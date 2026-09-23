
/* ===== Escrituras con manejo de errores ===== */
async function conManejo(promesa) {
  try { await promesa; return true; }
  catch (e) {
    const code = e && e.code;
    console.error('Error al guardar', e);
    if (code === 'invalid_argument' && estado.modo === 'nube' && estado.puedeEscribir !== true) {
      estado.puedeEscribir = false; notificar();
      avisar('No tenés permiso para editar este tablero. Pedile a quien lo creó que te invite con permiso de edición.', 'error');
    } else if (code === 'quota_exceeded') {
      avisar('El tablero llegó al máximo de documentos. Borrá tareas o comentarios viejos para seguir.', 'error');
    } else if (code === 'revoked' || code === 'not_granted') {
      estado.errorConexion = true; notificar();
    } else {
      avisar('No se pudo guardar el cambio. Revisá tu conexión y probá de nuevo.', 'error');
    }
    return false;
  }
}
const yo = () => resolverYo(estado);
const esFinal = colId => { const cfg = estado.config || CONFIG_BASE; const f = cfg.columnas.find(c => c.final) || cfg.columnas[cfg.columnas.length - 1]; return f && f.id === colId; };
const nombreColumna = colId => { const cfg = estado.config || CONFIG_BASE; const c = cfg.columnas.find(x => x.id === colId); return c ? c.nombre : 'otra columna'; };
const nombreMiembro = id => { const m = estado.integrantes.get(id); return m ? m.nombre : 'alguien'; };
const tareaPorId = id => { const t = estado.tareas.get(id); return t ? { ...t, id } : null; };
function tareasDeColumna(colId, excepto) {
  const l = [];
  for (const [id, t] of estado.tareas) if (t.columna === colId && !t.archivada && id !== excepto) l.push({ ...t, id });
  return ordenar(l);
}

const acciones = {
  async crearTarea(c) {
    const cfg = estado.config || CONFIG_BASE;
    const id = backend.nuevoId('tareas');
    let maxNum = 0;
    for (const t of estado.tareas.values()) if (t.numero > maxNum) maxNum = t.numero;
    let numero = maxNum + 1;
    try { numero = await backend.siguienteNumero(maxNum); } catch (_) {}
    const columna = c.columna && cfg.columnas.some(x => x.id === c.columna) ? c.columna : (cfg.columnas[1] || cfg.columnas[0]).id;
    const enCol = tareasDeColumna(columna);
    const orden = enCol.length ? enCol[enCol.length - 1].orden + 1024 : 1024;
    const ahora = ahoraISO();
    const t = {
      numero, titulo: c.titulo.trim(), descripcion: c.descripcion || '', tipo: c.tipo || 'tarea', columna, orden,
      asignados: c.asignados || [], etiquetas: c.etiquetas || [], prioridad: c.prioridad || 'media',
      vence: c.vence || null, estimacion: c.estimacion != null && c.estimacion !== '' ? Number(c.estimacion) : null, hito: c.hito || null,
      subtareas: c.subtareas || [], criterios: c.criterios || [], enlaces: c.enlaces || [], dependeDe: [],
      bloqueada: false, motivoBloqueo: '', creadaPor: yo(), creadaEn: ahora, actualizadaEn: ahora, entroEnColumna: ahora,
      terminadaEn: esFinal(columna) ? ahora : null, archivada: false,
      historial: [{ en: ahora, quien: yo(), que: c.que || 'creó la tarea' }],
    };
    const ok = await conManejo(backend.crear('tareas/' + id, t));
    return ok ? { id, numero } : null;
  },
  actualizarTarea(id, cambios, que) {
    const t = estado.tareas.get(id);
    if (!t) return Promise.resolve(false);
    const ahora = ahoraISO();
    const data = { ...cambios, actualizadaEn: ahora };
    if (que) data.historial = [...(t.historial || []), { en: ahora, quien: yo(), que }].slice(-40);
    return conManejo(backend.actualizar('tareas/' + id, data));
  },
  moverTarea(id, colId, orden, extra = {}) {
    const t = estado.tareas.get(id);
    if (!t) return Promise.resolve(false);
    const cambios = { orden, ...extra };
    let que = extra.__que || null;
    delete cambios.__que;
    if (colId && colId !== t.columna) {
      const ahora = ahoraISO();
      cambios.columna = colId; cambios.entroEnColumna = ahora; cambios.terminadaEn = esFinal(colId) ? ahora : null;
      que = `la movió a ${nombreColumna(colId)}`;
      const cfg = estado.config || CONFIG_BASE;
      const col = cfg.columnas.find(c => c.id === colId);
      const n = tareasDeColumna(colId, id).length + 1;
      if (col && col.limiteWip && n > col.limiteWip) avisar(`${col.nombre} pasó su límite: ${n} de ${col.limiteWip} tareas.`, 'info');
    }
    return acciones.actualizarTarea(id, cambios, que);
  },
  // Deja la tarea al final de una columna
  moverAlFinal(id, colId) {
    const l = tareasDeColumna(colId, id);
    return acciones.moverTarea(id, colId, l.length ? l[l.length - 1].orden + 1024 : 1024);
  },
  async renumerar(colId, idsEnOrden) {
    for (let i = 0; i < idsEnOrden.length; i++) await backend.actualizar('tareas/' + idsEnOrden[i], { orden: (i + 1) * 1024 }).catch(() => {});
  },
  async duplicar(id) {
    const t = tareaPorId(id);
    if (!t) return null;
    const r = await acciones.crearTarea({
      ...t, titulo: t.titulo + ' (copia)', que: `la duplicó de ${estado.config?.prefijo || 'FIN'}-${t.numero}`,
      subtareas: (t.subtareas || []).map(x => ({ ...x, hecho: false })), criterios: (t.criterios || []).map(x => ({ ...x, hecho: false })),
    });
    if (r) avisar(`Creaste la copia ${(estado.config || CONFIG_BASE).prefijo}-${r.numero}.`);
    return r;
  },
  archivar(id, archivar) { return acciones.actualizarTarea(id, { archivada: archivar }, archivar ? 'la archivó' : 'la sacó del archivo'); },
  async eliminarTarea(id) {
    const ok = await conManejo(backend.borrar('tareas/' + id));
    if (!ok) return false;
    for (const [cid, c] of estado.comentarios) if (c.tareaId === id) await backend.borrar('comentarios/' + cid).catch(() => {});
    return true;
  },
  comentar(tareaId, texto) {
    const id = backend.nuevoId('comentarios');
    return conManejo(backend.crear('comentarios/' + id, { tareaId, autor: yo(), texto, en: ahoraISO() }));
  },
  borrarComentario(id) { return conManejo(backend.borrar('comentarios/' + id)); },
  guardarConfig(cfg) { return conManejo(backend.crear('tablero/config', cfg)); },
  async guardarIntegrante(id, datos) {
    if (id) return (await conManejo(backend.actualizar('integrantes/' + id, datos))) ? id : null;
    const nid = backend.nuevoId('integrantes');
    const ok = await conManejo(backend.crear('integrantes/' + nid, { userId: null, ...datos, creadoEn: ahoraISO() }));
    return ok ? nid : null;
  },
  async borrarIntegrante(id) {
    const ok = await conManejo(backend.borrar('integrantes/' + id));
    if (!ok) return false;
    for (const [tid, t] of estado.tareas) {
      if ((t.asignados || []).includes(id)) await backend.actualizar('tareas/' + tid, { asignados: t.asignados.filter(x => x !== id) }).catch(() => {});
    }
    if (estado.yoId === id) { estado.yoId = null; guardar('finora-yo', ''); }
    return true;
  },
  async sumarme(datos) {
    const id = await acciones.guardarIntegrante(null, { ...datos, userId: estado.userId || null });
    if (id) { estado.yoId = id; guardar('finora-yo', id); notificar(); avisar(`¡Listo, ${datos.nombre}! Ya sos parte del tablero.`); }
    return id;
  },
  async soyYo(id) {
    estado.yoId = id; guardar('finora-yo', id);
    const m = estado.integrantes.get(id);
    if (estado.userId && m && !m.userId) await conManejo(backend.actualizar('integrantes/' + id, { userId: estado.userId }));
    notificar();
  },
  async dejarDeSerYo() {
    const id = yo();
    const m = id && estado.integrantes.get(id);
    if (m && estado.userId && m.userId === estado.userId) await conManejo(backend.actualizar('integrantes/' + id, { userId: null }));
    estado.yoId = null; guardar('finora-yo', ''); notificar();
  },
  async guardarHito(id, datos) {
    if (id) return conManejo(backend.actualizar('hitos/' + id, datos));
    return conManejo(backend.crear('hitos/' + backend.nuevoId('hitos'), { ...datos, creadoEn: ahoraISO() }));
  },
  async borrarHito(id) {
    const ok = await conManejo(backend.borrar('hitos/' + id));
    if (!ok) return false;
    for (const [tid, t] of estado.tareas) if (t.hito === id) await backend.actualizar('tareas/' + tid, { hito: null }).catch(() => {});
    return true;
  },
};

/* ===== Respaldo: exportar e importar ===== */
function respaldoJSON() {
  const obj = m => Object.fromEntries([...m]);
  return JSON.stringify({
    app: 'tablero-finora', version: 1, exportado: ahoraISO(), config: estado.config || CONFIG_BASE,
    integrantes: obj(estado.integrantes), tareas: obj(estado.tareas), comentarios: obj(estado.comentarios), hitos: obj(estado.hitos),
  }, null, 2);
}
function tareasCSV(ctx) {
  const esc = v => { const s = v == null ? '' : String(v); return /[";\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
  const filas = [['Código', 'Título', 'Estado', 'Tipo', 'Prioridad', 'Responsables', 'Etiquetas', 'Vence', 'Puntos', 'Hito', 'Bloqueada', 'Archivada', 'Creada', 'Terminada', 'Descripción']];
  const lista = [...ctx.tareas].sort((a, b) => (a.numero || 0) - (b.numero || 0));
  for (const t of lista) {
    filas.push([
      codigo(t, ctx), t.titulo, ctx.colPorId.get(t.columna)?.nombre || '', TIPO[t.tipo]?.nombre || '', PRIORIDAD[t.prioridad]?.nombre || '',
      (t.asignados || []).map(id => nombreDe(id, ctx)).join(', '), (t.etiquetas || []).map(id => ctx.etiquetasPorId.get(id)?.nombre).filter(Boolean).join(', '),
      t.vence ? fechaNum(t.vence) : '', t.estimacion ?? '', t.hito ? ctx.hitosPorId.get(t.hito)?.nombre || '' : '',
      estaBloqueada(t, ctx) ? 'Sí' : 'No', t.archivada ? 'Sí' : 'No', t.creadaEn ? fechaNum(isoDe(new Date(t.creadaEn))) : '',
      t.terminadaEn ? fechaNum(isoDe(new Date(t.terminadaEn))) : '', t.descripcion || '',
    ]);
  }
  // Punto y coma: Excel en español (Uruguay) usa ; como separador de listas
  return '﻿' + filas.map(f => f.map(esc).join(';')).join('\r\n');
}
const puedeDescargar = () => !!estado.descargas || !window.claude;
async function guardarArchivo(nombre, contenido, mime) {
  if (estado.descargas) {
    try { await estado.descargas.save({ filename: nombre, data: contenido }); avisar('Archivo guardado.'); }
    catch (err) { if (!err || err.code !== 'declined') avisar('No se pudo guardar el archivo en esta vista.', 'error'); }
    return;
  }
  if (!window.claude) {
    const url = URL.createObjectURL(new Blob([contenido], { type: mime }));
    const a = document.createElement('a');
    a.href = url; a.download = nombre; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
    return;
  }
  avisar('Descargar archivos no está disponible en esta vista.', 'error');
}
function validarRespaldo(datos) {
  if (!datos || datos.app !== 'tablero-finora') throw new Error('El archivo no es un respaldo del Tablero Finora.');
  const ops = [];
  if (datos.config && Array.isArray(datos.config.columnas)) ops.push(['tablero/config', datos.config]);
  for (const col of ['integrantes', 'hitos', 'tareas', 'comentarios']) {
    for (const [id, d] of Object.entries(datos[col] || {})) {
      if (ID_VALIDO.test(id) && d && typeof d === 'object' && !Array.isArray(d)) ops.push([`${col}/${id}`, d]);
    }
  }
  return ops;
}
async function importarRespaldo(ops, alProgresar) {
  for (let i = 0; i < ops.length; i++) {
    await backend.crear(ops[i][0], ops[i][1]);
    alProgresar(i + 1, ops.length);
  }
}

/* ===== Arranque: suscripciones y capacidades ===== */
const subs = {};
function abrirSuscripcion(nombre) {
  if (subs[nombre]) { try { subs[nombre](); } catch (_) {} }
  const alError = err => {
    console.error('Suscripción', nombre, err);
    if (err && err.code === 'unavailable') { setTimeout(() => abrirSuscripcion(nombre), 1500 + Math.random() * 1500); return; }
    estado.errorConexion = true; notificar();
  };
  if (nombre === 'config') {
    subs.config = backend.observarDoc('tablero/config', d => {
      estado.config = d && Array.isArray(d.columnas) && d.columnas.length ? d : null;
      estado.cargado.config = true; notificar();
    }, alError);
  } else {
    subs[nombre] = backend.observarColeccion(nombre, m => { estado[nombre] = m; estado.cargado[nombre] = true; notificar(); }, alError);
  }
}
function usar(nombre) {
  const c = window.claude;
  if (!c || typeof c.use !== 'function') return Promise.resolve(null);
  return Promise.race([c.use(nombre).catch(() => null), dormir(12000).then(() => null)]);
}
async function iniciar() {
  const pUser = usar('user'), pRoom = usar('room'), pDescargas = usar('downloads');
  const db = await usar('db');
  backend = db ? crearBackendNube(db) : crearBackendLocal();
  estado.modo = backend.tipo;
  if (backend.tipo === 'local') estado.puedeEscribir = true;
  ['config', 'integrantes', 'tareas', 'comentarios', 'hitos'].forEach(abrirSuscripcion);
  notificar();
  pUser.then(async user => {
    if (!user) return;
    const [id, puede] = await Promise.all([user.id().catch(() => null), user.can('data.write').catch(() => null)]);
    estado.userId = id;
    if (backend.tipo === 'nube') estado.puedeEscribir = puede;
    notificar();
  });
  pRoom.then(room => {
    if (!room) return;
    estado.room = room;
    room.onPeers(cambio => { estado.pares = cambio.peers; notificar(); }, () => { estado.pares = []; notificar(); });
    fijarPublicador(p => { room.presence(p).catch(() => {}); });
    notificar();
  });
  pDescargas.then(d => { estado.descargas = d; notificar(); });
}
