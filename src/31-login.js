
/* ===== Versión web: pantallas de acceso ===== */
function traducirError(err) {
  const m = (err && (err.message || err.error_description)) || '';
  if (/invalid login credentials/i.test(m)) return 'El email o la contraseña no coinciden.';
  if (/email not confirmed/i.test(m)) return 'Todavía no confirmaste tu email. Buscá el link que te mandamos (fijate también en spam).';
  if (/already registered|already been registered/i.test(m)) return 'Ya hay una cuenta con ese email. Entrá o recuperá la contraseña.';
  if (/password should be at least|weak password/i.test(m)) return 'La contraseña es muy débil. Usá al menos 8 caracteres.';
  if (/rate limit|too many|security purposes/i.test(m)) return 'Hubo muchos intentos seguidos. Esperá unos minutos y probá de nuevo.';
  if (/fetch|network|load failed/i.test(m)) return 'No hay conexión con el servidor. Revisá tu internet y probá de nuevo.';
  if (/same password|different from the old/i.test(m)) return 'La contraseña nueva tiene que ser distinta de la anterior.';
  return 'No se pudo completar. ' + (m || 'Probá de nuevo en un rato.');
}
const urlSitio = () => location.origin + location.pathname;

function MarcaAcceso({ bajada }) {
  return html`<div class="acceso-marca">
    <${Chispa} t=${52} />
    <div class="etiqueta-mono">Finora · Proyecto final · ORT Uruguay</div>
    <h1>Tablero del equipo</h1>
    ${bajada && html`<p>${bajada}</p>`}
  </div>`;
}

function PantallaAcceso({ cliente }) {
  const [modo, setModo] = useState('entrar');
  const [email, setEmail] = useState('');
  const [clave, setClave] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [mensaje, setMensaje] = useState(null);
  const cambiarModo = m => { setModo(m); setMensaje(null); };
  const enviar = async ev => {
    ev.preventDefault();
    const correo = email.trim().toLowerCase();
    if (!correo) return;
    setEnviando(true); setMensaje(null);
    try {
      if (modo === 'entrar') {
        const { error } = await cliente.auth.signInWithPassword({ email: correo, password: clave });
        if (error) throw error;
      } else if (modo === 'crear') {
        if (clave.length < 8) throw { message: 'weak password' };
        const { data, error } = await cliente.auth.signUp({ email: correo, password: clave, options: { emailRedirectTo: urlSitio() } });
        if (error) throw error;
        if (!data.session) setMensaje({ tipo: 'ok', texto: `Te mandamos un email a ${correo}. Abrí el link para confirmar la cuenta y después entrá acá. Si no llega en unos minutos, fijate en spam.` });
      } else {
        const { error } = await cliente.auth.resetPasswordForEmail(correo, { redirectTo: urlSitio() });
        if (error) throw error;
        setMensaje({ tipo: 'ok', texto: 'Si ese email tiene cuenta, te llegó un link para elegir una contraseña nueva. Fijate también en spam.' });
      }
    } catch (err) {
      setMensaje({ tipo: 'error', texto: traducirError(err) });
    }
    setEnviando(false);
  };
  const textoBoton = modo === 'entrar' ? 'Entrar' : modo === 'crear' ? 'Crear cuenta' : 'Mandarme el link';
  return html`<main class="acceso">
    <div class="acceso-caja">
      <${MarcaAcceso} bajada="Entrá con tu email para ver y mover las tareas del equipo." />
      <div class="acceso-tarjeta">
        ${modo !== 'olvide' ? html`<div class="subpestanas" role="group" aria-label="Acceso">
          <button type="button" aria-pressed=${modo === 'entrar'} onClick=${() => cambiarModo('entrar')}>Entrar</button>
          <button type="button" aria-pressed=${modo === 'crear'} onClick=${() => cambiarModo('crear')}>Crear cuenta</button>
        </div>` : html`<div><h2 style="font-size:17px">Recuperar la contraseña</h2><p class="tenue" style="margin-top:4px">Te mandamos un link para elegir una nueva.</p></div>`}
        <form onSubmit=${enviar}>
          <div class="campo"><label for="acc-email">Email</label>
            <input class="entrada" id="acc-email" type="email" autocomplete="email" required value=${email} onInput=${e => setEmail(e.target.value)} /></div>
          ${modo !== 'olvide' && html`<div class="campo"><label for="acc-clave">Contraseña</label>
            <input class="entrada" id="acc-clave" type="password" required minlength=${modo === 'crear' ? 8 : undefined}
              autocomplete=${modo === 'crear' ? 'new-password' : 'current-password'} value=${clave} onInput=${e => setClave(e.target.value)} />
            ${modo === 'crear' && html`<span class="tenue" style="font-size:12.5px">Al menos 8 caracteres.</span>`}</div>`}
          ${mensaje && html`<div class=${'mensaje ' + mensaje.tipo} role=${mensaje.tipo === 'error' ? 'alert' : 'status'}>${mensaje.texto}</div>`}
          <button class="btn btn-primario" type="submit" disabled=${enviando}>${enviando ? 'Un momento…' : textoBoton}</button>
        </form>
        ${modo === 'entrar' && html`<button class="btn-link" style="justify-self:start" onClick=${() => cambiarModo('olvide')}>¿Te olvidaste la contraseña?</button>`}
        ${modo === 'olvide' && html`<button class="btn-link" style="justify-self:start" onClick=${() => cambiarModo('entrar')}>Volver a entrar</button>`}
      </div>
      <p class="acceso-pie">Solo pueden entrar los emails que <strong>invitó el equipo</strong>. Si todavía no te invitaron, pedíselo a alguien del grupo.</p>
    </div>
  </main>`;
}

function PantallaNuevaClave({ cliente, alListo }) {
  const [clave, setClave] = useState('');
  const [otra, setOtra] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [mensaje, setMensaje] = useState(null);
  const enviar = async ev => {
    ev.preventDefault();
    if (clave.length < 8) { setMensaje({ tipo: 'error', texto: 'Usá al menos 8 caracteres.' }); return; }
    if (clave !== otra) { setMensaje({ tipo: 'error', texto: 'Las dos contraseñas no coinciden.' }); return; }
    setEnviando(true);
    const { error } = await cliente.auth.updateUser({ password: clave });
    setEnviando(false);
    if (error) { setMensaje({ tipo: 'error', texto: traducirError(error) }); return; }
    avisar('Cambiaste tu contraseña.');
    alListo();
  };
  return html`<main class="acceso"><div class="acceso-caja">
    <${MarcaAcceso} bajada="Elegí tu contraseña nueva." />
    <form class="acceso-tarjeta" onSubmit=${enviar}>
      <div class="campo"><label for="nc-clave">Contraseña nueva</label><input class="entrada" id="nc-clave" type="password" autocomplete="new-password" required value=${clave} onInput=${e => setClave(e.target.value)} /></div>
      <div class="campo"><label for="nc-otra">Repetila</label><input class="entrada" id="nc-otra" type="password" autocomplete="new-password" required value=${otra} onInput=${e => setOtra(e.target.value)} /></div>
      ${mensaje && html`<div class=${'mensaje ' + mensaje.tipo} role="alert">${mensaje.texto}</div>`}
      <button class="btn btn-primario" type="submit" disabled=${enviando}>${enviando ? 'Guardando…' : 'Guardar contraseña'}</button>
    </form>
  </div></main>`;
}

function PantallaAviso({ titulo, texto, acciones: botones }) {
  return html`<main class="acceso"><div class="acceso-caja">
    <${MarcaAcceso} />
    <div class="acceso-tarjeta">
      <h2 style="font-size:18px">${titulo}</h2>
      <p class="tenue">${texto}</p>
      <div class="fila">${botones}</div>
    </div>
  </div></main>`;
}

function RaizWeb({ cliente }) {
  const [sesion, setSesion] = useState(undefined);
  const [recuperando, setRecuperando] = useState(false);
  const [permiso, setPermiso] = useState(null);
  const [intento, setIntento] = useState(0);
  useEffect(() => {
    const { data } = cliente.auth.onAuthStateChange((evento, s) => {
      if (evento === 'PASSWORD_RECOVERY') setRecuperando(true);
      setSesion(s || null);
    });
    return () => data.subscription.unsubscribe();
  }, []);
  const uidSesion = sesion && sesion.user ? sesion.user.id : null;
  useEffect(() => {
    if (!uidSesion) { setPermiso(null); return; }
    let vivo = true;
    setPermiso(null);
    cliente.rpc('verificar_acceso').then(({ data, error }) => {
      if (!vivo) return;
      if (error) console.error(error);
      setPermiso(error ? 'error' : data ? 'si' : 'no');
    });
    return () => { vivo = false; };
  }, [uidSesion, intento]);
  useEffect(() => { if (permiso === 'si' && sesion) conectarDatosWeb(cliente, sesion.user); }, [permiso]);

  const salir = html`<button class="btn" onClick=${async () => { await cliente.auth.signOut(); location.reload(); }}><${Icono} n="salir" t=${15} />Cerrar sesión</button>`;
  if (sesion === undefined) return html`<div class="cargando"><${Chispa} t=${48} /><p>Cargando…</p></div>`;
  if (sesion && recuperando) return html`<${PantallaNuevaClave} cliente=${cliente} alListo=${() => setRecuperando(false)} />`;
  if (!sesion) return html`<${PantallaAcceso} cliente=${cliente} />`;
  if (permiso === null) return html`<div class="cargando"><${Chispa} t=${48} /><p>Verificando tu acceso…</p></div>`;
  if (permiso === 'no') {
    return html`<${PantallaAviso} titulo="Tu email todavía no está invitado"
      texto=${`Entraste como ${sesion.user.email}, pero ese email no está en la lista del equipo. Pedile a alguien del grupo que te sume desde Equipo → Invitar al equipo, y después tocá "Probar de nuevo".`}
      acciones=${html`<button class="btn btn-primario" onClick=${() => setIntento(n => n + 1)}>Probar de nuevo</button>${salir}`} />`;
  }
  if (permiso === 'error') {
    return html`<${PantallaAviso} titulo="No pudimos conectar con la base de datos"
      texto="Puede ser un corte de internet, o que el proyecto de Supabase esté pausado por no usarse en 7 días (se reactiva desde su panel con Restore). También puede faltar correr el script supabase/esquema.sql."
      acciones=${html`<button class="btn btn-primario" onClick=${() => setIntento(n => n + 1)}>Probar de nuevo</button>${salir}`} />`;
  }
  return html`<${Raiz} />`;
}
