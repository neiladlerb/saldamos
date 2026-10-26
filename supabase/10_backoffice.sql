-- =====================================================================
--  10 · BACK OFFICE COMERCIAL
--   · Rol «comercial» (gestor comercial): ve el negocio, promociones y
--     campañas, pero no puede bloquear, borrar ni cambiar roles.
--   · Cuentas: cancelar (deja de poder entrar) y borrar definitivamente.
--     Crear cuentas lo hace la función de servidor /api/admin-usuarios
--     (necesita la clave secreta de Supabase para enviar la invitación).
--   · Pagos: registro de cobros por usuario (plan, importe, periodo, estado).
--   · Promociones: códigos (Premium gratis X días, descuento) e
--     «Invita a tus amigos» con un código personal por usuario.
--   · Campañas: propuestas del gestor comercial y su seguimiento.
--  Ejecutar después de 09_dimelo.sql. Se puede ejecutar más de una vez.
--  Importes en céntimos.
-- =====================================================================

-- ---------- Perfiles: rol comercial, cuenta cancelada, empresa e invitaciones ----------
alter table public.perfiles drop constraint if exists perfiles_rol_check;
alter table public.perfiles add constraint perfiles_rol_check check (rol in ('usuario', 'admin', 'comercial'));
alter table public.perfiles drop constraint if exists perfiles_estado_check;
alter table public.perfiles add constraint perfiles_estado_check check (estado in ('activo', 'bloqueado', 'cancelada'));
alter table public.perfiles add column if not exists empresa text;
alter table public.perfiles add column if not exists premium_hasta timestamptz;
alter table public.perfiles add column if not exists codigo_invitacion text unique;
alter table public.perfiles add column if not exists invitado_por uuid references public.perfiles (id) on delete set null;

-- Código personal para invitar: 8 caracteres fáciles de dictar (sin 0/O ni 1/I)
create or replace function public.nuevo_codigo(largo int default 8)
returns text language sql volatile as $$
  select string_agg(substr('ABCDEFGHJKLMNPQRSTUVWXYZ23456789', 1 + floor(random() * 32)::int, 1), '')
    from generate_series(1, largo);
$$;
update public.perfiles set codigo_invitacion = public.nuevo_codigo() where codigo_invitacion is null;

create or replace function public.soy_comercial()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.perfiles where id = auth.uid() and rol in ('admin', 'comercial') and estado = 'activo');
$$;

-- Premium por plan o por una promoción todavía vigente
create or replace function public.es_premium(u uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.perfiles where id = u and (plan in ('premium', 'empresa') or premium_hasta > now()));
$$;

-- ---------- Pagos ----------
create table if not exists public.pagos (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references public.perfiles (id) on delete cascade,
  plan           text not null check (plan in ('premium', 'empresa')),
  concepto       text not null default '' check (char_length(concepto) <= 200),
  importe        int not null check (importe >= 0 and importe <= 100000000),
  periodo_inicio date not null default current_date,
  periodo_fin    date,
  metodo         text not null default 'tarjeta' check (metodo in ('tarjeta', 'transferencia', 'bizum', 'domiciliacion', 'otro')),
  estado         text not null default 'pendiente' check (estado in ('pagado', 'pendiente', 'fallido', 'reembolsado')),
  referencia     text check (char_length(referencia) <= 120),
  creado         timestamptz not null default now(),
  creado_por     uuid references public.perfiles (id) on delete set null
);
alter table public.pagos enable row level security;
drop policy if exists "pagos: admin todo" on public.pagos;
create policy "pagos: admin todo" on public.pagos for all using (public.soy_admin()) with check (public.soy_admin());
drop policy if exists "pagos: el usuario ve los suyos" on public.pagos;
create policy "pagos: el usuario ve los suyos" on public.pagos for select using (user_id = auth.uid());
revoke all on public.pagos from anon;

-- ---------- Promociones y canjes ----------
create table if not exists public.promociones (
  id                    uuid primary key default gen_random_uuid(),
  codigo                text not null unique check (codigo ~ '^[A-Z0-9-]{3,24}$'),
  nombre                text not null check (char_length(nombre) between 1 and 120),
  tipo                  text not null check (tipo in ('invitacion', 'premium_gratis', 'descuento')),
  dias_premium          int not null default 0 check (dias_premium between 0 and 365),
  dias_premium_invitador int not null default 0 check (dias_premium_invitador between 0 and 365),
  descuento_pct         int not null default 0 check (descuento_pct between 0 and 100),
  inicio                date not null default current_date,
  fin                   date,
  max_usos              int check (max_usos > 0),
  usos                  int not null default 0,
  activa                boolean not null default true,
  creado                timestamptz not null default now()
);
create table if not exists public.canjes (
  id            uuid primary key default gen_random_uuid(),
  promocion_id  uuid not null references public.promociones (id) on delete cascade,
  user_id       uuid not null references public.perfiles (id) on delete cascade,
  invitador_id  uuid references public.perfiles (id) on delete set null,
  creado        timestamptz not null default now(),
  unique (promocion_id, user_id)
);
alter table public.promociones enable row level security;
alter table public.canjes enable row level security;
drop policy if exists "promociones: comercial todo" on public.promociones;
create policy "promociones: comercial todo" on public.promociones for all using (public.soy_comercial()) with check (public.soy_comercial());
drop policy if exists "canjes: comercial ve" on public.canjes;
create policy "canjes: comercial ve" on public.canjes for select using (public.soy_comercial() or user_id = auth.uid());
revoke all on public.promociones, public.canjes from anon;

-- ---------- Campañas ----------
create table if not exists public.campanas (
  id            uuid primary key default gen_random_uuid(),
  nombre        text not null check (char_length(nombre) between 1 and 160),
  segmento      text not null check (segmento in ('todos', 'gratis', 'gratis_activos', 'premium', 'empresa', 'inactivos', 'sin_confirmar', 'invitadores', 'empresas_potenciales')),
  canal         text not null check (canal in ('email', 'whatsapp', 'en_app', 'redes', 'contacto_directo')),
  mensaje       text not null default '' check (char_length(mensaje) <= 2000),
  motivo        text not null default '' check (char_length(motivo) <= 600),
  objetivo      text not null default '' check (char_length(objetivo) <= 300),
  promocion_id  uuid references public.promociones (id) on delete set null,
  estado        text not null default 'propuesta' check (estado in ('propuesta', 'aprobada', 'en_curso', 'terminada', 'descartada')),
  origen        text not null default 'manual' check (origen in ('gestor', 'manual')),
  alcance       int not null default 0,
  inicio        date,
  fin           date,
  creado        timestamptz not null default now(),
  creado_por    uuid references public.perfiles (id) on delete set null
);
alter table public.campanas enable row level security;
drop policy if exists "campanas: comercial todo" on public.campanas;
create policy "campanas: comercial todo" on public.campanas for all using (public.soy_comercial()) with check (public.soy_comercial());
revoke all on public.campanas from anon;

-- ---------- Altas: código propio e invitación ----------
create or replace function public.crear_perfil_nuevo_usuario()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  invitador uuid;
  promo public.promociones;
begin
  select id into invitador from public.perfiles
   where codigo_invitacion = upper(coalesce(new.raw_user_meta_data ->> 'invita', ''));
  insert into public.perfiles (id, email, nombre, acepta_privacidad_en, codigo_invitacion, invitado_por)
  values (
    new.id,
    coalesce(new.email, ''),
    coalesce(new.raw_user_meta_data ->> 'nombre', ''),
    case when (new.raw_user_meta_data ->> 'acepta_privacidad') = 'true' then now() end,
    public.nuevo_codigo(),
    invitador
  );
  -- Si viene invitado y hay una promoción de invitación activa, Premium gratis para los dos
  if invitador is not null then
    select * into promo from public.promociones
     where tipo = 'invitacion' and activa and inicio <= current_date and (fin is null or fin >= current_date)
       and (max_usos is null or usos < max_usos)
     order by creado desc limit 1;
    if found then
      insert into public.canjes (promocion_id, user_id, invitador_id) values (promo.id, new.id, invitador);
      update public.promociones set usos = usos + 1 where id = promo.id;
      update public.perfiles set premium_hasta = greatest(coalesce(premium_hasta, now()), now()) + make_interval(days => promo.dias_premium) where id = new.id and promo.dias_premium > 0;
      update public.perfiles set premium_hasta = greatest(coalesce(premium_hasta, now()), now()) + make_interval(days => promo.dias_premium_invitador) where id = invitador and promo.dias_premium_invitador > 0;
    end if;
  end if;
  return new;
end;
$$;

-- ---------- El usuario: mi invitación y canjear un código ----------
create or replace function public.mi_invitacion()
returns json language plpgsql stable security definer set search_path = public as $$
declare promo public.promociones;
begin
  if auth.uid() is null then raise exception 'No hay sesión'; end if;
  select * into promo from public.promociones
   where tipo = 'invitacion' and activa and inicio <= current_date and (fin is null or fin >= current_date)
     and (max_usos is null or usos < max_usos)
   order by creado desc limit 1;
  return json_build_object(
    'codigo', (select codigo_invitacion from public.perfiles where id = auth.uid()),
    'invitados', (select count(*) from public.perfiles where invitado_por = auth.uid()),
    'premium_hasta', (select premium_hasta from public.perfiles where id = auth.uid()),
    'promo', case when promo.id is null then null else json_build_object('nombre', promo.nombre, 'dias', promo.dias_premium, 'dias_invitador', promo.dias_premium_invitador, 'fin', promo.fin) end
  );
end;
$$;

create or replace function public.canjear_codigo(codigo text)
returns json language plpgsql security definer set search_path = public as $$
declare promo public.promociones;
begin
  if auth.uid() is null or not public.soy_activo() then raise exception 'No hay sesión'; end if;
  select * into promo from public.promociones p
   where p.codigo = upper(trim(canjear_codigo.codigo)) and p.tipo <> 'invitacion' and p.activa
     and p.inicio <= current_date and (p.fin is null or p.fin >= current_date) and (p.max_usos is null or p.usos < p.max_usos);
  if not found then raise exception 'Código no válido o caducado'; end if;
  if exists (select 1 from public.canjes where promocion_id = promo.id and user_id = auth.uid()) then raise exception 'Ya has usado este código'; end if;
  insert into public.canjes (promocion_id, user_id) values (promo.id, auth.uid());
  update public.promociones set usos = usos + 1 where id = promo.id;
  if promo.dias_premium > 0 then
    update public.perfiles set premium_hasta = greatest(coalesce(premium_hasta, now()), now()) + make_interval(days => promo.dias_premium) where id = auth.uid();
  end if;
  return json_build_object('nombre', promo.nombre, 'dias', promo.dias_premium, 'descuento', promo.descuento_pct);
end;
$$;

-- ---------- Back office: negocio, usuarios y cuentas ----------
create or replace function public.admin_negocio()
returns json language plpgsql stable security definer set search_path = public as $$
begin
  if not public.soy_comercial() then raise exception 'No autorizado'; end if;
  return json_build_object(
    'usuarios',        (select count(*) from public.perfiles),
    'activas',         (select count(*) from public.perfiles where estado = 'activo'),
    'canceladas',      (select count(*) from public.perfiles where estado = 'cancelada'),
    'bloqueadas',      (select count(*) from public.perfiles where estado = 'bloqueado'),
    'gratis',          (select count(*) from public.perfiles where estado = 'activo' and plan = 'gratis' and not coalesce(premium_hasta > now(), false)),
    'premium',         (select count(*) from public.perfiles where estado = 'activo' and plan = 'premium'),
    'premium_promo',   (select count(*) from public.perfiles where estado = 'activo' and plan = 'gratis' and premium_hasta > now()),
    'empresa',         (select count(*) from public.perfiles where estado = 'activo' and plan = 'empresa'),
    'empresas',        (select count(distinct lower(empresa)) from public.perfiles where plan = 'empresa' and coalesce(empresa, '') <> ''),
    'nuevos_30d',      (select count(*) from public.perfiles where creado > now() - interval '30 days'),
    'activos_7d',      (select count(*) from auth.users where last_sign_in_at > now() - interval '7 days'),
    'gratis_activos_7d', (select count(*) from public.perfiles p join auth.users u on u.id = p.id
                            where p.plan = 'gratis' and p.estado = 'activo' and u.last_sign_in_at > now() - interval '7 days'),
    'inactivos_30d',   (select count(*) from public.perfiles p join auth.users u on u.id = p.id
                            where p.estado = 'activo' and coalesce(u.last_sign_in_at, p.creado) < now() - interval '30 days'),
    'sin_confirmar',   (select count(*) from auth.users where email_confirmed_at is null),
    'invitados',       (select count(*) from public.perfiles where invitado_por is not null),
    'invitadores',     (select count(distinct invitado_por) from public.perfiles where invitado_por is not null),
    'ingresos_mes',    (select coalesce(sum(importe), 0) from public.pagos where estado = 'pagado' and date_trunc('month', periodo_inicio) = date_trunc('month', current_date)),
    'ingresos_30d',    (select coalesce(sum(importe), 0) from public.pagos where estado = 'pagado' and creado > now() - interval '30 days'),
    'pendiente',       (select coalesce(sum(importe), 0) from public.pagos where estado = 'pendiente'),
    'n_pendientes',    (select count(*) from public.pagos where estado = 'pendiente'),
    'n_fallidos',      (select count(*) from public.pagos where estado = 'fallido' and creado > now() - interval '30 days'),
    'grupos',          (select count(*) from public.grupos),
    'grupos_compartidos', (select count(*) from public.grupos where compartido)
  );
end;
$$;

-- Lista de usuarios para el back office (plan, empresa, invitaciones y pagos; nunca el contenido)
drop function if exists public.admin_listar_usuarios();
create or replace function public.admin_listar_usuarios()
returns table (
  id uuid, email text, nombre text, rol text, estado text, plan text, empresa text, premium_hasta timestamptz,
  creado timestamptz, ultimo_acceso timestamptz, email_confirmado boolean,
  n_tareas bigint, n_gastos bigint, n_invitados bigint, pagado bigint
)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.soy_comercial() then raise exception 'No autorizado'; end if;
  return query
    select p.id, p.email, p.nombre, p.rol, p.estado, p.plan, p.empresa, p.premium_hasta, p.creado,
           u.last_sign_in_at, (u.email_confirmed_at is not null),
           (select count(*) from public.tareas t where t.user_id = p.id),
           (select count(*) from public.gastos g where g.user_id = p.id),
           (select count(*) from public.perfiles i where i.invitado_por = p.id),
           (select coalesce(sum(x.importe), 0) from public.pagos x where x.user_id = p.id and x.estado = 'pagado')
      from public.perfiles p
      join auth.users u on u.id = p.id
     order by p.creado desc;
end;
$$;

create or replace function public.admin_cambiar_estado(usuario uuid, nuevo_estado text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.soy_admin() then raise exception 'No autorizado'; end if;
  if usuario = auth.uid() then raise exception 'No puedes cambiar tu propio estado'; end if;
  if nuevo_estado not in ('activo', 'bloqueado', 'cancelada') then raise exception 'Estado no válido'; end if;
  update public.perfiles set estado = nuevo_estado where id = usuario;
end;
$$;

create or replace function public.admin_cambiar_rol(usuario uuid, nuevo_rol text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.soy_admin() then raise exception 'No autorizado'; end if;
  if usuario = auth.uid() then raise exception 'No puedes cambiar tu propio rol'; end if;
  if nuevo_rol not in ('usuario', 'admin', 'comercial') then raise exception 'Rol no válido'; end if;
  update public.perfiles set rol = nuevo_rol where id = usuario;
end;
$$;

drop function if exists public.admin_cambiar_plan(uuid, text);   -- la versión de 07 sin empresa
create or replace function public.admin_cambiar_plan(usuario uuid, nuevo_plan text, nueva_empresa text default null)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.soy_admin() then raise exception 'No autorizado'; end if;
  if nuevo_plan not in ('gratis', 'premium', 'empresa') then raise exception 'Plan no válido'; end if;
  update public.perfiles set plan = nuevo_plan,
         empresa = case when nuevo_plan = 'empresa' then nullif(trim(coalesce(nueva_empresa, empresa, '')), '') else empresa end
   where id = usuario;
end;
$$;

-- Borrar definitivamente (se borran en cascada todos sus datos)
create or replace function public.admin_borrar_usuario(usuario uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.soy_admin() then raise exception 'No autorizado'; end if;
  if usuario = auth.uid() then raise exception 'No puedes borrarte a ti mismo desde aquí'; end if;
  delete from auth.users where id = usuario;
end;
$$;

-- El gráfico de altas también lo ve el rol comercial
create or replace function public.admin_estadisticas()
returns json language plpgsql stable security definer set search_path = public as $$
begin
  if not public.soy_comercial() then raise exception 'No autorizado'; end if;
  return json_build_object(
    'usuarios',      (select count(*) from public.perfiles),
    'nuevos_7d',     (select count(*) from public.perfiles where creado > now() - interval '7 days'),
    'nuevos_30d',    (select count(*) from public.perfiles where creado > now() - interval '30 days'),
    'activos_7d',    (select count(*) from auth.users where last_sign_in_at > now() - interval '7 days'),
    'bloqueados',    (select count(*) from public.perfiles where estado = 'bloqueado'),
    'sin_confirmar', (select count(*) from auth.users where email_confirmed_at is null),
    'tareas',        (select count(*) from public.tareas),
    'gastos',        (select count(*) from public.gastos),
    'altas_por_dia', (select coalesce(json_agg(json_build_object('dia', dia, 'n', n) order by dia), '[]'::json)
                       from (select date_trunc('day', creado)::date as dia, count(*) as n from public.perfiles
                              where creado > now() - interval '30 days' group by 1) d)
  );
end;
$$;

-- Quién puede llamar a cada función
revoke all on function public.admin_negocio(), public.admin_listar_usuarios(), public.admin_cambiar_estado(uuid, text),
  public.admin_cambiar_rol(uuid, text), public.admin_cambiar_plan(uuid, text, text), public.admin_borrar_usuario(uuid),
  public.mi_invitacion(), public.canjear_codigo(text), public.nuevo_codigo(int) from public, anon;
grant execute on function public.admin_negocio(), public.admin_listar_usuarios(), public.admin_cambiar_estado(uuid, text),
  public.admin_cambiar_rol(uuid, text), public.admin_cambiar_plan(uuid, text, text), public.admin_borrar_usuario(uuid),
  public.mi_invitacion(), public.canjear_codigo(text), public.soy_comercial() to authenticated;
grant select, insert, update, delete on public.pagos, public.promociones, public.campanas to authenticated;
grant select on public.canjes to authenticated;
-- El usuario solo puede leer de su perfil lo que necesita la app (no puede cambiarse plan ni premium)
grant select on public.perfiles to authenticated;
