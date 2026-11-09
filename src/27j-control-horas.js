
/* ===== Horas: control de calidad del registro (para SQA y SCM) =====
   Calcula, para un mes, los controles del registro de horas. La pantalla los muestra y 27k los pasa a Excel. */
const META_VINCULADAS = 90;     // % de horas sin reuniones vinculadas a una tarea
const CARGA_TARDIA_HORAS = 48;  // cargado más de 48 h después de terminar
const REGISTRO_LARGO_MIN = 8 * 60;
const REGISTRO_CORTO_MIN = 5;
const DESVIO_TAREA_PCT = 50;    // horas reales contra estimadas de una tarea terminada
const NOTA_MIN_LETRAS = 10;
// Se comparan sin tildes ni signos
const NOTAS_GENERICAS = new Set(['avance', 'avances', 'avance de la tarea', 'avance tarea', 'cosas', 'hice cosas', 'varias cosas', 'varios', 'otros', 'otro', 'general',
  'trabajo', 'trabajando', 'trabajo en la tarea', 'trabajo en tarea', 'trabajo general', 'trabajo del proyecto', 'proyecto', 'tarea', 'tareas', 'la tarea',
  'reunion', 'reuniones', 'reunion de equipo', 'reunion del equipo', 'reunion grupal', 'desarrollo', 'documentacion', 'documento', 'investigacion', 'revision', 'revisiones',
  'correcciones', 'ajustes', 'cambios', 'pruebas', 'testing', 'gestion', 'sin nota', 'sin descripcion', 'nada', 'etc']);

const notaNormal = s => normalizar(s).replace(/[^a-z0-9ñ ]+/g, ' ').replace(/\s+/g, ' ').trim();
const esReunionReg = (r, ctx) => r.etapa === 'reunion' || ctx.trabajosPorId.get(r.trabajo)?.grupo === 'Reuniones';
const finDeSemana = fecha => { const d = aFecha(lunesISO(fecha)); d.setDate(d.getDate() + 6); return isoDe(d); };
const unDiaMenos = iso => { const d = aFecha(iso); d.setDate(d.getDate() - 1); return isoDe(d); };

// Devuelve 'Sin nota', 'Nota genérica' o null si la nota está bien
function problemaNota(r, ctx) {
  const n = notaNormal(r.descripcion);
  if (!n) return 'Sin nota';
  const letras = n.replace(/[^a-zñ]/g, '').length;
  const palabras = n.split(' ').length;
  const nombres = [ctx.trabajosPorId.get(r.trabajo)?.nombre, ctx.etapasPorId.get(r.etapa)?.nombre].filter(Boolean).map(notaNormal);
  if (NOTAS_GENERICAS.has(n) || nombres.includes(n) || palabras < 2 || letras < NOTA_MIN_LETRAS) return 'Nota genérica';
  return null;
}

// Meses que se pueden elegir: los que tienen horas y el actual, del más nuevo al más viejo
function mesesDeControl(ctx) {
  const set = new Set(ctx.horas.map(r => mesClave(r.fecha)));
  set.add(mesClave(ctx.hoy));
  return [...set].filter(m => m <= mesClave(ctx.hoy)).sort().reverse();
}

function calcularControlHoras(ctx, mes) {
  const pctDe = (a, b) => (b ? a / b * 100 : 0);
  const regs = ctx.horas.filter(r => mesClave(r.fecha) === mes).sort((a, b) => (a.inicio < b.inicio ? -1 : 1));
  const [y, m] = mes.split('-').map(Number);
  const ultimoDia = isoDe(new Date(y, m, 0));
  const enCurso = ultimoDia >= ctx.hoy;
  // El día de hoy todavía no terminó: en el mes en curso se mide hasta ayer
  const hasta = enCurso ? unDiaMenos(ctx.hoy) : ultimoDia;

  const hallazgos = [];
  const tareaTexto = id => { if (!id) return ''; const t = ctx.porId.get(id); return t ? `${codigo(t, ctx)} ${t.titulo}` : 'Tarea borrada'; };
  const anotar = (control, r, detalle, extra = {}) => hallazgos.push({
    control, persona: nombreDe(r.miembro, ctx), miembro: r.miembro, fecha: r.fecha, cierre: finDeSemana(r.fecha), minutos: r.minutos || 0,
    detalle, nota: r.descripcion || '', tarea: tareaTexto(r.tarea), ...extra,
  });
  const marcas = new Map(); // observaciones por registro, para la hoja de registros
  const marcar = (r, texto) => { if (!marcas.has(r.id)) marcas.set(r.id, []); marcas.get(r.id).push(texto); };
  const personasIds = [...ctx.miembros.map(x => x.id), ...new Set(regs.map(r => r.miembro).filter(id => !ctx.integrantes.has(id)))];
  const porPersona = new Map(personasIds.map(id => [id, {
    id, nombre: nombreDe(id, ctx), rol: ctx.integrantes.get(id)?.rol || '', minutos: 0, registros: 0, reunionMin: 0, baseMin: 0, vinculadoMin: 0,
    notas: 0, superpuestos: 0, duplicadas: 0, tardios: 0, dispDeclarada: HABILES.some(d => minutosFranjas(semanaDe(ctx, id)[d]) > 0), dispMin: 0, esperados: 0, conRegistro: 0, diasSin: [],
  }]));
  const porSemana = new Map();
  const semana = fecha => {
    const l = lunesISO(fecha);
    if (!porSemana.has(l)) porSemana.set(l, { lunes: l, minutos: 0, baseMin: 0, vinculadoMin: 0, notas: 0, duplicadas: 0 });
    return porSemana.get(l);
  };

  /* --- Por registro --- */
  let total = 0, reunionMin = 0, baseMin = 0, vinculadoMin = 0;
  let notasMal = 0, sinNota = 0, genericas = 0, copiadas = 0, sinClasificar = 0, tardios = 0, conFechaCarga = 0, atipicos = 0, enCerradas = 0, deOtro = 0, editados = 0;
  for (const r of regs) {
    const min = r.minutos || 0, p = porPersona.get(r.miembro), s = semana(r.fecha);
    const reunion = esReunionReg(r, ctx), t = r.tarea ? ctx.porId.get(r.tarea) : null;
    total += min; p.minutos += min; p.registros++; s.minutos += min;
    if (reunion) { reunionMin += min; p.reunionMin += min; }
    else {
      baseMin += min; p.baseMin += min; s.baseMin += min;
      if (t) { vinculadoMin += min; p.vinculadoMin += min; s.vinculadoMin += min; }
      else { anotar('Horas sin tarea vinculada', r, r.tarea ? 'La tarea vinculada ya no existe: vinculá otra' : 'Vincular el registro a una tarea'); marcar(r, 'Sin tarea'); }
    }
    const nota = problemaNota(r, ctx);
    if (nota) {
      notasMal++; p.notas++; s.notas++;
      if (nota === 'Sin nota') sinNota++; else genericas++;
      anotar('Registro sin nota o con nota genérica', r, `${nota}: escribir qué se hizo`);
      marcar(r, nota);
    } else if (t && notaNormal(r.descripcion) === notaNormal(t.titulo)) { copiadas++; marcar(r, 'Nota igual al título de la tarea'); }
    if (!r.etapa || !r.trabajo) {
      sinClasificar++;
      const falta = !r.etapa && !r.trabajo ? 'etapa y trabajo' : !r.etapa ? 'etapa' : 'trabajo';
      anotar('Registro sin clasificar', r, `Falta ${falta}`); marcar(r, `Falta ${falta}`);
    }
    if (r.creadoEn) {
      conFechaCarga++;
      const demora = (new Date(r.creadoEn) - new Date(r.fin)) / 3600e3;
      if (demora > CARGA_TARDIA_HORAS) { tardios++; p.tardios++; anotar('Carga tardía', r, `Se cargó ${Math.round(demora / 24)} días después de hacerlo`); marcar(r, 'Carga tardía'); }
    }
    if (min > REGISTRO_LARGO_MIN || min < REGISTRO_CORTO_MIN) {
      atipicos++;
      anotar('Duración atípica', r, min > REGISTRO_LARGO_MIN ? `Dura ${duracionTexto(min)}: ¿quedó prendido el cronómetro?` : `Dura ${duracionTexto(min)}: ¿sirve o se borra?`);
      marcar(r, 'Duración atípica');
    }
    if (t && (t.archivada || (esHecha(t, ctx) && t.terminadaEn && r.fecha > isoDe(new Date(t.terminadaEn))))) {
      enCerradas++;
      anotar('Horas en tareas cerradas', r, t.archivada ? 'La tarea está archivada' : `La tarea se terminó el ${fechaNum(isoDe(new Date(t.terminadaEn)))}`);
      marcar(r, 'Tarea ya cerrada');
    }
    if (r.creadoPor && r.creadoPor !== r.miembro) deOtro++;
    if (r.creadoEn && r.actualizadoEn && new Date(r.actualizadoEn) - new Date(r.creadoEn) > 60000) editados++;
  }

  /* --- Superposiciones y reuniones duplicadas, por persona --- */
  let duplicadas = 0, superpuestas = 0, reunionesTotal = 0;
  for (const id of personasIds) {
    const propios = regs.filter(r => r.miembro === id);
    for (let i = 0; i < propios.length; i++) {
      for (let j = i + 1; j < propios.length; j++) {
        const a = propios[i], b = propios[j];
        if (new Date(b.inicio) >= new Date(a.fin)) break; // están ordenados por inicio
        if (esReunionReg(a, ctx) && esReunionReg(b, ctx)) continue; // se cuentan abajo como reuniones duplicadas
        superpuestas++; porPersona.get(id).superpuestos++;
        anotar('Registros superpuestos', a, `Se superpone con otro registro de ${horaDe(b.inicio)} a ${horaDe(b.fin)}: ${b.descripcion || 'sin nota'}`);
        marcar(a, 'Superpuesto'); marcar(b, 'Superpuesto');
      }
    }
    // Reuniones de una misma persona que se pisan: la misma reunión cargada más de una vez
    let grupo = [], finGrupo = 0;
    const cerrar = () => {
      if (grupo.length > 1) {
        duplicadas += grupo.length - 1; porPersona.get(id).duplicadas += grupo.length - 1; semana(grupo[0].fecha).duplicadas += grupo.length - 1;
        anotar('Reunión duplicada', grupo[0], `Figura ${grupo.length} veces: ${grupo.map(x => `${horaDe(x.inicio)}–${horaDe(x.fin)}`).join(', ')}. Dejar un solo registro`);
        grupo.forEach(x => marcar(x, 'Reunión duplicada'));
      }
      reunionesTotal += grupo.length ? 1 : 0;
    };
    for (const r of propios.filter(x => esReunionReg(x, ctx))) {
      const ini = new Date(r.inicio).getTime();
      if (grupo.length && ini >= finGrupo) { cerrar(); grupo = []; finGrupo = 0; }
      grupo.push(r); finGrupo = Math.max(finGrupo, new Date(r.fin).getTime());
    }
    cerrar();
  }

  /* --- Días sin registro, contra la disponibilidad declarada --- */
  const fechasConRegistro = new Map(personasIds.map(id => [id, new Set(regs.filter(r => r.miembro === id).map(r => r.fecha))]));
  let esperados = 0, diasSinRegistro = 0, dispMin = 0, minutosConDisp = 0;
  for (const p of porPersona.values()) {
    if (!p.dispDeclarada) continue;
    minutosConDisp += p.minutos;
    const sem = semanaDe(ctx, p.id);
    // No se le piden días de antes de sumarse al tablero
    const alta = ctx.integrantes.get(p.id)?.creadoEn ? isoDe(new Date(ctx.integrantes.get(p.id).creadoEn)) : '';
    for (let d = aFecha(`${mes}-01`); isoDe(d) <= hasta; d.setDate(d.getDate() + 1)) {
      const f = isoDe(d), declarado = minutosFranjas(sem[diaSemana(d)]);
      if (!declarado || f < alta || ausencia(ctx, p.id, f) !== null) continue;
      p.esperados++; p.dispMin += declarado;
      if (fechasConRegistro.get(p.id).has(f)) p.conRegistro++;
      else {
        p.diasSin.push(f);
        hallazgos.push({ control: 'Día sin registro', persona: p.nombre, miembro: p.id, fecha: f, cierre: finDeSemana(f), minutos: 0,
          detalle: `Declaró ${horasTexto(declarado)} disponibles (${franjasTexto(sem[diaSemana(d)])}) y no cargó horas`, nota: '', tarea: '' });
      }
    }
    esperados += p.esperados; diasSinRegistro += p.diasSin.length; dispMin += p.dispMin;
  }
  const sinDisp = [...porPersona.values()].filter(p => !p.dispDeclarada && ctx.integrantes.has(p.id));
  for (const p of sinDisp) hallazgos.push({ control: 'Sin disponibilidad declarada', persona: p.nombre, miembro: p.id, fecha: null, cierre: null, minutos: 0, detalle: 'Cargar la disponibilidad para poder contrastar sus días', nota: '', tarea: '' });

  /* --- Tareas terminadas en el mes --- */
  const terminadas = ctx.tareas.filter(t => !t.archivada && esHecha(t, ctx) && t.terminadaEn && mesClave(isoDe(new Date(t.terminadaEn))) === mes);
  const tareaHallazgo = (control, t, detalle, min) => hallazgos.push({ control, persona: (t.asignados || []).filter(a => ctx.integrantes.has(a)).map(a => nombreDe(a, ctx)).join(', ') || 'Sin responsable',
    miembro: null, fecha: isoDe(new Date(t.terminadaEn)), cierre: null, minutos: min, detalle, nota: '', tarea: `${codigo(t, ctx)} ${t.titulo}` });
  let terminadasSinHoras = 0, conEstimacion = 0, desviadas = 0;
  for (const t of terminadas) {
    const real = ctx.horasPorTarea.get(t.id) || 0;
    if (!real) { terminadasSinHoras++; tareaHallazgo('Tarea terminada sin horas', t, 'Se terminó y no tiene ninguna hora cargada', 0); continue; }
    if (Number(t.estimacion) > 0) {
      conEstimacion++;
      const est = Number(t.estimacion) * HORAS_POR_PUNTO * 60;
      if (Math.abs(real - est) / est * 100 > DESVIO_TAREA_PCT) {
        desviadas++;
        tareaHallazgo('Horas lejos de lo estimado', t, `${horasTexto(real)} cargadas contra ${horasTexto(est)} estimadas: ¿faltan o sobran horas?`, real);
      }
    }
  }

  /* --- Controles --- */
  const pctVinc = pctDe(vinculadoMin, baseMin);
  const pctNotas = pctDe(notasMal, regs.length), pctDias = pctDe(diasSinRegistro, esperados), pctClasif = pctDe(sinClasificar, regs.length);
  const pctTarde = pctDe(tardios, conFechaCarga), pctSinHoras = pctDe(terminadasSinHoras, terminadas.length), pctDesv = pctDe(desviadas, conEstimacion);
  const pctDisp = pctDe(minutosConDisp, dispMin);
  const nivel = (v, ok, atencion) => (v <= ok ? 'ok' : v <= atencion ? 'atencion' : 'mal');
  const enPct = v => `${Math.round(v)} %`;
  const hayRegs = regs.length > 0;
  const controles = [
    { id: 'vinculadas', grupo: 'sqa', nombre: 'Horas sin tarea vinculada', valor: baseMin ? enPct(pctVinc) + ' vinculadas' : '—', detalle: baseMin ? `${horasTexto(baseMin - vinculadoMin)} sin tarea, de ${horasTexto(baseMin)} sin contar reuniones` : 'No hay horas fuera de reuniones',
      meta: `≥ ${META_VINCULADAS} % vinculadas`, estado: !baseMin ? 'nd' : pctVinc >= META_VINCULADAS ? 'ok' : pctVinc >= 80 ? 'atencion' : 'mal',
      accion: 'Vincular cada registro a su tarea. Si no hay tarea para ese trabajo, crearla en el tablero.',
      criterio: 'Horas vinculadas a una tarea existente ÷ horas del mes, sin contar reuniones (etapa Reunión o trabajo del grupo Reuniones).', niveles: `Cumple ≥ ${META_VINCULADAS} %. Atención 80 % a ${META_VINCULADAS} %. No cumple < 80 %.` },
    { id: 'notas', grupo: 'sqa', nombre: 'Registros sin nota o con nota genérica', valor: `${notasMal} ${notasMal === 1 ? 'registro' : 'registros'}`, detalle: `${sinNota} sin nota y ${genericas} con nota genérica, de ${regs.length} registros`,
      meta: '0 registros', estado: !hayRegs ? 'nd' : !notasMal ? 'ok' : nivel(pctNotas, 0, 5),
      accion: 'Pedir la corrección antes del cierre de la semana del registro.',
      criterio: `Registros sin nota, o con una nota de una sola palabra, de menos de ${NOTA_MIN_LETRAS} letras, igual al nombre de su etapa o trabajo, o de la lista de notas genéricas (al pie de esta hoja).`, niveles: 'Cumple: 0. Atención ≤ 5 % de los registros. No cumple > 5 %.' },
    { id: 'dias', grupo: 'sqa', nombre: 'Días sin registro', valor: `${diasSinRegistro} ${diasSinRegistro === 1 ? 'día' : 'días'}`, detalle: esperados ? `de ${esperados} ${esperados === 1 ? 'día' : 'días'} con disponibilidad declarada` : 'Nadie tiene días con disponibilidad declarada en el período',
      meta: '0 días', estado: !esperados ? 'nd' : nivel(pctDias, 0, 10),
      accion: 'Contrastar con cada integrante: cargar lo que falta, o declarar la ausencia en Disponibilidad.',
      criterio: 'Por integrante: días desde que se sumó al tablero en que declaró franjas disponibles, no marcó ausencia y no tiene ningún registro. Se usa la disponibilidad vigente hoy; no hay historial de cambios.', niveles: 'Cumple: 0. Atención ≤ 10 % de los días esperados. No cumple > 10 %.' },
    { id: 'duplicadas', grupo: 'sqa', nombre: 'Reuniones duplicadas', valor: `${duplicadas} ${duplicadas === 1 ? 'duplicada' : 'duplicadas'}`, detalle: `en ${reunionesTotal} ${reunionesTotal === 1 ? 'reunión registrada' : 'reuniones registradas'} por participante`,
      meta: '0 duplicadas', estado: !reunionesTotal ? 'nd' : duplicadas ? 'mal' : 'ok',
      accion: 'Dejar un solo registro por participante y borrar el resto.',
      criterio: 'Registros de reunión de una misma persona que se pisan en el horario: la misma reunión figura más de una vez. Cuenta los registros que sobran.', niveles: 'Cumple: 0. No cumple: 1 o más.' },

    { id: 'superpuestos', grupo: 'extra', nombre: 'Registros superpuestos', valor: `${superpuestas} ${superpuestas === 1 ? 'caso' : 'casos'}`, detalle: 'Una misma persona con dos registros en el mismo horario',
      meta: '0 casos', estado: !hayRegs ? 'nd' : !superpuestas ? 'ok' : superpuestas <= 2 ? 'atencion' : 'mal',
      accion: 'Corregir los horarios: una persona no trabaja en dos cosas a la vez.',
      criterio: 'Pares de registros de la misma persona que se pisan en el horario, salvo los que ya son reuniones duplicadas.', niveles: 'Cumple: 0. Atención: 1 o 2. No cumple: 3 o más.' },
    { id: 'clasificar', grupo: 'extra', nombre: 'Registros sin clasificar', valor: `${sinClasificar} ${sinClasificar === 1 ? 'registro' : 'registros'}`, detalle: 'Sin etapa o sin tipo de trabajo',
      meta: '0 registros', estado: !hayRegs ? 'nd' : !sinClasificar ? 'ok' : nivel(pctClasif, 0, 5),
      accion: 'Completar la etapa y el trabajo: sin eso no entran bien a los reportes.',
      criterio: 'Registros a los que les falta la etapa, el trabajo o ambos.', niveles: 'Cumple: 0. Atención ≤ 5 % de los registros. No cumple > 5 %.' },
    { id: 'tardios', grupo: 'extra', nombre: 'Carga tardía', valor: conFechaCarga ? enPct(pctTarde) : '—', detalle: `${tardios} de ${conFechaCarga} registros se cargaron más de ${CARGA_TARDIA_HORAS} h después`,
      meta: '≤ 10 %', estado: !conFechaCarga ? 'nd' : nivel(pctTarde, 10, 25),
      accion: 'Recordar que se carga en el momento o en el día: de memoria, las horas son menos confiables.',
      criterio: `Registros guardados más de ${CARGA_TARDIA_HORAS} horas después de la hora de fin.`, niveles: 'Cumple ≤ 10 %. Atención ≤ 25 %. No cumple > 25 %.' },
    { id: 'atipicos', grupo: 'extra', nombre: 'Duración atípica', valor: `${atipicos} ${atipicos === 1 ? 'registro' : 'registros'}`, detalle: `De más de ${REGISTRO_LARGO_MIN / 60} h o de menos de ${REGISTRO_CORTO_MIN} min`,
      meta: '0 registros', estado: !hayRegs ? 'nd' : atipicos ? 'atencion' : 'ok',
      accion: 'Revisar si el cronómetro quedó prendido o si el registro se cargó mal.',
      criterio: `Registros de más de ${REGISTRO_LARGO_MIN / 60} horas o de menos de ${REGISTRO_CORTO_MIN} minutos.`, niveles: 'Cumple: 0. Atención: 1 o más.' },
    { id: 'cerradas', grupo: 'extra', nombre: 'Horas en tareas cerradas', valor: `${enCerradas} ${enCerradas === 1 ? 'registro' : 'registros'}`, detalle: 'Con fecha posterior al cierre de la tarea, o en una tarea archivada',
      meta: '0 registros', estado: !hayRegs ? 'nd' : enCerradas ? 'atencion' : 'ok',
      accion: 'Revisar si va en otra tarea, o si la tarea se cerró antes de tiempo.',
      criterio: 'Registros con fecha posterior al día en que su tarea pasó a Hecho, o vinculados a una tarea archivada.', niveles: 'Cumple: 0. Atención: 1 o más.' },
    { id: 'sinhoras', grupo: 'extra', nombre: 'Tareas terminadas sin horas', valor: `${terminadasSinHoras} ${terminadasSinHoras === 1 ? 'tarea' : 'tareas'}`, detalle: `de ${terminadas.length} ${terminadas.length === 1 ? 'terminada' : 'terminadas'} en el mes`,
      meta: '0 tareas', estado: !terminadas.length ? 'nd' : !terminadasSinHoras ? 'ok' : nivel(pctSinHoras, 0, 20),
      accion: 'Pedir a los responsables que carguen las horas: el trabajo existió y no quedó registrado.',
      criterio: 'Tareas que pasaron a Hecho en el mes y no tienen ninguna hora cargada, en ningún mes.', niveles: 'Cumple: 0. Atención ≤ 20 % de las terminadas. No cumple > 20 %.' },
    { id: 'desviadas', grupo: 'extra', nombre: 'Horas lejos de lo estimado', valor: `${desviadas} ${desviadas === 1 ? 'tarea' : 'tareas'}`, detalle: `de ${conEstimacion} ${conEstimacion === 1 ? 'terminada, estimada y con horas' : 'terminadas, estimadas y con horas'} (más de ${DESVIO_TAREA_PCT} % de diferencia)`,
      meta: '≤ 25 % de las tareas', estado: !conEstimacion ? 'nd' : nivel(pctDesv, 25, 50),
      accion: 'Revisar si faltan horas por cargar o si la estimación quedó corta.',
      criterio: `Tareas terminadas en el mes cuyas horas reales se apartan más de ${DESVIO_TAREA_PCT} % de lo estimado (1 punto = ${HORAS_POR_PUNTO} hora).`, niveles: 'Cumple ≤ 25 % de las tareas. Atención ≤ 50 %. No cumple > 50 %.' },
    { id: 'sindisp', grupo: 'extra', nombre: 'Sin disponibilidad declarada', valor: `${sinDisp.length} ${sinDisp.length === 1 ? 'integrante' : 'integrantes'}`, detalle: sinDisp.length ? sinDisp.map(p => p.nombre).join(', ') : 'Todos la declararon',
      meta: '0 integrantes', estado: !ctx.miembros.length ? 'nd' : sinDisp.length ? 'atencion' : 'ok',
      accion: 'Pedirle que la cargue: sin ella no se pueden contrastar sus días.',
      criterio: 'Integrantes sin disponibilidad cargada: sus días sin registro no se pueden contrastar.', niveles: 'Cumple: 0. Atención: 1 o más.' },

    { id: 'uso', grupo: 'info', nombre: 'Horas contra disponibilidad', valor: dispMin ? enPct(pctDisp) : '—', detalle: `${horasTexto(minutosConDisp)} registradas de ${horasTexto(dispMin)} disponibles`,
      meta: '—', estado: dispMin ? 'info' : 'nd', accion: 'Si se aleja mucho de 100 %, revisar la disponibilidad declarada.',
      criterio: 'Horas registradas por quienes declararon disponibilidad ÷ horas que declararon, descontando sus ausencias.', niveles: 'Sin meta: es una referencia.' },
    { id: 'copiadas', grupo: 'info', nombre: 'Nota igual al título de la tarea', valor: `${copiadas} ${copiadas === 1 ? 'registro' : 'registros'}`, detalle: 'Pasa al iniciar el cronómetro desde una tarea y no cambiar la nota',
      meta: '—', estado: hayRegs ? 'info' : 'nd', accion: 'Conviene sumar qué parte de la tarea se hizo.',
      criterio: 'Registros cuya nota es igual al título de su tarea. No cuentan como genéricos, porque la nota dice algo.', niveles: 'Sin meta: es una referencia.' },
    { id: 'terceros', grupo: 'info', nombre: 'Registros cargados por otra persona', valor: `${deOtro} ${deOtro === 1 ? 'registro' : 'registros'}`, detalle: 'Por ejemplo, los participantes de una reunión',
      meta: '—', estado: hayRegs ? 'info' : 'nd', accion: 'Cada integrante revisa que lo cargado a su nombre sea correcto.',
      criterio: 'Registros cuyo creador no es la persona a la que se le imputan las horas.', niveles: 'Sin meta: es una referencia.' },
    { id: 'editados', grupo: 'info', nombre: 'Registros editados después de cargarlos', valor: `${editados} ${editados === 1 ? 'registro' : 'registros'}`, detalle: 'Rastro de auditoría para SCM',
      meta: '—', estado: hayRegs ? 'info' : 'nd', accion: 'Sirve para ver cuánto se corrigió en el mes.',
      criterio: 'Registros cuya última edición es posterior a su creación.', niveles: 'Sin meta: es una referencia.' },
  ];
  const conMeta = controles.filter(c => c.grupo !== 'info' && c.estado !== 'nd');
  const orden = [...new Set(hallazgos.map(x => x.control))];
  const ordenControl = ['Horas sin tarea vinculada', 'Registro sin nota o con nota genérica', 'Día sin registro', 'Reunión duplicada'];
  const pos = c => { const i = ordenControl.indexOf(c); return i < 0 ? ordenControl.length + orden.indexOf(c) : i; };
  hallazgos.sort((a, b) => pos(a.control) - pos(b.control) || (a.fecha || '').localeCompare(b.fecha || '') || a.persona.localeCompare(b.persona, 'es'));

  return {
    mes, enCurso, hasta, regs, marcas, controles, hallazgos, total, reunionMin, baseMin, vinculadoMin, pctVinc, esperados, diasSinRegistro, dispMin,
    personas: [...porPersona.values()].filter(p => p.registros || ctx.integrantes.has(p.id)),
    semanas: [...porSemana.values()].sort((a, b) => a.lunes.localeCompare(b.lunes)),
    cumplen: conMeta.filter(c => c.estado === 'ok').length, atencion: conMeta.filter(c => c.estado === 'atencion').length, noCumplen: conMeta.filter(c => c.estado === 'mal').length, medidos: conMeta.length,
  };
}

const ESTADOS_CONTROL = {
  ok: { nombre: 'Cumple', tag: 'hecho' }, atencion: { nombre: 'Atención', tag: 'media' }, mal: { nombre: 'No cumple', tag: 'urgente' },
  info: { nombre: 'Referencia', tag: 'baja' }, nd: { nombre: 'Sin datos', tag: 'baja' },
};

/* ----- La pestaña ----- */
function ExportarHoras({ ctx }) {
  const meses = mesesDeControl(ctx);
  const [mes, setMes] = useState(meses[0]);
  const [generando, setGenerando] = useState(false);
  const elegido = meses.includes(mes) ? mes : meses[0];
  const c = calcularControlHoras(ctx, elegido);
  const descargar = async () => {
    setGenerando(true);
    try {
      const datos = await armarExcelHoras(c, ctx);
      await guardarArchivo(`control-horas-finora-${elegido}.xlsx`, datos, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    } catch (err) {
      console.error('No se pudo armar el Excel', err);
      avisar('No se pudo armar el Excel. Revisá tu conexión y probá de nuevo.', 'error');
    }
    setGenerando(false);
  };
  const fila = x => html`<tr key=${x.id} style="cursor:default">
    <td><strong>${x.nombre}</strong><br /><span class="tenue">${x.detalle}</span></td>
    <td class="mono">${x.valor}</td><td class="tenue">${x.meta}</td>
    <td><span class=${'tag ' + ESTADOS_CONTROL[x.estado].tag}>${ESTADOS_CONTROL[x.estado].nombre}</span></td>
  </tr>`;
  const tabla = (titulo, lista) => html`<h4 class="sub-titulo">${titulo}</h4>
    <div class="tabla-env"><table class="tabla tabla-desvios">
      <thead><tr><th>Control</th><th>Resultado</th><th>Meta</th><th>Estado</th></tr></thead>
      <tbody>${lista.map(fila)}</tbody>
    </table></div>`;
  return html`<div class="vista-horas-cuerpo">
    <div class="barra horas-filtros">
      <label for="xl-mes" class="etiqueta-mono">Mes</label>
      <select class="entrada" id="xl-mes" style="width:auto;height:34px;min-height:34px;padding-block:4px" value=${elegido} onChange=${e => setMes(e.target.value)}>
        ${meses.map(m => html`<option key=${m} value=${m}>${mesNombre(m)}</option>`)}
      </select>
      ${c.enCurso && html`<span class="tenue">Mes en curso: los días se miden hasta ayer.</span>`}
      ${puedeDescargar() && html`<div class="barra-fin"><button class="btn btn-primario" disabled=${generando} onClick=${descargar}><${Icono} n="descargar" t=${15} />${generando ? 'Armando el Excel…' : 'Descargar Excel'}</button></div>`}
    </div>
    <section class="panel ancho">
      <div class="seccion-cab"><h3>Control de calidad del registro</h3><span class="mono tenue">${c.hallazgos.length} ${c.hallazgos.length === 1 ? 'hallazgo' : 'hallazgos'}</span></div>
      <p class="sub">Lo que va a tener el Excel de ${mesNombre(elegido)}, para SQA y SCM: el resumen, cada integrante y la lista de lo que hay que corregir.</p>
      <div class="reu-resumen">
        <div><span class="etiqueta-mono">Horas registradas</span><strong>${horasTexto(c.total)}</strong></div>
        <div><span class="etiqueta-mono">Registros</span><strong>${c.regs.length}</strong></div>
        <div><span class="etiqueta-mono">Vinculadas a tarea</span><strong>${c.baseMin ? Math.round(c.pctVinc) + ' %' : '—'}</strong></div>
        <div><span class="etiqueta-mono">Controles que cumplen</span><strong>${c.cumplen} de ${c.medidos}</strong></div>
      </div>
      ${tabla('Controles de SQA', c.controles.filter(x => x.grupo === 'sqa'))}
      ${tabla('Controles adicionales', c.controles.filter(x => x.grupo === 'extra'))}
      ${tabla('Datos de referencia', c.controles.filter(x => x.grupo === 'info'))}
    </section>
  </div>`;
}
