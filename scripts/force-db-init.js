
const fs = require('fs');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();

const SEARCH_DIR = path.join(process.cwd(), '.dev', '.wrangler');
const MIGRATION_FILE = path.join(process.cwd(), 'frontend', 'migrations', '0001_initial.sql');

function getAllFiles(dirPath, arrayOfFiles) {
    const file = fs.readdirSync(dirPath);
    arrayOfFiles = arrayOfFiles || [];

    file.forEach(function(file) {
        if (fs.statSync(dirPath + "/" + file).isDirectory()) {
            arrayOfFiles = getAllFiles(dirPath + "/" + file, arrayOfFiles);
        } else {
            if (file.endsWith('.sqlite')) {
                arrayOfFiles.push(path.join(dirPath, file));
            }
        }
    });

    return arrayOfFiles;
}

async function runSQL(dbPath, sql) {
    return new Promise((resolve, reject) => {
        console.log(`[DB-FORCE] Opening ${dbPath}...`);
        const db = new sqlite3.Database(dbPath);
        
        // Remove comments to verify pure SQL execution if needed, 
        // but sqlite3 exec handles comments fine usually.
        
        db.exec(sql, (err) => {
            if (err) {
                console.error(`[DB-FORCE] Error executing on ${dbPath}:`, err.message);
                // Don't reject, just log, so we continue to other DBs
                resolve(false); 
            } else {
                console.log(`[DB-FORCE] Successfully applied SQL to ${dbPath}`);
                resolve(true);
            }
            db.close();
        });
    });
}

async function main() {
    if (!fs.existsSync(SEARCH_DIR)) {
        console.error(`[DB-FORCE] Search directory does not exist: ${SEARCH_DIR}`);
        return;
    }

    if (!fs.existsSync(MIGRATION_FILE)) {
        console.error(`[DB-FORCE] Migration file not found: ${MIGRATION_FILE}`);
        return;
    }

    const sql = fs.readFileSync(MIGRATION_FILE, 'utf8');
    const dbFiles = getAllFiles(SEARCH_DIR);
    
    // Also add the new default location if it doesn't exist yet, we might want to create it?
    // Miniflare creates it on startup. 
    // If dbFiles is empty, we have a problem.
    
    if (dbFiles.length === 0) {
        console.log("[DB-FORCE] No existing SQLite file found in .dev/.wrangler. Launching dev once might be needed to create them.");
        // We could manually create the folder structure and a default DB?
        // Let's rely on the user having run 'dev' at least once. 
        // Based on logs, they have.
    }

    console.log(`[DB-FORCE] Found ${dbFiles.length} SQLite file. Applying schema...`);

    for (const file of dbFiles) {
        await runSQL(file, sql);
    }
    
    console.log("[DB-FORCE] Done.");
}

main();

