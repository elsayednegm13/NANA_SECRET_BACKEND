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
const CONTACT_TO = String(process.env.CONTACT_TO || 'elsayedmohamed963@gmail.com').trim();
const RESEND_API_KEY = String(process.env.RESEND_API_KEY || '').trim();
const RESEND_FROM = String(process.env.RESEND_FROM || 'NANA SECRET Website <onboarding@resend.dev>').trim();

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


function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function contactEmailTemplate(data) {
  const name = escapeHtml(data.name);
  const phone = escapeHtml(data.phone);
  const email = escapeHtml(data.email || 'غير مذكور');
  const message = escapeHtml(data.message).replace(/\n/g, '<br>');
  const date = new Date().toLocaleString('ar-EG', { timeZone: 'Africa/Cairo' });
  return `<!doctype html>
<html lang="ar" dir="rtl">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head>
<body style="margin:0;background:#f6f1e7;font-family:Arial,Tahoma,sans-serif;color:#17140f;direction:rtl;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f6f1e7;padding:28px 12px;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:680px;background:#ffffff;border-radius:18px;overflow:hidden;border:1px solid #eadfca;box-shadow:0 18px 45px rgba(23,20,15,.12);">
        <tr>
          <td style="background:linear-gradient(135deg,#17140f,#2b261c);padding:28px;text-align:center;color:#ffd400;">
            <div style="font-size:28px;font-weight:900;letter-spacing:.5px;">NANA SECRET</div>
            <div style="margin-top:8px;color:#fff;font-size:15px;">رسالة جديدة من نموذج التواصل</div>
          </td>
        </tr>
        <tr>
          <td style="padding:28px;">
            <div style="background:linear-gradient(135deg,#ffd400,#ff8c00,#ff5f00);border-radius:14px;padding:18px 22px;color:#17140f;font-size:20px;font-weight:900;text-align:center;">طلب تواصل جديد</div>
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:22px;border-collapse:separate;border-spacing:0 10px;">
              <tr><td style="width:145px;font-weight:800;color:#746b5f;">الاسم</td><td style="background:#fffaf0;border:1px solid #eadfca;border-radius:10px;padding:12px 14px;font-weight:700;">${name}</td></tr>
              <tr><td style="width:145px;font-weight:800;color:#746b5f;">الهاتف</td><td style="background:#fffaf0;border:1px solid #eadfca;border-radius:10px;padding:12px 14px;font-weight:700;direction:ltr;text-align:right;">${phone}</td></tr>
              <tr><td style="width:145px;font-weight:800;color:#746b5f;">البريد الإلكتروني</td><td style="background:#fffaf0;border:1px solid #eadfca;border-radius:10px;padding:12px 14px;font-weight:700;direction:ltr;text-align:right;">${email}</td></tr>
              <tr><td style="width:145px;font-weight:800;color:#746b5f;">وقت الإرسال</td><td style="background:#fffaf0;border:1px solid #eadfca;border-radius:10px;padding:12px 14px;font-weight:700;">${date}</td></tr>
            </table>
            <div style="margin-top:22px;">
              <div style="font-weight:900;font-size:18px;margin-bottom:10px;">تفاصيل الرسالة</div>
              <div style="background:#17140f;color:#fff;border-radius:14px;padding:18px 20px;line-height:1.8;font-size:16px;">${message}</div>
            </div>
            <div style="margin-top:24px;color:#746b5f;font-size:13px;text-align:center;">تم إرسال هذه الرسالة تلقائيًا من موقع NANA SECRET.</div>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

async function sendContactEmail(data) {
  if (!RESEND_API_KEY) {
    throw new Error('RESEND_API_KEY is required in Render Environment Variables');
  }

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      from: RESEND_FROM,
      to: [CONTACT_TO],
      reply_to: data.email || undefined,
      subject: `رسالة جديدة من موقع NANA SECRET - ${data.name}`,
      text: `الاسم: ${data.name}\nالهاتف: ${data.phone}\nالبريد: ${data.email || 'غير مذكور'}\n\nالرسالة:\n${data.message}`,
      html: contactEmailTemplate(data)
    })
  });

  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    console.error('Resend API error:', result);
    throw new Error(result.message || 'Failed to send contact email');
  }
  return result;
}

function saveDataUrlImage(dataUrl, prefix = 'image') {
  if (!/^data:image\//i.test(String(dataUrl || ''))) return dataUrl;
  const match = String(dataUrl).match(/^data:(image\/(png|jpe?g|webp|gif|svg\+xml));base64,(.+)$/i);
  if (!match) return dataUrl;
  const mime = match[1].toLowerCase();
  const extMap = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/jpg': 'jpg', 'image/webp': 'webp', 'image/gif': 'gif', 'image/svg+xml': 'svg' };
  const ext = extMap[mime] || 'png';
  const buffer = Buffer.from(match[3], 'base64');
  if (!buffer.length || buffer.length > 5 * 1024 * 1024) {
    throw new Error('Image must be less than 5 MB');
  }
  const filename = `${prefix}-${Date.now()}-${crypto.randomBytes(4).toString('hex')}.${ext}`;
  const fullPath = path.join(ROOT, 'uploads', filename);
  fs.writeFileSync(fullPath, buffer);
  return `/uploads/${filename}`;
}

function prepareImageInput(input = {}, prefix = 'image') {
  const output = { ...input };
  if (output.imageUrl && /^data:image\//i.test(String(output.imageUrl))) {
    output.imageUrl = saveDataUrlImage(output.imageUrl, prefix);
  }
  return output;
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


app.post('/api/contact', async (req, res, next) => {
  try {
    const data = {
      name: String(req.body.name || '').trim(),
      phone: String(req.body.phone || '').trim(),
      email: String(req.body.email || '').trim(),
      message: String(req.body.message || '').trim()
    };
    if (!data.name || !data.phone || !data.message) {
      return res.status(400).json({ error: 'Name, phone, and message are required' });
    }
    await sendContactEmail(data);
    res.json({ ok: true, message: 'Message sent successfully' });
  } catch (e) { next(e); }
});

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
    const post = normalizeNews(prepareImageInput(req.body, 'news'));
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
    const post = normalizeNews(prepareImageInput({ ...req.body, id: req.params.id }, 'news'), existing);
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
      const post = normalizeNews(prepareImageInput(item, 'news'));
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
    const p = normalizeProduct(prepareImageInput(req.body, 'product'));
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
    const p = normalizeProduct(prepareImageInput(req.body, 'product'), existing);
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
