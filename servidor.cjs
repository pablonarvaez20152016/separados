const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const files = { '/': ['index.html', 'text/html; charset=utf-8'], '/index.html': ['index.html', 'text/html; charset=utf-8'], '/app.js': ['app.js', 'text/javascript; charset=utf-8'], '/style.css': ['style.css', 'text/css; charset=utf-8'], '/logo-koquetas.png': ['logo-koquetas.png', 'image/png'], '/icono-koquetas.png': ['icono-koquetas.png', 'image/png'] };
http.createServer((req, res) => {
  const entry = files[new URL(req.url, 'http://localhost').pathname];
  if (!entry) { res.writeHead(404); return res.end('No encontrado'); }
  fs.readFile(path.join(__dirname, entry[0]), (err, contents) => {
    if (err) { res.writeHead(500); return res.end('Error al leer el archivo'); }
    res.writeHead(200, { 'Content-Type': entry[1], 'Cache-Control': 'no-store' });
    res.end(contents);
  });
}).listen(8000, '127.0.0.1', () => console.log('Abre http://localhost:8000 en este computador. Presiona Ctrl+C para detener.'));
