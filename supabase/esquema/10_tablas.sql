-- Tablas del esquema app (reconstruidas desde el catálogo de Postgres el 2026-11-15).
-- Ningún rol de la app (anon, authenticated, service_role) tiene permisos sobre estas tablas ni
-- USAGE sobre el esquema: solo se tocan desde funciones SECURITY DEFINER. RLS está activo y sin
-- políticas, es decir, cerrado por completo aunque algún día se concediera un permiso por error.
create schema if not exists app;
create schema if not exists privado;

create table app.parametros (
  clave text not null,
  valor jsonb not null,
  actualizado_at timestamp with time zone not null default now(),
  constraint parametros_pkey PRIMARY KEY (clave)
);
alter table app.parametros enable row level security;

create table app.perfiles (
  id uuid not null,
  rol text not null,
  nombre text not null,
  apellidos text not null,
  correo text not null,
  telefono text not null,
  telefono_verificado_at timestamp with time zone,
  bloqueada boolean not null default false,
  created_at timestamp with time zone not null default now(),
  constraint perfiles_pkey PRIMARY KEY (id),
  constraint perfiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE,
  constraint perfiles_apellidos_check CHECK (((char_length(apellidos) >= 1) AND (char_length(apellidos) <= 80))),
  constraint perfiles_nombre_check CHECK (((char_length(nombre) >= 1) AND (char_length(nombre) <= 60))),
  constraint perfiles_rol_check CHECK ((rol = ANY (ARRAY['tutor'::text, 'mvz'::text]))),
  constraint perfiles_telefono_check CHECK ((telefono ~ '^[0-9]{10}$'::text))
);
alter table app.perfiles enable row level security;

create table app.admins (
  id uuid not null,
  created_at timestamp with time zone not null default now(),
  constraint admins_pkey PRIMARY KEY (id),
  constraint admins_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE
);
alter table app.admins enable row level security;

create table app.aceptaciones (
  id bigint generated always as identity,
  cuenta_id uuid not null,
  documento text not null,
  version text not null,
  solicitud_id uuid,
  aceptado_at timestamp with time zone not null default now(),
  constraint aceptaciones_pkey PRIMARY KEY (id),
  constraint aceptaciones_cuenta_id_fkey FOREIGN KEY (cuenta_id) REFERENCES app.perfiles(id) ON DELETE CASCADE,
  constraint aceptaciones_documento_check CHECK ((documento = ANY (ARRAY['terminos'::text, 'privacidad'::text, 'carta_mvz'::text, 'transferencia_datos'::text, 'compartir_telefono'::text])))
);
alter table app.aceptaciones enable row level security;
CREATE INDEX aceptaciones_cuenta_id_idx ON app.aceptaciones USING btree (cuenta_id);

create table app.mvz (
  id uuid not null,
  estado text not null default 'pendiente'::text,
  cedula text,
  cedula_verificada_at timestamp with time zone,
  identidad_verificada_at timestamp with time zone,
  verificada_por uuid,
  presentacion text,
  precio_consulta integer,
  precio_vacunacion integer,
  precio_desparasitacion integer,
  medios_pago text[] not null default '{}'::text[],
  comparte_telefono_at timestamp with time zone,
  recibe_solicitudes boolean not null default true,
  actualizado_at timestamp with time zone not null default now(),
  constraint mvz_pkey PRIMARY KEY (id),
  constraint mvz_id_fkey FOREIGN KEY (id) REFERENCES app.perfiles(id) ON DELETE CASCADE,
  constraint mvz_verificada_por_fkey FOREIGN KEY (verificada_por) REFERENCES auth.users(id),
  constraint mvz_cedula_check CHECK ((cedula ~ '^[0-9]{6,9}$'::text)),
  constraint mvz_estado_check CHECK ((estado = ANY (ARRAY['pendiente'::text, 'aprobado'::text, 'suspendido'::text]))),
  constraint mvz_medios_pago_check CHECK ((medios_pago <@ ARRAY['efectivo'::text, 'transferencia'::text, 'tarjeta'::text])),
  constraint mvz_precio_consulta_check CHECK (((precio_consulta >= 100) AND (precio_consulta <= 20000))),
  constraint mvz_precio_desparasitacion_check CHECK (((precio_desparasitacion >= 100) AND (precio_desparasitacion <= 20000))),
  constraint mvz_precio_vacunacion_check CHECK (((precio_vacunacion >= 100) AND (precio_vacunacion <= 20000))),
  constraint mvz_presentacion_check CHECK ((char_length(presentacion) <= 400))
);
alter table app.mvz enable row level security;

create table app.mvz_zonas (
  mvz_id uuid not null,
  alcaldia text not null,
  constraint mvz_zonas_pkey PRIMARY KEY (mvz_id, alcaldia),
  constraint mvz_zonas_mvz_id_fkey FOREIGN KEY (mvz_id) REFERENCES app.mvz(id) ON DELETE CASCADE
);
alter table app.mvz_zonas enable row level security;

create table app.mvz_horario (
  mvz_id uuid not null,
  dia smallint not null,
  hora smallint not null,
  constraint mvz_horario_pkey PRIMARY KEY (mvz_id, dia, hora),
  constraint mvz_horario_mvz_id_fkey FOREIGN KEY (mvz_id) REFERENCES app.mvz(id) ON DELETE CASCADE,
  constraint mvz_horario_dia_check CHECK (((dia >= 1) AND (dia <= 7))),
  constraint mvz_horario_hora_check CHECK ((hora = ANY (ARRAY[6, 8, 10, 12, 14, 16, 18, 20])))
);
alter table app.mvz_horario enable row level security;

create table app.mvz_bloqueos (
  mvz_id uuid not null,
  fecha date not null,
  constraint mvz_bloqueos_pkey PRIMARY KEY (mvz_id, fecha),
  constraint mvz_bloqueos_mvz_id_fkey FOREIGN KEY (mvz_id) REFERENCES app.mvz(id) ON DELETE CASCADE
);
alter table app.mvz_bloqueos enable row level security;

create table app.solicitudes (
  id uuid not null default gen_random_uuid(),
  tutor_id uuid not null,
  servicio text not null,
  mascota text not null,
  especie text not null,
  alcaldia text not null,
  colonia text not null,
  calle_numero text not null,
  cp text not null,
  referencias text,
  inicia_at timestamp with time zone not null,
  termina_at timestamp with time zone not null,
  inicia_original_at timestamp with time zone not null,
  estado text not null default 'buscando'::text,
  mvz_id uuid,
  precio_servicio integer,
  cuota integer not null,
  aceptada_at timestamp with time zone,
  pagar_antes_de timestamp with time zone,
  confirmada_at timestamp with time zone,
  cerrada_at timestamp with time zone,
  motivo_cierre text,
  reagendas smallint not null default 0,
  reagenda_propuesta_at timestamp with time zone,
  created_at timestamp with time zone not null default now(),
  constraint solicitudes_pkey PRIMARY KEY (id),
  constraint solicitudes_mvz_id_fkey FOREIGN KEY (mvz_id) REFERENCES app.mvz(id),
  constraint solicitudes_tutor_id_fkey FOREIGN KEY (tutor_id) REFERENCES app.perfiles(id),
  constraint solicitudes_calle_numero_check CHECK (((char_length(calle_numero) >= 3) AND (char_length(calle_numero) <= 120))),
  constraint solicitudes_check CHECK ((termina_at > inicia_at)),
  constraint solicitudes_colonia_check CHECK (((char_length(colonia) >= 2) AND (char_length(colonia) <= 80))),
  constraint solicitudes_cp_check CHECK ((cp ~ '^[0-9]{5}$'::text)),
  constraint solicitudes_cuota_check CHECK (((cuota >= 1) AND (cuota <= 5000))),
  constraint solicitudes_especie_check CHECK ((especie = ANY (ARRAY['perro'::text, 'gato'::text]))),
  constraint solicitudes_estado_check CHECK ((estado = ANY (ARRAY['buscando'::text, 'por_pagar'::text, 'confirmada'::text, 'realizada'::text, 'sin_medico'::text, 'vencida'::text, 'cancelada_tutor'::text, 'cancelada_tarde'::text, 'tutor_ausente'::text, 'cancelada_mvz'::text, 'mvz_no_asistio'::text, 'cancelada_admin'::text]))),
  constraint solicitudes_mascota_check CHECK (((char_length(mascota) >= 1) AND (char_length(mascota) <= 40))),
  constraint solicitudes_motivo_cierre_check CHECK ((char_length(motivo_cierre) <= 300)),
  constraint solicitudes_referencias_check CHECK ((char_length(referencias) <= 200)),
  constraint solicitudes_servicio_check CHECK ((servicio = ANY (ARRAY['consulta'::text, 'vacunacion'::text, 'desparasitacion'::text])))
);
alter table app.solicitudes enable row level security;
CREATE UNIQUE INDEX solicitudes_bloque_unico ON app.solicitudes USING btree (mvz_id, inicia_at) WHERE (estado = ANY (ARRAY['por_pagar'::text, 'confirmada'::text]));
CREATE INDEX solicitudes_estado_idx ON app.solicitudes USING btree (estado);
CREATE INDEX solicitudes_mvz_id_inicia_at_idx ON app.solicitudes USING btree (mvz_id, inicia_at);
CREATE UNIQUE INDEX solicitudes_tutor_bloque ON app.solicitudes USING btree (tutor_id, inicia_at) WHERE (estado = ANY (ARRAY['buscando'::text, 'por_pagar'::text, 'confirmada'::text]));
CREATE INDEX solicitudes_tutor_id_created_at_idx ON app.solicitudes USING btree (tutor_id, created_at DESC);

create table app.solicitud_opciones (
  solicitud_id uuid not null,
  orden smallint not null,
  mvz_id uuid not null,
  estado text not null default 'en_espera'::text,
  ofrecida_at timestamp with time zone,
  vence_at timestamp with time zone,
  respondida_at timestamp with time zone,
  constraint solicitud_opciones_solicitud_id_mvz_id_key UNIQUE (solicitud_id, mvz_id),
  constraint solicitud_opciones_pkey PRIMARY KEY (solicitud_id, orden),
  constraint solicitud_opciones_mvz_id_fkey FOREIGN KEY (mvz_id) REFERENCES app.mvz(id),
  constraint solicitud_opciones_solicitud_id_fkey FOREIGN KEY (solicitud_id) REFERENCES app.solicitudes(id) ON DELETE CASCADE,
  constraint solicitud_opciones_estado_check CHECK ((estado = ANY (ARRAY['en_espera'::text, 'pendiente'::text, 'aceptada'::text, 'rechazada'::text, 'sin_respuesta'::text, 'descartada'::text]))),
  constraint solicitud_opciones_orden_check CHECK (((orden >= 1) AND (orden <= 3)))
);
alter table app.solicitud_opciones enable row level security;
CREATE INDEX solicitud_opciones_estado_vence_at_idx ON app.solicitud_opciones USING btree (estado, vence_at);
CREATE INDEX solicitud_opciones_mvz_id_estado_idx ON app.solicitud_opciones USING btree (mvz_id, estado);

create table app.pagos (
  id uuid not null default gen_random_uuid(),
  solicitud_id uuid not null,
  principal boolean not null default true,
  monto integer not null,
  estado text not null default 'creado'::text,
  mp_preference_id text,
  mp_payment_id text,
  mp_refund_id text,
  motivo_reembolso text,
  intentos_reembolso smallint not null default 0,
  aprobado_at timestamp with time zone,
  reembolsado_at timestamp with time zone,
  created_at timestamp with time zone not null default now(),
  comision_mp numeric(10,2),
  neto_mp numeric(10,2),
  retenciones_mp numeric(10,2),
  constraint pagos_montos_mp_check CHECK (((COALESCE(comision_mp, (0)::numeric) >= (0)::numeric) AND (COALESCE(neto_mp, (0)::numeric) >= (0)::numeric) AND (COALESCE(retenciones_mp, (0)::numeric) >= (0)::numeric))),
  constraint pagos_mp_payment_id_key UNIQUE (mp_payment_id),
  constraint pagos_pkey PRIMARY KEY (id),
  constraint pagos_solicitud_id_fkey FOREIGN KEY (solicitud_id) REFERENCES app.solicitudes(id),
  constraint pagos_estado_check CHECK ((estado = ANY (ARRAY['creado'::text, 'aprobado'::text, 'reembolso_pendiente'::text, 'reembolsado'::text, 'contracargo'::text]))),
  constraint pagos_monto_check CHECK ((monto > 0))
);
alter table app.pagos enable row level security;
CREATE INDEX pagos_estado_idx ON app.pagos USING btree (estado);
CREATE UNIQUE INDEX pagos_principal ON app.pagos USING btree (solicitud_id) WHERE principal;

create table app.reportes (
  id uuid not null default gen_random_uuid(),
  solicitud_id uuid,
  autor_id uuid not null,
  tipo text not null,
  detalle text not null,
  estado text not null default 'abierto'::text,
  version_medico text,
  resolucion text,
  decision text,
  resuelto_por uuid,
  resuelto_at timestamp with time zone,
  created_at timestamp with time zone not null default now(),
  constraint reportes_pkey PRIMARY KEY (id),
  constraint reportes_autor_id_fkey FOREIGN KEY (autor_id) REFERENCES app.perfiles(id),
  constraint reportes_resuelto_por_fkey FOREIGN KEY (resuelto_por) REFERENCES auth.users(id),
  constraint reportes_solicitud_id_fkey FOREIGN KEY (solicitud_id) REFERENCES app.solicitudes(id),
  constraint reportes_decision_check CHECK ((decision = ANY (ARRAY['reembolsar'::text, 'no_procede'::text, 'atendido'::text]))),
  constraint reportes_detalle_check CHECK (((char_length(detalle) >= 10) AND (char_length(detalle) <= 1000))),
  constraint reportes_estado_check CHECK ((estado = ANY (ARRAY['abierto'::text, 'resuelto'::text]))),
  constraint reportes_resolucion_check CHECK ((char_length(resolucion) <= 1000)),
  constraint reportes_tipo_check CHECK ((tipo = ANY (ARRAY['inasistencia_mvz'::text, 'reembolso'::text, 'tutor_ausente'::text, 'datos_personales'::text, 'otro'::text]))),
  constraint reportes_version_medico_check CHECK ((char_length(version_medico) <= 1000))
);
alter table app.reportes enable row level security;
CREATE INDEX reportes_estado_created_at_idx ON app.reportes USING btree (estado, created_at);
CREATE UNIQUE INDEX reportes_uno_abierto ON app.reportes USING btree (solicitud_id, autor_id, tipo) WHERE (estado = 'abierto'::text);

create table app.encuestas (
  solicitud_id uuid not null,
  tutor_id uuid not null,
  se_presento boolean not null,
  puntualidad smallint,
  trato smallint,
  recomendaria smallint,
  comentario text,
  created_at timestamp with time zone not null default now(),
  constraint encuestas_pkey PRIMARY KEY (solicitud_id),
  constraint encuestas_solicitud_id_fkey FOREIGN KEY (solicitud_id) REFERENCES app.solicitudes(id),
  constraint encuestas_tutor_id_fkey FOREIGN KEY (tutor_id) REFERENCES app.perfiles(id),
  constraint encuestas_comentario_check CHECK ((char_length(comentario) <= 1000)),
  constraint encuestas_puntualidad_check CHECK (((puntualidad >= 1) AND (puntualidad <= 5))),
  constraint encuestas_recomendaria_check CHECK (((recomendaria >= 0) AND (recomendaria <= 10))),
  constraint encuestas_trato_check CHECK (((trato >= 1) AND (trato <= 5)))
);
alter table app.encuestas enable row level security;

create table app.avisos (
  id bigint generated always as identity,
  destinatario_id uuid not null,
  tipo text not null,
  titulo text not null,
  cuerpo text not null,
  solicitud_id uuid,
  leido_at timestamp with time zone,
  correo_at timestamp with time zone,
  whatsapp_at timestamp with time zone,
  intentos smallint not null default 0,
  created_at timestamp with time zone not null default now(),
  constraint avisos_pkey PRIMARY KEY (id),
  constraint avisos_destinatario_id_fkey FOREIGN KEY (destinatario_id) REFERENCES app.perfiles(id) ON DELETE CASCADE
);
alter table app.avisos enable row level security;
CREATE INDEX avisos_destinatario_id_created_at_idx ON app.avisos USING btree (destinatario_id, created_at DESC);
CREATE INDEX avisos_por_enviar ON app.avisos USING btree (created_at) WHERE ((correo_at IS NULL) AND (intentos < 5));

create table app.auditoria (
  id bigint generated always as identity,
  actor_id uuid,
  accion text not null,
  objeto text,
  objeto_id text,
  detalle jsonb,
  created_at timestamp with time zone not null default now(),
  constraint auditoria_pkey PRIMARY KEY (id)
);
alter table app.auditoria enable row level security;
CREATE INDEX auditoria_created_at_idx ON app.auditoria USING btree (created_at DESC);

create table app.intentos (
  cuenta_id uuid not null,
  accion text not null,
  created_at timestamp with time zone not null default now()
);
alter table app.intentos enable row level security;
CREATE INDEX intentos_cuenta_id_accion_created_at_idx ON app.intentos USING btree (cuenta_id, accion, created_at);
