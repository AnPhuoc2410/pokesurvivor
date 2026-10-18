/* ============ login.js — inicio: entrar, crear cuenta o invitado ============ */
G.LoginUI = (() => {
  const $ = G.UI.$;
  let mode = 'login';

  function init() {
    document.querySelectorAll('#scr-login .tab').forEach(t => {
      t.onclick = () => setMode(t.dataset.tab);
    });
    $('login-form').onsubmit = async e => {
      e.preventDefault();
      $('login-err').textContent = '';
      $('btn-auth').disabled = true;
      const fn = mode === 'login' ? G.DB.login : G.DB.register;
      const r = await fn($('f-user').value, $('f-pass').value);
      $('btn-auth').disabled = false;
      if (!r.ok) { $('login-err').textContent = r.error; return; }
      $('f-pass').value = '';
      G.Flow.afterLogin();
    };
    $('btn-guest').onclick = () => { G.DB.playAsGuest(); G.Flow.afterLogin(); };
    $('f-forgot').onclick = e => {
      e.preventDefault();
      $('login-err').textContent = '';
      $('forgot-note').classList.toggle('hidden');
    };
    // Vincular Gmail para poder recuperar la cuenta (ver offerRecovery).
    $('rec-link').onclick = async () => {
      $('rec-err').textContent = '';
      $('rec-link').disabled = true;
      const r = await G.DB.linkGoogle();
      $('rec-link').disabled = false;
      if (!r.ok) { $('rec-err').textContent = r.error; return; }
      $('scr-recover').classList.add('hidden');
      G.UI.toast('¡Gmail vinculado! Si olvidas la contraseña, entra con Google.', 4500);
    };
    $('rec-later').onclick = () => $('scr-recover').classList.add('hidden');
    $('rec-never').onclick = () => {
      try { localStorage.setItem('ps.recover.no.' + G.DB.fb.uid, '1'); } catch (e) { /* nada */ }
      $('scr-recover').classList.add('hidden');
    };
    $('btn-google').onclick = async () => {
      $('login-err').textContent = '';
      $('btn-google').disabled = true;
      const r = await G.DB.loginWithGoogle();
      $('btn-google').disabled = false;
      if (!r.ok) { $('login-err').textContent = r.error; return; }
      G.Flow.afterLogin();
    };
  }

  /**
   * Al entrar (o recién creada la cuenta) con nombre y contraseña, si aún no
   * hay Gmail vinculado: "¿te da miedo perder tu cuenta?". Una vez por sesión,
   * hasta que lo vincule o diga que no le vuelvan a preguntar.
   */
  let offered = false;
  function offerRecovery() {
    if (offered || G.DB.mode !== 'cloud' || !G.DB.fb || !G.DB.nameAccount || G.DB.hasGoogle) return;
    try { if (localStorage.getItem('ps.recover.no.' + G.DB.fb.uid)) return; } catch (e) { /* nada */ }
    offered = true;
    $('rec-err').textContent = '';
    $('scr-recover').classList.remove('hidden');
  }

  /**
   * Aviso del botón Guardar (18-10-2026): la primera vez que se entra al menú
   * tras la actualización, con cuenta en la nube. → true si se ha enseñado.
   */
  const K_SAVENOTE = 'ps.savenote.1';
  function saveNotice() {
    if (G.DB.mode !== 'cloud' || G.DB.guest) return false;
    try { if (localStorage.getItem(K_SAVENOTE)) return false; localStorage.setItem(K_SAVENOTE, '1'); } catch (e) { return false; }
    const en = G.I18n.lang === 'en';
    $('savenote-title').textContent = en ? 'Important: save your game' : 'Importante: guarda tu partida';
    $('savenote-body').innerHTML = en
      ? '<p>Because of problems with saving, from now on your game is saved to the cloud automatically <b>every 10 minutes</b>.</p>' +
        '<p>We have added a <b class="gold">Save</b> button at the top right. Use it before closing the game or switching devices: <b>it is very important so you don’t lose your progress</b>.</p>'
      : '<p>Debido a problemas con el guardado, a partir de ahora la partida se guarda en la nube automáticamente <b>cada 10 minutos</b>.</p>' +
        '<p>Hemos incorporado un botón <b class="gold">Guardar</b> arriba a la derecha. Úsalo antes de cerrar el juego o de cambiar de aparato: <b>es muy importante para no perder tu partida</b>.</p>';
    $('savenote-ok').textContent = en ? 'Got it' : 'Entendido';
    $('savenote-ok').onclick = () => $('scr-savenote').classList.add('hidden');
    $('scr-savenote').classList.remove('hidden');
    return true;
  }

  /** Explica dónde se guarda la partida según el modo de la base de datos. */
  function modeNote() {
    if (G.DB.mode === 'cloud') return 'Tu partida se guarda en la nube: entra desde cualquier ordenador. Como invitado no se guarda.';
    const why = G.DB.localReason === 'file'
      ? 'Abierto desde un archivo: la partida sólo se guarda en este navegador. Para guardar en la nube, juega en la versión publicada.'
      : G.DB.localReason === 'host'
        ? 'Esta no es la web oficial: la partida sólo se guarda en este navegador. El juego oficial y gratis está en pokesurvivor.com.'
      : G.DB.localReason === 'config'
        ? 'Nube sin configurar: la partida sólo se guarda en este navegador.'
        : 'No se pudo conectar con la nube: la partida sólo se guarda en este navegador.';
    return why;
  }

  function setMode(m) {
    mode = m;
    document.querySelectorAll('#scr-login .tab').forEach(t => t.classList.toggle('on', t.dataset.tab === m));
    $('btn-auth').textContent = m === 'login' ? 'Entrar' : 'Crear cuenta';
    $('f-pass').autocomplete = m === 'login' ? 'current-password' : 'new-password';
    $('login-err').textContent = '';
  }

  function open() {
    G.UI.chrome(false);
    G.UI.show('scr-login');
    if (!G.DB.storageOk) $('login-err').textContent = 'Este navegador no deja guardar datos: juega como invitado.';
    $('btn-google').classList.toggle('hidden', G.DB.mode !== 'cloud');
    $('login-mode').textContent = modeNote();
    setTimeout(() => $('f-user').focus(), 50);
  }

  return { init, open, offerRecovery, saveNotice };
})();
