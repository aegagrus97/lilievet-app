// Vista de muestra: datos de ejemplo que viven solo en la memoria de esta pestaña.
// Sirve para revisar el diseño sin conectar Supabase. Nada se guarda ni se envía.
const H = 36e5;
const en = (horas) => new Date(Date.now() + horas * H).toISOString();
function bloque(dias, hora) {
  const d = new Date(Date.now() + dias * 24 * H);
  const ymd = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Mexico_City' }).format(d);
  return new Date(`${ymd}T${String(hora).padStart(2, '0')}:00:00-06:00`).toISOString();
}
const mas2 = (iso) => new Date(new Date(iso).getTime() + 2 * H).toISOString();
const espera = (v, ms = 250) => new Promise((r) => setTimeout(() => r(JSON.parse(JSON.stringify(v ?? null))), ms));
const ALCALDIAS = ['Álvaro Obregón', 'Azcapotzalco', 'Benito Juárez', 'Coyoacán', 'Cuajimalpa', 'Cuauhtémoc', 'Gustavo A. Madero', 'Iztacalco', 'Iztapalapa', 'Magdalena Contreras', 'Miguel Hidalgo', 'Milpa Alta', 'Tláhuac', 'Tlalpan', 'Venustiano Carranza', 'Xochimilco'];
const PARAMS = { cuota: 120, minutos_respuesta: 60, horas_cancelacion: 24, horas_para_pagar: 12, exigir_telefono: true, alcaldias: ALCALDIAS };

const MEDICOS = [
  { id: 'm1', nombre: 'Mariana Ortega Ruiz', cedula: '10458231', cedula_verificada_at: en(-24 * 20), presentacion: 'Medicina preventiva y geriatría en perros y gatos. Manejo libre de miedo.', precio: 650, medios_pago: ['efectivo', 'transferencia', 'tarjeta'] },
  { id: 'm2', nombre: 'Rodrigo Salas Peña', cedula: '9834417', cedula_verificada_at: en(-24 * 35), presentacion: 'Consulta general y vacunación. Atiendo gatos nerviosos con calma.', precio: 600, medios_pago: ['efectivo', 'transferencia'] },
  { id: 'm3', nombre: 'Elena Cruz Tovar', cedula: '11207765', cedula_verificada_at: en(-24 * 8), presentacion: 'Diez años de experiencia en medicina de perros y gatos.', precio: 700, medios_pago: ['efectivo', 'tarjeta'] },
];
const legM = (m, tel) => ({ nombre: m.nombre, cedula: m.cedula, cedula_verificada_at: m.cedula_verificada_at, medios_pago: m.medios_pago, telefono: tel || null });
const dom = { alcaldia: 'Coyoacán', colonia: 'Del Carmen', calle_numero: 'Viena 120, int. 3', cp: '04100', referencias: 'Portón verde, timbre 3' };

function solicitudesTutor() {
  const a = bloque(2, 10), b = bloque(4, 16), c = bloque(6, 12), d = bloque(-5, 10);
  return [
    { id: 's1', servicio: 'consulta', mascota: 'Liebe', especie: 'perro', sexo: 'hembra', edad_meses: 40, motivo: 'Se rasca mucho las orejas desde hace una semana y sacude la cabeza.', ...dom, inicia_at: a, termina_at: mas2(a), estado: 'por_pagar', cuota: 120, precio_servicio: 650, pagar_antes_de: en(9), reagendas: 0, created_at: en(-3),
      opciones: [{ orden: 1, estado: 'rechazada', nombre: MEDICOS[1].nombre }, { orden: 2, estado: 'aceptada', nombre: MEDICOS[0].nombre }], medico: legM(MEDICOS[0]), pago: 'creado', reportes: [] },
    { id: 's2', servicio: 'vacunacion', mascota: 'Lilie', especie: 'gato', ...dom, inicia_at: b, termina_at: mas2(b), estado: 'confirmada', cuota: 120, precio_servicio: 600, reagendas: 0, created_at: en(-30),
      reagenda_propuesta_at: bloque(5, 10), opciones: [{ orden: 1, estado: 'aceptada', nombre: MEDICOS[1].nombre }], medico: legM(MEDICOS[1], '5523456789'), pago: 'aprobado', reportes: [] },
    { id: 's3', servicio: 'desparasitacion', mascota: 'Liebe', especie: 'perro', ...dom, inicia_at: c, termina_at: mas2(c), estado: 'buscando', cuota: 120, reagendas: 0, created_at: en(-0.4),
      opciones: [{ orden: 1, estado: 'pendiente', nombre: MEDICOS[2].nombre, vence_at: en(0.6) }, { orden: 2, estado: 'en_espera', nombre: MEDICOS[0].nombre }, { orden: 3, estado: 'en_espera', nombre: MEDICOS[1].nombre }], medico: null, pago: null, reportes: [] },
    { id: 's4', servicio: 'consulta', mascota: 'Lilie', especie: 'gato', ...dom, inicia_at: d, termina_at: mas2(d), estado: 'realizada', cuota: 120, precio_servicio: 700, reagendas: 0, created_at: en(-24 * 7),
      opciones: [{ orden: 1, estado: 'aceptada', nombre: MEDICOS[2].nombre }], medico: legM(MEDICOS[2]), pago: 'aprobado', encuesta_pendiente: true, reportes: [] },
    { id: 's5', servicio: 'vacunacion', mascota: 'Lilie', especie: 'gato', sexo: 'hembra', edad_meses: 24, ...dom, inicia_at: bloque(3, 18), termina_at: mas2(bloque(3, 18)), estado: 'sin_medico', cuota: 120, reagendas: 0, created_at: en(-0.1),
      opciones: [{ orden: 1, estado: 'sin_respuesta', nombre: MEDICOS[1].nombre }], reportes: [] },
  ];
}
function solicitudesMvz() {
  const a = bloque(1, 12), b = bloque(2, 10), c = bloque(3, 16), d = bloque(5, 10);
  return [
    { id: 'q1', servicio: 'consulta', especie: 'perro', sexo: 'macho', edad_meses: 84, motivo: 'Cojea de la pata trasera derecha desde ayer, come bien.', alcaldia: 'Coyoacán', colonia: 'Del Carmen', inicia_at: b, termina_at: mas2(b), estado: 'buscando', oferta: { estado: 'pendiente', vence_at: en(0.7) }, reagendas: 0 },
    { id: 'q2', servicio: 'vacunacion', especie: 'gato', sexo: 'hembra', edad_meses: 4, alcaldia: 'Benito Juárez', colonia: 'Narvarte', inicia_at: d, termina_at: mas2(d), estado: 'buscando', oferta: { estado: 'pendiente', vence_at: en(0.3) }, reagendas: 0 },
    { id: 'q3', servicio: 'consulta', especie: 'gato', sexo: 'macho', edad_meses: 30, motivo: 'Vomita después de comer desde hace tres días.', alcaldia: 'Coyoacán', colonia: 'Copilco', inicia_at: c, termina_at: mas2(c), estado: 'por_pagar', precio_servicio: 650, oferta: { estado: 'aceptada' }, reagendas: 0 },
    { id: 'q4', servicio: 'consulta', especie: 'perro', reagendas: 0, reagenda_propuesta_at: bloque(4, 14), reagenda_por: 'tutor', alcaldia: 'Coyoacán', colonia: 'Del Carmen', inicia_at: a, termina_at: mas2(a), estado: 'confirmada', precio_servicio: 650, oferta: { estado: 'aceptada' }, reagendas: 0,
      contacto: { nombre: 'Tania Herrera Luna', telefono: '5512345678', mascota: 'Liebe', calle_numero: 'Viena 120, int. 3', cp: '04100', referencias: 'Portón verde, timbre 3' } },
  ];
}

const PERFILES = {
  tutor: { id: 't1', rol: 'tutor', nombre: 'Tania', apellidos: 'Herrera Luna', correo: 'tania@ejemplo.mx', telefono: '5512345678', telefono_verificado: true, es_admin: false, panel_abierto: false, mvz: null },
  mvz: { id: 'm1', rol: 'mvz', nombre: 'Mariana', apellidos: 'Ortega Ruiz', correo: 'mariana@ejemplo.mx', telefono: '5598765432', telefono_verificado: true, es_admin: false, panel_abierto: false,
    mvz: { estado: 'aprobado', cedula: '10458231', cedula_verificada_at: en(-24 * 20), presentacion: MEDICOS[0].presentacion, precio_consulta: 650, precio_vacunacion: 450, precio_desparasitacion: null,
      medios_pago: ['efectivo', 'transferencia', 'tarjeta'], comparte_telefono: true, recibe_solicitudes: true, zonas: ['Benito Juárez', 'Coyoacán'],
      horario: [1, 2, 3, 4, 5].flatMap((dia) => [10, 12, 16].map((hora) => ({ dia, hora }))).concat([{ dia: 6, hora: 10 }]), bloqueos: [] } },
  'mvz-nuevo': { id: 'm9', rol: 'mvz', nombre: 'Julio', apellidos: 'Méndez Ríos', correo: 'julio@ejemplo.mx', telefono: '5511223344', telefono_verificado: false, es_admin: false, panel_abierto: false,
    mvz: { estado: 'pendiente', cedula: null, cedula_verificada_at: null, presentacion: null, precio_consulta: null, precio_vacunacion: null, precio_desparasitacion: null, medios_pago: [], comparte_telefono: false, recibe_solicitudes: true, zonas: [], horario: [], bloqueos: [] } },
  admin: { id: 'a1', rol: 'mvz', nombre: 'Katia', apellidos: 'Moctezuma', correo: 'admin@ejemplo.mx', telefono: '5548031238', telefono_verificado: true, es_admin: true, panel_abierto: true,
    mvz: { estado: 'pendiente', cedula: null, medios_pago: [], zonas: [], horario: [], bloqueos: [], comparte_telefono: false, recibe_solicitudes: false } },
};

export function demoApi(quien) {
  const perfil = { ...PERFILES[quien], bloqueada: false, avisos_sin_leer: 2, parametros: PARAMS,
    aceptaciones: [{ documento: 'terminos', version: '2026-11', aceptado_at: en(-24 * 30) }, { documento: 'privacidad', version: '2026-11', aceptado_at: en(-24 * 30) }]
      .concat(quien === 'tutor' ? [] : [{ documento: 'carta_mvz', version: '2026-11', aceptado_at: en(-24 * 30) }]) };
  let sols = solicitudesTutor();
  let solsM = solicitudesMvz();
  const adminMedicos = [
    { id: 'm9', nombre: 'Julio', apellidos: 'Méndez Ríos', correo: 'julio@ejemplo.mx', telefono: '5511223344', estado: 'pendiente', cedula: '12003341', medios_pago: ['efectivo'], zonas: ['Tlalpan'], bloques: 6, precio_consulta: 550, comparte_telefono: true, recibe_solicitudes: true, created_at: en(-20) },
    ...MEDICOS.map((m, i) => ({ id: m.id, nombre: m.nombre.split(' ')[0], apellidos: m.nombre.split(' ').slice(1).join(' '), correo: `medico${i + 1}@ejemplo.mx`, telefono: '55' + String(23456789 + i), estado: 'aprobado', cedula: m.cedula,
      cedula_verificada_at: m.cedula_verificada_at, identidad_verificada_at: m.cedula_verificada_at, medios_pago: m.medios_pago, zonas: ['Coyoacán'], bloques: 12, precio_consulta: m.precio, comparte_telefono: true, recibe_solicitudes: true, created_at: en(-24 * 40) })),
  ];
  const reportes = [{ id: 'r1', tipo: 'inasistencia_mvz', detalle: 'Esperé dos horas y el médico no llegó ni contestó el teléfono.', estado: 'abierto', created_at: en(-5), solicitud_id: 's9', autor: 'Tomás Rivas', autor_rol: 'tutor', autor_telefono: '5500000002', autor_correo: 'tomas@ejemplo.mx', solicitud_estado: 'realizada', inicia_at: bloque(-1, 10), servicio: 'consulta', medico: MEDICOS[2].nombre, medico_telefono: '5523456791', pago: 'aprobado' }];
  let sesion = { user: { id: perfil.id } };
  const oyentes = new Set();

  return {
    mode: 'demo',
    session: async () => sesion,
    onAuth(cb) { oyentes.add(cb); return () => oyentes.delete(cb); },
    entrar: async () => {}, registrar: async () => {}, recuperar: async () => {}, nuevaContrasena: async () => {},
    salir: async () => { location.href = location.pathname; },
    salirDeTodos: async () => { location.href = location.pathname; },
    perfil: () => espera(perfil),
    guardarNombre: async (n, a) => { perfil.nombre = n; perfil.apellidos = a; },
    avisos: () => espera(quien === 'mvz-nuevo' ? [
      { id: 3, tipo: 'cedula', titulo: 'Revisa tu número de cédula', cuerpo: 'No pudimos verificar tu cédula profesional en el Registro Nacional de Profesionistas. Escríbela de nuevo en Servicios y guarda los cambios.', leido_at: null, created_at: en(-1) },
    ] : quien.startsWith('mvz') ? [
      { id: 4, tipo: 'solicitud_nueva', titulo: 'Tienes una solicitud nueva', cuerpo: 'Entra a LilieVET para aceptarla o rechazarla.', leido_at: null, created_at: en(-1) },
    ] : [
      { id: 1, tipo: 'aceptada', titulo: 'Un médico veterinario aceptó tu solicitud', cuerpo: 'Paga la cuota de servicio para confirmar tu consulta.', leido_at: null, created_at: en(-1) },
      { id: 2, tipo: 'reagenda', titulo: 'El médico veterinario propone otro horario', cuerpo: 'Entra a tus consultas para aceptarlo o conservar el horario actual.', leido_at: null, created_at: en(-4) },
    ]),
    guardarTelefono: async (t) => { perfil.telefono = String(t).replace(/\D/g, ''); perfil.telefono_verificado = false; },
    pedirCodigo: async () => espera(null, 500),
    verificarCodigo: async () => { perfil.telefono_verificado = true; return true; },

    bloquesEnZona: () => espera([1, 2, 3, 4, 5, 6].flatMap((d) => [10, 12, 16].map((h) => ({ inicia_at: bloque(d, h), medicos: ((d + h) % 3) + 1 })))),
    medicosEnBloque: () => espera(MEDICOS),
    crearSolicitud: async (p) => {
      const meds = p.medicos.map((id) => MEDICOS.find((m) => m.id === id));
      sols = [{ id: 's' + Date.now(), ...p, termina_at: mas2(p.inicia_at), estado: 'buscando', cuota: 120, reagendas: 0, created_at: en(0), medico: null, pago: null, reportes: [],
        opciones: meds.map((m, i) => ({ orden: i + 1, estado: i ? 'en_espera' : 'pendiente', nombre: m.nombre, vence_at: i ? null : en(1) })) }, ...sols];
      return espera('nuevo', 500);
    },
    misSolicitudes: () => espera(sols),
    cancelarSolicitud: async (id) => {
      const s = sols.find((x) => x.id === id);
      const reembolso = s.estado === 'confirmada' && new Date(s.inicia_at) - Date.now() > 24 * H;
      s.estado = s.estado === 'confirmada' && !reembolso ? 'cancelada_tarde' : 'cancelada_tutor';
      if (reembolso) s.pago = 'reembolso_pendiente';
      if (s.medico) s.medico.telefono = null;
      return espera({ estado: s.estado, reembolso });
    },
    horariosReagenda: async () => espera([bloque(2, 10), bloque(2, 12), bloque(4, 16), bloque(6, 10)]),
    pedirReagenda: async (id, inicia) => { const x = sols.find((y) => y.id === id); if (x) { x.reagenda_propuesta_at = inicia; x.reagenda_por = 'tutor'; } },
    responderReagenda: async (id, acepta) => { const s = sols.find((x) => x.id === id) || solsM.find((x) => x.id === id); if (acepta) { s.inicia_at = s.reagenda_propuesta_at; s.termina_at = mas2(s.inicia_at); s.reagendas = 1; } s.reagenda_propuesta_at = null; s.reagenda_por = null; },
    reportar: async (id, tipo) => { const s = sols.find((x) => x.id === id); if (s) s.reportes.push({ tipo, estado: 'abierto', created_at: en(0) }); return espera(null, 400); },
    responderEncuesta: async (id) => { sols.find((x) => x.id === id).encuesta_pendiente = false; },
    pagar: async (id) => { await espera(null, 700); const s = sols.find((x) => x.id === id); s.estado = 'confirmada'; s.pago = 'aprobado'; s.medico.telefono = '5598765432'; },

    guardarPerfilMvz: async (p) => { Object.assign(perfil.mvz, p, { comparte_telefono: p.comparte_telefono === 'true', cedula: perfil.mvz.cedula_verificada_at ? perfil.mvz.cedula : p.cedula }); return espera(null, 400); },
    subirFotoMvz: async (jpg) => { perfil.mvz.foto = await new Promise((ok) => { const r = new FileReader(); r.onload = () => ok(r.result); r.readAsDataURL(jpg); }); },
    quitarFotoMvz: async () => { perfil.mvz.foto = null; },
    guardarHorario: async (b) => { perfil.mvz.horario = b; return espera(null, 400); },
    bloquearDia: async (f, si) => { perfil.mvz.bloqueos = si ? [...new Set([...perfil.mvz.bloqueos, f])].sort() : perfil.mvz.bloqueos.filter((x) => x !== f); },
    solicitudesMvz: () => espera(quien === 'mvz' ? solsM : []),
    responderSolicitud: async (id, acepta) => {
      const s = solsM.find((x) => x.id === id);
      if (acepta) { s.estado = 'por_pagar'; s.oferta = { estado: 'aceptada' }; s.precio_servicio = 650; } else solsM = solsM.filter((x) => x.id !== id);
      return espera({ resultado: acepta ? 'aceptada' : 'rechazada' }, 400);
    },
    cancelarComoMvz: async (id) => { solsM = solsM.filter((x) => x.id !== id); },
    proponerReagenda: async (id, inicia) => { solsM.find((x) => x.id === id).reagenda_propuesta_at = inicia; },

    mfaEstado: async () => ({ nivel: 'aal2', factor: { id: 'f1' } }),
    mfaInscribir: async () => ({ id: 'f1', qr: '', secreto: 'EJEMPLO' }),
    mfaVerificar: async () => {},
    admin: {
      resumen: () => espera({ medicos_pendientes: 1, medicos_aprobados: 3, tutores: 18, tutores_sin_verificar: 1, reportes_abiertos: 1, reembolsos_pendientes: 1, buscando: 2, por_pagar: 1, confirmadas: 4, realizadas_30d: 11, cuotas_30d: 1920, reembolsado_30d: 240, comision_30d: 158.72, retenciones_30d: 0, depositado_30d: 1761.28, pagos_sin_detalle_30d: 0, encuestas: 7 }),
      medicos: () => espera(adminMedicos),
      decidirMvz: async (id, accion) => { const m = adminMedicos.find((x) => x.id === id); if (accion === 'aprobar') { m.estado = 'aprobado'; m.cedula_verificada_at = m.identidad_verificada_at = en(0); } if (accion === 'suspender') m.estado = 'suspendido'; if (accion === 'reactivar') m.estado = 'aprobado'; },
      tutores: () => espera([{ id: 't1', nombre: 'Tania', apellidos: 'Herrera Luna', correo: 'tania@ejemplo.mx', telefono: '5512345678', telefono_verificado_at: en(-200), bloqueada: false, created_at: en(-24 * 30), solicitudes: 4 },
        { id: 't2', nombre: 'Tomás', apellidos: 'Rivas', correo: 'tomas@ejemplo.mx', telefono: '5500000002', telefono_verificado_at: null, bloqueada: false, created_at: en(-24 * 3), solicitudes: 1 }]),
      cuenta: async () => {},
      eliminarDatos: async () => {},
      solicitudes: () => espera(solicitudesTutor().map((s) => ({ ...s, tutor: 'Tania Herrera Luna', tutor_telefono: '5512345678', medico: s.medico?.nombre || null }))),
      cerrarSolicitud: async () => {},
      reportes: () => espera(reportes),
      resolverReporte: async (id, decision, version, resolucion) => { Object.assign(reportes.find((x) => x.id === id), { estado: 'resuelto', decision, version_medico: version, resolucion, resuelto_at: en(0) }); },
      pagos: () => espera([{ id: 'g1', monto: 120, estado: 'aprobado', mp_payment_id: '98200011', aprobado_at: en(-30), created_at: en(-31), tutor: 'Tania Herrera Luna', principal: true },
        { id: 'g2', monto: 120, estado: 'reembolso_pendiente', mp_payment_id: '98200377', motivo_reembolso: 'El médico veterinario canceló', intentos_reembolso: 0, aprobado_at: en(-50), created_at: en(-51), tutor: 'Tomás Rivas', principal: true }]),
      procesarReembolsos: () => espera({ reembolsados: 1, fallidos: 0 }, 800),
      demanda: () => espera([
        { alcaldia: 'Azcapotzalco', busquedas: 7, tutores: 5, consulta: 5, vacunacion: 2, desparasitacion: 0, sin_medicos: true, ultima: en(-2), medicos_hoy: 0 },
        { alcaldia: 'Tlalpan', busquedas: 3, tutores: 3, consulta: 1, vacunacion: 1, desparasitacion: 1, sin_medicos: false, ultima: en(-30), medicos_hoy: 1 },
      ]),
      encuestas: () => espera([{ solicitud_id: 's4', se_presento: true, puntualidad: 5, trato: 5, recomendaria: 10, comentario: 'Muy paciente con mi gata.', created_at: en(-70), servicio: 'consulta', inicia_at: bloque(-5, 10), medico: MEDICOS[2].nombre }]),
      bitacora: () => espera([{ id: 3, accion: 'mvz_aprobar', objeto: 'mvz', objeto_id: 'm3', created_at: en(-24 * 8), actor: 'Katia Moctezuma' }, { id: 2, accion: 'parametro', objeto: 'parametro', objeto_id: 'cuota_servicio', detalle: { valor: '120' }, created_at: en(-24 * 9), actor: 'Katia Moctezuma' }]),
      parametros: () => espera({ cuota_servicio: 120, minutos_respuesta: 60, horas_para_pagar: 12, horas_cancelacion: 24, horas_anticipacion: 3, dias_agenda: 14, exigir_telefono_verificado: true, version_terminos: '2026-11', version_privacidad: '2026-11', version_carta: '2026-11' }),
      guardarParametro: async () => {},
    },
  };
}
