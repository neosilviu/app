
import sqlite3
import os

db_path = r'C:\app\.dev\.wrangler\d1\miniflare-D1DatabaseObject\4790caf945f4c2dcb3eae868a32998b398f5c418f5ef67a1b25142c0d441e678.sqlite'

if not os.path.exists(db_path):
    print(f"File not found: {db_path}")
else:
    conn = sqlite3.connect(db_path)
    try:
        users = conn.execute("SELECT email FROM user").fetchall()
        print(f"Users found: {users}")
    except Exception as e:
        print(f"Error: {e}")
    finally:
        conn.close()
