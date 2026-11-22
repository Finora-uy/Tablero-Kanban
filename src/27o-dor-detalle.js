
/* ===== Detalle de la tarea: campos Scrum y Definition of Ready ===== */

// Filas del bloque de propiedades: sprint, MoSCoW y requerimiento
function FilasScrum({ t, ctx, editable, act }) {
  const sprint = sprintDe(t, ctx);
  const puede = editable && puedeGestionarScrum();
  const rf = useBorrador(t.rf || '', v => { const x = v.trim(); if (x !== (t.rf || '')) act({ rf: x }, x ? `la vinculó al requerimiento ${x}` : 'sacó el requerimiento vinculado'); });
  return html`
    <label class="prop-etq" for="det-sprint">Sprint</label>
    <div class="fila">
      <select class="entrada" id="det-sprint" style="width:auto" value=${sprint ? sprint.id : ''} disabled=${!puede}
        onChange=${async e => { const ok = await accionesScrum.asignar(t.id, e.target.value || null); if (!ok) notificar(); }}>
        <option value="">Sin sprint</option>
        ${ctx.sprints.map(s => html`<option value=${s.id}>${s.nombre} · ${fechaCorta(s.inicio)} – ${fechaCorta(s.fin)}</option>`)}
      </select>
      ${editable && !puede && html`<span class="nota">Lo asignan el Scrum Master o el Product Owner (exige DoR).</span>`}
      ${puede && !ctx.sprints.length && html`<span class="nota">Todavía no hay sprints: se crean en Scrum.</span>`}
    </div>

    <label class="prop-etq" for="det-moscow">MoSCoW</label>
    <select class="entrada" id="det-moscow" style="width:auto" value=${t.moscow || ''} disabled=${!editable}
      onChange=${e => { const v = e.target.value || null; act({ moscow: v }, v ? `cambió el MoSCoW a ${MOSCOW_POR_ID[v].nombre}` : 'sacó el MoSCoW'); }}>
      <option value="">Sin definir</option>
      ${MOSCOW.map(m => html`<option value=${m.id}>${m.nombre} · ${m.desc}</option>`)}
    </select>

    <label class="prop-etq" for="det-rf">Requerimiento</label>
    <input class="entrada" id="det-rf" type="text" style="max-width:180px" maxlength="20" placeholder="Ej.: RF-12" disabled=${!editable} ...${rf} />`;
}

function CampoDoR({ valor, alGuardar, id, area, placeholder, editable, etiqueta }) {
  const b = useBorrador(valor || '', v => { if (v.trim() !== (valor || '')) alGuardar(v.trim()); });
  return area
    ? html`<textarea class="entrada" id=${id} rows="2" aria-label=${etiqueta} placeholder=${placeholder} disabled=${!editable} ...${b}></textarea>`
    : html`<input class="entrada" id=${id} type="text" aria-label=${etiqueta} placeholder=${placeholder} disabled=${!editable} ...${b} />`;
}

// Lo que cada criterio muestra además de su texto: campos para completar o información útil para quien verifica
function ExtraCriterio({ c, t, ctx, editable, act }) {
  const sub = (campo, clave) => v => act({ [campo]: { ...(t[campo] || {}), [clave]: v } });
  if (c.id === 'demo') return html`<${CampoDoR} id="dor-demo" etiqueta="Cómo se muestra en la revisión" placeholder="Ej.: se abre el Excel de ejemplo y se ve la alerta con fecha y monto" valor=${t.demo} editable=${editable} alGuardar=${v => act({ demo: v }, 'definió cómo se muestra en la revisión')} area />`;
  if (c.id === 'pregunta') return html`<${CampoDoR} id="dor-pregunta" etiqueta="Pregunta" placeholder="¿Qué queremos averiguar?" valor=${(t.spike || {}).pregunta} editable=${editable} alGuardar=${sub('spike', 'pregunta')} area />`;
  if (c.id === 'tiempo') return html`<${CampoDoR} id="dor-tiempo" etiqueta="Tiempo máximo" placeholder="Ej.: 8 h" valor=${(t.spike || {}).tiempo} editable=${editable} alGuardar=${sub('spike', 'tiempo')} />`;
  if (c.id === 'salida') return html`<select class="entrada" id="dor-salida" style="width:auto" aria-label="Salida esperada" value=${(t.spike || {}).salida || ''} disabled=${!editable} onChange=${e => sub('spike', 'salida')(e.target.value || null)}>
    <option value="">Elegí la salida</option>${SALIDAS_SPIKE.map(x => html`<option value=${x.id}>${x.nombre}</option>`)}</select>`;
  if (c.id === 'pasos') return html`<${CampoDoR} id="dor-pasos" etiqueta="Pasos de reproducción" placeholder="1. Abrir… 2. Hacer clic en…" valor=${(t.bug || {}).pasos} editable=${editable} alGuardar=${sub('bug', 'pasos')} area />`;
  if (c.id === 'severidad') return html`<select class="entrada" id="dor-severidad" style="width:auto" aria-label="Severidad" value=${(t.bug || {}).severidad || ''} disabled=${!editable} onChange=${e => sub('bug', 'severidad')(e.target.value || null)}>
    <option value="">Elegí la severidad</option>${SEVERIDADES.map(x => html`<option value=${x.id}>${x.nombre}</option>`)}</select>`;
  if (c.id === 'esperado') return html`<${CampoDoR} id="dor-esperado" etiqueta="Comportamiento esperado" placeholder="Qué debería pasar" valor=${(t.bug || {}).esperado} editable=${editable} alGuardar=${sub('bug', 'esperado')} area />`;
  if (c.id === 'dependencias') {
    const p = dependenciasPendientes(t, ctx);
    return p.length ? html`<p class="sc-info">Hoy depende de ${p.length === 1 ? '1 tarea sin terminar' : p.length + ' tareas sin terminar'}: ${p.map(d => codigo(d, ctx)).join(', ')}. Tiene que estar resuelto o planificado en el mismo sprint.</p>` : null;
  }
  if (c.id === 'capacidad') {
    const asig = (t.asignados || []).filter(id => ctx.integrantes.has(id));
    if (!asig.length) return null;
    const semanal = id => [0, 1, 2, 3, 4].reduce((a, d) => a + minutosFranjas(semanaDe(ctx, id)[d]), 0) / 60;
    return html`<p class="sc-info">Disponibilidad semanal según Disponibilidad: ${asig.map(id => `${nombreDe(id, ctx)} ${horasTxt(semanal(id))}`).join(' · ')}${tieneEstimacion(t) ? `. Estimación: ${t.estimacion} pts.` : '.'}</p>`;
  }
  return null;
}

function SeccionDoR({ t, ctx, editable, act }) {
  const [pidiendo, setPidiendo] = useState(false);
  const [form, setForm] = useState({ faltante: '', responsable: '', plazo: sumarDias(ctx.hoy, 3) });
  const ev = evaluarDoR(t);
  const sprint = sprintDe(t, ctx);
  const exc = t.dorExcepcion;
  const aprobada = excepcionAprobada(t);
  const vencida = excepcionVencida(t, ctx.hoy);
  const sabeQuien = !!ctx.yo;
  const antesDeListo = indiceColumna(t.columna) < indiceColumna('listo');
  const listaParaSprint = !!t.dorOk && ev.completa;
  const tipoTxt = t.tipo === 'inv' ? 'Es una investigación técnica (spike): no se estima en puntos ni pide criterios de aceptación; alcanza con la pregunta, el tiempo máximo y la salida esperada.'
    : t.tipo === 'bug' ? 'Es un defecto: para entrar al sprint necesita pasos de reproducción, severidad y el comportamiento esperado.' : null;
  const pedir = async () => {
    if (!form.faltante.trim() || !form.plazo) return;
    if (await accionesScrum.pedirExcepcion(t.id, form)) { setPidiendo(false); setForm({ faltante: '', responsable: '', plazo: sumarDias(ctx.hoy, 3) }); }
  };
  const aprobacion = (rol, nombreRol) => {
    const quien = exc && exc.aprobaciones && exc.aprobaciones[rol];
    return html`<li><span class="crece">${nombreRol}</span>
      ${quien ? html`<span class="tag hecho"><${Icono} n="check" t=${11} />${nombreDe(quien, ctx)}</span>`
        : html`<span class="tag baja">Pendiente</span>
          ${editable && sabeQuien && html`<button class="btn btn-chico" disabled=${!puedeAprobarExcepcion(rol)} title=${puedeAprobarExcepcion(rol) ? '' : 'Solo ' + nombreRol} onClick=${() => accionesScrum.aprobarExcepcion(t.id, rol)}>Dar mi acuerdo</button>`}`}
    </li>`;
  };
  return html`<section class=${'seccion sc-dor' + (listaParaSprint ? ' lista' : '')}>
    <div class="seccion-cab"><h3>Definition of Ready</h3><span class="mono tenue">${ev.cumplidos}/${ev.total}</span>
      ${t.columna === 'listo' ? html`<span class="tag hecho"><${Icono} n="check" t=${11} />Listo</span>` : listaParaSprint ? html`<span class="tag hecho">Lista</span>` : aprobada ? html`<span class="tag media">Con excepción</span>` : null}</div>
    <div class=${'progreso' + (ev.completa ? ' completo' : '')}><div style=${`width:${ev.cumplidos / ev.total * 100}%`}></div></div>
    ${tipoTxt && html`<p class="tenue">${tipoTxt}</p>`}
    <ul class="sc-criterios">${ev.items.map(({ c, auto, tilde, ok, check }) => html`<li key=${c.id} class=${ok ? 'ok' : ''}>
      ${c.manual
        ? html`<input type="checkbox" id=${'dor-ck-' + c.id} checked=${tilde} disabled=${!editable || !sabeQuien} aria-label=${c.nombre} onChange=${e => accionesScrum.tildar(t.id, c.id, e.target.checked)} />`
        : html`<span class=${'sc-estado' + (ok ? ' ok' : '')} aria-label=${ok ? 'Cumplido' : 'Falta'}>${ok ? html`<${Icono} n="check" t=${13} />` : null}</span>`}
      <div class="sc-crit-cuerpo">
        <div class="sc-crit-cab"><strong>${c.nombre}</strong><span class="tag baja" title="Quién lo verifica">${c.verifica}</span></div>
        <p class="tenue">${c.texto}</p>
        ${c.auto && !auto && c.falta && html`<p class="sc-falta">Falta: ${c.falta}.</p>`}
        ${c.manual && check && html`<p class="sc-info">Lo tildó ${nombreDe(check.por, ctx)} · ${momento(check.en)}</p>`}
        <${ExtraCriterio} c=${c} t=${t} ctx=${ctx} editable=${editable} act=${act} />
      </div>
    </li>`)}</ul>
    ${!sabeQuien && editable && html`<p class="tenue">Sumate al tablero (menú de tu perfil) para tildar la DoR.</p>`}

    <div class="sc-dor-estado">
      ${ev.completa
        ? (t.dorOk
          ? html`<p><strong>Cumple la DoR.</strong> ${t.dorOk.por ? `La marcó como Lista ${nombreDe(t.dorOk.por, ctx)} · ${momento(t.dorOk.en)}.` : ''}${sprint ? ` Está en el ${sprint.nombre}.` : ' Ya se puede sumar a un sprint.'}</p>`
          : html`<p><strong>Cumple los criterios.</strong> Falta que el Product Owner la pase a Listo.</p>`)
        : html`<p>Falta: ${textoFaltan(ev, 10)}.</p>`}
      ${ev.completa && !t.dorOk && editable && html`<div><button class="btn btn-primario btn-chico" disabled=${!puedeMarcarListo()} title=${puedeMarcarListo() ? '' : 'Solo el Product Owner'} onClick=${() => accionesScrum.marcarListo(t.id)}><${Icono} n="check" t=${14} />Marcar como Listo</button>
        ${!puedeMarcarListo() && html` <span class="tenue">Solo el Product Owner.</span>`}</div>`}
    </div>

    <div class="sc-excepcion">
      <h4>Ingreso con excepción</h4>
      ${!exc && !pidiendo && html`<p class="tenue">Si no cumple algún criterio, puede entrar a un sprint solo si el Scrum Master y el Product Owner lo acuerdan, y queda registrado qué falta, quién lo resuelve y en qué plazo.</p>
        ${editable && !listaParaSprint && html`<div><button class="btn btn-chico" onClick=${() => setPidiendo(true)}>Pedir una excepción</button></div>`}`}
      ${pidiendo && !exc && html`<div class="sc-exc-form">
        <div class="campo"><label for="exc-faltante">Qué falta</label><textarea class="entrada" id="exc-faltante" rows="2" placeholder="Ej.: faltan los datos de prueba del Odoo" value=${form.faltante} onInput=${e => setForm(f => ({ ...f, faltante: e.target.value }))}></textarea></div>
        <div class="grilla-2">
          <div class="campo"><label for="exc-resp">Quién lo resuelve</label><select class="entrada" id="exc-resp" value=${form.responsable} onChange=${e => setForm(f => ({ ...f, responsable: e.target.value }))}><option value="">Sin definir</option>${ctx.miembros.map(m => html`<option value=${m.id}>${m.nombre}</option>`)}</select></div>
          <div class="campo"><label for="exc-plazo">Plazo (primeros días del sprint)</label><input class="entrada" id="exc-plazo" type="date" value=${form.plazo} onChange=${e => setForm(f => ({ ...f, plazo: e.target.value }))} /></div>
        </div>
        <div class="fila"><button class="btn btn-primario btn-chico" disabled=${!form.faltante.trim() || !form.plazo} onClick=${pedir}>Pedir la excepción</button><button class="btn btn-fantasma btn-chico" onClick=${() => setPidiendo(false)}>Cancelar</button></div>
      </div>`}
      ${exc && html`<div class=${'sc-exc' + (vencida ? ' vencida' : '')}>
        <p><strong>Falta:</strong> ${exc.faltante}</p>
        <p class="tenue">Lo resuelve ${exc.responsable ? nombreDe(exc.responsable, ctx) : 'alguien sin definir'}${exc.plazo ? ` · plazo ${fechaLarga(exc.plazo)}${exc.resueltaEn ? '' : ' (' + cuandoVence(exc.plazo, ctx.hoy) + ')'}` : ''} · pedida por ${exc.pedidaPor ? nombreDe(exc.pedidaPor, ctx) : 'alguien'} ${momento(exc.en)}</p>
        <ul class="lista-simple">${aprobacion('sm', 'Scrum Master')}${aprobacion('po', 'Product Owner')}</ul>
        ${aprobada && !exc.resueltaEn && html`<p class=${vencida ? 'sc-falta' : 'sc-info'}>${vencida ? 'Venció el plazo sin resolver el faltante: el ítem sale del sprint.' : 'Aprobada: puede entrar a un sprint.'}</p>`}
        ${exc.resueltaEn && html`<p class="sc-info">Faltante resuelto ${momento(exc.resueltaEn)}.</p>`}
        ${editable && html`<div class="fila">
          ${aprobada && html`<button class="btn btn-chico" onClick=${() => accionesScrum.resolverExcepcion(t.id, !exc.resueltaEn)}>${exc.resueltaEn ? 'Reabrir el faltante' : 'Marcar el faltante como resuelto'}</button>`}
          <button class="btn btn-fantasma btn-chico" onClick=${() => accionesScrum.retirarExcepcion(t.id)}>Retirar la excepción</button></div>`}
      </div>`}
    </div>
  </section>`;
}
