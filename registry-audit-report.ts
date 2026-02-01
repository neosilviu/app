// registry-audit-report.ts
// Script pentru auditarea rapidă a entităților și permisiunilor din registry (Studio App v2)
// Rulează cu: npx ts-node registry-audit-report.ts

// Pentru rulare: npx ts-node --experimental-specifier-resolution=node registry-audit-report.ts
import { ENTITY_CONFIG, SYSTEM_ROLE } from './registry-baseline.ts';

console.log('=== ENTITY AUDIT REPORT ===');
for (const [entity, config] of Object.entries(ENTITY_CONFIG)) {
  const features = (config as any).features;
  console.log(`Entity: ${entity}`);
  if (features && typeof features === 'object') {
    console.log(`  Features: ${Object.keys(features).filter(f => features[f]).join(', ')}`);
  } else {
    console.log('  Features: (none)');
  }
  console.log('');
}

console.log('=== ROLE PERMISSIONS AUDIT ===');
for (const [role, def] of Object.entries(SYSTEM_ROLE)) {
  console.log(`Role: ${role}`);
  if (def.permission && def.permission.length) {
    for (const perm of def.permission) {
      console.log(`  - ${perm}`);
    }
  } else {
    console.log('  (no permissions)');
  }
  console.log('');
}
