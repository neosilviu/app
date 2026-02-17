# Studio App v3 - Instrucțiuni de Codare AI (Modular Agent Architecture)

Instrucțiuni experte pentru dezvoltarea în workspace-ul Studio App v3 (Enterprise Level 10).

## 🚨 **REGULA DE AUR: 100% REGISTRY-DRIVEN & MODULAR DNA**

### **REGULA ABSOLUTĂ - Nicio valoare hardcodată în cod!**
- ❌ **INTERZIS**: String-uri, URL-uri, modele, prompt-uri, parametri hardcodați în cod.
- ❌ **INTERZIS**: **Failsafe / Fallback strings** - Nu folosi al doilea argument în `t('key', 'default')`. Dacă cheia lipsește din registry, trebuie să rămână goală.
- ❌ **INTERZIS**: Definirea tabelelor SQL manual pentru entități. Schema se generează din Zod.
- ✅ **OBLIGATORIU**: **Modular Architecture (v3)** - Fiecare entitate nouă (sau modul opțional precum `deal` sau `task`) trebuie să locuiască în propriul fișier sub `app/core/entities/*.ts`.
- ✅ **OBLIGATORIU**: **Level 10 Master Model** - Toate entitățile moștenesc automat `BaseSchema` (id, workspaceId, createdAt, updatedAt, deletedAt). Nu le redifini manual!
- ✅ **OBLIGATORIU**: **Zod-First Metadata** - Folosește `.describe('ui:width=6;label=Nume')` pe schemele Zod pentru a injecta metadate de UI.
- ✅ **OBLIGATORIU**: **Singular Naming Convention** - Toate entitățile și tabelele la **SINGULAR**.
- ✅ **OBLIGATORIU**: **Unified Action Protocol** - Orice logică de business complexă trebuie definită ca un obiect de tip `Action` cu input/handler clar.

### **STYLING & FORMATTING**
- ✅ **OBLIGATORIU**: Importurile din `lucide-react` trebuie să fie întotdeauna pe **O SINGURĂ LINIE**, indiferent de numărul de iconițe importate. 
  - ❌ **INTERZIS**: Multi-line imports pentru iconițe.
  - ✅ **EXEMPLU**: `import { Activity, Shield, Settings, Zap, History, User } from 'lucide-react';`

**Impact:** Arhitectura modulară permite agenților AI să opereze pe contexte mici și sigure.

---

## 🏗️ Arhitectură: "Modular & Agent-First"
Studio App v3 este optimizat pentru operare autonomă de către agenți AI:
- **Core Entities (`app/core/entities/`)**: Module independente care definesc datele, validările și acțiunile locale.
- **The Brain (Cloudflare Workers)**: `frontend/app/brain.server.ts`. Inima logică care orchestrează normalizarea entităților v3 și sincronizarea lor cu D1.
- **D1 Self-Healing**: Baza de date se sincronizează automat cu definițiile din cod. Nu scrie fișiere de migrare SQL decât pentru logică de date complexă.
- **Enterprise Level 10 Core**:
  - **Structural Inheritance**: `normalizeEntity` injectează automat trăsăturile de sistem (Soft Delete, Audit, Workspace Isolation).
  - **Action Protocol**: Agenții AI apelează acțiuni predefinite (ex: `send-wa`) în loc să modifice handlere de rute.
  - **Module Service**: Permite activarea/dezactivarea la runtime a feature-urilor (ex: modulul de CRM/Vânzări).

## 🎨 Frontend: Schema-Driven UI
- **Dynamic Forms/Lists**: UI-ul se randează automat pe baza specificațiilor din schema Zod a entității.
- **V3 Bridge**: Entitățile noi sunt translate automat în formatul legacy pentru compatibilitate prin `getV3EntitiesAsLegacy()`.

## 🤖 **AI SYSTEM - 100% Discoverable**
- **Semantic Metadata**: Folosește `.describe()` în Zod pentru a explica agenților AI la ce servește fiecare câmp sau acțiune.
- **Actions**: Definește `input` strict pe acțiuni pentru ca AI-ul să știe exact ce parametri să trimită.

## 🔒 Reguli de Securitate & Operare
- **Workspace Isolation**: Câmpul `workspaceId` este obligatoriu și gestionat automat de Master Model (Level 10).
- **Audit Logging**: Automatizat prin `features: ['audit']`. Nu scrie logica de audit manual în servicii.
- **Excludere Folder OLD**: 🚨 **INTERZISĂ** orice modificare sau citire din folderul `OLD`.

## 🔍 Key Files & Folders
- `app/core/entities/`: Definițiile modulare de business (v3).
- `app/core/schemas/base.ts`: Fișierul DNA care conține `BaseSchema`.
- `app/core/services/`: Logica de business stateless (Audit, Module, Integration).
- `registry-baseline.ts`: Registry-ul hibrid care integrează modulele v3 și setările globale.
- `frontend/app/brain.server.ts`: Orchestratorul principal.

## 🛠️ D1 Production Ops (Maintenance)
Folosește aceste comenzi pentru mentenanța bazei de date de producție (`studio-db`):
- **Listare Tabele**: `npx wrangler d1 execute studio-db --remote --command="SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%';"`
- **Nuke Rapid (Excluzând sistem)**: `npx wrangler d1 execute studio-db --remote --command="PRAGMA foreign_keys = OFF; DROP TABLE IF EXISTS user; DROP TABLE IF EXISTS session; ...; PRAGMA foreign_keys = ON;"`
- **Reset Migrări**: `npx wrangler d1 execute studio-db --remote --command="DELETE FROM d1_migrations;"`
- **Aplicare Migrări**: `npx wrangler d1 migrations apply studio-db --remote` (Fără `--yes`, este interactiv).
- **Verificare Raport**: `npx wrangler d1 execute studio-db --remote --command="SELECT (SELECT COUNT(*) FROM user) as users, (SELECT COUNT(*) FROM workspaces) as workspaces;"`

---
*Utilizatorul este Vizionar/Designer. AI-ul (tu) este Arhitectul & Coderul. Orice linie de cod scrisă trebuie să respecte filozofia Registry-Driven.*
