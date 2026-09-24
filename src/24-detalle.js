
/* ===== Detalle de una tarea (panel lateral) ===== */
function Detalle({ id, ctx, editable, alCerrar, alAbrir }) {
  const t = ctx.porId.get(id);
  if (!t) {
    return html`<div class="velo" onClick=${alCerrar}></div>
      <aside class="detalle" role="dialog" aria-label="Tarea">
        <div class="detalle-cab"><span class="espacio"></span><button class="btn-icono" onClick=${alCerrar} aria-label="Cerrar"><${Icono} n="cerrar" /></button></div>
        <div class="detalle-cuerpo"><p class="tenue">Esta tarea ya no existe. Puede que alguien del equipo la haya eliminado.</p></div>
      </aside>`;
  }
  return html`<div class="velo" onClick=${alCerrar}></div><${DetalleTarea} key=${id} t=${t} ctx=${ctx} editable=${editable} alCerrar=${alCerrar} alAbrir=${alAbrir} />`;
}

function DetalleTarea({ t, ctx, editable, alCerrar, alAbrir }) {
  const id = t.id;
  const act = (cambios, que) => acciones.actualizarTarea(id, cambios, que);
  const [confirmar, setConfirmar] = useState(false);
  const panelRef = useRef(null);
  const tituloRef = useRef(null);
  const descRef = useRef(null);
  const titulo = useBorrador(t.titulo, v => { const x = v.trim(); if (x && x !== t.titulo) act({ titulo: x }); });
  const desc = useBorrador(t.descripcion || '', v => { if (v !== (t.descripcion || '')) act({ descripcion: v }); });
  const motivo = useBorrador(t.motivoBloqueo || '', v => { if (v !== (t.motivoBloqueo || '')) act({ motivoBloqueo: v }); });
  useAutoAlto(tituloRef, titulo.value);
  useAutoAlto(descRef, desc.value);
  useEffect(() => { panelRef.current?.focus(); }, []);

  const cod = codigo(t, ctx);
  const hecha = esHecha(t, ctx);
  const pendientes = dependenciasPendientes(t, ctx);
  const mirando = ctx.miradas.get(id) || [];
  const col = ctx.colPorId.get(t.columna);
  const copiarCodigo = async () => {
    try { await navigator.clipboard.writeText(`${cod} ${t.titulo}`); avisar(`Copiaste ${cod}.`); }
    catch (_) { avisar(`El código es ${cod}.`); }
  };
  const candidatas = ctx.tareas.filter(x => x.id !== id && !x.archivada && !(t.dependeDe || []).includes(x.id) && !(x.dependeDe || []).includes(id))
    .sort((a, b) => (a.numero || 0) - (b.numero || 0));
  const creador = t.creadaPor ? nombreDe(t.creadaPor, ctx) : null;

  return html`<aside class="detalle" role="dialog" aria-label=${`${cod}: ${t.titulo}`} tabindex="-1" ref=${panelRef}>
    <header class="detalle-cab">
      <button class="codigo" onClick=${copiarCodigo} title="Copiar código y título">${cod}</button>
      <select class="entrada" id="det-tipo" aria-label="Tipo" value=${t.tipo || 'tarea'} disabled=${!editable}
        onChange=${e => act({ tipo: e.target.value }, `cambió el tipo a ${TIPO[e.target.value].nombre}`)}>
        ${TIPOS.map(x => html`<option value=${x.id}>${x.nombre}</option>`)}
      </select>
      <span class="espacio"></span>
      ${mirando.length > 0 && html`<span class="t-mirando" title=${mirando.map(m => nombreDe(m, ctx)).join(', ') + ' también la está mirando'}><${Icono} n="ojo" t=${14} /><${Avatares} ids=${mirando} ctx=${ctx} t=${20} /></span>`}
      <button class="btn-icono" onClick=${alCerrar} aria-label="Cerrar"><${Icono} n="cerrar" /></button>
    </header>

    <div class="detalle-cuerpo">
      <textarea class="titulo-edit" id="det-titulo" ref=${tituloRef} rows="1" aria-label="Título" disabled=${!editable} ...${titulo}
        onKeyDown=${e => { if (e.key === 'Enter') { e.preventDefault(); e.currentTarget.blur(); } }}></textarea>

      <div class="props">
        <label class="prop-etq" for="det-estado">Estado</label>
        <div class="fila">
          <select class="entrada" id="det-estado" style="width:auto" value=${t.columna} disabled=${!editable} onChange=${e => acciones.moverAlFinal(id, e.target.value)}>
            ${ctx.columnas.map(c => html`<option value=${c.id}>${c.nombre}</option>`)}
          </select>
          ${hecha && t.terminadaEn && html`<span class="nota">Terminada el ${fechaLarga(isoDe(new Date(t.terminadaEn)))}</span>`}
          ${!hecha && t.entroEnColumna && html`<span class="nota">${col ? `En «${col.nombre}»` : 'En esta columna'} desde ${momento(t.entroEnColumna)}</span>`}
        </div>

        <label class="prop-etq" for="det-prioridad">Prioridad</label>
        <select class="entrada" id="det-prioridad" style="width:auto" value=${t.prioridad || 'media'} disabled=${!editable}
          onChange=${e => act({ prioridad: e.target.value }, `cambió la prioridad a ${PRIORIDAD[e.target.value].nombre}`)}>
          ${PRIORIDADES.map(p => html`<option value=${p.id}>${p.nombre}</option>`)}
        </select>

        <span class="prop-etq">Responsables</span>
        <${ChipsIntegrantes} ctx=${ctx} valor=${t.asignados || []} editable=${editable}
          alCambiar=${(v, m, on) => act({ asignados: v }, m.id === ctx.yo ? (on ? 'la tomó' : 'la soltó') : on ? `se la asignó a ${m.nombre}` : `sacó a ${m.nombre}`)} />

        <span class="prop-etq">Etiquetas</span>
        <${ChipsEtiquetas} ctx=${ctx} valor=${t.etiquetas || []} editable=${editable} alCambiar=${v => act({ etiquetas: v })} />

        <label class="prop-etq" for="det-vence">Vence</label>
        <div class="fila">
          <input class="entrada" type="date" id="det-vence" style="width:auto" value=${t.vence || ''} disabled=${!editable}
            onChange=${e => { const v = e.target.value || null; act({ vence: v }, v ? `puso el vencimiento el ${fechaLarga(v)}` : 'sacó el vencimiento'); }} />
          ${t.vence && !hecha && html`<span class=${'nota t-dato ' + estadoVence(t.vence, ctx.hoy)}>${mayus(cuandoVence(t.vence, ctx.hoy))}</span>`}
        </div>

        <label class="prop-etq" for="det-estimacion">Estimación</label>
        <select class="entrada" id="det-estimacion" style="width:auto" value=${t.estimacion != null ? String(t.estimacion) : ''} disabled=${!editable}
          onChange=${e => act({ estimacion: e.target.value ? Number(e.target.value) : null })}>
          <option value="">Sin estimar</option>
          ${ESTIMACIONES.map(n => html`<option value=${String(n)}>${n} ${n === 1 ? 'punto' : 'puntos'}</option>`)}
        </select>

        <label class="prop-etq" for="det-hito">Hito</label>
        <select class="entrada" id="det-hito" value=${t.hito || ''} disabled=${!editable}
          onChange=${e => { const v = e.target.value || null; act({ hito: v }, v ? `la sumó al hito ${ctx.hitosPorId.get(v)?.nombre || ''}` : 'la sacó del hito'); }}>
          <option value="">Sin hito</option>
          ${ctx.hitos.map(x => html`<option value=${x.id}>${x.nombre}${x.fin ? ' · ' + fechaCorta(x.fin) : ''}</option>`)}
        </select>

        <span class="prop-etq">Bloqueo</span>
        <div class="fila">
          <label class="opcion" style="padding-left:0"><input type="checkbox" id="det-bloqueada" checked=${!!t.bloqueada} disabled=${!editable}
            onChange=${e => act({ bloqueada: e.target.checked }, e.target.checked ? 'la marcó como bloqueada' : 'la desbloqueó')} />Está bloqueada</label>
        </div>
        ${t.bloqueada && html`<span class="prop-etq"></span><input class="entrada" id="det-motivo" type="text" placeholder="¿Qué la frena? Ej.: esperando acceso al Odoo de prueba" disabled=${!editable} ...${motivo} />`}
      </div>

      <section class="seccion">
        <div class="seccion-cab"><h3>Descripción</h3></div>
        <textarea class="entrada" id="det-desc" ref=${descRef} rows="4" disabled=${!editable}
          placeholder="Contexto, alcance y cómo la vamos a validar…" ...${desc}></textarea>
      </section>

      <${Checklist} titulo="Criterios de aceptación" idBase="cri" items=${t.criterios || []} editable=${editable}
        placeholder="Ej.: la alerta dice fecha y monto" alCambiar=${(v, que) => act({ criterios: v }, que)} />
      <${Checklist} titulo="Subtareas" idBase="sub" items=${t.subtareas || []} editable=${editable}
        placeholder="Agregá un paso" alCambiar=${(v, que) => act({ subtareas: v }, que)} />

      <section class="seccion">
        <div class="seccion-cab"><h3>Depende de</h3>${pendientes.length > 0 && html`<span class="tag urgente"><${Icono} n="candado" t=${11} />Esperando ${pendientes.length}</span>`}</div>
        ${(t.dependeDe || []).length > 0 && html`<ul class="lista-simple">${(t.dependeDe || []).map(did => {
          const d = ctx.porId.get(did);
          return html`<li key=${did}>
            ${d ? html`<button class="btn-link mono" onClick=${() => alAbrir(did)}>${codigo(d, ctx)}</button><span class="crece">${d.titulo}</span>
              <span class=${'tag ' + (esHecha(d, ctx) ? 'hecho' : 'media')}>${ctx.colPorId.get(d.columna)?.nombre || ''}</span>`
              : html`<span class="crece tenue">Tarea eliminada</span>`}
            ${editable && html`<button class="btn-icono chico" aria-label="Quitar dependencia" onClick=${() => act({ dependeDe: t.dependeDe.filter(x => x !== did) })}><${Icono} n="cerrar" t=${14} /></button>`}
          </li>`;
        })}</ul>`}
        ${editable && candidatas.length > 0 && html`<select class="entrada" id="det-dep" value="" onChange=${e => {
          const v = e.target.value; if (!v) return; const d = ctx.porId.get(v);
          act({ dependeDe: [...(t.dependeDe || []), v] }, `marcó que depende de ${d ? codigo(d, ctx) : 'otra tarea'}`); e.target.value = '';
        }}>
          <option value="">Agregar una tarea de la que depende…</option>
          ${candidatas.map(x => html`<option value=${x.id}>${codigo(x, ctx)} · ${x.titulo.length > 70 ? x.titulo.slice(0, 70) + '…' : x.titulo}</option>`)}
        </select>`}
        ${!editable && !(t.dependeDe || []).length && html`<p class="tenue">No depende de otras tareas.</p>`}
      </section>

      <${Enlaces} t=${t} editable=${editable} act=${act} />
      <${Comentarios} t=${t} ctx=${ctx} editable=${editable} />

      <details>
        <summary><${Icono} n="historial" t=${15} />Historial <span class="mono tenue">${(t.historial || []).length}</span></summary>
        <ul class="historial">${[...(t.historial || [])].reverse().map((ev, i) => html`<li key=${i}><span class="mono">${momento(ev.en)}</span><span><strong>${ev.quien ? nombreDe(ev.quien, ctx) : 'Alguien'}</strong> ${ev.que}</span></li>`)}</ul>
      </details>
    </div>

    <footer class="detalle-pie">
      ${confirmar ? html`<div class="confirmar-linea">
          <span>¿Eliminar ${cod} y sus comentarios? No se puede deshacer.</span>
          <button class="btn btn-peligro btn-chico" onClick=${async () => { if (await acciones.eliminarTarea(id)) { avisar(`Eliminaste ${cod}.`); alCerrar(); } }}>Eliminar</button>
          <button class="btn btn-fantasma btn-chico" onClick=${() => setConfirmar(false)}>Cancelar</button>
        </div>`
      : html`<span class="meta">${creador ? `Creada por ${creador}` : 'Creada'}${t.creadaEn ? ' · ' + momento(t.creadaEn) : ''}${t.actualizadaEn && t.actualizadaEn !== t.creadaEn ? ' · editada ' + momento(t.actualizadaEn) : ''}</span>
        ${editable && html`
          <button class="btn btn-fantasma btn-chico" onClick=${async () => { const r = await acciones.duplicar(id); if (r) alAbrir(r.id); }}><${Icono} n="copiar" t=${14} />Duplicar</button>
          <button class="btn btn-fantasma btn-chico" onClick=${async () => { await acciones.archivar(id, !t.archivada); avisar(t.archivada ? `${cod} volvió al tablero.` : `Archivaste ${cod}. La encontrás con el filtro Archivadas.`); if (!t.archivada) alCerrar(); }}><${Icono} n="archivo" t=${14} />${t.archivada ? 'Desarchivar' : 'Archivar'}</button>
          <button class="btn btn-peligro btn-chico" onClick=${() => setConfirmar(true)}><${Icono} n="basura" t=${14} />Eliminar</button>`}`}
    </footer>
  </aside>`;
}

function Enlaces({ t, editable, act }) {
  const [url, setUrl] = useState('');
  const [nombre, setNombre] = useState('');
  const enlaces = t.enlaces || [];
  const agregar = () => {
    const u = urlSegura(url);
    if (!u) { avisar('Ese enlace no parece válido. Probá pegando la dirección completa.', 'error'); return; }
    act({ enlaces: [...enlaces, { id: uid().slice(0, 10), url: u, titulo: nombre.trim() }] }, 'agregó un enlace');
    setUrl(''); setNombre('');
  };
  return html`<section class="seccion">
    <div class="seccion-cab"><h3>Enlaces</h3></div>
    ${enlaces.length > 0 && html`<ul class="lista-simple">${enlaces.map(e => html`<li key=${e.id}>
      <${Icono} n="enlace" t=${14} />
      <span class="crece"><a href=${e.url} target="_blank" rel="noopener noreferrer">${e.titulo || e.url}</a></span>
      ${editable && html`<button class="btn-icono chico" aria-label="Quitar enlace" onClick=${() => act({ enlaces: enlaces.filter(x => x.id !== e.id) })}><${Icono} n="cerrar" t=${14} /></button>`}
    </li>`)}</ul>`}
    ${editable && html`<div class="agregar-item">
      <input class="entrada" id="enl-url" type="url" placeholder="https://… (Figma, Drive, repo)" value=${url} onInput=${e => setUrl(e.target.value)} onKeyDown=${e => { if (e.key === 'Enter') { e.preventDefault(); agregar(); } }} />
      <input class="entrada" id="enl-nombre" type="text" placeholder="Nombre (opcional)" value=${nombre} onInput=${e => setNombre(e.target.value)} onKeyDown=${e => { if (e.key === 'Enter') { e.preventDefault(); agregar(); } }} />
      <button class="btn btn-chico" onClick=${agregar} disabled=${!url.trim()}>Agregar</button>
    </div>`}
    ${!editable && !enlaces.length && html`<p class="tenue">Sin enlaces.</p>`}
  </section>`;
}

function Comentarios({ t, ctx, editable }) {
  const [texto, setTexto] = useState('');
  const [enviando, setEnviando] = useState(false);
  const lista = ctx.comentarios.filter(c => c.tareaId === t.id).sort((a, b) => (a.en < b.en ? -1 : 1));
  const enviar = async () => {
    const x = texto.trim();
    if (!x || enviando) return;
    setEnviando(true);
    const ok = await acciones.comentar(t.id, x);
    setEnviando(false);
    if (ok) setTexto('');
  };
  return html`<section class="seccion">
    <div class="seccion-cab"><h3>Comentarios</h3>${lista.length > 0 && html`<span class="mono tenue">${lista.length}</span>`}</div>
    ${lista.map(c => {
      const m = ctx.integrantes.get(c.autor);
      return html`<div class="comentario" key=${c.id}>
        <${Avatar} m=${m} t=${28} />
        <div>
          <div class="comentario-cab"><strong>${m ? m.nombre : 'Alguien'}</strong><span class="mono">${momento(c.en)}</span>
            ${editable && c.autor && c.autor === ctx.yo && html`<button class="btn-link" onClick=${() => acciones.borrarComentario(c.id)}>Borrar</button>`}
          </div>
          <p class="comentario-texto"><${ConEnlaces} texto=${c.texto} /></p>
        </div>
      </div>`;
    })}
    ${!lista.length && !editable && html`<p class="tenue">Sin comentarios.</p>`}
    ${editable && html`<div class="campo">
      <textarea class="entrada" id="com-nuevo" rows="2" placeholder="Escribí un comentario… (Ctrl + Enter para enviar)" value=${texto}
        onInput=${e => setTexto(e.target.value)} onKeyDown=${e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); enviar(); } }}></textarea>
      <div class="fila-fin"><button class="btn btn-chico" onClick=${enviar} disabled=${!texto.trim() || enviando}>Comentar</button></div>
    </div>`}
  </section>`;
}
