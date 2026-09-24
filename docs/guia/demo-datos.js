// Datos de ejemplo SOLO para las capturas de la guía (modo local, no toca la base real).
(function () {
  const dia = n => { const d = new Date(); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); };
  const hace = h => new Date(Date.now() - h * 3600e3).toISOString();
  const integrantes = {
    emi: { nombre: 'Emi', rol: 'Datos', color: 'azul', userId: null },
    sofi: { nombre: 'Sofi', rol: 'Diseño', color: 'magenta', userId: null },
    juan: { nombre: 'Juan', rol: 'Desarrollo', color: 'verde', userId: null },
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
    t1: base(1, { titulo: 'Elegir el logo entre Llena y Dúo', columna: 'hecho', orden: 1024, asignados: ['sofi'], etiquetas: ['diseno'], terminadaEn: hace(30), estimacion: 2 }),
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
  const datos = { integrantes, tareas, comentarios, hitos };
  localStorage.setItem('finora-tablero-local-v1', JSON.stringify(datos));
  localStorage.setItem('finora-yo', 'emi');
  localStorage.setItem('finora-vista', 'tablero');
  localStorage.setItem('finora-filtros', '{}');
})();
