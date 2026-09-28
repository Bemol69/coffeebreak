const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const express = require('express');
const multer = require('multer');

// Carga simple de .env (sin dependencias)
const envPath = path.join(__dirname, '.env');
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i);
    if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
}

const PORT = process.env.PORT || 3000;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'cafe-break-2026';
const DATA_DIR = path.join(__dirname, 'data');
const CONTENT_FILE = path.join(DATA_DIR, 'content.json');
const SEED_FILE = path.join(DATA_DIR, 'seed.json');
const UPLOAD_DIR = path.join(__dirname, 'public', 'uploads');

fs.mkdirSync(UPLOAD_DIR, { recursive: true });
if (!fs.existsSync(CONTENT_FILE)) fs.copyFileSync(SEED_FILE, CONTENT_FILE);

const readContent = () => JSON.parse(fs.readFileSync(CONTENT_FILE, 'utf8'));
const writeContent = (data) => {
  const tmp = CONTENT_FILE + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2));
  fs.renameSync(tmp, CONTENT_FILE);
};

// Sesiones en memoria: token -> expiración
const sessions = new Map();
const SESSION_MS = 1000 * 60 * 60 * 8;

function getToken(req) {
  const cookie = req.headers.cookie || '';
  const m = cookie.match(/(?:^|;\s*)cb_admin=([a-f0-9]+)/);
  return m ? m[1] : null;
}

function requireAuth(req, res, next) {
  const token = getToken(req);
  const exp = token && sessions.get(token);
  if (!exp || exp < Date.now()) {
    if (token) sessions.delete(token);
    return res.status(401).json({ error: 'No autorizado' });
  }
  sessions.set(token, Date.now() + SESSION_MS);
  next();
}

function safeEqual(a, b) {
  const ha = crypto.createHash('sha256').update(String(a)).digest();
  const hb = crypto.createHash('sha256').update(String(b)).digest();
  return crypto.timingSafeEqual(ha, hb);
}

const upload = multer({
  storage: multer.diskStorage({
    destination: UPLOAD_DIR,
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase() || '.jpg';
      cb(null, `${Date.now()}-${crypto.randomBytes(4).toString('hex')}${ext}`);
    },
  }),
  limits: { fileSize: 8 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ok = /^image\/(jpeg|png|webp|gif|avif)$/.test(file.mimetype);
    cb(ok ? null : new Error('Formato de imagen no permitido'), ok);
  },
});

const app = express();
app.disable('x-powered-by');
app.use(express.json({ limit: '2mb' }));

// ---------- API pública ----------
app.get('/api/content', (req, res) => {
  res.set('Cache-Control', 'no-store');
  res.json(readContent());
});

// ---------- API admin ----------
app.post('/api/login', (req, res) => {
  const { password } = req.body || {};
  if (!password || !safeEqual(password, ADMIN_PASSWORD)) {
    return res.status(401).json({ error: 'Contraseña incorrecta' });
  }
  const token = crypto.randomBytes(24).toString('hex');
  sessions.set(token, Date.now() + SESSION_MS);
  res.set('Set-Cookie', `cb_admin=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${SESSION_MS / 1000}`);
  res.json({ ok: true });
});

app.post('/api/logout', (req, res) => {
  const token = getToken(req);
  if (token) sessions.delete(token);
  res.set('Set-Cookie', 'cb_admin=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0');
  res.json({ ok: true });
});

app.get('/api/session', requireAuth, (req, res) => res.json({ ok: true }));

app.put('/api/content', requireAuth, (req, res) => {
  const data = req.body;
  if (!data || typeof data !== 'object' || !data.site || !Array.isArray(data.products)) {
    return res.status(400).json({ error: 'Contenido inválido' });
  }
  writeContent(data);
  res.json({ ok: true });
});

app.post('/api/upload', requireAuth, (req, res) => {
  upload.single('image')(req, res, (err) => {
    if (err) return res.status(400).json({ error: err.message });
    if (!req.file) return res.status(400).json({ error: 'No se recibió imagen' });
    res.json({ url: `/uploads/${req.file.filename}` });
  });
});

app.post('/api/reset', requireAuth, (req, res) => {
  fs.copyFileSync(SEED_FILE, CONTENT_FILE);
  res.json({ ok: true });
});

// ---------- Páginas ----------
app.use(express.static(path.join(__dirname, 'public'), { extensions: ['html'] }));
app.get('/admin', (req, res) => res.sendFile(path.join(__dirname, 'public', 'admin', 'index.html')));
app.use((req, res) => res.status(404).sendFile(path.join(__dirname, 'public', 'index.html')));

app.listen(PORT, () => {
  console.log(`Coffee Break listo en http://localhost:${PORT}`);
  console.log(`Panel admin en http://localhost:${PORT}/admin`);
});
