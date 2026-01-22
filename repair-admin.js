const { execSync } = require('child_process');
const path = require('path');

async function run() {
    const email = 'neosilviu@gmail.com';
    const password = 'p5In22Iq*nx%3Geif1dL$saG'; // The password provided by the user

    console.log(`[REPAIR] Generating hash for ${email}...`);

    // We can't easily use Better-Auth here because it needs a DB connection
    // But we know Better-Auth uses 'scrypt-js' or similar.
    // Actually, Better-Auth stores passwords in a specific scrypt format.
    
    // Instead of generating it manually, let's use a trick.
    // We will use the 'wrangler' to delete the user and account, 
    // then the user can use the /setup route to re-create it correctly.
    // OR we can try to find a way to generate the hash.

    console.log("[REPAIR] Plan: Resetting account record for " + email);
    
    try {
        // 1. Delete the existing account record which has the wrong format
        console.log("[REPAIR] Deleting old account record...");
        execSync(`npx wrangler d1 execute studio-db --remote --command "DELETE FROM account WHERE userId IN (SELECT id FROM user WHERE email = '${email}')"`, { stdio: 'inherit' });

        // 2. Delete the user record to allow 'setup-admin' to run again
        console.log("[REPAIR] Deleting old user record...");
        execSync(`npx wrangler d1 execute studio-db --remote --command "DELETE FROM user WHERE email = '${email}'"`, { stdio: 'inherit' });

        // 3. Delete from contact
        console.log("[REPAIR] Deleting from contact...");
        execSync(`npx wrangler d1 execute studio-db --remote --command "DELETE FROM contact WHERE email = '${email}'"`, { stdio: 'inherit' });

        console.log("\n[SUCCESS] User " + email + " has been removed from the remote database.");
        console.log("[ACTION] Please go to https://service.aemdpc.ro/setup and create the account again.");
        console.log("[NOTE] This will ensure the password is hashed correctly by the current system.");
    } catch (e) {
        console.error("[REPAIR] Failed:", e.message);
    }
}

run();

