// =====================================================================
//  Firma de Redsys (HMAC_SHA256_V1) — la usan bizum-iniciar y
//  bizum-notificacion. Algoritmo oficial de Redsys:
//   1) los parámetros en JSON se codifican en Base64
//   2) la clave del TPV (Base64) se diversifica cifrando el nº de pedido
//      con 3DES-CBC (IV de ceros, relleno con ceros)
//   3) firma = HMAC-SHA256(clave diversificada, parámetros en Base64)
// =====================================================================
const crypto = require("crypto");

const URLS = {
  pruebas: "https://sis-t.redsys.es:25443/sis/realizarPago",
  real: "https://sis.redsys.es/sis/realizarPago"
};

function claveDiversificada(claveB64, pedido) {
  const clave = Buffer.from(claveB64, "base64");
  const iv = Buffer.alloc(8, 0);
  const datos = Buffer.from(pedido, "utf8");
  const relleno = Buffer.concat([datos, Buffer.alloc((8 - (datos.length % 8)) % 8, 0)]);
  const c = crypto.createCipheriv("des-ede3-cbc", clave, iv);
  c.setAutoPadding(false);
  return Buffer.concat([c.update(relleno), c.final()]);
}

function firmar(claveB64, pedido, parametrosB64) {
  return crypto.createHmac("sha256", claveDiversificada(claveB64, pedido)).update(parametrosB64).digest("base64");
}

// Redsys a veces devuelve Base64 «seguro para URL» (- y _)
function normalizar(b64) { return String(b64 || "").replace(/-/g, "+").replace(/_/g, "/").replace(/=+$/, ""); }

function iguales(a, b) {
  const x = Buffer.from(normalizar(a)), y = Buffer.from(normalizar(b));
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}

function codificar(obj) { return Buffer.from(JSON.stringify(obj), "utf8").toString("base64"); }
function decodificar(b64) { return JSON.parse(Buffer.from(normalizar(b64), "base64").toString("utf8")); }

// Orden de pago Bizum (Ds_Merchant_PayMethods = "z" abre directamente Bizum)
function ordenBizum(o) {
  const p = {
    DS_MERCHANT_AMOUNT: String(o.importe),
    DS_MERCHANT_ORDER: o.pedido,
    DS_MERCHANT_MERCHANTCODE: o.comercio,
    DS_MERCHANT_CURRENCY: "978",
    DS_MERCHANT_TRANSACTIONTYPE: "0",
    DS_MERCHANT_TERMINAL: o.terminal,
    DS_MERCHANT_MERCHANTURL: o.urlAviso,
    DS_MERCHANT_URLOK: o.urlOk,
    DS_MERCHANT_URLKO: o.urlKo,
    DS_MERCHANT_PAYMETHODS: "z",
    DS_MERCHANT_PRODUCTDESCRIPTION: String(o.concepto || "Saldamos").slice(0, 125),
    DS_MERCHANT_CONSUMERLANGUAGE: "001"
  };
  const parametros = codificar(p);
  return {
    url: URLS[o.entorno] || URLS.pruebas,
    campos: { Ds_SignatureVersion: "HMAC_SHA256_V1", Ds_MerchantParameters: parametros, Ds_Signature: firmar(o.clave, o.pedido, parametros) }
  };
}

module.exports = { claveDiversificada, firmar, iguales, codificar, decodificar, ordenBizum, URLS };
