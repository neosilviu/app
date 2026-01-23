# Studio App Backend v2 System Documentation

**Enterprise Level 8 Registry-Driven Backend**

## 1. Architecture Overview

The backend follows a **Worker-First** and **Registry-Driven** philosophy.
- **The Brain (Frontend)** defines the "DNA" (Schema, Settings, Logic) in `registry-baseline.ts`.
- **The Database (SQLite)** holds the state and overrides (`system_settings`, `entity_definitions`).
- **The Backend (Node.js)** is a dumb executor that reads the Registry and performs I/O tasks.

### Core Components

| Component | Path | Description |
|-----------|------|-------------|
| **Core** | `src/core/` | Registry loader, Database driver, Entity Sync, Audit Log. |
| **API** | `src/api/` | REST endpoints for Brain interaction. |
| **Socket** | `src/services/` | Real-time communication via Socket.IO. |
| **Workers** | `src/workers/` | Independent logic modules (WhatsApp, Gmail, Task). |

---

## 2. Setup & Installation

### Prerequisites
- Node.js v18+
- SQLite3
- LibreOffice (for PDF conversion)
- ffmpeg (for video encoding)

### Installation
```bash
cd backend-v2
npm install
```

### Configuration (`.env.v2`)
```env
PORT=4001
NODE_ENV=development
DB_PATH=../local_db.sqlite
```

### Running
```bash
# Development (TS-Node)
npm run dev

# Production (Compiled JS)
npm run build
npm start
```

---

## 3. Worker Modules

### 📱 WhatsApp Worker (`src/workers/whatsapp`)
- **Library:** `whatsapp-web.js` (LocalAuth).
- **Function:** Handles checking for messages, sending messages, and maintaining session.
- **Media:** Downloads attachments to `inbox/whatsapp/<sender>/<date>/`.
- **Registry:** Saves interactions to `interactions` table.

### 📧 Gmail Worker (`src/workers/gmail`)
- **Library:** `googleapis` (OAuth2).
- **Function:** Polls inbox using tokens stored in `system_settings`.
- **Media:** Downloads attachments to `inbox/gmail/<sender>/<date>/`.
- **State:** Removes `UNREAD` label after processing.

### 🖨️ Task Worker (`src/workers/task`)
- **Printing:** Uses native OS commands (`powershell`, `lp`) via `TaskService`.
- **Conversion:** HTML/Image -> PDF via Puppeteer; Office -> PDF via LibreOffice/Word.
- **Extraction:** ZIP/RAR/7z extraction.
- **Socket Event:** Listens for `task:print` and `task:convert`.

### 📂 Inbox Worker (`src/workers/inbox`)
- **Function:** Monitors generic `local-inbox` folder for manual file drops.

---

## 4. API Endpoints

Base URL: `http://localhost:4001/api/v2`

### Registry
- `GET /registry` - Get full merged registry (Baseline + DB).
- `GET /registry/:namespace` - Get specific namespace (e.g., `entity`, `system`).

### Entities (exclude `system_*`)
- `GET /entity` - List all entity definitions.
- `GET /entity/:name` - List records for an entity (supports query params).
- `POST /entity/:name` - Create a new record (Auto-Audited).
- `PUT /entity/:name/:id` - Update a record (Auto-Audited).

### Audit
- `GET /audit/log` - Retrieve audit trail.

---

## 5. Socket.IO Events

Namespace: `/`
- `task:print` (Client -> Server): Request print job.
- `task:print:result` (Server -> Client): Result of print job.

Namespace: `/whatsapp`
- `status`: `{ status: 'ready' | 'authenticated' }`
- `qr`: `{ data: 'base64...' }`
- `message-stored`: `{ id: '...', content: '...' }`

Namespace: `/gmail`
- `status`: `{ status: 'authed' | 'needs_auth' }`
- `email-received`: `{ subject: '...' }`

---

## 6. Development Guidelines

1. **No Hardcoding:** If you need a timeout, file extension list, or prompt, put it in `registry-baseline.ts`.
2. **Type Safety:** Always use TypeScript interfaces.
3. **Logging:** Use `winston` logger, never `console.log`.
4. **Idempotency:** Workers must be safe to restart at any time.

---

## 7. Troubleshooting

**WhatsApp QR not showing:**
- Check logs for "QR Code received".
- Ensure `socket.io-client` version matches on frontend.

**Gmail Auth failed:**
- Check `system_settings` table for `gmail_tokens`.
- Restart worker to force token refresh.

**Database Locked:**
- Monitor `local_db.sqlite-wal`.
- Ensure `WAL` mode is enabled (Driver does this automatically).
