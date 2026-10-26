// =====================================================================
//  SUGERENCIAS · botón flotante para que los usuarios valoren y comenten.
//  Lo que envían llega al back office y de ahí al Lab de producto.
// =====================================================================
(function () {
  const boton = document.createElement("button");
  boton.type = "button"; boton.className = "boton-sugerencia"; boton.textContent = "Sugerencias";
  boton.setAttribute("aria-haspopup", "dialog");

  const capa = document.createElement("div");
  capa.className = "capa-sugerencia"; capa.hidden = true;
  capa.innerHTML =
    '<form class="tarjeta caja-sugerencia" id="form-sugerencia" role="dialog" aria-modal="true" aria-labelledby="sg-titulo" novalidate>' +
      '<div class="fila-titulo"><h2 id="sg-titulo">¿Qué te parece Saldamos?</h2><button type="button" class="g-borrar" id="sg-cerrar" aria-label="Cerrar">×</button></div>' +
      '<div class="estrellas" id="sg-estrellas" role="radiogroup" aria-label="Valoración"></div>' +
      '<label class="etiqueta" for="sg-tipo" style="margin:0">Es…</label>' +
      '<select id="sg-tipo" class="filtro"><option value="idea">Una idea o mejora</option><option value="problema">Algo que falla o no se entiende</option>' +
      '<option value="elogio">Algo que me gusta</option><option value="pregunta">Una pregunta</option></select>' +
      '<textarea id="sg-texto" rows="4" maxlength="2000" placeholder="Cuéntanos con tus palabras. Cuanto más concreto, mejor."></textarea>' +
      '<p class="error" id="sg-error" hidden></p>' +
      '<button class="anadir" type="submit">Enviar</button>' +
    '</form>';
  document.body.append(boton, capa);

  let puntuacion = 0;
  const caja = document.getElementById("sg-estrellas");
  for (let i = 1; i <= 5; i++) {
    const e = document.createElement("button");
    e.type = "button"; e.textContent = "★"; e.dataset.v = i;
    e.setAttribute("role", "radio"); e.setAttribute("aria-label", i + " de 5");
    e.addEventListener("click", function () { puntuacion = i; pintarEstrellas(); });
    caja.appendChild(e);
  }
  function pintarEstrellas() {
    caja.querySelectorAll("button").forEach(function (b) {
      const on = Number(b.dataset.v) <= puntuacion;
      b.classList.toggle("on", on); b.setAttribute("aria-checked", String(Number(b.dataset.v) === puntuacion));
    });
  }

  document.getElementById("sg-texto").addEventListener("input", function () { document.getElementById("sg-error").hidden = true; });
  function abrir() { capa.hidden = false; document.getElementById("sg-texto").focus(); }
  function cerrar() { capa.hidden = true; boton.focus(); }
  boton.addEventListener("click", abrir);
  document.getElementById("sg-cerrar").addEventListener("click", cerrar);
  capa.addEventListener("click", function (e) { if (e.target === capa) cerrar(); });
  document.addEventListener("keydown", function (e) { if (e.key === "Escape" && !capa.hidden) cerrar(); });

  document.getElementById("form-sugerencia").addEventListener("submit", async function (ev) {
    ev.preventDefault();
    const texto = document.getElementById("sg-texto").value.trim();
    const err = document.getElementById("sg-error");
    if (!texto) { err.textContent = "Escribe tu comentario antes de enviarlo."; err.hidden = false; return; }
    err.hidden = true;
    const pestana = (document.querySelector('.pestanas button[aria-selected="true"]') || {}).dataset;
    const r = await sb.from("sugerencias").insert({
      tipo: document.getElementById("sg-tipo").value,
      puntuacion: puntuacion || null,
      texto: texto,
      pagina: pestana && pestana.panel ? pestana.panel : location.pathname.split("/").pop().replace(".html", "")
    });
    if (r.error) { err.textContent = "No se pudo enviar: " + traducirError(r.error); err.hidden = false; return; }
    this.reset(); puntuacion = 0; pintarEstrellas();
    cerrar();
    ponerEstadoSync("¡Gracias! Hemos recibido tu sugerencia.", "ok");
  });
})();
