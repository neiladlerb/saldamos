// =====================================================================
//  PRESUPUESTO COMPARTIDO (módulo Premium)
//  Un grupo (pareja, ex pareja con hijos, piso…) fija un presupuesto
//  mensual y cuánto aporta cada persona. Los gastos del presupuesto salen
//  del bote; los EXTRA necesitan la aprobación de la otra parte. Todo
//  queda en un registro que solo crece.
//  Este archivo tiene: 1) los cálculos, 2) el panel de la app y
//  3) la sección de la página pública del grupo (grupo.html).
// =====================================================================
(function (global) {
  const R = global.Reparto;

  // ---------------- 1 · Cálculos ----------------
  function mesDe(f) { return String(f || "").slice(0, 7); }
  function mesActual() { const d = new Date(); return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0"); }
  function sumarMes(clave, n) { const [a, m] = clave.split("-").map(Number); const d = new Date(a, m - 1 + n, 1); return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0"); }
  function mesesDesde(inicio, hasta) {
    if (!inicio || hasta < inicio) return 0;
    const [a1, m1] = inicio.split("-").map(Number), [a2, m2] = hasta.split("-").map(Number);
    return (a2 - a1) * 12 + (m2 - m1) + 1;
  }
  function vigente(x) { return !x.estado || x.estado === "aprobado"; }
  function gastosPres(g, mes) { return (g.gastos || []).filter(function (x) { return x.presupuesto && vigente(x) && (!mes || mesDe(x.fecha) === mes); }); }

  function resumenMes(g, mes) {
    const P = g.presupuesto || {};
    const lista = gastosPres(g, mes);
    const gastado = lista.reduce(function (s, x) { return s + x.importe; }, 0);
    const cats = (P.categorias || []).map(function (c) {
      return { nombre: c.nombre, previsto: c.importe || 0, gastado: lista.filter(function (x) { return x.categoria === c.nombre; }).reduce(function (s, x) { return s + x.importe; }, 0) };
    });
    const sinCat = lista.filter(function (x) { return !x.categoria || !(P.categorias || []).some(function (c) { return c.nombre === x.categoria; }); })
      .reduce(function (s, x) { return s + x.importe; }, 0);
    if (sinCat) cats.push({ nombre: "Sin categoría", previsto: 0, gastado: sinCat });
    const extras = (g.gastos || []).filter(function (x) { return !x.presupuesto && x.estado && mesDe(x.fecha) === mes; });
    return {
      mensual: P.mensual || 0, gastado: gastado, disponible: (P.mensual || 0) - gastado, categorias: cats,
      extrasAprobados: extras.filter(function (x) { return x.estado === "aprobado"; }).reduce(function (s, x) { return s + x.importe; }, 0),
      extrasPendientes: (g.gastos || []).filter(function (x) { return x.estado === "pendiente"; }).length
    };
  }

  // Aportaciones acumuladas hasta un mes: lo que cada uno debía poner y lo que ha puesto
  // (aportaciones confirmadas + gastos del presupuesto que adelantó de su bolsillo)
  function aportaciones(g, hasta) {
    const P = g.presupuesto || {};
    const meses = mesesDesde(P.inicio, hasta);
    const r = {};
    (g.miembros || []).forEach(function (m) {
      const cuota = (P.cuotas || {})[m.id] || 0;
      const ap = (g.aportes || []).filter(function (a) { return a.miembro === m.id && a.estado !== "pendiente" && a.estado !== "rechazado" && mesDe(a.fecha) <= hasta; });
      const ga = gastosPres(g).filter(function (x) { return mesDe(x.fecha) <= hasta; })
        .reduce(function (s, x) { return s + ((R.pagos(x))[m.id] || 0); }, 0);
      const aportado = ap.reduce(function (s, a) { return s + a.importe; }, 0) + ga;
      const delMes = ap.filter(function (a) { return mesDe(a.fecha) === hasta; }).reduce(function (s, a) { return s + a.importe; }, 0)
        + gastosPres(g, hasta).reduce(function (s, x) { return s + ((R.pagos(x))[m.id] || 0); }, 0);
      r[m.id] = { cuota: cuota, debido: cuota * meses, aportado: aportado, delMes: delMes, diferencia: aportado - cuota * meses };
    });
    return r;
  }

  // Dinero en el bote: aportaciones confirmadas menos lo pagado con el bote
  function bote(g) {
    const entra = (g.aportes || []).filter(function (a) { return a.estado !== "pendiente" && a.estado !== "rechazado"; }).reduce(function (s, a) { return s + a.importe; }, 0);
    const sale = gastosPres(g).reduce(function (s, x) { return s + ((R.pagos(x)).bote || 0); }, 0);
    return entra - sale;
  }

  global.Presupuesto = { mesActual: mesActual, sumarMes: sumarMes, mesesDesde: mesesDesde, resumenMes: resumenMes, aportaciones: aportaciones, bote: bote };
  if (typeof document === "undefined") return;

  // ---------------- utilidades de pantalla ----------------
  function el(tag, clase, texto) { const e = document.createElement(tag); if (clase) e.className = clase; if (texto != null) e.textContent = texto; return e; }
  function nombreMes(clave) { const [a, m] = clave.split("-").map(Number); const t = new Date(a, m - 1, 1).toLocaleDateString("es-ES", { month: "long", year: "numeric" }); return t.charAt(0).toUpperCase() + t.slice(1); }
  function fechaHora(iso) { const d = new Date(iso); return isNaN(d) ? iso : d.toLocaleDateString("es-ES", { day: "numeric", month: "short" }) + " " + d.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" }); }
  function hoy() { return new Date().toISOString().slice(0, 10); }
  function ahoraISO() { const d = new Date(); return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 19); }
  function nom(g, id) { return id === "bote" ? "el bote común" : R.nombre(g, id); }
  function input(tipo, ph, etiqueta) { const i = el("input"); i.type = tipo; if (ph) i.placeholder = ph; if (etiqueta) i.setAttribute("aria-label", etiqueta); if (tipo === "text") i.inputMode = "decimal"; return i; }

  // Barra «gastado de previsto»
  function barra(gastado, previsto) {
    const b = el("div", "pr-barra");
    const r = el("span"); const pct = previsto ? Math.min(100, Math.round(gastado * 100 / previsto)) : (gastado ? 100 : 0);
    r.style.width = pct + "%"; if (previsto && gastado > previsto) b.classList.add("pasado");
    b.appendChild(r); return b;
  }

  // Bloque común (app y enlace): resumen del mes y aportaciones
  function bloqueResumen(g, mes, opciones) {
    const caja = el("div", "pr-resumen");
    const r = resumenMes(g, mes);
    const cifra = el("div", "pr-cifra");
    cifra.append(el("b", null, R.eur(r.gastado)), el("span", null, " de " + R.eur(r.mensual) + " gastados"));
    const disp = el("p", "pr-disponible " + (r.disponible < 0 ? "negativo-txt" : "positivo-txt"),
      r.disponible < 0 ? "▲ " + R.eur(-r.disponible) + " por encima del presupuesto" : "Quedan " + R.eur(r.disponible) + " este mes");
    caja.append(cifra, barra(r.gastado, r.mensual), disp);
    if (r.categorias.length) {
      const ul = el("div", "pr-cats");
      r.categorias.forEach(function (c) {
        const f = el("div", "pr-cat");
        const cab = el("div", "pr-cat-cab");
        cab.append(el("span", null, c.nombre), el("span", "pr-cat-imp", R.eur(c.gastado) + (c.previsto ? " / " + R.eur(c.previsto) : "")));
        f.append(cab, barra(c.gastado, c.previsto));
        if (c.previsto && c.gastado > c.previsto) f.appendChild(el("small", "negativo-txt", "▲ " + R.eur(c.gastado - c.previsto) + " sobre lo previsto"));
        ul.appendChild(f);
      });
      caja.appendChild(ul);
    }
    if (r.extrasAprobados) caja.appendChild(el("p", "ayuda", "Extras aprobados este mes (fuera del presupuesto): " + R.eur(r.extrasAprobados) + ". Se reparten en «Para quedar en paz»."));
    // Aportaciones
    const ap = aportaciones(g, mes);
    const tit = el("p", "eti", "Aportaciones (acumulado hasta " + nombreMes(mes).toLowerCase() + ")");
    caja.appendChild(tit);
    (g.miembros || []).forEach(function (m) {
      const a = ap[m.id]; if (!a || (!a.cuota && !a.aportado)) return;
      const f = el("div", "fila-pago pr-aporte");
      const t = el("span", "texto-pago");
      t.append(el("b", null, m.nombre), el("div", "g-meta", R.eur(a.cuota) + "/mes · este mes " + R.eur(a.delMes)));
      const est = el("span", "importe " + (a.diferencia < 0 ? "negativo-txt" : "positivo-txt"),
        a.diferencia < 0 ? "Le faltan " + R.eur(-a.diferencia) : a.diferencia > 0 ? "✓ " + R.eur(a.diferencia) + " de más" : "✓ Al día");
      f.append(t, est);
      if (opciones && opciones.accionesAporte) opciones.accionesAporte(f, m, a);
      caja.appendChild(f);
    });
    caja.appendChild(el("p", "ayuda", "En el bote común: " + R.eur(bote(g)) + ". Los gastos del presupuesto que alguien adelanta cuentan como su aportación."));
    return caja;
  }

  function bloqueRegistro(g) {
    const det = el("details", "pr-registro");
    det.appendChild(el("summary", null, "Registro de cambios (" + (g.registro || []).length + ")"));
    det.appendChild(el("p", "ayuda", "Cada acción queda anotada con fecha y hora. Nada se puede borrar ni cambiar después."));
    const ul = el("ol", "pr-reg-lista");
    (g.registro || []).slice().reverse().forEach(function (r) {
      const li = el("li");
      li.append(el("span", "pr-reg-fecha", fechaHora(r.fecha)), el("b", null, r.quien + " · " + r.accion), document.createTextNode(r.detalle ? " — " + r.detalle : ""));
      ul.appendChild(li);
    });
    det.appendChild(ul);
    return det;
  }

  // ---------------- 2 · Panel en la app ----------------
  let planUsuario = null, mesVista = mesActual(), editando = false;
  async function miPlan() {
    if (planUsuario) return planUsuario;
    try { const p = await miPerfil(); planUsuario = (p && p.plan) || "gratis"; } catch (e) { planUsuario = "gratis"; }
    return planUsuario;
  }
  global.olvidarPlan = function () { planUsuario = null; };

  function panelApp(g, guardar, vista, recargar) {
    let caja = document.getElementById("pres-caja");
    if (!caja) {
      caja = el("section", "tarjeta pres-caja"); caja.id = "pres-caja";
      const res = document.getElementById("gd-resumen"); res.parentNode.insertBefore(caja, res.nextSibling);
    }
    if (caja.contains(document.activeElement) && /INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName) && caja.dataset.g === g.id) return;
    caja.dataset.g = g.id;
    miPlan().then(function (plan) { pintarApp(caja, g, guardar, recargar, plan); });
  }
  (global.ganchosGrupo = global.ganchosGrupo || []).push(panelApp);

  function cabecera(titulo) {
    const c = el("div", "fila-titulo");
    const h = el("h2", null, titulo); h.style.margin = "0";
    c.append(h, el("span", "insignia-premium", "Premium"));
    return c;
  }

  function pintarApp(caja, g, guardar, recargar, plan) {
    const SG = global.SaldamosGrupos;
    caja.innerHTML = "";
    const premium = plan === "premium" || plan === "empresa";
    if (!g.presupuesto && !editando) {
      caja.appendChild(cabecera("Presupuesto compartido"));
      caja.appendChild(el("p", "ayuda", "Para pareja, ex pareja con hijos o piso compartido: un presupuesto al mes, lo que pone cada uno, gastos extra que la otra parte aprueba y un registro de todo. Menos discusiones, todo por escrito."));
      if (premium) {
        const b = el("button", "anadir", "Crear presupuesto mensual"); b.type = "button";
        b.addEventListener("click", function () { editando = true; pintarApp(caja, g, guardar, recargar, plan); });
        caja.appendChild(b);
      } else {
        caja.classList.add("bloqueado");
        caja.appendChild(el("p", "mensaje", "Disponible en el plan Premium."));
      }
      return;
    }
    caja.classList.remove("bloqueado");
    if (editando) { caja.appendChild(formulario(g, guardar, caja, recargar, plan)); return; }

    const P = g.presupuesto;
    const cab = cabecera("Presupuesto compartido");
    caja.appendChild(cab);
    // Navegación por meses
    const nav = el("div", "pr-nav");
    const ant = el("button", "boton-sec", "◀"); ant.type = "button"; ant.setAttribute("aria-label", "Mes anterior");
    const sig = el("button", "boton-sec", "▶"); sig.type = "button"; sig.setAttribute("aria-label", "Mes siguiente");
    ant.disabled = mesVista <= P.inicio; sig.disabled = mesVista >= mesActual();
    ant.addEventListener("click", function () { mesVista = sumarMes(mesVista, -1); pintarApp(caja, g, guardar, recargar, plan); });
    sig.addEventListener("click", function () { mesVista = sumarMes(mesVista, 1); pintarApp(caja, g, guardar, recargar, plan); });
    const editar = el("button", "enlace-boton", "Editar presupuesto"); editar.type = "button";
    editar.addEventListener("click", function () { editando = true; pintarApp(caja, g, guardar, recargar, plan); });
    nav.append(ant, el("strong", null, nombreMes(mesVista)), sig, el("span", "pr-espacio"), editar);
    caja.appendChild(nav);

    const enlace = g.compartido ? enlaceCorto("g", g.token) : "";
    caja.appendChild(bloqueResumen(g, mesVista, {
      accionesAporte: function (fila, m, a) {
        const bs = el("div", "botones");
        const reg = el("button", "boton-sec", "Registrar aportación"); reg.type = "button";
        reg.addEventListener("click", function () {
          if (fila.nextSibling && fila.nextSibling.classList && fila.nextSibling.classList.contains("pr-form-aporte")) return;
          const f = el("div", "fila-miembro pr-form-aporte");
          const imp = input("text", "Importe €", "Importe de la aportación de " + m.nombre); imp.value = a.cuota ? (a.cuota / 100).toFixed(2).replace(".", ",") : "";
          const fe = input("date", "", "Fecha"); fe.value = hoy();
          const ok = el("button", "boton-sec", "Guardar"); ok.type = "button";
          ok.addEventListener("click", function () {
            const v = R.aCentimos(imp.value); if (!(v > 0)) { imp.focus(); return; }
            guardar({
              aportes: (g.aportes || []).concat([{ id: R.nuevoId(), miembro: m.id, importe: v, fecha: fe.value || hoy(), nota: "", estado: "confirmado", via: "app" }]),
              registro: SG.conRegistro(g, "Registra aportación", m.nombre + " · " + R.eur(v))
            });
          });
          f.append(imp, fe, ok); fila.parentNode.insertBefore(f, fila.nextSibling); imp.focus();
        });
        bs.appendChild(reg);
        if (a.diferencia < 0 && !m.yo) {
          const wa = el("a", "boton-sec wa", "Recordar"); wa.target = "_blank"; wa.rel = "noopener";
          wa.href = R.enlaceWhatsApp("Hola " + m.nombre + " 👋\nEn *" + g.nombre + "* falta tu aportación: *" + R.eur(-a.diferencia) + "*." + (enlace ? "\n\nEl detalle está aquí:\n" + enlace.replace(/^https?:\/\//, "") : ""), m.telefono);
          bs.appendChild(wa);
        }
        fila.appendChild(bs);
      }
    }));

    // Aportaciones declaradas por enlace, pendientes de confirmar
    const apPend = (g.aportes || []).filter(function (a) { return a.estado === "pendiente"; });
    const extrasOtros = g.gastos.filter(function (x) { return x.estado === "pendiente" && x.propuesto_por !== SG.yoDe(g).id; });
    const extrasMios = g.gastos.filter(function (x) { return x.estado === "pendiente" && x.propuesto_por === SG.yoDe(g).id; });
    if (apPend.length || extrasOtros.length) {
      const sec = el("div", "pr-pendiente");
      sec.appendChild(el("p", "eti", "Pendiente de tu decisión"));
      extrasOtros.forEach(function (x) { sec.appendChild(filaDecision(g, x, function (decision, comentario) {
        guardar({
          gastos: g.gastos.map(function (y) { return y.id === x.id ? Object.assign({}, y, { estado: decision, decision: { por: SG.yoDe(g).id, fecha: ahoraISO(), comentario: comentario, via: "cuenta" } }) : y; }),
          registro: SG.conRegistro(g, decision === "aprobado" ? "Aprueba extra" : "Rechaza extra", x.concepto + " · " + R.eur(x.importe) + (comentario ? " · «" + comentario + "»" : "") + " (cuenta)")
        });
      })); });
      apPend.forEach(function (a) {
        const f = el("div", "fila-pago aviso-pago");
        const t = el("span", "texto-pago"); t.append(el("b", null, nom(g, a.miembro)), document.createTextNode(" dice que ha aportado"), el("div", "g-meta", (a.nota ? "«" + a.nota + "» · " : "") + (a.via === "cuenta" ? "con su cuenta · " : "desde el enlace · ") + new Date(a.fecha + "T12:00:00").toLocaleDateString("es-ES", { day: "numeric", month: "short" })));
        const bs = el("div", "botones");
        const ok = el("button", "boton-sec", "Confirmar"); ok.type = "button";
        ok.addEventListener("click", function () {
          guardar({ aportes: g.aportes.map(function (y) { return y.id === a.id ? Object.assign({}, y, { estado: "confirmado" }) : y; }),
                    registro: SG.conRegistro(g, "Confirma aportación", nom(g, a.miembro) + " · " + R.eur(a.importe)) });
        });
        const no = el("button", "boton-sec peligro-texto", "No me ha llegado"); no.type = "button";
        no.addEventListener("click", function () {
          guardar({ aportes: g.aportes.map(function (y) { return y.id === a.id ? Object.assign({}, y, { estado: "rechazado" }) : y; }),
                    registro: SG.conRegistro(g, "Rechaza aportación", nom(g, a.miembro) + " · " + R.eur(a.importe) + " · no consta el ingreso") });
        });
        bs.append(ok, no);
        f.append(t, el("span", "importe", R.eur(a.importe)), bs);
        sec.appendChild(f);
      });
      caja.appendChild(sec);
    }
    if (extrasMios.length) {
      const sec = el("div", "pr-pendiente");
      sec.appendChild(el("p", "eti", "Esperando aprobación de la otra parte"));
      extrasMios.forEach(function (x) {
        const f = el("div", "fila-pago");
        f.append(el("span", "texto-pago", x.concepto), el("span", "importe", R.eur(x.importe)));
        const otros = g.miembros.filter(function (m) { return !m.yo; });
        const bs = el("div", "botones");
        otros.forEach(function (m) {
          const wa = el("a", "boton-sec wa", otros.length > 1 ? "Pedir a " + m.nombre : "Pedir aprobación"); wa.target = "_blank"; wa.rel = "noopener";
          wa.href = R.enlaceWhatsApp("Hola " + m.nombre + " 👋\nPropongo un gasto extra en *" + g.nombre + "*:\n• " + x.concepto + ": *" + R.eur(x.importe) + "*\n\n" +
            (enlace ? "¿Lo apruebas? Puedes hacerlo aquí:\n" + enlace.replace(/^https?:\/\//, "") : "¿Lo apruebas?"), m.telefono);
          bs.appendChild(wa);
        });
        f.appendChild(bs);
        sec.appendChild(f);
      });
      if (!g.compartido) sec.appendChild(el("p", "ayuda", "Activa el enlace del grupo para que la otra parte pueda aprobar sin cuenta."));
      caja.appendChild(sec);
    }
    caja.appendChild(el("p", "ayuda", "La otra parte aprueba los extras desde el enlace del grupo o con su propia cuenta de Saldamos (vinculándola desde el enlace)."));
    caja.appendChild(bloqueRegistro(g));
  }

  // Fila «aprobar / rechazar» (con motivo obligatorio para rechazar)
  function filaDecision(g, x, decidir) {
    const f = el("div", "fila-pago aviso-pago");
    const t = el("span", "texto-pago");
    t.append(el("b", null, x.concepto), el("div", "g-meta", "Gasto extra propuesto por " + nom(g, x.propuesto_por) + " · pagó " + x.pagos.map(function (p) { return nom(g, p.miembro); }).join(", ") +
      (x.nota ? " · «" + x.nota + "»" : "") + " · " + new Date(x.fecha + "T12:00").toLocaleDateString("es-ES", { day: "numeric", month: "short" })));
    const bs = el("div", "botones");
    const ok = el("button", "boton-sec", "Aprobar"); ok.type = "button";
    const no = el("button", "boton-sec peligro-texto", "Rechazar"); no.type = "button";
    ok.addEventListener("click", function () { ok.disabled = true; decidir("aprobado", ""); });
    no.addEventListener("click", function () {
      if (f.querySelector(".pr-motivo")) return;
      const fila = el("div", "fila-miembro pr-motivo");
      const m = el("input"); m.type = "text"; m.placeholder = "¿Por qué no? (obligatorio)"; m.maxLength = 300; m.setAttribute("aria-label", "Motivo del rechazo");
      const b = el("button", "boton-sec peligro-texto", "Rechazar"); b.type = "button";
      b.addEventListener("click", function () { const v = m.value.trim(); if (!v) { m.focus(); return; } b.disabled = true; decidir("rechazado", v); });
      fila.append(m, b); f.appendChild(fila); m.focus();
    });
    bs.append(ok, no);
    f.append(t, el("span", "importe", R.eur(x.importe)), bs);
    return f;
  }

  // Formulario: presupuesto mensual, cuánto pone cada uno y categorías
  function formulario(g, guardar, caja, recargar, plan) {
    const SG = global.SaldamosGrupos;
    const P = g.presupuesto || {};
    const f = el("div", "pr-form");
    f.appendChild(cabecera(g.presupuesto ? "Editar presupuesto" : "Nuevo presupuesto mensual"));
    const lm = el("label", "pr-campo", "Presupuesto al mes");
    const mensual = input("text", "Ej. 600", "Presupuesto al mes"); mensual.id = "pr-mensual";
    if (P.mensual) mensual.value = (P.mensual / 100).toFixed(2).replace(".", ",");
    lm.appendChild(mensual); f.appendChild(lm);

    f.appendChild(el("p", "eti", "¿Cuánto pone cada uno?"));
    const modos = el("div", "fila-miembro");
    const modoSel = P.modo || "pct";
    ["pct", "importe"].forEach(function (v) {
      const l = el("label", "casilla"); const r = el("input"); r.type = "radio"; r.name = "pr-modo"; r.value = v; r.checked = v === modoSel;
      l.append(r, el("span", null, v === "pct" ? "Por porcentaje" : "Importe fijo")); modos.appendChild(l);
    });
    f.appendChild(modos);
    const filas = el("div", "reparto-tabla");
    g.miembros.forEach(function (m) {
      const fila = el("div", "reparto-fila porc");
      const i = input("text", "", "Aportación de " + m.nombre); i.dataset.miembro = m.id; i.id = "pr-ap-" + m.id;
      const v = modoSel === "pct" ? (P.pct || {})[m.id] : ((P.cuotas || {})[m.id] || 0) / 100;
      if (v) i.value = String(v).replace(".", ",");
      fila.append(el("label", null, m.nombre), i, el("span", "cuota", ""));
      filas.appendChild(fila);
    });
    f.appendChild(filas);

    f.appendChild(el("p", "eti", "Categorías (opcional)"));
    const cats = el("div", "pr-cats-form");
    function filaCat(nombre, importe) {
      const r = el("div", "fila-miembro pr-cat-fila");
      const n = el("input"); n.type = "text"; n.placeholder = "Ej. Colegio"; n.maxLength = 40; n.value = nombre || ""; n.className = "pr-cat-nombre"; n.setAttribute("aria-label", "Categoría");
      const v = input("text", "€ al mes", "Importe de la categoría"); v.className = "pr-cat-importe"; if (importe) v.value = (importe / 100).toFixed(2).replace(".", ",");
      const x = el("button", "g-borrar", "×"); x.type = "button"; x.setAttribute("aria-label", "Quitar categoría");
      x.addEventListener("click", function () { r.remove(); recalcular(); });
      r.append(n, v, x); cats.appendChild(r);
    }
    (P.categorias && P.categorias.length ? P.categorias : [{}, {}, {}]).forEach(function (c) { filaCat(c.nombre, c.importe); });
    const mas = el("button", "boton-sec", "+ Categoría"); mas.type = "button"; mas.addEventListener("click", function () { filaCat(); });
    const plantilla = el("button", "enlace-boton", "Usar ejemplo «hijos»"); plantilla.type = "button";
    plantilla.addEventListener("click", function () {
      cats.innerHTML = "";
      [["Colegio", 25000], ["Extraescolares", 12000], ["Ropa", 8000], ["Salud", 5000], ["Otros", 10000]].forEach(function (c) { filaCat(c[0], c[1]); });
      if (!mensual.value) mensual.value = "600,00";
      recalcular();
    });
    f.append(cats, el("div", "fila-miembro", null));
    f.lastChild.append(mas, plantilla);

    const resumen = el("p", "ayuda"); const err = el("p", "error"); err.hidden = true;
    f.append(resumen, err);
    function modoActual() { return f.querySelector('input[name="pr-modo"]:checked').value; }
    function leer() {
      const total = R.aCentimos(mensual.value), m = modoActual();
      const pct = {}, cuotas = {};
      filas.querySelectorAll("input").forEach(function (i) {
        const v = m === "pct" ? (parseFloat(String(i.value).replace(",", ".")) || 0) : R.aCentimos(i.value);
        if (m === "pct") pct[i.dataset.miembro] = v; else cuotas[i.dataset.miembro] = v;
      });
      if (m === "pct") {
        const ids = Object.keys(pct); let asignado = 0;
        ids.forEach(function (id) { cuotas[id] = Math.floor(total * pct[id] / 100); asignado += cuotas[id]; });
        const mayor = ids.slice().sort(function (a, b) { return pct[b] - pct[a]; })[0];
        if (mayor && Math.abs(ids.reduce(function (s, k) { return s + pct[k]; }, 0) - 100) < 0.01) cuotas[mayor] += total - asignado;
      } else {
        const t = Object.keys(cuotas).reduce(function (s, k) { return s + cuotas[k]; }, 0) || 1;
        Object.keys(cuotas).forEach(function (k) { pct[k] = Math.round(cuotas[k] * 10000 / t) / 100; });
      }
      const categorias = Array.from(cats.querySelectorAll(".pr-cat-fila")).map(function (r) {
        return { nombre: r.querySelector(".pr-cat-nombre").value.trim(), importe: R.aCentimos(r.querySelector(".pr-cat-importe").value) };
      }).filter(function (c) { return c.nombre; });
      return { mensual: total, modo: m, pct: pct, cuotas: cuotas, categorias: categorias };
    }
    function recalcular() {
      const x = leer();
      filas.querySelectorAll(".reparto-fila").forEach(function (fila) {
        const id = fila.querySelector("input").dataset.miembro;
        fila.querySelector(".cuota").textContent = x.mensual && x.cuotas[id] ? R.eur(x.cuotas[id]) + "/mes" : "";
      });
      const sumaCat = x.categorias.reduce(function (s, c) { return s + c.importe; }, 0);
      const sumaAp = Object.keys(x.cuotas).reduce(function (s, k) { return s + x.cuotas[k]; }, 0);
      resumen.textContent = x.mensual ? "Aportaciones: " + R.eur(sumaAp) + " de " + R.eur(x.mensual) + (sumaAp === x.mensual ? " ✓" : "") +
        (x.categorias.length ? " · Categorías: " + R.eur(sumaCat) + (sumaCat < x.mensual ? " (el resto, sin categoría)" : "") : "") : "";
    }
    f.addEventListener("input", recalcular);
    f.addEventListener("change", function (e) {
      if (e.target.name === "pr-modo") { filas.querySelectorAll("input").forEach(function (i) { i.value = ""; i.placeholder = modoActual() === "pct" ? "%" : "€ al mes"; }); }
      recalcular();
    });
    filas.querySelectorAll("input").forEach(function (i) { i.placeholder = modoSel === "pct" ? "%" : "€ al mes"; });

    const bs = el("div", "fila-miembro");
    const ok = el("button", "anadir", g.presupuesto ? "Guardar cambios" : "Crear presupuesto"); ok.type = "button";
    const cancelar = el("button", "boton-sec", "Cancelar"); cancelar.type = "button";
    cancelar.addEventListener("click", function () { editando = false; pintarApp(caja, g, guardar, recargar, plan); });
    ok.addEventListener("click", function () {
      const x = leer();
      let problema = "";
      if (!(x.mensual > 0)) problema = "Escribe el presupuesto al mes.";
      else if (x.modo === "pct" && Math.abs(Object.keys(x.pct).reduce(function (s, k) { return s + x.pct[k]; }, 0) - 100) >= 0.01) problema = "Los porcentajes deben sumar 100 %.";
      else if (x.modo === "importe" && Object.keys(x.cuotas).reduce(function (s, k) { return s + x.cuotas[k]; }, 0) !== x.mensual) problema = "Las aportaciones deben sumar el presupuesto.";
      else if (x.categorias.reduce(function (s, c) { return s + c.importe; }, 0) > x.mensual) problema = "Las categorías suman más que el presupuesto.";
      if (problema) { err.textContent = problema; err.hidden = false; return; }
      const nuevo = Object.assign({ inicio: P.inicio || mesActual() }, x);
      const detalle = R.eur(x.mensual) + "/mes · " + g.miembros.map(function (m) { return m.nombre + " " + R.eur(x.cuotas[m.id] || 0); }).join(", ") +
        (x.categorias.length ? " · " + x.categorias.map(function (c) { return c.nombre + " " + R.eur(c.importe); }).join(", ") : "");
      editando = false;
      guardar({ presupuesto: nuevo, registro: SG.conRegistro(g, g.presupuesto ? "Cambia el presupuesto" : "Crea el presupuesto", detalle) });
    });
    bs.append(ok, cancelar);
    f.appendChild(bs);
    setTimeout(recalcular, 0);
    return f;
  }

  // ---------------- 3 · Página pública del grupo (grupo.html) ----------------
  let pub = null;
  global.alPintarPublico = function (g, token, recargar) {
    let caja = document.getElementById("pres-publico");
    if (!g.presupuesto) { if (caja) caja.remove(); return; }
    if (!caja) {
      caja = el("section", "tarjeta pres-caja"); caja.id = "pres-publico";
      const ancla = document.querySelector("#contenido > section");
      ancla.parentNode.insertBefore(caja, ancla.nextSibling);
    }
    const sel = document.getElementById("quien");
    if (g.yo_miembro && !sel.value) { sel.value = g.yo_miembro; sel.dispatchEvent(new Event("change")); }
    pub = { caja: caja, g: g, token: token, recargar: recargar };
    pintarPublico(caja, g, token, recargar);
    if (!sel.dataset.pres) { sel.dataset.pres = "1"; sel.addEventListener("change", function () { pintarPublico(pub.caja, pub.g, pub.token, pub.recargar); }); }
  };

  async function rpc(nombre, args, msg) {
    const r = await sb.rpc(nombre, args);
    if (r.error) { msg.textContent = traducirError(r.error); msg.className = "mensaje mal"; msg.hidden = false; return false; }
    return true;
  }

  function pintarPublico(caja, g, token, recargar) {
    const yo = document.getElementById("quien").value;
    caja.innerHTML = "";
    const cab = el("div", "fila-titulo"); const h = el("h2", null, "Presupuesto compartido"); h.style.margin = "0";
    cab.append(h, el("strong", null, nombreMes(mesActual())));
    caja.appendChild(cab);
    caja.appendChild(bloqueResumen(g, mesActual()));
    const msg = el("p", "mensaje"); msg.hidden = true;
    if (!yo) {
      caja.appendChild(el("p", "ayuda", "Elige tu nombre arriba para aprobar gastos extra, proponer uno o avisar de una aportación."));
    } else {
      // Extras pendientes que puede decidir esta persona
      const pendientes = g.gastos.filter(function (x) { return x.estado === "pendiente" && x.propuesto_por !== yo; });
      if (pendientes.length) {
        caja.appendChild(el("p", "eti", "Pendiente de tu aprobación"));
        pendientes.forEach(function (x) {
          caja.appendChild(filaDecision(g, x, async function (decision, comentario) {
            if (await rpc("grupo_decidir", { t: token, gasto: x.id, miembro: yo, decision: decision, comentario: comentario || null }, msg)) recargar();
          }));
        });
      }
      const mios = g.gastos.filter(function (x) { return x.estado === "pendiente" && x.propuesto_por === yo; });
      mios.forEach(function (x) { caja.appendChild(el("p", "ayuda", "⏳ Propusiste «" + x.concepto + "» (" + R.eur(x.importe) + "): falta que la otra parte lo apruebe.")); });

      // Proponer un extra
      const dx = el("details", "pr-accion"); dx.appendChild(el("summary", null, "+ Proponer un gasto extra"));
      const fx = el("div", "grid-form");
      const c = el("input"); c.type = "text"; c.placeholder = "Concepto (ej. Campamento de verano)"; c.maxLength = 120; c.setAttribute("aria-label", "Concepto"); c.id = "pp-concepto";
      const i = input("text", "Importe €", "Importe"); i.id = "pp-importe";
      const fe = input("date", "", "Fecha"); fe.value = hoy();
      const pp = el("select"); pp.setAttribute("aria-label", "Quién lo paga");
      g.miembros.forEach(function (m) { const o = el("option", null, "Lo paga " + m.nombre); o.value = m.id; if (m.id === yo) o.selected = true; pp.appendChild(o); });
      const nota = el("input"); nota.type = "text"; nota.placeholder = "Comentario (opcional)"; nota.maxLength = 300; nota.setAttribute("aria-label", "Comentario");
      const enviar = el("button", "anadir", "Proponer"); enviar.type = "button";
      enviar.addEventListener("click", async function () {
        const v = R.aCentimos(i.value);
        if (!c.value.trim() || !(v > 0)) { msg.textContent = "Escribe el concepto y el importe."; msg.className = "mensaje mal"; msg.hidden = false; return; }
        enviar.disabled = true;
        if (await rpc("grupo_proponer_extra", { t: token, miembro: yo, concepto: c.value.trim(), importe: v, fecha: fe.value || hoy(), pagado_por: pp.value, comentario: nota.value.trim() || null }, msg)) recargar();
        else enviar.disabled = false;
      });
      fx.append(c, i, fe, pp, nota, enviar); dx.appendChild(fx); caja.appendChild(dx);

      // Avisar de una aportación
      const da = el("details", "pr-accion"); da.appendChild(el("summary", null, "+ He hecho mi aportación"));
      const fa = el("div", "grid-form");
      const ai = input("text", "Importe €", "Importe de tu aportación"); ai.id = "pa-importe";
      const ap = aportaciones(g, mesActual())[yo]; if (ap && ap.cuota) ai.value = (ap.cuota / 100).toFixed(2).replace(".", ",");
      const af = input("date", "", "Fecha"); af.value = hoy();
      const an = el("input"); an.type = "text"; an.placeholder = "Nota (ej. transferencia de octubre)"; an.maxLength = 200; an.setAttribute("aria-label", "Nota");
      const ab = el("button", "anadir", "Avisar"); ab.type = "button";
      ab.addEventListener("click", async function () {
        const v = R.aCentimos(ai.value); if (!(v > 0)) { ai.focus(); return; }
        ab.disabled = true;
        if (await rpc("grupo_declarar_aporte", { t: token, miembro: yo, importe: v, fecha: af.value || hoy(), nota: an.value.trim() || null }, msg)) recargar();
        else ab.disabled = false;
      });
      fa.append(ai, af, an, ab); da.appendChild(fa); caja.appendChild(da);

      // Vincular con su propia cuenta
      if (!g.yo_miembro) {
        const turno = caja.dataset.turno = String(Number(caja.dataset.turno || 0) + 1);
        sesionActual().then(function (s) {
          if (caja.dataset.turno !== turno) return;  // ya se volvió a pintar
          const p = el("p", "ayuda");
          if (s) {
            const b = el("button", "enlace-boton", "Vincular este grupo a mi cuenta como " + R.nombre(g, yo)); b.type = "button";
            b.addEventListener("click", async function () { if (await rpc("grupo_vincular", { t: token, miembro: yo }, msg)) { msg.textContent = "Listo: verás este grupo en tu app y tus aprobaciones quedarán con tu cuenta."; msg.className = "mensaje ok"; msg.hidden = false; recargar(); } });
            p.appendChild(b);
          } else {
            p.append(document.createTextNode("¿Prefieres aprobar con tu propia cuenta? "));
            const a = el("a", null, "Entra o crea tu cuenta"); a.href = "acceso.html"; p.appendChild(a);
            p.appendChild(document.createTextNode(" y vuelve a este enlace."));
          }
          caja.insertBefore(p, caja.querySelector(".pr-registro"));
        });
      } else {
        caja.appendChild(el("p", "ayuda", "✓ Este grupo está vinculado a tu cuenta: tus aprobaciones quedan registradas con ella."));
      }
    }
    caja.appendChild(msg);
    caja.appendChild(bloqueRegistro(g));
  }
})(typeof window !== "undefined" ? window : globalThis);
