// Gastos con desglose por ítems y personas (ahora en Supabase)

  const CATEGORIAS = ["Hogar", "Comida", "Transporte", "Trabajo", "Ocio", "Salud", "Otros"];
  const TIPOS = { "mio": "Mío", "me-debe": "Me debe", "le-debo": "Le debo" };
  let gastos = [];

  // Dinero: trabajamos en céntimos (números enteros) para evitar errores de redondeo
  const formato = new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR", useGrouping: "always" });
  function eur(centimos) { return formato.format(centimos / 100); }
  function aCentimos(texto) {
    // Acepta «1.100», «1.100,50», «12,5» o «12.50»
    let t = String(texto == null ? "" : texto).replace(/\s|€/g, "");
    if (/,\d{0,2}$/.test(t)) t = t.replace(/\./g, "").replace(",", ".");
    else if (/^-?\d{1,3}(\.\d{3})+$/.test(t)) t = t.replace(/\./g, "");
    else t = t.replace(/,/g, "");
    const n = parseFloat(t);
    return isNaN(n) ? 0 : Math.round(n * 100);
  }
  function hoyTexto() {
    const d = new Date();
    return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
  }
  function lineasDe(g) { return Array.isArray(g.lineas) ? g.lineas : []; }
  function totalDe(g) { return lineasDe(g).reduce(function (s, l) { return s + (l.importe || 0); }, 0); }
  // Mi gasto real = lo que es mío (lo pagara yo o me lo pagaran)
  function miParte(g) { return lineasDe(g).filter(function (l) { return l.tipo !== "me-debe"; }).reduce(function (s, l) { return s + (l.importe || 0); }, 0); }

  // --- Piezas del HTML ---
  const gMes = document.getElementById("g-mes");
  const gConcepto = document.getElementById("g-concepto");
  const gFecha = document.getElementById("g-fecha");
  const gCategoria = document.getElementById("g-categoria");
  const lineasForm = document.getElementById("lineas-form");
  const totalForm = document.getElementById("total-form");
  const gError = document.getElementById("g-error");
  const listaGastos = document.getElementById("lista-gastos");
  const vacioGastos = document.getElementById("vacio-gastos");

  CATEGORIAS.forEach(function (c) { const o = document.createElement("option"); o.value = c; o.textContent = c; gCategoria.appendChild(o); });
  gFecha.value = hoyTexto();

  // --- Pestañas ---
  function abrirPestana(nombre) {
    document.querySelectorAll(".pestanas button").forEach(function (b) {
      b.setAttribute("aria-selected", String(b.dataset.panel === nombre));
    });
    ["tareas", "gastos", "grupos", "deudas"].forEach(function (p) {
      document.getElementById("panel-" + p).hidden = nombre !== p;
    });
    document.getElementById("titulo").innerHTML = "Mis <span>" + nombre + "</span>";
    try { localStorage.setItem("pestana", nombre); } catch (e) {}
  }
  document.querySelectorAll(".pestanas button").forEach(function (b) {
    b.addEventListener("click", function () { abrirPestana(b.dataset.panel); });
  });
  (function () {
    const validas = ["tareas", "gastos", "grupos", "deudas"];
    let inicial = location.hash.slice(1);
    if (validas.indexOf(inicial) === -1) { try { inicial = localStorage.getItem("pestana"); } catch (e) {} }
    abrirPestana(validas.indexOf(inicial) !== -1 ? inicial : "tareas");
  })();

  // --- Formulario: líneas del desglose ---
  let contadorLineas = 0;
  function nuevaLineaForm(valores) {
    valores = valores || {};
    contadorLineas++;
    const n = contadorLineas;
    const fila = document.createElement("div");
    fila.className = "linea-form";
    fila.innerHTML =
      '<input type="text" class="l-item" id="l-item-' + n + '" placeholder="Ítem (ej. mi parte)" aria-label="Ítem" autocomplete="off">' +
      '<input type="text" class="l-persona" id="l-persona-' + n + '" placeholder="Persona" aria-label="Persona" list="personas" autocomplete="off">' +
      '<input type="text" class="l-importe" id="l-importe-' + n + '" inputmode="decimal" placeholder="0,00 €" aria-label="Importe">' +
      '<select class="l-tipo" id="l-tipo-' + n + '" aria-label="Tipo">' +
        '<option value="mio">Mío</option><option value="me-debe">Me debe</option><option value="le-debo">Le debo</option>' +
      '</select>' +
      '<button type="button" class="quitar" aria-label="Quitar línea">×</button>';
    fila.querySelector(".l-item").value = valores.item || "";
    fila.querySelector(".l-persona").value = valores.persona || "";
    fila.querySelector(".l-tipo").value = valores.tipo || "mio";
    if (valores.importe) fila.querySelector(".l-importe").value = (valores.importe / 100).toFixed(2).replace(".", ",");
    fila.querySelector(".quitar").addEventListener("click", function () {
      if (lineasForm.children.length > 1) { fila.remove(); recalcularTotalForm(); }
    });
    fila.querySelector(".l-importe").addEventListener("input", recalcularTotalForm);
    lineasForm.appendChild(fila);
  }
  function leerLineasForm() {
    return Array.from(lineasForm.children).map(function (fila) {
      return {
        item: fila.querySelector(".l-item").value.trim(),
        persona: fila.querySelector(".l-persona").value.trim(),
        importe: aCentimos(fila.querySelector(".l-importe").value),
        tipo: fila.querySelector(".l-tipo").value,
        saldado: false
      };
    });
  }
  function recalcularTotalForm() {
    const total = leerLineasForm().reduce(function (s, l) { return s + l.importe; }, 0);
    totalForm.textContent = "Total: " + eur(total);
  }
  function reiniciarForm() {
    gConcepto.value = ""; gFecha.value = hoyTexto(); gCategoria.value = "Comida";
    document.getElementById("g-total-repartir").value = "";
    lineasForm.innerHTML = "";
    nuevaLineaForm({ item: "Mi parte", tipo: "mio" });
    recalcularTotalForm();
    gError.hidden = true;
  }
  document.getElementById("add-linea").addEventListener("click", function () { nuevaLineaForm({ tipo: "me-debe" }); });

  // Reparte un total entre todas las líneas; la última se queda los céntimos sobrantes
  document.getElementById("repartir").addEventListener("click", function () {
    const total = aCentimos(document.getElementById("g-total-repartir").value);
    const filas = Array.from(lineasForm.children);
    if (total <= 0 || filas.length === 0) return;
    const parte = Math.floor(total / filas.length);
    filas.forEach(function (fila, i) {
      const c = i === filas.length - 1 ? total - parte * (filas.length - 1) : parte;
      fila.querySelector(".l-importe").value = (c / 100).toFixed(2).replace(".", ",");
    });
    recalcularTotalForm();
  });

  document.getElementById("form-gasto").addEventListener("submit", function (ev) {
    ev.preventDefault();
    const lineas = leerLineasForm().filter(function (l) { return l.importe > 0; });
    let problema = "";
    if (!gConcepto.value.trim()) problema = "Escribe un concepto para el gasto.";
    else if (lineas.length === 0) problema = "Pon el importe de al menos una línea.";
    else if (lineas.some(function (l) { return l.tipo !== "mio" && !l.persona; })) problema = "Las líneas «Me debe» y «Le debo» necesitan el nombre de la persona.";
    if (problema) { gError.textContent = problema; gError.hidden = false; return; }
    const nuevo = {
      concepto: gConcepto.value.trim(),
      fecha: gFecha.value || hoyTexto(),
      categoria: gCategoria.value,
      lineas: lineas.map(function (l) { return Object.assign({}, l, { item: l.item || (l.persona || "Mi parte") }); })
    };
    if (ultimoTicket) { nuevo.ticket = ultimoTicket; ultimoTicket = null; }
    escribir(function () { return sb.from("gastos").insert(nuevo); });
    reiniciarForm();
    document.getElementById("caja-nuevo").open = false;
    estadoEscaneo("Haz una foto o elige una imagen del ticket y rellenamos el gasto. Se lee en tu móvil: la imagen no se sube a ningún sitio.", "ayuda");
  });

  // --- Escanear un ticket: rellena el formulario con lo leído ---
  const gEscaneo = document.getElementById("g-escaneo");
  function estadoEscaneo(texto, clase) { gEscaneo.textContent = texto; gEscaneo.className = clase || "ayuda"; }
  let ultimoTicket = null;   // datos del ticket leído, se guardan con el gasto
  function aplicarTicket(t) {
    document.getElementById("caja-nuevo").open = true;
    ultimoTicket = null;
    if (!t || (!t.total && !t.items.length)) { estadoEscaneo("No he encontrado importes en la foto. Prueba con más luz y el ticket recto y entero.", "error"); return false; }
    if (t.comercio) gConcepto.value = t.comercio;
    if (t.fecha) gFecha.value = t.fecha;
    if (t.categoria && CATEGORIAS.indexOf(t.categoria) !== -1) gCategoria.value = t.categoria;
    lineasForm.innerHTML = "";
    if (t.items.length) t.items.forEach(function (it) { nuevaLineaForm({ item: it.nombre, tipo: "mio", importe: it.importe }); });
    else nuevaLineaForm({ item: "Mi parte", tipo: "mio", importe: t.total });
    document.getElementById("g-total-repartir").value = (t.total / 100).toFixed(2).replace(".", ",");
    recalcularTotalForm();
    ultimoTicket = { comercio: t.comercio || "", numero: t.numero || "", nif: t.nif || "", fecha: t.fecha || "", total: t.total, productos: t.items.length };
    if (!t.items.length || t.cuadra) {
      estadoEscaneo("✓ Leído: " + (t.items.length ? t.items.length + " productos · " : "") + "total " + eur(t.total) + ". Revisa y, si algo lo pagaste por otra persona, cambia «Mío» por «Me debe».", "mensaje ok");
    } else {
      estadoEscaneo("Ojo: Los productos suman " + eur(t.sumaItems) + " y el total del ticket es " + eur(t.total) + ". Revisa los importes antes de guardar.", "mensaje mal");
    }
    return true;
  }
  window.aplicarTicket = aplicarTicket;
  document.getElementById("g-foto").addEventListener("change", async function () {
    const archivo = this.files && this.files[0]; this.value = "";
    if (!archivo) return;
    if (!window.Ticket) { estadoEscaneo("El lector de tickets no está disponible.", "error"); return; }
    document.getElementById("caja-nuevo").open = true;
    estadoEscaneo("Preparando el lector (solo tarda la primera vez)…", "ayuda");
    try {
      const texto = await Ticket.leerImagen(archivo, function (p) { estadoEscaneo("Leyendo el ticket… " + p + " %", "ayuda"); });
      aplicarTicket(Ticket.parsear(texto));
    } catch (e) {
      estadoEscaneo((e && e.message) || "No se pudo leer el ticket.", "error");
    }
  });

  // --- Cambiar una línea dentro de un gasto (p. ej. marcarla saldada) ---
  function cambiarLineas(gasto, nuevasLineas) {
    return escribir(function () { return sb.from("gastos").update({ lineas: nuevasLineas }).eq("id", gasto.id); });
  }

  // Saldar todas las cuentas pendientes con una persona (un gasto cada vez)
  async function saldarPersona(clave) {
    for (const g of gastos) {
      const ls = lineasDe(g);
      if (!ls.some(function (l) { return !l.saldado && l.tipo !== "mio" && clavePersona(l.persona) === clave; })) continue;
      await cambiarLineas(g, ls.map(function (l) {
        return (l.tipo !== "mio" && clavePersona(l.persona) === clave) ? Object.assign({}, l, { saldado: true }) : l;
      }));
    }
  }
  function clavePersona(nombre) { return String(nombre || "").trim().toLowerCase(); }

  // --- Pintar el panel de gastos ---
  function nombreMes(clave) {
    const [a, m] = clave.split("-").map(Number);
    const t = new Date(a, m - 1, 1).toLocaleDateString("es-ES", { month: "long", year: "numeric" });
    return t.charAt(0).toUpperCase() + t.slice(1);
  }
  function rellenarMeses() {
    const actual = gMes.value || hoyTexto().slice(0, 7);
    const meses = new Set([hoyTexto().slice(0, 7)]);
    gastos.forEach(function (g) { if (g.fecha) meses.add(g.fecha.slice(0, 7)); });
    gMes.innerHTML = "";
    Array.from(meses).sort().reverse().forEach(function (m) {
      const o = document.createElement("option"); o.value = m; o.textContent = nombreMes(m); gMes.appendChild(o);
    });
    const todos = document.createElement("option"); todos.value = "todos"; todos.textContent = "Todos los meses"; gMes.appendChild(todos);
    gMes.value = actual;
    if (!gMes.value) gMes.value = hoyTexto().slice(0, 7);
  }
  gMes.addEventListener("change", pintarGastos);

  function pintarGastos() {
    rellenarMeses();
    const mes = gMes.value;
    const delPeriodo = gastos
      .filter(function (g) { return mes === "todos" || (g.fecha || "").slice(0, 7) === mes; })
      .sort(function (a, b) { return (b.fecha || "").localeCompare(a.fecha || "") || String(b.creado || "").localeCompare(String(a.creado || "")); });

    // Cifras: mi gasto del periodo; deudas pendientes de siempre
    let miGasto = 0, meDeben = 0, debo = 0;
    delPeriodo.forEach(function (g) { miGasto += miParte(g); });
    const porPersona = {};
    gastos.forEach(function (g) {
      lineasDe(g).forEach(function (l) {
        if (l.tipo === "mio" || l.saldado) return;
        const k = clavePersona(l.persona);
        if (!porPersona[k]) porPersona[k] = { nombre: l.persona, neto: 0, n: 0 };
        porPersona[k].neto += l.tipo === "me-debe" ? l.importe : -l.importe;
        porPersona[k].n++;
        if (l.tipo === "me-debe") meDeben += l.importe; else debo += l.importe;
      });
    });
    document.getElementById("c-gasto").textContent = eur(miGasto);
    document.getElementById("c-medeben").textContent = eur(meDeben);
    document.getElementById("c-debo").textContent = eur(debo);
    pintarMes30(mes, miGasto, meDeben, debo, delPeriodo);

    // Saldos por persona
    const saldos = document.getElementById("saldos");
    saldos.innerHTML = "";
    const claves = Object.keys(porPersona).sort(function (a, b) { return Math.abs(porPersona[b].neto) - Math.abs(porPersona[a].neto); });
    if (claves.length === 0) {
      const p = document.createElement("p"); p.className = "vacio"; p.textContent = "Nadie te debe nada y no debes nada a nadie.";
      saldos.appendChild(p);
    }
    claves.forEach(function (k) {
      const s = porPersona[k];
      const fila = document.createElement("div");
      fila.className = "saldo " + (s.neto >= 0 ? "me-debe" : "le-debo");
      const nombre = document.createElement("div"); nombre.className = "nombre";
      nombre.textContent = s.nombre;
      const det = document.createElement("small");
      det.textContent = (s.neto >= 0 ? "Te debe" : "Le debes") + " · " + s.n + " línea" + (s.n === 1 ? "" : "s") + " pendiente" + (s.n === 1 ? "" : "s");
      nombre.appendChild(det);
      const imp = document.createElement("span"); imp.className = "importe"; imp.textContent = eur(Math.abs(s.neto));
      const btn = document.createElement("button"); btn.type = "button"; btn.className = "boton-sec"; btn.textContent = "Saldar";
      btn.addEventListener("click", function () { btn.disabled = true; saldarPersona(k); });
      fila.append(nombre, imp, btn);
      saldos.appendChild(fila);
    });

    // Lista de nombres para autocompletar
    const dl = document.getElementById("personas"); dl.innerHTML = "";
    const nombres = new Set();
    gastos.forEach(function (g) { lineasDe(g).forEach(function (l) { if (l.persona) nombres.add(l.persona); }); });
    nombres.forEach(function (n) { const o = document.createElement("option"); o.value = n; dl.appendChild(o); });

    // Barras por categoría (mi gasto del periodo)
    const barras = document.getElementById("barras"); barras.innerHTML = "";
    const porCat = {};
    delPeriodo.forEach(function (g) { porCat[g.categoria || "Otros"] = (porCat[g.categoria || "Otros"] || 0) + miParte(g); });
    const cats = Object.keys(porCat).filter(function (c) { return porCat[c] > 0; }).sort(function (a, b) { return porCat[b] - porCat[a]; });
    const max = cats.length ? porCat[cats[0]] : 0;
    if (cats.length === 0) {
      const p = document.createElement("p"); p.className = "ayuda"; p.style.margin = "0"; p.textContent = "Sin gastos propios en este periodo.";
      barras.appendChild(p);
    }
    cats.forEach(function (c) {
      const fila = document.createElement("div"); fila.className = "barra";
      const n = document.createElement("span"); n.textContent = c;
      const pista = document.createElement("div"); pista.className = "pista";
      const rel = document.createElement("div"); rel.className = "relleno"; rel.style.width = Math.max(2, porCat[c] / max * 100) + "%";
      pista.appendChild(rel);
      const q = document.createElement("span"); q.className = "cuanto"; q.textContent = eur(porCat[c]);
      fila.append(n, pista, q);
      barras.appendChild(fila);
    });

    // Movimientos
    listaGastos.innerHTML = "";
    delPeriodo.forEach(function (g) {
      const li = document.createElement("li"); li.className = "gasto";
      const cab = document.createElement("div"); cab.className = "g-cab";
      const cuerpo = document.createElement("div"); cuerpo.className = "cuerpo";
      const t = document.createElement("strong"); t.textContent = g.concepto;
      const meta = document.createElement("span"); meta.className = "g-meta";
      meta.textContent = g.fecha ? new Date(g.fecha + "T12:00").toLocaleDateString("es-ES", { day: "numeric", month: "short", year: "numeric" }) : "";
      const chip = document.createElement("span"); chip.className = "chip-cat"; chip.textContent = g.categoria || "Otros";
      meta.appendChild(chip);
      cuerpo.append(t, meta);
      const total = document.createElement("span"); total.className = "g-total"; total.textContent = eur(totalDe(g));
      // Borrar en dos pasos: el primer clic pide confirmación
      const borrar = document.createElement("button"); borrar.type = "button"; borrar.className = "g-borrar"; borrar.textContent = "×";
      borrar.setAttribute("aria-label", "Borrar gasto");
      borrar.addEventListener("click", function () {
        if (borrar.classList.contains("confirmar")) {
          escribir(function () { return sb.from("gastos").delete().eq("id", g.id); });
        } else {
          borrar.classList.add("confirmar"); borrar.textContent = "¿Borrar?";
          setTimeout(function () { borrar.classList.remove("confirmar"); borrar.textContent = "×"; }, 3000);
        }
      });
      cab.append(cuerpo, total, borrar);
      li.appendChild(cab);

      const ls = document.createElement("div"); ls.className = "g-lineas";
      lineasDe(g).forEach(function (l, i) {
        const fila = document.createElement("div"); fila.className = "g-linea";
        const quien = document.createElement("span"); quien.className = "quien";
        quien.textContent = l.item || "";
        if (l.persona && l.persona !== l.item) { const sm = document.createElement("small"); sm.textContent = " · " + l.persona; quien.appendChild(sm); }
        const est = document.createElement("button"); est.type = "button";
        est.className = "estado-linea " + l.tipo + (l.saldado ? " saldado" : "");
        est.textContent = l.tipo === "mio" ? "Mío" : (l.saldado ? "Saldado" : TIPOS[l.tipo]);
        if (l.tipo === "mio") { est.disabled = true; }
        else {
          est.title = l.saldado ? "Marcar como pendiente" : "Marcar como saldado";
          est.addEventListener("click", function () {
            const nuevas = lineasDe(g).map(function (x, j) { return j === i ? Object.assign({}, x, { saldado: !x.saldado }) : x; });
            cambiarLineas(g, nuevas);
          });
        }
        const imp = document.createElement("span"); imp.className = "imp"; imp.textContent = eur(l.importe || 0);
        fila.append(quien, est, imp);
        ls.appendChild(fila);
      });
      if (g.ticket && typeof g.ticket === "object") {
        // Gasto de ticket: el detalle va plegado para no llenar la lista
        const det = document.createElement("details"); det.className = "g-ticket";
        const sum = document.createElement("summary");
        sum.textContent = "Ticket" + (g.ticket.numero ? " nº " + g.ticket.numero : "") + " · " + lineasDe(g).length + " línea" + (lineasDe(g).length === 1 ? "" : "s");
        det.appendChild(sum);
        const datos = document.createElement("p"); datos.className = "ayuda g-ticket-datos";
        datos.textContent = [g.ticket.comercio, g.ticket.nif ? "NIF " + g.ticket.nif : "", g.ticket.fecha ? new Date(g.ticket.fecha + "T12:00").toLocaleDateString("es-ES") : "", g.ticket.total ? "Total del ticket " + eur(g.ticket.total) : ""].filter(Boolean).join(" · ");
        const compartir = document.createElement("button"); compartir.type = "button"; compartir.className = "boton-sec"; compartir.textContent = "Compartir ticket";
        compartir.addEventListener("click", function () {
          const txt = "*" + (g.ticket.comercio || g.concepto) + "*" + (g.fecha ? " · " + new Date(g.fecha + "T12:00").toLocaleDateString("es-ES") : "") +
            (g.ticket.numero ? "\nTicket nº " + g.ticket.numero : "") + "\n\n" +
            lineasDe(g).map(function (l) { return "• " + (l.item || "") + (l.persona && l.tipo !== "mio" ? " (" + l.persona + ")" : "") + ": " + eur(l.importe || 0); }).join("\n") +
            "\n\n*Total " + eur(totalDe(g)) + "*\n_Saldamos_";
          if (navigator.share) navigator.share({ text: txt }).catch(function () {});
          else window.open("https://wa.me/?text=" + encodeURIComponent(txt), "_blank", "noopener");
        });
        det.append(datos, ls, compartir);
        li.appendChild(det);
      } else {
        li.appendChild(ls);
      }
      listaGastos.appendChild(li);
    });
    vacioGastos.hidden = delPeriodo.length > 0;
  }

  // --- «Tu mes en 30 segundos»: cifra, evolución, categorías y un consejo, de un vistazo ---
  // Color por categoría (sigue a la categoría, nunca al puesto en el ranking)
  const COLOR_CAT = { "Hogar": "var(--cat-1)", "Comida": "var(--cat-2)", "Transporte": "var(--cat-3)", "Trabajo": "var(--cat-4)", "Ocio": "var(--cat-5)", "Salud": "var(--cat-6)", "Otros": "var(--cat-otros)" };
  function claveMes(a, m) { const d = new Date(a, m, 1); return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0"); }
  function mesCorto(clave) { const [a, m] = clave.split("-").map(Number); return new Date(a, m - 1, 1).toLocaleDateString("es-ES", { month: "short" }).replace(".", ""); }
  function mk(tag, clase, texto) { const e = document.createElement(tag); if (clase) e.className = clase; if (texto != null) e.textContent = texto; return e; }

  function pintarMes30(mes, miGasto, meDeben, debo, delPeriodo) {
    const caja = document.getElementById("mes-30");
    if (mes === "todos" || !delPeriodo.length) { caja.hidden = true; return; }
    const [a, m] = mes.split("-").map(Number);
    // Serie de los últimos 6 meses (mi parte)
    const serie = [];
    for (let i = 5; i >= 0; i--) {
      const k = claveMes(a, m - 1 - i);
      serie.push({ clave: k, total: gastos.filter(function (g) { return (g.fecha || "").slice(0, 7) === k; }).reduce(function (s, g) { return s + miParte(g); }, 0) });
    }
    const gastoPrev = serie[4].total;
    const porCat = {};
    delPeriodo.forEach(function (g) { porCat[g.categoria || "Otros"] = (porCat[g.categoria || "Otros"] || 0) + miParte(g); });
    const cats = Object.keys(porCat).filter(function (c) { return porCat[c] > 0; }).sort(function (x, y) { return porCat[y] - porCat[x]; });
    const top = cats[0];
    const mayor = delPeriodo.slice().sort(function (x, y) { return miParte(y) - miParte(x); })[0];
    const delta = gastoPrev ? Math.round((miGasto - gastoPrev) * 100 / gastoPrev) : null;

    // Un único consejo, el más útil según los datos
    let consejo;
    if (meDeben >= 2000) consejo = "Recupera lo que te deben antes de fin de mes: un recordatorio por WhatsApp suele bastar.";
    else if (gastoPrev && miGasto > gastoPrev * 1.15) consejo = "Este mes subió. Mira «" + top + "»: un pequeño tope semanal ahí marca la diferencia.";
    else if (gastoPrev && miGasto < gastoPrev) consejo = "Gastaste menos que el mes anterior: aparta la diferencia (" + eur(gastoPrev - miGasto) + ") a tu ahorro.";
    else consejo = "Anota los gastos el mismo día: con datos completos el resumen acierta más.";

    caja.innerHTML = "";
    const tip = mk("div", "m30-tip"); tip.hidden = true; tip.setAttribute("role", "status");
    function conTip(elem, texto) {
      elem.tabIndex = 0; elem.setAttribute("aria-label", texto);
      const ver = function () {
        tip.textContent = texto; tip.hidden = false;
        const r = elem.getBoundingClientRect(), c = caja.getBoundingClientRect();
        tip.style.left = Math.max(4, Math.min(c.width - tip.offsetWidth - 4, r.left - c.left + r.width / 2 - tip.offsetWidth / 2)) + "px";
        tip.style.top = (r.top - c.top - tip.offsetHeight - 6) + "px";
      };
      const ocultar = function () { tip.hidden = true; };
      elem.addEventListener("mouseenter", ver); elem.addEventListener("focus", ver); elem.addEventListener("click", ver);
      elem.addEventListener("mouseleave", ocultar); elem.addEventListener("blur", ocultar);
    }

    // Cabecera: título + cifra grande + variación
    const cab = mk("div", "m30-cab");
    cab.append(mk("span", "m30-titulo", "⏱ Tu mes en 30 segundos"), mk("span", "m30-mes", nombreMes(mes)));
    const heroe = mk("div", "m30-heroe");
    heroe.append(mk("b", "m30-cifra", eur(miGasto)));
    if (delta !== null) {
      const sube = delta > 0;
      const chip = mk("span", "m30-delta " + (sube ? "sube" : "baja"), (sube ? "▲ " : "▼ ") + Math.abs(delta) + " % " + (sube ? "más" : "menos") + " que en " + mesCorto(serie[4].clave));
      heroe.appendChild(chip);
    }
    heroe.appendChild(mk("span", "m30-sub", "gastado este mes (tu parte)"));

    // Gráfico 1: últimos 6 meses (una serie; el mes actual resaltado)
    const g1 = mk("div", "m30-bloque");
    g1.appendChild(mk("p", "m30-eti", "Últimos 6 meses"));
    const barras = mk("div", "m30-barras");
    const max = Math.max.apply(null, serie.map(function (x) { return x.total; })) || 1;
    serie.forEach(function (x, i) {
      const col = mk("div", "m30-col" + (i === 5 ? " actual" : ""));
      const zona = mk("div", "m30-zona");
      if (i === 5 || x.total === max) zona.appendChild(mk("span", "m30-valor", eur(x.total).replace(/,\d\d\s?€$/, " €")));
      const barra = mk("div", "m30-barra"); barra.style.height = Math.max(x.total ? 4 : 0, Math.round(x.total * 100 / max)) + "%";
      zona.appendChild(barra);
      col.append(zona, mk("span", "m30-x", mesCorto(x.clave)));
      conTip(col, nombreMes(x.clave) + ": " + eur(x.total));
      barras.appendChild(col);
    });
    g1.appendChild(barras);

    // Gráfico 2: en qué se fue (barra apilada + leyenda con importes)
    const g2 = mk("div", "m30-bloque");
    g2.appendChild(mk("p", "m30-eti", "En qué se fue"));
    const pila = mk("div", "m30-pila");
    const ley = mk("ul", "m30-leyenda");
    cats.forEach(function (c) {
      const pct = Math.round(porCat[c] * 100 / (miGasto || 1));
      const seg = mk("span", "m30-seg"); seg.style.flexGrow = porCat[c]; seg.style.background = COLOR_CAT[c] || "var(--cat-otros)";
      conTip(seg, c + ": " + eur(porCat[c]) + " (" + pct + " %)");
      pila.appendChild(seg);
      const li = mk("li");
      const mu = mk("span", "m30-muestra"); mu.style.background = COLOR_CAT[c] || "var(--cat-otros)";
      li.append(mu, mk("span", "m30-cat", c), mk("span", "m30-imp", eur(porCat[c])), mk("span", "m30-pct", pct + " %"));
      ley.appendChild(li);
    });
    g2.append(pila, ley);

    const graficos = mk("div", "m30-graficos"); graficos.append(g1, g2);

    // Fichas: mayor gasto, te deben, debes
    const fichas = mk("div", "m30-fichas");
    function ficha(eti, valor, extra, clase) {
      const f = mk("div", "m30-ficha" + (clase ? " " + clase : ""));
      f.append(mk("small", null, eti), mk("b", null, valor)); if (extra) f.appendChild(mk("span", null, extra));
      fichas.appendChild(f);
    }
    if (mayor && miParte(mayor)) ficha("Mayor gasto", eur(miParte(mayor)), mayor.concepto);
    ficha("Te deben", eur(meDeben), meDeben ? "pendiente de cobrar" : "nada pendiente", "positivo");
    ficha("Debes", eur(debo), debo ? "pendiente de pagar" : "estás al día", "negativo");

    // Consejo + enviar
    const pie = mk("div", "m30-consejo");
    pie.append(mk("p", null, consejo));
    const frases = ["Gastaste " + eur(miGasto) + (delta !== null ? " (" + (delta > 0 ? "+" : "−") + Math.abs(delta) + " % que el mes anterior)" : "") + "."];
    if (top) frases.push("Donde más: " + top + ", " + Math.round(porCat[top] * 100 / (miGasto || 1)) + " % del total.");
    if (mayor && miParte(mayor)) frases.push("Tu mayor gasto: " + mayor.concepto + " (" + eur(miParte(mayor)) + ").");
    if (meDeben) frases.push("Te deben " + eur(meDeben) + " todavía.");
    const wa = mk("a", "boton-sec", "Mandármelo por WhatsApp"); wa.target = "_blank"; wa.rel = "noopener";
    wa.href = "https://wa.me/?text=" + encodeURIComponent("*" + nombreMes(mes) + " en 30 segundos*\n\n" + frases.map(function (f) { return "• " + f; }).join("\n") + "\n\nConsejo: " + consejo + "\n\n_Saldamos_");

    caja.append(cab, heroe, graficos, fichas, pie, wa, tip);
    caja.hidden = false;
  }

  reiniciarForm();
  pintarGastos();
