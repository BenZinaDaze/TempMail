# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

TempMail is a disposable email system. Users generate a temporary email address, receive emails in real-time via WebSocket, and the session auto-expires after a configurable time (default 60 minutes). The UI is in Chinese (zh-CN).

## Commands

### Backend (`backend/`)
```bash
npm run dev    # node --watch src/server.js (dev with auto-reload)
npm start      # node src/server.js (production)
```

### Frontend (`frontend/`)
```bash
npm run dev      # vite dev server (port 5173)
npm run build    # production build → dist/
npm run lint     # eslint .
npm run preview  # preview production build
```

### Docker
```bash
docker-compose up -d   # full stack: web on :3000, SMTP on :25→:2525
```

No test framework is configured in either frontend or backend.

## Architecture

**Push-only messaging model with no persistence.** Emails arrive via SMTP, get parsed, and are immediately pushed to the frontend over WebSocket. Messages are never stored — if no WebSocket client is connected when an email arrives, the message is lost.

### Data Flow
1. User generates email → `POST /api/email/generate` → `MemoryStore` creates session
2. Frontend opens WebSocket → `ws://host?email=<address>` → connection stored in `MemoryStore.connections`
3. External MTA delivers to SMTP → `smtp.js` validates recipient exists → parses with `mailparser` → pushes via `wsNotify()`
4. Frontend receives `{ type: "new_message", message }` → renders in `EmailList`
5. Session expires → cleanup interval removes session + closes WebSocket → SMTP rejects new mail (550)

### Backend (`backend/src/`)
- **server.js** — Express app, REST API routes, static file serving, graceful shutdown
- **smtp.js** — `SMTPServer` (authOptional, plaintext only, `hideSTARTTLS: true`)
- **websocket.js** — `WebSocketServer` on same HTTP server, heartbeat ping/pong, returns `notify()` function
- **store.js** — `MemoryStore` class: in-memory `sessions` Map and `connections` Map, auto-cleanup of expired sessions
- **config.js** — centralized env var parsing with validation; `MAIL_DOMAIN` is required (app exits if missing)
- **middleware/rateLimiter.js** — express-rate-limit wrappers
- **utils/validation.js** — prefix validation + blacklist check
- **utils/errorHandler.js** — standardized error responses with error codes
- **utils/logger.js** — pino with pino-pretty in dev

### Frontend (`frontend/src/`)
- **App.jsx** — single-page root, conditional rendering (generator vs inbox)
- **components/EmailGenerator.jsx** — prefix input + generate button
- **components/EmailList.jsx** — message list sorted by receivedAt
- **components/EmailViewer.jsx** — modal with sandboxed iframe for HTML, `<pre>` for text, attachment download
- **components/Timer.jsx** — countdown to session expiry
- **hooks/useWebSocket.js** — manages WS connection, message state, reconnection
- **utils/validation.js** — client-side prefix validation (mirrors backend rules)

### Key Design Decisions
- **No database** — everything is in-memory; all data lost on server restart
- **Single WebSocket connection per email** — new connection replaces old one
- **Plaintext SMTP only** — `hideSTARTTLS: true` prevents TLS handshake failures with external MTAs
- **Production deployment** — Docker multi-stage build; frontend built into `backend/public/`, served by Express; `VITE_API_URL`/`VITE_WS_URL` forced empty so frontend uses relative paths

## Environment Variables

### Backend (required: `MAIL_DOMAIN`)
| Variable | Default | Purpose |
|---|---|---|
| `MAIL_DOMAIN` | — | Email domain (required) |
| `PORT` | 3000 | HTTP port |
| `SMTP_PORT` | 2525 | SMTP port (25 in production) |
| `CORS_ORIGIN` | `*` | CORS origin |
| `EMAIL_EXPIRY_MINUTES` | 60 | Session lifetime |
| `EMAIL_PREFIX_BLACKLIST` | 12 reserved words | Comma-separated banned prefixes |
| `HEARTBEAT_INTERVAL` | 30000 | WebSocket heartbeat (ms) |
| `CLEANUP_INTERVAL` | 60000 | Expired session cleanup (ms) |
| `LOG_LEVEL` | info | debug/info/warn/error |

### Frontend
| Variable | Default | Purpose |
|---|---|---|
| `VITE_API_URL` | `http://localhost:3000` | Backend API URL (empty in production) |
| `VITE_WS_URL` | `ws://localhost:3000` | WebSocket URL (empty in production) |

## Known Issues

- **Prefix blacklist is duplicated** between `backend/src/utils/validation.js` and `frontend/src/utils/validation.js` — must be kept in sync manually
- **GET message endpoints are non-functional** — `session.messages` is referenced in server.js routes but never populated; messages are push-only via WebSocket
- **`MAX_MESSAGES_PER_EMAIL`** env var is defined in config but never enforced
- **`nodemailer`** is a backend dependency but is never imported
