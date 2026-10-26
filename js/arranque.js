// =====================================================================
//  ARRANQUE · carga la conexión correcta según CONFIG.DEMO
//   · DEMO: true  → js/demo-supabase.js (datos de ejemplo en el navegador)
//   · DEMO: false → la librería oficial de Supabase
//  Va siempre justo después de js/config.js y antes de js/comun.js.
// =====================================================================
(function () {
  const demo = !!(window.CONFIG && window.CONFIG.DEMO);
  window.MODO_DEMO = demo;
  const src = demo
    ? "js/demo-supabase.js"
    : "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.117.2/dist/umd/supabase.js";
  // document.write mantiene el orden: comun.js no se ejecuta hasta que esto ha cargado
  document.write('<script src="' + src + '"><\/script>');
})();
