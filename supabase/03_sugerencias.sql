-- =====================================================================
--  MisGastosApp · SUGERENCIAS de los usuarios (alimentan el Lab de producto)
--  Ejecutar DESPUÉS de esquema.sql y 02_grupos.sql.
--  · Cada usuario envía y ve solo sus sugerencias.
--  · Los administradores las ven todas y solo pueden cambiar su estado.
-- =====================================================================

create table if not exists public.sugerencias (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  tipo        text not null default 'idea' check (tipo in ('idea', 'problema', 'elogio', 'pregunta')),
  puntuacion  int check (puntuacion between 1 and 5),
  texto       text not null check (char_length(texto) between 1 and 2000),
  pagina      text check (char_length(pagina) <= 40),
  estado      text not null default 'nueva' check (estado in ('nueva', 'revisada', 'en lab', 'descartada')),
  creado      timestamptz not null default now()
);
create index if not exists sugerencias_creado_idx on public.sugerencias (creado desc);

alter table public.sugerencias enable row level security;

drop policy if exists "enviar sugerencia" on public.sugerencias;
create policy "enviar sugerencia" on public.sugerencias
  for insert with check (user_id = auth.uid() and public.soy_activo());

drop policy if exists "ver sugerencias" on public.sugerencias;
create policy "ver sugerencias" on public.sugerencias
  for select using (user_id = auth.uid() or public.soy_admin());

drop policy if exists "gestionar sugerencias" on public.sugerencias;
create policy "gestionar sugerencias" on public.sugerencias
  for update using (public.soy_admin()) with check (public.soy_admin());

revoke all on public.sugerencias from anon;
revoke insert, update, delete on public.sugerencias from authenticated;
grant insert (tipo, puntuacion, texto, pagina) on public.sugerencias to authenticated;
grant update (estado) on public.sugerencias to authenticated;
grant select on public.sugerencias to authenticated;
