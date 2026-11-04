/* ===== Resumen: tratamiento de desvíos =====
   Dos mediciones por semana (lunes a domingo), cada una con su nivel:
   - Esfuerzo: horas estimadas de las tareas con vencimiento en la semana contra las horas que cada uno
     dijo tener disponibles (Disponibilidad). Las tareas se estiman en puntos: 1 punto = 1 hora.
   - Compromiso: tareas con vencimiento en la semana que se terminaron a tiempo.
   El nivel de la semana es el peor de los dos. Dos semanas seguidas en Atención pasan a Crítico. */
const NIVELES_DESVIO = [
  { id: 'verde', nombre: 'Verde', tag: 'hecho', condicion: 'Desvío ≤ 10 %', respuesta: 'Se mantiene la planificación.' },
  { id: 'atencion', nombre: 'Atención', tag: 'media', condicion: 'Desvío entre 10 % y 20 %', respuesta: 'Se replanifica el período siguiente y se analiza la causa en la retrospectiva.' },
  { id: 'critico', nombre: 'Crítico', tag: 'urgente', condicion: 'Desvío > 20 % o dos períodos seguidos en atención', respuesta: 'Se revisa el alcance con el tutor, se registra la decisión en el acta y se actualiza la matriz de riesgos.' },
];
const HORAS_POR_PUNTO = 1;
const ORDEN_NIVEL = { verde: 0, atencion: 1, critico: 2 };
const nivelDeDesvio = p => (p <= 10 ? 'verde' : p <= 20 ? 'atencion' : 'critico');

function calcularDesvios(ctx, semanas = 6) {
  const hoy = ctx.hoy, lunesActual = isoDe(lunesDe(new Date()));
  const conDisp = ctx.miembros.filter(m => ctx.disponibilidad.has(m.id));
  const filas = [];
  let previoAtencion = false;
  for (let i = semanas - 1; i >= 0; i--) {
    const lunes = moverSemana(lunesActual, -i);
    const domingo = (() => { const d = aFecha(lunes); d.setDate(d.getDate() + 6); return isoDe(d); })();
    const hasta = domingo < hoy ? domingo : hoy; // la semana en curso se mide hasta hoy
    // Esfuerzo
    let plan = 0;
    for (const m of conDisp) {
      const sem = semanaDe(ctx, m.id);
      fechasDeSemana(lunes).forEach((f, d) => { if (f <= hasta && ausencia(ctx, m.id, f) === null) plan += minutosFranjas(sem[d]); });
    }
    // Horas estimadas: los puntos de cada tarea con vencimiento esa semana, repartidos entre sus responsables (en minutos)
    const comprometidas = ctx.tareas.filter(t => !t.archivada && t.vence && t.vence >= lunes && t.vence <= hasta);
    let real = 0;
    for (const t of comprometidas) {
      const asig = (t.asignados || []).filter(id => ctx.integrantes.has(id));
      if (!asig.length || !(Number(t.estimacion) > 0)) continue;
      const parte = Number(t.estimacion) * HORAS_POR_PUNTO * 60 / asig.length;
      real += parte * asig.filter(id => conDisp.some(m => m.id === id)).length;
    }
    // Sin horas estimadas esa semana no hay contra qué medir
    const pEsf = plan > 0 && real > 0 ? Math.abs(real - plan) / plan * 100 : null;
    // Compromiso
    const cumplidas = comprometidas.filter(t => {
      if (!esHecha(t, ctx)) return false;
      const cuando = t.terminadaEn || t.entroEnColumna || t.actualizadaEn;
      return !cuando || isoDe(new Date(cuando)) <= t.vence;
    });
    const pCom = comprometidas.length ? (comprometidas.length - cumplidas.length) / comprometidas.length * 100 : null;
    const niveles = [pEsf, pCom].filter(x => x !== null).map(nivelDeDesvio);
    let base = niveles.length ? niveles.reduce((a, b) => (ORDEN_NIVEL[b] > ORDEN_NIVEL[a] ? b : a)) : null;
    const base0 = base;
    if (base === 'atencion' && previoAtencion) base = 'critico';
    previoAtencion = base0 === 'atencion';
    filas.push({
      lunes, domingo, enCurso: lunes === lunesActual, plan, real, pEsf, comprometidas: comprometidas.length, cumplidas: cumplidas.length, pCom,
      nivel: base, porRacha: base0 === 'atencion' && base === 'critico',
    });
  }
  return filas;
}

function PanelDesvios({ ctx }) {
  const filas = calcularDesvios(ctx);
  const actual = [...filas].reverse().find(f => f.nivel);
  const nivel = actual && NIVELES_DESVIO.find(n => n.id === actual.nivel);
  const rango = f => { const a = aFecha(f.lunes), b = aFecha(f.domingo); return `${a.getDate()}/${a.getMonth() + 1} al ${b.getDate()}/${b.getMonth() + 1}`; };
  const celdaPct = (p, detalle) => p === null ? html`<span class="tenue">—</span>`
    : html`<span data-tip=${detalle}><span class=${'tag ' + NIVELES_DESVIO.find(n => n.id === nivelDeDesvio(p)).tag}>${Math.round(p)} %</span></span>`;
  return html`<section class="panel ancho desvios">
    <div class="seccion-cab"><h3>Tratamiento de desvíos</h3>${nivel && html`<span class=${'tag ' + nivel.tag}>${nivel.nombre}</span>`}</div>
    <p class="sub">El desvío de esfuerzo y el cumplimiento del compromiso se clasifican en tres niveles, cada uno con una respuesta definida. Se miden por semana, de lunes a domingo.</p>
    ${nivel ? html`<p class="desvio-actual"><strong>Semana del ${rango(actual)}${actual.enCurso ? ' (en curso)' : ''}: ${nivel.nombre}.</strong> ${actual.porRacha ? 'Es la segunda semana seguida en Atención. ' : ''}${nivel.respuesta}</p>`
      : html`<p class="tenue">Todavía no hay datos para medir: se calculan con las tareas estimadas con vencimiento, la disponibilidad de cada uno y lo que se terminó a tiempo.</p>`}
    <div class="tabla-env"><table class="tabla tabla-desvios">
      <thead><tr><th>Nivel</th><th>Condición</th><th>Respuesta</th></tr></thead>
      <tbody>${NIVELES_DESVIO.map(n => html`<tr key=${n.id} style="cursor:default"><td><span class=${'tag ' + n.tag}>${n.nombre}</span></td><td>${n.condicion}</td><td>${n.respuesta}</td></tr>`)}</tbody>
    </table></div>
    <h4 class="sub-titulo">Últimas semanas</h4>
    <div class="tabla-env"><table class="tabla tabla-desvios">
      <thead><tr><th>Semana</th><th>Esfuerzo (estimado vs disponible)</th><th>Compromiso</th><th>Nivel</th></tr></thead>
      <tbody>${[...filas].reverse().map(f => {
        const n = f.nivel && NIVELES_DESVIO.find(x => x.id === f.nivel);
        return html`<tr key=${f.lunes} style="cursor:default">
          <td>${rango(f)}${f.enCurso ? html` <span class="tenue">(en curso)</span>` : ''}</td>
          <td>${celdaPct(f.pEsf, `${horasTexto(f.real)} estimadas contra ${horasTexto(f.plan)} disponibles`)}${f.pEsf !== null && html` <span class="tenue mono">${horasTexto(f.real)} est. / ${horasTexto(f.plan)} disp.</span>`}</td>
          <td>${celdaPct(f.pCom, `${f.cumplidas} de ${f.comprometidas} tareas con vencimiento esa semana se terminaron a tiempo`)}${f.pCom !== null && html` <span class="tenue mono">${f.cumplidas} de ${f.comprometidas}</span>`}</td>
          <td>${n ? html`<span class=${'tag ' + n.tag}>${n.nombre}</span>${f.porRacha ? html` <span class="tenue">2 seguidas en Atención</span>` : ''}` : html`<span class="tenue">Sin datos</span>`}</td>
        </tr>`;
      })}</tbody>
    </table></div>
    <p class="tenue desvio-nota"><strong>Esfuerzo:</strong> cuánto se aparta lo estimado (puntos de las tareas con vencimiento esa semana, a 1 punto = 1 hora, repartidos entre sus responsables) de lo que cada uno tiene disponible en Disponibilidad, en más o en menos; cuentan solo quienes cargaron su disponibilidad. <strong>Compromiso:</strong> el porcentaje de tareas con vencimiento esa semana que no se terminó a tiempo. El nivel de la semana es el peor de los dos.</p>
  </section>`;
}
