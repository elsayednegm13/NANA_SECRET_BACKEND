const assert = require('node:assert/strict');
const { test, before, after } = require('node:test');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'nana-secret-test-'));
process.env.DATA_DIR = path.join(temporary, 'data');
process.env.UPLOADS_DIR = path.join(temporary, 'uploads');
process.env.ADMIN_USER = 'test-admin';
process.env.ADMIN_PASS = 'test-password';
process.env.SESSION_SECRET = 'test-only-secret';
process.env.FRONTEND_ORIGINS = 'http://localhost:3000,https://www.example.com';
process.env.RESEND_API_KEY = '';

const { start, closeDatabase } = require('../backend/server');
let server;
let base;
const image = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j0i8AAAAASUVORK5CYII=';

before(async () => {
  server = await start(0, '127.0.0.1');
  base = `http://127.0.0.1:${server.address().port}`;
});
after(async () => {
  if (server) await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  await closeDatabase();
  fs.rmSync(temporary, { recursive: true, force: true });
});

async function request(url, method = 'GET', body, token) {
  return fetch(base + url, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body)
  });
}
async function login() {
  const response = await request('/api/login', 'POST', { username: 'test-admin', password: 'test-password' });
  assert.equal(response.status, 200);
  return (await response.json()).token;
}

test('API serves public data and health independently from the frontend', async () => {
  assert.deepEqual(await (await request('/api/health')).json(), { ok: true });
  for (const route of ['/api/products', '/api/news', '/api/gallery', '/api/content/home']) {
    const response = await request(route);
    assert.equal(response.status, 200);
    assert.ok(Array.isArray(await response.json()));
  }
  const products = await (await request('/api/products')).json();
  assert.ok(products.length > 0, 'seed data remains available with a custom DATA_DIR');
});

test('backend never exposes source, database, configuration or frontend pages', async () => {
  for (const route of ['/', '/index.html', '/assets/js/main.js', '/data/nana-secret.sqlite', '/data/products-seed.json', '/server.js', '/config.js', '/package.json', '/.env', '/.git/config']) {
    const response = await request(route);
    assert.equal(response.status, 404, route);
    assert.deepEqual(await response.json(), { error: 'Not found' });
  }
});

test('CORS permits configured frontend origins and authorization-header preflights', async () => {
  for (const origin of ['http://localhost:3000', 'https://www.example.com']) {
    const response = await fetch(base + '/api/products', { headers: { Origin: origin } });
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('Access-Control-Allow-Origin'), origin);
    assert.ok(response.headers.get('Vary').includes('Origin'));
    const preflight = await fetch(base + '/api/products', {
      method: 'OPTIONS',
      headers: { Origin: origin, 'Access-Control-Request-Method': 'PUT', 'Access-Control-Request-Headers': 'authorization,content-type' }
    });
    assert.equal(preflight.status, 204);
    assert.match(preflight.headers.get('Access-Control-Allow-Headers'), /Authorization/);
  }
  for (const method of ['GET', 'OPTIONS']) {
    const rejected = await fetch(base + '/api/products', { method, headers: { Origin: 'https://untrusted.example' } });
    assert.equal(rejected.status, 403);
    assert.equal(rejected.headers.get('Access-Control-Allow-Origin'), null);
  }
});

test('login, protected routes and logout retain their API contract', async () => {
  assert.equal((await request('/api/login', 'POST', { username: 'test-admin', password: 'wrong' })).status, 401);
  assert.equal((await request('/api/products', 'POST', { ar: 'Unauthorized' })).status, 401);
  const token = await login();
  const me = await (await request('/api/me', 'GET', undefined, token)).json();
  assert.equal(me.user, 'test-admin');
  assert.equal((await request('/api/users', 'GET', undefined, token)).status, 200);
  assert.equal((await request('/api/stats', 'GET', undefined, token)).status, 200);
  assert.equal((await request('/api/logout', 'POST', {}, token)).status, 200);
  assert.equal((await request('/api/me', 'GET', undefined, token)).status, 401);
});

test('product CRUD persists uploads on backend, with publish visibility intact', async () => {
  const token = await login();
  const response = await request('/api/products', 'POST', { ar: 'منتج تجريبي', imageUrl: image, isPublished: 0 }, token);
  assert.equal(response.status, 201);
  const product = await response.json();
  assert.match(product.imageUrl, /^\/uploads\/product-.*\.png$/);
  const uploaded = await request(product.imageUrl);
  assert.equal(uploaded.status, 200);
  assert.match(uploaded.headers.get('Content-Type'), /image\/png/);
  assert.deepEqual(Buffer.from(await uploaded.arrayBuffer()), Buffer.from(image.split(',')[1], 'base64'));
  const visible = await (await request('/api/products')).json();
  assert.ok(!visible.some((item) => item.id === product.id));
  const all = await (await request('/api/products?all=1', 'GET', undefined, token)).json();
  assert.ok(all.some((item) => item.id === product.id));
  assert.equal((await request(`/api/products/${product.id}`, 'PUT', { ...product, ar: 'Updated', isPublished: 1 }, token)).status, 200);
  assert.equal((await request(`/api/products/${product.id}`, 'DELETE', undefined, token)).status, 200);
});

test('news, gallery and page image overrides still support backend uploads', async () => {
  const token = await login();
  const response = await request('/api/news', 'POST', { titleAr: 'خبر', bodyAr: 'تفاصيل', excerptAr: 'ملخص', imageUrl: image }, token);
  assert.equal(response.status, 201);
  const news = await response.json();
  assert.match(news.imageUrl, /^\/uploads\/news-/);
  assert.equal((await request(`/api/news/${news.id}`, 'PUT', { ...news, titleAr: 'تعديل' }, token)).status, 200);
  assert.equal((await request(`/api/news/${news.id}`, 'DELETE', undefined, token)).status, 200);
  const galleryResponse = await request('/api/gallery', 'POST', { imageUrl: image, captionAr: 'صورة' }, token);
  assert.equal(galleryResponse.status, 201);
  const gallery = await galleryResponse.json();
  assert.match(gallery.imageUrl, /^\/uploads\/gallery-/);
  assert.equal((await request(`/api/gallery/${gallery.id}`, 'DELETE', undefined, token)).status, 200);
  assert.equal((await request('/api/content/home', 'PUT', { items: [{ key: 'home-img-0', ar: image, en: 'Test' }] }, token)).status, 200);
  const rows = await (await request('/api/content/home')).json();
  assert.match(rows[0].ar, /^\/uploads\/home-home-img-0-/);
  assert.equal((await request(rows[0].ar)).status, 200);
});

test('contact validation works without contacting an external email service', async () => {
  const response = await request('/api/contact', 'POST', { name: 'Test' });
  assert.equal(response.status, 400);
});
