/**
 * REGISTRY ENTITIES - Database Schema Definitions
 * Enterprise Level 8
 */
import { COMMON_STATUS, SYSTEM_ROLE, COMMON_COLOR, COMMON_PRIORITY } from './core';

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
      category: 'crm',
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
      label: { ro: 'Workspace', en: 'Workspace' },
      priority: 20
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
      category: 'data_systems',
      icon: 'FileText',
      label: { ro: 'Fișiere', en: 'Files' },
      priority: 35
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
      category: 'crm',
      icon: 'CheckSquare',
      label: { ro: 'Taskuri', en: 'Tasks' },
      priority: 40
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
      label: { ro: 'Deal-uri', en: 'Deals' },
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
      showInMainMenu: true,
      category: 'administration',
      icon: 'Bell',
      priority: 200
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
    },
    menuConfig: {
      showInMainMenu: true,
      category: 'administration',
      icon: 'StickyNote',
      priority: 160
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
      showInMainMenu: true,
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
      category: 'security',
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
      showInMainMenu: true,
      category: 'security',
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
      emailVerified: { type: 'boolean', defaultValue: false, ui: { width: 6 } },
      image: { type: 'image', ui: { width: 12 } },
      role: { type: 'string', ui: { width: 6 } },
      workspaceId: { type: 'string', hidden: true },
      lastWorkspaceId: { type: 'string', hidden: true },
      preferredLanguage: { type: 'string', defaultValue: 'ro', ui: { width: 6 } },
      active: { type: 'boolean', defaultValue: true, ui: { width: 6 } },
    },
    menuConfig: {
      showInMainMenu: true,
      category: 'security',
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
    },
    menuConfig: {
      showInMainMenu: true,
      category: 'security',
      icon: 'Key',
      priority: 210
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
      accessTokenExpiresAt: { type: 'datetime' },
      refreshTokenExpiresAt: { type: 'datetime' },
      scope: { type: 'string' },
      password: { type: 'password' }
    },
    menuConfig: {
      showInMainMenu: true,
      category: 'security',
      icon: 'Fingerprint',
      priority: 220
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
    },
    menuConfig: {
      showInMainMenu: true,
      category: 'security',
      icon: 'ShieldCheck',
      priority: 230
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
    },
    menuConfig: {
      showInMainMenu: true,
      category: 'administration',
      icon: 'History',
      priority: 240
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
    },
    menuConfig: {
      showInMainMenu: true,
      category: 'administration',
      icon: 'MessageSquare',
      priority: 190
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
      showInMainMenu: true,
      category: 'security',
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
    },
    menuConfig: {
      showInMainMenu: true,
      category: 'administration',
      icon: 'Tag',
      priority: 155
    }
  },
  tag: {
    label: { ro: 'Etichetă', en: 'Tag' },
    labelPlural: { ro: 'Etichete', en: 'Tags' },
    icon: 'Tag',
    tableName: 'tag',
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
      workspaceId: { type: 'relation', relation: { target: 'workspace', field: 'name' }, hidden: true },
      name: { type: 'string', required: true, searchable: true, ui: { width: 6 } },
      color: { type: 'color', defaultValue: '#3b82f6', ui: { width: 6 } },
      icon: { type: 'string', ui: { width: 6 } },
      description: { type: 'text', ui: { width: 12 } },
      createdAt: { type: 'datetime', generated: 'now', hidden: true },
    },
    menuConfig: {
      showInMainMenu: true,
      category: 'administration',
      icon: 'Tag',
      label: { ro: 'Tag', en: 'Tags' },
      priority: 150
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
    },
    menuConfig: {
      showInMainMenu: true,
      category: 'administration',
      icon: 'Paperclip',
      priority: 170
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
    },
    menuConfig: {
      showInMainMenu: true,
      category: 'administration',
      icon: 'Settings',
      priority: 180
    }
  },
} as const;
