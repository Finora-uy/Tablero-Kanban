
/* ===== Íconos (trazo 1,8) ===== */
const RUTAS = {
  buscar: 'M11 4a7 7 0 1 0 0 14a7 7 0 0 0 0-14zM20 20l-4-4',
  mas: 'M12 5v14M5 12h14',
  cerrar: 'M6 6l12 12M18 6L6 18',
  calendario: 'M4 6h16v14H4zM4 10h16M8 3v4M16 3v4',
  check: 'M4 12l5 5L20 6',
  checklist: 'M4 4h16v16H4zM8 12l3 3 5-6',
  comentario: 'M4 5h16v11H9l-5 4z',
  candado: 'M6 11h12v9H6zM8 11V8a4 4 0 0 1 8 0v3',
  enlace: 'M10 14a4 4 0 0 0 5.66 0l3-3a4 4 0 0 0-5.66-5.66l-1 1M14 10a4 4 0 0 0-5.66 0l-3 3a4 4 0 0 0 5.66 5.66l1-1',
  ajustes: 'M4 7h9M17 7h3M15 5v4M4 17h3M11 17h9M9 15v4',
  bandera: 'M5 21V4M5 4h11l-2 4 2 4H5',
  archivo: 'M3 4h18v4H3zM5 8v12h14V8M10 12h4',
  basura: 'M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13',
  copiar: 'M8 8h12v12H8zM4 16V4h12',
  ayuda: 'M12 3a9 9 0 1 0 0 18a9 9 0 0 0 0-18zM9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .9-1 1.6M12 17h.01',
  descargar: 'M12 4v11M7 10l5 5 5-5M5 20h14',
  subir: 'M12 20V9M7 14l5-5 5 5M5 4h14',
  izq: 'M15 6l-6 6 6 6',
  der: 'M9 6l6 6-6 6',
  usuario: 'M12 12a4 4 0 1 0 0-8a4 4 0 0 0 0 8zM4 21a8 8 0 0 1 16 0',
  usuarios: 'M9 11a3.5 3.5 0 1 0 0-7a3.5 3.5 0 0 0 0 7zM2.5 20a6.5 6.5 0 0 1 13 0M16 4.5a3.5 3.5 0 0 1 0 6.5M18 14a6.5 6.5 0 0 1 3.5 6',
  ojo: 'M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12zM12 9a3 3 0 1 0 0 6a3 3 0 0 0 0-6z',
  historial: 'M3 12a9 9 0 1 0 3-6.7M3 4v4h4M12 8v4l3 2',
  reloj: 'M12 3a9 9 0 1 0 0 18a9 9 0 0 0 0-18zM12 7v5l3 2',
  cambiar: 'M4 8h13l-3-3M20 16H7l3 3',
  teclado: 'M3 6h18v12H3zM7 10h.01M11 10h.01M15 10h.01M7 14h10',
  filtro: 'M4 5h16l-6 8v6l-4-2v-4z',
  vincular: 'M9 15l6-6M10 6l1-1a4 4 0 0 1 6 6l-1 1M14 18l-1 1a4 4 0 0 1-6-6l1-1',
  salir: 'M14 4h5v16h-5M10 8l-4 4 4 4M6 12h10',
  sobre: 'M3 6h18v12H3zM3 7l9 6 9-6',
};
function Icono({ n, t = 16, clase = '' }) {
  return html`<svg class=${'ic ' + clase} width=${t} height=${t} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d=${RUTAS[n]} /></svg>`;
}
// Isotipo "Llena": cuatro puntas de radio 22 sobre 48×48; manijas sobre los ejes a 0,387·r.
function Chispa({ t = 30 }) {
  return html`<svg width=${t} height=${t} viewBox="-6 -6 60 60" aria-hidden="true"><path fill="var(--amber)" d="M24 2C24 15.486 32.514 24 46 24C32.514 24 24 32.514 24 46C24 32.514 15.486 24 2 24C15.486 24 24 15.486 24 2Z" /></svg>`;
}
function Avatar({ m, t = 24, titulo }) {
  const nombre = m ? m.nombre : 'Ex integrante';
  const color = m && m.color ? m.color : 'pizarra';
  return html`<span class="avatar" style=${`--av:var(--m-${color});width:${t}px;height:${t}px;font-size:${Math.max(9, Math.round(t * 0.4))}px`} title=${titulo || nombre} aria-label=${titulo || nombre}>${iniciales(nombre)}</span>`;
}
function Avatares({ ids, ctx, max = 3, t = 22 }) {
  const lista = ids.map(id => ctx.integrantes.get(id)).filter(Boolean);
  if (!lista.length) return null;
  const extra = lista.length - max;
  return html`<span class="avatares">${lista.slice(0, max).map(m => html`<${Avatar} key=${m.id} m=${m} t=${t} />`)}${extra > 0 && html`<span class="avatar" style=${`width:${t}px;height:${t}px;--av:var(--line-2);color:var(--text)`} title=${lista.slice(max).map(m => m.nombre).join(', ')}>+${extra}</span>`}</span>`;
}

/* ===== Hooks ===== */
function useMedia(q) {
  const [ok, setOk] = useState(() => window.matchMedia(q).matches);
  useEffect(() => {
    const mq = window.matchMedia(q), f = () => setOk(mq.matches);
    mq.addEventListener('change', f);
    return () => mq.removeEventListener('change', f);
  }, [q]);
  return ok;
}
function useAutoFoco() {
  const ref = useRef(null);
  useEffect(() => { const el = ref.current; if (el) { el.focus(); if (el.select && el.value) el.select(); } }, []);
  return ref;
}
function useAutoAlto(ref, valor) {
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = el.scrollHeight + 2 + 'px';
  }, [valor]);
}
// Borrador local para texto: guarda con pausa y al salir del campo, y no pisa lo que estás escribiendo.
function useBorrador(remoto, alGuardar, demora = 700) {
  const [valor, setValor] = useState(remoto || '');
  const r = useRef({ sucio: false, foco: false, timer: 0, valor: remoto || '', remoto: remoto || '', alGuardar });
  r.current.alGuardar = alGuardar;
  r.current.remoto = remoto || '';
  useEffect(() => {
    const s = r.current;
    if (!s.sucio && !s.foco) { s.valor = remoto || ''; setValor(s.valor); }
  }, [remoto]);
  const volcar = useCallback(() => {
    const s = r.current;
    clearTimeout(s.timer);
    if (s.sucio) { s.sucio = false; s.alGuardar(s.valor); }
  }, []);
  useEffect(() => volcar, []);
  return {
    value: valor,
    onInput: ev => {
      const s = r.current;
      s.valor = ev.target.value; s.sucio = true; setValor(s.valor);
      clearTimeout(s.timer); s.timer = setTimeout(volcar, demora);
    },
    onFocus: () => { r.current.foco = true; },
    onBlur: () => {
      const s = r.current;
      s.foco = false;
      const estabaSucio = s.sucio;
      volcar();
      if (!estabaSucio && s.valor !== s.remoto) { s.valor = s.remoto; setValor(s.valor); }
    },
  };
}

/* ===== Piezas de interfaz ===== */
function Desplegable({ etiqueta, activo, alinear = '', clase = 'btn-filtro', titulo, children }) {
  const [abierto, setAbierto] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    if (!abierto) return;
    const fuera = ev => { if (ref.current && !ref.current.contains(ev.target)) setAbierto(false); };
    const tecla = ev => { if (ev.key === 'Escape') { ev.stopPropagation(); setAbierto(false); ref.current?.querySelector('button')?.focus(); } };
    document.addEventListener('pointerdown', fuera);
    document.addEventListener('keydown', tecla);
    return () => { document.removeEventListener('pointerdown', fuera); document.removeEventListener('keydown', tecla); };
  }, [abierto]);
  const cerrar = () => setAbierto(false);
  return html`<div class="despl" ref=${ref}>
    <button type="button" class=${clase + (activo ? ' activo' : '')} aria-expanded=${abierto} title=${titulo} onClick=${() => setAbierto(!abierto)}>${etiqueta}</button>
    ${abierto && html`<div class=${'despl-panel ' + alinear}>${typeof children === 'function' ? children(cerrar) : children}</div>`}
  </div>`;
}
function OpcionesMulti({ opciones, valor, alCambiar, idBase }) {
  return html`<div role="group">
    ${opciones.map(o => html`<label class="opcion" key=${o.id}>
      <input type="checkbox" id=${idBase + '-' + o.id} checked=${valor.includes(o.id)} onChange=${() => alCambiar(valor.includes(o.id) ? valor.filter(x => x !== o.id) : [...valor, o.id])} />
      ${o.pre}<span>${o.nombre}</span>
    </label>`)}
    ${valor.length > 0 && html`<div class="opciones-pie"><span class="tenue">${valor.length} elegidos</span><button class="btn-link" onClick=${() => alCambiar([])}>Limpiar</button></div>`}
  </div>`;
}
function FiltroMulti({ nombre, opciones, valor, alCambiar, idBase }) {
  const etq = html`${nombre}${valor.length ? html` <span class="cuenta">${valor.length}</span>` : null} <span class="caret">▾</span>`;
  return html`<${Desplegable} etiqueta=${etq} activo=${valor.length > 0}>
    <${OpcionesMulti} opciones=${opciones} valor=${valor} alCambiar=${alCambiar} idBase=${idBase} />
  <//>`;
}
function Modal({ titulo, alCerrar, ancho = 520, pie, children }) {
  const ref = useRef(null);
  useEffect(() => {
    const previo = document.activeElement;
    const el = ref.current && ref.current.querySelector('[data-foco]') || ref.current?.querySelector('input, textarea, select, button:not(.btn-icono)');
    el?.focus();
    return () => { try { previo?.focus?.(); } catch (_) {} };
  }, []);
  return html`<div class="modal-velo" onPointerDown=${ev => { if (ev.target === ev.currentTarget) alCerrar(); }}>
    <div class="modal" role="dialog" aria-modal="true" aria-label=${titulo} style=${`max-width:${ancho}px`} ref=${ref}>
      <header class="modal-cab"><h2>${titulo}</h2><button class="btn-icono" onClick=${alCerrar} aria-label="Cerrar"><${Icono} n="cerrar" /></button></header>
      <div class="modal-cuerpo">${children}</div>
      ${pie && html`<footer class="modal-pie">${pie}</footer>`}
    </div>
  </div>`;
}
function ChipsIntegrantes({ ctx, valor, alCambiar, editable = true }) {
  if (!ctx.miembros.length) return html`<span class="tenue">Todavía no hay integrantes. Sumalos desde Equipo.</span>`;
  return html`<div class="selector-chips">${ctx.miembros.map(m => {
    const on = valor.includes(m.id);
    return html`<button type="button" key=${m.id} class="chip-btn" aria-pressed=${on} disabled=${!editable} onClick=${() => alCambiar(on ? valor.filter(x => x !== m.id) : [...valor, m.id], m, !on)}>
      <${Avatar} m=${m} t=${22} />${m.nombre}${m.id === ctx.yo ? ' (vos)' : ''}
    </button>`;
  })}</div>`;
}
function ChipsEtiquetas({ ctx, valor, alCambiar, editable = true }) {
  return html`<div class="selector-chips">${ctx.etiquetas.map(x => {
    const on = valor.includes(x.id);
    return html`<button type="button" key=${x.id} class="chip-btn solo-texto" style=${`--c:var(--c-${x.color})`} aria-pressed=${on} disabled=${!editable} onClick=${() => alCambiar(on ? valor.filter(y => y !== x.id) : [...valor, x.id], x, !on)}>
      <span class="punto"></span>${x.nombre}
    </button>`;
  })}</div>`;
}
function Etiqueta({ x }) { return html`<span class="chip" style=${`--c:var(--c-${x.color})`}>${x.nombre}</span>`; }
function ConEnlaces({ texto }) {
  const partes = [];
  const re = /https?:\/\/[^\s<]+[^\s<.,;:!?)\]'"]/g;
  let i = 0, m;
  while ((m = re.exec(texto))) {
    if (m.index > i) partes.push(texto.slice(i, m.index));
    partes.push(html`<a href=${m[0]} target="_blank" rel="noopener noreferrer">${m[0]}</a>`);
    i = m.index + m[0].length;
  }
  if (i < texto.length) partes.push(texto.slice(i));
  return partes;
}
function TextoEditable({ valor, editable, alGuardar, id }) {
  const [v, setV] = useState(valor);
  const foco = useRef(false);
  useEffect(() => { if (!foco.current) setV(valor); }, [valor]);
  if (!editable) return html`<span class="ck-texto">${valor}</span>`;
  return html`<input class="ck-texto" id=${id} type="text" value=${v} aria-label="Editar texto"
    onInput=${e => setV(e.target.value)} onFocus=${() => { foco.current = true; }}
    onBlur=${() => { foco.current = false; const x = v.trim(); if (x && x !== valor) alGuardar(x); else setV(valor); }}
    onKeyDown=${e => { if (e.key === 'Enter') e.currentTarget.blur(); if (e.key === 'Escape') { e.stopPropagation(); setV(valor); setTimeout(() => e.target.blur()); } }} />`;
}
function Checklist({ titulo, items, alCambiar, editable, placeholder, idBase }) {
  const [nuevo, setNuevo] = useState('');
  const hechos = items.filter(i => i.hecho).length;
  const agregar = () => {
    const x = nuevo.trim();
    if (!x) return;
    alCambiar([...items, { id: uid().slice(0, 10), texto: x, hecho: false }], null);
    setNuevo('');
  };
  return html`<section class="seccion">
    <div class="seccion-cab"><h3>${titulo}</h3>${items.length > 0 && html`<span class="mono tenue">${hechos}/${items.length}</span>`}</div>
    ${items.length > 0 && html`<div class=${'progreso' + (hechos === items.length ? ' completo' : '')}><div style=${`width:${hechos / items.length * 100}%`}></div></div>`}
    ${items.length > 0 && html`<ul class="checklist">${items.map(it => html`<li key=${it.id} class=${it.hecho ? 'hecho' : ''}>
      <input type="checkbox" id=${idBase + '-ck-' + it.id} checked=${it.hecho} disabled=${!editable} aria-label=${it.texto}
        onChange=${() => alCambiar(items.map(x => x.id === it.id ? { ...x, hecho: !x.hecho } : x), !it.hecho ? `completó «${it.texto}»` : null)} />
      <${TextoEditable} id=${idBase + '-tx-' + it.id} valor=${it.texto} editable=${editable} alGuardar=${v => alCambiar(items.map(x => x.id === it.id ? { ...x, texto: v } : x), null)} />
      ${editable && html`<button class="btn-icono chico" aria-label=${'Quitar ' + it.texto} onClick=${() => alCambiar(items.filter(x => x.id !== it.id), null)}><${Icono} n="cerrar" t=${14} /></button>`}
    </li>`)}</ul>`}
    ${editable && html`<div class="agregar-item">
      <input class="entrada" type="text" id=${idBase + '-nuevo'} placeholder=${placeholder} value=${nuevo} onInput=${e => setNuevo(e.target.value)}
        onKeyDown=${e => { if (e.key === 'Enter') { e.preventDefault(); agregar(); } }} />
      <button class="btn btn-chico" onClick=${agregar} disabled=${!nuevo.trim()}>Agregar</button>
    </div>`}
  </section>`;
}
function Avisos({ avisos }) {
  return html`<div class="avisos" aria-live="polite">${avisos.map(a => html`<div key=${a.id} class=${'aviso ' + (a.tipo === 'error' ? 'error' : '')} role=${a.tipo === 'error' ? 'alert' : 'status'}>${a.texto}</div>`)}</div>`;
}
function Muestras({ valor, alCambiar, idBase }) {
  return html`<div class="muestras" role="radiogroup">${COLORES.map(c => html`<button type="button" key=${c.id} id=${idBase + '-' + c.id} class="muestra" style=${`--m:var(--m-${c.id})`} aria-pressed=${valor === c.id} aria-label=${c.nombre} title=${c.nombre} onClick=${() => alCambiar(c.id)}></button>`)}</div>`;
}
