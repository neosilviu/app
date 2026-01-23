import { Router } from 'express';
import { registryRouter } from './handlers/registry.handler';
import { RegistryManager } from '../core/registry';
import { entityRouter } from './handlers/entity.handler';
import { auditRouter } from './handlers/audit.handler';
import { printingRouter } from './handlers/printing.handler';
import { systemRouter } from './handlers/system.handler';
import { filesRouter } from './handlers/files.handler';

const router = Router();

// Legacy / Compatibility Routes
router.get('/config', (req, res) => {
  try {
    const registry = RegistryManager.getInstance().get();
    res.json({ 
      success: true, 
      constants: registry.constants,
      entity: registry.entity,
      uiConfig: registry.uiConfig || {},
      role: registry.role || {},
      user: (req as any).user || null
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Mount routes
router.get('/health', (req, res) => { res.json({ status: 'ok', service: 'backend-v2' }); });

router.use('/registry', registryRouter);
router.use('/entity', entityRouter);
router.use('/audit', auditRouter);
router.use('/printing', printingRouter);
router.use('/system', systemRouter);
router.use('/file', filesRouter);

export const apiRoutes = router;



