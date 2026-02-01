
import sqlite3
import json

def get_product_prototype():
    conn = sqlite3.connect(r'C:\app\frontend\.wrangler\state\v3\d1\miniflare-D1DatabaseObject\4790caf945f4c2dcb3eae868a32998b398f5c418f5ef67a1b25142c0d441e678.sqlite')
    cursor = conn.cursor()
    
    cursor.execute("SELECT fields FROM entity_definition WHERE name = 'product_prototype' OR name = 'product_prototype'")
    row = cursor.fetchone()
    if row:
        fields = json.loads(row[0])
        print(json.dumps(fields, indent=2))
    else:
        print("Entity not found")
    
    conn.close()

if __name__ == "__main__":
    get_product_prototype()
