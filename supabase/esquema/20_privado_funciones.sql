CREATE OR REPLACE FUNCTION privado.al_cambiar_correo()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$ begin
  if new.email is distinct from old.email then update app.perfiles set correo = coalesce(new.email, '') where id = new.id; end if;
  return new;
end $function$
;

CREATE OR REPLACE FUNCTION privado.al_crear_cuenta()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  d jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  v_rol text := d ->> 'rol';
  v_tel text := regexp_replace(coalesce(d ->> 'telefono', ''), '[^0-9]', '', 'g');
begin
  if v_rol is null then return new; end if;   -- cuentas creadas a mano desde Supabase
  if v_rol not in ('tutor', 'mvz') then raise exception 'Tipo de cuenta no válido.'; end if;
  if v_tel !~ '^[0-9]{10}$' then raise exception 'Escribe tu celular a 10 dígitos.'; end if;
  if coalesce(d ->> 'acepta_terminos', '') <> 'true' or coalesce(d ->> 'acepta_privacidad', '') <> 'true' then
    raise exception 'Acepta los Términos y el Aviso de Privacidad para crear tu cuenta.';
  end if;
  if v_rol = 'mvz' and coalesce(d ->> 'acepta_carta', '') <> 'true' then
    raise exception 'Acepta la Carta del Médico Veterinario para crear tu cuenta.';
  end if;

  insert into app.perfiles (id, rol, nombre, apellidos, correo, telefono)
  values (new.id, v_rol,
          privado.txt(d ->> 'nombre', 1, 60, 'Nombre'),
          privado.txt(d ->> 'apellidos', 1, 80, 'Apellidos'),
          coalesce(new.email, ''), v_tel);

  insert into app.aceptaciones (cuenta_id, documento, version) values
    (new.id, 'terminos', privado.param('version_terminos') #>> '{}'),
    (new.id, 'privacidad', privado.param('version_privacidad') #>> '{}');
  if v_rol = 'mvz' then
    insert into app.aceptaciones (cuenta_id, documento, version) values (new.id, 'carta_mvz', privado.param('version_carta') #>> '{}');
    insert into app.mvz (id) values (new.id);
  end if;
  return new;
end $function$
;

CREATE OR REPLACE FUNCTION privado.alcaldias()
 RETURNS text[]
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO ''
AS $function$ select array['Álvaro Obregón', 'Azcapotzalco', 'Benito Juárez', 'Coyoacán', 'Cuajimalpa', 'Cuauhtémoc',
  'Gustavo A. Madero', 'Iztacalco', 'Iztapalapa', 'Magdalena Contreras', 'Miguel Hidalgo', 'Milpa Alta',
  'Tláhuac', 'Tlalpan', 'Venustiano Carranza', 'Xochimilco'] $function$
;

CREATE OR REPLACE FUNCTION privado.auditar(p_accion text, p_objeto text, p_id text, p_detalle jsonb DEFAULT NULL::jsonb)
 RETURNS void
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$ insert into app.auditoria (actor_id, accion, objeto, objeto_id, detalle) values (auth.uid(), p_accion, p_objeto, p_id, p_detalle) $function$
;

CREATE OR REPLACE FUNCTION privado.avisar(p_dest uuid, p_tipo text, p_titulo text, p_cuerpo text, p_solicitud uuid DEFAULT NULL::uuid)
 RETURNS void
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$ insert into app.avisos (destinatario_id, tipo, titulo, cuerpo, solicitud_id) values (p_dest, p_tipo, p_titulo, p_cuerpo, p_solicitud) $function$
;

CREATE OR REPLACE FUNCTION privado.avisar_admins(p_tipo text, p_titulo text, p_cuerpo text, p_solicitud uuid DEFAULT NULL::uuid)
 RETURNS void
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$ insert into app.avisos (destinatario_id, tipo, titulo, cuerpo, solicitud_id)
   select a.id, p_tipo, p_titulo, p_cuerpo, p_solicitud from app.admins a join app.perfiles p on p.id = a.id $function$
;

CREATE OR REPLACE FUNCTION privado.cuando(p timestamp with time zone)
 RETURNS text
 LANGUAGE sql
 STABLE
 SET search_path TO ''
AS $function$ select to_char(p at time zone 'America/Mexico_City', 'DD/MM/YYYY "a las" HH24:MI') $function$
;

CREATE OR REPLACE FUNCTION privado.disponible(p_mvz uuid, p_alcaldia text, p_servicio text, p_inicia timestamp with time zone)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select exists (
    select 1
    from app.mvz m
    join app.perfiles p on p.id = m.id and not p.bloqueada and p.telefono_verificado_at is not null
    where m.id = p_mvz
      and m.estado = 'aprobado' and m.recibe_solicitudes
      and m.cedula_verificada_at is not null and m.comparte_telefono_at is not null
      and privado.precio(m, p_servicio) is not null
      and exists (select 1 from app.mvz_zonas z where z.mvz_id = m.id and z.alcaldia = p_alcaldia)
      and exists (select 1 from app.mvz_horario h where h.mvz_id = m.id
                  and h.dia = extract(isodow from p_inicia at time zone 'America/Mexico_City')
                  and h.hora = extract(hour from p_inicia at time zone 'America/Mexico_City'))
      and extract(minute from p_inicia at time zone 'America/Mexico_City') = 0
      and not exists (select 1 from app.mvz_bloqueos b where b.mvz_id = m.id and b.fecha = (p_inicia at time zone 'America/Mexico_City')::date)
      and not exists (select 1 from app.solicitudes s where s.mvz_id = m.id and s.inicia_at = p_inicia and s.estado in ('por_pagar', 'confirmada'))
  )
$function$
;

CREATE OR REPLACE FUNCTION privado.error(p_msg text)
 RETURNS void
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$ begin raise exception '%', p_msg using errcode = 'P0001'; end $function$
;

CREATE OR REPLACE FUNCTION privado.es_admin()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$ select auth.uid() is not null
     and exists (select 1 from app.admins where id = auth.uid())
     and coalesce(auth.jwt() ->> 'aal', '') = 'aal2' $function$
;

CREATE OR REPLACE FUNCTION privado.exigir_admin()
 RETURNS void
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$ begin
  if not privado.es_admin() then perform privado.error('Solo el Panel puede hacer esto. Entra con tu código de verificación.'); end if;
end $function$
;

CREATE OR REPLACE FUNCTION privado.limitar(p_accion text, p_max integer, p_ventana interval)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare n integer;
begin
  select count(*) into n from app.intentos where cuenta_id = auth.uid() and accion = p_accion and created_at > now() - p_ventana;
  if n >= p_max then perform privado.error('Has hecho esto muchas veces. Espera un rato e intenta de nuevo.'); end if;
  insert into app.intentos (cuenta_id, accion) values (auth.uid(), p_accion);
end $function$
;

CREATE OR REPLACE FUNCTION privado.ofrecer_siguiente(p_solicitud uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  s app.solicitudes;
  o app.solicitud_opciones;
  v_limite timestamptz;
begin
  select * into s from app.solicitudes where id = p_solicitud for update;
  if not found or s.estado <> 'buscando' then return; end if;
  if exists (select 1 from app.solicitud_opciones where solicitud_id = s.id and estado = 'pendiente') then return; end if;
  v_limite := s.inicia_at - interval '1 hour';

  for o in select * from app.solicitud_opciones where solicitud_id = s.id and estado = 'en_espera' order by orden loop
    if now() < v_limite and privado.disponible(o.mvz_id, s.alcaldia, s.servicio, s.inicia_at) then
      update app.solicitud_opciones
        set estado = 'pendiente', ofrecida_at = now(),
            vence_at = least(now() + make_interval(mins => privado.param_int('minutos_respuesta')), v_limite)
        where solicitud_id = s.id and orden = o.orden;
      perform privado.avisar(o.mvz_id, 'solicitud_nueva', 'Tienes una solicitud nueva',
        'Un tutor pidió ' || privado.servicio_txt(s.servicio) || ' para el ' || privado.cuando(s.inicia_at) || ' en ' || s.alcaldia
        || '. Entra a LilieVET para aceptarla o rechazarla.', s.id);
      return;
    end if;
    update app.solicitud_opciones set estado = 'descartada', respondida_at = now() where solicitud_id = s.id and orden = o.orden;
  end loop;

  update app.solicitudes set estado = 'sin_medico', cerrada_at = now() where id = s.id;
  perform privado.avisar(s.tutor_id, 'sin_medico', 'No encontramos médico para tu solicitud',
    'Ningún médico veterinario pudo tomar tu solicitud del ' || privado.cuando(s.inicia_at) || '. No se te cobró nada. Puedes pedir otro horario.', s.id);
end $function$
;

CREATE OR REPLACE FUNCTION privado.param(p_clave text)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$ select valor from app.parametros where clave = p_clave $function$
;

CREATE OR REPLACE FUNCTION privado.param_int(p_clave text)
 RETURNS integer
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$ select (valor #>> '{}')::integer from app.parametros where clave = p_clave $function$
;

CREATE OR REPLACE FUNCTION privado.pedir_reembolso(p_solicitud uuid, p_motivo text)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare n integer;
begin
  update app.pagos set estado = 'reembolso_pendiente', motivo_reembolso = p_motivo
    where solicitud_id = p_solicitud and estado = 'aprobado';
  get diagnostics n = row_count;
  return n > 0;
end $function$
;

CREATE OR REPLACE FUNCTION privado.precio(m app.mvz, p_servicio text)
 RETURNS integer
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO ''
AS $function$ select case p_servicio when 'consulta' then m.precio_consulta when 'vacunacion' then m.precio_vacunacion when 'desparasitacion' then m.precio_desparasitacion end $function$
;

CREATE OR REPLACE FUNCTION privado.servicio_txt(p text)
 RETURNS text
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO ''
AS $function$ select case p when 'consulta' then 'consulta general' when 'vacunacion' then 'vacunación' when 'desparasitacion' then 'desparasitación' else p end $function$
;

CREATE OR REPLACE FUNCTION privado.solicitud_mvz(s app.solicitudes, p_mvz uuid)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select jsonb_build_object(
    'id', s.id, 'servicio', s.servicio, 'especie', s.especie, 'alcaldia', s.alcaldia, 'colonia', s.colonia,
    'inicia_at', s.inicia_at, 'termina_at', s.termina_at, 'precio_servicio', s.precio_servicio,
    'estado', case when s.mvz_id = p_mvz then s.estado else 'buscando' end,
    'oferta', (select jsonb_build_object('estado', o.estado, 'vence_at', o.vence_at) from app.solicitud_opciones o where o.solicitud_id = s.id and o.mvz_id = p_mvz),
    'reagendas', s.reagendas, 'reagenda_propuesta_at', case when s.mvz_id = p_mvz then s.reagenda_propuesta_at end,
    'contacto', case when s.mvz_id = p_mvz and (s.estado = 'confirmada' or (s.estado = 'realizada' and s.termina_at > now() - interval '3 days')) then
      (select jsonb_build_object('nombre', pf.nombre || ' ' || pf.apellidos, 'telefono', pf.telefono, 'mascota', s.mascota,
        'calle_numero', s.calle_numero, 'cp', s.cp, 'referencias', s.referencias) from app.perfiles pf where pf.id = s.tutor_id) end
  )
$function$
;

CREATE OR REPLACE FUNCTION privado.solicitud_tutor(s app.solicitudes)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select jsonb_build_object(
    'id', s.id, 'servicio', s.servicio, 'mascota', s.mascota, 'especie', s.especie,
    'alcaldia', s.alcaldia, 'colonia', s.colonia, 'calle_numero', s.calle_numero, 'cp', s.cp, 'referencias', s.referencias,
    'inicia_at', s.inicia_at, 'termina_at', s.termina_at, 'estado', s.estado, 'cuota', s.cuota,
    'precio_servicio', s.precio_servicio, 'pagar_antes_de', s.pagar_antes_de, 'reagendas', s.reagendas,
    'reagenda_propuesta_at', s.reagenda_propuesta_at, 'motivo_cierre', s.motivo_cierre, 'created_at', s.created_at,
    'opciones', (select jsonb_agg(jsonb_build_object('orden', o.orden, 'estado', o.estado, 'vence_at', o.vence_at,
                   'nombre', pf.nombre || ' ' || pf.apellidos) order by o.orden)
                 from app.solicitud_opciones o join app.perfiles pf on pf.id = o.mvz_id where o.solicitud_id = s.id),
    'medico', (select jsonb_build_object('nombre', pf.nombre || ' ' || pf.apellidos, 'cedula', m.cedula,
                   'cedula_verificada_at', m.cedula_verificada_at, 'medios_pago', m.medios_pago,
                   'telefono', case when s.estado = 'confirmada' or (s.estado = 'realizada' and s.termina_at > now() - interval '3 days') then pf.telefono end)
               from app.mvz m join app.perfiles pf on pf.id = m.id where m.id = s.mvz_id),
    'pago', (select g.estado from app.pagos g where g.solicitud_id = s.id and g.principal),
    'encuesta_pendiente', s.estado in ('realizada', 'mvz_no_asistio') and s.cerrada_at > now() - interval '30 days'
                          and not exists (select 1 from app.encuestas e where e.solicitud_id = s.id),
    'reportes', coalesce((select jsonb_agg(jsonb_build_object('tipo', r.tipo, 'estado', r.estado, 'decision', r.decision, 'resolucion', r.resolucion, 'created_at', r.created_at) order by r.created_at)
                          from app.reportes r where r.solicitud_id = s.id and r.autor_id = s.tutor_id), '[]'::jsonb)
  )
$function$
;

CREATE OR REPLACE FUNCTION privado.tick()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare r record;
begin
  if not pg_try_advisory_xact_lock(770112) then return; end if;

  -- El médico no respondió a tiempo: pasa al siguiente
  for r in select solicitud_id, orden from app.solicitud_opciones where estado = 'pendiente' and vence_at <= now() order by vence_at limit 200 loop
    update app.solicitud_opciones set estado = 'sin_respuesta', respondida_at = now()
      where solicitud_id = r.solicitud_id and orden = r.orden and estado = 'pendiente';
    perform privado.ofrecer_siguiente(r.solicitud_id);
  end loop;

  -- El tutor no pagó a tiempo: se libera el bloque
  for r in select id, tutor_id, mvz_id, inicia_at from app.solicitudes where estado = 'por_pagar' and pagar_antes_de <= now() limit 200 for update skip locked loop
    update app.solicitudes set estado = 'vencida', cerrada_at = now() where id = r.id;
    perform privado.avisar(r.tutor_id, 'vencida', 'Tu solicitud venció',
      'No recibimos la cuota de servicio a tiempo y el horario del ' || privado.cuando(r.inicia_at) || ' se liberó. No se te cobró nada.', r.id);
    perform privado.avisar(r.mvz_id, 'liberada', 'Se liberó un horario',
      'El tutor no completó el pago de la solicitud del ' || privado.cuando(r.inicia_at) || '. Ese horario vuelve a estar libre.', r.id);
  end loop;

  -- Ya pasó el bloque: se cierra y se invita a la encuesta privada
  for r in select id, tutor_id from app.solicitudes where estado = 'confirmada' and termina_at <= now() limit 200 for update skip locked loop
    update app.solicitudes set estado = 'realizada', cerrada_at = now(), reagenda_propuesta_at = null where id = r.id;
    perform privado.avisar(r.tutor_id, 'encuesta', '¿Cómo te fue en tu consulta?',
      'Cuéntanos en una encuesta breve y privada. Solo la lee LilieVET.', r.id);
  end loop;

  delete from app.intentos where created_at < now() - interval '2 days';
end $function$
;

CREATE OR REPLACE FUNCTION privado.txt(p text, p_min integer, p_max integer, p_campo text)
 RETURNS text
 LANGUAGE plpgsql
 IMMUTABLE
 SET search_path TO ''
AS $function$
declare v text := btrim(regexp_replace(coalesce(p, ''), '[[:cntrl:]]+', ' ', 'g'));
begin
  if char_length(v) < p_min then perform privado.error('Falta: ' || p_campo || '.'); end if;
  if char_length(v) > p_max then perform privado.error(p_campo || ' es demasiado largo (máximo ' || p_max || ' caracteres).'); end if;
  return nullif(v, '');
end $function$
;

CREATE OR REPLACE FUNCTION privado.yo(p_rol text DEFAULT NULL::text)
 RETURNS app.perfiles
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v app.perfiles;
begin
  if auth.uid() is null then perform privado.error('Inicia sesión para continuar.'); end if;
  select * into v from app.perfiles where id = auth.uid();
  if not found then perform privado.error('Tu cuenta no tiene perfil. Escríbenos para ayudarte.'); end if;
  if v.bloqueada then perform privado.error('Tu cuenta está suspendida. Escríbenos para revisarla.'); end if;
  if p_rol is not null and v.rol <> p_rol then perform privado.error('Esta acción no está disponible para tu tipo de cuenta.'); end if;
  return v;
end $function$
