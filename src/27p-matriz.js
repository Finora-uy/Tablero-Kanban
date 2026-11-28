
/* ===== Matriz de trazabilidad: requisito → tarea → PR, para la documentación =====
   El requisito sale del campo "Requerimiento" de la tarea (RF-12; puede tener varios separados por coma).
   Los PRs, ramas, commits y CI salen de GitHub (estado.github), así que solo está en la versión web. */

// "rf-12, RNF-3" → ["RF-12", "RNF-3"]
const requisitosDe = t => [...new Set(String(t.rf || '').split(/[,;\s]+/).map(x => x.trim().toUpperCase()).filter(Boolean))];
// RF antes que RNF, y por número
function ordenRequisito(a, b) {
  const pa = /^([A-Z]+)-?(\d+)/.exec(a), pb = /^([A-Z]+)-?(\d+)/.exec(b);
  if (pa && pb) return pa[1].localeCompare(pb[1]) || Number(pa[2]) - Number(pb[2]);
  return a.localeCompare(b, 'es', { numeric: true });
}
const SIN_REQUISITO = 'Sin requisito';

// Estado de la trazabilidad de cada tarea según su código
const TRAZA = {
  mergeado: { nombre: 'PR mergeado', fondo: 'FFE1F4EC', texto: 'FF0F7A54' },
  abierto: { nombre: 'PR abierto', fondo: 'FFFBF1D2', texto: 'FF8A6500' },
  rama: { nombre: 'Solo rama', fondo: 'FFE6EEFD', texto: 'FF2B5FC7' },
  nada: { nombre: 'Sin código', fondo: 'FFEEF1F6', texto: 'FF5B6B8C' },
};
const REQ_ESTADO = {
  completo: { nombre: 'Completo', fondo: 'FFE1F4EC', texto: 'FF0F7A54' },
  curso: { nombre: 'En curso', fondo: 'FFFBF1D2', texto: 'FF8A6500' },
  nada: { nombre: 'Sin empezar', fondo: 'FFEEF1F6', texto: 'FF5B6B8C' },
};

function calcularMatriz(ctx) {
  const g = estado.github || { ramas: [], commits: [], prs: [], ci: [] };
  const filas = [];
  for (const t of ctx.tareas) {
    if (t.archivada || t.numero == null) continue;
    const { ramas, prs, commits } = codigoDeTarea(t.numero, g);
    const vivos = prs.filter(p => p.estado !== 'cerrado');
    const principal = vivos.find(p => p.estado === 'mergeado') || vivos[0] || null;
    const traza = vivos.some(p => p.estado === 'mergeado') ? 'mergeado' : vivos.length ? 'abierto' : ramas.length || commits.length ? 'rama' : 'nada';
    const reqs = requisitosDe(t);
    // Sin requisito solo interesan las que ya tienen código: es código que no se puede rastrear
    if (!reqs.length && traza === 'nada') continue;
    for (const req of reqs.length ? reqs : [SIN_REQUISITO]) filas.push({ req, t, prs: vivos, principal, ramas, commits, traza });
  }
  filas.sort((a, b) => (a.req === SIN_REQUISITO) - (b.req === SIN_REQUISITO) || ordenRequisito(a.req, b.req) || a.t.numero - b.t.numero);
  const porReq = new Map();
  for (const f of filas) {
    if (f.req === SIN_REQUISITO) continue;
    const r = porReq.get(f.req) || { req: f.req, tareas: [], hechas: 0, mergeados: new Set(), conCodigo: false };
    r.tareas.push(f.t);
    if (f.traza !== 'nada') r.conCodigo = true;
    if (esHecha(f.t, ctx)) r.hechas++;
    f.prs.filter(p => p.estado === 'mergeado').forEach(p => r.mergeados.add(p.numero));
    porReq.set(f.req, r);
  }
  const requisitos = [...porReq.values()].map(r => ({
    ...r, estado: r.hechas === r.tareas.length ? 'completo' : r.hechas > 0 || r.conCodigo || r.tareas.some(t => !['ideas', 'por-hacer'].includes(t.columna)) ? 'curso' : 'nada',
  }));
  return { filas, requisitos, tareas: new Set(filas.map(f => f.t.id)).size };
}

function xlMarca(celda, e) {
  xlCelda(celda, e.nombre, { horizontal: 'center', fondo: e.fondo, font: xlLetra(10, e.texto, true) });
}
function xlPaginaMatriz(hoja) {
  xlPagina(hoja);
  hoja.headerFooter.oddFooter = '&L&8Finora · Matriz de trazabilidad&R&8Hoja &P de &N';
}

/* ----- Hoja 1: la matriz, una fila por requisito y tarea ----- */
function xlMatriz(libro, m, ctx, logo, subtitulo, derecha) {
  const hoja = libro.addWorksheet('Matriz', { properties: { tabColor: { argb: XL.ambar } } });
  xlPaginaMatriz(hoja);
  const cols = [['Requisito', 13], ['Tarea', 10], ['Título', 40], ['Tipo', 14], ['Columna', 14], ['Sprint', 12], ['PR', 16], ['Estado del PR', 18], ['CI', 13], ['Ramas', 34], ['Commits', 10], ['Trazabilidad', 15]];
  hoja.getColumn(1).width = 2.5;
  cols.forEach(([, w], i) => { hoja.getColumn(i + 2).width = w; });
  hoja.getColumn(cols.length + 2).width = 2.5;
  const fila0 = xlBanda(hoja, libro, logo, cols.length + 1, 'Matriz de trazabilidad', subtitulo, derecha);
  cols.forEach(([t], i) => xlEncabezado(hoja.getCell(fila0, i + 2), t, [0, 1, 10, 11].includes(i)));
  hoja.getRow(fila0).height = 24;
  let fila = fila0 + 1;
  const centro = { horizontal: 'center' };
  for (const f of m.filas) {
    const t = f.t, p = f.principal;
    const sprint = sprintDe(t, ctx);
    const ci = p && p.estado === 'abierto' ? ciDeRama(p.rama) : null;
    const textoPrs = f.prs.map(x => '#' + x.numero).join(', ');
    const ramas = f.ramas.filter(r => !r.borrada).map(r => r.nombre).join('\n') || (f.ramas.length ? '(borradas)' : '—');
    const sinReq = f.req === SIN_REQUISITO;
    xlCelda(hoja.getCell(fila, 2), f.req, { ...centro, font: xlLetra(10, sinReq ? XL_ESTADO.atencion.texto : XL.noche, true), fondo: sinReq ? XL_ESTADO.atencion.fondo : undefined });
    xlCelda(hoja.getCell(fila, 3), codigo(t, ctx), { ...centro, font: xlLetra(10, XL.gris) });
    xlCelda(hoja.getCell(fila, 4), t.titulo, { wrap: true });
    xlCelda(hoja.getCell(fila, 5), (TIPOS.find(x => x.id === t.tipo) || TIPOS[2]).nombre, { wrap: true, font: xlLetra(9) });
    xlCelda(hoja.getCell(fila, 6), ctx.colPorId.get(t.columna)?.nombre || nombreColumna(t.columna), { font: xlLetra(9) });
    xlCelda(hoja.getCell(fila, 7), sprint ? sprint.nombre : '—', { font: xlLetra(9) });
    xlCelda(hoja.getCell(fila, 8), p && p.url ? { text: textoPrs, hyperlink: p.url } : textoPrs || '—', { font: p ? xlLetra(10, 'FF2B5FC7', false, { underline: !!p.url }) : xlLetra(10, XL.gris) });
    xlCelda(hoja.getCell(fila, 9), p ? estadoPrVisible(p).texto : '—', { font: xlLetra(9) });
    xlCelda(hoja.getCell(fila, 10), ci ? CI_VISIBLE[ci.estado].texto : '—', { font: xlLetra(9, ci && ci.estado === 'falla' ? XL_ESTADO.mal.texto : XL.tinta, ci && ci.estado === 'falla') });
    xlCelda(hoja.getCell(fila, 11), ramas, { wrap: true, font: xlLetra(9, XL.gris) });
    xlCelda(hoja.getCell(fila, 12), f.commits.length, { ...centro, font: xlLetra(10) });
    xlMarca(hoja.getCell(fila, 13), TRAZA[f.traza]);
    hoja.getRow(fila).height = Math.max(xlAlto(t.titulo, 44, 14, 20), Math.max(1, ramas.split('\n').length) * 14 + 6);
    fila++;
  }
  if (!m.filas.length) {
    hoja.mergeCells(fila, 2, fila, cols.length + 1);
    xlCelda(hoja.getCell(fila, 2), 'Todavía no hay tareas con requisito (campo Requerimiento) ni con código vinculado.', { font: xlLetra(10, XL.gris) });
  } else {
    hoja.autoFilter = { from: { row: fila0, column: 2 }, to: { row: fila - 1, column: cols.length + 1 } };
  }
  hoja.views = [{ showGridLines: false, state: 'frozen', ySplit: fila0 }];
}

/* ----- Hoja 2: cobertura por requisito ----- */
function xlPorRequisito(libro, m, ctx, logo, subtitulo, derecha) {
  const hoja = libro.addWorksheet('Por requisito', { properties: { tabColor: { argb: XL.marino } } });
  xlPaginaMatriz(hoja);
  const cols = [['Requisito', 13], ['Tareas', 46], ['Terminadas', 12], ['PRs mergeados', 22], ['Estado', 15]];
  hoja.getColumn(1).width = 2.5;
  cols.forEach(([, w], i) => { hoja.getColumn(i + 2).width = w; });
  hoja.getColumn(cols.length + 2).width = 2.5;
  const fila0 = xlBanda(hoja, libro, logo, cols.length + 1, 'Cobertura por requisito', subtitulo, derecha);
  cols.forEach(([t], i) => xlEncabezado(hoja.getCell(fila0, i + 2), t, i !== 1 && i !== 3));
  hoja.getRow(fila0).height = 24;
  let fila = fila0 + 1;
  for (const r of m.requisitos) {
    const tareas = r.tareas.map(t => `${codigo(t, ctx)} ${t.titulo}`).join('\n');
    xlCelda(hoja.getCell(fila, 2), r.req, { horizontal: 'center', font: xlLetra(10, XL.noche, true) });
    xlCelda(hoja.getCell(fila, 3), tareas, { wrap: true, font: xlLetra(9) });
    xlCelda(hoja.getCell(fila, 4), `${r.hechas} de ${r.tareas.length}`, { horizontal: 'center' });
    xlCelda(hoja.getCell(fila, 5), [...r.mergeados].sort((a, b) => a - b).map(n => '#' + n).join(', ') || '—', { font: xlLetra(9) });
    xlMarca(hoja.getCell(fila, 6), REQ_ESTADO[r.estado]);
    hoja.getRow(fila).height = Math.max(20, r.tareas.length * 14 + 6);
    fila++;
  }
  if (!m.requisitos.length) {
    hoja.mergeCells(fila, 2, fila, cols.length + 1);
    xlCelda(hoja.getCell(fila, 2), 'Ninguna tarea tiene cargado el requisito (campo Requerimiento de la tarea).', { font: xlLetra(10, XL.gris) });
  }
  hoja.views = [{ showGridLines: false, state: 'frozen', ySplit: fila0 }];
}

async function armarExcelMatriz(ctx) {
  const ExcelJS = await cargarExcelJS();
  const libro = new ExcelJS.Workbook();
  libro.creator = 'Tablero Finora';
  libro.created = new Date();
  let logo = null;
  try { logo = xlLogo(); } catch (err) { console.warn('El Excel sale sin logo', err); }
  const m = calcularMatriz(ctx);
  const quien = ctx.yo ? ` por ${nombreDe(ctx.yo, ctx)}` : '';
  const subtitulo = `${m.requisitos.length} requisito${m.requisitos.length === 1 ? '' : 's'} · ${m.tareas} tarea${m.tareas === 1 ? '' : 's'} · repo IngSoft-ProyectoGrado/Finora`;
  const derecha = `Generado el ${fechaNum(ctx.hoy)}${quien}`;
  xlMatriz(libro, m, ctx, logo, subtitulo, derecha);
  xlPorRequisito(libro, m, ctx, logo, subtitulo, derecha);
  return libro.xlsx.writeBuffer();
}

// Botón de la vista Resumen (solo en la web, donde están los datos de GitHub)
function ExportarMatriz({ ctx }) {
  const [generando, setGenerando] = useState(false);
  const g = estado.github;
  if (!g || g.error) return null;
  const descargar = async () => {
    setGenerando(true);
    try {
      const datos = await armarExcelMatriz(ctx);
      await guardarArchivo(`matriz-trazabilidad-finora-${ctx.hoy}.xlsx`, datos, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    } catch (err) {
      console.error('No se pudo armar la matriz', err);
      avisar('No se pudo armar el Excel. Revisá tu conexión y probá de nuevo.', 'error');
    }
    setGenerando(false);
  };
  return html`<button class="btn" disabled=${generando || !g.cargado} onClick=${descargar}
      title="Excel con cada requisito (campo Requerimiento de la tarea), sus tareas y los PRs que las implementan">
    <${Icono} n="descargar" t=${15} />${generando ? 'Armando el Excel…' : 'Matriz de trazabilidad (.xlsx)'}
  </button>`;
}
