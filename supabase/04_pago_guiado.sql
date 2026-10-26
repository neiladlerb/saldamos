-- =====================================================================
--  MisGastosApp · PAGO GUIADO (ruta 0: el dinero nunca pasa por la app)
--  Ejecutar DESPUÉS de esquema.sql, 02_grupos.sql y 03_sugerencias.sql.
--
--  · Cada persona del grupo puede tener datos de cobro: Bizum (teléfono)
--    e IBAN. Solo se muestran en el enlace público si se marca
--    "mostrar_cobro" para esa persona.
--  · Quien abre el enlace puede avisar "Ya he pagado". El aviso queda
--    pendiente hasta que el dueño del grupo lo confirma o lo rechaza.
-- =====================================================================

alter table public.grupos add column if not exists avisos jsonb not null default '[]'::jsonb
  check (jsonb_typeof(avisos) = 'array');

-- El dueño puede confirmar o rechazar (es decir, reescribir la lista de avisos)
grant update (avisos) on public.grupos to authenticated;

-- El enlace público: los teléfonos e IBAN solo salen si se autorizó
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
           'actualizado', g.actualizado)
    from public.grupos g
    join public.perfiles p on p.id = g.user_id
   where g.token = t and g.compartido and p.estado = 'activo'
     and char_length(t) = 14;
$$;

-- "Ya he pagado" desde el enlace (sin cuenta). Solo deja un aviso pendiente.
create or replace function public.grupo_avisar_pago(t text, de text, a text, importe int)
returns json
language plpgsql security definer set search_path = public
as $$
declare g public.grupos;
begin
  select gr.* into g from public.grupos gr
    join public.perfiles p on p.id = gr.user_id
   where gr.token = t and gr.compartido and p.estado = 'activo' and char_length(t) = 14;
  if not found then raise exception 'Enlace no válido'; end if;
  if de = a or importe is null or importe <= 0 or importe > 1000000 then raise exception 'Datos no válidos'; end if;
  if not exists (select 1 from jsonb_array_elements(g.miembros) m where m ->> 'id' = de)
     or not exists (select 1 from jsonb_array_elements(g.miembros) m where m ->> 'id' = a) then
    raise exception 'Persona no válida';
  end if;
  -- Límite anti-abuso: como mucho 50 avisos pendientes por grupo
  if jsonb_array_length(g.avisos) >= 50 then raise exception 'Demasiados avisos pendientes'; end if;
  -- Un aviso por pareja: si ya existe, no se duplica
  if exists (select 1 from jsonb_array_elements(g.avisos) v where v ->> 'de' = de and v ->> 'a' = a) then
    return json_build_object('ok', true, 'repetido', true);
  end if;
  update public.grupos
     set avisos = avisos || jsonb_build_array(jsonb_build_object(
           'id', replace(gen_random_uuid()::text, '-', ''), 'de', de, 'a', a,
           'importe', importe, 'fecha', to_char(now(), 'YYYY-MM-DD')))
   where id = g.id;
  return json_build_object('ok', true);
end;
$$;

revoke execute on function public.grupo_avisar_pago(text, text, text, int) from public;
grant execute on function public.grupo_avisar_pago(text, text, text, int) to anon, authenticated;
