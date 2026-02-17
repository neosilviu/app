/**
 * Entity Blueprints (Modular V3)
 * Templates for rapid module creation.
 */

export const BLUEPRINT = {
  lead: {
    label: { ro: 'Lead / Prospect', en: 'Lead / Prospect' },
    icon: 'UserPlus',
    colorTheme: 'indigo',
    features: { auditable: true, statusFlow: true },
    fields: [
      { id: 'name', label: { ro: 'Nume Complet', en: 'Full Name' }, type: 'text', required: true, searchable: true },
      { id: 'email', label: 'Email', type: 'email', required: true },
      { id: 'phone', label: { ro: 'Telefon', en: 'Phone' }, type: 'phone' },
      { id: 'source', label: { ro: 'Sursă', en: 'Source' }, type: 'select', options: [
          { value: 'website', label: 'Website' },
          { value: 'referral', label: 'Referral' },
          { value: 'social', label: 'Social Media' }
        ]
      },
      { id: 'status', label: 'Status', type: 'status', defaultValue: 'new', options: [
          { value: 'new', label: { ro: 'Nou', en: 'New' }, color: '#3b82f6' },
          { value: 'contacted', label: { ro: 'Contactat', en: 'Contacted' }, color: '#f59e0b' },
          { value: 'qualified', label: { ro: 'Calificat', en: 'Qualified' }, color: '#10b981' },
          { value: 'lost', label: { ro: 'Pierdut', en: 'Lost' }, color: '#ef4444' }
        ]
      }
    ]
  }
} as const;
