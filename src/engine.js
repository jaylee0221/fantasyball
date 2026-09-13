/* engine v2 on the game bundle — same math as engine2.js, bundle layout (array stats). */
function makeEngine(BUNDLE){
  const W=BUNDLE.weights, PG=BUNDLE.meta.pgKeys, ADV=BUNDLE.meta.advKeys;
  const pgi=Object.fromEntries(PG.map((k,i)=>[k,i])), advi=Object.fromEntries(ADV.map((k,i)=>[k,i]));
  const P={}; for(const p of BUNDLE.players) P[p.id]=p;
  const T={}; for(const t of BUNDLE.teams) T[t.id]=t;
  /* Bench minutes are less trustworthy than starter minutes: a man's z-scores are pulled toward the
     league average by his playing time. Starters (30+ min) are untouched, so the fit to real fives holds;
     an 18-minute man keeps 84% of his signal, a 12-minute man 70%, an 8-minute man 56%. */
  const trust=p=>Math.min(1,((p.min||0)/((p.min||0)+20))/(30/(30+20)));   // 24 min → .93, 18 → .84, 12 → .70, 8 → .56
  const st=(p,k)=>p.p100[pgi[k]], adv=(p,k)=>p.adv[advi[k]];
  const z=(p,k,v)=>{const m=W.SM[p.season+':'+k]; return trust(p)*(v-m[0])/m[1];};
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v)), mean=a=>a.reduce((x,y)=>x+y,0)/a.length;
  function tax(ps){ const u=ps.reduce((a,p)=>a+adv(p,'usg'),0)*100; if(u<=100) return ps.map(()=>1);
    const cut=u-100, dep=ps.map(p=>adv(p,'astPct')*100+adv(p,'tovPct')), s=dep.reduce((a,b)=>a+b,0)||1;
    return ps.map((p,i)=>Math.max(.75,1-(cut*dep[i]/s)/(adv(p,'usg')*100))); }   // floor .75: five alphas are a decent team, not a losing one; real fives (Σ≤115) are untouched
  function offFeats(ps){ const f=tax(ps), x=[];
    for(const k of ['pts','ast','fg3m','tov']) x.push(ps.reduce((a,p,i)=>a+z(p,k,st(p,k))*f[i],0));
    for(const k of ['fta','fga']) x.push(ps.reduce((a,p)=>a+z(p,k,st(p,k)),0));
    x.push(mean(ps.map(p=>z(p,'ts',adv(p,'ts'))))); x.push(mean(ps.map(p=>z(p,'threePAr',adv(p,'threePAr')))));
    x.push(mean(ps.map(p=>z(p,'rebPct',adv(p,'rebPct'))))); x.push(ps.reduce((a,p)=>a+adv(p,'usg'),0)*100-100); return x; }
  const boxDef=p=>.35*z(p,'stl',st(p,'stl'))+.35*z(p,'blk',st(p,'blk'))+.2*z(p,'rebPct',adv(p,'rebPct'))+.1*(((p.ht||79)-79)/3.5);
  const playerDef=p=>.6*clamp(z(p,'onDef',W.LGD[p.season]-adv(p,'drtg')),-2.5,2.5)+.4*clamp(boxDef(p),-2.5,2.5);
  const dot=(a,b)=>a.reduce((s,v,i)=>s+v*b[i],0), sig=x=>1/(1+Math.exp(-x));
  function rate(ps){ const off=dot(offFeats(ps),W.off.coef)+W.off.b, def=W.def.coef*mean(ps.map(playerDef))+W.def.b; return {ortg:off,drtg:def,net:off-def,taxed:tax(ps),defs:ps.map(playerDef)}; }
  function series(A,B,home){ const ra=rate(A), rb=rate(B); const lin=W.series.net*(ra.net-rb.net)+W.series.home*(home||0)+W.series.b; return {p:sig(lin),net:ra.net-rb.net,A:ra,B:rb}; }
  function bo7(p){ let s=0; for(let k=0;k<=3;k++){ let c=1; for(let i=1;i<=k;i++) c=c*(3+i)/i; s+=c*Math.pow(p,4)*Math.pow(1-p,k);} return s; }
  function game(A,B,home){ const s=series(A,B,home).p; let lo=.01,hi=.99; for(let i=0;i<40;i++){ const m=(lo+hi)/2; if(bo7(m)<s) lo=m; else hi=m; } return (lo+hi)/2; }
  const five=(t,po)=>{ const ids=(po&&t.playoffStarters.length===5&&t.playoffStarters.every(Boolean))?t.playoffStarters:t.starters; const ps=ids.map(i=>P[i]); return ps.every(Boolean)?ps:null; };
  return {P,T,trust,rate,series,game,five,tax,playerDef,st,adv,W};
}
if(typeof module!=='undefined') module.exports={makeEngine};
if(typeof require!=='undefined'&&require.main===module){
  const B=JSON.parse(require('fs').readFileSync(process.argv[2]||'beatball-v2-bundle.json','utf8')); const E=makeEngine(B);
  let n=0,hit=0,ll=0,hn=0,hh=0;
  for(const s of B.series){ const A=E.T[s.teams[0]],Bt=E.T[s.teams[1]]; const fa=E.five(A,true),fb=E.five(Bt,true); if(!fa||!fb) continue;
    const r=E.series(fa,fb,s.home===s.teams[0]?1:-1); const y=s.winner===s.teams[0]; n++; if((r.p>=.5)===y) hit++; ll+=-Math.log(y?r.p:1-r.p); if(s.season>='2016-17'){hn++; if((r.p>=.5)===y) hh++;} }
  console.log(`bundle backtest: ${n} series, ${(100*hit/n).toFixed(1)}% (held-out ${(100*hh/hn).toFixed(1)}%), log-loss ${(ll/n).toFixed(3)}`);
  const legends=B.teams.map(t=>({t,f:E.five(t,false)})).filter(x=>x.f).map(x=>({id:x.t.id,team:x.t.team,season:x.t.season,rec:x.t.record,net:E.rate(x.f).net})).sort((a,b)=>b.net-a.net);
  console.log('top 12 fives by engine v2:',legends.slice(0,12).map(l=>`${l.id} ${l.net.toFixed(1)} (${l.rec.w}-${l.rec.l})`).join(' | '));
}
