# Arhitectura Sistemului (Enterprise Level 8)

Proiectul Studio App v2 este construit pe principiul **Worker-First Architecture**, utilizand **Cloudflare Workers** ca Creier central si un **Local Agent** pentru operatiuni hardware si procesari locale.

##  Pilonii Arhitecturali

### 1. The Brain (Unified API) - frontend/app/brain.server.ts
Acesta este nucleul aplicatiei care ruleaza in contextul Cloudflare Workers.
- **SSOT (Single Source of Truth)**: Gestioneaza Registry prin fuziunea dintre registry-baseline.ts si baza de date D1.
- **Metaprogramare Database**: In loc de migrari statice, brain.server.ts monitorizeaza definitiile din Registry si executa automat ALTER TABLE / CREATE TABLE pe Cloudflare D1 pentru a mentine schema sincronizata.
- **Securitate Centralizata**: Gestioneaza RBAC si autentificarea (Better-Auth).
- **AI Orchestrator**: Injecteaza prompt-urile din Registry si gestioneaza apelurile catre Cloudflare AI / Gemini.

### 2. The Database (Cloudflare D1)
- **Global & Scalable**: D1 este baza de date relationala principala.
- **Auto-Healing**: Schema se repara/actualizeaza singura la fiecare pornire a sistemului daca detecteaza discrepante fata de Registry.
- **Audit Engine**: Fiecare operatiune de scriere (Create/Update/Delete) trece prin createAuditProxy care salveaza snapshot-uri before si after pentru functia de Undo.

### 3. Local Agent (Local Hub) - backend/
Ruleaza pe hardware-ul local (Node.js) pentru sarcini inaccesibile din Cloudflare Workers:
- **WhatsApp Integration**: Bridge catre WAWebJS.
- **Printing**: Acces direct la spooler-ul de printare local.
- **Filesystem**: Procesarea si arhivarea fisierelor locale mari.
- **WebSocket Gateway**: Socket.IO pentru feedback instantaneu in UI.

##  Frontend: No-Code React UI
- **Dynamic Entity Builder**: Toate ecranele de listare si editare sunt generate dinamic.
- **Registry Integration**: Hook-ul useConfig() ofera acces instantaneu la toate constantele sistemului fara a necesita reincarcarea paginii.

##  Reguli de Operare (Regula de Aur)
1. **Niciodata hardcodat**: Orice string sau configurare trebuie sa fie in Registry.
2. **Sequential Migration**: Scrierile pe D1 (DDL) se fac secvential pentru a evita lock-urile SQLite (SQLITE_BUSY).
3. **Audit Obligatoriu**: Toate modificarile de date trebuie sa lase o urma in audit_log.
