// =====================================================================
//  GRUPOS · gastos compartidos (viajes, cenas…) y cobros por WhatsApp
//  Las cuentas las calcula reparto.js; aquí solo están las pantallas.
// =====================================================================
(function () {
  const R = window.Reparto;
  let grupos = [];
  let actualId = null;
  let nuevosMiembros = [];
  let firmaForm = "";
  let miId = null;  // para distinguir los grupos que otra persona compartió contigo

  const $ = function (id) { return document.getElementById(id); };
  function el(tag, clase, texto) {
    const e = document.createElement(tag);
    if (clase) e.className = clase;
    if (texto != null) e.textContent = texto;
    return e;
  }
  function hoy() { return new Date().toISOString().slice(0, 10); }
  function actual() { return grupos.find(function (g) { return g.id === actualId; }); }
  function enlacePublico(g) { return enlaceCorto("g", g.token); }
  function yoDe(g) { return (g.miembros.find(function (m) { return m.yo; }) || g.miembros[0] || {}); }
  function ahoraISO() { const d = new Date(); return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 19); }
  // Registro del grupo: solo se añade (la base de datos impide borrar o cambiar entradas)
  function conRegistro(g, accion, detalle) {
    return (g.registro || []).concat([{ fecha: ahoraISO(), quien: yoDe(g).nombre || "Yo", accion: accion, detalle: detalle || "" }]);
  }
  window.SaldamosGrupos = { conRegistro: conRegistro, yoDe: yoDe };
  function telefono(g, id) { const m = g.miembros.find(function (x) { return x.id === id; }); return m ? m.telefono : ""; }

  // Botón que pide una segunda pulsación antes de hacer algo irreversible
  function confirmar(boton, texto, accion) {
    boton.addEventListener("click", function () {
      if (boton.dataset.confirmar) { accion(); return; }
      const original = boton.textContent;
      boton.dataset.confirmar = "1"; boton.textContent = texto;
      setTimeout(function () { delete boton.dataset.confirmar; boton.textContent = original; }, 3000);
    });
  }

  function botonWhatsApp(texto, mensaje, tel) {
    const a = el("a", "boton-sec wa", texto);
    a.href = R.enlaceWhatsApp(mensaje, tel);
    a.target = "_blank"; a.rel = "noopener";
    return a;
  }

  // ---------------- Datos ----------------
  async function cargarGrupos() {
    const r = await sb.from("grupos").select("*");
    if (r.error) { ponerEstadoSync("No se pudieron cargar los grupos: " + traducirError(r.error), "error"); return; }
    const ses = await sesionActual();
    miId = ses && ses.user ? ses.user.id : null;
    grupos = r.data.sort(function (a, b) { return String(b.actualizado || "").localeCompare(String(a.actualizado || "")); });
    pintarLista();
    if (actualId) pintarDetalle();
  }
  window.cargarGrupos = cargarGrupos;

  // Guarda cambios del grupo abierto. Primero pinta (respuesta inmediata)
  // y después lo manda a la base de datos.
  async function guardar(cambios) {
    const g = actual(); if (!g) return;
    Object.assign(g, cambios);
    pintarDetalle();
    const r = await sb.from("grupos").update(cambios).eq("id", g.id);
    if (r.error) { ponerEstadoSync("No se pudo guardar: " + traducirError(r.error), "error"); await cargarGrupos(); return; }
    ponerEstadoSync("Guardado · se ve igual en el móvil", "ok");
  }

  // ---------------- Lista de grupos ----------------
  function pintarLista() {
    const ul = $("lista-grupos"); ul.innerHTML = "";
    grupos.forEach(function (g) {
      const li = el("li");
      const b = el("button", "tarjeta-grupo"); b.type = "button";
      const cuerpo = el("div", "cuerpo");
      cuerpo.append(el("strong", null, g.nombre), el("span", "g-meta", g.miembros.length + " personas · " + g.gastos.length + " gastos"));
      const pend = R.plan(g).length;
      b.append(cuerpo, el("span", "g-total", R.eur(R.total(g))), el("span", "estado " + (pend ? "pendiente" : "activo"), pend ? pend + " pagos pendientes" : "En paz"));
      const ajeno = miId && g.user_id && g.user_id !== miId;
      if (ajeno) {
        // Grupo de otra persona vinculado a tu cuenta: se abre su página compartida
        cuerpo.appendChild(el("span", "etiqueta-gasto pres", "Compartido contigo"));
        b.addEventListener("click", function () { location.href = enlacePublico(g); });
      } else {
        b.addEventListener("click", function () { abrir(g.id); });
      }
      li.appendChild(b); ul.appendChild(li);
    });
    $("vacio-grupos").hidden = grupos.length > 0;
  }

  // Formulario "crear grupo": tú ya vienes incluido
  function pintarNuevosMiembros() {
    const c = $("ng-miembros"); c.innerHTML = "";
    nuevosMiembros.forEach(function (m, i) {
      const chip = el("span", "chip", m.nombre + (m.yo ? " (tú)" : ""));
      if (!m.yo) {
        const x = el("button", null, "×"); x.type = "button"; x.setAttribute("aria-label", "Quitar a " + m.nombre);
        x.addEventListener("click", function () { nuevosMiembros.splice(i, 1); pintarNuevosMiembros(); });
        chip.appendChild(x);
      }
      c.appendChild(chip);
    });
  }
  $("caja-nuevo-grupo").addEventListener("toggle", function () {
    if (this.open && nuevosMiembros.length === 0) {
      nuevosMiembros.push({ id: R.nuevoId(), nombre: $("nombre-usuario").textContent.trim() || "Yo", telefono: "", yo: true });
      pintarNuevosMiembros();
    }
  });
  function anadirNuevo() {
    const n = $("ng-persona").value.trim(); if (!n) return;
    nuevosMiembros.push({ id: R.nuevoId(), nombre: n, telefono: $("ng-telefono").value.trim() });
    $("ng-persona").value = ""; $("ng-telefono").value = ""; $("ng-persona").focus();
    pintarNuevosMiembros();
  }
  $("ng-anadir").addEventListener("click", anadirNuevo);
  $("ng-persona").addEventListener("keydown", function (e) { if (e.key === "Enter") { e.preventDefault(); anadirNuevo(); } });

  $("form-grupo").addEventListener("submit", async function (ev) {
    ev.preventDefault();
    const nombre = $("ng-nombre").value.trim();
    const err = $("ng-error");
    if (!nombre) { err.textContent = "Ponle un nombre al grupo."; err.hidden = false; return; }
    if (nuevosMiembros.length < 2) { err.textContent = "Añade al menos otra persona."; err.hidden = false; return; }
    err.hidden = true;
    const r = await sb.from("grupos").insert({ nombre: nombre, miembros: nuevosMiembros }).select().single();
    if (r.error) { err.textContent = traducirError(r.error); err.hidden = false; return; }
    $("ng-nombre").value = ""; nuevosMiembros = []; $("caja-nuevo-grupo").open = false;
    await cargarGrupos();
    abrir(r.data.id);
  });

  // ---------------- Detalle de un grupo ----------------
  function abrir(id) {
    actualId = id; firmaForm = "";
    $("grupos-lista-vista").hidden = true;
    $("grupo-detalle-vista").hidden = false;
    pintarDetalle();
    window.scrollTo(0, 0);
  }
  $("gd-volver").addEventListener("click", function () {
    actualId = null;
    $("grupo-detalle-vista").hidden = true;
    $("grupos-lista-vista").hidden = false;
    pintarLista();
  });
  confirmar($("gd-borrar"), "¿Seguro? Pulsa otra vez", async function () {
    const g = actual(); if (!g) return;
    const r = await sb.from("grupos").delete().eq("id", g.id);
    if (r.error) { ponerEstadoSync(traducirError(r.error), "error"); return; }
    $("gd-volver").click();
    await cargarGrupos();
  });

  function pintarDetalle() {
    const g = actual();
    if (!g) { $("gd-volver").click(); return; }
    const enlace = enlacePublico(g);
    if ($("gd-abrir")) $("gd-abrir").href = enlace;
    const plan = R.plan(g);
    const nom = function (id) { return id === "bote" ? "el bote común" : R.nombre(g, id); };
    const conPres = !!g.presupuesto;

    $("gd-nombre").textContent = g.nombre;
    $("gd-resumen").textContent = g.miembros.length + " personas · " + g.gastos.length + " gastos · total " + R.eur(R.total(g));

    // Avisos «Ya he pagado» enviados desde el enlace, pendientes de confirmar
    const avisos = g.avisos || [];
    const cajaA = $("gd-avisos"); cajaA.innerHTML = ""; cajaA.hidden = !avisos.length;
    if (avisos.length) cajaA.appendChild(el("p", "eti", "Pendiente de confirmar"));
    avisos.forEach(function (v) {
      const fila = el("div", "fila-pago aviso-pago");
      const t = el("span", "texto-pago");
      t.append(el("b", null, nom(v.de)), document.createTextNode(" dice que ha pagado a "), el("b", null, nom(v.a)),
        el("div", "g-meta", "Avisó desde el enlace" + (v.fecha ? " · " + new Date(v.fecha + "T12:00").toLocaleDateString("es-ES", { day: "numeric", month: "short" }) : "") + ". Comprueba que te ha llegado."));
      const botones = el("div", "botones");
      const ok = el("button", "boton-sec", "Confirmar"); ok.type = "button";
      ok.addEventListener("click", function () {
        guardar({ avisos: avisos.filter(function (y) { return y.id !== v.id; }),
                  liquidaciones: g.liquidaciones.concat([{ id: R.nuevoId(), de: v.de, a: v.a, importe: v.importe, fecha: v.fecha || hoy() }]) });
      });
      const no = el("button", "boton-sec peligro-texto", "No me ha llegado"); no.type = "button";
      confirmar(no, "¿Descartar el aviso?", function () { guardar({ avisos: avisos.filter(function (y) { return y.id !== v.id; }) }); });
      botones.append(ok, no);
      fila.append(t, el("span", "importe", R.eur(v.importe)), botones);
      cajaA.appendChild(fila);
    });

    // Plan de pagos
    const cajaPlan = $("gd-plan"); cajaPlan.innerHTML = "";
    if (!plan.length) cajaPlan.appendChild(el("p", "ayuda", g.gastos.length ? "Todo saldado: nadie debe nada." : "Añade el primer gasto para ver las cuentas."));
    plan.forEach(function (p) {
      const fila = el("div", "fila-pago");
      const t = el("span", "texto-pago");
      t.append(el("b", null, nom(p.de)), document.createTextNode(" paga a "), el("b", null, nom(p.a)));
      const acreedor = g.miembros.find(function (m) { return m.id === p.a; }) || {};
      const via = [acreedor.telefono ? "Bizum " + acreedor.telefono : "", acreedor.iban ? "IBAN " + R.formatoIBAN(acreedor.iban) : ""].filter(Boolean).join(" · ");
      t.appendChild(el("div", "g-meta", via ? "Cobra por " + via + (acreedor.mostrar_cobro ? " (visible en el enlace)" : "") : "Sin datos de cobro: añádelos en «Personas»"));
      const botones = el("div", "botones");
      botones.appendChild(botonWhatsApp("Pedir por WhatsApp", R.mensajePersona(g, p.de, g.compartido ? enlace : ""), telefono(g, p.de)));
      const pagado = el("button", "boton-sec", "Marcar pagado"); pagado.type = "button";
      confirmar(pagado, "¿Confirmar?", function () {
        guardar({ liquidaciones: g.liquidaciones.concat([{ id: R.nuevoId(), de: p.de, a: p.a, importe: p.importe, fecha: hoy() }]) });
      });
      botones.appendChild(pagado);
      fila.append(t, el("span", "importe", R.eur(p.importe)), botones);
      cajaPlan.appendChild(fila);
    });
    const wa = $("gd-wa-grupo");
    wa.href = R.enlaceWhatsApp(R.mensajeGrupo(g, g.compartido ? enlace : ""), "");
    wa.hidden = !g.gastos.length;

    // Cada persona
    const saldos = R.saldos(g);
    const cajaP = $("gd-personas"); cajaP.innerHTML = "";
    g.miembros.forEach(function (m) {
      const s = saldos[m.id];
      const fila = el("div", "fila-pago");
      const t = el("span", "texto-pago");
      t.append(el("b", null, m.nombre + (m.yo ? " (tú)" : "")), el("div", "g-meta", "Su parte " + R.eur(s.parte) + " · adelantó " + R.eur(s.pagado)));
      const imp = el("span", "importe " + (s.neto > 0 ? "positivo-txt" : s.neto < 0 ? "negativo-txt" : ""),
        s.neto > 0 ? "Le deben " + R.eur(s.neto) : s.neto < 0 ? "Debe " + R.eur(-s.neto) : "En paz");
      const botones = el("div", "botones");
      if (!m.yo) botones.appendChild(botonWhatsApp("Enviar su detalle", R.mensajePersona(g, m.id, g.compartido ? enlace : ""), m.telefono));
      fila.append(t, imp, botones);
      cajaP.appendChild(fila);
    });

    // Enlace
    $("gd-enlace").value = enlace;
    $("gd-compartido").checked = !!g.compartido;
    $("gd-enlace").disabled = !g.compartido;

    // Gastos
    const ul = $("gd-gastos"); ul.innerHTML = "";
    g.gastos.slice().sort(function (a, b) { return String(b.fecha).localeCompare(String(a.fecha)); }).forEach(function (x) {
      const li = el("li", "gasto");
      const cab = el("div", "g-cab");
      const cuerpo = el("div", "cuerpo");
      const pag = (x.pagos || []).map(function (p) { return nom(p.miembro) + (x.pagos.length > 1 ? " " + R.eur(p.importe) : ""); }).join(", ");
      const rep = x.reparto.modo === "importes" ? "importes distintos"
        : x.reparto.modo === "porcentaje" ? Object.keys(x.reparto.porcentajes).map(function (k) { return nom(k) + " " + String(x.reparto.porcentajes[k]).replace(".", ",") + " %"; }).join(" / ")
        : (x.reparto.miembros.length === g.miembros.length ? "entre todos" : "entre " + x.reparto.miembros.map(nom).join(", "));
      const fechaTxt = x.fecha ? " · " + new Date(x.fecha + "T12:00").toLocaleDateString("es-ES", { day: "numeric", month: "short" }) : "";
      const ticketTxt = x.total_ticket ? " · al grupo " + R.eur(x.importe) + " de " + R.eur(x.total_ticket) : "";
      cuerpo.append(el("strong", null, x.concepto), el("span", "g-meta", "Pagó " + pag + (x.presupuesto ? "" : " · " + rep) + fechaTxt + ticketTxt));
      // Etiqueta de presupuesto / extra y su estado
      if (x.presupuesto || x.estado) {
        let txt, cls;
        if (x.estado === "anulado") { txt = "Anulado" + (x.anulacion && x.anulacion.motivo ? ": «" + x.anulacion.motivo + "»" : ""); cls = "anulado"; }
        else if (x.presupuesto) { txt = "Presupuesto" + (x.categoria ? " · " + x.categoria : ""); cls = "pres"; }
        else if (x.estado === "pendiente") { txt = "Extra · pendiente de aprobar" + (x.propuesto_por ? " (propuesto por " + nom(x.propuesto_por) + ")" : ""); cls = "pendiente"; }
        else if (x.estado === "rechazado") { txt = "Extra rechazado" + (x.decision ? " por " + nom(x.decision.por) + (x.decision.comentario ? ": «" + x.decision.comentario + "»" : "") : ""); cls = "rechazado"; }
        else { txt = "Extra aprobado" + (x.decision ? " por " + nom(x.decision.por) + " (" + (x.decision.via === "enlace" ? "por enlace" : "con su cuenta") + ", " + new Date(x.decision.fecha).toLocaleDateString("es-ES", { day: "numeric", month: "short" }) + ")" : ""); cls = "aprobado"; }
        cuerpo.appendChild(el("span", "etiqueta-gasto " + cls, txt));
      }
      if (x.estado === "anulado" || x.estado === "rechazado") li.classList.add("tachado");
      let accion;
      if (conPres) {
        // Con presupuesto no se borra: se anula con motivo y queda en el registro
        accion = el("button", "enlace-boton peligro-texto", "Anular"); accion.type = "button";
        if (x.estado === "anulado" || x.estado === "rechazado") accion.hidden = true;
        accion.addEventListener("click", function () {
          if (li.querySelector(".anular-fila")) return;
          const fila = el("div", "fila-miembro anular-fila");
          const motivo = el("input"); motivo.type = "text"; motivo.placeholder = "Motivo (obligatorio)"; motivo.maxLength = 200; motivo.setAttribute("aria-label", "Motivo de la anulación");
          const ok = el("button", "boton-sec", "Anular gasto"); ok.type = "button";
          ok.addEventListener("click", function () {
            const m = motivo.value.trim(); if (!m) { motivo.focus(); return; }
            guardar({
              gastos: g.gastos.map(function (y) { return y.id === x.id ? Object.assign({}, y, { estado: "anulado", anulacion: { motivo: m, fecha: ahoraISO(), por: yoDe(g).id } }) : y; }),
              registro: conRegistro(g, "Anula gasto", x.concepto + " · " + R.eur(x.importe) + " · «" + m + "»")
            });
          });
          fila.append(motivo, ok); li.appendChild(fila); motivo.focus();
        });
      } else {
        accion = el("button", "g-borrar", "×"); accion.type = "button"; accion.setAttribute("aria-label", "Borrar gasto");
        confirmar(accion, "¿Borrar?", function () { guardar({ gastos: g.gastos.filter(function (y) { return y.id !== x.id; }) }); });
      }
      cab.append(cuerpo, el("span", "g-total", R.eur(x.importe)), accion);
      li.appendChild(cab);
      ul.appendChild(li);
    });

    // Personas y sus datos de cobro (Bizum / IBAN). El dinero nunca pasa por la app.
    const cajaM = $("gd-miembros"); cajaM.innerHTML = "";
    const estiloInput = "font:inherit;padding:6px 10px;border:1.5px solid var(--borde);border-radius:8px;background:var(--tarjeta);color:var(--texto);min-width:0";
    g.miembros.forEach(function (m) {
      const fila = el("div", "fila-pago persona-cobro");
      const t = el("span", "texto-pago"); t.appendChild(el("b", null, m.nombre + (m.yo ? " (tú)" : "")));
      function actualizar(cambio) {
        guardar({ miembros: g.miembros.map(function (y) { return y.id === m.id ? Object.assign({}, y, cambio) : y; }) });
      }
      const tel = el("input"); tel.type = "tel"; tel.placeholder = "Bizum / móvil con prefijo"; tel.value = m.telefono || "";
      tel.id = "tel-" + m.id; tel.setAttribute("aria-label", "Teléfono de " + m.nombre); tel.style.cssText = estiloInput;
      tel.addEventListener("change", function () { actualizar({ telefono: tel.value.trim() }); });
      const iban = el("input"); iban.type = "text"; iban.placeholder = "IBAN (opcional)"; iban.value = m.iban ? R.formatoIBAN(m.iban) : "";
      iban.id = "iban-" + m.id; iban.setAttribute("aria-label", "IBAN de " + m.nombre); iban.style.cssText = estiloInput; iban.autocomplete = "off";
      iban.addEventListener("change", function () {
        const v = R.limpiarIBAN(iban.value);
        if (v && !R.ibanValido(v)) { iban.style.borderColor = "var(--rojo)"; ponerEstadoSync("Ese IBAN no es válido: revisa los números.", "error"); return; }
        iban.style.borderColor = ""; actualizar({ iban: v });
      });
      const lab = el("label", "casilla");
      const cb = el("input"); cb.type = "checkbox"; cb.checked = !!m.mostrar_cobro; cb.id = "mc-" + m.id;
      cb.addEventListener("change", function () { actualizar({ mostrar_cobro: cb.checked }); });
      lab.append(cb, el("span", null, "Mostrar en el enlace"));
      const datos = el("div", "datos-cobro"); datos.append(tel, iban, lab);
      fila.append(t, datos);
      const usado = g.gastos.some(function (x) { return R.pagos(x)[m.id] != null || R.cuotas(x)[m.id] != null; }) ||
                    g.liquidaciones.some(function (l) { return l.de === m.id || l.a === m.id; });
      if (!m.yo && !usado) {
        const q = el("button", "g-borrar", "×"); q.type = "button"; q.setAttribute("aria-label", "Quitar a " + m.nombre);
        q.addEventListener("click", function () { guardar({ miembros: g.miembros.filter(function (y) { return y.id !== m.id; }) }); });
        fila.appendChild(q);
      }
      cajaM.appendChild(fila);
    });

    // Pagos ya hechos
    const cajaL = $("gd-liquidaciones"); cajaL.innerHTML = "";
    if (!g.liquidaciones.length) cajaL.appendChild(el("p", "ayuda", "Cuando alguien pague su parte, pulsa «Marcar pagado» y aparecerá aquí."));
    g.liquidaciones.forEach(function (l) {
      const fila = el("div", "fila-pago");
      const tx = el("span", "texto-pago", nom(l.de) + " pagó a " + nom(l.a) + (l.fecha ? " · " + new Date(l.fecha + "T12:00").toLocaleDateString("es-ES", { day: "numeric", month: "short" }) : ""));
      if (l.via === "bizum") tx.appendChild(el("span", "etiqueta-gasto bizum", "Bizum Pay · conciliado solo"));
      fila.append(tx, el("span", "importe", R.eur(l.importe)));
      const d = el("button", "boton-sec", "Deshacer"); d.type = "button";
      d.addEventListener("click", function () { guardar({ liquidaciones: g.liquidaciones.filter(function (y) { return y.id !== l.id; }) }); });
      fila.appendChild(d);
      cajaL.appendChild(fila);
    });

    // El formulario solo se reconstruye si cambian las personas (para no borrar lo que estás escribiendo)
    const firma = g.id + "|" + g.miembros.map(function (m) { return m.id + ":" + m.nombre; }).join(",") + "|" + (g.presupuesto ? JSON.stringify([g.presupuesto.categorias || [], g.presupuesto.pct || {}]) : "");
    if (firma !== firmaForm) { firmaForm = firma; construirFormGasto(g); }
    // Puntos de extensión: módulos (presupuesto) y prototipos de la demo
    (window.ganchosGrupo || []).forEach(function (f) { f(g, guardar, $("grupo-detalle-vista"), cargarGrupos); });
    if (window.alPintarGrupo) window.alPintarGrupo(g, guardar, $("grupo-detalle-vista"));
  }

  // Enlace público
  $("gd-compartido").addEventListener("change", function () { guardar({ compartido: this.checked }); });
  $("gd-copiar").addEventListener("click", function () {
    const input = $("gd-enlace"), b = this;
    if (!navigator.clipboard) { input.select(); return; }
    navigator.clipboard.writeText(input.value).then(function () { b.textContent = "Copiado"; setTimeout(function () { b.textContent = "Copiar"; }, 1500); })
      .catch(function () { input.select(); });
  });
  confirmar($("gd-regenerar"), "El anterior dejará de funcionar. ¿Seguro?", async function () {
    const g = actual(); if (!g) return;
    const r = await sb.rpc("grupo_nuevo_enlace", { grupo: g.id });
    if (r.error) { ponerEstadoSync(traducirError(r.error), "error"); return; }
    g.token = r.data; pintarDetalle();
  });

  // Añadir persona a un grupo existente
  $("gm-anadir").addEventListener("click", function () {
    const g = actual(); const n = $("gm-nombre").value.trim(); if (!g || !n) return;
    guardar({ miembros: g.miembros.concat([{ id: R.nuevoId(), nombre: n, telefono: $("gm-telefono").value.trim() }]) });
    $("gm-nombre").value = ""; $("gm-telefono").value = "";
  });

  // ---------------- Formulario de gasto del grupo ----------------
  function construirFormGasto(g) {
    const sel = $("gg-pagador"); sel.innerHTML = "";
    g.miembros.forEach(function (m) {
      const o = el("option", null, m.nombre + (m.yo ? " (tú)" : "")); o.value = m.id; sel.appendChild(o);
    });
    if (g.presupuesto) {
      const o = el("option", null, "El bote común"); o.value = "bote"; sel.appendChild(o);
    }
    $("gg-pres").hidden = !g.presupuesto;
    const cat = $("gg-categoria"); cat.innerHTML = "";
    ((g.presupuesto && g.presupuesto.categorias) || []).forEach(function (c) { const o = el("option", null, c.nombre); o.value = c.nombre; cat.appendChild(o); });
    cat.hidden = !cat.options.length;
    tipoCambiado(g);
    const pv = $("gg-pagos-varios"); pv.innerHTML = "";
    g.miembros.forEach(function (m) {
      const f = el("div", "reparto-fila");
      f.append(el("label", null, m.nombre));
      const i = el("input"); i.type = "text"; i.inputMode = "decimal"; i.placeholder = "0,00"; i.id = "gp-" + m.id; i.dataset.miembro = m.id;
      f.appendChild(i); pv.appendChild(f);
    });
    $("gg-fecha").value = $("gg-fecha").value || hoy();
    pintarReparto(g);
  }

  function modo() { return document.querySelector('input[name="gg-modo"]:checked').value; }
  function tipo(g) { return g && g.presupuesto ? document.querySelector('input[name="gg-tipo"]:checked').value : "normal"; }
  // Con presupuesto: un gasto del presupuesto no se reparte (sale del bote);
  // un extra se reparte con los % del presupuesto, salvo que se cambien
  function tipoCambiado(g) {
    const t = tipo(g);
    $("gg-rep-bloque").hidden = t === "presupuesto";
    $("gg-categoria").disabled = t !== "presupuesto";
    const bote = $("gg-pagador").querySelector('option[value="bote"]');
    if (bote) { bote.disabled = t === "extra"; if (t === "extra" && $("gg-pagador").value === "bote") $("gg-pagador").value = yoDe(g).id; }
    if (t === "extra") {
      const r = document.querySelector('input[name="gg-modo"][value="porcentaje"]');
      if (!r.checked) { r.checked = true; pintarReparto(g); }
    }
  }
  // Qué parte del importe va al grupo (el resto es tuyo)
  function parteGrupo(total) {
    const modoP = $("gg-parte-modo").value, v = $("gg-parte-valor").value;
    if (modoP === "importe") return Math.min(total, R.aCentimos(v));
    if (modoP === "pct") { const p = parseFloat(String(v).replace(",", ".")) || 0; return Math.round(total * Math.min(100, Math.max(0, p)) / 100); }
    return total;
  }

  function pintarReparto(g) {
    const c = $("gg-reparto"); c.innerHTML = "";
    // En modo porcentaje proponemos los % del último gasto que los usó (o partes iguales)
    let previos = {};
    if (modo() === "porcentaje" && g.presupuesto && g.presupuesto.pct && tipo(g) === "extra") {
      previos = g.presupuesto.pct;
    } else if (modo() === "porcentaje") {
      const ult = g.gastos.slice().reverse().find(function (x) { return x.reparto && x.reparto.modo === "porcentaje"; });
      if (ult) previos = ult.reparto.porcentajes;
      else g.miembros.forEach(function (m) { previos[m.id] = Math.round(10000 / g.miembros.length) / 100; });
    }
    g.miembros.forEach(function (m) {
      const f = el("div", "reparto-fila");
      if (modo() === "iguales") {
        const l = el("label");
        const cb = el("input"); cb.type = "checkbox"; cb.checked = true; cb.id = "gr-" + m.id; cb.dataset.miembro = m.id;
        l.append(cb, document.createTextNode(m.nombre));
        f.append(l, el("span", "cuota", ""));
      } else if (modo() === "porcentaje") {
        f.classList.add("porc");
        f.append(el("label", null, m.nombre));
        const i = el("input"); i.type = "text"; i.inputMode = "decimal"; i.placeholder = "%"; i.id = "gpc-" + m.id; i.dataset.miembro = m.id; i.dataset.porc = "1";
        if (previos[m.id] != null) i.value = String(previos[m.id]).replace(".", ",");
        f.append(i, el("span", "cuota", ""));
      } else {
        f.append(el("label", null, m.nombre));
        const i = el("input"); i.type = "text"; i.inputMode = "decimal"; i.placeholder = "0,00"; i.id = "gi-" + m.id; i.dataset.miembro = m.id;
        f.appendChild(i);
      }
      c.appendChild(f);
    });
    actualizarCuadre();
  }

  function leerForm() {
    const g = actual();
    const totalTicket = R.aCentimos($("gg-importe").value);
    const importe = parteGrupo(totalTicket);
    let pagos;
    if ($("gg-varios").checked) {
      pagos = Array.from($("gg-pagos-varios").querySelectorAll("input")).map(function (i) { return { miembro: i.dataset.miembro, importe: R.aCentimos(i.value) }; })
        .filter(function (p) { return p.importe > 0; });
    } else {
      pagos = [{ miembro: $("gg-pagador").value, importe: importe }];
    }
    let reparto;
    if (modo() === "iguales") {
      reparto = { modo: "iguales", miembros: Array.from($("gg-reparto").querySelectorAll("input:checked")).map(function (i) { return i.dataset.miembro; }) };
    } else if (modo() === "porcentaje") {
      const pc = {};
      $("gg-reparto").querySelectorAll("input").forEach(function (i) { const v = parseFloat(String(i.value).replace(",", ".")); if (v > 0) pc[i.dataset.miembro] = v; });
      reparto = { modo: "porcentaje", porcentajes: pc };
    } else {
      const imp = {};
      $("gg-reparto").querySelectorAll("input").forEach(function (i) { const v = R.aCentimos(i.value); if (v > 0) imp[i.dataset.miembro] = v; });
      reparto = { modo: "importes", importes: imp };
    }
    const x = { id: R.nuevoId(), concepto: $("gg-concepto").value.trim(), fecha: $("gg-fecha").value || hoy(), importe: importe, pagos: pagos, reparto: reparto, _g: g };
    if (importe < totalTicket) x.total_ticket = totalTicket;
    return x;
  }

  // Muestra en vivo cuánto toca a cada uno y si las cuentas cuadran
  function actualizarCuadre() {
    const x = leerForm();
    const cuotas = R.cuotas(x);
    $("gg-reparto").querySelectorAll(".reparto-fila").forEach(function (f) {
      const cb = f.querySelector('input[type="checkbox"]'), span = f.querySelector(".cuota");
      if (cb && span) span.textContent = cb.checked && x.importe ? R.eur(cuotas[cb.dataset.miembro] || 0) : "";
      const pi = f.querySelector('input[data-porc]');
      if (pi && span) span.textContent = x.importe && cuotas[pi.dataset.miembro] ? R.eur(cuotas[pi.dataset.miembro]) : "";
    });
    let txt = "";
    if (x.importe) {
      const sumaRep = Object.keys(cuotas).reduce(function (s, k) { return s + cuotas[k]; }, 0);
      const sumaPag = x.pagos.reduce(function (s, p) { return s + p.importe; }, 0);
      if ($("gg-varios").checked) txt += "Pagado: " + R.eur(sumaPag) + " de " + R.eur(x.importe) + ". ";
      if (modo() === "porcentaje") {
        const sp = Math.round(Object.keys(x.reparto.porcentajes).reduce(function (s, k) { return s + x.reparto.porcentajes[k]; }, 0) * 100) / 100;
        txt += "Porcentajes: " + String(sp).replace(".", ",") + " %" + (Math.abs(sp - 100) < 0.01 ? " ✓" : " (deben sumar 100 %)") + ".";
      }
      if (modo() === "importes") txt += "Repartido: " + R.eur(sumaRep) + " de " + R.eur(x.importe) + (sumaRep === x.importe ? " ✓" : "") + ".";
    }
    $("gg-cuadre").textContent = txt;
    const tt = R.aCentimos($("gg-importe").value);
    $("gg-parte-texto").textContent = $("gg-parte-modo").value !== "todo" && tt ? "Al grupo: " + R.eur(x.importe) + " de " + R.eur(tt) + " (el resto es tuyo)" : "";
  }

  $("gd-form-gasto").addEventListener("input", actualizarCuadre);
  $("gd-form-gasto").addEventListener("change", function (e) {
    if (e.target.name === "gg-modo") pintarReparto(actual());
    if (e.target.name === "gg-tipo") tipoCambiado(actual());
    if (e.target.id === "gg-parte-modo") { $("gg-parte-valor").hidden = e.target.value === "todo"; $("gg-parte-valor").placeholder = e.target.value === "pct" ? "%" : "0,00 €"; if (e.target.value !== "todo") $("gg-parte-valor").focus(); }
    if (e.target.id === "gg-varios") { $("gg-pagos-varios").hidden = !e.target.checked; $("gg-pagador").disabled = e.target.checked; }
    actualizarCuadre();
  });

  $("gd-form-gasto").addEventListener("submit", function (ev) {
    ev.preventDefault();
    const g = actual(); if (!g) return;
    const x = leerForm(); delete x._g;
    const t = tipo(g);
    if (t === "presupuesto") {
      // Del presupuesto: no se reparte entre personas (sale del bote o cuenta como aportación de quien lo adelantó)
      x.presupuesto = true;
      if ($("gg-categoria").value) x.categoria = $("gg-categoria").value;
      x.reparto = { modo: "iguales", miembros: g.miembros.map(function (m) { return m.id; }) };
    } else if (t === "extra") {
      x.presupuesto = false; x.estado = "pendiente"; x.propuesto_por = yoDe(g).id;
    }
    const err = $("gg-error");
    if ($("gg-parte-modo").value !== "todo" && !(x.importe > 0)) { err.textContent = "Indica qué parte del importe va al grupo."; err.hidden = false; return; }
    const problema = R.validarGasto(x);
    if (problema) { err.textContent = problema; err.hidden = false; return; }
    err.hidden = true;
    const cambios = { gastos: g.gastos.concat([x]) };
    if (g.presupuesto) {
      cambios.registro = conRegistro(g, t === "extra" ? "Propone extra" : "Gasto del presupuesto",
        x.concepto + " · " + R.eur(x.importe) + (x.categoria ? " · " + x.categoria : "") + (x.total_ticket ? " (de un ticket de " + R.eur(x.total_ticket) + ")" : ""));
    }
    guardar(cambios);
    $("gg-parte-modo").value = "todo"; $("gg-parte-valor").value = ""; $("gg-parte-valor").hidden = true;
    $("gg-concepto").value = ""; $("gg-importe").value = "";
    $("gd-form-gasto").querySelectorAll(".reparto-tabla input[type=text]:not([data-porc])").forEach(function (i) { i.value = ""; });
    $("gg-reparto").querySelectorAll("input[type=checkbox]").forEach(function (i) { i.checked = true; });
    actualizarCuadre();
    $("gg-concepto").focus();
  });
})();
