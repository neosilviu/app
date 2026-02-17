import { z } from 'zod';
import { BaseSchema, type EntityV3 } from '../schemas/base';

/**
 * CRM DEALS MODULE - Marketplace V3
 * Management complet de oportunități cu acțiuni integrate.
 */
export const deal: EntityV3<any> = {
  id: 'deal',
  label: { ro: 'Oportunitate', en: 'Deal' },
  labelPlural: { ro: 'Oportunități', en: 'Deals' },
  icon: 'DollarSign',
  tableName: 'deal',
  displayField: 'title',
  
  // Marketplace Metadata
  solutionTitle: { ro: 'Pipeline de Vânzări (Deals)', en: 'Sales Pipeline (Deals)' },
  description: { ro: 'Urmărire oportunități financiare și gestiune pipeline de vânzări.', en: 'Track financial opportunities and sales pipeline management.' },
  category: 'sales',

  schema: z.object({
    ...BaseSchema,
    
    title: z.string()
      .min(1, 'Titlul este obligatoriu')
      .describe('ui:width=12;searchable=true;label={"ro": "Titlu Oportunitate", "en": "Opportunity Title"}'),
    
    contactId: z.string()
      .describe('ui:type=relation;target=contact;label={"ro": "Client/Contact", "en": "Client/Contact"}'),
    
    value: z.number().optional()
      .describe('ui:type=currency;width=6;label={"ro": "Valoare", "en": "Value"}'),
    
    currency: z.enum(['RON', 'EUR', 'USD'])
      .default('RON')
      .describe('ui:width=6;label={"ro": "Monedă", "en": "Currency"}'),
    
    status: z.enum(['proposal', 'negotiation', 'won', 'lost', 'archived'])
      .default('proposal')
      .describe('ui:width=6;label={"ro": "Status", "en": "Status"}'),
    
    expectedCloseDate: z.date().optional()
      .describe('ui:width=6;label={"ro": "Data Estimată Închiderii", "en": "Estimated Closing Date"}'),
  }),

  features: ['audit', 'soft-delete', 'timestamps'],
  dependencies: ['contact'],

  flowRules: {
    proposal: {
      nextStates: ['negotiation', 'lost'],
      label: { ro: 'Propunere → Negociere', en: 'Proposal → Negotiation' },
      requiresFields: ['title', 'value', 'contactId'],
      action: 'start_negotiation',
      icon: 'Handshake'
    },
    negotiation: {
      nextStates: ['won', 'lost'],
      label: { ro: 'Negociere → Finalizare', en: 'Negotiation → Close' },
      requiresFields: ['title', 'value'],
      action: 'close_deal',
      icon: 'CheckCircle'
    },
    won: {
      nextStates: ['archived'],
      label: { ro: 'Câştigat → Arhivare', en: 'Won → Archive' },
      requiresFields: [],
      action: 'archive_won',
      icon: 'Archive'
    },
    lost: {
      nextStates: ['proposal', 'archived'],
      label: { ro: 'Pierdut → Repriza', en: 'Lost → Retry/Archive' },
      requiresFields: [],
      action: 'reopen_deal',
      icon: 'RotateCcw'
    }
  },

  actions: [
    {
      id: 'create-task',
      label: { ro: 'Crează Task', en: 'Create Task' },
      handler: async (ctx: any, input: any) => {
        const { db, id, user } = ctx;
        const deal = await db.get('deal', id);
        if (!deal) throw new Error("Deal not found");

        const taskId = crypto.randomUUID();
        await db.create('task', {
          id: taskId,
          workspaceId: user.workspaceId || 'system',
          title: input.title || `Task for Deal: ${deal.title}`,
          description: input.description,
          status: 'todo',
          priority: 'medium',
          createdAt: new Date().toISOString()
        });

        return { success: true, taskId };
      }
    }
  ],
  
  menuConfig: {
    showInMainMenu: true,
    category: 'sales',
    icon: 'DollarSign',
    priority: 30
  }
};

export default deal;
