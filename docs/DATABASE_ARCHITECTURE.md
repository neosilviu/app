# Arhitectura Bazei de Date (Enterprise Level 10)

Studio App v2 utilizeaza un model **Worker-Master** unde Cloudflare D1 este autoritatea suprema, iar baza de date locala SQLite serveste doar ca cache sau stocare pentru Local Agent.

##  Tehnologii
- **Cloudflare D1**: Production Database (Primary SSOT).
- **SQLite (D1 Compatible)**: Folosit in development local si ca cache in Local Agent.
- **Metaprogramming Layer**: Logica de sincronizare a schemei este in cod (brain.server.ts), nu in fisiere de migrare SQL statice.

##  Schema Sync & Auto-Healing
Sistemul nu foloseste migrari traditionale. Schema este derivata din **Registry**:
1. La boot, Brain citeste definitiile din registry-baseline.ts si entity_definitions (D1).
2. Compara schema actuala a tabelelor D1 cu specificatiile din Registry.
3. Executa automat ALTER TABLE ADD COLUMN daca lipsesc campuri.
4. Garanteaza existenta coloanelor enterprise: workspaceId, archived, createdAt, updatedAt, metadata.

##  Audit & Undo Engine
Fiecare tabel are auditarea activata automat:
- **audit_log**: Inregistreaza cine, ce si cand a modificat.
- **Snapshots**: Salveaza snapshot_before si snapshot_after sub forma de JSON.
- **Polymorphic Attachments**: Tabelul entity_attachments permite legarea fisierelor de orice entitate folosind entityType si entityId.

##  Multi-Tenancy
- **Workspace Isolation**: Fiecare rand din tabelele de business contine un workspaceId.
- **RBAC**: Permisiunile sunt verificate la nivel de resursa in brain.server.ts.

##  Performanta
- **Pragmas**: Sistemul seteaza automat PRAGMA journal_mode = WAL si busy_timeout = 5000 pentru a minimiza lock-urile.
- **Sequential writes**: Operatiunile de mentenanta a schemei sunt executate unul cate unul.
