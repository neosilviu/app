# Studio App v3 - Cloud Native (Enterprise Level 10)

Un sistem avansat **Registry-Driven & No-Code Engine** construit pe arhitectură **Worker-First**.

##  Concept: 100% Zero Hardcoding

Studio App v2 respectă regula de aur: nicio valoare (string-uri, prompt-uri, rute, entități) nu este hardcodată în cod. Totul este generat dinamic din **Registry** (Cloudflare D1 + Baseline).

- **The Brain (Cloudflare Workers)**: Logica centrală, securitatea și metaprogramarea bazei de date.
- **The DNA (Registry Baseline)**: Specificația de bază din 
egistry-baseline.ts.
- **The Database (Cloudflare D1)**: Stocare globală, sincronizată automat prin rain.server.ts.
- **The Local Agent (Node.js)**: Server auxiliar pentru funcții hardware (WhatsApp, Printare) și proxy local.

##  Stack Tehnic

- **Frontend**: React 19 + React Router v7 + Tailwind CSS v4 + Shadcn/UI.
- **Backend (Brain)**: Cloudflare Worker + Hono (Custom Logic Hub).
- **Backend (Local Agent)**: Node.js + Socket.IO + WAWebJS.
- **Database**: Cloudflare D1 (Global) + SQLite (Local Cache/Agent).

##  Structura Proiectului

`
/app
 frontend/             # React Router v7 Application
    app/              # Core logic & components
       brain.server.ts # Main Logic Hub (The Brain)
       hooks/        # useConfig, useAuth, useSocket
       routes/       # Dynamic & Static routes
    package.json
 backend/              # Local Agent (Node.js)
    lib/              # WhatsApp, Gmail, Print logic
    server.js         # Entry point local
 registry-baseline.ts  # System DNA (Default Config)
 wrangler.toml         # Cloudflare Deployment Config
`

##  Dezvoltare Locală

### 1. Pornire The Brain (Vite Dev Server)
Se rulează în rădăcina folderului rontend:
`ash
cd frontend
npm install
npm run dev
`

### 2. Pornire Local Agent
Se rulează în rădăcina folderului ackend:
`ash
cd backend
npm install
npm run start
`

##  Documentație Suplimentară
- [Arhitectura Sistemului](docs/architecture.md)
- [Arhitectura Bazei de Date](docs/DATABASE_ARCHITECTURE.md)
- [Ghid Frontend](docs/frontend_guide.md)
- [Ghid Local Agent](docs/local_agent_guide.md)

---
"Vizionarul este Designerul. AI-ul este Arhitectul & Coderul."
