import sqlite3
import json

conn = sqlite3.connect('local_db.sqlite')
cursor = conn.cursor()
cursor.execute("SELECT id, category, content FROM _ai_prompt")
for row in cursor.fetchall():
    print(f"ID: {row[0]}, Category: {row[1]}")
    print(f"Content: {row[2][:100]}...")
    print("-" * 20)
conn.close()
