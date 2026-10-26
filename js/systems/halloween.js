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

  /** La medianoche de España de ese día, como instante (con el horario de verano o invierno que toque). */
  function madridMidnight(y, m, d) {
    const guess = Date.UTC(y, m - 1, d);
    const p = {};
    for (const x of new Intl.DateTimeFormat('en-CA', { timeZone: TZ, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit' }).formatToParts(guess)) p[x.type] = x.value;
    const off = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute) - guess;      // lo que va España por delante
    return guess - off;
  }
  /*
   * Cuenta atrás del menú: SOON días antes, cuánto falta para que empiece; durante
   * el evento, cuánto queda. → { on, ms } o null (el resto del año).
   */
  const SOON = 14 * 864e5;
  function countdown(now = Date.now()) {
    const y = +new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric' }).format(now);
    for (const yy of [y - 1, y]) {
      const start = madridMidnight(yy, 10, 30), end = madridMidnight(yy, 11, 2);
      if (now >= start && now < end) return { on: true, ms: end - now };
      if (now < start && start - now <= SOON) return { on: false, ms: start - now };
    }
    return null;
  }

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
    SKIN_PRICE, JUDGE, isOn, takeCandy, countdown,
    /** ¿Es Halloween ahora (menús, tienda, gacha)? */
    get on() { return on(); },
    /** ¿La partida en curso es de Halloween? (fuera de partida, lo de ahora) */
    get inRun() { return run != null ? run : on(); },
    /** Al empezar una partida: lo que sea ahora vale hasta que acabe. En grupo, lo dice el anfitrión. */
    runStart(hw) { run = hw == null ? on() : !!hw; dropped = 0; },
    runEnd() { run = null; }
  };
})();
