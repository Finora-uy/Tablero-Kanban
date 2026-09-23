'use strict';
const { h, render } = preact;
const { useState, useEffect, useRef, useCallback, useLayoutEffect, useErrorBoundary } = preactHooks;
const html = htm.bind(h);

/* ===== Utilidades ===== */
const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'setiembre', 'octubre', 'noviembre', 'diciembre'];
const MESES_CORTOS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'set', 'oct', 'nov', 'dic'];
const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
const pad = n => String(n).padStart(2, '0');
const isoDe = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const hoyISO = () => isoDe(new Date());
const aFecha = iso => { const [y, m, d] = iso.split('-').map(Number); return new Date(y, m - 1, d); };
const diasEntre = (a, b) => Math.round((aFecha(b) - aFecha(a)) / 864e5);
const fechaLarga = iso => { const d = aFecha(iso); return `${d.getDate()} de ${MESES[d.getMonth()]}`; };
const fechaCorta = iso => { const d = aFecha(iso); return `${d.getDate()} ${MESES_CORTOS[d.getMonth()]}`; };
const fechaNum = iso => { const d = aFecha(iso); return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`; };
const mayus = s => s.charAt(0).toUpperCase() + s.slice(1);
const ahoraISO = () => new Date().toISOString();
const dormir = ms => new Promise(r => setTimeout(r, ms));
const numUY = n => Number(n).toLocaleString('es-UY');

function cuandoVence(iso, hoy = hoyISO()) {
  const n = diasEntre(hoy, iso);
  if (n === 0) return 'vence hoy';
  if (n === 1) return 'vence mañana';
  if (n > 1) return `faltan ${n} días`;
  if (n === -1) return 'venció ayer';
  return `venció hace ${-n} días`;
}
function momento(iso) {
  if (!iso) return '';
  const d = new Date(iso), ahora = new Date(), seg = (ahora - d) / 1000;
  if (seg < 60) return 'recién';
  if (seg < 3600) return `hace ${Math.floor(seg / 60)} min`;
  const hora = `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  const dif = diasEntre(isoDe(d), isoDe(ahora));
  if (dif === 0) return `hoy ${hora}`;
  if (dif === 1) return `ayer ${hora}`;
  return `${d.getDate()} ${MESES_CORTOS[d.getMonth()]} ${hora}`;
}
function tituloDia(iso) {
  const n = diasEntre(iso, hoyISO());
  if (n === 0) return 'Hoy';
  if (n === 1) return 'Ayer';
  const d = aFecha(iso);
  return mayus(`${DIAS[d.getDay()]} ${d.getDate()} de ${MESES[d.getMonth()]}`);
}
function uid() {
  try { if (crypto.randomUUID) return crypto.randomUUID().replace(/-/g, '').slice(0, 20); } catch (_) {}
  return (Math.random().toString(36).slice(2) + Date.now().toString(36)).slice(0, 20);
}
const iniciales = nombre => ((nombre || '').trim().split(/\s+/).slice(0, 2).map(p => p[0]).join('') || '?').toUpperCase();
const normalizar = s => (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
function leer(k) { try { return localStorage.getItem(k); } catch (_) { return null; } }
function guardar(k, v) { try { localStorage.setItem(k, v); } catch (_) {} }
function leerSesion(k) { try { return sessionStorage.getItem(k); } catch (_) { return null; } }
function guardarSesion(k, v) { try { sessionStorage.setItem(k, v); } catch (_) {} }
const copiaProfunda = o => JSON.parse(JSON.stringify(o));
const urlSegura = u => { const x = (u || '').trim(); if (!x) return ''; const c = /^https?:\/\//i.test(x) ? x : 'https://' + x; try { const p = new URL(c); return /^https?:$/.test(p.protocol) ? p.href : ''; } catch (_) { return ''; } };

/* ===== Constantes del tablero ===== */
const TIPOS = [
  { id: 'rf', nombre: 'Requerimiento funcional', corto: 'RF' },
  { id: 'rnf', nombre: 'Requerimiento no funcional', corto: 'RNF' },
  { id: 'tarea', nombre: 'Tarea', corto: 'Tarea' },
  { id: 'bug', nombre: 'Bug', corto: 'Bug' },
  { id: 'inv', nombre: 'Investigación', corto: 'Invest.' },
  { id: 'doc', nombre: 'Documentación', corto: 'Doc' },
];
const TIPO = Object.fromEntries(TIPOS.map(t => [t.id, t]));
const PRIORIDADES = [
  { id: 'urgente', nombre: 'Urgente', peso: 4 },
  { id: 'alta', nombre: 'Alta', peso: 3 },
  { id: 'media', nombre: 'Media', peso: 2 },
  { id: 'baja', nombre: 'Baja', peso: 1 },
];
const PRIORIDAD = Object.fromEntries(PRIORIDADES.map(p => [p.id, p]));
const COLORES = [
  { id: 'azul', nombre: 'Azul' }, { id: 'verde', nombre: 'Verde' }, { id: 'violeta', nombre: 'Violeta' },
  { id: 'magenta', nombre: 'Magenta' }, { id: 'mostaza', nombre: 'Mostaza' }, { id: 'petroleo', nombre: 'Petróleo' },
  { id: 'naranja', nombre: 'Naranja' }, { id: 'pizarra', nombre: 'Pizarra' },
];
const TIPOS_HITO = [
  { id: 'entrega', nombre: 'Entrega ORT' }, { id: 'sprint', nombre: 'Sprint' },
  { id: 'reunion', nombre: 'Reunión' }, { id: 'otro', nombre: 'Otro' },
];
const ROLES = ['Producto', 'Diseño', 'Desarrollo', 'Datos', 'IA', 'Negocio', 'Investigación', 'Coordinación'];
const ESTIMACIONES = [1, 2, 3, 5, 8, 13];
const VISTAS = [
  { id: 'tablero', nombre: 'Tablero' }, { id: 'lista', nombre: 'Lista' }, { id: 'calendario', nombre: 'Calendario' },
  { id: 'hitos', nombre: 'Hitos' }, { id: 'resumen', nombre: 'Resumen' }, { id: 'equipo', nombre: 'Equipo' },
  { id: 'actividad', nombre: 'Actividad' },
];
const CARRILES = [
  { id: 'ninguno', nombre: 'Sin carriles' }, { id: 'integrante', nombre: 'Por integrante' }, { id: 'prioridad', nombre: 'Por prioridad' },
];
// Valores por defecto: se muestran si tablero/config todavía no existe, pero no se escriben solos.
const CONFIG_BASE = {
  prefijo: 'FIN',
  columnas: [
    { id: 'ideas', nombre: 'Ideas', limiteWip: 0 },
    { id: 'por-hacer', nombre: 'Por hacer', limiteWip: 0 },
    { id: 'en-curso', nombre: 'En curso', limiteWip: 4 },
    { id: 'revision', nombre: 'En revisión', limiteWip: 3 },
    { id: 'hecho', nombre: 'Hecho', limiteWip: 0, final: true },
  ],
  etiquetas: [
    { id: 'producto', nombre: 'Producto', color: 'azul' },
    { id: 'datos', nombre: 'Datos y Odoo', color: 'petroleo' },
    { id: 'ia', nombre: 'IA y proyección', color: 'violeta' },
    { id: 'diseno', nombre: 'Diseño y marca', color: 'magenta' },
    { id: 'investigacion', nombre: 'Investigación', color: 'verde' },
    { id: 'seguridad', nombre: 'Seguridad', color: 'naranja' },
    { id: 'ort', nombre: 'Académico ORT', color: 'mostaza' },
  ],
};
const SESION = uid();
const ID_VALIDO = /^[A-Za-z0-9_\-.~:@+]{1,200}$/;

/* ===== Estado global ===== */
const estado = {
  modo: 'cargando',                 // 'nube' | 'local'
  config: null,
  integrantes: new Map(), tareas: new Map(), comentarios: new Map(), hitos: new Map(),
  cargado: { config: false, integrantes: false, tareas: false, comentarios: false, hitos: false },
  puedeEscribir: null, userId: null, yoId: leer('finora-yo'),
  pares: [], room: null, descargas: null,
  errorConexion: false, avisos: [],
};
let backend = null;
// Lo que cambia según dónde corre el tablero (Artifact de Claude o web en Vercel)
const extensiones = { plataforma: 'claude', equipo: null, cuenta: null };
let publicador = null, ultimaPresencia = null;
function publicarPresencia(p) { ultimaPresencia = p; if (publicador) publicador(p); }
function fijarPublicador(f) { publicador = f; if (ultimaPresencia) f(ultimaPresencia); }
const oyentes = new Set();
let programado = false;
let version = 0;
function notificar() {
  version++;
  if (programado) return;
  programado = true;
  queueMicrotask(() => { programado = false; oyentes.forEach(f => f()); });
}
function useEstado() {
  const [, forzar] = useState(0);
  const vista = useRef(version);
  vista.current = version;
  useLayoutEffect(() => {
    const f = () => forzar(n => n + 1);
    oyentes.add(f);
    // Si hubo cambios entre el primer render y la suscripción, se vuelve a dibujar.
    if (vista.current !== version) f();
    return () => oyentes.delete(f);
  }, []);
  return estado;
}
function avisar(texto, tipo = 'info') {
  const id = uid();
  estado.avisos = [...estado.avisos, { id, texto, tipo }].slice(-3);
  notificar();
  setTimeout(() => { estado.avisos = estado.avisos.filter(a => a.id !== id); notificar(); }, tipo === 'error' ? 6500 : 3200);
}

/* ===== Backends: nube (db compartida) y local (este navegador) ===== */
function conReintento(fn) {
  return async () => {
    try { return await fn(); }
    catch (e) {
      if (e && (e.code === 'unavailable' || e.code === 'resource_exhausted')) { await dormir(400 + Math.random() * 800); return fn(); }
      throw e;
    }
  };
}
function crearCola() {
  const cadenas = new Map();
  return (path, fn) => {
    const previa = cadenas.get(path) || Promise.resolve();
    const p = previa.catch(() => {}).then(conReintento(fn));
    cadenas.set(path, p);
    p.finally(() => { if (cadenas.get(path) === p) cadenas.delete(path); }).catch(() => {});
    return p;
  };
}
function crearBackendNube(db) {
  const encolar = crearCola();
  return {
    tipo: 'nube',
    observarColeccion(nombre, cb, alError) {
      return db.collection(nombre).onSnapshot(s => {
        const m = new Map();
        s.docs.forEach(d => m.set(d.id, d.data()));
        cb(m);
      }, alError);
    },
    observarDoc(path, cb, alError) { return db.doc(path).onSnapshot(s => cb(s.exists ? s.data() : null), alError); },
    nuevoId(col) { return db.collection(col).doc().id; },
    crear(path, data) { return encolar(path, () => db.doc(path).set(data)); },
    actualizar(path, data) { return encolar(path, () => db.doc(path).update(data)); },
    borrar(path) { return encolar(path, () => db.doc(path).delete()); },
    async siguienteNumero(maxActual) {
      const ref = db.doc('tablero/contador');
      for (let i = 0; i < 5; i++) {
        let r;
        try { r = await ref.acquire({ holder: SESION, ttlMs: 4000 }); } catch (_) { break; }
        if (r && r.acquired) {
          const s = await ref.get();
          const n = Math.max((s.exists && s.data().n) || 0, maxActual) + 1;
          await ref.set({ n });
          return n;
        }
        await dormir(250 + Math.random() * 500);
      }
      return maxActual + 1;
    },
  };
}
function crearBackendLocal() {
  const CLAVE = 'finora-tablero-local-v1';
  let datos = {};
  try { datos = JSON.parse(leer(CLAVE) || '{}') || {}; } catch (_) { datos = {}; }
  const subs = new Set();
  const partes = path => { const i = path.lastIndexOf('/'); return [path.slice(0, i), path.slice(i + 1)]; };
  const persistir = () => guardar(CLAVE, JSON.stringify(datos));
  const emitir = col => {
    for (const s of subs) {
      if (s.col && s.nombre === col) s.cb(new Map(Object.entries(datos[col] || {})));
      if (!s.col && partes(s.nombre)[0] === col) { const [c, id] = partes(s.nombre); s.cb((datos[c] || {})[id] || null); }
    }
  };
  const fusionar = (a, b) => {
    const r = { ...a };
    for (const [k, v] of Object.entries(b)) r[k] = v && typeof v === 'object' && !Array.isArray(v) && a[k] && typeof a[k] === 'object' && !Array.isArray(a[k]) ? fusionar(a[k], v) : v;
    return r;
  };
  return {
    tipo: 'local',
    observarColeccion(nombre, cb) {
      const s = { col: true, nombre, cb }; subs.add(s);
      queueMicrotask(() => cb(new Map(Object.entries(datos[nombre] || {}))));
      return () => subs.delete(s);
    },
    observarDoc(path, cb) {
      const s = { col: false, nombre: path, cb }; subs.add(s);
      const [c, id] = partes(path);
      queueMicrotask(() => cb((datos[c] || {})[id] || null));
      return () => subs.delete(s);
    },
    nuevoId() { return uid(); },
    async crear(path, data) { const [c, id] = partes(path); datos[c] = { ...(datos[c] || {}), [id]: copiaProfunda(data) }; persistir(); emitir(c); },
    async actualizar(path, data) {
      const [c, id] = partes(path);
      const prev = (datos[c] || {})[id];
      if (!prev) throw { code: 'invalid_argument', message: 'El documento no existe' };
      datos[c] = { ...datos[c], [id]: fusionar(prev, copiaProfunda(data)) }; persistir(); emitir(c);
    },
    async borrar(path) { const [c, id] = partes(path); if (datos[c]) { const x = { ...datos[c] }; delete x[id]; datos[c] = x; persistir(); emitir(c); } },
    async siguienteNumero(maxActual) { return maxActual + 1; },
  };
}

/* ===== Identidad ===== */
function resolverYo(e) {
  if (e.userId) for (const [id, m] of e.integrantes) if (m.userId === e.userId) return id;
  if (e.yoId && e.integrantes.has(e.yoId)) return e.yoId;
  return null;
}
function miembroDePar(p, e) {
  if (p.by) for (const [id, m] of e.integrantes) if (m.userId === p.by) return id;
  const m = p.presence && typeof p.presence.m === 'string' ? p.presence.m : null;
  return m && e.integrantes.has(m) ? m : null;
}

/* ===== Contexto derivado para renderizar ===== */
function armarContexto(e) {
  const config = e.config || CONFIG_BASE;
  const columnas = config.columnas;
  const finalCol = columnas.find(c => c.final) || columnas[columnas.length - 1];
  const tareas = [];
  for (const [id, t] of e.tareas) tareas.push({ ...t, id });
  const porId = new Map(tareas.map(t => [t.id, t]));
  const miembros = [...e.integrantes].map(([id, m]) => ({ ...m, id })).sort((a, b) => (a.nombre || '').localeCompare(b.nombre || '', 'es'));
  const integrantes = new Map(miembros.map(m => [m.id, m]));
  const hitos = [...e.hitos].map(([id, x]) => ({ ...x, id })).sort((a, b) => (a.fin || '9').localeCompare(b.fin || '9'));
  const comentarios = [...e.comentarios].map(([id, c]) => ({ ...c, id }));
  const comentariosPorTarea = new Map();
  for (const c of comentarios) comentariosPorTarea.set(c.tareaId, (comentariosPorTarea.get(c.tareaId) || 0) + 1);
  const yo = resolverYo(e);
  const miradas = new Map(), enLinea = [];
  const vistos = new Set();
  for (const p of e.pares) {
    if (p.kind !== 'viewer') continue;
    const m = miembroDePar(p, e);
    if (!m) continue;
    if (!vistos.has(m)) { vistos.add(m); enLinea.push({ id: m, esYo: !!p.isMe }); }
    const t = p.presence && typeof p.presence.t === 'string' ? p.presence.t : null;
    if (t && !p.isMe) { const l = miradas.get(t) || []; if (!l.includes(m)) l.push(m); miradas.set(t, l); }
  }
  enLinea.sort((a, b) => (b.esYo ? 1 : 0) - (a.esYo ? 1 : 0));
  return {
    config, columnas, finalId: finalCol && finalCol.id, colPorId: new Map(columnas.map(c => [c.id, c])),
    etiquetas: config.etiquetas || [], etiquetasPorId: new Map((config.etiquetas || []).map(x => [x.id, x])),
    prefijo: config.prefijo || 'FIN', tareas, porId, miembros, integrantes, hitos, hitosPorId: new Map(hitos.map(x => [x.id, x])),
    comentarios, comentariosPorTarea, yo, hoy: hoyISO(), miradas, enLinea,
  };
}
const codigo = (t, ctx) => `${ctx.prefijo}-${t.numero != null ? t.numero : '?'}`;
const estadoVence = (vence, hoy) => { const n = diasEntre(hoy, vence); return n < 0 ? 'vencida' : n <= 2 ? 'pronto' : 'normal'; };
const esHecha = (t, ctx) => t.columna === ctx.finalId;
const dependenciasPendientes = (t, ctx) => (t.dependeDe || []).map(id => ctx.porId.get(id)).filter(d => d && !d.archivada && !esHecha(d, ctx));
const estaBloqueada = (t, ctx) => !!t.bloqueada || dependenciasPendientes(t, ctx).length > 0;
const estaVencida = (t, ctx) => !!t.vence && !esHecha(t, ctx) && !t.archivada && diasEntre(ctx.hoy, t.vence) < 0;
const nombreDe = (id, ctx) => { const m = ctx.integrantes.get(id); return m ? m.nombre : 'Ex integrante'; };
const ordenar = lista => lista.sort((a, b) => (a.orden ?? 0) - (b.orden ?? 0) || (a.numero ?? 0) - (b.numero ?? 0));

function filtrar(tareas, f, ctx) {
  const q = normalizar(f.q);
  return tareas.filter(t => {
    if (!!t.archivada !== !!f.archivadas) return false;
    if (q && !normalizar(`${codigo(t, ctx)} ${t.titulo} ${t.descripcion || ''}`).includes(q)) return false;
    if (f.integrantes.length && !f.integrantes.some(i => i === 'sin' ? !(t.asignados || []).length : (t.asignados || []).includes(i))) return false;
    if (f.etiquetas.length && !f.etiquetas.some(x => (t.etiquetas || []).includes(x))) return false;
    if (f.prioridades.length && !f.prioridades.includes(t.prioridad || 'media')) return false;
    if (f.tipos.length && !f.tipos.includes(t.tipo || 'tarea')) return false;
    if (f.hito && (f.hito === 'sin' ? !!t.hito : t.hito !== f.hito)) return false;
    if (f.mias && !(ctx.yo && (t.asignados || []).includes(ctx.yo))) return false;
    if (f.vencidas && !estaVencida(t, ctx)) return false;
    if (f.bloqueadas && !estaBloqueada(t, ctx)) return false;
    return true;
  });
}
const FILTROS_VACIOS = { q: '', integrantes: [], etiquetas: [], prioridades: [], tipos: [], hito: '', mias: false, vencidas: false, bloqueadas: false, archivadas: false };
function cargarFiltros() {
  try { return { ...FILTROS_VACIOS, ...JSON.parse(leer('finora-filtros') || '{}'), q: '' }; } catch (_) { return { ...FILTROS_VACIOS }; }
}
const cuantosFiltros = f => f.integrantes.length + f.etiquetas.length + f.prioridades.length + f.tipos.length + (f.hito ? 1 : 0) + (f.mias ? 1 : 0) + (f.vencidas ? 1 : 0) + (f.bloqueadas ? 1 : 0) + (f.archivadas ? 1 : 0);
