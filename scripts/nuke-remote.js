const { execSync } = require('child_process');
const path = require('path');

const ACCOUNT_ID = '1ee6235f1d9f54e97869e1620f5cb51e';
const DB_NAME = 'studio-db';

async function nukeRemote() {
  console.log('\n☢️  NUKE REMOTE D1 DATABASE: ' + DB_NAME);
  console.log('------------------------------------------');
  
  const env = { ...process.env, CLOUDFLARE_ACCOUNT_ID: ACCOUNT_ID };
  const wranglerCwd = path.join(__dirname, '../frontend');
  const configFlag = '-c wrangler.production.toml';

  // 1. Get all tables
  console.log('🔍 [1/3] Discovering remote schema...');
  try {
    const listCmd = `npx wrangler d1 execute ${DB_NAME} --remote ${configFlag} --command "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%';" --json`;
    const resultRaw = execSync(listCmd, { cwd: wranglerCwd, env, encoding: 'utf-8' });
    const result = JSON.parse(resultRaw);
    const tables = result[0].results
      .map(r => r.name)
      .filter(name => !name.startsWith('sqlite_') && !name.startsWith('_cf_')); 
    
    if (tables.length === 0) {
      console.log('✨ Database is already empty (no custom tables found).');
      return;
    }

    console.log(`   Found ${tables.length} tables.`);

    // 2. Drop all tables
    console.log('🧨 [2/3] Dropping all tables...');
    
    const tablesToDrop = tables.filter(t => t !== 'd1_migrations');
    
    if (tablesToDrop.length > 0) {
        // Try dropping one by one to avoid large command issues or auth issues on specific tables
        for (const table of tablesToDrop) {
            console.log(`   - Dropping table: ${table}...`);
            try {
                execSync(`npx wrangler d1 execute ${DB_NAME} --remote ${configFlag} --command "DROP TABLE IF EXISTS \\"${table}\\";"`, {
                    cwd: wranglerCwd,
                    env,
                    stdio: 'inherit'
                });
            } catch (e) {
                console.warn(`   ⚠️ Failed to drop ${table}: ${e.message}`);
            }
        }
    } else {
        console.log('   ℹ️ No tables to drop (only system tables found).');
    }

    // 3. Clear migrations
    console.log('🧹 [3/3] Truncating migration history...');
    try {
        execSync(`npx wrangler d1 execute ${DB_NAME} --remote ${configFlag} --command "DELETE FROM d1_migrations;"`, {
            cwd: wranglerCwd,
            env,
            stdio: 'inherit'
        });
        console.log('   ✅ Migration history cleared.');
    } catch (e) {
        // If d1_migrations doesn't exist, ignore
        console.log('   ℹ️ migration history already empty or table missing.');
    }

    console.log('\n✨ REMOTE DATABASE WIPE COMPLETE. Ready for fresh migrations.');
  } catch (e) {
    console.error('\n❌ CRITICAL ERROR during nuke:');
    console.error(e.stdout || e.message);
    process.exit(1);
  }
}

nukeRemote();
