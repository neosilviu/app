// Repair Admin script
// This script will promote the first user it finds to superadmin and fix the workspaceId

import sqlite3 from 'sqlite3';
import { open } from 'sqlite';

async function repair() {
    const db = await open({
        filename: 'C:/app/.dev/local_db_dev.sqlite',
        driver: sqlite3.Database
    });

    console.log("Checking users...");
    const users = await db.all("SELECT * FROM user");
    
    if (users.length === 0) {
        console.log("NO USERS FOUND. Please register via /setup first.");
        await db.close();
        return;
    }

    console.log(`Found ${users.length} users. Promoting all to superadmin...`);
    
    await db.run("UPDATE user SET role = 'superadmin', workspaceId = 'system'");
    
    console.log("Done! Please refresh the page in your browser.");
    await db.close();
}

repair().catch(console.error);
