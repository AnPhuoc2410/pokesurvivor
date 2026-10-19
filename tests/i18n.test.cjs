const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.join(__dirname, '..');
const source = f => fs.readFileSync(path.join(root, f), 'utf8');
const dictionaries = [...source('dev.html').matchAll(/src="(js\/data\/lang-[^"]+\.js)"/g)].map(m => m[1]);
function boot(saved = null, nav = 'en-US', pathname = '/', blocked = false) {
  const storage = { 'ps.lang': saved }, calls = [], dicts = {};
  class Canvas {
    constructor() { this.font = '16px Pixelify,sans-serif'; }
    fillText(s) { calls.push([s, this.font]); }
    strokeText(s) { calls.push([s, this.font]); }
    measureText(s) { calls.push([s, this.font]); return { width: s.length }; }
  }
  const ctx = { G: {}, navigator: { language: nav, languages: [nav] },
    location: { pathname, reload: () => calls.push('reload') },
    localStorage: { getItem: k => { if (blocked) throw Error('blocked'); return storage[k]; }, setItem: (k, v) => { storage[k] = v; } },
    document: { documentElement: {} }, CanvasRenderingContext2D: Canvas,
    confirm: s => { calls.push(s); return true; }, alert: s => calls.push(s), console };
  ctx.window = ctx;
  vm.createContext(ctx);
  const load = f => vm.runInContext(source(f), ctx, { filename: f });
  load('js/core/locales.js'); load('js/core/i18n.js');
  const add = ctx.G.I18n.add;
  ctx.G.I18n.add = (d, l = 'en', c = '') => {
    if (!c) dicts[l] = { ...dicts[l], ...d };
    add(d, l, c);
  };
  dictionaries.forEach(load);
  return { ctx, G: ctx.G, storage, calls, dicts, Canvas, load };
}
const langs = ['es', 'en', 'fr', 'it', 'pt-BR', 'zh-Hans', 'zh-Hant'];
const save = ['Guardar', 'Save', 'Enregistrer', 'Salva', 'Salvar', '保存', '儲存'];
for (const [i, lang] of langs.entries()) {
  test(`${lang}: isolated dictionary, templates, loading locale, canvas, new save notice`, () => {
    const b = boot(lang), I = b.G.I18n;
    assert.equal(I.lang, lang); assert.equal(b.ctx.document.documentElement.lang, lang);
    assert.equal(b.G.T('Guardar'), save[i]);
    assert.equal(I.f('Se guarda en la nube en {x} s.', 17).includes('17'), true);
    const c = new b.Canvas(); c.fillText('Guardar');
    assert.equal(b.calls.at(-1)[0], save[i]);
    assert.equal(c.font, '16px Pixelify,sans-serif');
    I.rawCanvas(c, 'fillText', 'Pikachu'); assert.equal(b.calls.at(-1)[0], 'Pikachu');
    assert.ok(b.G.T('Solicitud enviada a Pikachu').includes('Pikachu'));
    assert.ok(I.f('Esperando a {x}…', 'Pikachu').includes('Pikachu'));
    const nodes = {};
    const node = id => nodes[id] ||= { children: [], classList: { add() {}, remove() {} },
      replaceChildren() { this.children = []; }, appendChild(n) { this.children.push(n); } };
    b.G.UI = { $: node }; b.G.DB = { mode: 'cloud', guest: false, save: { stats: {} } };
    b.ctx.document.createElement = () => ({});
    b.load('js/ui/login.js');
    assert.equal(b.G.LoginUI.updateNotices(), true);
    assert.ok(node('savenote-body').children[0].textContent.includes('30'));
    assert.ok(!node('savenote-body').children[0].textContent.includes('10'));
    assert.equal(node('savenote-title').textContent, b.G.T('Importante: guarda tu partida'));
    assert.equal(b.G.LoginUI.updateNotices(), false);
    b.G.DB.save.stats.runs = 1;
    assert.equal(b.G.LoginUI.updateNotices(), true);
    assert.equal(node('savenote-title').textContent, b.G.T('Los rankings se han reiniciado'));
    assert.equal(node('savenote-body').children.length, 2);
    assert.equal(b.G.LoginUI.updateNotices(), false);
  });
  if (lang === 'es') continue;
  test(`${lang}: current English-key coverage and placeholder contracts`, () => {
    const { dicts, G, load } = boot(lang);
    const normalize = k => k.replace(/\{name\}/g, '{x}');
    const keys = new Set(Object.keys(dicts[lang]).map(normalize));
    assert.deepEqual(Object.keys(dicts.en).filter(k => !keys.has(normalize(k))), []);
    for (const [k, v] of Object.entries(dicts[lang])) {
      assert.equal((k.match(/\{(?:x|name)\}/g) || []).length,
        (v.match(/\{(?:x|name)\}/g) || []).length, k);
    }
    load('js/data/changelog.js');
    if (lang !== 'en') for (const entry of G.CHANGELOG.filter(e => e.d >= '2026-10-18')) {
      for (const pair of [entry.title, ...(entry.new || []), ...(entry.chg || []), ...(entry.fix || [])]) {
        assert.ok(G.I18n.has(pair[0]), pair[0]);
      }
    }
  });
}
test('locale precedence, aliases and blocked storage', () => {
  for (const [input, expected] of [['zh-TW', 'zh-Hant'], ['zh-HK', 'zh-Hant'], ['zh-Hant-HK', 'zh-Hant'],
    ['zh-CN', 'zh-Hans'], ['zh-SG', 'zh-Hans'], ['zh', 'zh-Hans'], ['zh-Hans-TW', 'zh-Hans'],
    ['pt', 'pt-BR'], ['pt-PT', 'pt-BR'], ['fr-CA', 'fr'], ['it-IT', 'it'], ['ja-JP', 'en']]) {
    assert.equal(boot(null, input).G.I18n.lang, expected, input);
  }
  assert.equal(boot('it', 'fr-FR', '/en/').G.I18n.lang, 'it');
  assert.equal(boot('unknown', 'fr-FR', '/en/').G.I18n.lang, 'en');
  assert.equal(boot(null, 'fr-FR', '/', true).G.I18n.lang, 'fr');
  assert.equal(boot(null, 'es-MX').G.I18n.lang, 'es');
});
test('switching language writes only the preference and validates input', () => {
  const b = boot('es'); b.storage['ps.cloud.fake'] = '{"coins":42}';
  b.G.I18n.set('invalid'); assert.equal(b.storage['ps.lang'], 'es');
  b.G.I18n.set('zh-Hant'); assert.equal(b.storage['ps.lang'], 'zh-Hant');
  assert.equal(b.storage['ps.cloud.fake'], '{"coins":42}'); assert.deepEqual(b.calls, ['reload']);
});
test('specific templates and later overrides beat generic patterns', () => {
  const { G } = boot('fr');
  G.I18n.add({ 'Bonjour {x}': 'Ancien {x}', '{x}).': '{x}）。' }, 'fr');
  G.I18n.add({ 'Bonjour {x}': 'Nouveau {x}', 'Le résultat ({x}).': 'Résultat : {x}' }, 'fr');
  assert.equal(G.T('Bonjour 5'), 'Nouveau 5');
  assert.equal(G.T('Le résultat (42).'), 'Résultat : 42');
});
test('Chinese move context is distinct from type; all species have names', () => {
  for (const lang of ['zh-Hans', 'zh-Hant']) {
    const b = boot(lang); b.load('js/data/pokedex.js');
    assert.notEqual(b.G.T('Psíquico'), b.G.T('Psíquico', 'move'));
    for (const p of b.G.DEX) assert.ok(b.G.I18n.has(p.name), p.name);
  }
});


test('external boot follows the shared locale without inline executable scripts', () => {
  const html = source('dev.html');
  assert.ok(html.indexOf('src="js/core/locales.js"') < html.indexOf('src="js/boot.js"'));
  for (const match of html.matchAll(/<script([^>]*)>([\s\S]*?)<\/script>/g)) {
    assert.ok(/src=/.test(match[1]) || /application\/ld\+json/.test(match[1]), 'Executable inline script');
  }
  assert.ok(html.includes("script-src 'self'"));
  for (const lang of langs) {
    const b = boot(lang), paragraphs = [{}, {}];
    b.ctx.document.querySelector = () => ({});
    b.ctx.document.querySelectorAll = () => paragraphs;
    b.load('js/boot.js');
    assert.equal(b.ctx.PS_PAGES, true);
    assert.equal(b.ctx.document.documentElement.lang, lang);
    assert.ok(paragraphs.every(p => typeof p.textContent === 'string' && p.textContent.length));
    if (lang !== 'es') assert.notEqual(paragraphs[1].textContent, 'Cargando…');
  }
});
