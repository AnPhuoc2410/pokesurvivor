const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const crypto = require('node:crypto');
const root = path.join(__dirname, '..');

test('Windows build handles a checkout with spaces and missing optional Firebase config', () => {
  const calls = [], writes = new Map();
  const fakeFs = { ...fs, mkdirSync() {},
    writeFileSync: (f, data) => writes.set(f, data),
    readFileSync(f, encoding) {
      if (writes.has(f)) return encoding ? String(writes.get(f)) : Buffer.from(writes.get(f));
      return fs.readFileSync(f, encoding);
    },
    existsSync: f => f.endsWith('firebase-config.js') ? false : fs.existsSync(f)
  };
  const requireMock = name => name === 'fs' ? fakeFs : name === './build_langs' ? { build: () => [] }
    : name === 'child_process' ? { execFileSync: (cmd, args, opts) => {
      calls.push({ cmd, args, opts });
      writes.set(path.join(root, 'js', 'app.min.js'), '/* built */');
    } } : require(name);
  vm.runInNewContext(fs.readFileSync(path.join(root, 'tools/build.js'), 'utf8'), {
    require: requireMock, __dirname: path.join(root, 'tools'), process: { argv: [], platform: 'win32' },
    console: { log() {}, warn() {} }
  });
  assert.equal(calls.length, 2);
  for (const call of calls) {
    assert.equal(call.opts.cwd, root);
    assert.equal(call.cmd, 'npx.cmd');
    assert.ok(call.args.every(a => !path.isAbsolute(a)), 'paths passed to cmd must be relative');
  }
  const html = writes.get(path.join(root, 'index.html'));
  assert.ok(html.includes('id="menu-mode"'));
  assert.ok(!html.includes('src="js/core/firebase-config.js"'));
  assert.ok(html.includes('src="js/app.min.js?v='));
  assert.ok(JSON.parse(writes.get(path.join(root, 'version.json'))).v);
});

test('both published entry pages contain the mode controls and use the current bundle hash', () => {
  const version = JSON.parse(fs.readFileSync(path.join(root, 'version.json'), 'utf8')).v;
  const hash = crypto.createHash('sha1').update(fs.readFileSync(path.join(root, 'js/app.min.js')))
    .update(fs.readFileSync(path.join(root, 'css/style.css'))).digest('hex').slice(0, 10);
  assert.equal(version, hash);
  for (const f of ['dev.html', 'index.html', 'en/index.html']) {
    const html = fs.readFileSync(path.join(root, f), 'utf8');
    assert.equal((html.match(/id="menu-mode"/g) || []).length, 1, f);
    assert.ok(html.includes('id="menu-mode-hint"'), f);
    assert.ok(html.includes('3 màn boss ngẫu nhiên, mỗi mức 1 màn'), f);
    assert.ok(html.includes('data-go="hurry-test"'), f);
    assert.ok(html.includes('id="boss-test-players"'), f);
    assert.ok(html.includes('id="boss-test-immortal"'), f);
    assert.ok(html.includes('<option value="10">10 người</option>'), f);
    if (f !== 'dev.html') assert.ok(html.includes('js/app.min.js?v=' + version), f);
  }
});
