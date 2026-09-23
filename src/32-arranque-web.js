
/* ===== Arranque de la versión web (Vercel) ===== */
extensiones.plataforma = 'web';
(function arrancarWeb() {
  const cfg = window.FINORA_CONFIG || {};
  const raiz = document.getElementById('app');
  const sdk = window.supabase;
  if (!cfg.url || !cfg.anonKey || !sdk || typeof sdk.createClient !== 'function') {
    // Sin base de datos configurada: el tablero funciona en modo local
    render(html`<${Raiz} />`, raiz);
    iniciar();
    return;
  }
  const cliente = sdk.createClient(cfg.url, cfg.anonKey, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, flowType: 'implicit' },
  });
  web.cliente = cliente;
  extensiones.equipo = BloqueInvitaciones;
  render(html`<${RaizWeb} cliente=${cliente} />`, raiz);
})();
