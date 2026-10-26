// =====================================================================
//  POST /api/bizum-notificacion  (lo llama Redsys, no el navegador)
//  Redsys avisa del resultado del pago. Comprobamos la firma con la clave
//  del TPV de ese pedido y, si está autorizado, la base de datos apunta el
//  pago en el grupo sola (bizum_resultado). Respondemos 200 siempre que la
//  firma sea buena para que Redsys no repita el aviso.
// =====================================================================
const { firmar, iguales, decodificar } = require("./_redsys");
const { rpc } = require("./_supabase");

function leerFormulario(req) {
  if (req.body && typeof req.body === "object") return Promise.resolve(req.body);
  if (typeof req.body === "string") return Promise.resolve(Object.fromEntries(new URLSearchParams(req.body)));
  return new Promise(function (ok, ko) {
    let d = ""; req.on("data", function (c) { d += c; if (d.length > 20000) req.destroy(); });
    req.on("end", function () { ok(Object.fromEntries(new URLSearchParams(d))); }); req.on("error", ko);
  });
}

module.exports = async function (req, res) {
  if (req.method !== "POST") { res.status(405).end(); return; }
  try {
    const f = await leerFormulario(req);
    if (f.Ds_SignatureVersion !== "HMAC_SHA256_V1" || !f.Ds_MerchantParameters || !f.Ds_Signature) { res.status(400).end(); return; }
    const p = decodificar(f.Ds_MerchantParameters);
    const pedido = String(p.Ds_Order || p.DS_ORDER || "");
    if (!/^[0-9]{4}[0-9A-Za-z]{8}$/.test(pedido)) { res.status(400).end(); return; }
    const clave = await rpc("bizum_clave", { pedido: pedido });
    if (!clave || !iguales(firmar(clave, pedido, f.Ds_MerchantParameters), f.Ds_Signature)) { res.status(403).end(); return; }
    await rpc("bizum_resultado", {
      pedido: pedido, respuesta: String(p.Ds_Response || ""), autorizacion: String(p.Ds_AuthorisationCode || "").trim(),
      importe: Number(p.Ds_Amount)
    });
    res.status(200).end();
  } catch (e) {
    res.status(500).end();
  }
};
