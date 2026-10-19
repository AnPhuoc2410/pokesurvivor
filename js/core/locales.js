/* Shared by the early loading screen and the game. Contains no player data. */
window.PS_LOCALES = (() => {
  const choices = [
    ['es', 'Español', 'es-ES'], ['en', 'English', 'en-GB'],
    ['fr', 'Français', 'fr-FR'], ['it', 'Italiano', 'it-IT'],
    ['pt-BR', 'Português (Brasil)', 'pt-BR'],
    ['zh-Hans', '简体中文', 'zh-CN'], ['zh-Hant', '繁體中文', 'zh-TW']
  ];
  function normalize(value) {
    const s = String(value || '').toLowerCase().replace(/_/g, '-');
    if (/^zh(?:-|$)/.test(s)) {
      if (s.includes('-hans')) return 'zh-Hans';
      if (s.includes('-hant') || /^zh-(tw|hk|mo)(-|$)/.test(s)) return 'zh-Hant';
      return 'zh-Hans';
    }
    if (/^pt(?:-|$)/.test(s)) return 'pt-BR';
    return choices.find(([id]) => s === id || s.startsWith(id + '-'))?.[0] || null;
  }
  let saved;
  try { saved = localStorage.getItem('ps.lang'); } catch (e) { /* storage can be blocked */ }
  const lang = normalize(saved) || (/\/en(\/|$)/.test(location.pathname) ? 'en' : null)
    || normalize((navigator.languages && navigator.languages[0]) || navigator.language || 'es') || 'en';
  document.documentElement.lang = lang;
  return { choices, normalize, lang, locale: choices.find(([id]) => id === lang)[2] };
})();
