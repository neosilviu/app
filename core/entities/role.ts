import { z } from 'zod';
import { BaseSchema, type EntityV3 } from '../schemas/base';

/**
 * ROLE ENTITY (v3 Modular)
 * RBAC system roles.
 */
export const role: EntityV3<any> = {
  id: 'role',
  label: { ro: 'Rol', en: 'Role' },
  labelPlural: { ro: 'Roluri', en: 'Roles' },
  icon: 'Shield',
  tableName: 'role',
  displayField: 'name',
  isSystem: true,
  isGlobal: true,
  baseline: true,

  // Marketplace Solution Metadata
  solutionId: 'rbac-security-module',
  solutionTitle: { ro: 'Securitate RBAC', en: 'RBAC Security Module' },
  description: { 
    ro: 'Definirea și managementul rolurilor de acces și permisiunilor.', 
    en: 'Definition and management of access roles and permissions.' 
  },
  category: 'security',
  priority: 15,
  
  schema: z.object({
    ...BaseSchema,
    name: z.string()
      .describe('ui:width=6;icon=Type;label={"ro": "Nume Rol", "en": "Role Name"};searchable=true;section={"ro": "General", "en": "General"}'),
    
    color: z.string().default('#4f46e5')
      .describe('ui:width=6;type=color;icon=Palette;label={"ro": "Culoare", "en": "Color"};section={"ro": "General", "en": "General"}'),
    
    description: z.string().optional()
      .describe('ui:width=12;type=textarea;label={"ro": "Descriere", "en": "Description"};section={"ro": "General", "en": "General"}'),
    
    permission: z.any().optional()
      .describe('ui:width=12;type=json;icon=Lock;label={"ro": "Permisiuni (JSON)", "en": "Permissions (JSON)"};section={"ro": "Configurare", "en": "Configuration"}'),
  }),

  features: ['audit', 'soft-delete'],

  menuConfig: {
    showInMainMenu: true,
    category: 'system_admin',
    icon: 'Shield',
    priority: 95
  }
};

