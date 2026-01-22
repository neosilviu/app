import { DatabaseDriver } from '../db/driver';
import { v4 as uuidv4 } from 'uuid';

export interface AuditLogParams {
  entityType: string;
  entityId: string;
  action: 'CREATE' | 'UPDATE' | 'DELETE' | 'LOGIN' | 'LOGOUT' | 'EXPORT' | 'IMPORT';
  actorId: string; // User ID or 'SYSTEM'
  changes?: Record<string, { old: any, new: any }>;
  metadata?: any;
}

export class AuditService {
  private db: DatabaseDriver;

  constructor() {
    this.db = DatabaseDriver.getInstance();
  }

  /**
   * Record an action in the audit log
   */
  public async log(params: AuditLogParams): Promise<void> {
    const { entityType, entityId, action, actorId, changes, metadata } = params;
    
    const before = changes?.old ? JSON.stringify(changes.old) : null;
    const after = changes?.new ? JSON.stringify(changes.new) : null;
    const meta = metadata ? JSON.stringify(metadata) : null;

    // Assuming table 'audit_log' exists. If not, it should be part of the core definitions.
    await this.db.run(`
      INSERT INTO audit_log (
        id, 
        entity_type, 
        entity_id, 
        action, 
        actor_id, 
        snapshot_before, 
        snapshot_after,
        metadata_json, 
        createdAt
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    `, [
      uuidv4(),
      entityType,
      entityId,
      action,
      actorId,
      before,
      after,
      meta
    ]);
  }
}

