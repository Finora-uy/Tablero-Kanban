
/* ===== Lista ===== */
const CAMPOS_LISTA = [
  { id: 'numero', nombre: 'Código', valor: t => t.numero || 0 },
  { id: 'titulo', nombre: 'Título', valor: t => normalizar(t.titulo) },
  { id: 'estado', nombre: 'Estado', valor: (t, ctx) => ctx.columnas.findIndex(c => c.id === t.columna) },
  { id: 'tipo', nombre: 'Tipo', valor: t => TIPOS.findIndex(x => x.id === (t.tipo || 'tarea')) },
  { id: 'prioridad', nombre: 'Prioridad', valor: t => -(PRIORIDAD[t.prioridad || 'media'].peso) },
  { id: 'asignados', nombre: 'Responsables', valor: (t, ctx) => normalizar((t.asignados || []).map(id => nombreDe(id, ctx)).join(' ')) || '~' },
  { id: 'vence', nombre: 'Vence', valor: t => t.vence || '9999' },
  { id: 'estimacion', nombre: 'Pts', valor: t => t.estimacion ?? -1 },
  { id: 'hito', nombre: 'Hito', valor: (t, ctx) => (t.hito && ctx.hitosPorId.get(t.hito)?.fin) || '9999' },
];
function VistaLista({ ctx, tareas, alAbrir, hayFiltros, alLimpiar }) {
  const [orden, setOrden] = useState({ campo: 'numero', dir: 1 });
  const campo = CAMPOS_LISTA.find(c => c.id === orden.campo) || CAMPOS_LISTA[0];
  const filas = [...tareas].sort((a, b) => {
    const x = campo.valor(a, ctx), y = campo.valor(b, ctx);
    return (x < y ? -1 : x > y ? 1 : 0) * orden.dir || (a.numero || 0) - (b.numero || 0);
  });
  if (!filas.length) return html`<div class="vista"><${VacioVista} hayFiltros=${hayFiltros} alLimpiar=${alLimpiar} /></div>`;
  return html`<div class="vista">
    <div class="tabla-env"><table class="tabla">
      <thead><tr>${CAMPOS_LISTA.map(c => html`<th key=${c.id} aria-sort=${orden.campo === c.id ? (orden.dir > 0 ? 'ascending' : 'descending') : 'none'}>
        <button onClick=${() => setOrden(o => ({ campo: c.id, dir: o.campo === c.id ? -o.dir : 1 }))}>${c.nombre}${orden.campo === c.id ? (orden.dir > 0 ? ' ↑' : ' ↓') : ''}</button>
      </th>`)}<th>Etiquetas</th></tr></thead>
      <tbody>${filas.map(t => {
        const hecha = esHecha(t, ctx);
        const hito = t.hito && ctx.hitosPorId.get(t.hito);
        return html`<tr key=${t.id} tabindex="0" onClick=${() => alAbrir(t.id)} onKeyDown=${e => { if (e.key === 'Enter') alAbrir(t.id); }}>
          <td class="num">${codigo(t, ctx)}</td>
          <td class="celda-titulo">${estaBloqueada(t, ctx) && !hecha && html`<span title="Bloqueada" style="color:var(--red-text);display:inline-block;vertical-align:-2px;margin-right:6px"><${Icono} n="candado" t=${14} /></span>`}${t.titulo}</td>
          <td><span class=${'tag ' + (hecha ? 'hecho' : 'media')}>${ctx.colPorId.get(t.columna)?.nombre || '—'}</span></td>
          <td>${(TIPO[t.tipo] || TIPO.tarea).nombre}</td>
          <td><span class=${'tag ' + (t.prioridad || 'media')}>${PRIORIDAD[t.prioridad || 'media'].nombre}</span></td>
          <td>${(t.asignados || []).length ? html`<span class="fila" style="gap:6px;flex-wrap:nowrap"><${Avatares} ids=${t.asignados} ctx=${ctx} /><span>${t.asignados.map(id => nombreDe(id, ctx)).join(', ')}</span></span>` : html`<span class="tenue">—</span>`}</td>
          <td class=${'num t-dato ' + (t.vence && !hecha ? estadoVence(t.vence, ctx.hoy) : '')} title=${t.vence && !hecha ? cuandoVence(t.vence, ctx.hoy) : ''}>${t.vence ? fechaNum(t.vence) : '—'}</td>
          <td class="num">${t.estimacion ?? '—'}</td>
          <td>${hito ? hito.nombre : html`<span class="tenue">—</span>`}</td>
          <td><div class="t-etiquetas">${(t.etiquetas || []).map(id => ctx.etiquetasPorId.get(id)).filter(Boolean).map(x => html`<${Etiqueta} key=${x.id} x=${x} />`)}</div></td>
        </tr>`;
      })}</tbody>
    </table></div>
    <p class="tenue">${filas.length === 1 ? '1 tarea' : `${numUY(filas.length)} tareas`}. Tocá una fila para abrirla; tocá un encabezado para ordenar.</p>
  </div>`;
}
function VacioVista({ hayFiltros, alLimpiar, texto }) {
  return html`<div class="vacio-vista">
    <${Chispa} t=${40} />
    <p>${hayFiltros ? 'Ninguna tarea coincide con los filtros.' : (texto || 'Todavía no hay tareas. Creá la primera con N o con el botón Nueva tarea.')}</p>
    ${hayFiltros && html`<button class="btn btn-chico" onClick=${alLimpiar}>Limpiar filtros</button>`}
  </div>`;
}

/* ===== Calendario ===== */
function VistaCalendario({ ctx, tareas, alAbrir }) {
  const angosto = useMedia('(max-width: 720px)');
  const [mes, setMes] = useState(() => { const d = new Date(); return { y: d.getFullYear(), m: d.getMonth() }; });
  const mover = n => setMes(({ y, m }) => { const d = new Date(y, m + n, 1); return { y: d.getFullYear(), m: d.getMonth() }; });
  const primero = new Date(mes.y, mes.m, 1);
  const inicio = new Date(mes.y, mes.m, 1 - ((primero.getDay() + 6) % 7));
  const diasMes = new Date(mes.y, mes.m + 1, 0).getDate();
  const semanas = Math.ceil(((primero.getDay() + 6) % 7 + diasMes) / 7);
  const porDia = new Map();
  for (const t of tareas) if (t.vence) { if (!porDia.has(t.vence)) porDia.set(t.vence, []); porDia.get(t.vence).push(t); }
  const hitosPorDia = new Map();
  for (const x of ctx.hitos) if (x.fin) { if (!hitosPorDia.has(x.fin)) hitosPorDia.set(x.fin, []); hitosPorDia.get(x.fin).push(x); }
  const sinFecha = tareas.filter(t => !t.vence).length;
  const item = t => {
    const hecha = esHecha(t, ctx);
    const cls = 'cal-item' + (hecha ? ' hecha' : estaVencida(t, ctx) ? ' vencida' : '');
    return html`<button key=${t.id} class=${cls} onClick=${() => alAbrir(t.id)} title=${`${codigo(t, ctx)} · ${t.titulo}`}><span class="mono">${codigo(t, ctx)}</span>${t.titulo}</button>`;
  };
  const hitoItem = x => html`<div key=${x.id} class="cal-hito" title=${'Hito: ' + x.nombre}><${Icono} n="bandera" t=${12} />${x.nombre}</div>`;
  const cab = html`<div class="cal-cab">
    <h2>${mayus(MESES[mes.m])} ${mes.y}</h2>
    <button class="btn btn-chico" onClick=${() => { const d = new Date(); setMes({ y: d.getFullYear(), m: d.getMonth() }); }}>Hoy</button>
    <button class="btn-icono" aria-label="Mes anterior" onClick=${() => mover(-1)}><${Icono} n="izq" /></button>
    <button class="btn-icono" aria-label="Mes siguiente" onClick=${() => mover(1)}><${Icono} n="der" /></button>
  </div>`;
  const nota = sinFecha > 0 && html`<p class="tenue">${sinFecha === 1 ? '1 tarea no tiene' : `${sinFecha} tareas no tienen`} fecha de vencimiento y no aparece${sinFecha === 1 ? '' : 'n'} acá.</p>`;
  if (angosto) {
    const dias = [];
    for (let d = 1; d <= diasMes; d++) {
      const iso = isoDe(new Date(mes.y, mes.m, d));
      if (porDia.has(iso) || hitosPorDia.has(iso)) dias.push(iso);
    }
    return html`<div class="vista">${cab}
      ${dias.length ? html`<div class="agenda">${dias.map(iso => html`<div class="agenda-dia" key=${iso}>
        <h3>${tituloDia(iso)}${iso === ctx.hoy ? '' : ' · ' + fechaCorta(iso)}</h3>
        ${(hitosPorDia.get(iso) || []).map(hitoItem)}${(porDia.get(iso) || []).map(item)}
      </div>`)}</div>` : html`<p class="tenue">No hay vencimientos ni hitos en ${MESES[mes.m]}.</p>`}
      ${nota}
    </div>`;
  }
  const celdas = [];
  for (let i = 0; i < semanas * 7; i++) {
    const d = new Date(inicio.getFullYear(), inicio.getMonth(), inicio.getDate() + i);
    const iso = isoDe(d);
    const fuera = d.getMonth() !== mes.m;
    celdas.push(html`<div key=${iso} class=${'cal-celda' + (fuera ? ' fuera' : '') + (iso === ctx.hoy ? ' hoy' : '')}>
      <span class="cal-num">${d.getDate()}</span>
      ${(hitosPorDia.get(iso) || []).map(hitoItem)}
      ${(porDia.get(iso) || []).map(item)}
    </div>`);
  }
  return html`<div class="vista">${cab}
    <div class="cal">
      ${['lun', 'mar', 'mié', 'jue', 'vie', 'sáb', 'dom'].map(n => html`<div class="cal-dia-nombre etiqueta-mono" key=${n}>${n}</div>`)}
      ${celdas}
    </div>
    ${nota}
  </div>`;
}

/* ===== Hitos ===== */
function VistaHitos({ ctx, editable, alEditar, alVerTareas }) {
  const futuros = ctx.hitos.filter(x => !x.fin || x.fin >= ctx.hoy);
  const pasados = ctx.hitos.filter(x => x.fin && x.fin < ctx.hoy).reverse();
  const tarjeta = x => {
    const ts = ctx.tareas.filter(t => t.hito === x.id && !t.archivada);
    const hechas = ts.filter(t => esHecha(t, ctx));
    const pts = ts.reduce((a, t) => a + (t.estimacion || 0), 0);
    const ptsH = hechas.reduce((a, t) => a + (t.estimacion || 0), 0);
    const pct = ts.length ? (pts ? ptsH / pts : hechas.length / ts.length) : 0;
    const n = x.fin ? diasEntre(ctx.hoy, x.fin) : null;
    const tipo = TIPOS_HITO.find(y => y.id === x.tipo) || TIPOS_HITO[3];
    return html`<article class="hito" key=${x.id}>
      <div class="hito-cab">
        <h3>${x.nombre}</h3>
        <span class="tag media">${tipo.nombre}</span>
        ${editable && html`<button class="btn-icono chico" aria-label=${'Editar ' + x.nombre} onClick=${() => alEditar(x.id)}><${Icono} n="ajustes" t=${14} /></button>`}
      </div>
      <p class="hito-fecha">${x.fin ? html`${x.inicio ? html`Del <strong>${fechaLarga(x.inicio)}</strong> al ` : null}<strong>${fechaLarga(x.fin)}</strong> · ${n === 0 ? html`<span class="pronto">es hoy</span>` : n > 0 ? html`<span class=${n <= 7 ? 'pronto' : ''}>faltan ${n} día${n === 1 ? '' : 's'}</span>` : html`<span class="pasado">fue hace ${-n} día${n === -1 ? '' : 's'}</span>`}` : 'Sin fecha'}</p>
      ${x.objetivo && html`<p class="hito-objetivo">${x.objetivo}</p>`}
      <div class=${'progreso' + (ts.length && pct >= 1 ? ' completo' : '')} role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow=${Math.round(pct * 100)}><div style=${`width:${pct * 100}%`}></div></div>
      <div class="hito-nums">
        <span>${ts.length ? `${hechas.length} de ${ts.length} tareas hechas` : 'Sin tareas asignadas'}</span>
        <span class="mono">${pts ? `${ptsH}/${pts} pts` : ''}</span>
      </div>
      ${ts.length > 0 && html`<div><button class="btn btn-chico" onClick=${() => alVerTareas(x.id)}>Ver sus tareas en el tablero</button></div>`}
    </article>`;
  };
  return html`<div class="vista">
    <div class="vista-cab">
      <div><h2>Hitos</h2><p>Entregas a ORT, sprints y reuniones con fecha. Asigná tareas a un hito desde el detalle de cada tarea para ver el avance acá.</p></div>
      ${editable && html`<button class="btn btn-primario" onClick=${() => alEditar(null)}><${Icono} n="mas" />Nuevo hito</button>`}
    </div>
    ${ctx.hitos.length === 0 && html`<div class="vacio-vista"><${Icono} n="bandera" t=${28} /><p>Todavía no hay hitos. Cargá la primera entrega a ORT para ver cuánto falta.</p></div>`}
    ${futuros.length > 0 && html`<div class="hitos-lista">${futuros.map(tarjeta)}</div>`}
    ${pasados.length > 0 && html`<details><summary>Hitos pasados <span class="mono tenue">${pasados.length}</span></summary><div class="hitos-lista">${pasados.map(tarjeta)}</div></details>`}
  </div>`;
}
