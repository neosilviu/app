// scripts/compile-entities-to-json.ts
// Compile ESM registry to JSON for backend-v2 (CommonJS)
import { getV3EntitiesAsLegacy } from '../core/entities/index.js';
import { writeFileSync } from 'fs';

(async () => {
  const registry = getV3EntitiesAsLegacy();
  writeFileSync('backend-v2/registry-entities.json', JSON.stringify(registry, null, 2));
  console.log('[OK] Registry exported to backend-v2/registry-entities.json');
})();
