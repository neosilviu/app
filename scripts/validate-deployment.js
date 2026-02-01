/**
 * Simple Deployment Validator
 * Checks if production configuration files exist before allowing deploy
 */
const fs = require('fs');
const path = require('path');

console.log('🔍 Validating deployment environment...');

const frontendDir = path.join(__dirname, '../frontend');
const prodConfig = path.join(frontendDir, 'wrangler.production.toml');

if (!fs.existsSync(prodConfig)) {
  console.error('❌ ERROR: wrangler.production.toml is missing in frontend directory!');
  process.exit(1);
}

// Check for registry baseline
const registryBaseline = path.join(__dirname, '../registry-baseline.ts');
if (!fs.existsSync(registryBaseline)) {
    console.warn('⚠️ WARNING: registry-baseline.ts not found in root. System might start with defaults.');
}

console.log('✅ Environment check passed.\n');
process.exit(0);
