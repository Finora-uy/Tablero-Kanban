
/* ===== Roadmap: fases del proyecto hasta la entrega, con tareas, hitos, ausencias y feriados ===== */
const ESTADOS_RM = [['pendiente', 'Pendiente'], ['en-curso', 'En curso'], ['hecho', 'Hecho'], ['bloqueado', 'Bloqueado']];
const ESTADO_RM = Object.fromEntries(ESTADOS_RM);
const ROLES_RM = ['Todos', 'Gerente de proyecto', 'Arquitecto', 'SQA', 'SCM', 'Ingeniería de requerimientos', 'Documentación', 'Tutor'];
const fechaCortaAnio = iso => { const [y, m, d] = iso.split('-'); return `${d}/${m}/${y.slice(2)}`; };
const etiquetaFase = (f, i) => (f.etiqueta && f.etiqueta.trim()) || `Fase ${i + 1}`;
const rmAtrasado = (it, fase, hoy) => it.estado !== 'hecho' && fase && fase.fin && fase.fin < hoy;

const accionesRm = {
  async guardarFase(id, datos, fases) {
    if (id) return conManejo(backend.actualizar('roadmapFases/' + id, datos));
    const orden = fases.length ? (fases[fases.length - 1].orden ?? 0) + 1024 : 1024;
    return conManejo(backend.crear('roadmapFases/' + backend.nuevoId('roadmapFases'), { ...datos, orden }));
  },
  async borrarFase(id, items) {
    const ok = await conManejo(backend.borrar('roadmapFases/' + id));
    if (ok) for (const it of items.filter(x => x.fase === id)) await backend.borrar('roadmapItems/' + it.id).catch(() => {});
    return ok;
  },
  guardarItem(id, datos, items) {
    if (id) return conManejo(backend.actualizar('roadmapItems/' + id, datos));
    const deFase = items.filter(x => x.fase === datos.fase);
    const orden = deFase.length ? (deFase[deFase.length - 1].orden ?? 0) + 1024 : 1024;
    return conManejo(backend.crear('roadmapItems/' + backend.nuevoId('roadmapItems'), { ...datos, orden, creadoPor: yo(), creadoEn: ahoraISO() }));
  },
  borrarItem(id) { return conManejo(backend.borrar('roadmapItems/' + id)); },
  moverItem(id, fase, orden) { return conManejo(backend.actualizar('roadmapItems/' + id, { fase, orden })); },
  guardarMeta(meta) { return conManejo(backend.crear('roadmap/meta', meta)); },
  guardarPeriodo(id, datos) {
    if (id) return conManejo(backend.actualizar('roadmapPeriodos/' + id, datos));
    return conManejo(backend.crear('roadmapPeriodos/' + backend.nuevoId('roadmapPeriodos'), datos));
  },
  borrarPeriodo(id) { return conManejo(backend.borrar('roadmapPeriodos/' + id)); },
};
// Orden fraccional entre dos vecinos (o al principio/al final)
function ordenEntre(antes, despues) {
  if (antes && despues) return ((antes.orden ?? 0) + (despues.orden ?? 0)) / 2;
  if (antes) return (antes.orden ?? 0) + 1024;
  if (despues) return (despues.orden ?? 0) - 1024;
  return 1024;
}
function useEscape(alCerrar) {
  useEffect(() => {
    const tecla = ev => { if (ev.key === 'Escape') { ev.stopPropagation(); alCerrar(); } };
    document.addEventListener('keydown', tecla);
    return () => document.removeEventListener('keydown', tecla);
  }, []);
}

/* ----- Marcador de estado (forma + relleno, no solo color) ----- */
function MarcaEstado({ estado, hito }) {
  return html`<span class=${'rm-marca rm-' + (estado || 'pendiente') + (hito ? ' rm-hito' : '')} aria-hidden="true"></span>`;
}

/* ----- Editores ----- */
function ModalItemRm({ ctx, inicial, alCerrar, editable }) {
  const rm = ctx.roadmap;
  const existente = inicial.id ? inicial : null;
  const [f, setF] = useState({ nombre: inicial.nombre || '', tipo: inicial.tipo || 'tarea', estado: inicial.estado || 'pendiente', fase: inicial.fase || rm.fases[0]?.id, responsable: inicial.responsable || '', notas: inicial.notas || '' });
  const [confirmar, setConfirmar] = useState(false);
  const set = c => setF(s => ({ ...s, ...c }));
  useEscape(alCerrar);
  const guardarlo = async () => {
    if (!f.nombre.trim()) return;
    const datos = { nombre: f.nombre.trim(), tipo: f.tipo, estado: f.estado, fase: f.fase, responsable: f.responsable.trim(), notas: f.notas.trim() };
    // Si cambió de fase, va al final de la nueva
    if (existente && existente.fase !== f.fase) {
      const deFase = rm.items.filter(x => x.fase === f.fase);
      datos.orden = deFase.length ? (deFase[deFase.length - 1].orden ?? 0) + 1024 : 1024;
    }
    if (await accionesRm.guardarItem(existente && existente.id, datos, rm.items)) alCerrar();
  };
  const responsables = [...new Set([...ROLES_RM, ...ctx.miembros.map(m => m.nombre), ...rm.items.map(x => x.responsable).filter(Boolean)])];
  const pie = !editable ? html`<button class="btn" onClick=${alCerrar}>Cerrar</button>`
    : confirmar ? html`<div class="confirmar-linea"><span>¿Eliminar «${existente.nombre}» del roadmap?</span>
        <button class="btn btn-peligro btn-chico" onClick=${async () => { if (await accionesRm.borrarItem(existente.id)) { avisar('Lo sacaste del roadmap.'); alCerrar(); } }}>Eliminar</button>
        <button class="btn btn-fantasma btn-chico" onClick=${() => setConfirmar(false)}>Cancelar</button></div>`
    : html`${existente && html`<button class="btn btn-peligro" style="margin-right:auto" onClick=${() => setConfirmar(true)}><${Icono} n="basura" t=${14} />Eliminar</button>`}
        <button class="btn btn-fantasma" onClick=${alCerrar}>Cancelar</button>
        <button class="btn btn-primario" disabled=${!f.nombre.trim()} onClick=${guardarlo}>${existente ? 'Guardar' : 'Agregar'}</button>`;
  return html`<${Modal} titulo=${existente ? (editable ? 'Editar' : 'Detalle') : 'Nueva tarea o hito'} alCerrar=${alCerrar} ancho=${520} pie=${pie}>
    <div class="campo"><label for="rmi-nombre">Nombre</label><input class="entrada" id="rmi-nombre" data-foco type="text" disabled=${!editable} value=${f.nombre} onInput=${e => set({ nombre: e.target.value })} onKeyDown=${e => { if (e.key === 'Enter') guardarlo(); }} /></div>
    <div class="grilla-2">
      <div class="campo"><label for="rmi-tipo">Tipo</label><select class="entrada" id="rmi-tipo" disabled=${!editable} value=${f.tipo} onChange=${e => set({ tipo: e.target.value })}><option value="tarea">Tarea</option><option value="hito">Hito</option></select></div>
      <div class="campo"><label for="rmi-estado">Estado</label><select class="entrada" id="rmi-estado" disabled=${!editable} value=${f.estado} onChange=${e => set({ estado: e.target.value })}>${ESTADOS_RM.map(([v, n]) => html`<option key=${v} value=${v}>${n}</option>`)}</select></div>
    </div>
    <div class="campo"><label for="rmi-fase">Fase</label><select class="entrada" id="rmi-fase" disabled=${!editable} value=${f.fase} onChange=${e => set({ fase: e.target.value })}>${rm.fases.map((x, i) => html`<option key=${x.id} value=${x.id}>${etiquetaFase(x, i)}: ${x.nombre}</option>`)}</select></div>
    <div class="campo"><label for="rmi-resp">Responsable</label><input class="entrada" id="rmi-resp" type="text" list="rm-responsables" placeholder="Persona o rol" disabled=${!editable} value=${f.responsable} onInput=${e => set({ responsable: e.target.value })} />
      <datalist id="rm-responsables">${responsables.map(r => html`<option key=${r} value=${r}></option>`)}</datalist></div>
    <div class="campo"><label for="rmi-notas">Notas</label><textarea class="entrada" id="rmi-notas" rows="4" disabled=${!editable} value=${f.notas} onInput=${e => set({ notas: e.target.value })}></textarea></div>
  <//>`;
}

function ModalFaseRm({ ctx, inicial, alCerrar }) {
  const rm = ctx.roadmap;
  const existente = inicial.id ? inicial : null;
  const idx = existente ? rm.fases.findIndex(x => x.id === existente.id) : rm.fases.length;
  const [f, setF] = useState({ etiqueta: inicial.etiqueta || '', nombre: inicial.nombre || '', desc: inicial.desc || '', inicio: inicial.inicio || '', fin: inicial.fin || '', color: inicial.color || COLORES[rm.fases.length % COLORES.length].id, pos: idx });
  const [confirmar, setConfirmar] = useState(false);
  const [error, setError] = useState('');
  const set = c => setF(s => ({ ...s, ...c }));
  useEscape(alCerrar);
  const n = rm.fases.length + (existente ? 0 : 1);
  const nItems = existente ? rm.items.filter(x => x.fase === existente.id).length : 0;
  const guardarla = async () => {
    if (!f.nombre.trim()) { setError('Escribí un nombre para la fase.'); return; }
    if (f.inicio && f.fin && f.fin < f.inicio) { setError('La fecha de fin no puede ser anterior al inicio.'); return; }
    const datos = { etiqueta: f.etiqueta.trim(), nombre: f.nombre.trim(), desc: f.desc.trim(), inicio: f.inicio || null, fin: f.fin || null, color: f.color };
    const otras = rm.fases.filter(x => !existente || x.id !== existente.id);
    if (!existente || Number(f.pos) !== idx) datos.orden = ordenEntre(otras[Number(f.pos) - 1], otras[Number(f.pos)]);
    if (await accionesRm.guardarFase(existente && existente.id, datos, rm.fases)) alCerrar();
  };
  const pie = confirmar
    ? html`<div class="confirmar-linea"><span>¿Eliminar la fase «${existente.nombre}»${nItems ? ` y sus ${nItems} tareas e hitos` : ''}? No se puede deshacer.</span>
        <button class="btn btn-peligro btn-chico" onClick=${async () => { if (await accionesRm.borrarFase(existente.id, rm.items)) { avisar('Eliminaste la fase.'); alCerrar(); } }}>Eliminar</button>
        <button class="btn btn-fantasma btn-chico" onClick=${() => setConfirmar(false)}>Cancelar</button></div>`
    : html`${existente && html`<button class="btn btn-peligro" style="margin-right:auto" onClick=${() => setConfirmar(true)}><${Icono} n="basura" t=${14} />Eliminar fase</button>`}
        <button class="btn btn-fantasma" onClick=${alCerrar}>Cancelar</button>
        <button class="btn btn-primario" onClick=${guardarla}>${existente ? 'Guardar' : 'Agregar fase'}</button>`;
  return html`<${Modal} titulo=${existente ? 'Editar fase' : 'Nueva fase'} alCerrar=${alCerrar} ancho=${540} pie=${pie}>
    <div class="grilla-2">
      <div class="campo"><label for="rmf-etq">Título de la columna</label><input class="entrada" id="rmf-etq" type="text" maxlength="16" placeholder=${`Fase ${idx + 1}`} value=${f.etiqueta} onInput=${e => set({ etiqueta: e.target.value })} /></div>
      <div class="campo"><label for="rmf-pos">Posición</label><select class="entrada" id="rmf-pos" value=${String(f.pos)} onChange=${e => set({ pos: Number(e.target.value) })}>
        ${Array.from({ length: n }, (_, i) => html`<option key=${i} value=${String(i)}>${i + 1}${i === 0 ? ' (primera)' : i === n - 1 ? ' (última)' : ''}</option>`)}</select></div>
    </div>
    <div class="campo"><label for="rmf-nombre">Nombre</label><input class="entrada" id="rmf-nombre" data-foco type="text" value=${f.nombre} onInput=${e => set({ nombre: e.target.value })} /></div>
    <div class="campo"><label for="rmf-desc">Descripción</label><textarea class="entrada" id="rmf-desc" rows="3" value=${f.desc} onInput=${e => set({ desc: e.target.value })}></textarea></div>
    <div class="grilla-2">
      <div class="campo"><label for="rmf-ini">Inicio</label><input class="entrada" id="rmf-ini" type="date" value=${f.inicio} onChange=${e => set({ inicio: e.target.value })} /></div>
      <div class="campo"><label for="rmf-fin">Fin</label><input class="entrada" id="rmf-fin" type="date" value=${f.fin} onChange=${e => set({ fin: e.target.value })} /></div>
    </div>
    <div class="campo"><span class="campo-etq">Color</span><div class="muestras">${COLORES.map(c => html`<button type="button" key=${c.id} class="muestra" style=${`--m:var(--c-${c.id})`} aria-pressed=${f.color === c.id} aria-label=${c.nombre} title=${c.nombre} onClick=${() => set({ color: c.id })}></button>`)}</div></div>
    ${error && html`<p class="error-horario" role="alert">${error}</p>`}
  <//>`;
}

function ModalMetaRm({ ctx, alCerrar }) {
  const meta = ctx.roadmap.meta || {};
  const [deadline, setDeadline] = useState(meta.deadline || '');
  const [fijas, setFijas] = useState(() => (meta.fechasFijas || []).map(x => ({ ...x })));
  const [nota, setNota] = useState(meta.nota || '');
  useEscape(alCerrar);
  const setFija = (i, c) => setFijas(l => l.map((x, j) => (j === i ? { ...x, ...c } : x)));
  const guardarla = async () => {
    const limpias = fijas.filter(x => (x.fecha || '').trim() || (x.texto || '').trim()).map(x => ({ fecha: (x.fecha || '').trim(), texto: (x.texto || '').trim(), destacada: !!x.destacada }));
    if (await accionesRm.guardarMeta({ deadline: deadline || null, fechasFijas: limpias, nota: nota.trim() })) { avisar('Guardaste los datos del roadmap.'); alCerrar(); }
  };
  return html`<${Modal} titulo="Datos del roadmap" alCerrar=${alCerrar} ancho=${600} pie=${html`<button class="btn btn-fantasma" onClick=${alCerrar}>Cancelar</button><button class="btn btn-primario" onClick=${guardarla}>Guardar</button>`}>
    <div class="campo"><label for="rmm-dl">Fecha de entrega</label><input class="entrada" id="rmm-dl" data-foco type="date" style="max-width:200px" value=${deadline} onChange=${e => setDeadline(e.target.value)} />
      <span class="tenue" style="font-size:12.5px">Es la fecha a la que apunta el roadmap ("faltan N días").</span></div>
    <div class="campo"><span class="campo-etq">Fechas fijas de ORT</span>
      ${fijas.map((x, i) => html`<div class="rm-fija-fila" key=${i}>
        <input class="entrada mono" type="text" id=${'rmm-f-' + i} aria-label="Fecha" placeholder="Ej.: 20/04/2027 · 21:00" value=${x.fecha} onInput=${e => setFija(i, { fecha: e.target.value })} />
        <input class="entrada" type="text" id=${'rmm-t-' + i} aria-label="Qué es" placeholder="Ej.: Entrega en Gestión" value=${x.texto} onInput=${e => setFija(i, { texto: e.target.value })} />
        <label class="opcion" title="Resaltarla"><input type="checkbox" id=${'rmm-d-' + i} checked=${!!x.destacada} onChange=${e => setFija(i, { destacada: e.target.checked })} />Resaltar</label>
        <button class="btn-icono chico" aria-label="Quitar" onClick=${() => setFijas(l => l.filter((_, j) => j !== i))}><${Icono} n="cerrar" t=${14} /></button>
      </div>`)}
      <div><button class="btn btn-chico" onClick=${() => setFijas(l => [...l, { fecha: '', texto: '', destacada: false }])}><${Icono} n="mas" t=${14} />Agregar fecha fija</button></div></div>
    <div class="campo"><label for="rmm-nota">Nota al pie</label><textarea class="entrada" id="rmm-nota" rows="2" value=${nota} onInput=${e => setNota(e.target.value)}></textarea></div>
  <//>`;
}

/* ----- Ausencias y feriados ----- */
function PeriodosRm({ ctx, editable }) {
  const lista = ctx.roadmap.periodos;
  const cambiar = (p, campo, valor) => {
    const datos = { [campo]: campo === 'etiqueta' ? valor.trim() : valor };
    if (campo === 'desde' && p.hasta && valor > p.hasta) datos.hasta = valor;
    if (campo === 'hasta' && p.desde && valor < p.desde) datos.desde = valor;
    accionesRm.guardarPeriodo(p.id, datos);
  };
  const agregar = () => {
    const d = aFecha(ctx.hoy); d.setDate(d.getDate() + 6);
    accionesRm.guardarPeriodo(null, { etiqueta: 'Nueva ausencia', tipo: 'ausencia', desde: ctx.hoy, hasta: isoDe(d) });
  };
  return html`<section class="panel ancho">
    <div class="seccion-cab"><h3>Ausencias y feriados del equipo</h3><span class="mono tenue">${lista.length}</span></div>
    <p class="sub">Períodos largos que afectan la planificación: vacaciones, viajes, fiestas, Carnaval, Turismo. Para días sueltos de cada uno está la pestaña Disponibilidad.</p>
    ${lista.length ? html`<div class="tabla-env"><table class="tabla rm-periodos">
      <thead><tr><th>Descripción</th><th>Tipo</th><th>Desde</th><th>Hasta</th><th>Días</th><th></th></tr></thead>
      <tbody>${lista.map(p => html`<tr key=${p.id} style="cursor:default">
        <td><${CampoTextoRm} id=${'rmp-e-' + p.id} valor=${p.etiqueta} editable=${editable} alGuardar=${v => cambiar(p, 'etiqueta', v)} /></td>
        <td><select class="entrada" id=${'rmp-t-' + p.id} disabled=${!editable} value=${p.tipo} onChange=${e => cambiar(p, 'tipo', e.target.value)}><option value="ausencia">Ausencia</option><option value="feriado">Feriado</option></select></td>
        <td><input class="entrada" type="date" id=${'rmp-d-' + p.id} disabled=${!editable} value=${p.desde} onChange=${e => e.target.value && cambiar(p, 'desde', e.target.value)} /></td>
        <td><input class="entrada" type="date" id=${'rmp-h-' + p.id} disabled=${!editable} value=${p.hasta} onChange=${e => e.target.value && cambiar(p, 'hasta', e.target.value)} /></td>
        <td class="num">${p.desde && p.hasta ? diasEntre(p.desde, p.hasta) + 1 : '—'}</td>
        <td>${editable && html`<button class="btn-icono chico" aria-label=${'Quitar ' + p.etiqueta} onClick=${() => accionesRm.borrarPeriodo(p.id)}><${Icono} n="basura" t=${14} /></button>`}</td>
      </tr>`)}</tbody>
    </table></div>` : html`<p class="tenue">Todavía no hay ausencias ni feriados cargados.</p>`}
    ${editable && html`<div><button class="btn btn-chico" onClick=${agregar}><${Icono} n="mas" t=${14} />Agregar ausencia o feriado</button></div>`}
  </section>`;
}
function CampoTextoRm({ id, valor, editable, alGuardar }) {
  const [v, setV] = useState(valor || '');
  const foco = useRef(false);
  useEffect(() => { if (!foco.current) setV(valor || ''); }, [valor]);
  return html`<input class="entrada" type="text" id=${id} disabled=${!editable} aria-label="Descripción" value=${v}
    onInput=${e => setV(e.target.value)} onFocus=${() => { foco.current = true; }}
    onBlur=${() => { foco.current = false; if (v.trim() && v.trim() !== valor) alGuardar(v); else setV(valor || ''); }}
    onKeyDown=${e => { if (e.key === 'Enter') e.currentTarget.blur(); }} />`;
}

/* ----- La vista ----- */
function VistaRoadmap({ ctx, editable, alModal }) {
  const rm = ctx.roadmap;
  const [item, setItem] = useState(null);
  const [fase, setFase] = useState(null);
  const [meta, setMeta] = useState(false);
  const [arr, setArr] = useState(null);
  const sRef = useRef(null);
  const scrollRef = useRef(null);
  const suprimir = useRef(false);
  const datos = useRef();
  datos.current = rm;

  // Arrastrar tareas e hitos entre fases (mouse, o mantener apretado en el celular)
  function alBajar(ev, it) {
    if (!editable || (ev.pointerType === 'mouse' && ev.button !== 0)) return;
    const s = { id: it.id, nombre: it.nombre, x0: ev.clientX, y0: ev.clientY, x: ev.clientX, y: ev.clientY, tactil: ev.pointerType !== 'mouse', activo: false, timer: 0, fantasma: null, destino: null, raf: 0 };
    sRef.current = s;
    if (s.tactil) s.timer = setTimeout(activar, 350);
    window.addEventListener('pointermove', mover, { passive: false });
    window.addEventListener('pointerup', soltar);
    window.addEventListener('pointercancel', limpiar);
    window.addEventListener('touchmove', bloquear, { passive: false });
  }
  function bloquear(e) { if (sRef.current && sRef.current.activo) e.preventDefault(); }
  function activar() {
    const s = sRef.current; if (!s || s.activo) return;
    s.activo = true;
    const g = document.createElement('div'); g.className = 'rm-fantasma'; g.textContent = s.nombre;
    document.body.appendChild(g); s.fantasma = g;
    document.documentElement.classList.add('arrastrando');
    posicionar(); destino();
    s.raf = requestAnimationFrame(bucle);
  }
  function mover(e) {
    const s = sRef.current; if (!s) return;
    s.x = e.clientX; s.y = e.clientY;
    if (!s.activo) {
      const d = Math.abs(s.x - s.x0) + Math.abs(s.y - s.y0);
      if (s.tactil) { if (d > 10) limpiar(); return; }
      if (d < 6) return;
      activar();
    }
    e.preventDefault(); posicionar(); destino();
  }
  function posicionar() { const s = sRef.current; if (s && s.fantasma) s.fantasma.style.transform = `translate(${s.x + 12}px, ${s.y + 12}px) rotate(-2deg)`; }
  function destino() {
    const s = sRef.current; if (!s || !s.activo) return;
    const el = document.elementFromPoint(s.x, s.y);
    const col = el && el.closest('[data-rm-fase]');
    if (!col) { if (s.destino) { s.destino = null; setArr(null); } return; }
    const lis = [...col.querySelectorAll('[data-rm-item]')].filter(li => li.dataset.rmItem !== s.id);
    let antesDe = null;
    for (const li of lis) { const r = li.getBoundingClientRect(); if (s.y < r.top + r.height / 2) { antesDe = li.dataset.rmItem; break; } }
    const d = { fase: col.dataset.rmFase, antesDe };
    if (!s.destino || s.destino.fase !== d.fase || s.destino.antesDe !== d.antesDe) { s.destino = d; setArr({ id: s.id, ...d }); }
  }
  function bucle() {
    const s = sRef.current; if (!s || !s.activo) return;
    const sc = scrollRef.current;
    if (sc) { const r = sc.getBoundingClientRect(); const v = s.x < r.left + 60 ? -14 : s.x > r.right - 60 ? 14 : 0; if (v) { sc.scrollLeft += v; destino(); } }
    s.raf = requestAnimationFrame(bucle);
  }
  function soltar() {
    const s = sRef.current;
    if (s && s.activo && s.destino) {
      suprimir.current = true; setTimeout(() => { suprimir.current = false; }, 80);
      const { fase: f, antesDe } = s.destino;
      const lista = datos.current.items.filter(x => x.fase === f && x.id !== s.id);
      const i = antesDe ? lista.findIndex(x => x.id === antesDe) : lista.length;
      const it = datos.current.items.find(x => x.id === s.id);
      if (it && !(it.fase === f && lista[i - 1]?.orden < it.orden && (!lista[i] || lista[i].orden > it.orden))) {
        accionesRm.moverItem(s.id, f, ordenEntre(lista[i - 1], lista[i]));
      }
    }
    limpiar();
  }
  function limpiar() {
    const s = sRef.current;
    window.removeEventListener('pointermove', mover); window.removeEventListener('pointerup', soltar);
    window.removeEventListener('pointercancel', limpiar); window.removeEventListener('touchmove', bloquear);
    if (!s) return;
    clearTimeout(s.timer); cancelAnimationFrame(s.raf);
    if (s.fantasma) s.fantasma.remove();
    document.documentElement.classList.remove('arrastrando');
    sRef.current = null; setArr(null);
  }

  const total = rm.items.length;
  const hechos = rm.items.filter(x => x.estado === 'hecho').length;
  const enCurso = rm.items.filter(x => x.estado === 'en-curso').length;
  const fasePorId = new Map(rm.fases.map(f => [f.id, f]));
  const atrasados = rm.items.filter(x => rmAtrasado(x, fasePorId.get(x.fase), ctx.hoy)).length;
  const deadline = rm.meta && rm.meta.deadline;
  const faltan = deadline ? Math.max(0, diasEntre(ctx.hoy, deadline)) : null;
  const avance = total ? Math.round(hechos / total * 100) : 0;
  const modales = html`
    ${item && html`<${ModalItemRm} ctx=${ctx} inicial=${item} editable=${editable} alCerrar=${() => setItem(null)} />`}
    ${fase && html`<${ModalFaseRm} ctx=${ctx} inicial=${fase} alCerrar=${() => setFase(null)} />`}
    ${meta && html`<${ModalMetaRm} ctx=${ctx} alCerrar=${() => setMeta(false)} />`}`;

  if (!rm.fases.length) {
    return html`<div class="vista">
      <div class="vista-cab"><div><h2>Roadmap</h2><p>El camino del proyecto hasta la entrega: fases, tareas, hitos, ausencias y feriados.</p></div></div>
      <div class="vacio-vista"><${Isotipo} t=${40} />
        <p>Todavía no hay roadmap. Agregá la primera fase, o importá un roadmap guardado desde <strong>Ajustes → Respaldo</strong>.</p>
        ${editable && html`<div class="fila" style="justify-content:center">
          <button class="btn btn-primario" onClick=${() => setFase({})}><${Icono} n="mas" t=${15} />Agregar fase</button>
          <button class="btn" onClick=${() => alModal({ tipo: 'ajustes', seccion: 'respaldo' })}><${Icono} n="subir" t=${15} />Importar un roadmap</button></div>`}
      </div>${modales}
    </div>`;
  }

  return html`<div class="vista roadmap">
    <div class="vista-cab">
      <div><h2>Roadmap</h2><p>${deadline ? `El camino del proyecto hacia la entrega del ${fechaLarga(deadline)} de ${aFecha(deadline).getFullYear()}.` : 'El camino del proyecto hasta la entrega.'}</p></div>
      ${editable && html`<button class="btn btn-chico" onClick=${() => setMeta(true)}><${Icono} n="ajustes" t=${14} />Fecha de entrega y fechas fijas</button>`}
    </div>
    <div class="rm-datos">
      ${faltan !== null && html`<span class="rm-dato"><strong>${numUY(faltan)}</strong> ${faltan === 1 ? 'día' : 'días'} para la entrega</span>`}
      <span class="rm-dato"><strong>${hechos}</strong> de <strong>${total}</strong> hechos</span>
      <span class="rm-dato"><strong>${enCurso}</strong> en curso</span>
      <span class=${'rm-dato' + (atrasados ? ' alerta' : '')}><strong>${atrasados}</strong> ${atrasados === 1 ? 'atrasado' : 'atrasados'}</span>
    </div>
    <div class="rm-scroll" ref=${scrollRef}>
      <div class="rm-tablero">
        <section class="rm-col rm-intro" style="--fase:var(--c-pizarra)">
          <div class="rm-cab estatica">Sobre el roadmap</div>
          <div class="rm-cuerpo">
            <p>Ordena el trabajo del equipo desde la asignación del proyecto hasta la defensa. Las fases se pueden superponer.</p>
            ${rm.meta && rm.meta.fechasFijas && rm.meta.fechasFijas.length > 0 && html`<h4>Fechas fijas de ORT</h4>
              <ul class="rm-fijas">${rm.meta.fechasFijas.map((x, i) => html`<li key=${i} class=${x.destacada ? 'destacada' : ''}><span class="mono">${x.fecha}</span><span>${x.texto}</span></li>`)}</ul>`}
            <h4>Avance</h4>
            <p>${avance} % hecho${faltan !== null ? ` · faltan ${faltan} días` : ''}</p>
            <div class=${'progreso' + (avance >= 100 ? ' completo' : '')}><div style=${`width:${avance}%`}></div></div>
            <h4>Referencias</h4>
            <ul class="rm-leyenda">
              ${ESTADOS_RM.map(([v, n]) => html`<li key=${v}><${MarcaEstado} estado=${v} />${n}</li>`)}
              <li><${MarcaEstado} estado="pendiente" hito /> Hito</li>
              <li><span class="tag urgente">Atrasada</span></li>
            </ul>
            ${editable && html`<p class="tenue">Tocá una tarea para editarla, o el título de una fase para cambiarla. Arrastrá para mover de fase.</p>`}
          </div>
        </section>
        ${rm.fases.map((f, i) => {
          const its = rm.items.filter(x => x.fase === f.id);
          const listos = its.filter(x => x.estado === 'hecho').length;
          const destinoAca = arr && arr.fase === f.id;
          const filas = [];
          for (const it of its) {
            if (destinoAca && arr.antesDe === it.id) filas.push(html`<li key="__hueco" class="rm-hueco" aria-hidden="true"></li>`);
            const atras = rmAtrasado(it, f, ctx.hoy);
            filas.push(html`<li key=${it.id} data-rm-item=${it.id} class=${arr && arr.id === it.id ? 'arrastrado' : ''}>
              <button class=${'rm-item rm-' + it.estado} onPointerDown=${e => alBajar(e, it)} onClick=${() => { if (!suprimir.current) setItem(it); }}
                onContextMenu=${e => { if (sRef.current) e.preventDefault(); }} data-tip=${ESTADO_RM[it.estado] + (it.tipo === 'hito' ? ' · hito' : '') + (it.notas ? ' · ' + it.notas : '')}>
                <${MarcaEstado} estado=${it.estado} hito=${it.tipo === 'hito'} />
                <span class="rm-nombre">${it.nombre}</span>
                ${(it.responsable || atras) && html`<span class="rm-meta">${it.responsable && html`<span>${it.responsable}</span>`}${atras && html`<span class="tag urgente">Atrasada</span>`}</span>`}
              </button>
            </li>`);
          }
          if (destinoAca && !arr.antesDe) filas.push(html`<li key="__hueco" class="rm-hueco" aria-hidden="true"></li>`);
          return html`<section class=${'rm-col' + (destinoAca ? ' destino' : '')} key=${f.id} style=${`--fase:var(--c-${f.color || 'azul'})`}>
            ${editable ? html`<button class="rm-cab" onClick=${() => setFase(f)} title="Editar fase">${etiquetaFase(f, i)}<${Icono} n="lapiz" t=${13} /></button>`
              : html`<div class="rm-cab estatica">${etiquetaFase(f, i)}</div>`}
            <div class="rm-cuerpo" data-rm-fase=${f.id}>
              <h3>${f.nombre}</h3>
              ${f.inicio && f.fin && html`<p class="rm-fechas mono">${fechaCortaAnio(f.inicio)} → ${fechaCortaAnio(f.fin)}</p>`}
              ${f.desc && html`<p class="rm-desc">${f.desc}</p>`}
              <p class="rm-cuenta">${listos} de ${its.length} hechos</p>
              <div class=${'progreso' + (its.length && listos === its.length ? ' completo' : '')}><div style=${`width:${its.length ? listos / its.length * 100 : 0}%`}></div></div>
              <ul class="rm-items">${filas}</ul>
              ${editable && html`<button class="rm-agregar" onClick=${() => setItem({ fase: f.id })}><${Icono} n="mas" t=${14} />Agregar tarea o hito</button>`}
            </div>
          </section>`;
        })}
        ${editable && html`<button class="rm-col rm-nueva" onClick=${() => setFase({})}><span class="rm-cab">+ Nueva</span><span class="rm-cuerpo"><${Icono} n="mas" t=${28} />Agregar fase</span></button>`}
      </div>
    </div>
    <${PeriodosRm} ctx=${ctx} editable=${editable} />
    ${rm.meta && rm.meta.nota && html`<p class="tenue">${rm.meta.nota}</p>`}
    ${modales}
  </div>`;
}
