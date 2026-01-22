
const sqlite3 = require('sqlite3').verbose();
const dbPath = process.env.NODE_ENV === 'production' ? 'backend/local_db.sqlite' : '.dev/local_db_dev.sqlite';
const db = new sqlite3.Database(dbPath);

db.get('SELECT COUNT(*) as count FROM contact', (err, row) => {
    if (err) {
        console.error('Error counting contact:', err);
    } else {
        console.log('Total contact:', row.count);
    }
    
    db.all('SELECT workspaceId, COUNT(*) as count FROM contact GROUP BY workspaceId', (err, rows) => {
        if (err) {
            console.error('Error counting contact by workspace:', err);
        } else {
            console.log('contact by Workspace:', rows);
        }
        
        db.get('SELECT * FROM workspace LIMIT 1', (err, ws) => {
           console.log('Sample Workspace:', ws);
           db.close();
        });
    });
});

