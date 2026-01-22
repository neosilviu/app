const sqlite3 = require('sqlite3').verbose();
const dbPath = ".dev\\.wrangler\\d1\\miniflare-D1DatabaseObject\\4790caf945f4c2dcb3eae868a32998b398f5c418f5ef67a1b25142c0d441e678.sqlite";
const db = new sqlite3.Database(dbPath);

db.serialize(() => {
  db.each("SELECT name, permissions FROM entity_definition WHERE name = 'workspace'", (err, row) => {
    if (err) {
      console.error(err.message);
    }
    console.log(`${row.name}: ${row.permissions}`);
  });
});

db.close();

