"""Decode a chatgpt.com/share page's react-router turbo-stream payload into the conversation."""
import re, json, sys, datetime

path = sys.argv[1]
raw = open(path, encoding='utf-8', errors='replace').read()

# 1. collect every streamController.enqueue("<js string>") chunk, in order
PAT = re.compile(r'streamController\.enqueue\(\s*("(?:[^"\\]|\\.)*")\s*\)', re.S)
chunks = [json.loads(m.group(1)) for m in PAT.finditer(raw)]
payload = ''.join(chunks)
print(f'[{path}] enqueue chunks={len(chunks)} payload_chars={len(payload)}', file=sys.stderr)

# the stream is newline-delimited JSON documents; the first is the big flat array
flat = None
for line in payload.split('\n'):
    line = line.strip()
    if not line:
        continue
    try:
        v = json.loads(line)
    except Exception:
        continue
    if isinstance(v, list) and len(v) > 50:
        flat = v
        break
if flat is None:
    print('could not locate flat array', file=sys.stderr)
    sys.exit(1)
print(f'flat array entries={len(flat)}', file=sys.stderr)

SPECIAL = {-1: None, -2: None, -3: float('nan'), -4: float('inf'), -5: None, -6: 0, -7: None}

def hydrate(idx, seen=None):
    if seen is None:
        seen = set()
    if isinstance(idx, int) and idx < 0:
        return SPECIAL.get(idx)
    if not isinstance(idx, int) or idx >= len(flat):
        return idx
    if idx in seen:
        return '<cycle>'
    seen = seen | {idx}
    node = flat[idx]
    if isinstance(node, dict):
        out = {}
        for k, v in node.items():
            key = k[1:] if k.startswith('_') else k
            try:
                key = hydrate(int(key), seen)
            except (ValueError, TypeError):
                pass
            out[key if isinstance(key, str) else str(key)] = hydrate(v, seen)
        return out
    if isinstance(node, list):
        return [hydrate(x, seen) for x in node]
    return node

root = hydrate(0)
json.dump(root, open(path + '.decoded.json', 'w', encoding='utf-8'), ensure_ascii=False, indent=1, default=str)
print('wrote', path + '.decoded.json', file=sys.stderr)

# 2. walk for the conversation
def find(obj, key, hits):
    if isinstance(obj, dict):
        for k, v in obj.items():
            if k == key:
                hits.append(v)
            find(v, key, hits)
    elif isinstance(obj, list):
        for v in obj:
            find(v, key, hits)
    return hits

mappings = find(root, 'mapping', [])
linears = find(root, 'linear_conversation', [])
titles = find(root, 'title', [])
print('mapping hits', len(mappings), 'linear hits', len(linears), 'titles', titles[:3], file=sys.stderr)

nodes = None
if linears and isinstance(linears[0], list) and linears[0]:
    nodes = linears[0]
elif mappings and isinstance(mappings[0], dict):
    nodes = list(mappings[0].values())

if not nodes:
    print('no conversation nodes found', file=sys.stderr)
    sys.exit(2)

def text_of(msg):
    c = msg.get('content') or {}
    parts = c.get('parts')
    out = []
    if isinstance(parts, list):
        for p in parts:
            if isinstance(p, str):
                out.append(p)
            elif isinstance(p, dict):
                out.append(p.get('text') or p.get('content_type') or json.dumps(p, ensure_ascii=False)[:200])
    for k in ('text', 'result', 'thoughts'):
        if c.get(k) and not out:
            out.append(str(c[k]))
    return '\n'.join(x for x in out if x)

lines = []
if titles:
    lines.append(f'# TITLE: {titles[0]}\n')
n = 0
for node in nodes:
    if not isinstance(node, dict):
        continue
    msg = node.get('message')
    if not isinstance(msg, dict):
        continue
    author = (msg.get('author') or {}).get('role', '?')
    ct = ((msg.get('content') or {}).get('content_type')) or ''
    t = text_of(msg)
    ts = msg.get('create_time')
    if isinstance(ts, (int, float)):
        ts = datetime.datetime.utcfromtimestamp(ts).strftime('%Y-%m-%d %H:%M:%SZ')
    if not t or not t.strip():
        continue
    n += 1
    lines.append(f'\n{"="*70}\n[{n}] {author.upper()}  ({ct})  {ts}\n{"="*70}\n{t}')
open(path + '.convo.txt', 'w', encoding='utf-8').write('\n'.join(lines))
print(f'wrote {path}.convo.txt  messages={n}', file=sys.stderr)
