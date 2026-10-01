
/* ===== Gráficos (HTML/SVG, con los tokens del tema y tooltip en cada marca) ===== */
function useAncho(ref) {
  const [ancho, setAncho] = useState(0);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    setAncho(el.clientWidth);
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(() => setAncho(el.clientWidth));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return ancho;
}
// Tope "lindo" para un eje: 0, 5, 10, 15 h…
function ejeLindo(max, marcas = 4) {
  if (max <= 0) return { tope: 1, paso: 1 };
  const bruto = max / marcas;
  const mag = Math.pow(10, Math.floor(Math.log10(bruto)));
  const paso = [1, 2, 2.5, 5, 10].map(f => f * mag).find(p => p >= bruto) || 10 * mag;
  return { tope: Math.ceil(max / paso) * paso, paso };
}
const nivelCalor = (v, max) => (v <= 0 || max <= 0 ? 0 : Math.min(5, Math.max(1, Math.ceil(v / max * 5))));

function Leyenda({ items, activos, alAlternar }) {
  return html`<div class="leyenda" role=${alAlternar ? 'group' : null} aria-label="Leyenda">${items.map(it => {
    const contenido = html`<span class="leyenda-marca" style=${`background:${it.color}`}></span>${it.nombre}`;
    return alAlternar
      ? html`<button type="button" key=${it.id} class="leyenda-item" aria-pressed=${activos.includes(it.id)} onClick=${() => alAlternar(it.id)}>${contenido}</button>`
      : html`<span key=${it.id} class="leyenda-item">${contenido}</span>`;
  })}</div>`;
}

// Barras horizontales apiladas: una fila por persona/etapa, segmentos por serie
function BarrasApiladas({ filas, series, formato = horasTexto }) {
  const max = Math.max(1, ...filas.map(f => f.total));
  return html`<div class="barras">${filas.map(f => {
    const segs = series.map(s => ({ s, v: f.valores.get(s.id) || 0 })).filter(x => x.v > 0);
    return html`<div class="barra-fila" key=${f.id}>
      <div class="barra-etq">${f.etiqueta}</div>
      <div class="barra-pista">
        <div class="apilada" style=${`width:calc((100% - 4rem) * ${f.total / max})`}>
          ${segs.map(({ s, v }, i) => html`<span key=${s.id} class=${'seg' + (i === segs.length - 1 ? ' fin' : '')} tabindex="0"
            style=${`flex:${v} 1 0;background:${s.color}`} data-tip=${`${f.nombre} · ${s.nombre}: ${formato(v)} (${pct(v, f.total)} %)`}></span>`)}
        </div>
        <span class="barra-valor">${formato(f.total)}</span>
      </div>
    </div>`;
  })}</div>`;
}

// Columnas verticales, simples o apiladas
function Columnas({ datos, series, formato = horasTexto, alto = 180, destacar }) {
  const max = Math.max(1, ...datos.map(d => d.total));
  return html`<div class="cols-graf">
    <div class="cols-area" style=${`height:${alto}px`}>${datos.map(d => {
      const segs = series ? series.map(s => ({ s, v: d.valores.get(s.id) || 0 })).filter(x => x.v > 0) : [];
      const tip = series
        ? `${d.nombre}: ${formato(d.total)}${segs.length ? ' · ' + segs.map(x => `${x.s.nombre} ${formato(x.v)}`).join(' · ') : ''}`
        : `${d.nombre}: ${formato(d.total)}${d.extra ? ' · ' + d.extra : ''}`;
      return html`<div class=${'col-item' + (destacar === d.id ? ' destacada' : '')} key=${d.id} tabindex="0" data-tip=${tip}>
        <span class="col-valor">${d.total ? formato(d.total) : ''}</span>
        <div class="col-pila" style=${`height:${d.total / max * 100}%`}>
          ${series ? segs.map(({ s, v }) => html`<span key=${s.id} style=${`flex:${v} 1 0;background:${s.color}`}></span>`)
            : html`<span style="flex:1 1 0;background:var(--blue)"></span>`}
        </div>
      </div>`;
    })}</div>
    <div class="cols-etqs" aria-hidden="true">${datos.map(d => html`<span key=${d.id}>${d.etq}</span>`)}</div>
  </div>`;
}

// Mapa de calor: filas × columnas; el máximo de cada fila queda marcado
function MapaCalor({ filas, columnas, valor, formato = duracionTexto, marcarMax = true }) {
  let max = 0;
  const vals = filas.map(f => columnas.map((c, j) => { const v = valor(f, j); if (v > max) max = v; return v; }));
  return html`<div class="calor-env">
    <div class="calor" style=${`grid-template-columns:minmax(64px,auto) repeat(${columnas.length}, minmax(0,1fr))`}>
      <span></span>${columnas.map(c => html`<span class="calor-col" key=${c.id}>${c.etq}</span>`)}
      ${filas.map((f, i) => {
        const maxFila = Math.max(...vals[i]);
        return [
          html`<span class="calor-fila" key=${'f' + f.id}>${f.etiqueta}</span>`,
          ...columnas.map((c, j) => {
            const v = vals[i][j];
            const pico = marcarMax && v > 0 && v === maxFila;
            return html`<span key=${f.id + '-' + c.id} class=${'celda-calor calor-' + nivelCalor(v, max) + (pico ? ' pico' : '')} tabindex="0"
              data-tip=${`${f.nombre} · ${c.nombre}: ${v ? formato(v) : 'sin horas'}${pico ? ' (su máximo)' : ''}`}></span>`;
          }),
        ];
      })}
    </div>
    <${EscalaCalor} />
  </div>`;
}
function EscalaCalor({ texto }) {
  return html`<div class="calor-escala" aria-hidden="true">${texto || 'Menos'}${[1, 2, 3, 4, 5].map(n => html`<span key=${n} class=${'celda-calor calor-' + n}></span>`)}Más</div>`;
}

// Calendario anual estilo GitHub: una columna por semana, de lunes a domingo
function CalendarioCalor({ porDia, desde, hasta }) {
  const fin = aFecha(hasta || hoyISO());
  // Desde el lunes de la primera semana del período, como mucho 52 semanas para atrás
  const tope = new Date(fin); tope.setDate(tope.getDate() - 7 * 52);
  const inicio = desde && aFecha(desde) > tope ? aFecha(desde) : tope;
  inicio.setDate(inicio.getDate() - diaSemana(inicio));
  const ref = useRef(null);
  useLayoutEffect(() => { if (ref.current) ref.current.scrollLeft = ref.current.scrollWidth; }, [desde, hasta]);
  const celdas = [], meses = [];
  let max = 0;
  porDia.forEach(v => { if (v > max) max = v; });
  let semana = 0, mesPrevio = -1;
  for (const d = new Date(inicio); d <= fin; d.setDate(d.getDate() + 1)) {
    const iso = isoDe(d), ds = diaSemana(d);
    if (ds === 0 && d.getMonth() !== mesPrevio) {
      // Una etiqueta por mes, sin encimarse con la anterior
      if (!meses.length || semana - meses[meses.length - 1].semana >= 3) meses.push({ semana, nombre: MESES_CORTOS[d.getMonth()] });
      mesPrevio = d.getMonth();
    }
    const v = porDia.get(iso) || 0;
    celdas.push(html`<span key=${iso} class=${'celda-calor calor-' + nivelCalor(v, max)} style=${`grid-column:${semana + 2};grid-row:${ds + 2}`}
      data-tip=${`${mayus(DIAS_LARGOS[ds])} ${fechaLarga(iso)}: ${v ? duracionTexto(v) : 'sin horas'}`}></span>`);
    if (ds === 6) semana++;
  }
  return html`<div class="anual-env" ref=${ref}>
    <div class="anual" style=${`grid-template-columns:28px repeat(${semana + 1}, 12px)`}>
      ${[0, 2, 4].map(ds => html`<span key=${'d' + ds} class="anual-dia" style=${`grid-column:1;grid-row:${ds + 2}`}>${DIAS_CORTOS[ds]}</span>`)}
      ${meses.map(m => html`<span key=${'m' + m.semana} class="anual-mes" style=${`grid-column:${m.semana + 2} / span 4;grid-row:1`}>${m.nombre}</span>`)}
      ${celdas}
    </div>
    <${EscalaCalor} />
  </div>`;
}

// Área semanal del total + una línea por persona activa en la leyenda
function AreaSemanal({ puntos, series, activos, formato = horasTexto }) {
  const ref = useRef(null);
  const ancho = useAncho(ref);
  const alto = 220, izq = 44, der = 12, arriba = 12, abajo = 26;
  const w = Math.max(0, ancho - izq - der), h = alto - arriba - abajo;
  const maxMin = Math.max(1, ...puntos.map(p => p.total));
  const { tope, paso } = ejeLindo(maxMin / 60);
  const x = i => izq + (puntos.length > 1 ? i / (puntos.length - 1) * w : w / 2);
  const y = min => arriba + h - (min / 60) / tope * h;
  const linea = valor => puntos.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(valor(p)).toFixed(1)}`).join(' ');
  const marcas = [];
  for (let v = 0; v <= tope + 1e-9; v += paso) marcas.push(v);
  const cadaN = Math.max(1, Math.ceil(puntos.length / 7));
  const visibles = series.filter(s => activos.includes(s.id));
  return html`<div class="area-env" ref=${ref}>
    ${ancho > 0 && puntos.length > 0 && html`<svg width=${ancho} height=${alto} role="img" aria-label="Horas por semana">
      ${marcas.map(v => html`<g key=${'y' + v}><line x1=${izq} x2=${izq + w} y1=${y(v * 60)} y2=${y(v * 60)} class="eje-grilla" />
        <text x=${izq - 8} y=${y(v * 60) + 4} class="eje-texto" text-anchor="end">${v.toLocaleString('es-UY')} h</text></g>`)}
      ${puntos.map((p, i) => i % cadaN === 0 && html`<text key=${'x' + i} x=${x(i)} y=${alto - 6} class="eje-texto" text-anchor="middle">${fechaCorta(p.clave)}</text>`)}
      <path d=${`${linea(p => p.total)} L${x(puntos.length - 1)},${y(0)} L${x(0)},${y(0)} Z`} class="area-relleno" />
      <path d=${linea(p => p.total)} class="area-linea" />
      ${visibles.map(s => html`<path key=${s.id} d=${linea(p => p.porSerie.get(s.id) || 0)} fill="none" stroke=${s.color} stroke-width="2" stroke-linejoin="round" stroke-linecap="round" />`)}
      <circle cx=${x(puntos.length - 1)} cy=${y(puntos[puntos.length - 1].total)} r="5" class="area-punto" />
      ${puntos.map((p, i) => {
        const x0 = puntos.length > 1 ? (i ? (x(i - 1) + x(i)) / 2 : izq) : izq;
        const x1 = puntos.length > 1 ? (i < puntos.length - 1 ? (x(i) + x(i + 1)) / 2 : izq + w) : izq + w;
        const detalle = visibles.map(s => `${s.nombre} ${formato(p.porSerie.get(s.id) || 0)}`).join(' · ');
        return html`<g key=${'h' + i} class="area-hit" tabindex="0" data-tip=${`Semana del ${fechaLarga(p.clave)}: ${formato(p.total)}${detalle ? ' · ' + detalle : ''}`}>
          <rect x=${x0} y=${arriba} width=${Math.max(1, x1 - x0)} height=${h} fill="transparent" />
          <line x1=${x(i)} x2=${x(i)} y1=${arriba} y2=${arriba + h} class="area-cursor" />
        </g>`;
      })}
    </svg>`}
  </div>`;
}
