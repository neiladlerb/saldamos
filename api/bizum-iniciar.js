// =====================================================================
//  POST /api/bizum-iniciar   { t, de, a, importe }
//  Lo llama la página del enlace del grupo al pulsar «Pagar con Bizum Pay».
//  Crea el pedido en la base de datos y devuelve la orden firmada para
//  enviar al TPV de Redsys de QUIEN COBRA. El dinero va directo de un
//  banco a otro: Saldamos no lo recibe ni lo guarda.
// =====================================================================
const { ordenBizum } = require("./_redsys");
const { rpc } = require("./_supabase");

module.exports = async function (req, res) {
  if (req.method !== "POST") { res.status(405).json({ error: "Usa POST" }); return; }
  try {
    const b = typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {});
    const t = String(b.t || ""), de = String(b.de || ""), a = String(b.a || ""), importe = Math.round(Number(b.importe));
    if (!/^[A-Za-z0-9_-]{14}$/.test(t) || !de || !a || !(importe >= 50 && importe <= 1000000)) {
      res.status(400).json({ error: "Datos del pago no válidos" }); return;
    }
    const p = await rpc("bizum_preparar", { t: t, de: de, a: a, importe: importe });
    const sitio = (process.env.SITIO_URL || ("https://" + req.headers.host)).replace(/\/$/, "");
    const vuelta = sitio + "/g/" + encodeURIComponent(t) + "?pedido=" + p.pedido + "&bizum=";
    const orden = ordenBizum({
      importe: importe, pedido: p.pedido, comercio: p.comercio, terminal: p.terminal, clave: p.clave, entorno: p.entorno,
      concepto: p.concepto, urlAviso: sitio + "/api/bizum-notificacion", urlOk: vuelta + "ok", urlKo: vuelta + "ko"
    });
    res.setHeader("Cache-Control", "no-store");
    res.status(200).json({ pedido: p.pedido, url: orden.url, campos: orden.campos });
  } catch (e) {
    res.status(e.status && e.status < 500 ? 400 : 500).json({ error: e.message || "No se pudo iniciar el pago" });
  }
};
