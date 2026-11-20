-- Permisos, disparadores y tareas programadas, tal como estaban en la base el 2026-11-15.
-- (Reconstruido desde el catálogo de Postgres; el resultado es equivalente al estado real.)

-- Esquemas app y privado: nadie más que postgres. Ni anon, ni authenticated, ni service_role.
revoke all on schema app, privado from public, anon, authenticated, service_role;
revoke all on all tables in schema app from public, anon, authenticated, service_role;
revoke all on all functions in schema privado from public, anon, authenticated, service_role;

-- Funciones nuevas en public nacen sin permisos para nadie
alter default privileges for role postgres in schema public revoke execute on functions from public, anon, authenticated, service_role;
alter default privileges for role postgres revoke execute on functions from public;

-- Funciones de public: todas cerradas y luego se abre una por una
revoke all on all functions in schema public from public, anon, authenticated, service_role;

-- La app (persona con sesión). Cada función comprueba adentro quién llama:
--   privado.yo('tutor' | 'mvz')  -> sesión, perfil, cuenta no suspendida y tipo de cuenta
--   privado.exigir_admin()       -> está en app.admins Y la sesión pasó el doble factor (aal2)
grant execute on function
  public.mi_perfil(), public.guardar_nombre(text, text), public.mis_avisos(),
  public.cambiar_telefono(text), public.sincronizar_telefono(),
  public.bloques_en_zona(text, text), public.medicos_en_bloque(text, text, timestamptz),
  public.crear_solicitud(jsonb), public.mis_solicitudes(), public.cancelar_solicitud(uuid),
  public.responder_reagenda(uuid, boolean), public.reportar(uuid, text, text), public.responder_encuesta(uuid, jsonb),
  public.guardar_perfil_mvz(jsonb), public.guardar_horario(jsonb), public.bloquear_dia(date, boolean),
  public.mis_solicitudes_mvz(), public.responder_solicitud(uuid, boolean), public.cancelar_como_mvz(uuid, text),
  public.proponer_reagenda(uuid, timestamptz),
  public.admin_resumen(), public.admin_medicos(), public.admin_decidir_mvz(uuid, text, boolean, boolean),
  public.admin_tutores(), public.admin_cuenta(uuid, text), public.admin_eliminar_datos(uuid),
  public.admin_solicitudes(), public.admin_cerrar_solicitud(uuid, text, text), public.admin_reportes(),
  public.admin_resolver_reporte(uuid, text, text, text), public.admin_pagos(), public.admin_encuestas(),
  public.admin_auditoria(), public.admin_parametros(), public.admin_guardar_parametro(text, text)
to authenticated;

-- Solo el servidor (Edge Functions con la clave secreta)
grant execute on function
  public.srv_tick(), public.srv_avisos_pendientes(), public.srv_marcar_aviso(bigint, boolean, boolean),
  public.srv_es_admin(uuid), public.srv_preparar_pago(uuid, uuid), public.srv_guardar_preferencia(uuid, text),
  public.srv_registrar_pago(uuid, text, text, numeric, text), public.srv_reembolsos_pendientes(),
  public.srv_marcar_reembolso(uuid, boolean, text, text)
to service_role;

-- public.crear_admin(text): sin permisos para nadie. Solo se corre a mano desde el editor SQL de Supabase.

-- Disparadores sobre las cuentas de acceso
create trigger lv_al_crear_cuenta after insert on auth.users for each row execute function privado.al_crear_cuenta();
create trigger lv_al_cambiar_correo after update on auth.users for each row execute function privado.al_cambiar_correo();

-- Tarea programada (pg_cron): revisa plazos cada 5 minutos
select cron.schedule('lilievet-plazos', '*/5 * * * *', 'select privado.tick()');

-- Valores de app.parametros al momento de la copia
insert into app.parametros (clave, valor) values
  ('cuota_servicio', '120'), ('minutos_respuesta', '60'), ('horas_para_pagar', '12'), ('horas_cancelacion', '24'),
  ('horas_anticipacion', '3'), ('dias_agenda', '30'), ('exigir_telefono_verificado', 'true'),
  ('version_terminos', '"2026-11"'), ('version_privacidad', '"2026-11"'), ('version_carta', '"2026-11"')
on conflict (clave) do nothing;

-- 2026-11-16 · migración revocar_rls_auto_enable: la función de Supabase que activa RLS no la llama nadie por la API
revoke execute on function public.rls_auto_enable() from authenticated, anon, public;

-- 2026-11-16 · migración tareas_avisos_y_reembolsos
-- El secreto 'cron_secret' vive en Supabase Vault (se generó dentro de la base; no está en este repositorio)
-- y debe ser igual al secreto CRON_SECRET de las Edge Functions. Si no existe, la función no llama a nada.
create or replace function privado.llamar_funcion(p_slug text)
returns void
language plpgsql
security definer
set search_path to ''
as $function$
declare v_secreto text;
begin
  if p_slug not in ('enviar-avisos', 'procesar-reembolsos') then return; end if;
  select decrypted_secret into v_secreto from vault.decrypted_secrets where name = 'cron_secret';
  if v_secreto is null or char_length(v_secreto) < 24 then return; end if;
  perform net.http_post(
    url := 'https://wqxirebttvrodhqddsag.supabase.co/functions/v1/' || p_slug,
    body := '{}'::jsonb,
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-cron-secret', v_secreto),
    timeout_milliseconds := 20000);
end $function$;
revoke all on function privado.llamar_funcion(text) from public, anon, authenticated, service_role;

select cron.schedule('lilievet-avisos', '* * * * *', $$select privado.llamar_funcion('enviar-avisos')$$);
select cron.schedule('lilievet-reembolsos', '*/15 * * * *', $$select privado.llamar_funcion('procesar-reembolsos')$$);

-- 2026-11-20 · migración foto_mvz: bucket público 'fotos-mvz' (1 MB, solo JPG) y políticas de Storage;
-- ver supabase/esquema/70_fotos_mvz.sql

-- 2026-11-20 · migración reagenda_tutor
revoke all on function public.horarios_reagenda(uuid) from public, anon, authenticated, service_role;
revoke all on function public.pedir_reagenda(uuid, timestamp with time zone) from public, anon, authenticated, service_role;
grant execute on function public.horarios_reagenda(uuid) to authenticated;
grant execute on function public.pedir_reagenda(uuid, timestamp with time zone) to authenticated;
