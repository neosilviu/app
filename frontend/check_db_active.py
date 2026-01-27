import sqlite3
import os

# Find the sqlite file in .dev (root)
db_path = r'C:\app\.dev\.wrangler\v3\d1\miniflare-D1DatabaseObject\4790caf945f4c2dcb3eae868a32998b398f5c418f5ef67a1b25142c0d441e678.sqlite'
if not os.path.exists(db_path):
    print(f"Path not found: {db_path}")
    exit(1)

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
            
    if 'contact' in tables:
        cursor.execute("SELECT id, email, role FROM contact")
        contacts = cursor.fetchall()
        print(f"Contacts found: {len(contacts)}")
        for c in contacts:
            print(f"  Contact: {c}")

except Exception as e:
    print(f"Error: {e}")

conn.close()
