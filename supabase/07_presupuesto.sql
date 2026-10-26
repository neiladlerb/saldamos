-- =====================================================================
--  07 · PRESUPUESTO COMPARTIDO (módulo Premium)
--  Para pareja, ex pareja con hijos, piso compartido…
--   · Presupuesto mensual y cuánto aporta cada persona (importe o %).
--   · Aportaciones registradas (las que llegan por el enlace, pendientes
--     hasta que el dueño las confirma).
--   · Gastos dentro del presupuesto (por categoría) y gastos EXTRA, que
--     necesitan la aprobación de la otra parte.
--   · Registro inalterable: solo se puede añadir, nunca borrar ni cambiar.
--   · La otra parte aprueba por enlace (sin cuenta) o con su propia cuenta
--     vinculada al grupo.
--  Ejecutar después de 06_deudas.sql. Se puede ejecutar más de una vez.
--  Importes en céntimos.
-- =====================================================================

-- ---------- Planes ----------
alter table public.perfiles add column if not exists plan text not null default 'gratis';
alter table public.perfiles drop constraint if exists perfiles_plan_valido;
alter table public.perfiles add constraint perfiles_plan_valido check (plan in ('gratis', 'premium', 'empresa'));
-- El usuario NO puede cambiarse el plan (solo nombre e ingresos); lo cambia un admin o, más adelante, el pago
grant update (nombre, ingresos_mensuales) on public.perfiles to authenticated;

create or replace function public.admin_cambiar_plan(usuario uuid, nuevo_plan text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.soy_admin() then raise exception 'No autorizado'; end if;
  if nuevo_plan not in ('gratis', 'premium', 'empresa') then raise exception 'Plan no válido'; end if;
  update public.perfiles set plan = nuevo_plan where id = usuario;
end;
$$;
revoke all on function public.admin_cambiar_plan(uuid, text) from public, anon;
grant execute on function public.admin_cambiar_plan(uuid, text) to authenticated;

create or replace function public.es_premium(u uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.perfiles where id = u and plan in ('premium', 'empresa'));
$$;

-- ---------- Columnas nuevas del grupo ----------
--  presupuesto → {mensual, inicio:"YYYY-MM", cuotas:{miembro: céntimos}, modo:"importe"|"pct",
--                 pct:{miembro: %}, categorias:[{nombre, importe}]}
--  aportes     → [{id, miembro, importe, fecha, nota, estado:"confirmado"|"pendiente", via}]
--  registro    → [{fecha (ISO), quien, accion, detalle}]  ← solo se añade
--  En gastos: presupuesto (bool), categoria, estado ("aprobado"|"pendiente"|"rechazado"|"anulado"),
--             propuesto_por, decision {por, fecha, comentario, via}, total_ticket
alter table public.grupos add column if not exists presupuesto jsonb;
alter table public.grupos add column if not exists aportes jsonb not null default '[]'::jsonb;
alter table public.grupos add column if not exists registro jsonb not null default '[]'::jsonb;
alter table public.grupos drop constraint if exists grupos_presupuesto_ok;
alter table public.grupos add constraint grupos_presupuesto_ok check (
  (presupuesto is null or jsonb_typeof(presupuesto) = 'object')
  and jsonb_typeof(aportes) = 'array' and jsonb_array_length(aportes) <= 2000
  and jsonb_typeof(registro) = 'array' and jsonb_array_length(registro) <= 5000);
grant update (presupuesto, aportes, registro) on public.grupos to authenticated;
grant insert (presupuesto) on public.grupos to authenticated;

-- ---------- Reglas: Premium y registro inalterable ----------
create or replace function public.grupos_reglas_presupuesto()
returns trigger language plpgsql as $$
declare n int;
begin
  -- Activar o cambiar el presupuesto es Premium
  if new.presupuesto is not null
     and (tg_op = 'INSERT' or new.presupuesto is distinct from old.presupuesto)
     and not public.es_premium(new.user_id) then
    raise exception 'El presupuesto compartido es una función Premium';
  end if;
  -- El registro solo crece: lo anterior no se puede tocar
  if tg_op = 'UPDATE' then
    n := jsonb_array_length(old.registro);
    if jsonb_array_length(new.registro) < n
       or (n > 0 and (select jsonb_agg(e order by i) from jsonb_array_elements(new.registro) with ordinality as x(e, i) where i <= n) <> old.registro) then
      raise exception 'El registro no se puede modificar, solo ampliar';
    end if;
  end if;
  return new;
end;
$$;
drop trigger if exists grupos_reglas_presupuesto on public.grupos;
create trigger grupos_reglas_presupuesto before insert or update on public.grupos
  for each row execute function public.grupos_reglas_presupuesto();

create or replace function public.euros(c bigint)
returns text language sql immutable as $$
  select replace(to_char(c::numeric / 100, 'FM9999999990.00'), '.', ',');
$$;

-- ---------- Cuentas vinculadas (la otra parte con su propia cuenta) ----------
create table if not exists public.grupo_cuentas (
  grupo_id   uuid not null references public.grupos(id) on delete cascade,
  user_id    uuid not null references auth.users(id) on delete cascade,
  miembro_id text not null check (char_length(miembro_id) between 1 and 64),
  creado     timestamptz not null default now(),
  primary key (grupo_id, user_id),
  unique (grupo_id, miembro_id)
);
alter table public.grupo_cuentas enable row level security;

-- Funciones auxiliares (security definer) para que las reglas no se llamen en bucle
create or replace function public.soy_dueno_grupo(gid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.grupos where id = gid and user_id = auth.uid());
$$;
create or replace function public.estoy_vinculado(gid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.grupo_cuentas where grupo_id = gid and user_id = auth.uid());
$$;
drop policy if exists "mis vinculos" on public.grupo_cuentas;
create policy "mis vinculos" on public.grupo_cuentas for select to authenticated
  using (user_id = auth.uid() or public.soy_dueno_grupo(grupo_id));
drop policy if exists "desvincular" on public.grupo_cuentas;
create policy "desvincular" on public.grupo_cuentas for delete to authenticated
  using (user_id = auth.uid() or public.soy_dueno_grupo(grupo_id));
revoke insert, update on public.grupo_cuentas from anon, authenticated;

-- Quien está vinculado puede VER el grupo (cambiarlo, solo con las funciones de abajo)
drop policy if exists "grupos vinculados" on public.grupos;
create policy "grupos vinculados" on public.grupos for select to authenticated
  using (public.soy_activo() and public.estoy_vinculado(id));

-- ---------- Funciones auxiliares ----------
-- Grupo por enlace, con dueño activo
create or replace function public.grupo_por_token(t text)
returns public.grupos language sql stable security definer set search_path = public as $$
  select g.* from public.grupos g join public.perfiles p on p.id = g.user_id
   where g.token = t and g.compartido and p.estado = 'activo' and char_length(t) = 14;
$$;
revoke all on function public.grupo_por_token(text) from public, anon, authenticated;

-- Quién actúa: si el usuario tiene cuenta vinculada a ese grupo, es SU persona y la vía es «cuenta»
create or replace function public.grupo_quien(g public.grupos, miembro text, out m text, out via text)
language plpgsql stable security definer set search_path = public as $$
begin
  select c.miembro_id into m from public.grupo_cuentas c where c.grupo_id = g.id and c.user_id = auth.uid();
  if m is not null then via := 'cuenta'; return; end if;
  if auth.uid() = g.user_id then
    select x ->> 'id' into m from jsonb_array_elements(g.miembros) x where coalesce((x ->> 'yo')::boolean, false) limit 1;
    via := 'cuenta'; return;
  end if;
  if not exists (select 1 from jsonb_array_elements(g.miembros) x where x ->> 'id' = miembro) then
    raise exception 'Persona no válida';
  end if;
  m := miembro; via := 'enlace';
end;
$$;
revoke all on function public.grupo_quien(public.grupos, text) from public, anon, authenticated;

create or replace function public.nombre_miembro(g public.grupos, id text)
returns text language sql immutable as $$
  select coalesce((select x ->> 'nombre' from jsonb_array_elements(g.miembros) x where x ->> 'id' = id limit 1), '?');
$$;

create or replace function public.entrada_registro(quien text, accion text, detalle text)
returns jsonb language sql stable as $$
  select jsonb_build_array(jsonb_build_object('fecha', to_char(now() at time zone 'Europe/Madrid', 'YYYY-MM-DD"T"HH24:MI:SS'),
                                              'quien', left(quien, 80), 'accion', left(accion, 60), 'detalle', left(coalesce(detalle, ''), 300)));
$$;

-- ---------- Acciones desde el enlace o con cuenta vinculada ----------

-- Aprobar o rechazar un gasto extra
create or replace function public.grupo_decidir(t text, gasto text, miembro text, decision text, comentario text default null)
returns json language plpgsql security definer set search_path = public as $$
declare g public.grupos; q record; x jsonb; idx int; nuevo jsonb;
begin
  select * into g from public.grupo_por_token(t);
  if g.id is null then raise exception 'Enlace no válido'; end if;
  if decision not in ('aprobado', 'rechazado') then raise exception 'Decisión no válida'; end if;
  if decision = 'rechazado' and coalesce(btrim(comentario), '') = '' then raise exception 'Explica por qué lo rechazas'; end if;
  select * into q from public.grupo_quien(g, miembro);
  select e, i - 1 into x, idx from jsonb_array_elements(g.gastos) with ordinality as a(e, i) where e ->> 'id' = gasto;
  if x is null then raise exception 'Gasto no encontrado'; end if;
  if coalesce(x ->> 'estado', '') <> 'pendiente' then raise exception 'Ese gasto ya está decidido'; end if;
  if x ->> 'propuesto_por' = q.m then raise exception 'No puedes aprobar un gasto que propusiste tú'; end if;
  nuevo := x || jsonb_build_object('estado', decision,
             'decision', jsonb_build_object('por', q.m, 'fecha', to_char(now() at time zone 'Europe/Madrid', 'YYYY-MM-DD"T"HH24:MI:SS'),
                                            'comentario', left(coalesce(comentario, ''), 300), 'via', q.via));
  update public.grupos
     set gastos = jsonb_set(gastos, array[idx::text], nuevo),
         registro = registro || public.entrada_registro(public.nombre_miembro(g, q.m),
                      case when decision = 'aprobado' then 'Aprueba extra' else 'Rechaza extra' end,
                      (x ->> 'concepto') || ' · ' || public.euros((x ->> 'importe')::bigint) || ' €'
                      || case when coalesce(comentario, '') <> '' then ' · «' || left(comentario, 200) || '»' else '' end
                      || ' (' || q.via || ')')
   where id = g.id;
  return json_build_object('ok', true);
end;
$$;

-- Proponer un gasto extra (queda pendiente de la otra parte)
create or replace function public.grupo_proponer_extra(t text, miembro text, concepto text, importe int, fecha date,
                                                       pagado_por text, comentario text default null)
returns json language plpgsql security definer set search_path = public as $$
declare g public.grupos; q record; pct jsonb; nuevo jsonb;
begin
  select * into g from public.grupo_por_token(t);
  if g.id is null then raise exception 'Enlace no válido'; end if;
  if g.presupuesto is null then raise exception 'Este grupo no tiene presupuesto'; end if;
  select * into q from public.grupo_quien(g, miembro);
  if coalesce(btrim(concepto), '') = '' or char_length(concepto) > 120 then raise exception 'Escribe el concepto'; end if;
  if importe is null or importe <= 0 or importe > 10000000 then raise exception 'Importe no válido'; end if;
  if not exists (select 1 from jsonb_array_elements(g.miembros) x where x ->> 'id' = pagado_por) then raise exception 'Persona no válida'; end if;
  if (select count(*) from jsonb_array_elements(g.gastos) e where e ->> 'estado' = 'pendiente') >= 30 then
    raise exception 'Hay demasiados gastos pendientes de aprobar';
  end if;
  pct := coalesce(g.presupuesto -> 'pct', '{}'::jsonb);
  nuevo := jsonb_build_object('id', replace(gen_random_uuid()::text, '-', ''), 'concepto', btrim(concepto),
             'fecha', coalesce(fecha, current_date)::text, 'importe', importe,
             'pagos', jsonb_build_array(jsonb_build_object('miembro', pagado_por, 'importe', importe)),
             'reparto', jsonb_build_object('modo', 'porcentaje', 'porcentajes', pct),
             'presupuesto', false, 'estado', 'pendiente', 'propuesto_por', q.m,
             'nota', left(coalesce(comentario, ''), 300), 'via', q.via);
  update public.grupos
     set gastos = gastos || jsonb_build_array(nuevo),
         registro = registro || public.entrada_registro(public.nombre_miembro(g, q.m), 'Propone extra',
                      btrim(concepto) || ' · ' || public.euros(importe) || ' € (' || q.via || ')')
   where id = g.id;
  return json_build_object('ok', true);
end;
$$;

-- Declarar una aportación al presupuesto (pendiente hasta que el dueño la confirma)
create or replace function public.grupo_declarar_aporte(t text, miembro text, importe int, fecha date, nota text default null)
returns json language plpgsql security definer set search_path = public as $$
declare g public.grupos; q record;
begin
  select * into g from public.grupo_por_token(t);
  if g.id is null then raise exception 'Enlace no válido'; end if;
  if g.presupuesto is null then raise exception 'Este grupo no tiene presupuesto'; end if;
  select * into q from public.grupo_quien(g, miembro);
  if importe is null or importe <= 0 or importe > 10000000 then raise exception 'Importe no válido'; end if;
  if (select count(*) from jsonb_array_elements(g.aportes) a where a ->> 'estado' = 'pendiente') >= 30 then
    raise exception 'Hay demasiadas aportaciones pendientes';
  end if;
  update public.grupos
     set aportes = aportes || jsonb_build_array(jsonb_build_object('id', replace(gen_random_uuid()::text, '-', ''),
                    'miembro', q.m, 'importe', importe, 'fecha', coalesce(fecha, current_date)::text,
                    'nota', left(coalesce(nota, ''), 200), 'estado', 'pendiente', 'via', q.via)),
         registro = registro || public.entrada_registro(public.nombre_miembro(g, q.m), 'Declara aportación',
                      public.euros(importe) || ' € (' || q.via || ')')
   where id = g.id;
  return json_build_object('ok', true);
end;
$$;

-- Vincular mi cuenta a una persona del grupo (para aprobar desde mi app)
create or replace function public.grupo_vincular(t text, miembro text)
returns json language plpgsql security definer set search_path = public as $$
declare g public.grupos;
begin
  if auth.uid() is null then raise exception 'Tienes que entrar con tu cuenta'; end if;
  select * into g from public.grupo_por_token(t);
  if g.id is null then raise exception 'Enlace no válido'; end if;
  if g.user_id = auth.uid() then raise exception 'Ya eres el dueño de este grupo'; end if;
  if not exists (select 1 from jsonb_array_elements(g.miembros) x where x ->> 'id' = miembro and not coalesce((x ->> 'yo')::boolean, false)) then
    raise exception 'Persona no válida';
  end if;
  if exists (select 1 from public.grupo_cuentas where grupo_id = g.id and miembro_id = miembro and user_id <> auth.uid()) then
    raise exception 'Esa persona ya está vinculada a otra cuenta';
  end if;
  insert into public.grupo_cuentas (grupo_id, user_id, miembro_id) values (g.id, auth.uid(), miembro)
    on conflict (grupo_id, user_id) do update set miembro_id = excluded.miembro_id;
  update public.grupos set registro = registro || public.entrada_registro(public.nombre_miembro(g, miembro), 'Vincula su cuenta', '')
   where id = g.id;
  return json_build_object('ok', true);
end;
$$;

revoke all on function public.grupo_decidir(text, text, text, text, text) from public;
revoke all on function public.grupo_proponer_extra(text, text, text, int, date, text, text) from public;
revoke all on function public.grupo_declarar_aporte(text, text, int, date, text) from public;
revoke all on function public.grupo_vincular(text, text) from public;
grant execute on function public.grupo_decidir(text, text, text, text, text) to anon, authenticated;
grant execute on function public.grupo_proponer_extra(text, text, text, int, date, text, text) to anon, authenticated;
grant execute on function public.grupo_declarar_aporte(text, text, int, date, text) to anon, authenticated;
grant execute on function public.grupo_vincular(text, text) to authenticated;

-- ---------- Enlace público: incluye presupuesto, aportaciones y registro ----------
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
           'actualizado', g.actualizado)
    from public.grupos g
    join public.perfiles p on p.id = g.user_id
   where g.token = t and g.compartido and p.estado = 'activo'
     and char_length(t) = 14;
$$;
