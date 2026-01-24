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
      ownerId: { type: 'relation', relation: { target: 'contact' } },
      settings: { type: 'text' },
      logo: { type: 'string' },
      active: { type: 'boolean', defaultValue: true }
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
  system_setting: {
    tableName: 'SYSTEM_SETTING',
    fields: {
      id: { type: 'uuid' },
      namespace: { type: 'string', required: true },
      key: { type: 'string', required: true },
      value: { type: 'text' },
      dataType: { type: 'enum', defaultValue: 'string' },
      description: { type: 'text' }
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
  user: {
    tableName: 'user',
    fields: {
      id: { type: 'uuid' },
      name: { type: 'string', required: true },
      email: { type: 'string', required: true, unique: true },
      emailVerified: { type: 'boolean', defaultValue: false },
      image: { type: 'string' },
      role: { type: 'string' },
      workspaceId: { type: 'string' },
      active: { type: 'boolean', defaultValue: true }
    }
  },
  session: {
    tableName: 'session',
    fields: {
      id: { type: 'uuid' },
      userId: { type: 'string', required: true },
      token: { type: 'string', required: true, unique: true },
      expiresAt: { type: 'datetime', required: true },
      ipAddress: { type: 'string' },
      userAgent: { type: 'string' }
    }
  },
  account: {
    tableName: 'account',
    fields: {
      id: { type: 'uuid' },
      userId: { type: 'string', required: true },
      providerId: { type: 'string', required: true },
      accountId: { type: 'string', required: true },
      accessToken: { type: 'string' },
      refreshToken: { type: 'string' },
      idToken: { type: 'string' },
      accessTokenExpiresAt: { type: 'datetime' },
      refreshTokenExpiresAt: { type: 'datetime' },
      scope: { type: 'string' },
      password: { type: 'password' }
    }
  },
  role: {
    tableName: 'role',
    fields: {
      id: { type: 'uuid' },
      name: { type: 'string', required: true },
      color: { type: 'string' },
      description: { type: 'text' },
      permission: { type: 'json' }
    }
  },
  workspace_user: {
    tableName: 'workspace_user',
    fields: {
      id: { type: 'uuid' },
      workspaceId: { type: 'string' },
      userId: { type: 'string' },
      role: { type: 'string' }
    }
  },
  workspace_invitation: {
    tableName: 'invitation',
    fields: {
      id: { type: 'uuid' },
      workspaceId: { type: 'string' },
      email: { type: 'string', required: true },
      role: { type: 'string' },
      token: { type: 'string' },
      expiresAt: { type: 'datetime' },
      status: { type: 'enum', defaultValue: 'pending' }
    }
  },
  _ai_prompt: {
    tableName: '_ai_prompt',
    fields: {
      id: { type: 'uuid' },
      name: { type: 'string', required: true, unique: true },
      systemPrompt: { type: 'text' },
      userPromptTemplate: { type: 'text' },
      model: { type: 'string' },
      inputContext: { type: 'text' },
      outputField: { type: 'string' },
      workspaceId: { type: 'string' },
      category: { type: 'string' },
      isLocked: { type: 'boolean' }
    }
  },
  entity_definition: {
    tableName: 'entity_definition',
    fields: {
      id: { type: 'uuid' },
      name: { type: 'string', required: true },
      label: { type: 'string' },
      tableName: { type: 'string' },
      fields: { type: 'json' }
    }
  },
  task: {
    tableName: 'task',
    fields: {
      id: { type: 'uuid', primaryKey: true },
      workspaceId: { type: 'relation', relation: { target: 'workspace' } },
      contactId: { type: 'relation', relation: { target: 'contact' } },
      title: { type: 'string', required: true },
      description: { type: 'text' },
      status: { type: 'enum', defaultValue: 'todo' },
      priority: { type: 'enum', defaultValue: 'medium' },
      dueDate: { type: 'datetime' },
      assignedTo: { type: 'relation', relation: { target: 'contact' } },
      createdAt: { type: 'datetime' }
    }
  },
  deal: {
    tableName: 'deal',
    fields: {
      id: { type: 'uuid', primaryKey: true },
      workspaceId: { type: 'relation', relation: { target: 'workspace' } },
      contactId: { type: 'relation', relation: { target: 'contact' } },
      title: { type: 'string', required: true },
      value: { type: 'currency' },
      currency: { type: 'enum', defaultValue: 'RON' },
      status: { type: 'enum', defaultValue: 'open' },
      expectedCloseDate: { type: 'date' },
      createdAt: { type: 'datetime' }
    }
  },
  notification: {
    tableName: 'notification',
    fields: {
      id: { type: 'uuid', primaryKey: true },
      workspaceId: { type: 'relation', relation: { target: 'workspace' } },
      userId: { type: 'string' },
      title: { type: 'string', required: true },
      body: { type: 'text' },
      type: { type: 'enum', defaultValue: 'info' },
      status: { type: 'enum', defaultValue: 'unread' },
      createdAt: { type: 'datetime' }
    }
  },
  lead: {
    tableName: 'lead',
    fields: {
      id: { type: 'uuid', primaryKey: true },
      workspaceId: { type: 'relation', relation: { target: 'workspace' } },
      contactId: { type: 'relation', relation: { target: 'contact' } },
      title: { type: 'string', required: true },
      source: { type: 'string' },
      status: { type: 'enum', defaultValue: 'new' },
      createdAt: { type: 'datetime' }
    }
  },
  bug_report: {
    tableName: 'bug_report',
    fields: {
      id: { type: 'uuid', primaryKey: true },
      workspaceId: { type: 'relation', relation: { target: 'workspace' } },
      userId: { type: 'relation', relation: { target: 'user' } },
      title: { type: 'string', required: true },
      description: { type: 'text' },
      severity: { type: 'enum' },
      status: { type: 'enum', defaultValue: 'open' },
      createdAt: { type: 'datetime' }
    }
  },
  changelog: {
    tableName: 'changelog',
    fields: {
      id: { type: 'uuid', primaryKey: true },
      workspaceId: { type: 'relation', relation: { target: 'workspace' } },
      module: { type: 'string' },
      version: { type: 'string', required: true },
      details: { type: 'text' },
      createdAt: { type: 'datetime' }
    }
  },
  collection: {
    tableName: 'collection',
    fields: {
      id: { type: 'uuid', primaryKey: true },
      name: { type: 'string', required: true },
      slug: { type: 'string' },
      description: { type: 'text' },
      color: { type: 'string' },
      icon: { type: 'string' },
      createdAt: { type: 'datetime' },
      updatedAt: { type: 'datetime' }
    }
  },
  entity_attachment: {
    tableName: 'entity_attachment',
    fields: {
      id: { type: 'uuid', primaryKey: true },
      workspaceId: { type: 'relation', relation: { target: 'workspace' } },
      fileId: { type: 'relation', relation: { target: 'file' }, required: true },
      entityType: { type: 'string', required: true },
      entityId: { type: 'string', required: true },
      category: { type: 'string' },
      createdAt: { type: 'datetime' }
    }
  },
  workspace_setting: {
    tableName: 'workspace_setting',
    fields: {
      id: { type: 'uuid', primaryKey: true },
      workspaceId: { type: 'relation', relation: { target: 'workspace' } },
      category: { type: 'string' },
      setting: { type: 'json' },
      workspaceName: { type: 'string' },
      timezone: { type: 'string' },
      logoUrl: { type: 'string' },
      language: { type: 'string' },
      ai: { type: 'json' }
    }
  },
  entity_note: {
    tableName: 'entity_note',
    fields: {
      id: { type: 'uuid', primaryKey: true },
      workspaceId: { type: 'relation', relation: { target: 'workspace' } },
      entityType: { type: 'string', required: true },
      entityId: { type: 'string', required: true },
      content: { type: 'text', required: true },
      authorId: { type: 'relation', relation: { target: 'contact' } },
      createdAt: { type: 'datetime' }
    }
  },
  tag_assignment: {
    tableName: 'tag_assignment',
    fields: {
      id: { type: 'uuid', primaryKey: true },
      workspaceId: { type: 'relation', relation: { target: 'workspace' } },
      tagId: { type: 'relation', relation: { target: 'tag' } },
      entityType: { type: 'string' },
      entityId: { type: 'string' }
    }
  },
  interaction: {
    tableName: 'interaction',
    fields: {
      id: { type: 'uuid', primaryKey: true },
      workspaceId: { type: 'relation', relation: { target: 'workspace' } },
      contactId: { type: 'relation', relation: { target: 'contact' } },
      channel: { type: 'enum' },
      type: { type: 'enum' },
      subject: { type: 'string' },
      body: { type: 'text' },
      status: { type: 'enum', defaultValue: 'unread' },
      metadata: { type: 'json' },
      createdAt: { type: 'datetime' }
    }
  },
  verification: {
    tableName: 'verification',
    fields: {
      id: { type: 'uuid', primaryKey: true },
      identifier: { type: 'string', required: true },
      value: { type: 'string', required: true },
      expiresAt: { type: 'datetime', required: true }
    }
  },
  config_version: {
    tableName: 'config_version',
    fields: {
      id: { type: 'uuid', primaryKey: true },
      namespace: { type: 'string', required: true },
      key: { type: 'string', required: true },
      configJson: { type: 'json' },
      changedBy: { type: 'string' },
      description: { type: 'string' }
    }
  },
  // Add other schemas as needed...
} as const;
