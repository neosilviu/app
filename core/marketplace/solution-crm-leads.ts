import { z } from 'zod';
import { BaseSchema, type EntityV3 } from '../schemas/base';

/**
 * CRM LEADS MODULE - Marketplace V3
 * Captură și calificare lead-uri cu suport AI.
 */
export const lead: EntityV3<any> = {
  id: 'lead',
  label: { ro: 'Lead', en: 'Lead' },
  labelPlural: { ro: 'Leads', en: 'Leads' },
  icon: 'Target',
  tableName: 'lead',
  displayField: 'title',

  // Marketplace Metadata
  solutionTitle: { ro: 'Gestiune Lead-uri', en: 'Lead Management' },
  description: { ro: 'Colectare, calificare și conversie lead-uri folosind AI Magic Fill.', en: 'Collect, qualify and convert leads using AI Magic Fill.' },
  category: 'sales',

  schema: z.object({
    ...BaseSchema,
    contactId: z.string().optional().describe('ui:type=relation;relation=contact.name;label={"ro": "Contact", "en": "Contact"}'),
    title: z.string().describe('ui:width=12;searchable=true;label={"ro": "Titlu / Scop", "en": "Title / Purpose"}'),
    description: z.string().optional().describe('ui:width=12;type=textarea;label={"ro": "Descriere", "en": "Description"}'),
    source: z.string().optional().describe('ui:width=6;label={"ro": "Sursă", "en": "Source"}'),
    status: z.enum(['new', 'contacted', 'qualified', 'unqualified']).default('new')
      .describe('ui:width=6;label={"ro": "Status", "en": "Status"}'),
    priority: z.enum(['low', 'medium', 'high', 'critical']).default('medium').optional()
      .describe('ui:width=6;label={"ro": "Prioritate", "en": "Priority"}'),
    industry: z.string().optional().describe('ui:width=6;label={"ro": "Industrie", "en": "Industry"}'),
    estimatedValue: z.number().optional().describe('ui:width=6;type=number;label={"ro": "Valoare Estimată", "en": "Estimated Value"}'),
  }),

  features: ['timestamps', 'audit', 'soft-delete'],
  dependencies: ['contact', 'deal'],

  // Enterprise Level 10: Extension Protocol
  extensions: {
    contact: {
      schema: {
        status: z.enum(['lead', 'customer', 'partner', 'vendor'])
          .default('lead')
          .describe('ui:width=6;label={"ro": "Status", "en": "Status"}'),
      },
      flowRules: {
        lead: {
          nextStates: ['customer', 'archived'],
          label: { ro: 'Lead → Client', en: 'Lead → Customer' },
          requiresFields: ['email', 'name'],
          action: 'convert_to_customer',
          icon: 'ArrowRight'
        },
        customer: {
          nextStates: ['partner', 'archived'],
          label: { ro: 'Client → Partener', en: 'Customer → Partner' },
          requiresFields: ['email', 'phone'],
          action: 'upgrade_to_partner',
          icon: 'ArrowRight'
        },
        partner: {
          nextStates: ['archived'],
          label: { ro: 'Partener → Arhivat', en: 'Partner → Archived' },
          requiresFields: [],
          action: 'archive_partner',
          icon: 'Archive'
        },
        archived: {
          nextStates: ['lead'],
          label: { ro: 'Arhivat → Reactivare', en: 'Archived → Reactivate' },
          requiresFields: [],
          action: 'reactivate',
          icon: 'RotateCcw'
        }
      }
    }
  },

  actions: [
    {
      id: 'magic-fill',
      label: { ro: 'Magic Fill (AI)', en: 'Magic Fill (AI)' },
      description: 'Auto-completează câmpurile lipsă folosind inteligența artificială.',
      icon: 'Zap',
      handler: async (ctx: any, input: any) => {
        const { db, env, id, registry, AiService } = ctx;
        const lead = await db.from('lead').where('id', id).first();
        if (!lead) throw new Error("Lead not found");

        const ai = new AiService(env, { ai_config: registry.AI_CONFIG, registry, db: db.rawBinding || db });
        
        const context = {
          entity: 'lead',
          title: lead.title,
          description: lead.description,
          currentData: lead
        };

        const systemPrompt = `Ești un asistent AI expert în vânzări. Analizează datele lead-ului și completează câmpurile lipsă (description, industry, priority, estimatedValue).
        Răspunde DOAR cu un obiect JSON curat.`;

        const response = await ai.chat(`Analizează acest lead: ${JSON.stringify(context)}`, [], {
          systemPrompt,
          response_mime_type: 'application/json'
        });

        const suggestedBody = (ai as any).engine.extractJson(response);
        
        if (suggestedBody && Object.keys(suggestedBody).length > 0) {
          await db.from('lead').where('id', id).update(suggestedBody);
          return { message: { ro: "Lead îmbogățit!", en: "Lead enriched!" }, refresh: true };
        }
        return { message: "No changes needed." };
      }
    },
    {
      id: 'convert-to-deal',
      label: { ro: 'Convertește în Oportunitate', en: 'Convert to Deal' },
      handler: async (ctx: any, input: any) => {
        const { db, id, user } = ctx;
        const lead = await db.get('lead', id);
        if (!lead) throw new Error("Lead not found");

        const dealId = crypto.randomUUID();
        await db.create('deal', {
          id: dealId,
          workspaceId: user.workspaceId || 'system',
          title: lead.title,
          contactId: lead.contactId,
          value: lead.estimatedValue,
          status: 'open',
          createdAt: new Date().toISOString()
        });

        await db.update('lead', id, { status: 'qualified', updatedAt: new Date().toISOString() });
        return { success: true, dealId };
      }
    }
  ],

  menuConfig: {
    showInMainMenu: true,
    category: 'sales',
    icon: 'Target',
    priority: 25
  }
};

export default lead;
