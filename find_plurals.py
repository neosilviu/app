import re

with open('registry-baseline.ts', 'r', encoding='utf-8') as f:
    content = f.read()

matches = re.findall(r'\b[A-Z_]+S\b', content)
unique_matches = sorted(list(set(matches)))
print(unique_matches)
