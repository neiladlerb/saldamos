// =====================================================================
//  Arranque de la app y menú "Mi cuenta":
//   · comprueba la sesión y el perfil (¿admin?, ¿bloqueado?)
//   · carga los datos y los refresca (al volver a la pestaña y cada minuto)
//   · descargar mis datos, cerrar sesión y borrar la cuenta (RGPD)
// =====================================================================
(async function iniciar() {
  const sesion = await exigirSesion();
  if (!sesion) return;

  const perfil = await miPerfil();
  document.getElementById("nombre-usuario").textContent = (perfil && perfil.nombre) || sesion.user.email;
  if (perfil && perfil.rol === "admin") document.getElementById("enlace-admin").hidden = false;

  if (perfil && perfil.estado === "bloqueado") {
    document.querySelectorAll("#app > header, #app > nav, #app > .panel").forEach(function (el) { el.hidden = true; });
    document.getElementById("bloqueado").hidden = false;
    return;
  }

  await Promise.all([cargarTodo(), cargarGrupos(), window.cargarDeudas ? cargarDeudas() : null]);
  // Mantener el móvil y el ordenador al día
  setInterval(function () { cargarTodo(); cargarGrupos(); if (window.cargarDeudas) cargarDeudas(); }, 60000);
  document.addEventListener("visibilitychange", function () {
    if (document.visibilityState === "visible") { cargarTodo(); cargarGrupos(); if (window.cargarDeudas) cargarDeudas(); }
  });
})();

// Si la sesión se cierra (en esta u otra pestaña), volvemos a la portada
sb.auth.onAuthStateChange(function (evento) {
  if (evento === "SIGNED_OUT") location.replace("acceso.html");
});

document.getElementById("b-salir").addEventListener("click", cerrarSesion);

// Descargar mis datos (derecho de acceso y portabilidad del RGPD)
document.getElementById("b-exportar").addEventListener("click", async function () {
  if (window.MODO_DEMO) { ponerEstadoSync("En la demo no se descargan archivos. En la versión real se descarga un archivo con todos tus datos.", "error"); return; }
  const [p, t, g, gr] = await Promise.all([
    sb.from("perfiles").select("email, nombre, creado, acepta_privacidad_en").maybeSingle(),
    sb.from("tareas").select("*"),
    sb.from("gastos").select("*"),
    sb.from("grupos").select("nombre, miembros, gastos, liquidaciones, creado")
  ]);
  if (p.error || t.error || g.error || gr.error) { ponerEstadoSync("No se pudieron exportar los datos", "error"); return; }
  const datos = { exportado: new Date().toISOString(), perfil: p.data, tareas: t.data, gastos: g.data, grupos: gr.data };
  const blob = new Blob([JSON.stringify(datos, null, 2)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "mis-datos-saldamos.json";
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(function () { URL.revokeObjectURL(a.href); }, 2000);
});

// Borrar la cuenta: dos pulsaciones para evitar sustos
const botonBorrar = document.getElementById("b-borrar-cuenta");
botonBorrar.addEventListener("click", async function () {
  if (!botonBorrar.dataset.confirmar) {
    botonBorrar.dataset.confirmar = "1";
    botonBorrar.textContent = "¿Seguro? Se borrará todo. Pulsa otra vez";
    setTimeout(function () { delete botonBorrar.dataset.confirmar; botonBorrar.textContent = "Borrar mi cuenta"; }, 5000);
    return;
  }
  botonBorrar.disabled = true;
  const { error } = await sb.rpc("borrar_mi_cuenta");
  if (error) { botonBorrar.disabled = false; ponerEstadoSync("No se pudo borrar la cuenta: " + traducirError(error), "error"); return; }
  await sb.auth.signOut();
  location.replace("acceso.html");
});
