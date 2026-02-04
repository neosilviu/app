import sqlite3
import os
import uuid

db_path = os.path.join("backend-v2", "db", "local_db.sqlite")

if os.path.exists(db_path):
    conn = sqlite3.connect(db_path)
    c = conn.cursor()
    
    # Cloudflare Credentials (recovered from system logs)
    cf_account_id = '1ee6235f1d9f54e97869e1620f5cb51e'
    
    settings = [
        ('ai_help_provider', 'ai_config', 'help_provider', 'cloudflare'),
        ('ai_help_model', 'ai_config', 'help_model', '@cf/meta/llama-3.1-8b-instruct'),
        ('ai_changelog_provider', 'ai_config', 'changelog_provider', 'cloudflare'),
        ('ai_changelog_model', 'ai_config', 'changelog_model', '@cf/meta/llama-3.1-8b-instruct'),
        ('cf_account_id', 'system_setting', 'cloudflare_account_id', cf_account_id)
    ]
    
    for id, ns, key, val in settings:
        c.execute("INSERT OR REPLACE INTO system_setting (id, namespace, key, value, dataType) VALUES (?, ?, ?, ?, 'text')", (id, ns, key, val))
        
    conn.commit()
    conn.close()
    print("Successfully updated local database with AI overrides.")
else:
    print(f"Database not found at {db_path}")
