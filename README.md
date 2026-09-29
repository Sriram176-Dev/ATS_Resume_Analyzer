# ATS Resume Analyzer

A full-stack web app that shows job seekers how applicant tracking systems (ATS) read their resume. Upload a PDF or Word resume and get an explainable score, a checklist of what parsers can and can't read, keyword matching against a job description, and prioritised fixes. Reports can be downloaded as PDF.

**Stack:** React 19 + Vite, Express 4, MongoDB (Mongoose), Google Gemini (optional).

> Scores are **estimates** based on behaviour common to most ATS software. No tool can reproduce a specific employer's system, and the app says so.

---

## Features

- **Explainable scoring.** Every point comes from a named check (email present, standard headings, action verbs, quantified results...) with a pass/warn/fail status and a fix. No black box.
- **PDF and DOCX** upload, validated by file signature (not just extension), with clear errors for scanned/image-only PDFs, password-protected files, and legacy `.doc`.
- **Keyword matching** against a pasted job description: boundary-aware (Java is not JavaScript), alias-aware (K8s = Kubernetes), weighted (technical skills count more than soft skills).
- **AI suggestions** via Gemini, with a rule-based fallback. The app works fully without an API key; if the AI is down, users are told and still get recommendations.
- **PDF report export** for every analysis.
- **Progress tracking:** history, best/average/latest score, and a trend line.
- **Accessible, responsive UI** with light and dark themes. Audited with axe-core (WCAG 2.2 AA): zero violations on all pages, both themes, and mobile.

## How the score works

| Part | Weight with a job description | Weight without | What it checks |
|---|---|---|---|
| Keywords | 40% | n/a | Coverage of the job description's skills and terms |
| Format | 30% | 50% | Contact info, standard section headings, dates, bullets, length, page count, extractable structure |
| Content | 30% | 50% | Action-verb bullets, quantified results, weak/cliché phrases, first-person language, bullet length and variety |

Without a job description the keyword score is `null` (not a fake number) and the UI says so. The full list of checks lives in [`server/utils/atsScore.js`](server/utils/atsScore.js) and is covered by tests.

---

## Quick start (development)

**Requirements:** Node.js >= 22.13, MongoDB (local, Docker, or Atlas).

```bash
git clone <your-repo-url> && cd ATS_Resume_Analyzer
npm install                      # root dev tooling (concurrently)
npm run install:all              # server + client dependencies

cp server/.env.example server/.env
# edit server/.env: set MONGODB_URI and JWT_SECRET (GEMINI_API_KEY is optional)

npm run dev                      # API on :5000, web app on http://localhost:5173
```

The Vite dev server proxies `/api` to the API, so there is no CORS setup in development.

### Useful scripts

| Command | What it does |
|---|---|
| `npm run dev` | API (nodemon) and web app together |
| `npm test` | Server tests (Node test runner) and client tests (Vitest) |
| `npm run lint` | ESLint on the client |
| `npm run build` | Production build of the web app to `client/dist` |
| `npm run check` | lint + tests + build (what CI runs) |

---




### Platform checklist

- Set `NODE_ENV=production`, `MONGODB_URI`, `JWT_SECRET`, and (optionally) `GEMINI_API_KEY`.
- Use MongoDB Atlas (or a managed Mongo) with a dedicated database user and IP allow-list.
- Health check path: `/api/health` (returns 503 while the database is unreachable).
- Build command: `npm --prefix client ci && npm --prefix client run build && npm --prefix server ci --omit=dev`. Start command: `node server/server.js` (run from `server/`).

---

## Project structure

```
client/                 React app (Vite)
  src/
    api/                axios client + typed service functions
    components/         ui primitives (ScoreRing, Field, ...) and layout (Navbar, guards)
    context/            Auth, Theme, Toast providers
    lib/                pure helpers (format, score, jwt, files, errors)
    pages/              Landing, Login, Register, Dashboard, Report, Contact, NotFound
    styles/             design tokens, base styles, UI primitives
server/
  app.js                Express app factory (no listen; testable)
  server.js             DB connection, listen, graceful shutdown
  config/env.js         validated configuration
  controllers/ routes/ middleware/ validators/ models/
  services/             analysis pipeline, PDF report, serializers
  utils/                parser, ATS scoring, keyword engine, AI client
  tests/                unit + API tests
```

## API

All routes are under `/api`. Errors share one shape: `{ "error": "message", "code": "CODE", "details"?: [...], "requestId": "..." }`.

| Method & path | Auth | Description |
|---|---|---|
| `GET /health` | no | Liveness/readiness (503 if DB is down) |
| `GET /config` | no | Public settings (upload limit, whether AI is on) |
| `POST /auth/register` | no | `{ name, email, password }` -> `{ token, user }` |
| `POST /auth/login` | no | `{ email, password }` -> `{ token, user }` |
| `GET /auth/me` | yes | Current user |
| `POST /resumes` | yes | Multipart: `resume` (PDF/DOCX), optional `jobDescription`, `label`. Returns the full analysis |
| `GET /resumes?page&limit` | yes | Paginated history |
| `GET /resumes/stats` | yes | Count, best, average, latest, change, trend |
| `GET /resumes/:id` | yes | Full analysis |
| `GET /resumes/:id/report.pdf` | yes | Downloadable PDF report |
| `DELETE /resumes/:id` | yes | Delete an analysis |
| `POST /contact` | no | Contact form (stored in the `contactmessages` collection) |

## Security notes

- Passwords hashed with bcrypt (cost 12); login is timing-equalised and returns one generic error for wrong email or password.
- JWTs are pinned to HS256 with an expiry; secrets are validated at startup.
- Input validation (zod) on every route; non-string payloads (NoSQL-injection attempts) are rejected.
- Uploads: extension pre-check, size limit, in-memory only, real file-signature check, PDF page cap, and `pdf.js` runs with script evaluation disabled.
- Rate limiting on the API overall, on auth (failed attempts), on analyses (per user), and on the contact form (plus a honeypot).
- Helmet security headers with a strict CSP; CORS is closed unless `FRONTEND_URL` is set.
- Users can only ever read or delete their own analyses (other users' ids return 404). Raw resume text is never returned by the API.
- The session token is kept in `localStorage`. This is simple and common, but readable by any XSS bug; the strict CSP mitigates this. Moving to an `httpOnly` cookie is a reasonable future hardening step.

## Privacy

Uploaded resumes are parsed on the server and the analysis (including extracted text) is stored under the user's account until they delete it. When `GEMINI_API_KEY` is set, resume and job-description text is sent to Google's Gemini API to generate suggestions, and the UI tells users this. Review your own privacy policy and terms before a public launch.

## Testing

```bash
npm test                    # both suites
npm --prefix server test    # 67 tests: parsing, scoring, keywords, AI parsing, full API flows
npm --prefix client test    # 22 tests: helpers, route guard, sign-in flow
```

API tests run the real Express stack (routing, validation, auth, uploads, PDF/DOCX parsing, scoring, report generation) and stub only the Mongoose model methods, so no database is needed to run them.

## Known gaps / before a public launch

- Routes moved under `/api` (e.g. `POST /api/resumes`); the old text-only `/resume/upload` endpoint from the original project is gone.
- No privacy policy or terms of service page yet.
- The contact form only stores messages in MongoDB; there's no email notification or admin inbox UI.
- Docker image builds were not verified in this environment (Docker wasn't available); the server was verified to run correctly with production-only dependencies in an equivalent layout.
- The `@google/generative-ai` SDK is used for AI suggestions; Google's newer `@google/genai` SDK was not adopted since it couldn't be tested here.
