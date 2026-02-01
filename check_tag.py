
import sqlite3
import json

def check_tag():
    conn = sqlite3.connect(r'C:\app\frontend\.wrangler\state\v3\d1\miniflare-D1DatabaseObject\4790caf945f4c2dcb3eae868a32998b398f5c418f5ef67a1b25142c0d441e678.sqlite')
    cursor = conn.cursor()
    
    cursor.execute("SELECT id, name FROM tag WHERE id = 'd1136b3a-af9f-4e2f-b395-f271a9aa6da9'")
    row = cursor.fetchone()
    if row:
        print(f"Tag Found: ID={row[0]}, Name={row[1]}")
    else:
        print("Tag NOT Found")
        # List all tags to be sure
        cursor.execute("SELECT id, name FROM tag")
        print("All Tags:")
        for r in cursor.fetchall():
            print(f"ID={r[0]}, Name={r[1]}")
    
    conn.close()

if __name__ == "__main__":
    print("Starting check_tag...")
    check_tag()
