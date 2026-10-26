// =====================================================================
//  INVITA A TUS AMIGOS y CÓDIGOS PROMOCIONALES (menú «Mi cuenta»)
//   · Cada cuenta tiene un código propio. El enlace lleva a «Crear cuenta»
//     con el código ya puesto (acceso.html?invita=CÓDIGO#registro).
//   · Si hay una promoción de invitación activa (back office → Promociones),
//     los dos reciben días de Premium gratis al registrarse el amigo.
//   · «¿Tienes un código?»: canjea códigos como BIENVENIDA.
// =====================================================================
(function () {
  const $ = function (id) { return document.getElementById(id); };
  const caja = $("invitar");
  if (!caja) return;
  let datos = null;

  function fechaCorta(t) { return new Date(t).toLocaleDateString("es-ES", { day: "numeric", month: "long" }); }

  async function cargar() {
    const { data, error } = await sb.rpc("mi_invitacion");
    if (error || !data) { $("invitar-estado").textContent = "No se ha podido cargar tu invitación. Inténtalo de nuevo en un momento."; return; }
    datos = data;
    const url = new URL("acceso.html?invita=" + encodeURIComponent(data.codigo) + "#registro", location.href).href;
    $("invitar-url").value = url;
    const p = data.promo;
    $("invitar-promo").textContent = p
      ? (p.dias === p.dias_invitador
          ? "Por cada amigo que cree su cuenta con tu enlace, tenéis " + p.dias + " días de Premium gratis los dos."
          : "Tu amigo tiene " + p.dias + " días de Premium gratis y tú " + p.dias_invitador + " por cada amigo que se registre.") +
        (p.fin ? " Hasta el " + fechaCorta(p.fin) + "." : "")
      : "Comparte tu enlace: tus amigos crean su cuenta gratis y empezáis a llevar las cuentas juntos.";
    const texto = "Te invito a Saldamos para llevar las cuentas sin líos: quién pagó qué y quién debe a quién." +
      (p && p.dias ? " Con mi enlace tienes " + p.dias + " días de Premium gratis." : "") + "\n" + url;
    $("invitar-wa").href = Reparto.enlaceWhatsApp(texto, "");
    const partes = [];
    partes.push(data.invitados === 1 ? "Has invitado a 1 amigo." : "Has invitado a " + data.invitados + " amigos.");
    if (data.premium_hasta && Date.parse(data.premium_hasta) > Date.now()) partes.push("Tienes Premium gratis hasta el " + fechaCorta(data.premium_hasta) + ".");
    $("invitar-estado").textContent = partes.join(" ");
  }

  function abrir() {
    const menu = $("menu-cuenta"); if (menu) menu.open = false;
    caja.hidden = false;
    caja.scrollIntoView({ behavior: "smooth", block: "start" });
    cargar();
  }
  $("b-invitar").addEventListener("click", abrir);
  $("invitar-cerrar").addEventListener("click", function () { caja.hidden = true; });

  $("invitar-copiar").addEventListener("click", async function () {
    const b = this;
    try { await navigator.clipboard.writeText($("invitar-url").value); }
    catch (e) { $("invitar-url").select(); document.execCommand("copy"); }
    b.textContent = "Copiado ✓"; setTimeout(function () { b.textContent = "Copiar"; }, 2000);
  });

  $("form-codigo").addEventListener("submit", async function (ev) {
    ev.preventDefault();
    const msg = $("codigo-msg");
    const codigo = $("codigo-promo").value.trim().toUpperCase();
    if (!codigo) return;
    const { data, error } = await sb.rpc("canjear_codigo", { codigo: codigo });
    msg.hidden = false;
    if (error) { msg.className = "mensaje mal"; msg.textContent = traducirError(error); return; }
    msg.className = "mensaje ok";
    msg.textContent = "¡Código canjeado! " + (data.dias ? "Tienes " + data.dias + " días de Premium gratis." : data.descuento ? "Tienes un " + data.descuento + " % de descuento en tu próximo pago." : "");
    $("codigo-promo").value = "";
    if (window.olvidarPlan) window.olvidarPlan();
    cargar();
  });

  // Abrir directamente con app.html#invitar
  if (location.hash === "#invitar") abrir();
})();
