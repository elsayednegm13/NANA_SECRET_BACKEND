# NANA SECRET

Bilingual company website with **independent frontend and backend applications**.

- **Frontend:** HTML, CSS and vanilla JavaScript. Deploy the pages and `assets/` to a static host, or use the included local Express server.
- **Backend:** Express JSON API, SQLite database, uploaded images and Resend contact email. It does **not** serve the frontend, source code or database files.

[دليل التشغيل والنشر بالعربية](README-AR.md) · [تقرير فحص المشروع](docs/PROJECT-ANALYSIS.md)

## Quick start

Requires Node.js **22 or newer**, npm and two available ports: **3000** and **4000**.

```sh
npm run setup
npm run dev
```

`setup` installs each application's locked dependencies. Running `npm install` in the root alone does not install the two applications.

- Website: http://localhost:3000
- Dashboard login: http://localhost:3000/login.html
- API health: http://localhost:4000/api/health

Development bootstrap defaults: `ADMIN` / `123`. These only create a missing administrator; the existing database may already have different credentials. **Do not deploy with the development credentials or secret.**

Run separately in two terminals instead:

```sh
npm run backend
```

```sh
npm run frontend
```

`npm start` starts only the backend, for compatibility with Node hosting start commands. Use `npm run dev` to run both locally. Ctrl+C stops both development processes.

## Structure

```text
frontend/
  *.html
  assets/             # CSS, JavaScript, public images
  assets/js/config.js # Public API origin and upload URL helpers
  server.js           # Optional local static server; port 3000
  package.json
  package-lock.json
backend/
  server.js           # API and /uploads only; port 4000
  config.js
  .env.example
  data/               # Existing SQLite database and product seeds
  uploads/            # Existing and newly uploaded images
  package.json
  package-lock.json
scripts/dev.js        # Runs the two independent processes locally
 tests/               # Backend integration tests with temporary storage
```

## Configuration and independent deployment

1. Optionally copy `backend/.env.example` to `backend/.env`. Environment variables from the host take precedence. Configuration is loaded from `backend/`, regardless of your terminal's current directory.
2. In `frontend/assets/js/config.js`, set `window.NANA_API_BASE` to your **public API origin**, e.g. `https://api.example.com`. Its local default is `http://localhost:4000`. Set it to `""` only when a reverse proxy routes `/api` and `/uploads` to the backend on the frontend's origin.
3. Set backend `FRONTEND_ORIGINS` to a comma-separated list of allowed frontend origins, without trailing slashes, e.g. `https://www.example.com,https://example.com`. This is an exact allowlist, not `*`; requests without an Origin header are permitted. CORS is not authentication.
4. Deploy `backend/` separately with `npm ci` and `npm start`. Keep `DATA_DIR` and `UPLOADS_DIR` on persistent storage. Relative storage paths resolve from `backend/`. Use HTTPS for both sites.
5. Deploy the frontend HTML and `assets/` to a static host. No frontend build step is needed. If using its Node server instead: `npm ci`, `npm start`; configure `FRONTEND_PORT` if port 3000 is unavailable.

Never upload `backend/`, the repository root, `.env`, SQLite files, or private server files to a static hosting public directory. Frontend configuration is public: **no API keys or passwords there**.

The existing database and uploaded files were moved intact into `backend/`; API URLs and stored `/uploads/...` paths remain compatible. **Preserve the original `SESSION_SECRET` when migrating an existing database**: the legacy password hashes depend on it. Changing `ADMIN_PASS` does not reset an existing administrator's password. See the Arabic guide before changing credentials.

Contact email setup: [README-RESEND.md](README-RESEND.md).

## Validation and security status

```sh
npm test
npm audit --prefix backend --omit=dev
npm audit --prefix frontend --omit=dev
```

Tests cover backend routes, authentication, CORS, private-file isolation, uploads, frontend API/media configuration and mock-based frontend flows. Backend tests use a temporary database and upload directory, not the real project database. No full browser end-to-end testing or live Resend email test is included.

At the time of this separation, backend dependency audit reported **12 advisories (2 critical, 7 high, 1 moderate, 2 low)**; frontend audit reported none. Existing authentication also needs production hardening. See [the analysis report](docs/PROJECT-ANALYSIS.md) before deploying; separation alone does not make the application production-secure.
