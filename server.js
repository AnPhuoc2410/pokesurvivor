const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');

const PORT = process.env.PORT || 3000;
const ROOT = __dirname;

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.cjs': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.ttf': 'font/ttf',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.mp3': 'audio/mpeg',
  '.ogg': 'audio/ogg',
  '.wav': 'audio/wav',
  '.webm': 'video/webm',
  '.webmanifest': 'application/manifest+json'
};

function getLocalIPs() {
  const ips = [];
  const ifaces = os.networkInterfaces();
  for (const name of Object.keys(ifaces)) {
    for (const net of ifaces[name]) {
      if (net.family === 'IPv4' && !net.internal) {
        ips.push({ name, address: net.address });
      }
    }
  }
  return ips;
}

const server = http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', '*');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  let reqPath = decodeURI(req.url.split('?')[0]);

  // Alias /dev -> dev.html
  if (reqPath === '/dev' || reqPath === '/dev/') {
    reqPath = '/dev.html';
  } else if (reqPath === '/' || reqPath === '') {
    reqPath = '/index.html';
  }

  const safePath = path.normalize(path.join(ROOT, reqPath));
  if (!safePath.startsWith(ROOT)) {
    res.writeHead(403);
    res.end('403 Forbidden');
    return;
  }

  fs.stat(safePath, (err, stats) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('404 Not Found: ' + reqPath);
      return;
    }

    let filePath = safePath;
    if (stats.isDirectory()) {
      filePath = path.join(safePath, 'index.html');
    }

    fs.readFile(filePath, (readErr, content) => {
      if (readErr) {
        res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('500 Server Error');
        return;
      }
      const ext = path.extname(filePath).toLowerCase();
      const contentType = MIME_TYPES[ext] || 'application/octet-stream';
      res.writeHead(200, { 'Content-Type': contentType });
      res.end(content);
    });
  });
});

server.listen(PORT, () => {
  console.log('====================================================');
  console.log(`  PokeSurvivor Local Server dang chay tren cong ${PORT}`);
  console.log('====================================================');
  console.log(`- Cho may cua ban (Localhost):`);
  console.log(`    http://localhost:${PORT}/`);
  console.log(`    http://localhost:${PORT}/dev.html`);
  console.log(`- Cho ban be trong mang LAN / Wi-Fi:`);
  const ips = getLocalIPs();
  for (const ip of ips) {
    console.log(`    http://${ip.address}:${PORT}/   (${ip.name})`);
  }
  console.log('====================================================');
  console.log('Nhan Ctrl+C de dung server.\n');
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`[LOI] Cong ${PORT} dang duoc su dung boi ung dung khac!`);
    console.error(`Ban co the doi cong bang cach: set PORT=3001 && node server.js`);
  } else {
    console.error('[LOI]', err.message);
  }
});
