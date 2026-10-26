// =====================================================================
//  CONFIGURACIÓN · lo único que tienes que cambiar tú.
//  Los dos valores están en Supabase → Project Settings → API.
//  La "anon key" es PÚBLICA por diseño: puede ir en la web sin problema,
//  porque la seguridad la ponen las reglas (RLS) de la base de datos.
//  NUNCA pongas aquí la "service_role key": esa es secreta.
//
//  DEMO: true  → la app funciona con datos de ejemplo guardados en el
//                navegador (no hace falta Supabase). Ideal para enseñarla.
//  DEMO: false → la app usa tu Supabase de verdad. Ponlo en false en
//                cuanto hayas pegado la URL y la anon key.
// =====================================================================
window.CONFIG = {
  DEMO: true,
  SUPABASE_URL: "https://TU-PROYECTO.supabase.co",
  SUPABASE_ANON_KEY: "PEGA-AQUI-TU-ANON-KEY",
  NOMBRE_APP: "Saldamos"
};
