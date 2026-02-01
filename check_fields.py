import sqlite3
import json

db_path = r'C:\app\frontend\.wrangler\state\v3\d1\miniflare-D1DatabaseObject\4790caf945f4c2dcb3eae868a32998b398f5c418f5ef67a1b25142c0d441e678.sqlite'

def check_db():
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    cursor.execute("SELECT fields FROM entity_definition WHERE name = 'product_prototype'")
    row = cursor.fetchone()
    if row:
        fields = json.loads(row[0])
        for f in fields:
            if f.get('name') in ['tag', 'tag_copy_dij']:
                print(f"Field: {f.get('name')}")
                print(json.dumps(f, indent=2))
    
    conn.close()

if __name__ == "__main__":
    check_db()
