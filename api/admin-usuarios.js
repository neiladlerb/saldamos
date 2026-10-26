// =====================================================================
//  POST /api/admin-usuarios   { email, nombre, plan, rol, empresa }
//  Cabecera: Authorization: Bearer <token de la sesión de Supabase>
//
//  Lo usa el back office para CREAR una cuenta. Solo administradores.
//  Supabase envía a la persona un email de invitación; al pulsarlo
//  llega a recuperar.html y elige su contraseña.
//
//  Variables en Vercel: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY y SITIO_URL.
// =====================================================================
const PLANES = ["gratis", "premium", "empresa"];
const ROLES = ["usuario", "admin", "comercial"];

function base() { return String(process.env.SUPABASE_URL || "").replace(/\/$/, ""); }
function cabeceras(extra) {
  const k = process.env.SUPABASE_SERVICE_ROLE_KEY;
  return Object.assign({ apikey: k, Authorization: "Bearer " + k, "Content-Type": "application/json" }, extra || {});
}

async function quienLlama(token) {
  const r = await fetch(base() + "/auth/v1/user", { headers: { apikey: process.env.SUPABASE_SERVICE_ROLE_KEY, Authorization: "Bearer " + token } });
  if (!r.ok) return null;
  const u = await r.json();
  if (!u || !u.id) return null;
  const p = await fetch(base() + "/rest/v1/perfiles?select=rol,estado&id=eq." + encodeURIComponent(u.id), { headers: cabeceras() });
  const filas = p.ok ? await p.json() : [];
  return filas[0] || null;
}

module.exports = async function (req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") { res.status(405).json({ error: "Usa POST" }); return; }
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) { res.status(503).json({ error: "Falta configurar Supabase en Vercel" }); return; }
  try {
    const token = String(req.headers.authorization || "").replace(/^Bearer\s+/i, "");
    const yo = token ? await quienLlama(token) : null;
    if (!yo || yo.rol !== "admin" || yo.estado !== "activo") { res.status(403).json({ error: "No autorizado" }); return; }

    const b = typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {});
    const email = String(b.email || "").trim().toLowerCase();
    const nombre = String(b.nombre || "").trim().slice(0, 80);
    const plan = PLANES.indexOf(b.plan) !== -1 ? b.plan : "gratis";
    const rol = ROLES.indexOf(b.rol) !== -1 ? b.rol : "usuario";
    const empresa = plan === "empresa" ? String(b.empresa || "").trim().slice(0, 120) : null;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { res.status(400).json({ error: "Email no válido" }); return; }

    // 1 · Invitación por email (crea el usuario y su perfil con el trigger de la base de datos)
    const sitio = String(process.env.SITIO_URL || ("https://" + req.headers.host)).replace(/\/$/, "");
    const inv = await fetch(base() + "/auth/v1/invite?redirect_to=" + encodeURIComponent(sitio + "/recuperar.html"), {
      method: "POST", headers: cabeceras(), body: JSON.stringify({ email: email, data: { nombre: nombre } })
    });
    const u = await inv.json().catch(function () { return {}; });
    if (!inv.ok) {
      const m = String(u.msg || u.message || u.error_description || "");
      res.status(inv.status === 422 || /registered|exists/i.test(m) ? 409 : 502).json({ error: /registered|exists/i.test(m) ? "Ya existe una cuenta con ese email" : "No se pudo crear la cuenta" });
      return;
    }

    // 2 · Plan, rol y empresa
    const id = u.id || (u.user && u.user.id);
    if (id && (plan !== "gratis" || rol !== "usuario" || empresa)) {
      await fetch(base() + "/rest/v1/perfiles?id=eq." + encodeURIComponent(id), {
        method: "PATCH", headers: cabeceras({ Prefer: "return=minimal" }), body: JSON.stringify({ plan: plan, rol: rol, empresa: empresa })
      });
    }
    res.status(200).json({ ok: true, id: id || null });
  } catch (e) {
    res.status(500).json({ error: "No se pudo crear la cuenta" });
  }
};
