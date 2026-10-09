// Recordatorio por email para dar el OK de una tarea (Vercel Function).
// Las claves viven solo en las variables de entorno de Vercel; el navegador nunca las ve ni ve los emails.
//   BREVO_API_KEY, BREVO_SENDER_EMAIL, BREVO_SENDER_NAME, SUPABASE_SERVICE_ROLE_KEY (+ NEXT_PUBLIC_SUPABASE_URL)

const ESPERA_MS = 6 * 3600e3; // un recordatorio cada 6 horas por persona y tarea
const MAX_DESTINATARIOS = 8;

const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const urlBase = () => (process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || '').replace(/\/$/, '');

async function supabase(ruta, opciones = {}, token) {
  const clave = process.env.SUPABASE_SERVICE_ROLE_KEY;
  // Las claves nuevas (sb_secret_…) NO son un JWT: van solo en `apikey`. Las viejas (service_role) también van como Bearer.
  const autorizacion = token ? `Bearer ${token}` : (clave && clave.startsWith('sb_') ? null : `Bearer ${clave}`);
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

function correo({ destinatario, quien, codigo, titulo, columna, final, url }) {
  const asunto = `Falta tu OK en ${codigo}: ${titulo}`;
  const texto = `Hola ${destinatario}, ${quien} te recuerda dar tu OK en la tarea ${codigo} «${titulo}».\n\nEstá en «${columna}» y no puede pasar a «${final}» hasta que todos los responsables den su OK.\n\nAbrila acá: ${url}\n`;
  const html = `<div style="font-family:Arial,Helvetica,sans-serif;max-width:520px;margin:0 auto;padding:24px;color:#07132F">
    <p style="font-size:13px;letter-spacing:.12em;text-transform:uppercase;color:#5A6685;margin:0 0 16px">Finora · Tablero del equipo</p>
    <p style="font-size:16px;margin:0 0 12px">Hola ${esc(destinatario)},</p>
    <p style="font-size:16px;line-height:1.5;margin:0 0 16px"><strong>${esc(quien)}</strong> te recuerda dar tu <strong>OK</strong> en la tarea:</p>
    <div style="border:1px solid #D8DFEB;border-radius:10px;padding:14px 16px;margin:0 0 16px">
      <div style="font-family:Consolas,monospace;font-size:13px;color:#5A6685">${esc(codigo)}</div>
      <div style="font-size:17px;font-weight:600;margin-top:4px">${esc(titulo)}</div>
    </div>
    <p style="font-size:15px;line-height:1.5;color:#2A3553;margin:0 0 20px">Está en «${esc(columna)}» y no puede pasar a «${esc(final)}» hasta que todos los responsables den su OK.</p>
    <a href="${esc(url)}" style="display:inline-block;background:#C0843A;color:#07132F;text-decoration:none;font-weight:700;padding:11px 20px;border-radius:8px">Abrir el tablero</a>
    <p style="font-size:12px;color:#5A6685;margin:24px 0 0">Entrá a la tarea y tocá «Dar mi OK». Este mail lo mandó el tablero porque alguien del equipo lo pidió.</p>
  </div>`;
  return { asunto, texto, html };
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); return res.status(405).json({ error: 'Solo se acepta POST.' }); }
  const { BREVO_API_KEY, BREVO_SENDER_EMAIL, SUPABASE_SERVICE_ROLE_KEY } = process.env;
  if (!BREVO_API_KEY || !BREVO_SENDER_EMAIL || !SUPABASE_SERVICE_ROLE_KEY || !urlBase()) {
    return res.status(500).json({ error: 'Faltan variables de entorno en Vercel para mandar recordatorios.' });
  }
  try {
    // 1) Quién pide: tiene que estar logueado, con email confirmado e invitado al equipo
    const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
    if (!token) return res.status(401).json({ error: 'Iniciá sesión para mandar recordatorios.' });
    const u = await supabase('/auth/v1/user', {}, token);
    if (!u.ok || !u.datos || !u.datos.id) return res.status(401).json({ error: 'Tu sesión venció. Recargá la página.' });
    const emailQuien = String(u.datos.email || '').toLowerCase();
    const invitado = await supabase(`/rest/v1/equipo_permitido?email=eq.${encodeURIComponent(emailQuien)}&select=email`);
    if (!invitado.ok) {
      // Es un problema de configuración (clave de Supabase), no de la cuenta de quien pide
      console.error('No se pudo leer equipo_permitido', invitado.status, JSON.stringify(invitado.datos));
      return res.status(500).json({ error: 'El servicio no pudo verificar tu acceso: revisá la clave SUPABASE_SERVICE_ROLE_KEY en Vercel.' });
    }
    if (!u.datos.email_confirmed_at || !invitado.datos || !invitado.datos.length) return res.status(403).json({ error: 'Tu email no está en la lista de invitados del equipo.' });

    // 2) Qué se pide
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
    const tareaId = String(body.tareaId || '');
    const pedidos = [...new Set(Array.isArray(body.destinatarios) ? body.destinatarios.map(String) : [])].slice(0, MAX_DESTINATARIOS);
    if (!tareaId || !pedidos.length) return res.status(400).json({ error: 'Falta la tarea o a quién recordarle.' });

    const [tareaR, cfgR, intR] = await Promise.all([
      docs('tareas', `&id=eq.${encodeURIComponent(tareaId)}`), docs('tablero', '&id=eq.config'), docs('integrantes'),
    ]);
    const tarea = tareaR.datos && tareaR.datos[0] && tareaR.datos[0].data;
    if (!tarea) return res.status(404).json({ error: 'No encontré la tarea.' });
    const integrantes = new Map((intR.datos || []).map(x => [x.id, x.data]));
    const yoId = [...integrantes].find(([, d]) => d.userId === u.datos.id)?.[0] || null;
    const quien = (yoId && integrantes.get(yoId).nombre) || 'Alguien del equipo';

    // 3) La tarea tiene que estar en revisión, con 2 o más responsables
    const cfg = cfgR.datos && cfgR.datos[0] && cfgR.datos[0].data;
    const columnas = (cfg && cfg.columnas) || [{ id: 'ideas', nombre: 'Ideas' }, { id: 'por-hacer', nombre: 'Por hacer' }, { id: 'en-curso', nombre: 'En curso' }, { id: 'revision', nombre: 'En revisión' }, { id: 'hecho', nombre: 'Hecho', final: true }];
    const iFinal = columnas.findIndex(c => c.final) >= 0 ? columnas.findIndex(c => c.final) : columnas.length - 1;
    const revision = columnas[iFinal - 1];
    if (!revision || tarea.columna !== revision.id) return res.status(409).json({ error: `La tarea ya no está en «${revision ? revision.nombre : 'revisión'}».` });
    const asignados = (tarea.asignados || []).filter(id => integrantes.has(id));
    if (asignados.length < 2) return res.status(409).json({ error: 'Esta tarea no pide OK de varios responsables.' });

    // 4) A quién sí: responsables que todavía no dieron el OK, que no sean quien pide y que no hayan sido avisados hace poco
    const dieronOk = tarea.aprobaciones || [];
    const recordatorios = { ...(tarea.recordatorios || {}) };
    const ahora = Date.now();
    const omitidos = [], objetivos = [];
    for (const id of pedidos) {
      if (!asignados.includes(id)) omitidos.push({ id, motivo: 'no-responsable' });
      else if (dieronOk.includes(id)) omitidos.push({ id, motivo: 'ya-dio-ok' });
      else if (id === yoId) omitidos.push({ id, motivo: 'sos-vos' });
      else if (recordatorios[id] && ahora - Date.parse(recordatorios[id]) < ESPERA_MS) omitidos.push({ id, motivo: 'reciente', desde: recordatorios[id] });
      else objetivos.push(id);
    }

    // 5) Mandar un mail por persona
    const sitio = process.env.SITE_URL || `https://${req.headers['x-forwarded-host'] || req.headers.host}`;
    const prefijo = (cfg && cfg.prefijo) || 'FIN';
    const enviados = [], fallidos = [];
    for (const id of objetivos) {
      const d = integrantes.get(id);
      const a = d.userId ? await supabase(`/auth/v1/admin/users/${encodeURIComponent(d.userId)}`) : null;
      const email = a && a.ok && a.datos && a.datos.email;
      if (!email) { fallidos.push({ id, motivo: 'sin-email' }); continue; }
      const c = correo({ destinatario: d.nombre || 'equipo', quien, codigo: `${prefijo}-${tarea.numero ?? '?'}`, titulo: tarea.titulo, columna: revision.nombre, final: columnas[iFinal].nombre, url: sitio });
      const r = await fetch('https://api.brevo.com/v3/smtp/email', {
        method: 'POST', headers: { 'api-key': BREVO_API_KEY, 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ sender: { name: process.env.BREVO_SENDER_NAME || 'Tablero Finora', email: BREVO_SENDER_EMAIL }, to: [{ email, name: d.nombre || undefined }],
          subject: c.asunto, htmlContent: c.html, textContent: c.texto, tags: ['recordatorio-ok'] }),
      });
      if (r.ok) { enviados.push(id); recordatorios[id] = new Date(ahora).toISOString(); }
      else { fallidos.push({ id, motivo: 'brevo-' + r.status }); console.error('Brevo', r.status, await r.text().catch(() => '')); }
    }

    // 6) Anotar cuándo se avisó, para respetar la espera
    if (enviados.length) await supabase('/rest/v1/rpc/actualizar_doc', { method: 'POST', body: JSON.stringify({ p_coleccion: 'tareas', p_id: tareaId, p_cambios: { recordatorios } }) });
    const estado = enviados.length ? 200 : (fallidos.length ? 502 : 429);
    return res.status(estado).json({ enviados, omitidos, fallidos });
  } catch (err) {
    console.error('recordar-ok', err);
    return res.status(500).json({ error: 'No se pudo mandar el recordatorio. Probá de nuevo en un rato.' });
  }
}
