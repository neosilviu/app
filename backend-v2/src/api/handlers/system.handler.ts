import { Router } from 'express';
import fs from 'fs-extra';
import path from 'path';
import os from 'os';
import { RegistryManager } from '../../core/registry';

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
  try {
    const registry = RegistryManager.getInstance().get();

    const nodeVersion = process.version;
    const platform = os.type();
    const arch = os.arch();
    const cpus = os.cpus() || [];
    const cpuCount = cpus.length;
    const totalMem = os.totalmem();
    const freeMem = os.freemem();

    // Gather local IP addresses (non-internal IPv4 first)
    const nets = os.networkInterfaces() || {};
    const localIps: string[] = [];
    Object.values(nets).forEach((ifaceList: any) => {
      if (!ifaceList) return;
      ifaceList.forEach((iface: any) => {
        if (iface && iface.address) {
          // include IPv4 and IPv6 but prefer non-internal
          localIps.push(iface.address);
        }
      });
    });

    res.json({
      success: true,
      info: {
        nodeVersion,
        platform,
        arch,
        cpus: cpuCount,
        cpuModel: cpus[0]?.model || null,
        memory: {
          total: totalMem,
          free: freeMem
        },
        localIps
      }
    });
  } catch (error: any) {
    console.error('[System] Error fetching system info:', error);
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
