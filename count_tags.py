
import sqlite3
db_path = r'C:\app\frontend\.wrangler\state\v3\d1\miniflare-D1DatabaseObject\4790caf945f4c2dcb3eae868a32998b398f5c418f5ef67a1b25142c0d441e678.sqlite'
conn = sqlite3.connect(db_path)
cursor = conn.cursor()
cursor.execute("SELECT COUNT(*) FROM tag")
print(f"Total tags: {cursor.fetchone()[0]}")
conn.close()
