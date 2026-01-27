
import sqlite3
import os

db_path = r'C:\app\frontend\.wrangler\state\v3\d1\miniflare-D1DatabaseObject\4790caf945f4c2dcb3eae868a32998b398f5c418f5ef67a1b25142c0d441e678.sqlite'

if not os.path.exists(db_path):
    print(f"ERROR: File not found at {db_path}")
    exit(1)

conn = sqlite3.connect(db_path)
cursor = conn.cursor()

try:
    cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='user'")
    if not cursor.fetchone():
        print("Table 'user' does not exist in this database.")
    else:
        cursor.execute("SELECT id, email, role FROM user")
        users = cursor.fetchall()
        print(f"Found {len(users)} users:")
        for u in users:
            print(f"  - ID: {u[0]}, Email: {u[1]}, Role: {u[2]}")
except Exception as e:
    print(f"Error: {e}")
finally:
    conn.close()
