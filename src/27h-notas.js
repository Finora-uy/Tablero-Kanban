/* ===== Notas (post-its que se borran solos) y panel "Requiere tu atención" ===== */
const NOTA_DURA_MS = 5 * 24 * 3600e3; // cada post-it vive 5 días
const NOTA_MAX = 280;
const COLORES_NOTA = [
  { id: 'amarillo', nombre: 'Amarillo' }, { id: 'verde', nombre: 'Verde' },
  { id: 'azul', nombre: 'Azul' }, { id: 'rosa', nombre: 'Rosa' },
];
const notaVencida = (n, ahora = Date.now()) => !n.creadaEn || ahora - new Date(n.creadaEn) >= NOTA_DURA_MS;
const DIAS_NOTA = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];
const cuandoNota = iso => { const d = new Date(iso), p = n => String(n).padStart(2, '0'); return `${DIAS_NOTA[d.getDay()]} ${d.getDate()}/${d.getMonth() + 1} · ${p(d.getHours())}:${p(d.getMinutes())}`; };
function quedaNota(n) {
  const ms = new Date(n.creadaEn).getTime() + NOTA_DURA_MS - Date.now();
  const h = Math.ceil(ms / 3600e3);
  if (h <= 1) return 'se borra en menos de 1 hora';
  if (h < 24) return `se borra en ${h} horas`;
  const d = Math.ceil(h / 24);
  return d === 1 ? 'se borra mañana' : `se borra en ${d} días`;
}

const accionesNotas = {
  crear(texto, color) {
    const yoId = yo();
    if (!yoId) { avisar('Sumate al tablero (menú de tu perfil) para dejar notas.', 'error'); return Promise.resolve(false); }
    const limpio = texto.trim().slice(0, NOTA_MAX);
    if (!limpio) return Promise.resolve(false);
    return conManejo(backend.crear('notas/' + backend.nuevoId('notas'), { texto: limpio, color: color || 'amarillo', autor: yoId, creadaEn: ahoraISO() }));
  },
  borrar(id) { return conManejo(backend.borrar('notas/' + id)); },
  // Cualquiera que tenga el tablero abierto borra las vencidas (si dos lo hacen a la vez, no pasa nada)
  limpiarVencidas() {
    for (const [id, n] of estado.notas) if (notaVencida(n)) backend.borrar('notas/' + id).catch(() => {});
  },
};

function PanelNotas({ ctx, editable }) {
  const [escribiendo, setEscribiendo] = useState(false);
  const [texto, setTexto] = useState('');
  const [color, setColor] = useState('amarillo');
  const [guardando, setGuardando] = useState(false);
  // Repasa los vencimientos al abrir y cada 10 minutos
  const [, setTic] = useState(0);
  useEffect(() => {
    if (editable) accionesNotas.limpiarVencidas();
    const id = setInterval(() => { setTic(n => n + 1); if (editable) accionesNotas.limpiarVencidas(); }, 600000);
    return () => clearInterval(id);
  }, [editable]);
  const notas = ctx.notas.filter(n => !notaVencida(n));
  const publicar = async () => {
    if (!texto.trim() || guardando) return;
    setGuardando(true);
    const ok = await accionesNotas.crear(texto, color);
    setGuardando(false);
    if (ok) { setTexto(''); setEscribiendo(false); }
  };
  return html`<section class="columna col-notas" aria-label="Notas">
    <header class="col-cab">
      <h2 class="col-nombre">Notas</h2>
      <span class="col-cuenta" title=${notas.length + ' notas'}>${notas.length}</span>
      ${editable && html`<button class="btn-icono" aria-label="Dejar una nota" title="Dejar una nota" onClick=${() => setEscribiendo(true)}><${Icono} n="mas" /></button>`}
    </header>
    <div class="col-lista">
      ${escribiendo && html`<div class=${'postit nueva c-' + color}>
        <textarea class="entrada" aria-label="Texto de la nota" placeholder="Escribí tu nota para el equipo…" maxlength=${NOTA_MAX} value=${texto} autofocus
          onInput=${e => setTexto(e.target.value)}
          onKeyDown=${e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); publicar(); } if (e.key === 'Escape') { e.stopPropagation(); setEscribiendo(false); } }}></textarea>
        <div class="postit-colores" role="group" aria-label="Color">
          ${COLORES_NOTA.map(c => html`<button key=${c.id} type="button" class=${'postit-color c-' + c.id} aria-label=${c.nombre} aria-pressed=${color === c.id} onClick=${() => setColor(c.id)}></button>`)}
          <span class="mono tenue">${texto.length}/${NOTA_MAX}</span>
        </div>
        <div class="fila">
          <button class="btn btn-primario btn-chico" disabled=${!texto.trim() || guardando} onClick=${publicar}>Pegar nota</button>
          <button class="btn btn-fantasma btn-chico" onClick=${() => { setEscribiendo(false); setTexto(''); }}>Cancelar</button>
        </div>
      </div>`}
      ${notas.map(n => html`<${PostIt} key=${n.id} n=${n} ctx=${ctx} editable=${editable} />`)}
      ${!notas.length && !escribiendo && html`<p class="col-vacia">${editable ? 'Dejá una nota para el equipo. Se borra sola a los 5 días.' : 'Sin notas.'}</p>`}
    </div>
    ${editable && !escribiendo && html`<button class="col-agregar" onClick=${() => setEscribiendo(true)}><${Icono} n="mas" />Dejar una nota</button>`}
  </section>`;
}

function PostIt({ n, ctx, editable }) {
  const [confirmar, setConfirmar] = useState(false);
  const autor = ctx.integrantes.get(n.autor);
  const mia = editable && n.autor === ctx.yo;
  return html`<article class=${'postit c-' + (n.color || 'amarillo')}>
    <p class="postit-texto">${n.texto}</p>
    <footer class="postit-pie">
      <${Avatar} m=${autor} t=${20} />
      <span class="postit-quien"><strong>${autor ? autor.nombre : 'Alguien'}</strong><span class="postit-cuando">${cuandoNota(n.creadaEn)}</span></span>
      ${mia && (confirmar
        ? html`<span class="fila"><button class="btn btn-peligro btn-chico" onClick=${() => accionesNotas.borrar(n.id)}>Borrar</button><button class="btn btn-fantasma btn-chico" onClick=${() => setConfirmar(false)}>No</button></span>`
        : html`<button class="btn-icono chico" title="Borrar la nota" aria-label="Borrar la nota" onClick=${() => setConfirmar(true)}><${Icono} n="basura" t=${14} /></button>`)}
    </footer>
    <span class="postit-vence" title=${'Se publicó el ' + cuandoNota(n.creadaEn)}><${Icono} n="reloj" t=${12} />${quedaNota(n)}</span>
  </article>`;
}

/* ----- Requiere tu atención ----- */
function pendientesDe(ctx) {
  if (!ctx.yo) return { ok: [], vencen: [] };
  const vivas = ctx.tareas.filter(t => !t.archivada && !esHecha(t, ctx));
  const ok = vivas.filter(t => {
    const asig = (t.asignados || []).filter(id => ctx.integrantes.has(id));
    return esRevision(t.columna) && asig.length >= 2 && asig.includes(ctx.yo) && !(t.aprobaciones || []).includes(ctx.yo);
  });
  const vencen = vivas
    .filter(t => t.vence && (t.asignados || []).includes(ctx.yo) && diasEntre(ctx.hoy, t.vence) <= 2 && !ok.includes(t))
    .sort((a, b) => a.vence.localeCompare(b.vence));
  return { ok, vencen };
}

function PanelAtencion({ ctx, alAbrir }) {
  const [abierto, setAbiertoS] = useState(() => leer('finora-atencion') !== 'cerrado');
  const setAbierto = v => { setAbiertoS(v); guardar('finora-atencion', v ? 'abierto' : 'cerrado'); };
  if (!ctx.yo) return null;
  const { ok, vencen } = pendientesDe(ctx);
  const total = ok.length + vencen.length;
  const fila = (t, detalle, clase) => html`<li key=${t.id}><button class="atencion-item" onClick=${() => alAbrir(t.id)}>
    <span class="mono tenue">${codigo(t, ctx)}</span>
    <span class="atencion-titulo">${t.titulo}</span>
    <span class=${'atencion-detalle ' + (clase || '')}>${detalle}</span>
  </button></li>`;
  if (!abierto) {
    return html`<aside class="atencion cerrada" aria-label="Requiere tu atención">
      <button class="atencion-abrir" onClick=${() => setAbierto(true)} title="Mostrar lo que requiere tu atención" aria-expanded="false">
        <${Icono} n="bandera" t=${16} />${total > 0 && html`<span class="atencion-cuenta">${total}</span>`}
      </button>
    </aside>`;
  }
  return html`<aside class="atencion" aria-label="Requiere tu atención">
    <header class="atencion-cab">
      <h2>Requiere tu atención</h2>
      ${total > 0 && html`<span class="atencion-cuenta">${total}</span>`}
      <button class="btn-icono chico" onClick=${() => setAbierto(false)} title="Ocultar el panel" aria-label="Ocultar el panel" aria-expanded="true"><${Icono} n="der" t=${16} /></button>
    </header>
    <div class="atencion-cuerpo">
      ${!total && html`<p class="atencion-vacio"><${Icono} n="check" t=${16} />Estás al día: no tenés OK pendientes ni tareas por vencer.</p>`}
      ${ok.length > 0 && html`<section>
        <h3>Falta tu OK <span class="mono tenue">${ok.length}</span></h3>
        <ul>${ok.map(t => {
          const asig = (t.asignados || []).filter(id => ctx.integrantes.has(id));
          const n = asig.filter(id => (t.aprobaciones || []).includes(id)).length;
          const quien = t.recordatorios && t.recordatorios[ctx.yo] ? ' · te lo recordaron' : '';
          return fila(t, `OK ${n}/${asig.length}${quien}`, quien ? 'pronto' : '');
        })}</ul>
      </section>`}
      ${vencen.length > 0 && html`<section>
        <h3>Tus tareas por vencer <span class="mono tenue">${vencen.length}</span></h3>
        <ul>${vencen.map(t => fila(t, mayus(cuandoVence(t.vence, ctx.hoy)) + ' · ' + nombreColumna(t.columna), estadoVence(t.vence, ctx.hoy)))}</ul>
      </section>`}
    </div>
  </aside>`;
}
