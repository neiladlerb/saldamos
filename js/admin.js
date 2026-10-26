// =====================================================================
//  BACK OFFICE (admin.html)
//   · Resumen del negocio, usuarios, pagos, promociones, gestor
//     comercial y sugerencias.
//   · Administrador: todo. Comercial: ver, promociones y campañas.
//   · La base de datos vuelve a comprobar cada permiso (10_backoffice.sql).
// =====================================================================
(function () {
  const $ = function (id) { return document.getElementById(id); };
  const R = window.Reparto, G = window.GestorComercial;
  let miId = null, soyAdmin = false;
  let negocio = {}, usuarios = [], pagos = [], promociones = [], campanas = [], sugerencias = [];

  // ---------- Utilidades ----------
  function el(tag, clase, texto) { const e = document.createElement(tag); if (clase) e.className = clase; if (texto != null) e.textContent = texto; return e; }
  function fecha(t) { return t ? new Date(t).toLocaleDateString("es-ES", { day: "numeric", month: "short", year: "numeric" }) : "—"; }
  function hoyISO() { return new Date().toISOString().slice(0, 10); }
  function mensaje(texto, ok) {
    const p = $("msg"); p.textContent = texto; p.className = "mensaje " + (ok ? "ok" : "mal"); p.hidden = false;
    clearTimeout(mensaje.t); mensaje.t = setTimeout(function () { p.hidden = true; }, 5000);
  }
  function opcion(sel, valor, texto) { const o = el("option", null, texto); o.value = valor; sel.appendChild(o); return o; }
  function fila(tbody) { const tr = el("tr"); tbody.appendChild(tr); return function (contenido, clase) { const td = el("td", clase); if (contenido instanceof Node) td.appendChild(contenido); else td.textContent = contenido == null ? "" : contenido; tr.appendChild(td); return td; }; }
  function vacio(tbody, cols, texto) { tbody.innerHTML = ""; const tr = el("tr"); const td = el("td", "cargando", texto); td.colSpan = cols; tr.appendChild(td); tbody.appendChild(tr); }
  function boton(texto, clase, fn) { const b = el("button", clase || "boton-sec", texto); b.type = "button"; b.addEventListener("click", fn); return b; }
  // Acciones delicadas: hay que pulsar dos veces
  function confirmarDosVeces(b, fn) {
    return function () {
      if (!b.dataset.confirmar) {
        b.dataset.original = b.textContent; b.dataset.confirmar = "1"; b.textContent = "¿Seguro?";
        setTimeout(function () { if (b.isConnected) { delete b.dataset.confirmar; b.textContent = b.dataset.original; } }, 3000);
        return;
      }
      b.disabled = true; fn();
    };
  }
  const NOMBRE_PLAN = { gratis: "Gratis", premium: "Premium", empresa: "Empresas" };
  const NOMBRE_ESTADO = { activo: "Activa", bloqueado: "Bloqueada", cancelada: "Cancelada" };
  const NOMBRE_ROL = { usuario: "Usuario", comercial: "Comercial", admin: "Administrador" };
  function promoVigente(u) { return u.premium_hasta && Date.parse(u.premium_hasta) > Date.now(); }
  function emailDe(id) { const u = usuarios.find(function (x) { return x.id === id; }); return u ? u.email : "—"; }
  function descargarCSV(nombre, cab, filas) {
    if (window.MODO_DEMO) { mensaje("En la demo no se descargan archivos. En la versión real se descarga en CSV para Excel."); return; }
    const esc = function (v) { v = v == null ? "" : String(v); return /[";\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; };
    const texto = "﻿" + cab.join(";") + "\n" + filas.map(function (f) { return f.map(esc).join(";"); }).join("\n");
    const a = el("a"); a.href = URL.createObjectURL(new Blob([texto], { type: "text/csv;charset=utf-8" })); a.download = nombre;
    document.body.appendChild(a); a.click(); a.remove();
  }

  // ---------- Pestañas ----------
  function abrir(nombre) {
    document.querySelectorAll("[data-bo]").forEach(function (b) { b.setAttribute("aria-selected", String(b.dataset.bo === nombre)); });
    document.querySelectorAll(".bo-panel").forEach(function (p) { p.hidden = p.id !== "bo-" + nombre; });
    try { history.replaceState(null, "", "#" + nombre); } catch (e) {}
  }
  document.querySelectorAll("[data-bo]").forEach(function (b) { b.addEventListener("click", function () { abrir(b.dataset.bo); }); });

  // ---------- Arranque ----------
  (async function () {
    const s = await exigirSesion(); if (!s) return;
    miId = s.user.id;
    const perfil = await miPerfil();
    $("yo").textContent = s.user.email;
    if (!perfil || (perfil.rol !== "admin" && perfil.rol !== "comercial") || perfil.estado !== "activo") { $("sin-permiso").hidden = false; return; }
    soyAdmin = perfil.rol === "admin";
    $("mi-rol").textContent = NOMBRE_ROL[perfil.rol]; $("mi-rol").hidden = false;
    if (!soyAdmin) document.querySelectorAll("[data-solo-admin]").forEach(function (e) { e.hidden = true; });
    $("contenido").hidden = false;
    const inicial = location.hash.slice(1);
    abrir($("bo-" + inicial) && (soyAdmin || inicial !== "sugerencias") ? inicial : "resumen");
    await cargarTodo();
  })();

  async function cargarTodo() {
    await Promise.all([cargarNegocio(), cargarUsuarios(), cargarPromociones(), cargarCampanas(), cargarPagos()]);
    pintarComercial();
    if (soyAdmin) cargarSugerencias();
  }

  // ---------- Resumen ----------
  async function cargarNegocio() {
    const [neg, est] = await Promise.all([sb.rpc("admin_negocio"), sb.rpc("admin_estadisticas")]);
    if (neg.error) return mensaje(traducirError(neg.error));
    negocio = neg.data || {};
    const n = negocio;
    $("k-activas").textContent = n.activas;
    $("k-gratis").textContent = n.gratis;
    $("k-premium").textContent = n.premium;
    $("k-empresa").textContent = n.empresa + (n.empresas ? " · " + n.empresas + (n.empresas === 1 ? " empresa" : " empresas") : "");
    $("k-ingresos").textContent = R.eur(n.ingresos_mes || 0);
    $("k-pendiente").textContent = R.eur(n.pendiente || 0);
    $("k-promo").textContent = n.premium_promo;
    $("k-invitados").textContent = n.invitados;
    const total = Math.max(1, (n.gratis || 0) + (n.premium_promo || 0) + (n.premium || 0) + (n.empresa || 0));
    const partes = [["Gratis", n.gratis, "gratis"], ["Premium por promoción", n.premium_promo, "promo"], ["Premium de pago", n.premium, "premium"], ["Empresas", n.empresa, "empresa"]];
    const barra = $("barra-planes"), ley = $("leyenda-planes"); barra.innerHTML = ""; ley.innerHTML = "";
    partes.forEach(function (p) {
      const pct = Math.round((p[1] || 0) / total * 1000) / 10;
      const s = el("span", "seg-" + p[2]); s.style.width = pct + "%"; s.title = p[0] + ": " + (p[1] || 0); barra.appendChild(s);
      const l = el("span", "ley"); l.append(el("i", "seg-" + p[2]), document.createTextNode(p[0] + " · " + (p[1] || 0) + " (" + String(pct).replace(".", ",") + " %)")); ley.appendChild(l);
    });
    const conversion = n.activas ? Math.round(((n.premium || 0) + (n.empresa || 0)) / n.activas * 1000) / 10 : 0;
    $("k-extra").textContent = n.usuarios + " cuentas en total · " + n.canceladas + " canceladas · " + n.bloqueadas + " bloqueadas · " +
      n.nuevos_30d + " altas en 30 días · " + n.activos_7d + " activas esta semana · conversión a pago " + String(conversion).replace(".", ",") + " % · " +
      n.grupos_compartidos + " grupos compartidos por WhatsApp";
    if (!est.error && est.data) pintarGrafico(est.data.altas_por_dia || []);
  }

  function pintarGrafico(altas) {
    const svg = $("grafico-altas"), porDia = {};
    altas.forEach(function (a) { porDia[a.dia] = a.n; });
    const dias = [];
    for (let i = 29; i >= 0; i--) { const d = new Date(); d.setDate(d.getDate() - i); dias.push(d.toISOString().slice(0, 10)); }
    const max = Math.max(1, ...dias.map(function (d) { return porDia[d] || 0; }));
    const ancho = 600 / dias.length;
    let html = '<line x1="0" y1="120" x2="600" y2="120" stroke="var(--borde)" />';
    dias.forEach(function (d, i) {
      const h = (porDia[d] || 0) / max * 100;
      html += '<rect x="' + (i * ancho + 2) + '" y="' + (120 - h) + '" width="' + (ancho - 4) + '" height="' + h + '" rx="2" fill="var(--marca)"><title>' + d + ': ' + (porDia[d] || 0) + ' altas</title></rect>';
    });
    svg.innerHTML = html;
    const eje = $("eje-grafico"); eje.innerHTML = "";
    eje.append(el("span", null, fecha(dias[0])), el("span", null, "Máximo: " + max + " altas/día"), el("span", null, "Hoy"));
  }

  // ---------- Usuarios ----------
  async function cargarUsuarios() {
    const { data, error } = await sb.rpc("admin_listar_usuarios");
    if (error) return mensaje(traducirError(error));
    usuarios = data || [];
    const dl = $("lista-emails"); dl.innerHTML = "";
    usuarios.forEach(function (u) { opcion(dl, u.email, u.nombre || ""); });
    pintarUsuarios();
  }
  function filtrados() {
    const q = $("buscar").value.trim().toLowerCase(), f = $("filtro").value, fp = $("filtro-plan").value;
    return usuarios.filter(function (u) {
      if (q && (u.email + " " + (u.nombre || "") + " " + (u.empresa || "")).toLowerCase().indexOf(q) === -1) return false;
      const plan = u.plan || "gratis";
      if (fp === "promo" && !(plan === "gratis" && promoVigente(u))) return false;
      if (fp && fp !== "promo" && plan !== fp) return false;
      if (f === "activo" || f === "cancelada" || f === "bloqueado") return u.estado === f;
      if (f === "admin" || f === "comercial") return u.rol === f;
      if (f === "sin-confirmar") return !u.email_confirmado;
      return true;
    });
  }
  function pintarUsuarios() {
    const tb = $("filas"), lista = filtrados();
    $("u-resumen").textContent = lista.length + (lista.length === 1 ? " cuenta" : " cuentas") + " con este filtro";
    if (!lista.length) return vacio(tb, 8, "No hay cuentas con este filtro.");
    tb.innerHTML = "";
    lista.forEach(function (u) {
      const td = fila(tb);
      const quien = el("div"); quien.append(el("strong", null, u.nombre || "(sin nombre)"), el("div", "g-meta", u.email));
      if (u.empresa) quien.appendChild(el("div", "g-meta", u.empresa));
      td(quien);
      // Plan
      const plan = u.plan || "gratis";
      if (soyAdmin && u.estado !== "cancelada") {
        const sel = el("select", "filtro"); sel.setAttribute("aria-label", "Plan de " + u.email);
        Object.keys(NOMBRE_PLAN).forEach(function (k) { opcion(sel, k, NOMBRE_PLAN[k]); }); sel.value = plan;
        sel.addEventListener("change", async function () {
          let empresa = null;
          if (sel.value === "empresa") { empresa = prompt("Nombre de la empresa", u.empresa || ""); if (empresa === null) { sel.value = plan; return; } }
          const { error } = await sb.rpc("admin_cambiar_plan", { usuario: u.id, nuevo_plan: sel.value, nueva_empresa: empresa });
          if (error) { sel.value = plan; return mensaje(traducirError(error)); }
          mensaje("Plan cambiado a " + NOMBRE_PLAN[sel.value] + ".", true); recargarCuentas();
        });
        const c = el("div", "celda-plan"); c.appendChild(sel);
        if (plan === "gratis" && promoVigente(u)) c.appendChild(el("div", "g-meta", "Premium por promoción hasta " + fecha(u.premium_hasta)));
        td(c);
      } else {
        const c = el("div"); c.appendChild(el("span", "estado plan-" + plan, NOMBRE_PLAN[plan]));
        if (plan === "gratis" && promoVigente(u)) c.appendChild(el("div", "g-meta", "Premium por promoción hasta " + fecha(u.premium_hasta)));
        td(c);
      }
      // Estado y rol
      const est = el("div", "chips");
      est.appendChild(el("span", "estado " + (u.estado === "activo" ? "activo" : u.estado === "cancelada" ? "pendiente" : "bloqueado"), NOMBRE_ESTADO[u.estado] || u.estado));
      if (u.rol !== "usuario") est.appendChild(el("span", "estado admin", NOMBRE_ROL[u.rol]));
      if (!u.email_confirmado) est.appendChild(el("span", "estado pendiente", "Sin confirmar"));
      td(est);
      td(fecha(u.creado)); td(fecha(u.ultimo_acceso));
      td(String(u.n_invitados || 0), "num"); td(R.eur(u.pagado || 0), "num");
      // Acciones
      const acc = el("div", "acciones-fila");
      if (u.id === miId) acc.appendChild(el("span", "g-meta", "Eres tú"));
      else if (!soyAdmin) acc.appendChild(el("span", "g-meta", "Solo lectura"));
      else {
        if (u.estado === "cancelada") {
          const b = boton("Reactivar"); b.addEventListener("click", confirmarDosVeces(b, function () { rpcCuenta("admin_cambiar_estado", { usuario: u.id, nuevo_estado: "activo" }, "Cuenta reactivada."); })); acc.appendChild(b);
        } else {
          const b1 = boton(u.estado === "activo" ? "Bloquear" : "Desbloquear");
          b1.addEventListener("click", confirmarDosVeces(b1, function () { rpcCuenta("admin_cambiar_estado", { usuario: u.id, nuevo_estado: u.estado === "activo" ? "bloqueado" : "activo" }, "Estado cambiado."); }));
          const b2 = boton("Cancelar cuenta");
          b2.addEventListener("click", confirmarDosVeces(b2, function () { rpcCuenta("admin_cambiar_estado", { usuario: u.id, nuevo_estado: "cancelada" }, "Cuenta cancelada: ya no puede entrar. Sus datos se conservan."); }));
          acc.append(b1, b2);
        }
        const rol = el("select", "filtro"); rol.setAttribute("aria-label", "Rol de " + u.email);
        Object.keys(NOMBRE_ROL).forEach(function (k) { opcion(rol, k, NOMBRE_ROL[k]); }); rol.value = u.rol;
        rol.addEventListener("change", function () { rpcCuenta("admin_cambiar_rol", { usuario: u.id, nuevo_rol: rol.value }, "Rol cambiado a " + NOMBRE_ROL[rol.value] + "."); });
        const b3 = boton("Borrar", "boton-sec peligro-sec");
        b3.title = "Borra la cuenta y todos sus datos para siempre";
        b3.addEventListener("click", confirmarDosVeces(b3, function () { rpcCuenta("admin_borrar_usuario", { usuario: u.id }, "Cuenta borrada con todos sus datos."); }));
        acc.append(rol, b3);
      }
      td(acc);
    });
  }
  async function rpcCuenta(funcion, args, ok) {
    const { error } = await sb.rpc(funcion, args);
    if (error) { mensaje(traducirError(error)); return recargarCuentas(); }
    mensaje(ok, true); recargarCuentas();
  }
  async function recargarCuentas() { await Promise.all([cargarNegocio(), cargarUsuarios()]); pintarComercial(); }
  $("buscar").addEventListener("input", pintarUsuarios);
  $("filtro").addEventListener("change", pintarUsuarios);
  $("filtro-plan").addEventListener("change", pintarUsuarios);
  $("b-csv").addEventListener("click", function () {
    descargarCSV("usuarios-saldamos.csv", ["email", "nombre", "plan", "empresa", "rol", "estado", "email_confirmado", "alta", "ultimo_acceso", "invitados", "pagado_eur"],
      filtrados().map(function (u) { return [u.email, u.nombre, u.plan, u.empresa, u.rol, u.estado, u.email_confirmado ? "sí" : "no", u.creado, u.ultimo_acceso, u.n_invitados, ((u.pagado || 0) / 100).toFixed(2).replace(".", ",")]; }));
  });

  // Crear cuenta
  $("b-nueva-cuenta").addEventListener("click", function () { $("form-cuenta").hidden = false; $("c-email").focus(); });
  $("c-cancelar").addEventListener("click", function () { $("form-cuenta").hidden = true; });
  $("c-plan").addEventListener("change", function () { $("c-empresa-l").hidden = this.value !== "empresa"; });
  $("form-cuenta").addEventListener("submit", async function (ev) {
    ev.preventDefault();
    const d = { email: $("c-email").value.trim(), nombre: $("c-nombre").value.trim(), plan: $("c-plan").value, rol: $("c-rol").value, empresa: $("c-empresa").value.trim() };
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(d.email)) return mensaje("Escribe un email válido.");
    if (d.plan === "empresa" && !d.empresa) return mensaje("Escribe el nombre de la empresa.");
    const b = this.querySelector("button[type=submit]"); b.disabled = true;
    let r;
    try {
      if (window.MODO_DEMO) r = await window.DemoAdmin.crearUsuario(d);
      else {
        const s = await sesionActual();
        const resp = await fetch("/api/admin-usuarios", { method: "POST", headers: { "Content-Type": "application/json", Authorization: "Bearer " + s.access_token }, body: JSON.stringify(d) });
        r = await resp.json().catch(function () { return { error: "No se pudo crear la cuenta" }; });
      }
    } catch (e) { r = { error: "No hay conexión con el servidor." }; }
    b.disabled = false;
    if (!r || r.error) return mensaje(r && r.error ? r.error : "No se pudo crear la cuenta.");
    mensaje(window.MODO_DEMO ? "Cuenta creada. En la demo, la primera contraseña con la que entre quedará como suya." : "Cuenta creada. Hemos enviado a " + d.email + " un email para que elija su contraseña.", true);
    this.reset(); $("c-empresa-l").hidden = true; this.hidden = true;
    recargarCuentas();
  });

  // ---------- Pagos ----------
  async function cargarPagos() {
    const { data, error } = await sb.from("pagos").select("*").order("creado", { ascending: false });
    if (error) { vacio($("filas-pagos"), 7, "No se han podido cargar los pagos."); return; }
    pagos = (data || []).sort(function (a, b) { return String(b.creado).localeCompare(String(a.creado)); });
    pintarPagos();
  }
  function pintarPagos() {
    const n = negocio;
    $("p-mes").textContent = R.eur(n.ingresos_mes || 0); $("p-30").textContent = R.eur(n.ingresos_30d || 0);
    $("p-pend").textContent = R.eur(n.pendiente || 0) + " · " + (n.n_pendientes || 0); $("p-fall").textContent = n.n_fallidos || 0;
    const f = $("filtro-pago").value, tb = $("filas-pagos");
    const lista = pagos.filter(function (p) { return !f || p.estado === f; });
    if (!lista.length) return vacio(tb, 7, "No hay pagos con este filtro.");
    tb.innerHTML = "";
    lista.forEach(function (p) {
      const td = fila(tb);
      td(fecha(p.creado)); td(emailDe(p.user_id)); td(NOMBRE_PLAN[p.plan] || p.plan); td(R.eur(p.importe), "num");
      td({ tarjeta: "Tarjeta", transferencia: "Transferencia", bizum: "Bizum", domiciliacion: "Domiciliación", otro: "Otro" }[p.metodo] || p.metodo);
      td(fecha(p.periodo_inicio) + (p.periodo_fin ? " – " + fecha(p.periodo_fin) : ""));
      if (soyAdmin) {
        const sel = el("select", "filtro estado-pago " + p.estado); sel.setAttribute("aria-label", "Estado del pago");
        [["pagado", "Pagado"], ["pendiente", "Pendiente"], ["fallido", "Fallido"], ["reembolsado", "Reembolsado"]].forEach(function (o) { opcion(sel, o[0], o[1]); });
        sel.value = p.estado;
        sel.addEventListener("change", async function () {
          const { error } = await sb.from("pagos").update({ estado: sel.value }).eq("id", p.id);
          if (error) { sel.value = p.estado; return mensaje(traducirError(error)); }
          p.estado = sel.value; mensaje("Pago marcado como " + sel.options[sel.selectedIndex].text.toLowerCase() + ".", true);
          await Promise.all([cargarNegocio(), cargarUsuarios()]); pintarPagos(); pintarComercial();
        });
        td(sel);
      } else td(el("span", "estado " + (p.estado === "pagado" ? "activo" : p.estado === "pendiente" ? "pendiente" : "bloqueado"), p.estado));
    });
  }
  $("filtro-pago").addEventListener("change", pintarPagos);
  $("b-nuevo-pago").addEventListener("click", function () { $("form-pago").hidden = false; $("pg-inicio").value = hoyISO(); $("pg-usuario").focus(); });
  $("pg-cancelar").addEventListener("click", function () { $("form-pago").hidden = true; });
  $("form-pago").addEventListener("submit", async function (ev) {
    ev.preventDefault();
    const u = usuarios.find(function (x) { return x.email.toLowerCase() === $("pg-usuario").value.trim().toLowerCase(); });
    if (!u) return mensaje("Elige una cuenta de la lista (por su email).");
    const importe = R.aCentimos($("pg-importe").value);
    if (!(importe > 0)) return mensaje("Escribe el importe.");
    const d = { user_id: u.id, plan: $("pg-plan").value, concepto: ($("pg-plan").value === "empresa" ? "Plan Empresas" : "Premium"), importe: importe,
      metodo: $("pg-metodo").value, estado: $("pg-estado").value, periodo_inicio: $("pg-inicio").value || hoyISO(), periodo_fin: $("pg-fin").value || null,
      referencia: $("pg-ref").value.trim() || null, creado_por: miId };
    const { error } = await sb.from("pagos").insert(d);
    if (error) return mensaje(traducirError(error));
    mensaje("Pago registrado.", true); this.reset(); this.hidden = true;
    await Promise.all([cargarNegocio(), cargarUsuarios(), cargarPagos()]); pintarComercial();
  });

  // ---------- Promociones ----------
  async function cargarPromociones() {
    const { data, error } = await sb.from("promociones").select("*");
    if (error) { vacio($("filas-promos"), 6, "No se han podido cargar las promociones."); return; }
    promociones = (data || []).sort(function (a, b) { return String(b.creado).localeCompare(String(a.creado)); });
    pintarPromociones();
    const sel = $("cp-promo"); sel.innerHTML = ""; opcion(sel, "", "Sin promoción");
    promociones.filter(function (p) { return p.activa; }).forEach(function (p) { opcion(sel, p.id, p.codigo + " · " + p.nombre); });
  }
  function beneficio(p) {
    if (p.tipo === "invitacion") return p.dias_premium + " días Premium al invitado · " + p.dias_premium_invitador + " a quien invita";
    if (p.tipo === "premium_gratis") return p.dias_premium + " días de Premium";
    return p.descuento_pct + " % de descuento";
  }
  function pintarPromociones() {
    const tb = $("filas-promos");
    if (!promociones.length) return vacio(tb, 6, "Aún no hay promociones. Crea la primera o acepta una propuesta del gestor comercial.");
    tb.innerHTML = "";
    const hoy = hoyISO();
    promociones.forEach(function (p) {
      const td = fila(tb);
      td(el("code", null, p.codigo));
      const n = el("div"); n.append(el("strong", null, p.nombre), el("div", "g-meta", { invitacion: "Invitación", premium_gratis: "Premium gratis", descuento: "Descuento" }[p.tipo])); td(n);
      td(beneficio(p));
      td(fecha(p.inicio) + (p.fin ? " – " + fecha(p.fin) : " · sin fin"));
      td((p.usos || 0) + (p.max_usos ? " / " + p.max_usos : ""), "num");
      const caducada = (p.fin && p.fin < hoy) || (p.max_usos && p.usos >= p.max_usos);
      const c = el("div", "acciones-fila");
      c.appendChild(el("span", "estado " + (caducada ? "bloqueado" : p.activa ? "activo" : "pendiente"), caducada ? "Terminada" : p.activa ? "Activa" : "Pausada"));
      if (!caducada) c.appendChild(boton(p.activa ? "Pausar" : "Activar", "boton-sec", async function () {
        const { error } = await sb.from("promociones").update({ activa: !p.activa }).eq("id", p.id);
        if (error) return mensaje(traducirError(error));
        mensaje(p.activa ? "Promoción pausada." : "Promoción activada.", true); cargarPromociones().then(pintarComercial);
      }));
      td(c);
    });
  }
  function tipoPromo() {
    const t = $("pr-tipo").value;
    $("pr-dias-l").hidden = t === "descuento"; $("pr-dias-inv-l").hidden = t !== "invitacion"; $("pr-desc-l").hidden = t !== "descuento";
  }
  $("pr-tipo").addEventListener("change", tipoPromo);
  $("b-nueva-promo").addEventListener("click", function () { $("form-promo").hidden = false; $("pr-inicio").value = hoyISO(); tipoPromo(); $("pr-nombre").focus(); });
  $("pr-cancelar").addEventListener("click", function () { $("form-promo").hidden = true; });
  $("pr-codigo").addEventListener("input", function () { this.value = this.value.toUpperCase().replace(/[^A-Z0-9-]/g, ""); });
  async function crearPromocion(d) {
    if (!/^[A-Z0-9-]{3,24}$/.test(d.codigo)) { mensaje("El código debe tener entre 3 y 24 letras, números o guiones."); return false; }
    if (promociones.some(function (p) { return p.codigo === d.codigo; })) { mensaje("Ya existe una promoción con el código " + d.codigo + "."); return false; }
    const { error } = await sb.from("promociones").insert(Object.assign({ usos: 0, activa: true, inicio: hoyISO(), fin: null, max_usos: null }, d));
    if (error) { mensaje(traducirError(error)); return false; }
    await cargarPromociones(); return true;
  }
  $("form-promo").addEventListener("submit", async function (ev) {
    ev.preventDefault();
    const t = $("pr-tipo").value;
    const d = { nombre: $("pr-nombre").value.trim(), codigo: $("pr-codigo").value.trim(), tipo: t,
      dias_premium: t === "descuento" ? 0 : parseInt($("pr-dias").value, 10) || 0,
      dias_premium_invitador: t === "invitacion" ? parseInt($("pr-dias-inv").value, 10) || 0 : 0,
      descuento_pct: t === "descuento" ? parseInt($("pr-desc").value, 10) || 0 : 0,
      inicio: $("pr-inicio").value || hoyISO(), fin: $("pr-fin").value || null, max_usos: parseInt($("pr-max").value, 10) || null };
    if (!d.nombre) return mensaje("Escribe el nombre de la promoción.");
    if (t !== "descuento" && !(d.dias_premium > 0)) return mensaje("Indica los días de Premium.");
    if (t === "descuento" && !(d.descuento_pct > 0)) return mensaje("Indica el descuento.");
    if (await crearPromocion(d)) { mensaje("Promoción " + d.codigo + " creada.", true); this.reset(); this.hidden = true; pintarComercial(); }
  });

  // ---------- Gestor comercial y campañas ----------
  async function cargarCampanas() {
    const { data, error } = await sb.from("campanas").select("*");
    if (error) { $("campanas").textContent = "No se han podido cargar las campañas."; return; }
    campanas = (data || []).sort(function (a, b) { return String(b.creado).localeCompare(String(a.creado)); });
  }
  function pintarComercial() {
    const ctx = { negocio: negocio, usuarios: usuarios, promociones: promociones, campanas: campanas, hoy: new Date() };
    // Propuestas
    const caja = $("propuestas"); caja.innerHTML = "";
    const lista = G.propuestas(ctx);
    if (!lista.length) caja.appendChild(el("p", "ayuda", "No hay propuestas nuevas: todas están ya en campañas."));
    lista.forEach(function (p) {
      const c = el("article", "propuesta prioridad-" + p.prioridad);
      const cab = el("div", "propuesta-cab");
      cab.append(el("span", "estado " + (p.prioridad === 1 ? "bloqueado" : p.prioridad === 2 ? "pendiente" : "admin"), p.prioridad === 1 ? "Prioridad alta" : p.prioridad === 2 ? "Prioridad media" : "Prioridad baja"),
        el("span", "g-meta", G.CANALES[p.canal] + " · " + G.SEGMENTOS[p.segmento] + (p.segmento === "empresas_potenciales" ? "" : " · " + p.alcance + (p.alcance === 1 ? " cuenta" : " cuentas"))));
      c.append(cab, el("h3", null, p.titulo), el("p", "propuesta-motivo", p.motivo));
      const m = el("blockquote", "propuesta-mensaje", p.mensaje); c.appendChild(m);
      c.appendChild(el("p", "g-meta", "Objetivo: " + p.objetivo + (p.promo ? " · Crea la promoción " + p.promo.codigo : "")));
      const bs = el("div", "botones");
      bs.appendChild(boton("Crear campaña", "anadir", async function () {
        this.disabled = true;
        let promoId = p.promoId || null;
        if (p.promo) {
          const ya = promociones.find(function (x) { return x.codigo === p.promo.codigo; });
          if (ya) promoId = ya.id;
          else if (await crearPromocion(p.promo)) { const n = promociones.find(function (x) { return x.codigo === p.promo.codigo; }); promoId = n ? n.id : null; }
          else { this.disabled = false; return; }
        }
        await guardarCampana({ nombre: p.titulo, segmento: p.segmento, canal: p.canal, mensaje: p.mensaje, motivo: p.motivo, objetivo: p.objetivo, promocion_id: promoId, origen: "gestor", alcance: p.alcance });
      }));
      bs.appendChild(boton("Copiar mensaje", "boton-sec", function () { copiar(p.mensaje, this); }));
      c.appendChild(bs);
      caja.appendChild(c);
    });
    pintarActividad(ctx);
    pintarCampanas();
  }
  function copiar(texto, b) {
    const ok = function () { const o = b.textContent; b.textContent = "Copiado ✓"; setTimeout(function () { b.textContent = o; }, 1800); };
    if (navigator.clipboard) navigator.clipboard.writeText(texto).then(ok, function () { mensaje("No se ha podido copiar."); });
  }
  // Lista de actividad: lo marcado se recuerda en este navegador, por semana
  function pintarActividad(ctx) {
    const clave = "bo-actividad-" + G.semana(new Date());
    let hecho = {}; try { hecho = JSON.parse(localStorage.getItem(clave)) || {}; } catch (e) {}
    const ul = $("actividad"); ul.innerHTML = "";
    const lista = G.actividad(ctx);
    lista.forEach(function (a) {
      const li = el("li"); const id = "act-" + a.clave;
      const cb = el("input"); cb.type = "checkbox"; cb.id = id; cb.checked = !!hecho[a.clave];
      const lab = el("label", null, a.texto); lab.htmlFor = id;
      cb.addEventListener("change", function () { hecho[a.clave] = cb.checked; try { localStorage.setItem(clave, JSON.stringify(hecho)); } catch (e) {} progreso(); });
      li.append(cb, lab); ul.appendChild(li);
    });
    function progreso() { $("act-progreso").textContent = lista.filter(function (a) { return hecho[a.clave]; }).length + " de " + lista.length + " hechas"; }
    progreso();
  }
  async function guardarCampana(d) {
    const { error } = await sb.from("campanas").insert(Object.assign({ estado: "propuesta", origen: "manual", alcance: G.segmento(usuarios, d.segmento).length, creado_por: miId }, d));
    if (error) return mensaje(traducirError(error));
    mensaje("Campaña «" + d.nombre + "» creada como propuesta.", true);
    await cargarCampanas(); pintarComercial();
  }
  const ESTADOS_CAMP = [["propuesta", "Propuesta"], ["aprobada", "Aprobada"], ["en_curso", "En marcha"], ["terminada", "Terminada"], ["descartada", "Descartada"]];
  function pintarCampanas() {
    const f = $("filtro-camp").value, caja = $("campanas"); caja.innerHTML = "";
    const lista = campanas.filter(function (c) { return f === "vivas" ? (c.estado !== "terminada" && c.estado !== "descartada") : (!f || c.estado === f); });
    if (!lista.length) { caja.appendChild(el("p", "ayuda", "No hay campañas con este filtro.")); return; }
    lista.forEach(function (c) {
      const art = el("article", "campana tarjeta");
      const cab = el("div", "fila-titulo");
      cab.appendChild(el("h3", null, c.nombre));
      const sel = el("select", "filtro"); sel.setAttribute("aria-label", "Estado de la campaña");
      ESTADOS_CAMP.forEach(function (e) { opcion(sel, e[0], e[1]); }); sel.value = c.estado;
      sel.addEventListener("change", async function () {
        const cambios = { estado: sel.value };
        if (sel.value === "en_curso" && !c.inicio) cambios.inicio = hoyISO();
        if ((sel.value === "terminada" || sel.value === "descartada") && !c.fin) cambios.fin = hoyISO();
        const { error } = await sb.from("campanas").update(cambios).eq("id", c.id);
        if (error) { sel.value = c.estado; return mensaje(traducirError(error)); }
        Object.assign(c, cambios); mensaje("Campaña: " + sel.options[sel.selectedIndex].text.toLowerCase() + ".", true); pintarComercial();
      });
      cab.appendChild(sel);
      art.appendChild(cab);
      const promo = promociones.find(function (p) { return p.id === c.promocion_id; });
      art.appendChild(el("p", "g-meta", (G.CANALES[c.canal] || c.canal) + " · " + (G.SEGMENTOS[c.segmento] || c.segmento) + " · alcance " + (c.alcance || 0) +
        (promo ? " · promoción " + promo.codigo + " (" + (promo.usos || 0) + " usos)" : "") + " · " + (c.origen === "gestor" ? "propuesta del gestor" : "manual") +
        (c.inicio ? " · desde " + fecha(c.inicio) : "") + (c.fin ? " hasta " + fecha(c.fin) : "")));
      if (c.mensaje) art.appendChild(el("blockquote", "propuesta-mensaje", c.mensaje));
      if (c.objetivo) art.appendChild(el("p", "g-meta", "Objetivo: " + c.objetivo));
      const bs = el("div", "botones");
      bs.appendChild(boton("Copiar mensaje", "boton-sec", function () { copiar(c.mensaje, this); }));
      if (c.canal === "whatsapp" || c.canal === "redes") {
        const a = el("a", "boton-sec wa", "Compartir por WhatsApp"); a.href = R.enlaceWhatsApp(c.mensaje, ""); a.target = "_blank"; a.rel = "noopener"; bs.appendChild(a);
      }
      if (c.segmento !== "empresas_potenciales") bs.appendChild(boton("Descargar lista", "boton-sec", function () {
        const l = G.segmento(usuarios, c.segmento);
        descargarCSV("campana-" + c.nombre.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 40) + ".csv", ["email", "nombre", "plan"], l.map(function (u) { return [u.email, u.nombre, u.plan]; }));
      }));
      art.appendChild(bs);
      caja.appendChild(art);
    });
  }
  $("filtro-camp").addEventListener("change", pintarCampanas);
  // Campaña manual
  Object.keys(G.SEGMENTOS).forEach(function (k) { opcion($("cp-segmento"), k, G.SEGMENTOS[k]); });
  Object.keys(G.CANALES).forEach(function (k) { opcion($("cp-canal"), k, G.CANALES[k]); });
  $("b-nueva-camp").addEventListener("click", function () { $("form-camp").hidden = false; $("cp-nombre").focus(); });
  $("cp-cancelar").addEventListener("click", function () { $("form-camp").hidden = true; });
  $("form-camp").addEventListener("submit", async function (ev) {
    ev.preventDefault();
    const nombre = $("cp-nombre").value.trim();
    if (!nombre) return mensaje("Escribe el nombre de la campaña.");
    await guardarCampana({ nombre: nombre, segmento: $("cp-segmento").value, canal: $("cp-canal").value, mensaje: $("cp-mensaje").value.trim(),
      objetivo: $("cp-objetivo").value.trim(), motivo: "", promocion_id: $("cp-promo").value || null, origen: "manual" });
    this.reset(); this.hidden = true;
  });

  // ---------- Sugerencias ----------
  const TIPOS_SUG = { idea: "Idea", problema: "Problema", elogio: "Elogio", pregunta: "Pregunta" };
  async function cargarSugerencias() {
    const { data, error } = await sb.from("sugerencias").select("*");
    if (error) return mensaje(traducirError(error));
    sugerencias = (data || []).sort(function (a, b) { return String(b.creado).localeCompare(String(a.creado)); });
    pintarSugerencias();
  }
  function pintarSugerencias() {
    const f = $("filtro-sug").value;
    const conNota = sugerencias.filter(function (x) { return x.puntuacion; });
    const media = conNota.length ? (conNota.reduce(function (s, x) { return s + x.puntuacion; }, 0) / conNota.length).toFixed(1).replace(".", ",") : "—";
    $("sug-resumen").textContent = sugerencias.length + " sugerencias · " + sugerencias.filter(function (x) { return x.estado === "nueva"; }).length + " nuevas · valoración media " + media + " / 5";
    const tb = $("filas-sug"), lista = sugerencias.filter(function (x) { return !f || x.estado === f; });
    if (!lista.length) return vacio(tb, 6, "No hay sugerencias con este filtro.");
    tb.innerHTML = "";
    lista.forEach(function (x) {
      const td = fila(tb);
      td(fecha(x.creado)); td(TIPOS_SUG[x.tipo] || x.tipo); td(x.puntuacion ? "★".repeat(x.puntuacion) : "—");
      td(x.texto + (x.pagina ? " · (" + x.pagina + ")" : ""), "texto-sugerencia"); td(emailDe(x.user_id));
      const sel = el("select", "filtro"); sel.setAttribute("aria-label", "Estado de la sugerencia");
      ["nueva", "revisada", "en lab", "descartada"].forEach(function (e) { opcion(sel, e, e.charAt(0).toUpperCase() + e.slice(1)); });
      sel.value = x.estado;
      sel.addEventListener("change", async function () {
        const { error } = await sb.from("sugerencias").update({ estado: sel.value }).eq("id", x.id);
        if (error) return mensaje(traducirError(error));
        x.estado = sel.value; pintarSugerencias();
      });
      td(sel);
    });
  }
  $("filtro-sug").addEventListener("change", pintarSugerencias);
})();
