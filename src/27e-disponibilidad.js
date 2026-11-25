
/* ===== Disponibilidad: franjas de lunes a viernes y días en que alguien no está ===== */
const HABILES = [0, 1, 2, 3, 4];
const aMin = hhmm => { const [h, m] = String(hhmm).split(':').map(Number); return h * 60 + (m || 0); };
const deMin = m => `${pad(Math.floor(m / 60) % 24 === 0 && m >= 1440 ? 24 : Math.floor(m / 60))}:${pad(m % 60)}`;
// Ordena y junta franjas que se pisan o se tocan
function unirFranjas(lista) {
  const orden = (lista || []).map(f => [aMin(f.desde), aMin(f.hasta)]).filter(([a, b]) => b > a).sort((x, y) => x[0] - y[0]);
  const res = [];
  for (const [a, b] of orden) {
    const u = res[res.length - 1];
    if (u && a <= u[1]) u[1] = Math.max(u[1], b); else res.push([a, b]);
  }
  return res.map(([a, b]) => ({ desde: deMin(a), hasta: deMin(b) }));
}
const minutosFranjas = lista => (lista || []).reduce((s, f) => s + Math.max(0, aMin(f.hasta) - aMin(f.desde)), 0);
const franjasTexto = lista => (lista && lista.length ? lista.map(f => `${f.desde}–${f.hasta}`).join(', ') : 'sin franjas');
const semanaDe = (ctx, id) => (ctx.disponibilidad.get(id) || {}).semana || {};
// Motivo por el que alguien no está ese día, o null si está. Mira las ausencias del equipo (períodos)
// y los días sueltos que se hayan marcado antes.
function ausencia(ctx, id, fecha) {
  const d = (ctx.ausencias.get(id) || {}).dias;
  if (d && Object.prototype.hasOwnProperty.call(d, fecha)) return d[fecha];
  const p = ctx.roadmap.periodos.find(p => p.tipo === 'ausencia' && p.desde <= fecha && fecha <= (p.hasta || p.desde) && (miembroDePeriodo(p, ctx.miembros) || {}).id === id);
  return p ? p.etiqueta || '' : null;
}
const fechasDeSemana = lunes => HABILES.map(i => { const d = aFecha(lunes); d.setDate(d.getDate() + i); return isoDe(d); });
const moverSemana = (lunes, n) => { const d = aFecha(lunes); d.setDate(d.getDate() + 7 * n); return isoDe(d); };

const accionesDisp = {
  guardarSemana(semana) {
    const id = yo();
    if (!id) { avisar('Sumate al tablero (menú de tu perfil) para cargar tu disponibilidad.', 'error'); return Promise.resolve(false); }
    return conManejo(backend.crear('disponibilidad/' + id, { semana, actualizadoEn: ahoraISO() }));
  },
};

/* ----- Tu semana ----- */
function EditorSemana({ ctx }) {
  const semana = semanaDe(ctx, ctx.yo);
  const [agregando, setAgregando] = useState(null);
  const [nueva, setNueva] = useState({ desde: '18:00', hasta: '21:00' });
  const guardarDia = (d, franjas) => accionesDisp.guardarSemana({ ...semana, [d]: unirFranjas(franjas) });
  const agregar = d => {
    if (!nueva.desde || !nueva.hasta || aMin(nueva.hasta) <= aMin(nueva.desde)) { avisar('La hora de fin tiene que ser después del inicio (dentro del mismo día).', 'error'); return; }
    guardarDia(d, [...(semana[d] || []), nueva]);
    setAgregando(null);
  };
  const total = HABILES.reduce((s, d) => s + minutosFranjas(semana[d]), 0);
  const hayLunes = (semana[0] || []).length > 0;
  return html`<section class="panel ancho editor-semana">
    <div class="seccion-cab"><h3>Tu semana</h3><span class="mono tenue">${horasTexto(total)} por semana</span></div>
    <p class="sub">Cargá en qué horarios solés estar disponible para el proyecto, de lunes a viernes. Se guarda solo.</p>
    <ul class="dias-semana">${HABILES.map(d => {
      const franjas = semana[d] || [];
      return html`<li key=${d} class="dia-fila">
        <span class="dia-nombre">${mayus(DIAS_LARGOS[d])}</span>
        <div class="franjas">
          ${franjas.map((f, i) => html`<span class="franja" key=${f.desde}>
            <span class="mono">${f.desde}–${f.hasta}</span>
            <button class="btn-icono chico" aria-label=${`Quitar ${f.desde} a ${f.hasta} del ${DIAS_LARGOS[d]}`} onClick=${() => guardarDia(d, franjas.filter((_, j) => j !== i))}><${Icono} n="cerrar" t=${12} /></button>
          </span>`)}
          ${!franjas.length && agregando !== d && html`<span class="tenue sin-franjas">No disponible</span>`}
          ${agregando === d
            ? html`<span class="franja-nueva">
                <input class="entrada mono" type="time" id=${'fr-desde-' + d} aria-label="Desde" value=${nueva.desde} onInput=${e => setNueva(n => ({ ...n, desde: e.target.value }))} />
                <span class="tenue">a</span>
                <input class="entrada mono" type="time" id=${'fr-hasta-' + d} aria-label="Hasta" value=${nueva.hasta} onInput=${e => setNueva(n => ({ ...n, hasta: e.target.value }))}
                  onKeyDown=${e => { if (e.key === 'Enter') agregar(d); if (e.key === 'Escape') { e.stopPropagation(); setAgregando(null); } }} />
                <button class="btn btn-primario btn-chico" onClick=${() => agregar(d)}>Agregar</button>
                <button class="btn btn-fantasma btn-chico" onClick=${() => setAgregando(null)}>Cancelar</button>
              </span>`
            : html`<button class="btn-link" onClick=${() => { setAgregando(d); const u = franjas[franjas.length - 1]; if (u) setNueva({ desde: u.hasta, hasta: deMin(Math.min(aMin(u.hasta) + 120, 23 * 60 + 59)) }); }}>+ Franja</button>`}
        </div>
        <span class="mono dia-total">${minutosFranjas(franjas) ? duracionReloj(minutosFranjas(franjas)) : '—'}</span>
      </li>`;
    })}</ul>
    ${hayLunes && html`<div><button class="btn btn-chico" onClick=${() => accionesDisp.guardarSemana(Object.fromEntries(HABILES.map(d => [d, semana[0]])))}>Repetir el lunes en toda la semana</button></div>`}
  </section>`;
}

/* ----- El equipo en la semana elegida ----- */
function SemanaEquipo({ ctx, lunes }) {
  const fechas = fechasDeSemana(lunes);
  const domingo = (() => { const d = aFecha(lunes); d.setDate(d.getDate() + 6); return isoDe(d); })();
  const filas = ctx.miembros.map(m => {
    const semana = semanaDe(ctx, m.id);
    const cargo = ctx.disponibilidad.has(m.id);
    const dias = fechas.map((f, d) => { const aus = ausencia(ctx, m.id, f); return { f, aus, min: aus !== null ? 0 : minutosFranjas(semana[d]), franjas: semana[d] || [] }; });
    const disp = dias.reduce((s, x) => s + x.min, 0);
    const trabajadas = ctx.horas.filter(r => r.miembro === m.id && r.fecha >= lunes && r.fecha <= domingo).reduce((s, r) => s + (r.minutos || 0), 0);
    return { m, cargo, dias, disp, trabajadas };
  });
  const totalDisp = filas.reduce((s, x) => s + x.disp, 0);
  if (!ctx.miembros.length) return html`<p class="tenue">Todavía no hay integrantes.</p>`;
  return html`<section class="panel ancho">
    <div class="seccion-cab"><h3>El equipo esta semana</h3><span class="mono tenue">${horasTexto(totalDisp)} disponibles en total</span></div>
    <p class="sub">Horas disponibles por día, descontando las ausencias cargadas abajo. "Cargadas" son las horas registradas en Horas esa semana.</p>
    <div class="tabla-env"><table class="tabla tabla-disp">
      <thead><tr><th>Persona</th>${fechas.map((f, d) => html`<th key=${f}>${DIAS_CORTOS[d]} ${aFecha(f).getDate()}</th>`)}<th>Disponibles</th><th>Cargadas</th></tr></thead>
      <tbody>${filas.map(({ m, cargo, dias, disp, trabajadas }) => html`<tr key=${m.id} style="cursor:default">
        <td><span class="fila" style="gap:8px;flex-wrap:nowrap"><${Avatar} m=${m} t=${22} />${m.nombre}${m.id === ctx.yo ? ' (vos)' : ''}</span></td>
        ${dias.map((x, d) => html`<td key=${x.f} class=${'num celda-disp' + (x.aus !== null ? ' ausente' : '')}
            data-tip=${x.aus !== null ? `${m.nombre} no está disponible el ${DIAS_LARGOS[d]} ${aFecha(x.f).getDate()}${x.aus ? ': ' + x.aus : ''}` : `${m.nombre} · ${DIAS_LARGOS[d]}: ${franjasTexto(x.franjas)}`}>
          ${x.aus !== null ? 'No' : !cargo ? '' : x.min ? duracionReloj(x.min) : '—'}</td>`)}
        <td class="num"><strong>${cargo ? horasTexto(disp) : html`<span class="tenue">Sin cargar</span>`}</strong></td>
        <td class="num">${cargo && disp ? html`<span class="uso" data-tip=${`${horasTexto(trabajadas)} cargadas de ${horasTexto(disp)} disponibles`}>
            <span class="uso-barra"><span style=${`width:${Math.min(100, pct(trabajadas, disp))}%`}></span></span>${pct(trabajadas, disp)} %</span>`
          : horasTexto(trabajadas)}</td>
      </tr>`)}</tbody>
    </table></div>
  </section>`;
}

/* ----- Cuándo coincidimos ----- */
function Coincidencias({ ctx, lunes }) {
  const fechas = fechasDeSemana(lunes);
  const todas = ctx.miembros.flatMap(m => HABILES.flatMap(d => semanaDe(ctx, m.id)[d] || []));
  let hMin = 8, hMax = 22;
  if (todas.length) { hMin = Math.min(...todas.map(f => Math.floor(aMin(f.desde) / 60))); hMax = Math.max(...todas.map(f => Math.ceil(aMin(f.hasta) / 60))); }
  if (hMax - hMin < 6) hMax = Math.min(24, hMin + 6);
  const horas = Array.from({ length: hMax - hMin }, (_, i) => hMin + i);
  const total = ctx.miembros.length;
  // Quién está disponible al menos media hora de cada hora
  const quien = (d, h) => ctx.miembros.filter(m => ausencia(ctx, m.id, fechas[d]) === null && (semanaDe(ctx, m.id)[d] || [])
    .some(f => Math.min(aMin(f.hasta), (h + 1) * 60) - Math.max(aMin(f.desde), h * 60) >= 30));
  const grilla = HABILES.map(d => horas.map(h => quien(d, h)));
  let mejor = null;
  const maxN = Math.max(0, ...grilla.flat().map(l => l.length));
  if (maxN >= 2) {
    HABILES.forEach(d => {
      let ini = null;
      horas.forEach((h, j) => {
        const ok = grilla[d][j].length === maxN;
        if (ok && ini === null) ini = j;
        if ((!ok || j === horas.length - 1) && ini !== null) {
          const fin = ok ? j : j - 1;
          if (!mejor || fin - ini > mejor.fin - mejor.ini) mejor = { d, ini, fin };
          ini = null;
        }
      });
    });
  }
  return html`<section class="panel ancho">
    <div class="seccion-cab"><h3>Cuándo coincidimos</h3></div>
    <p class="sub">Cuántos del equipo están disponibles en cada hora de la semana. El recuadro marca las horas en que están todos.</p>
    ${mejor && html`<p class="mejor-momento"><${Icono} n="usuarios" t=${16} /><span>El mejor momento para juntarse: <strong>el ${DIAS_LARGOS[mejor.d]} ${aFecha(fechas[mejor.d]).getDate()} de ${pad(horas[mejor.ini])} a ${pad(horas[mejor.fin] + 1)} h</strong>, ${maxN === total ? `con los ${total} disponibles` : `con ${maxN} de ${total}`}.</span></p>`}
    ${!todas.length ? html`<p class="tenue">Cuando el equipo cargue su disponibilidad, acá van a ver en qué horarios coinciden.</p>` : html`<div class="calor-env">
      <div class="calor coincidencias" style=${`grid-template-columns:minmax(64px,auto) repeat(${horas.length}, minmax(0,1fr))`}>
        <span></span>${horas.map(h => html`<span class="calor-col" key=${h}>${h}</span>`)}
        ${HABILES.map(d => [
          html`<span class="calor-fila" key=${'f' + d}>${DIAS_CORTOS[d]} ${aFecha(fechas[d]).getDate()}</span>`,
          ...horas.map((h, j) => {
            const l = grilla[d][j];
            return html`<span key=${d + '-' + h} tabindex="0" class=${'celda-calor calor-' + nivelCalor(l.length, total) + (l.length === total && total > 1 ? ' pico' : '')}
              data-tip=${`${mayus(DIAS_LARGOS[d])} de ${pad(h)} a ${pad(h + 1)} h: ${l.length ? `${l.length} de ${total} (${l.map(m => m.nombre).join(', ')})` : 'nadie disponible'}`}></span>`;
          }),
        ])}
      </div>
      <${EscalaCalor} texto="Menos gente" />
    </div>`}
  </section>`;
}

/* ----- La vista ----- */
function VistaDisponibilidad({ ctx, editable }) {
  const [lunes, setLunes] = useState(() => lunesISO(hoyISO()));
  const viernes = fechasDeSemana(lunes)[4];
  const esta = lunesISO(ctx.hoy);
  const etiquetaSemana = lunes === esta ? 'Esta semana' : lunes === moverSemana(esta, 1) ? 'La semana que viene' : lunes === moverSemana(esta, -1) ? 'La semana pasada' : 'Semana';
  return html`<div class="vista disponibilidad">
    <div class="vista-cab"><div><h2>Disponibilidad</h2><p>En qué horarios puede trabajar cada uno de lunes a viernes, y cuándo no va a estar. Sirve para repartir tareas y encontrar cuándo juntarse.</p></div></div>
    ${editable && ctx.yo ? html`<${EditorSemana} ctx=${ctx} />`
      : editable && html`<div class="aviso-vacio"><p><strong>Para cargar tu disponibilidad, primero sumate al tablero</strong> desde el menú de tu perfil.</p></div>`}
    <div class="selector-semana">
      <button class="btn-icono" aria-label="Semana anterior" onClick=${() => setLunes(l => moverSemana(l, -1))}><${Icono} n="izq" /></button>
      <span><strong>${etiquetaSemana}</strong> <span class="tenue">· del ${fechaLarga(lunes)} al ${fechaLarga(viernes)}</span></span>
      <button class="btn-icono" aria-label="Semana siguiente" onClick=${() => setLunes(l => moverSemana(l, 1))}><${Icono} n="der" /></button>
      ${lunes !== esta && html`<button class="btn btn-chico" onClick=${() => setLunes(esta)}>Volver a esta semana</button>`}
    </div>
    <div class="paneles">
      <${SemanaEquipo} ctx=${ctx} lunes=${lunes} />
      <${Coincidencias} ctx=${ctx} lunes=${lunes} />
      <${PeriodosRm} ctx=${ctx} editable=${editable} />
    </div>
  </div>`;
}
