-- =====================================================================
--  08 · COBRAR CON BIZUM PAY (Redsys)
--  Quien cobra conecta SU TPV virtual (el que le da su banco, con Bizum
--  activado). Quien paga pulsa «Pagar con Bizum Pay» en el enlace del
--  grupo, confirma en la app de su banco y el dinero llega directo a la
--  cuenta de quien cobra. Saldamos nunca toca el dinero: solo inicia el
--  pago y, cuando Redsys avisa de que se ha pagado, lo apunta solo como
--  «pagado» en el grupo (conciliación automática).
--
--  Ejecutar DESPUÉS de 07_presupuesto.sql.
--  Lo usan las funciones del servidor /api/bizum-iniciar y
--  /api/bizum-notificacion (Vercel), con la clave service_role guardada
--  como variable de entorno en Vercel. NUNCA en js/config.js.
-- =====================================================================

-- ---------- 1 · El TPV de quien cobra ----------
create table if not exists public.tpv_cobro (
  user_id     uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  proveedor   text not null default 'redsys' check (proveedor in ('redsys')),
  comercio    text not null check (comercio ~ '^[0-9]{6,9}$'),         -- FUC / número de comercio
  terminal    text not null default '1' check (terminal ~ '^[0-9]{1,3}$'),
  clave       text not null check (char_length(clave) between 24 and 64), -- clave SHA-256 del TPV
  entorno     text not null default 'pruebas' check (entorno in ('pruebas', 'real')),
  activo      boolean not null default true,
  actualizado timestamptz not null default now()
);
alter table public.tpv_cobro enable row level security;
-- Nadie lee ni escribe la tabla directamente: solo con las funciones de abajo.
-- Así la clave del TPV no sale nunca hacia el navegador.
revoke all on public.tpv_cobro from anon, authenticated;

-- Guardar o cambiar mi TPV (la clave en blanco = dejar la que había)
create or replace function public.guardar_tpv(comercio text, terminal text, clave text, entorno text, activo boolean)
returns json language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'No autorizado'; end if;
  if exists (select 1 from public.tpv_cobro where user_id = auth.uid()) then
    update public.tpv_cobro t
       set comercio = guardar_tpv.comercio, terminal = coalesce(nullif(guardar_tpv.terminal, ''), '1'),
           clave = coalesce(nullif(btrim(guardar_tpv.clave), ''), t.clave),
           entorno = guardar_tpv.entorno, activo = guardar_tpv.activo, actualizado = now()
     where t.user_id = auth.uid();
  else
    if coalesce(btrim(clave), '') = '' then raise exception 'Escribe la clave de tu TPV'; end if;
    insert into public.tpv_cobro (user_id, comercio, terminal, clave, entorno, activo)
    values (auth.uid(), comercio, coalesce(nullif(terminal, ''), '1'), btrim(clave), entorno, activo);
  end if;
  return json_build_object('ok', true);
end;
$$;

-- Ver mi TPV sin la clave (solo sus 4 últimos caracteres)
create or replace function public.mi_tpv()
returns json language sql stable security definer set search_path = public as $$
  select json_build_object('comercio', comercio, 'terminal', terminal, 'entorno', entorno, 'activo', activo,
                           'clave_fin', right(clave, 4), 'actualizado', actualizado)
    from public.tpv_cobro where user_id = auth.uid();
$$;

create or replace function public.borrar_tpv()
returns void language sql security definer set search_path = public as $$
  delete from public.tpv_cobro where user_id = auth.uid();
$$;

revoke all on function public.guardar_tpv(text, text, text, text, boolean) from public, anon;
revoke all on function public.mi_tpv() from public, anon;
revoke all on function public.borrar_tpv() from public, anon;
grant execute on function public.guardar_tpv(text, text, text, text, boolean) to authenticated;
grant execute on function public.mi_tpv() to authenticated;
grant execute on function public.borrar_tpv() to authenticated;

-- ---------- 2 · Cada pago iniciado con Bizum Pay ----------
create table if not exists public.pagos_bizum (
  pedido       text primary key check (pedido ~ '^[0-9]{4}[0-9A-Za-z]{8}$'),  -- nº de pedido Redsys (12)
  grupo_id     uuid not null references public.grupos (id) on delete cascade,
  cobrador     uuid not null references auth.users (id) on delete cascade,
  de           text not null,
  a            text not null,
  importe      int not null check (importe between 50 and 1000000),           -- céntimos: 0,50 € a 10.000 €
  estado       text not null default 'iniciado' check (estado in ('iniciado', 'pagado', 'fallido')),
  respuesta    text,           -- Ds_Response de Redsys
  autorizacion text,           -- Ds_AuthorisationCode
  creado       timestamptz not null default now(),
  resuelto     timestamptz
);
create index if not exists pagos_bizum_grupo_idx on public.pagos_bizum (grupo_id, creado desc);
alter table public.pagos_bizum enable row level security;
revoke all on public.pagos_bizum from anon, authenticated;
grant select on public.pagos_bizum to authenticated;
drop policy if exists "mis cobros bizum" on public.pagos_bizum;
create policy "mis cobros bizum" on public.pagos_bizum for select using (cobrador = auth.uid());

-- ---------- 3 · Funciones que solo usa el servidor (service_role) ----------
-- Prepara un pago: comprueba el enlace, que quien cobra es el dueño del grupo
-- y tiene TPV activo, y devuelve los datos para firmar la orden de Redsys.
create or replace function public.bizum_preparar(t text, de text, a text, importe int)
returns json language plpgsql security definer set search_path = public as $$
declare g public.grupos; tp public.tpv_cobro; ped text; yo_id text; letras text := 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
begin
  select * into g from public.grupo_por_token(t);
  if g.id is null then raise exception 'Enlace no válido'; end if;
  select x ->> 'id' into yo_id from jsonb_array_elements(g.miembros) x where coalesce((x ->> 'yo')::boolean, false) limit 1;
  if a is distinct from yo_id then raise exception 'Esa persona no cobra con Bizum Pay'; end if;
  if de = a or not exists (select 1 from jsonb_array_elements(g.miembros) x where x ->> 'id' = de) then
    raise exception 'Persona no válida';
  end if;
  if importe is null or importe < 50 or importe > 1000000 then raise exception 'Importe no válido'; end if;
  select * into tp from public.tpv_cobro where user_id = g.user_id and activo;
  if tp.user_id is null then raise exception 'Esa persona no cobra con Bizum Pay'; end if;
  -- Anti-abuso: como mucho 20 pagos iniciados por grupo en una hora
  if (select count(*) from public.pagos_bizum p where p.grupo_id = g.id and p.creado > now() - interval '1 hour') >= 20 then
    raise exception 'Demasiados intentos. Prueba dentro de un rato';
  end if;
  ped := lpad((extract(epoch from now())::bigint % 10000)::text, 4, '0');
  for i in 1..8 loop ped := ped || substr(letras, 1 + floor(random() * length(letras))::int, 1); end loop;
  insert into public.pagos_bizum (pedido, grupo_id, cobrador, de, a, importe)
  values (ped, g.id, g.user_id, de, a, importe);
  return json_build_object('pedido', ped, 'comercio', tp.comercio, 'terminal', tp.terminal, 'clave', tp.clave,
                           'entorno', tp.entorno, 'concepto', left('Saldamos · ' || g.nombre, 120));
end;
$$;

-- La clave del TPV de un pedido (para comprobar la firma del aviso de Redsys)
create or replace function public.bizum_clave(pedido text)
returns text language sql stable security definer set search_path = public as $$
  select t.clave from public.pagos_bizum p join public.tpv_cobro t on t.user_id = p.cobrador
   where p.pedido = bizum_clave.pedido;
$$;

-- Resultado del pago (llamada desde el aviso firmado de Redsys). Si está
-- autorizado (Ds_Response 0000-0099) apunta el pago en el grupo, quita el
-- aviso «Ya he pagado» de esa pareja y lo deja en el registro. Idempotente.
create or replace function public.bizum_resultado(pedido text, respuesta text, autorizacion text, importe int)
returns json language plpgsql security definer set search_path = public as $$
declare p public.pagos_bizum; ok boolean;
begin
  select * into p from public.pagos_bizum x where x.pedido = bizum_resultado.pedido for update;
  if p.pedido is null then raise exception 'Pedido desconocido'; end if;
  if p.estado <> 'iniciado' then return json_build_object('ok', true, 'estado', p.estado, 'repetido', true); end if;
  ok := respuesta ~ '^[0-9]{1,4}$' and respuesta::int between 0 and 99 and importe = p.importe;
  update public.pagos_bizum x
     set estado = case when ok then 'pagado' else 'fallido' end, respuesta = bizum_resultado.respuesta,
         autorizacion = bizum_resultado.autorizacion, resuelto = now()
   where x.pedido = p.pedido;
  if ok then
    update public.grupos g
       set liquidaciones = g.liquidaciones || jsonb_build_array(jsonb_build_object(
             'id', 'bz' || p.pedido, 'de', p.de, 'a', p.a, 'importe', p.importe,
             'fecha', to_char(now() at time zone 'Europe/Madrid', 'YYYY-MM-DD'), 'via', 'bizum', 'pedido', p.pedido)),
           avisos = coalesce((select jsonb_agg(v) from jsonb_array_elements(g.avisos) v
                               where not (v ->> 'de' = p.de and v ->> 'a' = p.a)), '[]'::jsonb),
           registro = g.registro || public.entrada_registro(public.nombre_miembro(g, p.de), 'Paga con Bizum Pay',
                        public.euros(p.importe) || ' € a ' || public.nombre_miembro(g, p.a) || ' · pedido ' || p.pedido)
     where g.id = p.grupo_id;
  end if;
  return json_build_object('ok', true, 'estado', case when ok then 'pagado' else 'fallido' end);
end;
$$;

revoke all on function public.bizum_preparar(text, text, text, int) from public, anon, authenticated;
revoke all on function public.bizum_clave(text) from public, anon, authenticated;
revoke all on function public.bizum_resultado(text, text, text, int) from public, anon, authenticated;
grant execute on function public.bizum_preparar(text, text, text, int) to service_role;
grant execute on function public.bizum_clave(text) to service_role;
grant execute on function public.bizum_resultado(text, text, text, int) to service_role;

-- ---------- 4 · Para la página del enlace ----------
-- ¿Cómo va mi pago? (al volver de Bizum). Solo dice el estado, nada más.
create or replace function public.bizum_estado(t text, pedido text)
returns text language sql stable security definer set search_path = public as $$
  select p.estado from public.pagos_bizum p join public.grupos g on g.id = p.grupo_id
   where p.pedido = bizum_estado.pedido and g.token = t;
$$;
revoke all on function public.bizum_estado(text, text) from public;
grant execute on function public.bizum_estado(text, text) to anon, authenticated;

-- El enlace público dice si el dueño cobra con Bizum Pay (sin ningún dato del TPV)
create or replace function public.grupo_publico(t text)
returns json
language sql stable security definer set search_path = public
as $$
  select json_build_object(
           'nombre', g.nombre,
           'miembros', (select coalesce(jsonb_agg(
                          case when coalesce((m ->> 'mostrar_cobro')::boolean, false)
                               then m - 'mostrar_cobro'
                               else m - 'telefono' - 'iban' - 'mostrar_cobro' end), '[]'::jsonb)
                          from jsonb_array_elements(g.miembros) m),
           'gastos', g.gastos,
           'liquidaciones', g.liquidaciones,
           'avisos', g.avisos,
           'presupuesto', g.presupuesto,
           'aportes', g.aportes,
           'registro', g.registro,
           'yo_miembro', (select c.miembro_id from public.grupo_cuentas c where c.grupo_id = g.id and c.user_id = auth.uid()),
           'bizum_pay', exists (select 1 from public.tpv_cobro tp where tp.user_id = g.user_id and tp.activo),
           'actualizado', g.actualizado)
    from public.grupos g
    join public.perfiles p on p.id = g.user_id
   where g.token = t and g.compartido and p.estado = 'activo'
     and char_length(t) = 14;
$$;
