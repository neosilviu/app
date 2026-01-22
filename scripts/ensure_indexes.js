const { createDatabase } = require('../backend/lib/db');

(async () => {
  const db = await createDatabase();
  console.log('[INDEXER] Ensuring important indexes...');

  try {
    // Get list of tables from sqlite_master
    const tablesRes = await db.query("SELECT name FROM sqlite_master WHERE type='table'");
    const tables = (tablesRes.results || []).map(r => r.name).filter(n => !n.startsWith('sqlite_'));

    for (const table of tables) {
      try {
        const info = await db.query(`PRAGMA table_info(${table})`);
        const cols = (info.results || []).map(r => r.name);

        // Always ensure index on `name` if present
        if (cols.includes('name')) {
          const idx = `idx_${table}_name`;
          await db.query(`CREATE INDEX IF NOT EXISTS ${idx} ON ${table} (name)`);
          console.log(`[INDEXER] Ensured index ${idx}`);
        }

        // Additional guaranteed indexes for contact
        if (table === 'contact') {
          if (cols.includes('phone')) {
            await db.query(`CREATE INDEX IF NOT EXISTS idx_contacts_phone ON contact (phone)`);
            console.log('[INDEXER] Ensured index idx_contacts_phone');
          }
          if (cols.includes('email')) {
            await db.query(`CREATE INDEX IF NOT EXISTS idx_contacts_email ON contact (email)`);
            console.log('[INDEXER] Ensured index idx_contacts_email');
          }
          if (cols.includes('name')) {
            await db.query(`CREATE INDEX IF NOT EXISTS idx_contacts_name ON contact (name)`);
            console.log('[INDEXER] Ensured index idx_contacts_name');
          }
        }

      } catch (e) {
        console.warn(`[INDEXER] Failed to ensure indexes for ${table}: ${e.message}`);
      }
    }

    console.log('[INDEXER] Done.');
  } catch (e) {
    console.error('[INDEXER] Error:', e.message);
    process.exit(1);
  }

  process.exit(0);
})();

