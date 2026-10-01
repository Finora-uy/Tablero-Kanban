
/* ===== Fechas importantes (entregas a la facultad, reuniones con el tutor…) ===== */
const TIPOS_FECHA = [
  { id: 'entrega', nombre: 'Entrega a la facultad' },
  { id: 'tutor', nombre: 'Reunión con el tutor' },
  { id: 'defensa', nombre: 'Presentación o defensa' },
  { id: 'reunion', nombre: 'Reunión del equipo' },
  { id: 'otro', nombre: 'Otra fecha importante' },
];
const TIPO_FECHA = Object.fromEntries(TIPOS_FECHA.map(t => [t.id, t]));

const accionesFechas = {
  async guardar(id, datos) {
    const doc = { titulo: datos.titulo.trim(), fecha: datos.fecha, hora: datos.hora || null, tipo: datos.tipo || 'otro', nota: (datos.nota || '').trim() };
    if (id) return conManejo(backend.actualizar('fechas/' + id, { ...doc, actualizadoEn: ahoraISO() }));
    return conManejo(backend.crear('fechas/' + backend.nuevoId('fechas'), { ...doc, creadoPor: yo(), creadoEn: ahoraISO() }));
  },
  borrar(id) { return conManejo(backend.borrar('fechas/' + id)); },
};

function cuantoFalta(fecha, hoy) {
  const n = diasEntre(hoy, fecha);
  if (n === 0) return 'es hoy';
  if (n === 1) return 'es mañana';
  if (n > 1) return `faltan ${n} días`;
  return n === -1 ? 'fue ayer' : `fue hace ${-n} días`;
}
function FechaChip({ x, alAbrir, largo }) {
  const tipo = TIPO_FECHA[x.tipo] || TIPO_FECHA.otro;
  return html`<button type="button" key=${x.id} class=${'cal-importante' + (largo ? ' largo' : '')} onClick=${e => { e.stopPropagation(); alAbrir(x); }}
    data-tip=${`${tipo.nombre}${x.hora ? ' · ' + x.hora + ' h' : ''}${x.nota ? ' · ' + x.nota : ''}`}>
    <${Icono} n="estrella" t=${12} />${x.hora ? html`<span class="mono">${x.hora}</span>` : null}<span class="cal-importante-texto">${x.titulo}</span>
  </button>`;
}

// Las próximas fechas importantes, arriba del calendario
function ProximasFechas({ ctx, alAbrir }) {
  const proximas = ctx.fechas.filter(x => x.fecha >= ctx.hoy).slice(0, 4);
  if (!proximas.length) return null;
  return html`<div class="proximas-fechas" aria-label="Próximas fechas importantes">${proximas.map(x => {
    const n = diasEntre(ctx.hoy, x.fecha);
    return html`<button type="button" key=${x.id} class=${'proxima-fecha' + (n <= 7 ? ' cerca' : '')} onClick=${() => alAbrir(x)}>
      <span class="etiqueta-mono">${(TIPO_FECHA[x.tipo] || TIPO_FECHA.otro).nombre}</span>
      <strong>${x.titulo}</strong>
      <span class="proxima-cuando">${mayus(DIAS[aFecha(x.fecha).getDay()])} ${fechaLarga(x.fecha)}${x.hora ? `, ${x.hora} h` : ''} · <span class="falta">${cuantoFalta(x.fecha, ctx.hoy)}</span></span>
    </button>`;
  })}</div>`;
}

function ModalFecha({ ctx, inicial, alCerrar, editable }) {
  const existente = inicial && inicial.id ? inicial : null;
  const [f, setF] = useState({ titulo: existente?.titulo || '', fecha: inicial?.fecha || ctx.hoy, hora: existente?.hora || '', tipo: existente?.tipo || 'entrega', nota: existente?.nota || '' });
  const [confirmar, setConfirmar] = useState(false);
  const set = c => setF(s => ({ ...s, ...c }));
  useEffect(() => {
    const tecla = ev => { if (ev.key === 'Escape') { ev.stopPropagation(); alCerrar(); } };
    document.addEventListener('keydown', tecla);
    return () => document.removeEventListener('keydown', tecla);
  }, []);
  const valido = f.titulo.trim() && f.fecha;
  const guardarla = async () => {
    if (!valido) return;
    if (await accionesFechas.guardar(existente && existente.id, f)) { avisar(existente ? 'Guardaste la fecha.' : `Agregaste «${f.titulo.trim()}» al calendario.`); alCerrar(); }
  };
  if (!editable && existente) {
    const tipo = TIPO_FECHA[existente.tipo] || TIPO_FECHA.otro;
    return html`<${Modal} titulo=${existente.titulo} alCerrar=${alCerrar} ancho=${480} pie=${html`<button class="btn" onClick=${alCerrar}>Cerrar</button>`}>
      <p><strong>${tipo.nombre}</strong> · ${mayus(DIAS[aFecha(existente.fecha).getDay()])} ${fechaLarga(existente.fecha)}${existente.hora ? `, ${existente.hora} h` : ''} (${cuantoFalta(existente.fecha, ctx.hoy)})</p>
      ${existente.nota && html`<p class="comentario-texto"><${ConEnlaces} texto=${existente.nota} /></p>`}
    <//>`;
  }
  const pie = confirmar
    ? html`<div class="confirmar-linea"><span>¿Borrar «${existente.titulo}» del calendario?</span>
        <button class="btn btn-peligro btn-chico" onClick=${async () => { if (await accionesFechas.borrar(existente.id)) { avisar('Borraste la fecha.'); alCerrar(); } }}>Borrar</button>
        <button class="btn btn-fantasma btn-chico" onClick=${() => setConfirmar(false)}>Cancelar</button></div>`
    : html`${existente && html`<button class="btn btn-peligro" style="margin-right:auto" onClick=${() => setConfirmar(true)}><${Icono} n="basura" t=${14} />Borrar</button>`}
      <button class="btn btn-fantasma" onClick=${alCerrar}>Cancelar</button>
      <button class="btn btn-primario" disabled=${!valido} onClick=${guardarla}>${existente ? 'Guardar' : 'Agregar fecha'}</button>`;
  return html`<${Modal} titulo=${existente ? 'Fecha importante' : 'Nueva fecha importante'} alCerrar=${alCerrar} ancho=${520} pie=${pie}>
    <div class="campo"><label for="fe-titulo">Qué es</label>
      <input class="entrada" id="fe-titulo" data-foco type="text" maxlength="80" placeholder="Ej.: Entrega del anteproyecto" value=${f.titulo}
        onInput=${e => set({ titulo: e.target.value })} onKeyDown=${e => { if (e.key === 'Enter') guardarla(); }} /></div>
    <div class="grilla-2">
      <div class="campo"><label for="fe-tipo">Tipo</label>
        <select class="entrada" id="fe-tipo" value=${f.tipo} onChange=${e => set({ tipo: e.target.value })}>${TIPOS_FECHA.map(t => html`<option key=${t.id} value=${t.id}>${t.nombre}</option>`)}</select></div>
      <div class="campo"><label for="fe-fecha">Fecha</label><input class="entrada" id="fe-fecha" type="date" value=${f.fecha} onChange=${e => set({ fecha: e.target.value })} /></div>
      <div class="campo"><label for="fe-hora">Hora (opcional)</label><input class="entrada mono" id="fe-hora" type="time" value=${f.hora} onInput=${e => set({ hora: e.target.value })} /></div>
    </div>
    <div class="campo"><label for="fe-nota">Nota (opcional)</label>
      <textarea class="entrada" id="fe-nota" rows="3" placeholder="Ej.: se entrega por Gestión; llevar la demo en la compu" value=${f.nota} onInput=${e => set({ nota: e.target.value })}></textarea></div>
    ${f.fecha && html`<p class="tenue">${mayus(DIAS[aFecha(f.fecha).getDay()])} ${fechaLarga(f.fecha)} · ${cuantoFalta(f.fecha, ctx.hoy)}.</p>`}
  <//>`;
}
