// =====================================================================
//  SERVICE WORKER · hace que Saldamos se pueda instalar en el móvil
//  y que abra aunque no haya cobertura.
//   · Páginas (HTML): primero la red; sin conexión, la última copia.
//   · css / js / img: también primero la red (nunca una versión vieja).
//   · vendor/ (OCR): se guarda la primera vez que se usa y ya no cambia.
//   · NUNCA se guarda nada de /api/ ni de Supabase: los datos van siempre
//     en directo y protegidos por la base de datos.
//  Al publicar cambios grandes, sube VERSION para limpiar lo antiguo.
// =====================================================================
const VERSION = "saldamos-2026-10-26";
const BASICOS = [
  "/", "/index.html", "/acceso.html", "/app.html", "/calculadora.html",
  "/css/estilos.css", "/js/config.js", "/js/arranque.js", "/js/comun.js",
  "/img/icono.svg", "/img/icono-192.png", "/manifest.webmanifest"
];

self.addEventListener("install", function (e) {
  e.waitUntil(caches.open(VERSION).then(function (c) { return c.addAll(BASICOS); }).then(function () { return self.skipWaiting(); }));
});

self.addEventListener("activate", function (e) {
  e.waitUntil(caches.keys().then(function (claves) {
    return Promise.all(claves.filter(function (k) { return k !== VERSION; }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});

function guardar(peticion, respuesta) {
  if (respuesta && respuesta.ok && respuesta.type === "basic") {
    const copia = respuesta.clone();
    caches.open(VERSION).then(function (c) { c.put(peticion, copia); });
  }
  return respuesta;
}

self.addEventListener("fetch", function (e) {
  const p = e.request;
  if (p.method !== "GET") return;
  const url = new URL(p.url);
  if (url.origin !== location.origin || url.pathname.indexOf("/api/") === 0) return;

  // Páginas: red primero, copia guardada si no hay conexión
  if (p.mode === "navigate") {
    e.respondWith(fetch(p).then(function (r) { return guardar(p, r); }).catch(function () {
      return caches.match(p, { ignoreSearch: true }).then(function (r) {
        return r || caches.match("/app.html");
      }).then(function (r) {
        return r || new Response("Sin conexión. Vuelve a intentarlo en un momento.", { headers: { "Content-Type": "text/plain; charset=utf-8" } });
      });
    }));
    return;
  }

  // OCR: no cambia nunca, se guarda la primera vez
  if (url.pathname.indexOf("/vendor/") === 0) {
    e.respondWith(caches.match(p).then(function (r) { return r || fetch(p).then(function (x) { return guardar(p, x); }); }));
    return;
  }

  // Resto (css, js, img): red primero para no servir nunca una versión vieja;
  // sin conexión, la última copia guardada
  e.respondWith(fetch(p).then(function (x) { return guardar(p, x); }).catch(function () { return caches.match(p); }));
});
