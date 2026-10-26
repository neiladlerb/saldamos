// =====================================================================
//  EXTRAS DE LA DEMO · solo se cargan con CONFIG.DEMO = true
//   · demo-banco.js: «Movimientos de tu banco» simulados (en la app)
//   · demo-prototipos.js: prototipos con «Dar mi opinión»
//  Va al final de la página, después de los scripts propios.
// =====================================================================
(function () {
  if (!(window.CONFIG && window.CONFIG.DEMO)) return;
  if (document.getElementById("panel-gastos")) document.write('<script src="js/demo-banco.js"><\/script>');
  document.write('<script src="js/demo-prototipos.js"><\/script>');
})();
