// =====================================================================
//  DEMO · "Movimientos de tu banco"
//  Simula cómo llegarían solos los pagos hechos con Apple Pay, Google Pay,
//  Bizum, Bizum Pay o tarjeta si el usuario conecta su banco (open banking).
//  Con un clic se convierten en gasto propio, gasto de grupo o pago recibido.
// =====================================================================
(function () {
  const R = window.Reparto;
  const panel = document.getElementById("panel-gastos");
  const anclaje = Array.from(panel.querySelectorAll("h2")).find(function (h) { return h.textContent.trim() === "Movimientos"; });
  const seccion = document.createElement("section");
  seccion.className = "tarjeta banco-demo";
  seccion.innerHTML =
    '<div class="fila-titulo"><h2>Movimientos de tu banco</h2><span class="estado pendiente">Simulación</span></div>' +
    '<p class="ayuda" style="margin:0">En la versión real conectarías tu banco una vez (open banking) y los pagos con Apple Pay, Google Pay, ' +
    'Bizum o tarjeta aparecerían aquí solos. Pulsa una opción para clasificarlos.</p>' +
    '<div id="banco-lista" class="g-lineas"></div><p class="mensaje" id="banco-msg" hidden></p>';
  panel.insertBefore(seccion, anclaje);

  function el(tag, clase, texto) { const e = document.createElement(tag); if (clase) e.className = clase; if (texto != null) e.textContent = texto; return e; }
  function msg(texto, ok) {
    const p = document.getElementById("banco-msg"); p.textContent = texto; p.className = "mensaje " + (ok ? "ok" : "mal"); p.hidden = false;
    clearTimeout(msg.t); msg.t = setTimeout(function () { p.hidden = true; }, 5000);
  }
  function hecho(m, estado, texto) { window.DemoBanco.marcar(m.id, estado); msg(texto, true); pintar(); }

  async function grupos() { const r = await sb.from("grupos").select("*"); return r.data || []; }

  async function aSaldamos(m) {
    const r = await sb.from("gastos").insert({ concepto: m.comercio, fecha: m.fecha, categoria: m.categoria || "Otros",
      lineas: [{ item: "Mi parte", persona: "", importe: -m.importe, tipo: "mio", saldado: false }] });
    if (r.error) return msg(traducirError(r.error));
    await cargarTodo();
    hecho(m, "Añadido a tus gastos", "Añadido a tus gastos: " + m.comercio + " (" + R.eur(-m.importe) + ").");
  }

  async function aGrupo(m, grupoId) {
    const gs = await grupos(); const g = gs.find(function (x) { return x.id === grupoId; }); if (!g) return;
    const yo = g.miembros.find(function (x) { return x.yo; }) || g.miembros[0];
    const gasto = { id: R.nuevoId(), concepto: m.comercio, fecha: m.fecha, importe: -m.importe,
      pagos: [{ miembro: yo.id, importe: -m.importe }], reparto: { modo: "iguales", miembros: g.miembros.map(function (x) { return x.id; }) } };
    const r = await sb.from("grupos").update({ gastos: g.gastos.concat([gasto]) }).eq("id", g.id);
    if (r.error) return msg(traducirError(r.error));
    if (window.cargarGrupos) await window.cargarGrupos();
    hecho(m, "Añadido a «" + g.nombre + "»", "Añadido a «" + g.nombre + "», repartido entre " + g.miembros.length + " personas.");
  }

  // Un Bizum recibido o enviado se intenta casar con una deuda pendiente de algún grupo
  async function conciliar(m) {
    const gs = await grupos();
    const recibido = m.importe > 0, otro = (recibido ? m.de : m.a) || "", importe = Math.abs(m.importe);
    for (const g of gs) {
      const yo = g.miembros.find(function (x) { return x.yo; }); if (!yo) continue;
      const persona = g.miembros.find(function (x) { return x.nombre.toLowerCase() === otro.toLowerCase(); }); if (!persona) continue;
      const p = R.plan(g).find(function (x) {
        return recibido ? (x.de === persona.id && x.a === yo.id && x.importe === importe) : (x.de === yo.id && x.a === persona.id && x.importe === importe);
      });
      if (!p) continue;
      const liq = { id: R.nuevoId(), de: p.de, a: p.a, importe: p.importe, fecha: m.fecha };
      const r = await sb.from("grupos").update({ liquidaciones: g.liquidaciones.concat([liq]) }).eq("id", g.id);
      if (r.error) return msg(traducirError(r.error));
      if (window.cargarGrupos) await window.cargarGrupos();
      return hecho(m, "Pago de «" + g.nombre + "»", (recibido ? otro + " ya te ha pagado " : "Has pagado a " + otro + " ") + R.eur(importe) + " de «" + g.nombre + "». Marcado como pagado.");
    }
    msg("No hay ninguna deuda pendiente con " + otro + " por " + R.eur(importe) + " en tus grupos.");
  }

  async function pintar() {
    const lista = document.getElementById("banco-lista"); lista.innerHTML = "";
    const gs = await grupos();
    window.DemoBanco.movimientos().forEach(function (m) {
      const f = el("div", "fila-pago");
      const t = el("span", "texto-pago");
      t.append(el("b", null, m.comercio), el("div", "g-meta", new Date(m.fecha + "T12:00").toLocaleDateString("es-ES", { day: "numeric", month: "short" }) + " · "));
      t.lastChild.appendChild(el("span", "metodo metodo-" + m.metodo.toLowerCase().replace(/\s/g, "-"), m.metodo));
      const imp = el("span", "importe " + (m.importe > 0 ? "positivo-txt" : ""), (m.importe > 0 ? "+" : "−") + R.eur(Math.abs(m.importe)));
      const acciones = el("div", "botones");
      if (m.estado) {
        acciones.appendChild(el("span", "estado activo", "✓ " + m.estado));
      } else if (m.metodo === "Bizum") {
        const b = el("button", "boton-sec", m.importe > 0 ? "Es un pago de un grupo" : "Es un pago a un grupo"); b.type = "button";
        b.addEventListener("click", function () { conciliar(m); });
        acciones.appendChild(b);
      } else {
        const b1 = el("button", "boton-sec", "A mis gastos"); b1.type = "button";
        b1.addEventListener("click", function () { aSaldamos(m); });
        const sel = el("select", "filtro"); sel.setAttribute("aria-label", "Añadir a un grupo"); sel.id = "banco-grupo-" + m.id;
        const o0 = el("option", null, "A un grupo…"); o0.value = ""; sel.appendChild(o0);
        gs.forEach(function (g) { const o = el("option", null, g.nombre); o.value = g.id; sel.appendChild(o); });
        sel.addEventListener("change", function () { if (sel.value) aGrupo(m, sel.value); });
        acciones.append(b1, sel);
      }
      f.append(t, imp, acciones);
      lista.appendChild(f);
    });
  }
  pintar();
})();
