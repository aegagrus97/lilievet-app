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

### Pendiente: verificar el celular con código por WhatsApp (20 nov 2026)

Hoy no hay proveedor de SMS en Supabase, así que el celular se verifica a mano: el tutor toca "Enviar mensaje por WhatsApp" en su Perfil (abre WhatsApp de soporte con un mensaje que trae su correo), se revisa que el número coincida y se marca en Panel → Tutores → "Marcar verificado". Los médicos quedan verificados al aprobarlos. Plan: mandar el código por WhatsApp directo con la API de Meta (sin Twilio). Requisitos, en orden:

1. Dominio propio con una página web sencilla de LilieVET (también sirve para el remitente de correo, ver arriba).
2. Portafolio en Meta Business (business.facebook.com) y **verificación del negocio**: documentos con el mismo nombre legal y domicilio (p. ej. constancia de situación fiscal) y, de preferencia, un correo del dominio.
3. Un número de celular dedicado a la API (lo más simple: un chip nuevo).
4. Nombre visible aprobado y una **plantilla de autenticación** aprobada (con botón "Copiar código").
5. Método de pago en Meta. Se cobra por mensaje entregado; no hay renta mensual si se usa la API de Meta directo.
6. Programar el envío (función en Supabase) y cambiar la pantalla de Celular. Con la misma cuenta se pueden mandar los avisos por WhatsApp: la función `enviar-avisos` ya está lista y solo faltan los secretos `WHATSAPP_TOKEN`, `WHATSAPP_PHONE_ID` y `WHATSAPP_TEMPLATE`. La plantilla (categoría utilidad, es_MX) lleva dos variables: `{{1}}` = título del aviso y `{{2}}` = enlace. Ejemplo: "LilieVET: {{1}}. Entra aquí: {{2}}". Para el aviso "médico aceptó", el enlace abre directo el cobro de la cuota (`#/consultas/<id>/pagar`).

Límite inicial: 250 personas por día; sube con la verificación y el buen uso.

### Pendiente: verificación automática del celular por WhatsApp (20 nov 2026)

Hacer antes que el código por WhatsApp de arriba: es menos trámite. Pasar el número de soporte (o uno nuevo, con chip dedicado) a la API oficial de WhatsApp Business de Meta y crear una función en Supabase que reciba los mensajes entrantes:

- Toma el número del remitente (lo da WhatsApp, no se puede falsificar) y el correo del mensaje ya escrito.
- Si el número coincide con el de esa cuenta: la marca verificada (dispara el aviso "Tu celular quedó verificado") y contesta automáticamente.
- Si no coincide: contesta que el número no es el registrado y queda pendiente en el Panel para revisión manual.

No necesita plantilla de autenticación (el tutor escribe primero) y las respuestas dentro de las 24 horas no se cobran. Ojo: si se usa el número de soporte actual, deja de funcionar en la app normal de WhatsApp.

### Pendiente: agente de IA para soporte por WhatsApp (20 nov 2026)

Después de la verificación automática, en el mismo número: un agente que conteste preguntas frecuentes (cómo pedir una consulta, cuánto cuesta, cómo cancelar) y pase a una persona lo que no sepa resolver. Nunca valora síntomas ni da indicaciones médicas, igual que el aviso actual de soporte.

### Pendiente: activar los avisos por WhatsApp (20 nov 2026)

El código ya está listo en `supabase/functions/enviar-avisos`: cada aviso (por ejemplo "Un médico veterinario aceptó tu solicitud") se manda por correo y, cuando esto esté configurado, también por WhatsApp con el mismo enlace directo (en ese caso, al cobro de la cuota). Falta:

1. Cuenta de WhatsApp Business en Meta con número dedicado (ver los pendientes de verificación por WhatsApp).
2. Una plantilla aprobada, categoría **utilidad**, idioma es_MX, con dos variables: `{{1}}` = título del aviso y `{{2}}` = enlace. Ejemplo: "LilieVET: {{1}}. Entra aquí: {{2}}".
3. En Supabase → Edge Functions → Secrets: `WHATSAPP_TOKEN`, `WHATSAPP_PHONE_ID` y `WHATSAPP_TEMPLATE` (el nombre de la plantilla).

### Pendiente: revisar las ganancias con los primeros cobros reales (20 nov 2026)

El bloque Ganancias del Panel (Resumen) usa la comisión, el depósito y las retenciones que reporta Mercado Pago en cada pago. Al conectar Mercado Pago, revisar:

1. **Comisión en reembolsos.** Hoy los pagos reembolsados no cuentan en la ganancia (se asume que Mercado Pago devuelve la comisión). Con el primer reembolso real, revisar en la cuenta de Mercado Pago si la comisión se devolvió; si no, agregar ese costo al cálculo.
2. **IVA e ISR con el contador.** El IVA por pagar es una estimación (16 % de las cuotas menos el IVA de la comisión de Mercado Pago, suponiendo que la comisión que reporta Mercado Pago ya incluye IVA). El ISR no está incluido. Confirmar la fórmula con el contador, sobre todo si Mercado Pago retiene impuestos.

### Pendiente: diseño del correo de avisos (20 nov 2026)

En el correo que llega (Edge Function `supabase/functions/enviar-avisos`), la línea "No es un servicio de urgencias." del pie se ve mal: va pegada al final del texto plano, sin separación ni formato. Acomodarla mejor (por ejemplo, una versión HTML del correo con un pie separado y más discreto, conservando la versión de texto).

### Pendiente: revisar la cobertura en el Estado de México (20 nov 2026)

Hoy la app acepta domicilios en los 125 municipios del Estado de México (el tutor elige el municipio; la app solo verifica que el C.P. sea 50000–57999). Se deja así por ahora. Revisarlo cuando LilieVET se extienda formalmente al Edomex o cuando el Panel → Demanda muestre solicitudes desde allá:

- Si conviene limitar la lista a los municipios donde sí hay cobertura (`privado.municipios_edomex()` en `supabase/esquema/20_privado_funciones.sql` y `EDOMEX` en `js/demo.js`).
- Si conviene validar el municipio con más precisión que solo el rango de C.P.
- Si hay médicos que marquen esas zonas; sin ellos, las solicitudes de allá quedan sin médico.

### Pendiente: reembolsos por domicilio que no corresponde (20 nov 2026)

En la fase piloto, si el médico cancela porque el domicilio no corresponde a la zona, al tutor se le reembolsa la cuota completa (como en cualquier cancelación del médico). Cuando haya datos, medir qué porcentaje de los reembolsos se debe a esto y decidir si se mantiene el reembolso en ese caso.

Las cancelaciones por esta razón se reconocen porque el médico usa el motivo rápido, que guarda siempre el mismo texto en `motivo_cierre`. Consulta para el SQL Editor de Supabase:

```sql
select count(*) filter (where motivo_cierre like 'El domicilio no corresponde%') as por_domicilio,
       count(*) as canceladas_por_medico,
       round(100.0 * count(*) filter (where motivo_cierre like 'El domicilio no corresponde%') / nullif(count(*), 0), 1) as porcentaje
from app.solicitudes
where estado = 'cancelada_mvz';
```

Ojo: si el médico escribe el motivo a mano en vez de usar el botón, no entra en la cuenta.

## Ver el diseño sin conectar nada

`?demo=tutor`, `?demo=mvz`, `?demo=mvz-nuevo` o `?demo=admin` abren la app con datos de ejemplo que viven solo en la memoria del navegador.
