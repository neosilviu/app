import { z } from 'zod';
import { BaseSchema, type EntityV3 } from '../schemas/base';

/**
 * AUTOMOTIVE SERVICE MODULE - Marketplace V3
 */
export const automotive_garage: EntityV3<any> = {
  id: 'automotive-garage',
  label: { ro: 'Service Auto', en: 'Auto Service' },
  labelPlural: { ro: 'Service Auto', en: 'Auto Service' },
  icon: 'Wrench',
  tableName: 'service_order',
  displayField: 'vehiclePlate',

  // Marketplace Metadata
  solutionId: 'automotive-garage',
  solutionTitle: { ro: 'Service Auto (Garage)', en: 'Automotive Service (Garage)' },
  description: { ro: 'Gestiune programări service, vehicule și istoric reparații.', en: 'Vehicle service appointments, history and repair logs.' },
  category: 'services',

  schema: z.object({
    ...BaseSchema,
    vehiclePlate: z.string()
      .describe('ui:width=4;label={"ro": "Nr. Înmatriculare", "en": "License Plate"}'),
    
    vehicleVin: z.string().optional()
      .describe('ui:width=8;label={"ro": "Serie Șasiu (VIN)", "en": "Chassis Number (VIN)"}'),
    
    contactId: z.string()
      .describe('ui:type=relation;target=contact;label={"ro": "Proprietar / Client", "en": "Owner / Client"}'),
    
    status: z.enum(['pending', 'in_repair', 'ready', 'picked_up'])
      .default('pending')
      .describe('ui:width=4;label={"ro": "Status Reparație", "en": "Repair Status"}'),
    
    totalCost: z.number().optional()
      .describe('ui:type=currency;width=4;label={"ro": "Cost Estimativ", "en": "Estimated Cost"}'),

    workDetails: z.string().optional()
      .describe('ui:type=textarea;width=12;label={"ro": "Detalii Lucrare", "en": "Work Details"}'),
  }),

  features: ['audit', 'timestamps', 'comments'],
  dependencies: ['contact'],

  extensions: {
    contact: {
      schema: {
        isCarOwner: z.boolean().default(false).describe('ui:hidden=true'),
        fleetSize: z.number().default(0).describe('ui:width=6;label={"ro": "Număr Vehicule", "en": "Vehicle Count"}'),
      }
    }
  }
};

export default automotive_garage;
