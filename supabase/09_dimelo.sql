-- =====================================================================
--  09 · «DÍMELO» CON IA (Premium / Empresas)
--  La frase se interpreta en el servidor (/api/dimelo) con Claude.
--  Aquí solo se lleva la cuenta de cuántas frases usa cada persona al
--  día (para el límite y para conocer el coste). NO se guarda el texto.
--  Ejecutar DESPUÉS de 08_bizum.sql.
-- =====================================================================
create table if not exists public.dimelo_uso (
  user_id uuid not null references auth.users (id) on delete cascade,
  dia     date not null default current_date,
  n       int  not null default 0,
  primary key (user_id, dia)
);
alter table public.dimelo_uso enable row level security;
revoke all on public.dimelo_uso from anon, authenticated;

-- ¿Puede usar la IA? Premium o Empresas, cuenta activa y por debajo del límite diario.
-- Si puede, suma una frase. Solo la llama el servidor (service_role).
create or replace function public.dimelo_permitir(u uuid, limite int default 300)
returns json language plpgsql security definer set search_path = public as $$
declare p public.perfiles; usados int;
begin
  select * into p from public.perfiles where id = u;
  if p.id is null or p.estado <> 'activo' then raise exception 'No autorizado'; end if;
  if coalesce(p.plan, 'gratis') not in ('premium', 'empresa') then raise exception 'Solo Premium'; end if;
  insert into public.dimelo_uso (user_id, dia, n) values (u, current_date, 1)
    on conflict (user_id, dia) do update set n = public.dimelo_uso.n + 1
    returning n into usados;
  if usados > limite then raise exception 'Límite diario'; end if;
  return json_build_object('ok', true, 'plan', p.plan, 'usados', usados);
end;
$$;
revoke all on function public.dimelo_permitir(uuid, int) from public, anon, authenticated;
grant execute on function public.dimelo_permitir(uuid, int) to service_role;

-- Para el back office: frases con IA en los últimos 30 días (sin ver nada de nadie)
create or replace function public.admin_uso_dimelo()
returns json language plpgsql stable security definer set search_path = public as $$
begin
  if not public.soy_admin() then raise exception 'No autorizado'; end if;
  return json_build_object('frases_30d', coalesce((select sum(n) from public.dimelo_uso where dia > current_date - 30), 0),
                           'personas_30d', (select count(distinct user_id) from public.dimelo_uso where dia > current_date - 30));
end;
$$;
revoke all on function public.admin_uso_dimelo() from public, anon;
grant execute on function public.admin_uso_dimelo() to authenticated;
