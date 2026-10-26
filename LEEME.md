# MisGastosApp · Guía de puesta en marcha

Aplicación web de tareas con avisos y gastos compartidos, con cuentas de usuario y back office.
Funciona sola, sin Claude: Supabase guarda las cuentas y los datos, y Vercel publica la web.

## Qué hay en esta carpeta

| Archivo | Para qué sirve |
|---|---|
| `index.html` | Portada comercial para el cliente final: qué es, cómo funciona, precios y preguntas. «Entrar» y «Crear cuenta» arriba a la derecha |
| `lab.html` | **Lab** (uso interno): accesos de la demo, prototipos y guion para enseñarla. No sale en buscadores; enlace discreto al pie de la portada |
| `acceso.html` | Entrar, crear cuenta y «He olvidado mi contraseña» |
| `empresas.html` | Página para empresas (marca blanca, panel de RR. HH.) |
| `recuperar.html` | Poner una contraseña nueva (se llega desde el email) |
| `app.html` | La aplicación: tareas, gastos y grupos |
| `grupo.html` | Página pública de un grupo (la que se abre desde WhatsApp) |
| `tarea.html` | Página pública de un compromiso terminado: «Conforme» o comentario |
| `calculadora.html` | Calculadora rápida para dividir una cuenta (sin registro) |
| `admin.html` | Back office (solo administradores) |
| `privacidad.html`, `aviso-legal.html` | Plantillas legales: **hay que completarlas** |
| `css/estilos.css` | El aspecto de todas las páginas |
| `js/config.js` | **Lo único que tienes que editar**: los datos de tu Supabase y el interruptor `DEMO` |
| `js/arranque.js` | Carga Supabase de verdad o la demo según `DEMO` |
| `js/demo-supabase.js`, `js/demo-banco.js`, `js/demo-prototipos.js`, `js/extras-demo.js` | Solo para la demo: datos de ejemplo, banco simulado y prototipos con «Dar mi opinión» |
| `vendor/ocr/` | Motor para leer tickets (Tesseract.js), servido desde la propia web |
| `manifest.webmanifest`, `sw.js`, `js/pwa.js` | App instalable en el móvil (PWA) y funcionamiento sin cobertura |
| `pruebas/reparto.html` | Pruebas automáticas de los repartos: ábrela en el navegador, todo debe salir en verde |
| `_archivo/` | Copias antiguas (la demo separada y el zip). No se publican |
| `vercel.json` | Enlaces cortos /c/… y /g/…, cabeceras de seguridad y caché |
| `img/` | Imágenes de la tarjeta que muestra WhatsApp al compartir un enlace |
| `js/comun.js` | Conexión con Supabase y utilidades |
| `js/tareas.js`, `js/gastos.js`, `js/grupos.js`, `js/cuenta.js` | La lógica de la app |
| `js/presupuesto.js` | Presupuesto compartido (Premium): en la app y en la página del enlace |
| `js/reparto.js` | Las matemáticas de los repartos (quién debe a quién) |
| `supabase/esquema.sql` | La base de datos y sus reglas de seguridad |
| `supabase/02_grupos.sql` | Módulo de grupos y enlaces públicos |
| `supabase/03_sugerencias.sql` | Sugerencias de los usuarios (botón en la app, lista en el back office) |
| `supabase/04_pago_guiado.sql` | Pago guiado: datos de cobro en el enlace y avisos «Ya he pagado» |
| `supabase/05_compromisos.sql` | Cerrar compromisos: «Hecho» por WhatsApp y conformidad sin cuenta |
| `supabase/06_deudas.sql` | Mis deudas y créditos, ingresos del perfil y datos de tickets escaneados |
| `supabase/07_presupuesto.sql` | Planes (Gratis / Premium / Empresas), presupuesto compartido, aprobaciones y cuentas vinculadas a un grupo |
| `supabase/08_bizum.sql` | Cobrar con Bizum Pay: TPV de quien cobra, pagos iniciados y conciliación automática |
| `api/bizum-iniciar.js`, `api/bizum-notificacion.js` | Funciones del servidor (Vercel) que firman la orden para Redsys y reciben su aviso |
| `cobros.html` | Mi cuenta → «Cobrar con Bizum Pay» (conectar el TPV y ver cobros) |
| `js/dimelo.js`, `api/dimelo.js`, `supabase/09_dimelo.sql` | «Dímelo y lo apunto»: reglas en el móvil (Gratis) e IA en el servidor (Premium) |
| `js/sugerencias.js` | El botón «Sugerencias» de la app |

---

## Paso 1 · Crear la base de datos en Supabase (unos 10 min)

1. Entra en **supabase.com** → *Start your project* → regístrate.
2. *New project*:
   - Name: `saldamos`
   - Database password: genera una y **guárdala** en tu gestor de contraseñas.
   - Region: **Central EU (Frankfurt)**, para que los datos estén en la UE.
3. Cuando termine de crearse: menú izquierdo → **SQL Editor** → *New query*.
4. Abre `supabase/esquema.sql` con el Bloc de notas, copia **todo**, pégalo y pulsa **Run**.
   Debe terminar con *Success. No rows returned*.
5. Repite lo mismo con `supabase/02_grupos.sql`, `supabase/03_sugerencias.sql`, `supabase/04_pago_guiado.sql`, `supabase/05_compromisos.sql`, `supabase/06_deudas.sql`, `supabase/07_presupuesto.sql`, `supabase/08_bizum.sql` y `supabase/09_dimelo.sql` (una *New query* para cada uno). **El orden importa: esquema.sql → 02 → 03 → 04 → 05 → 06 → 07 → 08 → 09.**

## Paso 2 · Conectar la web con Supabase

1. En Supabase: **Project Settings → API** (o *Data API* / *API Keys*).
2. Copia la **Project URL** y la clave **anon public** (en proyectos nuevos se llama *Publishable key* y empieza por `sb_publishable_`).
3. Abre `js/config.js`, pega los dos valores en su sitio y cambia `DEMO: true` por `DEMO: false`.

Mientras `DEMO` sea `true`, la web funciona sola con datos de ejemplo guardados en el navegador (sirve para enseñarla sin tener Supabase).

La clave anon/publishable es pública por diseño. **Nunca** pegues la `service_role` / *secret key*.

## Paso 3 · Publicar la web en Vercel

La forma más cómoda a largo plazo es con GitHub: cada cambio que guardes se publica solo.

1. Crea una cuenta en **github.com** e instala **GitHub Desktop**.
2. En GitHub Desktop: *File → Add local repository* → elige la carpeta `MisGastosApp` → *create a repository* → *Publish repository* (márcalo como **privado**).
3. Entra en **vercel.com** → *Sign up with GitHub* → *Add New → Project* → importa `MisGastosApp` → *Deploy* (no hay que tocar ninguna opción).
4. Vercel te da una dirección como `https://saldamos-xxxx.vercel.app`. Más adelante puedes poner un dominio propio en *Settings → Domains*.

**Enlaces cortos y bonitos.** El archivo `vercel.json` hace que los enlaces que se comparten por WhatsApp sean cortos: `tu-dominio/c/Ab3xK9pQ2mZ_1q` para un compromiso y `tu-dominio/g/…` para un grupo. Al compartirlos, WhatsApp muestra una tarjeta con imagen (las imágenes están en `img/`). Cuando tengas dominio propio, pon la dirección completa en la etiqueta `og:image` de `tarea.html` y `grupo.html` (por ejemplo `https://saldamos.app/img/og-hecho.png`): así la tarjeta sale siempre.

## Paso 3 bis · Activar Bizum Pay (opcional)

Para que «Pagar con Bizum Pay» funcione, Vercel necesita tres variables. Están en Vercel → tu proyecto → Settings → Environment Variables:

| Variable | Valor |
| --- | --- |
| `SUPABASE_URL` | La misma URL de `js/config.js` |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Project Settings → API → `service_role` (**secreta: solo aquí, nunca en `js/config.js`**) |
| `SITIO_URL` | La dirección de tu web, p. ej. `https://saldamos.app` |

Después pulsa **Redeploy**. Cada persona que quiera cobrar conecta su TPV virtual Redsys con Bizum en **Mi cuenta → Cobrar con Bizum Pay**. Para probar sin dinero real, en el entorno de pruebas de Redsys sirve el comercio `999008881`, terminal `1` y la clave pública de pruebas que da Redsys en su documentación. El dinero va directo a la cuenta del TPV de quien cobra; Saldamos no lo recibe.

## Paso 3 ter · Activar la IA de «Dímelo» para Premium (opcional)

1. Crea una cuenta en [console.anthropic.com](https://console.anthropic.com), añade saldo y crea una **API key**.
2. En Vercel → Settings → Environment Variables añade `ANTHROPIC_API_KEY` (secreta, solo aquí). Opcionales: `ANTHROPIC_MODEL` (por defecto `claude-haiku-5-5`) y `DIMELO_LIMITE` (frases al día por persona, por defecto 300).
3. Pulsa **Redeploy**.

Coste orientativo con Claude Haiku 5.5 (0,10 $ por millón de tokens de entrada y 0,50 $ de salida): cada frase gasta unos 1.500 tokens de entrada y 200 de salida, unos 0,00025 $; **100 frases ≈ 2-3 céntimos**. Sin la clave, o si la IA falla, Premium usa las mismas reglas que Gratis. En el plan Gratis la frase nunca sale del móvil.

## Paso 4 · Decirle a Supabase cuál es tu web

En Supabase → **Authentication → URL Configuration**:

- **Site URL**: `https://saldamos-xxxx.vercel.app` (la tuya)
- **Redirect URLs** → *Add URL*: `https://saldamos-xxxx.vercel.app/**`

Sin esto, los enlaces de los emails (confirmar cuenta, recuperar contraseña) no te devuelven a tu web.

Opcional: en *Authentication → Emails* puedes traducir al español los textos de los emails.

## Paso 5 · Hacerte administrador

1. Abre tu web, crea tu cuenta y confírmala desde el email.
2. En Supabase → SQL Editor, ejecuta esta línea con tu email:
   ```sql
   update public.perfiles set rol = 'admin' where email = 'tu@email.com';
   ```
3. Vuelve a la web: en **Mi cuenta** verás el enlace **Back office**.
4. Para dar Premium a alguien (mientras no haya pagos dentro de la app), ejecuta en SQL Editor:
   ```sql
   update public.perfiles set plan = 'premium' where email = 'su@email.com';   -- o 'empresa' o 'gratis'
   ```
   (Desde la web, un administrador puede usar la función `admin_cambiar_plan`.)

## Paso 6 · Antes de abrirla al público

- [ ] Completar `privacidad.html` y `aviso-legal.html` y que los revise vuestro asesor legal o DPO.
- [ ] **Email propio (SMTP).** El email de Supabase de serie solo envía unos pocos mensajes por hora y es para pruebas. Configura uno real en *Authentication → Emails → SMTP Settings* (Brevo, Resend, el de Microsoft 365 de la empresa…).
- [ ] Revisar en *Authentication → Providers → Email* que **Confirm email** está activado.
- [ ] Plan gratuito de Supabase: el proyecto **se pausa tras 7 días sin uso**. Para usuarios reales conviene el plan Pro.
- [ ] Hacer la prueba completa: registro → confirmar email → crear tarea → verla en el móvil → crear un grupo → enviarlo por WhatsApp y abrir el enlace desde otro móvil → recuperar contraseña → descargar mis datos → borrar cuenta.

---

## Cómo está pensada la seguridad

- **Cada usuario solo ve lo suyo.** Lo comprueba la propia base de datos en cada consulta (Row Level Security). Aunque alguien manipulara la web, no obtendría datos ajenos.
- **El back office no ve el contenido.** Los administradores ven datos de cuenta y recuentos, pero no las tareas ni los gastos de nadie (minimización de datos, RGPD).
- **Bloquear** a un usuario le corta el acceso a sus datos al momento. **Desbloquear** se lo devuelve.
- **Nadie puede hacerse admin a sí mismo.** Solo un admin puede nombrar a otro, y ningún admin puede bloquearse ni quitarse el rol a sí mismo.
- **Borrar la cuenta** elimina el usuario, su perfil, sus tareas, sus gastos y sus grupos.
- **Enlaces de grupo**: cada uno lleva un código aleatorio de 14 caracteres (unos 84 bits, imposible de adivinar en la práctica). Quien tenga el enlace ve los nombres e importes del grupo, pero no puede cambiar nada. El dueño puede desactivarlo o generar uno nuevo; el anterior deja de funcionar al momento.
- **El dinero nunca pasa por Saldamos.** Cada uno paga directo por Bizum o transferencia. El Bizum y el IBAN de una persona solo aparecen en el enlace si se marca «Mostrar en el enlace». Un «Ya he pagado» desde el enlace solo crea un aviso; el pago no cuenta hasta que el dueño del grupo lo confirma.
- **Los teléfonos** solo se usan para abrir WhatsApp desde tu móvil. La app no envía mensajes por su cuenta: eres tú quien pulsa «Enviar» en WhatsApp.

## Preparado para sponsors (marca blanca)

La base de datos ya tiene una tabla `sponsors` y cada perfil un campo `sponsor_id`, de momento vacío. Cuando toque, se añadirá:

- un rol de administrador de sponsor, que solo ve a sus usuarios;
- el registro desde la web de cada sponsor;
- su logo y sus colores.

## Nombre de la plataforma
«Saldamos» es el nombre **provisional** elegido en el Lab (finalistas: EnPaz y Liquida). Falta comprobar que el dominio y la marca están libres. Si cambia, basta con buscar y reemplazar «Saldamos» y `Sal<span>damos</span>` en los archivos.

## Novedades (octubre 2026)
- **Reparto por porcentaje** en los gastos de grupo (p. ej. pareja 60/40). No necesita cambios en la base de datos.
- **QR en la mesa**: la calculadora genera un QR que abre `cuenta.html`. Todos los datos van dentro del enlace, así que no se guarda nada en el servidor. La librería de QR va incluida en `js/qrcode.js` (MIT, Kazuhiko Arase).
- **Tu mes en 30 segundos**: en Gastos, un resumen del mes con un consejo y un botón para mandártelo por WhatsApp.
- Los móviles españoles sin prefijo (9 cifras) reciben +34 automáticamente en los enlaces de WhatsApp.
- **Mis deudas y créditos** (pestaña «Deudas»): préstamos, hipoteca, créditos y compras en cuotas. Muestra el total que debes, las cuotas del mes, cuándo terminas, los intereses que faltan y qué % de tus ingresos se va en cuotas. **Necesita ejecutar `supabase/06_deudas.sql`.**
- **Escanear ticket o factura** (en Gastos): lee la foto en el propio móvil con Tesseract.js (se descarga de la propia web, `vendor/ocr/`, la primera vez que se usa) y rellena comercio, fecha, nº de ticket, NIF, productos y total. La imagen no se sube a ningún sitio; se guardan solo los datos leídos.
- Los importes aceptan el punto de miles («1.100» = mil cien euros).
- **Presupuesto compartido (Premium)**, en cada grupo: presupuesto mensual que se repite, cuánto pone cada persona (en % o en €), categorías y un «bote común» que puede pagar gastos. Los gastos del presupuesto no generan deudas entre personas; los **gastos extra** quedan pendientes hasta que la otra parte los aprueba (para rechazar hay que escribir el motivo) y luego se reparten con los % del presupuesto. Nada se borra: los gastos se **anulan** con motivo y todo queda en un **registro** con fecha y hora que la base de datos impide modificar. La otra parte puede aprobar desde el enlace sin cuenta o **vincular el grupo a su propia cuenta** (lo verá en su lista como «Compartido contigo»). **Necesita ejecutar `supabase/07_presupuesto.sql`.**
- **Pagar con Bizum Pay** desde el enlace del grupo: quien cobra conecta su TPV Redsys con Bizum, quien debe paga en dos toques y el pago se apunta solo (firma HMAC SHA-256 de Redsys comprobada en el servidor). **Necesita `supabase/08_bizum.sql` y el paso 3 bis.**
- **Dímelo y lo apunto** (escribir o dictar): crea tareas, gastos, gastos de un grupo, grupos nuevos, deudas, pagos («Ana me ha pagado 20 €») y extras del presupuesto. En **Gratis** lo entienden unas reglas en el propio móvil; en **Premium y Empresas** lo entiende la IA (cualquier frase, hasta 3 cosas a la vez). Siempre enseña «He entendido esto» antes de guardar. **Necesita `supabase/09_dimelo.sql` y el paso 3 ter para la IA.**
- **Solo una parte al grupo**: al añadir un gasto de grupo puedes mandar al grupo todo el importe, una cantidad o un porcentaje (p. ej. del ticket del súper, solo lo de los niños).

## Revisión de octubre 2026 (una sola versión)
- **Demo y versión real son ahora el mismo código.** El interruptor `DEMO` de `js/config.js` decide si se usan datos de ejemplo o tu Supabase. La copia separada de la demo quedó en `_archivo/` y no se publica.
- **Portada comercial** (`index.html`) de cara al cliente final y la pantalla de entrar pasa a `acceso.html`. Todo lo interno (demo, prototipos, guion) está en **`lab.html`**, también desde la franja «DEMO» → «Lab». Los emails de Supabase siguen funcionando igual.
- **App instalable (PWA)**: en el móvil, «Añadir a pantalla de inicio» la instala con su icono, a pantalla completa, y abre aunque no haya cobertura. Los datos nunca se guardan en esa copia: van siempre en directo.
- **Arreglos en el móvil**: la app ya no se sale por la derecha en pantallas estrechas, las pestañas se deslizan si no caben, botones más cómodos al tacto, foco visible con teclado y menos animaciones para quien lo pida en su sistema.
- **Más seguridad y menos dependencias**: lector de tickets servido desde la propia web, cabeceras de seguridad (HSTS incluido) y los archivos `supabase/`, `pruebas/` y la documentación no se publican (`.vercelignore`).
- Arreglados: el enlace roto «Volver» de `empresas.html`, el ticket de ejemplo que faltaba en la versión real y el aviso «Dímelo» cuando no hay clave de la IA (ahora pasa a las reglas del móvil al momento).
