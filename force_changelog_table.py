import sqlite3
import os

db_paths = [
    'backend-v2/db/local_db.sqlite',
    '.dev/local_db_dev.sqlite',
    'local_db.sqlite'
]

for db_path in db_paths:
    if os.path.exists(db_path):
        print(f"Updating {db_path}...")
        try:
            conn = sqlite3.connect(db_path)
            c = conn.cursor()
            c.execute('DROP TABLE IF EXISTS changelog')
            c.execute('''
                CREATE TABLE IF NOT EXISTS changelog (
                    id TEXT PRIMARY KEY,
                    module TEXT DEFAULT 'System',
                    version TEXT NOT NULL,
                    title TEXT NOT NULL,
                    description TEXT,
                    type TEXT DEFAULT 'improvement',
                    workspaceId TEXT DEFAULT 'system',
                    archived INTEGER DEFAULT 0,
                    archivedAt DATETIME,
                    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
                    updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
                    deletedAt DATETIME,
                    createdBy TEXT,
                    updatedBy TEXT
                )
            ''')
            conn.commit()
            conn.close()
            print(f"Successfully updated {db_path}")
        except Exception as e:
            print(f"Failed to update {db_path}: {e}")
    else:
        print(f"Path {db_path} not found")
