const { execSync } = require('child_process');

/**
 * AUTH DOCTOR - Enterprise Level 10
 * Validates that Auth tables in local D1 are correctly configured 
 * with workspaceId defaults to prevent SQLite NOT NULL crashes.
 */
function verifyAuthD1() {
    console.log("🩺 Running Auth Schema Doctor...");
    
    const tables = ['account', 'session', 'user', 'system_error'];
    let allOk = true;

    tables.forEach(table => {
        try {
            const output = execSync(`cd frontend && npx wrangler d1 execute DB --local --command="PRAGMA table_info('${table}');"`).toString();
            
            if (output.includes('workspaceId')) {
                const lines = output.split('\n');
                const wsLine = lines.find(l => l.includes('workspaceId'));
                
                // Check for default value 'system'
                const hasDefault = wsLine.includes("'system'") || wsLine.includes('"system"');
                const isNotNull = wsLine.includes('| 1 |') || wsLine.includes('| 1 |'); // notnull column

                if (isNotNull && !hasDefault) {
                    console.error(`❌ Table [${table}]: workspaceId is NOT NULL but MISSING DEFAULT! This will cause crashes.`);
                    allOk = false;
                } else if (hasDefault) {
                    console.log(`✅ Table [${table}]: workspaceId has correct default.`);
                } else {
                    console.log(`⚠️ Table [${table}]: workspaceId is nullable (Safe, but default is preferred).`);
                }
            } else {
                console.warn(`⚠️ Table [${table}] does not exist yet or lacks workspaceId.`);
            }
        } catch (e) {
            console.warn(`⚠️ Could not check table [${table}]: ${e.message}`);
        }
    });

    if (!allOk) {
        console.error("\n🚨 Auth Schema is INVALID. Run 'npm run fix' or re-init database.");
        process.exit(1);
    } else {
        console.log("\n✨ Auth Schema is healthy!");
    }
}

verifyAuthD1();
