
/* ===== Horas: formatos, acciones y estadísticas ===== */
const DIAS_CORTOS = ['lun', 'mar', 'mié', 'jue', 'vie', 'sáb', 'dom'];
const DIAS_LARGOS = ['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo'];
const DIAS_PLURAL = ['los lunes', 'los martes', 'los miércoles', 'los jueves', 'los viernes', 'los sábados', 'los domingos'];
const FRANJAS = Array.from({ length: 12 }, (_, i) => i * 2);
const diaSemana = d => (d.getDay() + 6) % 7; // 0 = lunes
const diaSemanaISO = iso => diaSemana(aFecha(iso));

function duracionTexto(min) {
  const m = Math.max(0, Math.round(min || 0)), h = Math.floor(m / 60), r = m % 60;
  if (!h) return `${r} min`;
  return r ? `${h} h ${r} min` : `${h} h`;
}
const duracionReloj = min => { const m = Math.max(0, Math.round(min || 0)); return `${Math.floor(m / 60)}:${pad(m % 60)}`; };
const horasNum = (min, dec = 1) => (min / 60).toLocaleString('es-UY', { maximumFractionDigits: dec });
const horasTexto = (min, dec = 1) => `${horasNum(min, dec)} h`;
const cronoTexto = ms => { const s = Math.max(0, Math.floor(ms / 1000)); return `${Math.floor(s / 3600)}:${pad(Math.floor(s / 60) % 60)}:${pad(s % 60)}`; };
const horaDe = iso => { const d = new Date(iso); return `${pad(d.getHours())}:${pad(d.getMinutes())}`; };
const mesClave = fecha => fecha.slice(0, 7);
const mesNombre = clave => { const [y, m] = clave.split('-').map(Number); return `${mayus(MESES[m - 1])} ${y}`; };
const mesCorto = clave => { const [y, m] = clave.split('-').map(Number); return `${MESES_CORTOS[m - 1]} ${String(y).slice(2)}`; };
const lunesISO = fecha => { const d = aFecha(fecha); d.setDate(d.getDate() - diaSemana(d)); return isoDe(d); };
const pct = (a, b) => (b ? Math.round(a / b * 100) : 0);

// Fecha + horas de un formulario → inicio y fin. Si la hora de fin es menor, termina al día siguiente.
function armarInicioFin(fecha, desde, hasta) {
  if (!fecha || !desde || !hasta) return null;
  const ini = new Date(`${fecha}T${desde}`);
  let fin = new Date(`${fecha}T${hasta}`);
  if (isNaN(ini) || isNaN(fin)) return null;
  const cruza = fin <= ini;
  if (cruza) fin = new Date(fin.getTime() + 864e5);
  const minutos = Math.round((fin - ini) / 60000);
  // Cruzar la medianoche vale para una sesión nocturna, no para un error de tipeo de 20 horas
  if (cruza && minutos > 12 * 60) return null;
  return { inicio: ini.toISOString(), fin: fin.toISOString(), cruza, minutos };
}
const errorHorario = (f) => (f.desde && f.hasta && !armarInicioFin(f.fecha, f.desde, f.hasta) ? 'La hora de fin tiene que ser después del inicio.' : '');
function useReloj(activo) {
  const [, setTic] = useState(0);
  useEffect(() => {
    if (!activo) return;
    const id = setInterval(() => setTic(n => n + 1), 1000);
    return () => clearInterval(id);
  }, [activo]);
}

/* ----- Acciones ----- */
function armarRegistro(r) {
  const ini = new Date(r.inicio), fin = new Date(r.fin);
  return {
    miembro: r.miembro, inicio: ini.toISOString(), fin: fin.toISOString(),
    minutos: Math.max(0, Math.round((fin - ini) / 60000)), fecha: isoDe(ini),
    etapa: r.etapa || null, trabajo: r.trabajo || null, tarea: r.tarea || null,
    descripcion: (r.descripcion || '').trim(),
  };
}
function validarRegistro(r) {
  const ini = new Date(r.inicio), fin = new Date(r.fin);
  if (isNaN(ini) || isNaN(fin)) return 'Completá la fecha y los horarios.';
  if (fin <= ini) return 'La hora de fin tiene que ser después del inicio.';
  if (fin - ini > 24 * 3600e3) return 'Un registro no puede durar más de 24 horas. Partilo en dos.';
  return null;
}
function superposiciones(r, excepto) {
  const ini = new Date(r.inicio), fin = new Date(r.fin);
  let n = 0;
  for (const [id, x] of estado.horas) {
    if (id === excepto || x.miembro !== r.miembro) continue;
    if (new Date(x.inicio) < fin && new Date(x.fin) > ini) n++;
  }
  return n;
}

const accionesHoras = {
  async iniciar(datos = {}) {
    const yoId = yo();
    if (!yoId) { avisar('Sumate al tablero (menú de tu perfil) para cargar horas.', 'error'); return false; }
    if (estado.cronometros.has(yoId)) await accionesHoras.detener();
    return conManejo(backend.crear('cronometros/' + yoId, {
      inicio: ahoraISO(), descripcion: (datos.descripcion || '').trim(), etapa: datos.etapa || null,
      trabajo: datos.trabajo || null, tarea: datos.tarea || null, userId: estado.userId || null,
    }));
  },
  editarCronometro(cambios) {
    const yoId = yo();
    if (!yoId || !estado.cronometros.has(yoId)) return Promise.resolve(false);
    return conManejo(backend.actualizar('cronometros/' + yoId, cambios));
  },
  async detener() {
    const yoId = yo();
    const c = yoId && estado.cronometros.get(yoId);
    if (!c) return false;
    const fin = new Date();
    const minutos = Math.round((fin - new Date(c.inicio)) / 60000);
    const ok = await conManejo(backend.borrar('cronometros/' + yoId));
    if (!ok) return false;
    if (minutos < 1) { avisar('El cronómetro corrió menos de un minuto, así que no se guardó.'); return true; }
    const largo = fin - new Date(c.inicio) > 24 * 3600e3;
    const r = { ...c, miembro: yoId, fin: (largo ? new Date(new Date(c.inicio).getTime() + 24 * 3600e3) : fin).toISOString() };
    const guardado = await accionesHoras.crear(r, { silencioso: true });
    if (guardado) {
      if (minutos > 12 * 60) avisar(`Guardaste ${duracionTexto(Math.min(minutos, 1440))}. Si el cronómetro quedó prendido sin querer, editá el registro.`, 'error');
      else avisar(`Guardaste ${duracionTexto(minutos)}.`);
    }
    return guardado;
  },
  async descartar() {
    const yoId = yo();
    if (!yoId || !estado.cronometros.has(yoId)) return false;
    const ok = await conManejo(backend.borrar('cronometros/' + yoId));
    if (ok) avisar('Descartaste el cronómetro. No se guardó nada.');
    return ok;
  },
  async crear(r, { silencioso = false } = {}) {
    const error = validarRegistro(r);
    if (error) { avisar(error, 'error'); return false; }
    const doc = { ...armarRegistro(r), creadoPor: yo(), creadoEn: ahoraISO(), actualizadoEn: ahoraISO() };
    const ok = await conManejo(backend.crear('horas/' + backend.nuevoId('horas'), doc));
    if (ok && !silencioso) {
      const n = superposiciones(doc);
      avisar(n > 1 ? `Guardaste ${duracionTexto(doc.minutos)}. Ojo: se superpone con otro registro tuyo.` : `Guardaste ${duracionTexto(doc.minutos)}.`);
    }
    return ok;
  },
  async editar(id, r) {
    const error = validarRegistro(r);
    if (error) { avisar(error, 'error'); return false; }
    const ok = await conManejo(backend.actualizar('horas/' + id, { ...armarRegistro(r), actualizadoEn: ahoraISO() }));
    if (ok) avisar('Guardaste los cambios.');
    return ok;
  },
  async borrar(id) {
    const ok = await conManejo(backend.borrar('horas/' + id));
    if (ok) avisar('Borraste el registro.');
    return ok;
  },
  continuar(r) { return accionesHoras.iniciar({ descripcion: r.descripcion, etapa: r.etapa, trabajo: r.trabajo, tarea: r.tarea }); },
};

/* ----- Filtros de período ----- */
const PERIODOS = [
  { id: 'semana', nombre: 'Esta semana' }, { id: 'mes', nombre: 'Este mes' }, { id: '30', nombre: 'Últimos 30 días' },
  { id: '90', nombre: 'Últimos 90 días' }, { id: 'anio', nombre: 'Este año' }, { id: 'todo', nombre: 'Todo' }, { id: 'rango', nombre: 'Fechas a medida' },
];
function rangoDe(periodo, desde, hasta) {
  const hoy = hoyISO(), d = aFecha(hoy);
  const menos = n => { const x = aFecha(hoy); x.setDate(x.getDate() - n); return isoDe(x); };
  switch (periodo) {
    case 'semana': return { desde: lunesISO(hoy), hasta: hoy };
    case 'mes': return { desde: `${hoy.slice(0, 7)}-01`, hasta: hoy };
    case '30': return { desde: menos(29), hasta: hoy };
    case '90': return { desde: menos(89), hasta: hoy };
    case 'anio': return { desde: `${d.getFullYear()}-01-01`, hasta: hoy };
    case 'rango': return { desde: desde || null, hasta: hasta || null };
    default: return { desde: null, hasta: null };
  }
}
function filtrarHoras(registros, f) {
  return registros.filter(r =>
    (!f.desde || r.fecha >= f.desde) && (!f.hasta || r.fecha <= f.hasta) &&
    (!f.personas || !f.personas.length || f.personas.includes(r.miembro)) &&
    (!f.etapas || !f.etapas.length || f.etapas.includes(r.etapa || 'sin')) &&
    (!f.trabajos || !f.trabajos.length || f.trabajos.includes(r.trabajo || 'sin')));
}

/* ----- Estadísticas ----- */
function sumar(mapa, clave, v) { mapa.set(clave, (mapa.get(clave) || 0) + v); }
// Reparte los minutos de un registro en las horas del día en que cayeron (para "cuándo se trabaja")
function repartirPorHora(r, matriz) {
  let t = new Date(r.inicio).getTime();
  const fin = new Date(r.fin).getTime();
  while (t < fin) {
    const d = new Date(t);
    const corte = new Date(d.getFullYear(), d.getMonth(), d.getDate(), d.getHours() + 1).getTime();
    const hasta = Math.min(corte, fin);
    matriz[diaSemana(d)][Math.floor(d.getHours() / 2)] += (hasta - t) / 60000;
    t = hasta;
  }
}
function calcularEstadisticas(registros) {
  const est = {
    total: 0, sesiones: registros.length, dias: new Map(), porMiembro: new Map(), porDiaSemana: Array(7).fill(0),
    porMes: new Map(), porSemana: new Map(), porEtapa: new Map(), porTrabajo: new Map(), porTarea: new Map(),
    franjas: Array.from({ length: 7 }, () => Array(12).fill(0)), conTarea: 0,
  };
  for (const r of registros) {
    const m = r.minutos || 0;
    est.total += m;
    sumar(est.dias, r.fecha, m);
    const ds = diaSemanaISO(r.fecha);
    est.porDiaSemana[ds] += m;
    if (!est.porMiembro.has(r.miembro)) est.porMiembro.set(r.miembro, { total: 0, porDia: Array(7).fill(0), porEtapa: new Map(), dias: new Set(), porMes: new Map(), porSemana: new Map() });
    const pm = est.porMiembro.get(r.miembro);
    pm.total += m; pm.porDia[ds] += m; pm.dias.add(r.fecha);
    sumar(pm.porEtapa, r.etapa || 'sin', m);
    sumar(pm.porMes, mesClave(r.fecha), m);
    sumar(pm.porSemana, lunesISO(r.fecha), m);
    sumar(est.porMes, mesClave(r.fecha), m);
    sumar(est.porSemana, lunesISO(r.fecha), m);
    sumar(est.porEtapa, r.etapa || 'sin', m);
    sumar(est.porTrabajo, r.trabajo || 'sin', m);
    if (r.tarea) { sumar(est.porTarea, r.tarea, m); est.conTarea += m; }
    repartirPorHora(r, est.franjas);
  }
  // Rachas de días seguidos con horas cargadas
  const fechas = [...est.dias.keys()].sort();
  let mejor = 0, actual = 0, previa = null;
  for (const f of fechas) {
    actual = previa && diasEntre(previa, f) === 1 ? actual + 1 : 1;
    mejor = Math.max(mejor, actual);
    previa = f;
  }
  est.rachaMax = mejor;
  return est;
}
const maxIndice = arr => arr.reduce((mi, v, i) => (v > arr[mi] ? i : mi), 0);
const maxEntrada = mapa => [...mapa].reduce((a, b) => (!a || b[1] > a[1] ? b : a), null);

// Frases con lo que dicen los datos, en la voz de Finora: concreto, con día y número.
function hallazgos(est, ctx) {
  const lista = [];
  if (!est.total) return lista;
  const ds = maxIndice(est.porDiaSemana);
  lista.push({ id: 'dia', texto: html`El <strong>${DIAS_LARGOS[ds]}</strong> es el día en que más se trabaja: <strong>${pct(est.porDiaSemana[ds], est.total)} %</strong> de las horas.` });
  if (est.porMes.size > 1) {
    const [mes, min] = maxEntrada(est.porMes);
    lista.push({ id: 'mes', texto: html`<strong>${mesNombre(mes)}</strong> fue el mes con más horas: <strong>${horasTexto(min)}</strong>.` });
  }
  const personas = [...est.porMiembro].filter(([, pm]) => pm.total >= 60).map(([id, pm]) => ({ id, pm, nombre: nombreDe(id, ctx) }));
  if (personas.length) {
    lista.push({ id: 'personas', texto: html`El día en que más trabaja cada uno: ${personas.map((p, i) => html`${i ? '; ' : ''}<strong>${p.nombre}</strong>, ${DIAS_PLURAL[maxIndice(p.pm.porDia)]}`)}.` });
  }
  const etapa = maxEntrada(est.porEtapa);
  if (etapa && etapa[0] !== 'sin') {
    const nombre = ctx.etapasPorId.get(etapa[0])?.nombre || 'otra etapa';
    lista.push({ id: 'etapa', texto: html`La etapa con más horas es <strong>${nombre}</strong>: <strong>${pct(etapa[1], est.total)} %</strong> del total.` });
  }
  // Ventana de 4 horas con más trabajo, en cualquier día
  const porFranja = FRANJAS.map((_, j) => est.franjas.reduce((a, fila) => a + fila[j], 0));
  let mejorJ = 0;
  for (let j = 0; j < 12; j++) if (porFranja[j] + porFranja[(j + 1) % 12] > porFranja[mejorJ] + porFranja[(mejorJ + 1) % 12]) mejorJ = j;
  const ventana = porFranja[mejorJ] + porFranja[(mejorJ + 1) % 12];
  lista.push({ id: 'franja', texto: html`La franja más activa es de <strong>${pad(mejorJ * 2)} a ${pad((mejorJ * 2 + 4) % 24 || 24)} h</strong>: ahí cae el <strong>${pct(ventana, est.total)} %</strong> de las horas.` });
  if (personas.length > 1) {
    const constante = personas.reduce((a, b) => (b.pm.dias.size > a.pm.dias.size ? b : a));
    lista.push({ id: 'constancia', texto: html`<strong>${constante.nombre}</strong> es quien carga horas más días: <strong>${constante.pm.dias.size}</strong> de <strong>${est.dias.size}</strong> días con trabajo.` });
  }
  if (est.rachaMax > 2) lista.push({ id: 'racha', texto: html`La racha más larga fue de <strong>${est.rachaMax} días seguidos</strong> con horas cargadas.` });
  return lista.slice(0, 6);
}

function horasCSV(registros, ctx) {
  const esc = v => { const s = v == null ? '' : String(v); return /[";\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
  const filas = [['Fecha', 'Persona', 'Desde', 'Hasta', 'Horas', 'Etapa', 'Trabajo', 'Tarea', 'Descripción']];
  for (const r of [...registros].sort((a, b) => (a.inicio < b.inicio ? -1 : 1))) {
    const t = r.tarea && ctx.porId.get(r.tarea);
    filas.push([
      fechaNum(r.fecha), nombreDe(r.miembro, ctx), horaDe(r.inicio), horaDe(r.fin), horasNum(r.minutos || 0, 2),
      ctx.etapasPorId.get(r.etapa)?.nombre || '', ctx.trabajosPorId.get(r.trabajo)?.nombre || '',
      t ? `${codigo(t, ctx)} ${t.titulo}` : '', r.descripcion || '',
    ]);
  }
  return '﻿' + filas.map(f => f.map(esc).join(';')).join('\r\n');
}
