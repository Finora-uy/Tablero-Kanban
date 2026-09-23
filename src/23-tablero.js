
/* ===== Tarjeta ===== */
function Tarjeta({ t, ctx, oculta, editable, alAbrir, alBajar, alTecla, alMenuContexto }) {
  const tipo = TIPO[t.tipo] || TIPO.tarea;
  const hecha = esHecha(t, ctx);
  const pendientes = dependenciasPendientes(t, ctx);
  const bloq = !!t.bloqueada || pendientes.length > 0;
  const venc = !hecha && t.vence ? estadoVence(t.vence, ctx.hoy) : null;
  const items = [...(t.subtareas || []), ...(t.criterios || [])];
  const hechos = items.filter(i => i.hecho).length;
  const nCom = ctx.comentariosPorTarea.get(t.id) || 0;
  const etiquetas = (t.etiquetas || []).map(id => ctx.etiquetasPorId.get(id)).filter(Boolean);
  const mirando = ctx.miradas.get(t.id) || [];
  const cod = codigo(t, ctx);
  const cls = 'tarjeta' + (oculta ? ' origen' : '') + (bloq ? ' bloqueada' : '') + (hecha ? ' hecha' : '') + (editable ? '' : ' solo-lectura');
  const motivo = t.bloqueada ? (t.motivoBloqueo || 'Bloqueada') : `Espera a ${pendientes.map(d => codigo(d, ctx)).join(', ')}`;
  const tieneMeta = t.vence || items.length || nCom || t.estimacion;
  return html`<article class=${cls} data-tarea=${t.id} tabindex="0" role="button"
      aria-label=${`${cod}: ${t.titulo}. ${ctx.colPorId.get(t.columna)?.nombre || ''}${bloq ? '. Bloqueada' : ''}`}
      onPointerDown=${ev => alBajar(ev, t)} onClick=${() => alAbrir(t.id)} onKeyDown=${ev => alTecla(ev, t)} onContextMenu=${alMenuContexto}>
    <div class="t-cab">
      <span class="t-codigo">${cod}</span><span class="t-tipo">${tipo.corto}</span>
      <span class="derecha">
        ${mirando.length > 0 && html`<span class="t-mirando" title=${mirando.map(id => nombreDe(id, ctx)).join(', ') + ' la está mirando'}><${Icono} n="ojo" t=${13} /><${Avatares} ids=${mirando} ctx=${ctx} t=${16} max=${2} /></span>`}
        ${hecha ? html`<span class="tag hecho"><${Icono} n="check" t=${12} />Hecha</span>`
          : (t.prioridad === 'urgente' || t.prioridad === 'alta') && html`<span class=${'tag ' + t.prioridad}>${PRIORIDAD[t.prioridad].nombre}</span>`}
      </span>
    </div>
    <p class="t-titulo">${t.titulo}</p>
    ${etiquetas.length > 0 && html`<div class="t-etiquetas">${etiquetas.map(x => html`<${Etiqueta} key=${x.id} x=${x} />`)}</div>`}
    ${bloq && !hecha && html`<div class="t-bloqueo"><${Icono} n="candado" t=${13} /><span>${motivo}</span></div>`}
    ${(tieneMeta || (t.asignados || []).length > 0) && html`<div class="t-pie">
      <div class="t-meta">
        ${t.vence && html`<span class=${'t-dato ' + (venc || '')} title=${hecha ? 'Vencimiento: ' + fechaLarga(t.vence) : mayus(cuandoVence(t.vence, ctx.hoy)) + ' · ' + fechaLarga(t.vence)}><${Icono} n="calendario" t=${13} />${fechaCorta(t.vence)}</span>`}
        ${items.length > 0 && html`<span class=${'t-dato' + (hechos === items.length ? ' completo' : '')} title="Subtareas y criterios completos"><${Icono} n="checklist" t=${13} />${hechos}/${items.length}</span>`}
        ${nCom > 0 && html`<span class="t-dato" title=${nCom === 1 ? '1 comentario' : nCom + ' comentarios'}><${Icono} n="comentario" t=${13} />${nCom}</span>`}
        ${t.estimacion != null && html`<span class="t-dato" title="Estimación en puntos">${t.estimacion} pts</span>`}
      </div>
      <${Avatares} ids=${t.asignados || []} ctx=${ctx} />
    </div>`}
  </article>`;
}

function AltaRapida({ alCrear, alCerrar }) {
  const [v, setV] = useState('');
  const ref = useAutoFoco();
  const enviar = ev => { ev && ev.preventDefault(); const x = v.trim(); if (!x) return; alCrear(x); setV(''); };
  return html`<form class="alta-rapida" onSubmit=${enviar}>
    <textarea class="entrada" id="alta-rapida" ref=${ref} rows="2" placeholder="Título de la tarea (Enter para agregar)" value=${v}
      onInput=${e => setV(e.target.value)}
      onKeyDown=${e => { if (e.key === 'Enter' && !e.shiftKey) enviar(e); if (e.key === 'Escape') { e.stopPropagation(); alCerrar(); } }}></textarea>
    <div class="fila"><button class="btn btn-primario btn-chico" type="submit" disabled=${!v.trim()}>Agregar</button><button type="button" class="btn btn-fantasma btn-chico" onClick=${alCerrar}>Listo</button></div>
  </form>`;
}

/* ===== Carriles ===== */
function claveCarril(t, carril, ctx) {
  if (carril === 'prioridad') return t.prioridad || 'media';
  if (carril === 'integrante') { const a = (t.asignados || [])[0]; return a && ctx.integrantes.has(a) ? a : 'sin'; }
  return 'todos';
}
function listaCarriles(carril, ctx) {
  if (carril === 'prioridad') return PRIORIDADES.map(p => ({ id: p.id, nombre: p.nombre }));
  if (carril === 'integrante') return [...ctx.miembros.map(m => ({ id: m.id, nombre: m.nombre, m })), { id: 'sin', nombre: 'Sin asignar' }];
  return [{ id: 'todos', nombre: '' }];
}

/* ===== Tablero con arrastrar y soltar ===== */
function Tablero({ ctx, tareas, carril, editable, alAbrir, alNueva }) {
  const contRef = useRef(null);
  const sRef = useRef(null);
  const enfocarRef = useRef(null);
  const suprimirClick = useRef(false);
  const [arr, setArr] = useState(null);
  const [agregando, setAgregando] = useState(null);

  const carriles = listaCarriles(carril, ctx);
  const grupos = new Map();
  for (const t of tareas) {
    const k = claveCarril(t, carril, ctx) + '|' + t.columna;
    if (!grupos.has(k)) grupos.set(k, []);
    grupos.get(k).push(t);
  }
  grupos.forEach(ordenar);
  const datosRef = useRef();
  datosRef.current = { ctx, carril, grupos };

  const totales = new Map();
  for (const t of ctx.tareas) if (!t.archivada) totales.set(t.columna, (totales.get(t.columna) || 0) + 1);

  useEffect(() => {
    const id = enfocarRef.current;
    if (!id || !contRef.current) return;
    const el = contRef.current.querySelector(`[data-tarea="${CSS.escape(id)}"]`);
    if (el) { el.focus({ preventScroll: false }); enfocarRef.current = null; }
  });
  useEffect(() => () => limpiar(), []);

  function alBajar(ev, t) {
    if (!editable || sRef.current) return;
    if (ev.pointerType === 'mouse' && ev.button !== 0) return;
    if (ev.target.closest('button, a, input, select, textarea')) return;
    const el = ev.currentTarget, r = el.getBoundingClientRect();
    const s = { id: t.id, t, el, x0: ev.clientX, y0: ev.clientY, px: ev.clientX, py: ev.clientY, dx: ev.clientX - r.left, dy: ev.clientY - r.top, w: r.width, h: r.height, activo: false, tactil: ev.pointerType !== 'mouse', timer: 0, raf: 0, fantasma: null, destino: null };
    sRef.current = s;
    if (s.tactil) s.timer = setTimeout(activar, 260);
    window.addEventListener('pointermove', alMover, { passive: false });
    window.addEventListener('pointerup', alSoltar);
    window.addEventListener('pointercancel', limpiar);
    window.addEventListener('touchmove', bloquearToque, { passive: false });
  }
  function bloquearToque(ev) { if (sRef.current && sRef.current.activo) ev.preventDefault(); }
  function activar() {
    const s = sRef.current;
    if (!s || s.activo) return;
    s.activo = true;
    const f = s.el.cloneNode(true);
    f.classList.add('fantasma'); f.removeAttribute('tabindex'); f.setAttribute('aria-hidden', 'true');
    f.style.width = s.w + 'px';
    document.body.appendChild(f);
    s.fantasma = f;
    posicionar();
    document.documentElement.classList.add('arrastrando');
    const { ctx: c, carril: ca, grupos: g } = datosRef.current;
    const k = claveCarril(s.t, ca, c);
    const lista = (g.get(k + '|' + s.t.columna) || []).filter(x => x.id !== s.id);
    const indice = (g.get(k + '|' + s.t.columna) || []).findIndex(x => x.id === s.id);
    s.destino = { col: s.t.columna, carril: k, indice: Math.max(0, Math.min(indice, lista.length)) };
    setArr({ id: s.id, h: s.h, destino: s.destino });
    try { navigator.vibrate && navigator.vibrate(8); } catch (_) {}
    s.raf = requestAnimationFrame(bucle);
  }
  function alMover(ev) {
    const s = sRef.current;
    if (!s) return;
    s.px = ev.clientX; s.py = ev.clientY;
    if (!s.activo) {
      const d = Math.hypot(s.px - s.x0, s.py - s.y0);
      if (s.tactil) { if (d > 10) limpiar(); return; }
      if (d < 5) return;
      activar();
    }
    ev.preventDefault();
    posicionar();
    calcularDestino();
  }
  function posicionar() {
    const s = sRef.current;
    if (s && s.fantasma) s.fantasma.style.transform = `translate(${s.px - s.dx}px, ${s.py - s.dy}px) rotate(1.5deg)`;
  }
  function calcularDestino() {
    const s = sRef.current;
    if (!s || !s.activo) return;
    const el = document.elementFromPoint(s.px, s.py);
    const lista = el && el.closest('[data-lista]');
    if (!lista) return;
    const col = lista.dataset.col, car = lista.dataset.carril;
    const tarjetas = [...lista.querySelectorAll(':scope > [data-tarea]')].filter(c => c.dataset.tarea !== s.id);
    let indice = tarjetas.length;
    for (let i = 0; i < tarjetas.length; i++) {
      const r = tarjetas[i].getBoundingClientRect();
      if (s.py < r.top + r.height / 2) { indice = i; break; }
    }
    const d = s.destino;
    if (!d || d.col !== col || d.carril !== car || d.indice !== indice) {
      s.destino = { col, carril: car, indice };
      setArr(a => a && { ...a, destino: s.destino });
    }
  }
  function bucle() {
    const s = sRef.current;
    if (!s || !s.activo) return;
    const c = contRef.current;
    if (c) {
      const r = c.getBoundingClientRect(), m = 64;
      let vx = 0, vy = 0;
      if (s.px < r.left + m) vx = -Math.min(22, Math.ceil((r.left + m - s.px) / 3));
      else if (s.px > r.right - m) vx = Math.min(22, Math.ceil((s.px - (r.right - m)) / 3));
      if (c.scrollHeight > c.clientHeight) {
        if (s.py < r.top + m) vy = -Math.min(18, Math.ceil((r.top + m - s.py) / 3));
        else if (s.py > r.bottom - m) vy = Math.min(18, Math.ceil((s.py - (r.bottom - m)) / 3));
      }
      if (vx) c.scrollLeft += vx;
      if (vy) c.scrollTop += vy;
      const el = document.elementFromPoint(s.px, s.py);
      const lista = el && el.closest('.col-lista');
      let vl = 0;
      if (lista && lista.scrollHeight > lista.clientHeight) {
        const lr = lista.getBoundingClientRect();
        if (s.py < lr.top + 40) vl = -8; else if (s.py > lr.bottom - 40) vl = 8;
        if (vl) lista.scrollTop += vl;
      }
      if (vx || vy || vl) calcularDestino();
    }
    s.raf = requestAnimationFrame(bucle);
  }
  function alSoltar() {
    const s = sRef.current;
    if (!s) return;
    if (s.activo) {
      suprimirClick.current = true;
      setTimeout(() => { suprimirClick.current = false; }, 60);
      soltarEn(s);
    }
    limpiar();
  }
  function limpiar() {
    const s = sRef.current;
    window.removeEventListener('pointermove', alMover);
    window.removeEventListener('pointerup', alSoltar);
    window.removeEventListener('pointercancel', limpiar);
    window.removeEventListener('touchmove', bloquearToque);
    if (!s) return;
    clearTimeout(s.timer);
    cancelAnimationFrame(s.raf);
    if (s.fantasma) s.fantasma.remove();
    document.documentElement.classList.remove('arrastrando');
    sRef.current = null;
    setArr(null);
  }
  function calcularOrden(lista, indice, t) {
    const antes = lista[indice - 1], despues = lista[indice];
    if (antes && despues) return { orden: (antes.orden + despues.orden) / 2, justo: Math.abs(despues.orden - antes.orden) < 1e-6 };
    if (antes) return { orden: antes.orden + 1024 };
    if (despues) return { orden: despues.orden - 1024 };
    return { orden: t.orden ?? 1024 };
  }
  function soltarEn(s) {
    const d = s.destino;
    if (!d) return;
    const { ctx: c, carril: ca, grupos: g } = datosRef.current;
    const t = c.porId.get(s.id);
    if (!t) return;
    const lista = (g.get(d.carril + '|' + d.col) || []).filter(x => x.id !== s.id);
    const extra = {};
    if (ca !== 'ninguno' && d.carril !== claveCarril(t, ca, c)) {
      if (ca === 'prioridad') { extra.prioridad = d.carril; extra.__que = `cambió la prioridad a ${PRIORIDAD[d.carril].nombre}`; }
      if (ca === 'integrante') {
        const viejo = claveCarril(t, ca, c);
        const resto = (t.asignados || []).filter(x => x !== viejo && x !== d.carril);
        extra.asignados = d.carril === 'sin' ? [] : [d.carril, ...resto];
        extra.__que = d.carril === 'sin' ? 'la dejó sin asignar' : `se la asignó a ${nombreDe(d.carril, c)}`;
      }
    }
    const original = (g.get(claveCarril(t, ca, c) + '|' + t.columna) || []).findIndex(x => x.id === t.id);
    if (d.col === t.columna && !Object.keys(extra).length && d.indice === original) return;
    const { orden, justo } = calcularOrden(lista, d.indice, t);
    if (justo) {
      const ids = lista.map(x => x.id);
      ids.splice(d.indice, 0, t.id);
      acciones.moverTarea(t.id, d.col, d.indice * 1024 + 1024, extra).then(() => acciones.renumerar(d.col, ids));
    } else {
      acciones.moverTarea(t.id, d.col, orden, extra);
    }
    enfocarRef.current = t.id;
  }
  function alAbrirTarjeta(id) {
    if (suprimirClick.current) return;
    alAbrir(id);
  }
  function alMenuContexto(ev) { if (sRef.current) ev.preventDefault(); }
  function alTecla(ev, t) {
    if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); alAbrir(t.id); return; }
    if (!ev.altKey || !editable) return;
    const { ctx: c, carril: ca, grupos: g } = datosRef.current;
    const k = claveCarril(t, ca, c);
    if (ev.key === 'ArrowLeft' || ev.key === 'ArrowRight') {
      ev.preventDefault();
      const i = c.columnas.findIndex(x => x.id === t.columna);
      const nc = c.columnas[i + (ev.key === 'ArrowRight' ? 1 : -1)];
      if (!nc) return;
      const lista = g.get(k + '|' + nc.id) || [];
      acciones.moverTarea(t.id, nc.id, lista.length ? lista[lista.length - 1].orden + 1024 : 1024);
      enfocarRef.current = t.id;
    } else if (ev.key === 'ArrowUp' || ev.key === 'ArrowDown') {
      ev.preventDefault();
      const lista = g.get(k + '|' + t.columna) || [];
      const i = lista.findIndex(x => x.id === t.id);
      const sin = lista.filter(x => x.id !== t.id);
      const nuevo = ev.key === 'ArrowUp' ? i - 1 : i + 1;
      if (nuevo < 0 || nuevo > sin.length) return;
      const { orden } = calcularOrden(sin, nuevo, t);
      acciones.moverTarea(t.id, t.columna, orden);
      enfocarRef.current = t.id;
    }
  }

  function renderLista(col, car) {
    const lista = grupos.get(car + '|' + col.id) || [];
    const destinoAqui = arr && arr.destino && arr.destino.col === col.id && arr.destino.carril === car;
    const hueco = html`<div key="__hueco" class="hueco" style=${`height:${arr ? arr.h : 60}px`} aria-hidden="true"></div>`;
    const items = [];
    let vi = 0;
    for (const t of lista) {
      if (arr && t.id === arr.id) { items.push(html`<${Tarjeta} key=${t.id} t=${t} ctx=${ctx} oculta editable=${editable} alAbrir=${alAbrirTarjeta} alBajar=${alBajar} alTecla=${alTecla} alMenuContexto=${alMenuContexto} />`); continue; }
      if (destinoAqui && vi === arr.destino.indice) items.push(hueco);
      items.push(html`<${Tarjeta} key=${t.id} t=${t} ctx=${ctx} editable=${editable} alAbrir=${alAbrirTarjeta} alBajar=${alBajar} alTecla=${alTecla} alMenuContexto=${alMenuContexto} />`);
      vi++;
    }
    if (destinoAqui && arr.destino.indice >= vi) items.push(hueco);
    const visibles = lista.filter(t => !arr || t.id !== arr.id).length;
    if (!visibles && !destinoAqui && carril === 'ninguno') items.push(html`<p key="__vacia" class="col-vacia">${editable ? 'Arrastrá tareas acá' : 'Sin tareas'}</p>`);
    return items;
  }
  function cabeceraColumna(col, conAlta) {
    const total = totales.get(col.id) || 0;
    const lim = col.limiteWip || 0;
    const clase = lim ? (total > lim ? ' excedido' : total === lim ? ' lleno' : '') : '';
    const tituloCuenta = lim ? `${total} de ${lim} tareas (límite de trabajo en curso)` : `${total} tareas`;
    return html`<header class="col-cab">
      <h2 class="col-nombre">${col.nombre}</h2>
      <span class=${'col-cuenta' + clase} title=${tituloCuenta}>${lim ? `${total}/${lim}` : total}</span>
      ${col.final && html`<span title="Columna final: lo que llega acá cuenta como hecho"><${Icono} n="check" clase="col-final" t=${15} /></span>`}
      ${editable && html`<button class="btn-icono" aria-label=${'Agregar tarea en ' + col.nombre} title="Agregar tarea" onClick=${() => conAlta ? setAgregando(col.id) : alNueva({ columna: col.id })}><${Icono} n="mas" /></button>`}
    </header>`;
  }

  if (carril === 'ninguno') {
    return html`<div class="tablero" ref=${contRef}>
      ${ctx.columnas.map(col => html`<section class="columna" key=${col.id} aria-label=${col.nombre}>
        ${cabeceraColumna(col, true)}
        <div class="col-lista" data-lista data-col=${col.id} data-carril="todos">${renderLista(col, 'todos')}</div>
        ${editable && (agregando === col.id
          ? html`<${AltaRapida} alCerrar=${() => setAgregando(null)} alCrear=${titulo => acciones.crearTarea({ titulo, columna: col.id }).then(r => r && avisar(`Creaste ${ctx.prefijo}-${r.numero}.`))} />`
          : html`<button class="col-agregar" onClick=${() => setAgregando(col.id)}><${Icono} n="mas" />Agregar tarea</button>`)}
      </section>`)}
    </div>`;
  }
  return html`<div class="tablero con-carriles" ref=${contRef}>
    <div class="grilla-carriles" style=${`grid-template-columns:repeat(${ctx.columnas.length}, 280px)`}>
      ${ctx.columnas.map(col => html`<div key=${'cab-' + col.id}>${cabeceraColumna(col, false)}</div>`)}
      ${carriles.map(l => {
        const n = ctx.columnas.reduce((a, col) => a + (grupos.get(l.id + '|' + col.id) || []).length, 0);
        return [
          html`<div class="carril-cab" key=${'l-' + l.id}><span>${l.m && html`<${Avatar} m=${l.m} t=${22} />`}${l.nombre}<span class="mono">${n}</span></span></div>`,
          ...ctx.columnas.map(col => html`<div key=${l.id + '-' + col.id} class="celda" data-lista data-col=${col.id} data-carril=${l.id}>${renderLista(col, l.id)}</div>`),
        ];
      })}
    </div>
  </div>`;
}
