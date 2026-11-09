
/* ===== Horas: el Excel del control de calidad, con la marca de Finora =====
   ExcelJS se baja recién cuando alguien pide el archivo: pesa mucho para cargarlo con el tablero. */
const EXCELJS_URL = 'https://cdn.jsdelivr.net/npm/exceljs@4.4.0/dist/exceljs.min.js';
let promesaExcelJS = null;
function cargarExcelJS() {
  if (window.ExcelJS) return Promise.resolve(window.ExcelJS);
  if (!promesaExcelJS) {
    promesaExcelJS = new Promise((ok, mal) => {
      const s = document.createElement('script');
      s.src = EXCELJS_URL;
      s.onload = () => (window.ExcelJS ? ok(window.ExcelJS) : mal(new Error('ExcelJS no quedó disponible')));
      s.onerror = () => { promesaExcelJS = null; mal(new Error('No se pudo descargar ExcelJS')); };
      document.head.appendChild(s);
    });
  }
  return promesaExcelJS;
}

const XL = {
  noche: 'FF07132F', marino: 'FF0C2150', ambar: 'FFC0843A', ambarTinte: 'FFF8EFE2', hueso: 'FFEEF2F9', niebla: 'FF93A1C2',
  tinta: 'FF14233F', gris: 'FF5B6B8C', linea: 'FFD5DCE9', fondo: 'FFF5F7FB', blanco: 'FFFFFFFF',
};
const XL_ESTADO = {
  ok: { nombre: 'Cumple', fondo: 'FFE1F4EC', texto: 'FF0F7A54' }, atencion: { nombre: 'Atención', fondo: 'FFFBF1D2', texto: 'FF8A6500' },
  mal: { nombre: 'No cumple', fondo: 'FFFBE3E2', texto: 'FFB92D2A' }, info: { nombre: 'Referencia', fondo: 'FFE6EEFD', texto: 'FF2B5FC7' },
  nd: { nombre: 'Sin datos', fondo: 'FFEEF1F6', texto: 'FF5B6B8C' },
};
const XL_LETRA = 'Segoe UI';
const xlRelleno = argb => ({ type: 'pattern', pattern: 'solid', fgColor: { argb } });
const xlLetra = (size, color = XL.tinta, bold = false, extra = {}) => ({ name: XL_LETRA, size, color: { argb: color }, bold, ...extra });
const xlBorde = (color = XL.linea) => { const l = { style: 'thin', color: { argb: color } }; return { top: l, bottom: l, left: l, right: l }; };
// Excel guarda las fechas sin zona horaria: se arman en UTC para que muestre el día que corresponde
const xlFecha = iso => { const [y, m, d] = iso.split('-').map(Number); return new Date(Date.UTC(y, m - 1, d)); };
const xlFechaHora = instante => { const d = new Date(instante); return new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate(), d.getHours(), d.getMinutes())); };
const xlHoras = min => Math.round((min || 0) / 60 * 100) / 100;
const xlAlto = (texto, anchoLetras, porLinea = 15, minimo = 20) => Math.max(minimo, Math.ceil(String(texto || '').length / anchoLetras) * porLinea + 6);

// El logo como PNG, con la tinta en Hueso para que se lea sobre Noche
function xlLogo() {
  const v = LOGO.completo, [x, y, w, alto] = v.viewBox.split(' ').map(Number);
  const canvas = document.createElement('canvas');
  const escala = 132 / alto;
  canvas.width = Math.ceil(w * escala); canvas.height = Math.ceil(alto * escala);
  const g = canvas.getContext('2d');
  g.scale(escala, escala); g.translate(-x, -y);
  g.fillStyle = '#EEF2F9'; g.fill(new Path2D(v.tinta), 'evenodd');
  g.fillStyle = AMBAR_LOGO; g.fill(new Path2D(v.ambar));
  return { base64: canvas.toDataURL('image/png'), proporcion: w / alto };
}

// Banda de marca que encabeza cada hoja. Devuelve la primera fila libre.
function xlBanda(hoja, libro, logo, ultimaCol, titulo, subtitulo, derecha) {
  const pintar = (fila, alto, color = XL.noche) => {
    hoja.getRow(fila).height = alto;
    for (let c = 1; c <= ultimaCol + 1; c++) hoja.getCell(fila, c).fill = xlRelleno(color);
  };
  pintar(1, 8); pintar(2, 30); pintar(3, 30); pintar(4, 20); pintar(5, 8); pintar(6, 3, XL.ambar);
  if (logo) {
    const altoPx = 32;
    hoja.addImage(libro.addImage({ base64: logo.base64, extension: 'png' }), { tl: { col: 1, row: 1.1 }, ext: { width: Math.round(altoPx * logo.proporcion), height: altoPx }, editAs: 'absolute' });
  }
  const medio = Math.max(3, ultimaCol - 3);
  hoja.mergeCells(2, medio, 2, ultimaCol);
  Object.assign(hoja.getCell(2, medio), { value: derecha, font: xlLetra(9, XL.ambar, true), alignment: { horizontal: 'right', vertical: 'middle' } });
  hoja.mergeCells(3, 2, 3, ultimaCol);
  Object.assign(hoja.getCell(3, 2), { value: titulo, font: xlLetra(18, XL.hueso, true), alignment: { vertical: 'middle' } });
  hoja.mergeCells(4, 2, 4, ultimaCol);
  Object.assign(hoja.getCell(4, 2), { value: subtitulo, font: xlLetra(10, XL.niebla), alignment: { vertical: 'middle' } });
  return 8;
}
function xlEstado(celda, estado) {
  const e = XL_ESTADO[estado];
  celda.value = e.nombre;
  celda.fill = xlRelleno(e.fondo);
  celda.font = xlLetra(10, e.texto, true);
  celda.alignment = { horizontal: 'center', vertical: 'middle' };
}
function xlTitulo(hoja, fila, colIni, colFin, texto) {
  hoja.mergeCells(fila, colIni, fila, colFin);
  Object.assign(hoja.getCell(fila, colIni), { value: texto, font: xlLetra(12, XL.noche, true), alignment: { vertical: 'middle' }, border: { bottom: { style: 'medium', color: { argb: XL.ambar } } } });
  for (let c = colIni; c <= colFin; c++) hoja.getCell(fila, c).border = { bottom: { style: 'medium', color: { argb: XL.ambar } } };
  hoja.getRow(fila).height = 24;
}
function xlEncabezado(celda, texto, centrado) {
  Object.assign(celda, { value: texto, fill: xlRelleno(XL.marino), font: xlLetra(10, XL.hueso, true), alignment: { vertical: 'middle', wrapText: true, horizontal: centrado ? 'center' : 'left' }, border: xlBorde(XL.marino) });
}
function xlCelda(celda, valor, opciones = {}) {
  celda.value = valor;
  celda.font = opciones.font || xlLetra(10);
  celda.alignment = { vertical: opciones.vertical || 'middle', wrapText: !!opciones.wrap, horizontal: opciones.horizontal };
  celda.border = xlBorde();
  if (opciones.fondo) celda.fill = xlRelleno(opciones.fondo);
  if (opciones.formato) celda.numFmt = opciones.formato;
}
function xlPagina(hoja) {
  hoja.pageSetup = { orientation: 'landscape', paperSize: 9, fitToPage: true, fitToWidth: 1, fitToHeight: 0, margins: { left: 0.3, right: 0.3, top: 0.4, bottom: 0.4, header: 0.2, footer: 0.2 } };
  hoja.headerFooter.oddFooter = '&L&8Finora · Control de calidad del registro de horas&R&8Hoja &P de &N';
}

/* ----- Hoja 1: Resumen ----- */
function xlResumen(libro, c, ctx, logo, subtitulo, derecha) {
  const hoja = libro.addWorksheet('Resumen', { views: [{ showGridLines: false }], properties: { tabColor: { argb: XL.ambar } } });
  xlPagina(hoja);
  hoja.getColumn(1).width = 2.5;
  for (let i = 2; i <= 13; i++) hoja.getColumn(i).width = 12.5;
  hoja.getColumn(14).width = 2.5;
  let fila = xlBanda(hoja, libro, logo, 13, 'Control de calidad del registro de horas', subtitulo, derecha);

  // Tarjetas
  const tarjeta = (colIni, etiqueta, valor, formato, pie, colorValor = XL.noche) => {
    const colFin = colIni + 2;
    for (let f = fila; f <= fila + 2; f++) for (let k = colIni; k <= colFin; k++) hoja.getCell(f, k).fill = xlRelleno(XL.fondo);
    [[fila, etiqueta, xlLetra(9, XL.gris, true)], [fila + 1, valor, xlLetra(22, colorValor, true)], [fila + 2, pie, xlLetra(9, XL.gris)]].forEach(([f, v, font]) => {
      hoja.mergeCells(f, colIni, f, colFin);
      Object.assign(hoja.getCell(f, colIni), { value: v, font, alignment: { vertical: 'middle', horizontal: 'left', indent: 1 } });
      hoja.getCell(f, colIni).border = { left: { style: 'thick', color: { argb: XL.ambar } } };
    });
    if (formato) hoja.getCell(fila + 1, colIni).numFmt = formato;
  };
  const colorVinc = !c.baseMin ? XL.gris : c.pctVinc >= META_VINCULADAS ? XL_ESTADO.ok.texto : c.pctVinc >= 80 ? XL_ESTADO.atencion.texto : XL_ESTADO.mal.texto;
  tarjeta(2, 'HORAS REGISTRADAS', xlHoras(c.total), '0.0" h"', `${c.regs.length} registros · ${horasTexto(c.reunionMin)} en reuniones`);
  tarjeta(5, 'VINCULADAS A UNA TAREA', c.baseMin ? c.pctVinc / 100 : '—', '0%', `Meta ≥ ${META_VINCULADAS} %, sin contar reuniones`, colorVinc);
  tarjeta(8, 'DÍAS SIN REGISTRO', c.diasSinRegistro, '0', `de ${c.esperados} ${c.esperados === 1 ? 'día' : 'días'} con disponibilidad declarada`);
  tarjeta(11, 'CONTROLES QUE CUMPLEN', `${c.cumplen} de ${c.medidos}`, null, `${c.atencion} en atención · ${c.noCumplen} sin cumplir`);
  hoja.getRow(fila).height = 20; hoja.getRow(fila + 1).height = 34; hoja.getRow(fila + 2).height = 20;
  fila += 4;

  // Tablas de controles. Columnas: Control B:D · Resultado E:G · Meta H · Estado I · Qué hacer J:M
  const tabla = (titulo, lista) => {
    xlTitulo(hoja, fila, 2, 13, titulo); fila++;
    const unir = (f, a, b) => { if (b > a) hoja.mergeCells(f, a, f, b); };
    [[2, 4, 'Control'], [5, 7, 'Resultado'], [8, 8, 'Meta'], [9, 9, 'Estado'], [10, 13, 'Qué hacer']].forEach(([a, b, t]) => { unir(fila, a, b); for (let k = a; k <= b; k++) xlEncabezado(hoja.getCell(fila, k), t, a === 9); });
    hoja.getRow(fila).height = 22; fila++;
    for (const x of lista) {
      hoja.getRow(fila).height = Math.max(36, 15 + xlAlto(x.detalle, 36, 15, 15), xlAlto(x.accion, 50, 15, 15));
      [[2, 4], [5, 7], [10, 13]].forEach(([a, b]) => { unir(fila, a, b); for (let k = a; k <= b; k++) hoja.getCell(fila, k).border = xlBorde(); });
      xlCelda(hoja.getCell(fila, 2), x.nombre, { font: xlLetra(10, XL.noche, true), wrap: true });
      xlCelda(hoja.getCell(fila, 5), { richText: [{ font: xlLetra(10, XL.noche, true), text: x.valor + '\n' }, { font: xlLetra(9, XL.gris), text: x.detalle }] }, { wrap: true });
      xlCelda(hoja.getCell(fila, 8), x.meta, { wrap: true, font: xlLetra(9, XL.gris) });
      hoja.getCell(fila, 9).border = xlBorde();
      xlEstado(hoja.getCell(fila, 9), x.estado);
      xlCelda(hoja.getCell(fila, 10), x.accion, { wrap: true, font: xlLetra(9, XL.tinta) });
      fila++;
    }
    fila++;
  };
  tabla('Controles de SQA', c.controles.filter(x => x.grupo === 'sqa'));
  tabla('Controles adicionales', c.controles.filter(x => x.grupo === 'extra'));
  tabla('Datos de referencia', c.controles.filter(x => x.grupo === 'info'));

  // Por semana: la corrección se pide antes de cada cierre
  xlTitulo(hoja, fila, 2, 13, 'Semana a semana'); fila++;
  const cols = [[2, 4, 'Semana'], [5, 6, 'Horas'], [7, 8, 'Sin reuniones'], [9, 10, '% vinculadas'], [11, 12, 'Notas a corregir'], [13, 13, 'Reun. dupl.']];
  const unirFila = f => cols.forEach(([a, b]) => { if (b > a) hoja.mergeCells(f, a, f, b); });
  unirFila(fila);
  cols.forEach(([a, b, t]) => { for (let k = a; k <= b; k++) xlEncabezado(hoja.getCell(fila, k), t, a > 2); });
  hoja.getRow(fila).height = 22; fila++;
  for (const s of c.semanas) {
    unirFila(fila);
    cols.forEach(([a, b]) => { for (let k = a; k <= b; k++) hoja.getCell(fila, k).border = xlBorde(); });
    const pv = s.baseMin ? s.vinculadoMin / s.baseMin : null;
    const fin = finDeSemana(s.lunes);
    xlCelda(hoja.getCell(fila, 2), `${fechaCorta(s.lunes)} al ${fechaCorta(fin)}`);
    xlCelda(hoja.getCell(fila, 5), xlHoras(s.minutos), { horizontal: 'center', formato: '0.0' });
    xlCelda(hoja.getCell(fila, 7), xlHoras(s.baseMin), { horizontal: 'center', formato: '0.0' });
    const estadoVinc = pv === null ? null : pv * 100 >= META_VINCULADAS ? 'ok' : pv * 100 >= 80 ? 'atencion' : 'mal';
    xlCelda(hoja.getCell(fila, 9), pv === null ? '—' : pv, { horizontal: 'center', formato: '0%', fondo: estadoVinc ? XL_ESTADO[estadoVinc].fondo : undefined, font: xlLetra(10, estadoVinc ? XL_ESTADO[estadoVinc].texto : XL.gris, true) });
    xlCelda(hoja.getCell(fila, 11), s.notas, { horizontal: 'center', fondo: s.notas ? XL_ESTADO.atencion.fondo : undefined, font: xlLetra(10, s.notas ? XL_ESTADO.atencion.texto : XL.tinta, !!s.notas) });
    xlCelda(hoja.getCell(fila, 13), s.duplicadas, { horizontal: 'center', fondo: s.duplicadas ? XL_ESTADO.mal.fondo : undefined, font: xlLetra(10, s.duplicadas ? XL_ESTADO.mal.texto : XL.tinta, !!s.duplicadas) });
    hoja.getRow(fila).height = 20;
    fila++;
  }
  if (!c.semanas.length) { hoja.mergeCells(fila, 2, fila, 13); xlCelda(hoja.getCell(fila, 2), 'No hay horas cargadas en este mes.', { font: xlLetra(10, XL.gris) }); }
}

/* ----- Hoja 2: Por integrante ----- */
function xlPorIntegrante(libro, c, logo, subtitulo, derecha) {
  const hoja = libro.addWorksheet('Por integrante', { views: [{ showGridLines: false }], properties: { tabColor: { argb: XL.marino } } });
  xlPagina(hoja);
  const cols = [
    ['Integrante', 18], ['Rol', 24], ['Horas', 9], ['Disponibles (h)', 12], ['% de lo disponible', 14], ['Días esperados', 10], ['Días con registro', 10], ['Días sin registro', 10],
    ['% vinculadas', 11], ['Notas a corregir', 10], ['Reuniones (h)', 10], ['Reun. dupl.', 8], ['Superpuestos', 14], ['Carga tardía', 9], ['Fechas sin registro', 42],
  ];
  hoja.getColumn(1).width = 2.5;
  cols.forEach(([, w], i) => { hoja.getColumn(i + 2).width = w; });
  hoja.getColumn(cols.length + 2).width = 2.5;
  let fila = xlBanda(hoja, libro, logo, cols.length + 1, 'Por integrante', subtitulo, derecha);
  const encab = fila;
  cols.forEach(([t], i) => xlEncabezado(hoja.getCell(fila, i + 2), t, i > 1));
  hoja.getRow(fila).height = 36; fila++;
  const primera = fila;
  const contar = (celda, v) => xlCelda(celda, v, { horizontal: 'center', fondo: v ? XL_ESTADO.atencion.fondo : undefined, font: xlLetra(10, v ? XL_ESTADO.atencion.texto : XL.tinta, !!v) });
  for (const p of c.personas) {
    const pv = p.baseMin ? p.vinculadoMin / p.baseMin : null;
    const ev = pv === null ? null : pv * 100 >= META_VINCULADAS ? 'ok' : pv * 100 >= 80 ? 'atencion' : 'mal';
    const centro = { horizontal: 'center' };
    const fechas = p.dispDeclarada ? p.diasSin.map(f => { const d = aFecha(f); return `${d.getDate()}/${d.getMonth() + 1}`; }).join(', ') : 'No declaró disponibilidad';
    xlCelda(hoja.getCell(fila, 2), p.nombre, { font: xlLetra(10, XL.noche, true) });
    xlCelda(hoja.getCell(fila, 3), p.rol || '—', { font: xlLetra(9, XL.gris), wrap: true });
    xlCelda(hoja.getCell(fila, 4), xlHoras(p.minutos), { ...centro, formato: '0.0' });
    xlCelda(hoja.getCell(fila, 5), p.dispDeclarada ? xlHoras(p.dispMin) : '—', { ...centro, formato: '0.0' });
    xlCelda(hoja.getCell(fila, 6), p.dispMin ? p.minutos / p.dispMin : '—', { ...centro, formato: '0%' });
    xlCelda(hoja.getCell(fila, 7), p.dispDeclarada ? p.esperados : '—', centro);
    xlCelda(hoja.getCell(fila, 8), p.dispDeclarada ? p.conRegistro : '—', centro);
    if (p.dispDeclarada) contar(hoja.getCell(fila, 9), p.diasSin.length); else xlCelda(hoja.getCell(fila, 9), '—', centro);
    xlCelda(hoja.getCell(fila, 10), pv === null ? '—' : pv, { ...centro, formato: '0%', fondo: ev ? XL_ESTADO[ev].fondo : undefined, font: xlLetra(10, ev ? XL_ESTADO[ev].texto : XL.gris, !!ev) });
    contar(hoja.getCell(fila, 11), p.notas);
    xlCelda(hoja.getCell(fila, 12), xlHoras(p.reunionMin), { ...centro, formato: '0.0' });
    contar(hoja.getCell(fila, 13), p.duplicadas);
    contar(hoja.getCell(fila, 14), p.superpuestos);
    contar(hoja.getCell(fila, 15), p.tardios);
    xlCelda(hoja.getCell(fila, 16), fechas, { wrap: true, font: xlLetra(9, XL.gris) });
    hoja.getRow(fila).height = xlAlto(fechas, 46, 14, 24);
    fila++;
  }
  const ultima = fila - 1;
  // Fila de totales con fórmulas, para que siga cerrando si filtran o corrigen
  if (c.personas.length) {
    // Con el resultado ya calculado: en la Vista protegida de Excel las fórmulas no se recalculan
    const sumar = f => c.personas.reduce((a, p) => a + f(p), 0);
    const dato = (col, formato, result) => xlCelda(hoja.getCell(fila, col.charCodeAt(0) - 64), { formula: `SUM(${col}${primera}:${col}${ultima})`, result }, { horizontal: 'center', formato, fondo: XL.ambarTinte, font: xlLetra(10, XL.noche, true) });
    xlCelda(hoja.getCell(fila, 2), 'Equipo', { fondo: XL.ambarTinte, font: xlLetra(10, XL.noche, true) });
    xlCelda(hoja.getCell(fila, 3), '', { fondo: XL.ambarTinte });
    dato('D', '0.0', sumar(p => xlHoras(p.minutos))); dato('E', '0.0', sumar(p => xlHoras(p.dispMin)));
    xlCelda(hoja.getCell(fila, 6), c.dispMin ? sumar(p => (p.dispMin ? p.minutos : 0)) / c.dispMin : '—', { horizontal: 'center', formato: '0%', fondo: XL.ambarTinte, font: xlLetra(10, XL.noche, true) });
    dato('G', '0', sumar(p => p.esperados)); dato('H', '0', sumar(p => p.conRegistro)); dato('I', '0', sumar(p => p.diasSin.length));
    xlCelda(hoja.getCell(fila, 10), c.baseMin ? c.pctVinc / 100 : '—', { horizontal: 'center', formato: '0%', fondo: XL.ambarTinte, font: xlLetra(10, XL.noche, true) });
    dato('K', '0', sumar(p => p.notas)); dato('L', '0.0', sumar(p => xlHoras(p.reunionMin))); dato('M', '0', sumar(p => p.duplicadas)); dato('N', '0', sumar(p => p.superpuestos)); dato('O', '0', sumar(p => p.tardios));
    xlCelda(hoja.getCell(fila, 16), '', { fondo: XL.ambarTinte });
    hoja.getRow(fila).height = 24;
    // Barra de datos en "% de lo disponible"
    hoja.addConditionalFormatting({ ref: `F${primera}:F${ultima}`, rules: [{ type: 'dataBar', priority: 1, gradient: false, minLength: 0, maxLength: 100, cfvo: [{ type: 'num', value: 0 }, { type: 'num', value: 1 }], color: { argb: 'FFE3C69A' } }] });
  }
  hoja.views = [{ showGridLines: false, state: 'frozen', xSplit: 2, ySplit: encab }];
}

/* ----- Hoja 3: Hallazgos ----- */
function xlHallazgos(libro, c, logo, subtitulo, derecha) {
  const hoja = libro.addWorksheet('A corregir', { properties: { tabColor: { argb: 'FFB92D2A' } } });
  xlPagina(hoja);
  const cols = [['Control', 30], ['Integrante', 18], ['Fecha', 12], ['Corregir antes de', 14], ['Horas', 9], ['Qué hay que hacer', 52], ['Nota actual', 36], ['Tarea', 36], ['Corregido', 13.5]];
  hoja.getColumn(1).width = 2.5;
  cols.forEach(([, w], i) => { hoja.getColumn(i + 2).width = w; });
  hoja.getColumn(cols.length + 2).width = 2.5;
  const fila0 = xlBanda(hoja, libro, logo, cols.length + 1, 'A corregir', `${subtitulo} · ${c.hallazgos.length} ${c.hallazgos.length === 1 ? 'hallazgo' : 'hallazgos'}`, derecha);
  cols.forEach(([t], i) => xlEncabezado(hoja.getCell(fila0, i + 2), t, [2, 3, 4, 8].includes(i)));
  hoja.getRow(fila0).height = 30;
  let fila = fila0 + 1;
  c.hallazgos.forEach((x, i) => {
    const fondo = i % 2 ? XL.fondo : undefined, centro = { horizontal: 'center', fondo };
    xlCelda(hoja.getCell(fila, 2), x.control, { fondo, wrap: true, font: xlLetra(10, XL.noche, true) });
    xlCelda(hoja.getCell(fila, 3), x.persona, { fondo, wrap: true });
    xlCelda(hoja.getCell(fila, 4), x.fecha ? xlFecha(x.fecha) : '—', { ...centro, formato: 'dd/mm/yyyy' });
    xlCelda(hoja.getCell(fila, 5), x.cierre ? xlFecha(x.cierre) : '—', { ...centro, formato: 'dd/mm/yyyy' });
    xlCelda(hoja.getCell(fila, 6), x.minutos ? xlHoras(x.minutos) : '—', { ...centro, formato: '0.00' });
    xlCelda(hoja.getCell(fila, 7), x.detalle, { fondo, wrap: true });
    xlCelda(hoja.getCell(fila, 8), x.nota || '—', { fondo, wrap: true, font: xlLetra(9, XL.gris) });
    xlCelda(hoja.getCell(fila, 9), x.tarea || '—', { fondo, wrap: true, font: xlLetra(9, XL.gris) });
    xlCelda(hoja.getCell(fila, 10), 'No', { ...centro, font: xlLetra(10, XL_ESTADO.mal.texto, true) });
    hoja.getCell(fila, 10).dataValidation = { type: 'list', allowBlank: false, formulae: ['"Sí,No"'] };
    hoja.getRow(fila).height = Math.max(xlAlto(x.detalle, 58, 15, 22), xlAlto(x.nota, 42, 14, 22), xlAlto(x.tarea, 42, 14, 22));
    fila++;
  });
  const ultima = fila - 1;
  if (c.hallazgos.length) {
    hoja.autoFilter = { from: { row: fila0, column: 2 }, to: { row: ultima, column: cols.length + 1 } };
    hoja.addConditionalFormatting({ ref: `J${fila0 + 1}:J${ultima}`, rules: [{ type: 'cellIs', operator: 'equal', priority: 1, formulae: ['"Sí"'], style: { fill: { type: 'pattern', pattern: 'solid', bgColor: { argb: XL_ESTADO.ok.fondo } }, font: { color: { argb: XL_ESTADO.ok.texto }, bold: true } } }] });
  } else {
    hoja.mergeCells(fila, 2, fila, cols.length + 1);
    xlCelda(hoja.getCell(fila, 2), 'No hay nada para corregir en este mes.', { font: xlLetra(10, XL_ESTADO.ok.texto, true), fondo: XL_ESTADO.ok.fondo });
    hoja.getRow(fila).height = 24;
  }
  hoja.views = [{ showGridLines: false, state: 'frozen', ySplit: fila0 }];
}

/* ----- Hoja 4: Todos los registros ----- */
function xlRegistros(libro, c, ctx, logo, subtitulo, derecha) {
  const hoja = libro.addWorksheet('Registros', { properties: { tabColor: { argb: XL.niebla } } });
  xlPagina(hoja);
  const cols = [['Fecha', 12], ['Día', 8], ['Integrante', 16], ['Desde', 9], ['Hasta', 9], ['Horas', 9], ['Etapa', 16], ['Trabajo', 24], ['Tarea', 34], ['Nota', 42], ['Cargado el', 17], ['Cargado por', 16], ['Observaciones', 30]];
  hoja.getColumn(1).width = 2.5;
  cols.forEach(([, w], i) => { hoja.getColumn(i + 2).width = w; });
  hoja.getColumn(cols.length + 2).width = 2.5;
  const fila0 = xlBanda(hoja, libro, logo, cols.length + 1, 'Registros del mes', `${subtitulo} · ${c.regs.length} registros`, derecha);
  cols.forEach(([t], i) => xlEncabezado(hoja.getCell(fila0, i + 2), t, [0, 1, 3, 4, 5].includes(i)));
  hoja.getRow(fila0).height = 24;
  let fila = fila0 + 1;
  for (const r of c.regs) {
    const t = r.tarea && ctx.porId.get(r.tarea);
    const obs = [...new Set(c.marcas.get(r.id) || [])].join(', ');
    const centro = { horizontal: 'center' };
    xlCelda(hoja.getCell(fila, 2), xlFecha(r.fecha), { ...centro, formato: 'dd/mm/yyyy' });
    xlCelda(hoja.getCell(fila, 3), DIAS_CORTOS[diaSemanaISO(r.fecha)], { ...centro, font: xlLetra(9, XL.gris) });
    xlCelda(hoja.getCell(fila, 4), nombreDe(r.miembro, ctx));
    xlCelda(hoja.getCell(fila, 5), horaDe(r.inicio), centro);
    xlCelda(hoja.getCell(fila, 6), horaDe(r.fin), centro);
    xlCelda(hoja.getCell(fila, 7), xlHoras(r.minutos), { ...centro, formato: '0.00' });
    xlCelda(hoja.getCell(fila, 8), ctx.etapasPorId.get(r.etapa)?.nombre || '—');
    xlCelda(hoja.getCell(fila, 9), ctx.trabajosPorId.get(r.trabajo)?.nombre || '—');
    xlCelda(hoja.getCell(fila, 10), t ? `${codigo(t, ctx)} ${t.titulo}` : '—', { wrap: true, font: xlLetra(9) });
    xlCelda(hoja.getCell(fila, 11), r.descripcion || '—', { wrap: true, font: xlLetra(9) });
    xlCelda(hoja.getCell(fila, 12), r.creadoEn ? xlFechaHora(r.creadoEn) : '—', { ...centro, formato: 'dd/mm/yyyy hh:mm', font: xlLetra(9, XL.gris) });
    xlCelda(hoja.getCell(fila, 13), r.creadoPor ? nombreDe(r.creadoPor, ctx) : '—', { font: xlLetra(9, XL.gris) });
    xlCelda(hoja.getCell(fila, 14), obs, { wrap: true, fondo: obs ? XL_ESTADO.atencion.fondo : undefined, font: xlLetra(9, XL_ESTADO.atencion.texto, !!obs) });
    hoja.getRow(fila).height = Math.max(xlAlto(r.descripcion, 48, 14, 20), xlAlto(t ? t.titulo + '0000000' : '', 38, 14, 20), xlAlto(obs, 32, 14, 20));
    fila++;
  }
  if (c.regs.length) {
    hoja.autoFilter = { from: { row: fila0, column: 2 }, to: { row: fila - 1, column: cols.length + 1 } };
    xlCelda(hoja.getCell(fila, 2), 'Total', { fondo: XL.ambarTinte, font: xlLetra(10, XL.noche, true) });
    for (let k = 3; k <= cols.length + 1; k++) xlCelda(hoja.getCell(fila, k), '', { fondo: XL.ambarTinte });
    // SUBTOTAL: si filtran por persona, el total acompaña
    xlCelda(hoja.getCell(fila, 7), { formula: `SUBTOTAL(109,G${fila0 + 1}:G${fila - 1})`, result: c.regs.reduce((a, r) => a + xlHoras(r.minutos), 0) }, { horizontal: 'center', formato: '0.00', fondo: XL.ambarTinte, font: xlLetra(10, XL.noche, true) });
  }
  hoja.views = [{ showGridLines: false, state: 'frozen', ySplit: fila0 }];
}

/* ----- Hoja 5: Criterios ----- */
function xlCriterios(libro, c, logo, subtitulo, derecha) {
  const hoja = libro.addWorksheet('Criterios', { views: [{ showGridLines: false }], properties: { tabColor: { argb: XL.linea } } });
  xlPagina(hoja);
  const cols = [['Control', 34], ['Cómo se calcula', 72], ['Niveles', 44]];
  hoja.getColumn(1).width = 2.5;
  cols.forEach(([, w], i) => { hoja.getColumn(i + 2).width = w; });
  hoja.getColumn(5).width = 2.5;
  let fila = xlBanda(hoja, libro, logo, 4, 'Criterios de cada control', subtitulo, derecha);
  cols.forEach(([t], i) => xlEncabezado(hoja.getCell(fila, i + 2), t));
  hoja.getRow(fila).height = 22; fila++;
  for (const x of c.controles) {
    xlCelda(hoja.getCell(fila, 2), x.nombre, { font: xlLetra(10, XL.noche, true), wrap: true });
    xlCelda(hoja.getCell(fila, 3), x.criterio, { wrap: true });
    xlCelda(hoja.getCell(fila, 4), x.niveles, { wrap: true, font: xlLetra(9, XL.gris) });
    hoja.getRow(fila).height = Math.max(xlAlto(x.nombre, 34, 15, 22), xlAlto(x.criterio, 78, 15, 22), xlAlto(x.niveles, 50, 14, 22));
    fila++;
  }
  fila++;
  xlTitulo(hoja, fila, 2, 4, 'Notas'); fila++;
  [
    `Período: ${c.enCurso ? `mes en curso, los días se miden hasta el ${fechaNum(c.hasta)} (el día de hoy todavía no terminó)` : 'el mes completo'}. Los registros son una foto del momento en que se generó el archivo.`,
    `Se considera nota genérica, además de las reglas de arriba (se compara sin tildes ni signos): ${[...NOTAS_GENERICAS].join(', ')}.`,
    'Reunión: registro con etapa Reunión o con un trabajo del grupo Reuniones.',
    'Las metas de los controles adicionales son una propuesta inicial: el equipo puede ajustarlas.',
  ].forEach(texto => {
    hoja.mergeCells(fila, 2, fila, 4);
    Object.assign(hoja.getCell(fila, 2), { value: texto, font: xlLetra(10, XL.tinta), alignment: { wrapText: true, vertical: 'top' } });
    hoja.getRow(fila).height = xlAlto(texto, 165, 15, 20);
    fila++;
  });
}

async function armarExcelHoras(c, ctx) {
  const ExcelJS = await cargarExcelJS();
  const libro = new ExcelJS.Workbook();
  libro.creator = 'Tablero Finora';
  libro.created = new Date();
  let logo = null;
  try { logo = xlLogo(); } catch (err) { console.warn('El Excel sale sin logo', err); }
  const ahora = new Date();
  const quien = ctx.yo ? ` por ${nombreDe(ctx.yo, ctx)}` : '';
  const subtitulo = `${mesNombre(c.mes)}${c.enCurso ? ` · mes en curso, medido hasta el ${fechaNum(c.hasta)}` : ''}`;
  const derecha = `Generado el ${fechaNum(isoDe(ahora))}${quien}`;
  xlResumen(libro, c, ctx, logo, subtitulo, derecha);
  xlPorIntegrante(libro, c, logo, subtitulo, derecha);
  xlHallazgos(libro, c, logo, subtitulo, derecha);
  xlRegistros(libro, c, ctx, logo, subtitulo, derecha);
  xlCriterios(libro, c, logo, subtitulo, derecha);
  return libro.xlsx.writeBuffer();
}
