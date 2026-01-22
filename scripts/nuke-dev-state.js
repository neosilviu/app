const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('🚀 Nuke Database & Setup Virgin State...');

const pathsToNuke = [
  path.join(__dirname, '..', '.dev', 'local_db_dev.sqlite'),
  path.join(__dirname, '..', '.dev', 'local_db_dev.sqlite-shm'),
  path.join(__dirname, '..', '.dev', 'local_db_dev.sqlite-wal'),
  path.join(__dirname, '..', '.dev', '.wrangler'),
  path.join(__dirname, '..', 'frontend', '.wrangler'),
  path.join(__dirname, '..', 'backend', 'local_db.sqlite'),
  path.join(__dirname, '..', 'backend', 'local_db.sqlite-shm'),
  path.join(__dirname, '..', 'backend', 'local_db.sqlite-wal')
];

pathsToNuke.forEach(p => {
  if (fs.existsSync(p)) {
    try {
      if (fs.lstatSync(p).isDirectory()) {
        fs.rmSync(p, { recursive: true, force: true });
        console.log(`✅ Deleted directory: ${p}`);
      } else {
        fs.unlinkSync(p);
        console.log(`✅ Deleted file: ${p}`);
      }
    } catch (e) {
      console.warn(`❌ Failed to delete ${p}: ${e.message}`);
    }
  }
});

console.log('\n✨ Workspace is now in a VIRGIN state.');
console.log('👉 IMPORTANT: Please close your browser or clear cookies for localhost:5173 to remove old session data.');
console.log('👉 Then run: npm run dev');
