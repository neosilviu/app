export const BASE_ENTITY_FEATURES = {
  auditable: true,
  creatable: true,
  editable: true,
  deletable: true,
  softDelete: true,
  timestamps: true,
  attachments: true,
  comments: true,
  import: true,
  export: true,
} as const;

export const BASE_ENTITY_FIELDS = {
  id: { 
    type: 'uuid', 
    primaryKey: true, 
    generated: 'uuid', 
    hidden: true,
    label: { ro: 'ID', en: 'ID' }
  },
  workspaceId: { 
    type: 'relation', 
    relation: { target: 'workspace', field: 'name' }, 
    hidden: true,
    index: true,
    label: { ro: 'Workspace', en: 'Workspace' }
  },
  createdAt: { 
    type: 'datetime', 
    label: { ro: 'Creat la', en: 'Created At' },
    generated: 'now', 
    hidden: true,
    index: true
  },
  updatedAt: { 
    type: 'datetime', 
    label: { ro: 'Actualizat la', en: 'Updated At' },
    generated: 'now', 
    hidden: true,
    index: true
  },
  deletedAt: { 
    type: 'datetime', 
    label: { ro: 'Șters la', en: 'Deleted At' },
    hidden: true,
    index: true
  },
  createdBy: {
    type: 'relation',
    relation: { target: 'contact', field: 'name' },
    hidden: true,
    label: { ro: 'Creat de', en: 'Created By' }
  },
  updatedBy: {
    type: 'relation',
    relation: { target: 'contact', field: 'name' },
    hidden: true,
    label: { ro: 'Actualizat de', en: 'Updated By' }
  }
} as const;
