
/* ===== Sección Scrum: calendario, sprints y planificación ===== */
const horasTxt = h => `${numUY(Math.round(h * 10) / 10)} h`;
const puntosTxt = n => `${numUY(n)} pt${n === 1 ? '' : 's'}`;
// Cómo está una tarea frente a la DoR, para mostrarlo en listas
function estadoDoRTarea(t) {
  const ev = evaluarDoR(t);
  if (excepcionAprobada(t)) return { clase: 'media', texto: 'Excepción', ev, ok: true };
  if (t.dorOk && ev.completa) return { clase: 'hecho', texto: 'Lista', ev, ok: true };
  if (ev.completa) return { clase: 'media', texto: 'Falta el Listo del PO', ev, ok: false };
  return { clase: 'baja', texto: `DoR ${ev.cumplidos}/${ev.total}`, ev, ok: false };
}
const ordenBacklog = (a, b) => (MOSCOW_POR_ID[a.moscow] ? MOSCOW_POR_ID[a.moscow].orden : 9) - (MOSCOW_POR_ID[b.moscow] ? MOSCOW_POR_ID[b.moscow].orden : 9)
  || (PRIORIDAD[b.prioridad || 'media'].peso - PRIORIDAD[a.prioridad || 'media'].peso) || (a.numero || 0) - (b.numero || 0);

function VistaScrum({ ctx, e, editable, alAbrir, alFiltrar }) {
  const [sel, setSel] = useState(null);
  if (!e.cargado.sprints) return html`<div class="cargando"><${Isotipo} t=${48} /><p>Cargando los sprints…</p></div>`;
  const puede = editable && puedeGestionarScrum();
  const actual = ctx.sprints.find(s => ctx.hoy >= s.inicio && ctx.hoy <= s.fin) || ctx.sprints[0] || null;
  const elegido = ctx.sprintsPorId.get(sel) || actual;
  const venc = ctx.tareas.filter(t => !t.archivada && !esHecha(t, ctx) && excepcionVencida(t, ctx.hoy));
  const rotas = ctx.tareas.filter(t => !t.archivada && !esHecha(t, ctx) && sprintDe(t, ctx) && !estadoDoRTarea(t).ok);
  const sm = nombresConRol(rolSM, ctx), po = nombresConRol(rolPO, ctx);
  const ultimo = ctx.sprints[ctx.sprints.length - 1];
  return html`<div class="vista">
    <div class="vista-cab">
      <div><h2>Scrum</h2><p>Sprints del ${fechaLarga(SCRUM.desde)} al ${fechaLarga(SCRUM.hasta)}. Cada sprint crea su etiqueta y su etapa; una tarea solo entra si cumple la Definition of Ready.</p></div>
      ${puede && html`<div class="fila">
        ${!ctx.sprints.length && html`<button class="btn btn-primario" onClick=${() => accionesScrum.crearCuatro()}><${Icono} n="mas" />Crear los 4 sprints de 2 semanas</button>`}
        ${ctx.sprints.length > 0 && html`<button class="btn btn-primario" onClick=${() => accionesScrum.crearSprint(2)}><${Icono} n="mas" />Nuevo sprint</button>`}
      </div>`}
    </div>
    <div class="sc-roles">
      <span><strong>Scrum Master:</strong> ${sm || html`<span class="tenue">sin asignar</span>`}</span>
      <span><strong>Product Owner:</strong> ${po || html`<span class="tenue">sin asignar</span>`}</span>
      ${!puede && editable && html`<span class="tenue">Solo ellos crean y organizan los sprints.</span>`}
    </div>
    ${sinRolesScrum() && html`<div class="banner alerta"><${Icono} n="candado" /><span><strong>Falta asignar los roles.</strong> Mientras nadie tenga el rol <em>Scrum Master</em> o <em>Product Owner</em>, cualquiera puede organizar los sprints. Cada uno lo pone en su perfil (Equipo → Rol).</span></div>`}
    ${(venc.length > 0 || rotas.length > 0) && html`<div class="banner error"><${Icono} n="candado" /><span>
      ${venc.length > 0 && html`<strong>${venc.length === 1 ? '1 excepción de DoR vencida' : venc.length + ' excepciones de DoR vencidas'}:</strong> ${venc.map((t, i) => html`${i ? ', ' : ' '}<button class="btn-link" onClick=${() => alAbrir(t.id)}>${codigo(t, ctx)}</button>`)}. El faltante no se resolvió a tiempo y el ítem sale del sprint. `}
      ${rotas.length > 0 && html`<strong>Con la DoR incompleta dentro de un sprint:</strong> ${rotas.map((t, i) => html`${i ? ', ' : ' '}<button class="btn-link" onClick=${() => alAbrir(t.id)}>${codigo(t, ctx)}</button>`)}.`}
    </span></div>`}

    <${CalendarioScrum} ctx=${ctx} />

    ${ctx.sprints.length > 0
      ? html`<${SprintsResumen} ctx=${ctx} puede=${puede} sel=${elegido && elegido.id} alElegir=${setSel} alFiltrar=${alFiltrar} />
        <${PlanificacionScrum} ctx=${ctx} puede=${puede} alAbrir=${alAbrir} />
        ${elegido && html`<${Burndown} s=${elegido} ctx=${ctx} />`}`
      : html`<div class="vacio-vista"><${Icono} n="calendario" t=${28} /><p>Todavía no hay sprints.${puede ? ' Creá los 4 de 2 semanas con el botón de arriba, o armalos de a uno con la duración que quieras.' : ' Los crea el Scrum Master o el Product Owner.'}</p></div>`}
    ${ultimo && ultimo.fin < SCRUM.hasta && html`<p class="tenue">Del ${fechaLarga(sumarDias(ultimo.fin, 1))} al ${fechaLarga(SCRUM.hasta)} queda de margen.</p>`}
  </div>`;
}

/* ----- Calendario: semanas de lunes a domingo, con los sprints como franjas de color ----- */
function CalendarioScrum({ ctx }) {
  const lunes0 = sumarDias(SCRUM.desde, -((aFecha(SCRUM.desde).getDay() + 6) % 7));
  const nSem = Math.ceil((diasEntre(lunes0, SCRUM.hasta) + 1) / 7);
  const ultimoFin = ctx.sprints.length ? ctx.sprints[ctx.sprints.length - 1].fin : null;
  const ceremonias = new Map(), hitos = new Map(), fechas = new Map();
  for (const s of ctx.sprints) for (const c of ceremoniasSprint(s)) { if (!ceremonias.has(c.fecha)) ceremonias.set(c.fecha, []); ceremonias.get(c.fecha).push(c); }
  for (const x of ctx.hitos) if (x.fin) { if (!hitos.has(x.fin)) hitos.set(x.fin, []); hitos.get(x.fin).push(x); }
  for (const x of ctx.fechas) { if (!fechas.has(x.fecha)) fechas.set(x.fecha, []); fechas.get(x.fecha).push(x); }
  const celdas = [];
  for (let i = 0; i < nSem * 7; i++) {
    const iso = sumarDias(lunes0, i);
    const d = aFecha(iso);
    const dow = (d.getDay() + 6) % 7;
    const s = ctx.sprints.find(x => iso >= x.inicio && iso <= x.fin);
    const fuera = iso < SCRUM.desde || iso > SCRUM.hasta;
    const margen = !s && !fuera && ultimoFin && iso > ultimoFin;
    const feriado = !fuera && esFeriado(ctx, iso);
    const ausentes = fuera ? 0 : ctx.miembros.filter(m => ausencia(ctx, m.id, iso) !== null).length;
    const etiquetaSprint = s && (iso === s.inicio || dow === 0) ? `${s.nombre} · sem. ${Math.floor(diasEntre(s.inicio, iso) / 7) + 1}/${s.semanas}` : null;
    celdas.push(html`<div key=${iso} class=${'sc-dia' + (fuera ? ' fuera' : '') + (iso === ctx.hoy ? ' hoy' : '') + (s ? ' en-sprint' : '') + (margen ? ' margen' : '') + (dow > 4 ? ' finde' : '')}
        style=${s ? `--sp:var(--c-${s.color})` : ''}>
      <div class="sc-num"><span>${d.getDate()}</span>${(d.getDate() === 1 || i === 0) && html`<span class="sc-mes">${MESES_CORTOS[d.getMonth()]}</span>`}${feriado && html`<span class="sc-feriado" title="Feriado">feriado</span>`}</div>
      ${etiquetaSprint && html`<span class="sc-tag-sprint">${etiquetaSprint}</span>`}
      ${margen && dow === 0 && html`<span class="sc-tag-margen">Margen</span>`}
      ${(ceremonias.get(iso) || []).map(c => html`<span key=${c.id} class=${'sc-cer ' + c.id} title=${`${c.sprint.nombre}: ${c.nombre}`}>${c.corto}</span>`)}
      ${(hitos.get(iso) || []).map(x => html`<span key=${x.id} class="sc-hito" title=${'Hito: ' + x.nombre}><${Icono} n="bandera" t=${11} />${x.nombre}</span>`)}
      ${(fechas.get(iso) || []).map(x => html`<span key=${x.id} class="sc-fecha" title=${x.titulo}><${Icono} n="estrella" t=${11} />${x.titulo}</span>`)}
      ${ausentes > 0 && html`<span class="sc-aus" title=${`${ausentes} ${ausentes === 1 ? 'persona no está' : 'personas no están'} este día`}>${ausentes} ausente${ausentes === 1 ? '' : 's'}</span>`}
    </div>`);
  }
  return html`<section class="seccion">
    <div class="seccion-cab"><h3>Calendario del ${fechaCorta(SCRUM.desde)} al ${fechaCorta(SCRUM.hasta)}</h3></div>
    <div class="sc-cal-env"><div class="sc-cal" role="grid" aria-label="Calendario de sprints">
      ${['lun', 'mar', 'mié', 'jue', 'vie', 'sáb', 'dom'].map(n => html`<div class="cal-dia-nombre etiqueta-mono" key=${n}>${n}</div>`)}
      ${celdas}
    </div></div>
    <div class="sc-leyenda">
      ${ctx.sprints.map(s => html`<span key=${s.id} class="sc-ley" style=${`--sp:var(--c-${s.color})`}><i></i>${s.nombre}: ${fechaCorta(s.inicio)} – ${fechaCorta(s.fin)}</span>`)}
      <span class="sc-ley"><span class="sc-cer planning">Planning + refinamiento</span></span>
      <span class="sc-ley"><span class="sc-cer ref2">Refinamiento (SM y PO)</span></span>
      <span class="sc-ley"><span class="sc-cer revision">Revisión + retro</span></span>
    </div>
  </section>`;
}

/* ----- Un resumen por sprint: duración, objetivo, capacidad y avance ----- */
function SprintsResumen({ ctx, puede, sel, alElegir, alFiltrar }) {
  const [borrar, setBorrar] = useState(null);
  return html`<section class="seccion">
    <div class="seccion-cab"><h3>Sprints</h3><span class="mono tenue">${ctx.sprints.length}</span></div>
    <div class="sc-sprints">${ctx.sprints.map((s, i) => {
      const r = resumenSprint(s, ctx), cap = capacidadSprint(s, ctx);
      const prev = ctx.sprints[i - 1], velPrev = prev ? resumenSprint(prev, ctx).puntosHechos : null;
      const sobre = velPrev > 0 && r.puntos > velPrev;
      return html`<article key=${s.id} class=${'sc-sprint' + (sel === s.id ? ' elegido' : '')} style=${`--sp:var(--c-${s.color})`}>
        <header>
          <h4><button class="btn-link" aria-pressed=${sel === s.id} onClick=${() => alElegir(s.id)} title="Ver su avance">${s.nombre}</button></h4>
          ${puede ? html`<select class="entrada" id=${'sc-sem-' + s.id} style="width:auto;height:28px;min-height:28px;padding-block:2px" aria-label=${'Semanas de ' + s.nombre} value=${String(s.semanas)} onChange=${ev => accionesScrum.cambiarSemanas(s.id, Number(ev.target.value))}>
              ${[1, 2, 3, 4].map(n => html`<option value=${String(n)}>${n} semana${n === 1 ? '' : 's'}</option>`)}</select>`
            : html`<span class="tag baja">${s.semanas} semana${s.semanas === 1 ? '' : 's'}</span>`}
        </header>
        <p class="sc-fechas">${fechaLarga(s.inicio)} – ${fechaLarga(s.fin)}${s.fuera ? ' · se pasa del calendario' : ''}</p>
        <${ObjetivoSprint} s=${s} puede=${puede} />
        <dl class="sc-datos">
          <div><dt>Tareas</dt><dd>${r.hechas.length}/${r.tareas.length} hechas</dd></div>
          <div><dt>Puntos</dt><dd>${r.puntosHechos}/${r.puntos}${r.sinEstimar ? html` <span class="tenue" title="Tareas sin estimar">(+${r.sinEstimar} sin estimar)</span>` : ''}</dd></div>
          <div><dt>Horas disponibles</dt><dd title=${cap.personas.filter(p => p.horas > 0).map(p => `${p.m.nombre}: ${horasTxt(p.horas)}`).join(' · ') || 'Nadie cargó su disponibilidad'}>${horasTxt(cap.horas)}</dd></div>
          ${velPrev != null && html`<div><dt>Velocidad anterior</dt><dd class=${sobre ? 'sc-alerta' : ''}>${puntosTxt(velPrev)}${sobre ? ' · lo supera' : ''}</dd></div>`}
        </dl>
        <div class="fila">
          <button class="btn btn-chico" onClick=${() => alFiltrar({ etiquetas: [s.id] })}>Ver en el tablero</button>
          ${puede && (borrar === s.id
            ? html`<span class="confirmar-linea"><span>¿Borrar ${s.nombre} y su etiqueta y etapa?</span>
                <button class="btn btn-peligro btn-chico" onClick=${async () => { if (await accionesScrum.borrarSprint(s.id)) setBorrar(null); }}>Borrar</button>
                <button class="btn btn-fantasma btn-chico" onClick=${() => setBorrar(null)}>No</button></span>`
            : html`<button class="btn-icono chico" aria-label=${'Borrar ' + s.nombre} title="Borrar el sprint" onClick=${() => setBorrar(s.id)}><${Icono} n="basura" t=${14} /></button>`)}
        </div>
      </article>`;
    })}</div>
  </section>`;
}
function ObjetivoSprint({ s, puede }) {
  const obj = useBorrador(s.objetivo || '', v => { if (v !== (s.objetivo || '')) accionesScrum.guardarObjetivo(s.id, v); });
  if (!puede) return s.objetivo ? html`<p class="sc-objetivo">${s.objetivo}</p>` : html`<p class="sc-objetivo tenue">Sin objetivo definido.</p>`;
  return html`<textarea class="entrada" id=${'sc-obj-' + s.id} rows="2" aria-label=${'Objetivo de ' + s.nombre} placeholder="Objetivo del sprint (qué queremos mostrar en la revisión)" ...${obj}></textarea>`;
}

/* ----- Planificación: backlog a la izquierda, sprints a la derecha ----- */
function PlanificacionScrum({ ctx, puede, alAbrir }) {
  const [sobre, setSobre] = useState(null);
  const backlog = ctx.tareas.filter(t => !t.archivada && !esHecha(t, ctx) && !sprintDe(t, ctx)).sort(ordenBacklog);
  const listas = backlog.filter(t => estadoDoRTarea(t).ok);
  const porPreparar = backlog.filter(t => !estadoDoRTarea(t).ok);
  const soltar = (ev, s) => {
    ev.preventDefault(); setSobre(null);
    const id = ev.dataTransfer.getData('text/plain');
    if (id && puede) accionesScrum.asignar(id, s.id);
  };
  const fila = (t, enSprint) => {
    const d = estadoDoRTarea(t);
    const exc = excepcionAprobada(t);
    const vencida = excepcionVencida(t, ctx.hoy);
    return html`<li key=${t.id} class=${'sc-fila' + (enSprint && !d.ok ? ' rota' : '')} draggable=${puede} onDragStart=${ev => { ev.dataTransfer.setData('text/plain', t.id); ev.dataTransfer.effectAllowed = 'move'; }}>
      <button class="sc-fila-titulo" onClick=${() => alAbrir(t.id)} title=${t.titulo}><span class="mono">${codigo(t, ctx)}</span>${t.titulo}</button>
      <span class="sc-fila-meta">
        ${MOSCOW_POR_ID[t.moscow] && html`<span class="t-dato t-moscow" title=${MOSCOW_POR_ID[t.moscow].desc}>${MOSCOW_POR_ID[t.moscow].nombre}</span>`}
        ${tieneEstimacion(t) ? html`<span class="t-dato">${t.estimacion} pts</span>` : html`<span class="t-dato sin-estimar" title="Sin estimar">sin est.</span>`}
        <span class=${'tag ' + (vencida ? 'urgente' : enSprint && !d.ok ? 'alta' : d.clase)} title=${d.ev.faltan.length ? 'Falta: ' + textoFaltan(d.ev, 10) : 'Cumple la DoR'}>${vencida ? 'Excepción vencida' : enSprint && !d.ok ? 'DoR incompleta' : d.texto}</span>
        ${!enSprint && puede && ctx.sprints.length > 0 && html`<select class="entrada sc-asignar" id=${'sc-as-' + t.id} aria-label=${'Sumar ' + codigo(t, ctx) + ' a un sprint'} value="" onChange=${ev => { const v = ev.target.value; ev.target.value = ''; if (v) accionesScrum.asignar(t.id, v).then(ok => { if (!ok) notificar(); }); }}>
          <option value="">Sumar a…</option>${ctx.sprints.map(s => html`<option value=${s.id}>${s.nombre}</option>`)}</select>`}
        ${enSprint && puede && html`<button class="btn-icono chico" aria-label=${'Sacar ' + codigo(t, ctx) + ' del sprint'} title="Sacar del sprint" onClick=${() => accionesScrum.asignar(t.id, null)}><${Icono} n="cerrar" t=${13} /></button>`}
      </span>
    </li>`;
  };
  return html`<section class="seccion">
    <div class="seccion-cab"><h3>Planificación</h3><span class="mono tenue">${puede ? 'Arrastrá una tarea a un sprint o usá «Sumar a…»' : 'Solo lectura'}</span></div>
    <div class="sc-plan">
      <div class="sc-col">
        <h4>Listas para un sprint <span class="mono tenue">${listas.length}</span></h4>
        ${listas.length ? html`<ul class="sc-lista">${listas.map(t => fila(t, false))}</ul>` : html`<p class="tenue">No hay tareas listas. Cuando una cumple la DoR y el Product Owner la pasa a Listo, aparece acá.</p>`}
        <details>
          <summary>Todavía sin cumplir la DoR <span class="mono tenue">${porPreparar.length}</span></summary>
          <p class="tenue">No pueden entrar a un sprint hasta cumplirla. Se completa en el detalle de cada tarea; si es urgente, el Scrum Master y el Product Owner pueden aprobar una excepción.</p>
          ${porPreparar.length ? html`<ul class="sc-lista">${porPreparar.map(t => fila(t, false))}</ul>` : html`<p class="tenue">Ninguna.</p>`}
        </details>
      </div>
      <div class="sc-cols">${ctx.sprints.map(s => {
        const r = resumenSprint(s, ctx);
        return html`<div key=${s.id} class=${'sc-col sc-destino' + (sobre === s.id ? ' sobre' : '')} style=${`--sp:var(--c-${s.color})`}
            onDragOver=${ev => { if (puede) { ev.preventDefault(); if (sobre !== s.id) setSobre(s.id); } }} onDragLeave=${() => setSobre(x => (x === s.id ? null : x))} onDrop=${ev => soltar(ev, s)}>
          <h4><i></i>${s.nombre} <span class="mono tenue">${fechaCorta(s.inicio)} – ${fechaCorta(s.fin)}</span><span class="derecha mono">${puntosTxt(r.puntos)}</span></h4>
          ${r.tareas.length ? html`<ul class="sc-lista">${r.tareas.sort(ordenBacklog).map(t => fila(t, true))}</ul>` : html`<p class="tenue">Sin tareas todavía.</p>`}
        </div>`;
      })}</div>
    </div>
  </section>`;
}

/* ----- Burndown simple: puntos que faltan contra la línea ideal ----- */
function Burndown({ s, ctx }) {
  const b = datosBurndown(s, ctx);
  const W = 640, H = 170, mx = 36, my = 14;
  const n = b.puntos.length;
  const x = i => mx + (n > 1 ? i / (n - 1) : 0) * (W - mx - 10);
  const y = v => my + (1 - (b.total ? v / b.total : 0)) * (H - my * 2);
  const linea = clave => b.puntos.map((p, i) => p[clave] == null ? null : `${x(i).toFixed(1)},${y(p[clave]).toFixed(1)}`).filter(Boolean).join(' ');
  return html`<section class="seccion">
    <div class="seccion-cab"><h3>Avance de ${s.nombre}</h3><span class="mono tenue">Burndown en puntos</span></div>
    ${b.total === 0 ? html`<p class="tenue">${s.nombre} todavía no tiene tareas con puntos. Cuando las tenga, acá se ve cuántos puntos faltan cada día contra lo ideal.</p>`
      : html`<div class="sc-burn-env"><svg viewBox=${`0 0 ${W} ${H}`} class="sc-burn" role="img" aria-label=${`Burndown de ${s.nombre}: ${b.total} puntos`}>
        <line x1=${mx} y1=${y(0)} x2=${W - 10} y2=${y(0)} class="eje" /><line x1=${mx} y1=${y(b.total)} x2=${mx} y2=${y(0)} class="eje" />
        <text x=${mx - 6} y=${y(b.total) + 4} text-anchor="end" class="eje-texto">${b.total}</text><text x=${mx - 6} y=${y(0) + 4} text-anchor="end" class="eje-texto">0</text>
        <text x=${x(0)} y=${H - 1} class="eje-texto">${fechaCorta(s.inicio)}</text><text x=${x(n - 1)} y=${H - 1} text-anchor="end" class="eje-texto">${fechaCorta(s.fin)}</text>
        <polyline points=${linea('ideal')} class="ideal" fill="none" />
        <polyline points=${linea('real')} class="real" fill="none" style=${`stroke:var(--c-${s.color})`} />
      </svg></div>
      <p class="tenue"><span class="sc-ley"><i class="ideal-muestra"></i>Ideal</span> <span class="sc-ley" style=${`--sp:var(--c-${s.color})`}><i></i>Real</span></p>`}
  </section>`;
}
