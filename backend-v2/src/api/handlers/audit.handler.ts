import { Router } from 'express';
import { DatabaseDriver } from '../../db/driver';

const router = Router();
const db = DatabaseDriver.getInstance();

router.get('/logs', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit as string) || 50;
    const offset = parseInt(req.query.offset as string) || 0;
    
    const logs = await db.query(
      'SELECT * FROM audit_log ORDER BY createdAt DESC LIMIT ? OFFSET ?', 
      [limit, offset]
    );
    res.json({ success: true, count: logs.length, data: logs });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/undo/:logId', async (req, res) => {
  // Advanced feature: Revert changes based on snapshot_before
  // For now, simpler implementation log
  res.status(501).json({ success: false, message: 'Undo engine not yet fully implemented' });
});

export const auditRouter = router;

