
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
const ausencia = (ctx, id, fecha) => { const d = (ctx.ausencias.get(id) || {}).dias; return d && Object.prototype.hasOwnProperty.call(d, fecha) ? d[fecha] : null; };
const fechasDeSemana = lunes => HABILES.map(i => { const d = aFecha(lunes); d.setDate(d.getDate() + i); return isoDe(d); });
const moverSemana = (lunes, n) => { const d = aFecha(lunes); d.setDate(d.getDate() + 7 * n); return isoDe(d); };

const accionesDisp = {
  guardarSemana(semana) {
    const id = yo();
    if (!id) { avisar('Sumate al tablero (menú de tu perfil) para cargar tu disponibilidad.', 'error'); return Promise.resolve(false); }
    return conManejo(backend.crear('disponibilidad/' + id, { semana, actualizadoEn: ahoraISO() }));
  },
  guardarAusencias(dias) {
    const id = yo();
    if (!id) return Promise.resolve(false);
    return conManejo(backend.crear('ausencias/' + id, { dias, actualizadoEn: ahoraISO() }));
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
    <p class="sub">Horas disponibles por día, descontando los días marcados como no disponibles. "Cargadas" son las horas registradas en Horas esa semana.</p>
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

/* ----- Calendario de días no disponibles ----- */
function CalendarioAusencias({ ctx, editable, alElegir }) {
  const [mes, setMes] = useState(() => { const d = new Date(); return { y: d.getFullYear(), m: d.getMonth() }; });
  const mover = n => setMes(({ y, m }) => { const d = new Date(y, m + n, 1); return { y: d.getFullYear(), m: d.getMonth() }; });
  const primero = new Date(mes.y, mes.m, 1);
  const inicio = new Date(mes.y, mes.m, 1 - diaSemana(primero));
  const semanas = Math.ceil((diaSemana(primero) + new Date(mes.y, mes.m + 1, 0).getDate()) / 7);
  const celdas = [];
  for (let i = 0; i < semanas * 7; i++) {
    const d = new Date(inicio.getFullYear(), inicio.getMonth(), inicio.getDate() + i);
    const iso = isoDe(d), ds = diaSemana(d), habil = ds < 5, fuera = d.getMonth() !== mes.m;
    const ausentes = habil ? ctx.miembros.filter(m => ausencia(ctx, m.id, iso) !== null) : [];
    const yoAusente = ctx.yo && ausentes.some(m => m.id === ctx.yo);
    const puede = habil && editable && ctx.yo;
    const tip = ausentes.length ? ausentes.map(m => `${m.nombre}${ausencia(ctx, m.id, iso) ? ': ' + ausencia(ctx, m.id, iso) : ''}`).join(' · ') : '';
    celdas.push(html`<div key=${iso} role=${puede ? 'button' : null} tabindex=${puede ? 0 : null}
      class=${'cal-celda aus-celda' + (fuera || !habil ? ' fuera' : '') + (iso === ctx.hoy ? ' hoy' : '') + (yoAusente ? ' yo-ausente' : '') + (puede ? ' elegible' : '')}
      data-tip=${tip || null} onClick=${() => puede && alElegir(iso)} onKeyDown=${e => { if (puede && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); alElegir(iso); } }}
      aria-label=${puede ? `${mayus(DIAS_LARGOS[ds])} ${fechaLarga(iso)}${yoAusente ? ', marcaste que no estás disponible' : ''}` : null}>
      <span class="cal-num">${d.getDate()}</span>
      ${yoAusente && html`<span class="aus-yo">No disponible</span>`}
      ${ausentes.length > 0 && html`<span class="avatares">${ausentes.slice(0, 4).map(m => html`<${Avatar} key=${m.id} m=${m} t=${20} />`)}</span>`}
    </div>`);
  }
  return html`<section class="panel">
    <div class="cal-cab">
      <h3>Días no disponibles</h3>
      <span class="tenue cal-mes">${mayus(MESES[mes.m])} ${mes.y}</span>
      <button class="btn btn-chico" onClick=${() => { const d = new Date(); setMes({ y: d.getFullYear(), m: d.getMonth() }); }}>Hoy</button>
      <button class="btn-icono" aria-label="Mes anterior" onClick=${() => mover(-1)}><${Icono} n="izq" /></button>
      <button class="btn-icono" aria-label="Mes siguiente" onClick=${() => mover(1)}><${Icono} n="der" /></button>
    </div>
    <p class="sub">${editable && ctx.yo ? 'Tocá un día de lunes a viernes para marcar que no vas a estar (un parcial, un viaje, trabajo). Las caras muestran quién falta ese día.' : 'Las caras muestran quién no está disponible cada día.'}</p>
    <div class="cal">
      ${['lun', 'mar', 'mié', 'jue', 'vie', 'sáb', 'dom'].map(n => html`<div class="cal-dia-nombre etiqueta-mono" key=${n}>${n}</div>`)}
      ${celdas}
    </div>
  </section>`;
}
function ProximasAusencias({ ctx }) {
  const hasta = (() => { const d = aFecha(ctx.hoy); d.setDate(d.getDate() + 30); return isoDe(d); })();
  const lista = [];
  for (const m of ctx.miembros) {
    const dias = (ctx.ausencias.get(m.id) || {}).dias || {};
    for (const [f, motivo] of Object.entries(dias)) if (f >= ctx.hoy && f <= hasta) lista.push({ f, m, motivo });
  }
  lista.sort((a, b) => a.f.localeCompare(b.f) || a.m.nombre.localeCompare(b.m.nombre, 'es'));
  return html`<section class="panel">
    <h3>Próximos 30 días</h3>
    ${lista.length ? html`<ul class="lista-simple">${lista.map(x => html`<li key=${x.f + x.m.id}>
      <span class="mono tenue" style="min-width:64px">${DIAS_CORTOS[diaSemanaISO(x.f)]} ${fechaCorta(x.f)}</span>
      <${Avatar} m=${x.m} t=${20} /><span class="crece"><strong>${x.m.nombre}</strong>${x.motivo ? html` <span class="tenue">· ${x.motivo}</span>` : ''}</span></li>`)}</ul>`
      : html`<p class="tenue">Nadie marcó días sin disponibilidad en el próximo mes.</p>`}
  </section>`;
}

function ModalAusencia({ ctx, fecha, alCerrar }) {
  const dias = (ctx.ausencias.get(ctx.yo) || {}).dias || {};
  const ya = Object.prototype.hasOwnProperty.call(dias, fecha);
  const [motivo, setMotivo] = useState(ya ? dias[fecha] : '');
  const [hasta, setHasta] = useState(fecha);
  useEffect(() => {
    const tecla = ev => { if (ev.key === 'Escape') { ev.stopPropagation(); alCerrar(); } };
    document.addEventListener('keydown', tecla);
    return () => document.removeEventListener('keydown', tecla);
  }, []);
  const marcar = async () => {
    const nuevos = { ...dias };
    let n = 0;
    for (const d = aFecha(fecha); d <= aFecha(hasta < fecha ? fecha : hasta) && n < 92; d.setDate(d.getDate() + 1), n++) {
      if (diaSemana(d) < 5) nuevos[isoDe(d)] = motivo.trim();
    }
    if (await accionesDisp.guardarAusencias(nuevos)) { avisar(hasta > fecha ? 'Marcaste esos días como no disponibles.' : 'Marcaste el día como no disponible.'); alCerrar(); }
  };
  const quitar = async () => {
    const nuevos = { ...dias };
    delete nuevos[fecha];
    if (await accionesDisp.guardarAusencias(nuevos)) { avisar('Listo: ese día volvés a estar disponible.'); alCerrar(); }
  };
  const ds = diaSemanaISO(fecha);
  const pie = ya
    ? html`<button class="btn btn-fantasma" style="margin-right:auto" onClick=${quitar}>Ya estoy disponible</button>
        <button class="btn btn-fantasma" onClick=${alCerrar}>Cancelar</button>
        <button class="btn btn-primario" onClick=${marcar}>Guardar</button>`
    : html`<button class="btn btn-fantasma" onClick=${alCerrar}>Cancelar</button>
        <button class="btn btn-primario" onClick=${marcar}>Marcar no disponible</button>`;
  return html`<${Modal} titulo=${ya ? 'No disponible' : 'Marcar que no estás'} alCerrar=${alCerrar} ancho=${480} pie=${pie}>
    <p>${mayus(DIAS_LARGOS[ds])} ${fechaLarga(fecha)}${ya ? ': marcaste que no vas a estar.' : '.'}</p>
    <div class="campo"><label for="aus-motivo">Motivo (opcional)</label>
      <input class="entrada" id="aus-motivo" data-foco type="text" maxlength="60" placeholder="Ej.: parcial de Cálculo, viaje, trabajo" value=${motivo}
        onInput=${e => setMotivo(e.target.value)} onKeyDown=${e => { if (e.key === 'Enter') marcar(); }} /></div>
    ${!ya && html`<div class="campo"><label for="aus-hasta">Hasta (opcional, para varios días seguidos)</label>
      <input class="entrada" id="aus-hasta" type="date" style="max-width:200px" min=${fecha} value=${hasta} onChange=${e => setHasta(e.target.value || fecha)} />
      <span class="tenue" style="font-size:12.5px">Se marcan solo los días de lunes a viernes.</span></div>`}
  <//>`;
}

/* ----- La vista ----- */
function VistaDisponibilidad({ ctx, editable }) {
  const [lunes, setLunes] = useState(() => lunesISO(hoyISO()));
  const [eligiendo, setEligiendo] = useState(null);
  const viernes = fechasDeSemana(lunes)[4];
  const esta = lunesISO(ctx.hoy);
  const etiquetaSemana = lunes === esta ? 'Esta semana' : lunes === moverSemana(esta, 1) ? 'La semana que viene' : lunes === moverSemana(esta, -1) ? 'La semana pasada' : 'Semana';
  return html`<div class="vista disponibilidad">
    <div class="vista-cab"><div><h2>Disponibilidad</h2><p>En qué horarios puede trabajar cada uno de lunes a viernes, y qué días no va a estar. Sirve para repartir tareas y encontrar cuándo juntarse.</p></div></div>
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
      <div class="aus-grid">
        <${CalendarioAusencias} ctx=${ctx} editable=${editable} alElegir=${setEligiendo} />
        <${ProximasAusencias} ctx=${ctx} />
      </div>
    </div>
    ${eligiendo && html`<${ModalAusencia} ctx=${ctx} fecha=${eligiendo} alCerrar=${() => setEligiendo(null)} />`}
  </div>`;
}
