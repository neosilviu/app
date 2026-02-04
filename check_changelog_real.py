import sqlite3
import os

db_path = 'backend-v2/db/local_db.sqlite'
if not os.path.exists(db_path):
    print(f"File {db_path} not found")
    exit(1)

conn = sqlite3.connect(db_path)
c = conn.cursor()
c.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='changelog'")
print(f"Table exists: {c.fetchone()}")
conn.close()
