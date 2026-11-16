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

## Ver el diseño sin conectar nada

`?demo=tutor`, `?demo=mvz`, `?demo=mvz-nuevo` o `?demo=admin` abren la app con datos de ejemplo que viven solo en la memoria del navegador.
