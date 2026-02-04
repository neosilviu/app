import sqlite3
import os

db_path = os.path.join("backend-v2", "db", "local_db.sqlite")
if not os.path.exists(db_path):
    print(f"Database not found at {db_path}")
else:
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    cursor.execute("PRAGMA table_info(changelog)")
    columns = cursor.fetchall()
    print("Columns in 'changelog' table:")
    for col in columns:
        print(col)
    conn.close()
