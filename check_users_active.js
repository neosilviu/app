const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('backend/local_db.sqlite');

db.all("SELECT name FROM sqlite_master WHERE type='table'", (err, rows) => {
    if (err) {
        console.error("Error reading tables:", err.message);
    } else {
        console.log("TABLES IN DB:", rows.map(r => r.name).join(', '));
    }
    
    db.all("SELECT name, email, role FROM user", (err, rows) => {
        console.log("USERS:", JSON.stringify(rows || [], null, 2));

        db.all("SELECT name, email, role FROM contact", (err, crows) => {
            console.log("contact:", JSON.stringify(crows || [], null, 2));
            db.close();
        });
    });
});

