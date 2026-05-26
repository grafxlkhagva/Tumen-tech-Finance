import io, sys, json, re
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

with open(r'C:\Users\natsa\Desktop\2026\tsalin\цаг_бүртгэл.html', encoding='utf-8') as f:
    content = f.read()

# INITIAL_ASSETS эхлэлийг олох
idx   = content.find('const INITIAL_ASSETS = [')
start = content.index('[', idx)

# Bracket matching
depth = 0
i = start
in_str = False
escape = False
while i < len(content):
    ch = content[i]
    if escape:
        escape = False
        i += 1; continue
    if ch == '\\' and in_str:
        escape = True
        i += 1; continue
    if ch == '"' and not in_str:
        in_str = True
        i += 1; continue
    if ch == '"' and in_str:
        in_str = False
        i += 1; continue
    if not in_str:
        if ch == '[': depth += 1
        elif ch == ']':
            depth -= 1
            if depth == 0:
                end = i + 1
                break
    i += 1

raw = content[start:end]

# JS // comment мөрүүдийг устгах
raw = re.sub(r'//[^\n]*', '', raw)
# Trailing comma арилгах
raw = re.sub(r',(\s*[}\]])', r'\1', raw)

data = json.loads(raw)

# Компаниудаар ялгах
companies = {}
for a in data:
    c = a.get('company', '?')
    companies[c] = companies.get(c, 0) + 1

print(f'Нийт INITIAL_ASSETS: {len(data)}')
for c, n in sorted(companies.items()):
    print(f'  {c}: {n}')

tt = [a for a in data if 'ТҮМЭН ТЭЭХ' in a.get('company', '').upper()]
print(f'\nТҮМЭН ТЭЭХ ХХК: {len(tt)} хөрөнгө')
print()
print(f'{"Код":8s} {"Нэр":38s} {"Ангилал":25s} {"Огноо":12s} {"Үнэ":>13s} {"Ж":>4s} {"Хариуцагч":15s} {"Статус"}')
print('-'*125)
total = 0
for a in tt:
    print(f"{a['code']:8s} {a['name']:38s} {a['category']:25s} {a['purchaseDate']:12s} "
          f"{a['purchasePrice']:>13,.0f} {a['usefulLife']:>4} {a.get('custodian',''):15s} {a.get('status','active')}")
    total += a['purchasePrice']
print('-'*125)
print(f'{"НИЙТ":>89s} {total:>13,.0f}')

# JSON хэлбэрээр хадгалах
with open('tt_assets_raw.json', 'w', encoding='utf-8') as f:
    json.dump(tt, f, ensure_ascii=False, indent=2)
print(f'\ntt_assets_raw.json хадгалагдлаа')
