const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const {
  PORT, ADMIN_USER, ADMIN_PASS, SESSION_SECRET, DATA_DIR, DB_PATH, SEED_PATH,
  UPLOADS_DIR, ALLOWED_ORIGINS, CONTACT_TO, RESEND_API_KEY, RESEND_FROM
} = require('./config');

const app = express();
app.disable('x-powered-by');
fs.mkdirSync(DATA_DIR, { recursive: true });
fs.mkdirSync(UPLOADS_DIR, { recursive: true });

app.use((req, res, next) => {
  const origin = req.get('Origin');
  res.vary('Origin');
  if (origin) {
    if (!ALLOWED_ORIGINS.includes(origin)) {
      return res.status(403).json({ error: 'Origin is not allowed' });
    }
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  }
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});
app.use(express.json({ limit: '25mb' }));
app.use(express.urlencoded({ extended: true, limit: '25mb' }));

const db = new sqlite3.Database(DB_PATH);
const sessions = new Map();

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
function hashPassword(password) {
  return crypto.createHash('sha256').update(String(password || '') + ':' + SESSION_SECRET).digest('hex');
}
function publicUser(row) {
  return row ? { username: row.username, name: row.name || row.username, createdAt: row.createdAt, updatedAt: row.updatedAt } : null;
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
  const fullPath = path.join(UPLOADS_DIR, filename);
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
    videoUrl: String(input.videoUrl || '').trim(),
    isPublished: input.isPublished === undefined ? (existing.isPublished === undefined ? 1 : Number(existing.isPublished)) : (Number(input.isPublished) === 0 ? 0 : 1),
    sortOrder: Number(input.sortOrder ?? existing.sortOrder ?? 0) || 0
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
    updatedAt: now,
    isPublished: input.isPublished === undefined ? (existing.isPublished === undefined ? 1 : Number(existing.isPublished)) : (Number(input.isPublished) === 0 ? 0 : 1)
  };
}
function normalizeContent(input = {}, existing = {}) {
  const now = new Date().toISOString();
  return {
    page: String(input.page || existing.page || '').trim(),
    key: String(input.key || existing.key || '').trim(),
    ar: String(input.ar || '').trim(),
    en: String(input.en || input.ar || '').trim(),
    createdAt: existing.createdAt || input.createdAt || now,
    updatedAt: now,
    updatedBy: String(input.updatedBy || existing.updatedBy || ADMIN_USER).trim()
  };
}

function normalizeGallery(input = {}, existing = {}) {
  const now = new Date().toISOString();
  return {
    id: existing.id || input.id || uid('gallery'),
    createdAt: existing.createdAt || input.createdAt || now,
    updatedAt: now,
    imageUrl: String(input.imageUrl || existing.imageUrl || 'assets/images/event-1.jpg').trim(),
    captionAr: String(input.captionAr || existing.captionAr || '').trim(),
    captionEn: String(input.captionEn || input.captionAr || existing.captionEn || existing.captionAr || '').trim(),
    displayMode: String(input.displayMode || existing.displayMode || 'grid').trim() === 'wide' ? 'wide' : 'grid',
    isPublished: input.isPublished === undefined ? (existing.isPublished === undefined ? 1 : Number(existing.isPublished)) : (Number(input.isPublished) === 0 ? 0 : 1),
    sortOrder: Number(input.sortOrder ?? existing.sortOrder ?? 0) || 0
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
    videoUrl TEXT,
    isPublished INTEGER DEFAULT 1,
    sortOrder INTEGER DEFAULT 0
  )`);
  await run(`CREATE TABLE IF NOT EXISTS products (
    id INTEGER PRIMARY KEY,
    ar TEXT NOT NULL,
    en TEXT,
    categoryAr TEXT,
    categoryEn TEXT,
    imageUrl TEXT,
    createdAt TEXT NOT NULL,
    updatedAt TEXT NOT NULL,
    isPublished INTEGER DEFAULT 1,
    sortOrder INTEGER DEFAULT 0
  )`);
  const newsColumns = await all('PRAGMA table_info(news)');
  const newsColumnNames = newsColumns.map((col) => col.name);
  if (!newsColumnNames.includes('isPublished')) await run('ALTER TABLE news ADD COLUMN isPublished INTEGER DEFAULT 1');
  if (!newsColumnNames.includes('sortOrder')) await run('ALTER TABLE news ADD COLUMN sortOrder INTEGER DEFAULT 0');
  const productColumns = await all('PRAGMA table_info(products)');
  const productColumnNames = productColumns.map((col) => col.name);
  if (!productColumnNames.includes('isPublished')) await run('ALTER TABLE products ADD COLUMN isPublished INTEGER DEFAULT 1');
  await run(`CREATE TABLE IF NOT EXISTS users (
    username TEXT PRIMARY KEY,
    name TEXT,
    passwordHash TEXT,
    createdAt TEXT NOT NULL,
    updatedAt TEXT NOT NULL
  )`);
  const userColumns = await all('PRAGMA table_info(users)');
  const userColumnNames = userColumns.map((col) => col.name);
  if (!userColumnNames.includes('name')) await run('ALTER TABLE users ADD COLUMN name TEXT');
  if (!userColumnNames.includes('passwordHash')) await run('ALTER TABLE users ADD COLUMN passwordHash TEXT');
  await run(`CREATE TABLE IF NOT EXISTS page_content (
    page TEXT NOT NULL,
    key TEXT NOT NULL,
    ar TEXT,
    en TEXT,
    createdAt TEXT NOT NULL,
    updatedAt TEXT NOT NULL,
    updatedBy TEXT,
    PRIMARY KEY (page, key)
  )`);
  await run(`CREATE TABLE IF NOT EXISTS gallery_images (
    id TEXT PRIMARY KEY,
    createdAt TEXT NOT NULL,
    updatedAt TEXT NOT NULL,
    imageUrl TEXT NOT NULL,
    captionAr TEXT,
    captionEn TEXT,
    displayMode TEXT DEFAULT 'grid',
    isPublished INTEGER DEFAULT 1,
    sortOrder INTEGER DEFAULT 0
  )`);
  const galleryColumns = await all('PRAGMA table_info(gallery_images)');
  const galleryColumnNames = galleryColumns.map((col) => col.name);
  if (!galleryColumnNames.includes('displayMode')) await run('ALTER TABLE gallery_images ADD COLUMN displayMode TEXT DEFAULT \'grid\'');
  if (!galleryColumnNames.includes('isPublished')) await run('ALTER TABLE gallery_images ADD COLUMN isPublished INTEGER DEFAULT 1');
  if (!galleryColumnNames.includes('sortOrder')) await run('ALTER TABLE gallery_images ADD COLUMN sortOrder INTEGER DEFAULT 0');
  const adminUserRow = await get('SELECT username FROM users WHERE username = ?', [ADMIN_USER]);
  if (!adminUserRow) {
    const now = new Date().toISOString();
    await run('INSERT INTO users (username, name, passwordHash, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?)', [ADMIN_USER, ADMIN_USER, hashPassword(ADMIN_PASS), now, now]);
  }
  await run('UPDATE users SET name = COALESCE(NULLIF(name, \'\'), username), passwordHash = COALESCE(NULLIF(passwordHash, \'\'), ?) WHERE username = ?', [hashPassword(ADMIN_PASS), ADMIN_USER]);
  const count = await get('SELECT COUNT(*) AS count FROM products');
  if (!count || count.count === 0) {
    const seedPath = SEED_PATH;
    if (fs.existsSync(seedPath)) {
      const products = JSON.parse(fs.readFileSync(seedPath, 'utf8'));
      for (const item of products) {
        const p = normalizeProduct(item);
        await run(`INSERT INTO products (id, ar, en, categoryAr, categoryEn, imageUrl, createdAt, updatedAt, isPublished)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`, [p.id, p.ar, p.en, p.categoryAr, p.categoryEn, p.imageUrl, p.createdAt, p.updatedAt, p.isPublished]);
      }
    }
  }
  const newsCount = await get('SELECT COUNT(*) AS count FROM news');
  if (!newsCount || newsCount.count === 0) {
    const defaultNews = [
      {
        id: 'foundation-stone',
        titleAr: 'حفل وضع حجر الأساس لمجمع نانا سيكريت للمنسوجات والمفروشات المنزلية',
        titleEn: 'Foundation stone ceremony for NANA SECRET textiles and home furnishings complex',
        authorAr: 'إدارة نانا سيكريت',
        authorEn: 'NANA SECRET Management',
        dateAr: '',
        dateEn: '',
        excerptAr: 'تشرفنا بالاحتفال بهذه المناسبة الهامة بوضع حجر الأساس لمجمع نانا سيكريت للمنسوجات والمفروشات المنزلية.',
        excerptEn: 'We were honored to celebrate laying the foundation stone for the NANA SECRET textiles and home furnishings complex.',
        bodyAr: `يمثل هذا المجمع الجديد إنجازًا آخر نفخر به في مسيرة التطور المستمر للقطاع الصناعي المصري.\nهذا المشروع يعكس طموح نانا سيكريت في تقديم جودة مصرية بمعايير عالمية.`,
        bodyEn: `This new complex represents another milestone in the continuous development of Egypt's industrial sector.\nThis project reflects NANA SECRET's ambition to deliver Egyptian quality to global standards.`,
        imageUrl: 'assets/images/event-1.jpg'
      },
      {
        id: 'canton-fair',
        titleAr: 'معرض كانتون',
        titleEn: 'Canton Fair',
        authorAr: 'إدارة نانا سيكريت',
        authorEn: 'NANA SECRET Management',
        dateAr: '',
        dateEn: '',
        excerptAr: 'في معرض كانتون، نعرض أحدث مجموعاتنا من البطانيات الفاخرة والفانيلا.',
        excerptEn: 'At Canton Fair, we showcase our latest collections of luxury blankets and flannel.',
        bodyAr: 'نشارك في معرض كانتون لتقديم أحدث منتجاتنا للأسواق العالمية، حيث يلتقي الفن المصري مع الأذواق العالمية في تحفة فنية تجمع بين الفخامة والإبداع.',
        bodyEn: 'We participate in Canton Fair to present our latest products to global markets, where Egyptian artistry meets international tastes in a refined blend of luxury and creativity.',
        imageUrl: 'assets/images/event-2.jpg'
      },
      {
        id: 'market-statement',
        titleAr: 'إعلان هام لسوق المنسوجات والمفروشات المنزلية المصري',
        titleEn: `Important announcement for Egypt's textiles and home furnishings market`,
        authorAr: 'إدارة نانا سيكريت',
        authorEn: 'NANA SECRET Management',
        dateAr: '',
        dateEn: '',
        excerptAr: 'يواجه سوقنا اليوم مرحلة حرجة وخطيرة تتطلب قرارات واضحة لحماية الصناعة.',
        excerptEn: 'Our market is facing a critical stage that requires clear decisions to protect the industry.',
        bodyAr: `اتخذت شركتنا قرارًا واضحًا واستراتيجيًا يهدف إلى حماية استقرار السوق وضمان سلامة وكلائنا.\nفي نانا سيكريت، نؤمن بأن الاستقرار المالي هو أساس الاستدامة الصناعية.`,
        bodyEn: `Our company has made a clear strategic decision to protect market stability and safeguard our agents.\nAt NANA SECRET, we believe financial stability is the foundation of industrial sustainability.`,
        imageUrl: 'assets/images/news-chairman.svg'
      }
    ];
    for (const item of defaultNews) {
      const post = normalizeNews(item);
      await run(`INSERT INTO news (id, createdAt, updatedAt, titleAr, titleEn, authorAr, authorEn, dateAr, dateEn, excerptAr, excerptEn, bodyAr, bodyEn, imageUrl, videoUrl, isPublished, sortOrder)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [post.id, post.createdAt, post.updatedAt, post.titleAr, post.titleEn, post.authorAr, post.authorEn, post.dateAr, post.dateEn, post.excerptAr, post.excerptEn, post.bodyAr, post.bodyEn, post.imageUrl, post.videoUrl, post.isPublished, post.sortOrder]);
    }
  }
  const galleryCount = await get('SELECT COUNT(*) AS count FROM gallery_images');
  if (!galleryCount || galleryCount.count === 0) {
    const defaults = [
      ['assets/images/event-1.jpg','وضع حجر الأساس لمجمع نانا سيكريت','Foundation stone for NANA SECRET Complex','grid'],
      ['assets/images/event-2.jpg','كلمة خلال فعاليات الاحتفال','Speech during the celebration','grid'],
      ['assets/images/event-3.jpg','عرض تقديمي لهوية نانا سيكريت','NANA SECRET identity presentation','grid'],
      ['assets/images/event-4.jpg','لقاء الضيوف والشركاء','Guests and partners gathering','grid'],
      ['assets/images/event-5.jpg','لحظة وضع حجر الأساس','Foundation stone moment','grid'],
      ['assets/images/event-6.jpg','حضور من قادة الصناعة','Industry leaders attendance','grid'],
      ['assets/images/event-7.jpg','مشاركة الشركاء في الاحتفالية','Partners participating in the event','grid'],
      ['assets/images/event-8.jpg','استقبال الزوار داخل موقع الاحتفال','Welcoming visitors at the event site','grid'],
      ['assets/images/event-9.jpg','صورة جماعية للضيوف','Group photo of guests','grid']
    ];
    for (const [imageUrl, captionAr, captionEn, displayMode] of defaults) {
      const item = normalizeGallery({ imageUrl, captionAr, captionEn, displayMode });
      await run(`INSERT INTO gallery_images (id, createdAt, updatedAt, imageUrl, captionAr, captionEn, displayMode, isPublished, sortOrder)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`, [item.id, item.createdAt, item.updatedAt, item.imageUrl, item.captionAr, item.captionEn, item.displayMode, item.isPublished, item.sortOrder]);
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

app.post('/api/login', async (req, res, next) => {
  try {
    const username = String(req.body.username || '').trim();
    const password = String(req.body.password || '').trim();
    const user = await get('SELECT * FROM users WHERE LOWER(username) = LOWER(?)', [username]);
    if (!user || user.passwordHash !== hashPassword(password)) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    const token = crypto.createHmac('sha256', SESSION_SECRET)
      .update(`${user.username}:${Date.now()}:${crypto.randomBytes(8).toString('hex')}`)
      .digest('hex');
    sessions.set(token, user.username);
    const now = new Date().toISOString();
    await run('UPDATE users SET updatedAt = ? WHERE username = ?', [now, user.username]);
    res.json({ token, user: user.username, name: user.name || user.username, createdAt: user.createdAt, updatedAt: now });
  } catch (e) { next(e); }
});
app.post('/api/logout', requireAuth, (req, res) => {
  const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  sessions.delete(token);
  res.json({ ok: true });
});
app.get('/api/news', async (req, res, next) => {
  try {
    const includeAll = req.query.all === '1' && (req.headers.authorization || '').replace(/^Bearer\s+/i, '') && sessions.has((req.headers.authorization || '').replace(/^Bearer\s+/i, ''));
    res.json(await all('SELECT * FROM news ' + (includeAll ? '' : 'WHERE COALESCE(isPublished,1)=1 ') + 'ORDER BY COALESCE(sortOrder,999999) ASC, updatedAt DESC, createdAt DESC'));
  }
  catch (e) { next(e); }
});
app.post('/api/news', requireAuth, async (req, res, next) => {
  try {
    const post = normalizeNews(prepareImageInput(req.body, 'news'));
    if (!post.titleAr || !post.bodyAr || !post.excerptAr) return res.status(400).json({ error: 'Missing required fields' });
    const maxOrder = await get('SELECT COALESCE(MAX(sortOrder),0) AS maxOrder FROM news');
    post.sortOrder = Number(req.body && req.body.sortOrder) || Number(maxOrder && maxOrder.maxOrder || 0) + 1;
    await run(`INSERT INTO news (id, createdAt, updatedAt, titleAr, titleEn, authorAr, authorEn, dateAr, dateEn, excerptAr, excerptEn, bodyAr, bodyEn, imageUrl, videoUrl, isPublished, sortOrder)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [post.id, post.createdAt, post.updatedAt, post.titleAr, post.titleEn, post.authorAr, post.authorEn, post.dateAr, post.dateEn, post.excerptAr, post.excerptEn, post.bodyAr, post.bodyEn, post.imageUrl, post.videoUrl, post.isPublished, post.sortOrder]);
    res.status(201).json(post);
  } catch (e) { next(e); }
});
app.put('/api/news/:id', requireAuth, async (req, res, next) => {
  try {
    const existing = await get('SELECT * FROM news WHERE id = ?', [req.params.id]);
    if (!existing) return res.status(404).json({ error: 'Not found' });
    const post = normalizeNews(prepareImageInput({ ...req.body, id: req.params.id }, 'news'), existing);
    await run(`UPDATE news SET updatedAt=?, titleAr=?, titleEn=?, authorAr=?, authorEn=?, dateAr=?, dateEn=?, excerptAr=?, excerptEn=?, bodyAr=?, bodyEn=?, imageUrl=?, videoUrl=?, isPublished=?, sortOrder=? WHERE id=?`,
      [post.updatedAt, post.titleAr, post.titleEn, post.authorAr, post.authorEn, post.dateAr, post.dateEn, post.excerptAr, post.excerptEn, post.bodyAr, post.bodyEn, post.imageUrl, post.videoUrl, post.isPublished, post.sortOrder, post.id]);
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
      await run(`INSERT INTO news (id, createdAt, updatedAt, titleAr, titleEn, authorAr, authorEn, dateAr, dateEn, excerptAr, excerptEn, bodyAr, bodyEn, imageUrl, videoUrl, isPublished, sortOrder)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [post.id, post.createdAt, post.updatedAt, post.titleAr, post.titleEn, post.authorAr, post.authorEn, post.dateAr, post.dateEn, post.excerptAr, post.excerptEn, post.bodyAr, post.bodyEn, post.imageUrl, post.videoUrl, post.isPublished, post.sortOrder]);
    }
    res.json({ ok: true, count: posts.length });
  } catch (e) { next(e); }
});
app.get('/api/products', async (req, res, next) => {
  try {
    const includeAll = req.query.all === '1' && (req.headers.authorization || '').replace(/^Bearer\s+/i, '') && sessions.has((req.headers.authorization || '').replace(/^Bearer\s+/i, ''));
    res.json(await all('SELECT * FROM products ' + (includeAll ? '' : 'WHERE COALESCE(isPublished,1)=1 ') + 'ORDER BY id ASC'));
  }
  catch (e) { next(e); }
});
app.post('/api/products', requireAuth, async (req, res, next) => {
  try {
    const p = normalizeProduct(prepareImageInput(req.body, 'product'));
    if (!p.ar) return res.status(400).json({ error: 'Product name is required' });
    const result = await run(`INSERT INTO products (ar, en, categoryAr, categoryEn, imageUrl, createdAt, updatedAt, isPublished) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [p.ar, p.en, p.categoryAr, p.categoryEn, p.imageUrl, p.createdAt, p.updatedAt, p.isPublished]);
    p.id = result.lastID;
    res.status(201).json(p);
  } catch (e) { next(e); }
});
app.put('/api/products/:id', requireAuth, async (req, res, next) => {
  try {
    const existing = await get('SELECT * FROM products WHERE id = ?', [req.params.id]);
    if (!existing) return res.status(404).json({ error: 'Not found' });
    const p = normalizeProduct(prepareImageInput(req.body, 'product'), existing);
    await run(`UPDATE products SET ar=?, en=?, categoryAr=?, categoryEn=?, imageUrl=?, updatedAt=?, isPublished=? WHERE id=?`,
      [p.ar, p.en, p.categoryAr, p.categoryEn, p.imageUrl, p.updatedAt, p.isPublished, req.params.id]);
    res.json({ ...p, id: Number(req.params.id) });
  } catch (e) { next(e); }
});
app.delete('/api/products/:id', requireAuth, async (req, res, next) => {
  try { await run('DELETE FROM products WHERE id = ?', [req.params.id]); res.json({ ok: true }); }
  catch (e) { next(e); }
});

app.get('/api/me', requireAuth, async (req, res, next) => {
  try {
    const header = req.headers.authorization || '';
    const token = header.replace(/^Bearer\s+/i, '');
    const username = sessions.get(token) || ADMIN_USER;
    const row = await get('SELECT username, name, createdAt, updatedAt FROM users WHERE username = ?', [username]);
    res.json({ user: row && row.username || username, name: row && row.name || username, createdAt: row && row.createdAt, updatedAt: row && row.updatedAt });
  } catch (e) { next(e); }
});

app.get('/api/users', requireAuth, async (req, res, next) => {
  try { res.json((await all('SELECT username, name, createdAt, updatedAt FROM users ORDER BY createdAt DESC')).map(publicUser)); }
  catch (e) { next(e); }
});
app.post('/api/users', requireAuth, async (req, res, next) => {
  try {
    const username = String(req.body.username || '').trim();
    const name = String(req.body.name || username).trim();
    const password = String(req.body.password || '').trim();
    if (!username || !password) return res.status(400).json({ error: 'اسم المستخدم وكلمة المرور مطلوبين' });
    if (!/^[a-zA-Z0-9_.-]{3,40}$/.test(username)) return res.status(400).json({ error: 'اسم المستخدم يجب أن يكون 3 أحرف على الأقل بدون مسافات' });
    const duplicate = await get('SELECT username FROM users WHERE LOWER(username) = LOWER(?)', [username]);
    if (duplicate) return res.status(409).json({ error: 'اسم المستخدم موجود بالفعل' });
    const now = new Date().toISOString();
    await run('INSERT INTO users (username, name, passwordHash, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?)', [username, name, hashPassword(password), now, now]);
    res.status(201).json({ username, name, createdAt: now, updatedAt: now });
  } catch (e) { next(e); }
});
app.put('/api/users/:username', requireAuth, async (req, res, next) => {
  try {
    const username = String(req.params.username || '').trim();
    const existing = await get('SELECT * FROM users WHERE username = ?', [username]);
    if (!existing) return res.status(404).json({ error: 'Not found' });
    const name = String(req.body.name || existing.name || username).trim();
    const password = String(req.body.password || '').trim();
    const now = new Date().toISOString();
    if (password) await run('UPDATE users SET name=?, passwordHash=?, updatedAt=? WHERE username=?', [name, hashPassword(password), now, username]);
    else await run('UPDATE users SET name=?, updatedAt=? WHERE username=?', [name, now, username]);
    res.json({ username, name, createdAt: existing.createdAt, updatedAt: now });
  } catch (e) { next(e); }
});
app.delete('/api/users/:username', requireAuth, async (req, res, next) => {
  try {
    const username = String(req.params.username || '').trim();
    if (username.toLowerCase() === ADMIN_USER.toLowerCase()) return res.status(400).json({ error: 'Cannot delete main admin user' });
    await run('DELETE FROM users WHERE username = ?', [username]);
    res.json({ ok: true });
  } catch (e) { next(e); }
});


app.get('/api/gallery', async (req, res, next) => {
  try {
    const includeAll = req.query.all === '1' && (req.headers.authorization || '').replace(/^Bearer\s+/i, '') && sessions.has((req.headers.authorization || '').replace(/^Bearer\s+/i, ''));
    res.json(await all('SELECT * FROM gallery_images ' + (includeAll ? '' : 'WHERE COALESCE(isPublished,1)=1 ') + 'ORDER BY COALESCE(sortOrder,999999) ASC, createdAt ASC'));
  } catch (e) { next(e); }
});
app.post('/api/gallery', requireAuth, async (req, res, next) => {
  try {
    const item = normalizeGallery(prepareImageInput(req.body, 'gallery'));
    if (!item.imageUrl) return res.status(400).json({ error: 'Image is required' });
    const maxOrder = await get('SELECT COALESCE(MAX(sortOrder),0) AS maxOrder FROM gallery_images');
    item.sortOrder = Number(req.body && req.body.sortOrder) || Number(maxOrder && maxOrder.maxOrder || 0) + 1;
    await run(`INSERT INTO gallery_images (id, createdAt, updatedAt, imageUrl, captionAr, captionEn, displayMode, isPublished, sortOrder)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`, [item.id, item.createdAt, item.updatedAt, item.imageUrl, item.captionAr, item.captionEn, item.displayMode, item.isPublished, item.sortOrder]);
    res.status(201).json(item);
  } catch (e) { next(e); }
});
app.put('/api/gallery/:id', requireAuth, async (req, res, next) => {
  try {
    const existing = await get('SELECT * FROM gallery_images WHERE id = ?', [req.params.id]);
    if (!existing) return res.status(404).json({ error: 'Not found' });
    const item = normalizeGallery(prepareImageInput({ ...req.body, id: req.params.id }, 'gallery'), existing);
    await run(`UPDATE gallery_images SET updatedAt=?, imageUrl=?, captionAr=?, captionEn=?, displayMode=?, isPublished=?, sortOrder=? WHERE id=?`,
      [item.updatedAt, item.imageUrl, item.captionAr, item.captionEn, item.displayMode, item.isPublished, item.sortOrder, item.id]);
    res.json(item);
  } catch (e) { next(e); }
});
app.delete('/api/gallery/:id', requireAuth, async (req, res, next) => {
  try { await run('DELETE FROM gallery_images WHERE id = ?', [req.params.id]); res.json({ ok: true }); }
  catch (e) { next(e); }
});

app.put('/api/reorder/news', requireAuth, async (req, res, next) => {
  try {
    const ids = Array.isArray(req.body && req.body.ids) ? req.body.ids : [];
    for (let i = 0; i < ids.length; i += 1) await run('UPDATE news SET sortOrder=?, updatedAt=? WHERE id=?', [i + 1, new Date().toISOString(), ids[i]]);
    res.json({ ok: true });
  } catch (e) { next(e); }
});
app.put('/api/reorder/gallery', requireAuth, async (req, res, next) => {
  try {
    const ids = Array.isArray(req.body && req.body.ids) ? req.body.ids : [];
    for (let i = 0; i < ids.length; i += 1) await run('UPDATE gallery_images SET sortOrder=?, updatedAt=? WHERE id=?', [i + 1, new Date().toISOString(), ids[i]]);
    res.json({ ok: true });
  } catch (e) { next(e); }
});

app.get('/api/stats', requireAuth, async (req, res, next) => {
  try {
    const products = await get('SELECT COUNT(*) AS count FROM products');
    const publishedProducts = await get('SELECT COUNT(*) AS count FROM products WHERE COALESCE(isPublished,1)=1');
    const news = await get('SELECT COUNT(*) AS count FROM news');
    const publishedNews = await get('SELECT COUNT(*) AS count FROM news WHERE COALESCE(isPublished,1)=1');
    const users = await get('SELECT COUNT(*) AS count FROM users');
    const gallery = await get('SELECT COUNT(*) AS count FROM gallery_images');
    const publishedGallery = await get('SELECT COUNT(*) AS count FROM gallery_images WHERE COALESCE(isPublished,1)=1');
    const content = await get('SELECT MAX(updatedAt) AS updatedAt, MIN(createdAt) AS createdAt FROM page_content');
    res.json({
      products: products ? products.count : 0,
      publishedProducts: publishedProducts ? publishedProducts.count : 0,
      news: news ? news.count : 0,
      publishedNews: publishedNews ? publishedNews.count : 0,
      users: users ? users.count : 0,
      gallery: gallery ? gallery.count : 0,
      publishedGallery: publishedGallery ? publishedGallery.count : 0,
      contentCreatedAt: content ? content.createdAt : null,
      contentUpdatedAt: content ? content.updatedAt : null
    });
  } catch (e) { next(e); }
});
app.get('/api/content/:page', async (req, res, next) => {
  try { res.json(await all('SELECT * FROM page_content WHERE page = ? ORDER BY key ASC', [req.params.page])); }
  catch (e) { next(e); }
});
app.put('/api/content/:page', requireAuth, async (req, res, next) => {
  try {
    const page = String(req.params.page || '').trim();
    const items = Array.isArray(req.body.items) ? req.body.items : [];
    const saved = [];
    for (const item of items) {
      const preparedItem = { ...item };
      if (preparedItem.ar && /^data:image\//i.test(String(preparedItem.ar))) {
        preparedItem.ar = saveDataUrlImage(preparedItem.ar, `${page}-${preparedItem.key || 'image'}`);
      }
      const existing = await get('SELECT * FROM page_content WHERE page = ? AND key = ?', [page, preparedItem.key]);
      const row = normalizeContent({ ...preparedItem, page, updatedBy: ADMIN_USER }, existing || {});
      if (!row.key) continue;
      if (existing) {
        await run('UPDATE page_content SET ar=?, en=?, updatedAt=?, updatedBy=? WHERE page=? AND key=?', [row.ar, row.en, row.updatedAt, row.updatedBy, page, row.key]);
      } else {
        await run('INSERT INTO page_content (page, key, ar, en, createdAt, updatedAt, updatedBy) VALUES (?, ?, ?, ?, ?, ?, ?)', [page, row.key, row.ar, row.en, row.createdAt, row.updatedAt, row.updatedBy]);
      }
      saved.push(row);
    }
    res.json({ ok: true, count: saved.length, items: saved });
  } catch (e) { next(e); }
});

app.get('/api/health', (req, res) => res.json({ ok: true }));
app.use('/uploads', express.static(UPLOADS_DIR, { index: false, dotfiles: 'deny' }));
app.use((req, res) => res.status(404).json({ error: 'Not found' }));
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Server error', details: err.message });
});

async function start(port = PORT, host) {
  await initDb();
  return new Promise((resolve, reject) => {
    const server = app.listen(port, host, () => resolve(server));
    server.once('error', reject);
  });
}

function closeDatabase() {
  return new Promise((resolve, reject) => db.close((err) => err ? reject(err) : resolve()));
}

if (require.main === module) {
  start().then((server) => {
    console.log(`NANA SECRET API is running on http://localhost:${server.address().port}`);
  }).catch((err) => {
    console.error('Failed to start server:', err);
    process.exit(1);
  });
}

module.exports = { app, start, closeDatabase };
