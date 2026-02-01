
import sqlite3
import json

def check_products():
    conn = sqlite3.connect(r'C:\app\frontend\.wrangler\state\v3\d1\miniflare-D1DatabaseObject\4790caf945f4c2dcb3eae868a32998b398f5c418f5ef67a1b25142c0d441e678.sqlite')
    cursor = conn.cursor()
    
    cursor.execute("SELECT name, tag FROM product_prototype")
    rows = cursor.fetchall()
    for row in rows:
        print(f"Product: {row[0]}, Tag Column: {row[1]}")
    
    conn.close()

if __name__ == "__main__":
    check_products()
