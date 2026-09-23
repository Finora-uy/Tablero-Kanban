
/* ===== Cabecera y barra de filtros ===== */
function Cabecera({ ctx, e, vista, setVista, editable, alModal, alCambiarYo }) {
  const yoM = ctx.yo ? ctx.integrantes.get(ctx.yo) : null;
  const otros = ctx.enLinea;
  return html`<header class="cabecera">
    <div class="cab-fila">
      <div class="marca">
        <${Chispa} t=${34} />
        <div><h1>Tablero del equipo</h1><div class="etiqueta-mono">Finora · Proyecto final · ORT Uruguay</div></div>
      </div>
      <div class="cab-acciones">
        ${otros.length > 0 && html`<div class="en-linea" title=${otros.map(x => nombreDe(x.id, ctx) + (x.esYo ? ' (vos)' : '')).join(', ')}>
          <span class="punto-vivo" aria-hidden="true"></span><span class="texto">En línea</span>
          <span class="avatares">${otros.slice(0, 5).map(x => html`<${Avatar} key=${x.id} m=${ctx.integrantes.get(x.id)} t=${26} titulo=${nombreDe(x.id, ctx) + (x.esYo ? ' (vos)' : '')} />`)}</span>
        </div>`}
        <${Desplegable} clase="boton-yo" alinear="der" titulo="Tu perfil y opciones" etiqueta=${yoM
          ? html`<${Avatar} m=${yoM} t=${26} /><span class="nombre">${yoM.nombre}</span><span class="caret">▾</span>`
          : html`<span class="avatar" style="width:26px;height:26px;--av:var(--line-2);color:var(--text)"><${Icono} n="usuario" t=${14} /></span><span class="nombre">Invitado</span><span class="caret">▾</span>`}>
          ${cerrar => html`
            ${yoM && html`<button class="menu-item" onClick=${() => { cerrar(); alModal({ tipo: 'integrante', id: yoM.id }); }}><${Icono} n="usuario" />Editar mi perfil</button>`}
            ${editable && html`<button class="menu-item" onClick=${() => { cerrar(); alCambiarYo(); }}><${Icono} n="cambiar" />${yoM ? 'No soy yo / cambiar de perfil' : 'Sumarme al tablero'}</button>`}
            <button class="menu-item" onClick=${() => { cerrar(); alModal({ tipo: 'ajustes' }); }}><${Icono} n="ajustes" />Ajustes del tablero</button>
            <button class="menu-item" onClick=${() => { cerrar(); alModal({ tipo: 'ajustes', seccion: 'respaldo' }); }}><${Icono} n="descargar" />Exportar o importar</button>
            <button class="menu-item" onClick=${() => { cerrar(); alModal({ tipo: 'ayuda' }); }}><${Icono} n="teclado" />Atajos y ayuda</button>
            ${extensiones.cuenta && html`<div class="menu-cuenta"><span class="tenue">Conectado como</span><span class="menu-email">${extensiones.cuenta.email}</span></div>
              <button class="menu-item" onClick=${() => { cerrar(); extensiones.cuenta.cerrarSesion(); }}><${Icono} n="salir" />Cerrar sesión</button>`}`}
        <//>
      </div>
    </div>
    <nav class="pestanas" aria-label="Vistas">
      ${VISTAS.map((v, i) => html`<button key=${v.id} class="pestana" aria-current=${vista === v.id ? 'page' : null} title=${`${v.nombre} (${i + 1})`} onClick=${() => setVista(v.id)}>${v.nombre}</button>`)}
    </nav>
  </header>`;
}

function BarraFiltros({ ctx, filtros, setFiltros, vista, carril, setCarril, editable, buscarRef, alNueva }) {
  const [abiertos, setAbiertos] = useState(false);
  const n = cuantosFiltros(filtros);
  const set = cambios => setFiltros({ ...filtros, ...cambios });
  const toggle = (k, nombre) => html`<button class="btn-filtro" aria-pressed=${!!filtros[k]} onClick=${() => set({ [k]: !filtros[k] })}>${nombre}</button>`;
  const hitoSel = filtros.hito ? (filtros.hito === 'sin' ? 'Sin hito' : ctx.hitosPorId.get(filtros.hito)?.nombre || 'Hito') : 'Hito';
  return html`<div class="barra" role="search">
    <div class="buscador">
      <${Icono} n="buscar" />
      <input class="entrada" id="buscar" ref=${buscarRef} type="search" placeholder="Buscar tareas" aria-label="Buscar tareas" value=${filtros.q}
        onInput=${e => set({ q: e.target.value })} onKeyDown=${e => { if (e.key === 'Escape') { e.stopPropagation(); if (filtros.q) set({ q: '' }); else e.target.blur(); } }} />
      ${!filtros.q && html`<kbd aria-hidden="true">/</kbd>`}
    </div>
    <button class="btn-filtro solo-movil" aria-expanded=${abiertos} onClick=${() => setAbiertos(!abiertos)}><${Icono} n="filtro" t=${15} />Filtros${n > 0 && html` <span class="cuenta">${n}</span>`}</button>
    <div class=${'filtros' + (abiertos ? ' abiertos' : '')}>
      ${toggle('mias', 'Mis tareas')}
      <${FiltroMulti} nombre="Responsable" idBase="f-int" valor=${filtros.integrantes} alCambiar=${v => set({ integrantes: v })}
        opciones=${[...ctx.miembros.map(m => ({ id: m.id, nombre: m.nombre, pre: html`<${Avatar} m=${m} t=${20} />` })), { id: 'sin', nombre: 'Sin asignar' }]} />
      <${FiltroMulti} nombre="Etiqueta" idBase="f-etq" valor=${filtros.etiquetas} alCambiar=${v => set({ etiquetas: v })}
        opciones=${ctx.etiquetas.map(x => ({ id: x.id, nombre: x.nombre, pre: html`<span class="chip sin-punto" style=${`width:10px;height:10px;padding:0;border-radius:50%;background:var(--c-${x.color})`}></span>` }))} />
      <${FiltroMulti} nombre="Prioridad" idBase="f-pri" valor=${filtros.prioridades} alCambiar=${v => set({ prioridades: v })} opciones=${PRIORIDADES} />
      <${FiltroMulti} nombre="Tipo" idBase="f-tip" valor=${filtros.tipos} alCambiar=${v => set({ tipos: v })} opciones=${TIPOS} />
      <${Desplegable} activo=${!!filtros.hito} etiqueta=${html`${hitoSel} <span class="caret">▾</span>`}>
        ${cerrar => html`
          <button class="menu-item" onClick=${() => { set({ hito: '' }); cerrar(); }}>Todos los hitos</button>
          <button class="menu-item" onClick=${() => { set({ hito: 'sin' }); cerrar(); }}>Sin hito</button>
          ${ctx.hitos.map(x => html`<button key=${x.id} class="menu-item" onClick=${() => { set({ hito: x.id }); cerrar(); }}><${Icono} n="bandera" />${x.nombre}</button>`)}`}
      <//>
      ${toggle('vencidas', 'Vencidas')}
      ${toggle('bloqueadas', 'Bloqueadas')}
      ${toggle('archivadas', 'Archivadas')}
      ${n > 0 && html`<button class="btn-link" onClick=${() => setFiltros({ ...FILTROS_VACIOS, q: filtros.q })}>Limpiar filtros</button>`}
      ${vista === 'tablero' && html`<span class="barra-sep" aria-hidden="true"></span>
        <label class="oculto-visual" for="carriles">Carriles</label>
        <select class="entrada" id="carriles" style="width:auto;height:34px;min-height:34px;padding-block:4px" value=${carril} onChange=${e => setCarril(e.target.value)}>
          ${CARRILES.map(c => html`<option value=${c.id}>${c.nombre}</option>`)}
        </select>`}
    </div>
    ${editable && html`<div class="barra-fin"><button class="btn btn-primario" onClick=${() => alNueva({})} title="Nueva tarea (N)"><${Icono} n="mas" />Nueva tarea</button></div>`}
  </div>`;
}

/* ===== Tooltip para los gráficos ===== */
function useTooltips(ref) {
  useEffect(() => {
    const tip = ref.current;
    if (!tip) return;
    const mostrar = el => {
      tip.textContent = el.getAttribute('data-tip');
      tip.hidden = false;
      const r = el.getBoundingClientRect(), tr = tip.getBoundingClientRect();
      const x = Math.min(window.innerWidth - tr.width - 8, Math.max(8, r.left + r.width / 2 - tr.width / 2));
      const y = r.top - tr.height - 8 < 8 ? r.bottom + 8 : r.top - tr.height - 8;
      tip.style.left = x + 'px'; tip.style.top = y + 'px';
    };
    const sobre = ev => { const el = ev.target.closest && ev.target.closest('[data-tip]'); if (el) mostrar(el); };
    const fuera = ev => { const el = ev.target.closest && ev.target.closest('[data-tip]'); if (el && !el.contains(ev.relatedTarget)) tip.hidden = true; };
    document.addEventListener('pointerover', sobre);
    document.addEventListener('pointerout', fuera);
    document.addEventListener('focusin', sobre);
    document.addEventListener('focusout', fuera);
    const ocultar = () => { tip.hidden = true; };
    window.addEventListener('scroll', ocultar, true);
    return () => {
      document.removeEventListener('pointerover', sobre); document.removeEventListener('pointerout', fuera);
      document.removeEventListener('focusin', sobre); document.removeEventListener('focusout', fuera);
      window.removeEventListener('scroll', ocultar, true);
    };
  }, []);
}

/* ===== App ===== */
function App() {
  const e = useEstado();
  const [vista, setVistaS] = useState(() => { const v = leer('finora-vista'); return VISTAS.some(x => x.id === v) ? v : 'tablero'; });
  const [filtros, setFiltrosS] = useState(cargarFiltros);
  const [carril, setCarrilS] = useState(() => { const c = leer('finora-carril'); return CARRILES.some(x => x.id === c) ? c : 'ninguno'; });
  const [abierta, setAbierta] = useState(null);
  const [modal, setModal] = useState(null);
  const [soloMirar, setSoloMirar] = useState(() => leerSesion('finora-solo-mirar') === '1');
  const [forzarSumate, setForzarSumate] = useState(false);
  const buscarRef = useRef(null);
  const tipRef = useRef(null);
  useTooltips(tipRef);

  const setVista = v => { setVistaS(v); guardar('finora-vista', v); };
  const setFiltros = f => { setFiltrosS(f); guardar('finora-filtros', JSON.stringify({ ...f, q: '' })); };
  const setCarril = c => { setCarrilS(c); guardar('finora-carril', c); };

  const ctx = armarContexto(e);
  const listo = e.modo !== 'cargando' && e.cargado.tareas && e.cargado.integrantes && e.cargado.config;
  const editable = listo && (e.modo === 'local' || e.puedeEscribir !== false) && !e.errorConexion;
  const mostrarSumate = listo && editable && !modal && (forzarSumate || (!ctx.yo && !soloMirar));

  useEffect(() => {
    publicarPresencia({ m: ctx.yo || null, t: abierta || null, v: vista });
  }, [ctx.yo, abierta, vista]);

  const alNueva = inicial => setModal({ tipo: 'nueva', inicial });
  const filtrarPor = cambios => { setFiltros({ ...FILTROS_VACIOS, ...cambios }); setVista('tablero'); };
  const cerrarSumate = mirar => {
    setForzarSumate(false);
    if (mirar) { setSoloMirar(true); guardarSesion('finora-solo-mirar', '1'); }
  };
  const cambiarYo = async () => { await acciones.dejarDeSerYo(); setSoloMirar(false); setForzarSumate(true); };

  const teclas = useRef();
  teclas.current = ev => {
    const tag = ev.target && ev.target.tagName;
    const escribiendo = /^(INPUT|TEXTAREA|SELECT)$/.test(tag) || (ev.target && ev.target.isContentEditable);
    if (ev.key === 'Escape') {
      if (modal) { setModal(null); return; }
      if (mostrarSumate) { cerrarSumate(true); return; }
      if (abierta) { setAbierta(null); return; }
      if (escribiendo) ev.target.blur();
      return;
    }
    if (escribiendo || ev.ctrlKey || ev.metaKey || ev.altKey || modal || mostrarSumate) return;
    const k = ev.key;
    if ((k === 'n' || k === 'N') && editable) { ev.preventDefault(); alNueva({}); }
    else if (k === '/') {
      ev.preventDefault();
      if (!['tablero', 'lista', 'calendario'].includes(vista)) setVista('tablero');
      setAbierta(null);
      setTimeout(() => buscarRef.current && buscarRef.current.focus(), 0);
    }
    else if (k === '?') setModal({ tipo: 'ayuda' });
    else if (k === 'm' || k === 'M') setFiltros({ ...filtros, mias: !filtros.mias });
    else if (/^[1-7]$/.test(k)) setVista(VISTAS[Number(k) - 1].id);
  };
  useEffect(() => {
    const f = ev => teclas.current(ev);
    window.addEventListener('keydown', f);
    return () => window.removeEventListener('keydown', f);
  }, []);

  const conFiltros = ['tablero', 'lista', 'calendario'].includes(vista);
  const tareasFiltradas = filtrar(ctx.tareas, filtros, ctx);
  const hayFiltros = cuantosFiltros(filtros) > 0 || !!filtros.q;
  const limpiarFiltros = () => setFiltros({ ...FILTROS_VACIOS });
  const sinTareas = !ctx.tareas.some(t => !t.archivada);

  let cuerpo;
  if (!listo) {
    cuerpo = html`<div class="cargando"><${Chispa} t=${48} /><p>Conectando con el tablero…</p></div>`;
  } else if (vista === 'tablero') {
    cuerpo = html`<div class="tablero-envoltura">
      ${sinTareas && !filtros.archivadas && html`<div class="aviso-vacio"><${Chispa} t=${28} /><p><strong>Todavía no hay tareas.</strong> ${editable ? 'Creá la primera con N o con el botón Nueva tarea, o escribila directo en una columna.' : 'Cuando el equipo cargue tareas, van a aparecer acá.'}</p></div>`}
      ${!sinTareas && hayFiltros && !tareasFiltradas.length && html`<div class="aviso-vacio"><p>Ninguna tarea coincide con los filtros.</p><button class="btn btn-chico" onClick=${limpiarFiltros}>Limpiar filtros</button></div>`}
      <${Tablero} ctx=${ctx} tareas=${tareasFiltradas} carril=${carril} editable=${editable && !filtros.archivadas} alAbrir=${setAbierta} alNueva=${alNueva} />
    </div>`;
  } else if (vista === 'lista') {
    cuerpo = html`<${VistaLista} ctx=${ctx} tareas=${tareasFiltradas} alAbrir=${setAbierta} hayFiltros=${hayFiltros} alLimpiar=${limpiarFiltros} />`;
  } else if (vista === 'calendario') {
    cuerpo = html`<${VistaCalendario} ctx=${ctx} tareas=${tareasFiltradas} alAbrir=${setAbierta} />`;
  } else if (vista === 'hitos') {
    cuerpo = html`<${VistaHitos} ctx=${ctx} editable=${editable} alEditar=${id => setModal({ tipo: 'hito', id })} alVerTareas=${id => filtrarPor({ hito: id })} />`;
  } else if (vista === 'resumen') {
    cuerpo = html`<${VistaResumen} ctx=${ctx} alAbrir=${setAbierta} alFiltrar=${filtrarPor} />`;
  } else if (vista === 'equipo') {
    cuerpo = html`<${VistaEquipo} ctx=${ctx} e=${e} editable=${editable} alEditar=${id => setModal({ tipo: 'integrante', id })} alVerTareas=${id => filtrarPor({ integrantes: [id] })} alSoyYo=${() => { setSoloMirar(false); setForzarSumate(true); }} />`;
  } else {
    cuerpo = html`<${VistaActividad} ctx=${ctx} alAbrir=${setAbierta} />`;
  }

  let ventana = null;
  if (modal) {
    const cerrar = () => setModal(null);
    if (modal.tipo === 'nueva') ventana = html`<${ModalNueva} ctx=${ctx} inicial=${modal.inicial} alCerrar=${cerrar} alAbrir=${id => { setModal(null); setAbierta(id); }} />`;
    else if (modal.tipo === 'integrante') ventana = html`<${ModalIntegrante} ctx=${ctx} e=${e} id=${modal.id} alCerrar=${cerrar} />`;
    else if (modal.tipo === 'hito') ventana = html`<${ModalHito} ctx=${ctx} id=${modal.id} alCerrar=${cerrar} />`;
    else if (modal.tipo === 'ajustes') ventana = html`<${ModalAjustes} ctx=${ctx} alCerrar=${cerrar} seccionInicial=${modal.seccion} />`;
    else if (modal.tipo === 'ayuda') ventana = html`<${ModalAyuda} alCerrar=${cerrar} />`;
  }

  return html`<div class="app">
    <${Cabecera} ctx=${ctx} e=${e} vista=${vista} setVista=${setVista} editable=${editable} alModal=${setModal} alCambiarYo=${cambiarYo} />
    <div class="avisos-fijos">
      ${e.modo === 'local' && html`<div class="banner alerta"><${Icono} n="archivo" /><span><strong>Modo local.</strong> Los cambios se guardan solo en este navegador y no los ve nadie más. ${extensiones.plataforma === 'web' ? 'Conectá la base de datos (ver LEEME.md) para trabajar en equipo.' : 'Abrí el tablero desde Claude para trabajar en equipo.'}</span></div>`}
      ${e.modo === 'nube' && e.puedeEscribir === false && html`<div class="banner"><${Icono} n="ojo" /><span><strong>Solo lectura.</strong> Para editar, pedile a quien creó el tablero que te invite con permiso de edición.</span></div>`}
      ${e.errorConexion && html`<div class="banner error"><${Icono} n="candado" /><span><strong>Se perdió la conexión con el tablero.</strong> Recargá la página para seguir.</span></div>`}
    </div>
    ${listo && conFiltros && html`<${BarraFiltros} ctx=${ctx} filtros=${filtros} setFiltros=${setFiltros} vista=${vista} carril=${carril} setCarril=${setCarril} editable=${editable} buscarRef=${buscarRef} alNueva=${alNueva} />`}
    <main class=${'principal v-' + vista}>${cuerpo}</main>
    ${abierta && html`<${Detalle} id=${abierta} ctx=${ctx} editable=${editable} alCerrar=${() => setAbierta(null)} alAbrir=${setAbierta} />`}
    ${ventana}
    ${mostrarSumate && html`<${ModalSumate} ctx=${ctx} e=${e} alCerrar=${cerrarSumate} />`}
    <${Avisos} avisos=${e.avisos} />
    <div class="tip" ref=${tipRef} role="tooltip" hidden></div>
  </div>`;
}

function Raiz() {
  const [error, reintentar] = useErrorBoundary(err => console.error(err));
  if (error) return html`<div class="fallo"><h2>Algo falló al mostrar el tablero</h2><p class="tenue">Tus datos están a salvo. Probá de nuevo; si sigue pasando, recargá la página.</p><button class="btn btn-primario" onClick=${reintentar}>Reintentar</button></div>`;
  return html`<${App} />`;
}
