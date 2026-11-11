// Webhook de GitHub (Vercel Function).
// GitHub avisa cada rama, push, PR y revisión del repo. Acá se vincula con las tareas (FIN-n), se guarda en Supabase
// (tablas github_*) y se mueven las tareas: rama creada → En curso, PR listo para revisión → En revisión.
// Al mergear NO se mueve: Hecho lo da cada responsable con su OK; el tablero muestra "PR mergeado".
//
// Vínculo con la tarea:
//   - la rama: `fin-n` en cualquier parte del nombre (ej. feature/fin-12-importar-csv), sin importar mayúsculas
//   - el cuerpo del PR: la línea `Refs: FIN-n` (puede tener varias: `Refs: FIN-12, FIN-13`)
//   No se usa el título del PR ni el mensaje del commit (con squash puede no venir).
//
// Variables en Vercel: GITHUB_WEBHOOK_SECRET, SUPABASE_SERVICE_ROLE_KEY (+ NEXT_PUBLIC_SUPABASE_URL)
// Opcional: GITHUB_REPO, si algún día cambia el repo del producto.
import { createHmac, timingSafeEqual } from 'node:crypto';
import { waitUntil } from '@vercel/functions';

// Solo se aceptan avisos del repo del producto (no del repo del tablero ni de otro)
const repoEsperado = () => (process.env.GITHUB_REPO || 'IngSoft-ProyectoGrado/Finora').toLowerCase();

const COLUMNAS_BASE = [{ id: 'ideas', nombre: 'Ideas' }, { id: 'por-hacer', nombre: 'Por hacer' }, { id: 'en-curso', nombre: 'En curso' }, { id: 'revision', nombre: 'En revisión' }, { id: 'hecho', nombre: 'Hecho', final: true }];
const MAX_HISTORIAL = 40;
const urlBase = () => (process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || '').replace(/\/$/, '');

/* ===== Supabase (clave secret: solo acá, en el servidor) ===== */
async function supabase(ruta, opciones = {}) {
  const clave = process.env.SUPABASE_SERVICE_ROLE_KEY;
  // Las claves nuevas (sb_secret_…) NO son un JWT: van solo en `apikey`. Las viejas (service_role) también van como Bearer.
  const autorizacion = clave && clave.startsWith('sb_') ? null : `Bearer ${clave}`;
  const r = await fetch(urlBase() + ruta, {
    ...opciones,
    headers: { apikey: clave, ...(autorizacion ? { Authorization: autorizacion } : {}), 'Content-Type': 'application/json', ...(opciones.headers || {}) },
  });
  const texto = await r.text();
  let datos = null;
  try { datos = texto ? JSON.parse(texto) : null; } catch (_) { datos = texto; }
  return { ok: r.ok, status: r.status, datos };
}
async function exigir(promesa, que) {
  const r = await promesa;
  if (!r.ok) throw new Error(`${que}: ${r.status} ${JSON.stringify(r.datos)}`);
  return r.datos;
}
const upsert = (tabla, filas, clave) => exigir(supabase(`/rest/v1/${tabla}?on_conflict=${clave}`, {
  method: 'POST', headers: { Prefer: 'resolution=merge-duplicates,return=minimal' }, body: JSON.stringify(filas),
}), `guardar en ${tabla}`);

/* ===== Firma: HMAC SHA-256 del cuerpo tal cual llegó, comparado en tiempo constante ===== */
export function firmaValida(cuerpo, firma, secreto) {
  if (!secreto || typeof firma !== 'string' || !firma.startsWith('sha256=')) return false;
  const esperada = Buffer.from('sha256=' + createHmac('sha256', secreto).update(cuerpo).digest('hex'));
  const recibida = Buffer.from(firma);
  return esperada.length === recibida.length && timingSafeEqual(esperada, recibida);
}

/* ===== Vínculo con las tareas ===== */
const escRegex = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
// `fin-12` pegado a otra letra o número (ej. "delfin-12") no cuenta
const patron = prefijo => new RegExp(`(?<![a-z0-9])${escRegex(prefijo)}-(\\d{1,9})(?!\\d)`, 'gi');
export function tareaDeRama(rama, prefijo = 'FIN') {
  const m = patron(prefijo).exec(String(rama || ''));
  return m && Number(m[1]) > 0 ? Number(m[1]) : null;
}
// Líneas "Refs: FIN-12" o "Refs: FIN-12, FIN-13" (también "**Refs:** FIN-12" o en una lista)
export function tareasDeCuerpo(cuerpo, prefijo = 'FIN') {
  const nums = [];
  for (const linea of String(cuerpo || '').split(/\r?\n/)) {
    const m = linea.match(/^\s*(?:[-*]\s+)?\**\s*refs?\s*\**\s*:\s*\**\s*(.*)$/i);
    if (!m) continue;
    for (const x of m[1].matchAll(patron(prefijo))) if (Number(x[1]) > 0) nums.push(Number(x[1]));
  }
  return nums;
}
export function tareasDePr(pr, prefijo = 'FIN') {
  const deRama = tareaDeRama(pr.head && pr.head.ref, prefijo);
  return [...new Set([...(deRama ? [deRama] : []), ...tareasDeCuerpo(pr.body, prefijo)])].sort((a, b) => a - b);
}
export const esBot = u => !!u && (u.type === 'Bot' || /\[bot\]$/i.test(u.login || ''));

/* ===== A qué columna pasa la tarea ===== */
// Igual que en el tablero: En revisión es la de antes de la final, y En curso la de antes de esa
export function columnasClave(columnas) {
  const i = columnas.findIndex(c => c.final), fin = i >= 0 ? i : columnas.length - 1;
  return { fin, revision: fin > 0 ? fin - 1 : -1, enCurso: fin > 1 ? fin - 2 : -1 };
}
// Solo avanza: nunca retrocede, nunca toca una tarea archivada ni una que ya está más adelante (ni Hecho)
export function decidirMovimiento(tarea, destino, columnas) {
  const iDestino = columnasClave(columnas)[destino];
  if (iDestino == null || iDestino < 0 || !tarea || tarea.archivada) return null;
  const iActual = columnas.findIndex(c => c.id === tarea.columna);
  if (iActual >= iDestino) return null;
  // Regla del equipo: nada pasa a En curso sin estimación en puntos
  if (destino === 'enCurso' && !(Number(tarea.estimacion) > 0)) return { columna: columnas[iDestino], falta: 'estimacion' };
  return { columna: columnas[iDestino] };
}

async function leerConfig() {
  const r = await supabase('/rest/v1/docs?coleccion=eq.tablero&id=eq.config&select=data');
  const cfg = r.ok && r.datos && r.datos[0] && r.datos[0].data;
  return { columnas: (cfg && Array.isArray(cfg.columnas) && cfg.columnas.length ? cfg.columnas : COLUMNAS_BASE), prefijo: (cfg && cfg.prefijo) || 'FIN' };
}

// Mueve la tarea FIN-n (si corresponde) y deja el motivo en su historial, firmado por GitHub
async function moverTarea(numero, destino, motivo, cfg, { avisarSiFalta = false } = {}) {
  const filas = await exigir(supabase(`/rest/v1/docs?coleccion=eq.tareas&data->>numero=eq.${numero}&select=id,data`), 'leer la tarea');
  const fila = filas && filas[0];
  if (!fila) return `${cfg.prefijo}-${numero}: no existe`;
  const t = fila.data, d = decidirMovimiento(t, destino, cfg.columnas);
  if (!d || (d.falta && !avisarSiFalta)) return `${cfg.prefijo}-${numero}: sin cambios`;
  const ahora = new Date().toISOString();
  const que = d.falta ? `no la pasó a ${d.columna.nombre} porque le falta la estimación en puntos (${motivo})` : `la movió a ${d.columna.nombre}: ${motivo}`;
  const cambios = { actualizadaEn: ahora, historial: [...(t.historial || []), { en: ahora, quien: null, por: 'github', que }].slice(-MAX_HISTORIAL) };
  if (!d.falta) {
    // Al final de la columna, como cuando se mueve a mano
    const enCol = await exigir(supabase(`/rest/v1/docs?coleccion=eq.tareas&data->>columna=eq.${encodeURIComponent(d.columna.id)}&select=orden:data->orden`), 'leer la columna');
    const ultimo = Math.max(0, ...(enCol || []).map(x => Number(x.orden) || 0));
    Object.assign(cambios, { columna: d.columna.id, orden: ultimo + 1024, entroEnColumna: ahora, terminadaEn: null });
    // Al cambiar de columna los OK empiezan de cero (igual que en el tablero)
    if ((t.aprobaciones || []).length) cambios.aprobaciones = [];
  }
  await exigir(supabase('/rest/v1/rpc/actualizar_doc', { method: 'POST', body: JSON.stringify({ p_coleccion: 'tareas', p_id: fila.id, p_cambios: cambios }) }), 'actualizar la tarea');
  return `${cfg.prefijo}-${numero}: ${d.falta ? 'falta estimación' : '→ ' + d.columna.nombre}`;
}

/* ===== Eventos ===== */
const urlRama = (repo, rama) => repo && repo.html_url ? `${repo.html_url}/tree/${rama.split('/').map(encodeURIComponent).join('/')}` : null;
const estadoPr = pr => (pr.merged || pr.merged_at ? 'mergeado' : pr.state === 'closed' ? 'cerrado' : 'abierto');
const filaPr = (pr, prefijo) => ({
  numero: pr.number, titulo: String(pr.title || '').slice(0, 500), rama: pr.head && pr.head.ref, tareas: tareasDePr(pr, prefijo),
  estado: estadoPr(pr), borrador: !!pr.draft, autor_login: pr.user && pr.user.login, url: pr.html_url,
  creado: pr.created_at, actualizado: pr.updated_at, mergeado: pr.merged_at || null,
});
const REVISION = { approved: 'aprobado', changes_requested: 'cambios' };

// Devuelve [estado, detalle] para dejar anotado en github_entregas
export async function procesar(evento, p) {
  const repo = p.repository || {};
  const nombreRepo = String(repo.full_name || '').toLowerCase();
  if (nombreRepo !== repoEsperado()) return ['ignorado', `repo ${repo.full_name || 'desconocido'} (se espera ${repoEsperado()})`];
  if (evento === 'ping') return ['ok', `ping de ${repo.full_name}`];
  if (esBot(p.sender)) return ['ignorado', `bot ${p.sender.login}`];
  const principal = repo.default_branch || 'main';

  if (evento === 'create' || evento === 'delete') {
    if (p.ref_type !== 'branch') return ['ignorado', `${evento} de ${p.ref_type}`];
    const rama = String(p.ref || '');
    if (rama === principal) return ['ignorado', 'rama principal'];
    const cfg = await leerConfig();
    const tarea = tareaDeRama(rama, cfg.prefijo);
    const ahora = new Date().toISOString();
    if (evento === 'delete') {
      await upsert('github_ramas', { nombre: rama, tarea, url: urlRama(repo, rama), borrada: ahora }, 'nombre');
      return ['ok', `rama borrada ${rama}`];
    }
    await upsert('github_ramas', { nombre: rama, tarea, url: urlRama(repo, rama), autor_login: p.sender && p.sender.login, creada: ahora, borrada: null }, 'nombre');
    if (!tarea) return ['ok', `rama sin vincular ${rama}`];
    return ['ok', await moverTarea(tarea, 'enCurso', `se creó la rama ${rama}`, cfg, { avisarSiFalta: true })];
  }

  if (evento === 'push') {
    const ref = String(p.ref || '');
    if (!ref.startsWith('refs/heads/')) return ['ignorado', 'push de tag'];
    const rama = ref.slice('refs/heads/'.length);
    if (rama === principal) return ['ignorado', 'push a la rama principal'];
    const cfg = await leerConfig();
    const tarea = tareaDeRama(rama, cfg.prefijo);
    const ahora = new Date().toISOString();
    if (p.deleted) {
      await upsert('github_ramas', { nombre: rama, tarea, url: urlRama(repo, rama), borrada: ahora }, 'nombre');
      return ['ok', `rama borrada ${rama}`];
    }
    await upsert('github_ramas', { nombre: rama, tarea, url: urlRama(repo, rama), ultimo_push: ahora, borrada: null }, 'nombre');
    if (!tarea) return ['ok', `push a rama sin vincular ${rama}`];
    const commits = (p.commits || []).map(c => ({
      rama, sha: c.id, tarea, mensaje: String(c.message || '').slice(0, 2000), autor: (c.author && c.author.name) || null,
      autor_login: (c.author && c.author.username) || null, fecha: c.timestamp || null, url: c.url || null,
    }));
    if (commits.length) await upsert('github_commits', commits, 'rama,sha');
    // Por si se perdió el aviso de "rama creada" (ese es el que deja la nota si falta la estimación)
    const mov = p.created ? '; ' + await moverTarea(tarea, 'enCurso', `se creó la rama ${rama}`, cfg) : '';
    return ['ok', `${commits.length} commits en ${rama}${mov}`];
  }

  if (evento === 'pull_request') {
    const pr = p.pull_request || {};
    const cfg = await leerConfig();
    const fila = filaPr(pr, cfg.prefijo);
    await upsert('github_prs', fila, 'numero');
    const listo = pr.state === 'open' && !pr.draft;
    let aMover = [];
    if (listo && ['opened', 'reopened', 'ready_for_review'].includes(p.action)) aMover = fila.tareas;
    // Si al editar el cuerpo se sumó una "Refs: FIN-n", esa tarea también pasa a revisión
    if (listo && p.action === 'edited' && p.changes && p.changes.body) {
      const antes = tareasDePr({ ...pr, body: p.changes.body.from }, cfg.prefijo);
      aMover = fila.tareas.filter(n => !antes.includes(n));
    }
    const res = [];
    for (const n of aMover) res.push(await moverTarea(n, 'revision', `se abrió el PR #${pr.number}`, cfg));
    return ['ok', `PR #${pr.number} ${p.action}${res.length ? '; ' + res.join(', ') : ''}`];
  }

  if (evento === 'pull_request_review') {
    const pr = p.pull_request || {}, review = p.review || {};
    const cfg = await leerConfig();
    const fila = filaPr(pr, cfg.prefijo);
    if (p.action === 'submitted' && REVISION[review.state]) fila.revision = REVISION[review.state];
    else if (p.action === 'dismissed') fila.revision = null;
    await upsert('github_prs', fila, 'numero');
    return ['ok', `revisión de PR #${pr.number}: ${review.state || p.action}`];
  }

  return ['ignorado', `evento ${evento}`];
}

/* ===== Entregas: cada aviso se procesa una sola vez (salvo que haya fallado) ===== */
async function tomarEntrega(id, evento) {
  const nueva = await exigir(supabase('/rest/v1/github_entregas', {
    method: 'POST', headers: { Prefer: 'resolution=ignore-duplicates,return=representation' }, body: JSON.stringify({ id, evento }),
  }), 'anotar la entrega');
  if (nueva && nueva.length) return true;
  const previa = await exigir(supabase(`/rest/v1/github_entregas?id=eq.${encodeURIComponent(id)}&select=estado`), 'leer la entrega');
  if (!previa || !previa[0] || previa[0].estado !== 'error') return false;
  await cerrarEntrega(id, 'procesando', 'reintento');
  return true;
}
const cerrarEntrega = (id, estado, detalle) => supabase(`/rest/v1/github_entregas?id=eq.${encodeURIComponent(id)}`, {
  method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ estado, detalle: String(detalle || '').slice(0, 1000) }),
});

async function manejar(entrega, evento, payload) {
  try {
    if (!(await tomarEntrega(entrega, evento))) { console.log('github-webhook repetida', entrega, evento); return; }
    const [estado, detalle] = await procesar(evento, payload);
    await cerrarEntrega(entrega, estado, detalle);
    console.log('github-webhook', entrega, evento, estado, detalle);
  } catch (err) {
    console.error('github-webhook', entrega, evento, err);
    await cerrarEntrega(entrega, 'error', err && err.message).catch(() => {});
  }
}

const json = (status, cuerpo) => new Response(JSON.stringify(cuerpo), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });

export function GET() {
  return new Response(JSON.stringify({ error: 'Este endpoint solo recibe los avisos de GitHub (POST).' }), { status: 405, headers: { Allow: 'POST', 'Content-Type': 'application/json' } });
}

export async function POST(request) {
  const secreto = process.env.GITHUB_WEBHOOK_SECRET;
  if (!secreto) return json(500, { error: 'Falta la variable GITHUB_WEBHOOK_SECRET en Vercel.' });
  // La firma se calcula sobre el cuerpo SIN parsear: cualquier cambio (espacios, orden) la invalida
  const cuerpo = Buffer.from(await request.arrayBuffer());
  if (!firmaValida(cuerpo, request.headers.get('x-hub-signature-256'), secreto)) return json(401, { error: 'Firma inválida.' });
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY || !urlBase()) return json(500, { error: 'Faltan variables de Supabase en Vercel.' });

  const evento = request.headers.get('x-github-event') || '';
  const entrega = request.headers.get('x-github-delivery') || '';
  if (!evento || !entrega) return json(400, { error: 'Faltan los encabezados de GitHub.' });
  let payload;
  try {
    const texto = cuerpo.toString('utf8');
    // Si el webhook se configuró como form-urlencoded, el JSON viene en el campo `payload`
    payload = /application\/x-www-form-urlencoded/i.test(request.headers.get('content-type') || '')
      ? JSON.parse(new URLSearchParams(texto).get('payload') || '{}')
      : JSON.parse(texto);
  } catch (_) {
    return json(400, { error: 'El cuerpo no es JSON.' });
  }

  // Se responde enseguida (GitHub corta a los 10 s) y se procesa después
  waitUntil(manejar(entrega, evento, payload));
  return json(200, { recibido: true, entrega });
}
