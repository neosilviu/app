import { Router } from 'express';
import fs from 'fs-extra';
import path from 'path';
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
