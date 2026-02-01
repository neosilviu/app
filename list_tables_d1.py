
import sqlite3
conn = sqlite3.connect(r'C:\app\frontend\.wrangler\state\v3\d1\miniflare-D1DatabaseObject\4790caf945f4c2dcb3eae868a32998b398f5c418f5ef67a1b25142c0d441e678.sqlite')
cursor = conn.cursor()
cursor.execute("SELECT name FROM sqlite_master WHERE type='table'")
print(cursor.fetchall())
conn.close()
