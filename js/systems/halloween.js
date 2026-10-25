/* ============ halloween.js — el evento de Halloween (30-10 al 1-11) ============
 * Del 30 de octubre al 1 de noviembre (hora de España, de cualquier año) el
 * juego cambia solo; el 2 vuelve todo a la normalidad. Nada de esto usa
 * Firebase: los caramelos y las skins van en la partida que ya se guarda.
 *
 *   - mapa de Halloween (biomas de noche con calabazas: world/tiles.js, world/world.js)
 *   - más Pokémon Fantasma (data/enemies.js)
 *   - caramelos (bag.candy): los sueltan sobre todo los Fantasma y las calabazas
 *   - Tienda Kecleon: Kecleon con sombrero de bruja y tres skins por caramelos
 *   - gacha: banner Noche Espectral (Fantasma de todas las regiones, shiny ×2)
 *   - minuto 30: en vez de Arceus sale el gran Gengar bruja (systems/judgment.js)
 *
 * Una partida empezada durante el evento lo es hasta que acaba (runStart).
 * Para probarlo otro día: ?halloween=1 (o =0) con ?dev o en localhost.
 */
G.Halloween = (() => {
  const TZ = 'Europe/Madrid';
  function madrid(date) {
    const p = {};
    for (const x of new Intl.DateTimeFormat('en-CA', { timeZone: TZ, month: '2-digit', day: '2-digit' }).formatToParts(date)) p[x.type] = x.value;
    return { m: +p.month, d: +p.day };
  }
  /** ¿Es Halloween en esta fecha? (30-10, 31-10 y 1-11.) */
  function isOn(date = new Date()) { const { m, d } = madrid(date); return (m === 10 && d >= 30) || (m === 11 && d === 1); }

  // Forzarlo para probar (sólo en pruebas: ?dev o el juego en este ordenador).
  let force = null;
  try {
    const q = new URLSearchParams(location.search), local = /^(localhost|127\.0\.0\.1)$/.test(location.hostname) || location.protocol === 'file:';
    if ((q.has('dev') || local) && q.has('halloween')) sessionStorage.setItem('ps.halloween', q.get('halloween') === '0' ? '0' : '1');
    const v = (q.has('dev') || local) ? sessionStorage.getItem('ps.halloween') : null;
    if (v != null) force = v === '1';
  } catch (e) { /* nada */ }

  let run = null;                  // ¿la partida en curso es de Halloween?
  const on = () => (force != null ? force : isOn());

  /*
   * Caramelos. Precio de cada skin: SKIN_PRICE. Lo que sale en una partida va
   * con el tiempo aguantado, no con lo que derrotas (si no, quien mata mucho
   * sacaría diez veces más): como mucho RATE por minuto, y JUDGE de golpe al
   * llegar al gran Gengar (minuto 30). Una partida floja (~8 min) da ~10 (unas
   * 30 por skin); una que llega a Gengar, ~100 (unas 3 por skin).
   */
  const SKIN_PRICE = 300, RATE = 1.25, JUDGE = 60;
  let dropped = 0;                 // caramelos soltados en esta partida (de los que van con el tiempo)
  /** ¿Puede soltarse otro caramelo a los `t` segundos? (y lo cuenta) */
  function takeCandy(t, need = 1) {
    if (!run) return false;
    if (Math.floor(t / 60 * RATE) - dropped < need) return false;
    dropped++;
    return true;
  }

  return {
    SKIN_PRICE, JUDGE, isOn, takeCandy,
    /** ¿Es Halloween ahora (menús, tienda, gacha)? */
    get on() { return on(); },
    /** ¿La partida en curso es de Halloween? (fuera de partida, lo de ahora) */
    get inRun() { return run != null ? run : on(); },
    /** Al empezar una partida: lo que sea ahora vale hasta que acabe. En grupo, lo dice el anfitrión. */
    runStart(hw) { run = hw == null ? on() : !!hw; dropped = 0; },
    runEnd() { run = null; }
  };
})();
