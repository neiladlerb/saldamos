// =====================================================================
//  MIS DEUDAS · préstamos, hipoteca, créditos, tarjeta en cuotas
//  Cuánto debo en total, cuánto pago cada mes, cuándo termino y qué
//  parte de mis ingresos se va en cuotas (liquidez).
//  Importes en céntimos. La TAE se convierte en tipo mensual equivalente.
// =====================================================================
(function (global) {
  // ---------------- Cálculos (sin pantalla: se prueban aparte) ----------------
  function tasaMensual(tae) { return tae > 0 ? Math.pow(1 + tae / 100, 1 / 12) - 1 : 0; }
  function claveMes(d) { return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0"); }
  function sumarMeses(clave, n) { const [a, m] = clave.split("-").map(Number); return claveMes(new Date(a, m - 1 + n, 1)); }
  function pagadaEnMes(d, clave) { return (d.pagos || []).some(function (p) { return String(p.fecha).slice(0, 7) === clave; }); }

  // Lo que toca pagar este mes (intereses incluidos) y cómo se reparte
  function cuotaDelMes(saldo, cuota, tae) {
    const interes = Math.round(saldo * tasaMensual(tae));
    const pago = Math.min(cuota, saldo + interes);
    return { pago: pago, interes: Math.min(interes, pago), capital: Math.max(0, pago - interes) };
  }

  // Calendario de pagos desde el mes en curso (o el siguiente si ya pagó este)
  function proyectar(d, hoy, maxMeses) {
    hoy = hoy || new Date(); maxMeses = maxMeses || 480;
    const filas = []; let saldo = d.saldo || 0;
    let mes = claveMes(hoy);
    if (pagadaEnMes(d, mes)) mes = sumarMeses(mes, 1);
    let i = 0;
    while (saldo > 0 && i < maxMeses) {
      const c = cuotaDelMes(saldo, d.cuota, d.tae || 0);
      if (c.capital <= 0) return { filas: filas, nunca: true, intereses: 0 };   // la cuota no cubre ni los intereses
      saldo -= c.capital;
      filas.push({ mes: mes, pago: c.pago, interes: c.interes, capital: c.capital, saldo: saldo });
      mes = sumarMeses(mes, 1); i++;
    }
    return { filas: filas, nunca: saldo > 0, intereses: filas.reduce(function (s, f) { return s + f.interes; }, 0), fin: filas.length ? filas[filas.length - 1].mes : null };
  }

  // Registrar el pago de la cuota de este mes
  function registrarPago(d, fechaISO) {
    const c = cuotaDelMes(d.saldo, d.cuota, d.tae || 0);
    return {
      saldo: Math.max(0, d.saldo - c.capital),
      pagos: (d.pagos || []).concat([{ fecha: fechaISO, importe: c.pago, capital: c.capital, interes: c.interes }])
    };
  }

  function resumen(deudas, ingresos, hoy) {
    hoy = hoy || new Date();
    const mes = claveMes(hoy);
    const activas = deudas.filter(function (d) { return d.activa !== false && d.saldo > 0; });
    let total = 0, cuotasMes = 0, pagadoMes = 0, fin = null, nunca = false;
    activas.forEach(function (d) {
      total += d.saldo;
      const pagada = pagadaEnMes(d, mes);
      const ultimoPago = pagada ? (d.pagos || []).filter(function (p) { return String(p.fecha).slice(0, 7) === mes; }).reduce(function (s, p) { return s + p.importe; }, 0) : 0;
      const c = pagada ? ultimoPago : cuotaDelMes(d.saldo, d.cuota, d.tae || 0).pago;
      cuotasMes += c; if (pagada) pagadoMes += c;
      const p = proyectar(d, hoy);
      if (p.nunca) nunca = true; else if (p.fin && (!fin || p.fin > fin)) fin = p.fin;
    });
    // Deudas que se pagaron del todo este mes también cuentan como pagado
    deudas.forEach(function (d) {
      if (d.saldo === 0 && pagadaEnMes(d, mes)) {
        const imp = (d.pagos || []).filter(function (p) { return String(p.fecha).slice(0, 7) === mes; }).reduce(function (s, p) { return s + p.importe; }, 0);
        cuotasMes += imp; pagadoMes += imp;
      }
    });
    const ratio = ingresos > 0 ? cuotasMes / ingresos : null;
    let nivel = null;
    if (ratio !== null) nivel = ratio <= 0.30 ? "sano" : ratio <= 0.40 ? "atencion" : "alto";
    return { total: total, cuotasMes: cuotasMes, pagadoMes: pagadoMes, pendienteMes: cuotasMes - pagadoMes, fin: fin, nunca: nunca, ratio: ratio, nivel: nivel, libre: ingresos > 0 ? ingresos - cuotasMes : null };
  }

  // Matriz de los próximos n meses: por mes, lo que se paga de cada deuda
  function calendario(deudas, n, hoy) {
    hoy = hoy || new Date();
    const inicio = claveMes(hoy);
    const meses = []; for (let i = 0; i < n; i++) meses.push({ mes: sumarMeses(inicio, i), partes: {}, total: 0 });
    deudas.forEach(function (d) {
      if (d.activa === false) return;
      // Lo ya pagado este mes también cuenta en la columna de este mes
      (d.pagos || []).forEach(function (p) { if (String(p.fecha).slice(0, 7) === inicio) { meses[0].partes[d.id] = (meses[0].partes[d.id] || 0) + p.importe; meses[0].total += p.importe; } });
      proyectar(d, hoy, n + 1).filas.forEach(function (f) {
        const m = meses.find(function (x) { return x.mes === f.mes; });
        if (m) { m.partes[d.id] = (m.partes[d.id] || 0) + f.pago; m.total += f.pago; }
      });
    });
    return meses;
  }

  global.CalcDeudas = { tasaMensual: tasaMensual, cuotaDelMes: cuotaDelMes, proyectar: proyectar, registrarPago: registrarPago, resumen: resumen, calendario: calendario, claveMes: claveMes };
  if (typeof document === "undefined" || !document.getElementById("panel-deudas")) return;

  // ---------------- Pantalla ----------------
  const $ = function (id) { return document.getElementById(id); };
  const fmt = new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR", useGrouping: "always" });
  const eur = function (c) { return fmt.format((c || 0) / 100); };
  const eurCorto = function (c) { return fmt.format(Math.round((c || 0) / 100)).replace(/,00\s?€/, " €"); };
  // Acepta «8.450», «8.450,50», «8450,5» o «8450.50»
  function aCent(t) {
    t = String(t || "").trim().replace(/\s|€/g, "");
    if (/,\d{1,2}$/.test(t)) t = t.replace(/\./g, "").replace(",", ".");
    else if (/^\d{1,3}(\.\d{3})+$/.test(t)) t = t.replace(/\./g, "");
    else t = t.replace(/,/g, "");
    const n = parseFloat(t); return isFinite(n) && n > 0 ? Math.round(n * 100) : 0;
  }
  function el(tag, clase, texto) { const e = document.createElement(tag); if (clase) e.className = clase; if (texto != null) e.textContent = texto; return e; }
  function nombreMes(clave, largo) { const [a, m] = clave.split("-").map(Number); const t = new Date(a, m - 1, 1).toLocaleDateString("es-ES", largo ? { month: "long", year: "numeric" } : { month: "short" }).replace(".", ""); return t.charAt(0).toUpperCase() + t.slice(1); }
  const TIPOS = { hipoteca: "Hipoteca", prestamo: "Préstamo personal", consumo: "Crédito al consumo", tarjeta: "Tarjeta / cuotas", comercial: "Crédito de tienda", otro: "Otra deuda" };
  const COLORES = ["var(--cat-1)", "var(--cat-2)", "var(--cat-3)", "var(--cat-4)", "var(--cat-5)", "var(--cat-6)"];

  let deudas = [], ingresos = 0, editando = null;
  function colorDe(d) {
    const orden = deudas.slice().sort(function (a, b) { return String(a.creado).localeCompare(String(b.creado)); });
    const i = orden.findIndex(function (x) { return x.id === d.id; });
    return i >= 0 && i < COLORES.length ? COLORES[i] : "var(--cat-otros)";
  }
  function estado(texto, tipo) { if (global.ponerEstadoSync) global.ponerEstadoSync(texto, tipo); }

  async function cargarDeudas() {
    const [r, p] = await Promise.all([sb.from("deudas").select("*"), global.miPerfil ? miPerfil() : null]);
    if (r.error) { estado("No se pudieron cargar tus deudas: " + traducirError(r.error), "error"); return; }
    deudas = (r.data || []).map(function (d) { return Object.assign({}, d, { saldo: +d.saldo, cuota: +d.cuota, tae: +d.tae || 0, importe_original: d.importe_original ? +d.importe_original : null, pagos: d.pagos || [] }); });
    if (p && p.ingresos_mensuales != null) ingresos = +p.ingresos_mensuales;
    if (document.activeElement !== $("dd-ingresos")) $("dd-ingresos").value = ingresos ? (ingresos / 100).toLocaleString("es-ES", { maximumFractionDigits: 2 }) : "";
    pintar();
  }
  global.cargarDeudas = cargarDeudas;

  async function guardarCambios(id, cambios) {
    const d = deudas.find(function (x) { return x.id === id; }); if (d) Object.assign(d, cambios);
    pintar();
    const r = await sb.from("deudas").update(Object.assign({}, cambios, { actualizado: new Date().toISOString() })).eq("id", id);
    if (r.error) { estado("No se pudo guardar: " + traducirError(r.error), "error"); await cargarDeudas(); return; }
    estado("Guardado · se ve igual en el móvil", "ok");
  }

  // Ingresos (en el perfil: solo los ves tú)
  let tIngresos = null;
  $("dd-ingresos").addEventListener("input", function () {
    ingresos = aCent(this.value); pintar();
    clearTimeout(tIngresos);
    tIngresos = setTimeout(async function () {
      const s = await sesionActual(); if (!s) return;
      const r = await sb.from("perfiles").update({ ingresos_mensuales: ingresos || null }).eq("id", s.user.id);
      if (r.error) estado("No se pudieron guardar tus ingresos: " + traducirError(r.error), "error");
    }, 700);
  });

  function pintar() {
    const hoy = new Date();
    const R = resumen(deudas, ingresos, hoy);
    $("dd-total").textContent = eur(R.total);
    $("dd-cuotas").textContent = eur(R.cuotasMes);
    $("dd-fin").textContent = R.nunca ? "Revisa una cuota" : R.fin ? nombreMes(R.fin, true) : (deudas.length ? "¡Ya!" : "—");
    pintarLiquidez(R);
    pintarGrafico();
    pintarCalendario(hoy);
    pintarLista(hoy);
    pintarConsejo(R);
  }

  function pintarLiquidez(R) {
    const est = $("dd-estado"), med = $("dd-medidor"), txt = $("dd-liquidez-texto");
    if (R.ratio === null) {
      est.textContent = ""; est.className = "dd-estado"; med.hidden = true;
      txt.textContent = "Pon tus ingresos para ver qué parte se va en deudas. Solo lo ves tú."; return;
    }
    const pct = Math.round(R.ratio * 100);
    const N = { sano: ["✓ Sano", "sano"], atencion: ["! Atención", "atencion"], alto: ["▲ Alto", "alto"] }[R.nivel];
    est.textContent = N[0] + " · " + pct + " %"; est.className = "dd-estado " + N[1];
    med.hidden = false; med.className = "dd-medidor " + N[1];
    $("dd-medidor-barra").style.width = Math.min(100, pct) + "%";
    txt.textContent = "Las cuotas se llevan el " + pct + " % de tus ingresos. " +
      (R.libre >= 0 ? "Te quedan " + eur(R.libre) + " al mes para todo lo demás." : "Las cuotas superan tus ingresos en " + eur(-R.libre) + ".") +
      " Los bancos suelen recomendar no pasar del 35 %.";
  }

  // Barras apiladas: cuánto pagarás de cada deuda en los próximos 12 meses
  function pintarGrafico() {
    const caja = $("dd-grafico"); caja.innerHTML = "";
    const activas = deudas.filter(function (d) { return d.activa !== false && (d.saldo > 0 || (d.pagos || []).length); });
    if (!activas.length) { caja.appendChild(el("p", "ayuda", "Cuando añadas tus deudas verás aquí lo que pagas cada mes y cuándo se libera dinero.")); return; }
    const meses = calendario(activas, 12);
    const umbral = ingresos > 0 ? Math.round(ingresos * 0.35) : 0;
    const max = Math.max(umbral, Math.max.apply(null, meses.map(function (m) { return m.total; }))) || 1;
    const tip = el("div", "m30-tip"); tip.hidden = true;
    function conTip(e, texto) {
      e.tabIndex = 0; e.setAttribute("aria-label", texto);
      const ver = function () {
        tip.textContent = texto; tip.hidden = false;
        const r = e.getBoundingClientRect(), c = caja.getBoundingClientRect();
        tip.style.left = Math.max(4, Math.min(c.width - tip.offsetWidth - 4, r.left - c.left + r.width / 2 - tip.offsetWidth / 2)) + "px";
        tip.style.top = Math.max(0, r.top - c.top - tip.offsetHeight - 6) + "px";
      };
      e.addEventListener("mouseenter", ver); e.addEventListener("focus", ver); e.addEventListener("click", ver);
      e.addEventListener("mouseleave", function () { tip.hidden = true; }); e.addEventListener("blur", function () { tip.hidden = true; });
    }
    const zona = el("div", "dd-barras");
    if (umbral) {
      const l = el("div", "dd-umbral"); l.style.bottom = Math.round(umbral * 100 / max) + "%";
      l.appendChild(el("span", null, "35 % de tus ingresos"));
      zona.appendChild(l);
    }
    const orden = activas.slice().sort(function (a, b) { return String(a.creado).localeCompare(String(b.creado)); });
    meses.forEach(function (m, i) {
      const col = el("div", "dd-col" + (i === 0 ? " actual" : ""));
      const pila = el("div", "dd-pila"); pila.style.height = Math.round(m.total * 100 / max) + "%";
      orden.forEach(function (d) {
        const v = m.partes[d.id]; if (!v) return;
        const seg = el("span", "dd-seg"); seg.style.flexGrow = v; seg.style.background = colorDe(d);
        conTip(seg, nombreMes(m.mes, true) + " · " + d.nombre + ": " + eur(v));
        pila.appendChild(seg);
      });
      // Etiqueta solo en el primer mes y cuando cambia el total (se libera dinero)
      const anterior = i > 0 ? meses[i - 1].total : null;
      if (i === 0 || (anterior !== null && Math.abs(anterior - m.total) > 100)) col.appendChild(el("span", "dd-valor", eurCorto(m.total)));
      col.append(pila);
      const zx = el("span", "dd-x", nombreMes(m.mes)); col.appendChild(zx);
      conTip(zx, nombreMes(m.mes, true) + ": " + eur(m.total) + " en cuotas");
      zona.appendChild(col);
    });
    const ley = el("ul", "dd-leyenda");
    orden.forEach(function (d) {
      const li = el("li"); const mu = el("span", "m30-muestra"); mu.style.background = colorDe(d);
      li.append(mu, el("span", null, d.nombre)); ley.appendChild(li);
    });
    caja.append(zona, ley, tip);
  }

  function siguienteCargo(d, hoy) {
    const mes = claveMes(hoy);
    // Si ya se pagó este mes o el día de cargo ya pasó, el siguiente es el mes que viene
    const yaPaso = pagadaEnMes(d, mes) || (d.dia_pago || 1) < hoy.getDate();
    const base = yaPaso ? new Date(hoy.getFullYear(), hoy.getMonth() + 1, 1) : new Date(hoy.getFullYear(), hoy.getMonth(), 1);
    const ultimo = new Date(base.getFullYear(), base.getMonth() + 1, 0).getDate();
    return new Date(base.getFullYear(), base.getMonth(), Math.min(d.dia_pago || 1, ultimo));
  }
  function iso(d) { return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); }

  function pintarCalendario(hoy) {
    const caja = $("dd-calendario"); caja.innerHTML = "";
    const mes = claveMes(hoy);
    const filas = deudas.filter(function (d) { return d.activa !== false && (d.saldo > 0 || pagadaEnMes(d, mes)); })
      .sort(function (a, b) { return (a.dia_pago || 1) - (b.dia_pago || 1); });
    if (!filas.length) { caja.appendChild(el("p", "ayuda", "No tienes cargos este mes.")); return; }
    filas.forEach(function (d) {
      const pagada = pagadaEnMes(d, mes);
      const ultimo = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0).getDate();
      const dia = Math.min(d.dia_pago || 1, ultimo);
      const vencida = !pagada && dia < hoy.getDate();
      const f = el("div", "fila-pago dd-cargo" + (pagada ? " pagada" : vencida ? " vencida" : ""));
      const fecha = el("span", "dd-dia"); fecha.append(el("b", null, String(dia)), el("small", null, nombreMes(mes)));
      const texto = el("span", "texto-pago");
      texto.append(el("strong", null, d.nombre), el("br"),
        el("small", pagada ? "positivo-txt" : vencida ? "negativo-txt" : "", pagada ? "✓ Pagada" : vencida ? "! Ya debería haberse cobrado" : "Pendiente"));
      const imp = pagada ? (d.pagos || []).filter(function (p) { return String(p.fecha).slice(0, 7) === mes; }).reduce(function (s, p) { return s + p.importe; }, 0)
                         : cuotaDelMes(d.saldo, d.cuota, d.tae).pago;
      f.append(fecha, texto, el("span", "importe", eur(imp)));
      if (pagada) {
        const b = el("button", "boton-sec", "Deshacer"); b.type = "button";
        b.addEventListener("click", function () { deshacerPago(d, mes); });
        f.appendChild(b);
      } else {
        const b = el("button", "boton-sec", "Marcar pagada"); b.type = "button";
        b.addEventListener("click", function () { guardarCambios(d.id, registrarPago(d, iso(hoy))); });
        f.appendChild(b);
      }
      caja.appendChild(f);
    });
  }

  function deshacerPago(d, mes) {
    const quitar = (d.pagos || []).filter(function (p) { return String(p.fecha).slice(0, 7) === mes; });
    const capital = quitar.reduce(function (s, p) { return s + (p.capital || 0); }, 0);
    guardarCambios(d.id, { saldo: d.saldo + capital, pagos: d.pagos.filter(function (p) { return String(p.fecha).slice(0, 7) !== mes; }) });
  }

  function pintarLista(hoy) {
    const ul = $("dd-lista"); ul.innerHTML = "";
    $("dd-vacio").hidden = deudas.length > 0;
    deudas.slice().sort(function (a, b) { return (b.saldo > 0) - (a.saldo > 0) || b.saldo - a.saldo; }).forEach(function (d) {
      const li = el("li", "dd-deuda" + (d.saldo === 0 ? " saldada" : ""));
      li.style.setProperty("--color-deuda", colorDe(d));
      const p = proyectar(d, hoy);
      const cab = el("div", "dd-cab");
      const nom = el("div", "cuerpo");
      nom.append(el("strong", null, d.nombre), el("span", "g-meta", (TIPOS[d.tipo] || "Deuda") + (d.entidad ? " · " + d.entidad : "") + (d.tae ? " · TAE " + String(d.tae).replace(".", ",") + " %" : " · sin intereses")));
      cab.append(nom, el("span", "dd-saldo", d.saldo ? eur(d.saldo) : "✓ Saldada"));
      li.appendChild(cab);
      if (d.importe_original && d.importe_original >= d.saldo) {
        const pagado = d.importe_original - d.saldo, pct = Math.round(pagado * 100 / d.importe_original);
        const barra = el("div", "dd-progreso"); const r = el("span"); r.style.width = pct + "%"; barra.appendChild(r);
        li.append(barra, el("small", "ayuda", "Llevas pagado el " + pct + " % (" + eur(pagado) + " de " + eur(d.importe_original) + ")"));
      }
      const datos = el("div", "dd-datos");
      function dato(eti, val) { const x = el("div"); x.append(el("small", null, eti), el("b", null, val)); datos.appendChild(x); }
      dato("Cuota", eur(d.cuota) + " · día " + (d.dia_pago || 1));
      if (d.saldo > 0) {
        dato("Termina", p.nunca ? "Nunca: la cuota no cubre los intereses" : nombreMes(p.fin, true) + " (" + p.filas.length + " cuotas)");
        dato("Intereses que faltan", p.nunca ? "—" : eur(p.intereses));
      }
      li.appendChild(datos);
      const acc = el("div", "dd-acciones");
      if (d.saldo > 0) {
        const av = el("button", "boton-sec", "Avisarme antes del cargo"); av.type = "button";
        av.addEventListener("click", async function () {
          av.disabled = true;
          const cargo = siguienteCargo(d, hoy); const aviso = new Date(cargo); aviso.setDate(aviso.getDate() - 2);
          const fecha = aviso < hoy ? hoy : aviso;
          const r = await sb.from("tareas").insert({ texto: "Cargo de " + d.nombre + " el día " + cargo.getDate() + " (" + eur(cuotaDelMes(d.saldo, d.cuota, d.tae).pago) + "): revisa que haya saldo", fecha: iso(fecha), hora: "09:00", hecha: false, avisada: false });
          av.textContent = r.error ? "No se pudo crear" : "✓ Aviso creado en Tareas";
          if (!r.error && global.cargarTodo) cargarTodo();
        });
        acc.appendChild(av);
      }
      const ed = el("button", "enlace-boton", "Editar"); ed.type = "button";
      ed.addEventListener("click", function () { editar(d); });
      const bo = el("button", "enlace-boton peligro-texto", "Borrar"); bo.type = "button";
      bo.addEventListener("click", async function () {
        if (!bo.dataset.c) { bo.dataset.c = "1"; bo.textContent = "¿Seguro? Pulsa otra vez"; setTimeout(function () { bo.dataset.c = ""; bo.textContent = "Borrar"; }, 3000); return; }
        deudas = deudas.filter(function (x) { return x.id !== d.id; }); pintar();
        const r = await sb.from("deudas").delete().eq("id", d.id);
        if (r.error) { estado("No se pudo borrar: " + traducirError(r.error), "error"); cargarDeudas(); }
      });
      acc.append(ed, bo);
      li.appendChild(acc);
      ul.appendChild(li);
    });
  }

  // Consejo: método avalancha (primero la de mayor TAE) y aviso si la cuota no cubre intereses
  function pintarConsejo(R) {
    const c = $("dd-consejo");
    const activas = deudas.filter(function (d) { return d.saldo > 0; });
    const malas = activas.filter(function (d) { return proyectar(d).nunca; });
    let t = "";
    if (malas.length) t = "⚠ La cuota de «" + malas[0].nombre + "» no cubre ni los intereses: la deuda crece cada mes. Revisa los datos o habla con tu banco.";
    else if (activas.filter(function (d) { return d.tae > 0; }).length >= 2) {
      const cara = activas.slice().sort(function (a, b) { return b.tae - a.tae; })[0];
      t = "💡 Si un mes te sobra dinero, adelántalo a «" + cara.nombre + "» (TAE " + String(cara.tae).replace(".", ",") + " %): es la que más intereses te cobra.";
    } else if (R.nivel === "alto") t = "💡 Más del 40 % de tus ingresos va a cuotas. Antes de pedir un crédito nuevo, espera a terminar alguno.";
    c.textContent = t; c.className = "mensaje " + (malas.length ? "mal" : "ok"); c.hidden = !t;
  }

  // ---------------- Formulario ----------------
  function leerForm() {
    const cuota = aCent($("dd-cuota").value);
    let saldo = aCent($("dd-saldo").value);
    const restantes = parseInt($("dd-restantes").value, 10) || 0;
    const tae = parseFloat(String($("dd-tae").value).replace(",", ".")) || 0;
    if (!saldo && restantes && cuota) saldo = cuota * restantes;   // compra en cuotas sin intereses
    return {
      tipo: $("dd-tipo").value, nombre: $("dd-nombre").value.trim(), entidad: $("dd-entidad").value.trim() || null,
      cuota: cuota, saldo: saldo, tae: tae, dia_pago: Math.min(31, Math.max(1, parseInt($("dd-dia").value, 10) || 1)),
      importe_original: aCent($("dd-original").value) || null
    };
  }
  function validar(x) {
    if (!x.nombre) return "Ponle un nombre (ej. «Préstamo coche»).";
    if (!x.cuota) return "Escribe la cuota que pagas cada mes.";
    if (!x.saldo) return "Escribe lo que queda por pagar o cuántas cuotas te quedan.";
    if (x.tae >= 100) return "La TAE parece demasiado alta. Revísala.";
    return "";
  }
  function previa() {
    const x = leerForm(); const p = $("dd-previa");
    if (!x.cuota || !x.saldo) { p.textContent = ""; return; }
    const pr = proyectar({ saldo: x.saldo, cuota: x.cuota, tae: x.tae, pagos: [] });
    p.textContent = pr.nunca ? "⚠ Con esa cuota no se cubren los intereses: la deuda no bajaría." :
      "Terminarías en " + nombreMes(pr.fin, true) + " (" + pr.filas.length + " cuotas)" + (pr.intereses ? " y pagarías " + eur(pr.intereses) + " de intereses." : ", sin intereses.");
  }
  $("dd-form").addEventListener("input", previa);
  function limpiar() {
    $("dd-form").reset(); editando = null;
    $("dd-guardar").textContent = "Guardar deuda"; $("dd-caja-titulo").textContent = "+ Añadir una deuda";
    $("dd-cancelar").hidden = true; $("dd-error").hidden = true; $("dd-previa").textContent = "";
  }
  function editar(d) {
    editando = d.id;
    $("dd-tipo").value = d.tipo || "prestamo"; $("dd-nombre").value = d.nombre; $("dd-entidad").value = d.entidad || "";
    $("dd-cuota").value = (d.cuota / 100).toFixed(2).replace(".", ","); $("dd-saldo").value = (d.saldo / 100).toFixed(2).replace(".", ",");
    $("dd-restantes").value = ""; $("dd-tae").value = d.tae ? String(d.tae).replace(".", ",") : "";
    $("dd-dia").value = d.dia_pago || 1; $("dd-original").value = d.importe_original ? (d.importe_original / 100).toFixed(2).replace(".", ",") : "";
    $("dd-guardar").textContent = "Guardar cambios"; $("dd-caja-titulo").textContent = "Editar «" + d.nombre + "»";
    $("dd-cancelar").hidden = false; $("dd-caja").open = true; previa();
    $("dd-caja").scrollIntoView({ behavior: "smooth", block: "start" }); $("dd-nombre").focus();
  }
  $("dd-cancelar").addEventListener("click", function () { limpiar(); $("dd-caja").open = false; });
  $("dd-form").addEventListener("submit", async function (ev) {
    ev.preventDefault();
    const x = leerForm(); const err = validar(x);
    if (err) { $("dd-error").textContent = err; $("dd-error").hidden = false; return; }
    $("dd-error").hidden = true;
    if (editando) { const id = editando; limpiar(); $("dd-caja").open = false; await guardarCambios(id, x); return; }
    const r = await sb.from("deudas").insert(x);
    if (r.error) { $("dd-error").textContent = "No se pudo guardar: " + traducirError(r.error); $("dd-error").hidden = false; return; }
    limpiar(); $("dd-caja").open = false;
    await cargarDeudas();
  });
})(typeof window !== "undefined" ? window : globalThis);
