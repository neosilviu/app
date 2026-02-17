// backend-v2/registry-entities.js
// CommonJS loader for registry-entities.json
const fs = require('fs');
const path = require('path');

function loadRegistry() {
  const file = path.join(__dirname, 'registry-entities.json');
  if (!fs.existsSync(file)) throw new Error('Registry JSON not found. Run: npm run build:registry');
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

module.exports = { loadRegistry };
