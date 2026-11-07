const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const DATA_DIR = path.resolve(__dirname, process.env.DATA_DIR || 'data');
const UPLOADS_DIR = path.resolve(__dirname, process.env.UPLOADS_DIR || 'uploads');
const ALLOWED_ORIGINS = String(process.env.FRONTEND_ORIGINS || 'http://localhost:3000,http://127.0.0.1:3000')
  .split(',').map((origin) => origin.trim()).filter(Boolean);

module.exports = {
  PORT: Number(process.env.PORT || 4000),
  ADMIN_USER: String(process.env.ADMIN_USER || 'ADMIN').trim(),
  ADMIN_PASS: String(process.env.ADMIN_PASS || '123').trim(),
  SESSION_SECRET: String(process.env.SESSION_SECRET || 'local-secret'),
  DATA_DIR,
  DB_PATH: path.join(DATA_DIR, 'nana-secret.sqlite'),
  SEED_PATH: path.join(__dirname, 'data', 'products-seed.json'),
  UPLOADS_DIR,
  ALLOWED_ORIGINS,
  CONTACT_TO: String(process.env.CONTACT_TO || 'elsayedmohamed963@gmail.com').trim(),
  RESEND_API_KEY: String(process.env.RESEND_API_KEY || '').trim(),
  RESEND_FROM: String(process.env.RESEND_FROM || 'NANA SECRET Website <onboarding@resend.dev>').trim()
};
