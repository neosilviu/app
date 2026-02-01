import sqlite3; import json; conn = sqlite3.connect(r'C:\app\frontend\.wrangler\state\v3\d1\miniflare-D1DatabaseObject\4790caf945f4c2dcb3eae868a32998b398f5c418f5ef67a1b25142c0d441e678.sqlite'); row = conn.execute('SELECT fields FROM entity_definition WHERE id = \
afe6ec71-9fff-408e-833a-0577fce835de\').fetchone(); print(json.dumps(json.loads(row[0]), indent=2))
