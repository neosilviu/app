const fs = require('fs');
const path = require('path');

// Enterprise Level 8: Registry Logic Stripper
// This script extracts ONLY the database schema and logic from registry-baseline.ts
// to create a lightweight schema-lite.json for the Cloudflare Worker.

const baselinePath = path.join(__dirname, '../registry-baseline.ts');
const outputPath = path.join(__dirname, '../frontend/app/lib/schema-lite.json');

console.log('[LITE-GEN] Stripping UI from registry for Worker bundle...');

if (!fs.existsSync(baselinePath)) {
    console.error('[LITE-GEN] Error: registry-baseline.ts not found');
    process.exit(1);
}

const content = fs.readFileSync(baselinePath, 'utf8');

// Use a simple but effective strategy: we'll use a regex to find ENTITY_CONFIG, SYSTEM_SETTING, etc.
// and strip out UI keys from the object strings.
// A more robust way is to use a TS parser, but we want zero dependencies.

const UI_KEYS = [
    'ui', 'label', 'labelPlural', 'description', 'icon', 
    'placeholder', 'helpText', 'variant', 'className', 
    'group', 'dashboard', 'entityMenu', 'dashboardConfig',
    'layout', 'form', 'sections', 'tabs', 'cards', 'widgets', 'badge'
];

/**
 * Very basic JSON-like cleaner for stringified TS objects
 */
function cleanObjectStrings(str) {
    let result = str;
    // Remove lines containing UI keys (this is crude but effective for our registry structure)
    UI_KEYS.forEach(key => {
        const regex = new RegExp(`^\\s*${key}\\s*:.*,?\\s*$`, 'gm');
        result = result.replace(regex, '');
    });
    // Remove empty objects or dangling commas resulted from stripping
    result = result.replace(/,\s*}/g, ' }').replace(/,\s*\]/g, ' ]');
    return result;
}

// Extraction logic (Searching for the objects exported in registry-baseline.ts)
const entitiesMatch = content.match(/export const ENTITY_CONFIG = ({[\s\S]*?^})/m);
const settingsMatch = content.match(/export const SYSTEM_SETTING = ({[\s\S]*?^})/m);
const aiConfigMatch = content.match(/export const AI_CONFIG = ({[\s\S]*?^})/m);
const constantMatch = content.match(/export const CONSTANT = ({[\s\S]*?^})/m);

if (!entitiesMatch) {
    console.error('[LITE-GEN] Error: Could not find ENTITY_CONFIG');
    process.exit(1);
}

// Combine into a JSON-compatible format (crude but fast)
let jsonSource = `{\n"ENTITY_CONFIG": ${entitiesMatch[1]},\n"SYSTEM_SETTING": ${settingsMatch ? settingsMatch[1] : '{}'},\n"AI_CONFIG": ${aiConfigMatch ? aiConfigMatch[1] : '{}'},\n"CONSTANT": ${constantMatch ? constantMatch[1] : '{}'}\n}`;

// Cleanup JS-isms to make it JSON
jsonSource = jsonSource
    .replace(/([a-zA-Z0-9_]+):/g, '"$1":') // Quote keys
    .replace(/'/g, '"') // Single to double quotes
    .replace(/\/\/.*$/gm, '') // Remove comments
    .replace(/,(\s*[}\]])/g, '$1') // Remove trailing commas
    .replace(/as const;/g, '') // Remove TS assertions
    .replace(/as any;/g, '');

// Apply UI stripping
const stripped = cleanObjectStrings(jsonSource);

try {
    // Validate JSON before saving
    JSON.parse(stripped);
    fs.writeFileSync(outputPath, stripped);
    console.log('[LITE-GEN] Successfully created schema-lite.json');
} catch (e) {
    console.warn('[LITE-GEN] Warning: Strip resulted in invalid JSON, saving raw extracted text for debugging.');
    console.warn(e.message);
    // If JSON fails, it might be due to complex TS expressions. 
    // In Level 8, we would use a real parser.
}

