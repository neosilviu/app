// scripts/test-healing.js
const { execSync } = require('child_process');

async function test() {
    console.log("--- STARTING SELF-HEALING TEST (ENTERPRISE LEVEL 10) ---");
    
    // 1. Get logs
    const output = execSync('npx wrangler d1 execute studio-db --local --command="SELECT * FROM system_performance_log WHERE status = \'slow\'" --json').toString();
    const logs = JSON.parse(output)[0].results;
    
    console.log(`Found ${logs.length} slow queries.`);
    if (logs.length === 0) {
        console.log("No logs found. Run a slow query first.");
        return;
    }

    const query = logs[0].query;
    console.log(`Targeting Query Pattern: ${query}`);

    console.log("\n[SIMULATING AI ANALYSIS...]");
    
    // Since I can't call the AI easily from a raw script without dependencies, 
    // I will mock the AI suggestion based on the table in the log.
    const tableMatch = query.match(/FROM\s+"?([a-zA-Z0-9_]+)"?/i);
    const table = tableMatch ? tableMatch[1] : 'unknown';
    
    if (table !== 'unknown') {
        const suggestion = `CREATE INDEX IF NOT EXISTS idx_${table}_performance_L9 ON ${table}(email);`;
        console.log(`AI Suggestion: ${suggestion}`);
        
        console.log(`\n[APPLYING OPTIMIZATION...]`);
        try {
            execSync(`npx wrangler d1 execute studio-db --local --command="${suggestion}"`);
            console.log("✅ Optimization Applied Successfully!");
        } catch (e) {
            console.error("❌ Failed to apply index:", e.message);
        }
    }
    
    console.log("\n--- TEST COMPLETE ---");
}

test();
