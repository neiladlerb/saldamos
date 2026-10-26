# Saldamos · Cómo publicar

Web estática HTML + JavaScript (sin framework: **no es Next.js**, no hay que compilar nada) + Supabase + funciones de servidor en `api/`. Vercel la publica tal cual.

Hay **una sola versión del código**. En `js/config.js`:

- `DEMO: true` → datos de ejemplo en el navegador, sin Supabase (para enseñarla).
- `DEMO: false` → la app de verdad, con tu Supabase.

## 1. Antes de publicar

1. Abre `pruebas/reparto.html` en el navegador: debe decir **«Todo bien»**.
2. Si vas a publicar la versión real: pega la URL y la anon key de Supabase en `js/config.js` y pon `DEMO: false` (pasos 1 y 2 del `LEEME.md`).

## 2. GitHub (guardar el código)

1. Instala **GitHub Desktop** → *File → Add local repository* → esta carpeta → *Create a repository*.
2. Comprueba que en la lista de cambios **no** aparecen `_archivo/` ni archivos `.zip` (los excluye `.gitignore`).
3. *Commit to main* → *Publish repository* → márcalo como **privado**.

## 3. Vercel (publicar la web)

1. **vercel.com** → *Sign up with GitHub* → *Add New → Project* → importa el repositorio.
2. *Framework Preset*: **Other**. No toques *Build Command* ni *Output Directory* → *Deploy*.
3. *Settings → Environment Variables* (solo para la versión real): `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SITIO_URL` y, si usáis «Dímelo» con IA, `ANTHROPIC_API_KEY` → *Deployments → Redeploy*.
4. En Supabase → *Authentication → URL Configuration*: pon la dirección de Vercel en *Site URL* y `https://tu-direccion/**` en *Redirect URLs*.
5. A partir de aquí, cada *Commit + Push* en GitHub Desktop publica solo. Cada rama nueva crea una dirección de prueba antes de pasar a producción.

**Consejo:** dos proyectos en Vercel desde el mismo repositorio — uno con la rama `main` (real, `DEMO: false`) y otro con una rama `demo` (`DEMO: true`) — para tener siempre una demo pública sin tocar datos reales.

Tras publicar, comprueba en Chrome (*F12 → Application → Manifest / Service workers*) que la app aparece como instalable.

## 4. ¿Y la app del móvil?

Vercel publica una **web**. El mismo código sirve para las tres opciones:

| Opción | Qué obtienes | Coste / esfuerzo | Estado |
|---|---|---|---|
| **PWA** | Icono en la pantalla de inicio, pantalla completa, abre sin cobertura | Gratis | **Ya incluida**: en Android, Chrome ofrece «Instalar app»; en iPhone, Safari → Compartir → «Añadir a pantalla de inicio» |
| **Google Play** (TWA con PWABuilder o Bubblewrap) | La misma PWA como app de Android en la tienda | 25 $ una vez · pocas horas | Siguiente paso recomendado |
| **App Store** (Capacitor) | App de iPhone (y Android) con funciones del móvil | 99 $/año · necesita un Mac o compilación en la nube · revisión de Apple | Apple rechaza apps que son solo una web: hay que añadir notificaciones nativas, cámara para tickets, etc. |

Para Google Play: entra en **pwabuilder.com**, pega la dirección publicada, descarga el paquete Android y súbelo a Google Play Console. Necesitarás publicar un archivo `/.well-known/assetlinks.json` que te da PWABuilder (para que no se vea la barra del navegador).

## 5. Pendiente antes de abrir al público

- Completar `privacidad.html` y `aviso-legal.html` (revisión legal / DPO).
- Email propio (SMTP) en Supabase y plan Pro (el gratuito se pausa tras 7 días sin uso).
- Con dominio propio: poner la dirección completa en `og:image` de `index.html`, `grupo.html` y `tarea.html`.
- Prueba completa con la versión real: registro → confirmar email → tarea → gasto → grupo → enlace por WhatsApp desde otro móvil → recuperar contraseña → descargar datos → borrar cuenta.
