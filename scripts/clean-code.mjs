import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.join(__dirname, '../frontend/app');

function processFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  const original = content;

  // 1. Regula Lucide: Transformă importurile multi-line în single-line
  // Caută: import { ... } from 'lucide-react'
  content = content.replace(/import\s+\{([\s\S]*?)\}\s+from\s+['"]lucide-react['"];?/g, (match, iconsPart) => {
    const icons = iconsPart
      .split(',')
      .map(i => i.trim())
      .filter(i => i !== '')
      .join(', ');
    return `import { ${icons} } from 'lucide-react';`;
  });

  // 2. Regula i18n: Elimină al doilea argument (fallback string) din t()
  // Exemplu: t('key', 'Default') -> t('key')
  // Exemplu: t('key', 'Default', { var }) -> t('key', { var })
  // We need to be careful with nested commas.
  // This simple regex handles most cases but might need refinement if nested objects are passed as second arg.
  // Updated regex to better handle the second argument being a string while preserving other arguments if they exist.
  content = content.replace(/t\(\s*(['"][^'"]+['"])\s*,\s*(['"][^'"]*['"])\s*(,[^)]+)?\)/g, 't($1$3)');

  if (content !== original) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`✅ Optimizat: ${path.relative(rootDir, filePath)}`);
  }
}

function walk(dir) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      walk(fullPath);
    } else if (fullPath.endsWith('.tsx') || fullPath.endsWith('.ts')) {
      processFile(fullPath);
    }
  }
}

console.log('🚀 Pornire proces de "Code Stripping" (Studio App v2)...');
walk(rootDir);
console.log('✨ Curățenie finalizată conform Regulei de Aur.');
