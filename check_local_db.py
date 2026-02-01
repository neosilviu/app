import sqlite3
import json

db_path = r'C:\app\frontend\.wrangler\state\v3\d1\miniflare-D1DatabaseObject\4790caf945f4c2dcb3eae868a32998b398f5c418f5ef67a1b25142c0d441e678.sqlite'

def query_db():
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    print("=== TABLES ===")
    cursor.execute("SELECT name FROM sqlite_master WHERE type='table';")
    tables = cursor.fetchall()
    for t in tables:
        print(t[0])
        
    print("\n=== ENTITY_DEFINITION FOR PRODUCT_PROTOTYPE ===")
    try:
        cursor.execute("SELECT * FROM entity_definition WHERE name = 'product_prototype';")
        row = cursor.fetchone()
        if row:
            columns = [column[0] for column in cursor.description]
            res = dict(zip(columns, row))
            print(json.dumps(res, indent=2))
        else:
            print("Not found in entity_definition")
    except Exception as e:
        print(f"Error: {e}")
        
    conn.close()

if __name__ == "__main__":
    query_db()
