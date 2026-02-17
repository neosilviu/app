import { describe, it, expect } from 'vitest';
import { REGISTRY_BASELINE } from '../../registry-baseline';
import { getV3EntitiesAsLegacy } from '../entities';

describe('Auth Entity Schema Sanity', () => {
  const v3Entities = getV3EntitiesAsLegacy();
  
  it('should have workspaceId in user, account, session, verification and system_error entities', () => {
    const criticalEntities = ['user', 'account', 'session', 'system_error', 'verification'];
    
    criticalEntities.forEach(entityId => {
      const entity = v3Entities[entityId];
      expect(entity, `Entity ${entityId} should be defined in registry`).toBeDefined();
      
      const fields = entity.fields || {};
      const workspaceIdField = fields.workspaceId;
      
      expect(workspaceIdField, `Entity ${entityId} should have workspaceId field`).toBeDefined();
    });
  });

  it('should not have required=true for workspaceId in system entities to prevent boot crashes', () => {
    // Level 9 Strategy: workspaceId should be nullable or have a default at DB level,
    // so the bridge should not mark it as required=true for the UI/DB generator
    const criticalEntities = ['user', 'account', 'session', 'system_error', 'workspace_user', 'verification'];
    
    criticalEntities.forEach(entityId => {
      const entity = v3Entities[entityId];
      const fields = entity.fields || {};
      const workspaceIdField = fields.workspaceId;
      
      if (workspaceIdField) {
        expect(workspaceIdField.required).toBeFalsy();
      }
    });
  });
});
