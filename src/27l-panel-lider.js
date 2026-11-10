
/* ===== Panel de Líder: carga semanal contra esfuerzo asignado =====
   Para cada persona y semana (lunes a domingo):
   - Disponibles: las horas que marcó en Disponibilidad, sin los días que no está.
   - Asignadas: horas estimadas de las tareas con vencimiento esa semana (1 punto = 1 hora),
     repartidas entre sus responsables. Se cuentan también las ya terminadas: es lo que se le pidió esa semana.
   - Registradas: horas que cargó en Horas esa semana (solo de referencia).
   El líder ve de un vistazo a quién le está pidiendo más horas de las que tiene marcadas. */
const LIDER_NIVELES = {
  sobre: { nombre: 'Sobrecargado', tag: 'urgente' },
  limite: { nombre: 'Al límite', tag: 'media' },
  ok: { nombre: 'En rango', tag: 'hecho' },
  poco: { nombre: 'Poco asignado', tag: 'baja' },
  sinDisp: { nombre: 'Sin disponibilidad', tag: 'baja' },
  sinTareas: { nombre: 'Sin tareas', tag: 'baja' },
};
const LIDER_LIMITE = 100, LIDER_SOBRE = 120, LIDER_POCO = 50; // % de lo disponible
const nivelLider = (disp, asig, cargo) => {
  if (!cargo || !disp) return asig > 0 ? 'sinDisp' : 'sinTareas';
  const p = asig / disp * 100;
  if (!asig) return 'sinTareas';
  return p > LIDER_SOBRE ? 'sobre' : p > LIDER_LIMITE ? 'limite' : p >= LIDER_POCO ? 'ok' : 'poco';
};
const finSemana = lunes => { const d = aFecha(lunes); d.setDate(d.getDate() + 6); return isoDe(d); };

// Una fila por integrante para la semana que empieza en `lunes`
function cargaSemanal(ctx, lunes) {
  const domingo = finSemana(lunes);
  const tareasSemana = ctx.tareas.filter(t => !t.archivada && t.vence && t.vence >= lunes && t.vence <= domingo);
  return ctx.miembros.map(m => {
    const cargo = ctx.disponibilidad.has(m.id) && HABILES.some(d => minutosFranjas(semanaDe(ctx, m.id)[d]) > 0);
    const sem = semanaDe(ctx, m.id);
    const ausencias = [];
    let disp = 0;
    fechasDeSemana(lunes).forEach((f, d) => {
      const aus = ausencia(ctx, m.id, f);
      if (aus !== null) { if (minutosFranjas(sem[d])) ausencias.push(f); return; }
      disp += minutosFranjas(sem[d]);
    });
    let asig = 0;
    const tareas = [], sinEstimar = [];
    for (const t of tareasSemana) {
      const duenios = (t.asignados || []).filter(id => ctx.integrantes.has(id));
      if (!duenios.includes(m.id)) continue;
      if (!(Number(t.estimacion) > 0)) { sinEstimar.push(t); continue; }
      const min = Number(t.estimacion) * HORAS_POR_PUNTO * 60 / duenios.length;
      asig += min;
      tareas.push({ t, min, compartida: duenios.length > 1, hecha: esHecha(t, ctx) });
    }
    tareas.sort((a, b) => b.min - a.min);
    const registradas = ctx.horas.filter(r => r.miembro === m.id && r.fecha >= lunes && r.fecha <= domingo).reduce((s, r) => s + (r.minutos || 0), 0);
    // Tareas vivas sin fecha ni estimación: no entran en la cuenta y conviene saberlo
    const sinFecha = ctx.tareas.filter(t => !t.archivada && !esHecha(t, ctx) && !t.vence && (t.asignados || []).includes(m.id) && t.columna !== 'ideas').length;
    return { m, cargo, disp, asig, registradas, tareas, sinEstimar, ausencias, sinFecha, nivel: nivelLider(disp, asig, cargo), pct: cargo && disp ? asig / disp * 100 : null };
  });
}

function BarraCarga({ disp, asig }) {
  const tope = Math.max(disp, asig, 1);
  const sobre = disp > 0 && asig > disp;
  return html`<div class="lider-barras" role="img" aria-label=${`${horasTexto(asig)} asignadas de ${horasTexto(disp)} disponibles`}>
    <span class="lider-barra disp" style=${`width:${disp / tope * 100}%`}></span>
    <span class=${'lider-barra asig' + (sobre ? ' sobre' : '')} style=${`width:${asig / tope * 100}%`}></span>
  </div>`;
}

/* ----- Mapa de carga: cómo está la semana o el mes de cada uno, día por día -----
   Cada celda pinta las horas estimadas de las tareas que vencen ese día (más oscuro, más horas). Los días en que alguien
   marcó que no está salen rayados. Al final de cada fila va el total del período contra lo disponible, con el mismo
   estado que la tabla de arriba. */
const mesDeFecha = iso => iso.slice(0, 7);
const moverMes = (mes, n) => { const [y, m] = mes.split('-').map(Number); const d = new Date(y, m - 1 + n, 1); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`; };
const nivelCelda = h => (h <= 0 ? 0 : h <= 2 ? 1 : h <= 4 ? 2 : h <= 8 ? 3 : 4);
const ESCALA_CELDA = ['', 'Hasta 2 h', 'Hasta 4 h', 'Hasta 8 h', 'Más de 8 h'];

function cargaPorDia(ctx, fechas) {
  const desde = fechas[0], hasta = fechas[fechas.length - 1];
  const tareas = ctx.tareas.filter(t => !t.archivada && t.vence && t.vence >= desde && t.vence <= hasta);
  return ctx.miembros.map(m => {
    const cargo = ctx.disponibilidad.has(m.id) && HABILES.some(d => minutosFranjas(semanaDe(ctx, m.id)[d]) > 0);
    const sem = semanaDe(ctx, m.id);
    const dias = new Map(fechas.map(f => {
      const d = diaSemanaISO(f), aus = ausencia(ctx, m.id, f);
      return [f, { f, aus, disp: aus !== null || d > 4 ? 0 : minutosFranjas(sem[d]), min: 0, tareas: [] }];
    }));
    let sinEstimar = 0;
    for (const t of tareas) {
      const duenios = (t.asignados || []).filter(id => ctx.integrantes.has(id));
      if (!duenios.includes(m.id)) continue;
      if (!(Number(t.estimacion) > 0)) { sinEstimar++; continue; }
      const min = Number(t.estimacion) * HORAS_POR_PUNTO * 60 / duenios.length;
      const dia = dias.get(t.vence);
      dia.min += min; dia.tareas.push({ t, min });
    }
    const lista = [...dias.values()];
    const disp = lista.reduce((s, x) => s + x.disp, 0), asig = lista.reduce((s, x) => s + x.min, 0);
    return { m, cargo, dias: lista, disp, asig, sinEstimar, nivel: nivelLider(disp, asig, cargo), pct: cargo && disp ? asig / disp * 100 : null };
  });
}

function MapaCarga({ ctx, lunes, alAbrir }) {
  const [modo, setModoS] = useState(() => (leer('finora-lider-mapa') === 'mes' ? 'mes' : 'semana'));
  const setModo = v => { setModoS(v); guardar('finora-lider-mapa', v); };
  const [mes, setMes] = useState(() => mesDeFecha(ctx.hoy));
  const esMes = modo === 'mes';
  const fechas = esMes
    ? Array.from({ length: new Date(Number(mes.slice(0, 4)), Number(mes.slice(5)), 0).getDate() }, (_, i) => `${mes}-${pad(i + 1)}`)
    : Array.from({ length: 7 }, (_, i) => { const d = aFecha(lunes); d.setDate(d.getDate() + i); return isoDe(d); });
  const filas = cargaPorDia(ctx, fechas);
  const letras = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];
  const celda = (x, m, cargo) => {
    const h = x.min / 60, nivel = nivelCelda(h), d = diaSemanaISO(x.f);
    const lista = x.tareas.map(y => `${codigo(y.t, ctx)} ${horasTexto(y.min)}`).join(', ');
    const tip = `${m.nombre} · ${DIAS_LARGOS[d]} ${fechaCorta(x.f)}: ` + (x.aus !== null ? `no está disponible${x.aus ? ' (' + x.aus + ')' : ''}` : `${cargo && x.disp ? horasTexto(x.disp) + ' disponibles' : 'sin horas marcadas'}`)
      + (x.min ? `. Vencen ${horasTexto(x.min)}: ${lista}` : '');
    const clase = 'mapa-celda n' + nivel + (x.aus !== null ? ' ausente' : '') + (d > 4 ? ' finde' : '') + (x.f === ctx.hoy ? ' hoy' : '');
    return html`<td key=${x.f} class=${clase} data-tip=${tip} tabindex="0" onClick=${() => x.tareas.length === 1 && alAbrir(x.tareas[0].t.id)}>
      ${x.aus !== null ? html`<span class="mapa-no">${esMes ? '' : 'No'}</span>` : x.min ? html`<strong>${Math.round(h * 10) / 10}${esMes ? '' : ' h'}</strong>` : ''}
      ${!esMes && x.aus === null && cargo && x.disp > 0 && html`<span class="mapa-disp">${horasTexto(x.disp)} disp.</span>`}
    </td>`;
  };
  return html`<section class="panel ancho mapa-carga">
    <div class="seccion-cab"><h3>Mapa de carga</h3>
      <div class="subpestanas" role="group" aria-label="Período del mapa">
        <button aria-pressed=${!esMes} onClick=${() => setModo('semana')}>Semana</button>
        <button aria-pressed=${esMes} onClick=${() => setModo('mes')}>Mes</button>
      </div>
    </div>
    <p class="sub">Cada celda muestra las horas estimadas de las tareas que vencen ese día: cuanto más oscura, más horas se juntan. Los días rayados son días en que esa persona marcó que no está.</p>
    ${esMes
      ? html`<div class="selector-semana">
          <button class="btn-icono" aria-label="Mes anterior" onClick=${() => setMes(v => moverMes(v, -1))}><${Icono} n="izq" /></button>
          <span><strong>${mesNombre(mes)}</strong></span>
          <button class="btn-icono" aria-label="Mes siguiente" onClick=${() => setMes(v => moverMes(v, 1))}><${Icono} n="der" /></button>
          ${mes !== mesDeFecha(ctx.hoy) && html`<button class="btn btn-chico" onClick=${() => setMes(mesDeFecha(ctx.hoy))}>Volver a este mes</button>`}
        </div>`
      : html`<p class="tenue" style="margin:0">Semana del ${fechaLarga(fechas[0])} al ${fechaLarga(fechas[6])}. Se cambia con las flechas de arriba.</p>`}
    <div class="tabla-env"><table class=${'tabla mapa-tabla' + (esMes ? ' mes' : '')}>
      <thead><tr><th>Persona</th>${fechas.map(f => { const d = diaSemanaISO(f); return html`<th key=${f} class=${'mapa-dia' + (d > 4 ? ' finde' : '') + (f === ctx.hoy ? ' hoy' : '')}>${esMes ? html`<span>${letras[d]}</span>${aFecha(f).getDate()}` : html`${DIAS_CORTOS[d]} ${aFecha(f).getDate()}`}</th>`; })}<th>${esMes ? 'Mes' : 'Semana'}</th></tr></thead>
      <tbody>${filas.map(f => {
        const n = LIDER_NIVELES[f.nivel];
        return html`<tr key=${f.m.id} style="cursor:default">
          <td><span class="fila" style="gap:8px;flex-wrap:nowrap"><${Avatar} m=${f.m} t=${22} />${f.m.nombre}</span></td>
          ${f.dias.map(x => celda(x, f.m, f.cargo))}
          <td class="mapa-total"><span class=${'tag ' + n.tag} data-tip=${`${horasTexto(f.asig)} asignadas de ${horasTexto(f.disp)} disponibles${f.sinEstimar ? `. ${f.sinEstimar} sin estimar, no cuentan` : ''}`}>${f.pct === null ? (f.asig ? horasTexto(f.asig) : '—') : Math.round(f.pct) + ' %'}</span></td>
        </tr>`;
      })}</tbody>
    </table></div>
    <div class="mapa-escala" aria-hidden="true"><span class="tenue">Horas que vencen en el día</span>${[1, 2, 3, 4].map(i => html`<span key=${i}><span class=${'mapa-muestra n' + i}></span>${ESCALA_CELDA[i]}</span>`)}<span><span class="mapa-muestra ausente"></span>No está</span></div>
  </section>`;
}

function PanelLider({ ctx, alAbrir }) {
  const esta = lunesISO(ctx.hoy);
  const [lunes, setLunes] = useState(esta);
  const [abierto, setAbierto] = useState(null);
  const filas = cargaSemanal(ctx, lunes);
  const domingo = finSemana(lunes);
  const etiquetaSemana = lunes === esta ? 'Esta semana' : lunes === moverSemana(esta, 1) ? 'La semana que viene' : lunes === moverSemana(esta, -1) ? 'La semana pasada' : 'Semana';
  const pasadas = [5, 4, 3, 2, 1, 0].map(i => moverSemana(esta, -i));
  const historia = new Map(pasadas.map(l => [l, new Map(cargaSemanal(ctx, l).map(f => [f.m.id, f]))]));
  const sobrecargados = filas.filter(f => f.nivel === 'sobre' || f.nivel === 'limite');
  const totalDisp = filas.reduce((s, f) => s + f.disp, 0), totalAsig = filas.reduce((s, f) => s + (f.cargo ? f.asig : 0), 0);
  const rango = l => `${fechaCorta(l)} al ${fechaCorta(finSemana(l))}`;
  if (!ctx.miembros.length) return html`<div class="vista lider"><div class="vista-cab"><div><h2>Panel de Líder</h2></div></div><p class="tenue">Todavía no hay integrantes.</p></div>`;
  return html`<div class="vista lider">
    <div class="vista-cab"><div><h2>Panel de Líder</h2><p>Cuántas horas de trabajo le estás pidiendo a cada uno comparado con las que tiene marcadas como disponibles.</p></div></div>
    <div class="selector-semana">
      <button class="btn-icono" aria-label="Semana anterior" onClick=${() => setLunes(l => moverSemana(l, -1))}><${Icono} n="izq" /></button>
      <span><strong>${etiquetaSemana}</strong> <span class="tenue">· del ${fechaLarga(lunes)} al ${fechaLarga(domingo)}</span></span>
      <button class="btn-icono" aria-label="Semana siguiente" onClick=${() => setLunes(l => moverSemana(l, 1))}><${Icono} n="der" /></button>
      ${lunes !== esta && html`<button class="btn btn-chico" onClick=${() => setLunes(esta)}>Volver a esta semana</button>`}
    </div>
    <div class="paneles">
      <section class="panel ancho">
        <div class="seccion-cab"><h3>Carga semanal contra esfuerzo</h3>
          ${sobrecargados.length > 0 ? html`<span class="tag urgente">${sobrecargados.length} ${sobrecargados.length === 1 ? 'persona' : 'personas'} por encima de lo disponible</span>` : html`<span class="tag hecho">Nadie pasado de lo disponible</span>`}</div>
        <p class="sub">Disponibles son las horas que cada uno marcó en Disponibilidad, sin los días que no está. Asignadas son las horas estimadas de las tareas que vencen esa semana (1 punto = 1 hora; si una tarea tiene varios responsables, se reparte entre ellos).</p>
        ${sobrecargados.length > 0 && html`<p class="desvio-actual"><strong>Para revisar:</strong> ${sobrecargados.map((f, i) => html`${i ? '; ' : ''}<strong>${f.m.nombre}</strong> tiene ${horasTexto(f.asig)} asignadas y ${horasTexto(f.disp)} disponibles (${Math.round(f.pct)} %)`)}. Conviene mover alguna tarea o fecha.</p>`}
        <div class="reu-resumen">
          <div><span class="etiqueta-mono">Disponibles del equipo</span><strong>${horasTexto(totalDisp)}</strong></div>
          <div><span class="etiqueta-mono">Asignadas</span><strong>${horasTexto(totalAsig)}</strong></div>
          <div><span class="etiqueta-mono">Carga del equipo</span><strong>${totalDisp ? Math.round(totalAsig / totalDisp * 100) + ' %' : '—'}</strong></div>
        </div>
        <div class="tabla-env"><table class="tabla tabla-lider">
          <thead><tr><th>Persona</th><th>Disponibles</th><th>Asignadas</th><th>Carga</th><th>Registradas</th><th>Estado</th></tr></thead>
          <tbody>${filas.map(f => {
            const n = LIDER_NIVELES[f.nivel], abre = abierto === f.m.id;
            return html`<${Fragment} key=${f.m.id}>
              <tr class="lider-fila" onClick=${() => setAbierto(abre ? null : f.m.id)} aria-expanded=${abre}>
                <td><span class="fila" style="gap:8px;flex-wrap:nowrap"><${Avatar} m=${f.m} t=${22} />${f.m.nombre}${f.m.id === ctx.yo ? ' (vos)' : ''}</span></td>
                <td class="num">${f.cargo ? horasTexto(f.disp) : html`<span class="tenue">Sin cargar</span>`}</td>
                <td class="num"><strong>${f.asig ? horasTexto(f.asig) : '—'}</strong></td>
                <td class="lider-carga">${f.cargo && (f.disp || f.asig) ? html`<${BarraCarga} disp=${f.disp} asig=${f.asig} /><span class="mono">${f.pct === null ? '' : Math.round(f.pct) + ' %'}</span>` : html`<span class="tenue">—</span>`}</td>
                <td class="num">${f.registradas ? horasTexto(f.registradas) : '—'}</td>
                <td><span class=${'tag ' + n.tag}>${n.nombre}</span></td>
              </tr>
              ${abre && html`<tr class="lider-detalle" style="cursor:default"><td colspan="6">
                ${f.tareas.length > 0 ? html`<ul class="lider-tareas">${f.tareas.map(x => html`<li key=${x.t.id}><button class="atencion-item" onClick=${() => alAbrir(x.t.id)}>
                  <span class="mono tenue">${codigo(x.t, ctx)}</span><span class="atencion-titulo">${x.t.titulo}</span>
                  <span class="atencion-detalle">${horasTexto(x.min)}${x.compartida ? ' (compartida)' : ''} · vence ${fechaCorta(x.t.vence)}${x.hecha ? ' · terminada' : ''}</span></button></li>`)}</ul>`
                  : html`<p class="tenue">No tiene tareas estimadas que venzan esta semana.</p>`}
                ${f.sinEstimar.length > 0 && html`<p class="tenue lider-aviso"><strong>Sin estimar, no cuentan:</strong> ${f.sinEstimar.map(t => codigo(t, ctx)).join(', ')}.</p>`}
                ${f.sinFecha > 0 && html`<p class="tenue lider-aviso">Además tiene ${f.sinFecha} ${f.sinFecha === 1 ? 'tarea abierta' : 'tareas abiertas'} sin fecha de vencimiento, que no entra${f.sinFecha === 1 ? '' : 'n'} en la cuenta.</p>`}
                ${f.ausencias.length > 0 && html`<p class="tenue lider-aviso">No está disponible: ${f.ausencias.map(d => fechaCorta(d)).join(', ')}.</p>`}
              </td></tr>`}
            </${Fragment}>`;
          })}</tbody>
        </table></div>
        <p class="tenue desvio-nota">Tocá una persona para ver qué tareas suman su carga. <strong>En rango</strong>: entre ${LIDER_POCO} % y ${LIDER_LIMITE} % de lo disponible. <strong>Al límite</strong>: hasta ${LIDER_SOBRE} %. <strong>Sobrecargado</strong>: más de ${LIDER_SOBRE} %. <strong>Poco asignado</strong>: menos de ${LIDER_POCO} %. Solo cuentan las tareas con vencimiento y estimación.</p>
      </section>
      <${MapaCarga} ctx=${ctx} lunes=${lunes} alAbrir=${alAbrir} />
      <section class="panel ancho">
        <h3>Últimas semanas</h3>
        <p class="sub">Esfuerzo asignado como porcentaje de lo disponible, semana a semana. Sirve para ver si una persona viene siempre pasada.</p>
        <div class="tabla-env"><table class="tabla tabla-lider">
          <thead><tr><th>Persona</th>${pasadas.map(l => html`<th key=${l}>${rango(l)}${l === esta ? ' (en curso)' : ''}</th>`)}</tr></thead>
          <tbody>${ctx.miembros.map(m => html`<tr key=${m.id} style="cursor:default">
            <td><span class="fila" style="gap:8px;flex-wrap:nowrap"><${Avatar} m=${m} t=${22} />${m.nombre}</span></td>
            ${pasadas.map(l => {
              const f = historia.get(l).get(m.id), n = LIDER_NIVELES[f.nivel];
              return html`<td key=${l} class="num">${f.pct === null || !f.asig ? html`<span class="tenue" data-tip=${f.asig ? `${horasTexto(f.asig)} asignadas y sin disponibilidad cargada` : 'Sin tareas con vencimiento esa semana'}>${f.asig ? horasTexto(f.asig) : '—'}</span>`
                : html`<span data-tip=${`${horasTexto(f.asig)} asignadas de ${horasTexto(f.disp)} disponibles`}><span class=${'tag ' + n.tag}>${Math.round(f.pct)} %</span></span>`}</td>`;
            })}
          </tr>`)}</tbody>
        </table></div>
      </section>
    </div>
  </div>`;
}
