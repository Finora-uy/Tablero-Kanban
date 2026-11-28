
/* ===== Código de la tarea: ramas, PRs y commits de GitHub =====
   Los datos los guarda el webhook (api/github-webhook.js) y la versión web los carga en estado.github.
   En el Artifact de Claude no hay GitHub: la sección no aparece. */
const COMMITS_VISIBLES = 5;

/* Usuario de GitHub de cada integrante (campo `github` del perfil) */
// Acepta "emi", "@emi" o el link del perfil (https://github.com/emi) y devuelve "emi"
function limpiarLoginGithub(texto) {
  return String(texto || '').trim().replace(/^https?:\/\/(www\.)?github\.com\//i, '').replace(/^@/, '').split(/[/?#]/)[0].trim();
}
const LOGIN_GITHUB = /^[a-z\d](?:[a-z\d]|-(?=[a-z\d])){0,38}$/i;
const loginValido = l => !l || LOGIN_GITHUB.test(l);
function integranteDeGithub(login, ctx) {
  const l = String(login || '').toLowerCase();
  return l ? ctx.miembros.find(m => m.github && m.github.toLowerCase() === l) || null : null;
}
// Quién hizo algo en GitHub: el integrante si cargó su usuario, si no el @login (o el nombre del commit)
function AutorGithub({ login, nombre, ctx }) {
  const m = integranteDeGithub(login, ctx);
  if (m) return html`<span class="autor-github" title=${'@' + login}><${Avatar} m=${m} t=${16} />${m.nombre}</span>`;
  if (login) return html`<span title="Este usuario de GitHub no está cargado en ningún perfil del equipo">@${login}</span>`;
  return nombre ? html`<span>${nombre}</span>` : null;
}

const marcaFecha = s => { const v = Date.parse(s || ''); return isNaN(v) ? 0 : v; };

function codigoDeTarea(numero, g) {
  const ramas = g.ramas.filter(r => r.tarea === numero)
    .sort((a, b) => (a.borrada ? 1 : 0) - (b.borrada ? 1 : 0) || marcaFecha(b.ultimo_push || b.creada) - marcaFecha(a.ultimo_push || a.creada));
  const prs = g.prs.filter(p => (p.tareas || []).includes(numero)).sort((a, b) => b.numero - a.numero);
  // El mismo commit puede estar en varias ramas: se muestra una sola vez
  const porSha = new Map();
  for (const c of g.commits) if (c.tarea === numero && !porSha.has(c.sha)) porSha.set(c.sha, c);
  const commits = [...porSha.values()].sort((a, b) => marcaFecha(b.fecha) - marcaFecha(a.fecha));
  return { ramas, prs, commits };
}

/* ===== Revisión de PRs: lo puede revisar cualquiera; a las 48 h sin revisar se marca ===== */
const HORAS_ALERTA_REVISION = 48;
const esperaRevision = p => p.estado === 'abierto' && !p.borrador && !p.revision;
const esperandoDesde = p => marcaFecha(p.esperando_desde || p.creado);
const revisionDemorada = (p, ahora = Date.now()) => esperaRevision(p) && esperandoDesde(p) > 0 && ahora - esperandoDesde(p) >= HORAS_ALERTA_REVISION * 3600e3;
// "hace 5 h", "hace 3 días"
function hace(ms, ahora = Date.now()) {
  const h = Math.max(0, Math.floor((ahora - ms) / 3600e3));
  if (h < 1) return 'hace menos de 1 h';
  if (h < 48) return `hace ${h} h`;
  return `hace ${Math.floor(h / 24)} días`;
}

// Estado del PR para mostrar: mergeado, cerrado, borrador, aprobado, cambios pedidos o esperando revisión
function estadoPrVisible(p) {
  if (p.estado === 'mergeado') return { texto: 'PR mergeado', corto: 'Mergeado', clase: 'hecho' };
  if (p.estado === 'cerrado') return { texto: 'Cerrado', corto: 'Cerrado', clase: 'baja' };
  if (p.borrador) return { texto: 'Borrador', corto: 'Borrador', clase: 'baja' };
  if (p.revision === 'aprobado') return { texto: 'Aprobado', corto: 'Aprobado', clase: 'hecho' };
  if (p.revision === 'cambios') return { texto: 'Cambios pedidos', corto: 'Cambios', clase: 'alta' };
  if (revisionDemorada(p)) return { texto: `Sin revisar ${hace(esperandoDesde(p))}`, corto: '+48 h sin revisar', clase: 'alta' };
  return { texto: 'Esperando revisión', corto: 'En revisión', clase: 'media' };
}

// PR que representa a la tarea en la tarjeta: el abierto más nuevo; si no hay, el mergeado más nuevo
let cachePrs = { lista: null, mapa: new Map() };
function prDeTarea(numero) {
  const g = estado.github;
  if (!g || g.error || numero == null) return null;
  if (cachePrs.lista !== g.prs) {
    const mapa = new Map();
    const peso = p => (p.estado === 'abierto' ? 2 : p.estado === 'mergeado' ? 1 : 0);
    for (const p of g.prs) {
      if (p.estado === 'cerrado') continue;
      for (const n of p.tareas || []) {
        const otro = mapa.get(n);
        if (!otro || peso(p) > peso(otro) || (peso(p) === peso(otro) && p.numero > otro.numero)) mapa.set(n, p);
      }
    }
    cachePrs = { lista: g.prs, mapa };
  }
  return cachePrs.mapa.get(numero) || null;
}

// PRs que esperan revisión, del más viejo al más nuevo, sin los míos (no me reviso yo)
function prsParaRevisar(ctx) {
  const g = estado.github;
  if (!g || g.error) return [];
  const yo = ctx.yo && ctx.integrantes.get(ctx.yo);
  const mio = yo && yo.github ? yo.github.toLowerCase() : null;
  return g.prs.filter(p => esperaRevision(p) && !(mio && String(p.autor_login || '').toLowerCase() === mio))
    .sort((a, b) => esperandoDesde(a) - esperandoDesde(b));
}

function InsigniaPr({ t }) {
  const p = prDeTarea(t.numero);
  if (!p) return null;
  const e = estadoPrVisible(p);
  return html`<span class=${'t-pr ' + e.clase} title=${`PR #${p.numero}: ${e.texto}`}><${Icono} n="pr" t=${12} />#${p.numero} ${e.corto}</span>`;
}

// Nombre de rama sugerido según la convención: tipo/fin-n-descripcion
function ramaSugerida(t, ctx) {
  const desc = normalizar(t.titulo).replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  const corta = desc.length > 40 ? desc.slice(0, 40).replace(/-[^-]*$/, '') : desc;
  return `${t.tipo === 'bug' ? 'fix' : 'feature'}/${ctx.prefijo.toLowerCase()}-${t.numero}${corta ? '-' + corta : ''}`;
}

function CodigoDeTarea({ t, ctx }) {
  const [todos, setTodos] = useState(false);
  const g = estado.github;
  if (!g || g.error || t.numero == null) return null;
  const cod = codigo(t, ctx);
  const { ramas, prs, commits } = codigoDeTarea(t.numero, g);
  const vacio = !ramas.length && !prs.length && !commits.length;
  const copiar = async texto => {
    try { await navigator.clipboard.writeText(texto); avisar(`Copiaste ${texto}.`); } catch (_) { avisar(texto); }
  };
  const visibles = todos ? commits : commits.slice(0, COMMITS_VISIBLES);
  const sugerida = ramaSugerida(t, ctx);
  return html`<section class="seccion codigo-tarea">
    <div class="seccion-cab"><h3>Código</h3>${!g.cargado && html`<span class="tenue">Cargando…</span>`}</div>
    ${g.cargado && vacio && html`<div class="codigo-vacio">
      <p class="tenue">Todavía no hay código vinculado. Creá la rama con el código de la tarea en el nombre y, en el PR, sumá la línea <code>Refs: ${cod}</code>.</p>
      <div class="fila codigo-sugerida"><code>${sugerida}</code><button class="btn btn-chico" onClick=${() => copiar(sugerida)}><${Icono} n="copiar" t=${14} />Copiar nombre de rama</button></div>
    </div>`}

    ${prs.length > 0 && html`<ul class="lista-simple">${prs.map(p => {
      const e = estadoPrVisible(p);
      return html`<li key=${'pr' + p.numero}>
        <${Icono} n="pr" t=${15} />
        <span class="crece"><a href=${p.url} target="_blank" rel="noopener noreferrer"><span class="mono">#${p.numero}</span> ${p.titulo}</a>
          <span class="tenue codigo-meta">${p.autor_login && html`<${AutorGithub} login=${p.autor_login} ctx=${ctx} /> · `}${momento(p.mergeado || p.actualizado || p.creado)}</span></span>
        <span class=${'tag ' + e.clase}>${e.texto}</span>
      </li>`;
    })}</ul>`}

    ${ramas.length > 0 && html`<ul class="lista-simple">${ramas.map(r => html`<li key=${'r' + r.nombre} class=${r.borrada ? 'codigo-borrada' : ''}>
      <${Icono} n="rama" t=${15} />
      <span class="crece">${r.url && !r.borrada ? html`<a class="mono" href=${r.url} target="_blank" rel="noopener noreferrer">${r.nombre}</a>` : html`<span class="mono">${r.nombre}</span>`}
        ${r.autor_login && html`<span class="tenue codigo-meta"><${AutorGithub} login=${r.autor_login} ctx=${ctx} /></span>`}</span>
      ${r.borrada ? html`<span class="tag baja">Borrada</span>` : html`<button class="btn-icono chico" aria-label=${'Copiar ' + r.nombre} title="Copiar nombre de la rama" onClick=${() => copiar(r.nombre)}><${Icono} n="copiar" t=${14} /></button>`}
    </li>`)}</ul>`}

    ${commits.length > 0 && html`<div class="codigo-commits">
      <h4 class="etiqueta-mono">Commits <span class="tenue">${commits.length}</span></h4>
      <ul class="lista-simple">${visibles.map(c => html`<li key=${c.sha}>
        <${Icono} n="commit" t=${15} />
        <a class="mono codigo-sha" href=${c.url} target="_blank" rel="noopener noreferrer" title=${c.sha}>${c.sha.slice(0, 7)}</a>
        <span class="crece" title=${c.mensaje}>${(c.mensaje || '').split('\n')[0]}</span>
        <span class="tenue codigo-meta"><${AutorGithub} login=${c.autor_login} nombre=${c.autor} ctx=${ctx} />${c.fecha ? ' · ' + momento(c.fecha) : ''}</span>
      </li>`)}</ul>
      ${commits.length > COMMITS_VISIBLES && html`<button class="btn-link" onClick=${() => setTodos(!todos)}>${todos ? 'Ver menos' : `Ver los ${commits.length} commits`}</button>`}
    </div>`}
  </section>`;
}
