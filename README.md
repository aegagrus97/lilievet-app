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

Dos pendientes reales, fuera de lo que este repositorio puede arreglar por sí solo:

1. **Las cabeceras de `_headers` no se están aplicando.** Mientras la app esté publicada solo en GitHub Pages (como dice el enlace arriba), ese archivo se ignora: no hay `Strict-Transport-Security`, `X-Content-Type-Options` ni protección real contra iframes (`frame-ancestors` no funciona en `<meta>`, así que hoy esa protección depende solo de que `js/guardia.js` pueda ejecutarse). Para que esas cabeceras se envíen de verdad hay que publicar en **Cloudflare Pages** o **Netlify** en vez de GitHub Pages.
2. **La autorización real vive en Supabase, no en un repositorio.** Las funciones `rpc` que llama `js/api.js` (`crear_solicitud`, `admin_resumen`, `admin_decidir_mvz`, etc.) y sus políticas de RLS no están versionadas en ningún repositorio accesible aquí — el `supabase/schema.sql` del repo `lilieVET` es de una versión anterior de la app, con otros nombres de función (`reservar`, `cerrar_consulta`), y ya no coincide con lo que pide `js/api.js`. Sin esas migraciones en control de versiones no se puede revisar si cada función `admin_*` comprueba `es_admin()`, si `crear_solicitud` valida que el tutor solo pueda crear solicitudes a su propio nombre, etc. Recomendación: exportar las migraciones actuales de Supabase (Database → Migrations, o `supabase db dump`) a este repositorio o a uno dedicado, para que esa capa también se pueda auditar.

## Ver el diseño sin conectar nada

`?demo=tutor`, `?demo=mvz`, `?demo=mvz-nuevo` o `?demo=admin` abren la app con datos de ejemplo que viven solo en la memoria del navegador.
