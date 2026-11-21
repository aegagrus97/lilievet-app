CREATE OR REPLACE FUNCTION public.admin_auditoria()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$ declare v jsonb; begin
  perform privado.exigir_admin();
  select coalesce(jsonb_agg(x order by x.created_at desc), '[]'::jsonb) into v from (
    select a.id, a.accion, a.objeto, a.objeto_id, a.detalle, a.created_at,
      (select p.nombre || ' ' || p.apellidos from app.perfiles p where p.id = a.actor_id) as actor
    from app.auditoria a order by a.created_at desc limit 200) x;
  return v;
end $function$
;

CREATE OR REPLACE FUNCTION public.admin_cerrar_solicitud(p_solicitud uuid, p_estado text, p_motivo text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare s app.solicitudes; v_motivo text := privado.txt(p_motivo, 5, 300, 'El motivo');
begin
  perform privado.exigir_admin();
  if p_estado is null or p_estado not in ('cancelada_admin', 'mvz_no_asistio', 'tutor_ausente') then perform privado.error('Acción no válida.'); end if;
  select * into s from app.solicitudes where id = p_solicitud for update;
  if not found or s.estado not in ('buscando', 'por_pagar', 'confirmada', 'realizada') then perform privado.error('Esta solicitud ya está cerrada.'); end if;
  if p_estado in ('mvz_no_asistio', 'tutor_ausente') and s.estado not in ('confirmada', 'realizada') then
    perform privado.error('Eso solo aplica a consultas confirmadas.');
  end if;
  update app.solicitudes set estado = p_estado, cerrada_at = now(), motivo_cierre = v_motivo, reagenda_propuesta_at = null where id = s.id;
  update app.solicitud_opciones set estado = 'descartada', respondida_at = now() where solicitud_id = s.id and estado in ('en_espera', 'pendiente');
  if p_estado in ('cancelada_admin', 'mvz_no_asistio') then perform privado.pedir_reembolso(s.id, v_motivo); end if;
  perform privado.avisar(s.tutor_id, 'cierre', 'Actualizamos tu consulta',
    case when p_estado = 'tutor_ausente' then 'Registramos que no fue posible atenderte en el domicilio. La cuota de servicio no se reembolsa.'
         else 'Cerramos tu consulta del ' || privado.cuando(s.inicia_at) || '. Si pagaste la cuota de servicio, se te reembolsa completa.' end, s.id);
  if s.mvz_id is not null then
    perform privado.avisar(s.mvz_id, 'cierre', 'Actualizamos una consulta', 'LilieVET cerró la consulta del ' || privado.cuando(s.inicia_at) || '.', s.id);
  end if;
  perform privado.auditar('cerrar_solicitud', 'solicitud', s.id::text, jsonb_build_object('estado', p_estado, 'motivo', v_motivo));
  if p_estado = 'mvz_no_asistio' and s.mvz_id is not null then perform privado.registrar_advertencia_mvz(s.mvz_id, s.id); end if;
end $function$
;

CREATE OR REPLACE FUNCTION public.admin_cuenta(p_cuenta uuid, p_accion text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_ya timestamptz; v_ok boolean;
begin
  perform privado.exigir_admin();
  if p_cuenta = auth.uid() and p_accion = 'bloquear' then perform privado.error('No puedes suspender tu propia cuenta.'); end if;
  if p_accion = 'verificar_telefono' then
    select telefono_verificado_at into v_ya from app.perfiles where id = p_cuenta;
    update app.perfiles set telefono_verificado_at = coalesce(telefono_verificado_at, now()) where id = p_cuenta;
    v_ok := found;
    -- Avisa solo la primera vez (si ya estaba verificado no se repite el aviso)
    if v_ok and v_ya is null then
      perform privado.avisar(p_cuenta, 'celular', 'Tu celular quedó verificado', 'Confirmamos tu número. Ya puedes solicitar consultas en LilieVET.');
    end if;
  elsif p_accion = 'bloquear' then update app.perfiles set bloqueada = true where id = p_cuenta; v_ok := found;
  elsif p_accion = 'desbloquear' then update app.perfiles set bloqueada = false where id = p_cuenta; v_ok := found;
  else perform privado.error('Acción no válida.'); end if;
  if not v_ok then perform privado.error('No encontramos esa cuenta.'); end if;
  perform privado.auditar('cuenta_' || p_accion, 'perfil', p_cuenta::text);
end $function$
;

CREATE OR REPLACE FUNCTION public.admin_decidir_mvz(p_mvz uuid, p_accion text, p_cedula_ok boolean DEFAULT false, p_identidad_ok boolean DEFAULT false)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare m app.mvz;
begin
  perform privado.exigir_admin();
  select * into m from app.mvz where id = p_mvz for update;
  if not found then perform privado.error('No encontramos a ese médico veterinario.'); end if;
  if p_accion = 'aprobar' then
    if m.cedula is null then perform privado.error('Falta el número de cédula.'); end if;
    if not (coalesce(p_cedula_ok, false) or m.cedula_verificada_at is not null) or not (coalesce(p_identidad_ok, false) or m.identidad_verificada_at is not null) then
      perform privado.error('Marca que verificaste la cédula y la identidad antes de aprobar.');
    end if;
    update app.mvz set estado = 'aprobado', cedula_verificada_at = coalesce(cedula_verificada_at, now()),
      identidad_verificada_at = coalesce(identidad_verificada_at, now()), verificada_por = auth.uid() where id = m.id;
    -- En la videollamada también se confirma su celular
    update app.perfiles set telefono_verificado_at = coalesce(telefono_verificado_at, now()) where id = m.id;
    perform privado.avisar(m.id, 'alta', 'Tu cuenta fue aprobada', 'Ya puedes recibir solicitudes en LilieVET. Revisa tu horario, zonas y precios.');
  elsif p_accion = 'reverificar' then
    update app.mvz set cedula_verificada_at = now(), verificada_por = auth.uid() where id = m.id and estado = 'aprobado';
  elsif p_accion = 'suspender' then
    update app.mvz set estado = 'suspendido' where id = m.id;
  elsif p_accion = 'reactivar' then
    if m.cedula_verificada_at is null then perform privado.error('Primero hay que aprobar la cuenta.'); end if;
    -- Al reactivar, las advertencias vuelven a cero (solo cuentan las cancelaciones posteriores)
    update app.mvz set estado = 'aprobado', advertencias_desde = now(), suspendido_por_cancelaciones_at = null where id = m.id;
    perform privado.avisar(m.id, 'alta', 'Reactivamos tu cuenta', 'Ya puedes recibir solicitudes otra vez. Tus advertencias por cancelación empiezan de cero.');
  elsif p_accion = 'quitar_foto' then
    if m.foto is null then perform privado.error('Ese médico no tiene foto.'); end if;
    update app.mvz set foto = null where id = m.id;
    perform privado.avisar(m.id, 'foto', 'Quitamos tu foto de perfil', 'Tu foto no cumplía con lo que pedimos. Sube otra en Servicios: de frente, con buena luz y que se vea tu cara.');
  elsif p_accion = 'corregir_cedula' then
    if m.cedula is null then perform privado.error('Ya se le pidió corregir su cédula; falta que la vuelva a escribir.'); end if;
    update app.mvz set estado = 'pendiente', cedula = null, cedula_verificada_at = null where id = m.id;
    perform privado.avisar(m.id, 'cedula', 'Revisa tu número de cédula', 'No pudimos verificar tu cédula profesional en el Registro Nacional de Profesionistas. Escríbela de nuevo en Servicios y guarda los cambios.');
  else
    perform privado.error('Acción no válida.');
  end if;
  perform privado.auditar('mvz_' || p_accion, 'mvz', m.id::text);
end $function$
;

CREATE OR REPLACE FUNCTION public.admin_eliminar_datos(p_cuenta uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  perform privado.exigir_admin();
  if p_cuenta = auth.uid() or exists (select 1 from app.admins where id = p_cuenta) then perform privado.error('Una cuenta administradora no se elimina desde el Panel.'); end if;
  if not exists (select 1 from app.perfiles where id = p_cuenta) then perform privado.error('No encontramos esa cuenta.'); end if;
  if exists (select 1 from app.solicitudes s where (s.tutor_id = p_cuenta or s.mvz_id = p_cuenta) and s.estado in ('buscando', 'por_pagar', 'confirmada')) then
    perform privado.error('Esa cuenta tiene consultas en curso. Ciérralas antes de eliminar sus datos.');
  end if;
  if exists (select 1 from app.pagos g join app.solicitudes s on s.id = g.solicitud_id where s.tutor_id = p_cuenta and g.estado = 'reembolso_pendiente') then
    perform privado.error('Esa cuenta tiene un reembolso pendiente. Envíalo antes de eliminar sus datos.');
  end if;
  update app.solicitudes set mascota = '-', colonia = 'eliminado', calle_numero = 'eliminado', cp = '00000', referencias = null, motivo = null where tutor_id = p_cuenta;
  delete from app.demanda_sin_medico where tutor_id = p_cuenta;
  -- La cuenta de acceso queda sin correo, sin celular, sin contraseña y sin poder entrar
  update auth.users set email = 'eliminada-' || id::text || '@invalid.invalid', phone = null, phone_confirmed_at = null,
    raw_user_meta_data = '{}'::jsonb, encrypted_password = '', banned_until = 'infinity' where id = p_cuenta;
  update app.perfiles set nombre = 'Cuenta', apellidos = 'eliminada', correo = '', telefono = '0000000000', telefono_verificado_at = null, bloqueada = true where id = p_cuenta;
  update app.mvz set estado = 'suspendido', cedula = null, cedula_verificada_at = null, presentacion = null, foto = null, comparte_telefono_at = null, recibe_solicitudes = false where id = p_cuenta;
  delete from app.mvz_zonas where mvz_id = p_cuenta;
  delete from app.mvz_horario where mvz_id = p_cuenta;
  delete from app.mvz_bloqueos where mvz_id = p_cuenta;
  delete from app.avisos where destinatario_id = p_cuenta;
  update app.reportes set detalle = 'Contenido eliminado a petición del titular.' where autor_id = p_cuenta and estado = 'resuelto';
  update app.encuestas set comentario = null where tutor_id = p_cuenta;
  perform privado.auditar('eliminar_datos', 'perfil', p_cuenta::text);
end $function$
;

CREATE OR REPLACE FUNCTION public.admin_encuestas()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$ declare v jsonb; begin
  perform privado.exigir_admin();
  select coalesce(jsonb_agg(x order by x.created_at desc), '[]'::jsonb) into v from (
    select e.solicitud_id, e.se_presento, e.puntualidad, e.trato, e.recomendaria, e.comentario, e.created_at, s.servicio, s.inicia_at,
      (select pm.nombre || ' ' || pm.apellidos from app.perfiles pm where pm.id = s.mvz_id) as medico
    from app.encuestas e join app.solicitudes s on s.id = e.solicitud_id order by e.created_at desc limit 300) x;
  return v;
end $function$
;

CREATE OR REPLACE FUNCTION public.admin_guardar_parametro(p_clave text, p_valor text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare n integer;
begin
  perform privado.exigir_admin();
  if p_clave in ('version_terminos', 'version_privacidad', 'version_carta') then
    if coalesce(p_valor, '') !~ '^[0-9A-Za-z._-]{1,20}$' then perform privado.error('La versión lleva solo letras, números, punto o guion.'); end if;
    update app.parametros set valor = to_jsonb(p_valor), actualizado_at = now() where clave = p_clave;
  elsif p_clave = 'exigir_telefono_verificado' then
    if p_valor not in ('true', 'false') then perform privado.error('Valor no válido.'); end if;
    update app.parametros set valor = p_valor::jsonb, actualizado_at = now() where clave = p_clave;
  elsif p_clave in ('cuota_servicio', 'minutos_respuesta', 'horas_para_pagar', 'horas_cancelacion', 'horas_anticipacion', 'dias_agenda') then
    begin n := p_valor::integer; exception when others then perform privado.error('Escribe un número entero.'); end;
    if (p_clave = 'cuota_servicio' and n not between 1 and 5000) or (p_clave = 'minutos_respuesta' and n not between 10 and 720)
       or (p_clave = 'horas_para_pagar' and n not between 1 and 72) or (p_clave = 'horas_cancelacion' and n not between 0 and 168)
       or (p_clave = 'horas_anticipacion' and n not between 2 and 72) or (p_clave = 'dias_agenda' and n not between 1 and 60) then
      perform privado.error('Ese valor está fuera del rango permitido.');
    end if;
    update app.parametros set valor = to_jsonb(n), actualizado_at = now() where clave = p_clave;
  else
    perform privado.error('Ese parámetro no existe.');
  end if;
  perform privado.auditar('parametro', 'parametro', p_clave, jsonb_build_object('valor', p_valor));
end $function$
;

CREATE OR REPLACE FUNCTION public.admin_medicos()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$ declare v jsonb; begin
  perform privado.exigir_admin();
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', m.id, 'nombre', p.nombre, 'apellidos', p.apellidos, 'correo', p.correo, 'telefono', p.telefono, 'bloqueada', p.bloqueada,
    'estado', m.estado, 'cedula', m.cedula, 'cedula_verificada_at', m.cedula_verificada_at, 'identidad_verificada_at', m.identidad_verificada_at,
    'presentacion', m.presentacion, 'foto', m.foto, 'precio_consulta', m.precio_consulta, 'precio_vacunacion', m.precio_vacunacion, 'precio_desparasitacion', m.precio_desparasitacion,
    'medios_pago', m.medios_pago, 'comparte_telefono', m.comparte_telefono_at is not null, 'recibe_solicitudes', m.recibe_solicitudes,
    'zonas', coalesce((select jsonb_agg(alcaldia order by alcaldia) from app.mvz_zonas where mvz_id = m.id), '[]'::jsonb),
    'bloques', (select count(*) from app.mvz_horario where mvz_id = m.id),
    'advertencias', privado.advertencias_mvz(m.id), 'suspendido_por_cancelaciones', m.suspendido_por_cancelaciones_at is not null,
    'created_at', p.created_at) order by (m.estado = 'pendiente') desc, p.created_at desc), '[]'::jsonb) into v
  from app.mvz m join app.perfiles p on p.id = m.id;
  return v;
end $function$
;

CREATE OR REPLACE FUNCTION public.admin_pagos()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$ declare v jsonb; begin
  perform privado.exigir_admin();
  select coalesce(jsonb_agg(x order by x.created_at desc), '[]'::jsonb) into v from (
    select g.id, g.solicitud_id, g.principal, g.monto, g.estado, g.mp_payment_id, g.mp_refund_id, g.motivo_reembolso, g.intentos_reembolso,
      g.aprobado_at, g.reembolsado_at, g.created_at, t.nombre || ' ' || t.apellidos as tutor
    from app.pagos g join app.solicitudes s on s.id = g.solicitud_id join app.perfiles t on t.id = s.tutor_id
    where g.estado <> 'creado' order by g.created_at desc limit 300) x;
  return v;
end $function$
;

CREATE OR REPLACE FUNCTION public.admin_parametros()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$ begin
  perform privado.exigir_admin();
  return (select jsonb_object_agg(clave, valor) from app.parametros);
end $function$
;

CREATE OR REPLACE FUNCTION public.admin_reportes()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$ declare v jsonb; begin
  perform privado.exigir_admin();
  select coalesce(jsonb_agg(x order by (x.estado = 'abierto') desc, x.created_at desc), '[]'::jsonb) into v from (
    select r.id, r.tipo, r.detalle, r.estado, r.decision, r.resolucion, r.version_medico, r.version_medico_at, r.created_at, r.resuelto_at, r.solicitud_id,
      s.llegada_at,
      a.nombre || ' ' || a.apellidos as autor, a.rol as autor_rol, a.telefono as autor_telefono, a.correo as autor_correo,
      s.estado as solicitud_estado, s.inicia_at, s.servicio,
      (select pm.nombre || ' ' || pm.apellidos from app.perfiles pm where pm.id = s.mvz_id) as medico,
      (select pm.telefono from app.perfiles pm where pm.id = s.mvz_id) as medico_telefono,
      (select g.estado from app.pagos g where g.solicitud_id = s.id and g.principal) as pago
    from app.reportes r join app.perfiles a on a.id = r.autor_id left join app.solicitudes s on s.id = r.solicitud_id
    order by r.created_at desc limit 300) x;
  return v;
end $function$
;

CREATE OR REPLACE FUNCTION public.admin_resolver_reporte(p_reporte uuid, p_decision text, p_version_medico text, p_resolucion text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare r app.reportes; s app.solicitudes;
begin
  perform privado.exigir_admin();
  if p_decision is null or p_decision not in ('reembolsar', 'no_procede', 'atendido') then perform privado.error('Elige una decisión.'); end if;
  select * into r from app.reportes where id = p_reporte for update;
  if not found or r.estado <> 'abierto' then perform privado.error('Este reporte ya está resuelto.'); end if;

  if p_decision = 'reembolsar' then
    select * into s from app.solicitudes where id = r.solicitud_id for update;
    if not found then perform privado.error('Este reporte no tiene una consulta asociada.'); end if;
    if r.tipo = 'inasistencia_mvz' and s.estado in ('confirmada', 'realizada') then
      update app.solicitudes set estado = 'mvz_no_asistio', cerrada_at = now(), motivo_cierre = 'Reporte de inasistencia procedente', reagenda_propuesta_at = null where id = s.id;
      if s.mvz_id is not null then perform privado.registrar_advertencia_mvz(s.mvz_id, s.id); end if;
    end if;
    if not privado.pedir_reembolso(s.id, 'Reporte procedente') then
      perform privado.error('Esa consulta no tiene un pago aprobado por reembolsar (o ya se reembolsó).');
    end if;
  end if;

  -- Si el médico ya respondió desde la app y el Panel no escribe nada, se conserva su versión
  update app.reportes set estado = 'resuelto', decision = p_decision,
    version_medico = coalesce(nullif(privado.txt(p_version_medico, 0, 1000, 'La versión del médico'), ''), version_medico),
    resolucion = privado.txt(p_resolucion, 5, 1000, 'La respuesta'), resuelto_por = auth.uid(), resuelto_at = now() where id = r.id;
  perform privado.avisar(r.autor_id, 'reporte', 'Respondimos tu reporte', 'Entra a LilieVET para ver la respuesta.', r.solicitud_id);
  perform privado.auditar('resolver_reporte', 'reporte', r.id::text, jsonb_build_object('decision', p_decision));
end $function$
;

CREATE OR REPLACE FUNCTION public.admin_resumen()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$ begin
  perform privado.exigir_admin();
  perform privado.tick();
  return jsonb_build_object(
    'medicos_pendientes', (select count(*) from app.mvz where estado = 'pendiente' and cedula is not null),
    'medicos_aprobados', (select count(*) from app.mvz where estado = 'aprobado'),
    'tutores', (select count(*) from app.perfiles where rol = 'tutor'),
    'tutores_sin_verificar', (select count(*) from app.perfiles where rol = 'tutor' and not bloqueada and telefono_verificado_at is null),
    'reportes_abiertos', (select count(*) from app.reportes where estado = 'abierto'),
    'reembolsos_pendientes', (select count(*) from app.pagos where estado = 'reembolso_pendiente'),
    'buscando', (select count(*) from app.solicitudes where estado = 'buscando'),
    'por_pagar', (select count(*) from app.solicitudes where estado = 'por_pagar'),
    'confirmadas', (select count(*) from app.solicitudes where estado = 'confirmada'),
    'realizadas_30d', (select count(*) from app.solicitudes where estado = 'realizada' and cerrada_at > now() - interval '30 days'),
    'cuotas_30d', (select coalesce(sum(monto), 0) from app.pagos where estado = 'aprobado' and aprobado_at > now() - interval '30 days'),
    'reembolsado_30d', (select coalesce(sum(monto), 0) from app.pagos where estado = 'reembolsado' and reembolsado_at > now() - interval '30 days'),
    -- Lo que reporta Mercado Pago de las cuotas vigentes cobradas en los últimos 30 días
    'comision_30d', (select coalesce(sum(comision_mp), 0) from app.pagos where estado = 'aprobado' and aprobado_at > now() - interval '30 days'),
    'retenciones_30d', (select coalesce(sum(retenciones_mp), 0) from app.pagos where estado = 'aprobado' and aprobado_at > now() - interval '30 days'),
    'depositado_30d', (select coalesce(sum(neto_mp), 0) from app.pagos where estado = 'aprobado' and aprobado_at > now() - interval '30 days'),
    'pagos_sin_detalle_30d', (select count(*) from app.pagos where estado = 'aprobado' and aprobado_at > now() - interval '30 days' and neto_mp is null),
    'encuestas', (select count(*) from app.encuestas)
  );
end $function$
;

CREATE OR REPLACE FUNCTION public.admin_solicitudes()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$ declare v jsonb; begin
  perform privado.exigir_admin();
  perform privado.tick();
  select coalesce(jsonb_agg(x order by x.created_at desc), '[]'::jsonb) into v from (
    select s.id, s.servicio, s.especie, s.alcaldia, s.colonia, s.inicia_at, s.estado, s.cuota, s.precio_servicio, s.created_at, s.motivo_cierre, s.reagendas,
      t.nombre || ' ' || t.apellidos as tutor, t.telefono as tutor_telefono,
      (select pm.nombre || ' ' || pm.apellidos from app.perfiles pm where pm.id = s.mvz_id) as medico,
      (select g.estado from app.pagos g where g.solicitud_id = s.id and g.principal) as pago,
      (select jsonb_agg(jsonb_build_object('orden', o.orden, 'estado', o.estado, 'nombre', po.nombre || ' ' || po.apellidos) order by o.orden)
         from app.solicitud_opciones o join app.perfiles po on po.id = o.mvz_id where o.solicitud_id = s.id) as opciones
    from app.solicitudes s join app.perfiles t on t.id = s.tutor_id order by s.created_at desc limit 300) x;
  return v;
end $function$
;

CREATE OR REPLACE FUNCTION public.admin_tutores()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$ declare v jsonb; begin
  perform privado.exigir_admin();
  select coalesce(jsonb_agg(x order by x.created_at desc), '[]'::jsonb) into v from (
    select p.id, p.nombre, p.apellidos, p.correo, p.telefono, p.telefono_verificado_at, p.bloqueada, p.created_at,
      (select count(*) from app.solicitudes s where s.tutor_id = p.id) as solicitudes
    from app.perfiles p where p.rol = 'tutor' order by p.created_at desc limit 500) x;
  return v;
end $function$
