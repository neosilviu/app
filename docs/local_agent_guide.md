# Studio App v2 - Local Agent Guide

**Last Updated:** 16 ianuarie 2026

##  Rolul Agentului Local

Local Agent este componenta sistemului care ruleaza pe hardware local (PC-ul din Studio) pentru a gestiona operatiunile ce necesita acces direct la sistemul de operare sau periferice.

##  Responsabilitati Generale

- **WhatsApp (WAWebJS)**: Mentinerea sesiunii si trimiterea de mesaje.
- **Printing**: Acces direct la imprimantele locale.
- **Local Proxy**: Proxy pentru comunicarea securizata intre Cloud (The Brain) si Local Hardware.
- **File Processing**: Arhivare, procesare PDF-uri si alte operatiuni intense pe disc.

##  Comunicare: Socket.IO

Local Agent actioneaza ca un server **Socket.IO**. Frontend-ul se conecteaza la el pentru a primi feedback in timp real despre operatiunile hardware.

### Handler-e Socket Esentiale (lib/socket/handlers/)
- whatsapp.js: Logică pentru QR Code, statut conexiune și trimitere mesaje.
- print.js: Gestionarea cozii de printare locale.
- system.js: Informatii despre resursele locale (CPU, Ram, Disk).

##  Instalare si Pornire

`ash
cd backend
npm install
npm run dev (sau npm run start pentru productie)
`

##  Structura Codului

`
backend/
 lib/
    socket/handlers/      # Unde adaugam logica noua pentru Socket
    workers/              # Thread-uri separate pentru task-uri grele
    whatsapp.js           # Core WhatsApp logic
    print-handler.js      # Core Printing logic
 server.js                 # Entry point (Express + Socket.IO)
`

##  Reguli de Dezvoltare

1. **Non-Blocking**: Nu blocati event loop-ul cu operatiuni sincrone. Folositi workers/ pentru procesari intense.
2. **Brain-Sync**: Orice data persistenta creata local trebuie sa fie raportata catre **The Brain** (pi.brain.post).
3. **Audit**: Raportati actiunile catre udit_logs folosind API-ul din Brain.
