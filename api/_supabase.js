// Llamada a funciones de la base de datos con la clave service_role.
// La clave vive SOLO en las variables de entorno de Vercel (nunca en el navegador).
async function rpc(nombre, args) {
  const url = process.env.SUPABASE_URL, clave = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !clave) throw new Error("Falta configurar SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY en Vercel");
  const r = await fetch(url.replace(/\/$/, "") + "/rest/v1/rpc/" + nombre, {
    method: "POST",
    headers: { apikey: clave, Authorization: "Bearer " + clave, "Content-Type": "application/json" },
    body: JSON.stringify(args)
  });
  const texto = await r.text();
  let datos = null; try { datos = texto ? JSON.parse(texto) : null; } catch (e) { datos = texto; }
  if (!r.ok) { const e = new Error((datos && datos.message) || "Error de la base de datos"); e.status = r.status; throw e; }
  return datos;
}
module.exports = { rpc };
