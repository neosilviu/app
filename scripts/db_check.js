const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');
const path = require('path');

function findSqliteFiles(dir, fileList = []) {
  const files = fs.readdirSync(dir);
  files.forEach(file => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    if (stat.isDirectory()) {
      findSqliteFiles(filePath, fileList);
    } else if (file.endsWith('.sqlite')) {
      fileList.push(filePath);
    }
  });
  return fileList;
}

const devDir = path.resolve('/app/.dev');
const sqliteFiles = findSqliteFiles(devDir);

console.log(`Found ${sqliteFiles.length} SQLite files in .dev directory.\n`);

sqliteFiles.forEach(file => {
  const db = new sqlite3.Database(file, sqlite3.OPEN_READONLY, (err) => {
    if (err) {
      console.log(`[${file}] Error opening: ${err.message}`);
      return;
    }
    
    db.get("SELECT COUNT(*) as count FROM user", (err, row) => {
      if (err) {
        if (err.message.includes("no such table: user")) {
          console.log(`[${file}] Table 'user' does not exist.`);
        } else {
          console.log(`[${file}] Error: ${err.message}`);
        }
      } else {
        console.log(`[${file}] User count: ${row.count}`);
      }
      db.close();
    });
  });
});
