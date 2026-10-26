// Tareas con fechas y avisos (guardadas en Supabase)

  // --- Utilidades de fechas (igual que en la fase 2) --------------------
  function momentoAviso(tarea) {
    if (!tarea.fecha) return null;
    const [a, m, d] = tarea.fecha.split("-").map(Number);
    const [h, min] = (tarea.hora || "09:00").split(":").map(Number);
    return new Date(a, m - 1, d, h, min);
  }
  function diasHasta(tarea) {
    const [a, m, d] = tarea.fecha.split("-").map(Number);
    const hoy = new Date(); hoy.setHours(0, 0, 0, 0);
    return Math.round((new Date(a, m - 1, d) - hoy) / 86400000);
  }
  function estado(tarea) {
    if (tarea.hecha || !tarea.fecha) return "";
    const dias = diasHasta(tarea);
    if (dias < 0 || (tarea.hora && dias === 0 && momentoAviso(tarea) < new Date())) return "vencida";
    if (dias === 0) return "hoy";
    if (dias <= 3) return "pronto";
    return "";
  }
  function textoFecha(tarea) {
    const dias = diasHasta(tarea);
    let t;
    if (dias === 0) t = "Hoy";
    else if (dias === 1) t = "Mañana";
    else if (dias === -1) t = "Ayer";
    else if (dias > 1 && dias <= 6) t = "En " + dias + " días";
    else t = momentoAviso(tarea).toLocaleDateString("es-ES", { weekday: "short", day: "numeric", month: "short" });
    if (tarea.hora) t += " · " + tarea.hora;
    if (estado(tarea) === "vencida") t = "Vencida · " + t;
    return t;
  }

  // --- 1. Los datos -----------------------------------------------------
  // "tareas" ahora es solo una copia de lo que hay en la base de datos.
  let tareas = [];
  let conectado = false;         // true cuando ya hemos leído de Supabase
  const yaAvisadas = new Set();  // para no repetir un aviso en esta pantalla

  // --- 2. Referencias a las piezas del HTML -----------------------------
  const lista = document.getElementById("lista");
  const formulario = document.getElementById("formulario");
  const caja = document.getElementById("nueva-tarea");
  const campoFecha = document.getElementById("nueva-fecha");
  const campoHora = document.getElementById("nueva-hora");
  const resumen = document.getElementById("resumen");
  const vacio = document.getElementById("vacio");
  const alertas = document.getElementById("alertas");
  const avisos = document.getElementById("avisos");
  const sync = document.getElementById("sync");

  function ponerEstadoSync(texto, clase) {
    sync.textContent = texto;
    sync.className = "sync " + (clase || "");
  }

  function ordenar(a, b) {
    if (a.hecha !== b.hecha) return a.hecha ? 1 : -1;
    const ma = momentoAviso(a), mb = momentoAviso(b);
    if (ma && mb) return ma - mb;
    if (ma) return -1;
    if (mb) return 1;
    return String(a.creada || "").localeCompare(String(b.creada || ""));
  }

  // --- Escribir en la base de datos -------------------------------------
  // "operacion" es una petición a Supabase. Supabase no lanza errores:
  // devuelve { error }. Si todo va bien, volvemos a leer los datos.
  async function escribir(operacion) {
    if (!conectado) { ponerEstadoSync("Aún no hay conexión con el servidor", "error"); return; }
    try {
      const r = await operacion();
      if (r && r.error) throw r.error;
      ponerEstadoSync("Guardado · se ve igual en el móvil", "ok");
      await cargarTodo();
    } catch (e) {
      ponerEstadoSync("No se pudo guardar: " + traducirError(e), "error");
    }
  }

  // --- 3. Pintar la lista en pantalla -----------------------------------
  // --- Cerrar compromisos: «Hecho» por WhatsApp + conformidad ----------
  const abiertas = new Set();     // tareas con el panel «Hecho» abierto
  const borradores = {};          // lo que vas escribiendo en cada panel
  function enlaceTarea(t) { return enlaceCorto("c", t.token); }
  // Mensaje corto: qué está hecho, el resumen y un único llamado a confirmar
  function mensajeHecho(t, b) {
    return (b.para ? "Hola " + b.para.trim() + " 👋\n" : "") +
      "✅ *Hecho:* " + t.texto + "\n" +
      (b.resumen.trim() ? "\n" + b.resumen.trim() + "\n" : "") +
      "\n¿Me confirmas que está todo bien? 👇\n" + enlaceBonito(enlaceTarea(t));
  }
  // Vista previa con forma de burbuja de WhatsApp (negritas y cursivas incluidas)
  function pintarBurbuja(el, texto) {
    el.innerHTML = "";
    texto.split("\n").forEach(function (linea, i) {
      if (i) el.appendChild(document.createElement("br"));
      linea.split(/(\*[^*]+\*|_[^_]+_)/).forEach(function (trozo) {
        if (/^\*[^*]+\*$/.test(trozo)) { const b = document.createElement("b"); b.textContent = trozo.slice(1, -1); el.appendChild(b); }
        else if (/^_[^_]+_$/.test(trozo)) { const i2 = document.createElement("i"); i2.textContent = trozo.slice(1, -1); el.appendChild(i2); }
        else el.appendChild(document.createTextNode(trozo));
      });
    });
  }
  function waHecho(t, b) {
    return "https://wa.me/" + String(b.telefono || "").replace(/[^\d]/g, "") + "?text=" + encodeURIComponent(mensajeHecho(t, b));
  }
  function panelHecho(tarea) {
    const b = borradores[tarea.id] || (borradores[tarea.id] = { para: tarea.para || "", telefono: tarea.telefono || "", resumen: tarea.resumen || "" });
    const panel = document.createElement("div");
    panel.className = "panel-hecho";
    const titulo = document.createElement("p"); titulo.className = "eti-hecho"; titulo.textContent = "¿Era un compromiso con alguien? Cierra el tema";
    function campo(clave, tipo, ph, etiqueta) {
      const i = document.createElement(tipo === "area" ? "textarea" : "input");
      if (tipo !== "area") i.type = tipo; else i.rows = 3;
      i.id = "h-" + clave + "-" + tarea.id; i.placeholder = ph; i.value = b[clave]; i.setAttribute("aria-label", etiqueta);
      i.addEventListener("input", function () { b[clave] = i.value; wa.href = waHecho(tarea, b); pintarBurbuja(burbuja, mensajeHecho(tarea, b)); });
      return i;
    }
    const fila = document.createElement("div"); fila.className = "fila-hecho";
    fila.append(campo("para", "text", "¿Con quién? (ej. Laura)", "Con quién"), campo("telefono", "tel", "Su móvil (opcional)", "Móvil"));
    const resumenCampo = campo("resumen", "area", "Resumen de lo que hiciste (ej. Enviado el presupuesto con el desglose por partidas)", "Resumen");
    const wa = document.createElement("a");
    wa.className = "anadir boton-wa"; wa.target = "_blank"; wa.rel = "noopener"; wa.textContent = "Enviar «Hecho» por WhatsApp";
    wa.href = waHecho(tarea, b);
    wa.addEventListener("click", function () {
      abiertas.delete(tarea.id);
      tarea.cierre_enviado = new Date().toISOString(); tarea.conformidad = null;
      setTimeout(pintar, 0);   // muestra «esperando conformidad» al momento
      escribir(function () {
        return sb.from("tareas").update({ para: b.para.trim() || null, telefono: b.telefono.trim() || null, resumen: b.resumen.trim() || null,
          cierre_enviado: new Date().toISOString(), conformidad: null }).eq("id", tarea.id);
      });
    });
    const no = document.createElement("button"); no.type = "button"; no.className = "boton-sec"; no.textContent = "No hace falta";
    no.addEventListener("click", function () { abiertas.delete(tarea.id); pintar(); });
    const acciones = document.createElement("div"); acciones.className = "fila-hecho"; acciones.append(wa, no);
    const previa = document.createElement("div"); previa.className = "previa-wa";
    const etiqueta = document.createElement("span"); etiqueta.className = "eti-hecho"; etiqueta.textContent = "Así lo verá";
    const burbuja = document.createElement("div"); burbuja.className = "burbuja-wa";
    pintarBurbuja(burbuja, mensajeHecho(tarea, b));
    previa.append(etiqueta, burbuja);
    panel.append(titulo, fila, resumenCampo, previa, acciones);
    return panel;
  }
  function estadoCierre(tarea) {
    const p = document.createElement("div"); p.className = "estado-cierre";
    const c = tarea.conformidad;
    const quien = tarea.para || "la otra persona";
    if (c && c.estado === "conforme") {
      p.innerHTML = '<span class="chip-cierre ok"></span>';
      p.firstChild.textContent = "✔ " + quien + " está conforme" + (c.comentario ? ": «" + c.comentario + "»" : "");
    } else if (c && c.estado === "comentario") {
      p.innerHTML = '<span class="chip-cierre com"></span>';
      p.firstChild.textContent = quien + " comenta: «" + c.comentario + "»";
    } else if (tarea.cierre_enviado) {
      p.innerHTML = '<span class="chip-cierre esp"></span>';
      p.firstChild.textContent = "«Hecho» enviado a " + quien + " · esperando conformidad";
    }
    if (!abiertas.has(tarea.id)) {
      const b = document.createElement("button"); b.type = "button"; b.className = "enlace-boton";
      b.textContent = tarea.cierre_enviado ? "Volver a enviar" : "Enviar «Hecho» por WhatsApp";
      b.addEventListener("click", function () { abiertas.add(tarea.id); pintar(); });
      p.appendChild(b);
    }
    return p;
  }

  function pintar() {
    // Si estás escribiendo en un panel «Hecho», no repintamos (no perder lo escrito)
    const foco = document.activeElement;
    if (foco && /^(INPUT|TEXTAREA)$/.test(foco.tagName) && foco.closest(".panel-hecho")) return;
    lista.innerHTML = "";
    tareas.slice().sort(ordenar).forEach(function (tarea) {
      const li = document.createElement("li");
      const est = estado(tarea);
      if (est) li.classList.add(est);
      if (tarea.hecha) li.classList.add("hecha");

      const check = document.createElement("input");
      check.type = "checkbox";
      check.checked = !!tarea.hecha;
      check.setAttribute("aria-label", "Marcar como hecha");
      check.addEventListener("change", function () {
        // Al completarla se abre el panel para cerrar el compromiso
        if (check.checked) abiertas.add(tarea.id); else abiertas.delete(tarea.id);
        escribir(function () { return sb.from("tareas").update({ hecha: check.checked, completada: check.checked ? new Date().toISOString() : null }).eq("id", tarea.id); });
      });

      const cuerpo = document.createElement("div");
      cuerpo.className = "cuerpo";
      const texto = document.createElement("span");
      texto.className = "texto";
      texto.textContent = tarea.texto;
      cuerpo.appendChild(texto);
      if (tarea.fecha) {
        const fecha = document.createElement("span");
        fecha.className = "fecha";
        fecha.textContent = textoFecha(tarea);
        cuerpo.appendChild(fecha);
      }
      if (tarea.para && !tarea.hecha) {
        const con = document.createElement("span"); con.className = "fecha"; con.textContent = "Compromiso con " + tarea.para;
        cuerpo.appendChild(con);
      }
      if (tarea.hecha) {
        cuerpo.appendChild(estadoCierre(tarea));
        if (abiertas.has(tarea.id)) cuerpo.appendChild(panelHecho(tarea));
      }

      const borrar = document.createElement("button");
      borrar.className = "borrar";
      borrar.textContent = "×";
      borrar.setAttribute("aria-label", "Borrar tarea");
      borrar.addEventListener("click", function () {
        escribir(function () { return sb.from("tareas").delete().eq("id", tarea.id); });
      });

      li.append(check, cuerpo, borrar);
      lista.appendChild(li);
    });

    const pendientes = tareas.filter(function (t) { return !t.hecha; });
    const nVencidas = pendientes.filter(function (t) { return estado(t) === "vencida"; }).length;
    const nHoy = pendientes.filter(function (t) { return estado(t) === "hoy"; }).length;
    const nPronto = pendientes.filter(function (t) { return estado(t) === "pronto"; }).length;

    resumen.textContent = tareas.length === 0
      ? "Todo despejado."
      : pendientes.length + " pendiente" + (pendientes.length === 1 ? "" : "s") + " de " + tareas.length;

    alertas.innerHTML = "";
    [[nVencidas, "vencida", "vencida", "vencidas"], [nHoy, "hoy", "para hoy", "para hoy"], [nPronto, "pronto", "en los próximos 3 días", "en los próximos 3 días"]]
      .forEach(function (x) {
        if (x[0] === 0) return;
        const p = document.createElement("span");
        p.className = "pastilla " + x[1];
        p.textContent = x[0] + " " + (x[0] === 1 ? x[2] : x[3]);
        alertas.appendChild(p);
      });

    const urgentes = nVencidas + nHoy;
    document.title = (urgentes ? "(" + urgentes + ") " : "") + "Saldamos";
    vacio.hidden = tareas.length > 0;
  }

  // --- 4. Avisos programados --------------------------------------------
  function mostrarAviso(tarea) {
    const caja = document.createElement("div");
    caja.className = "aviso";
    caja.setAttribute("role", "status");
    const cuerpo = document.createElement("div");
    const titulo = document.createElement("strong");
    titulo.textContent = "Recordatorio" + (tarea.hora ? " · " + tarea.hora : "");
    const texto = document.createElement("p");
    texto.textContent = tarea.texto;
    cuerpo.append(titulo, texto);
    const cerrar = document.createElement("button");
    cerrar.textContent = "×";
    cerrar.setAttribute("aria-label", "Cerrar aviso");
    cerrar.addEventListener("click", function () { caja.remove(); });
    caja.append(cuerpo, cerrar);
    avisos.appendChild(caja);
  }

  // El "reloj": si una tarea llega a su hora, avisa y lo apunta en la base
  // de datos ("avisada: true") para que el móvil no vuelva a avisar.
  function revisarAvisos() {
    const ahora = new Date();
    tareas.forEach(function (tarea) {
      const momento = momentoAviso(tarea);
      if (momento && !tarea.hecha && !tarea.avisada && momento <= ahora && !yaAvisadas.has(tarea.id)) {
        yaAvisadas.add(tarea.id);
        mostrarAviso(tarea);
        escribir(function () { return sb.from("tareas").update({ avisada: true }).eq("id", tarea.id); });
      }
    });
    pintar();
  }
  setInterval(revisarAvisos, 20000);

  // --- 5. Añadir una tarea nueva ----------------------------------------
  formulario.addEventListener("submit", function (evento) {
    evento.preventDefault();
    const texto = caja.value.trim();
    if (texto === "") return;
    const conQuien = document.getElementById("nueva-para");
    const nueva = {
      texto: texto,
      para: conQuien && conQuien.value.trim() ? conQuien.value.trim() : null,
      fecha: campoFecha.value || null,          // en la base de datos, "vacío" es null
      hora: (campoFecha.value && campoHora.value) ? campoHora.value : null,
      hecha: false,
      avisada: false
    };
    caja.value = ""; campoFecha.value = ""; campoHora.value = "";
    if (conQuien) conQuien.value = "";
    escribir(function () { return sb.from("tareas").insert(nueva); });
  });

  // --- 6. Leer los datos de Supabase -----------------------------------
  // Pedimos tareas y gastos a la vez. Las reglas de la base de datos
  // (RLS) se encargan de devolver SOLO los del usuario conectado.
  async function cargarTodo() {
    const [rt, rg] = await Promise.all([
      sb.from("tareas").select("*"),
      sb.from("gastos").select("*")
    ]);
    if (rt.error || rg.error) { ponerEstadoSync("No se pudieron cargar tus datos: " + traducirError(rt.error || rg.error), "error"); return; }
    conectado = true;
    ponerEstadoSync("Sincronizado · se ve igual en el móvil", "ok");
    // La base de datos devuelve la hora como "10:30:00": nos quedamos con "10:30"
    tareas = rt.data.map(function (x) { return Object.assign({}, x, { fecha: x.fecha || "", hora: x.hora ? x.hora.slice(0, 5) : "" }); });
    gastos = rg.data;
    pintarGastos();
    revisarAvisos();
  }
