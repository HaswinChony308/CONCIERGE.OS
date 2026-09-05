import re
import json

with open('stitch_screen.html', 'r', encoding='utf-8') as f:
    content = f.read()

print("HTML length:", len(content))

# Look for data chunks
matches = re.findall(r'AF_initDataCallback\((.*?)\);', content, re.DOTALL)
print(f"AF_initDataCallback calls: {len(matches)}")
for i, m in enumerate(matches):
    print(f"\n--- CHUNK {i} ---")
    print(m[:300])

# Look for screen ID or project ID mentions
print("\nSearching for IDs:")
for match in re.finditer(r'(15a112ff|17980187401088952448)', content):
    start = max(0, match.start() - 100)
    end = min(len(content), match.end() + 100)
    print("Context around ID:")
    print(content[start:end])

# Search for any hosted URLs or image links
urls = re.findall(r'https?://[^\s"\'<>]+', content)
print(f"\nTotal URLs found: {len(urls)}")
for u in urls:
    if any(k in u for k in ['storage', 'blob', 'cdn', 'image', 'screen', 'project', 'googleusercontent']):
        print("Relevant URL:", u)

