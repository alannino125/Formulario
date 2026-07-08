const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 3000;
const DATA_FILE = path.join(__dirname, 'data', 'registros.json');
const PUBLIC_DIR = path.join(__dirname, 'public');

// Asegura que exista el archivo de datos
if (!fs.existsSync(DATA_FILE)) {
  fs.mkdirSync(path.dirname(DATA_FILE), { recursive: true });
  fs.writeFileSync(DATA_FILE, '[]');
}

function leerRegistros() {
  try {
    return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  } catch (e) {
    return [];
  }
}

function guardarRegistros(registros) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(registros, null, 2));
}

function esCorreoValido(correo) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo);
}

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
};

function servirArchivo(res, filePath) {
  fs.readFile(filePath, (err, contenido) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('No encontrado');
      return;
    }
    const ext = path.extname(filePath);
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
    res.end(contenido);
  });
}

function leerCuerpoJSON(req, callback) {
  let cuerpo = '';
  req.on('data', chunk => {
    cuerpo += chunk;
    if (cuerpo.length > 1e6) req.destroy(); // límite de seguridad simple
  });
  req.on('end', () => {
    try {
      callback(null, JSON.parse(cuerpo || '{}'));
    } catch (e) {
      callback(e, null);
    }
  });
}

const server = http.createServer((req, res) => {
  const url = req.url.split('?')[0];

  // --- Rutas de la API ---
  if (url === '/api/registro' && req.method === 'POST') {
    leerCuerpoJSON(req, (err, body) => {
      if (err) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ ok: false, error: 'JSON inválido' }));
      }
      const usuario = (body.usuario || '').toString().trim();
      const correo = (body.correo || '').toString().trim();

      if (!usuario || !esCorreoValido(correo)) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ ok: false, error: 'Usuario o correo inválido' }));
      }

      const registros = leerRegistros();
      registros.push({
        id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
        usuario,
        correo,
        fecha: new Date().toISOString(),
      });
      guardarRegistros(registros);

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true }));
    });
    return;
  }

  if (url === '/api/registros' && req.method === 'GET') {
    const registros = leerRegistros().slice().reverse(); // más recientes primero
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(registros));
    return;
  }

  if (url.startsWith('/api/registro/') && req.method === 'DELETE') {
    const id = url.split('/').pop();
    const registros = leerRegistros().filter(r => r.id !== id);
    guardarRegistros(registros);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: true }));
    return;
  }

  // --- Páginas y archivos estáticos ---
  let filePath;
  if (url === '/' || url === '/index.html') {
    filePath = path.join(PUBLIC_DIR, 'index.html');
  } else if (url === '/admin') {
    filePath = path.join(PUBLIC_DIR, 'admin.html');
  } else {
    filePath = path.join(PUBLIC_DIR, url);
  }

  servirArchivo(res, filePath);
});

server.listen(PORT, () => {
  console.log(`Servidor corriendo en http://localhost:${PORT}`);
  console.log(`Panel de administración en http://localhost:${PORT}/admin`);
});