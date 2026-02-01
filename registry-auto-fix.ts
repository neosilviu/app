// registry-auto-fix.ts
// Script pentru auto-fixarea permisiunilor de bază pentru entități și roluri (Studio App v2)
// Rulează cu: npx ts-node registry-auto-fix.ts


// Pentru rulare: npx ts-node --experimental-specifier-resolution=node registry-auto-fix.ts
import fs from 'fs';
import path from 'path';
const REGISTRY_PATH = path.resolve('./registry-baseline.ts');

// Caută și fixează permisiunile lipsă pentru fiecare entitate și rol de bază
function autoFixRegistry() {
  let content = fs.readFileSync(REGISTRY_PATH, 'utf-8');

  // Exemplu: asigură că toate entitățile cu features.deletable === true au permisiunea 'entity:delete' pentru workspace_owner, workspace_admin, member
  const roles = ['workspace_owner', 'workspace_admin', 'member'];
  const entityRegex = /([a-zA-Z0-9_]+):\s*{[^}]*features:\s*{[^}]*deletable:\s*true/gs;
  let match;
  const deletableEntities = [];
  while ((match = entityRegex.exec(content)) !== null) {
    deletableEntities.push(match[1]);
  }

  for (const entity of deletableEntities) {
    for (const role of roles) {
      const permRegex = new RegExp(`(${role}:\s*{[^}]*permission:\s*\[[^\]]*)`, 'g');
      content = content.replace(permRegex, (m: string, p1: string) => {
        const perm = `'${entity}:delete'`;
        if (!m.includes(perm)) {
          return m.replace(/(permission:\s*\[[^\]]*)/, `$1, ${perm}`);
        }
        return m;
      });
    }
  }

  fs.writeFileSync(REGISTRY_PATH, content, 'utf-8');
  console.log('Registry auto-fix complete. Verifică registry-baseline.ts pentru modificări.');
}

autoFixRegistry();
