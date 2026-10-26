// =====================================================================
//  «DÍMELO Y LO APUNTO» — escribe o dicta una frase y la app la apunta.
//
//  · Gratis: reglas que corren en el propio móvil (no sale nada de él).
//    Entiende tareas, gastos, gastos de un grupo, grupos nuevos, deudas,
//    pagos («Ana me ha pagado 20 €») y gastos extra del presupuesto.
//  · Premium / Empresas: modo avanzado en el servidor (/api/dimelo).
//    Entiende cualquier forma de decirlo y varias cosas a la vez.
//    Si no responde, se usan las reglas.
//
//  En los dos casos solo se PROPONE: la app enseña
//  «He entendido esto» y no guarda nada hasta que pulsas «Guardar».
//  Todo lo que se guarda pasa por las mismas reglas de la base de datos.
// =====================================================================
(function (global) {
  const R = global.Reparto;

  // ---------------- utilidades ----------------
  const DIAS = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];
  const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
  const CATS = [["Comida", /cena|comida|restaurante|\bbar\b|caf[eé]|desayuno|almuerzo|pizza|tapas|cañas|menú/], ["Transporte", /taxi|uber|cabify|gasolina|bencina|tren|\bbus\b|metro|parking|peaje|vtc/],
    ["Ocio", /cine|concierto|entradas?|teatro|museo|fiesta|copas/], ["Hogar", /s[uú]per|mercadona|carrefour|lidl|compra|alquiler|\bluz\b|agua|\bgas\b|internet/],
    ["Viajes", /hotel|vuelo|avi[oó]n|airbnb|apartamento/], ["Salud", /farmacia|m[eé]dico|dentista|[oó]ptica|gafas/]];
  const BANCOS = ["BBVA", "Santander", "CaixaBank", "Sabadell", "Bankinter", "ING", "Unicaja", "Abanca", "Kutxabank", "Openbank", "Cetelem", "Cofidis", "Oney", "Revolut", "Ibercaja"];
  function plano(s) { return String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, ""); }
  function hoyISO(n, base) { const d = base ? new Date(base + "T12:00:00") : new Date(); d.setDate(d.getDate() + (n || 0)); return d.toISOString().slice(0, 10); }
  function mayus(s) { s = String(s || "").trim(); return s.charAt(0).toUpperCase() + s.slice(1); }
  function euros(c) { return R.eur(c); }
  function nombres(txt) { return String(txt || "").split(/\s*(?:,|\by\b|\be\b)\s*/).map(function (x) { return x.trim().replace(/[.;:]+$/, ""); }).filter(Boolean); }
  // primer importe con € (o el primer número si hay pista de dinero)
  const RE_EUR = /(\d{1,3}(?:\.\d{3})+(?:,\d{1,2})?|\d+(?:[.,]\d{1,2})?)\s*(?:€|eur\b|euros?\b|pavos\b)/g;
  function importesEn(t) { const r = []; let m; RE_EUR.lastIndex = 0; while ((m = RE_EUR.exec(t))) r.push({ c: R.aCentimos(m[1]), i: m.index, txt: m[0] }); return r; }

  // ---------------- 1 · Reglas (plan Gratis) ----------------
  // Devuelve una acción «en bruto» (nombres en vez de ids, importes en euros).
  function interpretarReglas(texto, grupos, hoy) {
    const t = String(texto || "").trim().replace(/\s+/g, " ");
    const low = t.toLowerCase(), pl = plano(t);
    const imps = importesEn(low);
    let primero = imps[0] || null;
    if (!primero) {
      const pista = /pagu[eé]|pag[oó]|gast[eé]|cena|comida|entre \d|entre todos|invit[eé]|cuota|me debe|le debo/.test(low);
      const m = pista && low.match(/\b(\d{1,3}(?:\.\d{3})+|\d+(?:[.,]\d{1,2})?)\b(?!\s*(?:h\b|:|de (?:enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre)|personas|cuotas|meses))/);
      if (m) primero = { c: R.aCentimos(m[1]), i: m.index, txt: m[0] };
    }

    // a) Crear un grupo: «crea el grupo Cumple de Lucía con Ana, Pedro y Juan»
    const mG = t.match(/^(?:crea|crear|cr[eé]ame|abre|haz|hazme|monta|nuevo|nueva)\s+(?:un\s+|el\s+|otro\s+)?grupo\s+(?:nuevo\s+)?(?:llamado\s+|que se llame\s+)?[«"']?(.+?)[»"']?(?:\s+(?:con|para)\s+(.+))?$/i);
    if (mG && !primero) {
      return { tipo: "grupo_nuevo", nombre: mayus(mG[1].replace(/[.,;]+$/, "")), personas: nombres(mG[2]) };
    }

    // b) Deuda o crédito: «préstamo coche 8.000 € cuota 250 € al mes el día 5»
    if (/pr[eé]stamo|hipoteca|cr[eé]dito|financiad|a plazos|en cuotas|aplazad/.test(low) && /cuota|al mes|mensual|cada mes|plazos/.test(low)) {
      let cuota = null, saldo = null;
      const mCuota = low.match(/(?:cuotas?(?: de)?|pago|pagando)\s*(\d{1,3}(?:\.\d{3})+(?:,\d{1,2})?|\d+(?:[.,]\d{1,2})?)\s*(?:€|eur|euros)?/) ||
                     low.match(/(\d{1,3}(?:\.\d{3})+(?:,\d{1,2})?|\d+(?:[.,]\d{1,2})?)\s*(?:€|eur|euros)?\s*(?:al mes|mensuales|cada mes|\/mes)/);
      if (mCuota) cuota = R.aCentimos(mCuota[1]);
      const mN = low.match(/(\d+)\s*(?:cuotas|plazos|meses)/);
      imps.forEach(function (x) { if (saldo == null && x.c !== cuota) saldo = x.c; });
      if (saldo == null && mN && cuota) saldo = cuota * (+mN[1]);
      const tipoD = /hipoteca/.test(low) ? "hipoteca" : /tarjeta/.test(low) ? "tarjeta" : /a plazos|financiad|aplazad|tienda/.test(low) ? "comercial" : /cr[eé]dito/.test(low) ? "consumo" : "prestamo";
      const mDia = low.match(/(?:el )?d[ií]a (\d{1,2})/);
      const mTae = low.match(/(\d+(?:[.,]\d+)?)\s*%/);
      const ent = BANCOS.find(function (b) { return new RegExp("\\b" + b + "\\b", "i").test(t); }) || null;
      let nombre = t.split(/\d/)[0].replace(/^(tengo|he pedido|pedí|pedi|me han dado|apunta|añade|anade)\s+(un|una|el|la)?\s*/i, "").replace(/\s+(de|por|con|del|en)\s*$/i, "").replace(/[,:;]+$/, "").trim();
      if (!nombre || nombre.length < 3) nombre = { hipoteca: "Hipoteca", tarjeta: "Tarjeta en cuotas", comercial: "Compra a plazos", consumo: "Crédito", prestamo: "Préstamo" }[tipoD];
      return { tipo: "deuda", nombre: mayus(nombre).slice(0, 80), tipo_deuda: tipoD, entidad: ent, saldo: saldo != null ? saldo / 100 : null, cuota: cuota != null ? cuota / 100 : null,
               dia_pago: mDia ? Math.min(31, +mDia[1]) : null, tae: mTae ? +mTae[1].replace(",", ".") : null };
    }

    // c) Un pago entre personas: «Ana me ha pagado 20 €», «le pagué 15 € a Pedro»
    const mMePaga = t.match(/([A-ZÁÉÍÓÚÑ][\wáéíóúñ]+)\s+(?:ya\s+)?me\s+(?:ha\s+)?(?:pagado|pag[oó]|devuelto|devolvi[oó]|ha hecho un bizum|hizo un bizum|mand[oó]|ha mandado)/);
    const mLePago = t.match(/(?:le\s+)?(?:he\s+)?(?:pagado|pagu[eé]|devuelto|devolv[ií]|mand[eé]|hice un bizum|he hecho un bizum)\s+(?:a\s+)?.*?\ba\s+([A-ZÁÉÍÓÚÑ][\wáéíóúñ]+)/) ||
                    t.match(/(?:le\s+)?(?:he\s+)?(?:pagado|pagu[eé]|devuelto|devolv[ií])\s+a\s+([A-ZÁÉÍÓÚÑ][\wáéíóúñ]+)/);
    if (primero && (mMePaga || (mLePago && /^(le |he |pagu|devolv|mand|hice)/i.test(low)))) {
      const g = grupoEnTexto(pl, grupos, []);
      return mMePaga
        ? { tipo: "pago", de: mMePaga[1], a: "yo", importe: primero.c / 100, grupo: g ? g.nombre : null }
        : { tipo: "pago", de: "yo", a: mLePago[1], importe: primero.c / 100, grupo: g ? g.nombre : null };
    }

    // d) Tarea (sin importe, o con «recuérdame»)
    const esTarea = /recu[eé]rda|recordar|tengo que|no olvid|av[ií]same|apunta que/.test(low) || !primero;
    if (esTarea) return tareaDe(t, hoy);

    // e) Gasto: personal, de un grupo o extra del presupuesto
    const importe = primero.c;
    const mEntre = low.match(/entre (\d+)/);
    let n = mEntre ? +mEntre[1] : 0;
    let pagador = "yo";
    const mPago = t.match(/pag[oó] ([A-ZÁÉÍÓÚÑ][\wáéíóúñ]+)/) || t.match(/([A-ZÁÉÍÓÚÑ][\wáéíóúñ]+) pag[oó]/) || t.match(/lo (?:ha )?pagado ([A-ZÁÉÍÓÚÑ][\wáéíóúñ]+)/);
    if (mPago && !/^(Yo|La|El|Lo)$/.test(mPago[1])) pagador = mPago[1];
    const mCon = t.match(/con ((?:[A-ZÁÉÍÓÚÑ][\wáéíóúñ]+)(?:\s*(?:,|y|e)\s*[A-ZÁÉÍÓÚÑ][\wáéíóúñ]+)*)/);
    const conNombres = mCon ? nombres(mCon[1]) : [];
    const personas = conNombres.slice();
    if (pagador !== "yo" && personas.indexOf(pagador) === -1) personas.push(pagador);
    const g = grupoEnTexto(pl, grupos, personas);
    let concepto = t.slice(0, low.indexOf(primero.txt)).replace(/^(he |hemos )?(pagado|pagu[eé]|gast[eé]|gastado)\s*/i, "").replace(/^(un |una )?(gasto )?extra( de)?\s*/i, "").trim();
    if (!concepto) concepto = t.replace(primero.txt, "").replace(/entre \d+|entre todos|pag[oó] \S+|con .*|en (el grupo )?.*$/gi, "").replace(/^\s*(he |hemos )?(pagado|pagu[eé]|gast[eé]|gastado)\s*/i, "").replace(/^\s*(un |una )?(gasto )?extra( de)?\s*/i, "").replace(/^\s*(del|de la|de los|de|en|para)\s+/i, "").trim();
    concepto = mayus(concepto.replace(/[,.;:]+$/, "").replace(/\s+(en|para|del|de)$/i, "")) || "Gasto";
    const cat = (CATS.find(function (c) { return c[1].test(low); }) || ["Otros"])[0];
    if (g && g.presupuesto && /\bextra\b|fuera del presupuesto|aprobar|que lo apruebe/.test(low)) {
      return { tipo: "extra", grupo: g.nombre, concepto: concepto, importe: importe / 100, pagador: pagador, comentario: null };
    }
    if (g) return { tipo: "gasto_grupo", grupo: g.nombre, concepto: concepto, importe: importe / 100, pagador: pagador, personas: conNombres, categoria: cat };
    if (!n) n = personas.length + 1;
    return { tipo: "gasto", concepto: concepto, importe: importe / 100, categoria: cat, pagador: pagador, personas: personas, n_personas: Math.max(1, n) };
  }

  function tareaDe(t, hoy) {
    const low = t.toLowerCase(), pl = plano(t);
    let fecha = null, hora = null, resto = t;
    const quita = function (re) { resto = resto.replace(re, " "); };
    if (/pasado mañana/.test(low)) { fecha = hoyISO(2, hoy); quita(/pasado mañana/i); }
    else if (/\bmañana\b/.test(low) && !/por la mañana/.test(low)) { fecha = hoyISO(1, hoy); quita(/\bmañana\b/i); }
    else if (/\bhoy\b|esta tarde|esta noche/.test(low)) { fecha = hoyISO(0, hoy); quita(/\bhoy\b|esta tarde|esta noche/i); }
    DIAS.forEach(function (d, i) {
      if (fecha) return;
      const re = new RegExp("(el |este |próximo |proximo )?" + plano(d) + "\\b", "i");
      if (re.test(pl)) { const base = new Date((hoy || hoyISO(0)) + "T12:00:00"); let n = (i - base.getDay() + 7) % 7; if (n === 0) n = 7; fecha = hoyISO(n, hoy); resto = resto.replace(new RegExp("(el |este |próximo |proximo )?" + d + "\\b", "i"), " ").replace(re, " "); }
    });
    if (!fecha) {
      const mFecha = low.match(/\bel (?:d[ií]a )?(\d{1,2})(?: de (enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre))?\b/);
      if (mFecha) {
        const base = new Date((hoy || hoyISO(0)) + "T12:00:00"); const d = new Date(base);
        if (mFecha[2]) { d.setMonth(MESES.indexOf(mFecha[2])); if (d < base) d.setFullYear(d.getFullYear() + 1); }
        else if (+mFecha[1] < base.getDate()) d.setMonth(d.getMonth() + 1);
        d.setDate(+mFecha[1]); fecha = d.toISOString().slice(0, 10); quita(/\bel (?:d[ií]a )?\d{1,2}(?: de [a-z]+)?\b/i);
      }
    }
    const mHora = low.match(/a las (\d{1,2})(?:[:.](\d{2}))?|(\d{1,2})(?::(\d{2}))?\s?h\b/);
    if (mHora) { let h = +(mHora[1] || mHora[3]), m = +(mHora[2] || mHora[4] || 0); if (/tarde|noche/.test(low) && h < 12) h += 12; if (h < 24 && m < 60) hora = String(h).padStart(2, "0") + ":" + String(m).padStart(2, "0"); quita(/a las \d{1,2}(?:[:.]\d{2})?|\d{1,2}(?::\d{2})?\s?h\b/i); if (!fecha) fecha = hoyISO(0, hoy); }
    resto = resto.replace(/^\s*(recu[eé]rdame|recordarme|av[ií]same|apunta que|tengo que|no olvidar|no olvides|apunta)\s*(que|de)?\s*/i, "").replace(/\s+(por la|de la|esta)\s*(tarde|noche|mañana)\b/i, "").replace(/\s+/g, " ").trim();
    return { tipo: "tarea", texto: mayus(resto) || t, fecha: fecha, hora: hora };
  }

  // ¿Nombra la frase un grupo? (sin contar los nombres de personas)
  function grupoEnTexto(pl, grupos, personas) {
    let txt = pl;
    (personas || []).forEach(function (p) { txt = txt.split(plano(p)).join(" "); });
    let mejor = null;
    (grupos || []).forEach(function (g) {
      if (mejor) return;
      const n = plano(g.nombre);
      const palabras = n.split(/[^a-z0-9/]+/).filter(function (w) { return w.length >= 4 && ["viaje", "grupo", "regalo", "casa", "gastos", "cuentas"].indexOf(w) === -1; });
      if (txt.indexOf(n) !== -1 || palabras.some(function (w) { return new RegExp("\\b" + w.replace("/", "\\/") + "\\b").test(txt); })) mejor = g;
    });
    return mejor;
  }

  // Varias cosas en una frase (lo usa la demo para simular el modo Premium)
  function partirFrases(texto) {
    return String(texto || "").split(/\s*(?:\.\s+|;\s*|\by además\b|\by también\b|\by luego\b|,?\s+y (?=recu[eé]rdame|ap[uú]ntame|apunta|crea|av[ií]same))\s*/i).map(function (x) { return x.trim(); }).filter(function (x) { return x.length > 2; });
  }

  // ---------------- 2 · Comprobar la acción contra tus datos ----------------
  // Sirve igual para lo que proponen las reglas y el modo Premium: busca el grupo y las
  // personas, pasa euros a céntimos y rechaza lo que no tenga sentido.
  function buscarGrupo(nombre, grupos) {
    if (!nombre) return null;
    const k = plano(nombre);
    return (grupos || []).find(function (g) { return plano(g.nombre) === k; }) ||
           (grupos || []).find(function (g) { const n = plano(g.nombre); return n.indexOf(k) !== -1 || k.indexOf(n) !== -1; }) ||
           grupoEnTexto(k, grupos, []);
  }
  function yoEn(g) { return g.miembros.find(function (m) { return m.yo; }) || g.miembros[0]; }
  function miembro(g, nombre) {
    if (!nombre || /^(yo|m[ií]|me|nosotros)$/i.test(String(nombre).trim())) return yoEn(g);
    const k = plano(nombre);
    return g.miembros.find(function (m) { return plano(m.nombre) === k; }) || g.miembros.find(function (m) { return plano(m.nombre).split(" ")[0] === k.split(" ")[0]; }) || null;
  }
  function cent(x) { const v = typeof x === "number" ? Math.round(x * 100) : R.aCentimos(String(x == null ? "" : x)); return v > 0 && v <= 10000000 ? v : 0; }
  function fechaOk(f) { return /^\d{4}-\d{2}-\d{2}$/.test(String(f || "")) ? f : null; }
  function horaOk(h) { const m = String(h || "").match(/^(\d{1,2}):(\d{2})/); return m && +m[1] < 24 && +m[2] < 60 ? String(+m[1]).padStart(2, "0") + ":" + m[2] : null; }

  function resolver(a, grupos) {
    if (!a || !a.tipo) return { error: "No he entendido qué quieres apuntar." };
    if (a.tipo === "tarea") {
      const texto = String(a.texto || "").trim().slice(0, 200);
      if (!texto) return { error: "Falta el texto de la tarea." };
      return { tipo: "tarea", texto: mayus(texto), fecha: fechaOk(a.fecha), hora: horaOk(a.hora) };
    }
    if (a.tipo === "grupo_nuevo") {
      const nombre = String(a.nombre || "").trim().slice(0, 120);
      if (!nombre) return { error: "Falta el nombre del grupo." };
      const personas = (a.personas || []).map(function (p) { return mayus(String(p).trim()).slice(0, 60); }).filter(function (p) { return p && !/^(yo|m[ií])$/i.test(p); }).slice(0, 30);
      return { tipo: "grupo_nuevo", nombre: mayus(nombre), personas: personas };
    }
    if (a.tipo === "deuda") {
      const cuota = cent(a.cuota), saldo = cent(a.saldo);
      if (!cuota) return { error: "Dime la cuota que pagas cada mes." };
      if (!saldo) return { error: "Dime cuánto te queda por pagar (o cuántas cuotas)." };
      const tipos = ["hipoteca", "prestamo", "consumo", "tarjeta", "comercial", "otro"];
      return { tipo: "deuda", nombre: mayus(String(a.nombre || "Préstamo")).slice(0, 80), tipo_deuda: tipos.indexOf(a.tipo_deuda) !== -1 ? a.tipo_deuda : "prestamo",
               entidad: a.entidad ? String(a.entidad).slice(0, 80) : null, saldo: saldo, cuota: cuota,
               dia_pago: Math.min(31, Math.max(1, parseInt(a.dia_pago, 10) || 1)), tae: Math.max(0, Math.min(100, +a.tae || 0)) };
    }
    const importe = cent(a.importe);
    if (!importe) return { error: "Falta el importe." };
    if (a.tipo === "gasto") {
      const personas = (a.personas || []).map(function (p) { return mayus(String(p)).slice(0, 60); }).filter(Boolean).slice(0, 20);
      const pagador = !a.pagador || /^(yo|m[ií])$/i.test(a.pagador) ? "yo" : mayus(a.pagador);
      if (pagador !== "yo" && personas.indexOf(pagador) === -1) personas.push(pagador);
      const n = Math.max(1, Math.min(50, parseInt(a.n_personas, 10) || personas.length + 1));
      return { tipo: "gasto", concepto: mayus(String(a.concepto || "Gasto")).slice(0, 120), importe: importe, categoria: String(a.categoria || "Otros").slice(0, 40), pagador: pagador, personas: personas, n: n };
    }
    if (a.tipo === "gasto_grupo" || a.tipo === "extra") {
      const g = buscarGrupo(a.grupo, grupos);
      if (!g) return { error: "No encuentro el grupo «" + (a.grupo || "") + "»." };
      const pm = miembro(g, a.pagador);
      if (!pm) return { error: "En «" + g.nombre + "» no hay nadie llamado " + a.pagador + "." };
      const concepto = mayus(String(a.concepto || "Gasto")).slice(0, 120);
      if (a.tipo === "extra") {
        if (!g.presupuesto) return { error: "«" + g.nombre + "» no tiene presupuesto: apúntalo como gasto normal." };
        return { tipo: "extra", grupo: g, concepto: concepto, importe: importe, pagador: pm, comentario: a.comentario ? String(a.comentario).slice(0, 300) : "" };
      }
      let ids = g.miembros.map(function (m) { return m.id; });
      const lista = (a.personas || []).map(function (p) { return miembro(g, p); }).filter(Boolean);
      if (lista.length && !g.presupuesto) { const y = yoEn(g); ids = [y.id].concat(lista.map(function (m) { return m.id; }).filter(function (i) { return i !== y.id; })); }
      let categoria = null;
      if (g.presupuesto) {
        const cats = (g.presupuesto.categorias || []).map(function (c) { return c.nombre; });
        categoria = cats.find(function (c) { return plano(c) === plano(a.categoria); }) || cats.find(function (c) { return plano(concepto).indexOf(plano(c)) !== -1; }) || null;
      }
      return { tipo: "gasto_grupo", grupo: g, concepto: concepto, importe: importe, pagador: pm, miembros: ids, presupuesto: !!g.presupuesto, categoria: categoria };
    }
    if (a.tipo === "pago") {
      const yoPaga = !a.de || /^(yo|m[ií])$/i.test(a.de);
      const otro = yoPaga ? a.a : a.de;
      if (!otro || /^(yo|m[ií])$/i.test(otro)) return { error: "¿Quién pagó a quién?" };
      let g = a.grupo ? buscarGrupo(a.grupo, grupos) : null;
      if (!g) { const conEl = (grupos || []).filter(function (x) { return miembro(x, otro) && miembro(x, otro) !== yoEn(x); }); if (conEl.length === 1) g = conEl[0]; }
      if (g) {
        const m = miembro(g, otro); if (!m) return { error: "En «" + g.nombre + "» no hay nadie llamado " + otro + "." };
        const y = yoEn(g);
        return { tipo: "pago", grupo: g, de: yoPaga ? y : m, a: yoPaga ? m : y, importe: importe };
      }
      return { tipo: "pago", personal: true, persona: mayus(otro), sentido: yoPaga ? "le_pago" : "me_paga", importe: importe };
    }
    return { error: "No sé apuntar eso todavía." };
  }

  function lineasGasto(x) {
    const partes = R.repartirIguales(x.importe, Array.from({ length: x.n }, function (_, i) { return i; }));
    const lineas = [{ item: "Mi parte", persona: "", importe: partes[0], tipo: "mio", saldado: false }];
    if (x.pagador === "yo") {
      for (let i = 1; i < x.n; i++) {
        const p = x.personas[i - 1];
        lineas.push({ item: p ? "Parte de " + p : "Persona " + (i + 1), persona: p || ("Persona " + (i + 1)), importe: partes[i], tipo: "me-debe", saldado: false });
      }
    } else {
      lineas[0] = { item: "Mi parte", persona: x.pagador, importe: partes[0], tipo: "le-debo", saldado: false };
    }
    return lineas;
  }

  function describir(x) {
    if (x.tipo === "tarea") {
      const f = x.fecha ? new Date(x.fecha + "T12:00").toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long" }) : "sin fecha";
      return [["Qué", "Tarea con aviso"], ["Texto", x.texto], ["Cuándo", f + (x.hora ? " a las " + x.hora : "")]];
    }
    if (x.tipo === "grupo_nuevo") return [["Qué", "Grupo nuevo"], ["Nombre", x.nombre], ["Personas", ["Tú"].concat(x.personas).join(", ")]];
    if (x.tipo === "deuda") return [["Qué", "Deuda o crédito"], ["Nombre", x.nombre + (x.entidad ? " · " + x.entidad : "")], ["Te queda", euros(x.saldo)], ["Cuota", euros(x.cuota) + " al mes, el día " + x.dia_pago], ["TAE", x.tae ? String(x.tae).replace(".", ",") + " %" : "sin indicar"]];
    if (x.tipo === "gasto_grupo") {
      const r = [["Qué", "Gasto del grupo «" + x.grupo.nombre + "»" + (x.presupuesto ? " · del presupuesto" : "")], ["Concepto", x.concepto], ["Importe", euros(x.importe)], ["Pagó", x.pagador.nombre + (x.pagador.yo ? " (tú)" : "")]];
      if (x.presupuesto) r.push(["Categoría", x.categoria || "sin categoría"]);
      else r.push(["Entre", x.miembros.length === x.grupo.miembros.length ? "todos (" + x.miembros.length + ")" : x.miembros.map(function (i) { return R.nombre(x.grupo, i); }).join(", ")]);
      return r;
    }
    if (x.tipo === "extra") return [["Qué", "Gasto extra de «" + x.grupo.nombre + "» (lo aprueba la otra parte)"], ["Concepto", x.concepto], ["Importe", euros(x.importe)], ["Pagó", x.pagador.nombre], ["Reparto", Object.keys(x.grupo.presupuesto.pct || {}).map(function (k) { return R.nombre(x.grupo, k) + " " + x.grupo.presupuesto.pct[k] + " %"; }).join(" / ") || "según el presupuesto"]];
    if (x.tipo === "pago") {
      if (x.personal) return [["Qué", x.sentido === "me_paga" ? x.persona + " te ha pagado" : "Le has pagado a " + x.persona], ["Importe", euros(x.importe)], ["Dónde", "En tus gastos: se marca como pagado"]];
      return [["Qué", "Pago en «" + x.grupo.nombre + "»"], ["De", x.de.nombre + (x.de.yo ? " (tú)" : "")], ["A", x.a.nombre + (x.a.yo ? " (tú)" : "")], ["Importe", euros(x.importe)]];
    }
    const l = lineasGasto(x);
    const r = [["Qué", "Gasto personal · " + x.categoria], ["Concepto", x.concepto], ["Importe", euros(x.importe) + (x.n > 1 ? " entre " + x.n : "")], ["Tu parte", euros(l[0].importe)]];
    if (x.pagador === "yo" && x.n > 1) r.push(["Te deben", l.slice(1).map(function (y) { return y.persona + " " + euros(y.importe); }).join(", ")]);
    if (x.pagador !== "yo") r.push(["Le debes", x.pagador + " " + euros(l[0].importe)]);
    return r;
  }

  global.Dimelo = { interpretarReglas: interpretarReglas, partirFrases: partirFrases, resolver: resolver, describir: describir, lineasGasto: lineasGasto };
  if (typeof document === "undefined") return;

  // ---------------- 3 · Guardar ----------------
  function ahoraISO() { const d = new Date(); return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 19); }
  async function recargar() {
    await Promise.all([typeof cargarTodo === "function" ? cargarTodo() : null, global.cargarGrupos ? global.cargarGrupos() : null, global.cargarDeudas ? global.cargarDeudas() : null]);
  }
  function conRegistro(g, accion, detalle) {
    const y = yoEn(g);
    return (g.registro || []).concat([{ fecha: ahoraISO(), quien: (y && y.nombre) || "Yo", accion: accion, detalle: detalle || "" }]);
  }
  async function grupoFresco(id) { const r = await sb.from("grupos").select("*").eq("id", id); const g = (r.data || [])[0]; if (!g) throw new Error("Grupo no encontrado"); return g; }
  function comprobar(r) { if (r && r.error) throw r.error; return r; }

  async function guardarAccion(x) {
    if (x.tipo === "tarea") {
      comprobar(await sb.from("tareas").insert({ texto: x.texto, fecha: x.fecha, hora: x.hora, hecha: false, avisada: false }));
      return "Tarea creada";
    }
    if (x.tipo === "gasto") {
      comprobar(await sb.from("gastos").insert({ concepto: x.concepto, fecha: hoyISO(0), categoria: x.categoria, lineas: lineasGasto(x) }));
      return "Gasto anotado";
    }
    if (x.tipo === "grupo_nuevo") {
      const yo = (document.getElementById("nombre-usuario") || {}).textContent;
      const miembros = [{ id: R.nuevoId(), nombre: (yo && yo.trim() && yo.trim() !== "Mi cuenta") ? yo.trim() : "Yo", telefono: "", yo: true }]
        .concat(x.personas.map(function (p) { return { id: R.nuevoId(), nombre: p, telefono: "" }; }));
      comprobar(await sb.from("grupos").insert({ nombre: x.nombre, miembros: miembros }));
      return "Grupo «" + x.nombre + "» creado";
    }
    if (x.tipo === "deuda") {
      comprobar(await sb.from("deudas").insert({ tipo: x.tipo_deuda, nombre: x.nombre, entidad: x.entidad, cuota: x.cuota, saldo: x.saldo, tae: x.tae, dia_pago: x.dia_pago, importe_original: null }));
      return "Deuda añadida en «Deudas»";
    }
    if (x.tipo === "gasto_grupo") {
      const g = await grupoFresco(x.grupo.id);
      const gasto = { id: R.nuevoId(), concepto: x.concepto, fecha: hoyISO(0), importe: x.importe, pagos: [{ miembro: x.pagador.id, importe: x.importe }],
                      reparto: { modo: "iguales", miembros: x.presupuesto ? g.miembros.map(function (m) { return m.id; }) : x.miembros } };
      const cambios = { gastos: (g.gastos || []).concat([gasto]) };
      if (g.presupuesto) { gasto.presupuesto = true; if (x.categoria) gasto.categoria = x.categoria; cambios.registro = conRegistro(g, "Añade gasto del presupuesto", x.concepto + " · " + euros(x.importe) + (x.categoria ? " · " + x.categoria : "")); }
      comprobar(await sb.from("grupos").update(cambios).eq("id", g.id));
      return "Añadido a «" + g.nombre + "»";
    }
    if (x.tipo === "extra") {
      const g = await grupoFresco(x.grupo.id);
      const gasto = { id: R.nuevoId(), concepto: x.concepto, fecha: hoyISO(0), importe: x.importe, pagos: [{ miembro: x.pagador.id, importe: x.importe }],
                      reparto: { modo: "porcentaje", porcentajes: Object.assign({}, (g.presupuesto || {}).pct) }, presupuesto: false, estado: "pendiente",
                      propuesto_por: yoEn(g).id, nota: x.comentario || "" };
      comprobar(await sb.from("grupos").update({ gastos: (g.gastos || []).concat([gasto]), registro: conRegistro(g, "Propone extra", x.concepto + " · " + euros(x.importe)) }).eq("id", g.id));
      return "Extra propuesto en «" + g.nombre + "»: falta que la otra parte lo apruebe";
    }
    if (x.tipo === "pago" && !x.personal) {
      const g = await grupoFresco(x.grupo.id);
      comprobar(await sb.from("grupos").update({ liquidaciones: (g.liquidaciones || []).concat([{ id: R.nuevoId(), de: x.de.id, a: x.a.id, importe: x.importe, fecha: hoyISO(0) }]),
        avisos: (g.avisos || []).filter(function (v) { return !(v.de === x.de.id && v.a === x.a.id); }) }).eq("id", g.id));
      return "Pago apuntado en «" + g.nombre + "»";
    }
    if (x.tipo === "pago") {
      // Marca como saldadas las líneas pendientes con esa persona, de la más antigua a la más nueva
      const r = await sb.from("gastos").select("*"); comprobar(r);
      const tipo = x.sentido === "me_paga" ? "me-debe" : "le-debo", k = plano(x.persona);
      const lista = (r.data || []).slice().sort(function (a, b) { return String(a.fecha).localeCompare(String(b.fecha)); });
      let queda = x.importe; const cambios = [];
      lista.forEach(function (gst) {
        if (queda <= 0) return;
        let toca = false;
        const lineas = gst.lineas.map(function (l) {
          if (queda > 0 && !l.saldado && l.tipo === tipo && plano(l.persona).split(" ")[0] === k.split(" ")[0] && l.importe <= queda) { queda -= l.importe; toca = true; return Object.assign({}, l, { saldado: true }); }
          return l;
        });
        if (toca) cambios.push({ id: gst.id, lineas: lineas });
      });
      if (!cambios.length) throw new Error(x.sentido === "me_paga" ? "No encuentro nada pendiente que te deba " + x.persona + " por ese importe." : "No encuentro nada pendiente que le debas a " + x.persona + " por ese importe.");
      for (const c of cambios) comprobar(await sb.from("gastos").update({ lineas: c.lineas }).eq("id", c.id));
      return "Marcado como pagado" + (queda > 0 ? " (sobran " + euros(queda) + " sin asignar)" : "");
    }
    throw new Error("No sé guardar eso");
  }

  // ---------------- 4 · Premium: modo avanzado en el servidor ----------------
  let planCache = null;
  async function miPlan() {
    if (planCache) return planCache;
    try { const p = await miPerfil(); planCache = (p && p.plan) || "gratis"; } catch (e) { planCache = "gratis"; }
    return planCache;
  }
  const olvidarAnterior = global.olvidarPlan;
  global.olvidarPlan = function () { planCache = null; if (olvidarAnterior) olvidarAnterior(); };

  function contexto(grupos) {
    return (grupos || []).slice(0, 30).map(function (g) {
      return { nombre: g.nombre, personas: g.miembros.map(function (m) { return m.yo ? "yo" : m.nombre; }), presupuesto: !!g.presupuesto,
               categorias: g.presupuesto ? (g.presupuesto.categorias || []).map(function (c) { return c.nombre; }) : [] };
    });
  }
  async function interpretarIA(texto, grupos) {
    if (global.MODO_DEMO) {
      // La demo no tiene servidor: simulamos el modo avanzado con las reglas, frase a frase
      return { acciones: partirFrases(texto).map(function (f) { return interpretarReglas(f, grupos); }), simulada: true };
    }
    const s = await sesionActual(); if (!s) throw new Error("Sin sesión");
    const r = await fetch("/api/dimelo", {
      method: "POST", headers: { "Content-Type": "application/json", Authorization: "Bearer " + s.access_token },
      body: JSON.stringify({ texto: texto, hoy: hoyISO(0), grupos: contexto(grupos) })
    });
    const j = await r.json().catch(function () { return {}; });
    if (!r.ok) { const e = new Error(j.error || "El modo Premium no está disponible"); e.status = r.status; throw e; }
    return { acciones: j.acciones || [] };
  }

  // ---------------- 5 · Pantalla ----------------
  function el(tag, clase, texto) { const e = document.createElement(tag); if (clase) e.className = clase; if (texto != null) e.textContent = texto; return e; }
  function $(id) { return document.getElementById(id); }

  function montar() {
    const nav = document.querySelector("nav.pestanas"); if (!nav || $("dm-texto")) return;
    const caja = el("section", "tarjeta dimelo"); caja.id = "dimelo";
    caja.innerHTML =
      '<div class="dimelo-fila"><input type="text" id="dm-texto" maxlength="300" autocomplete="off" placeholder="Dímelo y lo apunto: «cena 120 € entre 4, pagó Ana»" aria-label="Dímelo y lo apunto">' +
      '<button type="button" class="boton-sec" id="dm-voz" aria-label="Dictar" title="Dictar" hidden><svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/></svg></button><button type="button" class="anadir" id="dm-ir">Apuntar</button></div>' +
      '<p class="dimelo-modo" id="dm-modo"></p><div class="dimelo-ejemplos" id="dm-ejemplos"></div><div id="dm-carta" hidden></div>';
    nav.parentNode.insertBefore(caja, nav);
    const ejemplos = ["cena 120 € entre 4, pagó Ana", "recuérdame llamar al seguro el jueves a las 10", "crea el grupo Cumple de Lucía con Ana y Pedro",
      "Ana me ha pagado 30 €", "préstamo coche 8.000 € cuota 250 € al mes el día 5"];
    ejemplos.forEach(function (e) {
      const b = el("button", "chip", e); b.type = "button";
      b.addEventListener("click", function () { $("dm-texto").value = e; procesar(); });
      $("dm-ejemplos").appendChild(b);
    });
    miPlan().then(pintarModo);

    function pintarModo(plan) {
      const m = $("dm-modo"); m.innerHTML = "";
      if (plan === "premium" || plan === "empresa") {
        m.append(el("span", "insignia-premium", "Premium"), document.createTextNode(" Entiende cualquier frase y varias cosas a la vez." + (global.MODO_DEMO ? " (En la demo se simula.)" : "")));
      } else {
        m.appendChild(document.createTextNode("Tareas, gastos, grupos, deudas y pagos con frases sencillas. "));
        const s = el("span", "dimelo-mas", "Con Premium entiende cualquier frase y varias cosas a la vez."); m.appendChild(s);
      }
    }

    let acciones = [];
    async function procesar() {
      const txt = $("dm-texto").value.trim(); if (!txt) return;
      const ir = $("dm-ir"); ir.disabled = true; ir.textContent = "Leyendo…";
      const gs = (await sb.from("grupos").select("*")).data || [];
      const plan = await miPlan();
      let brutas = [], aviso = "", fuente = "reglas";
      if (plan === "premium" || plan === "empresa") {
        try { const r = await interpretarIA(txt, gs); brutas = r.acciones; fuente = r.simulada ? "ia-simulada" : "ia"; }
        catch (e) { brutas = [interpretarReglas(txt, gs)]; aviso = e.status === 429 ? "Has llegado al límite de hoy del modo Premium; lo he interpretado con el modo básico." : "Ahora mismo no puedo usar el modo Premium; lo he interpretado con el modo básico."; }
      } else {
        const partes = partirFrases(txt);
        brutas = [interpretarReglas(partes[0] || txt, gs)];
        if (partes.length > 1) aviso = "Parece que son " + partes.length + " cosas: te propongo la primera. Escribe las demás de una en una (con Premium las entiende juntas).";
      }
      ir.disabled = false; ir.textContent = "Apuntar";
      acciones = brutas.slice(0, 3).map(function (b) { return resolver(b, gs); });
      pintarCarta(fuente, aviso);
    }

    function pintarCarta(fuente, aviso) {
      const carta = $("dm-carta"); carta.innerHTML = ""; carta.hidden = false;
      const cab = el("p", "etiqueta", acciones.length > 1 ? "He entendido " + acciones.length + " cosas:" : "He entendido esto:");
      if (fuente !== "reglas") cab.appendChild(el("span", "insignia-premium dimelo-ia", fuente === "ia" ? "Premium" : "Premium · demo"));
      carta.appendChild(cab);
      if (aviso) carta.appendChild(el("p", "ayuda", aviso));
      if (!acciones.length) acciones = [{ error: "No he entendido qué quieres apuntar." }];
      acciones.forEach(function (x, i) {
        const bloque = el("div", "dimelo-accion");
        if (x.error) { bloque.appendChild(el("p", "mensaje mal", x.error)); }
        else {
          const dl = el("dl", "dimelo-dl");
          describir(x).forEach(function (f) { dl.append(el("dt", null, f[0]), el("dd", null, f[1])); });
          bloque.appendChild(dl);
          if (acciones.length > 1) {
            const q = el("button", "enlace-boton", "Quitar"); q.type = "button";
            q.addEventListener("click", function () { acciones.splice(i, 1); if (!acciones.length) { carta.hidden = true; return; } pintarCarta(fuente, ""); });
            bloque.appendChild(q);
          }
        }
        carta.appendChild(bloque);
      });
      const validas = acciones.filter(function (x) { return !x.error; });
      const fila = el("div", "fila-miembro");
      const ok = el("button", "anadir", validas.length > 1 ? "Guardar las " + validas.length : "Guardar"); ok.type = "button"; ok.disabled = !validas.length;
      const no = el("button", "boton-sec", "No es eso"); no.type = "button";
      const msg = el("p", "mensaje"); msg.hidden = true;
      fila.append(ok, no); carta.append(fila, msg);
      ok.addEventListener("click", async function () {
        ok.disabled = true;
        const hechos = [], fallos = [];
        for (const x of validas) { try { hechos.push(await guardarAccion(x)); } catch (e) { fallos.push(traducirError(e)); } }
        await recargar();
        msg.textContent = hechos.concat(fallos.map(function (f) { return "No se pudo: " + f; })).join(" · ") + ".";
        msg.className = fallos.length ? "mensaje mal" : "mensaje ok"; msg.hidden = false; fila.hidden = true;
        if (!fallos.length) { $("dm-texto").value = ""; setTimeout(function () { carta.hidden = true; }, 3500); }
      });
      no.addEventListener("click", function () { carta.hidden = true; $("dm-texto").focus(); });
    }

    $("dm-ir").addEventListener("click", procesar);
    $("dm-texto").addEventListener("keydown", function (e) { if (e.key === "Enter") { e.preventDefault(); procesar(); } });
    // Dictado con el reconocimiento de voz del propio navegador (Chrome, Edge, Safari)
    const SR = global.SpeechRecognition || global.webkitSpeechRecognition;
    if (SR) {
      $("dm-voz").hidden = false;
      $("dm-voz").addEventListener("click", function () {
        try {
          const rec = new SR(); rec.lang = "es-ES"; rec.interimResults = false;
          $("dm-voz").classList.add("escuchando");
          rec.onresult = function (ev) { $("dm-texto").value = ev.results[0][0].transcript; procesar(); };
          rec.onend = function () { $("dm-voz").classList.remove("escuchando"); };
          rec.start();
        } catch (e) {}
      });
    }
  }
  if (document.querySelector("nav.pestanas")) montar(); else document.addEventListener("DOMContentLoaded", montar);
})(typeof window !== "undefined" ? window : globalThis);
