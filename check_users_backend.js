const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('backend/local_db.sqlite');

db.all("SELECT name, role FROM user", (err, rows) => {
    if (err) console.error(err);
    else console.log("USERS:", rows);
    db.close();
});
