# Studio App v2 - AI Guardrails (Enterprise Level 8)

Acest repository folosește o arhitectură **100% Registry-Driven & No-Code Engine**. Orice intervenție AI trebuie să respecte aceste reguli absolute.

## 🚨 REGULA DE AUR: NO-CODE FIRST
- **STOP**: Nu scrie funcții specifice pentru entități (ex: `getContacts`, `updateDeal`).
- **ACTION**: Folosește exclusiv handler-ul generic `Brain.execute(entity, action, payload)` din `frontend/app/brain.server.ts`.
- **REGISTRY**: Dacă lipsește o funcționalitate, adaugă meta-date în `registry-baseline.ts`, NU cod în `.tsx`.

## 🏗️ ARHITECTURĂ ȘI CODING STANDARDS

### 1. Registry & Bază de Date
- **Singular Naming**: Toate entitățile și tabelele sunt la **SINGULAR** (ex: `contact`, nu `contacts`).
- **No Hardcoding**: Interzisă folosirea de string-uri, URL-uri sau prompt-uri direct în cod. Totul se extrage din Registry prin `useConfig()`.
- **Idempotency**: Codul de sincronizare DB (`syncEntityTable`) trebuie să fie safe; nu propune `DROP TABLE` fără backup.

### 2. Frontend & UI (Dumb Shell Pattern)
- **Shells, not Logic**: Componentele de layout (`LayoutCore`) și listele (`DynamicEntityList`) sunt „mute”. Ele doar randează datele din Registry.
- **Icons**: Importurile din `lucide-react` trebuie să fie pe **O SINGURĂ LINIE**.
  - *Corect*: `import { User, Settings, Save } from 'lucide-react';`
- **i18n**: Nu folosi al doilea argument (fallback) în funcția `t()`.
  - *Greșit*: `t('key', 'Default')`
  - *Corect*: `t('key')`

### 3. Error Handling & Security
- **Erori Vizibile**: Interzis `try-catch` care returnează array-uri goale sau ascunde erori de DB/Auth. Erorile trebuie să fie vizibile pentru depanare.
- **Audit**: Orice acțiune de scriere (WRITE/DELETE) trebuie să folosească snapshot-uri `before`/`after` pentru motorul de Undo.

## 🔍 PRIORITĂȚI ÎN REFACTORIZARE
1. **Șterge peste Adaugă**: Dacă un bug poate fi rezolvat prin simplificarea codului sau mutarea logicii în Registry, aceasta este singura cale acceptată.
2. **Elimină .tsx-urile specifice**: Dacă găsești fișiere dedicate unei singure entități (ex: `Contacts.tsx`), propune ștergerea lor și utilizarea rutei dinamice `$entity`.

## 📍 LOCALIZARE RESURSE CORE
- **DNA-ul Sistemului**: `registry-baseline.ts`
- **Creierul (Server)**: `frontend/app/brain.server.ts`
- **Hook-ul de Config**: `frontend/app/hooks/useConfig.tsx`
- **Componenta Listă**: `frontend/app/components/entity/DynamicEntityList.tsx`
- **Componenta Formular**: `frontend/app/components/entity/DynamicEntityDetail.tsx`

- **Excludere Folder OLD si backend**: 🚨 **INTERZISĂ** orice modificare, ștergere sau citire în afara contextului de backup a folderului `OLD`. Acest folder este rezervat exclusiv pentru copii de siguranță manuale și fișiere istorice ale utilizatorului. Nu muta fișiere acolo și nu rula scripturi în interiorul lui.
- ❌ **INTERZIS**: Multi-line imports pentru iconițe.
---
*Acest sistem este optimizat pentru Cloudflare Workers (The Brain) și D1. Gândește modular și scalabil.*

