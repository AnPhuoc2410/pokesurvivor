const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = path.resolve(__dirname, '..');
const DEV = path.join(ROOT, 'dev.html');
const OUT = path.join(ROOT, 'index.html');
const BEGIN = '<!-- scripts:begin -->';
const END = '<!-- scripts:end -->';

const dev = fs.readFileSync(DEV, 'utf8');
const i = dev.indexOf(BEGIN), j = dev.indexOf(END);
if (i < 0 || j < 0) throw new Error('dev.html thieu the ' + BEGIN + ' / ' + END);

const block = dev.slice(i, j + END.length);
const files = [...block.matchAll(/<script[^>]*src="(js\/[^"]+\.js)"/g)].map(m => m[1])
  .filter(f => f !== 'js/core/firebase-config.js');

console.log('[INFO] Loai bo firebase-config.js khoi app.min.js de tranh lo secret key len GitHub.');

// Gộp các file
let joined = files.map(f => `/* ${f} */\n` + fs.readFileSync(path.join(ROOT, f), 'utf8')).join('\n;\n');

const WIN_G = 'window.G = window.G || {};';
if (joined.includes(WIN_G)) {
  joined = joined.replace(WIN_G, WIN_G + ' G.BUILT = true;');
}
joined = '(() => {\n' + joined.replace(WIN_G, 'var G = window.G = window.G || {};') + '\n})();\n';

const outJs = path.join(ROOT, 'js', 'app.min.js');
fs.writeFileSync(outJs, joined);

// Tinh hash
const min = fs.readFileSync(outJs);
const css = fs.readFileSync(path.join(ROOT, 'css', 'style.css'));
const hash = crypto.createHash('sha1').update(min).update(css).digest('hex').slice(0, 10);

// Cap nhat version.json
fs.writeFileSync(path.join(ROOT, 'version.json'), JSON.stringify({ v: hash, at: new Date().toISOString() }) + '\n');

// Cap nhat index.html (nap firebase-config.js rieng, khong bundle vao app.min.js)
let html = dev.slice(0, i) + `<script defer src="js/core/firebase-config.js"></script>\n<script defer src="js/app.min.js?v=${hash}"></script>` + dev.slice(j + END.length);
const LOC = '<script src="js/core/locales.js"></script>';
if (dev.includes(LOC)) {
  const locHash = crypto.createHash('sha1').update(fs.readFileSync(path.join(ROOT, 'js', 'core', 'locales.js'))).digest('hex').slice(0, 10);
  html = html.replace(LOC, `<script src="js/core/locales.js?v=${locHash}"></script>`);
}
const CSS = '<link rel="stylesheet" href="css/style.css">';
if (dev.includes(CSS)) {
  const cssHash = crypto.createHash('sha1').update(css).digest('hex').slice(0, 10);
  html = html.replace(CSS, `<link rel="stylesheet" href="css/style.css?v=${cssHash}">`);
}
html = html.replace(/<meta name="robots" content="noindex">\s*/, '');
html = html.replace(/<!-- seo:(begin|end) -->\n?/g, '');
html = html.replace(/<!-- dev.html: página fuente[^>]*-->/, '<!-- GENERADO desde dev.html por tools/build.js: no editar a mano (se edita dev.html). -->');

fs.writeFileSync(OUT, html);

// Cap nhat en/index.html neu co
const enPath = path.join(ROOT, 'en', 'index.html');
if (fs.existsSync(enPath)) {
  let en = fs.readFileSync(enPath, 'utf8');
  en = en.replace(/js\/app\.min\.js\?v=[a-f0-9]+/, 'js/app.min.js?v=' + hash);
  if (!en.includes('js/core/firebase-config.js')) {
    en = en.replace('<script defer src="js/app.min.js', '<script defer src="js/core/firebase-config.js"></script>\n<script defer src="js/app.min.js');
  }
  fs.writeFileSync(enPath, en);
}

console.log(`[THANH CONG] Da dong goi ${files.length} scripts vao app.min.js va cap nhat index.html (hash: ${hash})`);

