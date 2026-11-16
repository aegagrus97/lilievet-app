# Supabase · copia versionada del servidor de LilieVET

Copia de lo que corre en el proyecto de Supabase `LilieVET-cuota` (`wqxirebttvrodhqddsag`), tomada el **15 de noviembre de 2026**. Antes de esta copia, nada de esto estaba en un repositorio.

Es una **referencia para revisar y auditar**, no un instalador: la base real sigue siendo la fuente de verdad. Si cambias una función en Supabase, actualiza aquí el archivo correspondiente en el mismo cambio.

## Qué hay

| Archivo | Contenido | Fidelidad |
| --- | --- | --- |
| `esquema/10_tablas.sql` | Las 16 tablas del esquema `app`, con restricciones e índices | Reconstruido desde el catálogo |
| `esquema/20_privado_funciones.sql` | 23 funciones internas (`privado.*`); la número 24, `llamar_funcion`, está en el archivo 60 | Idéntico byte por byte (md5 verificado) |
| `esquema/30_public_admin.sql` | 15 funciones del Panel (`admin_*`) | Idéntico byte por byte |
| `esquema/40_…` y `41_…` | Funciones que llama la app (tutor y médico) | Idéntico byte por byte |
| `esquema/50_public_srv.sql` | 9 funciones solo para el servidor (`srv_*`) | Idéntico byte por byte |
| `esquema/60_permisos_y_tareas.sql` | Permisos, disparadores, tarea programada y parámetros | Reconstruido desde el catálogo |
| `functions/*/index.ts` | Las 4 Edge Functions | Copia del código desplegado (versión 1) |

No se copian secretos: `MP_ACCESS_TOKEN`, `MP_WEBHOOK_SECRET`, `CRON_SECRET`, `RESEND_API_KEY`, etc. viven solo en Supabase → Edge Functions → Secrets.

## Cómo está protegida la base

- **Tres esquemas.** `app` (tablas) y `privado` (funciones internas) no son accesibles para ningún rol de la app: ni `anon`, ni `authenticated`, ni `service_role` tienen `USAGE`. Solo `public` está expuesto.
- **Las tablas no se tocan directo.** Ninguna tiene permisos para roles de la app, y además todas tienen RLS activo sin políticas (cerrado por completo).
- **Todo pasa por funciones `SECURITY DEFINER` con `search_path = ''`**, que comprueban quién llama:
  - `privado.yo('tutor' | 'mvz')`: sesión válida, perfil existente, cuenta no suspendida y tipo de cuenta correcto. Cada función filtra después por `tutor_id` / `mvz_id` = quien llama.
  - `privado.exigir_admin()`: estar en `app.admins` **y** que la sesión haya pasado el doble factor (`aal2`).
- **`anon` no puede ejecutar nada.** `authenticated` solo las 35 funciones de la app; `service_role` solo las 9 `srv_*`. `crear_admin` no la puede ejecutar ningún rol: solo a mano desde el editor SQL.
- **Edge Functions** con `verify_jwt = false`, pero cada una se autentica sola: `crear-pago` valida el token con Supabase Auth; `mp-webhook` verifica la firma HMAC de Mercado Pago y vuelve a consultar el pago en Mercado Pago; `procesar-reembolsos` exige secreto de cron o administradora con `aal2`; `enviar-avisos` exige secreto de cron.

## Resultado de la revisión (15 nov 2026)

Se leyeron las 47 funciones de `public`, las 23 de `privado` y las 4 Edge Functions.

**Sin hallazgos que permitan a una cuenta ver o cambiar datos ajenos.** En particular:

- Las 15 funciones `admin_*` llaman a `privado.exigir_admin()` antes de leer o escribir.
- Las funciones de tutor y médico filtran siempre por la cuenta que llama; ninguna recibe el id de la cuenta como parámetro.
- El monto del cobro sale de la base, no del navegador; el webhook compara monto y moneda y es idempotente.
- El tipo de cuenta al registrarse solo puede ser `tutor` o `mvz`; no hay forma de registrarse como administradora.

**Pendientes menores** (ninguno expone datos):

1. ~~`public.rls_auto_enable()` (función de Supabase, no de LilieVET) era ejecutable por `authenticated`.~~ **Resuelto el 16 nov 2026** con la migración `revocar_rls_auto_enable`. El disparador que activa RLS en tablas nuevas sigue funcionando.
2. Protección contra contraseñas filtradas desactivada en Supabase Auth (Authentication → Sign In / Providers → Password). Puede requerir plan de pago.
3. La extensión `pg_net` está instalada en `public`; Supabase recomienda otro esquema.
4. ~~No había tareas que llamaran a `enviar-avisos` ni a `procesar-reembolsos`.~~ **Armado el 16 nov 2026** (`lilievet-avisos` cada minuto, `lilievet-reembolsos` cada 15 minutos). Empiezan a funcionar cuando el secreto `CRON_SECRET` de las Edge Functions sea igual al secreto `cron_secret` de Vault; mientras no coincidan, las funciones responden 401 y no pasa nada.

## Revisión "como atacante" (16 nov 2026)

Corregido ese día:

- `bloques_en_zona` y `medicos_en_bloque` ahora tienen tope de 240 consultas por hora por cuenta (migración `limite_consultas_agenda`), para que un script con sesión no pueda saturar la base.

Pendientes que no se pueden cerrar desde el código (ver el README principal):

- Proyecto anterior de Supabase `LilieVET-v3-2` sigue activo, con su clave en el repo público `lilieVET`.
- La rama `main` no está protegida y de ella sale el código que corre en el navegador de cada persona.
- Configuración de Supabase Auth por confirmar: CAPTCHA, largo mínimo de contraseña, confirmación de correo y límites de SMS.
