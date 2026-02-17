import { z } from 'zod';
import { BaseSchema, type EntityV3 } from '../schemas/base';

/**
 * ACCOUNTING & CASH BOOK MODULE - Marketplace V3
 */
export const accounting_cash_book: EntityV3<any> = {
  id: 'accounting-cash-book',
  label: { ro: 'Contabilitate', en: 'Accounting' },
  labelPlural: { ro: 'Contabilitate', en: 'Accounting' },
  icon: 'Wallet',
  tableName: 'budget_item',
  displayField: 'description',

  // Marketplace Metadata
  solutionId: 'accounting-cash-book',
  solutionTitle: { ro: 'Contabilitate & Registru Casă', en: 'Accounting & Cash Book' },
  description: { ro: 'Gestiune bugete, venituri, cheltuieli și investiții cu documente atașate.', en: 'Budget management, income, expenses, and investments with attachments.' },
  category: 'finance',

  schema: z.object({
    ...BaseSchema,
    date: z.date()
      .describe('ui:width=4;label={"ro": "Dată Tranzacție", "en": "Date Tranzacție"}'),
    
    type: z.enum(['income', 'expense', 'investment'])
      .describe('ui:width=4;label={"ro": "Tip", "en": "Type"}'),
    
    amount: z.number()
      .describe('ui:width=4;type=currency;label={"ro": "Sumă", "en": "Sumă"}'),
    
    currency: z.enum(['RON', 'EUR', 'USD']).default('RON')
      .describe('ui:width=4;label={"ro": "Monedă", "en": "Currency"}'),

    description: z.string()
      .describe('ui:width=8;label={"ro": "Descriere", "en": "Description"}'),
    
    category: z.string().optional()
      .describe('ui:width=6;label={"ro": "Categorie", "en": "Category"}'),
    
    contactId: z.string().optional()
      .describe('ui:type=relation;target=contact;label={"ro": "Sursă / Destinatar", "en": "Source / Destinatar"}'),

    metadata: z.any().optional().describe('ui:type=json;label={"ro": "Metadate Document", "en": "Metadate Document"}'),
  }),

  features: ['audit', 'timestamps', 'files'],
  dependencies: ['contact'],

  extensions: {
    contact: {
      schema: {
        totalRevenue: z.number().default(0)
          .describe('ui:width=6;type=currency;label={"ro": "Total Venituri (lifetime)", "en": "Total Incomes (lifetime)"}'),
        balance: z.number().default(0)
          .describe('ui:width=6;type=currency;label={"ro": "Sold Curent", "en": "Balance Curent"}'),
      }
    }
  }
};

export default accounting_cash_book;
