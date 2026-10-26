// =====================================================================
//  MODO DEMO · sustituye a Supabase por datos de ejemplo guardados en
//  este navegador. Mismas funciones que supabase-js, así el resto del
//  código de la app es exactamente el mismo que en la versión real.
// =====================================================================
(function () {
  window.MODO_DEMO = true;
  const CLAVE = "misgastos-demo-v1";
  const TOKEN_ACDC = "Acdc-2026-Dem0";
  const YO = "u-demo";

  function dia(n) { const d = new Date(); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); }
  function mesAtras(n, d) { const x = new Date(); x.setDate(1); x.setMonth(x.getMonth() - n); x.setDate(d); return x.toISOString().slice(0, 10); }
  function mesPasado(d) { const x = new Date(); x.setDate(1); x.setMonth(x.getMonth() - 1); x.setDate(d); return x.toISOString().slice(0, 10); }
  function hace(n) { return new Date(Date.now() - n * 86400000).toISOString(); }
  let contador = 1;
  function id() { return "d" + Date.now().toString(36) + (contador++) + Math.random().toString(36).slice(2, 6); }

  // Grupo Premium de ejemplo: presupuesto compartido de una ex pareja con hijos
  function grupoNinos() {
    const ini = mesAtras(1, 1).slice(0, 7);
    const pct = { yo: 60, marta: 40 };
    const mesA = function (d) { return mesAtras(1, d); };
    const esteMes = function (d) { const x = new Date(); x.setDate(Math.min(d, x.getDate())); return x.toISOString().slice(0, 10); };
    const reg = function (f, quien, accion, detalle) { return { fecha: f + "T" + "09:" + String(10 + (contador++ % 40)) + ":00", quien: quien, accion: accion, detalle: detalle }; };
    const gp = function (concepto, fecha, importe, pagador, categoria) {
      return { id: id(), concepto: concepto, fecha: fecha, importe: importe, pagos: [{ miembro: pagador, importe: importe }],
        reparto: { modo: "iguales", miembros: ["yo", "marta"] }, presupuesto: true, categoria: categoria };
    };
    return {
      id: "g-ninos", user_id: YO, nombre: "Gastos de los niños", token: "Ninos-2026-Dm0", compartido: true, creado: hace(40), actualizado: hace(0),
      miembros: [{ id: "yo", nombre: "Neil", telefono: "", yo: true }, { id: "marta", nombre: "Marta", telefono: "" }],
      presupuesto: { mensual: 60000, inicio: ini, modo: "pct", pct: pct, cuotas: { yo: 36000, marta: 24000 },
        categorias: [{ nombre: "Colegio", importe: 25000 }, { nombre: "Extraescolares", importe: 12000 }, { nombre: "Ropa", importe: 8000 }, { nombre: "Salud", importe: 5000 }, { nombre: "Otros", importe: 10000 }] },
      aportes: [
        { id: id(), miembro: "yo", importe: 36000, fecha: mesA(1), nota: "Transferencia", estado: "confirmado", via: "cuenta" },
        { id: id(), miembro: "marta", importe: 24000, fecha: mesA(2), nota: "Transferencia", estado: "confirmado", via: "enlace" },
        { id: id(), miembro: "yo", importe: 36000, fecha: esteMes(1), nota: "Transferencia", estado: "confirmado", via: "cuenta" },
        { id: id(), miembro: "marta", importe: 24000, fecha: esteMes(2), nota: "Bizum a la cuenta común", estado: "pendiente", via: "enlace" }
      ],
      gastos: [
        gp("Cuota del colegio", mesA(3), 25000, "bote", "Colegio"),
        gp("Natación (trimestre)", mesA(6), 12000, "bote", "Extraescolares"),
        gp("Zapatillas y chándal", mesA(12), 9450, "marta", "Ropa"),
        gp("Dentista revisión", mesA(20), 4000, "bote", "Salud"),
        gp("Cuota del colegio", esteMes(3), 25000, "bote", "Colegio"),
        gp("Material escolar", esteMes(4), 6830, "yo", "Otros"),
        gp("Natación", esteMes(5), 12000, "bote", "Extraescolares"),
        { id: id(), concepto: "Gafas graduadas", fecha: mesA(24), importe: 18000, pagos: [{ miembro: "yo", importe: 18000 }],
          reparto: { modo: "porcentaje", porcentajes: pct }, presupuesto: false, estado: "aprobado", propuesto_por: "yo", nota: "Receta de la óptica en el chat",
          decision: { por: "marta", fecha: mesA(25) + "T20:14:00", comentario: "", via: "enlace" } },
        { id: id(), concepto: "Consola de videojuegos", fecha: esteMes(2), importe: 32000, pagos: [{ miembro: "marta", importe: 32000 }],
          reparto: { modo: "porcentaje", porcentajes: pct }, presupuesto: false, estado: "rechazado", propuesto_por: "marta", nota: "Para su cumpleaños",
          decision: { por: "yo", fecha: esteMes(3) + "T18:02:00", comentario: "Mejor como regalo de cada uno, no a medias", via: "cuenta" } },
        { id: id(), concepto: "Campamento de verano", fecha: esteMes(5), importe: 45000, pagos: [{ miembro: "marta", importe: 45000 }],
          reparto: { modo: "porcentaje", porcentajes: pct }, presupuesto: false, estado: "pendiente", propuesto_por: "marta", nota: "Reserva antes del día 20", via: "enlace" }
      ],
      liquidaciones: [], avisos: [],
      registro: [
        reg(mesA(1), "Neil", "Crea el presupuesto", "600,00 €/mes · Neil 360,00 €, Marta 240,00 € · Colegio 250,00 €, Extraescolares 120,00 €, Ropa 80,00 €, Salud 50,00 €, Otros 100,00 €"),
        reg(mesA(1), "Neil", "Registra aportación", "Neil · 360,00 €"),
        reg(mesA(2), "Marta", "Declara aportación", "240,00 € (enlace)"),
        reg(mesA(2), "Neil", "Confirma aportación", "Marta · 240,00 €"),
        reg(mesA(3), "Neil", "Añade gasto del presupuesto", "Cuota del colegio · 250,00 € · Colegio"),
        reg(mesA(24), "Neil", "Propone extra", "Gafas graduadas · 180,00 €"),
        reg(mesA(25), "Marta", "Aprueba extra", "Gafas graduadas · 180,00 € (enlace)"),
        reg(esteMes(2), "Marta", "Propone extra", "Consola de videojuegos · 320,00 € (enlace)"),
        reg(esteMes(3), "Neil", "Rechaza extra", "Consola de videojuegos · 320,00 € · «Mejor como regalo de cada uno, no a medias» (cuenta)"),
        reg(esteMes(5), "Marta", "Propone extra", "Campamento de verano · 450,00 € (enlace)")
      ]
    };
  }

  function semilla() {
    const M = ["yo", "ana", "pedro", "juan", "sofi"];
    const todos = M.slice();
    const nombresFicticios = ["Lucía M.", "Carlos R.", "Marta G.", "Javier P.", "Elena S.", "Pablo D.", "Sara L.", "Diego F.", "Laura C.",
      "Andrés V.", "Paula T.", "Hugo B.", "Irene N.", "Álvaro Q.", "Nuria H.", "Raúl J.", "Clara O.", "Iván K."];
    const usuarios = [{ id: YO, email: "demo@saldamos.app", nombre: "Neil", rol: "admin", plan: "premium", ingresos_mensuales: 260000, estado: "activo", creado: hace(40), ultimo_acceso: hace(0), email_confirmado: true, n_tareas: 0, n_gastos: 0 }];
    nombresFicticios.forEach(function (n, i) {
      usuarios.push({
        id: "u" + i, email: n.toLowerCase().replace(/[^a-z]/g, "") + "@ejemplo.com", nombre: n, rol: "usuario",
        estado: i === 6 ? "bloqueado" : "activo", creado: hace((i * 7) % 29 + 1), ultimo_acceso: i % 4 === 3 ? null : hace(i % 9),
        email_confirmado: i % 5 !== 4, n_tareas: (i * 3) % 11, n_gastos: (i * 5) % 17
      });
    });
    return {
      sesion: null,
      usuarios: usuarios,
      tareas: [
        { id: id(), user_id: YO, texto: "Pagar la reserva del hotel", fecha: dia(-1), hora: null, hecha: false, avisada: true, creada: hace(3) },
        { id: id(), user_id: YO, texto: "Revisar la propuesta de garantía extendida", fecha: dia(0), hora: "17:00:00", hecha: false, avisada: false, creada: hace(2) },
        { id: id(), user_id: YO, texto: "Llamar al seguro del coche", fecha: dia(3), hora: null, hecha: false, avisada: false, creada: hace(2) },
        { id: id(), user_id: YO, texto: "Cena de equipo", fecha: dia(8), hora: "21:00:00", hecha: false, avisada: false, creada: hace(1) },
        { id: id(), user_id: YO, texto: "Comprar las entradas del concierto", fecha: null, hora: null, hecha: true, avisada: false, creada: hace(9), token: "Kp3vX9-entrada" },
        { id: id(), user_id: YO, texto: "Enviar a Laura el presupuesto de la reforma", fecha: dia(-1), hora: null, hecha: true, avisada: true, creada: hace(4),
          para: "Laura", telefono: "", resumen: "Enviado por email con el desglose por partidas y dos opciones de cocina.", completada: hace(1), cierre_enviado: hace(1),
          conformidad: { estado: "conforme", comentario: "¡Perfecto, gracias!", fecha: dia(0) + "T10:15" }, token: "Lr7qZ2_reforma" },
        { id: id(), user_id: YO, texto: "Reservar la pista de pádel para el sábado", fecha: dia(0), hora: null, hecha: true, avisada: true, creada: hace(2),
          para: "Carlos", telefono: "", resumen: "Reservada la pista 3 de 11:00 a 12:30. Pagado.", completada: hace(0.1), cierre_enviado: hace(0.1),
          conformidad: null, token: "Pd4mW8-padel01" }
      ],
      gastos: [
        { id: id(), user_id: YO, concepto: "Cena con amigos", fecha: dia(-2), categoria: "Comida", creado: hace(2), lineas: [
          { item: "Mi parte", persona: "", importe: 4000, tipo: "mio", saldado: false },
          { item: "Parte de Juan", persona: "Juan", importe: 4000, tipo: "me-debe", saldado: false },
          { item: "Parte de Laura", persona: "Laura", importe: 4000, tipo: "me-debe", saldado: false }] },
        { id: id(), user_id: YO, concepto: "Entradas de cine (pagó Laura)", fecha: dia(-1), categoria: "Ocio", creado: hace(1), lineas: [
          { item: "Mi entrada", persona: "Laura", importe: 950, tipo: "le-debo", saldado: false }] },
        { id: id(), user_id: YO, concepto: "Compra del supermercado", fecha: dia(-4), categoria: "Hogar", creado: hace(4), lineas: [
          { item: "Alimentación", persona: "", importe: 6235, tipo: "mio", saldado: false },
          { item: "Limpieza", persona: "", importe: 1480, tipo: "mio", saldado: false }] },
        { id: id(), user_id: YO, concepto: "Compra del mes", fecha: mesAtras(2, 5), categoria: "Hogar", creado: hace(60), lineas: [
          { item: "Mi parte", persona: "", importe: 11200, tipo: "mio", saldado: false }] },
        { id: id(), user_id: YO, concepto: "Cenas y comidas", fecha: mesAtras(2, 11), categoria: "Comida", creado: hace(60), lineas: [
          { item: "Mi parte", persona: "", importe: 5400, tipo: "mio", saldado: false }] },
        { id: id(), user_id: YO, concepto: "Planes de ocio", fecha: mesAtras(2, 17), categoria: "Ocio", creado: hace(60), lineas: [
          { item: "Mi parte", persona: "", importe: 3200, tipo: "mio", saldado: false }] },
        { id: id(), user_id: YO, concepto: "Compra del mes", fecha: mesAtras(3, 5), categoria: "Hogar", creado: hace(90), lineas: [
          { item: "Mi parte", persona: "", importe: 9800, tipo: "mio", saldado: false }] },
        { id: id(), user_id: YO, concepto: "Cenas y comidas", fecha: mesAtras(3, 11), categoria: "Comida", creado: hace(90), lineas: [
          { item: "Mi parte", persona: "", importe: 7600, tipo: "mio", saldado: false }] },
        { id: id(), user_id: YO, concepto: "Abono transporte", fecha: mesAtras(3, 17), categoria: "Transporte", creado: hace(90), lineas: [
          { item: "Mi parte", persona: "", importe: 2000, tipo: "mio", saldado: false }] },
        { id: id(), user_id: YO, concepto: "Planes de ocio", fecha: mesAtras(3, 23), categoria: "Ocio", creado: hace(90), lineas: [
          { item: "Mi parte", persona: "", importe: 6400, tipo: "mio", saldado: false }] },
        { id: id(), user_id: YO, concepto: "Compra del mes", fecha: mesAtras(4, 5), categoria: "Hogar", creado: hace(120), lineas: [
          { item: "Mi parte", persona: "", importe: 10400, tipo: "mio", saldado: false }] },
        { id: id(), user_id: YO, concepto: "Cenas y comidas", fecha: mesAtras(4, 11), categoria: "Comida", creado: hace(120), lineas: [
          { item: "Mi parte", persona: "", importe: 4300, tipo: "mio", saldado: false }] },
        { id: id(), user_id: YO, concepto: "Abono transporte", fecha: mesAtras(4, 17), categoria: "Transporte", creado: hace(120), lineas: [
          { item: "Mi parte", persona: "", importe: 2000, tipo: "mio", saldado: false }] },
        { id: id(), user_id: YO, concepto: "Compra del mes", fecha: mesAtras(5, 5), categoria: "Hogar", creado: hace(150), lineas: [
          { item: "Mi parte", persona: "", importe: 9900, tipo: "mio", saldado: false }] },
        { id: id(), user_id: YO, concepto: "Cenas y comidas", fecha: mesAtras(5, 11), categoria: "Comida", creado: hace(150), lineas: [
          { item: "Mi parte", persona: "", importe: 6100, tipo: "mio", saldado: false }] },
        { id: id(), user_id: YO, concepto: "Farmacia", fecha: mesAtras(5, 17), categoria: "Salud", creado: hace(150), lineas: [
          { item: "Mi parte", persona: "", importe: 2500, tipo: "mio", saldado: false }] },
        { id: id(), user_id: YO, concepto: "Abono transporte", fecha: mesAtras(5, 23), categoria: "Transporte", creado: hace(150), lineas: [
          { item: "Mi parte", persona: "", importe: 2000, tipo: "mio", saldado: false }] },
        { id: id(), user_id: YO, concepto: "Compra grande del mes", fecha: mesPasado(6), categoria: "Hogar", creado: hace(35), lineas: [
          { item: "Mi parte", persona: "", importe: 9800, tipo: "mio", saldado: false }] },
        { id: id(), user_id: YO, concepto: "Cumpleaños de Carlos", fecha: mesPasado(14), categoria: "Comida", creado: hace(28), lineas: [
          { item: "Mi parte", persona: "", importe: 3500, tipo: "mio", saldado: false }] },
        { id: id(), user_id: YO, concepto: "Abono transporte", fecha: mesPasado(2), categoria: "Transporte", creado: hace(38), lineas: [
          { item: "Mi parte", persona: "", importe: 2000, tipo: "mio", saldado: false }] },
        { id: id(), user_id: YO, concepto: "Taxi al aeropuerto", fecha: dia(-3), categoria: "Transporte", creado: hace(3), lineas: [
          { item: "Mi parte", persona: "", importe: 1750, tipo: "mio", saldado: false },
          { item: "Parte de Marta", persona: "Marta", importe: 1750, tipo: "me-debe", saldado: true }] }
      ],
      grupos: [
        {
          id: "g-acdc", user_id: YO, nombre: "Viaje concierto AC/DC", token: TOKEN_ACDC, compartido: true, creado: hace(6), actualizado: hace(0),
          miembros: [{ id: "yo", nombre: "Neil", telefono: "", iban: "ES9121000418450200051332", mostrar_cobro: true, yo: true }, { id: "ana", nombre: "Ana", telefono: "" }, { id: "pedro", nombre: "Pedro", telefono: "" },
                     { id: "juan", nombre: "Juan", telefono: "" }, { id: "sofi", nombre: "Sofi", telefono: "" }],
          gastos: [
            { id: id(), concepto: "Entradas AC/DC", fecha: dia(-6), importe: 47500, pagos: [{ miembro: "yo", importe: 47500 }], reparto: { modo: "iguales", miembros: todos } },
            { id: id(), concepto: "Hotel (2 noches)", fecha: dia(-3), importe: 40000, pagos: [{ miembro: "ana", importe: 32000 }, { miembro: "pedro", importe: 8000 }], reparto: { modo: "iguales", miembros: todos } },
            { id: id(), concepto: "Bencina", fecha: dia(-3), importe: 9000, pagos: [{ miembro: "juan", importe: 9000 }], reparto: { modo: "iguales", miembros: ["yo", "ana", "juan"] } },
            { id: id(), concepto: "Restaurante", fecha: dia(-2), importe: 25000, pagos: [{ miembro: "sofi", importe: 12500 }, { miembro: "yo", importe: 12500 }],
              reparto: { modo: "importes", importes: { yo: 6000, ana: 4000, pedro: 5000, juan: 5000, sofi: 5000 } } }
          ],
          liquidaciones: [],
          avisos: [{ id: "av1", de: "juan", a: "yo", importe: 16500, fecha: dia(0) }]
        },
        grupoNinos(),
        {
          id: "g-cumple", user_id: YO, nombre: "Regalo cumpleaños de Marta", token: "Cumple-Marta26", compartido: true, creado: hace(2), actualizado: hace(2),
          miembros: [{ id: "yo", nombre: "Neil", telefono: "", yo: true }, { id: "l", nombre: "Laura", telefono: "" }, { id: "c", nombre: "Carlos", telefono: "" }, { id: "e", nombre: "Elena", telefono: "" }],
          gastos: [{ id: id(), concepto: "Regalo", fecha: dia(-2), importe: 12000, pagos: [{ miembro: "l", importe: 12000 }], reparto: { modo: "iguales", miembros: ["yo", "l", "c", "e"] } }],
          liquidaciones: [],
          avisos: []
        },
        {
          // PROTOTIPO «Modo pareja / hogar»: reparto 60/40 y gastos fijos
          id: "g-casa", user_id: YO, nombre: "Casa (Neil y Laura)", token: "Casa-Neil-Lau1", compartido: false, creado: hace(60), actualizado: hace(1),
          hogar: true,
          miembros: [{ id: "yo", nombre: "Neil", telefono: "", yo: true }, { id: "lau", nombre: "Laura", telefono: "" }],
          fijos: [
            { id: "f1", concepto: "Alquiler", importe: 110000, dia: 1, pagador: "yo" },
            { id: "f2", concepto: "Luz y gas", importe: 9000, dia: 10, pagador: "lau" },
            { id: "f3", concepto: "Internet y móviles", importe: 5500, dia: 5, pagador: "yo" }
          ],
          gastos: [
            { id: id(), concepto: "Alquiler", fecha: dia(-30), importe: 110000, pagos: [{ miembro: "yo", importe: 110000 }], reparto: { modo: "porcentaje", porcentajes: { yo: 60, lau: 40 } } },
            { id: id(), concepto: "Súper semanal", fecha: dia(-4), importe: 8640, pagos: [{ miembro: "lau", importe: 8640 }], reparto: { modo: "porcentaje", porcentajes: { yo: 60, lau: 40 } } }
          ],
          liquidaciones: [], avisos: []
        },
        {
          // PROTOTIPO «Metas de ahorro en grupo» + «Amigos de Europa» (MB WAY / Wero)
          id: "g-lisboa", user_id: YO, nombre: "Lisboa 2027", token: "Lisboa-2027-Pt", compartido: true, creado: hace(20), actualizado: hace(1),
          meta: { por_persona: 60000, fecha: "2027-06-15", aportado: { yo: 42000, rui: 51000, ines: 18000, ana: 30000 } },
          miembros: [{ id: "yo", nombre: "Neil", telefono: "", yo: true, app: "Bizum" }, { id: "rui", nombre: "Rui", telefono: "", app: "MB WAY", idioma: "pt" },
                     { id: "ines", nombre: "Inês", telefono: "", app: "MB WAY", idioma: "pt" }, { id: "ana", nombre: "Ana", telefono: "", app: "Wero" }],
          gastos: [
            { id: id(), concepto: "Reserva del apartamento (señal)", fecha: dia(-10), importe: 32000, pagos: [{ miembro: "rui", importe: 32000 }], reparto: { modo: "iguales", miembros: ["yo", "rui", "ines", "ana"] } }
          ],
          liquidaciones: [], avisos: []
        }
      ],
      sugerencias: [
        { id: id(), user_id: "u0", tipo: "idea", puntuacion: 5, texto: "Me encanta que mis amigos no tengan que instalar nada. ¿Podríais añadir varias monedas para el viaje a Londres?", pagina: "grupos", estado: "nueva", creado: hace(0.2) },
        { id: id(), user_id: "u3", tipo: "problema", puntuacion: 3, texto: "Me equivoqué en el importe del hotel y tuve que borrar el gasto y crearlo otra vez.", pagina: "grupos", estado: "nueva", creado: hace(1) },
        { id: id(), user_id: "u5", tipo: "idea", puntuacion: 4, texto: "Estaría genial hacer una foto al ticket y que cada uno marque lo suyo.", pagina: "gastos", estado: "revisada", creado: hace(2) },
        { id: id(), user_id: "u8", tipo: "elogio", puntuacion: 5, texto: "La calculadora es justo lo que necesitaba en la cena de empresa.", pagina: "calculadora", estado: "revisada", creado: hace(3) },
        { id: id(), user_id: "u1", tipo: "pregunta", puntuacion: null, texto: "¿Se puede usar sin conexión cuando estoy de viaje?", pagina: "grupos", estado: "nueva", creado: hace(4) }
      ],
      // Deudas y créditos de ejemplo (préstamo, crédito, compras en cuotas)
      deudas: [
        { id: "dd-coche", user_id: YO, nombre: "Préstamo coche", tipo: "prestamo", entidad: "Banco Ejemplo", importe_original: 1500000, saldo: 845000 - 27420, cuota: 32000, tae: 6.5, dia_pago: 5, activa: true, creado: hace(400),
          pagos: [{ fecha: dia(-1).slice(0, 8) + "05", importe: 32000, capital: 27420, interes: 4580 }] },
        { id: "dd-cocina", user_id: YO, nombre: "Reforma de la cocina", tipo: "consumo", entidad: "Financiera Ejemplo", importe_original: 600000, saldo: 420000, cuota: 18000, tae: 8.9, dia_pago: 10, activa: true, creado: hace(300), pagos: [] },
        { id: "dd-movil", user_id: YO, nombre: "Móvil en 12 cuotas", tipo: "tarjeta", entidad: "Tarjeta de crédito", importe_original: 54000, saldo: 27000, cuota: 4500, tae: 0, dia_pago: 15, activa: true, creado: hace(200), pagos: [] },
        { id: "dd-sofa", user_id: YO, nombre: "Sofá (crédito de la tienda)", tipo: "comercial", entidad: "Tienda de muebles", importe_original: 99000, saldo: 49500, cuota: 5500, tae: 0, dia_pago: 25, activa: true, creado: hace(100), pagos: [] }
      ],
      // Movimientos simulados del banco (para enseñar la importación automática)
      banco: [
        { id: "b1", fecha: dia(0), comercio: "Restaurante La Tasca", metodo: "Apple Pay", importe: -8600, categoria: "Comida", estado: "" },
        { id: "b2", fecha: dia(0), comercio: "Bizum recibido de Pedro · «ACDC»", metodo: "Bizum", importe: 14500, categoria: "", estado: "", de: "Pedro" },
        { id: "b3", fecha: dia(-1), comercio: "Gasolinera Autovía Sur", metodo: "Google Pay", importe: -6240, categoria: "Transporte", estado: "" },
        { id: "b4", fecha: dia(-1), comercio: "Supermercado del barrio", metodo: "Bizum Pay", importe: -4815, categoria: "Hogar", estado: "" },
        { id: "b5", fecha: dia(-2), comercio: "Farmacia Central", metodo: "Tarjeta", importe: -1290, categoria: "Salud", estado: "" },
        { id: "b6", fecha: dia(-2), comercio: "Bizum enviado a Laura · «Regalo Marta»", metodo: "Bizum", importe: -3000, categoria: "", estado: "", a: "Laura" }
      ]
    };
  }

  let S;
  try { S = JSON.parse(localStorage.getItem(CLAVE)); } catch (e) { S = null; }
  if (!S || !S.usuarios || !S.sugerencias || !S.version2 || !S.version4 || !S.version7 || !S.version8 || !S.version9) { S = semilla(); S.version2 = true; S.version4 = true; S.version5 = true; S.version6 = true; S.version7 = true; S.version8 = true; S.version9 = true; }
  // TPV de pruebas de Redsys conectado para Neil: así se ve «Pagar con Bizum Pay» en sus grupos
  if (!S.pagos_bizum) S.pagos_bizum = [];
  if (S.tpv === undefined) S.tpv = { comercio: "999008881", terminal: "1", clave: "sq7HjrUOBfKmC576ILgskD5srU870gJ7", entorno: "pruebas", activo: true, actualizado: new Date().toISOString() };
  function guardar() { try { localStorage.setItem(CLAVE, JSON.stringify(S)); } catch (e) {} }
  S.tareas.forEach(function (t) { if (!t.token) t.token = (id() + id()).replace(/[^a-z0-9]/g, "").slice(-14); });
  guardar();

  const espera = function (v) { return new Promise(function (r) { setTimeout(function () { r(v); }, 120); }); };
  const copia = function (x) { return JSON.parse(JSON.stringify(x)); };
  const yoUser = function () { return S.usuarios.find(function (u) { return u.id === YO; }); };

  // ---- Constructor de consultas compatible con supabase-js ----
  function consulta(tabla) {
    let op = "select", datos = null, filtros = [], uno = false;
    const q = {
      select: function () { return q; },
      eq: function (k, v) { filtros.push([k, v]); return q; },
      order: function () { return q; },
      insert: function (d) { op = "insert"; datos = d; return q; },
      update: function (d) { op = "update"; datos = d; return q; },
      delete: function () { op = "delete"; return q; },
      single: function () { uno = true; return q; },
      maybeSingle: function () { uno = true; return q; },
      then: function (ok, ko) { return espera(ejecutar()).then(ok, ko); }
    };
    function ejecutar() {
      if (!S.sesion) return { data: null, error: { message: "No hay sesión" } };
      if (tabla === "perfiles") {
        const u = yoUser();
        if (op === "update") { if (datos && "ingresos_mensuales" in datos) u.ingresos_mensuales = datos.ingresos_mensuales; guardar(); return { data: null, error: null }; }
        return { data: { id: u.id, email: u.email, nombre: u.nombre, rol: u.rol, estado: u.estado, creado: u.creado, acepta_privacidad_en: u.creado, ingresos_mensuales: u.ingresos_mensuales == null ? null : u.ingresos_mensuales, plan: u.plan || "gratis" }, error: null };
      }
      const filas = S[tabla];
      // En "sugerencias" el usuario de la demo es administrador: ve todas
      const cumple = function (f) { return (tabla === "sugerencias" || f.user_id === YO) && filtros.every(function (x) { return f[x[0]] === x[1]; }); };
      if (op === "select") { const r = filas.filter(cumple).map(copia); return { data: uno ? (r[0] || null) : r, error: null }; }
      if (op === "insert") {
        const lista = Array.isArray(datos) ? datos : [datos];
        const nuevas = lista.map(function (d) {
          const f = Object.assign({ id: id(), user_id: YO, creado: new Date().toISOString(), creada: new Date().toISOString(), actualizado: new Date().toISOString() }, copia(d));
          if (tabla === "grupos") { f.token = f.token || (id() + id()).replace(/[^a-z0-9]/g, "").slice(-14); if (f.compartido == null) f.compartido = true; f.gastos = f.gastos || []; f.liquidaciones = f.liquidaciones || []; f.avisos = f.avisos || []; }
          if (tabla === "tareas" && f.hora && f.hora.length === 5) f.hora += ":00";
          if (tabla === "tareas" && !f.token) f.token = (id() + id()).replace(/[^a-z0-9]/g, "").slice(-14);
          if (tabla === "sugerencias") f.estado = "nueva";
          filas.push(f); return f;
        });
        guardar();
        return { data: uno ? copia(nuevas[0]) : null, error: null };
      }
      if (op === "update") {
        filas.filter(cumple).forEach(function (f) { Object.assign(f, copia(datos)); f.actualizado = new Date().toISOString(); });
        guardar(); return { data: null, error: null };
      }
      if (op === "delete") { S[tabla] = filas.filter(function (f) { return !cumple(f); }); guardar(); return { data: null, error: null }; }
    }
    return q;
  }

  // ---- Funciones (rpc) ----
  function rpc(nombre, a) {
    a = a || {};
    if (nombre === "grupo_publico") {
      const g = S.grupos.find(function (x) { return x.token === a.t && x.compartido; });
      return espera({ data: g ? { nombre: g.nombre, miembros: g.miembros.map(function (m) {
          const x = { id: m.id, nombre: m.nombre, yo: m.yo, app: m.app, idioma: m.idioma };
          if (m.mostrar_cobro) { if (m.telefono) x.telefono = m.telefono; if (m.iban) x.iban = m.iban; }
          return x;
        }),
        gastos: copia(g.gastos), liquidaciones: copia(g.liquidaciones), avisos: copia(g.avisos || []),
        presupuesto: g.presupuesto ? copia(g.presupuesto) : null, aportes: copia(g.aportes || []), registro: copia(g.registro || []),
        yo_miembro: (S.sesion && g.vinculo) || null, bizum_pay: !!(S.tpv && S.tpv.activo), actualizado: g.actualizado } : null, error: null });
    }
    if (nombre === "tarea_publica") {
      const ta = S.tareas.find(function (x) { return x.token === a.t; });
      return espera({ data: ta ? { texto: ta.texto, resumen: ta.resumen || null, para: ta.para || null, hecha: ta.hecha, completada: ta.completada || null,
        conformidad: ta.conformidad || null, de: yoUser().nombre } : null, error: null });
    }
    if (nombre === "tarea_conformidad") {
      const ta = S.tareas.find(function (x) { return x.token === a.t && x.hecha; });
      if (!ta) return espera({ data: null, error: { message: "Enlace no válido" } });
      if (a.estado === "comentario" && !a.comentario) return espera({ data: null, error: { message: "Escribe el comentario" } });
      ta.conformidad = { estado: a.estado, comentario: a.comentario || null, fecha: new Date().toISOString().slice(0, 16) };
      guardar(); return espera({ data: { ok: true }, error: null });
    }
    if (nombre === "grupo_avisar_pago") {
      const g = S.grupos.find(function (x) { return x.token === a.t && x.compartido; });
      if (!g) return espera({ data: null, error: { message: "Enlace no válido" } });
      g.avisos = g.avisos || [];
      if (!g.avisos.some(function (v) { return v.de === a.de && v.a === a.a; }))
        g.avisos.push({ id: id(), de: a.de, a: a.a, importe: a.importe, fecha: new Date().toISOString().slice(0, 10) });
      guardar(); return espera({ data: { ok: true }, error: null });
    }
    if (nombre === "bizum_estado") {
      const pb = S.pagos_bizum.find(function (x) { return x.pedido === a.pedido && x.token === a.t; });
      return espera({ data: pb ? pb.estado : null, error: null });
    }
    if (nombre === "grupo_decidir" || nombre === "grupo_proponer_extra" || nombre === "grupo_declarar_aporte" || nombre === "grupo_vincular") {
      const g = S.grupos.find(function (x) { return x.token === a.t && x.compartido; });
      const mal = function (m) { return espera({ data: null, error: { message: m } }); };
      if (!g) return mal("Enlace no válido");
      const quien = (S.sesion && g.vinculo) || a.miembro;
      const via = S.sesion && g.vinculo ? "cuenta" : "enlace";
      if (!g.miembros.some(function (m) { return m.id === quien; })) return mal("Persona no válida");
      const nm = function (mid) { const m = g.miembros.find(function (x) { return x.id === mid; }); return m ? m.nombre : "?"; };
      const eur = function (c) { return (c / 100).toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 }); };
      const ahora = function () { const d = new Date(); return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 19); };
      const anotar = function (accion, detalle) { g.registro = (g.registro || []).concat([{ fecha: ahora(), quien: nm(quien), accion: accion, detalle: detalle }]); g.actualizado = new Date().toISOString(); guardar(); };
      if (nombre !== "grupo_vincular" && !g.presupuesto) return mal("Este grupo no tiene presupuesto");
      if (nombre === "grupo_decidir") {
        if (a.decision === "rechazado" && !String(a.comentario || "").trim()) return mal("Explica por qué lo rechazas");
        const x = g.gastos.find(function (y) { return y.id === a.gasto; });
        if (!x) return mal("Gasto no encontrado");
        if (x.estado !== "pendiente") return mal("Ese gasto ya está decidido");
        if (x.propuesto_por === quien) return mal("No puedes aprobar un gasto que propusiste tú");
        x.estado = a.decision; x.decision = { por: quien, fecha: ahora(), comentario: String(a.comentario || "").slice(0, 300), via: via };
        anotar(a.decision === "aprobado" ? "Aprueba extra" : "Rechaza extra", x.concepto + " · " + eur(x.importe) + " €" + (a.comentario ? " · «" + a.comentario + "»" : "") + " (" + via + ")");
      }
      if (nombre === "grupo_proponer_extra") {
        if (!String(a.concepto || "").trim()) return mal("Escribe el concepto");
        if (!(a.importe > 0)) return mal("Importe no válido");
        g.gastos.push({ id: id(), concepto: a.concepto.trim(), fecha: a.fecha, importe: a.importe, pagos: [{ miembro: a.pagado_por, importe: a.importe }],
          reparto: { modo: "porcentaje", porcentajes: copia(g.presupuesto.pct || {}) }, presupuesto: false, estado: "pendiente", propuesto_por: quien, nota: a.comentario || "", via: via });
        anotar("Propone extra", a.concepto.trim() + " · " + eur(a.importe) + " € (" + via + ")");
      }
      if (nombre === "grupo_declarar_aporte") {
        if (!(a.importe > 0)) return mal("Importe no válido");
        g.aportes = (g.aportes || []).concat([{ id: id(), miembro: quien, importe: a.importe, fecha: a.fecha, nota: a.nota || "", estado: "pendiente", via: via }]);
        anotar("Declara aportación", eur(a.importe) + " € (" + via + ")");
      }
      if (nombre === "grupo_vincular") {
        if (!S.sesion) return mal("Tienes que entrar con tu cuenta");
        const m = g.miembros.find(function (x) { return x.id === a.miembro; });
        if (!m || m.yo) return mal("Persona no válida");
        g.vinculo = a.miembro;
        anotar("Vincula su cuenta", "Demo: simulas ser " + m.nombre + " con su propia cuenta");
      }
      return espera({ data: { ok: true }, error: null });
    }
    if (!S.sesion) return espera({ data: null, error: { message: "No autorizado" } });
    const yo = yoUser();
    yo.n_tareas = S.tareas.length; yo.n_gastos = S.gastos.length;
    if (nombre === "mi_tpv") return espera({ data: S.tpv ? { comercio: S.tpv.comercio, terminal: S.tpv.terminal, entorno: S.tpv.entorno, activo: S.tpv.activo, clave_fin: S.tpv.clave.slice(-4), actualizado: S.tpv.actualizado } : null, error: null });
    if (nombre === "guardar_tpv") {
      if (!S.tpv && !a.clave) return espera({ data: null, error: { message: "Escribe la clave de tu TPV" } });
      S.tpv = { comercio: a.comercio, terminal: a.terminal || "1", clave: a.clave || S.tpv.clave, entorno: a.entorno, activo: !!a.activo, actualizado: new Date().toISOString() };
      guardar(); return espera({ data: { ok: true }, error: null });
    }
    if (nombre === "borrar_tpv") { S.tpv = null; guardar(); return espera({ data: null, error: null }); }
    if (nombre === "admin_estadisticas") {
      const n = function (f) { return S.usuarios.filter(f).length; };
      const lim = function (d) { return Date.now() - d * 86400000; };
      const porDia = {};
      S.usuarios.forEach(function (u) { if (Date.parse(u.creado) > lim(30)) { const k = u.creado.slice(0, 10); porDia[k] = (porDia[k] || 0) + 1; } });
      return espera({ data: {
        usuarios: S.usuarios.length, nuevos_7d: n(function (u) { return Date.parse(u.creado) > lim(7); }), nuevos_30d: n(function (u) { return Date.parse(u.creado) > lim(30); }),
        activos_7d: n(function (u) { return u.ultimo_acceso && Date.parse(u.ultimo_acceso) > lim(7); }), bloqueados: n(function (u) { return u.estado === "bloqueado"; }),
        sin_confirmar: n(function (u) { return !u.email_confirmado; }),
        tareas: S.usuarios.reduce(function (s, u) { return s + u.n_tareas; }, 0), gastos: S.usuarios.reduce(function (s, u) { return s + u.n_gastos; }, 0), grupos: S.grupos.length + 23,
        altas_por_dia: Object.keys(porDia).map(function (k) { return { dia: k, n: porDia[k] }; })
      }, error: null });
    }
    if (nombre === "admin_listar_usuarios") return espera({ data: copia(S.usuarios).sort(function (x, y) { return y.creado.localeCompare(x.creado); }), error: null });
    if (nombre === "admin_cambiar_estado" || nombre === "admin_cambiar_rol") {
      if (a.usuario === YO) return espera({ data: null, error: { message: "No puedes cambiarte a ti mismo" } });
      const u = S.usuarios.find(function (x) { return x.id === a.usuario; });
      if (nombre === "admin_cambiar_estado") u.estado = a.nuevo_estado; else u.rol = a.nuevo_rol;
      guardar(); return espera({ data: null, error: null });
    }
    if (nombre === "grupo_nuevo_enlace") {
      const g = S.grupos.find(function (x) { return x.id === a.grupo; });
      g.token = (id() + id()).replace(/[^a-z0-9]/g, "").slice(-14); guardar();
      return espera({ data: g.token, error: null });
    }
    if (nombre === "borrar_mi_cuenta") { localStorage.removeItem(CLAVE); S = semilla(); guardar(); return espera({ data: null, error: null }); }
    return espera({ data: null, error: null });
  }

  const auth = {
    getSession: function () { return Promise.resolve({ data: { session: S.sesion } }); },
    signInWithPassword: function () { S.sesion = { user: { id: YO, email: yoUser().email } }; guardar(); return espera({ data: { session: S.sesion }, error: null }); },
    signUp: function (o) {
      const u = yoUser(); if (o && o.options && o.options.data && o.options.data.nombre) u.nombre = o.options.data.nombre;
      S.sesion = { user: { id: YO, email: u.email } }; guardar(); return espera({ data: { session: S.sesion }, error: null });
    },
    signOut: function () { S.sesion = null; guardar(); return espera({ error: null }); },
    onAuthStateChange: function () { return { data: { subscription: { unsubscribe: function () {} } } }; },
    resetPasswordForEmail: function () { return espera({ error: null }); },
    updateUser: function () { return espera({ error: null }); }
  };

  window.supabase = { createClient: function () { return { auth: auth, from: consulta, rpc: rpc }; } };

  // API pequeña para la simulación del banco
  window.DemoBanco = {
    movimientos: function () { return copia(S.banco); },
    marcar: function (idMov, estado) { const m = S.banco.find(function (x) { return x.id === idMov; }); if (m) { m.estado = estado; guardar(); } },
    reiniciar: function () { localStorage.removeItem(CLAVE); location.reload(); },
    tokenEjemplo: TOKEN_ACDC
  };

  // Simulación del paso por Bizum (en la web real lo hace Redsys + la app del banco)
  window.DemoBizum = {
    pagar: function (d) {
      const fondo = document.createElement("div"); fondo.className = "demo-bizum";
      const caja = document.createElement("div"); caja.className = "demo-bizum-caja"; caja.setAttribute("role", "dialog"); caja.setAttribute("aria-label", "Pago con Bizum (simulado)");
      fondo.appendChild(caja); document.body.appendChild(fondo);
      const eur = (d.importe / 100).toLocaleString("es-ES", { minimumFractionDigits: 2 }) + " €";
      const pedido = String(Date.now() % 10000).padStart(4, "0") + Math.random().toString(36).slice(2, 10).padEnd(8, "x");
      function salir(r) { location.href = "grupo.html?pedido=" + pedido + "&bizum=" + r + "#" + d.t; }
      function paso1() {
        caja.innerHTML = '<p class="demo-bizum-sim">Simulación de la pasarela Redsys · entorno de pruebas</p>' +
          '<p class="demo-bizum-marca">Pago con Bizum</p><p class="demo-bizum-imp"></p><p class="demo-bizum-a"></p>' +
          '<label class="etiqueta" for="db-movil">Tu móvil (el de Bizum)</label><input id="db-movil" type="tel" value="600 000 000">' +
          '<button type="button" class="bizum-pay" id="db-seguir">Continuar</button><button type="button" class="boton-sec" id="db-cancelar">Cancelar</button>';
        caja.querySelector(".demo-bizum-imp").textContent = eur;
        caja.querySelector(".demo-bizum-a").textContent = "Pago a " + (d.cobra || "quien cobra") + " · " + (d.grupo || "");
        caja.querySelector("#db-seguir").onclick = paso2; caja.querySelector("#db-cancelar").onclick = function () { salir("ko"); };
      }
      function paso2() {
        caja.innerHTML = '<p class="demo-bizum-sim">Simulación · así lo verías en el móvil</p><p class="demo-bizum-marca">Tu banco</p>' +
          '<p>Confirma el pago de <b></b> con tu huella o tu PIN de Bizum.</p>' +
          '<button type="button" class="bizum-pay" id="db-ok">Confirmar en mi banco</button><button type="button" class="boton-sec" id="db-no">Rechazar</button>';
        caja.querySelector("b").textContent = eur;
        caja.querySelector("#db-ok").onclick = function () {
          const g = S.grupos.find(function (x) { return x.token === d.t; });
          S.pagos_bizum.unshift({ pedido: pedido, token: d.t, user_id: YO, cobrador: YO, grupo_id: g.id, de: d.de, a: d.a, importe: d.importe, estado: "pagado", respuesta: "0000", autorizacion: "123456", creado: new Date().toISOString() });
          g.liquidaciones.push({ id: "bz" + pedido, de: d.de, a: d.a, importe: d.importe, fecha: new Date().toISOString().slice(0, 10), via: "bizum", pedido: pedido });
          g.avisos = (g.avisos || []).filter(function (v) { return !(v.de === d.de && v.a === d.a); });
          const nm = function (m) { const x = g.miembros.find(function (y) { return y.id === m; }); return x ? x.nombre : "?"; };
          if (g.registro) g.registro.push({ fecha: new Date().toISOString().slice(0, 19), quien: nm(d.de), accion: "Paga con Bizum Pay", detalle: eur + " a " + nm(d.a) + " · pedido " + pedido });
          g.actualizado = new Date().toISOString(); guardar();
          caja.innerHTML = '<p class="demo-bizum-marca">✓</p><p><b>Pago autorizado</b></p><p class="ayuda">Volviendo a Saldamos…</p>';
          setTimeout(function () { salir("ok"); }, 900);
        };
        caja.querySelector("#db-no").onclick = function () {
          S.pagos_bizum.unshift({ pedido: pedido, token: d.t, user_id: YO, cobrador: YO, de: d.de, a: d.a, importe: d.importe, estado: "fallido", respuesta: "9915", creado: new Date().toISOString() });
          guardar(); salir("ko");
        };
      }
      paso1();
    }
  };

  // Franja "DEMO" en todas las páginas (salvo las de cara al público: <body data-sin-franja>)
  document.addEventListener("DOMContentLoaded", function () {
    if (document.body.hasAttribute("data-sin-franja")) return;
    const b = document.createElement("div");
    b.className = "franja-demo";
    b.innerHTML = '<span><b>DEMO</b> · datos de ejemplo guardados solo en este navegador</span>' +
      '<span class="franja-acciones"><label class="franja-plan">Versión <select id="demo-plan" aria-label="Versión de Saldamos">' +
      '<option value="gratis">Gratis</option><option value="premium">Premium</option><option value="empresa">Empresas</option></select></label>' +
      '<a href="lab.html">Lab</a><button type="button" id="demo-reiniciar">Reiniciar datos</button></span>';
    document.body.prepend(b);
    const selPlan = document.getElementById("demo-plan");
    selPlan.value = yoUser().plan || "gratis";
    selPlan.addEventListener("change", function () {
      yoUser().plan = this.value; guardar();
      if (window.olvidarPlan) window.olvidarPlan();
      location.reload();
    });
    // Versión Empresas: la empresa patrocinadora regala Premium a su equipo o clientes (B2B2C)
    if (yoUser().plan === "empresa") {
      const marca = document.querySelector(".marca");
      if (marca) { const s = document.createElement("span"); s.className = "sello-sponsor"; s.textContent = "Premium incluido por Tu Empresa S.A."; marca.after(s); }
    }
    document.getElementById("demo-reiniciar").addEventListener("click", function () {
      if (this.dataset.c) { window.DemoBanco.reiniciar(); return; }
      this.dataset.c = "1"; this.textContent = "¿Seguro? Pulsa otra vez";
    });
  });
})();
