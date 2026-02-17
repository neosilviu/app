import { describe, it, expect } from 'vitest';
import { AVAILABLE_V3_ENTITIES } from './index';

/**
 * MASTER AUDITOR (Level 10)
 * Deep structural validation for all modular entities.
 */
describe('Modular Entity Audit (Level 10 Master Loop)', () => {
  const entities = Object.entries(AVAILABLE_V3_ENTITIES);
  
  it('should have at least one entity discovered', () => {
    expect(entities.length).toBeGreaterThan(0);
  });

  entities.forEach(([id, entity]: [string, any]) => {
    describe(`Entity: ${id}`, () => {
      
      it('SSOT: Basic metadata must be complete and valid', () => {
        expect(entity.id).toBe(id);
        expect(entity.label).toBeDefined();
        expect(entity.label.ro).toBeDefined();
        expect(entity.icon).toBeDefined();
        expect(entity.tableName).toBeDefined();
      });

      it('CONVENTION: Identifiers must be singular', () => {
        const pluralSuffixes = ['s', 'es'];
        const isLikelyPlural = (s: string) => pluralSuffixes.some(suffix => s.endsWith(suffix)) && !['status', 'process', 'address', 'bus', 'glass', 'leads'].includes(s);
        
        // 'leads' is acceptable if it's the domain term, but we prefer 'lead'
        expect(isLikelyPlural(entity.id), `ID '${entity.id}' should be singular.`).toBe(false);
        expect(isLikelyPlural(entity.tableName), `TableName '${entity.tableName}' should be singular.`).toBe(false);
      });

      it('SCHEMA: Must adhere to structural inheritance (BaseSchema)', () => {
        const schema = entity.schema;
        expect(schema, 'Entity must define a Zod schema.').toBeDefined();
        
        // Check for required base fields in the schema shape
        const getShape = (s: any): any => {
          if (!s || !s._def) return {};
          if (s.shape) return s.shape;
          const def = s._def;
          if (def.shape) return typeof def.shape === 'function' ? def.shape() : def.shape;
          if (def.schema) return getShape(def.schema);
          if (def.innerType) return getShape(def.innerType);
          return {};
        };
        
        const shape = getShape(schema);
        const requiredBaseFields = ['id', 'workspaceId', 'createdAt', 'updatedAt'];
        
        requiredBaseFields.forEach(field => {
          expect(shape[field], `Entity '${id}' schema is missing base field: ${field}`).toBeDefined();
        });

        // If displayField is set, it must exist in schema
        if (entity.displayField && entity.displayField !== 'id') {
          expect(shape[entity.displayField], `displayField '${entity.displayField}' not found in schema.`).toBeDefined();
        }
      });

      it('DISCOVERY: Metadata (.describe) must be complete for all UI fields', () => {
        const getShape = (s: any): any => {
          if (!s || !s._def) return {};
          if (s.shape) return s.shape;
          const def = s._def;
          if (def.shape) return typeof def.shape === 'function' ? def.shape() : def.shape;
          if (def.schema) return getShape(def.schema);
          if (def.innerType) return getShape(def.innerType);
          return {};
        };
        
        const shape = getShape(entity.schema);
        
        Object.entries(shape).forEach(([fieldName, field]: [string, any]) => {
          const isSystemField = ['id', 'workspaceId', 'createdAt', 'updatedAt', 'deletedAt', 'createdBy', 'updatedBy'].includes(fieldName);
          
          // Field description from Zod
          const description = field.description || field._def.description;
          
          if (!isSystemField) {
            expect(description, `Field '${fieldName}' in '${id}' must have a .describe() string.`).toBeDefined();
            
            const isHidden = description.includes('ui:hidden=true') || description.includes('hidden=true');
            if (!isHidden) {
              expect(description, `Field '${fieldName}' in '${id}' .describe() must contain 'label=' (or be hidden)`).toContain('label=');
            }
          }
          
          if (description) {
            // Verify format key=value;key=value
            const parts = description.split(';');
            parts.forEach((p: string) => {
              if (p.trim()) {
                expect(p, `Invalid metadata part '${p}' in '${id}.${fieldName}'. Format must be key=value`).toContain('=');
              }
            });
          }
        });
      });

      it('ACTIONS: Modular actions must be valid', () => {
        const actions = entity.actions || [];
        actions.forEach((action: any) => {
          expect(action.id, `Action in '${id}' is missing ID.`).toBeDefined();
          expect(action.label, `Action '${action.id}' in '${id}' is missing label.`).toBeDefined();
          expect(typeof action.handler, `Action '${action.id}' in '${id}' must be a function.`).toBe('function');
        });
      });

      it('UI: Menu configuration sanity', () => {
        if (entity.menuConfig) {
          const m = entity.menuConfig;
          if (m.showInMainMenu !== false) {
            expect(m.icon || entity.icon, `Entity '${id}' shown in menu must have an icon.`).toBeDefined();
          }
        }
      });
    });
  });
});
