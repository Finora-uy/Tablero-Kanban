
/* ===== Nueva tarea ===== */
function ModalNueva({ ctx, inicial = {}, alCerrar, alAbrir }) {
  const [f, setF] = useState({
    titulo: '', tipo: 'tarea', columna: inicial.columna || (ctx.columnas[1] || ctx.columnas[0]).id, prioridad: 'media',
    asignados: [], etiquetas: [], vence: '', hito: '', estimacion: '',
  });
  const [enviando, setEnviando] = useState(false);
  const set = (k, v) => setF(x => ({ ...x, [k]: v }));
  const crear = async abrir => {
    if (!f.titulo.trim() || enviando) return;
    setEnviando(true);
    const r = await acciones.crearTarea(f);
    setEnviando(false);
    if (!r) return;
    avisar(`Creaste ${ctx.prefijo}-${r.numero}.`);
    if (abrir) alAbrir(r.id); else alCerrar();
  };
  const pie = html`<button class="btn btn-fantasma" onClick=${alCerrar}>Cancelar</button>
    <button class="btn" disabled=${!f.titulo.trim() || enviando} onClick=${() => crear(true)}>Crear y abrir</button>
    <button class="btn btn-primario" disabled=${!f.titulo.trim() || enviando} onClick=${() => crear(false)}>Crear tarea</button>`;
  return html`<${Modal} titulo="Nueva tarea" alCerrar=${alCerrar} ancho=${600} pie=${pie}>
    <div class="campo"><label for="nt-titulo">Título</label>
      <input class="entrada" id="nt-titulo" data-foco type="text" placeholder="Ej.: Conectar la planilla de ejemplo y leer los movimientos" value=${f.titulo}
        onInput=${e => set('titulo', e.target.value)} onKeyDown=${e => { if (e.key === 'Enter') { e.preventDefault(); crear(false); } }} /></div>
    <div class="grilla-2">
      <div class="campo"><label for="nt-tipo">Tipo</label><select class="entrada" id="nt-tipo" value=${f.tipo} onChange=${e => set('tipo', e.target.value)}>${TIPOS.map(x => html`<option value=${x.id}>${x.nombre}</option>`)}</select></div>
      <div class="campo"><label for="nt-col">Columna</label><select class="entrada" id="nt-col" value=${f.columna} onChange=${e => set('columna', e.target.value)}>${ctx.columnas.map(c => html`<option value=${c.id}>${c.nombre}</option>`)}</select></div>
      <div class="campo"><label for="nt-prio">Prioridad</label><select class="entrada" id="nt-prio" value=${f.prioridad} onChange=${e => set('prioridad', e.target.value)}>${PRIORIDADES.map(p => html`<option value=${p.id}>${p.nombre}</option>`)}</select></div>
      <div class="campo"><label for="nt-vence">Vence</label><input class="entrada" id="nt-vence" type="date" value=${f.vence} onChange=${e => set('vence', e.target.value)} /></div>
      <div class="campo"><label for="nt-est">Estimación</label><select class="entrada" id="nt-est" value=${f.estimacion} onChange=${e => set('estimacion', e.target.value)}><option value="">Sin estimar</option>${ESTIMACIONES.map(n => html`<option value=${String(n)}>${n} ${n === 1 ? 'punto' : 'puntos'}</option>`)}</select></div>
      <div class="campo"><label for="nt-hito">Hito</label><select class="entrada" id="nt-hito" value=${f.hito} onChange=${e => set('hito', e.target.value)}><option value="">Sin hito</option>${ctx.hitos.map(x => html`<option value=${x.id}>${x.nombre}</option>`)}</select></div>
    </div>
    <div class="campo"><span class="campo-etq">Responsables</span><${ChipsIntegrantes} ctx=${ctx} valor=${f.asignados} alCambiar=${v => set('asignados', v)} /></div>
    <div class="campo"><span class="campo-etq">Etiquetas</span><${ChipsEtiquetas} ctx=${ctx} valor=${f.etiquetas} alCambiar=${v => set('etiquetas', v)} /></div>
  <//>`;
}

/* ===== Sumate al equipo ===== */
function ModalSumate({ ctx, e, alCerrar }) {
  const [nombre, setNombre] = useState('');
  const [rol, setRol] = useState('');
  const usados = new Set(ctx.miembros.map(m => m.color));
  const [color, setColor] = useState(() => (COLORES.find(c => !usados.has(c.id)) || COLORES[0]).id);
  const [enviando, setEnviando] = useState(false);
  const libres = ctx.miembros.filter(m => !m.userId || !e.userId);
  const sumarme = async () => {
    if (!nombre.trim() || enviando) return;
    setEnviando(true);
    const id = await acciones.sumarme({ nombre: nombre.trim(), rol: rol.trim(), color });
    setEnviando(false);
    if (id) alCerrar(false);
  };
  const pie = html`<button class="btn btn-fantasma" onClick=${() => alCerrar(true)}>Solo mirar por ahora</button>
    <button class="btn btn-primario" disabled=${!nombre.trim() || enviando} onClick=${sumarme}>Sumarme al tablero</button>`;
  return html`<${Modal} titulo="Sumate al tablero de Finora" alCerrar=${() => alCerrar(true)} ancho=${540} pie=${pie}>
    <div class="bienvenida-chispa"><${Chispa} t=${44} /><p class="tenue">Así te ve el resto del equipo en las tareas, los comentarios y el resumen. Lo podés cambiar después desde Equipo.</p></div>
    ${libres.length > 0 && html`<div class="campo"><span class="campo-etq">¿Ya te sumaron? Elegí tu nombre</span>
      <div class="lista-miembros">${libres.map(m => html`<button key=${m.id} class="chip-btn" onClick=${async () => { await acciones.soyYo(m.id); avisar(`Hola, ${m.nombre}.`); alCerrar(false); }}><${Avatar} m=${m} t=${22} />${m.nombre}</button>`)}</div>
      <p class="tenue" style="font-size:12.5px">O creá tu perfil:</p></div>`}
    <div class="campo"><label for="su-nombre">Nombre o apodo</label>
      <input class="entrada" id="su-nombre" data-foco type="text" maxlength="40" placeholder="Ej.: Emi" value=${nombre} onInput=${ev => setNombre(ev.target.value)} onKeyDown=${ev => { if (ev.key === 'Enter') sumarme(); }} /></div>
    <div class="campo"><label for="su-rol">Rol en el proyecto</label>
      <input class="entrada" id="su-rol" type="text" list="roles-sugeridos" maxlength="40" placeholder="Ej.: Datos" value=${rol} onInput=${ev => setRol(ev.target.value)} />
      <datalist id="roles-sugeridos">${ROLES.map(r => html`<option value=${r}></option>`)}</datalist></div>
    <div class="campo"><span class="campo-etq">Tu color</span><${Muestras} idBase="su-color" valor=${color} alCambiar=${setColor} /></div>
  <//>`;
}

/* ===== Integrante ===== */
function ModalIntegrante({ ctx, e, id, alCerrar }) {
  const m = id ? ctx.integrantes.get(id) : null;
  const [nombre, setNombre] = useState(m ? m.nombre : '');
  const [rol, setRol] = useState(m ? m.rol || '' : '');
  const [color, setColor] = useState(m ? m.color || 'azul' : 'azul');
  const [confirmar, setConfirmar] = useState(false);
  const esYo = id && id === ctx.yo;
  const guardarlo = async () => {
    if (!nombre.trim()) return;
    const r = await acciones.guardarIntegrante(id, { nombre: nombre.trim(), rol: rol.trim(), color });
    if (r) { avisar(id ? 'Guardaste los cambios.' : `Sumaste a ${nombre.trim()}.`); alCerrar(); }
  };
  const pie = confirmar
    ? html`<div class="confirmar-linea"><span>¿Sacar a ${m.nombre} del equipo? Sus tareas quedan sin esa persona asignada.</span>
        <button class="btn btn-peligro btn-chico" onClick=${async () => { if (await acciones.borrarIntegrante(id)) { avisar(`Sacaste a ${m.nombre}.`); alCerrar(); } }}>Sacar</button>
        <button class="btn btn-fantasma btn-chico" onClick=${() => setConfirmar(false)}>Cancelar</button></div>`
    : html`${id && html`<button class="btn btn-peligro" style="margin-right:auto" onClick=${() => setConfirmar(true)}><${Icono} n="basura" t=${14} />Sacar del equipo</button>`}
      <button class="btn btn-fantasma" onClick=${alCerrar}>Cancelar</button>
      <button class="btn btn-primario" disabled=${!nombre.trim()} onClick=${guardarlo}>${id ? 'Guardar' : 'Sumar'}</button>`;
  return html`<${Modal} titulo=${id ? (esYo ? 'Tu perfil' : 'Editar integrante') : 'Sumar integrante'} alCerrar=${alCerrar} pie=${pie}>
    ${!id && html`<p>Cuando esta persona abra el tablero por primera vez, va a poder elegir su nombre de la lista.</p>`}
    <div class="campo"><label for="in-nombre">Nombre o apodo</label><input class="entrada" id="in-nombre" data-foco type="text" maxlength="40" value=${nombre} onInput=${ev => setNombre(ev.target.value)} /></div>
    <div class="campo"><label for="in-rol">Rol</label><input class="entrada" id="in-rol" type="text" list="roles-sugeridos-2" maxlength="40" value=${rol} onInput=${ev => setRol(ev.target.value)} />
      <datalist id="roles-sugeridos-2">${ROLES.map(r => html`<option value=${r}></option>`)}</datalist></div>
    <div class="campo"><span class="campo-etq">Color</span><${Muestras} idBase="in-color" valor=${color} alCambiar=${setColor} /></div>
    ${id && m && m.userId && e.userId && m.userId === e.userId && html`<p class="tenue" style="font-size:12.5px">Este perfil está vinculado a tu cuenta, así que te reconoce en cualquier dispositivo.</p>`}
  <//>`;
}

/* ===== Hito ===== */
function ModalHito({ ctx, id, alCerrar }) {
  const x = id ? ctx.hitosPorId.get(id) : null;
  const [f, setF] = useState({ nombre: x?.nombre || '', tipo: x?.tipo || 'entrega', inicio: x?.inicio || '', fin: x?.fin || '', objetivo: x?.objetivo || '' });
  const [confirmar, setConfirmar] = useState(false);
  const set = (k, v) => setF(s => ({ ...s, [k]: v }));
  const valido = f.nombre.trim() && f.fin && (!f.inicio || f.inicio <= f.fin);
  const guardarlo = async () => {
    if (!valido) return;
    const ok = await acciones.guardarHito(id, { nombre: f.nombre.trim(), tipo: f.tipo, inicio: f.inicio || null, fin: f.fin, objetivo: f.objetivo.trim() });
    if (ok) { avisar(id ? 'Guardaste el hito.' : `Creaste el hito ${f.nombre.trim()}.`); alCerrar(); }
  };
  const pie = confirmar
    ? html`<div class="confirmar-linea"><span>¿Eliminar el hito? Sus tareas quedan sin hito.</span>
        <button class="btn btn-peligro btn-chico" onClick=${async () => { if (await acciones.borrarHito(id)) { avisar('Eliminaste el hito.'); alCerrar(); } }}>Eliminar</button>
        <button class="btn btn-fantasma btn-chico" onClick=${() => setConfirmar(false)}>Cancelar</button></div>`
    : html`${id && html`<button class="btn btn-peligro" style="margin-right:auto" onClick=${() => setConfirmar(true)}><${Icono} n="basura" t=${14} />Eliminar</button>`}
      <button class="btn btn-fantasma" onClick=${alCerrar}>Cancelar</button>
      <button class="btn btn-primario" disabled=${!valido} onClick=${guardarlo}>${id ? 'Guardar' : 'Crear hito'}</button>`;
  return html`<${Modal} titulo=${id ? 'Editar hito' : 'Nuevo hito'} alCerrar=${alCerrar} pie=${pie}>
    <div class="campo"><label for="hi-nombre">Nombre</label><input class="entrada" id="hi-nombre" data-foco type="text" maxlength="60" placeholder="Ej.: Entrega 1 · Anteproyecto" value=${f.nombre} onInput=${e => set('nombre', e.target.value)} /></div>
    <div class="grilla-2">
      <div class="campo"><label for="hi-tipo">Tipo</label><select class="entrada" id="hi-tipo" value=${f.tipo} onChange=${e => set('tipo', e.target.value)}>${TIPOS_HITO.map(t => html`<option value=${t.id}>${t.nombre}</option>`)}</select></div>
      <div class="campo"><label for="hi-inicio">Empieza (opcional)</label><input class="entrada" id="hi-inicio" type="date" value=${f.inicio} onChange=${e => set('inicio', e.target.value)} /></div>
      <div class="campo"><label for="hi-fin">Fecha de entrega o cierre</label><input class="entrada" id="hi-fin" type="date" value=${f.fin} onChange=${e => set('fin', e.target.value)} /></div>
    </div>
    ${f.inicio && f.fin && f.inicio > f.fin && html`<p style="color:var(--red-text)">El inicio tiene que ser antes del cierre.</p>`}
    <div class="campo"><label for="hi-obj">Objetivo</label><textarea class="entrada" id="hi-obj" rows="3" placeholder="Qué tiene que estar listo para esa fecha" value=${f.objetivo} onInput=${e => set('objetivo', e.target.value)}></textarea></div>
  <//>`;
}

/* ===== Ajustes ===== */
function ModalAjustes({ ctx, alCerrar, seccionInicial = 'columnas' }) {
  const [sec, setSec] = useState(seccionInicial);
  const [cfg, setCfg] = useState(() => copiaProfunda(ctx.config));
  const [guardando, setGuardando] = useState(false);
  const cambiado = JSON.stringify(cfg) !== JSON.stringify(ctx.config);
  const setCol = (i, cambios) => setCfg(c => ({ ...c, columnas: c.columnas.map((x, j) => j === i ? { ...x, ...cambios } : x) }));
  const setEtq = (i, cambios) => setCfg(c => ({ ...c, etiquetas: c.etiquetas.map((x, j) => j === i ? { ...x, ...cambios } : x) }));
  const moverCol = (i, d) => setCfg(c => { const l = [...c.columnas]; const j = i + d; if (j < 0 || j >= l.length) return c; [l[i], l[j]] = [l[j], l[i]]; return { ...c, columnas: l }; });
  const cuantas = colId => ctx.tareas.filter(t => t.columna === colId).length;
  const guardarlo = async () => {
    const limpia = {
      ...cfg,
      prefijo: (cfg.prefijo || 'FIN').replace(/[^A-Za-z0-9]/g, '').toUpperCase().slice(0, 6) || 'FIN',
      columnas: cfg.columnas.map(c => ({ ...c, nombre: c.nombre.trim() || 'Sin nombre', limiteWip: Math.max(0, parseInt(c.limiteWip, 10) || 0) })),
      etiquetas: cfg.etiquetas.map(x => ({ ...x, nombre: x.nombre.trim() || 'Etiqueta' })),
    };
    if (!limpia.columnas.some(c => c.final)) limpia.columnas[limpia.columnas.length - 1].final = true;
    setGuardando(true);
    const ok = await acciones.guardarConfig(limpia);
    setGuardando(false);
    if (ok) { avisar('Guardaste los ajustes del tablero.'); alCerrar(); }
  };
  const pie = sec === 'respaldo' ? html`<button class="btn" onClick=${alCerrar}>Cerrar</button>`
    : html`<button class="btn btn-fantasma" onClick=${alCerrar}>Cancelar</button><button class="btn btn-primario" disabled=${!cambiado || guardando} onClick=${guardarlo}>Guardar cambios</button>`;
  return html`<${Modal} titulo="Ajustes del tablero" alCerrar=${alCerrar} ancho=${640} pie=${pie}>
    <div class="subpestanas" role="group" aria-label="Secciones">
      ${[['columnas', 'Columnas'], ['etiquetas', 'Etiquetas'], ['general', 'General'], ['respaldo', 'Respaldo']].map(([k, n]) => html`<button key=${k} aria-pressed=${sec === k} onClick=${() => setSec(k)}>${n}</button>`)}
    </div>
    ${sec === 'columnas' && html`<p>El límite de trabajo en curso (WIP) avisa cuando una columna se llena. Poné 0 para no tener límite. La columna final es la que cuenta como hecha.</p>
      ${cfg.columnas.map((c, i) => html`<div class="fila-col" key=${c.id}>
        <input class="entrada" id=${'cfg-col-' + c.id} type="text" aria-label="Nombre de la columna" value=${c.nombre} onInput=${e => setCol(i, { nombre: e.target.value })} />
        <input class="entrada mono" id=${'cfg-wip-' + c.id} type="number" min="0" max="99" aria-label="Límite WIP" title="Límite WIP" value=${c.limiteWip || 0} onInput=${e => setCol(i, { limiteWip: e.target.value })} />
        <label class="final"><input type="radio" name="col-final" id=${'cfg-fin-' + c.id} checked=${!!c.final} onChange=${() => setCfg(s => ({ ...s, columnas: s.columnas.map((x, j) => ({ ...x, final: j === i })) }))} />Final</label>
        <span class="fila" style="gap:2px;flex-wrap:nowrap">
          <button class="btn-icono chico" aria-label="Mover a la izquierda" title="Mover a la izquierda" disabled=${i === 0} onClick=${() => moverCol(i, -1)}><${Icono} n="izq" t=${14} /></button>
          <button class="btn-icono chico" aria-label="Mover a la derecha" title="Mover a la derecha" disabled=${i === cfg.columnas.length - 1} onClick=${() => moverCol(i, 1)}><${Icono} n="der" t=${14} /></button>
          <button class="btn-icono chico" aria-label=${'Borrar ' + c.nombre} disabled=${cfg.columnas.length <= 1}
            onClick=${() => { const n = cuantas(c.id); if (n) { avisar(`${c.nombre} tiene ${n} tarea${n === 1 ? '' : 's'}. Movelas o eliminalas antes de borrar la columna.`, 'error'); return; } setCfg(s => ({ ...s, columnas: s.columnas.filter((_, j) => j !== i) })); }}><${Icono} n="basura" t=${14} /></button>
        </span>
      </div>`)}
      <div><button class="btn btn-chico" onClick=${() => setCfg(s => ({ ...s, columnas: [...s.columnas, { id: 'col-' + uid().slice(0, 8), nombre: 'Nueva columna', limiteWip: 0 }] }))}><${Icono} n="mas" t=${14} />Agregar columna</button></div>`}
    ${sec === 'etiquetas' && html`<p>Las etiquetas agrupan tareas por área. Borrar una la saca del filtro, pero no toca las tareas.</p>
      ${cfg.etiquetas.map((x, i) => html`<div class="fila-edit" key=${x.id}>
        <div class="fila" style="flex-wrap:nowrap">
          <select class="entrada" id=${'cfg-etc-' + x.id} style="width:auto" aria-label="Color" value=${x.color} onChange=${e => setEtq(i, { color: e.target.value })}>${COLORES.map(c => html`<option value=${c.id}>${c.nombre}</option>`)}</select>
          <span class="chip sin-punto" style=${`--c:var(--c-${x.color});width:14px;padding:0;height:14px;border-radius:50%;background:var(--c-${x.color})`} aria-hidden="true"></span>
          <input class="entrada" id=${'cfg-etq-' + x.id} type="text" aria-label="Nombre de la etiqueta" value=${x.nombre} onInput=${e => setEtq(i, { nombre: e.target.value })} />
        </div>
        <button class="btn-icono chico" aria-label=${'Borrar ' + x.nombre} onClick=${() => setCfg(s => ({ ...s, etiquetas: s.etiquetas.filter((_, j) => j !== i) }))}><${Icono} n="basura" t=${14} /></button>
      </div>`)}
      <div><button class="btn btn-chico" onClick=${() => setCfg(s => ({ ...s, etiquetas: [...s.etiquetas, { id: 'et-' + uid().slice(0, 8), nombre: 'Nueva etiqueta', color: COLORES[s.etiquetas.length % COLORES.length].id }] }))}><${Icono} n="mas" t=${14} />Agregar etiqueta</button></div>`}
    ${sec === 'general' && html`<div class="campo"><label for="cfg-prefijo">Prefijo de los códigos</label>
      <input class="entrada mono" id="cfg-prefijo" type="text" maxlength="6" style="max-width:160px" value=${cfg.prefijo} onInput=${e => setCfg(s => ({ ...s, prefijo: e.target.value }))} />
      <p class="tenue" style="font-size:12.5px">Las tareas se numeran solas: ${((cfg.prefijo || 'FIN').replace(/[^A-Za-z0-9]/g, '').toUpperCase() || 'FIN')}-1, ${((cfg.prefijo || 'FIN').replace(/[^A-Za-z0-9]/g, '').toUpperCase() || 'FIN')}-2… Sirve para nombrarlas en el chat del grupo.</p></div>`}
    ${sec === 'respaldo' && html`<${Respaldo} ctx=${ctx} />`}
  <//>`;
}

function Respaldo({ ctx }) {
  const [ops, setOps] = useState(null);
  const [error, setError] = useState('');
  const [progreso, setProgreso] = useState(null);
  const leerArchivo = ev => {
    const f = ev.target.files && ev.target.files[0];
    ev.target.value = '';
    if (!f) return;
    const r = new FileReader();
    r.onload = () => {
      try { setOps(validarRespaldo(JSON.parse(r.result))); setError(''); }
      catch (err) { setOps(null); setError(err.message && err.message.startsWith('El archivo') ? err.message : 'No se pudo leer el archivo. Tiene que ser un .json exportado desde este tablero.'); }
    };
    r.readAsText(f);
  };
  const contar = pref => ops.filter(o => o[0].startsWith(pref)).length;
  const importar = async () => {
    setProgreso({ hechos: 0, total: ops.length });
    try {
      await importarRespaldo(ops, (hechos, total) => setProgreso({ hechos, total }));
      avisar('Importaste el respaldo.'); setOps(null);
    } catch (err) {
      console.error(err); avisar('La importación se cortó. Lo que ya se importó quedó guardado; podés volver a intentarlo.', 'error');
    }
    setProgreso(null);
  };
  return html`<div class="campo"><span class="campo-etq">Exportar</span>
      <p class="tenue">Bajá una copia completa (tareas, equipo, hitos y comentarios) o una planilla de tareas para Excel.</p>
      ${puedeDescargar() ? html`<div class="fila">
        <button class="btn" onClick=${() => guardarArchivo(`tablero-finora-${hoyISO()}.json`, respaldoJSON(), 'application/json')}><${Icono} n="descargar" t=${15} />Respaldo completo (.json)</button>
        <button class="btn" onClick=${() => guardarArchivo(`tareas-finora-${hoyISO()}.csv`, tareasCSV(ctx), 'text/csv')}><${Icono} n="descargar" t=${15} />Tareas (.csv)</button>
      </div>` : html`<p class="tenue">Descargar archivos no está disponible en esta vista.</p>`}
    </div>
    <div class="campo"><label for="imp-archivo">Importar un respaldo</label>
      <p class="tenue">Agrega lo que tenga el archivo. Si algo ya existe con el mismo identificador, se reemplaza; no se borra nada más.</p>
      <input class="entrada" id="imp-archivo" type="file" accept=".json,application/json" onChange=${leerArchivo} disabled=${!!progreso} />
      ${error && html`<p style="color:var(--red-text)">${error}</p>`}
      ${ops && !progreso && html`<div class="confirmar-linea" style="background:var(--blue-tint)">
        <span>Vas a importar ${contar('tareas/')} tareas, ${contar('integrantes/')} integrantes, ${contar('hitos/')} hitos y ${contar('comentarios/')} comentarios${ops.some(o => o[0] === 'tablero/config') ? ', más los ajustes' : ''}.</span>
        <button class="btn btn-primario btn-chico" onClick=${importar}>Importar</button>
        <button class="btn btn-fantasma btn-chico" onClick=${() => setOps(null)}>Cancelar</button></div>`}
      ${progreso && html`<div class="barra-progreso" role="progressbar" aria-valuenow=${progreso.hechos} aria-valuemax=${progreso.total}><div style=${`width:${progreso.hechos / progreso.total * 100}%`}></div></div>
        <p class="tenue mono">${progreso.hechos} de ${progreso.total}</p>`}
    </div>`;
}

/* ===== Ayuda ===== */
function ModalAyuda({ alCerrar }) {
  const atajos = [
    ['N', 'Nueva tarea'], ['/', 'Buscar'], ['M', 'Mostrar solo mis tareas'], ['1 … 7', 'Cambiar de vista'],
    ['Alt + ← →', 'Mover la tarjeta enfocada de columna'], ['Alt + ↑ ↓', 'Subir o bajar la tarjeta enfocada'],
    ['Enter', 'Abrir la tarjeta enfocada'], ['Esc', 'Cerrar'], ['?', 'Esta ayuda'],
  ];
  return html`<${Modal} titulo="Cómo se usa" alCerrar=${alCerrar} ancho=${560} pie=${html`<button class="btn btn-primario" onClick=${alCerrar}>Entendido</button>`}>
    <p>Arrastrá las tarjetas entre columnas para cambiar su estado. En el celular, mantené apretada la tarjeta un momento y después arrastrala. Todo lo que cambia se guarda solo y lo ve el resto del equipo al instante.</p>
    <div class="atajos">${atajos.map(([k, d]) => html`<kbd key=${k}>${k}</kbd><span>${d}</span>`)}</div>
    <p>Los criterios de aceptación sirven para los requerimientos: la tarea está lista cuando todos están tildados. Una tarea que depende de otra sin terminar aparece como bloqueada.</p>
  <//>`;
}
