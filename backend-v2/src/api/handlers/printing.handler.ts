import { Router } from 'express';
import crypto from 'crypto';
import { DatabaseDriver } from '../../db/driver';
import { RegistryManager } from '../../core/registry';

const router = Router();
const db = DatabaseDriver.getInstance();

/**
 * GET /api/printing/sessions
 * Retrieve saved printing sessions
 */
router.get('/sessions', async (req, res) => {
  try {
    const registry = RegistryManager.getInstance().get();
    const limit = registry.system?.printing_sessions_limit || 50;

    const result = await db.query(
      `SELECT * FROM printing_session ORDER BY createdAt DESC LIMIT ?`,
      [limit]
    );

    res.json({
      success: true,
      data: result || []
    });
  } catch (error: any) {
    console.error('[Printing] Error fetching sessions:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/printing/sessions
 * Save a printing session
 */
router.post('/sessions', async (req, res) => {
  try {
    const { name, config, status } = req.body;

    if (!name) {
      return res.status(400).json({
        success: false,
        error: 'Session name is required'
      });
    }

    const id = crypto.randomUUID ? crypto.randomUUID() : `session_${Date.now()}`;
    const createdAt = new Date().toISOString();

    await db.query(
      `INSERT INTO printing_session (id, name, config, status, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?)`,
      [id, name, JSON.stringify(config || {}), status || 'active', createdAt, createdAt]
    );

    res.json({
      success: true,
      data: { id, name, config, status, createdAt }
    });
  } catch (error: any) {
    console.error('[Printing] Error saving session:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * DELETE /api/printing/sessions/:id
 * Delete a printing session
 */
router.delete('/sessions/:id', async (req, res) => {
  try {
    const { id } = req.params;

    await db.query(
      `DELETE FROM printing_session WHERE id = ?`,
      [id]
    );

    res.json({
      success: true,
      message: 'Session deleted'
    });
  } catch (error: any) {
    console.error('[Printing] Error deleting session:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/printing/recent-arrivals
 * Retrieve recent arrivals for printing
 */
router.get('/recent-arrivals', async (req, res) => {
    try {
        const registry = RegistryManager.getInstance().get();
        const defaultLimit = registry.system?.recent_arrivals_limit || 20;
        const limit = parseInt(req.query.limit as string) || defaultLimit;

        const entries: any[] = await db.query(`
            SELECT
                n.id, n.source, n.senderName, n.senderId, n.body, n.timestamp, n.createdAt,
                f.id as fileId, f.filename, f.path
            FROM inbox_notification n
            LEFT JOIN inbox_file f ON n.id = f.notificationId
            ORDER BY n.createdAt DESC
            LIMIT ?
        `, [limit * 10]);

        const grouped: any = {};
        (entries || []).forEach((row: any) => {
            if (!grouped[row.id]) {
                grouped[row.id] = {
                    id: row.id,
                    source: row.source,
                    senderName: row.senderName,
                    senderId: row.senderId,
                    body: row.body,
                    timestamp: row.timestamp,
                    createdAt: row.createdAt,
                    files: []
                };
            }
            if (row.fileId) {
                grouped[row.id].files.push({
                    id: row.fileId,
                    filename: row.filename,
                    path: row.path
                });
            }
        });

        res.json({
            success: true,
            data: Object.values(grouped).slice(0, limit)
        });
    } catch (error: any) {
        console.error('[Printing] Error fetching recent arrivals:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

export const printingRouter = router;


