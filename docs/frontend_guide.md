# Studio App v2 - Frontend Development Guide (L8)

**Last Updated:** 16 ianuarie 2026

##  Paradigma: Registry-Driven UI

In Studio App v2, majoritatea componentelor sunt generate dinamic. Nu mai definim entitati in fisiere JS/TS statice, ci le consumam prin intermediul hook-ului useConfig().

##  Structura Fisierelor

### Core Config & DNA
- registry-baseline.ts: Specificatia 'Factory Reset' a sistemului.
- app/lib/registry.ts: Loader-ul care fuzioneaza baseline-ul cu setarile din D1.

### The Brain (Main Handler)
- frontend/app/brain.server.ts: Toate rutele /api/* sunt gestionate aici. Este singura sursa de adevar pentru logica de business.

### Hooks Esentiale
- useConfig(): Acces la entitati, tema si constante.
- useAuth(): Autentificare via Better-Auth.
- useSocket(): Comunicare real-time cu Local Agent.

##  Adaugarea unei Noi Entitati (No-Code First)

1. Navigeaza la SuperAdmin -> Entity Builder.
2. Adauga entitatea (nume, tabel, iconita).
3. Adauga campurile dorite.
4. Salveaza. Entitatea va aparea automat in meniul de navigare.

##  API & Communication

### REST via api.brain
Folosim un wrapper peste Axios (api.ts) pentru comunicarea cu The Brain:

`	sx
const response = await api.brain.get('workspace/users');
const save = await api.brain.post('entity/contacts', { ...data });
`

### Real-time via Socket.IO
Folosit pentru comunicarea cu Local Agent (WhatsApp, Printing):

`	sx
const { socket } = useSocket();
socket.emit('whatsapp:send', { to: '...', message: '...' });
`

##  Design System: Tailwind CSS v4 + Shadcn

Folosim Tailwind v4 (care nu mai necesita tailwind.config.ts) si Shadcn/UI.

### Glassmorphism
Componenta GlassCard este standardul pentru containere:
`	sx
<GlassCard className='p-6'>
  <h1 className='text-xl font-black italic uppercase'>Titlu Enterprise</h1>
</GlassCard>
`

##  Internationalization (i18n)

Toate string-urile care nu vin din Registry trebuie sa foloseasca t():
`	sx
const { t } = useTranslation(['common', 'settings']);
<span>{t('common:save')}</span>
`

**Nota:** Nu puneti fallback strings in t('key', 'default'). Registry-ul este SSOT.

##  Checklist pentru Dezvoltatori

- Verifică dacă feature-ul poate fi implementat prin Registry înainte de a scrie cod.
- Foloseste brain.server.ts pentru orice logica ce necesita acces la D1.
- Înregistreaza evenimentele in audit_logs (automat prin Proxy-ul din Brain).
- Asigura-te ca UI-ul este responsiv si respecta tema din Registry (THEME).
