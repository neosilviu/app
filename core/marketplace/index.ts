/**
 * V3 MARKETPLACE REGISTRY - Automated Level 10 (Registry-Less Discovery)
 * Automatically discovers all ecosystem templates in this folder.
 */

// Vite/Vitest compatible auto-discovery
let modules: Record<string, any> = {};

try {
  // @ts-ignore - Only works in Vite environment
  const globResult = import.meta.glob('./*.ts', { eager: true });
  if (globResult && Object.keys(globResult).length > 0) {
    modules = globResult;
  }
} catch (e) {
  // Silent fail
}

// Fallback for Node.js environment (Migrations, CLI tools)
if (Object.keys(modules).length === 0 && typeof process !== 'undefined' && (process as any).versions?.node) {
  try {
    const fs = require('fs');
    const path = require('path');
    const dir = __dirname;
    
    fs.readdirSync(dir).forEach((file: string) => {
      if (file.endsWith('.ts') && file !== 'index.ts' && !file.includes('.test.') && !file.includes('.spec.')) {
        const fullPath = path.join(dir, file);
        modules[`./${file}`] = require(fullPath);
      }
    });
  } catch (nodeErr) {
    // Silent fail
  }
}

export function getV3MarketplaceTemplates() {
  const templates: any[] = [];
  
  Object.entries(modules).forEach(([path, module]: [string, any]) => {
    // Extract the template object (default export or named export)
    const exported = module.default || module;
    
    if (Array.isArray(exported)) {
      templates.push(...exported.filter(t => t && t.id));
    } else if (exported && typeof exported === 'object' && exported.id) {
      const template = exported;
      templates.push(template);
    }
  });

  return templates;
}

