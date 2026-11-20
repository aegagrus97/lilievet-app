# LilieVET · Tu vet a domicilio

Webapp para agendar consultas veterinarias a domicilio para perros y gatos en la Ciudad de México, con médicos veterinarios independientes y con cédula verificada.

Publicada en **https://aegagrus97.github.io/lilievet-app/**

## Cómo funciona

1. El tutor elige servicio, horario y de uno a tres médicos veterinarios de su zona.
2. El médico acepta o rechaza. Si no responde en una hora, la solicitud pasa a la siguiente opción.
3. Cuando uno acepta, el tutor paga la cuota de servicio y cada parte recibe los datos de contacto de la otra.
4. La consulta, las vacunas y los productos se pagan directo al médico veterinario.

LilieVET conecta y agenda. No presta servicios veterinarios, no cobra ni paga nada al médico veterinario y **no es un servicio de urgencias**.

## Qué hay aquí

Solo los archivos de la página. Son estáticos: no hay servidor en este repositorio.

| Carpeta | Contenido |
| --- | --- |
| `js/` | La aplicación (tutor, médico veterinario y panel) |
| `ds/`, `css/`, `fonts/`, `img/`, `icons/` | Sistema de diseño LilieVET, estilos, fuentes y gráficos |
| `vendor/` | Librerías del navegador, incluidas en el repositorio para no depender de terceros |
| `config.js` | Dirección del proyecto de Supabase y su clave publishable |
| `_headers` | Cabeceras de seguridad (las aplica Cloudflare Pages; GitHub Pages no admite cabeceras propias) |

Las cuentas, la base de datos y las funciones del servidor viven en Supabase, fuera de este repositorio.

## Sobre `config.js`

La clave que aparece ahí es la **publishable**, pensada para ir en el navegador: no da acceso a ninguna tabla. Todo pasa por funciones que revisan quién llama, su rol y el estado de los datos. Las claves secretas nunca van en este repositorio.

## Seguridad: qué está cubierto y qué falta

Lo que ya protege esta webapp (código de este repositorio):

- CSP estricta (`<meta>` en `index.html` + `_headers`), sin scripts ni estilos en línea, sin terceros.
- `js/guardia.js` evita que la página se abra escondida dentro de otro sitio.
- Todas las operaciones pasan por funciones (`rpc`) en Supabase; la app nunca lee ni escribe tablas directo.
- El pago (`api.pagar`) valida que la URL que llega del servidor sea `https://` y de un dominio de Mercado Pago antes de abrirla, para no seguir una redirección maliciosa.
- Los enlaces que abren pestaña nueva usan `rel="noopener noreferrer"`.
- El service worker solo guarda archivos propios; nunca respuestas de Supabase.
- Los mensajes de error que ve la persona son genéricos; no exponen detalles internos.

Un pendiente real y una capa que vive fuera del navegador:

1. **Las cabeceras de `_headers` no se están aplicando.** Mientras la app esté publicada solo en GitHub Pages (como dice el enlace arriba), ese archivo se ignora: no hay `Strict-Transport-Security`, `X-Content-Type-Options` ni protección real contra iframes (`frame-ancestors` no funciona en `<meta>`, así que hoy esa protección depende solo de que `js/guardia.js` pueda ejecutarse). Para que esas cabeceras se envíen de verdad hay que publicar en **Cloudflare Pages** o **Netlify** en vez de GitHub Pages.
2. **La autorización del servidor ya está versionada y revisada.** Las funciones de Supabase, sus permisos y las Edge Functions están copiadas en [`supabase/`](supabase/README.md), con el resultado de la revisión del 15 de noviembre de 2026 y cuatro pendientes menores. Si cambias algo en Supabase, actualiza esa carpeta en el mismo cambio.

### Pendientes de la revisión "como atacante" (16 nov 2026)

Estos tres no se arreglan con código; se cierran en los paneles de Supabase y GitHub:

1. **Proyecto anterior de Supabase (`LilieVET-v3-2`): pausado el 16 nov 2026.** Mientras esté pausado nadie puede entrar. Se puede restaurar desde el panel de Supabase; si se reactiva, vuelve a aplicar lo siguiente. Antes de pausarlo seguía activo, su dirección y su clave están en el repositorio público `lilieVET`, guarda documentos de prueba y su panel de administración no pide doble factor. Si ya no se usa: pausarlo o borrarlo, y archivar ese repositorio y su página.
2. **Proteger la cuenta de GitHub y la rama `main`.** Lo que hay en `main` es lo que corre en el navegador de cada persona: quien pueda escribir ahí puede robar sesiones. Activar verificación en dos pasos en la cuenta y una regla que impida forzar o borrar la rama.
3. **Revisar Supabase Auth:** CAPTCHA en registro e inicio de sesión, contraseña mínima de 10 caracteres también en el servidor, confirmación de correo obligatoria, protección de contraseñas filtradas y límite de SMS por hora.

### Pendiente: correo de los avisos con dominio propio (20 nov 2026)

Los avisos por correo salen por **Resend** (cuenta abierta con catiamimbrera@gmail.com). Hoy el remitente es el de prueba, `LilieVET <onboarding@resend.dev>`, y con él Resend **solo entrega a catiamimbrera@gmail.com**: el resto de los usuarios no recibe correos todavía. Cuando se compre el dominio:

1. En Resend → **Domains → Add Domain**, escribir el dominio y copiar los registros DNS (SPF, DKIM) en el lugar donde se compró. Esperar a que diga **Verified**.
2. En Supabase → **Edge Functions → Secrets**, cambiar `MAIL_FROM` a `LilieVET <avisos@tudominio.mx>`. La clave `RESEND_API_KEY` no cambia.
3. Probar con una cuenta que use otro correo (por ejemplo, la veterinaria de prueba).

### Pendiente: diseño del correo de avisos (20 nov 2026)

En el correo que llega (Edge Function `supabase/functions/enviar-avisos`), la línea "No es un servicio de urgencias." del pie se ve mal: va pegada al final del texto plano, sin separación ni formato. Acomodarla mejor (por ejemplo, una versión HTML del correo con un pie separado y más discreto, conservando la versión de texto).

## Ver el diseño sin conectar nada

`?demo=tutor`, `?demo=mvz`, `?demo=mvz-nuevo` o `?demo=admin` abren la app con datos de ejemplo que viven solo en la memoria del navegador.
