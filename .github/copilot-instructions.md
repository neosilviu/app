# Studio App v2 - Instrucțiuni de Codare AI

Instrucțiuni experte pentru dezvoltarea în workspace-ul Studio App v2 (Enterprise Level 8).

## 🚨 **REGULA DE AUR: 100% REGISTRY-DRIVEN & NO-CODE ENGINE**

### **REGULA ABSOLUTĂ - Nicio valoare hardcodată în cod!**
- ❌ **INTERZIS**: String-uri, URL-uri, modele, prompt-uri, parametri hardcodați în cod.
- ❌ **INTERZIS**: **Failsafe / Fallback strings** - Nu folosi al doilea argument în `t('key', 'default')`. Dacă cheia lipsește din registry, trebuie să rămână goală.
- ❌ **INTERZIS**: **Silent Failsafes (Code)** - Nu folosi `try-catch` blocks care returnează seturi de date goale (`[]`, `null`) pentru a ascunde erori de DB sau Auth. Erorile trebuie sa fie vizibile!
- ❌ **INTERZIS**: Definirea tabelelor SQL manual în cod sau în migrări statice pentru entitățile din Builder.
- ✅ **OBLIGATORIU**: Totul vine din Registry (D1 + `registry-baseline.ts`).
- ✅ **OBLIGATORIU**: **Singular Naming Convention** - Toate entitățile, tabelele și cheile din Registry trebuie să fie la **SINGULAR** (ex: `contact`, nu `contacts`).
- ❌ **INTERZIS**: **Automatic Pluralization** - Nu folosi logici de pluralizare automată. Dacă un tabel în DB este la plural, acesta trebuie redenumit la singular pentru a respecta Registry-ul, NU invers.
- ✅ **OBLIGATORIU**: SSOT ("Single Source of Truth") este baza de date D1 (tabelul `system_settings`) sincronizată cu `registry-baseline.ts`.
- ✅ **OBLIGATORIU**: Metaprogramare + template engine pentru prompt-uri.
- ✅ **OBLIGATORIU**: Folosire `useConfig()` (Frontend) și `getRegistry()` (Worker) pentru a încărca config.

### **STYLING & FORMATTING**
- ✅ **OBLIGATORIU**: Importurile din `lucide-react` trebuie să fie întotdeauna pe **O SINGURĂ LINIE**, indiferent de numărul de iconițe importate. 
  - ❌ **INTERZIS**: Multi-line imports pentru iconițe.
  - ✅ **EXEMPLU**: `import { Activity, Shield, Settings, Zap, History, User } from 'lucide-react';`

**Impact:** Orice schimbare de config/prompt/entitate se face DOAR din interfața SuperAdmin, fără redeploy!

---

## 🏗️ Arhitectură: "Worker-First" (Cloud Native)
Studio App v2 folosește o arhitectură orientată către Cloudflare:
- **The Brain (Cloudflare Workers)**: `frontend/app/brain.server.ts` este inima aplicației. Gestionează logica de business, securitatea și **Metaprogramarea Database**.
- **The Database (Cloudflare D1)**: Stocare relațională globală. Logica `syncEntityTable` din Worker gestionează DDL-ul (CREATE/ALTER) automat pe baza definițiilor din Registry.
- **Enterprise Level 8 Core**:
  - **Undo Engine**: Fiecare modificare semnificativă stochează `snapshot_before`/`snapshot_after` în `audit_logs`.
  - **Polymorphic Attachments**: Tabelul `entity_attachments` permite legarea fișierelor de ORICE entitate (Contacts, Deals, etc.) folosind `entity_type` și `entity_id`.
  - **Flow State Machine**: Suport nativ pentru statusuri complexe și tranziții în entități.
- **Local Agent (Node.js)**: Server Socket.IO pentru funcții hardware (WhatsApp, Printing) și proxy local.

## 🎨 Frontend: No-Code UI (React Router v7)
- **Dynamic Entities**: Interfața este generată complet din definițiile din `Registry`.
- **Entity Builder**: UI în SuperAdmin care permite adăugarea de câmpuri, relații și validări fără a scrie cod.
- **Styling**: Tailwind CSS v4 + Shadcn/UI (shadcn-v4).
- **Core Hooks**: 
  - `useConfig()`: Acces la toate entitățile, constantele și setările sistemului.
  - `useSocket()`: Comunicare în timp real cu Local Agent.

## ⚙️ Logic Layer (The Brain)
- **Metaprogramare**: Când un utilizator adaugă un câmp nou în Builder, Worker-ul execută `ALTER TABLE` pe D1 automat.
- **Security Logic**: RBAC-ul este definit în Registry și verificat în `brain.server.ts`.
- **AI Integration**: Prompt-urile și modelele sunt injectate din Registry. NU scrie prompt-uri în cod.

## 🤖 **AI SYSTEM - 100% Registry-Driven**
- **Prompts**: Stocate în registry sub `aiPrompts`. Folosește `{{ variable }}` pentru substituție.
- **Models**: Configurate în `system_settings` (Cloudflare AI, Gemini, Claude).
- **Settings UI**: SuperAdmin controlează tot: temperatură, model, format output, prompt-uri sistem.

## 🌐 **I18n & Traduceri (Hybrid Strategy)**
- ✅ **Registry (`const I18N`)**: Exclusiv pentru "Cuvintele de Control" și arhitectură.
    - Navigare, Sidebar, Butoane Core (`Save`, `Search`), Roluri, Entități.
    - Avantaj: Hot-editing instant din SuperAdmin, performanță O(1).
- ✅ **JSON Locales (`public/locales`)**: Doar pentru conținut static și informativ.
    - Placeholder-e lungi, tutoriale, mesaje de ajutor module specific (ex: erori hardware WhatsApp).
- ✅ **Regula de Aur**: Folosește obiecte `{ ro: '...', en: '...' }` pentru traducerile dinamice și utilitarul `renderString(val, lang)` pentru afișare.

## 🔒 Reguli de Securitate & Operare
- **D1 First**: În producție, D1 este singura bază de date de încredere.
- **Audit**: Înregistrează întotdeauna acțiunile de scriere în `audit_logs` cu snapshot-uri pentru feature-ul de Undo.
- **Sync**: `syncEntityTable` trebuie să fie idempotent. Nu șterge coloane fără backup/confirmare explicită.
- **Excludere Folder OLD si backend**: 🚨 **INTERZISĂ** orice modificare, ștergere sau citire în afara contextului de backup a folderului `OLD`. Acest folder este rezervat exclusiv pentru copii de siguranță manuale și fișiere istorice ale utilizatorului. Nu muta fișiere acolo și nu rula scripturi în interiorul lui.

## 🔍 Key Files
- `frontend/app/brain.server.ts`: Central logic hub (The Brain).
- `registry-baseline.ts`: Specificația de bază a sistemului (The DNA).
- `frontend/app/lib/registry.ts`: Loader-ul pentru setări și constante.
- `frontend/app/components/EntityDefinitionsPanel.tsx`: UI-ul de administrare a bazei de date.

## 🛠️ D1 Production Ops (Maintenance)
Folosește aceste comenzi pentru mentenanța bazei de date de producție (`studio-db`):
- **Listare Tabele**: `npx wrangler d1 execute studio-db --remote --command="SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%';"`
- **Nuke Rapid (Excluzând sistem)**: `npx wrangler d1 execute studio-db --remote --command="PRAGMA foreign_keys = OFF; DROP TABLE IF EXISTS user; DROP TABLE IF EXISTS session; ...; PRAGMA foreign_keys = ON;"`
- **Reset Migrări**: `npx wrangler d1 execute studio-db --remote --command="DELETE FROM d1_migrations;"`
- **Aplicare Migrări**: `npx wrangler d1 migrations apply studio-db --remote` (Fără `--yes`, este interactiv).
- **Verificare Raport**: `npx wrangler d1 execute studio-db --remote --command="SELECT (SELECT COUNT(*) FROM user) as users, (SELECT COUNT(*) FROM workspaces) as workspaces;"`

---
*Utilizatorul este Vizionar/Designer. AI-ul (tu) este Arhitectul & Coderul. Orice linie de cod scrisă trebuie să respecte filozofia Registry-Driven.*
