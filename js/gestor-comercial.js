// =====================================================================
//  GESTOR COMERCIAL · propone campañas y actividad comercial.
//  Reglas a partir de los datos del back office (cuentas por plan,
//  actividad, cobros, invitaciones…) y de la época del año.
//  Sin pantallas: el back office (js/admin.js) pinta lo que devuelve.
// =====================================================================
(function (global) {
  const SEGMENTOS = {
    todos: "Todas las cuentas activas",
    gratis: "Cuentas Gratis",
    gratis_activos: "Gratis activas (últimos 7 días)",
    premium: "Premium y Empresas",
    empresa: "Cuentas de empresa",
    inactivos: "Sin entrar en 30 días",
    sin_confirmar: "Email sin confirmar",
    invitadores: "Quienes ya han invitado",
    empresas_potenciales: "Empresas a contactar (fuera de la app)"
  };
  const CANALES = { email: "Email", whatsapp: "WhatsApp", en_app: "Aviso en la app", redes: "Redes sociales", contacto_directo: "Contacto directo" };

  const DIA = 86400000;
  function activa(u) { return u.estado === "activo"; }
  function promoVigente(u) { return u.premium_hasta && Date.parse(u.premium_hasta) > Date.now(); }

  // Cuentas de cada segmento (para el alcance y para descargar la lista)
  function segmento(usuarios, clave) {
    const ahora = Date.now();
    const lista = (usuarios || []).filter(activa);
    switch (clave) {
      case "gratis": return lista.filter(function (u) { return (u.plan || "gratis") === "gratis" && !promoVigente(u); });
      case "gratis_activos": return lista.filter(function (u) { return (u.plan || "gratis") === "gratis" && u.ultimo_acceso && ahora - Date.parse(u.ultimo_acceso) < 7 * DIA; });
      case "premium": return lista.filter(function (u) { return u.plan === "premium" || u.plan === "empresa"; });
      case "empresa": return lista.filter(function (u) { return u.plan === "empresa"; });
      case "inactivos": return lista.filter(function (u) { return ahora - Date.parse(u.ultimo_acceso || u.creado) > 30 * DIA; });
      case "sin_confirmar": return lista.filter(function (u) { return !u.email_confirmado; });
      case "invitadores": return lista.filter(function (u) { return (u.n_invitados || 0) > 0; });
      case "empresas_potenciales": return [];
      default: return lista;
    }
  }

  // Campaña de temporada según el mes (0 = enero)
  const TEMPORADA = [
    { titulo: "Cuesta de enero: pon orden en tus deudas", mensaje: "Empieza el año sabiendo cuánto debes y cuándo terminas de pagar. En Saldamos, pestaña «Deudas», lo ves en un minuto.", foco: "el módulo de deudas" },
    { titulo: "San Valentín: las cuentas claras en pareja", mensaje: "¿Pagáis los gastos de casa a medias o según lo que gana cada uno? Crea un grupo «Casa» y repartid 50/50 o 60/40 sin discusiones.", foco: "el reparto por porcentaje en pareja" },
    { titulo: "Semana Santa: viajes con amigos sin líos", mensaje: "Este año, nada de cuentas en una servilleta: crea el grupo del viaje, apuntad los gastos y al volver cada uno sabe lo que paga.", foco: "los grupos de viaje" },
    { titulo: "Semana Santa y puentes de primavera", mensaje: "Escapadas con amigos: crea el grupo, apuntad sobre la marcha y al volver cada uno recibe su parte por WhatsApp.", foco: "los grupos de viaje" },
    { titulo: "Bodas, despedidas y comuniones", mensaje: "¿Organizas una despedida o un regalo entre muchos? Saldamos calcula quién pone cuánto y avisa a cada uno por WhatsApp.", foco: "los regalos y eventos en grupo" },
    { titulo: "Verano: viajes en grupo", mensaje: "Vacaciones con amigos o en familia: apuntad los gastos del viaje y al final, el mínimo de pagos para quedar en paz.", foco: "los viajes de verano" },
    { titulo: "Verano: viajes en grupo", mensaje: "Vacaciones con amigos o en familia: apuntad los gastos del viaje y al final, el mínimo de pagos para quedar en paz.", foco: "los viajes de verano" },
    { titulo: "Agosto: cerrad las cuentas del verano", mensaje: "¿Quedó algo pendiente del viaje? Abre el grupo y manda a cada uno su parte por WhatsApp en un clic.", foco: "cerrar los grupos de viaje" },
    { titulo: "Vuelta al cole: los gastos de los niños, claros", mensaje: "Libros, uniformes, extraescolares… Con el presupuesto compartido cada uno sabe lo que pone y los extras se aprueban sin discusiones.", foco: "el presupuesto compartido (Premium)" },
    { titulo: "Otoño: piso compartido sin discusiones", mensaje: "Empieza el curso en el piso con las cuentas claras: luz, internet y la compra, repartidos y al día.", foco: "los pisos compartidos" },
    { titulo: "Navidad se acerca: amigo invisible y cenas", mensaje: "Cena de empresa, amigo invisible, regalos entre hermanos… Organízalo en Saldamos y que cada uno pague lo suyo.", foco: "los regalos y cenas de Navidad" },
    { titulo: "Navidad y Nochevieja: cenas, regalos y lotería", mensaje: "Cenas, regalos y la lotería compartida: apúntalo todo y en enero nadie se acuerda de deudas.", foco: "los gastos de Navidad" }
  ];

  function invitacionActiva(promociones) {
    const hoy = new Date().toISOString().slice(0, 10);
    return (promociones || []).find(function (p) { return p.tipo === "invitacion" && p.activa && p.inicio <= hoy && (!p.fin || p.fin >= hoy); });
  }
  function promoPorCodigo(promociones, codigo) { return (promociones || []).find(function (p) { return p.codigo === codigo; }); }
  function eur(c) { return global.Reparto ? global.Reparto.eur(c) : (c / 100).toFixed(2) + " €"; }

  // Propuestas de campaña. Cada una: {clave, titulo, motivo, segmento, canal, mensaje, objetivo, prioridad, promo?}
  function propuestas(ctx) {
    const n = ctx.negocio || {}, us = ctx.usuarios || [], promos = ctx.promociones || [];
    const hoy = ctx.hoy || new Date();
    const r = [];
    const activas = Math.max(1, n.activas || 0);

    // 1 · Conversión a Premium
    if ((n.gratis_activos_7d || 0) > 0) {
      r.push({ clave: "conversion", prioridad: 1, titulo: "Pasa a Premium: 14 días de prueba",
        motivo: n.gratis_activos_7d + " cuentas Gratis han entrado esta semana. Son las más fáciles de convertir.",
        segmento: "gratis_activos", canal: "en_app",
        mensaje: "Prueba Premium 14 días gratis: «Dímelo» entiende cualquier frase y varias cosas a la vez, y el presupuesto compartido pone orden en los gastos de casa. Código: PRUEBA14.",
        objetivo: "Convertir el 10 % (" + Math.max(1, Math.round(n.gratis_activos_7d * 0.1)) + " cuentas) en 30 días",
        promo: promoPorCodigo(promos, "PRUEBA14") ? null : { codigo: "PRUEBA14", nombre: "Prueba Premium 14 días", tipo: "premium_gratis", dias_premium: 14, dias_premium_invitador: 0, descuento_pct: 0 } });
    }
    // 2 · Invitaciones
    const inv = invitacionActiva(promos);
    if (!inv) {
      r.push({ clave: "invitar", prioridad: 1, titulo: "Lanza «Invita a tus amigos»",
        motivo: "No hay ninguna promoción de invitación activa. Cada grupo compartido llega a varias personas que aún no tienen cuenta.",
        segmento: "todos", canal: "en_app",
        mensaje: "Invita a tus amigos a Saldamos: por cada amigo que se registre con tu enlace, tenéis 30 días de Premium gratis los dos. Lo encuentras en Mi cuenta → Invita a tus amigos.",
        objetivo: "1 de cada 5 cuentas activas invita al menos a un amigo",
        promo: { codigo: "INVITA30", nombre: "Invita a tus amigos: 30 días de Premium para los dos", tipo: "invitacion", dias_premium: 30, dias_premium_invitador: 30, descuento_pct: 0 } });
    } else if ((n.invitadores || 0) / activas < 0.2) {
      r.push({ clave: "invitar-empujon", prioridad: 2, titulo: "Recuerda «Invita a tus amigos»",
        motivo: "Solo " + (n.invitadores || 0) + " de " + activas + " cuentas activas han invitado a alguien. La promoción «" + inv.codigo + "» está activa.",
        segmento: "todos", canal: "en_app",
        mensaje: "¿Llevas las cuentas con amigos? Invítales con tu enlace y tenéis " + inv.dias_premium + " días de Premium gratis. Mi cuenta → Invita a tus amigos.",
        objetivo: "Duplicar las cuentas invitadas este mes (ahora: " + (n.invitados || 0) + ")", promoId: inv.id });
    }
    // 3 · Cobros
    if ((n.n_pendientes || 0) + (n.n_fallidos || 0) > 0) {
      r.push({ clave: "cobros", prioridad: 1, titulo: "Recupera los cobros pendientes",
        motivo: (n.n_pendientes || 0) + " pagos pendientes (" + eur(n.pendiente || 0) + ") y " + (n.n_fallidos || 0) + " fallidos en 30 días.",
        segmento: "premium", canal: "email",
        mensaje: "Hola: no hemos podido completar el pago de tu plan. Revisa tu forma de pago para seguir disfrutando de Premium sin cortes. Si necesitas ayuda, responde a este email.",
        objetivo: "Cobrar el 80 % de lo pendiente en 15 días" });
    }
    // 4 · Reactivación
    if ((n.inactivos_30d || 0) > 0) {
      r.push({ clave: "reactivar", prioridad: 2, titulo: "Te echamos de menos",
        motivo: n.inactivos_30d + " cuentas activas no han entrado en 30 días.",
        segmento: "inactivos", canal: "email",
        mensaje: "¿Tienes cuentas pendientes con alguien? Abre Saldamos, apunta el último gasto y manda a cada uno su parte por WhatsApp en un clic.",
        objetivo: "Que vuelva a entrar el 15 % en 2 semanas" });
    }
    // 5 · Premium regalado que caduca
    const caducan = us.filter(function (u) { return u.estado === "activo" && (u.plan || "gratis") === "gratis" && u.premium_hasta && Date.parse(u.premium_hasta) > Date.now() && Date.parse(u.premium_hasta) - Date.now() < 7 * DIA; }).length;
    if (caducan > 0) {
      r.push({ clave: "retener", prioridad: 1, titulo: "Que se queden en Premium",
        motivo: caducan + " cuentas terminan su Premium gratis en los próximos 7 días.",
        segmento: "gratis", canal: "en_app",
        mensaje: "Tu Premium gratis termina pronto. Sigue con «Dímelo» avanzado y el presupuesto compartido: el primer mes con un 50 % de descuento con el código SIGUE50.",
        objetivo: "Retener al 25 %",
        promo: promoPorCodigo(promos, "SIGUE50") ? null : { codigo: "SIGUE50", nombre: "Sigue en Premium: 50 % el primer mes", tipo: "descuento", dias_premium: 0, dias_premium_invitador: 0, descuento_pct: 50 } });
    }
    // 6 · Empresas
    if ((n.empresas || 0) < 5) {
      r.push({ clave: "empresas", prioridad: 2, titulo: "Prospección de empresas: beneficio para empleados",
        motivo: "Solo hay " + (n.empresas || 0) + " empresas cliente. El plan Empresas da ingresos recurrentes con pocas ventas.",
        segmento: "empresas_potenciales", canal: "contacto_directo",
        mensaje: "Hola, soy [nombre] de Saldamos. Ayudamos a que vuestro equipo controle sus gastos y llegue mejor a fin de mes, con vuestra marca y sin ver nunca datos personales. ¿Os encaja una prueba gratis de 3 meses? Más información: saldamos.app/empresas",
        objetivo: "3 reuniones con RR. HH. y 1 piloto este mes" });
    }
    // 7 · Email sin confirmar
    if ((n.sin_confirmar || 0) > 0) {
      r.push({ clave: "confirmar", prioridad: 3, titulo: "Recordatorio: confirma tu email",
        motivo: n.sin_confirmar + " cuentas no han confirmado el email y no pueden entrar.",
        segmento: "sin_confirmar", canal: "email",
        mensaje: "Te falta un paso: confirma tu email para empezar a usar Saldamos. Si no encuentras el mensaje, mira en spam o pide otro desde «Entrar».",
        objetivo: "Que confirme el 50 %" });
    }
    // 8 · Temporada
    const t = TEMPORADA[hoy.getMonth()];
    r.push({ clave: "temporada-" + hoy.getFullYear() + "-" + (hoy.getMonth() + 1), prioridad: 2, titulo: t.titulo,
      motivo: "Campaña de temporada centrada en " + t.foco + ".",
      segmento: "todos", canal: "redes", mensaje: t.mensaje,
      objetivo: "Altas nuevas desde redes: +20 % sobre el mes pasado (" + (n.nuevos_30d || 0) + ")" });

    // Fuera las que ya están creadas y vivas
    const vivas = (ctx.campanas || []).filter(function (c) { return c.estado !== "descartada" && c.estado !== "terminada"; }).map(function (c) { return c.nombre; });
    return r.filter(function (p) { return vivas.indexOf(p.titulo) === -1; })
      .map(function (p) { p.alcance = segmento(us, p.segmento).length; return p; })
      .sort(function (a, b) { return a.prioridad - b.prioridad; });
  }

  // Actividad comercial de la semana (lista de tareas para el gestor)
  function actividad(ctx) {
    const n = ctx.negocio || {}, hoy = ctx.hoy || new Date();
    const t = TEMPORADA[hoy.getMonth()];
    const a = [
      { clave: "redes", texto: "Publicar 3 piezas en redes sobre " + t.foco + " (una con un caso real de grupo)." },
      { clave: "empresas", texto: "Contactar con 10 empresas (RR. HH. o beneficios) y proponer el piloto gratis de 3 meses." },
      { clave: "campanas", texto: "Revisar las campañas en marcha: alcance, altas y conversiones; cerrar las que han terminado." }
    ];
    if ((n.n_pendientes || 0) + (n.n_fallidos || 0) > 0) a.push({ clave: "cobros", texto: "Revisar " + ((n.n_pendientes || 0) + (n.n_fallidos || 0)) + " pagos pendientes o fallidos y contactar con cada cuenta." });
    if ((n.invitadores || 0) > 0) a.push({ clave: "testimonios", texto: "Pedir una opinión o testimonio a las " + Math.min(5, n.invitadores) + " cuentas que más invitan." });
    a.push({ clave: "sugerencias", texto: "Leer las sugerencias nuevas y pasar las 3 mejores al equipo de producto." });
    return a;
  }

  // Semana del año (para guardar la lista de actividad por semana)
  function semana(d) {
    const x = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    const dia = x.getUTCDay() || 7; x.setUTCDate(x.getUTCDate() + 4 - dia);
    const ini = new Date(Date.UTC(x.getUTCFullYear(), 0, 1));
    return x.getUTCFullYear() + "-S" + Math.ceil(((x - ini) / DIA + 1) / 7);
  }

  global.GestorComercial = { SEGMENTOS: SEGMENTOS, CANALES: CANALES, segmento: segmento, propuestas: propuestas, actividad: actividad, semana: semana };
})(typeof window !== "undefined" ? window : globalThis);
