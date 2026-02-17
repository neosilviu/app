import { z } from 'zod';
import { BaseSchema, type EntityV3 } from '../schemas/base';

/**
 * HR MANAGEMENT MODULE - Marketplace V3
 */
export const hr_management: EntityV3<any> = {
  id: 'hr-management',
  label: { ro: 'Resurse Umane', en: 'HR Management' },
  labelPlural: { ro: 'Resurse Umane', en: 'HR Management' },
  icon: 'Users2',
  tableName: 'hr_solution',
  displayField: 'id',

  // Marketplace Metadata
  solutionId: 'hr-management',
  solutionTitle: { ro: 'Resurse Umane & Salariați', en: 'HR & Employees' },
  description: { ro: 'Dosare angajați, contracte, concedii și evaluări.', en: 'Employee files, contracts, leave management and evaluations.' },
  category: 'hr',

  schema: z.object({}), // Placeholder
  features: [],
  dependencies: ['contact'],

  // Enterprise Level 10: Extension Protocol
  extensions: {
    contact: {
      schema: {
        employeeId: z.string().optional()
          .describe('ui:width=6;label={"ro": "Marca / ID Angajat", "en": "Marca / ID Angajat"}'),
        
        department: z.enum(['management', 'sales', 'it', 'hr', 'ops', 'marketing'])
          .optional()
          .describe('ui:width=6;label={"ro": "Departament", "en": "Departament"}'),
        
        hireDate: z.date().optional()
          .describe('ui:width=6;label={"ro": "Data Angajării", "en": "Data Angajării"}'),
        
        salary: z.number().optional()
          .describe('ui:width=6;type=currency;label={"ro": "Salariu Brut", "en": "Salariu Brut"}'),
      }
    }
  }
};

export default hr_management;
