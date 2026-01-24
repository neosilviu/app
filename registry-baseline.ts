/**
 * Registry Baseline - Studio App v2
 * Enterprise Level 8 System Specification
 * 
 * TEMPLATE ONLY - Actual values come from D1 SYSTEM_SETTING table.
 * 
 * Structure:
 * - Navigation (NAV): Route definitions and menu hierarchy
 * - Core Constants: App metadata, directories, entity definitions
 * - Entity Configurations: Database schema and UI definitions for each entity
 * - Theme: Colors, typography, layout
 * - AI/LLM: Provider configs, models, prompts
 * - Auth: Security settings, roles, permissions
 * - INTEGRATION: WhatsApp, Gmail, Printing, etc.
 * - System: Feature flags, behavior settings
 */

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Safe environment variable accessor for both Node/Worker and Browser.
 */
const safeEnv = (key: string, fallback: string = ''): string => {
  if (typeof process !== 'undefined' && process.env && process.env[key]) {
    return process.env[key] || fallback;
  }
  return fallback;
};

const isDevCheck = () => {
  if (typeof process !== 'undefined' && process.env.NODE_ENV !== 'production') return true;
  const g = globalThis as any;
  if (typeof g.window !== 'undefined' && g.window.location) {
    const hostname = g.window.location.hostname;
    return hostname === 'localhost' || hostname === '127.0.0.1' || hostname.startsWith('192.168.');
  }
  return false;
};

const isDev = isDevCheck();

const DEFAULT_AGENT_PORT = isDev ? '4001' : '5000';
const DEFAULT_AGENT_URL = isDev ? `http://localhost:${DEFAULT_AGENT_PORT}` : 'https://api.aemdpc.ro';

// ============================================================================
// SYSTEM ROLES & PERMISSIONS (Enterprise Level 8)
// ============================================================================

export const COMMON_COLOR = {
  blue: '#3b82f6',
  indigo: '#4f46e5',
  emerald: '#10b981',
  amber: '#f59e0b',
  rose: '#f43f5e',
  slate: '#64748b',
  violet: '#8b5cf6',
  orange: '#f97316',
  red: '#ef4444',
  gray: '#6b7280'
} as const;

export const COMMON_STATUS = {
  active: { label: { ro: 'Activ', en: 'Active' }, value: 'active', color: COMMON_COLOR.emerald },
  archived: { label: { ro: 'Arhivat', en: 'Archived' }, value: 'archived', color: COMMON_COLOR.amber },
  deleted: { label: { ro: 'Șters', en: 'Deleted' }, value: 'deleted', color: COMMON_COLOR.red },
  planning: { label: { ro: 'În Planificare', en: 'Planning' }, value: 'planning', color: COMMON_COLOR.indigo },
  blocked: { label: { ro: 'Blocat', en: 'Blocked' }, value: 'blocked', color: COMMON_COLOR.red },
  completed: { label: { ro: 'Finalizat', en: 'Completed' }, value: 'completed', color: COMMON_COLOR.slate },
  lead: { label: { ro: 'Lead', en: 'Lead' }, value: 'lead', color: COMMON_COLOR.blue },
  customer: { label: { ro: 'Client', en: 'Customer' }, value: 'customer', color: COMMON_COLOR.emerald },
  partner: { label: { ro: 'Partener', en: 'Partner' }, value: 'partner', color: COMMON_COLOR.violet },
  vendor: { label: { ro: 'Furnizor', en: 'Vendor' }, value: 'vendor', color: COMMON_COLOR.amber },
  todo: { label: { ro: 'De făcut', en: 'To Do' }, value: 'todo', color: COMMON_COLOR.slate },
  in_progress: { label: { ro: 'În lucru', en: 'In Progress' }, value: 'in_progress', color: COMMON_COLOR.blue },
  done: { label: { ro: 'Gata', en: 'Done' }, value: 'done', color: COMMON_COLOR.emerald },
} as const;

export const COMMON_PRIORITY = {
  low: { label: { ro: 'Scăzută', en: 'Low' }, value: 'low', color: COMMON_COLOR.slate },
  medium: { label: { ro: 'Medie', en: 'Medium' }, value: 'medium', color: COMMON_COLOR.amber },
  high: { label: { ro: 'Urgentă', en: 'High' }, value: 'high', color: COMMON_COLOR.red },
} as const;

export const SYSTEM_ROLE = {
  superadmin: {
    label: { ro: 'SuperAdmin', en: 'SuperAdmin' },
    color: COMMON_COLOR.red,
    description: { ro: 'Acces total la sistem și configurări globale', en: 'Full system access and global configurations' },
    permission: ['*'],
    allowedPage: ['*'],
  },
  workspace_owner: {
    label: { ro: 'Proprietar', en: 'Workspace Owner' },
    color: COMMON_COLOR.indigo,
    description: { ro: 'Control total asupra workspace-ului curent', en: 'Full control over the current workspace' },
    permission: [
      'workspace:manage',
      'workspace:members:manage',
      'workspace:setting:edit',
      'workspace:data:export',
      'contact:create',
      'contact:read',
      'contact:update',
      'contact:delete',
      'file:manage',
    ],
    allowedPage: ['dashboard', 'monitoring', 'setting', 'profile', 'entity', 'worker'],
  },
  workspace_admin: {
    label: { ro: 'Administrator', en: 'Workspace Admin' },
    color: COMMON_COLOR.violet,
    description: { ro: 'Gestionare membri și configurări de bază', en: 'Manage members and basic settings' },
    permission: [
      'workspace:members:manage',
      'workspace:setting:view',
      'contact:create',
      'contact:read',
      'contact:update',
      'file:manage',
    ],
    allowedPage: ['dashboard', 'monitoring', 'setting', 'profile', 'entity', 'worker'],
  },
  member: {
    label: { ro: 'Membru', en: 'Member' },
    color: COMMON_COLOR.emerald,
    description: { ro: 'Utilizator activ cu acces la datele de business', en: 'Active user with access to business data' },
    permission: [
      'contact:read',
      'contact:create',
      'contact:update',
      'file:upload',
      'workspace:view',
    ],
    allowedPage: ['dashboard', 'profile', 'entity', 'worker'],
  },
  agent: {
    label: { ro: 'Agent', en: 'Agent' },
    color: COMMON_COLOR.orange,
    description: { ro: 'Acces limitat pentru colaboratori externi sau AI', en: 'Limited access for external collaborators or AI' },
    permission: [
      'contact:read',
      'interaction:create',
      'interaction:read',
    ],
    allowedPage: ['dashboard', 'profile'],
  },
  guest: {
    label: { ro: 'Fără permisiuni', en: 'No Permissions' },
    color: COMMON_COLOR.gray,
    description: { ro: 'Utilizator fără permisiuni de acces în sistem', en: 'User with no access permissions' },
    permission: [],
    allowedPage: [],
  },
} as const;

// ============================================================================
// NAVIGATION STRUCTURE (TEMPLATE)
// ============================================================================

export const NAV = {
  main: [
    { id: 'dashboard', label: { ro: 'Tablou de bord', en: 'Dashboard' }, icon: 'Layout', path: '/', priority: 1, category: 'main_menu' },
  ],
  worker: [],
  SHORTCUT: [
    { id: 'blueprint-architect', label: { ro: 'Arhitect Blueprint', en: 'Blueprint Architect' }, icon: 'Sparkles', path: '/superadmin?tab=ai-architect', priority: 1 },
    { id: 'cloud-status', label: { ro: 'Status Cloudflare', en: 'Cloudflare Status' }, icon: 'Cloud', path: '/monitoring?tab=cloudflare', priority: 2, localAgentOnly: true },
    { id: 'local-agent', label: { ro: 'Agent Local', en: 'Local Agent' }, icon: 'HardDrive', path: '/monitoring?tab=agent', priority: 3, localAgentOnly: true },
  ],
  admin: [
    { id: 'monitoring', label: { ro: 'Monitorizare', en: 'Monitoring' }, icon: 'Activity', path: '/monitoring', priority: 90, category: 'administration', localAgentOnly: true },
    { id: 'audit-history', label: { ro: 'Istoric Modificări', en: 'Change History' }, icon: 'History', path: '/audit-history', priority: 95, category: 'administration' },
    { id: 'setting', label: { ro: 'Setări Generale', en: 'General Settings' }, icon: 'Settings', path: '/settings', priority: 100, category: 'administration' },
    { id: 'superadmin', label: { ro: 'SuperAdmin', en: 'SuperAdmin' }, icon: 'Shield', path: '/superadmin', priority: 110, category: 'administration' }
  ],
  user: [
    { id: 'profile', label: { ro: 'Profil', en: 'Profile' }, icon: 'User', path: '/profile' },
    { id: 'setting', label: { ro: 'Setări Generale', en: 'General Settings' }, icon: 'Settings', path: '/settings' }
  ],
  entity: [], // Dynamically populated
  auth: [],
} as const;

export const SHORTCUT = [
  { action: 'open-search', key: 'k', ctrlKey: true, label: { ro: 'Căutare Globală', en: 'Global Search' } },
  { action: 'open-search-ai', key: 'j', ctrlKey: true, label: { ro: 'Căutare AI / Chat', en: 'AI Search / Chat' } },
  { action: 'open-search-file', key: '.', ctrlKey: true, label: { ro: 'Căutare Fișiere', en: 'File Search' } },
  { action: 'toggle-theme', key: 't', shiftKey: true, altKey: true, label: { ro: 'Schimbă Tema (Light/Dark)', en: 'Toggle Theme (Light/Dark)' } },
  { action: 'nav:contact', key: 'c', ctrlKey: true, label: { ro: 'Navigare Contacte', en: 'Navigate contact' } },
  { action: 'list:contact', key: 'l', ctrlKey: true, label: { ro: 'Listă Contacte (Full)', en: 'contact List (Full)' } },
  { action: 'new:contact', key: 'n', ctrlKey: true, label: { ro: 'Adăugare Contact Nou', en: 'Add New Contact' } },
  { action: 'nav:dashboard', key: 'd', ctrlKey: true, label: { ro: 'Navigare Tablou Bord', en: 'Navigate Dashboard' } },
  { action: 'nav:setting', key: 's', ctrlKey: true, label: { ro: 'Navigare Setări', en: 'Navigate Settings' } },
  { action: 'nav:superadmin', key: 'a', ctrlKey: true, label: { ro: 'Navigare SuperAdmin', en: 'Navigate SuperAdmin' } },
  { action: 'nav:superadmin?tab=ai-architect', key: 'b', ctrlKey: true, shiftKey: true, label: { ro: 'Deschide Arhitect AI', en: 'Open AI Architect' } },
  { action: 'go-help', key: '/', ctrlKey: true, label: { ro: 'Asistent AI / Ajutor', en: 'AI Assistant / Help' } },
  { action: 'go-monitoring', key: 'm', ctrlKey: true, label: { ro: 'Monitorizare Sistem', en: 'System Monitoring' } },
];

// ============================================================================
// CORE CONSTANTS (TEMPLATE)
// ============================================================================

export const CONSTANT = {
  app: {
    name: 'Studio App v2',
    version: '2.0.0',
    description: { ro: 'Un sistem cuprinzător de CRM și management al spațiului de lucru', en: 'A comprehensive CRM and workspace management system' },
    homepage: 'https://studioapp.local',
  },
  directories: {
    baseUrl: safeEnv('BASE_URL', 'https://service.aemdpc.ro'),
    apiUrl: safeEnv('API_URL', 'https://api.aemdpc.ro'),
    uploadDir: './uploads',
    mediaDir: './media',
    backupDir: './backups',
    logsDir: './logs',
    tempDir: './temp',
  },
  coreEntity: [
    'contact',
    'workspace',
    'workspace_user',
    'tag',
    'file',
    'entity_attachment',
    'entity_note',
    'system_setting',
    'entity_definition',
    'audit_log',
    'config_version',
    '_ai_prompt',
    'user',
    'role'
  ],
  globalEntity: [
    'workspace', 
    'workspace_setting',
    'system_setting', 
    'entity_definition', 
    'config_version', 
    'audit_log', 
    '_ai_prompt',
    'user',
    'role'
  ],
  auditExclusion: [
    'audit_log',
    'session',
    'config_version'
  ],
  aiPromptCategory: [
    'system', 
    'global', 
    'workspaceTemplates', 
    'language_instruction'
  ],
  systemFields: [
    'workspaceId', 
    'createdAt', 
    'updatedAt', 
    'deletedAt', 
    'archived', 
    'createdBy', 
    'updatedBy'
  ],
  namespaceMapping: {
    'ai': 'AI_CONFIG',
    'ai_config': 'AI_CONFIG',
    'theme': 'THEME',
    'ui': 'THEME',
    'uiconfig': 'THEME',
    'ui_config': 'THEME',
    'auth': 'AUTH_CONFIG',
    'auth_config': 'AUTH_CONFIG',
    'nav': 'NAV',
    'system': 'SYSTEM_SETTING',
    'system_setting': 'SYSTEM_SETTING',
    'constants': 'CONSTANTS',
    'integration': 'INTEGRATION',
    'i18n': 'I18N_CONFIG',
    'general': 'GENERAL',
    'root': 'GENERAL'
  },
  pagination: {
    defaultLimit: 20,
    maxLimit: 100,
    defaultPage: 1,
  },
  timeouts: {
    socketTimeout: 30000,
    requestTimeout: 15000,
  },
  limits: {
    maxFileSize: 50 * 1024 * 1024,
    maxUploadConcurrency: 5,
    maxBatchSize: 100,
  }
} as const;

export const MARKETPLACE_TEMPLATE = [
  {
    id: 'project-management-enterprise',
    name: { ro: 'Project 360 Enterprise', en: 'Project 360 Enterprise' },
    description: { ro: 'Management de proiect complex cu Proiecte, Etape, Task-uri și resurse.', en: 'Complex project management with Project, Milestones, task, and Resource tracking.' },
    icon: 'Briefcase',
    entity: [
      { 
        id: 'project', 
        label: { ro: 'Proiect', en: 'Project' }, 
        labelPlural: { ro: 'Proiecte', en: 'Projects' },
        fields: {
          name: { type: 'text', label: { ro: 'Nume Proiect', en: 'Project Name' }, required: true, searchable: true },
          status: { 
            type: 'enum', 
            label: { ro: 'Status', en: 'Status' }, 
            options: [
              COMMON_STATUS.planning,
              COMMON_STATUS.active,
              COMMON_STATUS.blocked,
              COMMON_STATUS.completed
            ]
          },
          client_id: { type: 'relation', label: { ro: 'Client', en: 'Client' }, relation: { target: 'contact', field: 'name' } },
          start_date: { type: 'date', label: { ro: 'Data Început', en: 'Start Date' } },
          deadline: { type: 'date', label: { ro: 'Deadline', en: 'Deadline' } },
          budget: { type: 'currency', label: { ro: 'Buget Estimativ', en: 'Estimated Budget' } }
        }
      },
      {
        id: 'task',
        label: { ro: 'Task', en: 'Task' },
        labelPlural: { ro: 'Task-uri', en: 'Tasks' },
        fields: {
          title: { type: 'text', label: { ro: 'Titlu Task', en: 'Task Title' }, required: true },
          project_id: { type: 'relation', label: { ro: 'Proiect', en: 'Project' }, relation: { target: 'project', field: 'name' }, required: true },
          assignee_id: { type: 'relation', label: { ro: 'Responsabil', en: 'Assignee' }, relation: { target: 'contact', field: 'name' } },
          priority: { type: 'enum', label: { ro: 'Prioritate', en: 'Priority' }, options: [COMMON_PRIORITY.low, COMMON_PRIORITY.medium, COMMON_PRIORITY.high] },
          status: { type: 'enum', label: { ro: 'Status', en: 'Status' }, options: [COMMON_STATUS.todo, COMMON_STATUS.in_progress, COMMON_STATUS.done] }
        }
      }
    ]
  },
  {
    id: 'medical-clinic',
    name: { ro: 'Clinică Medicală & Pacienți', en: 'Medical Clinic & Patients' },
    description: { ro: 'Gestiune pacienți, programări, consultații și fișe medicale.', en: 'Patient management, appointments, consultations and medical records.' },
    icon: 'HeartPulse',
    entity: [
      {
        id: 'patient',
        label: { ro: 'Pacient', en: 'Patient' },
        labelPlural: { ro: 'Pacienți', en: 'Patients' },
        fields: {
          full_name: { type: 'text', label: { ro: 'Nume Complet', en: 'Full Name' }, required: true },
          phone: { type: 'phone', label: { ro: 'Telefon', en: 'Phone' } },
          email: { type: 'email', label: { ro: 'Email', en: 'Email' } },
          cnp: { type: 'text', label: { ro: 'CNP', en: 'CNP' }, unique: true }
        }
      },
      {
        id: 'appointment',
        label: { ro: 'Programare', en: 'Appointment' },
        labelPlural: { ro: 'Programări', en: 'Appointments' },
        fields: {
          patient_id: { type: 'relation', label: { ro: 'Pacient', en: 'Patient' }, relation: { target: 'patient', field: 'full_name' }, required: true },
          doctor_id: { type: 'relation', label: { ro: 'Medic', en: 'Doctor' }, relation: { target: 'contact', field: 'name' } },
          date_time: { type: 'datetime', label: { ro: 'Data & Ora', en: 'Date & Time' }, required: true },
          status: { type: 'enum', label: { ro: 'Status', en: 'Status' }, options: ['scheduled', 'confirmed', 'cancelled', 'completed'] }
        }
      }
    ]
  },
  {
    id: 'real-estate-pro',
    name: { ro: 'Imobiliare Pro', en: 'Real Estate Pro' },
    description: { ro: 'Gestiune proprietăți, vizionări, agenți și contracte.', en: 'Property management, viewings, agents and contracts.' },
    icon: 'Home',
    entity: [
      {
        id: 'property',
        label: { ro: 'Proprietate', en: 'Property' },
        labelPlural: { ro: 'Proprietăți', en: 'Properties' },
        fields: {
          title: { type: 'text', label: { ro: 'Titlu', en: 'Title' }, required: true },
          address: { type: 'text', label: { ro: 'Adresă', en: 'Address' } },
          type: { type: 'enum', label: { ro: 'Tip', en: 'Type' }, options: ['apartment', 'house', 'land', 'commercial'] },
          price: { type: 'currency', label: { ro: 'Preț', en: 'Price' } },
          status: { type: 'enum', label: { ro: 'Status', en: 'Status' }, options: ['available', 'reserved', 'sold', 'rented'] }
        }
      },
      {
        id: 'viewing',
        label: { ro: 'Vizionare', en: 'Viewing' },
        labelPlural: { ro: 'Vizionări', en: 'Viewings' },
        fields: {
          property_id: { type: 'relation', label: { ro: 'Proprietate', en: 'Property' }, relation: { target: 'property', field: 'title' } },
          client_id: { type: 'relation', label: { ro: 'Client', en: 'Client' }, relation: { target: 'contact', field: 'name' } },
          date: { type: 'datetime', label: { ro: 'Dată Vizionare', en: 'Viewing Date' } }
        }
      }
    ]
  },
  {
    id: 'inventory-logistics',
    name: { ro: 'Inventar & Logistică', en: 'Inventory & Logistics' },
    description: { ro: 'Control stocuri, depozite, furnizori și mișcări de marfă.', en: 'Stock control, warehouses, vendors and product movements.' },
    icon: 'Package',
    entity: [
      {
        id: 'product',
        label: { ro: 'Produs', en: 'Product' },
        labelPlural: { ro: 'Produse', en: 'Products' },
        fields: {
          sku: { type: 'text', label: { ro: 'Cod SKU', en: 'SKU' }, unique: true },
          name: { type: 'text', label: { ro: 'Nume Produs', en: 'Product Name' }, required: true },
          category: { type: 'text', label: { ro: 'Categorie', en: 'Category' } },
          unit_price: { type: 'currency', label: { ro: 'Preț Unitar', en: 'Unit Price' } }
        }
      },
      {
        id: 'stock_movement',
        label: { ro: 'Mișcare Stoc', en: 'Stock Movement' },
        labelPlural: { ro: 'Mișcări Stoc', en: 'Stock Movements' },
        fields: {
          product_id: { type: 'relation', label: { ro: 'Produs', en: 'Product' }, relation: { target: 'product', field: 'name' } },
          quantity: { type: 'number', label: { ro: 'Cantitate', en: 'Quantity' } },
          type: { type: 'enum', label: { ro: 'Tip', en: 'Type' }, options: ['in', 'out', 'adjustment'] }
        }
      }
    ]
  },
  {
    id: 'hr-management',
    name: { ro: 'Resurse Umane & Salariați', en: 'HR & Employees' },
    description: { ro: 'Dosare angajați, contracte, concedii și evaluări.', en: 'Employee files, contracts, leave management and evaluations.' },
    icon: 'Users2',
    entity: [
      {
        id: 'employee',
        label: { ro: 'Angajat', en: 'Employee' },
        labelPlural: { ro: 'Angajați', en: 'Employees' },
        fields: {
          contact_id: { type: 'relation', label: { ro: 'Profil Contact', en: 'Contact Profile' }, relation: { target: 'contact', field: 'name' } },
          employee_id: { type: 'text', label: { ro: 'Marca', en: 'Employee ID' }, unique: true },
          department: { type: 'text', label: { ro: 'Departament', en: 'Department' } },
          hire_date: { type: 'date', label: { ro: 'Data Angajării', en: 'Hire Date' } }
        }
      },
      {
        id: 'leave_request',
        label: { ro: 'Cerere Concediu', en: 'Leave Request' },
        labelPlural: { ro: 'Cereri Concediu', en: 'Leave Requests' },
        fields: {
          employee_id: { type: 'relation', label: { ro: 'Angajat', en: 'Employee' }, relation: { target: 'employee', field: 'employee_id' } },
          start_date: { type: 'date', label: { ro: 'Inceput', en: 'Start' } },
          end_date: { type: 'date', label: { ro: 'Sfarsit', en: 'End' } },
          type: { type: 'enum', label: { ro: 'Tip', en: 'Type' }, options: ['vacation', 'sick', 'unpaid', 'other'] }
        }
      }
    ]
  },
  {
    id: 'support-hub',
    name: { ro: 'Support & Ticketing', en: 'Support & Ticketing' },
    description: { ro: 'Gestionare cereri suport, tichete, SLA și satisfacție clienți.', en: 'Support requests, tickets, SLA tracking and customer satisfaction.' },
    icon: 'LifeBuoy',
    entity: [
      {
        id: 'ticket',
        label: { ro: 'Tichet', en: 'Ticket' },
        labelPlural: { ro: 'Tichete', en: 'Tickets' },
        fields: {
          subject: { type: 'text', label: { ro: 'Subiect', en: 'Subject' }, required: true },
          client_id: { type: 'relation', label: { ro: 'Client', en: 'Client' }, relation: { target: 'contact', field: 'name' } },
          priority: { type: 'enum', label: { ro: 'Prioritate', en: 'Priority' }, options: ['low', 'medium', 'high', 'critical'] },
          status: { type: 'enum', label: { ro: 'Status', en: 'Status' }, options: ['new', 'open', 'pending', 'resolved', 'closed'] }
        }
      }
    ]
  },
  {
    id: 'fleet-management',
    name: { ro: 'Flotă Auto', en: 'Fleet Management' },
    description: { ro: 'Monitorizare vehicule, asigurări, rca, km și mentenanță.', en: 'Vehicle monitoring, insurance, RCA, mileage and maintenance.' },
    icon: 'Car',
    entity: [
      {
        id: 'vehicle',
        label: { ro: 'Vehicul', en: 'Vehicle' },
        labelPlural: { ro: 'Vehicule', en: 'Vehicles' },
        fields: {
          plate_number: { type: 'text', label: { ro: 'Nr. Înmatriculare', en: 'Plate Number' }, required: true, unique: true },
          model: { type: 'text', label: { ro: 'Marcă/Model', en: 'Make/Model' } },
          year: { type: 'number', label: { ro: 'An Fabricație', en: 'Year' } },
          vin: { type: 'text', label: { ro: 'Serie Șasiu', en: 'VIN' } }
        }
      }
    ]
  },
  {
    id: 'knowledge-base',
    name: { ro: 'Bază de Cunoștințe (KB)', en: 'Knowledge Base (KB)' },
    description: { ro: 'Documentație internă, tutoriale și articole de ajutor.', en: 'Internal documentation, tutorials and help articles.' },
    icon: 'BookOpen',
    entity: [
      {
        id: 'article',
        label: { ro: 'Articol', en: 'Article' },
        labelPlural: { ro: 'Articole', en: 'Articles' },
        fields: {
          title: { type: 'text', label: { ro: 'Titlu', en: 'Title' }, required: true },
          content: { type: 'richtext', label: { ro: 'Conținut', en: 'Content' } },
          category: { type: 'text', label: { ro: 'Categorie', en: 'Category' } }
        }
      }
    ]
  },
  {
    id: 'b2b-sales-crm',
    name: { ro: 'Vânzări B2B Pipeline', en: 'B2B Sales Pipeline' },
    description: { ro: 'Oportunități, oferte comerciale și urmărire vânzări.', en: 'Opportunities, commercial offers and sales tracking.' },
    icon: 'TrendingUp',
    entity: [
      {
        id: 'deal',
        label: { ro: 'Oportunitate', en: 'Deal' },
        labelPlural: { ro: 'Oportunități', en: 'Deals' },
        fields: {
          title: { type: 'text', label: { ro: 'Nume Oportunitate', en: 'Deal Name' }, required: true },
          contact_id: { type: 'relation', label: { ro: 'Contact', en: 'Contact' }, relation: { target: 'contact', field: 'name' } },
          value: { type: 'currency', label: { ro: 'Valoare Estimată', en: 'Estimated Value' } },
          stage: { type: 'enum', label: { ro: 'Etapă', en: 'Stage' }, options: ['prospecting', 'qualification', 'proposal', 'negotiation', 'won', 'lost'] }
        }
      }
    ]
  },
  {
    id: 'legal-case-mgmt',
    name: { ro: 'Juridic & Contracte', en: 'Legal & Contracts' },
    description: { ro: 'Management dosare juridice, termene de judecată și contracte.', en: 'Legal case management, court dates and contracts.' },
    icon: 'Gavel',
    entity: [
      {
        id: 'legal_case',
        label: { ro: 'Dosar Juridic', en: 'Legal Case' },
        labelPlural: { ro: 'Dosare Juridice', en: 'Legal Cases' },
        fields: {
          case_number: { type: 'text', label: { ro: 'Nr. Dosar', en: 'Case Number' }, required: true },
          court: { type: 'text', label: { ro: 'Instanță', en: 'Court' } },
          client_id: { type: 'relation', label: { ro: 'Client', en: 'Client' }, relation: { target: 'contact', field: 'name' } }
        }
      }
    ]
  },
  {
    id: 'restaurant-pos',
    name: { ro: 'Restaurant & POS', en: 'Restaurant & POS' },
    description: { ro: 'Gestiune meniu, mese, comenzi și facturare rapidă.', en: 'Menu management, tables, orders and quick billing.' },
    icon: 'Utensils',
    entity: [
      {
        id: 'menu_item',
        label: { ro: 'Element Meniu', en: 'Menu Item' },
        labelPlural: { ro: 'Elemente Meniu', en: 'Menu Items' },
        fields: {
          name: { type: 'text', label: { ro: 'Nume Preparat', en: 'Dish Name' }, required: true },
          price: { type: 'currency', label: { ro: 'Preț', en: 'Price' } },
          category: { type: 'enum', label: { ro: 'Categorie', en: 'Category' }, options: ['pizza', 'pasta', 'drinks', 'dessert'] }
        }
      }
    ]
  },
  {
    id: 'beauty-salon-pro',
    name: { ro: 'Beauty & Salon Pro', en: 'Beauty & Salon Pro' },
    description: { ro: 'Gestiune programări salon, servicii, stiliști și abonamente.', en: 'Salon appointments, services, stylists and member plans.' },
    icon: 'Sparkles',
    entity: [
      {
        id: 'salon_service',
        label: { ro: 'Serviciu Salon', en: 'Salon Service' },
        labelPlural: { ro: 'Servicii Salon', en: 'Salon Services' },
        fields: {
          name: { type: 'text', label: { ro: 'Nume Serviciu', en: 'Service Name' }, required: true },
          duration: { type: 'number', label: { ro: 'Durată (min)', en: 'Duration (min)' } },
          price: { type: 'currency', label: { ro: 'Preț', en: 'Price' } }
        }
      },
      {
        id: 'salon_appointment',
        label: { ro: 'Programare Salon', en: 'Salon Appointment' },
        labelPlural: { ro: 'Programări Salon', en: 'Salon Appointments' },
        fields: {
          client_id: { type: 'relation', label: { ro: 'Client', en: 'Client' }, relation: { target: 'contact', field: 'name' } },
          service_id: { type: 'relation', label: { ro: 'Serviciu', en: 'Service' }, relation: { target: 'salon_service', field: 'name' } },
          stylist_id: { type: 'relation', label: { ro: 'Stilist', en: 'Stylist' }, relation: { target: 'contact', field: 'name' } },
          date_time: { type: 'datetime', label: { ro: 'Dată & Oră', en: 'Date & Time' } }
        }
      }
    ]
  },
  {
    id: 'fitness-gym-mgmt',
    name: { ro: 'Fitness & Gym Management', en: 'Fitness & Gym Management' },
    description: { ro: 'Management abonamente sală, antrenori personali și acces.', en: 'Gym memberships, personal trainers and entry logs.' },
    icon: 'Dumbbell',
    entity: [
      {
        id: 'gym_membership',
        label: { ro: 'Abonament Fit', en: 'Fitness Membership' },
        labelPlural: { ro: 'Abonamente Fit', en: 'Fitness Memberships' },
        fields: {
          client_id: { type: 'relation', label: { ro: 'Membru', en: 'Member' }, relation: { target: 'contact', field: 'name' } },
          type: { type: 'enum', label: { ro: 'Tip', en: 'Type' }, options: ['monthly', 'quarterly', 'yearly', 'day_pass'] },
          expiry_date: { type: 'date', label: { ro: 'Data Expirării', en: 'Expiry Date' } },
          status: { type: 'enum', label: { ro: 'Status', en: 'Status' }, options: ['active', 'expired', 'frozen'] }
        }
      }
    ]
  },
  {
    id: 'construction-site-log',
    name: { ro: 'Șantier & Construcții', en: 'Construction & Site Log' },
    description: { ro: 'Jurnal de șantier, utilaje, materiale și rapoarte zilnice.', en: 'Site diary, machinery, materials and daily reports.' },
    icon: 'HardHat',
    entity: [
      {
        id: 'site_report',
        label: { ro: 'Raport Zilnic', en: 'Daily Report' },
        labelPlural: { ro: 'Rapoarte Zilnice', en: 'Daily Reports' },
        fields: {
          site_name: { type: 'text', label: { ro: 'Nume Șantier', en: 'Site Name' }, required: true },
          date: { type: 'date', label: { ro: 'Data', en: 'Date' } },
          weather: { type: 'text', label: { ro: 'Meteo', en: 'Weather' } },
          summary: { type: 'textarea', label: { ro: 'Rezumat Activități', en: 'Activity Summary' } }
        }
      }
    ]
  },
  {
    id: 'education-academy-lms',
    name: { ro: 'Educație & Academie LMS', en: 'Education & Academy LMS' },
    description: { ro: 'Gestiune cursuri, studenți, înscrieri și progres.', en: 'Course management, students, enrollments and progress tracking.' },
    icon: 'GraduationCap',
    entity: [
      {
        id: 'course',
        label: { ro: 'Curs', en: 'Course' },
        labelPlural: { ro: 'Cursuri', en: 'Courses' },
        fields: {
          title: { type: 'text', label: { ro: 'Titlu Curs', en: 'Course Title' }, required: true },
          instructor_id: { type: 'relation', label: { ro: 'Instructor', en: 'Instructor' }, relation: { target: 'contact', field: 'name' } },
          price: { type: 'currency', label: { ro: 'Preț', en: 'Price' } }
        }
      },
      {
        id: 'enrollment',
        label: { ro: 'Înscriere', en: 'Enrollment' },
        labelPlural: { ro: 'Înscrieri', en: 'Enrollments' },
        fields: {
          student_id: { type: 'relation', label: { ro: 'Student', en: 'Student' }, relation: { target: 'contact', field: 'name' } },
          course_id: { type: 'relation', label: { ro: 'Curs', en: 'Course' }, relation: { target: 'course', field: 'title' } },
          enrolled_at: { type: 'date', label: { ro: 'Data Înscrierii', en: 'Enrollment Date' } }
        }
      }
    ]
  },
  {
    id: 'event-planner-os',
    name: { ro: 'Event Planner OS', en: 'Event Planner OS' },
    description: { ro: 'Management evenimente, locații, speakeri și bilete.', en: 'Comprehensive event management, venues, speakers and tickets.' },
    icon: 'Calendar',
    entity: [
      {
        id: 'event',
        label: { ro: 'Eveniment', en: 'Event' },
        labelPlural: { ro: 'Evenimente', en: 'Events' },
        fields: {
          name: { type: 'text', label: { ro: 'Nume Eveniment', en: 'Event Name' }, required: true },
          location: { type: 'text', label: { ro: 'Locație', en: 'Location' } },
          start_date: { type: 'datetime', label: { ro: 'Start', en: 'Start' } },
          end_date: { type: 'datetime', label: { ro: 'End', en: 'End' } }
        }
      }
    ]
  },
  {
    id: 'mrp-manufacturing',
    name: { ro: 'MRP & Producție', en: 'MRP & Manufacturing' },
    description: { ro: 'Gestiune producție, Bill of Materials (BOM) și comenzi lucru.', en: 'Production management, Bill of Materials (BOM) and work orders.' },
    icon: 'Factory',
    entity: [
      {
        id: 'work_order',
        label: { ro: 'Comandă Lucru', en: 'Work Order' },
        labelPlural: { ro: 'Comenzi Lucru', en: 'Work Orders' },
        fields: {
          product_name: { type: 'text', label: { ro: 'Produs Final', en: 'Final Product' }, required: true },
          quantity: { type: 'number', label: { ro: 'Cantitate Planificată', en: 'Planned Quantity' } },
          start_date: { type: 'date', label: { ro: 'Data Start', en: 'Start Date' } },
          status: { type: 'enum', label: { ro: 'Status', en: 'Status' }, options: ['draft', 'released', 'in_progress', 'completed'] }
        }
      }
    ]
  },
  {
    id: 'saas-billing-sim',
    name: { ro: 'SaaS Billing & Subscriptions', en: 'SaaS Billing & Subscriptions' },
    description: { ro: 'Management abonamente SaaS, facturare și status plăți.', en: 'SaaS subscription management, invoicing and payment status.' },
    icon: 'CreditCard',
    entity: [
      {
        id: 'subscription',
        label: { ro: 'Abonament SaaS', en: 'SaaS Subscription' },
        labelPlural: { ro: 'Abonamente SaaS', en: 'SaaS Subscriptions' },
        fields: {
          client_id: { type: 'relation', label: { ro: 'Client', en: 'Client' }, relation: { target: 'contact', field: 'name' } },
          plan_name: { type: 'enum', label: { ro: 'Plan', en: 'Plan' }, options: ['free', 'basic', 'pro', 'enterprise'] },
          billing_interval: { type: 'enum', label: { ro: 'Interval', en: 'Interval' }, options: ['monthly', 'yearly'] },
          next_billing: { type: 'date', label: { ro: 'Următoarea Factură', en: 'Next Billing Date' } }
        }
      }
    ]
  },
  {
    id: 'automotive-garage',
    name: { ro: 'Service Auto (Garage)', en: 'Automotive Service (Garage)' },
    description: { ro: 'Gestiune programări service, vehicule și istoric reparații.', en: 'Vehicle service appointments, history and repair logs.' },
    icon: 'Wrench',
    entity: [
      {
        id: 'service_order',
        label: { ro: 'Comandă Service', en: 'Service Order' },
        labelPlural: { ro: 'Comenzi Service', en: 'Service Orders' },
        fields: {
          vehicle_plate: { type: 'text', label: { ro: 'Nr. Înmatriculare', en: 'Plate Number' }, required: true },
          client_name: { type: 'text', label: { ro: 'Nume Client', en: 'Client Name' } },
          total_cost: { type: 'currency', label: { ro: 'Cost Total', en: 'Total Cost' } },
          status: { type: 'enum', label: { ro: 'Status', en: 'Status' }, options: ['pending', 'in_repair', 'ready', 'picked_up'] }
        }
      }
    ]
  },
  {
    id: 'accounting-cash-book',
    name: { ro: 'Contabilitate & Registru Casă', en: 'Accounting & Cash Book' },
    description: { ro: 'Gestiune bugete, venituri, cheltuieli și investiții cu documente atașate.', en: 'Budget management, income, expenses, and investments with attachments.' },
    icon: 'Wallet',
    entity: [
      {
        id: 'budget_item',
        label: { ro: 'Tranzacție Financiara', en: 'Financial Transaction' },
        labelPlural: { ro: 'Registru Casă/Buget', en: 'Cash Book / Budget' },
        fields: {
          date: { type: 'date', label: { ro: 'Dată', en: 'Date' }, required: true },
          type: { type: 'enum', label: { ro: 'Tip', en: 'Type' }, options: ['Venit', 'Cheltuiala', 'Investitie'] },
          description: { type: 'text', label: { ro: 'Descriere', en: 'Description' } },
          amount: { type: 'currency', label: { ro: 'Sumă', en: 'Amount' }, required: true },
          currency: { type: 'enum', label: { ro: 'Valută', en: 'Currency' }, options: ['RON', 'EUR', 'USD'], defaultValue: 'RON' },
          location: { type: 'text', label: { ro: 'Locație/Gestiune', en: 'Location/Stock' } },
          account: { type: 'text', label: { ro: 'Cont/Sursă', en: 'Account/Source' } },
          investment_type: { 
            type: 'text', 
            label: { ro: 'Tip Investiție', en: 'Investment Type' },
            ui: { showIf: { field: 'type', operator: 'eq', value: 'Investitie' } }
          },
          maturity_date: { 
            type: 'date', 
            label: { ro: 'Data Maturitate', en: 'Maturity Date' },
            ui: { showIf: { field: 'type', operator: 'eq', value: 'Investitie' } }
          },
          status: { type: 'text', label: { ro: 'Status', en: 'Status' } },
          photo_url: { type: 'image', label: { ro: 'Dovadă/Factură', en: 'Proof/Invoice' } }
        }
      }
    ]
  },
  {
    id: 'product-catalog-service',
    name: { ro: 'Catalog Produse & Inventar', en: 'Product Catalog & Inventory' },
    description: { ro: 'Gestiune mărfuri fizice și produse digitale (Cărți/GDrive).', en: 'Physical goods and digital products management.' },
    icon: 'Box',
    entity: [
      {
        id: 'service_product',
        label: { ro: 'Produs Service', en: 'Service Product' },
        labelPlural: { ro: 'Produse Service', en: 'Service Products' },
        fields: {
          name: { type: 'text', label: { ro: 'Nume Produs', en: 'Product Name' }, required: true },
          product_type: { type: 'enum', label: { ro: 'Tip Produs', en: 'Product Type' }, options: ['Marfa', 'Carte'] },
          serial_number: { 
            type: 'text', 
            label: { ro: 'Serie/IMEI', en: 'Serial/IMEI' },
            ui: { showIf: { field: 'product_type', operator: 'eq', value: 'Marfa' } }
          },
          warranty_months: { 
            type: 'number', 
            label: { ro: 'Garanție Implicită', en: 'Default Warranty' },
            ui: { showIf: { field: 'product_type', operator: 'eq', value: 'Marfa' } }
          },
          photo_url: { 
            type: 'image', 
            label: { ro: 'Poză Produs', en: 'Product Photo' },
            ui: { showIf: { field: 'product_type', operator: 'eq', value: 'Marfa' } }
          },
          gdrive_link: { 
            type: 'url', 
            label: { ro: 'Resurse GDrive', en: 'GDrive Resources' },
            ui: { showIf: { field: 'product_type', operator: 'eq', value: 'Carte' } }
          },
          price: { 
            type: 'currency', 
            label: { ro: 'Preț Vânzare', en: 'Sales Price' },
            ui: { showIf: { field: 'product_type', operator: 'eq', value: 'Carte' } }
          },
          description: { type: 'textarea', label: { ro: 'Descriere', en: 'Description' } }
        }
      }
    ]
  },
  {
    id: 'service-repair-ticketing',
    name: { ro: 'Service Desk & Tichete', en: 'Service Desk & Ticketing' },
    description: { ro: 'Sistem de tichete reparații cu istoric media și note interne.', en: 'Repair ticketing system with media history and internal notes.' },
    icon: 'Tool',
    entity: [
      {
        id: 'repair_ticket',
        label: { ro: 'Tichet Reparație', en: 'Repair Ticket' },
        labelPlural: { ro: 'Tichete Reparații', en: 'Repair Tickets' },
        fields: {
          contact_id: { type: 'relation', label: { ro: 'Client', en: 'Client' }, relation: { target: 'contact', field: 'name' }, required: true },
          object: { type: 'text', label: { ro: 'Obiect Reparație', en: 'Repair Object' }, required: true },
          product_id: { type: 'relation', label: { ro: 'Produs Asociat', en: 'Associated Product' }, relation: { target: 'service_product', field: 'name' } },
          description: { type: 'textarea', label: { ro: 'Descriere Defect', en: 'Issue Description' } },
          stage: { type: 'enum', label: { ro: 'Etapă', en: 'Stage' }, options: ['New', 'In work', 'Finish', 'Canceled'] },
          internal_notes: { type: 'textarea', label: { ro: 'Note Interne', en: 'Internal Notes' } },
          solution: { type: 'enum', label: { ro: 'Soluție', en: 'Solution' }, options: ['Reparat', 'Doar diagnostic'] },
          price: { type: 'currency', label: { ro: 'Preț Reparație', en: 'Repair Price' } },
          repair_gallery: { type: 'gallery', label: { ro: 'Media Reparație', en: 'Repair Media' } }
        }
      }
    ]
  },
  {
    id: 'order-commerce-v2',
    name: { ro: 'Gestiune Comenzi Produse', en: 'Product Order Management' },
    description: { ro: 'Urmărire comenzi clienți, avansuri și status livrare.', en: 'Client order tracking, advances, and delivery status.' },
    icon: 'ShoppingCart',
    entity: [
      {
        id: 'product_order',
        label: { ro: 'Comandă Produs', en: 'Product Order' },
        labelPlural: { ro: 'Comenzi Produse', en: 'Product Orders' },
        fields: {
          contact_id: { type: 'relation', label: { ro: 'Client', en: 'Client' }, relation: { target: 'contact', field: 'name' }, required: true },
          product_id: { type: 'relation', label: { ro: 'Produs', en: 'Product' }, relation: { target: 'service_product', field: 'name' } },
          total: { type: 'currency', label: { ro: 'Total', en: 'Total' } },
          avans: { type: 'currency', label: { ro: 'Avans', en: 'Advance' } },
          stage: { type: 'enum', label: { ro: 'Etapă', en: 'Stage' }, options: ['New', 'In work', 'Finish', 'Canceled'] },
          ticket_id: { type: 'relation', label: { ro: 'Ticket Asociat', en: 'Linked Ticket' }, relation: { target: 'repair_ticket', field: 'object' } },
          notes: { type: 'textarea', label: { ro: 'Note', en: 'Notes' } }
        }
      }
    ]
  },
  {
    id: 'warranty-tracking-pro',
    name: { ro: 'Garanții & Post-Vânzare', en: 'Warranty & After-Sales' },
    description: { ro: 'Monitorizare perioade garanție și reclamații clienți.', en: 'Warranty period monitoring and customer claims.' },
    icon: 'Award',
    entity: [
      {
        id: 'warranty_record',
        label: { ro: 'Garanție', en: 'Warranty' },
        labelPlural: { ro: 'Garanții', en: 'Warranties' },
        fields: {
          contact_id: { type: 'relation', label: { ro: 'Client', en: 'Client' }, relation: { target: 'contact', field: 'name' }, required: true },
          product_id: { type: 'relation', label: { ro: 'Produs', en: 'Product' }, relation: { target: 'service_product', field: 'name' }, required: true },
          purchase_date: { type: 'date', label: { ro: 'Data Achiziției', en: 'Purchase Date' } },
          expiry_date: { type: 'date', label: { ro: 'Data Expirării', en: 'Expiry Date' } },
          status: { type: 'enum', label: { ro: 'Status', en: 'Status' }, options: ['Active', 'Expired', 'Claimed'] }
        }
      }
    ]
  },
  {
    id: 'printer-refill-v2',
    name: { ro: 'Reîncărcări Consumabile', en: 'Printer & Refill Service' },
    description: { ro: 'Sistem rapid pentru gestionarea reîncărcărilor de cartușe.', en: 'Fast entry system for cartridge refill management.' },
    icon: 'Printer',
    entity: [
      {
        id: 'refill_item',
        label: { ro: 'Reîncărcare', en: 'Refill' },
        labelPlural: { ro: 'Reîncărcări', en: 'Refills' },
        fields: {
          contact_id: { type: 'relation', label: { ro: 'Client', en: 'Client' }, relation: { target: 'contact', field: 'name' }, required: true },
          quantity: { type: 'number', label: { ro: 'Cantitate', en: 'Quantity' }, defaultValue: 1 },
          paid_status: { type: 'enum', label: { ro: 'Status Plată', en: 'Payment Status' }, options: ['Yes', 'No', 'Pending'] },
          refill_type: { type: 'enum', label: { ro: 'Tip', en: 'Type' }, options: ['Toner', 'Jet'] },
          photo_url: { type: 'image', label: { ro: 'Dovadă Foto', en: 'Photo Proof' } },
          notes: { type: 'textarea', label: { ro: 'Note', en: 'Notes' } }
        }
      }
    ]
  }
];


// ===================================
// REGISTRY TYPES (Enterprise Level 8)
// ===================================

export interface I18nString {
  ro: string;
  en: string;
}

export type Localized<T = string> = T | I18nString;

export type FieldType = 
  | 'uuid' | 'text' | 'textarea' | 'richtext' | 'string'
  | 'number' | 'integer' | 'currency' | 'percent' | 'range' | 'progress'
  | 'date' | 'datetime' | 'time'
  | 'boolean' | 'enum' | 'select' | 'multi-select' | 'tag'
  | 'relation' | 'relation-many'
  | 'file' | 'image' | 'gallery' | 'video' | 'audio'
  | 'email' | 'phone' | 'url' | 'password'
  | 'color' | 'icon' | 'rating' | 'signature'
  | 'location' | 'map'
  | 'ai' | 'ai-text' | 'ai-summarize'
  | 'formula' | 'computed'
  | 'json' | 'array';

export interface FieldUIAction {
  label: Localized;
  type: 'email-trigger' | 'whatsapp-trigger' | 'phone-call' | 'url-link' | 'script-trigger';
  icon?: string;
  variant?: 'primary' | 'secondary' | 'success' | 'destructive' | 'ghost' | 'glass';
  templateId?: string;
  template?: string;
  phoneNumberField?: string;
  emailField?: string;
  urlField?: string;
  script?: string;
}

export interface FieldUICondition {
  field: string;
  operator: 'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte' | 'in' | 'not_in' | 'contains' | 'empty' | 'not_empty';
  value?: any;
}

export interface FieldUIDefinition {
  width?: number; // 1-12 (grid system)
  placeholder?: Localized;
  helpText?: Localized;
  hidden?: boolean;
  readOnly?: boolean;
  showIf?: FieldUICondition;
  icon?: string; // Icon to show next to the field or in the input
  variant?: 'default' | 'badge' | 'ghost' | 'glass' | 'destructive';
  actions?: FieldUIAction[];
  className?: string;
  group?: Localized; // Layout group name
}

export interface FieldValidation {
  required?: boolean;
  pattern?: string;
  min?: number;
  max?: number;
  message?: Localized;
  custom?: string; // Custom validation logic or script
}

export interface FieldDefinition {
  type: FieldType;
  label?: Localized;
  description?: Localized;
  format?: 'email' | 'phone' | 'url' | 'json' | 'markdown' | 'html' | 'regex';
  required?: boolean;
  unique?: boolean;
  primaryKey?: boolean;
  multiple?: boolean; // For file/image/relation-many/multi-select
  generated?: 'uuid' | 'now';
  storage?: 'local-inbox' | 'r2' | 'gdrive';
  searchable?: boolean;
  sortable?: boolean;
  hidden?: boolean;
  readonly?: boolean;
  isPrivate?: boolean; // Sensitive data
  encrypted?: boolean; // Encrypt value in DB
  maxLength?: number;
  defaultValue?: any;
  options?: string[] | { label: Localized; value: any; color?: string }[];
  relation?: {
    target: string;
    field: string; // The display field in the target entity
  };
  validation?: FieldValidation;
  visibility?: {
    type: 'always' | 'hidden' | 'conditional';
    dependsOn?: string;
    operator?: '==' | '!=' | 'in' | 'set';
    value?: any;
  };
  ai?: {
    prompt?: string;
    model?: string;
    personality?: string;
    temperature?: number;
    outputFormat?: 'text' | 'json' | 'markdown';
  };
  formula?: {
    expression: string;
    dependencies?: string[];
  };
  ui?: FieldUIDefinition;
}

export interface EntityMenuConfig {
  showInMainMenu: boolean;
  showInUserMenu?: boolean;
  showInActionMenu?: boolean; // The central "+" button
  category?: string;
  priority?: number;
  badge?: string; // Logic or value: "count:status=new"
  label?: Localized;
  icon?: string;
  path?: string; // Optional override
}

export interface EntityPermission {
  role: Record<string, string[] | { read: boolean; write: boolean; delete: boolean }>; 
  ownerOnly?: boolean;
}

export interface EntityFeatures {
  softDelete?: boolean;
  auditable?: boolean;
  import?: boolean;
  export?: boolean;
  bulkActions?: boolean;
  attachments?: boolean;
  comments?: boolean;
  creatable?: boolean; 
  editable?: boolean;  
  deletable?: boolean; 
  timestamps?: boolean;
  authorTracking?: boolean; // createdBy, updatedBy tracking
  authorizable?: boolean; // Rule-based ownership access
  versioning?: boolean; // Keep history of versions
  publicAccess?: boolean; // Allow non-auth read access
  workflow?: {
    statusField: string;
    states: string[];
    transitions: Record<string, string[]>;
  };
}

export interface EntityDashboardCard {
  type: 'count' | 'sum' | 'avg' | 'chart';
  label: Localized;
  query?: string;
  color?: string;
}

export interface EntityDashboardConfig {
  enabled: boolean;
  showInDashboard?: boolean;
  priority?: number;
  category?: string;
  widgetType?: 'stats' | 'list' | 'chart' | 'table';
  cards?: EntityDashboardCard[];
}

export interface EntityLayoutSection {
  title?: Localized;
  description?: Localized;
  columns?: number; 
  variant?: 'default' | 'glass' | 'card' | 'ghost';
  fields: string[]; 
  showIf?: FieldUICondition;
}

export interface EntityLayoutTab {
  id: string;
  label: Localized;
  sections: EntityLayoutSection[];
  icon?: string;
  showIf?: FieldUICondition;
}

export interface EntityLayout {
  sections?: EntityLayoutSection[]; // Default sections if no tabs
  tabs?: EntityLayoutTab[];
}

export interface EntityDefinition {
  id?: string;
  label: I18nString;
  labelPlural: I18nString;
  icon: string;
  colorTheme?: string;
  description?: Localized;
  tableName: string;
  displayField: string;
  sortField?: string;
  searchFields?: string[];
  isSystem?: boolean;
  fields: Record<string, FieldDefinition>;
  menuConfig?: EntityMenuConfig;
  permission?: EntityPermission;
  features?: EntityFeatures;
  dashboardConfig?: EntityDashboardConfig;
  layout?: EntityLayout;
  indexes?: (string | string[] | { fields: string[]; unique?: boolean })[];
}

// ============================================================================
// ENTITY CONFIGURATIONS
// ============================================================================

export const ENTITY_CONFIG = {
  contact: {
    label: { ro: 'Contact', en: 'Contact' },
    labelPlural: { ro: 'Contacte', en: 'Contacts' },
    icon: 'Users',
    description: { ro: 'Informații de contact pentru clienți, lead-uri sau membri ai echipei', en: 'Customer, lead, or team member contact information' },
    tableName: 'contact',
    displayField: 'name',
    sortField: 'createdAt',
    searchFields: ['name', 'email', 'phone', 'company', 'role'],
    isSystem: true,
    dashboardConfig: {
      enabled: true,
      showInDashboard: true,
      priority: 2,
      category: 'CORE'
    },
    features: {
      softDelete: true,
      auditable: true,
      bulkActions: true,
      import: true,
      export: true,
      attachments: true,
      comments: true,
      deletable: true,
    },
    fields: {
      id: { type: 'uuid', primaryKey: true, generated: 'uuid', hidden: true },
      workspaceId: { 
        type: 'relation', 
        relation: { target: 'workspace', field: 'name' }, 
        hidden: true 
      },
      name: { 
        type: 'string', 
        required: true, 
        maxLength: 255, 
        searchable: true,
        ui: { width: 6, icon: 'User' } 
      },
      email: { 
        type: 'string', 
        format: 'email', 
        unique: true, 
        searchable: true,
        ui: { width: 6, icon: 'Mail' } 
      },
      phone: { 
        type: 'string', 
        searchable: true,
        ui: { width: 4, icon: 'Phone' } 
      },
      company: { 
        type: 'string', 
        searchable: true,
        ui: { width: 4, icon: 'Building' } 
      },
      position: { 
        type: 'string',
        ui: { width: 4 }
      },
      status: { 
        type: 'enum', 
        options: [
          COMMON_STATUS.lead,
          COMMON_STATUS.customer,
          COMMON_STATUS.partner,
          COMMON_STATUS.vendor
        ],
        defaultValue: 'lead',
        ui: { width: 6 }
      },
      role: { 
        type: 'enum', 
        options: [
          { value: 'superadmin', label: SYSTEM_ROLE.superadmin.label, color: SYSTEM_ROLE.superadmin.color },
          { value: 'workspace_owner', label: SYSTEM_ROLE.workspace_owner.label, color: SYSTEM_ROLE.workspace_owner.color },
          { value: 'workspace_admin', label: SYSTEM_ROLE.workspace_admin.label, color: SYSTEM_ROLE.workspace_admin.color },
          { value: 'member', label: SYSTEM_ROLE.member.label, color: SYSTEM_ROLE.member.color },
          { value: 'agent', label: SYSTEM_ROLE.agent.label, color: SYSTEM_ROLE.agent.color },
          { value: 'guest', label: SYSTEM_ROLE.guest.label, color: COMMON_COLOR.gray }
        ],
        defaultValue: 'guest',
        ui: { width: 6 }
      },
      tag: { 
        type: 'relation-many', 
        relation: { target: 'tag', field: 'name' },
        ui: { width: 12, icon: 'Tag' },
        description: { ro: 'Categorii și etichete asociate contactului', en: 'Categories and tag associated with the contact' }
      },
      permission: {
        type: 'json',
        hidden: true,
        description: { ro: 'Permisiuni specifice utilizatorului', en: 'User specific permissions' }
      },
      last_interaction: { type: 'datetime', ui: { width: 6 }, hidden: true },
      createdAt: { type: 'datetime', generated: 'now', hidden: true },
      updatedAt: { type: 'datetime', generated: 'now', hidden: true },
      deletedAt: { type: 'datetime', hidden: true },
    },
    menuConfig: {
      showInMainMenu: true,
      category: 'main_menu',
      icon: 'Users',
      label: { ro: 'Contacte', en: 'Contacts' },
      priority: 5
    },
    layout: {
      sections: [
        {
          title: 'General Information',
          description: { ro: 'Detalii principale de contact', en: 'Primary contact details' },
          columns: 2,
          fields: ['name', 'email', 'phone', 'company', 'position']
        },
        {
          title: 'Classification',
          fields: ['status', 'role', 'tag']
        }
      ]
    },
    indexes: ['workspaceId', 'email', 'createdAt']
  },
  workspace: {
    label: { ro: 'Spațiu de Lucru', en: 'Workspace' },
    labelPlural: { ro: 'Spații de Lucru', en: 'Workspaces' },
    icon: 'Briefcase',
    description: { ro: 'Spațiu de lucru al echipei sau unitate organizațională', en: 'Team workspace or organization unit' },
    tableName: 'workspace',
    displayField: 'name',
    sortField: 'createdAt',
    searchFields: ['name', 'description'],
    isSystem: true,
    dashboardConfig: {
      enabled: true,
      showInDashboard: false,
      priority: 3,
      category: 'CORE'
    },
    features: {
      softDelete: true,
      auditable: true,
      deletable: true,
    },
    fields: {
      id: { type: 'uuid', primaryKey: true, generated: 'uuid', hidden: true },
      name: { 
        type: 'string', 
        required: true, 
        maxLength: 255, 
        searchable: true,
        ui: { width: 12, icon: 'Layout' }
      },
      description: { type: 'text', searchable: true, ui: { width: 12 } },
      slug: { type: 'string', unique: true, ui: { width: 6 } },
      ownerId: { 
        type: 'relation', 
        relation: { target: 'contact', field: 'name' },
        ui: { width: 6, icon: 'User' },
        description: { ro: 'Utilizatorul care deține acest workspace', en: 'The user who owns this workspace' }
      },
      avatarUrl: { 
        type: 'image', 
        ui: { width: 12, icon: 'Image' }, 
        description: { ro: 'Logo-ul sau imaginea de profil a workspace-ului', en: 'The logo or profile image of the workspace' } 
      },
      setting: { 
        type: 'json', 
        ui: { width: 12, icon: 'Settings' }, 
        description: { ro: 'Configurări avansate specifice workspace-ului', en: 'Advanced workspace-specific settings' } 
      },
      status: { 
        type: 'enum', 
        options: [
          COMMON_STATUS.archived,
          COMMON_STATUS.deleted
        ],
        defaultValue: 'active',
        ui: { width: 6 }
      },
      createdAt: { type: 'datetime', generated: 'now', hidden: true },
      updatedAt: { type: 'datetime', generated: 'now', hidden: true },
    },
    indexes: ['ownerId', 'slug', 'status'],
    menuConfig: {
      showInMainMenu: true,
      category: 'administration',
      icon: 'Briefcase',
      label: { ro: 'Spații de Lucru', en: 'Workspaces' },
      priority: 20
    }
  },
  tag: {
    label: { ro: 'Etichetă', en: 'Tag' },
    labelPlural: { ro: 'Etichete', en: 'Tags' },
    icon: 'Tag',
    description: { ro: 'Etichete de clasificare pentru contacte și elemente', en: 'Categorization tag for contact and items' },
    tableName: 'tag',
    displayField: 'name',
    isSystem: true,
    sortField: 'createdAt',
    searchFields: ['name', 'description'],
    dashboardConfig: {
      enabled: true,
      showInDashboard: false,
      priority: 4,
      category: 'CORE'
    },
    fields: {
      id: { type: 'uuid', primaryKey: true, generated: 'uuid' },
      workspaceId: { 
        type: 'relation', 
        relation: { target: 'workspace', field: 'name' }, 
        hidden: true 
      },
      name: { type: 'string', required: true, maxLength: 255, searchable: true },
      description: { type: 'string' },
      color: { type: 'string', format: 'color', default: '#3b82f6' },
      icon: { type: 'string' },
      entityType: { 
        type: 'enum', 
        options: [
          { label: { ro: 'Contact', en: 'Contact' }, value: 'contact' },
          { label: { ro: 'Item', en: 'Item' }, value: 'item' },
          { label: { ro: 'Toate', en: 'All' }, value: 'all' }
        ], 
        defaultValue: 'all' 
      },
      createdAt: { type: 'datetime', generated: 'now' },
      updatedAt: { type: 'datetime', generated: 'now' },
    },
    indexes: ['workspaceId', 'entityType'],
    menuConfig: {
      showInMainMenu: true,
      category: 'data_systems',
      icon: 'Tag',
      priority: 10
    },
    features: {
      softDelete: true,
      auditable: true,
    }
  },
  file: {
    label: { ro: 'Fișier', en: 'File' },
    labelPlural: { ro: 'Fișiere', en: 'Files' },
    icon: 'FileText',
    description: { ro: 'Documente încărcate și fișiere media', en: 'Uploaded documents and media file' },
    tableName: 'file',
    displayField: 'filename',
    sortField: 'createdAt',
    searchFields: ['filename', 'description'],
    isSystem: true,
    fields: {
      id: { type: 'uuid', primaryKey: true, generated: 'uuid' },
      workspaceId: { 
        type: 'relation', 
        relation: { target: 'workspace', field: 'name' }, 
        hidden: true 
      },
      filename: { type: 'string', required: true, searchable: true },
      originalName: { type: 'string' },
      mimeType: { type: 'string' },
      size: { type: 'number' },
      category: { type: 'enum', options: ['document', 'image', 'media', 'archive', 'other'] },
      url: { type: 'string', format: 'url' },
      storagePath: { type: 'string' },
      uploadedBy: { 
        type: 'relation', 
        relation: { target: 'contact', field: 'name' },
        hidden: true 
      },
      description: { type: 'string' },
      tag: { 
        type: 'relation-many', 
        relation: { target: 'tag', field: 'name' },
        ui: { width: 12, icon: 'Tag' } 
      },
      metadata: { type: 'json' },
      createdAt: { type: 'datetime', generated: 'now' },
      updatedAt: { type: 'datetime', generated: 'now' },
      deletedAt: { type: 'datetime' },
    },
    indexes: ['workspaceId', 'uploadedBy', 'category', 'createdAt'],
    menuConfig: {
      showInMainMenu: true,
      category: 'main_menu',
      icon: 'FileText',
      priority: 5
    },
    features: {
      softDelete: true,
      auditable: true,
    }
  },
  interaction: {
    label: { ro: 'Interacțiune', en: 'Interaction' },
    labelPlural: { ro: 'Interacțiuni', en: 'Interactions' },
    icon: 'MessageSquare',
    description: { ro: 'Mesaje de pe WhatsApp, Gmail sau alte canale', en: 'Messages from WhatsApp, Gmail or other channels' },
    tableName: 'interaction',
    displayField: 'subject',
    sortField: 'createdAt',
    fields: {
      id: { type: 'uuid', primaryKey: true, generated: 'uuid' },
      workspaceId: { type: 'relation', relation: { target: 'workspace', field: 'name' }, hidden: true },
      contactId: { type: 'relation', relation: { target: 'contact', field: 'name' } },
      channel: { type: 'enum', options: ['whatsapp', 'email', 'sms', 'system'] },
      type: { type: 'enum', options: ['inbound', 'outbound'] },
      subject: { type: 'string', searchable: true },
      body: { type: 'text', searchable: true },
      status: { type: 'enum', options: ['unread', 'read', 'archived', 'trash'], defaultValue: 'unread' },
      metadata: { type: 'json' },
      createdAt: { type: 'datetime', generated: 'now' },
    },
    menuConfig: {
      showInMainMenu: true,
      category: 'comms',
      icon: 'MessageSquare',
      priority: 10
    }
  },
  task: {
    label: { ro: 'Task', en: 'Task' },
    labelPlural: { ro: 'Task-uri', en: 'Tasks' },
    icon: 'CheckSquare',
    description: { ro: 'Sarcini și activități de rezolvat', en: 'Tasks and activities to resolve' },
    tableName: 'task',
    displayField: 'title',
    fields: {
      id: { type: 'uuid', primaryKey: true, generated: 'uuid' },
      workspaceId: { type: 'relation', relation: { target: 'workspace', field: 'name' }, hidden: true },
      contactId: { type: 'relation', relation: { target: 'contact', field: 'name' } },
      title: { type: 'string', required: true, searchable: true },
      description: { type: 'text' },
      status: { type: 'enum', options: [COMMON_STATUS.todo, COMMON_STATUS.in_progress, COMMON_STATUS.done], defaultValue: 'todo' },
      priority: { type: 'enum', options: [COMMON_PRIORITY.low, COMMON_PRIORITY.medium, COMMON_PRIORITY.high], defaultValue: 'medium' },
      dueDate: { type: 'datetime' },
      assignedTo: { type: 'relation', relation: { target: 'contact', field: 'name' } },
      createdAt: { type: 'datetime', generated: 'now' },
    },
    menuConfig: {
      showInMainMenu: true,
      category: 'main_menu',
      icon: 'CheckSquare',
      priority: 20
    }
  },
  deal: {
    label: { ro: 'Oportunitate', en: 'Deal' },
    labelPlural: { ro: 'Oportunități', en: 'Deals' },
    icon: 'DollarSign',
    description: { ro: 'Potențiale vânzări sau proiecte comerciale', en: 'Potential sales or commercial projects' },
    tableName: 'deal',
    displayField: 'title',
    fields: {
      id: { type: 'uuid', primaryKey: true, generated: 'uuid' },
      workspaceId: { type: 'relation', relation: { target: 'workspace', field: 'name' }, hidden: true },
      contactId: { type: 'relation', relation: { target: 'contact', field: 'name' } },
      title: { type: 'string', required: true, searchable: true },
      value: { type: 'currency' },
      currency: { type: 'enum', options: ['RON', 'EUR', 'USD'], defaultValue: 'RON' },
      status: { type: 'enum', options: ['open', 'won', 'lost', 'abandoned'], defaultValue: 'open' },
      expectedCloseDate: { type: 'date' },
      createdAt: { type: 'datetime', generated: 'now' },
    },
    menuConfig: {
      showInMainMenu: true,
      category: 'sales',
      icon: 'DollarSign',
      priority: 30
    }
  },
  notification: {
    label: { ro: 'Notificare', en: 'Notification' },
    labelPlural: { ro: 'Notificări', en: 'Notifications' },
    icon: 'Bell',
    tableName: 'notification',
    displayField: 'title',
    fields: {
      id: { type: 'uuid', primaryKey: true },
      workspaceId: { type: 'relation', relation: { target: 'workspace', field: 'name' }, hidden: true },
      userId: { type: 'string' },
      title: { type: 'string', required: true },
      body: { type: 'text' },
      type: { type: 'enum', options: ['info', 'warning', 'error', 'success'], defaultValue: 'info' },
      status: { type: 'enum', options: ['unread', 'read'], defaultValue: 'unread' },
      createdAt: { type: 'datetime', generated: 'now' },
    },
    menuConfig: {
      showInMainMenu: false
    }
  },
  audit_log: {
    label: { ro: 'Jurnal Audit', en: 'Audit Log' },
    labelPlural: { ro: 'Jurnale Audit', en: 'Audit Logs' },
    icon: 'ShieldCheck',
    tableName: 'audit_log',
    displayField: 'action',
    isSystem: true,
    features: {
      creatable: false,
      editable: false,
      deletable: false,
    },
    fields: {
      id: { type: 'uuid', primaryKey: true, hidden: true },
      workspaceId: { 
        type: 'relation', 
        relation: { target: 'workspace', field: 'name' }, 
        hidden: true 
      },
      userId: { 
        type: 'relation', 
        relation: { target: 'contact', field: 'name' },
        hidden: true 
      },
      user: { type: 'string', ui: { width: 4, icon: 'User' } },
      action: { type: 'string', ui: { width: 4, icon: 'Zap' } },
      entityType: { type: 'string', ui: { width: 4 } },
      entityId: { type: 'string', ui: { width: 4 } },
      display_value: { type: 'string', label: { ro: 'Valoare', en: 'Value' }, ui: { width: 4 } },
      details: { type: 'text', ui: { width: 12 } },
      snapshot_before: { type: 'json', hidden: true },
      snapshot_after: { type: 'json', hidden: true },
      createdAt: { type: 'datetime', ui: { width: 4 }, generated: 'now' },
    },
    menuConfig: {
      showInMainMenu: true,
      category: 'administration',
      icon: 'ShieldCheck',
      priority: 90
    }
  },
  entity_note: {
    label: { ro: 'Notă', en: 'Note' },
    labelPlural: { ro: 'Note și Comentarii', en: 'Notes & Comments' },
    icon: 'StickyNote',
    tableName: 'entity_note',
    displayField: 'content',
    isSystem: true,
    features: {
      softDelete: true,
      auditable: false,
      creatable: true,
      editable: true,
      deletable: true,
    },
    fields: {
      id: { type: 'uuid', primaryKey: true, generated: 'uuid' },
      workspaceId: { type: 'relation', relation: { target: 'workspace', field: 'name' }, hidden: true },
      entityType: { type: 'string', required: true, searchable: true },
      entityId: { type: 'string', required: true, searchable: true },
      content: { type: 'text', required: true, searchable: true },
      authorId: { type: 'relation', relation: { target: 'contact', field: 'name' } },
      createdAt: { type: 'datetime', generated: 'now' },
    }
  },
  system_setting: {
    label: { ro: 'Setare Sistem', en: 'System Setting' },
    labelPlural: { ro: 'Setări Sistem', en: 'System Settings' },
    icon: 'Settings',
    tableName: 'SYSTEM_SETTING',
    displayField: 'key',
    isSystem: true,
    features: {
      creatable: false,
      editable: true,
      deletable: false,
      auditable: true,
      timestamps: true
    },
    fields: {
      id: { type: 'uuid', primaryKey: true, hidden: true },
      namespace: { type: 'string', required: true, ui: { width: 4 } },
      key: { type: 'string', required: true, ui: { width: 4 } },
      value: { type: 'text', ui: { width: 12 } },
      dataType: { type: 'enum', options: [
        { label: { ro: 'Text', en: 'String' }, value: 'string' },
        { label: { ro: 'Număr', en: 'Number' }, value: 'number' },
        { label: { ro: 'Boolean', en: 'Boolean' }, value: 'boolean' },
        { label: { ro: 'JSON', en: 'JSON' }, value: 'json' }
      ], ui: { width: 4 } },
      description: { type: 'text', ui: { width: 12 } },
    },
    menuConfig: {
      showInMainMenu: false,
      category: 'administration',
      icon: 'Settings',
      priority: 100
    }
  },
  entity_definition: {
    label: { ro: 'Definiție Entitate', en: 'Entity Definition' },
    labelPlural: { ro: 'Builder Entități', en: 'Entity Builder' },
    icon: 'Database',
    tableName: 'entity_definition',
    displayField: 'label',
    isSystem: true,
    features: {
      creatable: true,
      editable: true,
      deletable: false, 
      auditable: true,
      timestamps: true
    },
    dashboardConfig: {
      enabled: true,
      showInDashboard: false,
      priority: 1,
      widgetType: 'stats'
    },
    fields: {
      id: { type: 'uuid', primaryKey: true, hidden: true },
      name: { type: 'string', required: true, ui: { width: 6 } },
      label: { type: 'string', required: true, ui: { width: 6 } },
      labelPlural: { type: 'string', ui: { width: 6 } },
      description: { type: 'text', ui: { width: 12 } },
      icon: { type: 'string', ui: { width: 6 } },
      colorTheme: { type: 'string', ui: { width: 6 } },
      tableName: { type: 'string', ui: { width: 6 } },
      displayField: { type: 'string', ui: { width: 6 } },
      fields: { type: 'json', ui: { width: 12 } },
      validations: { type: 'json', ui: { width: 12 } },
      relationships: { type: 'json', ui: { width: 12 } },
      uiConfig: { type: 'json', ui: { width: 12 } },
      menuConfig: { type: 'json', ui: { width: 12 } },
      permission: { type: 'json', ui: { width: 12 } },
      features: { type: 'json', ui: { width: 12 } },
      layout: { type: 'json', ui: { width: 12 } },
      dashboardConfig: { type: 'json', ui: { width: 12 } },
      isSystem: { type: 'boolean', hidden: true },
      workspaceId: { type: 'string', hidden: true },
    },
    menuConfig: {
      showInMainMenu: true,
      category: 'administration',
      icon: 'Database',
      priority: 110
    }
  },
  role: {
    label: { ro: 'Rol', en: 'Role' },
    labelPlural: { ro: 'Roluri', en: 'Roles' },
    icon: 'Shield',
    tableName: 'role',
    displayField: 'name',
    isSystem: true,
    features: {
      creatable: true,
      editable: true,
      deletable: true,
      auditable: true,
      timestamps: true
    },
    fields: {
      id: { type: 'uuid', primaryKey: true, hidden: true },
      workspaceId: { 
        type: 'relation', 
        relation: { target: 'workspace', field: 'name' }, 
        hidden: true 
      },
      name: { type: 'string', required: true, ui: { width: 6 } },
      color: { type: 'color', ui: { width: 6 } },
      description: { type: 'text', ui: { width: 12 } },
      permission: { type: 'json', ui: { width: 12 } },
    },
    menuConfig: {
      showInMainMenu: true,
      category: 'administration',
      icon: 'Shield',
      priority: 120
    }
  },
  workspace_user: {
    label: { ro: 'Membru Spațiu', en: 'Workspace Member' },
    labelPlural: { ro: 'Membri Spațiu', en: 'Workspace Members' },
    icon: 'Users',
    tableName: 'workspace_user',
    displayField: 'userId',
    isSystem: true,
    features: {
      creatable: true,
      editable: true,
      deletable: true,
      auditable: true,
      timestamps: true
    },
    fields: {
      id: { type: 'uuid', primaryKey: true, hidden: true },
      workspaceId: { 
        type: 'relation', 
        relation: { target: 'workspace', field: 'name' }, 
        hidden: true 
      },
      userId: { 
        type: 'relation', 
        relation: { target: 'user', field: 'email' },
        ui: { width: 6 } 
      },
      role: { 
        type: 'enum', 
        options: [
          { label: { ro: 'Proprietar', en: 'Owner' }, value: 'owner' },
          { label: { ro: 'Admin', en: 'Admin' }, value: 'admin' },
          { label: { ro: 'Utilizator', en: 'User' }, value: 'user' },
          { label: { ro: 'Guest', en: 'Guest' }, value: 'guest' }
        ],
        defaultValue: 'user',
        ui: { width: 6 } 
      },
      permission: { type: 'json', hidden: true },
    },
    menuConfig: {
      showInMainMenu: false,
      category: 'administration',
      icon: 'Users',
      priority: 130
    }
  },
  user: {
    label: { ro: 'Utilizator', en: 'User' },
    labelPlural: { ro: 'Utilizatori', en: 'Users' },
    icon: 'User',
    tableName: 'user',
    displayField: 'name',
    isSystem: true,
    features: {
      creatable: false,
      editable: true,
      deletable: false,
      auditable: true,
      timestamps: true
    },
    fields: {
      id: { type: 'uuid', primaryKey: true, hidden: true },
      name: { type: 'string', required: true, ui: { width: 6 } },
      email: { type: 'string', required: true, unique: true, ui: { width: 6 } },
      image: { type: 'image', ui: { width: 12 } },
      role: { type: 'string', ui: { width: 6 } },
      workspaceId: { type: 'string', hidden: true },
      active: { type: 'boolean', defaultValue: true, ui: { width: 6 } },
    },
    menuConfig: {
      showInMainMenu: true,
      category: 'administration',
      icon: 'User',
      priority: 80
    }
  },
  session: {
    label: { ro: 'Sesiune', en: 'Session' },
    labelPlural: { ro: 'Sesiuni', en: 'Sessions' },
    icon: 'Key',
    tableName: 'session',
    isSystem: true,
    features: { auditable: false, deletable: true },
    fields: {
      id: { type: 'uuid', primaryKey: true },
      userId: { type: 'string', required: true },
      token: { type: 'string', required: true, unique: true },
      expiresAt: { type: 'datetime', required: true },
      ipAddress: { type: 'string' },
      userAgent: { type: 'string' }
    }
  },
  account: {
    label: { ro: 'Cont Extern', en: 'External Account' },
    labelPlural: { ro: 'Conturi Externe', en: 'External Accounts' },
    icon: 'Fingerprint',
    tableName: 'account',
    isSystem: true,
    features: { auditable: false, deletable: true },
    fields: {
      id: { type: 'uuid', primaryKey: true },
      userId: { type: 'string', required: true },
      providerId: { type: 'string', required: true },
      accountId: { type: 'string', required: true },
      accessToken: { type: 'string' },
      refreshToken: { type: 'string' },
      idToken: { type: 'string' },
      expiresAt: { type: 'datetime' },
      password: { type: 'password' }
    }
  },
  verification: {
    label: { ro: 'Verificare', en: 'Verification' },
    labelPlural: { ro: 'Verificări', en: 'Verifications' },
    icon: 'ShieldCheck',
    tableName: 'verification',
    isSystem: true,
    features: { auditable: false, deletable: true },
    fields: {
      id: { type: 'uuid', primaryKey: true },
      identifier: { type: 'string', required: true },
      value: { type: 'string', required: true },
      expiresAt: { type: 'datetime', required: true }
    }
  },
  config_version: {
    label: { ro: 'Versiune Config', en: 'Config Version' },
    labelPlural: { ro: 'Versiuni Config', en: 'Config Versions' },
    icon: 'History',
    tableName: 'config_version',
    isSystem: true,
    features: { auditable: false, deletable: true },
    fields: {
      id: { type: 'uuid', primaryKey: true },
      namespace: { type: 'string', required: true },
      key: { type: 'string', required: true },
      configJson: { type: 'json' },
      changedBy: { type: 'string' },
      description: { type: 'string' }
    }
  },
  _ai_prompt: {
    label: { ro: 'Prompt AI', en: 'AI Prompt' },
    labelPlural: { ro: 'Prompturi AI', en: 'AI Prompts' },
    icon: 'MessageSquare',
    tableName: '_ai_prompt',
    isSystem: true,
    features: { auditable: true, deletable: true },
    fields: {
      id: { type: 'uuid', primaryKey: true },
      name: { type: 'string', required: true, unique: true },
      systemPrompt: { type: 'text' },
      userPromptTemplate: { type: 'text' },
      model: { type: 'string' },
      inputContext: { type: 'json' },
      outputField: { type: 'string' },
      category: { type: 'string' },
      description: { type: 'string' },
      isLocked: { type: 'boolean', defaultValue: false }
    }
  },
  workspace_invitation: {
    label: { ro: 'Invitație', en: 'Invitation' },
    labelPlural: { ro: 'Invitații', en: 'Invitations' },
    icon: 'Mail',
    tableName: 'invitation',
    displayField: 'email',
    isSystem: true,
    features: {
      creatable: true,
      editable: false,
      deletable: true,
      auditable: true,
      timestamps: true
    },
    fields: {
      id: { type: 'uuid', primaryKey: true, hidden: true },
      workspaceId: { 
        type: 'relation', 
        relation: { target: 'workspace', field: 'name' }, 
        hidden: true 
      },
      email: { type: 'string', required: true, ui: { width: 6 } },
      role: { type: 'string', defaultValue: 'user', ui: { width: 4 } },
      token: { type: 'string', hidden: true },
      expiresAt: { type: 'datetime', ui: { width: 6 } },
      status: { 
        type: 'enum', 
        options: [
          { label: { ro: 'În așteptare', en: 'Pending' }, value: 'pending' },
          { label: { ro: 'Acceptată', en: 'Accepted' }, value: 'accepted' },
          { label: { ro: 'Expirată', en: 'Expired' }, value: 'expired' }
        ], 
        defaultValue: 'pending', 
        ui: { width: 4 } 
      },
    },
    menuConfig: {
      showInMainMenu: false,
      category: 'administration',
      icon: 'Mail',
      priority: 140
    }
  },
  tag_assignment: {
    label: { ro: 'Atribuire Etichetă', en: 'Tag Assignment' },
    labelPlural: { ro: 'Atribuiri Etichete', en: 'Tag Assignments' },
    icon: 'Tag',
    tableName: 'tag_assignment',
    displayField: 'tagId',
    isSystem: true,
    features: {
      creatable: true,
      editable: false,
      deletable: true,
      auditable: false,
      timestamps: true
    },
    fields: {
      id: { type: 'uuid', primaryKey: true, hidden: true },
      workspaceId: { 
        type: 'relation', 
        relation: { target: 'workspace', field: 'name' }, 
        hidden: true 
      },
      tagId: { 
        type: 'relation', 
        relation: { target: 'tag', field: 'name' },
        ui: { width: 6 } 
      },
      entityType: { type: 'string', ui: { width: 6 } },
      entityId: { type: 'string', ui: { width: 6 } },
    }
  },
  collection: {
    label: { ro: 'Colecție', en: 'Collection' },
    labelPlural: { ro: 'Colecții', en: 'Collections' },
    icon: 'Folder',
    description: { ro: 'Grupări de entități sau elemente', en: 'Groupings of entities or items' },
    tableName: 'collection',
    fields: {
      id: { type: 'uuid', primaryKey: true, generated: 'uuid' },
      name: { type: 'string', required: true },
      slug: { type: 'string', unique: true },
      description: { type: 'text' },
      color: { type: 'string' },
      icon: { type: 'string' },
      createdAt: { type: 'datetime', generated: 'now' },
      updatedAt: { type: 'datetime', generated: 'now' },
    },
    indexes: ['slug', 'createdAt'],
    menuConfig: {
      showInMainMenu: true,
      category: 'administration',
      icon: 'Folder',
      priority: 20
    }
  },
  lead: {
    label: { ro: 'Lead', en: 'Lead' },
    labelPlural: { ro: 'Leads', en: 'Leads' },
    icon: 'Target',
    tableName: 'lead',
    displayField: 'title',
    fields: {
      id: { type: 'uuid', primaryKey: true, hidden: true },
      workspaceId: { type: 'relation', relation: { target: 'workspace', field: 'name' }, hidden: true },
      contactId: { type: 'relation', relation: { target: 'contact', field: 'name' } },
      title: { type: 'string', required: true, searchable: true },
      source: { type: 'string' },
      status: { type: 'enum', options: ['new', 'contacted', 'qualified', 'unqualified'], defaultValue: 'new' },
      createdAt: { type: 'datetime', generated: 'now' },
    },
    menuConfig: {
      showInMainMenu: true,
      category: 'sales',
      icon: 'Target',
      priority: 25
    }
  },
  bug_report: {
    label: { ro: 'Bug Report', en: 'Bug Report' },
    labelPlural: { ro: 'Bug Reports', en: 'Bug Reports' },
    icon: 'Bug',
    tableName: 'bug_report',
    displayField: 'title',
    fields: {
      id: { type: 'uuid', primaryKey: true, hidden: true },
      workspaceId: { type: 'relation', relation: { target: 'workspace', field: 'name' }, hidden: true },
      userId: { type: 'relation', relation: { target: 'user', field: 'name' } },
      title: { type: 'string', required: true, searchable: true },
      description: { type: 'text' },
      severity: { type: 'enum', options: ['low', 'medium', 'high', 'critical'] },
      status: { type: 'enum', options: ['open', 'fixed', 'wontfix'], defaultValue: 'open' },
      createdAt: { type: 'datetime', generated: 'now' },
    },
    menuConfig: {
      showInMainMenu: true,
      category: 'administration',
      icon: 'Bug',
      priority: 200
    }
  },
  changelog: {
    label: { ro: 'Changelog', en: 'Changelog' },
    labelPlural: { ro: 'Changelogs', en: 'Changelogs' },
    icon: 'History',
    tableName: 'changelog',
    displayField: 'version',
    fields: {
      id: { type: 'uuid', primaryKey: true, hidden: true },
      workspaceId: { type: 'relation', relation: { target: 'workspace', field: 'name' }, hidden: true },
      module: { type: 'string' },
      version: { type: 'string', required: true },
      details: { type: 'text' },
      createdAt: { type: 'datetime', generated: 'now' },
    },
    menuConfig: {
      showInMainMenu: true,
      category: 'administration',
      icon: 'History',
      priority: 210
    }
  },
  entity_attachment: {
    label: { ro: 'Ataşament Entitate', en: 'Entity Attachment' },
    labelPlural: { ro: 'Ataşamente', en: 'Attachments' },
    icon: 'Paperclip',
    tableName: 'entity_attachment',
    displayField: 'entityId',
    isSystem: true,
    fields: {
      id: { type: 'uuid', primaryKey: true, hidden: true },
      workspaceId: { type: 'relation', relation: { target: 'workspace', field: 'name' }, hidden: true },
      fileId: { type: 'relation', relation: { target: 'file', field: 'filename' }, required: true },
      entityType: { type: 'string', required: true },
      entityId: { type: 'string', required: true },
      category: { type: 'string' },
      createdAt: { type: 'datetime', generated: 'now' },
    }
  },
  workspace_setting: {
    label: { ro: 'Setare Workspace', en: 'Workspace Setting' },
    labelPlural: { ro: 'Setări Workspace', en: 'Workspace Settings' },
    icon: 'Settings',
    tableName: 'workspace_setting',
    displayField: 'category',
    isSystem: true,
    fields: {
      id: { type: 'uuid', primaryKey: true, hidden: true },
      workspaceId: { type: 'relation', relation: { target: 'workspace', field: 'name' }, hidden: true },
      category: { type: 'string' },
      setting: { type: 'json' },
      workspaceName: { type: 'string' },
      timezone: { type: 'string' },
      logoUrl: { type: 'string' },
      language: { type: 'string' },
      ai: { type: 'json' },
    }
  },
} as const;

// ============================================================================
// DASHBOARD CONFIGURATION
// ============================================================================

export const DASHBOARD = {
  welcomeMessage: {
    ro: "Bine ai venit în Studio App v2",
    en: "Welcome to Studio App v2"
  },
  showQuickStats: true,
  layout: 'grid', // grid, list
  cards: [
    {
      id: 'contact_card',
      entity: 'contact',
      type: 'count', // count, activity, chart
      label: { ro: 'Total Contacte', en: 'Total Contacts' },
      icon: 'Users',
      color: 'blue'
    },
    {
      id: 'workspaces_card',
      entity: 'workspace',
      type: 'count',
      label: { ro: 'Spații de Lucru', en: 'Workspaces' },
      icon: 'Briefcase',
      color: 'indigo'
    }
  ]
} as const;

// ============================================================================
// THEME CONFIGURATION
// ============================================================================

export const THEME = {
  defaultTheme: 'light',
  storageKey: 'studio-theme',
  brand: {
    name: 'Studio App v2',
    logo: 'Command',
    primary: '#4f46e5',
    secondary: '#0f172a',
    accent: '#f97316',
  },
  colors: {
    primary: '#4f46e5',
    secondary: '#0f172a',
    danger: '#ef4444',
    warning: '#f59e0b',
    success: '#10b981',
    info: '#0ea5e9',
    light: '#f3f4f6',
    dark: '#1f2937',
    muted: '#6b7280',
    background: '#ffffff',
    foreground: '#000000',
    border: '#e5e7eb',
    neutral: {
      50: '#f9fafb',
      100: '#f3f4f6',
      200: '#e5e7eb',
      300: '#d1d5db',
      400: '#9ca3af',
      500: '#6b7280',
      600: '#4b5563',
      700: '#374151',
      800: '#1f2937',
      900: '#111827',
    },
    blue: {
      50: '#eff6ff',
      500: '#3b82f6',
      600: '#2563eb',
      900: '#1e3a8a',
    },
    purple: {
      50: '#faf5ff',
      500: '#a855f7',
      600: '#9333ea',
      900: '#581c87',
    },
    red: {
      50: '#fef2f2',
      500: '#ef4444',
      600: '#dc2626',
      900: '#7f1d1d',
    },
  },
  typography: {
    fontFamily: {
      sans: 'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      mono: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace',
    },
    fontSize: {
      xs: '0.75rem',
      sm: '0.875rem',
      base: '1rem',
      lg: '1.125rem',
      xl: '1.25rem',
      '2xl': '1.5rem',
      '3xl': '1.875rem',
    },
  },
  spacing: {
    xs: '0.25rem',
    sm: '0.5rem',
    md: '1rem',
    lg: '1.5rem',
    xl: '2rem',
    '2xl': '3rem',
  },
  layout: {
    sidebarWidth: '16rem',
    headerHeight: '4rem',
    borderRadius: '1rem',
    shadows: {
      sm: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
      md: '0 4px 10px -1px rgba(0, 0, 0, 0.1)',
      lg: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
    },
  },
  darkMode: {
    enabled: true,
    auto: true,
  },
} as const;

// ============================================================================
// AI/LLM CONFIGURATION
// ============================================================================

export const AI_CONFIG = {
  enabled: true,
  defaultProvider: 'gemini',
  // Active providers that the system can use. 
  // All active providers are initialized in parallel.
  activeProviders: ['gemini', 'cloudflare'], 
  temperature: 0.7,
  maxTokens: 2048,
  ragEnabled: true,
  agentPersonality: 'professional',
  providers: {
    gemini: {
      name: 'Google Gemini',
      apiKeyEnvVar: 'GEMINI_API_KEY',
      baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai/',
    },
    openai: {
      name: 'OpenAI',
      apiKeyEnvVar: 'OPENAI_API_KEY',
      baseUrl: 'https://api.openai.com/v1',
    },
    anthropic: {
      name: 'Anthropic Claude',
      apiKeyEnvVar: 'ANTHROPIC_API_KEY',
      baseUrl: 'https://api.anthropic.com/v1',
    },
    cloudflare: {
      name: 'Cloudflare Workers AI',
      apiKeyEnvVar: 'CLOUDFLARE_API_TOKEN',
      baseUrl: 'https://api.cloudflare.com/client/v4',
    },
  },
  // Dynamic Model Registry - Add or modify models here
  models: [
    { id: 'gemini-1.5-pro', name: 'Gemini 1.5 Pro', provider: 'gemini', isDefault: true, capabilities: ['vision', 'chat', 'long-context'] },
    { id: 'gemini-1.5-flash', name: 'Gemini 1.5 Flash', provider: 'gemini', isDefault: false, capabilities: ['chat', 'fast'] },
    { id: 'claude-3-5-sonnet', name: 'Claude 3.5 Sonnet', provider: 'anthropic', isDefault: false, capabilities: ['chat', 'coding'] },
    { id: '@cf/meta/llama-3-8b-instruct', name: 'Llama 3 8B (CF)', provider: 'cloudflare', isDefault: false, capabilities: ['chat', 'local'] },
  ],
  requestConfig: {
    timeout: 30000,
    retries: 3,
    retryDelay: 1000,
  },
} as any;

export const AI_PROMPT = {
  // SYSTEM PROMPTS: Essential for logic, NOT deletable, ONLY editable content.
  system: [
    { 
      id: 'core_assistant', 
      name: { ro: 'Asistent Sistem Core', en: 'Core System Assistant' }, 
      content: 'You are an AI assistant for Studio App v2. Be concise and professional. Use markdown for better readability.',
      isLocked: true 
    },
    { 
      id: 'entity_architect', 
      name: { ro: 'Arhitect Entități', en: 'Entity Architect' }, 
      content: `You are an Expert System Architect for Studio App v2 (Enterprise Level 8).
Your task is to design complex database entity definitions based on user requirements.

CORE ARCHITECTURE RULES:
1. Output MUST be a valid JSON object containing: label, labelPlural, icon, description, fields{}, and uiConfig{}.
2. Supported Field Types: uuid, string, text, textarea, richtext, number, currency, date, datetime, enum, multi-select, relation, relation-many, file, image, color, rating.
3. Relations: Use { "type": "relation", "relation": { "target": "entity_name", "field": "display_field" } }.
4. UI Config: Include { "form": { "columns": 2, "showChildren": true } } for parental entities.
5. Inbound Relations: Set "showChildren": true/false and "hiddenChildren": [] to control automatic child-record visibility.
6. Enums: Use { "options": [{ "label": "Text", "value": "val", "color": "#hex" }] }.

EXAMPLE SCHEMA:
{
  "label": "Project",
  "labelPlural": "Projects",
  "icon": "Briefcase",
  "fields": {
    "name": { "type": "string", "required": true },
    "budget": { "type": "currency" },
    "manager_id": { "type": "relation", "relation": { "target": "contact", "field": "name" } }
  },
  "uiConfig": {
    "form": { "columns": 2, "showChildren": true }
  }
}

Always prioritize clean, normalized data structures and intuitive UI layouts. Output ONLY the JSON.`,
      isLocked: true 
    },
    { 
      id: 'formula_wizard', 
      name: { ro: 'Vrajitor Formule (JS)', en: 'Formula Wizard (JS)' }, 
      content: 'You are a JavaScript expert. Write a clean, single-expression formula for a database field based on the provided context. Return ONLY the code.',
      isLocked: true 
    },
    { 
      id: 'entity_extractor', 
      name: { ro: 'Extractor Entități Date', en: 'Data Entity Extractor' }, 
      content: 'Extract entities from the provided text according to the specific JSON schema. If data is missing, use null. Output ONLY JSON.',
      isLocked: true 
    },
    { 
      id: 'business_intelligence', 
      name: { ro: 'Analist BI / Rapoarte', en: 'BI / Report Analyst' }, 
      content: 'You analyze business data and provide strategic insights. Focus on trends, KPIs, and actionable recommendations.',
      isLocked: true 
    },
    { 
      id: 'search', 
      name: { ro: 'Asistent Căutare Globală', en: 'Global Search Assistant' }, 
      content: 'You are a search assistant for Studio App v2. Interpret the user query and identify intent: navigation, data search, or general help. Return keywords for searching.',
      isLocked: true 
    },
    { 
      id: 'chat', 
      name: { ro: 'Suport Chat Floating', en: 'Floating Chat Support' }, 
      content: 'You are a friendly support agent for the workspace. Help users find features and answer questions about the platform logic.',
      isLocked: true 
    }
  ],
  // GLOBAL PROMPTS: Created by SuperAdmin, available to all workspace.
  global: [
    { 
      id: 'general_enrichment', 
      name: { ro: 'Îmbogățire Date Generală', en: 'General Data Enrichment' }, 
      content: 'Analyze the following data and suggest improvements: {{data}}' 
    }
  ],
  // WORKSPACE PROMPTS: Populated dynamically, but template for registry.
  workspaceTemplates: [
    { 
      id: 'ws_default_reply', 
      name: { ro: 'Răspuns Implicit Workspace', en: 'Workspace Default Reply' }, 
      content: 'Hello, this is a reply from {{workspace_name}}.' 
    }
  ],
  language_instruction: "You MUST communicate with the user ONLY in {{language}}. This is a strict requirement for all responses.",
} as any;

// ============================================================================
// AUTHENTICATION & AUTHORIZATION
// ============================================================================

export const AUTH_CONFIG = {
  enabled: true,
  sessionTimeout: 86400 * 7,
  tokenExpiry: 3600,
  refreshTokenExpiry: 604800,
  strategies: {
    local: {
      enabled: true,
      passwordMinLength: 8,
      passwordRequireUppercase: true,
      passwordRequireNumbers: true,
      passwordRequireSpecialChars: true,
    },
    google: {
      enabled: false,
      clientIdEnvVar: 'GOOGLE_CLIENT_ID',
      clientSecretEnvVar: 'GOOGLE_CLIENT_SECRET',
      callbackUrl: '/auth/google/callback',
    },
    github: {
      enabled: false,
      clientIdEnvVar: 'GITHUB_CLIENT_ID',
      clientSecretEnvVar: 'GITHUB_CLIENT_SECRET',
      callbackUrl: '/auth/github/callback',
    },
  },
  mfa: {
    enabled: true,
    methods: ['totp', 'sms'],
    required: false,
  },
  role: SYSTEM_ROLE,
} as const;

// ============================================================================
// INTEGRATION
// ============================================================================

export const INTEGRATION = {
  whatsapp: {
    enabled: true,
    provider: 'twilio',
    accountSidEnvVar: 'TWILIO_ACCOUNT_SID',
    authTokenEnvVar: 'TWILIO_AUTH_TOKEN',
    phoneNumberEnvVar: 'TWILIO_PHONE_NUMBER',
    webhookSecret: safeEnv('WHATSAPP_WEBHOOK_SECRET', 'your-webhook-secret'),
    messageTimeout: 30000,
    maxRetries: 3,
  },
  gmail: {
    enabled: true,
    clientIdEnvVar: 'GMAIL_CLIENT_ID',
    clientSecretEnvVar: 'GMAIL_CLIENT_SECRET',
    refreshTokenEnvVar: 'GMAIL_REFRESH_TOKEN',
    maxEmailsPerSync: 50,
    syncInterval: 3600,
  },
  slack: {
    enabled: false,
    botTokenEnvVar: 'SLACK_BOT_TOKEN',
    signingSecretEnvVar: 'SLACK_SIGNING_SECRET',
  },
} as const;

// ============================================================================
// EMAIL TEMPLATES
// ============================================================================

export const EMAIL_TEMPLATE = {
  workspace_invitation: {
    subject: {
      ro: "Invitație Workspace - {{workspaceName}}",
      en: "Workspace Invitation - {{workspaceName}}"
    },
    body: {
      ro: "Bună ziua,\n\nAți fost invitat să vă alăturați workspace-ului \"{{workspaceName}}\" pe platforma Studio App cu rolul de {{roleLabel}}.\n\nPuteți accesa platforma aici: {{appUrl}}\n\nEchipa Studio App",
      en: "Hello,\n\nYou have been invited to join the workspace \"{{workspaceName}}\" on the Studio App platform with the role of {{roleLabel}}.\n\nYou can access the platform here: {{appUrl}}\n\nThe Studio App Team"
    },
    html: {
      ro: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
          <h2 style="color: #4f46e5;">Invitație Workspace Nou</h2>
          <p>Bună ziua,</p>
          <p>Ați fost invitat să vă alăturați workspace-ului <strong>{{workspaceName}}</strong> cu rolul de <strong>{{roleLabel}}</strong>.</p>
          <div style="margin: 30px 0;">
            <a href="{{appUrl}}" style="background-color: #4f46e5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: bold;">Accesează Studio App</a>
          </div>
          <p style="color: #666; font-size: 12px;">Dacă nu recunoașteți această invitație, vă rugăm să ignorați acest email.</p>
        </div>
      `,
      en: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
          <h2 style="color: #4f46e5;">New Workspace Invitation</h2>
          <p>Hello,</p>
          <p>You have been invited to join the workspace <strong>{{workspaceName}}</strong> with the role of <strong>{{roleLabel}}</strong>.</p>
          <div style="margin: 30px 0;">
            <a href="{{appUrl}}" style="background-color: #4f46e5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: bold;">Access Studio App</a>
          </div>
          <p style="color: #666; font-size: 12px;">If you do not recognize this invitation, please ignore this email.</p>
        </div>
      `
    }
  }
} as const;

// ============================================================================
// FILE & MEDIA CONFIGURATION
// ============================================================================

export const FILE_CONFIG = {
  categories: {
    document: {
      label: { ro: 'Documente', en: 'Documents' },
      icon: 'FileText',
      mimeTypes: ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'text/plain'],
    },
    image: {
      label: { ro: 'Imagini', en: 'Images' },
      icon: 'Image',
      mimeTypes: ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml'],
    },
    media: {
      label: { ro: 'Media', en: 'Media' },
      icon: 'Film',
      mimeTypes: ['video/mp4', 'video/mpeg', 'audio/mpeg', 'audio/wav', 'audio/aac'],
    },
    archive: {
      label: { ro: 'Arhive', en: 'Archives' },
      icon: 'Archive',
      mimeTypes: ['application/zip', 'application/x-rar-compressed', 'application/x-7z-compressed', 'application/x-tar'],
    },
    spreadsheet: {
      label: { ro: 'Tabele', en: 'Spreadsheets' },
      icon: 'Sheet',
      mimeTypes: ['application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'text/csv'],
    },
  },
  storage: {
    type: 'local',
    uploadDir: './uploads',
    maxFileSize: 50 * 1024 * 1024,
    maxTotalSize: 5 * 1024 * 1024 * 1024,
    allowedMimeTypes: [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'image/jpeg',
      'image/png',
      'image/gif',
      'text/plain',
      'text/csv',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'video/mp4',
      'audio/mpeg',
    ],
    s3: {
      bucketEnvVar: 'AWS_S3_BUCKET',
      regionEnvVar: 'AWS_REGION',
      accessKeyIdEnvVar: 'AWS_ACCESS_KEY_ID',
      secretAccessKeyEnvVar: 'AWS_SECRET_ACCESS_KEY',
    },
  },
  processing: {
    generateThumbnails: true,
    thumbnailSizes: [80, 200, 400],
    extractMetadata: true,
    virusScan: true,
    textExtraction: true,
  },
} as const;

// ============================================================================
// LOCALIZATION & INTERNATIONALIZATION
// ============================================================================

export const I18N_CONFIG = {
  defaultLanguage: 'ro',
  supportedLanguages: {
    en: { name: 'English', nativeName: 'English', direction: 'ltr' },
    ro: { name: 'Romanian', nativeName: 'Română', direction: 'ltr' },
  },
  timezone: {
    default: 'UTC',
    userSelectable: true,
  },
  dateFormat: {
    default: 'DD/MM/YYYY',
    locale: {
      en: 'MM/DD/YYYY',
      ro: 'DD/MM/YYYY',
      es: 'DD/MM/YYYY',
      fr: 'DD/MM/YYYY',
    },
  },
  currencyFormat: {
    default: 'USD',
    locale: {
      en: 'USD',
      ro: 'RON',
      es: 'EUR',
      fr: 'EUR',
    },
  },
} as const;

// ============================================================================
// SYSTEM SETTINGS & FEATURE FLAGS
// ============================================================================

export const SYSTEM_SETTING = {
  use_local_agent: false, // Use Local Node.js Agent (WhatsApp, Hardware, etc)
  enable_worker: false, // Master switch for all background processes (V2)
  worker_whatsapp_enabled: false,
  worker_gmail_enabled: false,
  worker_print_enabled: false,
  worker_indexer_enabled: false,
  worker_archive_enabled: false,
  workspace_name: 'Studio App',
  logo_url: '/logo.png',
  file_retention_days: 30,
  max_backups: 10,
  sync_heavy_data: false, // Toggle for Cloud D1 synchronization
  local_inbox_path: '../local-inbox',
  local_config_path: '../backend-v2/config',
  local_agent_port: parseInt(safeEnv('LOCAL_AGENT_PORT', DEFAULT_AGENT_PORT)),
  local_agent_url: safeEnv('LOCAL_AGENT_URL', DEFAULT_AGENT_URL),
  libreoffice_path: 'C:\\Program file\\LibreOffice\\program\\soffice.exe',
  allowed_file_browser_roots: ['C:\\', 'D:\\', '../', '../local-inbox'],
  printing_allowed_extensions: ['.pdf', '.jpg', '.jpeg', '.png', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx', '.odt', '.ods', '.odp', '.rtf', '.txt', '.pages', '.numbers', '.key', '.zip', '.rar'],
  printing_sessions_limit: 50,
  recent_arrivals_limit: 20,
  ai: {
    priority_provider: 'cloudflare',
    model: 'gemini-1.5-pro',
    temperature: 0.7,
    max_tokens: 2048,
    agent_personality: 'professional',
    rag_enabled: true,
    auto_reply_enabled: false,
  },
  gmail: {
    active: false,
    autoReply: false,
    aiAnalysis: true,
    syncInterval: 60,
    syncLabels: 'INBOX,SENT',
    autoDownload: false,
  },
  whatsapp: {
    active: false,
    autoReply: false,
    aiAnalysis: true,
    autoDownload: false,
    mediaLimit: 16,
  },
  app: {
    maintenanceMode: false,
    debugMode: safeEnv('NODE_ENV') === 'development',
    logLevel: safeEnv('LOG_LEVEL', 'info'),
    maxDashboardWidgets: 12,
  },
  email: {
    enabled: true,
    from: safeEnv('MAIL_FROM', 'noreply@studioapp.local'),
    fromName: 'Studio App',
    provider: 'smtp',
    smtpHost: safeEnv('SMTP_HOST', 'localhost'),
    smtpPort: parseInt(safeEnv('SMTP_PORT', '587')),
    smtpSecure: safeEnv('SMTP_SECURE') === 'true',
    smtpUser: safeEnv('SMTP_USER'),
    smtpPassword: safeEnv('SMTP_PASSWORD'),
  },
  notification: {
    email: true,
    inApp: true,
    push: false,
    sms: false,
    maxNotificationHistory: 100,
  },
  search: {
    enabled: true,
    debounceMs: 300,
    minChars: 2,
    maxResults: 50,
    highlightResults: true,
  },
  export: {
    maxRecords: 10000,
    formats: ['csv', 'json', 'xlsx'],
    defaultFormat: 'csv',
  },
  import: {
    enabled: true,
    maxFileSize: 10 * 1024 * 1024,
    formats: ['csv', 'json', 'xlsx'],
    maxBatchSize: 100,
  },
  backup: {
    enabled: true,
    frequency: 'daily',
    retentionDays: 30,
    autoBackupTime: '02:00',
    backupDir: './backups',
  },
  rateLimit: {
    enabled: true,
    windowMs: 900000,
    maxRequests: 100,
    message: 'Too many requests, please try again later.',
  },
  security: {
    corsEnabled: true,
    allowedOrigins: [
      'https://service.aemdpc.ro',
      'http://localhost:8788',
      safeEnv('FRONTEND_URL', 'https://service.aemdpc.ro'),
    ],
    csrfProtection: true,
    helmetEnabled: true,
    contentSecurityPolicy: {
      enabled: true,
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'", 'cdn.jsdelivr.net'],
        scriptSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", 'data:', 'https:'],
      },
    },
  },
} as const;

// ============================================================================
// DATABASE CONFIGURATION
// ============================================================================

export const DATABASE_CONFIG = {
  type: safeEnv('DATABASE_TYPE', 'sqlite'),
  sqlite: {
    filename: safeEnv('DATABASE_PATH', './db/local_db.sqlite'),
    memory: false,
    verbose: false,
  },
  d1: {
    accountIdEnvVar: 'CLOUDFLARE_ACCOUNT_ID',
    apiTokenEnvVar: 'CLOUDFLARE_API_TOKEN',
    databaseIdEnvVar: 'CLOUDFLARE_D1_DATABASE_ID',
  },
  migrations: {
    enabled: true,
    autoMigrate: true,
    migrationDir: './migrations',
  },
  connection: {
    timeout: 5000,
    maxConnections: 10,
    idleTimeout: 30000,
  },
} as const;

// ============================================================================
// SOCKET.IO CONFIGURATION
// ============================================================================

export const SOCKET_CONFIG = {
  enabled: true,
  port: parseInt(safeEnv('SOCKET_PORT', DEFAULT_AGENT_PORT)),
  cors: {
    origin: [
      'https://service.aemdpc.ro',
      'http://localhost:8788',
      safeEnv('FRONTEND_URL', 'https://service.aemdpc.ro'),
    ],
    methods: ['GET', 'POST'],
    credentials: true,
  },
  transports: ['websocket', 'polling'],
  reconnectionDelay: 1000,
  reconnectionDelayMax: 5000,
  reconnectionAttempts: 5,
  namespaces: {
    default: '/',
    admin: '/admin',
    notification: '/notification',
  },
} as const;

// ============================================================================
// WORKER CONFIGURATION
// ============================================================================

export const WORKER_CONFIG = {
  enabled: true,
  concurrency: 4,
  timeout: 300000,
  worker: {
    emailWorker: {
      enabled: true,
      queue: 'email',
      maxRetries: 3,
    },
    smsWorker: {
      enabled: true,
      queue: 'sms',
      maxRetries: 3,
    },
    fileProcessingWorker: {
      enabled: true,
      queue: 'fileProcessing',
      maxRetries: 2,
    },
    reportGenerationWorker: {
      enabled: true,
      queue: 'reportGeneration',
      maxRetries: 2,
    },
    syncWorker: {
      enabled: true,
      queue: 'sync',
      maxRetries: 5,
    },
  },
} as const;

// ============================================================================
// API CONFIGURATION
// ============================================================================

export const API_CONFIG = {
  version: 'v1',
  baseUrl: '/api/v1',
  defaultTimeout: 15000,
  pagination: {
    defaultPageSize: 20,
    maxPageSize: 100,
  },
  rateLimit: {
    enabled: true,
    requestsPerMinute: 60,
  },
  authentication: {
    headerName: 'Authorization',
    scheme: 'Bearer',
    cookieName: 'auth_token',
  },
} as const;

// ============================================================================
// MAIN REGISTRY BASELINE EXPORT
// ============================================================================


export const I18N = {
  en: {
    common: {
      dashboard: "Dashboard",
      contact: "Contact",
      workspace: "Workspace",
      settings: "Settings",
      superadmin: "SuperAdmin",
      save: "Save",
      save_changes: "Save Changes",
      cancel: "Cancel",
      delete: "Delete",
      edit: "Edit",
      search: "Search",
      loading: "Loading...",
      error: "Error",
      confirm: "Confirm",
      close: "Close",
      regenerate: "Regenerate",
      no_results: "No results found",
      search_results: "Search Results",
      quick_commands: "Quick Commands",
      whats_new: "What's New",
      theme_editor: "Theme Editor",
      ai_platform: "AI Platform",
      ask_ai: "Ask AI",
      ai_analysis_for: "AI Analysis for \"{{query}}\"",
      to_open: "to open",
      to_search: "to search",
      connection_lost: "Connection Lost",
      reconnecting: "Reconnecting...",
      reload_in: "Reload in {{seconds}}s",
      keep_open: "Keep connection open",
      server_online_session: "Server Online (Active Session)",
      server_online_manual: "Server Online (Manual Mode)",
      manual_refresh: "Manual Refresh",
      auto_refresh: "Auto Refresh",
      visual_confirmation: "Visual Confirmation",
      processing: "Processing...",
      confirm_deletion: "Confirm Deletion",
      destructive_action_warning: "This action is destructive. Type \"{{word}}\" to confirm.",
      tag: "tag",
      saving: "Saving...",
      ai_draft: "AI Generated Draft",
      publish: "Publish",
      back_to_list: "Back to list",
      delete_success: "Deleted successfully",
      changes_saved: "Changes saved",
      view: "View",
      add: "Add",
      back: "Back",
      create: "Create",
      new_record: "New {{label}}",
      edit_entity: "Edit {{label}}",
      add_child: "Add {{label}}",
      no_children: "No {{label}} in this {{parent}}",
      operated_by: "Operated by",
      activity_log: "Unified Activity Stream",
      associated_members: "Associated Members",
      x_records: "{{count}} records",
      create_record: "Record creation",
      update_data: "Data update",
      restoration: "RESTORATION",
      security_settings: "Security Settings",
      visibility: "Visibility",
      access_rule: "Access Rule",
      metadata: "Metadata",
      creator: "Creator",
      updated: "Updated",
      open_api: "Open JSON API",
      smart_assistant: "Smart Assistant",
      ai_extraction: "AI EXTRACTION",
      ai_help_text: "Need help filling out this form? You can use the AI Agent to automatically extract data from documents or emails.",
      restore_to_this_state: "Restore to this state",
      in_this: "in this",
      system: "System",
      administrator: "Administrator",
      not_available: "N/A",
      email: "Email",
      password: "Password",
      records: "Records",
      new: "New",
      search_placeholder: "Search...",
      empty_dataset: "Empty Dataset",
      no_records_matching: "No {{label}} found matching your criteria.",
      create_first: "Create your first record",
      untitled_record: "Untitled Record",
      created: "Created",
      click_to_add: "Click dropdown to add {{label}}",
      no_records_in: "No records found in {{label}}",
      select: "Select",
      choose: "Choose",
      role: {
        superadmin: "Super Admin",
        workspace_owner: "Owner",
        workspace_admin: "Admin",
        member: "Member",
        agent: "Agent",
        guest: "Guest",
        user: "User"
      }
    },
    auth: {
      login_success: "Logged in successfully",
      login_error: "Invalid credentials",
      welcome_back: "Welcome back!",
      email: "Email Address",
      email_placeholder: "name@company.com",
      password: "Password",
      password_placeholder: "••••••••",
      sign_in: "Sign In",
      signing_in: "Signing in...",
      no_account: "Don't have an account?",
      register: "Register",
      register_success: "Account created successfully",
      register_error: "Registration failed",
      workspace_name: "Workspace Name",
      workspace_name_placeholder: "My Awesome Studio",
      initial_setup: "Initial Setup",
      setup_description: "Please register the first administrator account.",
      create_admin: "Create Admin Account",
      setup_success: "SuperAdmin registered successfully!",
      setup_error: "Setup error",
      registering: "Registering...",
      already_have_account: "Already have an account?",
      login_here: "Login here",
      signup_subtitle: "Start by creating your administrator account.",
      full_name: "Full Name",
      full_name_placeholder: "John Doe"
    },
    validation: {
      required: "{{label}} is required",
      invalid_email: "Invalid email",
      invalid_phone: "Invalid phone",
      invalid_format: "Invalid format for {{label}}"
    },
    dashboard: {
      welcome: "Welcome back!",
      subtitle: "Here's what's happening.",
      manage_entity: "Manage {{label}}",
      system_health: "System Health",
      activity_flow: "Activity Flow",
      view_edit_desc: "View and edit the database for {{label}}.",
      open_module: "Open Module",
      no_activity: "No recent activity available.",
      ai_assistant: "AI Assistant",
      ai_assistant_desc: "Analyze your data with the AI architect.",
      ask_ai: "Ask AI",
      data_integration: "Data Integration",
      d1_sync: "Cloudflare D1 sync is active.",
      restart_services: "Restart Services",
      confirm_restart: "Are you sure you want to restart all system workers? This will temporarily disconnect WhatsApp and Gmail.",
      workers_restarting: "Services are restarting...",
      restart_failed: "Restart failed",
      pending_tasks: "Pending task",
      all_done: "All task completed"
    },
    whatsapp: {
      title: "WhatsApp Messaging",
      connected: "Connected",
      connecting: "Connecting...",
      disconnected: "Disconnected",
      syncing: "Syncing...",
      message_deleted: "Message deleted",
      status: "WhatsApp Status"
    },
    gmail: {
      title: "Gmail Integration",
      inbox: "Inbox",
      sent: "Sent",
      drafts: "Drafts",
      trash: "Trash",
      sync_now: "Sync Now"
    },
    superadmin: {
      hub_title: "Superadmin Hub",
      hub_description: "Manage system architecture and marketplace templates",
      tabs: {
        ai_architect: "AI Architect",
        marketplace: "Marketplace",
        builder: "Studio Builder"
      },
      ai_architect: {
        title: "AI Business Model Architect",
        subtitle: "Describe your business model and let AI generate the full schema",
        describe_model: "Describe Your Business Model",
        prompt_placeholder: "Example: I run a SaaS platform for fitness coaches...",
        generating: "AI is thinking...",
        generate_schema: "Generate Full Schema"
      },
      navigation: {
        main_nav: "Main Navigation Orchestration",
        worker_apps: "Apps & Workers",
        admin_SHORTCUT: "Admin SHORTCUT",
        sidebar_entity: "Data Entities in Sidebar",
        commit_dna: "Save Navigation Structure",
        commit_success: "Navigation structure saved successfully!"
      }
    },
    profile: {
      title: "My Profile",
      subtitle: "Manage your personal account settings",
      personal_info: "Personal Information",
      description: "Update your contact details and how you are seen in the system.",
      full_name: "Full Name",
      phone: "Phone Number",
      email: "Email Address",
      company: "Company / Department",
      save: "Save Changes",
      saving: "Saving...",
      updated: "Profile updated successfully",
      error: "Error updating profile"
    },
    setting: {
      title: "Settings",
      workspace: "Workspace Settings",
      appearance: "Appearance",
      notification: "notification",
      security: "Security",
      theme_saved_success: "Theme settings saved",
      enable_worker: "Background Workers",
      advanced_ui_config: "Advanced UI Configuration",
      theme_presets_label: "Theme Presets",
      theme_custom_colors: "Custom Colors",
      theme_SHORTCUT: "Keyboard SHORTCUT",
      theme_sidebar: "Navigation Customization",
      theme_mode: "Display Mode",
      mode_light: "Light",
      mode_dark: "Dark",
      mode_system: "System",
      select_theme: "Select Theme",
      theme_select_desc: "Choose a base template to start customizing",
      main_colors: "Main Colors",
      primary: "Primary",
      secondary: "Secondary",
      accent: "Accent Color",
      background_colors: "Background & Surface",
      page_bg: "Page Background",
      surface: "Surface / Cards",
      text: "Text Color",
      aspect_layout: "Aspect & Layout",
      border_radius: "Border Radius",
      width: "Content Width",
      density: "UI Density",
      collapsed_sidebar: "Collapsed Sidebar",
      shadows: "Shadow Effects",
      scrollbar: "Custom Scrollbar",
      preview: "Live Preview",
      theme_sidebar_desc: "Pin entities or system tools to the global SHORTCUT section of your sidebar.",
      user: {
        invite_title: "Invite Member",
        invite_desc: "Send an email invitation to a new team member",
        role: "Member Role",
        permission_title: "Entity Permissions",
        permission_desc: "Configure granular access controls for {{name}}",
        permission_disclaimer: "* Changes apply immediately after saving. System DNA overrides have precedence.",
        permission_updated: "Permission updated successfully"
      }
    },
    sidebar: {
      main_menu: "Main Menu",
      app_worker: "Apps & Workers",
      data_system: "Data Systems",
      administration: "System Settings",
      SHORTCUT: "Quick Shortcuts",
      dashboard: "Dashboard",
      contact: "Contact",
      profile: "My Profile",
      setting: "General Settings",
      logout: "Log Out",
      theme_editor: "Appearance",
      v2_label: "v2 Core"
    },
    printing: {
      archive_logs: "History Logs",
      archive_description: "Detailed history of all completed and failed print jobs.",
      saved_orders: "Saved Orders",
      saved_orders_description: "Folders and sessions saved for future printing or billing.",
      recent_history: "Recent Activity",
      print_queue: "Print Queue",
      active_queue: "Active Jobs",
      inbox: "Local Inbox",
      currency: "RON",
      order_name: "Session Name",
      files_count: "{{count}} file",
      no_saved_orders: "No saved sessions found.",
    }
  },
  ro: {
    common: {
      dashboard: "Tablou de bord",
      contact: "Contact",
      workspace: "Workspace",
      settings: "Setări",
      superadmin: "SuperAdmin",
      save: "Salvează",
      save_changes: "Salvează Modificările",
      cancel: "Anulează",
      delete: "Șterge",
      edit: "Editează",
      search: "Caută",
      loading: "Se încarcă...",
      error: "Eroare",
      confirm: "Confirmă",
      close: "Închide",
      regenerate: "Re-generează",
      no_results: "Nu am găsit rezultate",
      search_results: "Rezultate căutare",
      quick_commands: "Comenzi rapide",
      whats_new: "Noutăți",
      theme_editor: "Editor Temă Vizuală",
      ai_platform: "Platformă AI",
      ask_ai: "Întreabă AI",
      ai_analysis_for: "Analiză AI pentru \"{{query}}\"",
      to_open: "pentru a deschide",
      to_search: "pentru a căuta",
      connection_lost: "Conexiune pierdută",
      reconnecting: "Se reconectează...",
      reload_in: "Reîncărcare în {{seconds}}s",
      keep_open: "Păstrează conexiunea deschisă",
      server_online_session: "Server Online (Sesiune activă)",
      server_online_manual: "Server Online (Mod manual)",
      manual_refresh: "Reîmprospătare manuală",
      auto_refresh: "Auto-reîmprospătare",
      visual_confirmation: "Confirmare vizuală",
      processing: "Se procesează...",
      confirm_deletion: "Confirmă ștergerea",
      destructive_action_warning: "Această acțiune este distructivă. Scrie „{{word}}” pentru a confirma.",
      tag: "Etichete",
      saving: "Se salvează...",
      ai_draft: "Draft Generat de AI",
      publish: "Publică",
      back_to_list: "Înapoi la listă",
      delete_success: "Șters cu succes",
      changes_saved: "Modificările au fost salvate",
      view: "Vizualizare",
      add: "Adăugare",
      back: "Înapoi",
      create: "Creează",
      new_record: "Nou {{label}}",
      edit_entity: "Editează {{label}}",
      add_child: "Adaugă {{label}}",
      no_children: "Nu există {{label}} în acest {{parent}}",
      operated_by: "Operat de",
      activity_log: "Flux Activitate Uniformizat",
      associated_members: "Membri asociați",
      x_records: "{{count}} înregistrări",
      create_record: "Creare înregistrare",
      update_data: "Actualizare date",
      restoration: "RESTAURARE",
      security_settings: "Setări Securitate",
      visibility: "Vizibilitate",
      access_rule: "Regulă Acces",
      metadata: "Metadate",
      creator: "Creator",
      updated: "Actualizat",
      open_api: "Deschide JSON API",
      smart_assistant: "Asistent Inteligent",
      ai_extraction: "EXTRACȚIE AI",
      ai_help_text: "Ai nevoie de ajutor pentru a completa acest formular? Poți folosi Agentul AI pentru a extrage automat date din documente sau e-mailuri.",
      restore_to_this_state: "Restaurează la această stare",
      in_this: "în acest",
      system: "Sistem",
      administrator: "Administrator",
      not_available: "N/A",
      email: "Email",
      password: "Parolă",
      records: "Înregistrări",
      new: "Nou",
      search_placeholder: "Caută...",
      empty_dataset: "Fără date",
      no_records_matching: "Nu am găsit {{label}} care să corespundă criteriilor tale.",
      create_first: "Creează prima înregistrare",
      untitled_record: "Înregistrare fără titlu",
      created: "Creat la",
      click_to_add: "Click pe dropdown pentru a adăuga {{label}}",
      no_records_in: "Nicio înregistrare găsită în {{label}}",
      select: "Selectează",
      choose: "Alege",
      role: {
        superadmin: "Super Admin",
        workspace_owner: "Proprietar",
        workspace_admin: "Administrator",
        member: "Membru",
        agent: "Agent",
        guest: "Fără permisiuni",
        user: "Utilizator"
      }
    },
    auth: {
      login_success: "Autentificare reușită",
      login_error: "Date invalide",
      welcome_back: "Bine ai revenit!",
      email: "Adresă Email",
      email_placeholder: "nume@companie.com",
      password: "Parolă",
      password_placeholder: "••••••••",
      sign_in: "Autentificare",
      signing_in: "Se autentifică...",
      no_account: "Nu ai cont?",
      register: "Înregistrare",
      register_success: "Cont creat cu succes",
      register_error: "Eroare la înregistrare",
      workspace_name: "Nume Workspace",
      workspace_name_placeholder: "Studioul Meu",
      initial_setup: "Configurare Inițială",
      setup_description: "Vă rugăm să înregistrați primul cont de administrator.",
      create_admin: "Creează Cont Admin",
      setup_success: "SuperAdmin înregistrat cu succes!",
      setup_error: "Eroare la configurare",
      registering: "Se înregistrează...",
      already_have_account: "Ai deja cont?",
      login_here: "Autentifică-te aici",
      signup_subtitle: "Începe prin a crea contul tău de administrator.",
      full_name: "Nume Complet",
      full_name_placeholder: "Ion Popescu"
    },
    validation: {
      required: "{{label}} este obligatoriu",
      invalid_email: "Email invalid",
      invalid_phone: "Telefon invalid",
      invalid_format: "Format invalid pentru {{label}}"
    },
    dashboard: {
      welcome: "Bine ai revenit!",
      subtitle: "Iată ce se întâmplă în studioul tău.",
      manage_entity: "Gestionează {{label}}",
      system_health: "Stare Sistem",
      activity_flow: "Flux de Activitate",
      view_edit_desc: "Vizualizează și editează baza de date pentru {{label}}.",
      open_module: "Deschide Modulul",
      no_activity: "Activitatea recentă nu este disponibilă.",
      ai_assistant: "Asistent AI",
      ai_assistant_desc: "Analizează datele cu AI arhitectul.",
      ask_ai: "Întreabă AI-ul",
      data_integration: "Integrare Date",
      d1_sync: "Sincronizarea cu Cloudflare D1 este activă.",
      restart_services: "Repornește Serviciile",
      confirm_restart: "Sigur doriți să reporniți toți workerii sistemului? Acest lucru va deconecta temporar WhatsApp și Gmail.",
      workers_restarting: "Serviciile se repornesc...",
      restart_failed: "Repornirea a eșuat",
      pending_tasks: "Task-uri în Așteptare",
      all_done: "Toate task-urile completate"
    },
    whatsapp: {
      title: "Mesagerie WhatsApp",
      connected: "Conectat",
      connecting: "Se conectează...",
      disconnected: "Deconectat",
      syncing: "Sincronizare...",
      message_deleted: "Mesaj șters",
      status: "Status WhatsApp"
    },
    gmail: {
      title: "Integrare Gmail",
      inbox: "Inbox",
      sent: "Trimise",
      drafts: "Ciorne",
      trash: "Gunoi",
      sync_now: "Sincronizează Acum"
    },
    superadmin: {
      hub_title: "Superadmin Hub",
      hub_description: "Gestionează arhitectura sistemului și șabloanele marketplace",
      tabs: {
        ai_architect: "AI Arhitect",
        marketplace: "Marketplace",
        builder: "Studio Builder"
      },
      ai_architect: {
        title: "AI Business Model Architect",
        subtitle: "Descrie modelul de afaceri și lasă AI-ul să genereze schema completă",
        describe_model: "Descrie Modelul Tău de Afaceri",
        prompt_placeholder: "Exemplu: Conduc o platformă SaaS pentru antrenori de fitness...",
        generating: "AI gândește...",
        generate_schema: "Generează Schema Completă"
      },
      navigation: {
        main_nav: "Orchestrare Navigare Principală",
        worker_apps: "Aplicații & Workeri",
        admin_SHORTCUT: "Scurtături Admin",
        sidebar_entity: "Entități Date în Sidebar",
        commit_dna: "Salvează Structura Navigării",
        commit_success: "Structura Navigării a fost salvată cu succes!"
      }
    },
    profile: {
      title: "Profilul Meu",
      subtitle: "Gestionează setările contului tău personal.",
      personal_info: "Informații Personale",
      description: "Actualizează detaliile tale de contact și modul în care ești văzut în sistem.",
      full_name: "Nume Complet",
      phone: "Număr Telefon",
      email: "Adresă Email",
      company: "Companie / Departament",
      save: "Salvează Modificările",
      saving: "Se salvează...",
      updated: "Profil actualizat cu succes",
      error: "Eroare la actualizarea profilului"
    },
    setting: {
      title: "Setări",
      workspace: "Setări Workspace",
      appearance: "Aspect Vizual",
      notification: "Notificări",
      security: "Securitate",
      theme_saved_success: "Setările au fost salvate",
      enable_worker: "Procesare Fundal",
      advanced_ui_config: "Configurare Avansată Interfață",
      theme_presets_label: "Preselecții Temă",
      theme_custom_colors: "Culori Personalizate",
      theme_SHORTCUT: "Scurtături Tastatură",
      theme_sidebar: "Personalizare Navigație",
      theme_mode: "Mod Afișare",
      mode_light: "Luminos",
      mode_dark: "Întunecat",
      mode_system: "Sistem",
      select_theme: "Selectează Tema",
      theme_select_desc: "Alege un model de bază pentru a începe personalizarea",
      main_colors: "Culori Principale",
      primary: "Primară",
      secondary: "Secundară",
      accent: "Culoare Accent",
      background_colors: "Fundal și Suprafețe",
      page_bg: "Fundal Pagină",
      surface: "Suprafețe / Carduri",
      text: "Culoare Text",
      aspect_layout: "Aspect și Distanțare",
      border_radius: "Raza Bordurilor",
      width: "Lățime Conținut",
      density: "Densitate UI",
      collapsed_sidebar: "Sidebar Restrâns",
      shadows: "Efecte de Umbră",
      scrollbar: "Scrollbar Personalizat",
      preview: "Previzualizare Live",
      theme_sidebar_desc: "Fixează entități sau unelte de sistem în secțiunea de scurtături globale din sidebar.",
      user: {
        invite_title: "Invită Membru",
        invite_desc: "Trimite o invitație pe email unui nou membru al echipei",
        role: "Rol Membru",
        permission_title: "Permisiuni Entități",
        permission_desc: "Configurează controlul accesului granular pentru {{name}}",
        permission_disclaimer: "* Modificările se aplică imediat. Specificațiile System DNA au prioritate.",
        permission_updated: "Permisiuni actualizate cu succes"
      }
    },
    sidebar: {
      main_menu: "Meniu Principal",
      app_worker: "Aplicații & Workeri",
      data_system: "Module Personalizate",
      administration: "Setări Sistem",
      SHORTCUT: "Scurtături Rapide",
      dashboard: "Panou Control",
      contact: "Contact",
      profile: "Profilul Meu",
      setting: "Setări Generale",
      logout: "Deconectare",
      theme_editor: "Aspect Vizual",
      v2_label: "v2 Core"
    },
    printing: {
      archive_logs: "Arhivă Jurnal",
      archive_description: "Istoricul detaliat al tuturor joburilor de printare finalizate sau eșuate.",
      saved_orders: "Comenzi Salvate",
      saved_orders_description: "Sesiuni și foldere salvate pentru printare ulterioară sau facturare.",
      recent_history: "Istoric Recent",
      print_queue: "Coadă Printare",
      active_queue: "Joburi Active",
      inbox: "Inbox Local",
      currency: "RON",
      order_name: "Nume Sesiune",
      files_count: "{{count}} fișiere",
      no_saved_orders: "Nu există sesiuni salvate.",
    }
  }
} as const;
export const REGISTRY_BASELINE = {
  __version__: CONSTANT.app.version,
  __lastUpdated__: new Date().toISOString(),
  __environment__: safeEnv('NODE_ENV', 'development'),

  // Top-level Config (Visible in GENERAL)
  appName: SYSTEM_SETTING.workspace_name,
  appLogo: SYSTEM_SETTING.logo_url,
  appVersion: CONSTANT.app.version,
  appDescription: CONSTANT.app.description,
  appUrl: CONSTANT.directories.baseUrl,
  language: I18N_CONFIG.defaultLanguage,
  timezone: I18N_CONFIG.timezone.default,
  maintenanceMode: SYSTEM_SETTING.app.maintenanceMode,
  debugMode: SYSTEM_SETTING.app.debugMode,

  NAV,
  SHORTCUT,
  CONSTANT,
  ENTITY_CONFIG,
  SYSTEM_ROLE,
  DASHBOARD,
  THEME,
  AI_CONFIG,
  AI_PROMPT,
  AUTH_CONFIG,
  INTEGRATION,
  EMAIL_TEMPLATE,
  FILE_CONFIG,
  I18N_CONFIG,
  I18N,
  SYSTEM_SETTING,
  DATABASE_CONFIG,
  SOCKET_CONFIG,
  WORKER_CONFIG,
  API_CONFIG,
  MARKETPLACE_TEMPLATE,
} as const;

export default REGISTRY_BASELINE;

