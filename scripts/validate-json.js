const fs = require('fs');
const path = require('path');

const file = ['common.json', 'dashboard.json', 'entities.json', 'gmail.json', 'monitoring.json', 'printing.json', 'settings.json', 'sidebar.json', 'superadmin.json', 'validation.json', 'whatsapp.json', 'auth.json'];

file.forEach(file => {
  const enPath = path.join('frontend/public/locales/en', file);
  const roPath = path.join('frontend/public/locales/ro', file);
  
  try {
    JSON.parse(fs.readFileSync(enPath, 'utf8'));
    console.log(`✓ ${file} (EN) - Valid JSON`);
  } catch(e) {
    console.log(`✗ ${file} (EN) - ERROR: ${e.message}`);
  }
  
  try {
    JSON.parse(fs.readFileSync(roPath, 'utf8'));
    console.log(`✓ ${file} (RO) - Valid JSON`);
  } catch(e) {
    console.log(`✗ ${file} (RO) - ERROR: ${e.message}`);
  }
});

