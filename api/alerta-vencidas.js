// Alerta semanal de tareas vencidas (Vercel Function que dispara Vercel Cron, ver vercel.json).
// Todos los lunes a las 8:00 (hora de Uruguay) le manda un email a cada integrante que tenga tareas vencidas.
// Las claves viven solo en las variables de entorno de Vercel:
//   CRON_SECRET, BREVO_API_KEY, BREVO_SENDER_EMAIL, BREVO_SENDER_NAME, SUPABASE_SERVICE_ROLE_KEY (+ NEXT_PUBLIC_SUPABASE_URL)
import { timingSafeEqual } from 'node:crypto';

const ZONA = 'America/Montevideo';
const MAX_EN_EL_MAIL = 15; // el resto se resume en "y N más"

const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const urlBase = () => (process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || '').replace(/\/$/, '');
// La fecha de hoy en Uruguay (YYYY-MM-DD), no la del servidor, que corre en UTC
const hoyUY = (ahora = new Date()) => new Intl.DateTimeFormat('en-CA', { timeZone: ZONA, year: 'numeric', month: '2-digit', day: '2-digit' }).format(ahora);
const dias = (desde, hasta) => Math.round((Date.parse(hasta + 'T00:00:00Z') - Date.parse(desde + 'T00:00:00Z')) / 864e5);
const hace = n => (n === 1 ? 'venció ayer' : `venció hace ${n} días`);
const igual = (a, b) => { const x = Buffer.from(String(a)), y = Buffer.from(String(b)); return x.length === y.length && timingSafeEqual(x, y); };

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
const docs = (coleccion, extra = '') => supabase(`/rest/v1/docs?coleccion=eq.${encodeURIComponent(coleccion)}${extra}&select=id,data`);

// Tareas vivas (no archivadas, ni terminadas, ni en Ideas) con vencimiento anterior a hoy, por responsable
export function vencidasPorPersona(tareas, integrantes, columnas, hoy) {
  const final = (columnas.find(c => c.final) || columnas[columnas.length - 1] || {}).id;
  const porPersona = new Map();
  for (const { id, data: t } of tareas) {
    if (!t || t.archivada || !t.vence || t.vence >= hoy || t.columna === final || t.columna === 'ideas') continue;
    for (const quien of (t.asignados || [])) {
      if (!integrantes.has(quien)) continue;
      if (!porPersona.has(quien)) porPersona.set(quien, []);
      porPersona.get(quien).push({ id, numero: t.numero, titulo: t.titulo || 'Sin título', vence: t.vence, atraso: dias(t.vence, hoy), columna: t.columna });
    }
  }
  for (const lista of porPersona.values()) lista.sort((a, b) => b.atraso - a.atraso || (a.numero ?? 0) - (b.numero ?? 0));
  return porPersona;
}

function correo({ nombre, lista, prefijo, nombresColumna, url }) {
  const n = lista.length;
  const visibles = lista.slice(0, MAX_EN_EL_MAIL), resto = n - visibles.length;
  const cod = t => `${prefijo}-${t.numero ?? '?'}`;
  const asunto = n === 1 ? 'Tenés 1 tarea vencida en el tablero' : `Tenés ${n} tareas vencidas en el tablero`;
  const texto = `Hola ${nombre}, estas tareas tuyas están vencidas:\n\n${visibles.map(t => `- ${cod(t)} ${t.titulo} (${hace(t.atraso)}, en «${nombresColumna.get(t.columna) || t.columna}»)`).join('\n')}${resto ? `\n- y ${resto} más` : ''}\n\nSi ya las hiciste, pasalas a Hecho. Si no llegás, avisale al equipo y movele la fecha.\n\nAbrí el tablero: ${url}\n`;
  const filas = visibles.map(t => `<tr>
      <td style="padding:10px 12px 10px 0;border-top:1px solid #E3E8F1;font-family:Consolas,monospace;font-size:13px;color:#5A6685;white-space:nowrap;vertical-align:top">${esc(cod(t))}</td>
      <td style="padding:10px 0;border-top:1px solid #E3E8F1;vertical-align:top"><div style="font-size:15px;font-weight:600;color:#07132F">${esc(t.titulo)}</div>
        <div style="font-size:13px;color:#B02A27;margin-top:2px">${esc(hace(t.atraso))} · ${esc(nombresColumna.get(t.columna) || t.columna)}</div></td>
    </tr>`).join('');
  const html = `<div style="font-family:Arial,Helvetica,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#07132F">
    <p style="font-size:13px;letter-spacing:.12em;text-transform:uppercase;color:#5A6685;margin:0 0 16px">Finora · Tablero del equipo</p>
    <p style="font-size:16px;margin:0 0 12px">Hola ${esc(nombre)},</p>
    <p style="font-size:16px;line-height:1.5;margin:0 0 16px">${n === 1 ? 'Tenés <strong>1 tarea vencida</strong>' : `Tenés <strong>${n} tareas vencidas</strong>`}. Arrancá la semana poniéndote al día:</p>
    <table style="width:100%;border-collapse:collapse;margin:0 0 ${resto ? 8 : 20}px">${filas}</table>
    ${resto ? `<p style="font-size:14px;color:#5A6685;margin:0 0 20px">y ${resto} más en el tablero.</p>` : ''}
    <p style="font-size:15px;line-height:1.5;color:#2A3553;margin:0 0 20px">Si ya la hiciste, pasala a <strong>Hecho</strong>. Si no llegás, avisale al equipo y movele la fecha.</p>
    <a href="${esc(url)}" style="display:inline-block;background:#C0843A;color:#07132F;text-decoration:none;font-weight:700;padding:11px 20px;border-radius:8px">Abrir el tablero</a>
    <p style="font-size:12px;color:#5A6685;margin:24px 0 0">Este mail sale solo todos los lunes a las 8:00 si tenés tareas vencidas.</p>
  </div>`;
  return { asunto, texto, html };
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'GET') { res.setHeader('Allow', 'GET'); return res.status(405).json({ error: 'Solo se acepta GET.' }); }
  const { CRON_SECRET, BREVO_API_KEY, BREVO_SENDER_EMAIL, SUPABASE_SERVICE_ROLE_KEY } = process.env;
  // Sin CRON_SECRET cualquiera podría disparar los mails: no se envía nada
  if (!CRON_SECRET) return res.status(500).json({ error: 'Falta la variable CRON_SECRET en Vercel.' });
  const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  if (!token || !igual(token, CRON_SECRET)) return res.status(401).json({ error: 'No autorizado.' });
  if (!BREVO_API_KEY || !BREVO_SENDER_EMAIL || !SUPABASE_SERVICE_ROLE_KEY || !urlBase()) {
    return res.status(500).json({ error: 'Faltan variables de entorno en Vercel para mandar mails.' });
  }
  try {
    const hoy = hoyUY();
    // Una sola alerta por día, aunque Vercel repita la llamada
    const marca = await docs('alertas', '&id=eq.vencidas');
    if (marca.ok && marca.datos && marca.datos[0] && marca.datos[0].data && marca.datos[0].data.fecha === hoy) return res.status(200).json({ hoy, enviados: [], omitido: 'ya-enviada-hoy' });

    const [tareasR, intR, cfgR] = await Promise.all([docs('tareas'), docs('integrantes'), docs('tablero', '&id=eq.config')]);
    if (!tareasR.ok || !intR.ok) {
      console.error('No se pudo leer el tablero', tareasR.status, intR.status, JSON.stringify(tareasR.datos));
      return res.status(500).json({ error: 'No se pudo leer el tablero: revisá la clave SUPABASE_SERVICE_ROLE_KEY en Vercel.' });
    }
    const cfg = cfgR.datos && cfgR.datos[0] && cfgR.datos[0].data;
    const columnas = (cfg && cfg.columnas) || [{ id: 'ideas', nombre: 'Ideas' }, { id: 'por-hacer', nombre: 'Por hacer' }, { id: 'en-curso', nombre: 'En curso' }, { id: 'revision', nombre: 'En revisión' }, { id: 'hecho', nombre: 'Hecho', final: true }];
    const nombresColumna = new Map(columnas.map(c => [c.id, c.nombre]));
    const prefijo = (cfg && cfg.prefijo) || 'FIN';
    const integrantes = new Map((intR.datos || []).map(x => [x.id, x.data]));
    const sitio = (process.env.SITE_URL || (process.env.VERCEL_PROJECT_PRODUCTION_URL ? 'https://' + process.env.VERCEL_PROJECT_PRODUCTION_URL : '') || `https://${req.headers['x-forwarded-host'] || req.headers.host}`).replace(/\/$/, '');

    const porPersona = vencidasPorPersona(tareasR.datos || [], integrantes, columnas, hoy);
    const enviados = [], fallidos = [];
    for (const [id, lista] of porPersona) {
      const d = integrantes.get(id);
      const a = d.userId ? await supabase(`/auth/v1/admin/users/${encodeURIComponent(d.userId)}`) : null;
      const email = a && a.ok && a.datos && a.datos.email;
      if (!email) { fallidos.push({ id, motivo: 'sin-cuenta' }); continue; }
      const c = correo({ nombre: d.nombre || 'equipo', lista, prefijo, nombresColumna, url: sitio });
      const r = await fetch('https://api.brevo.com/v3/smtp/email', {
        method: 'POST', headers: { 'api-key': BREVO_API_KEY, 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ sender: { name: process.env.BREVO_SENDER_NAME || 'Tablero Finora', email: BREVO_SENDER_EMAIL }, to: [{ email, name: d.nombre || undefined }],
          subject: c.asunto, htmlContent: c.html, textContent: c.texto, tags: ['alerta-vencidas'] }),
      });
      if (r.ok) enviados.push({ id, tareas: lista.length });
      else { fallidos.push({ id, motivo: 'brevo-' + r.status }); console.error('Brevo', r.status, await r.text().catch(() => '')); }
    }
    // Si se mandó algo, se anota el día para no repetirlo
    if (enviados.length) await supabase('/rest/v1/docs', { method: 'POST', headers: { Prefer: 'resolution=merge-duplicates,return=minimal' }, body: JSON.stringify({ coleccion: 'alertas', id: 'vencidas', data: { fecha: hoy, enviados: enviados.length } }) });
    console.log('alerta-vencidas', hoy, 'enviados', enviados.length, 'fallidos', JSON.stringify(fallidos));
    return res.status(fallidos.length && !enviados.length ? 502 : 200).json({ hoy, personasConVencidas: porPersona.size, enviados, fallidos });
  } catch (err) {
    console.error('alerta-vencidas', err);
    return res.status(500).json({ error: 'No se pudo mandar la alerta.' });
  }
}
