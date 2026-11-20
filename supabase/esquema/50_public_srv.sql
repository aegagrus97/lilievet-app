CREATE OR REPLACE FUNCTION public.srv_avisos_pendientes()
 RETURNS jsonb
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$ select coalesce(jsonb_agg(jsonb_build_object('id', a.id, 'correo', p.correo, 'telefono', p.telefono, 'nombre', p.nombre, 'titulo', a.titulo, 'cuerpo', a.cuerpo,
     'tipo', a.tipo, 'solicitud_id', a.solicitud_id, 'rol', p.rol, 'ya_whatsapp', a.whatsapp_at is not null)), '[]'::jsonb)
   from (select * from app.avisos where correo_at is null and intentos < 5 and created_at > now() - interval '2 days' order by created_at limit 40) a
   join app.perfiles p on p.id = a.destinatario_id $function$
;

CREATE OR REPLACE FUNCTION public.srv_es_admin(p_cuenta uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$ select exists (select 1 from app.admins a join app.perfiles p on p.id = a.id where a.id = p_cuenta and not p.bloqueada) $function$
;

CREATE OR REPLACE FUNCTION public.srv_guardar_preferencia(p_pago uuid, p_preferencia text)
 RETURNS void
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$ update app.pagos set mp_preference_id = left(p_preferencia, 100) where id = p_pago and estado = 'creado' $function$
;

CREATE OR REPLACE FUNCTION public.srv_marcar_aviso(p_aviso bigint, p_correo boolean, p_whatsapp boolean)
 RETURNS void
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$ update app.avisos set intentos = intentos + 1,
     correo_at = case when p_correo then now() else correo_at end,
     whatsapp_at = case when p_whatsapp then now() else whatsapp_at end
   where id = p_aviso $function$
;

CREATE OR REPLACE FUNCTION public.srv_marcar_reembolso(p_pago uuid, p_ok boolean, p_refund text, p_error text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare g app.pagos; s app.solicitudes;
begin
  select * into g from app.pagos where id = p_pago;
  if not found then return; end if;
  perform 1 from app.solicitudes where id = g.solicitud_id for update;
  select * into g from app.pagos where id = p_pago and estado = 'reembolso_pendiente' for update;
  if not found then return; end if;
  if p_ok then
    update app.pagos set estado = 'reembolsado', reembolsado_at = now(), mp_refund_id = left(p_refund, 60) where id = g.id;
    select * into s from app.solicitudes where id = g.solicitud_id;
    perform privado.avisar(s.tutor_id, 'reembolso', 'Reembolso enviado',
      'Reembolsamos tu cuota de servicio. Mercado Pago la acredita en el mismo medio con el que pagaste; puede tardar unos días.', s.id);
    perform privado.auditar('reembolso', 'pago', g.id::text, jsonb_build_object('refund', left(p_refund, 60)));
  else
    update app.pagos set intentos_reembolso = intentos_reembolso + 1 where id = g.id;
    perform privado.auditar('reembolso_fallido', 'pago', g.id::text, jsonb_build_object('error', left(coalesce(p_error, ''), 300)));
  end if;
end $function$
;

CREATE OR REPLACE FUNCTION public.srv_preparar_pago(p_solicitud uuid, p_tutor uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare s app.solicitudes; g app.pagos; t app.perfiles;
begin
  perform privado.tick();
  select * into t from app.perfiles where id = p_tutor;
  if not found or t.bloqueada or t.rol <> 'tutor' then return jsonb_build_object('error', 'Tu cuenta no puede pagar en este momento.'); end if;
  if (select count(*) from app.intentos where cuenta_id = p_tutor and accion = 'crear_pago' and created_at > now() - interval '1 hour') >= 12 then
    return jsonb_build_object('error', 'Has abierto el cobro muchas veces. Espera un rato e intenta de nuevo.');
  end if;
  insert into app.intentos (cuenta_id, accion) values (p_tutor, 'crear_pago');
  select * into s from app.solicitudes where id = p_solicitud and tutor_id = p_tutor for update;
  if not found then return jsonb_build_object('error', 'No encontramos esa solicitud.'); end if;
  if s.estado <> 'por_pagar' or s.pagar_antes_de <= now() + interval '2 minutes' then
    return jsonb_build_object('error', 'Esta solicitud ya no está esperando pago.');
  end if;
  select * into g from app.pagos where solicitud_id = s.id and principal;
  if not found then
    insert into app.pagos (solicitud_id, monto) values (s.id, s.cuota) returning * into g;
  elsif g.estado <> 'creado' then
    return jsonb_build_object('error', 'Ya recibimos un pago para esta solicitud.');
  end if;
  return jsonb_build_object('pago_id', g.id, 'monto', g.monto, 'vence', s.pagar_antes_de, 'correo', t.correo,
    'titulo', 'Cuota de servicio LilieVET');
end $function$
;

CREATE OR REPLACE FUNCTION public.srv_reembolsos_pendientes()
 RETURNS jsonb
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$ select coalesce(jsonb_agg(jsonb_build_object('pago_id', id, 'mp_payment_id', mp_payment_id, 'monto', monto)), '[]'::jsonb)
   from (select id, mp_payment_id, monto from app.pagos where estado = 'reembolso_pendiente' and mp_payment_id is not null and intentos_reembolso < 8
         order by created_at limit 25) x $function$
;

CREATE OR REPLACE FUNCTION public.srv_registrar_pago(p_pago uuid, p_mp_payment text, p_estado text, p_monto numeric, p_moneda text)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare g app.pagos; s app.solicitudes;
begin
  if p_pago is null or coalesce(p_mp_payment, '') !~ '^[0-9]{1,30}$' then return 'ignorado'; end if;
  select * into g from app.pagos where id = p_pago;
  if not found then return 'desconocido'; end if;
  select * into s from app.solicitudes where id = g.solicitud_id for update;
  select * into g from app.pagos where id = p_pago for update;

  if p_estado = 'approved' then
    if g.mp_payment_id = p_mp_payment then return 'ya_registrado'; end if;
    if exists (select 1 from app.pagos where mp_payment_id = p_mp_payment) then return 'ya_registrado'; end if;

    -- Monto o moneda que no coinciden, pago repetido o solicitud que ya no esperaba pago: se devuelve completo
    if p_monto is distinct from g.monto::numeric or p_moneda is distinct from 'MXN' then
      insert into app.pagos (solicitud_id, principal, monto, estado, mp_payment_id, motivo_reembolso, aprobado_at)
        values (s.id, false, greatest(1, round(coalesce(p_monto, 1))::integer), 'reembolso_pendiente', p_mp_payment, 'El monto o la moneda no coinciden', now());
      perform privado.auditar('pago_monto_distinto', 'pago', g.id::text, jsonb_build_object('monto', p_monto, 'moneda', p_moneda, 'mp', p_mp_payment));
      return 'monto_distinto';
    end if;
    if g.estado <> 'creado' then
      insert into app.pagos (solicitud_id, principal, monto, estado, mp_payment_id, motivo_reembolso, aprobado_at)
        values (s.id, false, g.monto, 'reembolso_pendiente', p_mp_payment, 'Pago repetido', now());
      perform privado.auditar('pago_repetido', 'pago', g.id::text, jsonb_build_object('mp', p_mp_payment));
      return 'repetido';
    end if;
    if s.estado <> 'por_pagar' or s.inicia_at <= now() then
      update app.pagos set estado = 'reembolso_pendiente', mp_payment_id = p_mp_payment, aprobado_at = now(),
        motivo_reembolso = 'El pago llegó cuando la solicitud ya no estaba vigente' where id = g.id;
      perform privado.avisar(s.tutor_id, 'reembolso', 'Te devolvemos tu pago',
        'Tu pago llegó cuando la solicitud ya no estaba vigente. Te lo reembolsamos completo.', s.id);
      return 'tardio';
    end if;

    update app.pagos set estado = 'aprobado', mp_payment_id = p_mp_payment, aprobado_at = now() where id = g.id;
    update app.solicitudes set estado = 'confirmada', confirmada_at = now() where id = s.id;
    perform privado.avisar(s.tutor_id, 'confirmada', 'Tu consulta está confirmada',
      'Recibimos tu cuota de servicio. En LilieVET ya puedes ver los datos de contacto de tu médico veterinario. La consulta se paga directo a él.', s.id);
    perform privado.avisar(s.mvz_id, 'confirmada', 'Consulta confirmada',
      'El tutor confirmó la consulta del ' || privado.cuando(s.inicia_at) || '. En LilieVET ya puedes ver su contacto y domicilio.', s.id);
    return 'confirmada';

  elsif p_estado = 'refunded' then
    if g.mp_payment_id = p_mp_payment and g.estado = 'aprobado' then  -- reembolso hecho a mano desde Mercado Pago
      update app.pagos set estado = 'reembolsado', reembolsado_at = now(), motivo_reembolso = 'Reembolsado desde Mercado Pago' where id = g.id;
      return 'reembolsado';
    end if;
  elsif p_estado = 'charged_back' then
    if g.mp_payment_id = p_mp_payment and g.estado <> 'contracargo' then
      update app.pagos set estado = 'contracargo' where id = g.id;
      perform privado.auditar('contracargo', 'pago', g.id::text, jsonb_build_object('mp', p_mp_payment));
      perform privado.avisar_admins('contracargo', 'Contracargo recibido', 'Mercado Pago avisó de un contracargo. Revísalo en el Panel.', s.id);
      return 'contracargo';
    end if;
  end if;
  return 'ignorado';
end $function$
;

CREATE OR REPLACE FUNCTION public.srv_tick()
 RETURNS void
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$ select privado.tick() $function$
