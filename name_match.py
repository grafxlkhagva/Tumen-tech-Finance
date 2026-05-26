"""
Харилцагчийн нэр тулгах utility
=================================
norm()      — нэрийг стандарт болгоно (дагавар хасах, UPPER, үг sort)
is_match()  — хоёр нэр ижил эсэхийг шалгана
match_partner() — VatRecord-ийн нэр/регистрийг Partner жагсаалттай тулгана

Тулгах дараалал:
  1. ТТД регистр — хамгийн найдвартай
  2. Нэрийн norm()-д яг тохирол
  3. Compact prefix (6 тэмдэгт) — богино нэрүүд

Аюулгүй байдлын шалгалт:
  • len(norm) < 3  → тулгалт хийхгүй (хоосон нэр бүгдтэй таарна гэсэн алдаанаас хамгаалах)
  • register < 5 тэмдэгт → регистрийн тулгалт хийхгүй
"""

import re

# ── Хасагдах дагаврууд ──────────────────────────────────────────────────────
_SUFFIX_PAT = re.compile(
    r'\b(ХХК|ХК|ТББ|ТӨХК|ХОАТ|ТӨК|ТУК|НТ|'
    r'LLC|LLP|CO|INC|LTD|CORP|JSC|NGO)\b\.?',
    re.IGNORECASE | re.UNICODE,
)

# Цэг, таслал, хаалт, ишлэл гэх мэт
_PUNCT_PAT  = re.compile(r'["""\'«»()\.\,\-_/\\;:@#№]')
# Олон зай
_SPACE_PAT  = re.compile(r'\s+')


def norm(name: str) -> str:
    """
    Нэрийг стандарт болгоно:
      1. UPPER
      2. ХХК / LLC гэх мэт дагавар хасна
      3. Цэг, хаалт хасна
      4. Олон зайг нэг зай болгоно
      5. Үгийг sort хийнэ → "Болд Дорж" == "Дорж Болд"

    >>> norm('"Лонг хоул трак"')  →  'ЛОНГ ТРАК ХОУЛ'   (sorted)
    >>> norm('ЛОНГ ХОУЛ ТРАК ХХК') → 'ЛОНГ ТРАК ХОУЛ'   (ХХК хасагдана, sorted)
    """
    if not name or not isinstance(name, str):
        return ''
    s = name.upper()
    s = _SUFFIX_PAT.sub(' ', s)
    s = _PUNCT_PAT.sub(' ', s)
    s = _SPACE_PAT.sub(' ', s).strip()
    words = sorted(s.split())          # Үгийн дараалал нормчилно
    return ' '.join(words)


def norm_compact(name: str) -> str:
    """Зай хассан norm — prefix харьцуулалтад ашиглана."""
    return norm(name).replace(' ', '')


def is_match(a: str, b: str, min_len: int = 3, prefix: int = 10) -> bool:
    """
    Хоёр нэр ижил харилцагчийг заасан эсэхийг шалгана.

    Аргументууд:
      min_len  — norm compact-ийн хамгийн богино урт (хоосон нэрнээс хамгаалах)
      prefix   — prefix тулгалтын урт (10 — монгол нэрүүдэд аюулгүй хязгаар)
                 Анхны 6 байсан боловч "МЯГМАР" гэх мэт 6 тэмдэгт дундын нэрүүд
                 буруу тааруулагдаж байсан тул 10 болгон нэмэгдүүллээ.
                 Жишээ: НЯМДОРЖ МЯГМАРДОРЖ vs МЯГМАР ОТГОНЖАРГАЛ →
                   prefix=6: "МЯГМАР" == "МЯГМАР" → буруу таарна
                   prefix=10: "МЯГМАРДОРЖ" ≠ "МЯГМАРОТГО" → зөв алгасана

    Шалгах дараалал:
      1. len шалгалт — min_len-ээс бага бол False (хоосон нэр бүгдтэй таарахаас хамгаалах)
      2. Яг тохирол compact == compact
      3. Prefix: ХОЁР тал хоёулаа >= prefix байвал эхний N тэмдэгт харьцуулна
         (нэг тал богино бол prefix тулгалт хийхгүй → яг тохирол л ажиллана)
         Жишээ: 'БОЛД' (4) vs 'БОЛДБААТАР' (10) → 4 < 10 → prefix хийхгүй → False

    Мэдэгдэж буй хязгаарлалт:
      'М М Капитал' vs 'ММКапитал' → norm-ийн sort-оор compact form өөр болж
      таарч чадахгүй. Регистрийн тулгалтаар илрүүлэх ёстой.
    """
    na = norm_compact(a)
    nb = norm_compact(b)

    # 1. Хоосон / богино нэр тулгалт хийхгүй
    if len(na) < min_len or len(nb) < min_len:
        return False

    # 2. Яг тохирол
    if na == nb:
        return True

    # 3. Prefix тулгалт — хоёул хангалттай урт байвал л
    if len(na) >= prefix and len(nb) >= prefix:
        return na[:prefix] == nb[:prefix]

    return False


def _get_aliases(partner) -> list:
    """Partner.aliases JSON текстийг задлана. Алдаа бол хоосон жагсаалт."""
    raw = getattr(partner, 'aliases', None)
    if not raw:
        return []
    try:
        import json
        return [str(a) for a in json.loads(raw) if a]
    except Exception:
        return []


def match_partner(vat_name: str, vat_register: str, partners):
    """
    VatRecord-ийн нэр/регистрийг Partner жагсаалттай тулгана.
    Олдвол Partner объект буцаана, олдохгүй бол None.

    Тулгах дараалал:
      1. ТТД регистр яг тохирол  ← хамгийн найдвартай
      2. Мастер нэр is_match
      3. Alias жагсаалтын аль нэг is_match  ← Mapping sheet-ийн хувилбар нэрүүд

    Ижил нэртэй өөр харилцагч:
      Регистр байвал регистрийн тулгалт давамгайлна → буруу тааруулахаас хамгаалагдана.
    """
    if not partners:
        return None

    reg = (vat_register or '').strip()
    na  = norm_compact(vat_name)

    # ── 1. Регистрийн тулгалт ──
    if len(reg) >= 5:
        for p in partners:
            if p.register and p.register.strip() == reg:
                return p

    # ── 2 & 3. Нэр + Alias тулгалт ──
    if len(na) < 3:
        return None   # Хоосон нэрийг бүгдтэй таарна гэж тооцохгүй

    for p in partners:
        # Мастер нэр
        if is_match(vat_name, p.name):
            return p
        # Alias жагсаалт
        for alias in _get_aliases(p):
            if is_match(vat_name, alias):
                return p

    return None


# ── Тест ────────────────────────────────────────────────────────────────────
if __name__ == '__main__':
    import sys, io
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

    cases = [
        ('"Лонг хоул трак"',        'ЛОНГ ХОУЛ ТРАК ХХК',           True),
        ('Болд Дорж',               'Дорж Болд',                     True),
        ('',                        'Ямар нэг ХХК',                  False),   # хоосон
        ('гolomt банк',             'GOLOMT BANK',                   False),   # кирилл/латин хольж болохгүй
        ('М М Капитал ХХК',         'ММКапитал',                     False),   # sort-оор compact өөр → регистрээр тулгана
        ('Ган-Эрдэнэ',              'Ганэрдэнэ',                     True),    # дефис хасагдана
        ('Болд',                    'Болдбаатар',                    False),   # хэтэрхий богино prefix
        # Буруу тааралтын тест — МЯГМАР дундын нэр
        ('МЯГМАР ОТГОНЖАРГАЛ',      'НЯМДОРЖ МЯГМАРДОРЖ',            False),   # prefix=10: таарч болохгүй
        ('ПҮРЭВСҮРЭН МЯГМАРСҮРЭН',  'НЯМДОРЖ МЯГМАРДОРЖ',            False),   # таарч болохгүй
        ('МЯГМАР ОТГОНЖАРГАЛ',      'МЯГМАР ОТГОНЖАРГАЛ',            True),    # яг тохирол
    ]
    print(f"{'A':<36} {'B':<36} {'Хүл':>5}  {'Дүн':>5}  OK")
    print('-' * 88)
    all_ok = True
    for a, b, expected in cases:
        result = is_match(a, b)
        ok = 'OK' if result == expected else 'АЛДАА'
        if result != expected:
            all_ok = False
        print(f"{a:<36} {b:<36} {str(expected):>5}  {str(result):>5}  {ok}")
    print()
    print('Бүх тест амжилттай!' if all_ok else 'АЛДААТАЙ ТЕСТ БИЙ!')
