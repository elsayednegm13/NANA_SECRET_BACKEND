const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const express = require('express');
const sqlite3 = require('sqlite3').verbose();
require('dotenv').config();

const app = express();
const PORT = Number(process.env.PORT || 4000);
const ADMIN_USER = String(process.env.ADMIN_USER || 'ADMIN').trim();
const ADMIN_PASS = String(process.env.ADMIN_PASS || '123').trim();
const SESSION_SECRET = String(process.env.SESSION_SECRET || 'local-secret');
const ROOT = __dirname;
const DB_PATH = path.join(ROOT, 'data', 'nana-secret.sqlite');

fs.mkdirSync(path.join(ROOT, 'data'), { recursive: true });
fs.mkdirSync(path.join(ROOT, 'uploads'), { recursive: true });

app.use(express.json({ limit: '25mb' }));
app.use(express.urlencoded({ extended: true, limit: '25mb' }));
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

const db = new sqlite3.Database(DB_PATH);
const sessions = new Set();

function run(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) reject(err);
      else resolve(this);
    });
  });
}
function all(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => err ? reject(err) : resolve(rows));
  });
}
function get(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => err ? reject(err) : resolve(row));
  });
}
function uid(prefix) {
  return `${prefix}-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
}
function normalizeNews(input = {}, existing = {}) {
  const now = new Date().toISOString();
  return {
    id: existing.id || input.id || uid('news'),
    createdAt: existing.createdAt || input.createdAt || now,
    updatedAt: now,
    titleAr: String(input.titleAr || '').trim(),
    titleEn: String(input.titleEn || input.titleAr || '').trim(),
    authorAr: String(input.authorAr || 'من الإدارة').trim(),
    authorEn: String(input.authorEn || 'From Management').trim(),
    dateAr: String(input.dateAr || '').trim(),
    dateEn: String(input.dateEn || input.dateAr || '').trim(),
    excerptAr: String(input.excerptAr || '').trim(),
    excerptEn: String(input.excerptEn || input.excerptAr || '').trim(),
    bodyAr: String(input.bodyAr || '').trim(),
    bodyEn: String(input.bodyEn || input.bodyAr || '').trim(),
    imageUrl: String(input.imageUrl || 'assets/images/news-chairman.svg').trim(),
    videoUrl: String(input.videoUrl || '').trim()
  };
}
function normalizeProduct(input = {}, existing = {}) {
  const now = new Date().toISOString();
  return {
    id: Number(existing.id || input.id || 0) || null,
    ar: String(input.ar || input.nameAr || '').trim(),
    en: String(input.en || input.nameEn || input.ar || input.nameAr || '').trim(),
    categoryAr: String(input.categoryAr || 'منتجات أخرى').trim(),
    categoryEn: String(input.categoryEn || 'Other products').trim(),
    imageUrl: String(input.imageUrl || 'assets/images/product-placeholder.svg').trim(),
    createdAt: existing.createdAt || input.createdAt || now,
    updatedAt: now
  };
}
async function initDb() {
  await run(`CREATE TABLE IF NOT EXISTS news (
    id TEXT PRIMARY KEY,
    createdAt TEXT NOT NULL,
    updatedAt TEXT NOT NULL,
    titleAr TEXT NOT NULL,
    titleEn TEXT,
    authorAr TEXT,
    authorEn TEXT,
    dateAr TEXT,
    dateEn TEXT,
    excerptAr TEXT,
    excerptEn TEXT,
    bodyAr TEXT,
    bodyEn TEXT,
    imageUrl TEXT,
    videoUrl TEXT
  )`);
  await run(`CREATE TABLE IF NOT EXISTS products (
    id INTEGER PRIMARY KEY,
    ar TEXT NOT NULL,
    en TEXT,
    categoryAr TEXT,
    categoryEn TEXT,
    imageUrl TEXT,
    createdAt TEXT NOT NULL,
    updatedAt TEXT NOT NULL
  )`);
  const count = await get('SELECT COUNT(*) AS count FROM products');
  if (!count || count.count === 0) {
    const seedPath = path.join(ROOT, 'data', 'products-seed.json');
    if (fs.existsSync(seedPath)) {
      const products = JSON.parse(fs.readFileSync(seedPath, 'utf8'));
      for (const item of products) {
        const p = normalizeProduct(item);
        await run(`INSERT INTO products (id, ar, en, categoryAr, categoryEn, imageUrl, createdAt, updatedAt)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)`, [p.id, p.ar, p.en, p.categoryAr, p.categoryEn, p.imageUrl, p.createdAt, p.updatedAt]);
      }
    }
  }
}
function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.replace(/^Bearer\s+/i, '');
  if (!token || !sessions.has(token)) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
}

app.post('/api/login', (req, res) => {
  const username = String(req.body.username || '').trim();
  const password = String(req.body.password || '').trim();
  if (username.toUpperCase() !== ADMIN_USER.toUpperCase() || password !== ADMIN_PASS) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }
  const token = crypto.createHmac('sha256', SESSION_SECRET)
    .update(`${username}:${Date.now()}:${crypto.randomBytes(8).toString('hex')}`)
    .digest('hex');
  sessions.add(token);
  res.json({ token, user: ADMIN_USER });
});
app.post('/api/logout', requireAuth, (req, res) => {
  const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  sessions.delete(token);
  res.json({ ok: true });
});
app.get('/api/news', async (req, res, next) => {
  try { res.json(await all('SELECT * FROM news ORDER BY updatedAt DESC, createdAt DESC')); }
  catch (e) { next(e); }
});
app.post('/api/news', requireAuth, async (req, res, next) => {
  try {
    const post = normalizeNews(req.body);
    if (!post.titleAr || !post.bodyAr || !post.excerptAr) return res.status(400).json({ error: 'Missing required fields' });
    await run(`INSERT INTO news (id, createdAt, updatedAt, titleAr, titleEn, authorAr, authorEn, dateAr, dateEn, excerptAr, excerptEn, bodyAr, bodyEn, imageUrl, videoUrl)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [post.id, post.createdAt, post.updatedAt, post.titleAr, post.titleEn, post.authorAr, post.authorEn, post.dateAr, post.dateEn, post.excerptAr, post.excerptEn, post.bodyAr, post.bodyEn, post.imageUrl, post.videoUrl]);
    res.status(201).json(post);
  } catch (e) { next(e); }
});
app.put('/api/news/:id', requireAuth, async (req, res, next) => {
  try {
    const existing = await get('SELECT * FROM news WHERE id = ?', [req.params.id]);
    if (!existing) return res.status(404).json({ error: 'Not found' });
    const post = normalizeNews({ ...req.body, id: req.params.id }, existing);
    await run(`UPDATE news SET updatedAt=?, titleAr=?, titleEn=?, authorAr=?, authorEn=?, dateAr=?, dateEn=?, excerptAr=?, excerptEn=?, bodyAr=?, bodyEn=?, imageUrl=?, videoUrl=? WHERE id=?`,
      [post.updatedAt, post.titleAr, post.titleEn, post.authorAr, post.authorEn, post.dateAr, post.dateEn, post.excerptAr, post.excerptEn, post.bodyAr, post.bodyEn, post.imageUrl, post.videoUrl, post.id]);
    res.json(post);
  } catch (e) { next(e); }
});
app.delete('/api/news/:id', requireAuth, async (req, res, next) => {
  try { await run('DELETE FROM news WHERE id = ?', [req.params.id]); res.json({ ok: true }); }
  catch (e) { next(e); }
});
app.put('/api/news/import/replace', requireAuth, async (req, res, next) => {
  try {
    const posts = Array.isArray(req.body) ? req.body : [];
    await run('DELETE FROM news');
    for (const item of posts) {
      const post = normalizeNews(item);
      await run(`INSERT INTO news (id, createdAt, updatedAt, titleAr, titleEn, authorAr, authorEn, dateAr, dateEn, excerptAr, excerptEn, bodyAr, bodyEn, imageUrl, videoUrl)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [post.id, post.createdAt, post.updatedAt, post.titleAr, post.titleEn, post.authorAr, post.authorEn, post.dateAr, post.dateEn, post.excerptAr, post.excerptEn, post.bodyAr, post.bodyEn, post.imageUrl, post.videoUrl]);
    }
    res.json({ ok: true, count: posts.length });
  } catch (e) { next(e); }
});
app.get('/api/products', async (req, res, next) => {
  try { res.json(await all('SELECT * FROM products ORDER BY id ASC')); }
  catch (e) { next(e); }
});
app.post('/api/products', requireAuth, async (req, res, next) => {
  try {
    const p = normalizeProduct(req.body);
    if (!p.ar) return res.status(400).json({ error: 'Product name is required' });
    const result = await run(`INSERT INTO products (ar, en, categoryAr, categoryEn, imageUrl, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [p.ar, p.en, p.categoryAr, p.categoryEn, p.imageUrl, p.createdAt, p.updatedAt]);
    p.id = result.lastID;
    res.status(201).json(p);
  } catch (e) { next(e); }
});
app.put('/api/products/:id', requireAuth, async (req, res, next) => {
  try {
    const existing = await get('SELECT * FROM products WHERE id = ?', [req.params.id]);
    if (!existing) return res.status(404).json({ error: 'Not found' });
    const p = normalizeProduct(req.body, existing);
    await run(`UPDATE products SET ar=?, en=?, categoryAr=?, categoryEn=?, imageUrl=?, updatedAt=? WHERE id=?`,
      [p.ar, p.en, p.categoryAr, p.categoryEn, p.imageUrl, p.updatedAt, req.params.id]);
    res.json({ ...p, id: Number(req.params.id) });
  } catch (e) { next(e); }
});
app.delete('/api/products/:id', requireAuth, async (req, res, next) => {
  try { await run('DELETE FROM products WHERE id = ?', [req.params.id]); res.json({ ok: true }); }
  catch (e) { next(e); }
});

app.use('/uploads', express.static(path.join(ROOT, 'uploads')));
app.use(express.static(ROOT));
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Server error', details: err.message });
});

initDb().then(() => {
  app.listen(PORT, () => {
    console.log(`NANA SECRET is running on http://localhost:${PORT}`);
  });
}).catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
