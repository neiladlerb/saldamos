// =====================================================================
//  Código compartido por todas las páginas:
//   · crea la conexión con Supabase ("sb")
//   · funciones para saber quién ha iniciado sesión
// =====================================================================
(function () {
  const c = window.CONFIG || {};
  if (!window.MODO_DEMO && (!c.SUPABASE_URL || c.SUPABASE_URL.indexOf("TU-PROYECTO") !== -1)) {
    document.addEventListener("DOMContentLoaded", function () {
      const aviso = document.createElement("p");
      aviso.className = "mensaje mal";
      aviso.style.margin = "16px";
      aviso.textContent = "Falta configurar Supabase: rellena js/config.js con la URL y la anon key de tu proyecto.";
      document.body.prepend(aviso);
    });
  }
  // "supabase" es la librería cargada desde el CDN; "sb" es nuestra conexión
  window.sb = window.supabase.createClient(c.SUPABASE_URL, c.SUPABASE_ANON_KEY, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
  });
})();

// Devuelve la sesión actual o null
async function sesionActual() {
  const { data } = await sb.auth.getSession();
  return data.session;
}

// Lee el perfil (nombre, rol, estado) del usuario conectado
async function miPerfil() {
  const s = await sesionActual();
  if (!s) return null;
  const { data, error } = await sb.from("perfiles").select("*").eq("id", s.user.id).maybeSingle();
  if (error) return null;
  return data;
}

// Para páginas privadas: si no hay sesión, vuelve a la portada
async function exigirSesion() {
  const s = await sesionActual();
  if (!s) { location.replace("acceso.html"); return null; }
  return s;
}

async function cerrarSesion() {
  await sb.auth.signOut();
  location.replace("acceso.html");
}

// Traduce los errores más comunes de Supabase al español
function traducirError(e) {
  const m = (e && (e.message || e.error_description || String(e))) || "";
  if (/Invalid login credentials/i.test(m)) return "Email o contraseña incorrectos.";
  if (/Email not confirmed/i.test(m)) return "Aún no has confirmado tu email. Revisa tu bandeja de entrada (y el spam).";
  if (/User already registered/i.test(m)) return "Ya existe una cuenta con ese email. Prueba a entrar o a recuperar la contraseña.";
  if (/Password should be at least/i.test(m)) return "La contraseña debe tener al menos 8 caracteres.";
  if (/rate limit|too many/i.test(m)) return "Demasiados intentos seguidos. Espera un minuto y vuelve a probar.";
  if (/network|fetch/i.test(m)) return "No hay conexión con el servidor. Revisa tu internet.";
  if (/No autorizado/i.test(m)) return "No tienes permiso para hacer esto.";
  return m || "Algo ha fallado. Inténtalo de nuevo.";
}

// ---- Enlaces cortos ----
// En la web publicada: /c/<código> (compromiso) y /g/<código> (grupo).
// En la demo o sin servidor: pagina.html#<código>.
function codigoDeEnlace() {
  const m = location.pathname.match(/\/(?:c|g)\/([A-Za-z0-9_-]{8,64})\/?$/);
  return m ? m[1] : (new URLSearchParams(location.search).get("t") || location.hash.slice(1) || "");
}
function enlaceCorto(tipo, codigo) {
  if (window.MODO_DEMO || location.protocol === "file:") {
    return new URL((tipo === "c" ? "tarea.html" : "grupo.html") + "#" + codigo, location.href).href;
  }
  return location.origin + "/" + tipo + "/" + codigo;
}
// Para mostrar el enlace sin «https://» (más limpio en los mensajes)
function enlaceBonito(url) { return String(url).replace(/^https?:\/\//, ""); }
