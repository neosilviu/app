import sqlite3
import os

dbs = [
    r"C:\app\.dev\local_db_dev.sqlite",
    r"C:\app\frontend\local_db.sqlite",
    r"C:\app\app.dev.wranglerd1miniflare-D1DatabaseObject'90caf945f4c2dcb3eae868a32998b398f5c418f5ef67a1b25142c0d441e678.sqlite"
]

for db_path in dbs:
    if os.path.exists(db_path):
        print(f"--- Checking {db_path} ---")
        try:
            conn = sqlite3.connect(db_path)
            cursor = conn.cursor()
            cursor.execute("SELECT name FROM sqlite_master WHERE type='table'")
            tables = cursor.fetchall()
            print(f"Tables: {[t[0] for t in tables]}")
            if ('user',) in tables or ('user' in [t[0] for t in tables]):
                cursor.execute("SELECT COUNT(*) FROM user")
                count = cursor.fetchone()[0]
                print(f"User count: {count}")
                if count > 0:
                    cursor.execute("SELECT email, role FROM user")
                    print(cursor.fetchall())
            conn.close()
        except Exception as e:
            print(f"Error: {e}")
    else:
        print(f"Not found: {db_path}")
