(function(){
/* ============================================================================
   FANTASYBALL — the fantasy universe.
   Nine familiar categories, ranked season by season since 1996. No simulation.
   History → Player → Build (a five, scored 9-cat head-to-head) → You.
   ============================================================================ */
'use strict';
/* one bundle for the whole app: adapt the engine bundle into the shape this module reads */
const D=(function(B){ const teams={}; for(const t of B.teams) teams[t.abbr+':'+t.season]={team:t.team,c1:t.c1,c2:t.c2,w:t.record.w,l:t.record.l};
  const players=B.players.map(p=>({id:p.id,n:p.name,s:p.season,t:p.abbr,pos:p.eligible[0],el:p.eligible,gp:p.gp,min:p.min,ht:p.ht,j:p.jersey||null,cap:p.capPct,pg:p.pg}));
  const fives=B.teams.map(t=>({id:t.id,team:t.team,s:t.season,w:t.record.w,l:t.record.l,ids:t.starters})).filter(x=>x.ids&&x.ids.length===5);
  return {meta:{seasons:B.meta.seasons,pgKeys:B.meta.pgKeys},teams,players,fives}; })(BEATBALL_V2);
const PK=D.meta.pgKeys, pgi=Object.fromEntries(PK.map((k,i)=>[k,i]));
const pg=(p,k)=>p.pg[pgi[k]];
const CATS=['pts','reb','ast','stl','blk','fg3m','fgp','ftp','tov'];
const CAT_LABEL={pts:'PTS',reb:'REB',ast:'AST',stl:'STL',blk:'BLK',fg3m:'3PM',fgp:'FG%',ftp:'FT%',tov:'TO'};
/* presets: which categories count, and with what weight */
const PRESETS={
  '9cat':{name:'9-cat',w:{pts:1,reb:1,ast:1,stl:1,blk:1,fg3m:1,fgp:1,ftp:1,tov:1}},
  '8cat':{name:'8-cat · no TO',w:{pts:1,reb:1,ast:1,stl:1,blk:1,fg3m:1,fgp:1,ftp:1,tov:0}},
  'points':{name:'Points',points:true},
  'puntft':{name:'Punt FT%',w:{pts:1,reb:1,ast:1,stl:1,blk:1,fg3m:1,fgp:1,ftp:0,tov:1}},
  'punt3':{name:'Punt 3PM',w:{pts:1,reb:1,ast:1,stl:1,blk:1,fg3m:0,fgp:1,ftp:1,tov:1}}};
const fmt=(v,d=1)=>(Math.round(v*10**d)/10**d).toFixed(d);
const pct3=v=>(v).toFixed(3).replace(/^0/,'');
const short2=s=>"'"+s.slice(2,4)+'-'+s.slice(-2);
const last=p=>p.n.split(' ').slice(-1)[0];
const first=p=>p.n.split(' ').slice(0,-1).join(' ');
const teamOf=p=>D.teams[p.t+':'+p.s]||{team:p.t,c1:'#3A4150',c2:'#8A9099'};
const price=p=>p.cap!=null?Math.round(p.cap*100):null;
const CAP=100;

/* ---------- the category numbers of one man ---------- */
function raw(p){ const fga=pg(p,'fga'),fta=pg(p,'fta');
  return {pts:pg(p,'pts'),reb:pg(p,'reb'),ast:pg(p,'ast'),stl:pg(p,'stl'),blk:pg(p,'blk'),fg3m:pg(p,'fg3m'),tov:pg(p,'tov'),
    fgp:fga?pg(p,'fgm')-fga*0.46:0, ftp:fta?pg(p,'ftm')-fta*0.76:0,   // volume-weighted: made above what a league shooter would make on those attempts
    fgpct:fga?pg(p,'fgm')/fga:0, ftpct:fta?pg(p,'ftm')/fta:0, fgm:pg(p,'fgm'),fga,ftm:pg(p,'ftm'),fta}; }
/* fantasy points, the common ESPN-style formula */
const fpts=p=>pg(p,'pts')+1.2*pg(p,'reb')+1.5*pg(p,'ast')+3*pg(p,'stl')+3*pg(p,'blk')-pg(p,'tov');

/* ---------- season pools, z-scores, ranks (computed once) ---------- */
const POOL_MIN=20, POOL_GP=40;
const SEASON={};   // season → {pool:[{p,r,z:{cat:z}}], mean, sd}
(function(){ for(const s of D.meta.seasons){ const pool=D.players.filter(p=>p.s===s&&p.min>=POOL_MIN&&p.gp>=POOL_GP).map(p=>({p,r:raw(p)}));
  const mean={},sd={}; for(const c of CATS){ const v=pool.map(x=>c==='tov'?-x.r.tov:x.r[c]); mean[c]=v.reduce((a,b)=>a+b,0)/v.length; sd[c]=Math.sqrt(v.reduce((a,b)=>a+(b-mean[c])**2,0)/v.length)||1; }
  for(const x of pool){ x.z={}; for(const c of CATS) x.z[c]=((c==='tov'?-x.r.tov:x.r[c])-mean[c])/sd[c]; x.fp=fpts(x.p); }
  SEASON[s]={pool,mean,sd}; } })();
const ROW=Object.fromEntries(Object.values(SEASON).flatMap(S=>S.pool.map(x=>[x.p.id,x])));
/* the row for any player-season, even outside the pool (bench men): z against that season's pool */
function rowOf(p){ if(ROW[p.id]) return ROW[p.id]; const S=SEASON[p.s]; if(!S) return null; const r=raw(p); const z={}; for(const c of CATS) z[c]=((c==='tov'?-r.tov:r[c])-S.mean[c])/S.sd[c]; return {p,r,z,fp:fpts(p),bench:true}; }
function value(x,preset){ const P=PRESETS[preset]; if(P.points) return x.fp; return CATS.reduce((a,c)=>a+P.w[c]*x.z[c],0); }
function ranked(season,preset){ const rows=season==='all'?Object.values(SEASON).flatMap(S=>S.pool):SEASON[season].pool; return rows.map(x=>({x,v:value(x,preset)})).sort((a,b)=>b.v-a.v); }
const RANK={};  // preset → season → id → rank
function rankOf(id,preset){ const x=ROW[id]; if(!x) return null; const s=x.p.s; RANK[preset]=RANK[preset]||{}; if(!RANK[preset][s]){ const m={}; ranked(s,preset).forEach((r,i)=>m[r.x.p.id]=i+1); RANK[preset][s]=m; } return RANK[preset][s][id]||null; }
function careerOf(name,preset){ return D.meta.seasons.map(s=>{ const x=SEASON[s].pool.find(y=>y.p.n===name); return x?{s,x,rank:rankOf(x.p.id,preset),v:value(x,preset)}:null; }).filter(Boolean); }

/* ---------- state ---------- */
const STORE='fantasyball.universe.v1';
const S={tab:'history',season:'2005-06',preset:'9cat',view:null,sheet:null,q:'',pick:null,five:[],fives:[],vs:null,side:null};
function save(){ try{ localStorage.setItem(STORE,JSON.stringify({five:S.five,fives:S.fives.slice(0,20),preset:S.preset,season:S.season})); }catch(e){} }
function load(){ try{ const j=JSON.parse(localStorage.getItem(STORE)||'null'); if(j) Object.assign(S,j); }catch(e){} }

/* ---------- the field: 892 real starting fives ---------- */
const PID=Object.fromEntries(D.players.map(p=>[p.id,p]));
const FIELD=(D.fives||[]).map(f=>({...f,men:f.ids.map(id=>PID[id]).filter(Boolean)})).filter(f=>f.men.length===5);
function vsField(five,preset){ const res={w:0,l:0,t:0,cat:{}}; CATS.forEach(c=>res.cat[c]={w:0,n:0}); for(const f of FIELD){ const H=h2h(five,f.men,preset); if(H.wa>H.wb) res.w++; else if(H.wa<H.wb) res.l++; else res.t++; for(const r of H.rows){ res.cat[r.c].n++; if(r.win==='a') res.cat[r.c].w++; } }
  const best=FIELD.map(f=>({f,H:h2h(five,f.men,preset)})).filter(x=>x.H.wa<x.H.wb).sort((a,b)=>(a.H.wa-a.H.wb)-(b.H.wa-b.H.wb)).slice(0,3);
  return Object.assign(res,{best}); }
/* ---------- team totals & head-to-head ---------- */
function totals(five){ const rs=five.map(raw); const t={}; for(const k of ['pts','reb','ast','stl','blk','fg3m','tov','fgm','fga','ftm','fta']) t[k]=rs.reduce((a,r)=>a+r[k],0); t.fgpct=t.fga?t.fgm/t.fga:0; t.ftpct=t.fta?t.ftm/t.fta:0; return t; }
function h2h(A,B,preset){ const a=totals(A), b=totals(B); const P=PRESETS[preset]; const rows=[]; let wa=0,wb=0;
  for(const c of CATS){ if(!P.points&&!P.w[c]) continue; const ka=c==='fgp'?a.fgpct:c==='ftp'?a.ftpct:a[c], kb=c==='fgp'?b.fgpct:c==='ftp'?b.ftpct:b[c]; const win=c==='tov'?(ka<kb?'a':ka>kb?'b':'-'):(ka>kb?'a':ka<kb?'b':'-'); if(win==='a')wa++; else if(win==='b')wb++; rows.push({c,a:ka,b:kb,win}); }
  return {rows,wa,wb,a,b}; }
const showCat=(c,v)=>c==='fgp'||c==='ftp'?pct3(v):fmt(v,1);

/* ---------- views ---------- */
const HOST=document.getElementById('mode-build');
function topBar(right){ return `<div class="top"><div class="brand" data-tab="history"><span class="ball"></span><b>FANTASYBALL</b></div><span class="meta">${right||''}</span></div>`; }
function tabs(){ return `<nav class="tabs">${[['history','History'],['matchup','Matchup'],['you','You']].map(([k,l])=>`<span data-tab="${k}" class="${S.tab===k?'on':''}">${l}</span>`).join('')}</nav>`; }
const presetChips=()=>`<div class="catsel">${Object.entries(PRESETS).map(([k,P])=>`<span data-preset="${k}" class="${S.preset===k?'on':''}">${P.name}</span>`).join('')}</div>`;
function lineOf(r){ return `${fmt(r.pts)}p ${fmt(r.reb)}r ${fmt(r.ast)}a · ${fmt(r.stl)}s ${fmt(r.blk)}b · ${fmt(r.fg3m)} 3s · FG ${Math.round(r.fgpct*100)} FT ${Math.round(r.ftpct*100)}`; }
const fv=v=>(v>=0?'+':'−')+fmt(Math.abs(v),1);

function dock(){ const five=S.five.map(id=>PID[id]).filter(Boolean); if(!five.length) return ''; const cost=five.reduce((a,p)=>a+(price(p)||0),0); const unpriced=five.filter(p=>price(p)==null).length;
  return `<div class="dock"><div class="cap"><span>My five · ${five.length} of 5${unpriced?` · ${unpriced} unpriced`:''} · $${CAP}M cap</span><b class="${CAP-cost<0?'over':''}">$${CAP-cost}M left</b></div>
    <div class="five5">${[0,1,2,3,4].map(i=>{const p=five[i]; return p?`<div class="f5 on" data-player="${p.id}"><i>${p.pos}</i><b>${last(p)}</b><em>${short2(p.s).slice(0,3)}</em></div>`:'<div class="f5"><i>·</i><b class="open">open</b></div>';}).join('')}</div>
    ${five.length===5?`<button class="big-cta" data-matchup>Matchup</button>`:''}</div>`; }
function searchResults(){ const q=S.q.trim().toLowerCase(); if(q.length<2) return ''; const names={}; for(const p of D.players){ if(p.n.toLowerCase().includes(q)) (names[p.n]=names[p.n]||[]).push(p); }
  const items=Object.entries(names).slice(0,14).map(([n,ps])=>{ const best=ps.map(p=>({p,x:rowOf(p)})).filter(o=>o.x).sort((a,b)=>value(b.x,S.preset)-value(a.x,S.preset))[0]; const kings=ps.filter(p=>rankOf(p.id,S.preset)===1).length; const pr=ps.map(price).filter(v=>v!=null);
    return `<div class="rk" data-player="${(best?best.p:ps[0]).id}"><i>${kings?'<span class="pill king">'+kings+'×</span>':''}</i><div><div class="nm">${n}</div><div class="ln">${ps.length} season${ps.length>1?'s':''} · ${ps[0].pos}${best?` · best ${short2(best.p.s)} ${fv(value(best.x,S.preset))}`:''}${pr.length?` · $${Math.min(...pr)}–${Math.max(...pr)}M`:''}</div></div><b>›</b></div>`; });
  return `<div class="rank">${items.join('')||'<p class="line" style="padding:12px">Nobody by that name.</p>'}</div><p class="line">Tap a name — his best season opens; switch seasons on the bars.</p>`; }
function viewHistory(){ const all=S.season==='all'; const rows=ranked(S.season,S.preset).slice(0,all?40:30);
  const yrs=['all',...D.meta.seasons.slice().reverse()]; const searching=S.q.trim().length>=2;
  return `<div class="stage ${S.five.length?'draft':''}"><div class="big">${all?'All-time.':'Fantasy history.'}<small>${all?'The best fantasy seasons since 1996, every preset.':'Ranked the way a league would. Tap a man, pick his season, add him.'}</small></div>
    ${presetChips()}
    <div class="search"><input id="q" type="search" placeholder="Search any player" value="${S.q.replace(/"/g,'&quot;')}" autocomplete="off"><i>${S.q?'×':'⌕'}</i></div>
    ${searching?searchResults():`<div class="yrs" id="yrs">${yrs.map(y=>`<span data-season="${y}" class="${S.season===y?'on':''} ${y==='all'?'all':''}">${y==='all'?'All-time':short2(y)}</span>`).join('')}</div>
    <div class="rank">${rows.map((r,i)=>`<div class="rk ${i===0?'one':''} ${S.five.includes(r.x.p.id)?'mine':''}" data-player="${r.x.p.id}"><i>${i+1}</i><div><div class="nm">${r.x.p.n}${i===0?`<span class="pill king">${all?'GOAT':'King of '+short2(S.season).slice(0,3)}</span>`:''}</div><div class="ln">${r.x.p.t} ${short2(r.x.p.s)} · ${lineOf(r.x.r)}</div></div><b>${PRESETS[S.preset].points?fmt(r.v,1):fv(r.v)}</b></div>`).join('')}</div>
    <p class="line">${PRESETS[S.preset].points?'Fantasy points per game: PTS + 1.2 REB + 1.5 AST + 3 STL + 3 BLK − TO.':'Value = sum of category z-scores among men with 20+ minutes and 40+ games; FG% and FT% weighted by volume.'}</p>`}</div>${dock()}`; }

function playerSheet(id,opts={}){ const p=D.players.find(q=>q.id===id); if(!p) return ''; const x=rowOf(p); if(!x) return ''; const tm=teamOf(p); const v=value(x,S.preset); const rank=rankOf(id,S.preset);
  const car=careerOf(p.n,S.preset); const vmax=Math.max(...car.map(c=>c.v)), vmin=Math.min(...car.map(c=>c.v)); const h=c=>8+(vmax>vmin?(c.v-vmin)/(vmax-vmin):1)*84;
  const kings=car.filter(c=>c.rank===1).map(c=>short2(c.s).slice(0,3));
  const inFive=S.five.includes(id);
  return `<div class="sheet ps" style="--c1:${tm.c1}"><div class="psbody"><div class="grab"></div>
    <div class="ph"><div class="r1"><span>${tm.team}</span><span>${short2(p.s)}</span></div><div class="first">${first(p)}</div><div class="r2"><b>${last(p)}</b>${opts.readOnly?`<b class="z" style="font-size:31px">${p.cap!=null?'$'+Math.round(p.cap*100)+'M':''}</b>`:`<b class="z">${PRESETS[S.preset].points?fmt(v,1):fv(v)}</b>`}</div></div>
    <div class="line">${rank?`<span class="pill ${rank===1?'king':''}">${rank===1?'King of '+short2(p.s).slice(0,3):'#'+rank+' of '+short2(p.s).slice(0,3)}</span>`:'<span class="pill">bench minutes</span>'}${kings.length?` <span class="pill king">${kings.length} time${kings.length>1?'s':''} king</span>`:''} ${lineOf(x.r)} · ${p.gp} GP · ${fmt(p.min)} min</div>
    ${opts.extra||''}
    <div class="career"><h2>Fantasy rank by season<span>${PRESETS[S.preset].name}</span></h2><div class="bars2">${car.map(c=>`<div class="${c.rank===1?'king':c.rank<=5?'top5':''} ${c.s===p.s?'now':''}" style="height:${h(c).toFixed(0)}px" data-player="${c.x.p.id}"><em>#${c.rank}</em><span>${short2(c.s).slice(0,3)}</span><u>${c.x.p.t}</u></div>`).join('')}</div></div>
    <div class="cats"><h2>${PRESETS[S.preset].points?'Per game':'9 categories · '+short2(p.s)}<span>${PRESETS[S.preset].points?'':'z vs league'}</span></h2>
      ${CATS.map(c=>{const z=x.z[c]; const val=c==='fgp'?Math.round(x.r.fgpct*100)+'%':c==='ftp'?Math.round(x.r.ftpct*100)+'%':fmt(x.r[c]); return `<div class="cr"><span class="l">${CAT_LABEL[c]}</span><div class="bar"><u></u><i class="${z<0?'neg':''}" style="left:${z>=0?50:Math.max(2,50+z*12)}%;width:${Math.min(48,Math.abs(z)*12)}%"></i></div><span class="v">${val}</span><span class="zz ${z>=1?'plus':''}">${fv(z)}</span></div>`;}).join('')}</div>
    ${(()=>{ const cost=S.five.map(fid=>price(PID[fid])||0).reduce((a,b)=>a+b,0); const mine=price(p)||0; const over=cost+mine-CAP; S._over=over; return ''; })()}
    <div class="psfoot">${opts.foot!=null?opts.foot:inFive?`<button class="g2 wide" data-drop="${id}">Drop from my five</button>`:S.five.length>=5?(S.swapFor===id?`<div class="kick" style="margin-bottom:8px">Swap ${last(p)} in for…</div><div class="five5" style="margin:0 0 8px">${S.five.map(fid=>{const q=PID[fid]; const cost=S.five.map(x=>price(PID[x])||0).reduce((a,b)=>a+b,0)-(price(q)||0)+(price(p)||0); const okc=cost<=CAP; return `<div class="f5 ${okc?'on':'no'}" ${okc?`data-swap-out="${fid}" data-swap-in="${id}"`:''}><i>${q.pos}</i><b>${last(q)}</b><em>${okc?'$'+cost+'M':'over'}</em></div>`;}).join('')}</div>`:`<button class="g2 wide" data-swap="${id}">Swap into my five</button>`):(S._over>0?`<button class="g2 wide" disabled>Over the cap by $${S._over}M</button>`:`<button class="g2 hot wide" data-add="${id}">Add to my five${price(p)!=null?' · $'+price(p)+'M':''}</button>`)}</div></div></div>`; }

function viewBuild(){ const five=S.five.map(id=>D.players.find(p=>p.id===id)).filter(Boolean); const cost=five.reduce((a,p)=>a+(price(p)||0),0); const unpriced=five.filter(p=>price(p)==null).length;
  const q=S.q.trim().toLowerCase(); let results='';
  if(q.length>=2){ const names={}; for(const p of D.players){ if(p.n.toLowerCase().includes(q)){ (names[p.n]=names[p.n]||[]).push(p); } }
    results=`<div class="rank">${Object.entries(names).slice(0,12).map(([n,ps])=>{ const best=ps.map(p=>({p,x:rowOf(p)})).filter(o=>o.x).sort((a,b)=>value(b.x,S.preset)-value(a.x,S.preset)); const b=best[0]; const pr=ps.map(price).filter(v=>v!=null); return `<div class="rk" data-seasons="${encodeURIComponent(n)}"><i></i><div><div class="nm">${n}</div><div class="ln">${ps.length} season${ps.length>1?'s':''} · ${ps[0].pos}${b?` · best ${short2(b.p.s)} ${fv(value(b.x,S.preset))}`:''}${pr.length?` · $${Math.min(...pr)}–${Math.max(...pr)}M`:''}</div></div><b>›</b></div>`;}).join('')||'<p class="line" style="padding:12px">Nobody by that name.</p>'}</div>`; }
  if(S.pick){ const ps=D.players.filter(p=>p.n===S.pick).sort((a,b)=>a.s<b.s?-1:1);
    results=`<div class="rank"><div class="rk" data-seasons=""><i>‹</i><div><div class="nm">${S.pick}</div><div class="ln">Pick a season</div></div><b></b></div>${ps.map(p=>{const x=rowOf(p); const rk=rankOf(p.id,S.preset); return `<div class="rk ${rk===1?'one':''}" data-player="${p.id}"><i>${short2(p.s).slice(0,3)}</i><div><div class="nm">${p.t} · ${rk?'#'+rk:'bench'}${price(p)!=null?' · $'+price(p)+'M':''}</div><div class="ln">${x?lineOf(x.r):''}</div></div><b>${x?fv(value(x,S.preset)):''}</b></div>`;}).join('')}</div>`; }
  const dock=`<div class="dock"><div class="cap"><span>My five · ${five.length} of 5${unpriced?` · ${unpriced} unpriced`:''}</span><b>$${cost}M</b></div>
    <div class="five5">${[0,1,2,3,4].map(i=>{const p=five[i]; return p?`<div class="f5 on" data-player="${p.id}"><i>${p.pos}</i><b>${last(p)}</b><em>${short2(p.s).slice(0,3)}</em></div>`:'<div class="f5"><i>·</i><b class="open">open</b></div>';}).join('')}</div>
    ${five.length===5?`<button class="big-cta" data-matchup>Matchup</button>`:''}</div>`;
  const note=S.note?`<div class="note">${S.note}</div>`:''; S.note=null;
  return `<div class="stage draft">${note}<div class="big" style="font-size:36px">Build<br>a five.<small>Any man, any season. Score is the category matrix against another five.</small></div>
    ${presetChips()}
    <div class="search"><input id="q" type="search" placeholder="Search any player" value="${S.q.replace(/"/g,'&quot;')}" autocomplete="off"><i>⌕</i></div>
    ${results||`<p class="line">Type a name. The five men you pick go in the dock below; press Matchup when it's full.</p>`}</div>${dock}`; }

function pairUp(A,B){ /* line the two fives up by position order PG→C so the man-vs-man rows make sense */ const order=p=>['PG','SG','SF','PF','C'].indexOf(p.pos); const a=A.slice().sort((x,y)=>order(x)-order(y)), b=B.slice().sort((x,y)=>order(x)-order(y)); return a.map((p,i)=>[p,b[i]]); }
function pairScore(p,q,preset){ const H=h2h([p],[q],preset); return H; }
function viewMatchup(){ const A=S.five.map(id=>D.players.find(p=>p.id===id)); const others=S.fives.filter(f=>f.ids.join()!==S.five.join()); const opp=S.vs&&S.vs.ids.join()!==S.five.join()?S.vs:(others[0]||null); const B=opp?opp.ids.map(id=>D.players.find(p=>p.id===id)):null;
  if(!B) return `<div class="stage"><div class="big" style="font-size:36px">Five is set.<small>Save it and see how it does against every real starting five since 1996. Saved fives can play each other.</small></div><button class="big-cta" data-save-five>Save &amp; see the result</button><button class="g2 wide" data-tab="history">Back</button></div>`;
  const H=h2h(A,B,S.preset); const rows=H.rows.map(r=>`<div class="mxr ${r.win==='a'?'w':''}"><span class="a ${r.win==='a'?'w':''}">${showCat(r.c,r.a)}</span><span class="c">${CAT_LABEL[r.c]}</span><span class="b ${r.win==='b'?'w':''}">${showCat(r.c,r.b)}</span></div>`).join('');
  const pairs=pairUp(A,B).map(([p,q])=>{ const P=pairScore(p,q,S.preset); const rp=rowOf(p),rq=rowOf(q); const same=p.id===q.id; return `<div class="pv"><div class="pm" data-player="${p.id}"><b>${last(p)}</b><span>${p.t} ${short2(p.s).slice(0,3)} · ${rp?lineOf(rp.r).split(' · ')[0]:''}</span></div><div class="ps2 ${same?'':P.wa>P.wb?'w':P.wa<P.wb?'l':''}">${same?`<em style="margin:0">same man</em>`:`<b>${P.wa}</b><i>–</i><b>${P.wb}</b><em>${p.pos}·${q.pos}</em>`}</div><div class="pm r" data-player="${q.id}"><b>${last(q)}</b><span>${q.t} ${short2(q.s).slice(0,3)} · ${rq?lineOf(rq.r).split(' · ')[0]:''}</span></div></div>`; }).join('');
  /* why: each category by margin, with the single man who swung it */
  const why=H.rows.map(r=>{ const d=r.c==='fgp'||r.c==='ftp'?(r.a-r.b)*1000:(r.a-r.b); const lostBig=r.win==='b'; const wonSmall=r.win==='a'; const contrib=(five)=>five.map(p=>({p,v:r.c==='fgp'?raw(p).fgm:r.c==='ftp'?raw(p).ftm:raw(p)[r.c]})).sort((x,y)=>r.c==='tov'?x.v-y.v:y.v-x.v)[0];
    const marg=r.c==='fgp'||r.c==='ftp'?Math.abs(d).toFixed(0)+' pts':fmt(Math.abs(d),1); if(r.win==='-') return `<span><b>${CAT_LABEL[r.c]}</b> tied.</span>`;
    if(lostBig){ const top=contrib(B); return `<span><b>${CAT_LABEL[r.c]}</b> lost by ${marg}${r.c!=='tov'?` — ${last(top.p)} alone ${fmt(top.v,1)}`:''}.</span>`; }
    const top=contrib(A); return `<span class="dim"><b>${CAT_LABEL[r.c]}</b> won by ${marg}${r.c!=='tov'?` (${last(top.p)} ${fmt(top.v,1)})`:''} — counts as one.</span>`; });
  const picker=others.length>1?`<div class="yrs" style="margin-top:10px">${others.map((f,i)=>`<span data-vsname="${i}" class="${f===opp?'on':''}">${f.name}</span>`).join('')}</div>`:'';
  return `<div class="stage">${picker}<div class="vs"><div class="tm" data-side="a">My five<small>${PRESETS[S.preset].name} · tap for the roster</small></div><div class="sc"><b>${H.wa}</b><i>vs</i>${H.wb}</div><div class="tm r" data-side="b">${opp.name||'Saved five'}<small>${opp.date?opp.date.slice(5)+' · ':''}tap for the roster</small></div></div>
    <div class="mx"><div class="mxh"><span>Mine</span><span></span><span>${opp.name||'Theirs'}</span></div>${rows}</div>
    <div class="why2"><b>${H.wa>H.wb?'Why it wins':H.wa<H.wb?'Why it loses':'Even'}</b>${why.join('')}<i>A category is decided by the five-man total; the margin doesn't matter. Five narrow wins beat one blowout.</i></div>
    <div class="cats" style="padding:10px 12px"><h2>Man vs man<span>categories won, by position</span></h2>${pairs}</div>
    <div class="row2"><button class="big-cta" data-save-five>Save this five</button><button class="g2" data-tab="history">Edit</button></div></div>`; }
function rosterSheet(side){ const others=S.fives.filter(f=>f.ids.join()!==S.five.join()); const opp=S.vs&&S.vs.ids.join()!==S.five.join()?S.vs:others[0]; const ids=side==='a'?S.five:opp.ids; const five=ids.map(id=>D.players.find(p=>p.id===id)); const T=totals(five);
  const cols=[['FGM/A',r=>`${fmt(r.fgm)}/${fmt(r.fga)}`],['FG%',r=>pct3(r.fgpct)],['FTM/A',r=>`${fmt(r.ftm)}/${fmt(r.fta)}`],['FT%',r=>pct3(r.ftpct)],['3PM',r=>fmt(r.fg3m)],['PTS',r=>fmt(r.pts)],['REB',r=>fmt(r.reb)],['AST',r=>fmt(r.ast)],['ST',r=>fmt(r.stl)],['BLK',r=>fmt(r.blk)],['TO',r=>fmt(r.tov)]];
  const zk={'FG%':'fgp','FT%':'ftp','3PM':'fg3m','PTS':'pts','REB':'reb','AST':'ast','ST':'stl','BLK':'blk','TO':'tov'};
  const tot={'FGM/A':`${fmt(T.fgm)}/${fmt(T.fga)}`,'FG%':pct3(T.fgpct),'FTM/A':`${fmt(T.ftm)}/${fmt(T.fta)}`,'FT%':pct3(T.ftpct),'3PM':fmt(T.fg3m),'PTS':fmt(T.pts),'REB':fmt(T.reb),'AST':fmt(T.ast),'ST':fmt(T.stl),'BLK':fmt(T.blk),'TO':fmt(T.tov)};
  return `<div class="sheet rs"><div class="psbody"><div class="grab"></div><div class="kick">${side==='a'?'My five':'Their five'}</div>
    <div class="rt"><div class="rtscroll"><table class="rtt"><tr><th>Player</th>${cols.map(([k])=>`<th>${k}</th>`).join('')}</tr>
    ${five.map(p=>{const x=rowOf(p); return `<tr><td data-player="${p.id}"><div class="nm">${p.n[0]}. ${last(p)}</div><div class="sub">${p.t} ${short2(p.s).slice(0,3)} · ${p.el.join(',')}${rankOf(p.id,S.preset)?' · #'+rankOf(p.id,S.preset):''}</div></td>${cols.map(([k,f])=>{const z=x&&zk[k]?x.z[zk[k]]:0; return `<td class="${z>=1.5?'hi':z<=-1?'dim':''}">${f(x?x.r:raw(p))}</td>`;}).join('')}</tr>`;}).join('')}
    <tr class="tot"><td><div class="nm" style="font-size:11px;color:var(--muted)">Total</div></td>${cols.map(([k])=>`<td>${tot[k]}</td>`).join('')}</tr></table></div><div class="hint">← swipe for the rest of the line · volt = elite, grey = a punt</div></div></div></div>`; }

function viewResult(){ const f=S.fives[0]; if(!f) return viewBuild(); const five=f.ids.map(id=>PID[id]); const R=vsField(five,S.preset); const n=R.w+R.l+R.t; const pctw=Math.round(100*R.w/n);
  const cats=CATS.filter(c=>PRESETS[S.preset].points||PRESETS[S.preset].w[c]).map(c=>({c,p:Math.round(100*R.cat[c].w/R.cat[c].n)})).sort((a,b)=>b.p-a.p);
  return `<div class="stage"><div class="kick">${f.name} · ${PRESETS[S.preset].name}</div><div class="rec2"><div class="num ${pctw>=50?'volt':'mut'}">${R.w}-${R.l}${R.t?'-'+R.t:''}</div><div class="lab">against every real starting five since 1996 · beats ${pctw}%</div></div>
    <div class="five5">${five.map(p=>`<div class="f5 on" data-player="${p.id}"><i>${p.pos}</i><b>${last(p)}</b><em>${short2(p.s).slice(0,3)}</em></div>`).join('')}</div>
    <div class="cats"><h2>Where it wins<span>share of real fives beaten, by category</span></h2>${cats.map(x=>`<div class="cr"><span class="l">${CAT_LABEL[x.c]}</span><div class="bar"><u></u><i class="${x.p<50?'neg':''}" style="left:${x.p>=50?50:x.p/2+25}%;width:${Math.abs(x.p-50)/2}%"></i></div><span class="v">${x.p}%</span><span class="zz ${x.p>=70?'plus':''}">${x.p>=70?'punch':x.p<=30?'punt':''}</span></div>`).join('')}</div>
    ${R.best.length?`<div class="cats"><h2>The real fives that beat it worst</h2>${R.best.map(x=>`<div class="cr" style="grid-template-columns:1fr auto"><span class="l" style="color:var(--ink);font-weight:700">${x.f.team.split(' ').slice(-1)[0]} ${short2(x.f.s)}</span><span class="v">${x.H.wa}-${x.H.wb}</span></div>`).join('')}</div>`:''}
    <div class="row2"><button class="big-cta" data-tab="history">Build another</button>${S.fives.length>1?`<button class="g2" data-tab="you">Play a saved five</button>`:''}</div></div>`; }
function viewYou(){ return `<div class="stage"><div class="big" style="font-size:36px">Your fives.<small>Every five you saved. Tap one to play against it.</small></div>
    <div class="rank">${S.fives.map((f,i)=>`<div class="rk" data-vs="${i}"><i>${i+1}</i><div><div class="nm">${f.name}</div><div class="ln">${f.ids.map(id=>{const p=D.players.find(q=>q.id===id); return p?last(p)+' '+short2(p.s).slice(0,3):'?';}).join(' · ')}</div></div><b>${f.date.slice(5)}</b></div>`).join('')||'<p class="line" style="padding:12px">Nothing saved yet.</p>'}</div>
    <button class="g2 wide ${S.resetArmed?'hot':''}" data-reset>${S.resetArmed?'Tap again to reset':'Reset'}</button></div>`; }
function viewLeague(){ return `<div class="stage"><div class="big" style="font-size:36px">Crew league.<small>Snake draft once a season, round-robin 9-cat head-to-head, standings. Coming next — for now, save fives and play them against each other.</small></div></div>`; }

function render(){ let body;
  if(S.view==='result') body=viewResult();
  else body=S.tab==='history'?viewHistory():S.tab==='matchup'?(S.five.length===5?viewMatchup():`<div class="stage"><div class="big" style="font-size:36px">Five first.<small>Pick five men on History — search or tap the ranking — and the matchup opens here.</small></div><button class="big-cta" data-tab="history">Go pick</button></div>`):viewYou();
  const sheet=S.sheet?(S.sheet.kind==='player'?playerSheet(S.sheet.id):rosterSheet(S.sheet.side)):'';
  HOST.className='mode'+(S.five.length&&S.tab==='history'?' drafting':''); HOST.innerHTML=`${body}${tabs()}${sheet?`<div class="scrim" data-close></div>${sheet}`:''}`; window.__shell&&window.__shell.meta(S.five.length?`${S.five.length}/5`:'');
  const q=document.getElementById('q'); if(q&&S.qFocus){ q.focus(); const v=q.value; q.value=''; q.value=v; }
  const yrs=document.getElementById('yrs'); if(yrs){ const on=yrs.querySelector('.on'); if(on) yrs.scrollLeft=Math.max(0,on.offsetLeft-120); } }

/* ---------- events ---------- */
document.addEventListener('input',e=>{ if(!HOST.contains(e.target)) return; if(e.target.id==='q'){ S.q=e.target.value; S.pick=null; S.qFocus=true; render(); } });
document.addEventListener('click',e=>{ if(!HOST.contains(e.target)) return; if(e.target.closest&&e.target.closest('.search i')&&S.q){ S.q=''; S.qFocus=false; render(); } });
document.addEventListener('click',e=>{ if(!HOST.contains(e.target)) return; const c=sel=>e.target.closest?e.target.closest(sel):null; let el;
  if(el=c('[data-tab]')){ S.tab=el.dataset.tab; S.view=null; S.sheet=null; S.qFocus=false; S.resetArmed=false; render(); return; }
  if(el=c('[data-preset]')){ S.preset=el.dataset.preset; save(); render(); return; }
  if(el=c('[data-season]')){ S.season=el.dataset.season; save(); render(); return; }
  if(el=c('[data-player]')){ S.sheet={kind:'player',id:el.dataset.player}; render(); return; }
  if(el=c('[data-seasons]')){ S.pick=el.dataset.seasons?decodeURIComponent(el.dataset.seasons):null; S.qFocus=false; render(); return; }
  if(el=c('[data-add]')){ const cost=S.five.map(fid=>price(PID[fid])||0).reduce((a,b)=>a+b,0)+(price(PID[el.dataset.add])||0); if(cost>CAP){ return; } if(S.five.length<5&&!S.five.includes(el.dataset.add)) S.five.push(el.dataset.add); S.sheet=null; S.pick=null; S.q=''; save(); S.tab='history'; S.view=null; render(); return; }
  if(el=c('[data-drop]')){ S.five=S.five.filter(id=>id!==el.dataset.drop); S.sheet=null; save(); render(); return; }
  if(el=c('[data-swap-out]')){ const i=S.five.indexOf(el.dataset.swapOut); if(i>=0) S.five[i]=el.dataset.swapIn; S.swapFor=null; S.sheet=null; save(); S.tab='history'; S.view=null; render(); return; }
  if(el=c('[data-swap]')){ S.swapFor=el.dataset.swap; render(); return; }
  if(c('[data-matchup]')){ S.tab='matchup'; S.view=null; S.sheet=null; render(); return; }
  if(el=c('[data-side]')){ S.sheet={kind:'roster',side:el.dataset.side}; render(); return; }
  if(c('[data-save-five]')){ if(S.five.length===5){ const name='Five #'+(S.fives.length+1); S.fives.unshift({name,ids:S.five.slice(),date:new Date().toISOString().slice(0,10),preset:S.preset}); S.five=[]; S.vs=null; save(); S.view='result'; S.tab='history'; S.q=''; S.pick=null; render(); return; } S.tab='matchup'; S.view=null; render(); return; }
  if(el=c('[data-vs]')){ const f=S.fives[+el.dataset.vs]; if(S.five.length<5||S.five.join()===f.ids.join()){ S.five=f.ids.slice(); S.vs=S.fives.find(x=>x.ids.join()!==f.ids.join())||null; } else S.vs=f; S.view=null; S.tab='matchup'; render(); return; }
  if(el=c('[data-vsname]')){ const others=S.fives.filter(f=>f.ids.join()!==S.five.join()); S.vs=others[+el.dataset.vsname]; render(); return; }
  if(c('[data-reset]')){ if(!S.resetArmed){ S.resetArmed=true; render(); return; } try{localStorage.removeItem(STORE);}catch(e){} S.five=[]; S.fives=[]; S.vs=null; S.resetArmed=false; render(); return; }
  if(c('[data-close]')){ S.sheet=null; S.swapFor=null; render(); return; } });
/* swipe down closes a sheet when its body is at the top */
(function(){ let y0=null,sc=null; document.addEventListener('touchstart',e=>{ const sh=e.target.closest&&e.target.closest('.sheet'); if(!sh) return; const b=sh.querySelector('.psbody')||sh; y0=e.touches[0].clientY; sc=b.scrollTop; },{passive:true});
  document.addEventListener('touchend',e=>{ if(y0==null) return; const dy=e.changedTouches[0].clientY-y0; if(sc<=0&&dy>90&&S.sheet){ S.sheet=null; render(); } y0=null; },{passive:true}); })();


window.__build={S,D,render,vsField,h2h,rowOf,value,ranked,rankOf,playerSheet,init(){ load(); render(); }};
})();
