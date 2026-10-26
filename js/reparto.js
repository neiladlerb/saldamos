// =====================================================================
//  REPARTO · las matemáticas de los grupos (sin pantallas ni base de datos)
//  Se usa en la app, en la página pública del grupo y en la calculadora.
//  Todo en CÉNTIMOS (números enteros) para que las sumas cuadren siempre.
// =====================================================================
(function (global) {
  const formato = new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR", useGrouping: "always" });
  function eur(c) { return formato.format((c || 0) / 100); }
  function aCentimos(texto) {
    // Acepta «1.100», «1.100,50», «12,5» o «12.50»
    let t = String(texto == null ? "" : texto).replace(/\s|€/g, "");
    if (/,\d{0,2}$/.test(t)) t = t.replace(/\./g, "").replace(",", ".");
    else if (/^-?\d{1,3}(\.\d{3})+$/.test(t)) t = t.replace(/\./g, "");
    else t = t.replace(/,/g, "");
    const n = parseFloat(t);
    return isNaN(n) ? 0 : Math.round(n * 100);
  }

  // Divide un total entre varias personas. Los céntimos que sobran se
  // reparten de uno en uno a los primeros, así la suma es exacta.
  // repartirIguales(1000, ["a","b","c"]) → {a: 334, b: 333, c: 333}
  function repartirIguales(total, ids) {
    const r = {};
    if (!ids.length) return r;
    const base = Math.floor(total / ids.length);
    let resto = total - base * ids.length;
    ids.forEach(function (id) { r[id] = base + (resto > 0 ? 1 : 0); if (resto > 0) resto--; });
    return r;
  }

  // Reparte por porcentajes (ej. pareja 60/40). Los céntimos sobrantes van a quien tiene más %.
  function repartirPorcentaje(total, porc) {
    const ids = Object.keys(porc).filter(function (k) { return porc[k] > 0; });
    const r = {}; let asignado = 0;
    ids.forEach(function (id) { r[id] = Math.floor(total * porc[id] / 100); asignado += r[id]; });
    let resto = total - asignado;
    if (Math.abs(sumaPorc(porc) - 100) < 0.01) {
      ids.slice().sort(function (a, b) { return porc[b] - porc[a]; }).forEach(function (id) { if (resto > 0) { r[id]++; resto--; } });
    }
    return r;
  }
  function sumaPorc(porc) { return Object.keys(porc).reduce(function (s, k) { return s + (porc[k] || 0); }, 0); }

  // Cuánto le toca pagar a cada uno de un gasto
  function cuotas(gasto) {
    const rep = gasto.reparto || {};
    if (rep.modo === "importes") return Object.assign({}, rep.importes || {});
    if (rep.modo === "porcentaje") return repartirPorcentaje(gasto.importe || 0, rep.porcentajes || {});
    return repartirIguales(gasto.importe || 0, rep.miembros || []);
  }

  // Cuánto adelantó cada uno en un gasto
  function pagos(gasto) {
    const r = {};
    (gasto.pagos || []).forEach(function (p) { r[p.miembro] = (r[p.miembro] || 0) + (p.importe || 0); });
    return r;
  }

  function suma(obj) { return Object.keys(obj).reduce(function (s, k) { return s + (obj[k] || 0); }, 0); }

  // Comprueba que un gasto tiene sentido antes de guardarlo
  function validarGasto(g) {
    if (!g.concepto) return "Escribe el concepto del gasto.";
    if (!(g.importe > 0)) return "Escribe el importe total.";
    if (!g.pagos || !g.pagos.length) return "Indica quién pagó.";
    if (suma(pagos(g)) !== g.importe) return "Lo pagado (" + eur(suma(pagos(g))) + ") no suma el total (" + eur(g.importe) + ").";
    if (g.reparto && g.reparto.modo === "porcentaje") {
      const sp = Math.round(sumaPorc(g.reparto.porcentajes || {}) * 100) / 100;
      if (Math.abs(sp - 100) >= 0.01) return "Los porcentajes suman " + String(sp).replace(".", ",") + " %, deben sumar 100 %.";
    }
    const c = cuotas(g);
    if (!Object.keys(c).length) return "Elige entre quiénes se reparte.";
    if (suma(c) !== g.importe) return "El reparto (" + eur(suma(c)) + ") no suma el total (" + eur(g.importe) + ").";
    return "";
  }

  // Un gasto «vigente» cuenta en las cuentas: no está pendiente de aprobar,
  // ni rechazado, ni anulado (módulo de presupuesto). Los gastos sin estado cuentan siempre.
  function vigente(g) { return !g.estado || g.estado === "aprobado"; }
  // Gastos que generan deudas entre personas. Los del presupuesto común no:
  // se pagan del bote o cuentan como aportación de quien los adelantó.
  function gastosDeuda(grupo) { return (grupo.gastos || []).filter(function (g) { return vigente(g) && !g.presupuesto; }); }

  // Saldo de cada miembro. neto > 0: le deben; neto < 0: debe.
  function saldos(grupo) {
    const s = {};
    (grupo.miembros || []).forEach(function (m) { s[m.id] = { pagado: 0, parte: 0, enviado: 0, recibido: 0, neto: 0 }; });
    function asegura(id) { if (!s[id]) s[id] = { pagado: 0, parte: 0, enviado: 0, recibido: 0, neto: 0 }; return s[id]; }
    gastosDeuda(grupo).forEach(function (g) {
      const p = pagos(g), c = cuotas(g);
      Object.keys(p).forEach(function (id) { asegura(id).pagado += p[id]; });
      Object.keys(c).forEach(function (id) { asegura(id).parte += c[id]; });
    });
    (grupo.liquidaciones || []).forEach(function (l) {
      asegura(l.de).enviado += l.importe;
      asegura(l.a).recibido += l.importe;
    });
    Object.keys(s).forEach(function (id) {
      const x = s[id];
      x.neto = x.pagado - x.parte + x.enviado - x.recibido;
    });
    return s;
  }

  // Plan con pocos pagos: el que más debe paga al que más le deben, y así
  // sucesivamente. Devuelve [{de, a, importe}]
  function plan(grupo) {
    const s = saldos(grupo);
    const deudores = [], acreedores = [];
    Object.keys(s).forEach(function (id) {
      if (s[id].neto < 0) deudores.push({ id: id, c: -s[id].neto });
      if (s[id].neto > 0) acreedores.push({ id: id, c: s[id].neto });
    });
    deudores.sort(function (a, b) { return b.c - a.c; });
    acreedores.sort(function (a, b) { return b.c - a.c; });
    const r = [];
    let i = 0, j = 0;
    while (i < deudores.length && j < acreedores.length) {
      const x = Math.min(deudores[i].c, acreedores[j].c);
      if (x > 0) r.push({ de: deudores[i].id, a: acreedores[j].id, importe: x });
      deudores[i].c -= x; acreedores[j].c -= x;
      if (deudores[i].c === 0) i++;
      if (acreedores[j].c === 0) j++;
    }
    return r;
  }

  function nombre(grupo, id) {
    if (id === "bote") return "el bote común";
    const m = (grupo.miembros || []).find(function (x) { return x.id === id; });
    return m ? m.nombre : "?";
  }
  function total(grupo) { return (grupo.gastos || []).filter(vigente).reduce(function (s, g) { return s + (g.importe || 0); }, 0); }

  // Detalle de una persona: qué le toca de cada gasto y qué adelantó
  function detalle(grupo, id) {
    const lineas = gastosDeuda(grupo).map(function (g) {
      return { concepto: g.concepto, parte: cuotas(g)[id] || 0, pagado: pagos(g)[id] || 0 };
    }).filter(function (l) { return l.parte || l.pagado; });
    const s = saldos(grupo)[id] || { pagado: 0, parte: 0, enviado: 0, recibido: 0, neto: 0 };
    const p = plan(grupo);
    return {
      lineas: lineas, saldo: s,
      paga: p.filter(function (x) { return x.de === id; }),
      cobra: p.filter(function (x) { return x.a === id; })
    };
  }

  // ---- Mensajes para WhatsApp (texto plano; *negrita* es formato de WhatsApp) ----
  // ---- Mensajes de WhatsApp ----
  // Reglas de diseño: cortos y escaneables, la cifra importante en *negrita*,
  // un solo llamado a la acción al final y el enlace limpio en su propia línea.
  // El detalle completo vive en el enlace, no en el mensaje.
  function limpio(url) { return String(url || "").replace(/^https?:\/\//, ""); }

  function mensajeGrupo(grupo, enlace) {
    const p = plan(grupo);
    const n = (grupo.miembros || []).length, ng = (grupo.gastos || []).length;
    let t = "📊 *" + grupo.nombre + "*\n";
    t += "Total " + eur(total(grupo)) + " · " + n + " personas · " + ng + " gasto" + (ng === 1 ? "" : "s") + "\n\n";
    if (!p.length) {
      t += "✅ Todo saldado. ¡Gracias a todos!\n";
    } else {
      t += "*Para quedar en paz:*\n";
      p.forEach(function (x) { t += "• " + nombre(grupo, x.de) + " → " + nombre(grupo, x.a) + ": *" + eur(x.importe) + "*\n"; });
    }
    if (enlace) t += "\nCada uno ve su parte y avisa cuando pague 👇\n" + limpio(enlace);
    return t;
  }

  function mensajePersona(grupo, id, enlace) {
    const d = detalle(grupo, id);
    const pagado = d.saldo.pagado + d.saldo.enviado - d.saldo.recibido;
    let t = "Hola " + nombre(grupo, id) + " 👋\n";
    t += "Cuentas de *" + grupo.nombre + "*\n\n";
    if (d.paga.length) {
      d.paga.forEach(function (x) { t += "Te toca pagar *" + eur(x.importe) + "* a " + nombre(grupo, x.a) + "\n"; });
      t += "_Tu parte: " + eur(d.saldo.parte) + " · ya pagaste: " + eur(pagado) + "_\n";
      // Si quien cobra eres tú, tus datos de cobro (el dinero va directo, nunca por la app)
      d.paga.forEach(function (x) {
        const acreedor = (grupo.miembros || []).find(function (m) { return m.id === x.a; });
        if (acreedor && acreedor.yo && (acreedor.telefono || acreedor.iban)) {
          t += "\n";
          if (acreedor.telefono) t += "💸 Bizum: " + acreedor.telefono + "\n";
          if (acreedor.iban) t += "🏦 IBAN: " + formatoIBAN(acreedor.iban) + "\n";
        }
      });
      if (enlace) t += "\nDetalle y botón «Ya he pagado» 👇\n" + limpio(enlace);
    } else if (d.cobra.length) {
      d.cobra.forEach(function (x) { t += nombre(grupo, x.de) + " te paga *" + eur(x.importe) + "*\n"; });
      if (enlace) t += "\nDetalle 👇\n" + limpio(enlace);
    } else {
      t += "✅ Estás en paz con el grupo.\n";
      if (enlace) t += "\nDetalle 👇\n" + limpio(enlace);
    }
    return t;
  }

  // Abre WhatsApp con el texto. Con teléfono va directo a esa persona;
  // sin teléfono, WhatsApp deja elegir el chat o el grupo.
  function enlaceWhatsApp(texto, telefono) {
    let tel = String(telefono || "").replace(/[^\d]/g, "");
    if (/^[679]\d{8}$/.test(tel)) tel = "34" + tel;   // móvil español sin prefijo
    return "https://wa.me/" + tel + "?text=" + encodeURIComponent(texto);
  }

  // ---- IBAN: limpiar, dar formato y comprobar el dígito de control (módulo 97) ----
  function limpiarIBAN(x) { return String(x || "").replace(/\s+/g, "").toUpperCase(); }
  function formatoIBAN(x) { return limpiarIBAN(x).replace(/(.{4})/g, "$1 ").trim(); }
  function ibanValido(x) {
    const i = limpiarIBAN(x);
    if (!/^[A-Z]{2}\d{2}[A-Z0-9]{10,30}$/.test(i)) return false;
    const reord = (i.slice(4) + i.slice(0, 4)).replace(/[A-Z]/g, function (c) { return String(c.charCodeAt(0) - 55); });
    let resto = 0;
    for (let k = 0; k < reord.length; k++) resto = (resto * 10 + Number(reord[k])) % 97;
    return resto === 1;
  }
  function concepto(grupo) { return "Saldamos · " + grupo.nombre; }

  function nuevoId() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }

  global.Reparto = {
    eur: eur, aCentimos: aCentimos, repartirIguales: repartirIguales, cuotas: cuotas, pagos: pagos,
    validarGasto: validarGasto, saldos: saldos, vigente: vigente, gastosDeuda: gastosDeuda, plan: plan, detalle: detalle, total: total, nombre: nombre,
    mensajeGrupo: mensajeGrupo, mensajePersona: mensajePersona, enlaceWhatsApp: enlaceWhatsApp, nuevoId: nuevoId,
    limpiarIBAN: limpiarIBAN, formatoIBAN: formatoIBAN, ibanValido: ibanValido, concepto: concepto
  };
})(typeof window !== "undefined" ? window : globalThis);
