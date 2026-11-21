CREATE OR REPLACE FUNCTION public.bloquear_dia(p_fecha date, p_bloquear boolean)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare y app.perfiles := privado.yo('mvz');
begin
  if p_fecha is null or p_fecha < (now() at time zone 'America/Mexico_City')::date or p_fecha > (now() at time zone 'America/Mexico_City')::date + 90 then
    perform privado.error('Elige un día dentro de los próximos 90 días.');
  end if;
  if p_bloquear then
    if exists (select 1 from app.solicitudes s where s.mvz_id = y.id and s.estado in ('por_pagar', 'confirmada')
               and (s.inicia_at at time zone 'America/Mexico_City')::date = p_fecha) then
      perform privado.error('Ese día tienes una consulta aceptada. Cancélala primero o propón otro horario al tutor.');
    end if;
    insert into app.mvz_bloqueos (mvz_id, fecha) values (y.id, p_fecha) on conflict do nothing;
  else
    delete from app.mvz_bloqueos where mvz_id = y.id and fecha = p_fecha;
  end if;
end $function$
;

CREATE OR REPLACE FUNCTION public.bloques_en_zona(p_alcaldia text, p_servicio text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  p app.perfiles := privado.yo('tutor');
  v_desde timestamptz := now() + make_interval(hours => privado.param_int('horas_anticipacion'));
  v jsonb;
begin
  if not (p_alcaldia = any (privado.alcaldias())) or p_servicio not in ('consulta', 'vacunacion', 'desparasitacion') then
    perform privado.error('Elige una alcaldía y un servicio de la lista.');
  end if;
  perform privado.limitar('ver_agenda', 240, interval '1 hour');
  select coalesce(jsonb_agg(jsonb_build_object('inicia_at', b.inicia, 'medicos', b.n) order by b.inicia), '[]'::jsonb) into v
  from (
    select c.inicia, count(*) as n
    from (
      select distinct h.mvz_id,
        ((d.dia + make_interval(hours => h.hora::integer)) at time zone 'America/Mexico_City') as inicia
      from generate_series(((now() at time zone 'America/Mexico_City')::date)::timestamp,
                           ((now() at time zone 'America/Mexico_City')::date + privado.param_int('dias_agenda'))::timestamp, interval '1 day') as d (dia)
      join app.mvz_horario h on h.dia = extract(isodow from d.dia)
      join app.mvz_zonas z on z.mvz_id = h.mvz_id and z.alcaldia = p_alcaldia
    ) c
    where c.inicia >= v_desde and privado.disponible(c.mvz_id, p_alcaldia, p_servicio, c.inicia)
    group by c.inicia
  ) b;
  return v;
end $function$
;

CREATE OR REPLACE FUNCTION public.cambiar_telefono(p_telefono text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  p app.perfiles := privado.yo();
  v_tel text := regexp_replace(coalesce(p_telefono, ''), '[^0-9]', '', 'g');
begin
  if v_tel !~ '^[0-9]{10}$' then perform privado.error('Escribe tu celular a 10 dígitos.'); end if;
  if v_tel = p.telefono then return; end if;
  perform privado.limitar('cambiar_telefono', 3, interval '1 day');
  if exists (select 1 from app.solicitudes s where (s.tutor_id = p.id or s.mvz_id = p.id) and s.estado in ('por_pagar', 'confirmada')) then
    perform privado.error('Tienes una consulta en curso. Cambia tu celular cuando termine o escríbenos.');
  end if;
  update app.perfiles set telefono = v_tel, telefono_verificado_at = null where id = p.id;
  perform privado.auditar('cambio_telefono', 'perfil', p.id::text);
end $function$
;

CREATE OR REPLACE FUNCTION public.cancelar_como_mvz(p_solicitud uuid, p_motivo text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare y app.perfiles := privado.yo('mvz'); s app.solicitudes; v_motivo text := privado.txt(p_motivo, 5, 300, 'El motivo');
begin
  select * into s from app.solicitudes where id = p_solicitud and mvz_id = y.id for update;
  if not found or s.estado not in ('por_pagar', 'confirmada') then perform privado.error('Esta consulta ya no se puede cancelar.'); end if;
  if s.llegada_at is not null then perform privado.error('Ya registraste tu llegada, así que la consulta ya no se puede cancelar. Si hubo un problema, envía un reporte.'); end if;
  if now() >= s.inicia_at then perform privado.error('El horario de la consulta ya empezó, así que ya no se puede cancelar. Si hubo un problema, envía un reporte.'); end if;
  update app.solicitudes set estado = 'cancelada_mvz', cerrada_at = now(), motivo_cierre = v_motivo, reagenda_propuesta_at = null where id = s.id;
  perform privado.pedir_reembolso(s.id, 'El médico veterinario canceló');
  perform privado.avisar(s.tutor_id, 'cancelada', 'Tu consulta fue cancelada',
    'El médico veterinario canceló la consulta del ' || privado.cuando(s.inicia_at) || '. Si ya pagaste la cuota de servicio, se te reembolsa completa.', s.id);
  perform privado.auditar('cancelar_mvz', 'solicitud', s.id::text, jsonb_build_object('motivo', v_motivo));
  perform privado.registrar_advertencia_mvz(y.id, s.id);
end $function$
;

CREATE OR REPLACE FUNCTION public.cancelar_solicitud(p_solicitud uuid, p_motivo text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  t app.perfiles := privado.yo('tutor');
  s app.solicitudes;
  v_reembolso boolean := false;
  v_estado text := 'cancelada_tutor';
  -- Motivo elegido de la lista (opcional para compatibilidad con versiones anteriores de la app)
  v_motivo text := nullif(privado.txt(p_motivo, 0, 300, 'El motivo'), '');
begin
  select * into s from app.solicitudes where id = p_solicitud and tutor_id = t.id for update;
  if not found then perform privado.error('No encontramos esa solicitud.'); end if;
  if s.estado not in ('buscando', 'por_pagar', 'confirmada') then perform privado.error('Esta solicitud ya no se puede cancelar.'); end if;
  if s.llegada_at is not null then perform privado.error('El médico veterinario ya registró su llegada. Si hubo un problema, envía un reporte.'); end if;

  if s.estado = 'confirmada' then
    if now() >= s.inicia_at then perform privado.error('El horario de la consulta ya empezó. Si hubo un problema, envía un reporte.'); end if;
    if s.inicia_at - now() > make_interval(hours => privado.param_int('horas_cancelacion')) then
      v_reembolso := privado.pedir_reembolso(s.id, 'El tutor canceló con anticipación');
    else
      v_estado := 'cancelada_tarde';
    end if;
  end if;

  update app.solicitudes set estado = v_estado, cerrada_at = now(), motivo_cierre = v_motivo, reagenda_propuesta_at = null where id = s.id;
  update app.solicitud_opciones set estado = 'descartada', respondida_at = now() where solicitud_id = s.id and estado in ('en_espera', 'pendiente');
  if s.mvz_id is not null then
    perform privado.avisar(s.mvz_id, 'cancelada', 'El tutor canceló una consulta',
      'Se canceló la consulta del ' || privado.cuando(s.inicia_at) || '. Ese horario vuelve a estar libre.', s.id);
  end if;
  perform privado.auditar('cancelar_tutor', 'solicitud', s.id::text, jsonb_build_object('estado', v_estado, 'reembolso', v_reembolso, 'motivo', v_motivo));
  return jsonb_build_object('estado', v_estado, 'reembolso', v_reembolso);
end $function$
;

CREATE OR REPLACE FUNCTION public.crear_admin(p_correo text)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_id uuid;
begin
  select id into v_id from auth.users where lower(email) = lower(btrim(p_correo));
  if v_id is null then return 'No hay ninguna cuenta con ese correo. Regístrate primero en la app.'; end if;
  if not exists (select 1 from app.perfiles where id = v_id) then return 'Esa cuenta no tiene perfil. Regístrala desde la app.'; end if;
  insert into app.admins (id) values (v_id) on conflict do nothing;
  insert into app.auditoria (actor_id, accion, objeto, objeto_id) values (null, 'crear_admin', 'perfil', v_id::text);
  return 'Listo. Entra a la app y activa el doble factor para abrir el Panel.';
end $function$
;

CREATE OR REPLACE FUNCTION public.crear_solicitud(p jsonb)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  t app.perfiles := privado.yo('tutor');
  v_servicio text := p ->> 'servicio';
  v_alcaldia text := p ->> 'alcaldia';
  v_inicia timestamptz;
  v_medicos uuid[];
  v_id uuid;
  v_edad integer;
  v_cp_ok boolean;
  i integer;
begin
  if privado.param('exigir_telefono_verificado') = 'true'::jsonb and t.telefono_verificado_at is null then
    perform privado.error('Verifica tu celular en tu Perfil antes de solicitar una consulta.');
  end if;
  if coalesce(p ->> 'no_es_urgencia', '') <> 'true' then
    perform privado.error('LilieVET no es un servicio de urgencias. Si es una urgencia, acude a un hospital veterinario.');
  end if;
  if coalesce(p ->> 'acepta_transferencia', '') <> 'true' then
    perform privado.error('Para solicitar, acepta que compartamos tus datos de contacto con el médico veterinario que confirme tu consulta.');
  end if;
  if coalesce(p ->> 'confirma_domicilio', '') <> 'true' then
    perform privado.error('Confirma que tu domicilio es correcto.');
  end if;
  if v_servicio is null or v_servicio not in ('consulta', 'vacunacion', 'desparasitacion') then perform privado.error('Elige un servicio.'); end if;
  if v_alcaldia is null or not (v_alcaldia = any (privado.alcaldias())) then perform privado.error('Elige una alcaldía o municipio de la lista.'); end if;
  if coalesce(p ->> 'especie', '') not in ('perro', 'gato') then perform privado.error('Elige perro o gato.'); end if;
  if coalesce(p ->> 'cp', '') !~ '^[0-9]{5}$' then perform privado.error('Escribe un código postal de 5 dígitos.'); end if;
  -- CDMX: los dos primeros dígitos del C.P. indican la alcaldía (01 Álvaro Obregón … 16 Xochimilco).
  -- Estado de México: el C.P. debe ser del estado (50000–57999); el municipio lo elige el tutor.
  if v_alcaldia = any (privado.municipios_edomex()) then
    v_cp_ok := privado.es_cp_edomex(p ->> 'cp');
  else
    v_cp_ok := privado.alcaldia_de_cp(p ->> 'cp') is not distinct from v_alcaldia;
  end if;
  if not v_cp_ok then
    perform privado.error('Tu código postal no corresponde a la alcaldía o municipio. Revisa tu domicilio.');
  end if;
  if coalesce(p ->> 'sexo', '') not in ('macho', 'hembra') then perform privado.error('Elige si tu mascota es macho o hembra.'); end if;
  if coalesce(p ->> 'edad_meses', '') ~ '^[0-9]{1,3}$' then v_edad := (p ->> 'edad_meses')::integer; end if;
  if v_edad is null or v_edad > 360 then perform privado.error('Escribe la edad de tu mascota.'); end if;

  begin
    v_inicia := (p ->> 'inicia_at')::timestamptz;
    select array_agg(distinct x::uuid) into v_medicos from jsonb_array_elements_text(p -> 'medicos') x;
  exception when others then
    perform privado.error('La solicitud no se pudo leer. Recarga la página e intenta de nuevo.');
  end;
  if v_inicia is null or v_medicos is null or cardinality(v_medicos) not between 1 and 3
     or jsonb_array_length(p -> 'medicos') <> cardinality(v_medicos) then
    perform privado.error('Elige de uno a tres médicos veterinarios distintos.');
  end if;
  if v_inicia < now() + make_interval(hours => privado.param_int('horas_anticipacion'))
     or v_inicia > now() + make_interval(days => privado.param_int('dias_agenda') + 1) then
    perform privado.error('Ese horario ya no está disponible. Elige otro.');
  end if;

  perform privado.limitar('crear_solicitud', 6, interval '1 day');
  if (select count(*) from app.solicitudes where tutor_id = t.id and estado in ('buscando', 'por_pagar', 'confirmada')) >= 3 then
    perform privado.error('Ya tienes tres solicitudes en curso. Espera a que se resuelva alguna.');
  end if;

  -- Respeta el orden en que el tutor eligió (primera, segunda, tercera opción)
  select array_agg(x::uuid order by ord) into v_medicos from jsonb_array_elements_text(p -> 'medicos') with ordinality as e (x, ord);
  for i in 1 .. cardinality(v_medicos) loop
    if not privado.disponible(v_medicos[i], v_alcaldia, v_servicio, v_inicia) then
      perform privado.error('Uno de los médicos que elegiste ya no está disponible en ese horario. Vuelve a elegir.');
    end if;
  end loop;

  begin
    insert into app.solicitudes (tutor_id, servicio, mascota, especie, sexo, edad_meses, motivo, alcaldia, colonia, calle_numero, cp, referencias,
                                 inicia_at, termina_at, inicia_original_at, cuota)
    values (t.id, v_servicio, privado.txt(p ->> 'mascota', 1, 40, 'Nombre de tu mascota'), p ->> 'especie',
            p ->> 'sexo', v_edad,
            -- En consulta general se pide el motivo (lo ve el médico al recibir la solicitud); en lo demás es opcional
            privado.txt(p ->> 'motivo', case when v_servicio = 'consulta' then 10 else 0 end, 400, 'Qué le pasa a tu mascota'),
            v_alcaldia,
            privado.txt(p ->> 'colonia', 2, 80, 'Colonia'), privado.txt(p ->> 'calle_numero', 3, 120, 'Calle y número'),
            p ->> 'cp', privado.txt(p ->> 'referencias', 0, 200, 'Referencias'),
            v_inicia, v_inicia + interval '2 hours', v_inicia, privado.param_int('cuota_servicio'))
    returning id into v_id;
  exception when unique_violation then
    perform privado.error('Ya tienes una solicitud para ese mismo horario.');
  end;

  for i in 1 .. cardinality(v_medicos) loop
    insert into app.solicitud_opciones (solicitud_id, orden, mvz_id) values (v_id, i, v_medicos[i]);
  end loop;
  insert into app.aceptaciones (cuenta_id, documento, version, solicitud_id)
    values (t.id, 'transferencia_datos', privado.param('version_privacidad') #>> '{}', v_id);

  perform privado.ofrecer_siguiente(v_id);
  return v_id;
end $function$
;

CREATE OR REPLACE FUNCTION public.guardar_horario(p jsonb)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare y app.perfiles := privado.yo('mvz');
begin
  if jsonb_typeof(p) <> 'array' or jsonb_array_length(p) > 56 then perform privado.error('El horario no se pudo leer.'); end if;
  delete from app.mvz_horario where mvz_id = y.id;
  begin
    insert into app.mvz_horario (mvz_id, dia, hora)
    select distinct y.id, (x ->> 'dia')::smallint, (x ->> 'hora')::smallint from jsonb_array_elements(p) x;
  exception when others then
    perform privado.error('El horario no se pudo guardar. Revisa los bloques e intenta de nuevo.');
  end;
end $function$
;

CREATE OR REPLACE FUNCTION public.guardar_nombre(p_nombre text, p_apellidos text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare p app.perfiles := privado.yo();
begin
  -- El nombre de un médico ya aprobado es el de su cédula: solo lo cambia el Panel
  if p.rol = 'mvz' and exists (select 1 from app.mvz where id = p.id and estado <> 'pendiente') then
    perform privado.error('Tu nombre ya fue verificado contra tu cédula. Escríbenos si hay que corregirlo.');
  end if;
  update app.perfiles set nombre = privado.txt(p_nombre, 1, 60, 'Nombre'), apellidos = privado.txt(p_apellidos, 1, 80, 'Apellidos') where id = p.id;
end $function$
;

CREATE OR REPLACE FUNCTION public.guardar_perfil_mvz(p jsonb)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  y app.perfiles := privado.yo('mvz');
  m app.mvz;
  v_cedula text := nullif(regexp_replace(coalesce(p ->> 'cedula', ''), '[^0-9]', '', 'g'), '');
  v_medios text[];
  v_zonas text[];
  v_comparte boolean := coalesce(p ->> 'comparte_telefono', '') = 'true';
begin
  select * into m from app.mvz where id = y.id for update;
  -- La cédula ya verificada no se cambia desde la cuenta del médico (ni el estado, nunca)
  if m.cedula_verificada_at is not null then v_cedula := m.cedula; end if;
  if v_cedula is not null and v_cedula !~ '^[0-9]{6,9}$' then perform privado.error('Escribe tu número de cédula profesional (solo números).'); end if;

  select coalesce(array_agg(distinct x), '{}') into v_medios from jsonb_array_elements_text(coalesce(p -> 'medios_pago', '[]'::jsonb)) x;
  if not (v_medios <@ array['efectivo', 'transferencia', 'tarjeta']) then perform privado.error('Elige medios de pago de la lista.'); end if;
  select coalesce(array_agg(distinct x), '{}') into v_zonas from jsonb_array_elements_text(coalesce(p -> 'zonas', '[]'::jsonb)) x;
  if not (v_zonas <@ privado.alcaldias()) then perform privado.error('Elige alcaldías o municipios de la lista.'); end if;

  begin
    update app.mvz set
      cedula = v_cedula,
      presentacion = privado.txt(p ->> 'presentacion', 0, 400, 'Tu presentación'),
      precio_consulta = nullif(p ->> 'precio_consulta', '')::integer,
      precio_vacunacion = nullif(p ->> 'precio_vacunacion', '')::integer,
      precio_desparasitacion = nullif(p ->> 'precio_desparasitacion', '')::integer,
      medios_pago = v_medios,
      comparte_telefono_at = case when v_comparte then coalesce(comparte_telefono_at, now()) end,
      recibe_solicitudes = coalesce((p ->> 'recibe_solicitudes')::boolean, recibe_solicitudes),
      actualizado_at = now()
    where id = y.id;
  exception when check_violation or invalid_text_representation or numeric_value_out_of_range then
    perform privado.error('Revisa tus precios: van de $100 a $20,000, sin centavos.');
  end;
  if v_comparte and m.comparte_telefono_at is null then
    insert into app.aceptaciones (cuenta_id, documento, version) values (y.id, 'compartir_telefono', privado.param('version_privacidad') #>> '{}');
  end if;

  delete from app.mvz_zonas where mvz_id = y.id and not (alcaldia = any (v_zonas));
  insert into app.mvz_zonas (mvz_id, alcaldia) select y.id, z from unnest(v_zonas) z on conflict do nothing;
end $function$
