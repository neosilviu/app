const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const dbPath = path.join(__dirname, '..', '.dev', 'local_db_dev.sqlite');
const db = new sqlite3.Database(dbPath);

db.all("SELECT name, sql FROM sqlite_master WHERE type='index' AND tbl_name='interaction'", (err, rows) => {
  if (err) {
    console.error('Error querying sqlite_master:', err.message);
    process.exit(1);
  }
  console.log('Indexes on interaction:');
  rows.forEach(r => console.log(r.name + ' -> ' + (r.sql || '[no definition]')));
  db.close();
});

