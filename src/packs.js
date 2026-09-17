/* ============================================================================
   FANTASYBALL — Packs, on the fantasy universe.
   Spin five playoff-calibre clubs, sign one man from each under a $100M cap,
   then play 82 games: each a 9-category head-to-head against a random real
   starting five. No dice. The record is the score. Uses the Build module's
   fantasy math (rowOf / value / h2h) and its player profile.
   ============================================================================ */
'use strict';
(function(){
const HOST=document.getElementById('mode-packs');
const B=BEATBALL_V2, FB=window.__build;
const PID=Object.fromEntries(B.players.map(p=>[p.id,p]));
const CAP=100, SLOTS=['PG','SG','SF','PF','C'];
const price=p=>p.capPct!=null?Math.max(1,Math.round(p.capPct*100)):null;
const last=p=>p.name.split(' ').slice(-1)[0], first=p=>p.name.split(' ').slice(0,-1).join(' ');
const fmt=(v,d=1)=>(Math.round(v*10**d)/10**d).toFixed(d);
const fv=v=>(v>=0?'+':'−')+fmt(Math.abs(v),1);
const short2=s=>"'"+s.slice(2,4)+'-'+s.slice(-2), yr=s=>"'"+s.slice(2,4);
function mulberry32(a){return function(){a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return ((t^t>>>14)>>>0)/4294967296;}}
const shuffle=(arr,rng)=>{const a=arr.slice();for(let i=a.length-1;i>0;i--){const j=Math.floor(rng()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;};
const dayKey=()=>{const d=new Date();return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');};

/* ---------- club colour: which of the two carries the screen ---------- */
const hexRgb=h=>{h=h.replace('#','');if(h.length===3)h=h.split('').map(c=>c+c).join('');return [0,2,4].map(i=>parseInt(h.slice(i,i+2),16)/255);};
const lum=h=>{const [r,g,b]=hexRgb(h).map(v=>v<=.03928?v/12.92:Math.pow((v+.055)/1.055,2.4));return .2126*r+.7152*g+.0722*b;};
const sat=h=>{const [r,g,b]=hexRgb(h);const mx=Math.max(r,g,b),mn=Math.min(r,g,b);return mx?(mx-mn)/mx:0;};
const mixHex=(a,b,t)=>{const A=hexRgb(a),Bc=hexRgb(b);return '#'+A.map((v,i)=>Math.round(255*(v*(1-t)+Bc[i]*t)).toString(16).padStart(2,'0')).join('');};
const usable=h=>sat(h)>=.25&&lum(h)>=.008&&lum(h)<=.55;
function clubTone(t){const c1=t.c1||'#123C86',c2=t.c2||'#4DA8FF';let body;if(usable(c1))body=c1;else if(usable(c2))body=c2;else body='#2B3038';if(lum(body)<.04)body=mixHex(body,'#ffffff',.12);return body;}
const TEAM_OF={}; for(const t of B.teams) TEAM_OF[t.abbr+':'+t.season]=t;
const toneOf=p=>{const t=TEAM_OF[p.abbr+':'+p.season]; return t?clubTone(t):'#2B3038';};

/* ---------- the field and the clubs on the wheel ---------- */
const PACK_TEAMS=B.teams.filter(t=>t.record.w>=45&&t.players.filter(id=>PID[id]&&PID[id].capPct!=null).length>=8);
const FBP=Object.fromEntries(FB.D.players.map(p=>[p.id,p]));
const fp=p=>FBP[p.id];
const rowOf=p=>FB.rowOf(fp(p));
const valueOf=p=>{const x=rowOf(p); return x?FB.value(x,'9cat'):-99;};
const rankOf=p=>FB.rankOf(p.id,'9cat');
/* The field: 200 fives built under the same rules by bots of mixed skill (half near-best picks, half decent),
   seeded so it is the same field every day. Real starting fives were too weak — a greedy five went 77-5.
   Against this field a perfect greedy run averages ~65 wins with a wide spread; random picks ~12. */
const FIELD=(function(){ const rng=mulberry32(20260913); const price_=p=>Math.max(1,Math.round(p.capPct*100)); const out=[];
  for(let i=0;i<200;i++){ const skill=i%2?4:2; const teams=shuffle(PACK_TEAMS,rng).slice(0,5); const picks=[]; let okf=true;
    for(const t of teams){ const men=t.players.map(id=>PID[id]).filter(p=>p&&p.capPct!=null&&picks.reduce((a,q)=>a+price_(q),0)+price_(p)+(4-picks.length)<=CAP); if(!men.length){okf=false;break;} men.sort((a,b)=>valueOf(b)-valueOf(a)); picks.push(men[Math.min(men.length-1,Math.floor(Math.pow(rng(),skill)*men.length))]); }
    if(okf) out.push({id:'bot'+i,five:picks,skill}); }
  return out; })();

/* ---------- state ---------- */
const STORE='fantasyball.packs9.v1';
const S={view:'home',tab:'build',packs:null,draftIdx:0,picks:[],pack:null,wheel:null,rerolls:2,season:null,seasons:[],bestW:0,bestL:0,bestTeam:null,team:null,sheet:null,resetArmed:false,shared:false,reveal:false};
function save(){try{localStorage.setItem(STORE,JSON.stringify({seasons:S.seasons.slice(0,60),bestW:S.bestW,bestL:S.bestL,bestTeam:S.bestTeam}));}catch(e){}}
function load(){try{const j=JSON.parse(localStorage.getItem(STORE)||'null');if(j)Object.assign(S,j);}catch(e){} S.seasons=S.seasons||[];}
const spent=()=>S.picks.reduce((a,p)=>a+price(p),0);
const canPick=p=>!S.picks.some(q=>q.id===p.id)&&price(p)!=null&&spent()+price(p)+(4-S.picks.length)<=CAP;

/* ---------- draft ---------- */
const packOf=t=>({team:t,players:t.players.map(id=>PID[id]).filter(p=>p&&p.capPct!=null).sort((a,b)=>valueOf(b)-valueOf(a))});
function makePacks(rng){ return shuffle(PACK_TEAMS,rng).slice(0,5).map(packOf); }
function startDraft(){ const rng=mulberry32((Math.random()*2**32)>>>0); S.packs=makePacks(rng); S.draftIdx=0; S.picks=[]; S.rerolls=2; S.view='draft'; S.sheet=null; spinWheel(); }
function spinWheel(){ const pk=S.packs[S.draftIdx]; if(!pk) return; const rng=Math.random;
  const others=shuffle(PACK_TEAMS.filter(t=>t.id!==pk.team.id),rng).slice(0,9); const teams=shuffle(others.concat([pk.team]),rng);
  S.wheel={teams,idx:Math.floor(rng()*teams.length),target:teams.indexOf(pk.team),spinning:true}; S.pack=null; S.reveal=false; render();
  if(typeof requestAnimationFrame!=='function'){ S.wheel.spinning=false; S.wheel.idx=S.wheel.target; landWheel(); return; }
  let lastT=performance.now(),acc=0,start=lastT; const total=2400;
  const step=now=>{const W=S.wheel; if(!W||!W.spinning) return; const t=Math.min(1,(now-start)/total); const interval=45+t*t*t*420; acc+=now-lastT; lastT=now;
    if(acc>=interval){acc=0;W.idx=(W.idx+1)%W.teams.length;renderWheel();}
    if(t<1) requestAnimationFrame(step); else {W.target=W.idx;W.spinning=false;landWheel();}};
  requestAnimationFrame(step); }
function lockWheel(){const W=S.wheel; if(!W||!W.spinning) return; W.spinning=false; W.target=W.idx; landWheel();}
function landWheel(){const W=S.wheel; const team=W.teams[W.idx]; if(team.id!==S.packs[S.draftIdx].team.id) S.packs[S.draftIdx]=packOf(team); S.pack={faceup:true}; S.reveal=true; render();}
function renderWheel(){const el=document.getElementById('wheelrows'); if(el) el.innerHTML=wheelRows();}
function wheelRows(){const W=S.wheel,n=W.teams.length; return [-2,-1,0,1,2].map(d=>{const t=W.teams[(W.idx+d+n*2)%n]; return `<div class="wrow ${d===0?'hit':''}" style="--tc1:${t.c1};--tc2:${t.c2==='#000000'?'#8A9099':t.c2}"><span class="dot"></span><span class="wyr">${t.season}</span><b>${t.team}</b><em>${t.record.w}–${t.record.l}</em></div>`;}).join('');}
function pick(p){ if(!canPick(p)||!S.pack) return; S.picks.push(p); S.draftIdx++; S.sheet=null;
  if(S.picks.length===5){ S.packsUsed=S.packs; S.wheel=null; S.pack=null; S.team=(SCORER.bestLineup||bestLineup)(S.picks); startSeason(); return; } spinWheel(); }
function bestLineup(men){ let best=null; const perm=(arr,acc)=>{ if(!arr.length){ const pen=acc.reduce((a,p,i)=>a+Math.abs(SLOTS.indexOf(p.eligible[0])-i),0); if(!best||pen<best.pen) best={pen,ids:acc.map(p=>p.id)}; return; } arr.forEach((p,i)=>perm(arr.filter((_,j)=>j!==i),acc.concat([p]))); }; perm(men,[]); return best.ids; }

const CATL={pts:'PTS',reb:'REB',ast:'AST',stl:'STL',blk:'BLK',fg3m:'3PM',fgp:'FG%',ftp:'FT%',tov:'TO'};
const CATS=['pts','reb','ast','stl','blk','fg3m','fgp','ftp','tov'];
/* ---------- the season: 82 head-to-heads against random fives ---------- */
function h2h(A,Bf){ return FB.h2h(A.map(fp),Bf.map(fp),'9cat'); }
function playSeason(five,seed){ const rng=mulberry32(seed>>>0); const games=[]; let w=0,l=0,t=0; const catW={},catN={};
  for(let g=0;g<82;g++){ const x=FIELD[Math.floor(rng()*FIELD.length)]; const H=h2h(five,x.five); const res=H.wa>H.wb?'w':H.wa<H.wb?'l':'t'; if(res==='w')w++;else if(res==='l')l++;else t++;
    for(const r of H.rows){ catN[r.c]=(catN[r.c]||0)+1; if(r.win==='a') catW[r.c]=(catW[r.c]||0)+1; } games.push({opp:x.id,res,wa:H.wa,wb:H.wb}); }
  return {seed,w,l,t,games,catW,catN}; }
function startSeason(){ const five=S.team.map(id=>PID[id]); S.season=SCORER.playSeason(five,(Math.random()*2**32)>>>0);
  S.seasons.unshift({date:dayKey(),team:S.team.slice(),w:S.season.w,l:S.season.l,t:S.season.t,cost:five.reduce((a,p)=>a+price(p),0)});
  if(S.season.w>S.bestW||!S.bestTeam){S.bestW=S.season.w;S.bestL=S.season.l;S.bestTeam=S.team.slice();}
  S.tab='season'; S.view=null; save(); render(); }
const SAMPLE=FIELD.filter((_,i)=>i%Math.max(1,Math.floor(FIELD.length/120))===0).slice(0,120);
function expW(five){ let w=0; for(const x of SAMPLE){ const H=h2h(five,x.five); if(H.wa>H.wb) w++; } return Math.round(82*w/SAMPLE.length); }
function bestFromPacks(packs){ if(!packs||packs.length<5) return null; const cands=packs.map(pk=>pk.players); const legal=f=>f.reduce((a,p)=>a+price(p),0)<=CAP;
  let five=[]; for(const c of cands){ let bp=null; for(const p of c){ const f=five.concat([p]); if(!legal(f)) continue; if(!bp||valueOf(p)>valueOf(bp)) bp=p; } if(bp) five.push(bp); } if(five.length<5) return null;
  let cur=five, cv=expW(cur), imp=true, g=0; while(imp&&g++<8){ imp=false; for(let i=0;i<5;i++) for(const p of cands[i]){ if(p.id===cur[i].id) continue; const f=cur.slice(); f[i]=p; if(!legal(f)) continue; const v=expW(f); if(v>cv){cur=f;cv=v;imp=true;} } }
  return {five:cur,ew:cv}; }

/* ---------- the scorer: fantasy by default; beatball plugs the engine in via window.__scorer ---------- */
const FANTASY={name:'fantasy',label:'82 nights · nine categories each',playSeason,expW,bestFromPacks,bestLineup:null,
  resultExtras:(five,sn,packsUsed)=>{ const prof=CATS.map(c=>({c,p:Math.round(100*(sn.catW[c]||0)/(sn.catN[c]||1))})).sort((a,b)=>b.p-a.p);
    const lost=[...prof].reverse().filter(x=>x.p<50).slice(0,2), won=prof.filter(x=>x.p>=65).slice(0,1); const bb=bestFromPacks(packsUsed); const myEw=expW(five);
    return `<div class="prof"><h2>Category profile<span>share of the 82 you won</span></h2>${prof.map(x=>`<div class="cr"><span class="l">${CATL[x.c]}</span><div class="bar"><u></u><i class="${x.p>=70?'hi':x.p<=30?'lo':''}" style="left:${x.p>=50?50:x.p/2+25}%;width:${Math.abs(x.p-50)/2}%"></i></div><span class="v">${x.p}%</span><span class="w ${x.p>=70?'hi':''}">${x.p>=70?'punch':x.p<=30?'punt':''}</span></div>`).join('')}</div>
    <div class="les"><h2>Where the ${sn.l} losses came from</h2>${lost.map(x=>`<div class="l"><b class="r">−${sn.catN[x.c]-(sn.catW[x.c]||0)}</b><div><div class="k">${CATL[x.c]}</div><div class="t">You lost ${CATL[x.c]} on ${sn.catN[x.c]-(sn.catW[x.c]||0)} of 82 nights. ${fixFor(x.c)}</div></div></div>`).join('')}${won.map(x=>`<div class="l"><b class="h">+${sn.catW[x.c]}</b><div><div class="k">${CATL[x.c]}</div><div class="t">Your best category — won ${sn.catW[x.c]} nights.</div></div></div>`).join('')}</div>
    ${bb&&bb.five.some((p,i)=>p.id!==five[i].id)?`<div class="les"><h2>The best five those packs allowed</h2><div class="l"><b class="h">${bb.ew}-${82-bb.ew}</b><div><div class="k">${bb.five.map(last).join(' · ')}</div><div class="t">expected, vs ${myEw}-${82-myEw} for yours. ${bestSwapText(five,bb.five)}</div></div></div></div>`:bb?`<div class="les"><h2>The best five those packs allowed</h2><p class="bbnote">You built it.</p></div>`:''}`; },
  profileRow:null};
const SCORER=window.__scorer||FANTASY;
/* ---------- views ---------- */
function tabs(){ return `<nav class="tabs">${[['build','Build'],['season','Season'],['you','You']].map(([k,l])=>`<span data-ptab="${k}" class="${S.tab===k?'on':''}">${l}</span>`).join('')}</nav>`; }
const recCls=(w,l)=>w>l?'volt':w===l?'':'mut';
function viewHome(){ const b=S.bestTeam; return `<div class="stage"><div class="big hero">Build<br>a five.<small>Five clubs from the wheel, one man each, a $100M cap. ${SCORER.name==='engine'?'Then 82 games against real fives, played by the engine. The record is the score.':'Then 82 nights against fives built the same way, nine categories a night. The record is the score.'}</small></div>
  <div class="cells"><div><b class="${b?'volt':''}">${b?`${S.bestW}-${S.bestL}`:'—'}</b><i>Your best</i></div><div><b>${S.seasons.length}</b><i>Seasons</i></div><div><b>${PACK_TEAMS.length}</b><i>Clubs</i></div><div><b>73-9</b><i>The record</i></div></div>
  <button class="big-cta" data-draft>Spin the wheel</button></div>`; }
function cellVal(x,c){ const r=x.r; return c==='fgp'?Math.round(r.fgpct*100):c==='ftp'?Math.round(r.ftpct*100):fmt(r[c]); }
const zc=(x,c)=>{const z=x?x.z[c]:0; return z>=1.5?'hi':z<=-1?'lo':'';};
function roleOf(p,x){ if(SCORER.tagOf) return SCORER.tagOf(p)[0]; if(!x) return 'ROTATION'; const r=x.r; const big=p.eligible[0]==='C'||p.eligible[0]==='PF'; if(big){ if(r.ast>=5) return 'PLAYMAKING BIG'; if(r.fg3m>=1.2) return 'STRETCH BIG'; return 'INSIDE BIG'; } if(r.ast>=6.5) return 'MAIN HANDLER'; if(r.pts>=18) return 'SCORER'; if(r.fg3m>=1.5) return '3&D'; return 'ROTATION'; }
function cardHTML(p,x,opts={}){ const c1=toneOf(p); const bg=`linear-gradient(165deg,color-mix(in srgb,${c1} 52%,#111317) 0%,color-mix(in srgb,${c1} 34%,#0E1013) 55%,color-mix(in srgb,${c1} 20%,#0E1013) 100%)`;
  const ok=canPick(p), signed=S.picks.some(q=>q.id===p.id), over=price(p)!=null&&!signed&&!ok;
  const cell=c=>x?`<div><b>${cellVal(x,c)}</b><span>${CATL[c]}</span></div>`:'';
  const t=TEAM_OF[p.abbr+':'+p.season]; const c2=t&&t.c2&&t.c2!=='#000000'&&t.c2.toLowerCase()!==(t.c1||'').toLowerCase()?t.c2:'rgba(255,255,255,.14)';
  const stats=SCORER.cardStats?SCORER.cardStats(p,x):null;
  return `<div class="fc ${signed?'gone':ok?'':'no'}" style="background:${bg};border-color:${c2}" ${ok?`data-pick="${p.id}"`:''}><div class="hd"><span class="pr ${over?'over':''}">${price(p)>CAP?'<small>OVER THE CAP</small>':over?`<small>OVER · $${price(p)}M</small>`:`$${price(p)}<small>M</small>`}</span><span class="dots" data-player="${p.id}">···</span></div>
    <div class="first">${first(p)}</div><div class="name">${last(p)}</div><div class="tag"><span>${roleOf(p,x)}</span></div><div class="meta">${p.jersey?'#'+p.jersey+' · ':''}${p.eligible.join(' · ')}</div>
    ${stats?stats:x?`<div class="big">${cell('pts')}${cell('reb')}${cell('ast')}</div><div class="sm">${cell('stl')}${cell('blk')}${cell('fg3m')}</div><div class="sm2">${cell('fgp')}${cell('ftp')}${cell('tov')}</div>`:`<div class="big" style="opacity:.5"><div><b>${p.min?fmt(p.min):'—'}</b><span>MIN</span></div><div><b>${p.gp}</b><span>GP</span></div><div><b>—</b><span>bench</span></div></div>`}</div>`; }
function rowHTML(p,x,opts={}){ const v=x?FB.value(x,'9cat'):null; const rk=rankOf(p); const ok=canPick(p); const over=price(p)!=null&&spent()+price(p)+(4-S.picks.length)>CAP;
  return `<div class="prow ${opts.mine?'mine':''}" data-player="${p.id}"><div class="l1"><div class="pb">${p.eligible[0]}</div><div><div class="nm">${p.name[0]}. ${last(p)}<small>${p.abbr} · ${p.eligible.join(', ')}</small></div><div class="mt"><b>${v!=null?fv(v):'—'}</b>${rk?` · #${rk} of ${yr(p.season)}`:' · bench'} · ${roleOf(p,x).toLowerCase()} · ${p.gp} GP</div></div>
    ${opts.mine?'':ok?`<button class="sign" data-pick="${p.id}">Sign · $${price(p)}M</button>`:`<span class="sign no">${price(p)>CAP||over?'Over the cap':S.picks.some(q=>q.id===p.id)?'Signed':'—'}</span>`}</div>
    ${x?`<div class="l2">${CATS.map(c=>`<b class="${zc(x,c)}">${cellVal(x,c)}</b>`).join('')}</div>`:''}</div>`; }
const colh=`<div class="colh">${CATS.map(c=>`<span>${CATL[c]}</span>`).join('')}</div>`;
function dock(){ const five=S.picks; const left=CAP-spent(); return `<div class="dock"><div class="cap"><span>My five · pack ${Math.min(5,S.draftIdx+1)} of 5 · $${CAP}M cap</span><b>$${left}M left</b></div>
  <div class="five5">${[0,1,2,3,4].map(i=>{const p=five[i]; return p?`<div class="f5 on" data-player="${p.id}"><i>${p.eligible[0]}</i><b>${last(p)}</b><em>$${price(p)}M</em></div>`:'<div class="f5"><i>·</i><b class="open">open</b></div>';}).join('')}</div></div>`; }
function viewDraft(){ const pk=S.packs[S.draftIdx]; if(!pk) return viewHome(); const W=S.wheel;
  if(!S.pack) return `<div class="stage draft wheelstage"><div class="wheel ${W&&W.spinning?'live':''}" data-lock><div id="wheelrows">${W?wheelRows():''}</div></div><p class="sub dim" style="text-align:center;margin-top:14px">${W&&W.spinning?'Tap to stop':''}</p></div>${dock()}`;
  const t=pk.team; const city=t.team.split(' ').slice(0,-1).join(' '), nick=t.team.split(' ').slice(-1)[0]; const any=pk.players.some(canPick);
  const cols=SLOTS.map(sl=>({sl,men:pk.players.filter(p=>p.eligible[0]===sl)})).filter(c=>c.men.length); let k=0;
  return `<div class="stage draft"><div class="hdY"><div><div class="n">${city}</div><div class="nn ${nick.length>=12?'l12':nick.length>=10?'l10':''}">${nick}</div></div><div class="yr">${short2(t.season)}</div></div>
    <div class="kboard">${cols.map(c=>`<div class="kcol"><div class="kchead"><b>${c.sl}</b><i>${c.men.length}</i></div>${c.men.map(p=>`<div class="${S.reveal?'flip':''}" style="animation-delay:${(k++)*90}ms">${cardHTML(p,rowOf(p))}</div>`).join('')}</div>`).join('')}</div>
    ${any?'<p class="sub dim">Tap a card to sign him · ··· for the profile</p>':'<p class="sub dim"><b style="color:var(--hot)">Nobody here fits under the cap.</b></p>'}
    <div class="row2"><button class="g2 ${any?'':'hot'}" data-reroll ${(S.rerolls>0||!any)?'':'disabled'}>Spin again<em>${any?`${S.rerolls} left`:'free — nobody fits'}</em></button><button class="g2" data-quit>Quit</button></div></div>${dock()}`; }
function viewSeason(){ const sn=S.season; if(!sn||!S.team) return `<div class="stage"><div class="big" style="font-size:36px">No season yet.<small>Spin the wheel and build a five.</small></div><button class="big-cta" data-draft>Spin the wheel</button></div>`;
  const five=S.team.map(id=>PID[id]); const ladder=[...S.seasons].sort((a,b)=>b.w-a.w).slice(0,5);
  return `<div class="stage"><div class="rec2"><div class="num ${recCls(sn.w,sn.l)}">${sn.w}-${sn.l}${sn.t?`<small>-${sn.t}</small>`:''}</div><div class="lab">${SCORER.label}${sn.w===S.bestW&&S.bestTeam&&S.bestTeam.join()===S.team.join()?' · your best':''}</div></div>
    <div class="five5">${SLOTS.map((sl,i)=>{const p=five[i]; return `<div class="f5 on" data-player="${p.id}"><i>${sl}</i><b>${last(p)}</b><em>${yr(p.season)} · $${price(p)}M</em></div>`;}).join('')}</div>
    <div class="ladder">${ladder.map((x,i)=>`<div class="r ${x.team.join()===S.team.join()&&x.w===sn.w?'you':'dim'}"><span class="k">${i+1}</span><span>${x.team.map(id=>PID[id]?last(PID[id]):'?').join(' · ')}</span><b>${x.w}-${x.l}</b></div>`).join('')}<div class="r dim"><span class="k"></span><span>your seasons · the crew ladder when the league is live</span><b></b></div></div>
    ${SCORER.resultExtras(five,sn,S.packsUsed)}
    <div class="row2"><button class="big-cta" data-draft>Build again</button><button class="g2" data-share>${S.shared?'Copied':'Share'}</button></div></div>`; }
function fixFor(c){ const packs=S.packsUsed||[]; const mine=new Set(S.team); let best=null; for(const pk of packs) for(const p of pk.players){ if(mine.has(p.id)) continue; const x=rowOf(p); if(!x) continue; if(!best||x.z[c]>best.z) best={p,z:x.z[c]}; } return best&&best.z>1?`The ${TEAM_OF[best.p.abbr+':'+best.p.season].team.split(' ').slice(-1)[0]} pack had ${last(best.p)} (${cellVal(rowOf(best.p),c)} ${CATL[c]}) for $${price(best.p)}M.`:'No pack had a fix for it.'; }
function bestSwapText(mine,best){ for(let i=0;i<5;i++){ if(mine[i].id!==best[i].id) return `${last(mine[i])} → ${last(best[i])} is the swap that moves the most categories.`; } return ''; }
function viewYou(){ const b=S.bestTeam; return `<div class="stage"><div class="rec2"><div class="num ${b?'volt':'mut'}">${b?`${S.bestW}-${S.bestL}`:'—'}</div><div class="lab">Best season · ${S.seasons.length} played</div></div>
  <div class="hist">${S.seasons.slice(0,30).map(x=>`<div class="h ${x.w===S.bestW&&x.team.join()===(S.bestTeam||[]).join()?'best':''}"><div><b>${x.w}-${x.l}</b><br><span>${x.team.map(id=>PID[id]?last(PID[id]):'?').join(' · ')}</span></div><em>${x.date.slice(5)}</em><em>$${x.cost}M</em></div>`).join('')||'<p class="sub">No seasons yet.</p>'}</div>
  <button class="g2 wide ${S.resetArmed?'hot':''}" data-preset-reset>${S.resetArmed?'Tap again to reset':'Reset'}</button></div>`; }
function sheet(){ if(!S.sheet) return ''; const p=PID[S.sheet.id]; if(!p) return ''; const inDraft=S.view==='draft'&&S.pack; const inPack=inDraft&&S.packs[S.draftIdx].players.some(q=>q.id===p.id);
  const foot=inDraft?(!inPack?`<button class="g2 wide" disabled>Not in this pack</button>`:S.picks.some(q=>q.id===p.id)?`<button class="g2 wide" disabled>Signed</button>`:canPick(p)?`<button class="g2 hot wide" data-pick="${p.id}">Sign · $${price(p)}M</button>`:`<button class="g2 wide" disabled>${price(p)>CAP?'Over the cap':'Over the cap by $'+(spent()+price(p)+(4-S.picks.length)-CAP)+'M'}</button>`):'';
  return `<div class="scrim" data-pclose></div>${FB.playerSheet(p.id,{foot,readOnly:true,extra:SCORER.profileRow?SCORER.profileRow(p):''})}`; }
function render(){ let body; if(S.view==='draft') body=viewDraft(); else body=S.tab==='build'?viewHome():S.tab==='season'?viewSeason():viewYou();
  const t=S.view==='draft'&&S.pack&&S.packs[S.draftIdx]?S.packs[S.draftIdx].team:null;
  HOST.className='mode'+(S.view==='draft'?' drafting':''); HOST.setAttribute('style',t?`--c1:${clubTone(t)}`:''); HOST.innerHTML=`${body}${S.view==='draft'?'':tabs()}${sheet()}`; if(S.reveal&&S.pack) S.reveal=false; window.__shell&&window.__shell.meta(S.bestTeam?`Best ${S.bestW}-${S.bestL}`:''); }

/* ---------- events (inside this host only) ---------- */
document.addEventListener('click',e=>{ if(!HOST.contains(e.target)) return; const c=sel=>e.target.closest?e.target.closest(sel):null; let el;
  if(el=c('[data-ptab]')){ S.tab=el.dataset.ptab; S.view=null; S.sheet=null; S.resetArmed=false; render(); return; }
  if(c('[data-draft]')){ startDraft(); return; }
  if(c('[data-lock]')){ lockWheel(); return; }
  if(el=c('[data-player]')){ S.sheet={id:el.dataset.player}; render(); return; }
  if(el=c('[data-pick]')){ pick(PID[el.dataset.pick]); return; }
  if(c('[data-reroll]')){ const any=S.packs[S.draftIdx].players.some(canPick); if(S.rerolls>0||!any){ if(S.rerolls>0&&any) S.rerolls--; const t=shuffle(PACK_TEAMS.filter(x=>!S.packs.some(pk=>pk.team.id===x.id)),Math.random)[0]; S.packs[S.draftIdx]=packOf(t); spinWheel(); } return; }
  if(c('[data-quit]')){ S.view='home'; S.tab='build'; S.packs=null; S.picks=[]; S.pack=null; S.wheel=null; S.sheet=null; render(); return; }
  if(c('[data-pclose]')||c('[data-close]')){ S.sheet=null; render(); return; }
  if(c('[data-share]')){ const sn=S.season; if(!sn) return; const five=S.team.map(id=>PID[id]); const txt=`${SCORER.name==='engine'?'beatball':'Fantasyball'} — ${sn.w}-${sn.l}\n${five.map((p,i)=>`${SLOTS[i]} ${p.name} ${yr(p.season)}`).join(' · ')}\n$${five.reduce((a,p)=>a+price(p),0)}M · 82 nights, 9-cat`; const done=()=>{S.shared=true;render();setTimeout(()=>{S.shared=false;render();},2500);}; if(navigator.share){navigator.share({text:txt}).then(done).catch(()=>{});}else if(navigator.clipboard){navigator.clipboard.writeText(txt).then(done).catch(()=>{});} return; }
  if(c('[data-preset-reset]')){ if(!S.resetArmed){S.resetArmed=true;render();return;} try{localStorage.removeItem(STORE);}catch(e){} S.seasons=[];S.bestW=0;S.bestL=0;S.bestTeam=null;S.season=null;S.team=null;S.resetArmed=false;S.tab='build';S.view='home';render(); return; } });
(function(){ let y0=null,sc=null; document.addEventListener('touchstart',e=>{ if(!HOST.contains(e.target)) return; const sh=e.target.closest&&e.target.closest('.sheet'); if(!sh) return; const b=sh.querySelector('.psbody')||sh; y0=e.touches[0].clientY; sc=b.scrollTop; },{passive:true});
  document.addEventListener('touchend',e=>{ if(y0==null) return; const dy=e.changedTouches[0].clientY-y0; if(sc<=0&&dy>90&&S.sheet){ S.sheet=null; render(); } y0=null; },{passive:true}); })();
window.__packs={S,FIELD,PACK_TEAMS,render,startDraft,startSeason,playSeason,pick,expW,bestFromPacks,cardHTML,rowHTML,canPick,init(){ load(); S.view='home'; S.tab='build'; render(); }};
})();
