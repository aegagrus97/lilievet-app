CREATE OR REPLACE FUNCTION public.medicos_en_bloque(p_alcaldia text, p_servicio text, p_inicia_at timestamp with time zone)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare p app.perfiles := privado.yo('tutor'); v jsonb;
begin
  if not (p_alcaldia = any (privado.alcaldias())) or p_servicio not in ('consulta', 'vacunacion', 'desparasitacion') then
    perform privado.error('Elige una alcaldía y un servicio de la lista.');
  end if;
  perform privado.limitar('ver_agenda', 240, interval '1 hour');
  select coalesce(jsonb_agg(jsonb_build_object(
      'id', m.id, 'nombre', pf.nombre || ' ' || pf.apellidos, 'cedula', m.cedula,
      'cedula_verificada_at', m.cedula_verificada_at, 'presentacion', m.presentacion,
      'precio', privado.precio(m, p_servicio), 'medios_pago', m.medios_pago) order by privado.precio(m, p_servicio), pf.nombre), '[]'::jsonb) into v
  from app.mvz m join app.perfiles pf on pf.id = m.id
  where privado.disponible(m.id, p_alcaldia, p_servicio, p_inicia_at);
  return v;
end $function$
;

CREATE OR REPLACE FUNCTION public.mi_perfil()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  p app.perfiles;
  m app.mvz;
  v_admin boolean;
begin
  if auth.uid() is null then perform privado.error('Inicia sesión para continuar.'); end if;
  select * into p from app.perfiles where id = auth.uid();
  if not found then return null; end if;
  select * into m from app.mvz where id = p.id;
  v_admin := exists (select 1 from app.admins where id = p.id);
  return jsonb_build_object(
    'id', p.id, 'rol', p.rol, 'nombre', p.nombre, 'apellidos', p.apellidos, 'correo', p.correo,
    'telefono', p.telefono, 'telefono_verificado', p.telefono_verificado_at is not null, 'bloqueada', p.bloqueada,
    'es_admin', v_admin, 'panel_abierto', privado.es_admin(),
    'mvz', case when m.id is null then null else jsonb_build_object(
      'estado', m.estado, 'cedula', m.cedula, 'cedula_verificada_at', m.cedula_verificada_at,
      -- El Panel pidió corregir la cédula y todavía no la vuelve a escribir
      'cedula_por_corregir', m.cedula is null and m.cedula_verificada_at is null
                             and exists (select 1 from app.avisos a where a.destinatario_id = m.id and a.tipo = 'cedula'),
      'presentacion', m.presentacion, 'precio_consulta', m.precio_consulta, 'precio_vacunacion', m.precio_vacunacion,
      'precio_desparasitacion', m.precio_desparasitacion, 'medios_pago', m.medios_pago,
      'comparte_telefono', m.comparte_telefono_at is not null, 'recibe_solicitudes', m.recibe_solicitudes,
      'zonas', coalesce((select jsonb_agg(alcaldia order by alcaldia) from app.mvz_zonas where mvz_id = m.id), '[]'::jsonb),
      'horario', coalesce((select jsonb_agg(jsonb_build_object('dia', dia, 'hora', hora) order by dia, hora) from app.mvz_horario where mvz_id = m.id), '[]'::jsonb),
      'bloqueos', coalesce((select jsonb_agg(fecha order by fecha) from app.mvz_bloqueos where mvz_id = m.id and fecha >= (now() at time zone 'America/Mexico_City')::date), '[]'::jsonb)
    ) end,
    'aceptaciones', coalesce((select jsonb_agg(jsonb_build_object('documento', documento, 'version', version, 'aceptado_at', aceptado_at) order by aceptado_at)
                              from app.aceptaciones where cuenta_id = p.id and documento <> 'transferencia_datos'), '[]'::jsonb),
    'avisos_sin_leer', (select count(*) from app.avisos where destinatario_id = p.id and leido_at is null),
    'parametros', jsonb_build_object(
      'cuota', privado.param_int('cuota_servicio'), 'minutos_respuesta', privado.param_int('minutos_respuesta'),
      'horas_cancelacion', privado.param_int('horas_cancelacion'), 'horas_para_pagar', privado.param_int('horas_para_pagar'),
      'exigir_telefono', privado.param('exigir_telefono_verificado') = 'true'::jsonb,
      'alcaldias', to_jsonb(privado.alcaldias()))
  );
end $function$
;

CREATE OR REPLACE FUNCTION public.mis_avisos()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare p app.perfiles := privado.yo(); v jsonb;
begin
  select coalesce(jsonb_agg(x order by x.created_at desc), '[]'::jsonb) into v from (
    select id, tipo, titulo, cuerpo, solicitud_id, leido_at, created_at from app.avisos
    where destinatario_id = p.id order by created_at desc limit 30) x;
  update app.avisos set leido_at = now() where destinatario_id = p.id and leido_at is null;
  return v;
end $function$
;

CREATE OR REPLACE FUNCTION public.mis_solicitudes()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare t app.perfiles := privado.yo('tutor'); v jsonb;
begin
  perform privado.tick();
  select coalesce(jsonb_agg(privado.solicitud_tutor(s) order by s.created_at desc), '[]'::jsonb) into v
  from (select * from app.solicitudes where tutor_id = t.id order by created_at desc limit 40) s;
  return v;
end $function$
;

CREATE OR REPLACE FUNCTION public.mis_solicitudes_mvz()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare y app.perfiles := privado.yo('mvz'); v jsonb;
begin
  perform privado.tick();
  select coalesce(jsonb_agg(privado.solicitud_mvz(s, y.id) order by s.inicia_at), '[]'::jsonb) into v
  from app.solicitudes s
  where (s.mvz_id = y.id and (s.estado in ('por_pagar', 'confirmada') or s.inicia_at > now() - interval '30 days'))
     or (s.estado = 'buscando' and exists (select 1 from app.solicitud_opciones o where o.solicitud_id = s.id and o.mvz_id = y.id and o.estado = 'pendiente'));
  return v;
end $function$
;

CREATE OR REPLACE FUNCTION public.proponer_reagenda(p_solicitud uuid, p_inicia_at timestamp with time zone)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare y app.perfiles := privado.yo('mvz'); s app.solicitudes;
begin
  select * into s from app.solicitudes where id = p_solicitud and mvz_id = y.id for update;
  if not found or s.estado <> 'confirmada' then perform privado.error('Solo se puede cambiar el horario de una consulta confirmada.'); end if;
  if s.reagendas >= 1 then perform privado.error('Esta consulta ya se reagendó una vez.'); end if;
  if p_inicia_at is null or p_inicia_at < now() + interval '2 hours' or p_inicia_at > s.inicia_original_at + interval '30 days'
     or extract(minute from p_inicia_at at time zone 'America/Mexico_City') <> 0
     or extract(hour from p_inicia_at at time zone 'America/Mexico_City') not in (6, 8, 10, 12, 14, 16, 18, 20) then
    perform privado.error('Elige un bloque futuro dentro de los 30 días siguientes a la fecha original.');
  end if;
  if exists (select 1 from app.solicitudes x where x.mvz_id = y.id and x.inicia_at = p_inicia_at and x.estado in ('por_pagar', 'confirmada')) then
    perform privado.error('Ya tienes una consulta en ese horario.');
  end if;
  perform privado.limitar('proponer_reagenda', 6, interval '1 day');
  update app.solicitudes set reagenda_propuesta_at = p_inicia_at where id = s.id;
  perform privado.avisar(s.tutor_id, 'reagenda', 'El médico veterinario propone otro horario',
    'Propone mover tu consulta al ' || privado.cuando(p_inicia_at) || '. Entra a LilieVET para aceptar o conservar el horario actual.', s.id);
end $function$
;

CREATE OR REPLACE FUNCTION public.reportar(p_solicitud uuid, p_tipo text, p_detalle text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  p app.perfiles := privado.yo();
  s app.solicitudes;
  v_det text := privado.txt(p_detalle, 10, 1000, 'El detalle del reporte (al menos 10 caracteres)');
begin
  if p_tipo is null or p_tipo not in ('inasistencia_mvz', 'reembolso', 'tutor_ausente', 'datos_personales', 'otro') then perform privado.error('Elige el tipo de reporte.'); end if;
  if p.rol = 'tutor' and p_tipo = 'tutor_ausente' or p.rol = 'mvz' and p_tipo in ('inasistencia_mvz', 'reembolso') then
    perform privado.error('Ese tipo de reporte no corresponde a tu cuenta.');
  end if;
  perform privado.limitar('reportar', 5, interval '1 day');

  if p_solicitud is not null then
    select * into s from app.solicitudes where id = p_solicitud and (tutor_id = p.id or mvz_id = p.id);
    if not found then perform privado.error('No encontramos esa consulta.'); end if;
    if p_tipo in ('inasistencia_mvz', 'tutor_ausente') then
      if s.estado not in ('confirmada', 'realizada') or now() < s.inicia_at or now() > s.termina_at + interval '7 days' then
        perform privado.error('Este reporte se puede enviar desde que empieza el horario de la consulta y hasta 7 días después.');
      end if;
    end if;
  elsif p_tipo not in ('datos_personales', 'otro') then
    perform privado.error('Elige la consulta de la que trata el reporte.');
  end if;

  begin
    insert into app.reportes (solicitud_id, autor_id, tipo, detalle) values (p_solicitud, p.id, p_tipo, v_det);
  exception when unique_violation then
    perform privado.error('Ya tenemos un reporte abierto de este tipo para esa consulta. Lo estamos revisando.');
  end;
  perform privado.avisar_admins('reporte', 'Reporte nuevo', 'Hay un reporte nuevo por revisar en el Panel.', p_solicitud);
end $function$
;

CREATE OR REPLACE FUNCTION public.responder_encuesta(p_solicitud uuid, p jsonb)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare t app.perfiles := privado.yo('tutor'); s app.solicitudes;
begin
  select * into s from app.solicitudes where id = p_solicitud and tutor_id = t.id;
  if not found or s.estado not in ('realizada', 'mvz_no_asistio') or s.cerrada_at < now() - interval '30 days' then
    perform privado.error('Esta encuesta ya no está disponible.');
  end if;
  begin
    insert into app.encuestas (solicitud_id, tutor_id, se_presento, puntualidad, trato, recomendaria, comentario)
    values (s.id, t.id, coalesce((p ->> 'se_presento')::boolean, true), (p ->> 'puntualidad')::smallint, (p ->> 'trato')::smallint,
            (p ->> 'recomendaria')::smallint, privado.txt(p ->> 'comentario', 0, 1000, 'El comentario'));
  exception
    when unique_violation then perform privado.error('Ya respondiste esta encuesta. Gracias.');
    when check_violation or invalid_text_representation or numeric_value_out_of_range then perform privado.error('Revisa tus respuestas e intenta de nuevo.');
  end;
end $function$
;

CREATE OR REPLACE FUNCTION public.responder_reagenda(p_solicitud uuid, p_acepta boolean)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare t app.perfiles := privado.yo('tutor'); s app.solicitudes;
begin
  select * into s from app.solicitudes where id = p_solicitud and tutor_id = t.id for update;
  if not found or s.estado <> 'confirmada' or s.reagenda_propuesta_at is null then perform privado.error('No hay un cambio de horario por responder.'); end if;
  if p_acepta then
    if s.reagenda_propuesta_at <= now() then perform privado.error('El horario propuesto ya pasó. Pide al médico que proponga otro.'); end if;
    begin
      update app.solicitudes set inicia_at = s.reagenda_propuesta_at, termina_at = s.reagenda_propuesta_at + interval '2 hours',
        reagendas = reagendas + 1, reagenda_propuesta_at = null where id = s.id;
    exception when unique_violation then
      perform privado.error('Ese horario ya se ocupó. Pide al médico que proponga otro.');
    end;
    perform privado.avisar(s.mvz_id, 'reagenda', 'El tutor aceptó el cambio de horario',
      'La consulta queda para el ' || privado.cuando(s.reagenda_propuesta_at) || '.', s.id);
  else
    update app.solicitudes set reagenda_propuesta_at = null where id = s.id;
    perform privado.avisar(s.mvz_id, 'reagenda', 'El tutor no aceptó el cambio de horario',
      'La consulta sigue para el ' || privado.cuando(s.inicia_at) || '.', s.id);
  end if;
  perform privado.auditar('responder_reagenda', 'solicitud', s.id::text, jsonb_build_object('acepta', p_acepta));
end $function$
;

CREATE OR REPLACE FUNCTION public.responder_solicitud(p_solicitud uuid, p_acepta boolean)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  y app.perfiles := privado.yo('mvz');
  m app.mvz;
  s app.solicitudes;
  o app.solicitud_opciones;
  r record;
begin
  if p_acepta is null then perform privado.error('Elige aceptar o rechazar.'); end if;
  select * into o from app.solicitud_opciones where solicitud_id = p_solicitud and mvz_id = y.id;
  if o.solicitud_id is null then perform privado.error('Esta solicitud ya no está esperando tu respuesta.'); end if;
  select * into s from app.solicitudes where id = p_solicitud for update;
  select * into o from app.solicitud_opciones where solicitud_id = p_solicitud and mvz_id = y.id;
  if s.id is null or s.estado <> 'buscando' or o.estado <> 'pendiente' then
    perform privado.error('Esta solicitud ya no está esperando tu respuesta.');
  end if;
  if o.vence_at <= now() then
    perform privado.tick();
    return jsonb_build_object('resultado', 'vencida');
  end if;

  if not p_acepta then
    update app.solicitud_opciones set estado = 'rechazada', respondida_at = now() where solicitud_id = s.id and orden = o.orden;
    perform privado.ofrecer_siguiente(s.id);
    return jsonb_build_object('resultado', 'rechazada');
  end if;

  select * into m from app.mvz where id = y.id;
  if not privado.disponible(y.id, s.alcaldia, s.servicio, s.inicia_at) then
    perform privado.error('Ya no puedes tomar esta solicitud: revisa que tu cuenta esté activa y que no tengas otra consulta en ese horario.');
  end if;
  begin
    update app.solicitudes set estado = 'por_pagar', mvz_id = y.id, precio_servicio = privado.precio(m, s.servicio), aceptada_at = now(),
      pagar_antes_de = least(now() + make_interval(hours => privado.param_int('horas_para_pagar')), s.inicia_at - interval '30 minutes')
      where id = s.id;
  exception when unique_violation then
    perform privado.error('Ya tienes otra consulta en ese mismo horario.');
  end;
  update app.solicitud_opciones set estado = 'aceptada', respondida_at = now() where solicitud_id = s.id and orden = o.orden;
  update app.solicitud_opciones set estado = 'descartada', respondida_at = now() where solicitud_id = s.id and estado = 'en_espera';

  -- Otras solicitudes que esperaban a este médico en el mismo bloque pasan a su siguiente opción
  for r in select o2.solicitud_id, o2.orden from app.solicitud_opciones o2 join app.solicitudes s2 on s2.id = o2.solicitud_id
           where o2.mvz_id = y.id and o2.estado = 'pendiente' and s2.inicia_at = s.inicia_at and s2.id <> s.id loop
    update app.solicitud_opciones set estado = 'descartada', respondida_at = now() where solicitud_id = r.solicitud_id and orden = r.orden;
    perform privado.ofrecer_siguiente(r.solicitud_id);
  end loop;

  -- El correo y el WhatsApp de este aviso llevan el enlace directo al cobro (ver enviar-avisos)
  perform privado.avisar(s.tutor_id, 'aceptada', 'Un médico veterinario aceptó tu solicitud',
    (select 'Para confirmar tu consulta del ' || privado.cuando(x.inicia_at) || ', paga la cuota de servicio de $' || x.cuota
            || ' antes del ' || privado.cuando(x.pagar_antes_de) || '. Si no se paga a tiempo, el horario se libera y no se cobra nada.'
     from app.solicitudes x where x.id = s.id), s.id);
  return jsonb_build_object('resultado', 'aceptada');
end $function$
;

CREATE OR REPLACE FUNCTION public.rls_auto_enable()
 RETURNS event_trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog'
AS $function$
DECLARE
  cmd record;
  tbl name;
BEGIN
  FOR cmd IN
    SELECT *
    FROM pg_event_trigger_ddl_commands()
    WHERE command_tag IN ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
      AND object_type IN ('table','partitioned table')
  LOOP
     IF cmd.schema_name IS NOT NULL AND cmd.schema_name IN ('public') AND cmd.schema_name NOT IN ('pg_catalog','information_schema') AND cmd.schema_name NOT LIKE 'pg_toast%' AND cmd.schema_name NOT LIKE 'pg_temp%' THEN
      BEGIN
        SELECT c.relname INTO tbl FROM pg_catalog.pg_class c WHERE c.oid = cmd.objid;
        EXECUTE format('alter table if exists %I.%I enable row level security', cmd.schema_name, tbl);
        RAISE LOG 'rls_auto_enable: enabled RLS on %', cmd.object_identity;
      EXCEPTION
        WHEN OTHERS THEN
          RAISE LOG 'rls_auto_enable: failed to enable RLS on %', cmd.object_identity;
      END;
     ELSE
        RAISE LOG 'rls_auto_enable: skip % (either system schema or not in enforced list: %.)', cmd.object_identity, cmd.schema_name;
     END IF;
  END LOOP;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.sincronizar_telefono()
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  p app.perfiles := privado.yo();
  v_tel text; v_conf timestamptz;
begin
  select regexp_replace(coalesce(u.phone, ''), '[^0-9]', '', 'g'), u.phone_confirmed_at into v_tel, v_conf from auth.users u where u.id = p.id;
  if v_conf is null or char_length(v_tel) < 10 then return false; end if;
  update app.perfiles set telefono = right(v_tel, 10), telefono_verificado_at = v_conf where id = p.id;
  return true;
end $function$
