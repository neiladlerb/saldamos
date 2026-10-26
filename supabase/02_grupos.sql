-- =====================================================================
--  MisGastosApp · Módulo GRUPOS (gastos compartidos y cobros por WhatsApp)
--  Ejecutar DESPUÉS de esquema.sql: SQL Editor → New query → pegar → Run.
--
--  Un grupo (p. ej. «Viaje concierto ACDC») guarda en una sola fila:
--    miembros      → [{id, nombre, telefono}]
--    gastos        → [{id, concepto, fecha, importe, pagos:[{miembro, importe}],
--                      reparto:{modo:"iguales"|"importes", miembros:[ids], importes:{id: céntimos}}}]
--    liquidaciones → [{id, de, a, importe, fecha}]   (pagos ya hechos entre miembros)
--  Importes siempre en CÉNTIMOS.
--
--  Enlace público: cada grupo tiene un código secreto corto (14 caracteres,
--  unos 80 bits de azar: imposible de adivinar) para enlaces del tipo /g/<código>.
--  Quien tenga el enlace puede VER el resumen del grupo (sin cuenta), pero
--  no modificarlo. El dueño puede desactivar el enlace o generar uno nuevo.
-- =====================================================================

-- Código corto y aleatorio para los enlaces (letras, números, - y _)
create or replace function public.nuevo_codigo()
returns text
language sql volatile
as $$
  select substr(translate(encode(uuid_send(gen_random_uuid()) || uuid_send(gen_random_uuid()), 'base64'), '+/=', '-_'), 1, 14);
$$;

create table if not exists public.grupos (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null default auth.uid() references auth.users (id) on delete cascade,
  nombre         text not null check (char_length(nombre) between 1 and 120),
  miembros       jsonb not null default '[]'::jsonb check (jsonb_typeof(miembros) = 'array'),
  gastos         jsonb not null default '[]'::jsonb check (jsonb_typeof(gastos) = 'array'),
  liquidaciones  jsonb not null default '[]'::jsonb check (jsonb_typeof(liquidaciones) = 'array'),
  token          text not null unique
                   default public.nuevo_codigo(),
  compartido     boolean not null default true,
  creado         timestamptz not null default now(),
  actualizado    timestamptz not null default now()
);
create index if not exists grupos_user_idx on public.grupos (user_id);

-- Fecha de última modificación automática
create or replace function public.marcar_actualizado()
returns trigger language plpgsql as $$
begin
  new.actualizado := now();
  return new;
end;
$$;
drop trigger if exists grupos_actualizado on public.grupos;
create trigger grupos_actualizado before update on public.grupos
  for each row execute function public.marcar_actualizado();

-- Seguridad: solo el dueño, con cuenta activa
alter table public.grupos enable row level security;
drop policy if exists "mis grupos" on public.grupos;
create policy "mis grupos" on public.grupos
  for all using (user_id = auth.uid() and public.soy_activo())
  with check (user_id = auth.uid() and public.soy_activo());

revoke all on public.grupos from anon;
-- El token no se puede elegir a mano: solo se cambia con grupo_nuevo_enlace()
revoke update on public.grupos from authenticated;
grant update (nombre, miembros, gastos, liquidaciones, compartido) on public.grupos to authenticated;
revoke insert on public.grupos from authenticated;
grant insert (nombre, miembros, gastos, liquidaciones, compartido) on public.grupos to authenticated;

-- Generar un enlace nuevo (el anterior deja de funcionar)
create or replace function public.grupo_nuevo_enlace(grupo uuid)
returns text
language plpgsql security definer set search_path = public
as $$
declare nuevo text := public.nuevo_codigo();
begin
  update public.grupos set token = nuevo
   where id = grupo and user_id = auth.uid() and public.soy_activo();
  if not found then raise exception 'No autorizado'; end if;
  return nuevo;
end;
$$;

-- Lectura pública por enlace (funciona SIN sesión iniciada)
create or replace function public.grupo_publico(t text)
returns json
language sql stable security definer set search_path = public
as $$
  select json_build_object(
           'nombre', g.nombre,
           -- los teléfonos NO se publican en el enlace
           'miembros', (select coalesce(jsonb_agg(m - 'telefono'), '[]'::jsonb) from jsonb_array_elements(g.miembros) m),
           'gastos', g.gastos,
           'liquidaciones', g.liquidaciones, 'actualizado', g.actualizado)
    from public.grupos g
    join public.perfiles p on p.id = g.user_id
   where g.token = t and g.compartido and p.estado = 'activo'
     and char_length(t) = 14;
$$;

revoke execute on function public.grupo_nuevo_enlace(uuid) from public, anon;
grant  execute on function public.grupo_nuevo_enlace(uuid) to authenticated;
grant  execute on function public.grupo_publico(text) to anon, authenticated;

-- El back office cuenta también los grupos (sin ver su contenido)
create or replace function public.admin_estadisticas()
returns json
language plpgsql stable security definer set search_path = public
as $$
begin
  if not public.soy_admin() then raise exception 'No autorizado'; end if;
  return json_build_object(
    'usuarios',         (select count(*) from public.perfiles),
    'nuevos_7d',        (select count(*) from public.perfiles where creado > now() - interval '7 days'),
    'nuevos_30d',       (select count(*) from public.perfiles where creado > now() - interval '30 days'),
    'activos_7d',       (select count(*) from auth.users where last_sign_in_at > now() - interval '7 days'),
    'bloqueados',       (select count(*) from public.perfiles where estado = 'bloqueado'),
    'sin_confirmar',    (select count(*) from auth.users where email_confirmed_at is null),
    'tareas',           (select count(*) from public.tareas),
    'gastos',           (select count(*) from public.gastos),
    'grupos',           (select count(*) from public.grupos),
    'altas_por_dia',    (select coalesce(json_agg(json_build_object('dia', dia, 'n', n) order by dia), '[]'::json)
                           from (select date_trunc('day', creado)::date as dia, count(*) as n
                                   from public.perfiles
                                  where creado > now() - interval '30 days'
                                  group by 1) d)
  );
end;
$$;
