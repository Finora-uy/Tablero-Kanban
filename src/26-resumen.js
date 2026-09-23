
/* ===== Resumen ===== */
function BarrasH({ filas }) {
  const max = Math.max(1, ...filas.map(f => f.valor));
  return html`<div class="barras">${filas.map(f => html`<div class="barra-fila" key=${f.id} tabindex="0" data-tip=${f.detalle}>
    <div class="barra-etq">${f.etiqueta}</div>
    <div class="barra-pista">
      ${f.valor > 0 && html`<div class="barra" style=${`width:calc((100% - 3.5rem) * ${f.valor / max})`}></div>`}
      <span class="barra-valor">${numUY(f.valor)}</span>
    </div>
  </div>`)}</div>`;
}
function ColumnasSemana({ datos }) {
  const max = Math.max(1, ...datos.map(d => d.valor));
  return html`<div>
    <div class="columnas-graf">${datos.map(d => html`<div class="cg-item" key=${d.etq} tabindex="0" data-tip=${d.detalle}>
      <span class="cg-valor">${d.valor}</span>
      <div class="cg-barra" style=${`height:${d.valor / max * 100}%`}></div>
    </div>`)}</div>
    <div class="cg-etqs" aria-hidden="true">${datos.map(d => html`<span key=${d.etq}>${d.etq}</span>`)}</div>
  </div>`;
}
function lunesDe(d) { const x = new Date(d.getFullYear(), d.getMonth(), d.getDate()); x.setDate(x.getDate() - ((x.getDay() + 6) % 7)); return x; }

function VistaResumen({ ctx, alAbrir, alFiltrar }) {
  const activas = ctx.tareas.filter(t => !t.archivada);
  const abiertas = activas.filter(t => !esHecha(t, ctx));
  const vencidas = abiertas.filter(t => estaVencida(t, ctx));
  const bloqueadas = abiertas.filter(t => estaBloqueada(t, ctx));
  const hace7 = Date.now() - 7 * 864e5, hace30 = Date.now() - 30 * 864e5;
  const hechas7 = activas.filter(t => esHecha(t, ctx) && t.terminadaEn && new Date(t.terminadaEn) >= hace7);
  const recientes = activas.filter(t => esHecha(t, ctx) && t.terminadaEn && t.creadaEn && new Date(t.terminadaEn) >= hace30);
  const ciclo = recientes.length ? recientes.reduce((a, t) => a + (new Date(t.terminadaEn) - new Date(t.creadaEn)) / 864e5, 0) / recientes.length : null;
  const ptsAbiertos = abiertas.reduce((a, t) => a + (t.estimacion || 0), 0);

  const porColumna = ctx.columnas.map(c => {
    const n = activas.filter(t => t.columna === c.id).length;
    return { id: c.id, etiqueta: c.nombre, valor: n, detalle: `${c.nombre}: ${n} tarea${n === 1 ? '' : 's'}${c.limiteWip ? ` · límite ${c.limiteWip}` : ''}` };
  });
  const porPersona = [...ctx.miembros.map(m => ({ id: m.id, m })), { id: 'sin', m: null }].map(({ id, m }) => {
    const ts = abiertas.filter(t => id === 'sin' ? !(t.asignados || []).length : (t.asignados || []).includes(id));
    const pts = ts.reduce((a, t) => a + (t.estimacion || 0), 0);
    const venc = ts.filter(t => estaVencida(t, ctx)).length;
    const nombre = m ? m.nombre : 'Sin asignar';
    return {
      id, valor: ts.length,
      etiqueta: html`${m ? html`<${Avatar} m=${m} t=${20} />` : null}<span>${nombre}</span>`,
      detalle: `${nombre}: ${ts.length} abierta${ts.length === 1 ? '' : 's'}${pts ? ` · ${pts} pts` : ''}${venc ? ` · ${venc} vencida${venc === 1 ? '' : 's'}` : ''}`,
    };
  }).filter(f => f.id !== 'sin' || f.valor > 0);
  const semanas = [];
  const esta = lunesDe(new Date());
  for (let i = 7; i >= 0; i--) {
    const ini = new Date(esta); ini.setDate(ini.getDate() - i * 7);
    const fin = new Date(ini); fin.setDate(fin.getDate() + 7);
    const n = activas.filter(t => esHecha(t, ctx) && t.terminadaEn && new Date(t.terminadaEn) >= ini && new Date(t.terminadaEn) < fin).length;
    const ultimo = new Date(fin); ultimo.setDate(ultimo.getDate() - 1);
    semanas.push({ etq: `${ini.getDate()}/${ini.getMonth() + 1}`, valor: n, detalle: `Semana del ${fechaLarga(isoDe(ini))} al ${fechaLarga(isoDe(ultimo))}: ${n} terminada${n === 1 ? '' : 's'}` });
  }
  const proximas = abiertas.filter(t => t.vence && diasEntre(ctx.hoy, t.vence) <= 14).sort((a, b) => a.vence.localeCompare(b.vence)).slice(0, 8);
  const proxHito = ctx.hitos.find(x => x.fin && x.fin >= ctx.hoy);

  const tile = (etq, valor, detalle, rojo, alClick) => html`<div class="tile">
    <span class="etiqueta-mono">${etq}</span>
    <span class=${'valor' + (rojo ? ' rojo' : '')}>${valor}</span>
    <span class="detalle-tile">${alClick ? html`<button class="btn-link" onClick=${alClick}>${detalle}</button>` : detalle}</span>
  </div>`;
  if (!activas.length) return html`<div class="vista"><div class="vista-cab"><div><h2>Resumen</h2><p>Cuando carguen tareas, acá van a ver el avance del equipo.</p></div></div><${VacioVista} /></div>`;
  return html`<div class="vista">
    <div class="vista-cab"><div><h2>Resumen</h2><p>Cómo viene el equipo hoy, ${fechaLarga(ctx.hoy)}.</p></div></div>
    <div class="tiles">
      ${tile('Abiertas', numUY(abiertas.length), ptsAbiertos ? `${numUY(ptsAbiertos)} puntos por hacer` : 'Sin estimar')}
      ${tile('Vencidas', numUY(vencidas.length), vencidas.length ? 'Ver las vencidas' : 'Todo al día', vencidas.length > 0, vencidas.length ? () => alFiltrar({ vencidas: true }) : null)}
      ${tile('Bloqueadas', numUY(bloqueadas.length), bloqueadas.length ? 'Ver las bloqueadas' : 'Nada frenado', false, bloqueadas.length ? () => alFiltrar({ bloqueadas: true }) : null)}
      ${tile('Hechas en 7 días', numUY(hechas7.length), 'Llegaron a la columna final')}
      ${tile('Días hasta hecha', ciclo == null ? '—' : ciclo.toLocaleString('es-UY', { maximumFractionDigits: 1 }), 'Promedio de creación a hecha, últimos 30 días')}
    </div>
    <div class="paneles">
      <section class="panel"><h3>Tareas por columna</h3><p class="sub">Sin contar las archivadas</p><${BarrasH} filas=${porColumna} /></section>
      <section class="panel"><h3>Carga por integrante</h3><p class="sub">Tareas abiertas asignadas a cada uno</p>
        ${porPersona.length ? html`<${BarrasH} filas=${porPersona} />` : html`<p class="tenue">Sumen integrantes desde Equipo para ver la carga.</p>`}</section>
      <section class="panel"><h3>Terminadas por semana</h3><p class="sub">Últimas 8 semanas, de lunes a domingo</p><${ColumnasSemana} datos=${semanas} /></section>
      <section class="panel"><h3>Próximos vencimientos</h3><p class="sub">Vencidas y de los próximos 14 días</p>
        ${proximas.length ? html`<ul class="lista-prox">${proximas.map(t => html`<li key=${t.id}><button onClick=${() => alAbrir(t.id)}>
          <span class=${'t-dato ' + estadoVence(t.vence, ctx.hoy)} style="min-width:64px">${fechaCorta(t.vence)}</span>
          <span class="crece">${t.titulo}</span><${Avatares} ids=${t.asignados || []} ctx=${ctx} /></button></li>`)}</ul>`
          : html`<p class="tenue">Nada vence en las próximas dos semanas.</p>`}
        ${proxHito && html`<p class="tenue" style="display:flex;gap:6px;align-items:center"><${Icono} n="bandera" t=${14} />Próximo hito: <strong style="color:var(--text)">${proxHito.nombre}</strong>, el ${fechaLarga(proxHito.fin)}</p>`}
      </section>
    </div>
  </div>`;
}

/* ===== Equipo ===== */
function VistaEquipo({ ctx, e, editable, alEditar, alVerTareas, alSoyYo }) {
  const activas = ctx.tareas.filter(t => !t.archivada);
  return html`<div class="vista">
    <div class="vista-cab">
      <div><h2>Equipo</h2><p>Cada uno se suma la primera vez que entra. También podés agregar a alguien que todavía no entró: cuando abra el tablero, elige su nombre.</p></div>
      ${editable && html`<button class="btn btn-primario" onClick=${() => alEditar(null)}><${Icono} n="mas" />Sumar integrante</button>`}
    </div>
    ${ctx.miembros.length === 0 && html`<div class="vacio-vista"><${Icono} n="usuarios" t=${28} /><p>Todavía no hay nadie. Sumate primero y después invitá al resto.</p>${editable && html`<button class="btn btn-chico" onClick=${alSoyYo}>Sumarme</button>`}</div>`}
    <div class="equipo">${ctx.miembros.map(m => {
      const suyas = activas.filter(t => (t.asignados || []).includes(m.id));
      const enCurso = suyas.filter(t => !esHecha(t, ctx) && t.columna !== ctx.columnas[0]?.id).length;
      const abiertas = suyas.filter(t => !esHecha(t, ctx)).length;
      const hechas = suyas.filter(t => esHecha(t, ctx)).length;
      const esYo = m.id === ctx.yo;
      const enLinea = ctx.enLinea.some(x => x.id === m.id);
      return html`<article class="miembro" key=${m.id}>
        <div class="miembro-cab">
          <${Avatar} m=${m} t=${44} />
          <div style="min-width:0;margin-right:auto">
            <h3>${m.nombre}${esYo ? html` <span class="tag media">Vos</span>` : null}</h3>
            <p>${m.rol || 'Sin rol'}${enLinea ? ' · en línea ahora' : ''}${!m.userId && e.modo === 'nube' ? ' · todavía no entró' : ''}</p>
          </div>
          ${editable && html`<button class="btn-icono chico" aria-label=${'Editar ' + m.nombre} onClick=${() => alEditar(m.id)}><${Icono} n="ajustes" t=${14} /></button>`}
        </div>
        <div class="miembro-nums">
          <div><strong>${abiertas}</strong><span>Abiertas</span></div>
          <div><strong>${enCurso}</strong><span>En marcha</span></div>
          <div><strong>${hechas}</strong><span>Hechas</span></div>
        </div>
        ${suyas.length > 0 && html`<div><button class="btn btn-chico" onClick=${() => alVerTareas(m.id)}>Ver sus tareas</button></div>`}
      </article>`;
    })}</div>
    ${extensiones.equipo && html`<${extensiones.equipo} ctx=${ctx} />`}
  </div>`;
}

/* ===== Actividad ===== */
function VistaActividad({ ctx, alAbrir }) {
  const eventos = [];
  for (const t of ctx.tareas) for (const ev of (t.historial || [])) eventos.push({ en: ev.en, quien: ev.quien, que: ev.que, t });
  for (const c of ctx.comentarios) { const t = ctx.porId.get(c.tareaId); if (t) eventos.push({ en: c.en, quien: c.autor, que: 'comentó en', t, cita: c.texto }); }
  eventos.sort((a, b) => (a.en < b.en ? 1 : -1));
  const lista = eventos.slice(0, 150);
  const dias = [];
  for (const ev of lista) {
    const dia = isoDe(new Date(ev.en));
    if (!dias.length || dias[dias.length - 1].dia !== dia) dias.push({ dia, eventos: [] });
    dias[dias.length - 1].eventos.push(ev);
  }
  return html`<div class="vista">
    <div class="vista-cab"><div><h2>Actividad</h2><p>Los últimos movimientos del equipo. Tocá un código para abrir la tarea.</p></div></div>
    ${!lista.length && html`<${VacioVista} texto="Todavía no hay movimientos. Acá van a aparecer las tareas creadas, movidas y comentadas." />`}
    <div class="actividad">${dias.map(d => html`<section class="act-dia" key=${d.dia}>
      <h3 class="etiqueta-mono">${tituloDia(d.dia)}</h3>
      <ul class="act-lista">${d.eventos.map((ev, i) => {
        const m = ctx.integrantes.get(ev.quien);
        return html`<li class="act-item" key=${i}>
          <${Avatar} m=${m} t=${26} />
          <p class="texto"><strong>${m ? m.nombre : 'Alguien'}</strong> ${ev.que === 'creó la tarea' ? 'creó' : ev.que} · <button onClick=${() => alAbrir(ev.t.id)}>${codigo(ev.t, ctx)}</button> ${ev.t.titulo}
            ${ev.cita && html`<span class="cita">«${ev.cita.length > 180 ? ev.cita.slice(0, 180) + '…' : ev.cita}»</span>`}</p>
          <span class="mono">${momento(ev.en)}</span>
        </li>`;
      })}</ul>
    </section>`)}</div>
  </div>`;
}
