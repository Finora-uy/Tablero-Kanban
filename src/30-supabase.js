
/* ===== Versión web: base de datos, tiempo real y presencia con Supabase ===== */
const web = { cliente: null };

function errorSupabase(err) {
  const msg = (err && (err.message || err.error_description)) || String(err || '');
  const code = err && err.code;
  if (code === '42501' || /row-level security|permission denied/i.test(msg)) return { code: 'invalid_argument', message: msg };
  if (code === 'P0002') return { code: 'invalid_argument', message: msg };
  return { code: 'unavailable', message: msg };
}
async function sb(consulta) {
  const { data, error } = await consulta;
  if (error) throw errorSupabase(error);
  return data;
}
// Normaliza timestamptz de Postgres ("2026-09-23 14:51:05.6+00") para compararlos
function marca(s) {
  if (!s) return 0;
  let x = String(s).replace(' ', 'T');
  if (/[+-]\d\d$/.test(x)) x += ':00';
  const v = Date.parse(x);
  return isNaN(v) ? 0 : v;
}

function crearBackendSupabase(cliente) {
  const encolar = crearCola();
  const cols = new Map();
  let canal = null, suscripto = false;
  const col = n => {
    if (!cols.has(n)) cols.set(n, { docs: new Map(), oyentes: new Set(), cargada: false, pendientes: [], errores: new Set() });
    return cols.get(n);
  };
  const partes = path => { const i = path.indexOf('/'); return [path.slice(0, i), path.slice(i + 1)]; };
  const emitir = n => {
    const c = col(n);
    if (!c.cargada) return;
    const m = new Map();
    c.docs.forEach((v, id) => m.set(id, v.data));
    c.oyentes.forEach(o => o(m));
  };
  function aplicar(n, tipo, fila) {
    const c = col(n);
    if (!c.cargada) { c.pendientes.push([tipo, fila]); return; }
    if (tipo === 'DELETE') c.docs.delete(fila.id);
    else {
      const previo = c.docs.get(fila.id);
      if (!previo || !previo.actualizado || marca(fila.actualizado) >= marca(previo.actualizado)) c.docs.set(fila.id, { data: fila.data, actualizado: fila.actualizado });
    }
    emitir(n);
  }
  async function cargar(n) {
    const c = col(n);
    try {
      const filas = [];
      for (let desde = 0; ; desde += 1000) {
        const lote = await sb(cliente.from('docs').select('id,data,actualizado').eq('coleccion', n).range(desde, desde + 999));
        filas.push(...lote);
        if (lote.length < 1000) break;
      }
      c.docs = new Map(filas.map(f => [f.id, { data: f.data, actualizado: f.actualizado }]));
      c.cargada = true;
      const pend = c.pendientes;
      c.pendientes = [];
      pend.forEach(([t, f]) => aplicar(n, t, f));
      emitir(n);
    } catch (err) {
      console.error('No se pudo cargar', n, err);
      c.errores.forEach(f => f(err));
    }
  }
  function asegurarCanal() {
    if (canal) return;
    let primera = true;
    canal = cliente.channel('docs-tablero')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'docs' }, p => {
        const fila = p.eventType === 'DELETE' ? p.old : p.new;
        if (!fila || !fila.coleccion || !cols.has(fila.coleccion)) return;
        aplicar(fila.coleccion, p.eventType, fila);
      })
      .subscribe(estadoCanal => {
        if (estadoCanal === 'SUBSCRIBED') {
          suscripto = true;
          primera = false;
          // Al conectar (y al reconectar) se vuelve a leer todo para no perder cambios
          for (const n of cols.keys()) cargar(n);
        } else if ((estadoCanal === 'CHANNEL_ERROR' || estadoCanal === 'TIMED_OUT') && primera) {
          primera = false;
          // Sin tiempo real igual se muestran los datos; el cliente reintenta conectarse solo
          for (const n of cols.keys()) if (!col(n).cargada) cargar(n);
          avisar('Las actualizaciones en vivo tardan en conectar. Si no ves cambios del resto, recargá la página.', 'error');
        }
      });
  }
  const conRecarga = (n, p) => p.catch(err => { cargar(n); throw err; });
  return {
    tipo: 'nube',
    observarColeccion(n, cb, alError) {
      const c = col(n);
      c.oyentes.add(cb);
      if (alError) c.errores.add(alError);
      asegurarCanal();
      if (suscripto && !c.cargada) cargar(n);
      else if (c.cargada) queueMicrotask(() => emitir(n));
      return () => { c.oyentes.delete(cb); if (alError) c.errores.delete(alError); };
    },
    observarDoc(path, cb, alError) {
      const [n, id] = partes(path);
      return this.observarColeccion(n, m => cb(m.get(id) || null), alError);
    },
    nuevoId() { return uid(); },
    crear(path, data) {
      const [n, id] = partes(path);
      const c = col(n);
      if (c.cargada) { c.docs.set(id, { data: copiaProfunda(data), actualizado: null }); emitir(n); }
      return conRecarga(n, encolar(path, () => sb(cliente.from('docs').upsert({ coleccion: n, id, data }))));
    },
    actualizar(path, cambios) {
      const [n, id] = partes(path);
      const c = col(n), previo = c.docs.get(id);
      if (previo) { c.docs.set(id, { data: { ...previo.data, ...copiaProfunda(cambios) }, actualizado: null }); emitir(n); }
      return conRecarga(n, encolar(path, () => sb(cliente.rpc('actualizar_doc', { p_coleccion: n, p_id: id, p_cambios: cambios }))));
    },
    borrar(path) {
      const [n, id] = partes(path);
      const c = col(n);
      if (c.docs.delete(id)) emitir(n);
      return conRecarga(n, encolar(path, () => sb(cliente.from('docs').delete().eq('coleccion', n).eq('id', id))));
    },
    async siguienteNumero(maxActual) {
      const n = await sb(cliente.rpc('siguiente_numero', { minimo: maxActual }));
      return typeof n === 'number' ? n : maxActual + 1;
    },
  };
}

// Presencia: quién está conectado y qué tarea mira (mismo formato que `room`)
function crearPresencia(cliente, userId) {
  const canal = cliente.channel('presencia-tablero', { config: { presence: { key: userId } } });
  const sincronizar = () => {
    const st = canal.presenceState();
    const pares = [];
    for (const [clave, lista] of Object.entries(st)) {
      for (const p of lista) pares.push({ kind: 'viewer', by: clave, isMe: clave === userId, sameTab: p.tab === SESION, guest: false, presence: p });
    }
    estado.pares = pares;
    notificar();
  };
  let listo = false, pendiente = null;
  canal.on('presence', { event: 'sync' }, sincronizar).subscribe(s => {
    if (s === 'SUBSCRIBED') { listo = true; if (pendiente) canal.track(pendiente).catch(() => {}); }
  });
  fijarPublicador(p => {
    const datos = { ...p, tab: SESION };
    if (listo) canal.track(datos).catch(() => {}); else pendiente = datos;
  });
}

let datosConectados = false;
function conectarDatosWeb(cliente, user) {
  if (datosConectados) return;
  datosConectados = true;
  backend = crearBackendSupabase(cliente);
  estado.modo = 'nube';
  estado.userId = user.id;
  estado.puedeEscribir = true;
  extensiones.cuenta = {
    email: user.email,
    cerrarSesion: async () => { try { await cliente.auth.signOut(); } catch (_) {} location.reload(); },
  };
  ['config', 'integrantes', 'tareas', 'comentarios', 'hitos'].forEach(abrirSuscripcion);
  crearPresencia(cliente, user.id);
  notificar();
}

/* ===== Invitaciones (vista Equipo) ===== */
function BloqueInvitaciones() {
  const cliente = web.cliente;
  const [lista, setLista] = useState(null);
  const [email, setEmail] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [quitando, setQuitando] = useState(null);
  const cargar = useCallback(async () => {
    const { data, error } = await cliente.from('equipo_permitido').select('email, creado').order('creado');
    if (!error) setLista(data);
  }, []);
  useEffect(() => {
    cargar();
    const canal = cliente.channel('invitados').on('postgres_changes', { event: '*', schema: 'public', table: 'equipo_permitido' }, () => cargar()).subscribe();
    return () => { cliente.removeChannel(canal); };
  }, []);
  const miEmail = ((extensiones.cuenta && extensiones.cuenta.email) || '').toLowerCase();
  const link = location.origin;
  const invitar = async ev => {
    ev.preventDefault();
    const x = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(x)) { avisar('Ese email no parece válido. Revisalo y probá de nuevo.', 'error'); return; }
    setEnviando(true);
    const { error } = await cliente.from('equipo_permitido').insert({ email: x });
    setEnviando(false);
    if (error) { avisar(error.code === '23505' ? 'Ese email ya estaba invitado.' : 'No se pudo invitar. Revisá tu conexión y probá de nuevo.', 'error'); return; }
    setEmail('');
    avisar(`Invitaste a ${x}. Pasale el link para que cree su cuenta con ese email.`);
    cargar();
  };
  const quitar = async x => {
    const { error } = await cliente.from('equipo_permitido').delete().eq('email', x);
    setQuitando(null);
    if (error) { avisar('No se pudo quitar la invitación.', 'error'); return; }
    avisar(`${x} ya no puede entrar al tablero.`);
    cargar();
  };
  const copiar = async () => {
    try { await navigator.clipboard.writeText(link); avisar('Copiaste el link del tablero.'); } catch (_) { avisar(`El link es ${link}`); }
  };
  return html`<section class="panel invitaciones">
    <h3>Invitar al equipo</h3>
    <p class="sub">Solo pueden entrar los emails de esta lista. Invitá a alguien y pasale el link: crea su cuenta con ese mismo email y confirma el correo que le llega.</p>
    <div class="link-sitio"><${Icono} n="enlace" t=${14} /><code>${link}</code><button class="btn btn-chico" onClick=${copiar}><${Icono} n="copiar" t=${14} />Copiar link</button></div>
    <form class="agregar-item" onSubmit=${invitar}>
      <label class="oculto-visual" for="inv-email">Email para invitar</label>
      <input class="entrada" id="inv-email" type="email" autocomplete="off" placeholder="amigo@ejemplo.com" value=${email} onInput=${e => setEmail(e.target.value)} />
      <button class="btn btn-primario btn-chico" type="submit" disabled=${!email.trim() || enviando}>Invitar</button>
    </form>
    ${lista === null ? html`<p class="tenue">Cargando invitados…</p>` : html`<ul class="lista-simple">${lista.map(i => html`<li key=${i.email}>
      <${Icono} n="sobre" t=${14} />
      <span class="crece">${i.email}${i.email === miEmail ? ' (vos)' : ''}</span>
      ${i.email !== miEmail && (quitando === i.email
        ? html`<span class="fila" style="gap:6px"><button class="btn btn-peligro btn-chico" onClick=${() => quitar(i.email)}>Quitar acceso</button><button class="btn btn-fantasma btn-chico" onClick=${() => setQuitando(null)}>Cancelar</button></span>`
        : html`<button class="btn-link" onClick=${() => setQuitando(i.email)}>Quitar</button>`)}
    </li>`)}</ul>`}
  </section>`;
}
