# Sarthos

Sarthos is a mobile-friendly React + Vite + TypeScript application with exactly two main pages: **Daily Checklist** and **Analysis**. Daily records and cached AI reports are stored in MongoDB Atlas through the Express backend. Gemini requests are made by the backend only.

## Requirements

- Node.js 20 or newer and npm
- A MongoDB Atlas database user and cluster
- A Gemini API key from Google AI Studio

## Local setup

Install frontend and backend dependencies from the project root:

```powershell
npm run install:all
if (-not (Test-Path server\.env)) { Copy-Item server\.env.example server\.env }
```

Edit `server\.env` locally. If it already contains your Atlas/Gemini settings, preserve it and add only the new authentication/time-zone settings. Never commit or share it.

| Backend variable | Purpose |
| --- | --- |
| `MONGODB_URI` | Atlas connection URI; use the `selfupgrade` database on `cluster0.tehxvyj.mongodb.net` |
| `GEMINI_API_KEY` | Google AI Studio API key; backend only |
| `GEMINI_MODEL` | Optional model ID; defaults to `gemini-2.5-flash` |
| `AUTH_USERNAME` | The single account's login name |
| `AUTH_PASSWORD` | Login password, at least 8 characters; use a strong unique value and keep it private |
| `SESSION_SECRET` | Random signing secret, at least 32 bytes; generate with `node -e "console.log(require('node:crypto').randomBytes(48).toString('base64url'))"` |
| `PORT` | API port; defaults to `8787` locally (Render supplies its own value) |
| `HOST` | Defaults to `127.0.0.1` locally |
| `FRONTEND_ORIGIN` | Exact allowed browser origin(s), comma-separated; defaults to `http://localhost:5173` |
| `APP_TIME_ZONE` | Time zone used to enforce today's-only writes; defaults to `Asia/Kolkata` |
| `COOKIE_SECURE` | Keep `false` for local HTTP; set `true` for HTTPS hosting (sets Secure and SameSite=None cookies) |

In Atlas, create a database user and add the local development IP to Network Access. The example URI uses your cluster host and the `selfupgrade` database; replace only its username/password placeholders and URL-encode special characters in the password. For hosted access, Atlas must also allow the backend host's egress IP. Avoid broad `0.0.0.0/0` access unless you explicitly accept the increased risk.

Run the API and frontend in separate terminals:

```powershell
npm run server
```

```powershell
npm run dev
```

Open `http://localhost:5173`. Vite proxies `/api` to `http://127.0.0.1:8787`. Check:

- `http://localhost:8787/api/health` for backend/database status and whether a Gemini key is configured.
- `http://localhost:8787/api/ai/health` to query Gemini model metadata for the configured project without generating text. A successful model lookup verifies model access, **not** remaining free quota, billing status, or future availability.

The default `gemini-2.5-flash` model is listed in Google's Gemini API model documentation. Free-tier model access and rate limits depend on Google's current policy and the API-key project. Check the [model catalog](https://ai.google.dev/gemini-api/docs/models), [pricing and free-tier terms](https://ai.google.dev/gemini-api/docs/pricing), and the project's [AI Studio rate limits](https://aistudio.google.com/rate-limit) before relying on free usage. Do not test generation repeatedly just to check configuration.

## API

- `GET /api/health` — application/database readiness; does not return secrets.
- `GET /api/ai/health` — checks configured Gemini model metadata, without generating content.
- `GET /api/auth/session`, `POST /api/auth/login`, `POST /api/auth/logout` — single-user cookie session authentication.
- `GET /api/logs?from=YYYY-MM-DD&to=YYYY-MM-DD` — list records (up to 400).
- `GET /api/logs/:date` — retrieve a saved local-calendar date.
- `PUT /api/logs/:date` — create or edit a date's single record.
- `GET /api/reports?date=YYYY-MM-DD&kind=daily` — retrieve cached reports.
- `POST /api/analysis` — daily, weekly, 30-day, or 80-day analysis, reused when its source data/model is unchanged.
- `POST /api/meals/nutrition` — approximate nutrition estimate for described food.

Private endpoints require authentication. The backend issues a seven-day HMAC-signed HttpOnly cookie, checks a CSRF token and exact allowed Origin on state-changing requests, rate-limits login attempts, and derives MongoDB ownership from the authenticated username. It does not accept a client owner ID. `AUTH_PASSWORD` must be at least 8 characters and `SESSION_SECRET` at least 32 bytes; use strong unique values, configure them privately, and never send them in chat. The cookie is `SameSite=Lax` for local use and `SameSite=None; Secure` when `COOKIE_SECURE=true`. Keep the frontend and API on HTTPS in production and set `FRONTEND_ORIGIN` to the exact frontend origin.

The API independently rejects daily-log writes unless the date is today in `APP_TIME_ZONE`; historical records remain readable but are view-only. Requests are validated, limited to 50 KB, and rate-limited. Calendar dates are stored and queried as `YYYY-MM-DD` strings. Editing a record invalidates reports whose analysis windows include that date. Daily text notes and the porn/masturbation count are not sent to Gemini. Meal nutrition is approximate and not medical advice.

## Data, privacy, and deployment gate

- Previous browser-local checklist data does not sync to MongoDB automatically. On the original device/browser, use **Import previous browser checklist**. It imports dates not already in MongoDB and keeps the browser copy. **Export MongoDB records** downloads a JSON backup.
- Authentication supports one account, not multi-user registration or account recovery. Losing the configured password requires changing `AUTH_PASSWORD` privately. Protect the backend environment and rotate credentials if they may have been exposed.
- Keep the backend private/local until the owner has configured unique authentication secrets, tested sign-in and persistence, and verified exact production CORS/HTTPS cookie settings. The backend binds to loopback (`127.0.0.1`) by default.
- `.env` files and generated output are ignored by Git. Never put `GEMINI_API_KEY` or `MONGODB_URI` in frontend source, a `VITE_` variable, or an API response. Vite's `VITE_API_BASE_URL` is public configuration and must contain only the API origin.

### Hosting plan (not yet deployed)

The Vite frontend is compatible with Vercel static hosting:

- Framework preset: Vite
- Build command: `npm run build`
- Output directory: `dist`
- Build environment variable, only after a secured backend exists: `VITE_API_BASE_URL=https://<render-service>.onrender.com` (origin only; frontend app appends `/api`).

An authenticated Express backend could run on Render with root directory `server`, build command `npm install && npm run build`, start command `npm start`, and health-check path `/api/health`. Render requires binding to `0.0.0.0`; set `HOST=0.0.0.0` only with authentication configured. Set `COOKIE_SECURE=true` and configure `MONGODB_URI`, `GEMINI_API_KEY`, `GEMINI_MODEL`, `AUTH_USERNAME`, `AUTH_PASSWORD`, `SESSION_SECRET`, `APP_TIME_ZONE`, and the exact Vercel `FRONTEND_ORIGIN` as private Render environment variables. The Render free service may spin down after inactivity and take time to wake; free-plan limitations and terms can change.

MongoDB Atlas M0 can be used as the database subject to Atlas limits and network access configuration. No Vercel/Render deployment, cloud setting, Atlas connection, or Gemini generation has been performed from this workspace. After successful deployment, the site can continue working while the laptop is off while Vercel, the protected Render API, Atlas, and Gemini are available. Install the mobile home-screen shortcut from the deployed **HTTPS Vercel URL**, never `localhost` or a laptop LAN address.

## Build

```powershell
npm run build
npm run server:build
npm run server:test
```

The frontend command type-checks and creates the Vite/PWA production output; the server command compiles TypeScript to `server/dist`; the test command runs isolated authentication/authorization tests with no Atlas connection or database writes.
