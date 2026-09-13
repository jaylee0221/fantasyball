// beatball-lite: the same bundle, with bench men who never start and carry no salary removed,
// and the percentile distributions precomputed on the FULL pool so nothing the player sees changes.
const fs=require('fs');const {makeEngine}=require('../src/engine.js');
const B=JSON.parse(fs.readFileSync(__dirname+'/../data/bundle-full.json','utf8')); const E=makeEngine(B);
const ADV=B.meta.advKeys, PG=B.meta.pgKeys, SLOTS=['PG','SG','SF','PF','C'];
const ai=Object.fromEntries(ADV.map((k,i)=>[k,i])), pi=Object.fromEntries(PG.map((k,i)=>[k,i]));
const pool=B.players.filter(p=>p.min>=15);
const Q=201; const quant=arr=>{const a=arr.slice().sort((x,y)=>x-y); if(!a.length) return null; return Array.from({length:Q},(_,i)=>+a[Math.min(a.length-1,Math.round(i*(a.length-1)/(Q-1)))].toFixed(4));};
const keysOf=ps=>{const d={}; for(const k of ADV) d[k]=quant(ps.map(p=>p.adv[ai[k]])); for(const k of ['fg3m','stl','blk','pts','ast','reb','tov']) d['p100:'+k]=quant(ps.map(p=>p.p100[pi[k]])); d.def=quant(ps.map(p=>E.playerDef(E.P[p.id]))); return d;};
const q={all:keysOf(pool)}; for(const sl of SLOTS) q[sl]=keysOf(pool.filter(p=>p.eligible[0]===sl));
const avg={}; for(const sl of SLOTS){ const ps=pool.filter(p=>p.eligible[0]===sl); const m={}; for(const k of ADV) m[k]=+(ps.reduce((a,p)=>a+p.adv[ai[k]],0)/ps.length).toFixed(4); for(const k of ['fg3m','stl','blk']) m['p100:'+k]=+(ps.reduce((a,p)=>a+p.p100[pi[k]],0)/ps.length).toFixed(3); m.def=+(ps.reduce((a,p)=>a+E.playerDef(E.P[p.id]),0)/ps.length).toFixed(3); avg[sl]=m; }
const keep=new Set(); for(const t of B.teams){ t.starters.forEach(i=>keep.add(i)); (t.playoffStarters||[]).forEach(i=>keep.add(i)); }
for(const p of B.players) if(p.capPct!=null) keep.add(p.id);
const L={meta:Object.assign({},B.meta,{q,posAvg:avg,lite:true}),weights:B.weights,teams:B.teams.map(t=>Object.assign({},t,{players:t.players.filter(i=>keep.has(i))})),players:B.players.filter(p=>keep.has(p.id)).map(p=>{const o=Object.assign({},p); delete o.nbaId; delete o.age; return o;})};
const js='const BEATBALL_V2='+JSON.stringify(L)+';'; fs.writeFileSync(__dirname+'/../data/bundle-lite.js',js); fs.writeFileSync(__dirname+'/../data/bundle-lite.json',JSON.stringify(L));
console.log('players',L.players.length,'bytes',js.length,'(full was',fs.statSync(__dirname+'/../data/bundle-full.json').size+')');
