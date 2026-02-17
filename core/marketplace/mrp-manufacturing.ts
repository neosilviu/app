import { z } from 'zod';
import { BaseSchema, type EntityV3 } from '../schemas/base';

/**
 * MRP & MANUFACTURING - Entities
 */
const work_order: EntityV3<any> = {
  id: 'work_order',
  label: { ro: 'Comandă Lucru', en: 'Work Order' },
  labelPlural: { ro: 'Comenzi Lucru', en: 'Work Orders' },
  icon: 'Factory',
  tableName: 'mrp_work_order',
  displayField: 'product_name',

  // Marketplace Metadata
  solutionId: 'mrp-manufacturing',
  solutionTitle: { ro: 'MRP & Producție', en: 'MRP & Manufacturing' },
  description: { ro: 'Gestiune producție, Bill of Materials (BOM) și comenzi lucru.', en: 'Production management, Bill of Materials (BOM) and work orders.' },
  category: 'production',

  schema: z.object({
    ...BaseSchema,
    product_name: z.string()
      .min(1)
      .describe('ui:width=12;label={"ro": "Produs Final", "en": "Final Product"}'),
    
    quantity: z.number().optional()
      .describe('ui:width=6;label={"ro": "Cantitate Planificată", "en": "Planned Quantity"}'),
    
    start_date: z.string().optional()
      .describe('ui:type=date;width=6;label={"ro": "Data Start", "en": "Start Date"}'),
    
    status: z.enum(['draft', 'released', 'in_progress', 'completed'])
      .default('draft')
      .describe('ui:width=6;label={"ro": "Status", "en": "Status"}'),
  }),

  features: ['audit', 'timestamps', 'soft-delete'],
};

export default [work_order];
