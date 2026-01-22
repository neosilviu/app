import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Enterprise Level 8: Parameterized infrastructure via CLI args
const DB_NAME = process.argv[2] || "studio-db";
const WRANGLER_RELATIVE_PATH = process.argv[3] || '../frontend/wrangler.toml';
const WRANGLER_TOML_PATH = path.resolve(__dirname, WRANGLER_RELATIVE_PATH);

async function setupDatabase() {
  console.log(`\x1b[36m[DB-SETUP]\x1b[0m Starting automated infrastructure provisioning for: ${DB_NAME}`);

  try {
    // 1. Create DB in Cloudflare (or get info if exists)
    console.log(`\x1b[36m[DB-SETUP]\x1b[0m Checking/Creating D1 database...`);
    let output;
    try {
      output = execSync(`npx wrangler d1 create ${DB_NAME}`, { stdio: ['pipe', 'pipe', 'pipe'] }).toString();
    } catch (e) {
      const errorMsg = (e.stdout?.toString() || "") + (e.stderr?.toString() || "");
      if (errorMsg.toLowerCase().includes('already exists')) {
        console.log(`\x1b[33m[DB-SETUP]\x1b[0m Database already exists, fetching existing ID...`);
        output = execSync(`npx wrangler d1 list`, { stdio: ['pipe', 'pipe', 'pipe'] }).toString();
      } else {
        throw new Error(`Failed to create/fetch D1: ${errorMsg}`);
      }
    }

    // 2. Extract database_id
    // Regex matches the UUID format
    const idMatch = output.match(/database_id\s*=\s*"([a-f0-9-]{36})"/i) || 
                    output.match(/([a-f0-9-]{36})/i);
    
    // If we used list, we might need a more specific match
    let dbId = "";
    if (output.includes('uuid')) {
        // Parsing output from 'wrangler d1 list' which usually looks like a table or array
        const lines = output.split('\n');
        const dbLine = lines.find(l => l.includes(DB_NAME));
        if (dbLine) {
            const uuidMatch = dbLine.match(/([a-f0-9-]{36})/i);
            if (uuidMatch) dbId = uuidMatch[1];
        }
    } else if (idMatch) {
       dbId = idMatch[1];
    }

    if (!dbId) {
      console.error(`\x1b[31m[DB-SETUP]\x1b[0m FAILED: Could not extract database_id from output.`);
      process.exit(1);
    }

    console.log(`\x1b[32m[DB-SETUP]\x1b[0m Target Database ID: ${dbId}`);

    // 3. Update wrangler.toml
    if (!fs.existsSync(WRANGLER_TOML_PATH)) {
      console.error(`\x1b[31m[DB-SETUP]\x1b[0m FAILED: wrangler.toml not found at ${WRANGLER_TOML_PATH}`);
      process.exit(1);
    }

    let tomlContent = fs.readFileSync(WRANGLER_TOML_PATH, 'utf8');
    
    // Replace the database_id line specifically for the DB binding
    const updatedToml = tomlContent.replace(
      /database_id\s*=\s*"[a-f0-9-]*"/i,
      `database_id = "${dbId}"`
    );

    if (tomlContent === updatedToml) {
        console.log(`\x1b[33m[DB-SETUP]\x1b[0m wrangler.toml already up to date.`);
    } else {
        fs.writeFileSync(WRANGLER_TOML_PATH, updatedToml);
        console.log(`\x1b[32m[DB-SETUP]\x1b[0m SUCCESS: Updated wrangler.toml with new database_id.`);
    }

    // 4. Run Migrations (Level 8: Preparation)
    console.log(`\x1b[36m[DB-SETUP]\x1b[0m Applying migrations to remote database...`);
    try {
        // Removed --yes as it's not supported in all wrangler versions for d1 migrations apply
        execSync(`npx wrangler d1 migrations apply ${DB_NAME} --remote`, { stdio: 'inherit', cwd: path.join(__dirname, '../frontend') });
        console.log(`\x1b[32m[DB-SETUP]\x1b[0m ALL DONE: Infrastructure is ready for deployment.`);
    } catch (migErr) {
        console.warn(`\x1b[33m[DB-SETUP]\x1b[0m Migration warning (Auto-init might handle this later): ${migErr.message}`);
    }

  } catch (err) {
    console.error(`\x1b[31m[DB-SETUP]\x1b[0m FATAL ERROR:`, err.message);
    process.exit(1);
  }
}

setupDatabase();
