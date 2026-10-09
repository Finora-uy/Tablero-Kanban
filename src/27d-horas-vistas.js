
/* ===== Horas: vistas ===== */
function OpcionesTarea({ ctx }) {
  const tareas = ctx.tareas.filter(t => !t.archivada).sort((a, b) => (b.numero || 0) - (a.numero || 0));
  return tareas.map(t => html`<option key=${t.id} value=${t.id}>${codigo(t, ctx)} · ${t.titulo.length > 60 ? t.titulo.slice(0, 60) + '…' : t.titulo}</option>`);
}
// Etapa, trabajo y tarea: los mismos tres selectores en el cronómetro, la carga manual y la edición
function SelectoresRegistro({ ctx, valor, alCambiar, idBase }) {
  return html`
    <select class="entrada" id=${idBase + '-etapa'} aria-label="Etapa" value=${valor.etapa || ''} onChange=${e => alCambiar({ etapa: e.target.value || null })}>
      <option value="">Sin etapa</option>${ctx.etapas.map(x => html`<option key=${x.id} value=${x.id}>${x.nombre}</option>`)}
    </select>
    <select class="entrada" id=${idBase + '-trabajo'} aria-label="Trabajo" value=${valor.trabajo || ''} onChange=${e => alCambiar({ trabajo: e.target.value || null })}>
      <option value="">Sin trabajo</option>
      ${ctx.trabajos.filter(x => !x.grupo && !x.legado).map(x => html`<option key=${x.id} value=${x.id}>${x.nombre}</option>`)}
      ${[...new Set(ctx.trabajos.filter(x => x.grupo).map(x => x.grupo))].map(g => html`<optgroup key=${g} label=${g}>
        ${ctx.trabajos.filter(x => x.grupo === g && (!x.legado || x.id === valor.trabajo)).map(x => html`<option key=${x.id} value=${x.id}>${x.nombre}</option>`)}</optgroup>`)}
    </select>
    <select class="entrada" id=${idBase + '-tarea'} aria-label="Tarea del tablero" value=${valor.tarea || ''} onChange=${e => alCambiar({ tarea: e.target.value || null })}>
      <option value="">Sin tarea del tablero</option><${OpcionesTarea} ctx=${ctx} />
    </select>`;
}

/* ----- Cronómetro y carga manual ----- */
function BarraCronometro({ ctx, editable }) {
  const [modo, setModoS] = useState(() => (leer('finora-horas-modo') === 'manual' ? 'manual' : 'crono'));
  const setModo = m => { setModoS(m); guardar('finora-horas-modo', m); };
  if (!editable) return null;
  if (!ctx.yo) return html`<div class="aviso-vacio"><p><strong>Para cargar horas, primero sumate al tablero</strong> desde el menú de tu perfil (arriba a la derecha).</p></div>`;
  const corriendo = ctx.cronometros.get(ctx.yo);
  return html`<section class="crono-barra" aria-label="Cargar horas">
    ${corriendo ? html`<${CronometroEnMarcha} key=${corriendo.inicio} c=${corriendo} ctx=${ctx} />`
      : modo === 'crono' ? html`<${CronometroNuevo} ctx=${ctx} />` : html`<${CargaManual} ctx=${ctx} />`}
    ${!corriendo && html`<div class="crono-modo" role="group" aria-label="Forma de cargar">
      <button type="button" aria-pressed=${modo === 'crono'} onClick=${() => setModo('crono')} title="Cronómetro"><${Icono} n="reloj" t=${15} /><span>Cronómetro</span></button>
      <button type="button" aria-pressed=${modo === 'manual'} onClick=${() => setModo('manual')} title="Carga manual"><${Icono} n="lapiz" t=${15} /><span>Manual</span></button>
    </div>`}
  </section>`;
}
function CronometroNuevo({ ctx }) {
  const [v, setV] = useState(() => { try { return JSON.parse(leer('finora-horas-ultimo') || '{}'); } catch (_) { return {}; } });
  const [desc, setDesc] = useState('');
  const iniciar = async () => {
    const datos = { etapa: v.etapa, trabajo: v.trabajo, tarea: v.tarea, descripcion: desc };
    guardar('finora-horas-ultimo', JSON.stringify({ etapa: v.etapa || null, trabajo: v.trabajo || null }));
    if (await accionesHoras.iniciar(datos)) setDesc('');
  };
  return html`<div class="crono-campos">
    <input class="entrada crono-desc" id="crono-desc" type="text" placeholder="¿En qué estás trabajando?" value=${desc}
      onInput=${e => setDesc(e.target.value)} onKeyDown=${e => { if (e.key === 'Enter') { e.preventDefault(); iniciar(); } }} />
    <${SelectoresRegistro} ctx=${ctx} valor=${v} idBase="crono" alCambiar=${c => setV(x => ({ ...x, ...c }))} />
    <span class="crono-tiempo mono" aria-hidden="true">0:00:00</span>
    <button class="btn btn-primario crono-boton" onClick=${iniciar}><${Icono} n="play" t=${15} />Iniciar</button>
  </div>`;
}
function CronometroEnMarcha({ c, ctx }) {
  useReloj(true);
  const desc = useBorrador(c.descripcion || '', v => accionesHoras.editarCronometro({ descripcion: v.trim() }));
  const [confirmar, setConfirmar] = useState(false);
  return html`<div class="crono-campos en-marcha">
    <input class="entrada crono-desc" id="crono-desc" type="text" placeholder="¿En qué estás trabajando?" ...${desc} />
    <${SelectoresRegistro} ctx=${ctx} valor=${c} idBase="crono" alCambiar=${cambios => accionesHoras.editarCronometro(cambios)} />
    <span class="crono-tiempo mono vivo" title=${'Desde las ' + horaDe(c.inicio)}>${cronoTexto(Date.now() - new Date(c.inicio))}</span>
    <button class="btn btn-detener crono-boton" onClick=${() => accionesHoras.detener()}><${Icono} n="stop" t=${14} />Detener</button>
    ${confirmar
      ? html`<span class="fila crono-descartar"><button class="btn btn-peligro btn-chico" onClick=${() => accionesHoras.descartar()}>Descartar sin guardar</button><button class="btn btn-fantasma btn-chico" onClick=${() => setConfirmar(false)}>Cancelar</button></span>`
      : html`<button class="btn-icono crono-descartar" title="Descartar sin guardar" aria-label="Descartar sin guardar" onClick=${() => setConfirmar(true)}><${Icono} n="basura" t=${15} /></button>`}
  </div>`;
}
function CargaManual({ ctx }) {
  const [v, setV] = useState(() => { try { return JSON.parse(leer('finora-horas-ultimo') || '{}'); } catch (_) { return {}; } });
  const [f, setF] = useState({ descripcion: '', fecha: hoyISO(), desde: '', hasta: '' });
  const set = (k, x) => setF(s => ({ ...s, [k]: x }));
  const tiempos = armarInicioFin(f.fecha, f.desde, f.hasta);
  const agregar = async () => {
    if (!tiempos) { avisar('Completá la fecha y los horarios de inicio y fin.', 'error'); return; }
    guardar('finora-horas-ultimo', JSON.stringify({ etapa: v.etapa || null, trabajo: v.trabajo || null }));
    const ok = await accionesHoras.crear({ miembro: ctx.yo, inicio: tiempos.inicio, fin: tiempos.fin, etapa: v.etapa, trabajo: v.trabajo, tarea: v.tarea, descripcion: f.descripcion });
    if (ok) setF(s => ({ ...s, descripcion: '', desde: s.hasta, hasta: '' }));
  };
  return html`<div class="crono-campos manual">
    <input class="entrada crono-desc" id="man-desc" type="text" placeholder="¿En qué trabajaste?" value=${f.descripcion} onInput=${e => set('descripcion', e.target.value)} />
    <${SelectoresRegistro} ctx=${ctx} valor=${v} idBase="man" alCambiar=${c => setV(x => ({ ...x, ...c }))} />
    <input class="entrada" id="man-fecha" type="date" aria-label="Fecha" value=${f.fecha} max=${hoyISO()} onChange=${e => set('fecha', e.target.value)} />
    <span class="fila man-horas">
      <input class="entrada mono" id="man-desde" type="time" aria-label="Desde" value=${f.desde} onInput=${e => set('desde', e.target.value)} />
      <span class="tenue">a</span>
      <input class="entrada mono" id="man-hasta" type="time" aria-label="Hasta" value=${f.hasta} onInput=${e => set('hasta', e.target.value)} />
    </span>
    <span class="crono-tiempo mono" title=${tiempos && tiempos.cruza ? 'Termina al día siguiente' : ''}>${tiempos ? duracionReloj(tiempos.minutos) + (tiempos.cruza ? ' +1' : '') : '0:00'}</span>
    <button class="btn btn-primario crono-boton" onClick=${agregar} disabled=${!tiempos}><${Icono} n="mas" t=${15} />Agregar</button>
    ${errorHorario(f) && html`<p class="error-horario" role="alert">${errorHorario(f)}</p>`}
  </div>`;
}

/* ----- Lista de registros ----- */
function FilaRegistro({ r, ctx, editable, alAbrir, alEditar }) {
  const [confirmar, setConfirmar] = useState(false);
  const m = ctx.integrantes.get(r.miembro);
  const etapa = r.etapa && ctx.etapasPorId.get(r.etapa);
  const trabajo = r.trabajo && ctx.trabajosPorId.get(r.trabajo);
  const tarea = r.tarea && ctx.porId.get(r.tarea);
  const propio = editable && r.miembro === ctx.yo;
  const otroDia = isoDe(new Date(r.fin)) !== r.fecha;
  return html`<li class="registro">
    <${Avatar} m=${m} t=${26} />
    <div class="reg-cuerpo">
      <p class="reg-desc">${r.descripcion || html`<span class="tenue">Sin descripción</span>`}</p>
      ${(etapa || trabajo || tarea) && html`<div class="reg-chips">
        ${etapa && html`<${Etiqueta} x=${etapa} />`}
        ${trabajo && html`<span class="chip-trabajo">${trabajo.nombre}</span>`}
        ${tarea && html`<button class="btn-link mono" onClick=${() => alAbrir(tarea.id)} title=${tarea.titulo}>${codigo(tarea, ctx)}</button>`}
      </div>`}
    </div>
    <span class="reg-horario mono" title=${otroDia ? 'Termina al día siguiente' : ''}>${horaDe(r.inicio)}–${horaDe(r.fin)}${otroDia ? ' +1' : ''}</span>
    <span class="reg-dur mono" title=${duracionTexto(r.minutos)}>${duracionReloj(r.minutos)}</span>
    <div class="reg-acciones">
      ${confirmar ? html`<button class="btn btn-peligro btn-chico" onClick=${() => accionesHoras.borrar(r.id)}>Borrar</button><button class="btn btn-fantasma btn-chico" onClick=${() => setConfirmar(false)}>No</button>`
        : propio && html`
          <button class="btn-icono chico" title="Continuar con esto" aria-label="Continuar con esto" onClick=${() => accionesHoras.continuar(r)}><${Icono} n="play" t=${14} /></button>
          <button class="btn-icono chico" title="Editar" aria-label="Editar registro" onClick=${() => alEditar(r)}><${Icono} n="lapiz" t=${14} /></button>
          <button class="btn-icono chico" title="Borrar" aria-label="Borrar registro" onClick=${() => setConfirmar(true)}><${Icono} n="basura" t=${14} /></button>`}
    </div>
  </li>`;
}
function RegistroHoras({ ctx, editable, alAbrir, alEditar }) {
  const [ambito, setAmbitoS] = useState(() => (leer('finora-horas-ambito') === 'equipo' ? 'equipo' : 'mias'));
  const setAmbito = a => { setAmbitoS(a); guardar('finora-horas-ambito', a); };
  const [dias, setDias] = useState(14);
  const mias = ambito === 'mias' && ctx.yo;
  const lista = ctx.horas.filter(r => !mias || r.miembro === ctx.yo).sort((a, b) => (a.inicio < b.inicio ? 1 : -1));
  const grupos = [];
  for (const r of lista) {
    if (!grupos.length || grupos[grupos.length - 1].fecha !== r.fecha) grupos.push({ fecha: r.fecha, registros: [], total: 0 });
    const g = grupos[grupos.length - 1];
    g.registros.push(r); g.total += r.minutos || 0;
  }
  const lunes = lunesISO(ctx.hoy);
  const semana = ctx.horas.filter(r => r.fecha >= lunes);
  const miSemana = semana.filter(r => r.miembro === ctx.yo).reduce((a, r) => a + (r.minutos || 0), 0);
  const equipoSemana = semana.reduce((a, r) => a + (r.minutos || 0), 0);
  return html`<div class="vista-horas-cuerpo">
    <${BarraCronometro} ctx=${ctx} editable=${editable} />
    <div class="registro-cab">
      <div class="subpestanas" role="group" aria-label="De quién">
        <button aria-pressed=${!!mias} disabled=${!ctx.yo} onClick=${() => setAmbito('mias')}>Mis horas</button>
        <button aria-pressed=${!mias} onClick=${() => setAmbito('equipo')}>Todo el equipo</button>
      </div>
      <p class="semana-total">Esta semana: ${ctx.yo && html`<strong class="mono">${duracionTexto(miSemana)}</strong> vos · `}<strong class="mono">${duracionTexto(equipoSemana)}</strong> el equipo</p>
    </div>
    ${!grupos.length && html`<div class="vacio-vista"><${Icono} n="reloj" t=${28} /><p>${mias ? 'Todavía no cargaste horas. Arrancá el cronómetro o cargalas a mano arriba.' : 'Todavía nadie cargó horas.'}</p></div>`}
    ${grupos.slice(0, dias).map(g => html`<section class="dia-registros" key=${g.fecha}>
      <header class="dia-cab"><h3>${tituloDia(g.fecha)}${diasEntre(g.fecha, ctx.hoy) > 1 ? '' : ' · ' + fechaCorta(g.fecha)}</h3><span class="mono">${duracionTexto(g.total)}</span></header>
      <ul class="registros">${g.registros.map(r => html`<${FilaRegistro} key=${r.id} r=${r} ctx=${ctx} editable=${editable} alAbrir=${alAbrir} alEditar=${alEditar} />`)}</ul>
    </section>`)}
    ${grupos.length > dias && html`<div><button class="btn btn-chico" onClick=${() => setDias(n => n + 14)}>Ver días anteriores</button></div>`}
  </div>`;
}

/* ----- Editar un registro ----- */
function ModalRegistro({ ctx, r, alCerrar }) {
  const [f, setF] = useState({ descripcion: r.descripcion || '', etapa: r.etapa, trabajo: r.trabajo, tarea: r.tarea, fecha: r.fecha, desde: horaDe(r.inicio), hasta: horaDe(r.fin) });
  const [confirmar, setConfirmar] = useState(false);
  const set = c => setF(s => ({ ...s, ...c }));
  const tiempos = armarInicioFin(f.fecha, f.desde, f.hasta);
  useEffect(() => {
    const tecla = ev => { if (ev.key === 'Escape') { ev.stopPropagation(); alCerrar(); } };
    document.addEventListener('keydown', tecla);
    return () => document.removeEventListener('keydown', tecla);
  }, []);
  const guardarlo = async () => {
    if (!tiempos) return;
    if (await accionesHoras.editar(r.id, { miembro: r.miembro, inicio: tiempos.inicio, fin: tiempos.fin, etapa: f.etapa, trabajo: f.trabajo, tarea: f.tarea, descripcion: f.descripcion })) alCerrar();
  };
  const pie = confirmar
    ? html`<div class="confirmar-linea"><span>¿Borrar este registro de ${duracionTexto(r.minutos)}?</span>
        <button class="btn btn-peligro btn-chico" onClick=${async () => { if (await accionesHoras.borrar(r.id)) alCerrar(); }}>Borrar</button>
        <button class="btn btn-fantasma btn-chico" onClick=${() => setConfirmar(false)}>Cancelar</button></div>`
    : html`<button class="btn btn-peligro" style="margin-right:auto" onClick=${() => setConfirmar(true)}><${Icono} n="basura" t=${14} />Borrar</button>
      <button class="btn btn-fantasma" onClick=${alCerrar}>Cancelar</button>
      <button class="btn btn-primario" disabled=${!tiempos} onClick=${guardarlo}>Guardar</button>`;
  return html`<${Modal} titulo="Editar registro" alCerrar=${alCerrar} ancho=${560} pie=${pie}>
    <div class="campo"><label for="er-desc">Descripción</label><input class="entrada" id="er-desc" data-foco type="text" value=${f.descripcion} onInput=${e => set({ descripcion: e.target.value })} /></div>
    <div class="grilla-2">
      <div class="campo"><label for="er-fecha">Fecha</label><input class="entrada" id="er-fecha" type="date" value=${f.fecha} onChange=${e => set({ fecha: e.target.value })} /></div>
      <div class="campo"><label for="er-desde">Desde</label><input class="entrada mono" id="er-desde" type="time" value=${f.desde} onInput=${e => set({ desde: e.target.value })} /></div>
      <div class="campo"><label for="er-hasta">Hasta</label><input class="entrada mono" id="er-hasta" type="time" value=${f.hasta} onInput=${e => set({ hasta: e.target.value })} /></div>
      <div class="campo"><span class="campo-etq">Duración</span><span class="mono" style="padding-top:8px">${tiempos ? duracionTexto(tiempos.minutos) + (tiempos.cruza ? ' (termina al día siguiente)' : '') : '—'}</span></div>
    </div>
    ${errorHorario(f) && html`<p class="error-horario" role="alert">${errorHorario(f)}</p>`}
    <div class="campo"><span class="campo-etq">Etapa, trabajo y tarea</span><div class="selectores-col"><${SelectoresRegistro} ctx=${ctx} valor=${f} idBase="er" alCambiar=${set} /></div></div>
  <//>`;
}

/* ----- Reportes ----- */
const FILTRO_HORAS_BASE = { periodo: '30', desde: '', hasta: '', personas: [], etapas: [], trabajos: [] };
/* ----- Carga horaria de reuniones ----- */
function PanelReuniones({ ctx, regs, personas, totalMin }) {
  const series = ctx.trabajos.filter(x => x.grupo === 'Reuniones').map(x => ({ id: x.id, nombre: x.nombre, color: `var(--c-${x.color})` }));
  const ids = new Set(series.map(x => x.id));
  const reu = regs.filter(r => ids.has(r.trabajo));
  const total = reu.reduce((a, r) => a + (r.minutos || 0), 0);
  if (!total) {
    return html`<section class="panel ancho"><h3>Carga horaria de reuniones</h3>
      <p class="tenue">No hay reuniones cargadas en este período o con estos filtros. Se cargan en <strong>Registro</strong> eligiendo el trabajo «Reunión interna», «Reunión con cliente» o «Reunión con tutor».</p></section>`;
  }
  const porTipo = new Map(), porPersona = new Map(), porSemana = new Map();
  for (const r of reu) {
    const m = r.minutos || 0;
    porTipo.set(r.trabajo, (porTipo.get(r.trabajo) || 0) + m);
    if (!porPersona.has(r.miembro)) porPersona.set(r.miembro, new Map());
    const pp = porPersona.get(r.miembro); pp.set(r.trabajo, (pp.get(r.trabajo) || 0) + m);
    const sem = lunesISO(r.fecha);
    if (!porSemana.has(sem)) porSemana.set(sem, new Map());
    const ps = porSemana.get(sem); ps.set(r.trabajo, (ps.get(r.trabajo) || 0) + m);
  }
  const usadas = series.filter(s => porTipo.has(s.id));
  const filas = personas.filter(p => porPersona.has(p.id)).map(p => {
    const valores = porPersona.get(p.id);
    return { id: p.id, nombre: p.nombre, valores, total: [...valores.values()].reduce((a, b) => a + b, 0),
      etiqueta: html`${p.m ? html`<${Avatar} m=${p.m} t=${20} />` : null}<span>${p.nombre}</span>` };
  }).sort((a, b) => b.total - a.total);
  const claves = [...porSemana.keys()].sort();
  const semanas = [];
  for (const d = aFecha(claves[0]); isoDe(d) <= claves[claves.length - 1]; d.setDate(d.getDate() + 7)) semanas.push(isoDe(d));
  const paso = Math.max(1, Math.ceil(semanas.length / 12));
  const datos = semanas.map((s, i) => {
    const valores = porSemana.get(s) || new Map();
    return { id: s, nombre: 'Semana del ' + fechaLarga(s), etq: i % paso === 0 ? `${aFecha(s).getDate()}/${aFecha(s).getMonth() + 1}` : '', total: [...valores.values()].reduce((a, b) => a + b, 0), valores };
  });
  const maxTipo = maxEntrada(porTipo);
  const tipoMax = series.find(s => s.id === maxTipo[0]);
  return html`<section class="panel ancho"><h3>Carga horaria de reuniones</h3>
    <p class="sub">Cuánto tiempo se va en reuniones, según con quién: interna del equipo, con clientes o con el tutor</p>
    <div class="reu-resumen">
      <div><span class="etiqueta-mono">Horas en reuniones</span><strong>${horasTexto(total)}</strong></div>
      <div><span class="etiqueta-mono">Del total de horas</span><strong>${pct(total, totalMin)} %</strong></div>
      ${usadas.map(s => html`<div key=${s.id}><span class="etiqueta-mono"><span class="leyenda-marca" style=${`background:${s.color}`}></span> ${s.nombre}</span><strong>${horasTexto(porTipo.get(s.id))}</strong></div>`)}
    </div>
    <div class="reu-grid">
      <div><h4 class="reu-sub">Por persona</h4><${BarrasApiladas} filas=${filas} series=${usadas} /></div>
      <div><h4 class="reu-sub">Por semana</h4><${Columnas} datos=${datos} series=${usadas} alto=${150} /></div>
    </div>
    <${Leyenda} items=${usadas} />
    <p class="tenue" style="font-size:12.5px">Lo que más tiempo lleva: ${tipoMax ? tipoMax.nombre.toLowerCase() : ''} (${pct(maxTipo[1], total)} % de las reuniones).</p>
  </section>`;
}

function ReportesHoras({ ctx, alAbrir }) {
  const [f, setFS] = useState(() => { try { return { ...FILTRO_HORAS_BASE, ...JSON.parse(leer('finora-horas-filtros') || '{}') }; } catch (_) { return { ...FILTRO_HORAS_BASE }; } });
  const setF = c => setFS(s => { const n = { ...s, ...c }; guardar('finora-horas-filtros', JSON.stringify(n)); return n; });
  const [ocultos, setOcultos] = useState([]);
  const [filasDet, setFilasDet] = useState(20);
  const rango = rangoDe(f.periodo, f.desde, f.hasta);
  const regs = filtrarHoras(ctx.horas, { ...rango, personas: f.personas, etapas: f.etapas, trabajos: f.trabajos });
  const est = calcularEstadisticas(regs);

  const personas = [...ctx.miembros.map(m => ({ id: m.id, nombre: m.nombre, color: `var(--m-${m.color || 'pizarra'})`, m })),
    ...[...est.porMiembro.keys()].filter(id => !ctx.integrantes.has(id)).map(id => ({ id, nombre: 'Ex integrante', color: 'var(--m-pizarra)' }))];
  const personasCon = personas.filter(p => est.porMiembro.has(p.id));
  const conSin = (lista, nombreSin) => [...lista.map(x => ({ id: x.id, nombre: x.nombre, color: `var(--c-${x.color})` })), { id: 'sin', nombre: nombreSin, color: 'var(--line-2)' }];
  const etapas = conSin(ctx.etapas, 'Sin etapa'), trabajos = conSin(ctx.trabajos, 'Sin trabajo');
  const etapasCon = etapas.filter(x => est.porEtapa.has(x.id));
  const filtros = html`<div class="barra horas-filtros" role="search">
    <label class="oculto-visual" for="hr-periodo">Período</label>
    <select class="entrada" id="hr-periodo" style="width:auto;height:34px;min-height:34px;padding-block:4px" value=${f.periodo} onChange=${e => setF({ periodo: e.target.value })}>
      ${PERIODOS.map(p => html`<option key=${p.id} value=${p.id}>${p.nombre}</option>`)}
    </select>
    ${f.periodo === 'rango' && html`<span class="fila" style="gap:6px">
      <input class="entrada" id="hr-desde" type="date" aria-label="Desde" style="width:auto;height:34px;min-height:34px" value=${f.desde} onChange=${e => setF({ desde: e.target.value })} />
      <span class="tenue">a</span>
      <input class="entrada" id="hr-hasta" type="date" aria-label="Hasta" style="width:auto;height:34px;min-height:34px" value=${f.hasta} onChange=${e => setF({ hasta: e.target.value })} />
    </span>`}
    <${FiltroMulti} nombre="Personas" idBase="hr-per" valor=${f.personas} alCambiar=${v => setF({ personas: v })}
      opciones=${ctx.miembros.map(m => ({ id: m.id, nombre: m.nombre, pre: html`<${Avatar} m=${m} t=${20} />` }))} />
    <${FiltroMulti} nombre="Etapas" idBase="hr-eta" valor=${f.etapas} alCambiar=${v => setF({ etapas: v })}
      opciones=${etapas.map(x => ({ id: x.id, nombre: x.nombre, pre: html`<span class="leyenda-marca" style=${`background:${x.color}`}></span>` }))} />
    <${FiltroMulti} nombre="Trabajos" idBase="hr-tra" valor=${f.trabajos} alCambiar=${v => setF({ trabajos: v })}
      opciones=${trabajos.map(x => ({ id: x.id, nombre: x.nombre, pre: html`<span class="leyenda-marca" style=${`background:${x.color}`}></span>` }))} />
    ${(f.personas.length + f.etapas.length + f.trabajos.length > 0) && html`<button class="btn-link" onClick=${() => setF({ personas: [], etapas: [], trabajos: [] })}>Limpiar filtros</button>`}
    ${puedeDescargar() && regs.length > 0 && html`<div class="barra-fin"><button class="btn" onClick=${() => guardarArchivo(`horas-finora-${hoyISO()}.csv`, horasCSV(regs, ctx), 'text/csv')}><${Icono} n="descargar" t=${15} />Exportar (.csv)</button></div>`}
  </div>`;
  if (!regs.length) {
    return html`<div class="vista-horas-cuerpo">${filtros}<div class="vacio-vista"><${Icono} n="grafico" t=${28} />
      <p>${ctx.horas.length ? 'No hay horas en este período o con estos filtros. Probá con «Todo».' : 'Todavía no hay horas cargadas. Cuando el equipo cargue horas en Registro, acá aparecen los reportes.'}</p></div></div>`;
  }

  // Días de la semana: total y promedio por cada vez que ese día cayó en el período
  const desde = rango.desde || [...est.dias.keys()].sort()[0];
  const hasta = rango.hasta || ctx.hoy;
  const veces = Array(7).fill(0);
  for (let d = aFecha(desde); d <= aFecha(hasta); d.setDate(d.getDate() + 1)) veces[diaSemana(d)]++;
  const diaTop = maxIndice(est.porDiaSemana);
  const datosDias = DIAS_CORTOS.map((etq, i) => ({ id: 'd' + i, etq, nombre: mayus(DIAS_LARGOS[i]), total: est.porDiaSemana[i], extra: veces[i] ? `promedio ${horasTexto(est.porDiaSemana[i] / veces[i])} por ${DIAS_LARGOS[i]}` : '' }));

  // Meses (sin huecos) apilados por persona
  const mesesClaves = [];
  const primerMes = [...est.porMes.keys()].sort()[0], ultimoMes = [...est.porMes.keys()].sort().pop();
  for (let [y, m] = primerMes.split('-').map(Number); `${y}-${pad(m)}` <= ultimoMes; m === 12 ? (y++, m = 1) : m++) mesesClaves.push(`${y}-${pad(m)}`);
  const datosMeses = mesesClaves.map(k => {
    const valores = new Map(personasCon.map(p => [p.id, est.porMiembro.get(p.id).porMes.get(k) || 0]));
    return { id: k, etq: mesCorto(k), nombre: mesNombre(k), total: est.porMes.get(k) || 0, valores };
  });

  // Semanas (sin huecos)
  const semanasClaves = [...est.porSemana.keys()].sort();
  const puntos = [];
  if (semanasClaves.length) {
    for (const d = aFecha(semanasClaves[0]); isoDe(d) <= semanasClaves[semanasClaves.length - 1]; d.setDate(d.getDate() + 7)) {
      const clave = isoDe(d);
      puntos.push({ clave, total: est.porSemana.get(clave) || 0, porSerie: new Map(personasCon.map(p => [p.id, est.porMiembro.get(p.id).porSemana.get(clave) || 0])) });
    }
  }
  const activos = personasCon.filter(p => !ocultos.includes(p.id)).map(p => p.id);
  const filasEtapa = (series, mapa) => series.filter(x => mapa.has(x.id)).map(x => ({ id: x.id, nombre: x.nombre, total: mapa.get(x.id), valores: new Map([[x.id, mapa.get(x.id)]]),
    etiqueta: html`<span class="leyenda-marca" style=${`background:${x.color}`}></span><span>${x.nombre}</span>` })).sort((a, b) => b.total - a.total);
  const tareasTop = [...est.porTarea].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([id, min]) => ({ t: ctx.porId.get(id), id, min })).filter(x => x.t);
  const diasConHoras = est.dias.size;
  const ultimos = [...regs].sort((a, b) => (a.inicio < b.inicio ? 1 : -1));
  const tile = (etq, valor, detalle) => html`<div class="tile"><span class="etiqueta-mono">${etq}</span><span class="valor">${valor}</span><span class="detalle-tile">${detalle}</span></div>`;

  return html`<div class="vista-horas-cuerpo">
    ${filtros}
    <div class="tiles">
      ${tile('Horas totales', horasTexto(est.total), `${numUY(est.sesiones)} registros`)}
      ${tile('Por día trabajado', horasTexto(est.total / diasConHoras), 'promedio de los días con horas')}
      ${tile('Días con horas', numUY(diasConHoras), rango.desde ? `de ${diasEntre(rango.desde, rango.hasta || ctx.hoy) + 1} días del período` : 'en total')}
      ${tile('Sesión promedio', duracionTexto(est.total / est.sesiones), 'lo que dura cada registro')}
      ${tile('En tareas del tablero', `${pct(est.conTarea, est.total)} %`, `${horasTexto(est.conTarea)} vinculadas a una tarea`)}
    </div>
    <section class="panel hallazgos-panel">
      <h3>Lo que dicen los datos</h3>
      <ul class="hallazgos">${hallazgos(est, ctx).map(x => html`<li key=${x.id}>${x.texto}</li>`)}</ul>
    </section>
    <div class="paneles">
      <section class="panel"><h3>Horas por persona</h3><p class="sub">Cada barra se divide por etapa</p>
        <${BarrasApiladas} filas=${personasCon.map(p => ({ id: p.id, nombre: p.nombre, total: est.porMiembro.get(p.id).total, valores: est.porMiembro.get(p.id).porEtapa,
          etiqueta: html`${p.m ? html`<${Avatar} m=${p.m} t=${20} />` : null}<span>${p.nombre}</span>` })).sort((a, b) => b.total - a.total)} series=${etapas} />
        <${Leyenda} items=${etapasCon} />
      </section>
      <section class="panel"><h3>Qué día trabaja más cada uno</h3><p class="sub">Horas por día de la semana; el recuadro marca el día fuerte de cada persona</p>
        <${MapaCalor} filas=${personasCon.map(p => ({ id: p.id, nombre: p.nombre, etiqueta: html`${p.m ? html`<${Avatar} m=${p.m} t=${18} />` : null}<span>${p.nombre}</span>` }))}
          columnas=${DIAS_CORTOS.map((d, i) => ({ id: 'd' + i, etq: d, nombre: DIAS_LARGOS[i] }))} valor=${(fila, j) => est.porMiembro.get(fila.id).porDia[j]} />
      </section>
      <section class="panel"><h3>Días de la semana · equipo</h3><p class="sub">Total de horas; el ${DIAS_LARGOS[diaTop]} es el más fuerte</p>
        <${Columnas} datos=${datosDias} destacar=${'d' + diaTop} />
      </section>
      <section class="panel"><h3>Horas por mes</h3><p class="sub">Cada columna se divide por persona</p>
        <${Columnas} datos=${datosMeses} series=${personasCon} />
        ${personasCon.length > 1 && html`<${Leyenda} items=${personasCon} />`}
      </section>
      <section class="panel"><h3>Cuándo se trabaja</h3><p class="sub">Horas por día y franja horaria</p>
        <${MapaCalor} marcarMax=${false} filas=${DIAS_CORTOS.map((d, i) => ({ id: 'd' + i, nombre: mayus(DIAS_LARGOS[i]), etiqueta: html`<span>${d}</span>` }))}
          columnas=${FRANJAS.map(h => ({ id: 'h' + h, etq: String(h), nombre: `de ${pad(h)} a ${pad((h + 2) % 24)} h` }))} valor=${(fila, j) => est.franjas[Number(fila.id.slice(1))][j]} />
      </section>
      <section class="panel"><h3>Por etapa</h3><${BarrasApiladas} filas=${filasEtapa(etapas, est.porEtapa)} series=${etapas} /></section>
      <section class="panel ancho"><h3>Evolución semanal</h3><p class="sub">El área es el total del equipo; tocá un nombre para mostrar u ocultar su línea</p>
        <${AreaSemanal} puntos=${puntos} series=${personasCon} activos=${activos} />
        <${Leyenda} items=${personasCon} activos=${activos} alAlternar=${id => setOcultos(o => (o.includes(id) ? o.filter(x => x !== id) : [...o, id]))} />
      </section>
      <${PanelReuniones} ctx=${ctx} regs=${regs} personas=${personas} totalMin=${est.total} />
      <section class="panel"><h3>Por trabajo</h3><${BarrasApiladas} filas=${filasEtapa(trabajos, est.porTrabajo)} series=${trabajos} /></section>
      <section class="panel"><h3>Tareas con más horas</h3><p class="sub">${horasTexto(est.conTarea)} vinculadas a tareas del tablero</p>
        ${tareasTop.length ? html`<ul class="lista-prox">${tareasTop.map(x => html`<li key=${x.id}><button onClick=${() => alAbrir(x.id)}>
          <span class="mono tenue" style="min-width:56px">${codigo(x.t, ctx)}</span><span class="crece">${x.t.titulo}</span>
          <span class="mono">${horasTexto(x.min)}</span></button></li>`)}</ul>`
          : html`<p class="tenue">Ningún registro de este período está vinculado a una tarea.</p>`}
      </section>
      <section class="panel"><h3>Año en un vistazo</h3><p class="sub">Horas de cada día, en el período (hasta 52 semanas)</p>
        <${CalendarioCalor} porDia=${est.dias} desde=${rango.desde} hasta=${hasta} />
      </section>
      <section class="panel ancho"><h3>Detalle</h3><p class="sub">${numUY(regs.length)} registros, del más reciente al más viejo${regs.length > filasDet ? ` · se ven ${filasDet}; exportá el .csv para tenerlos todos` : ''}</p>
        <div class="tabla-env"><table class="tabla">
          <thead><tr><th>Fecha</th><th>Persona</th><th>Horario</th><th>Duración</th><th>Etapa</th><th>Trabajo</th><th>Descripción</th></tr></thead>
          <tbody>${ultimos.slice(0, filasDet).map(r => html`<tr key=${r.id} style="cursor:default">
            <td class="num">${fechaNum(r.fecha)}</td><td>${nombreDe(r.miembro, ctx)}</td>
            <td class="num">${horaDe(r.inicio)}–${horaDe(r.fin)}</td><td class="num">${duracionReloj(r.minutos)}</td>
            <td>${ctx.etapasPorId.get(r.etapa)?.nombre || html`<span class="tenue">—</span>`}</td>
            <td>${ctx.trabajosPorId.get(r.trabajo)?.nombre || html`<span class="tenue">—</span>`}</td>
            <td style="min-width:200px">${r.descripcion || html`<span class="tenue">—</span>`}</td>
          </tr>`)}</tbody>
        </table></div>
        ${regs.length > filasDet && html`<div><button class="btn btn-chico" onClick=${() => setFilasDet(n => n + 50)}>Ver 50 más</button></div>`}
      </section>
    </div>
  </div>`;
}

/* ----- La vista ----- */
function VistaHoras({ ctx, editable, alAbrir }) {
  const [sub, setSubS] = useState(() => (leer('finora-horas-sub') === 'reportes' ? 'reportes' : 'registro'));
  const setSub = s => { setSubS(s); guardar('finora-horas-sub', s); };
  const [editando, setEditando] = useState(null);
  return html`<div class="vista horas">
    <div class="vista-cab">
      <div><h2>Horas</h2><p>Cargá en qué trabajaste y cuánto tiempo, y mirá en los reportes cómo se reparte el trabajo del equipo.</p></div>
      <div class="subpestanas" role="group" aria-label="Sección de horas">
        <button aria-pressed=${sub === 'registro'} onClick=${() => setSub('registro')}><${Icono} n="reloj" t=${15} /> Registro</button>
        <button aria-pressed=${sub === 'reportes'} onClick=${() => setSub('reportes')}><${Icono} n="grafico" t=${15} /> Reportes</button>
      </div>
    </div>
    ${sub === 'registro'
      ? html`<${RegistroHoras} ctx=${ctx} editable=${editable} alAbrir=${alAbrir} alEditar=${setEditando} />`
      : html`<${ReportesHoras} ctx=${ctx} alAbrir=${alAbrir} />`}
    ${editando && html`<${ModalRegistro} ctx=${ctx} r=${editando} alCerrar=${() => setEditando(null)} />`}
  </div>`;
}

/* ----- Cabecera y detalle de tarea ----- */
function ChipCronometro({ ctx, alIr }) {
  const c = ctx.yo ? ctx.cronometros.get(ctx.yo) : null;
  useReloj(!!c);
  if (!c) return null;
  const etapa = c.etapa && ctx.etapasPorId.get(c.etapa);
  return html`<button class="chip-crono" onClick=${alIr} title=${'Tu cronómetro está en marcha' + (c.descripcion ? ': ' + c.descripcion : '')}>
    <span class="punto-vivo" aria-hidden="true"></span><span class="mono">${cronoTexto(Date.now() - new Date(c.inicio))}</span>${etapa ? html`<span class="nombre">${etapa.nombre}</span>` : null}
  </button>`;
}
function HorasDeTarea({ t, ctx, editable }) {
  const c = ctx.yo ? ctx.cronometros.get(ctx.yo) : null;
  const enEsta = !!(c && c.tarea === t.id);
  useReloj(enEsta);
  const total = ctx.horasPorTarea.get(t.id) || 0;
  const porPersona = new Map();
  for (const r of ctx.horas) if (r.tarea === t.id) porPersona.set(r.miembro, (porPersona.get(r.miembro) || 0) + (r.minutos || 0));
  return html`<section class="seccion">
    <div class="seccion-cab"><h3>Horas</h3>${total > 0 && html`<span class="mono tenue">${duracionTexto(total)}</span>`}</div>
    ${porPersona.size > 0 && html`<div class="selector-chips">${[...porPersona].sort((a, b) => b[1] - a[1]).map(([id, min]) => html`<span key=${id} class="chip-btn" style="cursor:default">
      <${Avatar} m=${ctx.integrantes.get(id)} t=${22} />${nombreDe(id, ctx)} <span class="mono tenue">${duracionTexto(min)}</span></span>`)}</div>`}
    ${editable && ctx.yo && (enEsta
      ? html`<div class="fila"><span class="crono-tiempo mono vivo">${cronoTexto(Date.now() - new Date(c.inicio))}</span>
          <button class="btn btn-detener btn-chico" onClick=${() => accionesHoras.detener()}><${Icono} n="stop" t=${13} />Detener</button></div>`
      : html`<div><button class="btn btn-chico" onClick=${() => accionesHoras.iniciar({ tarea: t.id, descripcion: t.titulo })}><${Icono} n="play" t=${13} />${c ? 'Pasar el cronómetro a esta tarea' : 'Iniciar cronómetro en esta tarea'}</button></div>`)}
    ${!total && !enEsta && !(editable && ctx.yo) && html`<p class="tenue">Sin horas registradas.</p>`}
  </section>`;
}
