# Fill the salary holes: player-seasons in data/bundle-full.json with capPct == null.
# Source: basketball-reference team pages (the "Salaries" table) + its salary-cap history page.
#   python tools/salary.py fetch   # polite scrape into tools/.cache/bbref (>=4s between requests, cached)
#   python tools/salary.py build   # match -> data/salary-new.json + data/salary-unmatched.csv
#   python tools/salary.py apply   # write capPct into data/bundle-full.json (same rule bundle.py uses)
# Matching: bbref has no nbaId, so name + team + season; a traded man is matched on name + season when
# exactly one bundle player of that name played that season (match='name+season').
import json, os, re, sys, time, csv, unicodedata, collections
import requests
from bs4 import BeautifulSoup

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CACHE = os.path.join(ROOT, 'tools', '.cache', 'bbref')
BASE = 'https://www.basketball-reference.com'
WAIT = 4.0  # sports-reference allows 20 requests/minute; stay under it
UA = {'User-Agent': 'Mozilla/5.0 (fantasyball salary backfill; one-off, cached)'}
# every bundle season; only null capPct values are ever filled (the old file covered about half of each roster)
SEASONS = [f'{y}-{str(y + 1)[-2:]}' for y in range(1996, 2026)]

def end_year(season): return int(season[:4]) + 1

def bbref_code(abbr, season):
    y = end_year(season)
    if abbr == 'BKN': return 'BRK'
    if abbr == 'PHX': return 'PHO'
    if abbr == 'CHA': return 'CHO' if y >= 2015 else 'CHA'
    if abbr == 'WAS': return 'WSB' if y <= 1997 else 'WAS'
    return abbr

_last = [0.0]
def get(path, name):
    os.makedirs(CACHE, exist_ok=True)
    fn = os.path.join(CACHE, name)
    if os.path.exists(fn): return unmangle(open(fn, encoding='utf-8').read())
    wait = WAIT - (time.time() - _last[0])
    if wait > 0: time.sleep(wait)
    r = requests.get(BASE + path, headers=UA, timeout=30); _last[0] = time.time()
    if r.status_code == 429: sys.exit(f'429 rate-limited at {path} — stop and retry in an hour')
    if r.status_code != 200: print('  ', r.status_code, path); return None
    text = r.content.decode('utf-8', 'replace')  # bbref sends no charset; requests would guess latin-1 (Jokić -> JokiÄ)
    open(fn, 'w', encoding='utf-8').write(text)
    return text

def unmangle(text):
    """Cache files written before the decode fix hold latin-1-decoded UTF-8; undo that, leave clean files alone."""
    try: return text.encode('latin-1').decode('utf-8')
    except (UnicodeEncodeError, UnicodeDecodeError): return text

def table(html, tid):
    m = re.search(r'<table[^>]*id="%s".*?</table>' % tid, html, re.S)  # bbref hides most tables in comments
    return BeautifulSoup(m.group(0), 'lxml') if m else None

def caps():
    h = get('/contracts/salary-cap-history.html', 'salary-cap-history.html')
    # the table sits inside a comment on this page, so read the rows straight off the text
    rows = re.findall(r'data-stat="year_id"[^>]*>(?:<a[^>]*>)?(\d{4}-\d{2})(?:</a>)?</th>\s*<td[^>]*data-stat="cap"[^>]*>\$([\d,]+)', h)
    return {s: int(v.replace(',', '')) for s, v in rows}

def old():
    return json.load(open(os.path.join(ROOT, 'data', 'salary-old.json')))

def bundle():
    return json.load(open(os.path.join(ROOT, 'data', 'bundle-full.json')))

def team_pages(B):
    seen = sorted({(t['season'], t['abbr']) for t in B['teams'] if t['season'] in SEASONS})
    return [(s, a, bbref_code(a, s)) for s, a in seen]

def fetch():
    B = bundle(); c = caps(); print('caps', {s: c.get(s) for s in SEASONS})
    pages = team_pages(B)
    for i, (s, a, code) in enumerate(pages):
        y = end_year(s); name = f'{code}_{y}.html'
        cached = os.path.exists(os.path.join(CACHE, name))
        h = get(f'/teams/{code}/{y}.html', name)
        print(f'{i+1}/{len(pages)} {s} {a}->{code}', 'cached' if cached else 'fetched' if h else 'MISSING', flush=True)

SUFFIX = re.compile(r'\b(jr|sr|ii|iii|iv|v)\b')
# nba.com name -> bbref name, where no rule can bridge them (name changes, single names)
ALIAS = {'enes freedom': 'enes kanter', 'nene': 'nene hilario'}
def norm(name):
    name = name.replace('ё', 'e').replace('е', 'e')  # bbref writes Egor Dëmin with a Cyrillic ё
    n = unicodedata.normalize('NFKD', name).encode('ascii', 'ignore').decode().lower()
    n = re.sub(r'[^a-z ]', '', n.replace('-', ' '))
    n = ' '.join(SUFFIX.sub('', n).split())
    return ALIAS.get(n, n)

def build():
    B = bundle(); CAPS = caps()
    rows = []  # (season, abbr, bbrefId, name, salary)
    for s, a, code in team_pages(B):
        fn = os.path.join(CACHE, f'{code}_{end_year(s)}.html')
        if not os.path.exists(fn): print('no page', s, a, code); continue
        t = table(unmangle(open(fn, encoding='utf-8').read()), 'salaries2')
        if not t: print('no salary table', s, a, code); continue
        for r in t.find_all('tr'):
            p = r.find('td', {'data-stat': 'player'}); sal = r.find('td', {'data-stat': 'salary'})
            if not p or not sal: continue
            v = sal.get('csk') or re.sub(r'\D', '', sal.get_text())
            if not v: continue
            rows.append((s, a, p.get('data-append-csv'), p.get_text(strip=True), int(v)))
    # a man can show twice on one team (waived + re-signed): take the larger figure
    by_team = {}; by_name = collections.defaultdict(list)
    for s, a, bid, name, v in rows:
        k = (s, a, norm(name))
        if k not in by_team or v > by_team[k][2]: by_team[k] = (bid, name, v)
    for (s, a, n), val in by_team.items(): by_name[(s, n)].append((a,) + val)
    # nickname fallback (Steven/Steve Smith, Ike/Isaac Austin, Dan/Danny Schayes): same team + season,
    # same surname and first initial, and exactly one such man on each side
    sur = lambda n: (n.split()[-1], n[:1]) if n else ('', '')
    by_sur = collections.defaultdict(list)
    for (s, a, n), val in by_team.items(): by_sur[(s, a) + sur(n)].append(val)
    OLD = old()  # decide by the old file, not by null: re-running after `apply` must rebuild every new salary
    need = [p for p in B['players'] if p['season'] in SEASONS and f"{p['nbaId']}:{p['season']}" not in OLD]
    names_in_bundle = collections.Counter((p['season'], norm(p['name'])) for p in B['players'])
    sur_in_bundle = collections.Counter((p['season'], p['abbr']) + sur(norm(p['name'])) for p in B['players'])
    out, miss = {}, []
    for p in need:
        s, n = p['season'], norm(p['name']); cap = CAPS.get(s)
        hit, how = by_team.get((s, p['abbr'], n)), 'name+team+season'
        if not hit and names_in_bundle[(s, n)] == 1:
            cands = by_name.get((s, n), [])
            if cands:  # traded: bundle keeps one team; bbref lists him on each — same season salary, take the max
                a, bid, name, v = max(cands, key=lambda x: x[3]); hit, how = (bid, name, v), 'name+season'
        if not hit:
            k = (s, p['abbr']) + sur(n)
            if len(by_sur.get(k, [])) == 1 and sur_in_bundle[k] == 1: hit, how = by_sur[k][0], 'surname+initial+team+season'
        if not hit or not cap:
            miss.append({'season': s, 'abbr': p['abbr'], 'name': p['name'], 'nbaId': p['nbaId'], 'id': p['id'],
                         'gp': p['gp'], 'min': p['min'], 'starter': int(any(p['id'] in t['starters'] for t in B['teams'] if t['season'] == s)),
                         'reason': 'no cap value' if not cap else 'no bbref salary row'})
            continue
        bid, name, v = hit
        out[f"{p['nbaId']}:{s}"] = {'id': p['id'], 'capPct': round(v / cap, 4), 'salary': v, 'cap': cap, 'bbrefId': bid, 'bbrefName': name, 'match': how}
    json.dump({'meta': {'source': 'basketball-reference team salary tables', 'built': time.strftime('%Y-%m-%d'), 'seasons': SEASONS,
                        'caps': {s: CAPS.get(s) for s in SEASONS}}, 'salaries': out},
              open(os.path.join(ROOT, 'data', 'salary-new.json'), 'w'), indent=1, ensure_ascii=False)
    with open(os.path.join(ROOT, 'data', 'salary-unmatched.csv'), 'w', newline='') as f:
        w = csv.DictWriter(f, fieldnames=['season', 'abbr', 'name', 'nbaId', 'id', 'gp', 'min', 'starter', 'reason']); w.writeheader()
        for m in sorted(miss, key=lambda m: (m['season'], m['abbr'], m['name'])): w.writerow(m)
    print('needed', len(need), 'matched', len(out), collections.Counter(v['match'] for v in out.values()), 'unmatched', len(miss),
          'unmatched starters', sum(m['starter'] for m in miss))

def apply():
    """Same rule as tools/bundle.py: salary-new only fills player-seasons the old file doesn't have (safe to re-run)."""
    fn = os.path.join(ROOT, 'data', 'bundle-full.json'); B = json.load(open(fn))
    S = json.load(open(os.path.join(ROOT, 'data', 'salary-new.json')))['salaries']; OLD = old(); n = 0
    for p in B['players']:
        k = f"{p['nbaId']}:{p['season']}"
        if k not in OLD and k in S: p['capPct'] = round(S[k]['capPct'], 3); n += 1
    json.dump(B, open(fn, 'w'), separators=(',', ':'))
    print('filled', n)

if __name__ == '__main__':
    {'fetch': fetch, 'build': build, 'apply': apply}[sys.argv[1] if len(sys.argv) > 1 else 'build']()
