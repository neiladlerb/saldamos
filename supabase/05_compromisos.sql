-- =====================================================================
--  MisGastosApp · CERRAR COMPROMISOS
--  Ejecutar DESPUÉS de los archivos 01 a 04.
--
--  Una tarea puede ser un compromiso con otra persona. Al terminarla se
--  envía por WhatsApp un «Hecho» con el resumen y un enlace secreto.
--  La otra persona abre el enlace (sin cuenta) y marca «Conforme» o deja
--  un comentario. Solo puede tocar la conformidad, nada más de la tarea.
-- =====================================================================

alter table public.tareas
  add column if not exists para           text check (char_length(para) <= 80),
  add column if not exists telefono       text check (char_length(telefono) <= 30),
  add column if not exists resumen        text check (char_length(resumen) <= 2000),
  add column if not exists completada     timestamptz,
  add column if not exists cierre_enviado timestamptz,
  add column if not exists conformidad    jsonb,
  add column if not exists token          text unique
    default public.nuevo_codigo()
    check (char_length(token) = 14);

-- Las tareas que ya existían también reciben su enlace
update public.tareas
   set token = public.nuevo_codigo()
 where token is null;

-- Lo que ve la otra persona al abrir el enlace
create or replace function public.tarea_publica(t text)
returns json
language sql stable security definer set search_path = public
as $$
  select json_build_object(
           'texto', ta.texto, 'resumen', ta.resumen, 'para', ta.para,
           'hecha', ta.hecha, 'completada', ta.completada,
           'conformidad', ta.conformidad,
           'de', nullif(p.nombre, ''))
    from public.tareas ta
    join public.perfiles p on p.id = ta.user_id
   where ta.token = t and char_length(t) = 14 and p.estado = 'activo';
$$;

-- La otra persona deja su conformidad o un comentario (puede cambiarlo después)
create or replace function public.tarea_conformidad(t text, estado text, comentario text)
returns json
language plpgsql security definer set search_path = public
as $$
#variable_conflict use_variable
begin
  if estado not in ('conforme', 'comentario') then raise exception 'Estado no válido'; end if;
  if char_length(coalesce(comentario, '')) > 1000 then raise exception 'Comentario demasiado largo'; end if;
  if estado = 'comentario' and coalesce(trim(comentario), '') = '' then raise exception 'Escribe el comentario'; end if;
  update public.tareas ta
     set conformidad = jsonb_build_object('estado', estado, 'comentario', nullif(trim(coalesce(comentario, '')), ''),
                                          'fecha', to_char(now() at time zone 'Europe/Madrid', 'YYYY-MM-DD"T"HH24:MI'))
    from public.perfiles p
   where ta.token = t and char_length(t) = 14 and ta.hecha
     and p.id = ta.user_id and p.estado = 'activo';
  if not found then raise exception 'Enlace no válido'; end if;
  return json_build_object('ok', true);
end;
$$;

revoke execute on function public.tarea_publica(text), public.tarea_conformidad(text, text, text) from public;
grant execute on function public.tarea_publica(text), public.tarea_conformidad(text, text, text) to anon, authenticated;
