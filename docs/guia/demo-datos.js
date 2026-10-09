// Datos de ejemplo SOLO para las capturas de la guía (modo local, no toca la base real).
(function () {
  const dia = n => { const d = new Date(); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); };
  const hace = h => new Date(Date.now() - h * 3600e3).toISOString();
  const integrantes = {
    emi: { nombre: 'Emi', rol: 'Gerente de proyecto', color: 'azul', userId: null },
    sofi: { nombre: 'Sofi', rol: 'Ingeniería de requerimientos', color: 'magenta', userId: null },
    juan: { nombre: 'Juan', rol: 'SQA', color: 'verde', userId: null },
    caro: { nombre: 'Caro', rol: 'IA', color: 'violeta', userId: null },
  };
  const base = (n, o) => ({
    numero: n, descripcion: '', tipo: 'tarea', asignados: [], etiquetas: [], prioridad: 'media', vence: null, estimacion: null,
    hito: null, subtareas: [], criterios: [], enlaces: [], dependeDe: [], bloqueada: false, motivoBloqueo: '',
    creadaPor: 'emi', creadaEn: hace(200 - n * 10), actualizadaEn: hace(3), entroEnColumna: hace(20), terminadaEn: null, archivada: false,
    historial: [{ en: hace(200 - n * 10), quien: 'emi', que: 'creó la tarea' }], ...o,
  });
  const ck = (t, h) => ({ id: Math.random().toString(36).slice(2, 9), texto: t, hecho: h });
  const tareas = {
    t1: base(1, { titulo: 'Exportar los vectores del logo', columna: 'hecho', orden: 1024, asignados: ['sofi'], etiquetas: ['diseno'], terminadaEn: hace(30), estimacion: 2 }),
    t2: base(2, { titulo: 'Resumir la encuesta a pymes', tipo: 'inv', columna: 'hecho', orden: 2048, asignados: ['emi'], etiquetas: ['investigacion'], terminadaEn: hace(60), estimacion: 3 }),
    t3: base(3, { titulo: 'Conectar la planilla de ejemplo y leer los movimientos', tipo: 'rf', columna: 'en-curso', orden: 1024, asignados: ['juan', 'emi'], etiquetas: ['datos'], prioridad: 'alta', vence: dia(3), estimacion: 5, hito: 'h1',
      criterios: [ck('Lee fecha, concepto y monto de cada fila', true), ck('Avisa si falta una columna', false), ck('Soporta $U y US$', false)] }),
    t4: base(4, { titulo: 'Proyección de caja a 30, 60 y 90 días', tipo: 'rf', columna: 'en-curso', orden: 2048, asignados: ['caro'], etiquetas: ['ia'], prioridad: 'urgente', vence: dia(1), estimacion: 8, hito: 'h1',
      subtareas: [ck('Modelo base con cobros a 38 días', true), ck('Rango de confianza', false)] }),
    t5: base(5, { titulo: 'Alerta de caja con fecha y monto', tipo: 'rf', columna: 'por-hacer', orden: 1024, asignados: ['caro'], etiquetas: ['ia', 'producto'], estimacion: 5, dependeDe: ['t4'] }),
    t6: base(6, { titulo: 'Plantilla del informe mensual', columna: 'por-hacer', orden: 2048, asignados: ['sofi'], etiquetas: ['diseno'], vence: dia(9), estimacion: 3 }),
    t7: base(7, { titulo: 'Que el contador valide antes de aprobar un informe', tipo: 'rnf', columna: 'ideas', orden: 1024, etiquetas: ['producto'] }),
    t8: base(8, { titulo: 'Verificar el nombre en la DNPI', columna: 'ideas', orden: 2048, etiquetas: ['ort'], prioridad: 'baja' }),
    t9: base(9, { titulo: 'Capítulo de requerimientos del anteproyecto', tipo: 'doc', columna: 'revision', orden: 1024, asignados: ['emi'], etiquetas: ['ort'], vence: dia(5), estimacion: 3, hito: 'h1' }),
  };
  const comentarios = {
    c1: { tareaId: 't3', autor: 'juan', texto: 'Ya lee la planilla de prueba. Me falta el aviso cuando viene una columna vacía.', en: hace(5) },
    c2: { tareaId: 't3', autor: 'emi', texto: 'Genial. Te dejo el archivo con los movimientos de agosto en los enlaces.', en: hace(4) },
    c3: { tareaId: 't4', autor: 'caro', texto: 'Mañana subo la primera versión del modelo.', en: hace(2) },
  };
  const hitos = { h1: { nombre: 'Entrega 1 · Anteproyecto', tipo: 'entrega', inicio: null, fin: dia(20), objetivo: 'Requerimientos, arquitectura y primer prototipo de la proyección.' } };
  // Horas de ejemplo: ~100 días con hábitos distintos por persona (generador fijo, siempre da lo mismo)
  let semilla = 7;
  const azar = () => (semilla = (semilla * 16807) % 2147483647) / 2147483647;
  const elegir = l => l[Math.floor(azar() * l.length)];
  const isoLocal = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const perfiles = {
    emi: { dias: [0.8, 0.95, 0.6, 0.7, 0.5, 0.2, 0.3], hora: 19, etapas: ['investigacion', 'requerimientos', 'documentacion'] },
    sofi: { dias: [0.6, 0.5, 0.9, 0.6, 0.7, 0.3, 0.1], hora: 10, etapas: ['diseno', 'presentacion', 'requerimientos'] },
    juan: { dias: [0.8, 0.8, 0.7, 0.9, 0.4, 0.1, 0.2], hora: 15, etapas: ['desarrollo', 'pruebas'] },
    caro: { dias: [0.3, 0.4, 0.5, 0.4, 0.3, 0.6, 0.9], hora: 21, etapas: ['desarrollo', 'investigacion'] },
  };
  const trabajosPor = { investigacion: ['investigacion', 'reunion-cliente'], requerimientos: ['redaccion', 'reunion-interna'], diseno: ['diseno-ui', 'reunion-tutor'],
    desarrollo: ['programacion', 'programacion', 'testing'], pruebas: ['testing'], documentacion: ['redaccion'], presentacion: ['redaccion', 'gestion'] };
  const textos = {
    investigacion: ['Leer sobre modelos de proyección de caja', 'Entrevista con la dueña de una pyme', 'Comparar Odoo con planillas'],
    requerimientos: ['Escribir los RF de la alerta de caja', 'Revisar criterios de aceptación', 'Reunión de requerimientos'],
    diseno: ['Pantalla del panel del dueño', 'Componentes del informe mensual', 'Prototipo de la alerta'],
    desarrollo: ['Lectura de la planilla de movimientos', 'Modelo de proyección a 90 días', 'API de cobranzas'],
    pruebas: ['Pruebas con datos de agosto', 'Casos borde de montos en US$'],
    documentacion: ['Capítulo de requerimientos', 'Arquitectura para el anteproyecto'],
    presentacion: ['Armar la presentación al comité', 'Ensayo de la defensa'],
  };
  const horas = {};
  for (let d = 100; d >= 0; d--) {
    const fecha = new Date(); fecha.setHours(0, 0, 0, 0); fecha.setDate(fecha.getDate() - d);
    const ds = (fecha.getDay() + 6) % 7;
    for (const [id, p] of Object.entries(perfiles)) {
      if (azar() > p.dias[ds] * (0.55 + 0.45 * (1 - d / 100))) continue;
      let hora = p.hora + Math.floor(azar() * 3) - 1;
      const sesiones = azar() < 0.35 ? 2 : 1;
      for (let s = 0; s < sesiones; s++) {
        const dur = 30 + Math.floor(azar() * 6) * 20;
        const ini = new Date(fecha); ini.setHours(hora, elegir([0, 15, 30, 45]));
        const fin = new Date(ini.getTime() + dur * 60000);
        if (fin > new Date()) break;
        const etapa = elegir(p.etapas);
        const tarea = etapa === 'desarrollo' && azar() < 0.6 ? elegir(['t3', 't4']) : etapa === 'documentacion' ? 't9' : etapa === 'diseno' && azar() < 0.5 ? 't6' : null;
        horas[`h-${id}-${d}-${s}`] = { miembro: id, inicio: ini.toISOString(), fin: fin.toISOString(), minutos: dur, fecha: isoLocal(ini),
          etapa, trabajo: elegir(trabajosPor[etapa]), tarea, descripcion: elegir(textos[etapa]), creadoPor: id, creadoEn: fin.toISOString(), actualizadoEn: fin.toISOString() };
        hora = fin.getHours() + 1;
      }
    }
  }
  horas['h-viejo'] = { miembro: 'emi', inicio: new Date(Date.now() - 5 * 864e5).toISOString(), fin: new Date(Date.now() - 5 * 864e5 + 3600e3).toISOString(), minutos: 60, fecha: isoLocal(new Date(Date.now() - 5 * 864e5)), etapa: 'requerimientos', trabajo: 'reunion', tarea: null, descripcion: 'Reunión de antes del cambio', creadoPor: 'emi', creadoEn: new Date().toISOString(), actualizadoEn: new Date().toISOString() };
  const cronometros = { emi: { inicio: hace(0.7), descripcion: 'Ordenar los requerimientos de la alerta de caja', etapa: 'requerimientos', trabajo: 'redaccion', tarea: 't5', userId: null } };
  const fr = (desde, hasta) => ({ desde, hasta });
  const disponibilidad = {
    emi: { semana: { 0: [fr('19:00', '22:00')], 1: [fr('18:30', '22:30')], 2: [fr('20:00', '22:00')], 3: [fr('19:00', '23:00')], 4: [fr('18:00', '20:00')] } },
    sofi: { semana: { 0: [fr('09:00', '12:00')], 1: [fr('09:00', '11:00'), fr('19:00', '21:00')], 2: [fr('09:00', '13:00')], 3: [fr('19:00', '21:00')], 4: [fr('10:00', '12:00')] } },
    juan: { semana: { 0: [fr('14:00', '18:00')], 1: [fr('15:00', '21:00')], 2: [fr('14:00', '18:00')], 3: [fr('15:00', '21:00')], 4: [] } },
    caro: { semana: { 1: [fr('20:00', '23:00')], 3: [fr('19:00', '23:00')], 4: [fr('21:00', '23:30')] } },
  };
  // Días hábiles a partir de hoy (n = 0 es el próximo hábil)
  const habil = n => { const d = new Date(); d.setHours(0, 0, 0, 0); let k = -1; while (true) { if (d.getDay() % 6 !== 0 && ++k === n) return isoLocal(d); d.setDate(d.getDate() + 1); } };
  const ausencias = {
    juan: { dias: { [habil(1)]: 'parcial de Cálculo' } },
    sofi: { dias: { [habil(4)]: 'viaje', [habil(5)]: 'viaje', [habil(6)]: 'viaje' } },
    caro: { dias: { [habil(9)]: 'trabajo' } },
  };
  const fechas = {
    f1: { titulo: 'Reunión con el tutor', fecha: dia(5), hora: '18:30', tipo: 'tutor', nota: 'Llevar el avance de los requerimientos.' },
    f2: { titulo: 'Entrega del anteproyecto', fecha: dia(20), hora: '23:59', tipo: 'entrega', nota: 'Se sube a Gestión.' },
  };
  const datos = { integrantes, tareas, comentarios, hitos, horas, cronometros, disponibilidad, ausencias, fechas };
  localStorage.setItem('finora-tablero-local-v1', JSON.stringify(datos));
  localStorage.setItem('finora-yo', 'emi');
  localStorage.setItem('finora-vista', 'tablero');
  localStorage.setItem('finora-filtros', '{}');
})();
