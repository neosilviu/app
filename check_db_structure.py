import sqlite3
try:
    conn = sqlite3.connect('local_db.sqlite')
    cursor = conn.cursor()
    cursor.execute("SELECT name FROM sqlite_master WHERE type='table'")
    tables = [r[0] for r in cursor.fetchall()]
    print("Tables:", tables)
    
    if 'changelog' in tables:
        cursor.execute("PRAGMA table_info(changelog)")
        print("Changelog columns:", [r[1] for r in cursor.fetchall()])
        cursor.execute("SELECT COUNT(*) FROM changelog")
        print("Changelog count:", cursor.fetchone()[0])
    
    conn.close()
except Exception as e:
    print("Error:", e)
