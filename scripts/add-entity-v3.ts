import fs from 'fs';
import path from 'path';

const entityName = process.argv[2];

if (!entityName) {
  console.error('Usage: npx ts-node scripts/add-entity-v3.ts <entity_name>');
  process.exit(1);
}

const entitiesDir = path.resolve(__dirname, '../app/core/entities');
const filePath = path.join(entitiesDir, `${entityName}.ts`);
const testPath = path.join(entitiesDir, `${entityName}.test.ts`);
const indexPath = path.join(entitiesDir, 'index.ts');

if (fs.existsSync(filePath)) {
  console.error(`Entity "${entityName}" already exists at ${filePath}`);
  process.exit(1);
}

const template = `import { z } from 'zod';
import { BaseSchema, type EntityV3 } from '../schemas/base';

/**
 * ${entityName.toUpperCase()} ENTITY (v3 Modular)
 */
export const ${entityName}: EntityV3<any> = {
  id: '${entityName}',
  label: { ro: '${entityName}', en: '${entityName}' },
  labelPlural: { ro: '${entityName}s', en: '${entityName}s' },
  icon: 'Box',
  tableName: '${entityName}',
  displayField: 'name',

  schema: z.object({
    ...BaseSchema,
    name: z.string().describe('ui:width=12;searchable=true;label=Nume'),
    status: z.enum(['active', 'archived', 'deleted']).default('active')
      .describe('ui:width=6;label=Status'),
  }),

  features: ['timestamps', 'audit'],

  actions: [
    {
      id: 'custom-action',
      label: 'Custom Action',
      handler: async (ctx: any, input: any) => {
        // Logica ta aici
        return { success: true };
      }
    }
  ]
};
\`;

const testTemplate = \`import { describe, it, expect } from 'vitest';
import { ${entityName} } from './${entityName}';

describe('${entityName} Entity', () => {
  it('should have a valid schema', () => {
    expect(${entityName}.schema).toBeDefined();
    const result = ${entityName}.schema.safeParse({
        id: 'test-id',
        workspaceId: 'test-ws',
        name: 'Test Name',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
    });
    expect(result.success).toBe(true);
  });

  it('should have the correct table name', () => {
    expect(${entityName}.tableName).toBe('${entityName}');
  });

  it('should have the custom-action defined', () => {
    const action = ${entityName}.actions?.find(a => a.id === 'custom-action');
    expect(action).toBeDefined();
  });
});
\`;

// 1. Create the entity file
fs.writeFileSync(filePath, template);
console.log(\`✅ Created entity file: \${filePath}\`);

// 2. Create the test file
fs.writeFileSync(testPath, testTemplate);
console.log(\`✅ Created test file: \${testPath}\`);

// 3. Update index.ts
let indexContent = fs.readFileSync(indexPath, 'utf-8');

// Add import
const importMatch = indexContent.match(/import { (.*) } from '\.\/(.*)';/g);
const lastImport = importMatch ? importMatch[importMatch.length - 1] : '';
const newImport = `import { ${entityName} } from './${entityName}';\n`;

if (lastImport) {
  indexContent = indexContent.replace(lastImport, `${lastImport}\n${newImport}`);
} else {
  indexContent = `${newImport}${indexContent}`;
}

// Add to AVAILABLE_V3_ENTITIES
indexContent = indexContent.replace(
  /export const AVAILABLE_V3_ENTITIES = {([\s\S]*?)};/,
  (match, p1) => {
    return `export const AVAILABLE_V3_ENTITIES = {${p1}  ${entityName},\n};`;
  }
);

// Add to default active IDs (getActiveV3Entities and getV3EntitiesAsLegacy)
indexContent = indexContent.replace(
  /activeIds: string\[\] = \[([\s\S]*?)\]/g,
  (match, p1) => {
    if (p1.includes(`'${entityName}'`)) return match;
    const lastQuote = p1.lastIndexOf("'");
    if (lastQuote === -1) return match;
    return `activeIds: string[] = [${p1.substring(0, lastQuote + 1)}, '${entityName}'${p1.substring(lastQuote + 1)}]`;
  }
);

fs.writeFileSync(indexPath, indexContent);
console.log(`✅ Updated entities index: ${indexPath}`);
console.log(`\n🚀 Entity "${entityName}" is ready to use!`);
