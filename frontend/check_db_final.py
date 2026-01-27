import sqlite3
import os

# Find the sqlite file
base_path = r'C:\app\.dev\.wrangler\v3\d1\miniflare-D1DatabaseObject'
if not os.path.exists(base_path):
    print(f"Path not found: {base_path}")
    exit(1)

files = [f for f in os.listdir(base_path) if f.endswith('.sqlite')]
if not files:
    print("No .sqlite files found")
    exit(1)

db_path = os.path.join(base_path, files[0])
print(f"Connecting to: {db_path}")

conn = sqlite3.connect(db_path)
cursor = conn.cursor()

try:
    cursor.execute("SELECT name FROM sqlite_master WHERE type='table'")
    tables = [t[0] for t in cursor.fetchall()]
    print(f"Tables found: {len(tables)}")
    
    if 'user' in tables:
        cursor.execute("SELECT id, email, role FROM user")
        users = cursor.fetchall()
        print(f"Users found: {len(users)}")
        for u in users:
            print(f"  User: {u}")
    else:
        print("Table 'user' does not exist")
    
    if '_debug_logs' in tables:
        cursor.execute("SELECT msg, ts FROM _debug_logs ORDER BY ts DESC")
        logs = cursor.fetchall()
        print(f"Debug Logs found: {len(logs)}")
        for l in logs:
            print(f"  [{l[1]}] {l[0]}")
    else:
        print("Table '_debug_logs' does not exist yet")

except Exception as e:
    print(f"Error: {e}")

conn.close()
