import { z } from 'zod';
import { BaseSchema, type EntityV3 } from '../schemas/base';

/**
 * FLEET MANAGEMENT - Entities
 */
const vehicle: EntityV3<any> = {
  id: 'vehicle',
  label: { ro: 'Vehicul', en: 'Vehicle' },
  labelPlural: { ro: 'Vehicule', en: 'Vehicles' },
  icon: 'Car',
  tableName: 'vehicle',
  displayField: 'plate_number',

  // Marketplace Metadata
  solutionId: 'fleet-management',
  solutionTitle: { ro: 'Flotă Auto', en: 'Fleet Management' },
  description: { ro: 'Monitorizare vehicule, asigurări, rca, km și mentenanță.', en: 'Vehicle monitoring, insurance, RCA, mileage and maintenance.' },
  category: 'operations',

  schema: z.object({
    ...BaseSchema,
    plate_number: z.string()
      .min(1)
      .describe('ui:width=12;label={"ro": "Nr. Înmatriculare", "en": "License Plate"}'),
    
    model: z.string().optional()
      .describe('ui:width=6;label={"ro": "Marcă/Model", "en": "Marcă/Model"}'),
    
    year: z.number().optional()
      .describe('ui:width=6;label={"ro": "An Fabricație", "en": "An Fabricație"}'),
    
    vin: z.string().optional()
      .describe('ui:width=12;label={"ro": "Serie Șasiu", "en": "Serial Șasiu"}'),
  }),

  features: ['audit', 'timestamps', 'soft-delete'],

  extensions: {
    contact: {
      schema: {
        driverLicense: z.string().optional().describe('ui:width=6;label={"ro": "Permis Conducere", "en": "Permis Conducere"}'),
        assignedVehicleId: z.string().optional().describe('ui:type=relation;target=vehicle;label={"ro": "Vehicul Alocat", "en": "Vehicul Alocat"}'),
      }
    }
  }
};

export default [vehicle];
