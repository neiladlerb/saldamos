// =====================================================================
//  ESCANEAR UN TICKET
//  Lee la foto del ticket en el propio móvil (OCR con Tesseract.js) y
//  rellena el gasto: comercio, fecha, categoría, productos y total.
//  La foto NO se sube a ningún servidor: se lee en el navegador.
//  El motor de OCR (unos 5 MB) solo se descarga la primera vez que se usa.
// =====================================================================
(function (global) {
  // Dónde está el motor de OCR: en nuestros propios archivos (vendor/ocr),
  // así no dependemos de una CDN externa. Se puede cambiar con window.TICKET_RUTAS.
  const base = function (ruta) { return new URL(ruta, location.href).href; };
  const RUTAS = Object.assign({
    script: "vendor/ocr/tesseract.min.js",
    workerPath: base("vendor/ocr/worker.min.js"),
    corePath: base("vendor/ocr/"),
    langScript: "vendor/ocr/spa-datos.js",
    langPath: null
  }, global.TICKET_RUTAS || {});

  // ---------------- Lectura del texto (sin pantalla: se puede probar aparte) ----------------
  const RE_IMPORTE = /(-?\d{1,4}(?:[.,]\d{3})*[.,]\d{2})\s*(?:€|eur|euros?|e)?\s*[a-z]?\s*$/i;
  const RE_FECHA = /\b(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})\b/;
  const NO_PRODUCTO = /\b(sub)?total\b|\biva\b|\bbase\b|imponible|cambio|efectivo|entregad|tarjeta|visa|mastercard|contactless|devoluci|cuota|n\.?i\.?f|c\.?i\.?f|tel[eé]?f?|factura|ticket|fecha|hora|caja|cajer|operaci|autoriz|pendiente|redondeo|descuento total|a pagar|importe/i;
  const RE_TOTAL = /\b(total(\s+(compra|a pagar|eur|euros))?|importe\s+total|a\s+pagar|total\s+factura)\b/i;
  const CATEGORIAS_TICKET = [
    ["Hogar", /supermercado|mercadona|carrefour|\blidl\b|\bdia\b|alcampo|eroski|\baldi\b|consum|hipercor|el corte ingl|ahorram|bonpreu|gadis|froiz|spar|ikea|leroy|bricomart/i],
    ["Comida", /restaurante|\bbar\b|caf[eé]|cafeter|taberna|pizzer|burger|mcdonald|telepizza|sushi|tapas|bodega|asador|cervecer/i],
    ["Transporte", /repsol|cepsa|\bbp\b|galp|shell|gasolin|carburante|parking|aparcamiento|renfe|\bemt\b|metro|taxi|cabify|uber/i],
    ["Salud", /farmacia|parafarm|cl[ií]nica|dental|[oó]ptica|opticalia/i],
    ["Ocio", /cine|teatro|museo|concierto|entradas|fnac|decathlon|libreri/i]
  ];

  function aCent(txt) {
    let t = String(txt).replace(/\s/g, "");
    if (/,\d{2}$/.test(t)) t = t.replace(/\./g, "").replace(",", ".");
    else if (/\.\d{2}$/.test(t)) t = t.replace(/,/g, "");
    const n = parseFloat(t);
    return isFinite(n) ? Math.round(n * 100) : 0;
  }
  function capitalizar(s) { return s.toLowerCase().replace(/(^|\s)\S/g, function (c) { return c.toUpperCase(); }).replace(/\b(De|Del|La|El|Y|En)\b/g, function (w) { return w.toLowerCase(); }).replace(/^./, function (c) { return c.toUpperCase(); }); }

  function parsear(texto) {
    const lineas = String(texto || "").split(/\r?\n/).map(function (l) { return l.replace(/\s+/g, " ").trim(); }).filter(Boolean);
    const r = { comercio: "", fecha: "", numero: "", nif: "", total: 0, items: [], categoria: "Otros", sumaItems: 0, cuadra: false };
    // Número de ticket o factura y NIF/CIF del comercio
    lineas.forEach(function (l) {
      if (!r.numero) {
        const m = l.match(/(?:factura(?:\s+simplificada)?|ticket|tiquet|n[º°o]\.?\s*(?:de\s+)?(?:ticket|factura|operaci[oó]n)?|num(?:ero)?\.?)\s*[:#nº°.]*\s*([A-Z0-9][A-Z0-9\/-]{2,24})/i);
        if (m && /\d/.test(m[1])) r.numero = m[1];
      }
      if (!r.nif) { const n = l.match(/\b(?:n\.?i\.?f|c\.?i\.?f)\.?\s*:?\s*([A-Z]?-?\d{7,8}-?[A-Z0-9]?)\b/i); if (n) r.nif = n[1].replace(/-/g, "").toUpperCase(); }
    });

    // Comercio: primera línea con letras de verdad (no dirección, NIF, etc.)
    const cab = lineas.slice(0, 6).find(function (l) {
      return (l.match(/[a-záéíóúñ]/gi) || []).length >= 3 && !/\d{3,}/.test(l) && !/^(c\/|calle|avda|av\.|plaza|tel|nif|cif|www|http)/i.test(l) && !NO_PRODUCTO.test(l);
    });
    if (cab) r.comercio = capitalizar(cab.replace(/[^\wáéíóúñü&' .-]/gi, "").trim()).slice(0, 60);

    // Fecha
    for (let i = 0; i < lineas.length; i++) {
      const m = lineas[i].match(RE_FECHA);
      if (m) {
        let a = +m[3]; if (a < 100) a += 2000;
        const d = +m[1], me = +m[2];
        if (d >= 1 && d <= 31 && me >= 1 && me <= 12 && a >= 2000 && a <= 2100) { r.fecha = a + "-" + String(me).padStart(2, "0") + "-" + String(d).padStart(2, "0"); break; }
      }
    }

    // Total: la última línea «TOTAL …» con importe (sin contar subtotal)
    let idxTotal = -1;
    lineas.forEach(function (l, i) {
      if (RE_TOTAL.test(l) && !/sub\s*total/i.test(l)) {
        const m = l.match(RE_IMPORTE); if (m) { r.total = aCent(m[1]); if (idxTotal === -1) idxTotal = i; }
      }
    });

    // Productos: líneas con texto + importe al final, antes del total
    const hasta = idxTotal === -1 ? lineas.length : idxTotal;
    for (let i = 0; i < hasta; i++) {
      const l = lineas[i];
      const m = l.match(RE_IMPORTE);
      if (!m) continue;
      let nombre = l.slice(0, l.length - m[0].length).trim();
      if (NO_PRODUCTO.test(nombre) || RE_FECHA.test(l)) continue;
      nombre = nombre.replace(/\s+\d+(?:[.,]\d+)?\s*(?:€|eur)?\s*$/i, "")    // precio unitario suelto
                     .replace(/[^\wáéíóúñü%&' ,.\/-]/gi, "").trim();
      let cantidad = 1;
      const mq = nombre.match(/^(\d{1,2})\s*(?:x|uds?\.?|u)?\s+(?=[a-záéíóúñ])/i);   // «2 x yogur», «2 cañas»
      if (mq) { cantidad = +mq[1]; nombre = nombre.slice(mq[0].length); }
      nombre = nombre.replace(/[^\wáéíóúñü%&' ,.\/-]/gi, "").trim();
      if ((nombre.match(/[a-záéíóúñ]/gi) || []).length < 2) continue;
      const imp = aCent(m[1]);
      if (imp <= 0) continue;
      r.items.push({ nombre: (capitalizar(nombre) + (cantidad > 1 ? " ×" + cantidad : "")).slice(0, 50), importe: imp });
    }
    r.sumaItems = r.items.reduce(function (s, x) { return s + x.importe; }, 0);
    if (!r.total) r.total = r.sumaItems;
    r.cuadra = r.total > 0 && Math.abs(r.sumaItems - r.total) <= 2;
    const cat = CATEGORIAS_TICKET.find(function (c) { return c[1].test(r.comercio) || c[1].test(lineas.slice(0, 4).join(" ")); });
    if (cat) r.categoria = cat[0];
    return r;
  }

  // ---------------- OCR ----------------
  let cargando = null;
  function cargarMotor() {
    if (global.Tesseract) return Promise.resolve(global.Tesseract);
    if (cargando) return cargando;
    cargando = new Promise(function (ok, ko) {
      const s = document.createElement("script"); s.src = RUTAS.script; s.async = true;
      s.onload = function () { global.Tesseract ? ok(global.Tesseract) : ko(new Error("motor no disponible")); };
      s.onerror = function () { cargando = null; ko(new Error("No se pudo descargar el lector de tickets. ¿Tienes conexión?")); };
      document.head.appendChild(s);
    });
    return cargando;
  }

  // Reduce la foto (los móviles hacen fotos enormes) y la pasa a gris para leer mejor
  function prepararImagen(archivo) {
    return new Promise(function (ok, ko) {
      const url = URL.createObjectURL(archivo);
      const img = new Image();
      img.onload = function () {
        const max = 1800, esc = Math.min(1, max / Math.max(img.width, img.height));
        const c = document.createElement("canvas"); c.width = Math.round(img.width * esc); c.height = Math.round(img.height * esc);
        const x = c.getContext("2d"); x.filter = "grayscale(1) contrast(1.25)"; x.drawImage(img, 0, 0, c.width, c.height);
        URL.revokeObjectURL(url); ok(c);
      };
      img.onerror = function () { URL.revokeObjectURL(url); ko(new Error("No se pudo abrir la imagen.")); };
      img.src = url;
    });
  }

  // Datos del idioma servidos como script (para alojamientos que no sirven .gz)
  function cargarIdioma() {
    if (!RUTAS.langScript) return Promise.resolve("spa");
    if (global.TICKET_SPA_B64) return Promise.resolve(decodificar());
    return new Promise(function (ok, ko) {
      const s = document.createElement("script"); s.src = RUTAS.langScript;
      s.onload = function () { ok(decodificar()); };
      s.onerror = function () { ko(new Error("No se pudo descargar el idioma del lector.")); };
      document.head.appendChild(s);
    });
    function decodificar() {
      const b = atob(global.TICKET_SPA_B64); const u = new Uint8Array(b.length);
      for (let i = 0; i < b.length; i++) u[i] = b.charCodeAt(i);
      return [{ code: "spa", data: u }];
    }
  }

  async function leerImagen(archivo, progreso) {
    const T = await cargarMotor();
    const idioma = await cargarIdioma();
    const opciones = { logger: function (m) { if (progreso && m.status === "recognizing text") progreso(Math.round(m.progress * 100)); } };
    ["workerPath", "corePath", "langPath"].forEach(function (k) { if (RUTAS[k]) opciones[k] = RUTAS[k]; });
    if (RUTAS.workerBlobURL === false) opciones.workerBlobURL = false;
    const imagen = await prepararImagen(archivo);
    const w = await T.createWorker(idioma, 1, opciones);
    try { const r = await w.recognize(imagen); return r.data.text || ""; }
    finally { w.terminate(); }
  }

  global.Ticket = { parsear: parsear, leerImagen: leerImagen, cargarMotor: cargarMotor };
})(typeof window !== "undefined" ? window : globalThis);
