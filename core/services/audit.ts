/**
 * AUDIT SERVICE (v3 Core)
 * Single point of truth for logging changes
 */
export const AuditService = {
  async log(ctx: any, { entity, id, action, before, after }: any) {
    console.log(`[AUDIT] ${entity}:${id} - ${action}`);
    // Aici va veni logica de scriere in audit_log tabel
  },
  
  async getHistory(ctx: any, entity: string, id: string) {
    // Aici va veni logica de recuperare a snapshot-urilor
    return [];
  }
};
