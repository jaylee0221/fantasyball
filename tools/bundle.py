import json,re,collections
D=json.load(open('v2.json')); B=json.load(open('bio.json')); W=json.load(open('engine2-weights.json'))
CAP=json.load(open('old-cap.json')); COL=json.load(open('old-colors.json'))
COL.setdefault('NOK',COL['NOH']); COL.setdefault('VAN',{'c1':'#00B2A9','c2':'#E43C40','team':'Vancouver Grizzlies'}); COL.setdefault('CHO',COL['CHA'])
def yy(season): return season[-2:]
def slug(name,used):
    parts=re.sub(r"[^a-zA-Z ]","",name).lower().split(); base=(parts[-1]+parts[0][0]) if parts else 'p'
    s=base; n=1
    while s in used: n+=1; s=f'{base}{n}'
    used.add(s); return s
def eligible(p,bio):
    """nba.com gives G / F / C (and hyphenated pairs). Split guards and forwards by playmaking
    and size, and let every man be eligible at the neighbouring slot — a real roster rarely has
    a specialist at all five spots, and the draft board needs somebody in every column."""
    pos=(bio.get('pos') or ''); ht=bio.get('ht') or 79
    ast=p['p100']['ast']; reb=p['p100']['reb']; blk=p['p100']['blk']
    lead = ast>=6.5 or (ast>=5 and ht<=76)          # runs an offence
    apct=p['adv']['astPct']
    if pos=='G':   return (['PG','SG'] if (ht<=75 or apct>=.35) else ['SG','PG']) if lead else (['SG','PG'] if ht<=77 else ['SG','SF'])
    if pos=='G-F': return ['SG','SF','PG'] if lead else ['SG','SF']
    if pos=='F-G': return ['SF','SG']
    if pos=='F':   return ['PF','SF','C'] if (ht>=82 or reb>=11) else ['SF','PF']
    if pos=='F-C': return ['PF','C','SF']
    if pos=='C-F': return ['C','PF']
    if pos=='C':   return ['C','PF']
    return ['PG','SG'] if ht<=75 else ['SG','SF'] if ht<=78 else ['SF','PF'] if ht<=80 else ['PF','C'] if ht<=82 else ['C','PF']
def merge_elig(old,new):
    """The old file's positions were hand-checked (Wade = SG, Westbrook = PG): keep their primary and order,
    then add the neighbouring slots the stats-based mapping allows, so every column still has men."""
    if not old: return new
    out=list(old)
    for sl in new:
        if sl not in out: out.append(sl)
    return out
teams=[]; players=[]; used=set(); pid_by_key={}
# stable slugs: reuse old ids where the old file had that player-season
for p in D['players']:
    k=f"{p['nbaId']}:{p['season']}"
    if k in CAP: used.add(CAP[k]['id'])
for p in D['players']:
    if p['min']<12: continue
    k=f"{p['nbaId']}:{p['season']}"; bio=B.get(str(p['nbaId']),{})
    pid=CAP[k]['id'] if k in CAP else slug(p['name'],used); pid_by_key[k]=pid
    players.append({'id':pid,'nbaId':p['nbaId'],'name':p['name'],'season':p['season'],'abbr':p['abbr'],'age':p['age'],'gp':p['gp'],'gs':p['gs'],'min':p['min'],
        'eligible':merge_elig(CAP[k]['eligible'] if k in CAP else None, eligible(p,bio)),'ht':bio.get('ht'),'pos':bio.get('pos',''),'jersey':bio.get('jersey',''),
        'capPct':CAP[k]['capPct'] if k in CAP else None,'pg':p['pg'],'p100':p['p100'],'adv':p['adv']})
# salary holes: data/salary-new.json (tools/salary.py, basketball-reference) fills only a capPct the old file lacks
import os
_sn=os.path.join(os.path.dirname(os.path.abspath(__file__)),'..','data','salary-new.json')
if os.path.exists(_sn):
    SN=json.load(open(_sn))['salaries']; _f=0
    for p in players:
        k=f"{p['nbaId']}:{p['season']}"
        if p['capPct'] is None and k in SN: p['capPct']=SN[k]['capPct']; _f+=1
    print('salary-new filled',_f)
byteam=collections.defaultdict(list)
for p in players: byteam[(p['season'],p['nbaId'])]=p
team_players=collections.defaultdict(list)
for p in D['players']:
    if p['min']>=12: team_players[(p['season'],p['nbaTeamId'])].append(pid_by_key[f"{p['nbaId']}:{p['season']}"])
for t in D['teams']:
    ab=[p['abbr'] for p in D['players'] if p['nbaTeamId']==t['nbaTeamId'] and p['season']==t['season']]
    abbr=collections.Counter(ab).most_common(1)[0][0] if ab else 'UNK'
    c=COL.get(abbr,{'c1':'#444','c2':'#999'})
    key=lambda i:pid_by_key.get(f"{i}:{t['season']}")
    teams.append({'id':f"{abbr.lower()}{yy(t['season'])}",'nbaTeamId':t['nbaTeamId'],'team':t['team'],'season':t['season'],'abbr':abbr,'c1':c['c1'],'c2':c['c2'],
        'record':t['record'],'ortg':t['ortg'],'drtg':t['drtg'],'pace':t['pace'],
        'starters':[key(i) for i in t['starters']],'playoffStarters':[key(i) for i in t['playoffStarters']],'players':team_players[(t['season'],t['nbaTeamId'])]})
tid={(t['season'],t['nbaTeamId']):t['id'] for t in teams}
series=[]
for s in D['series']:
    if not s.get('winner'): continue
    a,b=s['teams']; series.append({'season':s['season'],'round':s['round'],'teams':[tid[(s['season'],a)],tid[(s['season'],b)]],'home':tid[(s['season'],s['games'][0]['home'])],'winner':tid[(s['season'],s['winner'])],'score':s['score']})
out={'meta':{'built':D['meta']['built'],'seasons':D['meta']['seasons'],'engine':'v2'},'weights':W,'teams':teams,'players':players,'series':series}
# ---- pack for the client: round, then store stats as arrays keyed by meta.pgKeys / advKeys
PGK=['pts','reb','ast','stl','blk','tov','fgm','fga','fg3m','fg3a','ftm','fta']
ADVK=['usg','ts','efg','threePAr','ftr','astPct','rebPct','orebPct','drebPct','tovPct','ortg','drtg','netrtg','pace','pie']
out['meta']['pgKeys']=PGK; out['meta']['advKeys']=ADVK
for p in out['players']:
    p['min']=round(p['min'],1)
    if p['capPct'] is not None: p['capPct']=round(p['capPct'],3)
    p['pg']=[round(p['pg'][k],1) for k in PGK]; p['p100']=[round(p['p100'][k],1) for k in PGK]
    p['adv']=[round(p['adv'][k],3) for k in ADVK]
w=out['weights']; w['SM']={k:[round(v[0],3),round(v[1],3)] for k,v in w['SM'].items()}
w['LGO']={k:round(v,2) for k,v in w['LGO'].items()}; w['LGD']={k:round(v,2) for k,v in w['LGD'].items()}
json.dump(out,open('beatball-v2-bundle.json','w'),separators=(',',':'))
open('beatball-v2-bundle.js','w').write('const BEATBALL_V2='+json.dumps(out,separators=(',',':'))+';')
ids=[t['id'] for t in teams]; dup=[k for k,v in collections.Counter(ids).items() if v>1]
print('teams',len(teams),'dup ids',dup[:5],'players',len(players),'with salary',sum(1 for p in players if p['capPct'] is not None),'series',len(series))
print('sample',next(t for t in teams if t['id']=='gsw17')['starters'],next(t for t in teams if t['id']=='bos24')['starters'])
import os; print('bundle bytes',os.path.getsize('beatball-v2-bundle.js'))
