import { z } from 'zod';
import { BaseSchema, type EntityV3 } from '../schemas/base';

/**
 * ENTITY RELATION MANY (Polymorphic v3 Modular)
 */
export const entity_relation_many: EntityV3<any> = {
  id: 'entity_relation_many',
  label: { ro: 'Relație Polimorfică Many', en: 'Polymorphic Relation Many' },
  labelPlural: { ro: 'Relații Polimorfice Many', en: 'Polymorphic Relations Many' },
  icon: 'Share2',
  tableName: 'entity_relation_many',
  displayField: 'targetId',
  isSystem: true,
  baseline: true,

  indexes: [
    'sourceType, fieldName, sourceId',
    'targetType, targetId'
  ],

  // Marketplace Solution Metadata
  solutionId: 'universal-relation-engine',
  solutionTitle: { ro: 'Motor Relații Universale', en: 'Universal Relation Engine' },
  description: { 
    ro: 'Gestionează legături complexe many-to-many între orice entități din sistem.', 
    en: 'Manages complex many-to-many links between any entities in the system.' 
  },
  category: 'system',
  priority: 5,

  schema: z.object({
    ...BaseSchema,
    sourceType: z.string()
      .describe('ui:width=4;icon=LogIn;label={"ro": "Tip Sursă", "en": "Source Type"}'),
    
    sourceId: z.string()
      .describe('ui:width=4;icon=Fingerprint;label={"ro": "ID Sursă", "en": "Source ID"}'),
    
    targetType: z.string()
      .describe('ui:width=4;icon=LogOut;label={"ro": "Tip Țintă", "en": "Target Type"}'),
    
    targetId: z.string()
      .describe('ui:width=4;icon=ExternalLink;label={"ro": "ID Țintă", "en": "Target ID"}'),
    
    fieldName: z.string()
      .describe('ui:width=4;icon=Tag;label={"ro": "Nume Câmp", "en": "Field Name"}'),
  }),


  features: ['deletable', 'timestamps'],
};
