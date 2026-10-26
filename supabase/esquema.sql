-- =====================================================================
--  MisGastosApp · Esquema de base de datos para Supabase
--  Cómo usarlo: en Supabase → SQL Editor → New query → pega TODO este
--  archivo → Run. Se puede ejecutar una sola vez en un proyecto nuevo.
--
--  Idea clave de seguridad (RLS = Row Level Security):
--  la base de datos comprueba en CADA consulta quién está conectado,
--  y solo le deja ver/cambiar SUS filas. Aunque alguien manipulara la
--  página web, la base de datos no le daría datos de otra persona.
--
--  Privacidad: los administradores NO ven las tareas ni los gastos de
--  los usuarios. El back office solo ve datos de cuenta y recuentos.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. SPONSORS (preparado para el futuro modelo de marca blanca).
--    Hoy no se usa: todos los usuarios tienen sponsor_id vacío.
-- ---------------------------------------------------------------------
create table if not exists public.sponsors (
  id          uuid primary key default gen_random_uuid(),
  nombre      text not null,
  activo      boolean not null default true,
  creado      timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- 2. PERFILES: una fila por cada usuario registrado.
--    Supabase guarda email y contraseña en su tabla interna auth.users;
--    aquí guardamos lo nuestro: nombre, rol y estado.
-- ---------------------------------------------------------------------
create table if not exists public.perfiles (
  id              uuid primary key references auth.users (id) on delete cascade,
  email           text not null,
  nombre          text not null default '',
  rol             text not null default 'usuario' check (rol in ('usuario', 'admin')),
  estado          text not null default 'activo'  check (estado in ('activo', 'bloqueado')),
  sponsor_id      uuid references public.sponsors (id) on delete set null,
  acepta_privacidad_en timestamptz,
  creado          timestamptz not null default now()
);

-- Al registrarse alguien, se le crea su perfil automáticamente.
create or replace function public.crear_perfil_nuevo_usuario()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.perfiles (id, email, nombre, acepta_privacidad_en)
  values (
    new.id,
    coalesce(new.email, ''),
    coalesce(new.raw_user_meta_data ->> 'nombre', ''),
    case when (new.raw_user_meta_data ->> 'acepta_privacidad') = 'true' then now() end
  );
  return new;
end;
$$;

drop trigger if exists al_crear_usuario on auth.users;
create trigger al_crear_usuario
  after insert on auth.users
  for each row execute function public.crear_perfil_nuevo_usuario();

-- ---------------------------------------------------------------------
-- 3. FUNCIONES DE AYUDA para las reglas de seguridad.
--    "security definer" = se ejecutan con permisos del sistema, para
--    poder leer el perfil sin entrar en un bucle de reglas.
-- ---------------------------------------------------------------------
create or replace function public.soy_activo()
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (select 1 from public.perfiles where id = auth.uid() and estado = 'activo');
$$;

create or replace function public.soy_admin()
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (select 1 from public.perfiles where id = auth.uid() and rol = 'admin' and estado = 'activo');
$$;

-- ---------------------------------------------------------------------
-- 4. TAREAS y GASTOS: cada fila pertenece a un usuario (user_id).
-- ---------------------------------------------------------------------
create table if not exists public.tareas (
  id        uuid primary key default gen_random_uuid(),
  user_id   uuid not null default auth.uid() references auth.users (id) on delete cascade,
  texto     text not null check (char_length(texto) between 1 and 500),
  fecha     date,
  hora      time,
  hecha     boolean not null default false,
  avisada   boolean not null default false,
  creada    timestamptz not null default now()
);
create index if not exists tareas_user_idx on public.tareas (user_id);

-- Un gasto guarda su desglose en "lineas" (lista JSON), igual que en el
-- prototipo: [{item, persona, importe (céntimos), tipo, saldado}]
create table if not exists public.gastos (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  concepto   text not null check (char_length(concepto) between 1 and 200),
  fecha      date not null default current_date,
  categoria  text not null default 'Otros',
  lineas     jsonb not null default '[]'::jsonb check (jsonb_typeof(lineas) = 'array'),
  creado     timestamptz not null default now()
);
create index if not exists gastos_user_idx on public.gastos (user_id);

-- ---------------------------------------------------------------------
-- 5. REGLAS DE SEGURIDAD (RLS)
-- ---------------------------------------------------------------------
alter table public.sponsors enable row level security;
alter table public.perfiles enable row level security;
alter table public.tareas   enable row level security;
alter table public.gastos   enable row level security;

-- Perfiles: cada uno ve el suyo; los admins ven todos.
drop policy if exists "ver mi perfil" on public.perfiles;
create policy "ver mi perfil" on public.perfiles
  for select using (id = auth.uid() or public.soy_admin());

-- Cada uno puede cambiar SOLO su nombre (no su rol ni su estado):
drop policy if exists "editar mi perfil" on public.perfiles;
create policy "editar mi perfil" on public.perfiles
  for update using (id = auth.uid()) with check (id = auth.uid());
revoke update on public.perfiles from anon, authenticated;
grant  update (nombre) on public.perfiles to authenticated;
revoke insert, delete on public.perfiles from anon, authenticated;

-- Tareas y gastos: solo el dueño, y solo si su cuenta está activa.
drop policy if exists "mis tareas" on public.tareas;
create policy "mis tareas" on public.tareas
  for all using (user_id = auth.uid() and public.soy_activo())
  with check (user_id = auth.uid() and public.soy_activo());

drop policy if exists "mis gastos" on public.gastos;
create policy "mis gastos" on public.gastos
  for all using (user_id = auth.uid() and public.soy_activo())
  with check (user_id = auth.uid() and public.soy_activo());

-- Sponsors: solo administradores.
drop policy if exists "sponsors admin" on public.sponsors;
create policy "sponsors admin" on public.sponsors
  for all using (public.soy_admin()) with check (public.soy_admin());

-- Los visitantes sin sesión (anon) no tocan ninguna tabla.
revoke all on public.tareas, public.gastos, public.sponsors from anon;

-- ---------------------------------------------------------------------
-- 6. FUNCIONES DEL BACK OFFICE (solo administradores)
--    Devuelven datos de cuenta y recuentos, nunca el contenido.
-- ---------------------------------------------------------------------
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
    'altas_por_dia',    (select coalesce(json_agg(json_build_object('dia', dia, 'n', n) order by dia), '[]'::json)
                           from (select date_trunc('day', creado)::date as dia, count(*) as n
                                   from public.perfiles
                                  where creado > now() - interval '30 days'
                                  group by 1) d)
  );
end;
$$;

create or replace function public.admin_listar_usuarios()
returns table (
  id uuid, email text, nombre text, rol text, estado text,
  creado timestamptz, ultimo_acceso timestamptz, email_confirmado boolean,
  n_tareas bigint, n_gastos bigint
)
language plpgsql stable security definer set search_path = public
as $$
begin
  if not public.soy_admin() then raise exception 'No autorizado'; end if;
  return query
    select p.id, p.email, p.nombre, p.rol, p.estado, p.creado,
           u.last_sign_in_at, (u.email_confirmed_at is not null),
           (select count(*) from public.tareas t where t.user_id = p.id),
           (select count(*) from public.gastos g where g.user_id = p.id)
      from public.perfiles p
      join auth.users u on u.id = p.id
     order by p.creado desc;
end;
$$;

create or replace function public.admin_cambiar_estado(usuario uuid, nuevo_estado text)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  if not public.soy_admin() then raise exception 'No autorizado'; end if;
  if usuario = auth.uid() then raise exception 'No puedes cambiar tu propio estado'; end if;
  if nuevo_estado not in ('activo', 'bloqueado') then raise exception 'Estado no válido'; end if;
  update public.perfiles set estado = nuevo_estado where id = usuario;
end;
$$;

create or replace function public.admin_cambiar_rol(usuario uuid, nuevo_rol text)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  if not public.soy_admin() then raise exception 'No autorizado'; end if;
  if usuario = auth.uid() then raise exception 'No puedes cambiar tu propio rol'; end if;
  if nuevo_rol not in ('usuario', 'admin') then raise exception 'Rol no válido'; end if;
  update public.perfiles set rol = nuevo_rol where id = usuario;
end;
$$;

-- ---------------------------------------------------------------------
-- 7. DERECHO DE SUPRESIÓN (RGPD): cada usuario puede borrar su cuenta.
--    Al borrar el usuario se borran en cascada perfil, tareas y gastos.
-- ---------------------------------------------------------------------
create or replace function public.borrar_mi_cuenta()
returns void
language plpgsql security definer set search_path = public
as $$
begin
  if auth.uid() is null then raise exception 'No hay sesión'; end if;
  delete from auth.users where id = auth.uid();
end;
$$;

-- Quién puede llamar a cada función
revoke execute on function public.admin_estadisticas(), public.admin_listar_usuarios(),
  public.admin_cambiar_estado(uuid, text), public.admin_cambiar_rol(uuid, text),
  public.borrar_mi_cuenta(), public.crear_perfil_nuevo_usuario() from public, anon;
grant execute on function public.admin_estadisticas(), public.admin_listar_usuarios(),
  public.admin_cambiar_estado(uuid, text), public.admin_cambiar_rol(uuid, text),
  public.borrar_mi_cuenta(), public.soy_activo(), public.soy_admin() to authenticated;

-- =====================================================================
-- 8. PRIMER ADMINISTRADOR (ejecutar DESPUÉS de registrarte en la app).
--    Cambia el email por el tuyo y ejecuta solo esta línea:
--
--    update public.perfiles set rol = 'admin' where email = 'tu@email.com';
-- =====================================================================
