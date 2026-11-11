
/* ===== Código de la tarea: ramas, PRs y commits de GitHub =====
   Los datos los guarda el webhook (api/github-webhook.js) y la versión web los carga en estado.github.
   En el Artifact de Claude no hay GitHub: la sección no aparece. */
const COMMITS_VISIBLES = 5;
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

// Estado del PR para mostrar: mergeado, cerrado, borrador, aprobado, cambios pedidos o esperando revisión
function estadoPrVisible(p) {
  if (p.estado === 'mergeado') return { texto: 'PR mergeado', clase: 'hecho' };
  if (p.estado === 'cerrado') return { texto: 'Cerrado', clase: 'baja' };
  if (p.borrador) return { texto: 'Borrador', clase: 'baja' };
  if (p.revision === 'aprobado') return { texto: 'Aprobado', clase: 'hecho' };
  if (p.revision === 'cambios') return { texto: 'Cambios pedidos', clase: 'alta' };
  return { texto: 'Esperando revisión', clase: 'media' };
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
          <span class="tenue codigo-meta">${p.autor_login ? '@' + p.autor_login + ' · ' : ''}${momento(p.mergeado || p.actualizado || p.creado)}</span></span>
        <span class=${'tag ' + e.clase}>${e.texto}</span>
      </li>`;
    })}</ul>`}

    ${ramas.length > 0 && html`<ul class="lista-simple">${ramas.map(r => html`<li key=${'r' + r.nombre} class=${r.borrada ? 'codigo-borrada' : ''}>
      <${Icono} n="rama" t=${15} />
      <span class="crece">${r.url && !r.borrada ? html`<a class="mono" href=${r.url} target="_blank" rel="noopener noreferrer">${r.nombre}</a>` : html`<span class="mono">${r.nombre}</span>`}</span>
      ${r.borrada ? html`<span class="tag baja">Borrada</span>` : html`<button class="btn-icono chico" aria-label=${'Copiar ' + r.nombre} title="Copiar nombre de la rama" onClick=${() => copiar(r.nombre)}><${Icono} n="copiar" t=${14} /></button>`}
    </li>`)}</ul>`}

    ${commits.length > 0 && html`<div class="codigo-commits">
      <h4 class="etiqueta-mono">Commits <span class="tenue">${commits.length}</span></h4>
      <ul class="lista-simple">${visibles.map(c => html`<li key=${c.sha}>
        <${Icono} n="commit" t=${15} />
        <a class="mono codigo-sha" href=${c.url} target="_blank" rel="noopener noreferrer" title=${c.sha}>${c.sha.slice(0, 7)}</a>
        <span class="crece" title=${c.mensaje}>${(c.mensaje || '').split('\n')[0]}</span>
        <span class="tenue codigo-meta">${c.autor_login ? '@' + c.autor_login : c.autor || ''}${c.fecha ? ' · ' + momento(c.fecha) : ''}</span>
      </li>`)}</ul>
      ${commits.length > COMMITS_VISIBLES && html`<button class="btn-link" onClick=${() => setTodos(!todos)}>${todos ? 'Ver menos' : `Ver los ${commits.length} commits`}</button>`}
    </div>`}
  </section>`;
}
