-- =====================================================================
--  06 · MIS DEUDAS Y CRÉDITOS
--  Préstamos, hipoteca, créditos de consumo, tarjeta en cuotas…
--  Para ver cuánto debes en total y cuánto pagas cada mes (liquidez).
--  Ejecutar después de 05_compromisos.sql. Se puede ejecutar más de una vez.
--  Importes siempre en céntimos.
-- =====================================================================

create table if not exists public.deudas (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null default auth.uid() references auth.users(id) on delete cascade,
  nombre           text not null check (char_length(nombre) between 1 and 80),
  tipo             text not null default 'prestamo'
                   check (tipo in ('hipoteca','prestamo','consumo','tarjeta','comercial','otro')),
  entidad          text check (char_length(entidad) <= 60),
  importe_original bigint check (importe_original is null or importe_original > 0),
  saldo            bigint not null check (saldo >= 0),            -- lo que queda por pagar hoy
  cuota            bigint not null check (cuota > 0),             -- cargo mensual
  tae              numeric(6,3) not null default 0 check (tae >= 0 and tae < 100),
  dia_pago         smallint not null default 1 check (dia_pago between 1 and 31),
  pagos            jsonb not null default '[]'::jsonb,            -- [{fecha, importe, capital, interes}]
  activa           boolean not null default true,
  creado           timestamptz not null default now(),
  actualizado      timestamptz not null default now()
);

create index if not exists deudas_user_idx on public.deudas (user_id);

alter table public.deudas enable row level security;

-- Cada uno ve y gestiona solo sus deudas (y solo si su cuenta está activa)
drop policy if exists "mis deudas" on public.deudas;
create policy "mis deudas" on public.deudas
  for all to authenticated
  using (user_id = auth.uid() and public.soy_activo())
  with check (user_id = auth.uid() and public.soy_activo());

-- Límite razonable de tamaño del historial de pagos
alter table public.deudas drop constraint if exists deudas_pagos_tam;
alter table public.deudas add constraint deudas_pagos_tam
  check (jsonb_typeof(pagos) = 'array' and jsonb_array_length(pagos) <= 600);

-- Ingresos netos al mes (opcional): sirve para calcular qué % de tus ingresos se va en deudas
alter table public.perfiles add column if not exists ingresos_mensuales bigint
  check (ingresos_mensuales is null or ingresos_mensuales >= 0);
grant update (nombre, ingresos_mensuales) on public.perfiles to authenticated;

-- Las estadísticas del back office solo cuentan deudas, nunca importes
create or replace function public.admin_contar_deudas()
returns bigint language sql security definer set search_path = public as $$
  select case when public.soy_admin() then (select count(*) from public.deudas) else null end;
$$;
revoke all on function public.admin_contar_deudas() from public, anon;
grant execute on function public.admin_contar_deudas() to authenticated;

-- Datos del ticket escaneado (para tener registro): comercio, nº, NIF, total…
-- La foto no se guarda: se lee en el móvil y solo se guardan estos datos.
alter table public.gastos add column if not exists ticket jsonb;
alter table public.gastos drop constraint if exists gastos_ticket_tam;
alter table public.gastos add constraint gastos_ticket_tam
  check (ticket is null or (jsonb_typeof(ticket) = 'object' and pg_column_size(ticket) < 4000));
