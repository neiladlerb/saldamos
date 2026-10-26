// =====================================================================
//  DEMO · PROTOTIPOS para probar con usuarios reales
//  Cada prototipo lleva la etiqueta «Prototipo» y un «Dar mi opinión»
//  (estrellas + comentario) que se guarda y se puede enviar por WhatsApp.
//  Ideas del Lab: t-dimelo, t-resumen-mes, t-bienestar-empresas,
//  t-pareja, t-qr-mesa, t-huchas, t-europa, t-suscripciones.
// =====================================================================
(function () {
  // Pon aquí tu móvil (con prefijo, ej. "34600112233") para que las opiniones te lleguen directas
  const TELEFONO_FEEDBACK = "";
  const R = window.Reparto;
  const $ = function (id) { return document.getElementById(id); };
  function el(tag, clase, texto) { const e = document.createElement(tag); if (clase) e.className = clase; if (texto != null) e.textContent = texto; return e; }
  function guardarLocal(clave, v) { try { localStorage.setItem(clave, JSON.stringify(v)); } catch (e) {} }
  function leerLocal(clave, def) { try { const v = JSON.parse(localStorage.getItem(clave)); return v == null ? def : v; } catch (e) { return def; } }
  function hoyISO(n) { const d = new Date(); d.setDate(d.getDate() + (n || 0)); return d.toISOString().slice(0, 10); }
  const eur = R ? R.eur : function (c) { return (c / 100).toFixed(2).replace(".", ",") + " €"; };

  // ---------------------------------------------------------------
  //  «Dar mi opinión»
  // ---------------------------------------------------------------
  function cajaOpinion(ideaId, titulo, pregunta) {
    const caja = el("div", "proto-opinion");
    const cab = el("div", "proto-cab");
    cab.append(el("span", "proto-badge", "Prototipo"), el("span", "proto-titulo", titulo));
    const abrir = el("button", "boton-sec", "Dar mi opinión"); abrir.type = "button";
    cab.appendChild(abrir);
    const form = el("div", "proto-form"); form.hidden = true;
    form.appendChild(el("p", "ayuda", pregunta || "¿Lo usarías? ¿Qué cambiarías?"));
    let estrellas = 0;
    const filaE = el("div", "proto-estrellas");
    for (let i = 1; i <= 5; i++) {
      const b = el("button", null, "★"); b.type = "button"; b.setAttribute("aria-label", i + " de 5");
      b.addEventListener("click", function () { estrellas = i; filaE.querySelectorAll("button").forEach(function (x, k) { x.classList.toggle("on", k < i); }); });
      filaE.appendChild(b);
    }
    const ta = el("textarea"); ta.rows = 3; ta.maxLength = 600; ta.placeholder = "Cuéntanos en una frase…";
    const enviar = el("button", "anadir", "Enviar opinión"); enviar.type = "button";
    const wa = el("a", "boton-sec", "Mandarla también por WhatsApp"); wa.target = "_blank"; wa.rel = "noopener"; wa.hidden = true;
    const ok = el("p", "mensaje ok", "¡Gracias! Tu opinión ayuda a decidir si esto se construye."); ok.hidden = true;
    form.append(filaE, ta, enviar, ok, wa);
    caja.append(cab, form);
    abrir.addEventListener("click", function () { form.hidden = !form.hidden; if (!form.hidden) ta.focus(); });
    enviar.addEventListener("click", async function () {
      if (!estrellas && !ta.value.trim()) { ta.focus(); return; }
      const op = { idea: ideaId, titulo: titulo, estrellas: estrellas, comentario: ta.value.trim().slice(0, 600), pagina: location.pathname.split("/").pop(), fecha: new Date().toISOString() };
      const todas = leerLocal("saldamos-opiniones", []); todas.push(op); guardarLocal("saldamos-opiniones", todas);
      if (window.sb && window.MODO_DEMO) {
        try { await sb.from("sugerencias").insert({ tipo: "idea", puntuacion: estrellas || null, texto: "[Prototipo · " + titulo + "] " + (op.comentario || "(sin comentario)"), pagina: "prototipo:" + ideaId }); } catch (e) {}
      }
      wa.href = "https://wa.me/" + TELEFONO_FEEDBACK + "?text=" + encodeURIComponent("Opinión sobre «" + titulo + "» (Saldamos)\n" + (estrellas ? "★".repeat(estrellas) + "☆".repeat(5 - estrellas) + "\n" : "") + (op.comentario || ""));
      ok.hidden = false; wa.hidden = false; enviar.disabled = true;
    });
    return caja;
  }
  window.Prototipos = { opinion: cajaOpinion };

  const pagina = (location.pathname.split("/").pop() || "").toLowerCase();
  const enApp = !!$("panel-gastos");

  // La función ya está en la app real (js/dimelo.js). Aquí solo su caja de opinión.
  function montarDimelo() {
    const caja = $("dimelo"); if (!caja) return;
    caja.appendChild(cajaOpinion("t-dimelo", "Dímelo y lo apunto", "¿Te ha entendido bien? ¿Lo usarías en vez de rellenar el formulario?"));
  }

  // ---------------------------------------------------------------
  //  2 · Tu mes en 30 segundos (la función es real; aquí su opinión)
  // ---------------------------------------------------------------
  function montarMes30() {
    const m = $("mes-30"); if (!m) return;
    m.parentNode.insertBefore(cajaOpinion("t-resumen-mes", "Tu mes en 30 segundos", "¿Te gustaría recibirlo cada mes por WhatsApp o email? ¿El consejo te sirve?"), m.nextSibling);
  }

  // ---------------------------------------------------------------
  //  8 · Detector de suscripciones (sobre los movimientos simulados)
  // ---------------------------------------------------------------
  const SUSCRIPCIONES = [
    { id: "netflix", nombre: "Netflix", importe: 1299, dia: 12, meses: 14, metodo: "Tarjeta" },
    { id: "spotify", nombre: "Spotify", importe: 1099, dia: 3, meses: 26, metodo: "Apple Pay" },
    { id: "gym", nombre: "Gimnasio Fit+", importe: 3990, dia: 1, meses: 8, metodo: "Tarjeta", poco: true },
    { id: "icloud", nombre: "iCloud+ 200 GB", importe: 299, dia: 20, meses: 31, metodo: "Apple Pay" },
    { id: "prensa", nombre: "Periódico digital", importe: 999, dia: 27, meses: 5, metodo: "Google Pay", poco: true }
  ];
  function proximoCobro(dia) { const d = new Date(); if (d.getDate() >= dia) d.setMonth(d.getMonth() + 1); d.setDate(dia); return d; }
  function montarSuscripciones() {
    const banco = document.querySelector(".banco-demo"); if (!banco) return;
    const sec = el("section", "tarjeta subs");
    const total = SUSCRIPCIONES.reduce(function (s, x) { return s + x.importe; }, 0);
    const cab = el("div", "fila-titulo"); cab.append(el("h2", null, "Suscripciones detectadas"), el("span", "estado pendiente", eur(total) + "/mes · " + eur(total * 12) + "/año"));
    sec.append(cab, el("p", "ayuda", "Cargos que se repiten cada mes en tus movimientos. Te avisamos unos días antes de la renovación para que decidas si la sigues usando."));
    const avisos = leerLocal("saldamos-demo-subs", {});
    const lista = el("div", "g-lineas");
    SUSCRIPCIONES.slice().sort(function (a, b) { return proximoCobro(a.dia) - proximoCobro(b.dia); }).forEach(function (s) {
      const f = el("div", "fila-pago");
      const p = proximoCobro(s.dia);
      const quedan = Math.ceil((p - new Date()) / 86400000);
      const txt = el("span", "texto-pago");
      txt.append(el("strong", null, s.nombre), document.createTextNode(" · próximo cobro " + p.toLocaleDateString("es-ES", { day: "numeric", month: "short" }) + (quedan <= 5 ? " (en " + quedan + " días)" : "") + " · " + s.meses + " meses seguidos"));
      if (s.poco) txt.append(el("br"), el("small", "negativo-txt", "Sin uso aparente: ¿la sigues necesitando?"));
      const b = el("button", "boton-sec", avisos[s.id] ? "✓ Te avisaremos" : "Avisarme 3 días antes"); b.type = "button"; b.disabled = !!avisos[s.id];
      b.addEventListener("click", async function () {
        b.disabled = true;
        const aviso = new Date(p); aviso.setDate(aviso.getDate() - 3);
        const fecha = (aviso < new Date() ? new Date() : aviso).toISOString().slice(0, 10);
        await sb.from("tareas").insert({ texto: "Renovación de " + s.nombre + " (" + eur(s.importe) + "): ¿la sigo usando?", fecha: fecha, hora: "10:00", hecha: false, avisada: false });
        avisos[s.id] = true; guardarLocal("saldamos-demo-subs", avisos);
        b.textContent = "✓ Te avisaremos"; await cargarTodo();
      });
      f.append(txt, el("span", "importe", eur(s.importe)), b);
      lista.appendChild(f);
    });
    sec.append(lista, cajaOpinion("t-suscripciones", "Detector de suscripciones", "¿Te ha descubierto alguna que no recordabas? ¿Conectarías tu banco para tenerlo?"));
    banco.parentNode.insertBefore(sec, banco.nextSibling);
  }

  // ---------------------------------------------------------------
  //  Grupos: 3 · Hogar 60/40  · 6 · Metas de ahorro · 7 · Europa
  // ---------------------------------------------------------------
  function porcHogar(g) {
    if (g.reparto_hogar) return g.reparto_hogar;
    const ult = (g.gastos || []).slice().reverse().find(function (x) { return x.reparto && x.reparto.modo === "porcentaje"; });
    if (ult) return ult.reparto.porcentajes;
    const r = {}; g.miembros.forEach(function (m) { r[m.id] = Math.round(10000 / g.miembros.length) / 100; }); return r;
  }
  function cartaHogar(g, guardar) {
    const c = el("section", "tarjeta proto-carta");
    const pc = porcHogar(g);
    c.append(el("h2", null, "Gastos fijos del hogar"),
      el("p", "ayuda", "Reparto según ingresos: " + g.miembros.map(function (m) { return m.nombre + " " + String(pc[m.id] || 0).replace(".", ",") + " %"; }).join(" · ")));
    const mes = hoyISO(0).slice(0, 7);
    const lista = el("div", "g-lineas");
    (g.fijos || []).forEach(function (f) {
      const ya = g.gastos.some(function (x) { return x.concepto === f.concepto && String(x.fecha).slice(0, 7) === mes; });
      const fila = el("div", "fila-pago");
      fila.append(el("span", "texto-pago", f.concepto + " · día " + f.dia + " · paga " + R.nombre(g, f.pagador) + (ya ? " · ✓ apuntado este mes" : "")), el("span", "importe", eur(f.importe)));
      lista.appendChild(fila);
    });
    c.appendChild(lista);
    const pend = (g.fijos || []).filter(function (f) { return !g.gastos.some(function (x) { return x.concepto === f.concepto && String(x.fecha).slice(0, 7) === mes; }); });
    if (pend.length) {
      const b = el("button", "anadir", "Apuntar los " + pend.length + " fijos de este mes"); b.type = "button";
      b.addEventListener("click", function () {
        const nuevos = pend.map(function (f) {
          return { id: R.nuevoId(), concepto: f.concepto, fecha: mes + "-" + String(f.dia).padStart(2, "0"), importe: f.importe, pagos: [{ miembro: f.pagador, importe: f.importe }], reparto: { modo: "porcentaje", porcentajes: porcHogar(g) } };
        });
        guardar({ gastos: g.gastos.concat(nuevos) });
      });
      c.appendChild(b);
    }
    // Calculadora de reparto por ingresos
    const det = el("details", "proto-ingresos");
    det.appendChild(el("summary", null, "Calcular el % según ingresos"));
    const filas = el("div", "grid-form");
    g.miembros.forEach(function (m) {
      const l = el("label", "etiqueta-campo", "Ingresos netos de " + m.nombre + " (€/mes)");
      const i = el("input"); i.type = "text"; i.inputMode = "decimal"; i.dataset.miembro = m.id; i.placeholder = "0";
      l.appendChild(i); filas.appendChild(l);
    });
    const res = el("p", "ayuda"); const usar = el("button", "boton-sec", "Usar este reparto"); usar.type = "button"; usar.hidden = true;
    let propuesta = null;
    filas.addEventListener("input", function () {
      const v = {}; let tot = 0;
      filas.querySelectorAll("input").forEach(function (i) { const x = R.aCentimos(i.value); v[i.dataset.miembro] = x; tot += x; });
      if (!tot) { res.textContent = ""; usar.hidden = true; return; }
      propuesta = {}; let acum = 0; const ids = Object.keys(v);
      ids.forEach(function (id, k) { propuesta[id] = k === ids.length - 1 ? Math.round((100 - acum) * 100) / 100 : Math.round(v[id] * 10000 / tot) / 100; acum += propuesta[id]; });
      res.textContent = "Propuesta: " + ids.map(function (id) { return R.nombre(g, id) + " " + String(propuesta[id]).replace(".", ",") + " %"; }).join(" · ") + ". Nadie ve los ingresos del otro: solo se guarda el %.";
      usar.hidden = false;
    });
    usar.addEventListener("click", function () { if (propuesta) guardar({ reparto_hogar: propuesta }); });
    det.append(filas, res, usar);
    c.append(det, cajaOpinion("t-pareja", "Modo pareja / hogar", "¿Repartís a medias o según ingresos? ¿Os ahorraría discusiones?"));
    return c;
  }

  function cartaMeta(g, guardar) {
    const mt = g.meta; const c = el("section", "tarjeta proto-carta");
    const n = g.miembros.length, objetivo = mt.por_persona * n;
    const llevado = g.miembros.reduce(function (s, m) { return s + Math.min(mt.aportado[m.id] || 0, mt.por_persona); }, 0);
    const fecha = new Date(mt.fecha + "T12:00");
    const meses = Math.max(1, Math.round((fecha - new Date()) / (30.4 * 86400000)));
    c.append(el("h2", null, "Meta: " + eur(mt.por_persona) + " por persona"),
      el("p", "ayuda", "Para el " + fecha.toLocaleDateString("es-ES", { day: "numeric", month: "long", year: "numeric" }) + ". Cada uno ahorra en su propio banco: Saldamos solo lleva la cuenta."));
    const barra = el("div", "meta-barra"); const relleno = el("span"); relleno.style.width = Math.round(llevado * 100 / objetivo) + "%"; barra.appendChild(relleno);
    c.append(barra, el("p", "meta-total", eur(llevado) + " de " + eur(objetivo) + " · " + Math.round(llevado * 100 / objetivo) + " %"));
    const lista = el("div", "g-lineas");
    g.miembros.slice().sort(function (a, b) { return (mt.aportado[b.id] || 0) - (mt.aportado[a.id] || 0); }).forEach(function (m) {
      const v = mt.aportado[m.id] || 0, pct = Math.min(100, Math.round(v * 100 / mt.por_persona));
      const f = el("div", "meta-fila");
      const b = el("div", "meta-barra mini"); const r = el("span"); r.style.width = pct + "%"; b.appendChild(r);
      const falta = Math.max(0, mt.por_persona - v);
      f.append(el("span", null, m.nombre + (m.yo ? " (tú)" : "") + (pct >= 100 ? " · conseguido" : "")), b, el("span", "importe", pct + " %"));
      f.title = falta ? "Le faltan " + eur(falta) + " (" + eur(Math.ceil(falta / meses)) + "/mes)" : "¡Meta cumplida!";
      lista.appendChild(f);
    });
    c.appendChild(lista);
    const yo = g.miembros.find(function (m) { return m.yo; });
    if (yo) {
      const fila = el("div", "fila-miembro");
      const i = el("input"); i.type = "text"; i.inputMode = "decimal"; i.placeholder = "Lo que llevas ahorrado"; i.value = ((mt.aportado[yo.id] || 0) / 100).toFixed(2).replace(".", ","); i.style.maxWidth = "160px";
      const b = el("button", "boton-sec", "Actualizar lo mío"); b.type = "button";
      b.addEventListener("click", function () { const ap = Object.assign({}, mt.aportado); ap[yo.id] = R.aCentimos(i.value); guardar({ meta: Object.assign({}, mt, { aportado: ap }) }); });
      const falta = Math.max(0, mt.por_persona - (mt.aportado[yo.id] || 0));
      fila.append(i, b, el("span", "ayuda", falta ? "Te faltan " + eur(falta) + ": unos " + eur(Math.ceil(falta / meses)) + " al mes" : "¡Ya tienes tu parte!"));
      c.appendChild(fila);
    }
    const ranking = g.miembros.slice().sort(function (a, b) { return (mt.aportado[b.id] || 0) - (mt.aportado[a.id] || 0); })
      .map(function (m) { return (Math.min(100, Math.round((mt.aportado[m.id] || 0) * 100 / mt.por_persona)) >= 100 ? "✓ " : "• ") + m.nombre + ": " + Math.min(100, Math.round((mt.aportado[m.id] || 0) * 100 / mt.por_persona)) + " %"; }).join("\n");
    const wa = el("a", "anadir boton-wa", "Animar al grupo por WhatsApp"); wa.target = "_blank"; wa.rel = "noopener";
    wa.href = R.enlaceWhatsApp("*" + g.nombre + "*: llevamos " + Math.round(llevado * 100 / objetivo) + " % de la meta\n\n" + ranking + "\n\n¡Quedan " + meses + " meses!", "");
    c.append(wa, cajaOpinion("t-huchas", "Metas de ahorro en grupo", "¿Os motivaría ver el progreso de todos? ¿Os daría corte o al revés?"));
    return c;
  }

  const MSG_PT = function (de, a, imp, grupo) { return "Olá " + de + "! 👋\nNo grupo *" + grupo + "* ficou: pagas *" + eur(imp) + "* a " + a + ".\nPodes pagar com MB WAY: desde 2026 funciona com o Bizum de Espanha.\n_Saldamos_"; };
  function cartaEuropa(g) {
    const c = el("section", "tarjeta proto-carta");
    c.append(el("h2", null, "🇪🇺 Amigos de varios países"),
      el("p", "ayuda", "Desde 2026 Bizum se conecta con MB WAY (Portugal), Bancomat (Italia), Vipps MobilePay y Wero. Cada uno paga con su app y recibe el mensaje en su idioma."));
    const chips = el("div", "chips");
    g.miembros.forEach(function (m) { if (m.app) chips.appendChild(el("span", "chip", m.nombre + " · " + m.app + (m.idioma === "pt" ? " 🇵🇹" : ""))); });
    c.appendChild(chips);
    const pl = R.plan(g);
    const lista = el("div", "g-lineas");
    pl.forEach(function (p) {
      const m = g.miembros.find(function (x) { return x.id === p.de; });
      if (!m || m.idioma !== "pt") return;
      const f = el("div", "fila-pago");
      const a = el("a", "boton-sec", "Pedir em português"); a.target = "_blank"; a.rel = "noopener";
      a.href = R.enlaceWhatsApp(MSG_PT(m.nombre, R.nombre(g, p.a), p.importe, g.nombre), m.telefono || "");
      f.append(el("span", "texto-pago", m.nombre + " paga a " + R.nombre(g, p.a) + " con " + m.app), el("span", "importe", eur(p.importe)), a);
      lista.appendChild(f);
    });
    c.appendChild(lista);
    if (g.compartido && g.token) {
      const v = el("a", "boton-sec", "Ver la página del grupo en portugués"); v.href = "grupo.html?lang=pt#" + encodeURIComponent(g.token); v.target = "_blank";
      c.appendChild(v);
    }
    c.appendChild(cajaOpinion("t-europa", "Grupos con amigos de Europa", "¿Tienes amigos o compañeros fuera de España con los que compartes gastos?"));
    return c;
  }

  window.alPintarGrupo = function (g, guardar, vista) {
    let caja = $("proto-grupo");
    if (!caja) {
      caja = el("div"); caja.id = "proto-grupo";
      const res = $("gd-resumen"); res.parentNode.insertBefore(caja, res.nextSibling);
    }
    // No repintar mientras se escribe dentro
    if (caja.contains(document.activeElement) && /INPUT|TEXTAREA/.test(document.activeElement.tagName) && caja.dataset.g === g.id) return;
    caja.dataset.g = g.id; caja.innerHTML = "";
    if (g.hogar || g.fijos) caja.appendChild(cartaHogar(g, guardar));
    if (g.meta) caja.appendChild(cartaMeta(g, guardar));
    if (g.miembros.some(function (m) { return m.app && m.app !== "Bizum"; })) caja.appendChild(cartaEuropa(g));
  };

  // ---------------------------------------------------------------
  //  Página pública del grupo en portugués (?lang=pt)
  // ---------------------------------------------------------------
  const PT = [
    [/^Cargando las cuentas…$/, "A carregar as contas…"], [/^¿Quién eres\?$/, "Quem és?"], [/^Elige tu nombre$/, "Escolhe o teu nome"],
    [/^Para quedar en paz$/, "Para ficarmos quites"], [/^Gastos$/, "Despesas"], [/^Tu parte de cada gasto$/, "A tua parte de cada despesa"],
    [/^Ya he pagado$/, "Já paguei"], [/^Copiado$/, "Copiado"], [/^Todo saldado: nadie debe nada\.$/, "Tudo pago: ninguém deve nada."],
    [/^Crear cuenta gratis$/, "Criar conta grátis"], [/^Calculadora rápida$/, "Calculadora rápida"], [/^¿Quieres hacer tus propias cuentas con amigos\?$/, "Queres fazer as tuas próprias contas com amigos?"],
    [/^Te deben\b/, "Devem-te"], [/^Debes\b/, "Deves"], [/^Estás en paz$/, "Estás quite"], [/^Privacidad$/, "Privacidade"], [/^Aviso legal$/, "Aviso legal"], [/^Concepto$/, "Conceito"],
    [/Pagas a /g, "Pagas a "], [/ te paga/g, " paga-te"], [/Tu parte total es /g, "A tua parte total é "], [/ y ya has pagado /g, " e já pagaste "],
    [/Gasto total /g, "Despesa total "], [/ personas · actualizado /g, " pessoas · atualizado "], [/ entre /g, " entre "],
    [/Pídele a /g, "Pede a "], [/ su Bizum o IBAN\. Saldamos no cobra ni guarda dinero: pagas directo desde tu banco\./g, " o MB WAY, Bizum ou IBAN. O Saldamos não cobra nem guarda dinheiro: pagas diretamente do teu banco."],
    [/Ya avisaste de que pagaste\. Falta que /g, "Já avisaste que pagaste. Falta que "], [/ lo confirme\./g, " confirme."], [/¡Hecho! Hemos avisado a /g, "Feito! Avisámos "],
    [/\. Cuando confirme que le ha llegado, quedará como pagado\./g, ". Quando confirmar que recebeu, fica como pago."], [/ pagó /g, " pagou "], [/^Pagó /, "Pagou "], [/ debe /g, " deve "]
  ];
  function traducirNodo(n) {
    if (n.nodeType === 3) { let t = n.nodeValue, o = t; PT.forEach(function (p) { t = t.replace(p[0], p[1]); }); if (t !== o) n.nodeValue = t; return; }
    if (n.nodeType === 1 && !/SCRIPT|STYLE/.test(n.tagName)) n.childNodes.forEach(traducirNodo);
  }
  function montarPT() {
    const enPT = new URLSearchParams(location.search).get("lang") === "pt";
    const marca = document.querySelector(".marca");
    const b = el("a", "boton-sec idioma", enPT ? "🇪🇸 Ver en español" : "🇵🇹 Ver em português");
    b.href = (enPT ? "grupo.html" : "grupo.html?lang=pt") + location.hash;
    b.addEventListener("click", function (e) { e.preventDefault(); location.replace(b.href); location.reload(); });
    marca.parentNode.insertBefore(b, marca.nextSibling);
    if (!enPT) return;
    document.documentElement.lang = "pt";
    const main = document.querySelector("main");
    traducirNodo(main);
    new MutationObserver(function (ms) { ms.forEach(function (m) { m.addedNodes.forEach(traducirNodo); if (m.type === "characterData") traducirNodo(m.target); }); })
      .observe(main, { childList: true, subtree: true, characterData: true });
    main.appendChild(cajaOpinion("t-europa", "Página em português", "Entendeste bem quanto tens de pagar? O que mudarias?"));
  }

  // ---------------------------------------------------------------
  //  Escanear ticket: botón con un ticket de ejemplo (y plan B si el
  //  navegador no deja ejecutar el lector dentro de la demo)
  // ---------------------------------------------------------------
  const TEXTO_EJEMPLO = "SUPERMERCADO EL SOL\nC/ Mayor 12, Madrid\nNIF B12345678\nFACTURA SIMPLIFICADA 2026-0412\nFecha: 04/10/2026 19:42\nLECHE ENTERA 6X1L 5,94\nPAN DE MOLDE 1,35\n2 x YOGUR NATURAL 2,40\nTOMATE KG 2,18\nACEITE OLIVA 1L 8,95\nDETERGENTE 6,50\nCAFE MOLIDO 3,29\nTOTAL 30,61 EUR\nTARJETA 30,61\nIVA 10% BASE 25,10 2,51";
  function montarTicket() {
    const caja = document.querySelector(".escanear"); if (!caja || !window.Ticket) return;
    const b = el("button", "boton-sec", "Probar con un ticket de ejemplo"); b.type = "button";
    const img = el("img"); img.src = "img/ticket-ejemplo.png"; img.alt = "Ticket de ejemplo"; img.className = "ticket-mini"; img.hidden = true;
    b.addEventListener("click", async function () {
      const estado = $("g-escaneo");
      $("caja-nuevo").open = true; img.hidden = false; b.disabled = true;
      estado.className = "ayuda"; estado.textContent = "Leyendo el ticket de ejemplo…";
      try {
        const blob = await (await fetch("img/ticket-ejemplo.png")).blob();
        const texto = await Promise.race([
          Ticket.leerImagen(blob, function (p) { estado.textContent = "Leyendo el ticket… " + p + " %"; }),
          new Promise(function (_, ko) { setTimeout(function () { ko(new Error("tiempo")); }, 45000); })
        ]);
        window.aplicarTicket(Ticket.parsear(texto));
      } catch (e) {
        // Plan B: el texto que saldría del ticket, para enseñar el resto del flujo
        window.aplicarTicket(Ticket.parsear(TEXTO_EJEMPLO));
        estado.textContent += " (Demo: este navegador no dejó ejecutar el lector aquí; en la app real se lee la foto en el móvil.)";
      }
      b.disabled = false;
    });
    caja.append(b, img);
    caja.parentNode.insertBefore(cajaOpinion("t-ticket", "Escanear ticket", "¿Te ha leído bien el ticket? ¿Lo usarías en vez de escribir el gasto?"), caja.nextSibling);
  }
  function montarDeudas() {
    const p = $("panel-deudas"); if (!p) return;
    p.appendChild(cajaOpinion("t-deudas", "Mis deudas y créditos", "¿Te ayuda a ver cuánto debes y cuánto te queda cada mes? ¿Qué echas en falta?"));
  }

  // ---------------------------------------------------------------
  //  Montaje según la página
  // ---------------------------------------------------------------
  if (enApp) {
    montarDimelo(); montarMes30(); montarSuscripciones(); montarTicket(); montarDeudas();
  } else if (pagina === "grupo.html") {
    montarPT();
  } else if (pagina === "calculadora.html") {
    const mesa = $("mesa");
    if (mesa) mesa.appendChild(cajaOpinion("t-qr-mesa", "QR en la mesa", "¿Lo enseñarías en la próxima cena? ¿Tus amigos lo entendieron sin explicación?"));
  } else if (pagina === "cuenta.html") {
    const c = $("cuenta"); if (c) c.appendChild(cajaOpinion("t-qr-mesa", "QR en la mesa", "¿Te ha quedado claro cuánto pagar y a quién?"));
  }
})();
