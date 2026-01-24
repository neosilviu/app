/**
 * REGISTRY SCHEMA - Lean database-only definitions
 * Enterprise Level 8
 * 
 * This file contains ONLY what the Brain needs to talk to D1.
 * NO labels, NO icons, NO UI layout.
 */

export const SCHEMA = {
  contact: {
    tableName: 'contact',
    primaryKey: 'id',
    fields: {
      id: { type: 'uuid' },
      workspaceId: { type: 'relation', relation: { target: 'workspace' } },
      name: { type: 'string', required: true },
      email: { type: 'string' },
      phone: { type: 'string' },
      status: { type: 'enum', defaultValue: 'lead' },
      role: { type: 'enum', defaultValue: 'guest' },
      createdAt: { type: 'datetime' },
      updatedAt: { type: 'datetime' }
    }
  },
  workspace: {
    tableName: 'workspace',
    fields: {
      id: { type: 'uuid' },
      name: { type: 'string', required: true },
      ownerId: { type: 'relation', relation: { target: 'contact' } }
    }
  },
  tag: {
    tableName: 'tag',
    fields: {
      id: { type: 'uuid' },
      name: { type: 'string', required: true },
      entityType: { type: 'enum', defaultValue: 'all' }
    }
  },
  file: {
    tableName: 'file',
    fields: {
      id: { type: 'uuid' },
      filename: { type: 'string', required: true },
      url: { type: 'string' }
    }
  },
  interaction: {
    tableName: 'interaction',
    fields: {
      id: { type: 'uuid' },
      contactId: { type: 'relation', relation: { target: 'contact' } },
      channel: { type: 'enum' },
      body: { type: 'text' }
    }
  },
  system_setting: {
    tableName: 'SYSTEM_SETTING',
    fields: {
      id: { type: 'uuid' },
      key: { type: 'string', required: true },
      value: { type: 'text' }
    }
  },
  audit_log: {
    tableName: 'audit_log',
    fields: {
      id: { type: 'uuid' },
      action: { type: 'string' },
      entityType: { type: 'string' },
      details: { type: 'text' }
    }
  },
  // Add other schemas as needed...
} as const;
