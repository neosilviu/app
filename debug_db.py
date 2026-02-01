
import sqlite3
db_path = r'C:\app\frontend\.wrangler\state\v3\d1\miniflare-D1DatabaseObject\4790caf945f4c2dcb3eae868a32998b398f5c418f5ef67a1b25142c0d441e678.sqlite'
conn = sqlite3.connect(db_path)
cursor = conn.cursor()
cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name LIKE 'product%'")
print(cursor.fetchall())

print("\n--- Rows from tag table ---")
cursor.execute("SELECT id, name, workspaceId FROM tag LIMIT 10")
for row in cursor.fetchall():
    print(row)

conn.close()
