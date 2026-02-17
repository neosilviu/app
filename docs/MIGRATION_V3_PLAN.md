# Plan de Migrare: Studio App v3 Core (Modular Agent Architecture)

Acest document descrie etapele necesare pentru conversia completă a aplicației de la modelul monolit (Level 8) la arhitectura modulară v3 (Enterprise Level 10).

## 🎯 Obiective
- Eliminarea dependenței de un `registry-baseline.ts` gigant.
- Migrarea tuturor entităților în folderul `app/core/entities/`.
- Trecerea la validare Zod-First (SSOT).
- Decuplarea logică a modulelor pentru activare/dezactivare la runtime.

---

## 🏗️ Etapa 1: Infrastructura Core (Finalizată ✅)
- [x] Definirea `BaseSchema` în `app/core/schemas/base.ts`.
- [x] Crearea Bridge-ului `getV3EntitiesAsLegacy` pentru compatibilitate.
- [x] Configurarea Vite/TSConfig pentru suport Cross-Folder.
- [x] Injectarea Bridge-ului în `registry-baseline.ts`.

## 📦 Etapa 2: Migrarea Entităților Rămase (Finalizată ✅)
- [x] **Utilizatori (`user`)**: Mutată în `app/core/entities/user.ts`.
- [x] **Workspace-uri (`workspace`)**: Mutată în `app/core/entities/workspace.ts`.
- [x] **Produse (`product`)**: Mutată în `app/core/entities/product.ts`.
- [x] **Etichete (`tag`)**: Mutată în `app/core/entities/tag.ts`.
- [x] **Audit Log**: Definirea schemei de logare în `app/core/entities/audit_log.ts`.

## ⚙️ Etapa 3: Business Logic & Actions (Finalizată ✅)
- [x] **Unified Action Protocol**: Inserarea dispatcher-ului de acțiuni în `brain.server.ts` care permite executarea handlerelor din v3.
- [x] **Audit Undo**: Implementarea primei acțiuni complexe modularizate în `audit_log.ts`.
- [x] **Decuplarea Backend-ului**: Optimizarea `backend-v2` (Zod & TSConfig) pentru a recunoaște structurile modularizate.

## 🛡️ Etapa 4: Database & Sync Evolution (Finalizată ✅)
- [x] **Refactor `syncEntityTable`**: Logica existentă a fost validată ca fiind compatibilă cu Bridge-ul V3.
- [x] **Disable Auto-Sync on Dev**: Dezactivarea pornirii automate a migrărilor SQL în favoarea self-healing-ului la runtime.
- [x] **Automated Testing Loop (Option 4)**: Integrarea Vitest pentru validarea automată a schemelor și acțiunilor la fiecare entitate creată.

## 🧹 Etapa 5: Curățenie & Optimizare (Finalizată ✅)
- [x] **Curățarea `brain.server.ts`**: Eliminarea a peste 1500 de linii de handlere legacy (Registry, Entity) în favoarea Modular Actions.
- [x] **Eliminarea totală a `ENTITY_CONFIG` din `registry-baseline.ts`**: Entitățile sunt injectate automat via Bridge V3.
- [x] **Arhitectură Enterprise Level 10**: Instrucțiunile AI au fost actualizate pentru a impune noul standard.
- [x] **Modular Dispatcher**: Dispatcher-ul din `brain.server.ts` injectează acum contextul securizat (db, user, registry) direct în handler-ele v3.

## 🚀 Etapa 6: Validare & Dezactivare Legacy (Finalizată ✅)
- [x] **Dezactivarea completă a endpoint-urilor legacy**: Toate rutele din `brain.server.ts` (auth, workspace, system, monitoring) sunt acum delegatori V3.
- [x] **Migrarea interfețelor de UI**: Paginile Superadmin și Monitoring folosesc acum `useActionV3`.
- [x] **Testarea regresiei Setup Admin**: Fluxul de inițializare a fost portat pe `user.ts` modular.

## 🤖 Etapa 7: Operațiuni Autonome (Finalizată ✅)
- [x] **Modular AI Architect**: Logica de design a bazei de date a fost mutată din Brain într-o acțiune modulară în `ai_prompt.ts`.
- [x] **Unified Action Protocol**: Dispatcher-ul din `brain.server.ts` permite executarea handlerelor direct din entități.
- [x] **Internal Pub/Sub (Triggers)**: `brain.server.ts` suportă hook-uri automate (`beforeCreate`, `afterUpdate`, `afterDelete`) definite în entități (Injectate în Phase 9).
- [x] **Migration Sandbox**: Implementarea acțiunii `heal-db` în `entity_definition.ts` care permite sincronizarea controlată a tabelelor D1.
- [x] **Self-Configuring AI**: Gestionarea prompturilor de sistem ca entități V3.

## 💎 Etapa 8: Zero-Config & Enterprise Level 10 (Finalizată ✅)
- [x] **Registry-Less Discovery**: Eliminarea importurilor manuale din `entities/index.ts` via `import.meta.glob` cu fallback pentru Node.js.
- [x] **Vitest Safety Loop v2**: Audit automat pe toate entitățile descoperite pentru a asigura standardele Enterprise Level 10.
- [x] **Discovery-Driven Navigation**: Generarea automată a meniului lateral (`NAV`) pe baza metadatelor din entități (V3 Navigation).
- [x] **Pluggable Marketplace**: Mutarea template-urilor gigant în fișiere modulare sub `core/marketplace/` (Automated Discovery active).
- [x] **Hydrated Registry State**: `registry.ts` a fost transformat într-un agregator automat care combină V3 Modular cu sistemul legacy.

## 🚀 Etapa 9: UI Integration & Intelligence (Finalizată ✅)
- [x] **Dynamic Action Buttons**: Randerizarea automată a butoanelor în `DynamicEntityList` și `DynamicEntityDetail` pe baza `entity.actions`.
- [x] **Global Action UI**: Dropdown dedicat pentru acțiuni la nivel de colecție în header-ul listelor.
- [x] **Contextual AI Assist**: Butoane "Magic Fill" în formulare care sugerează date pe baza contextului entității (Sparkles Button).
- [x] **Magic Creator UI**: Interfață de chat nativă în Builder pentru a crea entități noi via Natural Language (AI Architect).
- [x] **Action RBAC Editor**: Interfață pentru gestionarea permisiunilor granulare pe acțiuni (Inherited vs Direct Access).
- [x] **V3 Form Engine (Alpha)**: Trecerea formularelor la randerizare 100% din `.describe()`-ul Zod (Sections, Placeholders, Hints & Validations discovery).

## 🚀 Etapa 10: AI Intelligence & Automation (Finalizată ✅)
- [x] **Modular AI Architect**: Logica de design a bazei de date a fost mutată dintr-un endpoint generic într-o acțiune modulară în `ai_prompt.ts`.
- [x] **Contextual Magic Fill**: Implementarea handler-ului `magic-fill` în entitatea `lead` și integrarea butonului contextual Sparkles în formulare.
- [x] **Architect UI Integration**: Buton "AI Architect" în Entity Builder care permite generarea de noi entități prin limbaj natural.
- [x] **Global AI Dispatcher (Enterprise Level 10)**: Rafinarea `AiService` pentru a suporta "Tool Use" (funcții) direct din registrul de acțiuni. AI-ul poate agora executa sarcini complexe apelând acțiuni modulare (`solve-task`).
- [x] **Autonomous Self-Healing**: Acțiune de sistem în `system_error` care analizează log-urile de erori și propune strategii de remediere folosind LLM.
- [x] **Autonomous Executor**: Implementarea loop-ului `runTask` în `AiService` care permite AI-ului să execute succesiv acțiuni pentru a rezolva task-uri complexe.

## 🚀 Etapa 11: Enterprise Level 11 & Autonomous Ecosystem (In Progress 🔄)
- [x] **Unified Entity Hub (Backend-v2 Sync)**: Migrarea `backend-v2/src/core/registry.ts` pentru a consuma direct `AVAILABLE_V3_ENTITIES`. Eliminarea entitatilor hardcodate din backend.
- [ ] **Local Agent Tunneling Protocol**: Configurarea tunelului (ex: Cloudflare Tunnel/ngrok) pentru a mapala `/api/v2/*` catre agentul local separat.
- [x] **Node.js Discovery Optimization**: Rafinarea loop-ului de discovery in `core/entities/index.ts` pentru a suporta maparea cailor absolute in medii containerizate/virtualizate.
- [x] **Production Self-Healing**: Sincronizarea tabelelor D1 cu schemele Zod validate (Master Audit) prin actiunea `heal-db`. (Executat cu succes verificarea alinierii).
- [x] **Boot-Time Resilience**: Implementarea loop-ului de recuperare in `db-init.server.ts` care detecteaza bazele de date goale si forteaza re-sync-ul chiar daca token-ul de KV este prezent.
- [x] **Worker Discovery Protocol**: Mutarea logicii de pornire a workerilor (WhatsApp, Gmail) din Brain in handlere de actiuni V3. (Implementat prin entitatea `worker` și backend refresh).
- [ ] **Autonomous Task Benchmarking**: Validarea loop-ului `runTask` prin scenarii de automatizare cross-entity (ex: Lead -> Deal -> Task creation).
- [x] **V3 Form Engine (Beta)**: Implementarea suportului complet pentru validari numerice (min/max), regex si tooltips extrase direct din `.describe()`.
- [ ] **Legacy Decommissioning**: Stergerea definitiva a folderului `OLD` si a handler-elor comentate dupa validarea stabilitatii in productia finala.
- [x] **Global Discovery Logic**: Extinderea `import.meta.glob` pentru a include si plugin-uri locale sau module de marketplace fara nicio linie de cod de setup. (Implementat în `core/entities/index.ts`).

## 🌉 Etapa 11.1: Local Agent Hybrid Bridge (Current Focus 🎯)
- [ ] **Tunneling Setup**: Configurarea `/api/tunnel` in Brain care sa realizeze proxy-ul catre Local Agent pentru actiuni de tip "Hardware".
- [x] **Entity Action Metadata**: Adaugarea metadatelor `.describe('ui:location=local')` pe actiunile care trebuie executate pe Hardware Local.
- [ ] **Unified Socket Bridge**: Refactorizarea `AiService` si `Frontend` pentru a asculta pe un singur canal de Socket care aggreaga evenimentele de la Brain si Local Agent.

## 🔮 Etapa 12: Zero-Touch Operations & Smart Auto-Scaling
- [ ] **Edge-to-Local Bridge**: Implementarea unui proxy inteligent care ruteaza request-urile de scriere grele catre Local Agent si pe cele de citire catre D1 Edge Cache.
- [x] **Schema-to-SQL AI Migration**: Un utilitar care foloseste AI pentru a genera si rula migrarile SQL pentru schimbari distructive (ex: redenumire coloane) pe care self-healing-ul nu le poate face singur. (Implementat în `entity_definition.ts`).
- [x] **Autonomous Health Monitoring**: Integrarea `system_error.ts` cu un loop de auto-fixare care poate reporni local agent-ul daca tunelul cade. (Implementat acțiunea `monitor-tunnel`).
---

## 🛠️ Instrucțiuni de Dezvoltare (Agent Guidelines)
1. **Niciodată** nu adăuga entități noi în `registry-baseline.ts`.
2. Toate entitățile noi se adaugă direct în `app/core/entities/`. Ele sunt auto-descoperite de sistem.
3. **Loop de Testare**: După orice modificare de entitate, rulează `npm run test:v3` pentru a valida contractul Enterprise Level 10.
4. Toate metadatele de UI (`width`, `label`, `icon`) trebuie să stea în `.describe()` în interiorul schemei Zod.
5. **Regula Enterprise Level 10**: Orice componentă nouă (serviciu, marketplace, nav) trebuie să fie "Self-Registering". Pierdem timp cu cablarea manuală.
