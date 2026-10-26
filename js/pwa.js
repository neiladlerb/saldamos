// =====================================================================
//  APP INSTALABLE (PWA) · registra el service worker (sw.js).
//  No hace nada al abrir los archivos sin servidor (file://).
// =====================================================================
(function () {
  if (!("serviceWorker" in navigator) || location.protocol === "file:") return;
  window.addEventListener("load", function () {
    navigator.serviceWorker.register("/sw.js").catch(function () {});
  });
})();
