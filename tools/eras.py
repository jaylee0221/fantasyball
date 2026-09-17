"""
Extend the fantasy universe back to 1977-78 (steals, blocks and turnovers all exist from then).

Pulls from basketball-reference, one request every 4 seconds, cached in tools/.cache/bbref/:
  - per-game totals for every player-season 1977-78 … 1995-96  (leagues/NBA_{yyyy}_per_game.html)
  - team records + abbreviations for those seasons              (leagues/NBA_{yyyy}_standings.html)
  - salaries 1984-85 … 1995-96 where bbref has them              (teams/{ABBR}/{yyyy}.html, the Salaries table)
Writes data/eras.json: {players:[...], teams:[...]} in the bundle-full shape (pg keys identical to data/bundle-full.json),
with p100/adv left empty (the engine is not used for these years) and eligible positions from the listed position.
Then tools/lite.js merges it when present.

Usage:  python3 tools/eras.py fetch | build
"""
import json, os, re, sys, time, urllib.request, html
HERE=os.path.dirname(os.path.abspath(__file__)); CACHE=os.path.join(HERE,'.cache','bbref'); os.makedirs(CACHE,exist_ok=True)
BASE='https://www.basketball-reference.com'
SEASONS=list(range(1978,1997))     # end year: 1978 = 1977-78 … 1996 = 1995-96
UA={'User-Agent':'Mozilla/5.0 (fantasyball data tool; contact via github.com/jaylee0221)'}
def get(path):
    f=os.path.join(CACHE,re.sub(r'[^A-Za-z0-9_.-]','_',path)+'.html')
    if os.path.exists(f): return open(f,encoding='utf-8').read()
    req=urllib.request.Request(BASE+path,headers=UA); raw=urllib.request.urlopen(req,timeout=40).read().decode('utf-8','replace')
    open(f,'w',encoding='utf-8').write(raw); time.sleep(4); return raw
def table_rows(page,table_id):
    m=re.search(r'<table[^>]*id="%s"[^>]*>(.*?)</table>'%table_id,page,re.S)
    if not m: return []
    body=m.group(1).replace('<!--','').replace('-->','')
    rows=[]
    for tr in re.findall(r'<tr[^>]*>(.*?)</tr>',body,re.S):
        cells={}
        for stat,inner in re.findall(r'<t[dh][^>]*data-stat="([^"]+)"[^>]*>(.*?)</t[dh]>',tr,re.S):
            txt=html.unescape(re.sub(r'<[^>]+>','',inner)).strip(); cells[stat]=txt
            a=re.search(r'href="/players/[a-z]/([^"]+)\.html"',inner)
            if a: cells['_pid']=a.group(1)
            a=re.search(r'href="/teams/([A-Z]{3})/',inner)
            if a and stat in('team_id','team_name_abbr','team'): cells['_abbr']=a.group(1)
        if cells: rows.append(cells)
    return rows
def fetch():
    for y in SEASONS:
        get(f'/leagues/NBA_{y}_per_game.html'); get(f'/leagues/NBA_{y}_standings.html'); print('season',y,'ok',flush=True)
    for y in range(1985,1997):
        st=table_rows(get(f'/leagues/NBA_{y}_standings.html'),'divs_standings_E')+table_rows(get(f'/leagues/NBA_{y}_standings.html'),'divs_standings_W')
        for r in st:
            ab=r.get('_abbr')
            if ab: get(f'/teams/{ab}/{y}.html')
        print('salaries',y,'ok',flush=True)
def f(v,default=0.0):
    try: return float(v)
    except: return default
def build():
    pg_keys=['pts','reb','ast','stl','blk','tov','fgm','fga','fg3m','fg3a','ftm','fta','oreb','dreb','pf','min']
    players=[]; teams=[]
    for y in SEASONS:
        season=f'{y-1}-{str(y)[2:]}'
        page=get(f'/leagues/NBA_{y}_per_game.html'); rows=table_rows(page,'per_game_stats')
        seen=set()
        for r in rows:
            name=r.get('player') or r.get('name_display'); ab=r.get('_abbr') or r.get('team_id') or r.get('team_name_abbr')
            if not name or not ab or ab in('TOT','2TM','3TM'): continue
            pid=(r.get('_pid') or re.sub(r'\W','',name).lower())+'_'+str(y)
            if pid in seen: continue   # first team row for traded men
            seen.add(pid)
            pos=(r.get('pos') or 'SF').split('-')[0].replace('G','SG').replace('F','SF') if r.get('pos') in ('G','F') else (r.get('pos') or 'SF').split('-')[0]
            pos={'G':'SG','F':'SF','C':'C','PG':'PG','SG':'SG','SF':'SF','PF':'PF'}.get(pos,'SF')
            pg=[f(r.get(k2)) for k2 in ['pts','trb','ast','stl','blk','tov','fg','fga','fg3','fg3a','ft','fta','orb','drb','pf','mp']]
            players.append({'id':pid,'name':name,'season':season,'abbr':ab,'eligible':[pos],'gp':int(f(r.get('games') or r.get('g'))),'gs':int(f(r.get('games_started') or r.get('gs'))),'min':f(r.get('mp')),'ht':None,'jersey':None,'capPct':None,'pg':pg,'p100':[],'adv':[],'era':True})
        st=table_rows(get(f'/leagues/NBA_{y}_standings.html'),'divs_standings_E')+table_rows(get(f'/leagues/NBA_{y}_standings.html'),'divs_standings_W')
        for r in st:
            ab=r.get('_abbr'); nm=re.sub(r'\*','',r.get('team_name') or '').strip()
            if not ab or not nm: continue
            w=int(f(r.get('wins'))); l=int(f(r.get('losses')))
            men=[p['id'] for p in players if p['season']==season and p['abbr']==ab]
            teams.append({'id':(ab+str(y)[2:]).lower(),'team':nm,'abbr':ab,'season':season,'record':{'w':w,'l':l},'players':men,'starters':[],'c1':None,'c2':None,'era':True})
        print(season,'players',sum(1 for p in players if p['season']==season),'teams',sum(1 for t in teams if t['season']==season),flush=True)
    # salaries 1984-85+ (bbref team pages); capPct = salary / cap
    caps={1985:3600000,1986:4233000,1987:4945000,1988:6164000,1989:7232000,1990:9802000,1991:11871000,1992:12500000,1993:14000000,1994:15175000,1995:15964000,1996:23000000}
    filled=0
    for y in range(1985,1997):
        season=f'{y-1}-{str(y)[2:]}'
        for t in [t for t in teams if t['season']==season]:
            try: page=get(f"/teams/{t['abbr']}/{y}.html")
            except Exception as e: continue
            rows=table_rows(page,'salaries2')
            for r in rows:
                pid=r.get('_pid'); sal=f(re.sub(r'[^\d.]','',r.get('salary','')),None)
                if not pid or not sal: continue
                for p in players:
                    if p['season']==season and p['id'].startswith(pid+'_'): p['capPct']=round(sal/caps[y],4); filled+=1; break
    print('salaries filled',filled)
    json.dump({'players':players,'teams':teams,'pgKeys':pg_keys},open(os.path.join(HERE,'..','data','eras.json'),'w'))
    print('data/eras.json written:',len(players),'players',len(teams),'teams')
if __name__=='__main__':
    {'fetch':fetch,'build':build}[sys.argv[1]]()
