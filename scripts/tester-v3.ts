import { execSync } from 'child_process';
import path from 'path';

/**
 * V3 ENTITY TESTER LOOP
 * Runs vitest on modular entities and validates Enterprise Level 10 standards.
 */
function runTests() {
    console.log("🧪 Starting V3 Entity Validation Loop...");
    
    try {
        const result = execSync('npx vitest run app/core/entities', { stdio: 'inherit' });
        console.log("\n✅ All V3 Entities passed validation standard!");
    } catch (e) {
        console.error("\n❌ Validation Failed! Please fix schema errors before committing.");
        process.exit(1);
    }
}

runTests();
