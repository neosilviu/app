const { createDatabase } = require('../backend/lib/db');

async function fix() {
    const db = await createDatabase();
    
    // Find workspace with gmailConfig
    const workspace = await db.query("SELECT * FROM workspace");
    const wsList = workspace.results || workspace;
    
    let sourceSettings = null;
    for (const ws of wsList) {
        let s = ws.settings;
        if (typeof s === 'string') s = JSON.parse(s);
        if (s.modules && s.modules.gmail && s.modules.gmail.clientId) {
            sourceSettings = s;
            console.log(`Found Gmail credentials in workspace: ${ws.id}`);
            break;
        }
    }
    
    if (!sourceSettings) {
        console.log('No Gmail credentials found in any workspace in the local DB.');
        return;
    }
    
    // Update 'system' workspace
    const systemWs = await db.get('workspace', 'system');
    let sysSettings = systemWs.settings;
    if (typeof sysSettings === 'string') sysSettings = JSON.parse(sysSettings);
    
    // Inject gmailConfig
    sysSettings.gmailConfig = sourceSettings.modules.gmail;
    // Also inject into modules root for fallback
    sysSettings.clientId = sourceSettings.modules.gmail.clientId;
    sysSettings.clientSecret = sourceSettings.modules.gmail.clientSecret;
    sysSettings.refreshToken = sourceSettings.modules.gmail.refreshToken;
    
    await db.query("UPDATE workspace SET settings = ? WHERE id = 'system'", [JSON.stringify(sysSettings)]);
    console.log('Successfully injected Gmail credentials into "system" workspace.');
    process.exit(0);
}

fix();

