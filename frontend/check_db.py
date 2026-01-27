import sqlite3
import os

# Find the sqlite file
base_path = r'C:\app\frontend\.dev\.wrangler\v3\d1\miniflare-D1DatabaseObject'
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
    tables = cursor.fetchall()
    print(f"Tables: {tables}")
    
    if ('user',) in tables:
        cursor.execute("SELECT id, email, role FROM user")
        users = cursor.fetchall()
        print(f"Users found: {len(users)}")
        for u in users:
            print(f"  User: {u}")
    else:
        print("Table 'user' does not exist")
        
except Exception as e:
    print(f"Error: {e}")

conn.close()
