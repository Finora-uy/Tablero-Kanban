
/* ===== Scrum: roles, Definition of Ready (DoR), sprints y capacidad ===== */

/* ----- Roles: el Scrum Master, el Product Owner y sus suplentes se eligen en Equipo → Roles del proyecto ----- */
// Se guardan en scrum/roles: { sm, po, suplencias: [{ id, rol, miembro, sprint, semana }] }
// sprint null = suple en cualquier momento; semana null = el sprint entero
const ROLES_SCRUM = [{ id: 'sm', nombre: 'Scrum Master', clave: 'scrum master' }, { id: 'po', nombre: 'Product Owner', clave: 'product owner' }];
const rolesScrumGuardados = () => estado.scrum.get('roles') || {};
// El titular es el elegido en Equipo. Si nunca se eligió, vale lo que diga el campo «Rol» de cada perfil.
function titularesDe(rol) {
  const g = rolesScrumGuardados();
  if (g[rol] !== undefined) return estado.integrantes.has(g[rol]) ? [g[rol]] : [];
  const clave = ROLES_SCRUM.find(r => r.id === rol).clave;
  return [...estado.integrantes].filter(([, m]) => normalizar(m.rol).includes(clave)).map(([id]) => id);
}
const suplenciasDe = rol => (rolesScrumGuardados().suplencias || []).filter(x => x.rol === rol && estado.integrantes.has(x.miembro))
  .sort((a, b) => (a.sprint || 0) - (b.sprint || 0) || (a.semana || 0) - (b.semana || 0));
// Fechas que cubre una suplencia: null si es permanente o si su sprint (o esa semana) todavía no existe
function rangoSuplencia(x, sprints = armarSprints(estado.sprints)) {
  const s = x.sprint && sprints.find(y => y.numero === x.sprint);
  if (!s || (x.semana && x.semana > s.semanas)) return null;
  if (!x.semana) return { inicio: s.inicio, fin: s.fin };
  const inicio = sumarDias(s.inicio, (x.semana - 1) * 7);
  return { inicio, fin: sumarDias(inicio, 6) };
}
function suplenciaVigente(x, hoy = hoyISO()) {
  if (!x.sprint) return true;
  const r = rangoSuplencia(x);
  return !!r && r.inicio <= hoy && hoy <= r.fin;
}
const textoSuplencia = x => !x.sprint ? 'Siempre que falte el titular' : `Sprint ${x.sprint}${x.semana ? ', semana ' + x.semana : ', entero'}`;
// Quiénes pueden actuar hoy con ese rol: el titular y los suplentes vigentes
const habilitadosDe = rol => [...new Set([...titularesDe(rol), ...suplenciasDe(rol).filter(x => suplenciaVigente(x)).map(x => x.miembro)])];
const nombresDe = ids => ids.map(id => (estado.integrantes.get(id) || {}).nombre).filter(Boolean).join(', ');
const hayRol = rol => titularesDe(rol).length > 0;
const esSM = () => habilitadosDe('sm').includes(yo());
const esPO = () => habilitadosDe('po').includes(yo());
// Mientras no haya titulares, no se bloquea a nadie (si no, el tablero quedaría trabado)
const sinRolesScrum = () => !hayRol('sm') && !hayRol('po');
const puedeGestionarScrum = () => esSM() || esPO() || sinRolesScrum();
const puedeMarcarListo = () => esPO() || !hayRol('po');
const puedeAprobarExcepcion = rol => rol === 'sm' ? (esSM() || !hayRol('sm')) : (esPO() || !hayRol('po'));

const accionesRoles = {
  guardar(cambios) {
    return conManejo(estado.scrum.has('roles') ? backend.actualizar('scrum/roles', cambios) : backend.crear('scrum/roles', cambios));
  },
  elegirTitular(rol, miembro) { return this.guardar({ [rol]: miembro || null }); },
  agregarSuplente(rol, miembro, sprint, semana) {
    if (titularesDe(rol).includes(miembro)) { avisar('Esa persona ya es titular del rol: elegí a otra como suplente.', 'error'); return Promise.resolve(false); }
    const lista = rolesScrumGuardados().suplencias || [];
    if (lista.some(x => x.rol === rol && x.miembro === miembro && x.sprint === sprint && x.semana === semana)) { avisar('Esa suplencia ya está cargada.', 'error'); return Promise.resolve(false); }
    return this.guardar({ suplencias: [...lista, { id: uid(), rol, miembro, sprint, semana }] });
  },
  quitarSuplente(id) { return this.guardar({ suplencias: (rolesScrumGuardados().suplencias || []).filter(x => x.id !== id) }); },
};

/* ----- Criterios de la DoR (v1.1, FIN-67) ----- */
// manual: se tilda en la tarea · auto: se comprueba sola con los datos de la tarea · los dos: hacen falta ambos
const DOR_HISTORIA = [
  { id: 'valor', nombre: 'Valor y trazabilidad', verifica: 'Ingeniero de requerimientos', manual: true,
    texto: 'La historia indica rol, necesidad y beneficio, está vinculada a un requerimiento (RF-xx) y tiene la prioridad MoSCoW vigente.',
    auto: t => !!(t.rf || '').trim() && !!MOSCOW_POR_ID[t.moscow], falta: 'cargá el RF-xx y la prioridad MoSCoW' },
  { id: 'formulacion', nombre: 'Formulación (INVEST)', verifica: 'Ingeniero de requerimientos', manual: true,
    texto: 'Es independiente, negociable, valiosa, estimable, pequeña y verificable, y se comprende sin explicaciones adicionales.' },
  { id: 'aceptacion', nombre: 'Criterios de aceptación', verifica: 'Ingeniero de requerimientos y SQA', manual: true,
    texto: 'Están escritos y son verificables, preferentemente Dado / Cuando / Entonces. Para cálculos financieros, al menos un caso con valores esperados.',
    auto: t => (t.criterios || []).length > 0, falta: 'cargá los criterios de aceptación' },
  { id: 'estimacion', nombre: 'Estimación', verifica: 'Equipo completo', manual: false,
    texto: 'Estimada con planning poker (1, 2, 3, 5, 8 o 13). Un ítem de 13 puntos se divide en subtareas antes de entrar.',
    auto: t => tieneEstimacion(t) && (Number(t.estimacion) < 13 || (t.subtareas || []).length >= 2), falta: 'estimala; si son 13 puntos, dividila en al menos 2 subtareas' },
  { id: 'dependencias', nombre: 'Dependencias', verifica: 'Arquitecto', manual: true,
    texto: 'Las dependencias con otros ítems, datos, servicios externos o definiciones del experto están resueltas o planificadas en el mismo sprint.' },
  { id: 'datos', nombre: 'Datos de prueba', verifica: 'Ingeniero de requerimientos', manual: true,
    texto: 'Hay datos sintéticos o anonimizados para desarrollar y probar. Si requiere una definición financiera, se consultó al experto (riesgo PD-07).' },
  { id: 'diseno', nombre: 'Diseño y explicabilidad', verifica: 'Arquitecto', manual: true,
    texto: 'Si tiene interfaz, hay boceto o prototipo acordado. Se definió qué dato de origen, fórmula y supuestos se muestran junto a cada resultado (RF-66 a RF-68).' },
  { id: 'calidad', nombre: 'Requisitos de calidad', verifica: 'Arquitecto y SQA', manual: true,
    texto: 'Se identificaron las restricciones no funcionales que le aplican: seguridad, protección de datos (Ley 18.331) o rendimiento.' },
  { id: 'capacidad', nombre: 'Capacidad', verifica: 'Scrum Master', manual: true,
    texto: 'Hay un responsable tentativo y su disponibilidad en el sprint alcanza para el esfuerzo estimado (riesgo PY-02).',
    auto: t => (t.asignados || []).length > 0, falta: 'asigná un responsable tentativo' },
  { id: 'demo', nombre: 'Demostración', verifica: 'Equipo completo', manual: true,
    texto: 'Está definido cómo se va a mostrar el ítem terminado en la revisión del sprint.',
    auto: t => !!(t.demo || '').trim(), falta: 'escribí cómo se va a mostrar en la revisión' },
];
// Investigación técnica (spike): no se estima ni pide criterios de aceptación de funcionalidad
const DOR_SPIKE = [
  { id: 'pregunta', nombre: 'Pregunta a responder', verifica: 'Quien la propone', texto: 'Indica qué pregunta se quiere responder.', auto: t => !!((t.spike || {}).pregunta || '').trim(), falta: 'escribí la pregunta' },
  { id: 'tiempo', nombre: 'Tiempo máximo', verifica: 'Quien la propone', texto: 'Tiene un tiempo máximo asignado (por ejemplo, 8 h).', auto: t => !!((t.spike || {}).tiempo || '').trim(), falta: 'indicá el tiempo máximo' },
  { id: 'salida', nombre: 'Salida esperada', verifica: 'Quien la propone', texto: 'Dice qué se entrega: informe, prototipo o decisión.', auto: t => !!(t.spike || {}).salida, falta: 'elegí la salida esperada' },
];
// Defecto: pasos, severidad y comportamiento esperado
const DOR_BUG = [
  { id: 'pasos', nombre: 'Pasos de reproducción', verifica: 'Quien lo reporta', texto: 'Tiene los pasos para reproducirlo.', auto: t => !!((t.bug || {}).pasos || '').trim(), falta: 'escribí los pasos de reproducción' },
  { id: 'severidad', nombre: 'Severidad', verifica: 'Quien lo reporta', texto: 'Tiene una severidad asignada.', auto: t => !!(t.bug || {}).severidad, falta: 'elegí la severidad' },
  { id: 'esperado', nombre: 'Comportamiento esperado', verifica: 'Quien lo reporta', texto: 'Dice qué debería pasar.', auto: t => !!((t.bug || {}).esperado || '').trim(), falta: 'escribí el comportamiento esperado' },
];
const SEVERIDADES = [{ id: 'critica', nombre: 'Crítica' }, { id: 'alta', nombre: 'Alta' }, { id: 'media', nombre: 'Media' }, { id: 'baja', nombre: 'Baja' }];
const SALIDAS_SPIKE = [{ id: 'informe', nombre: 'Informe' }, { id: 'prototipo', nombre: 'Prototipo' }, { id: 'decision', nombre: 'Decisión' }];
const criteriosDoR = t => t.tipo === 'inv' ? DOR_SPIKE : t.tipo === 'bug' ? DOR_BUG : DOR_HISTORIA;

function evaluarDoR(t) {
  const checks = (t.dor && t.dor.checks) || {};
  const items = criteriosDoR(t).map(c => {
    const auto = c.auto ? !!c.auto(t) : true;
    const tilde = !c.manual || !!checks[c.id];
    return { c, auto, tilde, ok: auto && tilde, check: checks[c.id] || null };
  });
  const cumplidos = items.filter(x => x.ok).length;
  return { items, total: items.length, cumplidos, completa: cumplidos === items.length, faltan: items.filter(x => !x.ok) };
}
const textoFaltan = (ev, max = 3) => {
  const n = ev.faltan.map(x => x.c.nombre);
  return n.slice(0, max).join(', ') + (n.length > max ? ` y ${n.length - max} más` : '');
};
const codigoDe = t => `${(estado.config || CONFIG_BASE).prefijo}-${t.numero ?? '?'}`;

/* ----- Excepción: el SM y el PO acuerdan que entre igual, y queda registrada en la tarea ----- */
const excepcionAprobada = t => !!(t.dorExcepcion && t.dorExcepcion.aprobaciones && t.dorExcepcion.aprobaciones.sm && t.dorExcepcion.aprobaciones.po);
const excepcionVencida = (t, hoy) => excepcionAprobada(t) && !t.dorExcepcion.resueltaEn && !!t.dorExcepcion.plazo && t.dorExcepcion.plazo < hoy;

// ¿Puede esta tarea ir a un sprint? Devuelve el motivo si no.
function motivoNoEntraASprint(t) {
  if (excepcionAprobada(t)) return null;
  const ev = evaluarDoR(t);
  if (!ev.completa) return `${codigoDe(t)} todavía no cumple la Definition of Ready (falta: ${textoFaltan(ev)}). Completala, o pedí una excepción al Scrum Master y al Product Owner desde el detalle de la tarea.`;
  if (!t.dorOk) return `${codigoDe(t)} cumple los criterios, pero el Product Owner todavía no la marcó como Listo.`;
  return null;
}
// La DoR solo se exige a las tareas de Scrum: las que llevan la etiqueta «Scrum» o ya están en un sprint
const esTareaScrum = t => (t.etiquetas || []).some(x => x === 'scrum' || ES_ID_SPRINT.test(x));
function motivoListoBloqueado(t) {
  if (!esTareaScrum(t)) return null;
  if (!puedeMarcarListo()) {
    const po = nombresDe(habilitadosDe('po'));
    return `Solo el Product Owner${po ? ' (' + po + ')' : ''} puede pasar una tarea a Listo.`;
  }
  const ev = evaluarDoR(t);
  if (!ev.completa) return `Para pasar ${codigoDe(t)} a Listo falta cumplir la DoR: ${textoFaltan(ev)}. Se completa en el detalle de la tarea.`;
  return null;
}
// Poner o sacar la etiqueta Sprint: solo SM o PO, un solo sprint por tarea y con la DoR cumplida (o excepción)
function motivoSprintBloqueado(t, nuevas) {
  const deSprint = l => (l || []).filter(x => ES_ID_SPRINT.test(x));
  const antes = deSprint(t.etiquetas), despues = deSprint(nuevas);
  if (antes.slice().sort().join() === despues.slice().sort().join()) return null;
  if (!puedeGestionarScrum()) return 'Solo el Scrum Master o el Product Owner pueden poner o sacar una tarea de un sprint.';
  const agregadas = despues.filter(x => !antes.includes(x));
  if (!agregadas.length) return null;
  if (despues.length > 1) return 'Una tarea va en un solo sprint.';
  if (!armarSprints(estado.sprints).some(s => s.id === agregadas[0])) return 'Ese sprint no existe.';
  return motivoNoEntraASprint(t);
}

/* ----- Acciones ----- */
const accionesScrum = {
  async crearSprint(semanas = 2) {
    if (!puedeGestionarScrum()) { avisar('Solo el Scrum Master o el Product Owner pueden crear sprints.', 'error'); return false; }
    const sprints = armarSprints(estado.sprints);
    const ult = sprints[sprints.length - 1];
    const numero = (ult ? ult.numero : 0) + 1;
    const fin = sumarDias(ult ? ult.fin : sumarDias(SCRUM.inicio, -1), semanas * 7);
    if (fin > SCRUM.hasta) { avisar(`El Sprint ${numero} no entra en el calendario: terminaría el ${fechaLarga(fin)} y el calendario llega hasta el ${fechaLarga(SCRUM.hasta)}. Probá con menos semanas.`, 'error'); return false; }
    const ok = await conManejo(backend.crear('sprints/sprint-' + numero, { numero, semanas, objetivo: '', creadoPor: yo(), creadoEn: ahoraISO() }));
    if (ok) avisar(`Creaste el Sprint ${numero}: ya existen su etiqueta y su etapa.`);
    return ok;
  },
  async crearCuatro() {
    if (!puedeGestionarScrum()) { avisar('Solo el Scrum Master o el Product Owner pueden crear sprints.', 'error'); return false; }
    for (let n = 1; n <= 4; n++) {
      if (estado.sprints.has('sprint-' + n)) continue;
      const ok = await conManejo(backend.crear('sprints/sprint-' + n, { numero: n, semanas: 2, objetivo: '', creadoPor: yo(), creadoEn: ahoraISO() }));
      if (!ok) return false;
    }
    avisar('Creaste los 4 sprints de 2 semanas, con su etiqueta y su etapa.');
    return true;
  },
  async cambiarSemanas(id, semanas) {
    if (!puedeGestionarScrum()) { avisar('Solo el Scrum Master o el Product Owner pueden cambiar la duración de un sprint.', 'error'); return false; }
    const prueba = new Map(estado.sprints);
    prueba.set(id, { ...estado.sprints.get(id), semanas });
    const lista = armarSprints(prueba);
    const pasado = lista.find(s => s.fin > SCRUM.hasta);
    if (pasado) { avisar(`Con ${semanas} semana${semanas === 1 ? '' : 's'} el ${pasado.nombre} terminaría el ${fechaLarga(pasado.fin)}, después del fin del calendario (${fechaLarga(SCRUM.hasta)}). Achicá algún sprint antes.`, 'error'); notificar(); return false; }
    return conManejo(backend.actualizar('sprints/' + id, { semanas }));
  },
  guardarTitulo(id, titulo) { return conManejo(backend.actualizar('sprints/' + id, { titulo })); },
  guardarObjetivo(id, objetivo) { return conManejo(backend.actualizar('sprints/' + id, { objetivo })); },
  async borrarSprint(id) {
    if (!puedeGestionarScrum()) { avisar('Solo el Scrum Master o el Product Owner pueden borrar sprints.', 'error'); return false; }
    const n = [...estado.tareas.values()].filter(t => (t.etiquetas || []).includes(id)).length;
    if (n) { avisar(`Ese sprint tiene ${n} tarea${n === 1 ? '' : 's'}. Sacalas del sprint antes de borrarlo.`, 'error'); return false; }
    return conManejo(backend.borrar('sprints/' + id));
  },
  // Pone la tarea en un sprint (o la saca si sprintId es null). La regla de la DoR se aplica en actualizarTarea.
  asignar(tareaId, sprintId) {
    const t = estado.tareas.get(tareaId);
    if (!t) return Promise.resolve(false);
    const sinSprint = (t.etiquetas || []).filter(x => !ES_ID_SPRINT.test(x));
    const previo = armarSprints(estado.sprints).find(s => (t.etiquetas || []).includes(s.id));
    const nuevo = sprintId ? armarSprints(estado.sprints).find(s => s.id === sprintId) : null;
    if (previo && nuevo && previo.id === nuevo.id) return Promise.resolve(true);
    return acciones.actualizarTarea(tareaId, { etiquetas: nuevo ? [...sinSprint, nuevo.id] : sinSprint },
      nuevo ? `la sumó al ${nuevo.nombre}${!t.dorOk && excepcionAprobada(t) ? ' con excepción de DoR' : ''}` : `la sacó del ${previo ? previo.nombre : 'sprint'}`);
  },
  tildar(tareaId, critId, on) {
    const t = estado.tareas.get(tareaId);
    if (!t || !yo()) { if (!yo()) avisar('Sumate al tablero (menú de tu perfil) para tildar la DoR.', 'error'); return Promise.resolve(false); }
    const checks = { ...((t.dor && t.dor.checks) || {}) };
    if (on) checks[critId] = { por: yo(), en: ahoraISO() }; else delete checks[critId];
    return acciones.actualizarTarea(tareaId, { dor: { checks } }, null);
  },
  // Pasa la tarea a Listo; si ya avanzó más allá de esa columna (por ejemplo, ya está En curso), solo registra que cumple la DoR
  marcarListo(tareaId) {
    const t = estado.tareas.get(tareaId);
    if (!t) return Promise.resolve(false);
    if (indiceColumna(t.columna) <= indiceColumna('listo')) return acciones.moverAlFinal(tareaId, 'listo');
    const motivo = motivoListoBloqueado({ ...t, id: tareaId });
    if (motivo) { avisar(motivo, 'error'); return Promise.resolve(false); }
    return acciones.actualizarTarea(tareaId, { dorOk: { por: yo(), en: ahoraISO() } }, 'la marcó como Lista: cumple la Definition of Ready');
  },
  pedirExcepcion(tareaId, datos) {
    const t = estado.tareas.get(tareaId);
    if (!t) return Promise.resolve(false);
    const exc = { faltante: datos.faltante.trim(), responsable: datos.responsable || null, plazo: datos.plazo || null, pedidaPor: yo(), en: ahoraISO(), aprobaciones: { sm: null, po: null }, resueltaEn: null };
    return acciones.actualizarTarea(tareaId, { dorExcepcion: exc }, 'pidió ingresar con excepción de DoR: ' + exc.faltante);
  },
  async aprobarExcepcion(tareaId, rol) {
    const t = estado.tareas.get(tareaId);
    if (!t || !t.dorExcepcion) return false;
    if (!puedeAprobarExcepcion(rol)) { avisar(rol === 'sm' ? 'Solo el Scrum Master puede dar su acuerdo acá.' : 'Solo el Product Owner puede dar su acuerdo acá.', 'error'); return false; }
    const ap = { ...(t.dorExcepcion.aprobaciones || {}), [rol]: yo() };
    const completa = !!(ap.sm && ap.po);
    return acciones.actualizarTarea(tareaId, { dorExcepcion: { ...t.dorExcepcion, aprobaciones: ap } },
      `dio su acuerdo como ${rol === 'sm' ? 'Scrum Master' : 'Product Owner'} a la excepción de DoR${completa ? ': ya puede entrar a un sprint' : ''}`);
  },
  resolverExcepcion(tareaId, resuelta) {
    const t = estado.tareas.get(tareaId);
    if (!t || !t.dorExcepcion) return Promise.resolve(false);
    return acciones.actualizarTarea(tareaId, { dorExcepcion: { ...t.dorExcepcion, resueltaEn: resuelta ? ahoraISO() : null } },
      resuelta ? 'marcó como resuelto el faltante de la excepción de DoR' : 'reabrió el faltante de la excepción de DoR');
  },
  retirarExcepcion(tareaId) {
    const t = estado.tareas.get(tareaId);
    if (!t) return Promise.resolve(false);
    if (armarSprints(estado.sprints).some(s => (t.etiquetas || []).includes(s.id))) {
      avisar('Está en un sprint por esta excepción. Sacala del sprint antes de retirarla.', 'error'); return Promise.resolve(false);
    }
    return acciones.actualizarTarea(tareaId, { dorExcepcion: null }, 'retiró la excepción de DoR');
  },
};

/* ----- Ceremonias: salen de las fechas de cada sprint ----- */
// Planificación y primer refinamiento el primer día; segundo refinamiento (SM y PO) a mitad del sprint;
// revisión y retrospectiva el último día hábil (viernes).
function ceremoniasSprint(s) {
  const l = [{ fecha: s.inicio, id: 'planning', nombre: 'Planificación + refinamiento 1', corto: 'Planning + refinamiento' }];
  if (s.semanas >= 2) l.push({ fecha: sumarDias(s.inicio, 7 * Math.floor(s.semanas / 2)), id: 'ref2', nombre: 'Refinamiento 2 (SM y PO, para preparar el sprint siguiente)', corto: 'Refinamiento' });
  l.push({ fecha: sumarDias(s.fin, -2), id: 'revision', nombre: 'Revisión y retrospectiva', corto: 'Revisión + retro' });
  return l.map(c => ({ ...c, sprint: s }));
}

/* ----- Capacidad y avance de un sprint ----- */
const esFeriado = (ctx, iso) => ctx.roadmap.periodos.some(p => p.tipo === 'feriado' && p.desde <= iso && iso <= (p.hasta || p.desde));
// Las ausencias del Roadmap no guardan la persona: se reconoce por el nombre o apellido que diga la descripción.
// Si coincide con más de una por igual (o con nadie), devuelve null.
function miembroDePeriodo(p, miembros) {
  const palabras = t => normalizar(t).split(/[^a-z0-9ñ]+/).filter(Boolean);
  const texto = palabras(p.etiqueta);
  let mejor = null, max = 0, empate = false;
  for (const m of miembros) {
    const nombre = palabras(m.nombre);
    let puntos = 0;
    nombre.forEach((n, i) => {
      const en = n.length >= 3 ? texto.indexOf(n) : -1;
      if (en < 0) return;
      puntos += 2;
      // «Tomás C.»: la inicial del apellido desempata
      const sig = texto[en + 1];
      if (sig && sig.length === 1 && nombre[i + 1] && nombre[i + 1][0] === sig) puntos += 1;
    });
    if (puntos > max) { mejor = m; max = puntos; empate = false; } else if (puntos && puntos === max) empate = true;
  }
  return empate ? null : mejor;
}
// Quiénes no están un día: lo cargado en Disponibilidad más las ausencias del Roadmap
function ausentesDelDia(ctx, iso) {
  const personas = new Map(), sueltas = [];
  for (const m of ctx.miembros) {
    const motivo = ausencia(ctx, m.id, iso);
    if (motivo !== null) personas.set(m.id, { m, motivo: typeof motivo === 'string' ? motivo : '' });
  }
  for (const p of ctx.roadmap.periodos) {
    if (p.tipo !== 'ausencia' || !(p.desde <= iso && iso <= (p.hasta || p.desde))) continue;
    const m = miembroDePeriodo(p, ctx.miembros);
    if (!m) sueltas.push(p.etiqueta);
    else if (!personas.has(m.id)) personas.set(m.id, { m, motivo: p.etiqueta });
  }
  return { personas: [...personas.values()], sueltas };
}
// El primer nombre; si se repite en el equipo, con la inicial que sigue
function nombreCorto(m, miembros) {
  const [uno, dos] = m.nombre.trim().split(/\s+/);
  const repetido = miembros.some(x => x.id !== m.id && normalizar(x.nombre.trim().split(/\s+/)[0]) === normalizar(uno));
  return repetido && dos ? `${uno} ${dos[0]}.` : uno;
}
function capacidadSprint(s, ctx) {
  const personas = ctx.miembros.map(m => {
    let min = 0;
    for (let d = s.inicio; d <= s.fin; d = sumarDias(d, 1)) {
      const dow = (aFecha(d).getDay() + 6) % 7;
      if (dow > 4 || esFeriado(ctx, d) || ausentesDelDia(ctx, d).personas.some(x => x.m.id === m.id)) continue;
      min += minutosFranjas(semanaDe(ctx, m.id)[dow]);
    }
    return { m, horas: min / 60 };
  });
  return { personas, horas: personas.reduce((a, p) => a + p.horas, 0) };
}
function resumenSprint(s, ctx) {
  const tareas = ctx.tareas.filter(t => !t.archivada && (t.etiquetas || []).includes(s.id));
  const hechas = tareas.filter(t => esHecha(t, ctx));
  const pts = l => l.reduce((a, t) => a + (Number(t.estimacion) || 0), 0);
  return { tareas, hechas, puntos: pts(tareas), puntosHechos: pts(hechas), sinEstimar: tareas.filter(t => !tieneEstimacion(t)).length };
}
function datosBurndown(s, ctx) {
  const { tareas, puntos } = resumenSprint(s, ctx);
  const dias = [];
  for (let d = s.inicio; d <= s.fin; d = sumarDias(d, 1)) dias.push(d);
  const cierres = tareas.filter(t => esHecha(t, ctx) && t.terminadaEn).map(t => ({ dia: isoDe(new Date(t.terminadaEn)), pts: Number(t.estimacion) || 0 }));
  return {
    total: puntos,
    puntos: dias.map((fecha, i) => ({
      fecha, ideal: puntos * (1 - i / Math.max(1, dias.length - 1)),
      real: fecha <= ctx.hoy ? puntos - cierres.filter(c => c.dia <= fecha).reduce((a, c) => a + c.pts, 0) : null,
    })),
  };
}
