# 🚀 BACKEND-V2 IMPLEMENTATION PLAN

**Status:** IMPLEMENTATION  
**Start Date:** 16 ianuarie 2026  
**Target Completion:** 20 ianuarie 2026  
**Architecture:** Registry-Driven, Decoupled, Enterprise Level 8

---

## 📋 OVERVIEW

### Goal
Rebuild Backend from scratch as **Backend-v2** with:
- ✅ Registry-Driven Architecture (SSOT from `registry-baseline.ts` + D1)
- ✅ Rewritten Workers (WhatsApp, Gmail, TaskProcessor, Inbox) with clean separation of concerns
- ✅ REST API for Brain operations (entities, registry, audit)
- ✅ Socket.IO for real-time worker events
- ✅ Type-safe with TypeScript
- ✅ 100% Independent from Backend-v1 (can run in parallel)
- ✅ **AI-Readable Code:** Clear, well-documented, easy for AI to understand and extend

### Non-Goals
- ❌ Modify Frontend logic (only add cache layer)
- ❌ Touch Backend-v1 (keep as backup)
- ❌ Change user-facing UI
- ❌ Modify `registry-baseline.ts` structure

### 🎯 Philosophy
**You are the Architect & Designer. AI is the Coder.**
- Code must be crystal clear with proper TypeScript types
- Every function must have JSDoc comments explaining purpose, parameters, returns
- No clever tricks or overly complex logic
- Separation of concerns: one class/file = one responsibility
- Easy for future AI agents (and humans) to understand and maintain

---

## 🏗️ PHASE BREAKDOWN

### **PHASE 1: SCAFFOLDING & CORE SETUP** ⏱️ 1-2 hours

#### 1.1 Directory Structure
- [ ] Create `/app/backend-v2/` directory
- [ ] Create subdirectories: `src/`, `src/core/`, `src/api/`, `src/workers/`, `src/services/`, `src/db/`, `src/utils/`
- [ ] Create config directories: `.env.v2`, `.gitignore-v2`

#### 1.2 Package & Config
- [ ] Create `backend-v2/package.json` with dependencies (reuse existing versions from backend-v1):
  - `express@^5.2.1` (from backend-v1)
  - `sqlite3@^5.1.7` (from backend-v1)
  - `dotenv@^17.2.3` (from backend-v1)
  - `socket.io@^4.8.1` (from backend-v1)
  - `googleapis@^169.0.0` (from backend-v1)
  - `whatsapp-web.js@github:pedroslopez/whatsapp-web.js` (from backend-v1)
  - `nodemailer@^7.0.12` (from backend-v1)
  - `fs-extra@^11.3.3` (from backend-v1)
  - `axios@^1.13.2` (from backend-v1)
  - **New additions:**
    - `typescript@^5.3.0` (for type safety)
    - `ts-node@^10.9.0` (for running .ts directly)
    - `nodemon@^3.1.11` (from backend-v1, already have)
    - `joi@^17.11.0` (for validations)
    - `winston@^3.11.0` (for logging)
    - `@types/express@^4.17.21` (TypeScript types)
    - `@types/node@^20.10.0` (TypeScript types)
- [ ] Create `backend-v2/tsconfig.json`
- [ ] Create `backend-v2/.env.v2` template

#### 1.3 Entry Point
- [ ] Create `src/index.ts` - Express server on port 4001
- [ ] Create `src/config.ts` - Config loader from `.env.v2`
- [ ] Create health check route: `GET /health`
- [ ] Create Socket.IO instance placeholder

#### 1.4 Gitignore & Documentation
- [ ] Add `backend-v2/` to root `.gitignore`
- [ ] Create `backend-v2/README.md` with setup instructions

**Success Criteria:**
```bash
cd app/backend-v2
npm install
npm run dev
# Server should start on port 4001
# GET http://localhost:4001/health → { status: 'ok', initializing: true }
```

---

### **PHASE 2: CORE REGISTRY & DATABASE** ⏱️ 2-3 hours

#### 2.1 Database Driver
- [ ] Create `src/db/driver.ts` - SQLite adapter
  - Methods: `list()`, `get()`, `set()`, `update()`, `delete()`, `query()`, `batch()`
  - Connection to `/app/local_db.sqlite` (shared D1)

#### 2.2 Registry Core
- [ ] Create `src/core/registry.ts`
  - `mergeRegistryWithD1(db)` - PORT from `frontend/app/brain.server.ts`
  - Load `registry-baseline.ts`
  - Merge with `system_settings` from D1
  - Merge with `entity_definitions` from D1
  - Return complete Registry object
- [ ] Create `src/core/cache-manager.ts`
  - `RegistryCache` class with `get()`, `set()`, `invalidate()`, `refresh()`
  - TTL: 5 minutes
  - Version tracking

#### 2.3 Entity & Audit Core
- [ ] Create `src/core/entity-sync.ts`
  - `syncEntityTable()` - Create/alter tables based on Registry
  - **IDEMPOTENT:** Safe to call multiple times without side effects
  - Handle migrations automatically
  - Validate field types and constraints
  - ❌ **NEVER hardcode table definitions** - all from Registry
  - Support Flow State Machine: respect `statusField` and allowed transitions from Registry
  - Support Polymorphic Attachments: ensure `entity_attachments` table is available
- [ ] Create `src/core/audit.ts`
  - `createAuditProxy()` - Intercept DB mutations
  - Store `snapshot_before`, `snapshot_after` in `audit_log`
  - Enable Undo engine
  - **EVERY write operation must have audit trail**

#### 2.4 Initialize Registry at Startup
- [ ] Modify `src/index.ts` to:
  - Load Registry on server start
  - Cache it globally
  - Emit readiness event

**Success Criteria:**
```bash
npm run dev
# Server logs:
# [REGISTRY] Loaded 15 entities
# [CACHE] Initialized (TTL: 5min)
# [DB] Connected to /app/local_db.sqlite
# Ready on port 4001
```

---

### **PHASE 3: REST API LAYER** ⏱️ 1-2 hours

#### 3.1 Entity Handlers
- [ ] Create `src/api/handlers/entity.handler.ts`
  - `GET /api/v2/entities` - List all entities
  - `GET /api/v2/entities/:name` - Get entity schema
  - `POST /api/v2/entities` - Create new entity
  - `PUT /api/v2/entities/:name` - Update entity schema
  - `DELETE /api/v2/entities/:name` - Archive entity
  - Auto-validate via Registry

#### 3.2 Registry Handlers
- [ ] Create `src/api/handlers/registry.handler.ts`
  - `GET /api/v2/registry` - Get full registry
  - `GET /api/v2/registry/:namespace` - Get namespace
  - `POST /api/v2/registry/:namespace/:key` - Set value
  - Invalidate cache on mutation

#### 3.3 Audit Handlers
- [ ] Create `src/api/handlers/audit.handler.ts`
  - `GET /api/v2/audit/logs` - List audit logs
  - `POST /api/v2/audit/undo/:logId` - Undo operation
  - `GET /api/v2/audit/entity/:entityId` - Get entity history

#### 3.4 Route Registration
- [ ] Create `src/api/routes.ts`
  - Register all handlers
  - Add middleware: auth (if needed), error handling, logging
  - Add CORS support

#### 3.5 Error Handling
- [ ] Create global error middleware
- [ ] Standardized error responses

**Success Criteria:**
```bash
curl http://localhost:4001/api/v2/registry
# Response: { "success": true, "data": { ... } }
```

---

### **PHASE 4: SOCKET.IO SETUP** ⏱️ 1 hour

#### 4.1 Socket Manager
- [ ] Create `src/services/SocketManager.ts`
  - Namespace: `/` (default)
  - Methods: `emit()`, `broadcast()`, `emitToWorkspace()`
  - Connection/disconnect handlers

#### 4.2 Worker Namespaces (placeholders)
- [ ] Define namespaces:
  - `/whatsapp` - WhatsApp events
  - `/gmail` - Gmail events
  - `/printing` - Print queue events
  - `/inbox` - File archiving events

#### 4.3 Event Structure
- [ ] Define standard event format:
  ```
  {
    "type": "worker:status",
    "workspaceId": "...",
    "data": { ... },
    "timestamp": ISO8601
  }
  ```

**Success Criteria:**
```bash
# Frontend can connect to ws://localhost:4001
# Socket.IO debugger shows connected
```

---

### **PHASE 5: WHATSAPP WORKER REWRITE** ⏱️ 2-3 hours

#### 5.1 WhatsApp Service Structure
- [ ] Create `src/workers/whatsapp/WhatsAppService.ts`
  - Constructor: accepts Registry, DB, SocketManager, Logger
  - Methods:
    - `initialize()` - Load sessions, QR codes
    - `sendMessage(contact, message, mediaUrls?)`
    - `onMessageReceived(message)` - Handler
    - `onQRCode(qr)` - QR handler
    - `onReady()` - Connection ready
    - `stop()` - Graceful shutdown

#### 5.2 QR Handler
- [ ] Create `src/workers/whatsapp/QRHandler.ts`
  - Generate QR code from string
  - Store in `/app/local-inbox/qr/`
  - Emit via Socket.IO: `whatsapp:qr-generated`
  - Emit via Socket.IO: `whatsapp:authenticated` when scanned

#### 5.3 Message Handler
- [ ] Create `src/workers/whatsapp/MessageHandler.ts`
  - Parse incoming messages
  - Extract sender, text, media
  - Validate against Registry (entity: Contact) - ❌ **NO hardcoded validation**
  - **RBAC Check:** Verify user has permission to create/update interactions (from Registry RBAC)
  - Store in `interactions` table (via EntityService)
  - **Polymorphic Attachments:** Link media via `entity_attachments` table, not direct column
  - **Flow State Machine:** Respect interaction status transitions from Registry
  - Emit: `whatsapp:message-received`

#### 5.4 Media Downloader
- [ ] Create `src/workers/whatsapp/MediaDownloader.ts`
  - Download media from WhatsApp
  - **NEVER hardcode allowed extensions** - validate from Registry settings
  - Store in `/app/local-inbox/whatsapp/:senderId/`
  - Generate thumbnails if image/PDF
  - **Polymorphic Attachments:** Link to interaction via `entity_attachments` table:
    ```sql
    INSERT INTO entity_attachments 
    (id, entity_type, entity_id, file_path, mime_type, size)
    VALUES (?, 'interaction', ?, ?, ?, ?)
    ```

#### 5.5 Integration
- [ ] Create `src/workers/WhatsAppWorker.ts` (orchestrator)
  - Manages WhatsAppService lifecycle
  - Handles reconnects
  - Syncs sessions to DB

**Success Criteria:**
```bash
# Backend-v2 starts
# WhatsApp worker initializes
# QR code generated and logged
# Can scan with phone
# Message received → stored in DB with audit
```

---

### **PHASE 6: GMAIL WORKER REWRITE** ⏱️ 2-3 hours

#### 6.1 Gmail Service Structure
- [ ] Create `src/workers/gmail/GmailService.ts`
  - Constructor: Registry, DB, SocketManager, Logger
  - Methods:
    - `initialize()` - Setup OAuth, load credentials
    - `startListener()` - Polling for new messages
    - `onMessageReceived(message)` - Handler
    - `stop()` - Stop listening

#### 6.2 Message Listener
- [ ] Create `src/workers/gmail/MessageListener.ts`
  - **Poll interval from Registry** - ❌ DON'T hardcode (use `system.gmail_poll_interval`)
  - Parse sender, subject, body
  - Validate against Registry (entity: Contact/Email) - ❌ NO hardcoded validation
  - **RBAC Check:** Verify workspace has permission to create interactions
  - Store in `interactions` table
  - **Flow State Machine:** Respect status transitions from Registry

#### 6.3 Attachment Processor
- [ ] Create `src/workers/gmail/AttachmentProcessor.ts`
  - Extract attachments from email
  - **NEVER hardcode allowed file types** - get from Registry: `system.inbox_allowed_extensions`
  - Download and store in `/app/local-inbox/gmail/:senderId/`
  - **Polymorphic Attachments:** Link via `entity_attachments` table (same pattern as WhatsApp)

#### 6.4 Integration
- [ ] Create `src/workers/GmailWorker.ts`
  - Manages GmailService lifecycle
  - Handles auth refresh
  - Emits: `gmail:initialized`, `gmail:message-received`, `gmail:error`

**Success Criteria:**
```bash
# Gmail credentials loaded
# Inbox polling starts
# New emails detected
# Attachments downloaded
# Events emitted via Socket.IO
```

---

### **PHASE 7: TASK WORKER REWRITE (Print, Convert, Archive)** ⏱️ 3-4 hours

#### 7.1 Task Service Structure
- [ ] Create `src/workers/task/TaskService.ts`
  - Constructor: Registry, DB, SocketManager
  - Methods:
    - `handleTask(taskType, payload)`
    - `convertOfficeToPdf(input, output)`
    - `extractArchive(input, output)`
    - `printDocument(file, printer)`

#### 7.2 Media Conversion (Matching V1)
- [ ] Implement Office -> PDF
  - Check `system.libreoffice_path` from Registry
  - Use `child_process` to spawn LibreOffice (headless)
  - Fallback to Microsoft Word COM (PowerShell) if configured
- [ ] Implement Video Encoding
  - Check `system.ffmpeg_path`
  - Use `ffmpeg-static` or system ffmpeg
- [ ] Implement Image Processing
  - Use `sharp` (already installed)
  - Resize/Compress logic based on Registry profiles

#### 7.3 Archive Extraction (Matching V1)
- [ ] Implement `extractArchive`
  - Support ZIP (PowerShell/Native)
  - Support RAR (UnRAR/WinRAR via path from Registry)
  - Support 7z (7-Zip via path from Registry)
  - **Security:** Scan extracted files (placeholder for future AV)

#### 7.4 Printing Subsystem
- [ ] Implement `listPrinters()`
  - PowerShell `Get-Printer` (Windows) / `lpstat` (Linux)
- [ ] Implement `printJob()`
  - PowerShell `Start-Process -Verb Print`
  - Support printer selection
  - **Audit:** Log every print job in `audit_log`

#### 7.5 Integration
- [ ] Create `src/workers/TaskWorker.ts`
  - Listen for `task:submit` events via Socket.IO or DB queue
  - Execute appropriate method
  - Report progress via Socket.IO

**Success Criteria:**
```bash
# Can convert .docx -> .pdf
# Can extract .zip/.rar
# Can list and print to local printers
```

---

### **PHASE 8: INBOX & ARCHIVING WORKER** ⏱️ 1.5-2 hours

#### 8.1 Inbox Manager
- [ ] Create `src/workers/inbox/InboxManager.ts`
  - Constructor: Registry, DB, Logger
  - Methods:
    - `processMessage(source, data)` - Entry point
    - `saveAttachments(files)` - Store files
    - `createNotification(files)` - Create inbox_notifications record
    - `cleanup()` - Remove expired files
  - **NEVER hardcode file extensions** - get from Registry: `system.inbox_allowed_extensions`
  - **Polymorphic Attachments:** All files linked via `entity_attachments` table

#### 8.2 Archiver
- [ ] Create `src/workers/inbox/Archiver.ts`
  - **Scheduled cleanup interval from Registry** - ❌ DON'T hardcode (use `system.inbox_cleanup_interval_hours`)
  - Remove files older than TTL (from Registry: `system.inbox_ttl_days`)
  - Protect files linked to orders (printing_sessions)
  - Delete orphaned notifications
  - **Audit:** Log cleanup operations in audit_log

#### 8.3 Integration
- [ ] Create `src/workers/InboxWorker.ts`
  - Manages InboxManager + Archiver lifecycle
  - Emits: `inbox:notification-created`, `inbox:cleanup-completed`

**Success Criteria:**
```bash
# Inbox manager initialized
# WhatsApp/Gmail messages → files saved
# Cleanup runs on schedule
# Old files removed, protected files kept
```

---

### **PHASE 9: WORKER MANAGER & ORCHESTRATION** ⏱️ 1-1.5 hours

#### 9.1 Worker Manager
- [ ] Create `src/services/WorkerManager.ts`
  - Manages all workers (WhatsApp, Gmail, Print, Inbox)
  - Lifecycle hooks: `initialize()`, `start()`, `stop()`, `restart()`
  - Health checks per worker
  - Auto-restart on failure

#### 9.2 Worker Registry Integration
- [ ] Create `src/services/WorkerRegistry.ts`
  - Load worker config from Registry (which workers enabled, timeouts, etc.)
  - Enable/disable workers via Registry change
  - **RBAC:** Verify user has permission to change worker settings
  - **NO hardcoded worker names/timings** - all from Registry: `system.worker_*_enabled`, `system.worker_*_timeout`

#### 9.3 Logging & Monitoring
- [ ] Create `src/utils/logger.ts`
  - Winston logger with levels
  - Structured logging with context
  - Log to console and optional file

**Success Criteria:**
```bash
# All workers started on server init
# Health checks pass
# Can query /api/v2/workers/status
# Worker config loaded from Registry
```

---

### **PHASE 10: FRONTEND INTEGRATION (Cache Layer + Conditional Routes)** ⏱️ 1.5-2 hours

#### 10.1 Cache Manager
- [ ] Create `frontend/app/lib/cache-manager.ts`
  - `RegistryCache` class (same as backend-v2)
  - Methods: `get()`, `set()`, `invalidate()`, `refresh()`
  - TTL: 5 minutes
  - Global instance in `globalThis.REGISTERED_CACHE`

#### 10.2 Audit Proxy Enhancement
- [ ] Modify `frontend/app/brain.server.ts`
  - Import `RegistryCache`
  - Initialize in `startServer()`
  - Replace `db.list()` calls with `cache.refresh()`
  - Audit proxy invalidates cache on mutations
  - Store merged registry in `globalThis.CACHED_CONFIG`

#### 10.3 Registry-Driven Backend-v2 Flag
- [ ] Modify `registry-baseline.ts`
  - **LEVERAGE EXISTING SETTING:** Use `WORKER_CONFIG.enabled` as the master toggle
  - Add to `WORKER_CONFIG`:
    ```typescript
    export const WORKER_CONFIG = {
      enabled: true,  // ← Master switch (existing "Procesare în Fundal")
      backend_v2_enabled: false,  // ← NEW: Controls which backend (v1 vs v2)
      backend_v2_port: 4001,
      backend_v1_port: 4000,
      // ... rest of config
    }
    ```
  - **SSOT Principle:** 
    - `enabled=true` + `backend_v2_enabled=false` → Use Backend-v1 (current)
    - `enabled=true` + `backend_v2_enabled=true` → Use Backend-v2 (new)
    - `enabled=false` → All workers disabled (both versions)
  - SuperAdmin toggles `backend_v2_enabled` in existing "Procesare în Fundal" UI
  - No new settings UI needed - reuse current Workers section

#### 10.4 Backend-v2 Routes Conditioning (Build-Time)
- [ ] Modify `frontend/app/routes.ts`
  - Routes must be registered at build time (React Router requirement)
  - For now, ALL routes registered (v1 and v2 together)
  - Visibility controlled at runtime via Registry (see 10.5)
  - Plan: Future optimization could use dynamic imports
  ```typescript
  // All routes registered, but filtered at runtime by useConfig
  const allRoutes = [
    ...apiRoutes,
    route("($lang)._app.monitoring", "routes/($lang)._app.monitoring.tsx"),
    route("($lang)._app.comms", "routes/($lang)._app.comms.tsx"),
    route("($lang)._app.printing", "routes/($lang)._app.printing.tsx"),
    ...fsRoutes
  ];
  return allRoutes;
  ```

#### 10.5 Navigation Bar Conditioning (Runtime)
- [ ] Modify `frontend/app/hooks/useConfig.tsx`
  - Filter navigation items based on Registry flag:
    ```typescript
    const workerConfig = config?.constants?.WORKER_CONFIG ?? {};
    const backendV2Enabled = workerConfig.backend_v2_enabled ?? false;
    
    const baseMain = (dynamicNav?.main || []).filter(item => {
        // Hide backend-v2 pages if not enabled
        if (!backendV2Enabled && ['comms', 'monitoring', 'printing'].includes(item.id)) {
            return false;
        }
        return true;
    });
    ```
  - Navigation updates automatically when Registry changes
  - Audit trail: Every change logged in audit_log

#### 10.6 Socket.IO Port Configuration (Runtime)
- [ ] Update socket connection in Frontend (entry point or hook):
  ```typescript
  // frontend/app/entry.server.tsx or useSocket.ts
  const config = useConfig();
  const workerConfig = config?.constants?.WORKER_CONFIG ?? {};
  const backendV2Enabled = workerConfig.backend_v2_enabled ?? false;
  const port = backendV2Enabled 
    ? (workerConfig.backend_v2_port || 4001)
    : (workerConfig.backend_v1_port || 4000);
  
  const socket = io(`http://localhost:${port}`);
  ```
  - Socket reconnects automatically when config changes (if needed)
  - Fallback: Detects which port is available

#### 10.7 SuperAdmin UI for Backend-v2 Toggle
- [ ] **REUSE EXISTING SETTINGS:** In SuperAdmin "Procesare în Fundal" (Workers) section
  - Add toggle: "Enable Backend-v2 (New Brain)"
  - When enabled:
    - Pages (Monitoring, Communication, Printing) appear in sidebar
    - Socket.IO port changes to 4001
    - Backend-v2 expected to be running
  - When disabled:
    - Pages hidden from sidebar
    - Routes still accessible (for backward compat)
    - Socket.IO port stays 4000 (Backend-v1)
  - Saves to D1 `WORKER_CONFIG.backend_v2_enabled`
  - **NO new UI component needed** - integrate into existing Workers settings

**Success Criteria:**
```bash
# Frontend starts normally
# Registry loaded and cached
# Subsequent requests use cache (<1ms)
# Mutations invalidate cache

# BY DEFAULT (backend_v2_enabled: false):
#   - Monitoring, Communication, Printing pages NOT visible in sidebar
#   - Direct access to /monitoring still works (for backward compat)
#   - Socket.IO connects to port 4000 (Backend-v1)
#   - Users see familiar interface

# WHEN ENABLED via SuperAdmin (backend_v2_enabled: true):
#   - Pages appear in sidebar (no rebuild needed)
#   - Socket.IO reconnects to port 4001 (Backend-v2)
#   - All features work normally
#   - Audit trail shows who enabled it

# SWITCHING BACK:
#   - Disable flag in SuperAdmin
#   - UI updates instantly (no reload)
#   - Pages disappear from sidebar
#   - Socket.IO reconnects to 4000
```

---

### **PHASE 11: TESTING & VALIDATION** ⏱️ 2-3 hours

#### 11.1 Unit Tests
- [ ] Test `RegistryCache` (hit/miss/invalidation)
- [ ] Test `mergeRegistryWithD1()`
- [ ] Test entity validation
- [ ] Test audit snapshots

#### 11.2 Integration Tests
- [ ] Backend-v2 can start and connect to DB
- [ ] REST API endpoints return correct data
- [ ] Socket.IO events emit correctly
- [ ] Workers initialize without errors
- [ ] Cache invalidation works

#### 11.3 End-to-End Tests
- [ ] Frontend can fetch Registry via REST (if enabled)
- [ ] Create entity via API → table created in DB
- [ ] WhatsApp receives message → stored with audit
- [ ] Gmail receives email → stored with audit
- [ ] File added to print queue → printed
- [ ] File cleanup runs on schedule

#### 11.4 Regression Tests
- [ ] Backend-v1 still works (for comparison)
- [ ] No breaking changes to Frontend UI
- [ ] Socket.IO events still compatible

**Success Criteria:**
- All unit tests pass
- All integration tests pass
- E2E flow works start-to-finish
- Performance: Registry load <50ms, cache hit <1ms

---

### **PHASE 12: FEATURE FLAG & SWITCH** ⏱️ 30 minutes

#### 12.1 Environment Flag
- [ ] Add `USE_BACKEND_V2=false` to `.env`
- [ ] Add to `frontend/.env.dev`

#### 12.2 Frontend Switch Logic (Optional)
- [ ] Create `frontend/app/lib/api-client.ts`
  - Wrapper for API calls
  - Routes to Backend-v2 if `USE_BACKEND_V2=true`
  - Falls back to local logic otherwise

#### 12.3 Switch Procedure
- [ ] Set `USE_BACKEND_V2=true`
- [ ] Frontend Socket.IO connects to `localhost:4001` instead of `4000`
- [ ] Test all flows
- [ ] If issues, revert to `false` immediately

**Success Criteria:**
```bash
USE_BACKEND_V2=false # Works with v1 (current state)
USE_BACKEND_V2=true  # Works with v2 (new state)
```

---

### **PHASE 13: CLEANUP & DOCUMENTATION** ⏱️ 1 hour

#### 13.1 Backend-v1 Decision
- [ ] Option A: Keep as backup (add to `.gitignore` or move to `OLD/`)
- [ ] Option B: Archive to backup branch
- [ ] Option C: Delete (only if v2 fully stable)

#### 13.2 Documentation
- [ ] Update `backend-v2/README.md` with:
  - Architecture diagram
  - Setup instructions
  - Worker descriptions
  - API endpoints list
  - Troubleshooting guide
- [ ] Update root `README.md` with Backend-v2 info
- [ ] Add `ARCHITECTURE_V2.md` at root

#### 13.3 Code Cleanup
- [ ] Remove dead code
- [ ] Ensure proper logging
- [ ] Add JSDoc comments to public APIs

**Success Criteria:**
- Documentation is complete and clear
- New developers can understand Backend-v2 structure
- Setup is reproducible

---

## 📊 DEPENDENCY CHAIN

```
Phase 1 (Scaffolding)
    ↓
Phase 2 (Core Registry & DB)
    ↓
Phase 3 (REST API)
    ↓
Phase 4 (Socket.IO)
    ↓
┌─────────────────────┬──────────────────┬──────────────┬─────────────┐
│ Phase 5 (WhatsApp)  │ Phase 6 (Gmail)  │ Phase 7 (Print) │ Phase 8 (Inbox) │
│ (parallel)          │ (parallel)       │ (parallel)    │ (parallel)  │
└─────────────────────┴──────────────────┴──────────────┴─────────────┘
    ↓
Phase 9 (Worker Manager)
    ↓
Phase 10 (Frontend Cache)
    ↓
Phase 11 (Testing)
    ↓
Phase 12 (Feature Flag)
    ↓
Phase 13 (Cleanup & Docs)
```

**Parallelizable Phases:** 5, 6, 7, 8 (workers can be done independently)

---

## 📐 CODE QUALITY STANDARDS

### TypeScript & Format
- ✅ **Strict TypeScript:** `strict: true` in tsconfig.json
- ✅ **Interfaces first:** Define clear interfaces for every service
- ✅ **JSDoc on all public methods:**
  ```typescript
  /**
   * Loads Registry from D1 and merges with baseline
   * @param db - SQLite database connection
   * @returns Merged Registry object with all entities and settings
   */
  async function mergeRegistryWithD1(db: SqliteDatabase): Promise<Registry> { ... }
  ```
- ✅ **Meaningful variable names:** No `x`, `tmp`, `data123`
- ✅ **Single responsibility:** One class = one job
- ✅ **No magic numbers:** All hardcoded values → Registry lookups
- ✅ **Error handling:** Try-catch with proper logging (Winston)

### Structure & Readability (for AI)
- ✅ **Clear file organization:** Handlers → Services → Core → Utils
- ✅ **Constructor injection:** All dependencies passed in constructor
  ```typescript
  constructor(
    private registry: Registry,
    private db: SqliteDriver,
    private socketManager: SocketManager,
    private logger: Logger
  ) { }
  ```
- ✅ **Explicit types everywhere:** No `any` type
- ✅ **Comments explain WHY, not WHAT:**
  ```typescript
  // ✅ Good: Explains decision
  // Respect status transitions from Registry to prevent invalid state changes
  const validTransitions = registry.getStatusTransitions(entity.status);
  
  // ❌ Bad: Explains what code does (obvious)
  // Set variable to registry status transitions
  ```

### Logging & Debugging
- ✅ **Structured logging:** Include context (workspaceId, userId, etc.)
  ```typescript
  this.logger.info('[WhatsApp] Message received', {
    senderId: message.from,
    workspaceId: workspace.id,
    hasAttachments: attachments.length > 0
  });
  ```
- ✅ **Error logging with full stack:** 
  ```typescript
  this.logger.error('[Gmail] Failed to download attachment', {
    error: err.message,
    stack: err.stack,
    attachmentId: att.id
  });
  ```

---

## ✅ SUCCESS CRITERIA (Global)

- [ ] Backend-v2 starts without errors
- [ ] All REST endpoints respond correctly
- [ ] All workers initialize
- [ ] **Registry-Driven:** ZERO hardcoded values (printer names, timeouts, extensions, etc.)
- [ ] **Polymorphic Attachments:** All files linked via `entity_attachments` table
- [ ] **Flow State Machine:** Status transitions respect Registry definitions
- [ ] **RBAC:** All operations check permissions from Registry
- [ ] **Audit Trail:** Every mutation logged with snapshots (Undo engine working)
- [ ] **Idempotency:** `syncEntityTable` safe to call multiple times
- [ ] **AI-Readable Code:**
  - ✅ Full JSDoc on all public methods
  - ✅ Clear TypeScript interfaces and types
  - ✅ No magic numbers or unclear variable names
  - ✅ Proper error handling and logging
  - ✅ Single responsibility per class/file
  - ✅ Constructor injection for all dependencies
- [ ] WhatsApp can send/receive messages
- [ ] Gmail listens and receives emails
- [ ] Print jobs execute
- [ ] File archiving works
- [ ] Cache improves performance (50x for repeated requests)
- [ ] Socket.IO events emit correctly
- [ ] Frontend UI remains unchanged and functional
- [ ] No regression in Backend-v1 features (if keeping as backup)

---

## 🚨 ROLLBACK PLAN

| Phase | Rollback Action | Effort |
|---|---|---|
| 1-2 | Delete `backend-v2/` directory | Instant |
| 3-4 | Same + revert any Frontend changes | 5 min |
| 5-11 | Same + reset `frontend/app/brain.server.ts` | 15 min |
| 12 | Set `USE_BACKEND_V2=false`, restart | Instant |
| 13 | Check Backend-v1 still in repo | 1 min |

**Emergency Rollback:** 
```bash
git checkout frontend/app/brain.server.ts
rm -rf app/backend-v2/
git clean -fd
# Restart both servers
```

---

## 📈 TRACKING

Format: `[x]` = done, `[ ]` = todo, `[-]` = in-progress

Update this document as you progress through phases.

---

## 🎯 FINAL CHECKLIST

```
INFRASTRUCTURE
  [x] backend-v2/ directory created
  [x] All npm dependencies installed
  [x] TypeScript compiles without errors
  [x] Server starts on port 4001

CORE
  [x] Registry-Driven architecture working
  [x] Cache layer operational
  [x] Database driver connects to SQLite
  [x] Audit system captures mutations

API
  [x] REST endpoints respond correctly
  [x] Error handling works
  [x] CORS configured

WORKERS
  [x] WhatsApp worker sends/receives messages
  [x] Gmail worker listens and processes
  [x] Print queue executes jobs
  [x] Inbox archiving runs on schedule

INTEGRATION
  [x] Frontend pointed to Port 4001
  [x] Socket.IO events bridged (WhatsApp -> Namespace)
  [x] Registry CJS conflict resolved
  [ ] No UI regressions

TESTING
  [x] Unit tests pass (Sanity Check)
  [x] Integration tests pass
  [ ] E2E flows work
  [ ] Performance acceptable

DEPLOYMENT
  [ ] Feature flag works
  [ ] Rollback plan tested
  [x] Documentation complete
  [ ] Code review passed
```

---

**Last Updated:** 16 ianuarie 2026  
**Next Review:** After Phase 2 completion
