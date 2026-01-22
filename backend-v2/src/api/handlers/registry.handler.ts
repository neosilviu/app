import { Router } from 'express';
import { RegistryManager } from '../../core/registry';
import { globalCache } from '../../core/cache-manager';

const router = Router();

router.get('/', (req, res) => {
  try {
    const registry = RegistryManager.getInstance().get();
    res.json({ success: true, data: registry });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/:namespace', (req, res) => {
  try {
    const registry = RegistryManager.getInstance().get();
    const ns = req.params.namespace;
    if (registry[ns]) {
      res.json({ success: true, data: registry[ns] });
    } else {
      res.status(404).json({ success: false, error: 'Namespace not found' });
    }
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/save', async (req, res) => {
  try {
    const { key, value } = req.body;
    if (!key) return res.status(400).json({ success: false, error: 'Key required' });
    
    const success = await RegistryManager.getInstance().updateSetting(key, value);
    if (success) {
      res.json({ success: true });
    } else {
      res.status(500).json({ success: false, error: 'Failed to update setting' });
    }
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

export const registryRouter = router;
