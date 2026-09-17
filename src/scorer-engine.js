/* ============================================================================
   FANTASYBALL — the engine scorer (beatball). Same packs, same cards; the 82
   games are played by the rating engine (offence/defence/usage/positions,
   home court, game probability), not by category counts.
   ============================================================================ */
'use strict';
(function(){
const B=BEATBALL_V2, E=window.__engine||makeEngine(B);
const SLOTS=['PG','SG','SF','PF','C'], CAP=100;
const pgi=Object.fromEntries(B.meta.pgKeys.map((k,i)=>[k,i])), advi=Object.fromEntries(B.meta.advKeys.map((k,i)=>[k,i]));
const price=p=>Math.max(1,Math.round((p.capPct||0)*100)); const last=p=>p.name.split(' ').slice(-1)[0];
const fmt=(v,d=1)=>(v==null||isNaN(v))?'–':v.toFixed(d);
function mulberry32(a){return function(){a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return ((t^t>>>14)>>>0)/4294967296;}}
const GAME_K=0.135, GAME_H=0.42;
function gameP(mine,theirs,home){ return 1/(1+Math.exp(-(GAME_K*(fiveNet(mine)-E.rate(theirs).net)+GAME_H*(home||0)))); }
function gameWin(mine,theirs,home,rng){ return rng()<gameP(mine,theirs,home); }
const isBigRole=p=>p.eligible[0]==='C'||(p.eligible[0]==='PF'&&(adv(p,'rebPct')>=.13||((p.ht||0)>=82&&adv(p,'astPct')<.20)));   // Dirk is a big, Durant at PF is a wing   // LeBron-at-PF is a wing, Draymond is a big
function bestLineup(men){ let best=null; const perm=(arr,acc)=>{ if(!arr.length){ const v=fiveNet(acc); if(!best||v>best.v) best={v,five:acc.slice()}; return; } arr.forEach((p,i)=>perm(arr.filter((_,j)=>j!==i),acc.concat([p]))); }; perm(men,[]); return best.five.map(p=>p.id); }
const FIELD=B.teams.map(t=>({t,f:E.five(t,false)})).filter(x=>x.f).map(x=>{const r=E.rate(x.f);return{id:x.t.id,t:x.t,five:x.f,net:r.net,wp:x.t.record.w/(x.t.record.w+x.t.record.l)};}).sort((a,b)=>b.net-a.net);
const FIELD_BY_ID=Object.fromEntries(FIELD.map(x=>[x.id,x]));
const pg=(p,k)=>p.pg[pgi[k]], p100=(p,k)=>p.p100[pgi[k]], adv=(p,k)=>p.adv[advi[k]];

const mean=a=>a.reduce((x,y)=>x+y,0)/(a.length||1);

const OOP=[0,.5,1.0,1.5,2.0];

const slotDist=(p,sl)=>Math.abs(SLOTS.indexOf(sl)-SLOTS.indexOf(p.eligible[0]));

const slotPen=(p,sl)=>OOP[slotDist(p,sl)];

function oopPenalty(five){ return SLOTS.reduce((a,sl,i)=>{const p=five[i]; if(!p) return a; return a+slotPen(p,sl);},0); }

/* Fit rules — the lineup facts the additive engine can't see. Thresholds sit outside what real fives do
   (p5 of 892 real fives: best passer AST% 22, best rim protector BLK/100 1.1, usage sum 94), so real seasons are
   untouched and only game-built lineups pay: five Goberts have no one to create, five Fishers no one to score. */
const advi_=advi;
function fitPenalty(five){ let pen=0; const parts=[];
  const maxA=Math.max(...five.map(p=>adv(p,'astPct'))); if(maxA<.22){ const v=Math.min(6,(.22-maxA)*50); pen+=v; parts.push({k:'creation',v,t:'Nobody to run the offence (best passer AST% '+Math.round(maxA*100)+')'}); }
  const ns=five.filter(p=>adv(p,'threePAr')<.15).length; if(ns>=4){ const v=(ns-3)*1.5; pen+=v; parts.push({k:'spacing',v,t:ns+' non-shooters on the floor'}); }
  const maxB=Math.max(...five.map(p=>p100(p,'blk'))); if(maxB<1.1){ const v=Math.min(1.5,(1.1-maxB)*1.5); pen+=v; parts.push({k:'rim',v,t:'No rim protector (best BLK/100 '+maxB.toFixed(1)+')'}); }
  const usg=five.reduce((a,p)=>a+adv(p,'usg'),0)*100; if(usg<94){ const v=Math.min(3,(94-usg)*.15); pen+=v; parts.push({k:'usage',v,t:'Not enough scoring appetite (usage sum '+Math.round(usg)+')'}); }
  return {pen,parts}; }
function fiveNet(five){ return E.rate(five).net-oopPenalty(five)-fitPenalty(five).pen; }

function playSeason(mine,seed){ const rng=mulberry32(seed>>>0); const games=[]; let w=0,l=0,hw=0,hl=0;
  for(let g=0;g<82;g++){ const x=FIELD[Math.floor(rng()*FIELD.length)]; const home=g%2===0?1:-1; const win=gameWin(mine,x.five,home,rng);
    games.push({opp:x.id,home:home>0,win}); if(win){w++; if(home>0)hw++;} else {l++; if(home>0)hl++;} }
  const r=E.rate(mine); const pen=oopPenalty(mine); const ew=expectedWins(mine);
  return {seed,w,l,hw,hl,games,net:r.net-pen,ortg:r.ortg,drtg:r.drtg,pen,ew}; }

function bestFromPacks(packs){ if(!packs||packs.length<5) return null;
  const legal=f=>f.reduce((a,p)=>a+price(p),0)<=CAP;
  const arrange=f=>f.length<5?f:bestLineup(f).map(id=>E.P[id]);
  const cands=packs.map(pk=>pk.players.filter(p=>p.capPct!=null));
  let five=[]; for(const c of cands){ let best=null,bv=-1e9; for(const p of c){ const f=five.concat([p]); if(!legal(f)) continue; const g=f.slice(); while(g.length<5) g.push(g[g.length-1]); const v=E.rate(g).net; if(v>bv){bv=v;best=p;} } if(best) five.push(best); }
  if(five.length<5) return null;
  let cur=five, cv=fiveNet(arrange(cur)), improved=true, guard=0;
  while(improved&&guard++<30){ improved=false; for(let i=0;i<5;i++) for(const p of cands[i]){ if(p.id===cur[i].id) continue; const f=cur.slice(); f[i]=p; if(!legal(f)) continue; const v=fiveNet(arrange(f)); if(v>cv+1e-6){ cur=f; cv=v; improved=true; } } }
  return {five:arrange(cur),net:cv}; }

function expectedWins(five){ let e=0; for(let i=0;i<300;i++){ const x=FIELD[(i*4463)%FIELD.length]; e+=gameP(five,x.five,i%2?1:-1); } return Math.round(82*e/300); }

const zW=(p,k,v)=>{const m=B.weights.SM[p.season+':'+k]; return m?(E.trust?E.trust(p):1)*(v-m[0])/m[1]:0;};

function manOff(p){ const c=B.weights.off.coef; const st=k=>p100(p,k); let x=0;
  x+=c[0]*zW(p,'pts',st('pts'))+c[1]*zW(p,'ast',st('ast'))+c[2]*zW(p,'fg3m',st('fg3m'))+c[3]*zW(p,'tov',st('tov'))+c[4]*zW(p,'fta',st('fta'))+c[5]*zW(p,'fga',st('fga'));
  x+=(c[6]*zW(p,'ts',adv(p,'ts'))+c[7]*zW(p,'threePAr',adv(p,'threePAr'))+c[8]*zW(p,'rebPct',adv(p,'rebPct')))/5; x+=c[9]*(adv(p,'usg')*100-20); return x; }

const MANQ=(()=>{ const pool=B.players.filter(p=>p.min>=15); const o=pool.map(manOff), pd=pool.map(E.playerDef), d=pd.map(v=>v*B.weights.def.coef/5), n=o.map((v,i)=>v-d[i]); const srt=a=>a.slice().sort((x,y)=>x-y); return {o:srt(o),d:srt(pd),n:srt(n)}; })();

function ovr(p){ const q=(arr,v)=>{let lo=0,hi=arr.length; while(lo<hi){const m=(lo+hi)>>1; if(arr[m]<v) lo=m+1; else hi=m;} return Math.max(1,Math.round(99*lo/arr.length));}; const o=manOff(p), pd=E.playerDef(p), d=pd*B.weights.def.coef/5; return {ovr:q(MANQ.n,o-d),off:q(MANQ.o,o),def:q(MANQ.d,pd)}; }

function tagOf(p){ const u=adv(p,'usg')*100, t3=adv(p,'threePAr'), a=adv(p,'astPct')*100;
  if(isBigRole(p)){ if(a>=20) return ['PLAYMAKING BIG','pm']; if(t3>=.18) return ['STRETCH BIG','st']; return ['INSIDE BIG','in']; }
  if(a>=30) return ['MAIN HANDLER','mh'];
  if(t3>=.40&&a<15&&u<28) return ['3&D','td'];
  if(u>=24) return ['SCORER','sc'];
  if(t3>=.30) return ['3&D','td'];
  return ['ROTATION','ro']; }

function teamLine(f){ const r=E.rate(f); const usg=f.reduce((a,p)=>a+adv(p,'usg'),0)*100, t3=mean(f.map(p=>adv(p,'threePAr'))), def=mean(f.map(E.playerDef)), ts=mean(f.map(p=>adv(p,'ts'))), ast=mean(f.map(p=>adv(p,'astPct')))*100; return {net:r.net-oopPenalty(f),ortg:r.ortg,drtg:r.drtg,usg,t3,def,ts,ast,pen:oopPenalty(f),cost:f.reduce((a,p)=>a+price(p),0)}; }

function whyBetter(mine,best){ const a=teamLine(mine), b=teamLine(best); const out=[]; const d=(x,y)=>y-x;
  if(d(a.ortg,b.ortg)>1) out.push(`Offence +${fmt(d(a.ortg,b.ortg),1)}: ${b.ts-a.ts>=.015?`better shooting (TS ${Math.round(a.ts*100)} → ${Math.round(b.ts*100)})`:b.ast-a.ast>=3?`more creation (AST% ${Math.round(a.ast)} → ${Math.round(b.ast)})`:b.t3-a.t3>=.04?`more spacing (3PAr .${Math.round(a.t3*100)} → .${Math.round(b.t3*100)})`:'the ball gets shared better'}.`);
  if(d(a.drtg,b.drtg)<-1) out.push(`Defence ${fmt(-d(a.drtg,b.drtg),1)} better: team defence ${fmt(a.def,2)} → ${fmt(b.def,2)}.`);
  if(a.usg>108&&b.usg<a.usg-4) out.push(`Less overlap: usage ${Math.round(a.usg)} → ${Math.round(b.usg)}. Past 100, somebody stands in the corner.`);
  if(a.pen>b.pen+.4) out.push(`Fewer men out of position: −${fmt(a.pen,1)} → −${fmt(b.pen,1)}.`);
  if(b.cost<a.cost-8) out.push(`Cheaper too: $${a.cost}M → $${b.cost}M, and the savings bought a better man.`);
  if(!out.length) out.push('Small edges everywhere rather than one big one.');
  return out; }

/* result extras for the engine: lessons + the best five, rendered by the packs module */
function resultExtras(five,sn,packsUsed){ const bb=bestFromPacks(packsUsed); const ew=expectedWins(five); let html=''; const fp=fitPenalty(five); const pen=oopPenalty(five);
  if(fp.parts.length||pen>0) html+=`<div class="les"><h2>Fit</h2>${fp.parts.map(x=>`<div class="l"><b class="r">−${x.v.toFixed(1)}</b><div><div class="k">${x.k}</div><div class="t">${x.t}.</div></div></div>`).join('')}${pen>0?`<div class="l"><b class="r">−${pen.toFixed(1)}</b><div><div class="k">positions</div><div class="t">Men playing away from their natural spot.</div></div></div>`:''}</div>`;
  html+=`<div class="cells"><div><b>${ew}-${82-ew}</b><i>Expected</i></div><div><b>${sn.net>=0?'+':''}${fmt(sn.net,1)}</b><i>Net</i></div><div><b>${fmt(sn.ortg,1)}</b><i>ORtg</i></div><div><b>${fmt(sn.drtg,1)}</b><i>DRtg</i></div></div>`;
  if(bb){ const same=bb.five.every((p,i)=>p.id===five[i].id); html+=`<div class="les"><h2>The best five those packs allowed</h2>${same?'<p class="bbnote">You built it.</p>':`<div class="l"><b class="h">${expectedWins(bb.five)}-${82-expectedWins(bb.five)}</b><div><div class="k">${bb.five.map(last).join(' · ')}</div><div class="t">expected, vs ${ew}-${82-ew} for yours.</div></div></div><div class="why"><b>Why it wins</b>${whyBetter(five,bb.five).map(t=>`<span>${t}</span>`).join('')}</div>`}</div>`; }
  return html; }
/* the engine's profile row: OFF · DEF · USG for the sheet */
function profileRow(p){ const o=ovr(p); return `<div class="cats"><h2>Engine<span>percentiles among rotation men</span></h2><div class="cells" style="margin-top:8px"><div><b>${o.off}</b><i>Offence</i></div><div><b>${o.def}</b><i>Defence</i></div><div><b>${Math.round(adv(p,'usg')*100)}</b><i>Usage</i></div><div><b>${tagOf(p)[0]}</b><i>Role</i></div></div></div>`; }
window.__scorer={name:'engine',label:'82 games · the engine',
  playSeason:(five,seed)=>{ const sn=playSeason(five,seed); const r=E.rate(five); return Object.assign(sn,{ortg:r.ortg,drtg:r.drtg,net:fiveNet(five)}); },
  expW:expectedWins, bestFromPacks, bestLineup, resultExtras, profileRow, lineupPen:oopPenalty, ovr, tagOf, fitPenalty,
  /* E2 card: OFF · DEF · USG big; the four fit numbers small — 3PAr · AST% · BLK · REB% */
  cardStats:(p)=>{ const o=ovr(p); const f=(v,d)=>v==null||isNaN(v)?'—':v.toFixed(d).replace(/^0\./,'.'); return `<div class="big"><div><b>${o.off}</b><span>OFF</span></div><div><b>${o.def}</b><span>DEF</span></div><div><b>${Math.round(adv(p,'usg')*100)}</b><span>USG</span></div></div><div class="sm4"><div><b>${f(adv(p,'threePAr'),2)}</b><span>3PAr</span></div><div><b>${Math.round(adv(p,'astPct')*100)}</b><span>AST%</span></div><div><b>${f(p100(p,'blk'),1)}</b><span>BLK</span></div><div><b>${Math.round(adv(p,'rebPct')*100)}</b><span>REB%</span></div></div>`; }};
})();
