import { Router } from 'express';
import fs from 'fs-extra';
import path from 'path';
import os from 'os';
import { RegistryManager } from '../../core/registry';
import { EntitySync } from '../../core/entity-sync';

import { exec } from 'child_process';
import { promisify } from 'util';
const execAsync = promisify(exec);

const router = Router();

/**
 * GET /api/system/printing/config
 * Retrieve printing configuration
 */
router.get('/printing/config', async (req, res) => {
  try {
    const registry = RegistryManager.getInstance().get();
    const configDir = registry.system?.local_config_path || './backend/config';
    const printingConfigPath = path.resolve(configDir, 'printing.json');

    let pConfig: any = {};
    if (fs.existsSync(printingConfigPath)) {
        pConfig = await fs.readJson(printingConfigPath);
    }

    // Use Registry for allowed extensions if missing in file
    if (!pConfig.allowedExtensions) {
        pConfig.allowedExtensions = registry.system?.printing_allowed_extensions || [];
    }

    res.json({
        success: true,
        config: pConfig
    });
  } catch (error: any) {
    console.error('[System] Error fetching printing config:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

export const systemRouter = router;
// Additional endpoints

// GET /api/system/info
router.get('/info', async (req, res) => {
  // ... existing code ...
});

/**
 * POST /api/system/execute
 * Autonomous execute command for AI agent
 * (DANGEROUS: Enterprise Level 11 - Full Agent Control)
 */
router.post('/execute', async (req, res) => {
  try {
    const { command, cwd } = req.body;
    if (!command) throw new Error("Command is required");

    console.log(`[AI-EXECUTE] Running: ${command} in ${cwd || process.cwd()}`);
    
    const { stdout, stderr } = await execAsync(command, { 
        cwd: cwd || process.cwd(),
        timeout: 60000 // 1 minute limit
    });

    res.json({
        success: true,
        stdout,
        stderr,
        command
    });
  } catch (error: any) {
    console.error('[System] Execute Error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      stderr: error.stderr,
      stdout: error.stdout
    });
  }
});

/**
 * POST /api/system/db/sync
 * Manually trigger entity schema synchronization
 */
router.post('/db/sync', async (req, res) => {
    try {
        const sync = new EntitySync();
        await sync.syncAll();
        res.json({ success: true, message: "Database schema synchronized successfully." });
    } catch (error: any) {
        console.error('[DB-SYNC] Error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * GET /api/system/logs
 * Retrieve the latest application logs
 */
router.get('/logs', async (req, res) => {
    try {
        const lines = parseInt(req.query.lines as string) || 50;
        const logPath = path.resolve(process.cwd(), 'logs/combined.log');
        
        if (!fs.existsSync(logPath)) {
            return res.json({ success: true, logs: ["Log file not found."] });
        }

        const content = await fs.readFile(logPath, 'utf8');
        const allLines = content.split('\n').filter(l => l.trim().length > 0);
        const lastLines = allLines.slice(-lines);

        res.json({ success: true, logs: lastLines });
    } catch (error: any) {
        console.error('[LOGS] Error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// GET /api/system/get-settings
router.get('/get-settings', async (req, res) => {
  try {
    const registry = RegistryManager.getInstance().get();
    // Prefer explicit `system` section, fallback to SYSTEM_SETTING or entire registry
    const settings = registry.system || registry.SYSTEM_SETTING || registry.SYSTEM || registry || {};
    res.json({ success: true, settings });
  } catch (error: any) {
    console.error('[System] Error fetching system settings:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/workers/status', async (req, res) => {
  try {
    const { WorkerManager } = require('../../core/WorkerManager');
    const statuses = WorkerManager.getInstance().getStatuses();
    res.json({ success: true, statuses });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/workers/refresh', async (req, res) => {
  try {
    const { WorkerManager } = require('../../core/WorkerManager');
    await WorkerManager.getInstance().refreshState();
    res.json({ success: true, message: 'Workers refreshed' });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});
