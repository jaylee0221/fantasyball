import json,math,numpy as np,collections
from sklearn.linear_model import Ridge, LogisticRegression
D=json.load(open('v2.json')); B=json.load(open('bio.json'))
P={(p['nbaId'],p['season']):p for p in D['players']}
T={(t['season'],t['nbaTeamId']):t for t in D['teams']}
LG=collections.defaultdict(list)
for t in D['teams']: LG[t['season']].append(t)
LGO={s:float(np.mean([t['ortg'] for t in v])) for s,v in LG.items()}; LGD={s:float(np.mean([t['drtg'] for t in v])) for s,v in LG.items()}
pool=[p for p in D['players'] if p['min']>=15]
STATS=['pts','reb','ast','stl','blk','tov','fg3m','fga','fta']
SM={}
for se in LG:
    sub=[p for p in pool if p['season']==se]
    for k in STATS: v=[p['p100'][k] for p in sub]; SM[f'{se}:{k}']=[float(np.mean(v)),float(np.std(v))]
    for k in ['ts','threePAr','rebPct','usg']: v=[p['adv'][k] for p in sub]; SM[f'{se}:{k}']=[float(np.mean(v)),float(np.std(v))]
    v=[LGD[se]-p['adv']['drtg'] for p in sub]; SM[f'{se}:onDef']=[float(np.mean(v)),float(np.std(v))]
    v=[p['adv']['ortg']-LGO[se] for p in sub]; SM[f'{se}:onOff']=[float(np.mean(v)),float(np.std(v))]
z=lambda p,k,v:(v-SM[f"{p['season']}:{k}"][0])/SM[f"{p['season']}:{k}"][1]
def tax(ps):
    u=sum(p['adv']['usg'] for p in ps)*100
    if u<=100: return [1.0]*5
    cut=u-100; dep=[p['adv']['astPct']*100+p['adv']['tovPct'] for p in ps]; s=sum(dep) or 1
    return [max(.6,1-(cut*d/s)/(p['adv']['usg']*100)) for p,d in zip(ps,dep)]
def offfeats(ps):
    f=tax(ps); x=[]
    for k in ['pts','ast','fg3m','tov']: x.append(sum(z(p,k,p['p100'][k])*fi for p,fi in zip(ps,f)))
    for k in ['fta','fga']: x.append(sum(z(p,k,p['p100'][k]) for p in ps))
    x.append(float(np.mean([z(p,'ts',p['adv']['ts']) for p in ps]))); x.append(float(np.mean([z(p,'threePAr',p['adv']['threePAr']) for p in ps])))
    x.append(float(np.mean([z(p,'rebPct',p['adv']['rebPct']) for p in ps]))); x.append(sum(p['adv']['usg'] for p in ps)*100-100)
    return x
OFFLAB=['pts','ast','3pm','tov','fta','fga','ts','3PAr','reb%','usg+']
def boxdef(p): return 0.35*z(p,'stl',p['p100']['stl'])+0.35*z(p,'blk',p['p100']['blk'])+0.2*z(p,'rebPct',p['adv']['rebPct'])+0.1*((B[str(p['nbaId'])]['ht']-79)/3.5)
def playerdef(p): return 0.6*max(-2.5,min(2.5,z(p,'onDef',LGD[p['season']]-p['adv']['drtg'])))+0.4*max(-2.5,min(2.5,boxdef(p)))
def deffeat(ps): return [float(np.mean([playerdef(p) for p in ps]))]
def five(t,po=False):
    ids=t['playoffStarters'] if po and len(t['playoffStarters'])==5 else t['starters']
    ps=[P.get((i,t['season'])) for i in ids]; return None if any(p is None for p in ps) else ps
rows=[(t['season'],offfeats(ps),deffeat(ps),t['ortg']-LGO[t['season']],t['drtg']-LGD[t['season']]) for t in D['teams'] if (ps:=five(t))]
tr=[r for r in rows if r[0]<'2016-17']; te=[r for r in rows if r[0]>='2016-17']
mo=Ridge(alpha=3).fit([r[1] for r in tr],[r[3] for r in tr]); print('ORtg from box five: R2 train %.2f test %.2f'%(mo.score([r[1] for r in tr],[r[3] for r in tr]),mo.score([r[1] for r in te],[r[3] for r in te])))
print(' ',' '.join(f'{l}{w:+.2f}' for l,w in zip(OFFLAB,mo.coef_)))
md=Ridge(alpha=1).fit([r[2] for r in tr],[r[4] for r in tr]); print('DRtg from DEF composite (60 on-court/40 box): R2 train %.2f test %.2f coef %.2f'%(md.score([r[2] for r in tr],[r[4] for r in tr]),md.score([r[2] for r in te],[r[4] for r in te]),md.coef_[0]))
# series
sr=[]
for s in D['series']:
    if not s.get('winner'): continue
    a,b=s['teams']; A,Bt=T[(s['season'],a)],T[(s['season'],b)]; fa,fb=five(A,True),five(Bt,True)
    if not fa or not fb: continue
    na=mo.predict([offfeats(fa)])[0]-md.predict([deffeat(fa)])[0]; nb=mo.predict([offfeats(fb)])[0]-md.predict([deffeat(fb)])[0]
    sr.append((s['season'],na-nb,1 if s['games'][0]['home']==a else -1,1 if s['winner']==a else 0))
st=[r for r in sr if r[0]<'2016-17']; ste=[r for r in sr if r[0]>='2016-17']
lr=LogisticRegression(C=10).fit([[r[1],r[2]] for r in st],[r[3] for r in st])
for lab,sub in [('train',st),('test 2016+',ste),('all',sr)]:
    X=[[r[1],r[2]] for r in sub]; y=[r[3] for r in sub]; p=lr.predict_proba(X)[:,1]
    acc=np.mean([(pi>=.5)==(yi==1) for pi,yi in zip(p,y)]); ll=-np.mean([math.log(pi if yi else 1-pi) for pi,yi in zip(p,y)])
    buck={}
    for pi,yi in zip(p,y): k=min(int(max(pi,1-pi)*10),9); buck.setdefault(k,[0,0]); buck[k][0]+=1; buck[k][1]+=(yi==1)==(pi>=.5)
    print(f'series {lab:11s} acc {100*acc:.1f}% ll {ll:.3f} n={len(sub)} | '+' '.join(f'{k*10}s:{100*v[1]/v[0]:.0f}%/{v[0]}' for k,v in sorted(buck.items())))
print('net coef %.3f home coef %.3f → home = %.1f net pts'%(lr.coef_[0][0],lr.coef_[0][1],lr.coef_[0][1]/lr.coef_[0][0]))
json.dump({'SM':SM,'LGO':LGO,'LGD':LGD,'off':{'labels':OFFLAB,'coef':mo.coef_.tolist(),'b':float(mo.intercept_)},'def':{'coef':float(md.coef_[0]),'b':float(md.intercept_)},'series':{'net':float(lr.coef_[0][0]),'home':float(lr.coef_[0][1]),'b':float(lr.intercept_[0])}},open('engine2-weights.json','w'))
