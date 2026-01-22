const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');
const sqlite3 = require('sqlite3').verbose();
const crypto = require('crypto');

// MATCHING brain.server.ts / auth.server.ts hashing
const SALT = "studio-v2-salt-fixme";
const ITERATIONS = 100000;

function hashPassword(password) {
    const key = crypto.pbkdf2Sync(password, SALT, ITERATIONS, 32, 'sha256');
    return key.toString('hex');
}

const ADMIN = {
    id: 'admin@admin',
    workspaceId: 'ws-dev',
    name: 'Dev Admin',
    email: 'admin@admin',
    password: hashPassword('admin'),
    role: 'superadmin',
    status: 'lead',
    archived: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
};

const WORKSPACE = {
    id: 'ws-dev',
    name: 'Studio Dev',
    archived: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
};

function runSqlD1(sql) {
    console.log(`Executing SQL on local D1...`);
    const devStatePath = path.join(__dirname, '../.dev/.wrangler/state');
    try {
        execSync(`npx wrangler d1 execute studio-db --local --persist-to "${devStatePath}" --config ../.dev/wrangler-dev.toml --command "${sql.replace(/"/g, '\\"')}"`, {
            cwd: path.join(__dirname, '../frontend'),
            stdio: 'inherit'
        });
    } catch (e) {
        console.error(`Failed to execute SQL on D1: ${e.message}`);
    }
}

async function runSqlSqlite(dbPath, sql, params = []) {
    return new Promise((resolve, reject) => {
        const db = new sqlite3.Database(dbPath, (err) => {
            if (err) return reject(err);
            db.run(sql, params, function(err) {
                if (err) reject(err);
                else resolve(this);
                db.close();
            });
        });
    });
}

async function main() {
    console.log("Seeding local D1 (from .dev config) and Local SQLite with remote superadmin data...");

    // 1. Seed D1
    console.log("\n--- Seeding D1 ---");
    const devStatePath = path.join(__dirname, '../.dev/.wrangler/state');
    try {
        execSync(`npx wrangler d1 migrations apply studio-db --local --persist-to "${devStatePath}" --config ../.dev/wrangler-dev.toml`, {
            cwd: path.join(__dirname, '../frontend'),
            stdio: 'inherit'
        });
    } catch (e) {}

    // Cleanup potential prod mixup
    runSqlD1(`DELETE FROM contact WHERE email = 'neosilviu@gmail.com'`);
    runSqlD1(`DELETE FROM workspace WHERE name = 'aemdpc'`);

    runSqlD1(`INSERT OR REPLACE INTO workspace (id, name, archived, createdAt, updatedAt) VALUES ('${WORKSPACE.id}', '${WORKSPACE.name}', 0, '${WORKSPACE.createdAt}', '${WORKSPACE.updatedAt}')`);
    runSqlD1(`INSERT OR REPLACE INTO contact (id, workspaceId, name, email, password, role, status, archived, createdAt, updatedAt) VALUES ('${ADMIN.id}', '${ADMIN.workspaceId}', '${ADMIN.name}', '${ADMIN.email}', '${ADMIN.password}', '${ADMIN.role}', '${ADMIN.status}', 0, '${ADMIN.createdAt}', '${ADMIN.updatedAt}')`);

    // 2. Seed Local SQLite
    console.log("\n--- Seeding Local SQLite ---");
    const localDbPath = path.join(__dirname, '../.dev/local_db_dev.sqlite');
    
    if (fs.existsSync(localDbPath)) {
        try {
            // Ensure tables exist in local sqlite too (very basic)
            await runSqlSqlite(localDbPath, "CREATE TABLE IF NOT EXISTS workspace (id TEXT PRIMARY KEY, name TEXT, archived INTEGER DEFAULT 0, createdAt TEXT, updatedAt TEXT)");
            await runSqlSqlite(localDbPath, "CREATE TABLE IF NOT EXISTS contact (id TEXT PRIMARY KEY, workspaceId TEXT, name TEXT, email TEXT, password TEXT, role TEXT, status TEXT, archived INTEGER DEFAULT 0, createdAt TEXT, updatedAt TEXT)");

            // Cleanup potential prod mixup
            await runSqlSqlite(localDbPath, "DELETE FROM contact WHERE email = 'neosilviu@gmail.com'");
            await runSqlSqlite(localDbPath, "DELETE FROM workspace WHERE name = 'aemdpc'");

            await runSqlSqlite(localDbPath, "INSERT OR REPLACE INTO workspace (id, name, archived, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?)", 
                [WORKSPACE.id, WORKSPACE.name, 0, WORKSPACE.createdAt, WORKSPACE.updatedAt]);
            
            await runSqlSqlite(localDbPath, "INSERT OR REPLACE INTO contact (id, workspaceId, name, email, password, role, status, archived, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
                [ADMIN.id, ADMIN.workspaceId, ADMIN.name, ADMIN.email, ADMIN.password, ADMIN.role, ADMIN.status, 0, ADMIN.createdAt, ADMIN.updatedAt]);
            
            console.log(`✅ Seeded ${localDbPath}`);
        } catch (e) {
            console.error(`Failed to seed Local SQLite: ${e.message}`);
        }
    } else {
        console.warn(`Local SQLite file not found at ${localDbPath}, skipping.`);
    }

    console.log("\n✅ Seeding complete. Restart the application and the /setup redirect should be gone.");
}

main();

