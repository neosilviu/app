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
