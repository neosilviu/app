import { z } from 'zod';
import { BaseSchema, type EntityV3 } from '../schemas/base';

/**
 * SAAS BILLING & SUBSCRIPTIONS - Entities
 */
const saas_subscription: EntityV3<any> = {
  id: 'saas_subscription',
  label: { ro: 'Abonament SaaS', en: 'SaaS Subscription' },
  labelPlural: { ro: 'Abonamente SaaS', en: 'SaaS Subscriptions' },
  icon: 'CreditCard',
  tableName: 'saas_subscription',
  displayField: 'plan_name',

  // Marketplace Metadata
  solutionId: 'saas-billing-sim',
  solutionTitle: { ro: 'SaaS Billing & Subscriptions', en: 'SaaS Billing & Subscriptions' },
  description: { ro: 'Management abonamente SaaS, facturare și status plăți.', en: 'SaaS subscription management, invoicing and payment status.' },
  category: 'finance',

  schema: z.object({
    ...BaseSchema,
    contactId: z.string()
      .describe('ui:type=relation;target=contact;label={"ro": "Client", "en": "Client"}'),
    
    plan_name: z.enum(['free', 'basic', 'pro', 'enterprise'])
      .describe('ui:width=6;label={"ro": "Plan", "en": "Plan"}'),
    
    billing_interval: z.enum(['monthly', 'yearly'])
      .default('monthly')
      .describe('ui:width=6;label={"ro": "Interval", "en": "Interval"}'),
    
    next_billing: z.string().optional()
      .describe('ui:type=date;width=12;label={"ro": "Următoarea Factură", "en": "Next Invoice"}'),
  }),

  features: ['audit', 'timestamps', 'soft-delete'],
};

export default [saas_subscription];
