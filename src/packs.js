(function(){
const HOST=document.getElementById('mode-packs');
/* ============================================================================
   BEATBALL v3 — one team, one run, learn by losing.
   Engine v2 (stats.nba.com data, calibrated on 450 real playoff series).
   ============================================================================ */
'use strict';
const B=BEATBALL_V2, E=makeEngine(B);
const $=id=>document.getElementById(id);
const PG=B.meta.pgKeys, ADV=B.meta.advKeys, pgi=Object.fromEntries(PG.map((k,i)=>[k,i])), advi=Object.fromEntries(ADV.map((k,i)=>[k,i]));
const pg=(p,k)=>p.pg[pgi[k]], p100=(p,k)=>p.p100[pgi[k]], adv=(p,k)=>p.adv[advi[k]];
const SLOTS=['PG','SG','SF','PF','C'], CAP=100;
const price=p=>Math.max(1,Math.round((p.capPct||0)*100));
const last=p=>p.name.split(' ').slice(-1)[0];
const yr=s=>s.slice(2,4)+'-'+s.slice(-2);      // "2016-17" → "16-17"
const short=s=>"'"+s.slice(-2);                // "2016-17" → "'17"
const fmt=(v,d=1)=>(v==null||isNaN(v))?'–':v.toFixed(d);
const pct=v=>Math.round(v*100)+'%';
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const mean=a=>a.reduce((x,y)=>x+y,0)/(a.length||1);
function mulberry32(a){return function(){a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};}
const shuffle=(arr,rng)=>{const a=arr.slice();for(let i=a.length-1;i>0;i--){const j=Math.floor(rng()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;};
const dayKey=()=>{const d=new Date();return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');};
const daySeed=k=>{let h=2166136261;for(const c of k){h^=c.charCodeAt(0);h=Math.imul(h,16777619);}return h>>>0;};
const dayNumber=()=>Math.floor((Date.now()-Date.UTC(2025,8,1))/86400000);
const dayLabel=()=>new Date().toLocaleDateString('en-US',{weekday:'short',month:'short',day:'numeric'}).toUpperCase();

/* ---------- the field: every real five, rated; tiers for the bracket ---------- */
const FIELD=B.teams.map(t=>({t,f:E.five(t,false)})).filter(x=>x.f).map(x=>{const r=E.rate(x.f);return{id:x.t.id,t:x.t,five:x.f,net:r.net,wp:x.t.record.w/(x.t.record.w+x.t.record.l)};}).sort((a,b)=>b.net-a.net);
const FIELD_BY_ID=Object.fromEntries(FIELD.map(x=>[x.id,x]));
const TIERS=(()=>{ /* fame filter × engine band — a real bracket: playoff teams, then 50-win teams, then 60-win teams, then the greatest.
     Calibrated with bot drafts so a well-read five wins round 1 ~85% and takes a ring ~10% of runs; a scorer-chasing five is out in round 1 half the time. */
  const band=(w,lo,hi)=>FIELD.filter(x=>x.wp>=w&&x.net>=lo&&x.net<hi);
  const T4=FIELD.filter(x=>x.wp>=.79).slice(0,6), used=new Set(T4.map(x=>x.id));
  const T3=band(.68,3,6.5).filter(x=>!used.has(x.id)).slice(0,30); T3.forEach(x=>used.add(x.id));
  const T2=band(.60,1,3.5).filter(x=>!used.has(x.id)).slice(0,60); T2.forEach(x=>used.add(x.id));
  const T1=band(.50,-2,1).filter(x=>!used.has(x.id)).slice(0,100);
  return [T1,T2,T3,T4];})();
const ROUND_NAME=['ROUND 1','ROUND 2','CONFERENCE FINALS','THE FINALS'], ROUND_TIER=['PLAYOFF TEAMS','50-WIN TEAMS','60-WIN TEAMS','THE GREATEST'];
const HOME_NET=[0,.5,1,1.5];                     // the higher seed's edge, in net-rating points (data says home court ≈ 3.3 over a series; we give the legends half of it)
const PACK_TEAMS=B.teams.filter(t=>t.record.w>=45&&t.players.filter(id=>E.P[id]&&E.P[id].capPct!=null).length>=8);   // playoff-calibre clubs only
const TEAM_OF={}; for(const t of B.teams) TEAM_OF[t.abbr+':'+t.season]=t;
/* club tone: which of the two club colours carries the screen. A near-black or near-white primary
   (Spurs, Nets, Kings' black) hands over to the secondary; if both are neutral the body is a lifted
   graphite and the neutral becomes the frame. Very dark navies are lifted a touch so every club
   sits in the same band of brightness. */
const hexRgb=h=>{h=h.replace('#',''); if(h.length===3) h=h.split('').map(c=>c+c).join(''); return [0,2,4].map(i=>parseInt(h.slice(i,i+2),16)/255);};
const lum=h=>{const [r,g,b]=hexRgb(h).map(v=>v<=.03928?v/12.92:Math.pow((v+.055)/1.055,2.4)); return .2126*r+.7152*g+.0722*b;};
const sat=h=>{const [r,g,b]=hexRgb(h); const mx=Math.max(r,g,b),mn=Math.min(r,g,b); return mx?(mx-mn)/mx:0;};
const mixHex=(a,b,t)=>{const A=hexRgb(a),B=hexRgb(b); return '#'+A.map((v,i)=>Math.round(255*(v*(1-t)+B[i]*t)).toString(16).padStart(2,'0')).join('');};
const usable=h=>sat(h)>=.25&&lum(h)>=.008&&lum(h)<=.55;
function clubTone(t){ const c1=t.c1||'#123C86', c2=t.c2||'#4DA8FF'; let body, frame;
  if(usable(c1)){ body=c1; frame=c2; } else if(usable(c2)){ body=c2; frame=c1; } else { body='#2B3038'; frame=lum(c2)>lum(c1)?c2:c1; }
  if(lum(body)<.04) body=mixHex(body,'#ffffff',.12);
  if(lum(frame)<.08) frame='rgba(255,255,255,.45)'; else if(lum(frame)>.9) frame='rgba(255,255,255,.7)';
  return {body,frame,wash:body}; }
const colorsOf=p=>{const t=TEAM_OF[p.abbr+':'+p.season]; return t?Object.assign({c1:t.c1,c2:t.c2},clubTone(t)):Object.assign({c1:'#123C86',c2:'#4DA8FF'},clubTone({c1:'#123C86',c2:'#4DA8FF'}));};
/* card tier: where the man sits among every player-season since 1996-97 (PIE percentile, an nba.com stat) */
const tierOf=p=>{const q=pctile('pie',adv(p,'pie'))||0; return q>=.92?'holo':q>=.72?'gold':q>=.4?'silver':'bronze';};
const TIER_LOOK={holo:{c:'#F5C518',bg:'linear-gradient(165deg,#3a2a52,#1a1030 60%,#0a0713)'},gold:{c:'#C9A227',bg:'linear-gradient(165deg,#3a3018,#1e1a0d 60%,#0b0906)'},silver:{c:'#9AA5B1',bg:'linear-gradient(165deg,#2a323c,#161b22 60%,#0a0d11)'},bronze:{c:'#A9713B',bg:'linear-gradient(165deg,#33241a,#1c1410 60%,#0a0706)'}};
const ACC={"jamesl":["ALL-NBA 1ST","ALL-STAR"],"thompsonk":["ALL-STAR"],"currys":["ALL-NBA 2ND","ALL-STAR"],"greend":["DPOY","ALL-NBA 3RD"],"durantk":["ALL-NBA 2ND","ALL-STAR"],"jordanm":["ALL-NBA 1ST"],"pippens":["ALL-NBA 1ST"],"oneals":["ALL-NBA 1ST","ALL-STAR"],"bryantk":["ALL-NBA 2ND","ALL-STAR"],"piercep":["ALL-NBA 3RD","ALL-STAR"],"allenr":["ALL-STAR"],"garnettk":["DPOY","ALL-NBA 1ST"],"parkert":["ALL-NBA 2ND","ALL-STAR"],"antetokounmpog":["MVP","DPOY"],"middletonk":["ALL-STAR"],"jamesl2":["MVP","ALL-NBA 1ST"],"boshc":["ALL-STAR"],"waded":["ALL-NBA 3RD","ALL-STAR"],"greend3":["ALL-NBA 2ND","ALL-STAR"],"currys2":["MVP","ALL-NBA 1ST"],"thompsonk2":["ALL-NBA 3RD","ALL-STAR"],"wallaceb":["ALL-NBA 2ND","ALL-STAR"],"lowryk":["ALL-STAR"],"leonardk2":["ALL-STAR"],"nowitzkid":["ALL-NBA 2ND","ALL-STAR"],"bryantk2":["ALL-NBA 1ST","ALL-STAR"],"gasolp":["ALL-NBA 3RD","ALL-STAR"],"bryantk3":["ALL-NBA 1ST","ALL-STAR"],"oneals2":["ALL-NBA 1ST","ALL-STAR"],"oneals3":["MVP","ALL-NBA 1ST"],"bryantk4":["ALL-NBA 2ND","ALL-STAR"],"duncant2":["MVP","ALL-NBA 1ST"],"duncant3":["ALL-NBA 1ST","ALL-STAR"],"ginobilim2":["ALL-STAR"],"waded2":["ALL-NBA 2ND","ALL-STAR"],"oneals4":["ALL-NBA 1ST","ALL-STAR"],"gasolp2":["ALL-NBA 3RD","ALL-STAR"],"bryantk5":["ALL-NBA 1ST","ALL-STAR"],"jamesl3":["MVP","ALL-NBA 1ST"],"boshc2":["ALL-STAR"],"waded3":["ALL-NBA 3RD","ALL-STAR"],"marions2":["ALL-NBA 3RD","ALL-STAR"],"stoudemirea":["ALL-NBA 2ND","ALL-STAR"],"nashs":["MVP","ALL-NBA 1ST"],"marions3":["ALL-STAR"],"stoudemirea2":["ALL-NBA 1ST","ALL-STAR"],"nashs2":["ALL-NBA 1ST","ALL-STAR"],"stoudemirea3":["ALL-NBA 2ND","ALL-STAR"],"nashs3":["ALL-NBA 2ND","ALL-STAR"],"allenr3":["ALL-NBA 2ND","ALL-STAR"],"lewisr2":["ALL-STAR"],"kiddj2":["ALL-NBA 2ND","ALL-STAR"],"royb":["ALL-NBA 2ND","ALL-STAR"],"mingy":["ALL-NBA 2ND","ALL-STAR"],"williamsd":["ALL-NBA 2ND"],"boozerc":["ALL-NBA 3RD","ALL-STAR"],"paulc":["ALL-NBA 1ST","ALL-STAR"],"westd2":["ALL-STAR"],"jordanm2":["ALL-NBA 1ST"],"pippens2":["ALL-NBA 2ND"],"jordanm3":["ALL-NBA 1ST"],"pippens3":["ALL-NBA 3RD"],"malonek":["ALL-NBA 1ST"],"stocktonj":["ALL-NBA 3RD"],"malonek2":["ALL-NBA 1ST"],"duncant4":["ALL-NBA 1ST"],"millerr":["ALL-STAR"],"davisd":["ALL-STAR"],"iversona":["MVP","ALL-NBA 1ST"],"mutombod2":["DPOY","ALL-NBA 2ND"],"ratlifft":["ALL-STAR"],"stojakovicp3":["ALL-STAR"],"webberc":["ALL-NBA 2ND","ALL-STAR"],"garnettk2":["MVP","ALL-NBA 1ST"],"cassells2":["ALL-NBA 2ND","ALL-STAR"],"onealj":["ALL-NBA 2ND","ALL-STAR"],"peacem3":["DPOY","ALL-NBA 3RD"],"wallaceb2":["DPOY","ALL-NBA 3RD"],"nowitzkid2":["ALL-NBA 1ST","ALL-STAR"],"jamesl4":["MVP","ALL-NBA 1ST"],"williamsm3":["ALL-STAR"],"lewisr3":["ALL-STAR"],"howardd":["DPOY","ALL-NBA 1ST"],"nelsonj":["ALL-STAR"],"rondor2":["ALL-STAR"],"piercep2":["ALL-STAR"],"garnettk3":["ALL-STAR"],"durantk2":["ALL-NBA 1ST","ALL-STAR"],"westbrookr":["ALL-NBA 2ND","ALL-STAR"],"gasolm2":["DPOY","ALL-NBA 2ND"],"randolphz":["ALL-STAR"],"griffinb":["ALL-NBA 2ND","ALL-STAR"],"paulc2":["ALL-NBA 1ST","ALL-STAR"],"korverk3":["ALL-STAR"],"millsapp2":["ALL-STAR"],"horforda":["ALL-STAR"],"teaguej":["ALL-STAR"],"hardenj2":["ALL-NBA 1ST","ALL-STAR"],"thompsonk3":["ALL-STAR"],"durantk3":["ALL-NBA 1ST","ALL-STAR"],"greend5":["ALL-STAR"],"currys3":["ALL-NBA 3RD","ALL-STAR"],"middletonk2":["ALL-STAR"],"antetokounmpog2":["MVP","ALL-STAR"],"lillardd":["ALL-STAR"],"townsk":["ALL-NBA 3RD","ALL-STAR"],"butlerj":["ALL-NBA 3RD","ALL-STAR"],"jokicn2":["ALL-STAR"],"duncant5":["ALL-NBA 1ST","ALL-STAR"],"robinsond3":["ALL-NBA 3RD","ALL-STAR"],"duncant6":["ALL-NBA 1ST","ALL-STAR"],"parkert4":["ALL-STAR"],"bryantk6":["MVP","ALL-NBA 1ST"],"nowitzkid3":["ALL-NBA 2ND","ALL-STAR"],"nashs4":["ALL-NBA 3RD","ALL-STAR"],"nowitzkid4":["ALL-NBA 2ND","ALL-STAR"],"kiddj3":["ALL-STAR"],"stojakovicp4":["ALL-NBA 2ND","ALL-STAR"],"millerb":["ALL-STAR"],"billupsc3":["ALL-NBA 2ND","ALL-STAR"],"wallaceb4":["DPOY","ALL-NBA 2ND"],"hamiltonr3":["ALL-STAR"],"wallacer4":["ALL-STAR"],"jamesl5":["ALL-NBA 1ST","ALL-STAR"],"howardd2":["DPOY","ALL-NBA 1ST"],"piercep3":["ALL-STAR"],"rondor3":["ALL-NBA 3RD","ALL-STAR"],"durantk4":["MVP","ALL-NBA 1ST"],"georgep":["ALL-NBA 3RD","ALL-STAR"],"hibbertr":["ALL-STAR"],"rosed2":["MVP","ALL-NBA 1ST"],"dengl2":["ALL-STAR"],"rosed3":["ALL-STAR"],"hardenj3":["ALL-NBA 1ST","ALL-STAR"],"lowryk3":["ALL-NBA 3RD","ALL-STAR"],"derozand":["ALL-STAR"],"lillardd2":["ALL-NBA 3RD","ALL-STAR"],"aldridgel2":["ALL-NBA 3RD","ALL-STAR"],"gasolm3":["ALL-NBA 1ST","ALL-STAR"],"wallj":["ALL-NBA 3RD","ALL-STAR"],"gobertr":["ALL-NBA 2ND"],"haywardg":["ALL-STAR"],"embiidj":["ALL-NBA 2ND","ALL-STAR"],"jokicn3":["ALL-STAR"],"leonardk3":["ALL-STAR"],"harrellm":["6MOY"],"adebayob":["ALL-STAR"],"butlerj2":["ALL-STAR"],"hardenj4":["ALL-STAR"],"anthonyc":["ALL-NBA 2ND","ALL-STAR"],"chandlert3":["ALL-STAR"],"johnsonj5":["ALL-NBA 3RD","ALL-STAR"],"horforda2":["ALL-STAR"],"dragicg3":["ALL-NBA 3RD"],"paulc5":["ALL-NBA 3RD","ALL-STAR"],"piercep4":["ALL-NBA 2ND","ALL-STAR"],"allenr6":["ALL-STAR"],"garnettk5":["ALL-STAR"],"oneals5":["ALL-NBA 1ST","ALL-STAR"],"bryantk7":["ALL-NBA 1ST","ALL-STAR"],"gasolp5":["ALL-NBA 2ND","ALL-STAR"],"bryantk8":["ALL-NBA 1ST","ALL-STAR"],"leonardk4":["DPOY","ALL-NBA 1ST"],"aldridgel3":["ALL-NBA 3RD","ALL-STAR"],"nashs5":["ALL-NBA 2ND","ALL-STAR"],"stoudemirea5":["ALL-NBA 2ND","ALL-STAR"],"thompsonk4":["ALL-STAR"],"currys5":["ALL-STAR"],"jamesl6":["ALL-NBA 1ST","ALL-STAR"],"boshc3":["ALL-STAR"],"waded4":["ALL-STAR"],"durantk5":["ALL-NBA 1ST","ALL-STAR"],"westbrookr3":["ALL-NBA 2ND","ALL-STAR"],"westbrookr4":["ALL-NBA 1ST","ALL-STAR"],"durantk6":["ALL-NBA 2ND","ALL-STAR"],"jamesl7":["ALL-NBA 1ST","ALL-STAR"],"irvingk2":["ALL-STAR"],"lovek2":["ALL-STAR"],"allenr8":["ALL-NBA 3RD","ALL-STAR"],"robinsong":["ALL-STAR"],"garnettk6":["ALL-NBA 2ND","ALL-STAR"],"jordand2":["ALL-NBA 1ST"],"paulc6":["ALL-NBA 2ND","ALL-STAR"],"williamsd4":["ALL-NBA 2ND","ALL-STAR"],"lopezb3":["ALL-STAR"],"olajuwonh":["ALL-NBA 1ST"],"riceg2":["ALL-NBA 2ND"],"masona":["ALL-NBA 3RD"],"paytong3":["ALL-NBA 2ND"],"hardawaya":["ALL-NBA 3RD"],"hardawayt":["ALL-NBA 1ST"],"hillg7":["ALL-NBA 1ST"],"oneals7":["ALL-NBA 1ST"],"stricklandr2":["ALL-NBA 2ND"],"paytong4":["ALL-NBA 1ST"],"bakerv":["ALL-NBA 2ND"],"hardawayt2":["ALL-NBA 2ND"],"hillg8":["ALL-NBA 2ND"],"kiddj7":["ALL-NBA 1ST"],"garnettk8":["ALL-NBA 3RD"],"malonek4":["ALL-NBA 1ST"],"stocktonj3":["ALL-NBA 3RD"],"iversona2":["ALL-NBA 1ST"],"paytong5":["ALL-NBA 2ND"],"bryantk10":["ALL-NBA 3RD"],"oneals8":["ALL-NBA 2ND"],"hardawayt3":["ALL-NBA 2ND"],"mourninga4":["ALL-NBA 1ST"],"hillg9":["ALL-NBA 2ND"],"kiddj8":["ALL-NBA 1ST","ALL-STAR"],"jonese2":["ALL-NBA 3RD","ALL-STAR"],"carterv3":["ALL-NBA 3RD","ALL-STAR"],"webberc5":["ALL-NBA 3RD","ALL-STAR"],"paytong6":["ALL-NBA 1ST","ALL-STAR"],"finleym4":["ALL-STAR"],"garnettk9":["ALL-NBA 1ST","ALL-STAR"],"malonek5":["ALL-NBA 2ND","ALL-STAR"],"stocktonj4":["ALL-STAR"],"allenr10":["ALL-STAR"],"robinsong3":["ALL-STAR"],"stackhousej5":["ALL-STAR"],"hillg10":["ALL-NBA 2ND","ALL-STAR"],"mourninga5":["DPOY","ALL-NBA 2ND"],"webberc6":["ALL-NBA 1ST","ALL-STAR"],"divacv5":["ALL-STAR"],"finleym5":["ALL-STAR"],"nowitzkid6":["ALL-NBA 3RD"],"garnettk10":["ALL-NBA 2ND","ALL-STAR"],"kiddj9":["ALL-NBA 1ST","ALL-STAR"],"carterv4":["ALL-NBA 2ND","ALL-STAR"],"davisa2":["ALL-STAR"],"mcdyessa4":["ALL-STAR"],"mcgradyt3":["ALL-NBA 2ND","ALL-STAR"],"nowitzkid7":["ALL-NBA 2ND","ALL-STAR"],"nashs9":["ALL-NBA 3RD","ALL-STAR"],"garnettk11":["ALL-NBA 2ND","ALL-STAR"],"szczerbiakw6":["ALL-STAR"],"allenr11":["ALL-STAR"],"mcgradyt4":["ALL-NBA 1ST","ALL-STAR"],"davisb2":["ALL-STAR"],"carterv5":["ALL-STAR"],"mutombod4":["ALL-NBA 3RD","ALL-STAR"],"iversona3":["ALL-NBA 2ND","ALL-STAR"],"wallaceb7":["DPOY","ALL-NBA 3RD"],"brande2":["ALL-STAR"],"webberc7":["ALL-NBA 2ND","ALL-STAR"],"stojakovicp8":["ALL-STAR"],"bryantk11":["ALL-NBA 1ST","ALL-STAR"],"oneals9":["ALL-NBA 1ST","ALL-STAR"],"paytong7":["ALL-STAR"],"mashburnj7":["ALL-NBA 3RD","ALL-STAR"],"onealj3":["ALL-NBA 3RD","ALL-STAR"],"millerb4":["ALL-STAR"],"garnettk12":["ALL-NBA 1ST","ALL-STAR"],"marions6":["ALL-STAR"],"marburys4":["ALL-NBA 3RD","ALL-STAR"],"walkera4":["ALL-STAR"],"piercep7":["ALL-NBA 3RD","ALL-STAR"],"iversona4":["ALL-NBA 2ND","ALL-STAR"],"nowitzkid8":["ALL-NBA 3RD","ALL-STAR"],"magloirej3":["ALL-STAR"],"davisb4":["ALL-NBA 3RD","ALL-STAR"],"kiddj10":["ALL-NBA 1ST","ALL-STAR"],"martink5":["ALL-STAR"],"allenr12":["ALL-STAR"],"duncant8":["ALL-NBA 1ST","ALL-STAR"],"franciss":["ALL-STAR"],"mingy2":["ALL-NBA 3RD","ALL-STAR"],"waded5":["ALL-NBA 2ND","ALL-STAR"],"oneals10":["ALL-NBA 1ST","ALL-STAR"],"arenasg":["ALL-NBA 3RD","ALL-STAR"],"jamisona2":["ALL-STAR"],"nowitzkid9":["ALL-NBA 1ST","ALL-STAR"],"mcgradyt5":["ALL-NBA 3RD","ALL-STAR"],"mingy3":["ALL-STAR"],"jamesl8":["ALL-NBA 2ND","ALL-STAR"],"ilgauskasz3":["ALL-STAR"],"carterv6":["ALL-STAR"],"bryantk12":["ALL-NBA 3RD","ALL-STAR"],"marions7":["ALL-NBA 3RD","ALL-STAR"],"nashs11":["MVP","ALL-NBA 1ST"],"iversona5":["ALL-NBA 3RD","ALL-STAR"],"brande3":["ALL-NBA 2ND","ALL-STAR"],"anthonyc2":["ALL-NBA 3RD"],"carterv7":["ALL-STAR"],"allenr13":["ALL-STAR"],"jamesl9":["ALL-NBA 1ST","ALL-STAR"],"gasolp7":["ALL-STAR"],"bryantk13":["ALL-NBA 1ST","ALL-STAR"],"mcgradyt6":["ALL-NBA 2ND","ALL-STAR"],"mingy4":["ALL-NBA 2ND","ALL-STAR"],"arenasg2":["ALL-NBA 2ND","ALL-STAR"],"butlerc5":["ALL-STAR"],"allenr14":["ALL-STAR"],"iversona6":["ALL-STAR"],"anthonyc3":["ALL-NBA 3RD","ALL-STAR"],"cambym4":["DPOY"],"bryantk14":["ALL-NBA 1ST","ALL-STAR"],"hamiltonr5":["ALL-STAR"],"billupsc6":["ALL-NBA 3RD","ALL-STAR"],"nowitzkid10":["MVP","ALL-NBA 1ST"],"howardj8":["ALL-STAR"],"iversona7":["ALL-STAR"],"anthonyc4":["ALL-STAR"],"kiddj13":["ALL-STAR"],"nowitzkid11":["ALL-NBA 2ND","ALL-STAR"],"waded6":["ALL-STAR"],"nowitzkid12":["ALL-NBA 1ST","ALL-STAR"],"johnsonj8":["ALL-STAR"],"boshc4":["ALL-STAR"],"grangerd3":["ALL-STAR"],"oneals11":["ALL-NBA 3RD","ALL-STAR"],"stoudemirea6":["ALL-STAR"],"billupsc7":["ALL-NBA 3RD","ALL-STAR"],"anthonyc5":["ALL-NBA 3RD"],"jamesl10":["MVP","ALL-NBA 1ST"],"randolphz3":["ALL-STAR"],"royb2":["ALL-NBA 3RD","ALL-STAR"],"anthonyc6":["ALL-NBA 2ND","ALL-STAR"],"billupsc8":["ALL-STAR"],"wallaceg6":["ALL-STAR"],"leed":["ALL-STAR"],"randolphz4":["ALL-NBA 3RD"],"jamesl11":["ALL-NBA 1ST","ALL-STAR"],"waded7":["ALL-NBA 2ND","ALL-STAR"],"boshc5":["ALL-STAR"],"durantk7":["ALL-NBA 1ST","ALL-STAR"],"westbrookr5":["ALL-NBA 2ND","ALL-STAR"],"allenr15":["ALL-STAR"],"piercep8":["ALL-STAR"],"rondor5":["ALL-STAR"],"garnettk13":["ALL-STAR"],"aldridgel5":["ALL-NBA 3RD"],"howardd4":["DPOY","ALL-NBA 1ST"],"stoudemirea7":["ALL-NBA 2ND","ALL-STAR"],"anthonyc7":["ALL-STAR"],"griffinb3":["ALL-NBA 2ND","ALL-STAR"],"paulc7":["ALL-NBA 1ST","ALL-STAR"],"gasolm6":["ALL-STAR"],"bryantk15":["ALL-NBA 1ST","ALL-STAR"],"bynuma7":["ALL-NBA 2ND","ALL-STAR"],"howardd5":["ALL-NBA 1ST","ALL-STAR"],"chandlert5":["DPOY","ALL-NBA 3RD"],"anthonyc8":["ALL-NBA 3RD","ALL-STAR"],"johnsonj9":["ALL-STAR"],"bryantk16":["ALL-NBA 1ST","ALL-STAR"],"howardd6":["ALL-NBA 3RD","ALL-STAR"],"parkert7":["ALL-NBA 2ND","ALL-STAR"],"duncant9":["ALL-NBA 1ST","ALL-STAR"],"hardenj6":["ALL-NBA 3RD","ALL-STAR"],"griffinb4":["ALL-NBA 2ND","ALL-STAR"],"paulc8":["ALL-NBA 1ST","ALL-STAR"],"georgep3":["ALL-NBA 3RD","ALL-STAR"],"holidayj":["ALL-STAR"],"hardenj7":["ALL-NBA 1ST","ALL-STAR"],"howardd7":["ALL-NBA 2ND","ALL-STAR"],"davisa4":["ALL-STAR"],"currys7":["ALL-NBA 2ND","ALL-STAR"],"millsapp9":["ALL-STAR"],"lovek3":["ALL-NBA 2ND","ALL-STAR"],"wallj2":["ALL-STAR"],"nowitzkid13":["ALL-STAR"],"currys8":["MVP","ALL-NBA 1ST"],"thompsonk6":["ALL-NBA 3RD","ALL-STAR"],"paulc9":["ALL-NBA 2ND","ALL-STAR"],"jordand5":["ALL-NBA 3RD"],"griffinb5":["ALL-NBA 3RD","ALL-STAR"],"davisa5":["ALL-NBA 1ST","ALL-STAR"],"irvingk3":["ALL-NBA 3RD","ALL-STAR"],"jamesl12":["ALL-NBA 1ST","ALL-STAR"],"westbrookr6":["ALL-NBA 2ND","ALL-STAR"],"durantk8":["ALL-STAR"],"lillardd3":["ALL-STAR"],"aldridgel6":["ALL-NBA 2ND","ALL-STAR"],"duncant10":["ALL-NBA 3RD","ALL-STAR"],"leonardk6":["DPOY"],"gasolp10":["ALL-NBA 2ND","ALL-STAR"],"butlerj3":["ALL-STAR"],"nowitzkid14":["ALL-STAR"],"hardenj8":["ALL-STAR"],"davisa6":["ALL-STAR"],"cousinsd2":["ALL-NBA 2ND","ALL-STAR"],"millsapp10":["ALL-STAR"],"horforda6":["ALL-STAR"],"wallj3":["ALL-STAR"],"waded8":["ALL-STAR"],"boshc6":["ALL-STAR"],"davisa7":["ALL-NBA 1ST","ALL-STAR"],"cousinsd3":["ALL-STAR"],"hardenj9":["ALL-NBA 1ST","ALL-STAR"],"thomasi":["ALL-NBA 2ND","ALL-STAR"],"jordand6":["ALL-NBA 3RD","ALL-STAR"],"derozand2":["ALL-NBA 3RD","ALL-STAR"],"lowryk5":["ALL-STAR"],"antetokounmpog4":["ALL-NBA 2ND","ALL-STAR"],"georgep4":["ALL-STAR"],"davisa8":["ALL-NBA 1ST","ALL-STAR"],"cousinsd4":["ALL-STAR"],"antetokounmpog5":["ALL-NBA 2ND","ALL-STAR"],"westbrookr7":["ALL-NBA 2ND","ALL-STAR"],"georgep5":["ALL-NBA 3RD","ALL-STAR"],"bealb4":["ALL-STAR"],"wallj4":["ALL-STAR"],"jamesl13":["ALL-NBA 1ST","ALL-STAR"],"lovek5":["ALL-STAR"],"oladipov":["ALL-NBA 3RD","ALL-STAR"],"lillardd4":["ALL-NBA 1ST","ALL-STAR"],"georgep6":["ALL-STAR"],"westbrookr8":["ALL-STAR"],"davisa9":["ALL-STAR"],"irvingk4":["ALL-STAR"],"gobertr2":["DPOY"],"oladipov2":["ALL-STAR"],"walkerk2":["ALL-STAR"],"vucevicn":["ALL-STAR"],"tatumj2":["ALL-STAR"],"walkerk3":["ALL-STAR"],"siakamp2":["ALL-STAR"],"lowryk6":["ALL-STAR"],"simmonsb2":["ALL-STAR"],"embiidj2":["ALL-STAR"],"youngt5":["ALL-STAR"],"lillardd5":["ALL-STAR"],"bookerd":["ALL-STAR"],"doncicl":["ALL-STAR"],"ingramb":["ALL-STAR"]};

/* ---------- series math ---------- */
function seriesProb(mine,theirs,round){ const r=E.series(mine,theirs,0); const lin=E.W.series.net*(r.net-HOME_NET[round])+E.W.series.b; return {p:1/(1+Math.exp(-lin)),net:r.net-HOME_NET[round],A:r.A,B:r.B}; }
function bo7(p){let s=0;for(let k=0;k<=3;k++){let c=1;for(let i=1;i<=k;i++)c=c*(3+i)/i;s+=c*Math.pow(p,4)*Math.pow(1-p,k);}return s;}
function gameProb(sp){let lo=.01,hi=.99;for(let i=0;i<40;i++){const m=(lo+hi)/2;if(bo7(m)<sp)lo=m;else hi=m;}return (lo+hi)/2;}
function playSeries(mine,theirs,round,rng){ const sp=seriesProb(mine,theirs,round), gp=gameProb(sp.p); const games=[]; let w=0,l=0;
  while(w<4&&l<4){ const win=rng()<gp; const m=Math.round((win?1:-1)*(3+rng()*12)); games.push({win,margin:m}); if(win)w++; else l++; }

  return {win:w===4,w,l,games,sp:sp.p,gp,net:sp.net}; }
/* ===== THE SEASON =====
   Your five plays 82 games: each night a real team-season five from the field, home and away
   alternating, every game a fresh draw from the calibrated engine. The record is the score. */
/* Out of position costs something. Real starting fives play their natural spots; a built five that
   moves a man to his second or third position gives up 0.5 / 1.0 of net for him. */
/* A man can play anywhere; the further from his natural spot, the more it costs:
   one slot over −0.5, two −1.0, three −1.5, four (a point guard at centre) −2.0 of net. */
const OOP=[0,.5,1.0,1.5,2.0];
const slotDist=(p,sl)=>Math.abs(SLOTS.indexOf(sl)-SLOTS.indexOf(p.eligible[0]));
const slotPen=(p,sl)=>OOP[slotDist(p,sl)];
function oopPenalty(five){ return SLOTS.reduce((a,sl,i)=>{const p=five[i]; if(!p) return a; return a+slotPen(p,sl);},0); }
function fiveNet(five){ return E.rate(five).net-oopPenalty(five); }
/* Game-level model, fitted to the 892 real regular-season records (not the playoff-series curve, which
   compresses the scale): p(win) = σ(0.135·Δnet + 0.42·home). Real 73-9 Warriors → 67 expected. */
const GAME_K=0.135, GAME_H=0.42;
function gameP(mine,theirs,home){ return 1/(1+Math.exp(-(GAME_K*(fiveNet(mine)-E.rate(theirs).net)+GAME_H*(home||0)))); }
function gameWin(mine,theirs,home,rng){ return rng()<gameP(mine,theirs,home); }
function playSeason(mine,seed){ const rng=mulberry32(seed>>>0); const games=[]; let w=0,l=0,hw=0,hl=0;
  for(let g=0;g<82;g++){ const x=FIELD[Math.floor(rng()*FIELD.length)]; const home=g%2===0?1:-1; const win=gameWin(mine,x.five,home,rng);
    games.push({opp:x.id,home:home>0,win}); if(win){w++; if(home>0)hw++;} else {l++; if(home>0)hl++;} }
  const r=E.rate(mine); const pen=oopPenalty(mine); const ew=expectedWins(mine);
  return {seed,w,l,hw,hl,games,net:r.net-pen,ortg:r.ortg,drtg:r.drtg,pen,ew}; }
/* where the losses came from: opponent traits that beat you, counted in games */
function seasonLessons(mine,sn){ const my=k=>mean(mine.map(p=>adv(p,k)));
  const oppTrait=(g,f)=>f(FIELD_BY_ID[g.opp].five);
  const losses=sn.games.filter(g=>!g.win), wins=sn.games.filter(g=>g.win);
  const shooters=g=>oppTrait(g,f=>mean(f.map(p=>adv(p,'threePAr')))>=.34), stoppers=g=>oppTrait(g,f=>mean(f.map(E.playerDef))>=.5), stars=g=>oppTrait(g,f=>f.some(p=>adv(p,'usg')>=.30));
  const out=[];
  const usgSum=mine.reduce((a,p)=>a+adv(p,'usg'),0)*100, def=mean(mine.map(E.playerDef)), t3=my('threePAr'), ts=my('ts');
  if(t3<.30){ const n=losses.filter(shooters).length; if(n) out.push({n:-n,k:`Shooting · 3PAr ${fmt(t3,2).replace(/^0/,'')}`,t:`${n} loss${n===1?'':'es'} to teams that live at the three-point line. Your five takes ${Math.round(t3*100)}% of its shots from deep; the league median is .34.`,sheet:'threePAr'}); }
  if(usgSum>108){ const n=losses.filter(stars).length; if(n) out.push({n:-n,k:`USG% sum ${Math.round(usgSum)}`,t:`${n} loss${n===1?'':'es'} to teams with an alpha of their own. Your five wants ${Math.round(usgSum)}% of the ball; past 100 somebody stands in the corner.`,sheet:'usg'}); }
  if(ts<.55){ const n=losses.filter(stoppers).length; if(n) out.push({n:-n,k:`Efficiency · TS% ${Math.round(ts*100)}`,t:`${n} loss${n===1?'':'es'} to top defences. At ${Math.round(ts*100)}% true shooting the offence has no margin when the shots get harder.`,sheet:'ts'}); }
  if(def<0){ const n=losses.filter(g=>oppTrait(g,f=>mean(f.map(p=>adv(p,'ts')))>=.56)).length; if(n) out.push({n:-n,k:`Defence · ${fmt(def,2)}`,t:`${n} loss${n===1?'':'es'} to efficient offences. Your five defends below the league median; nobody on it changes shots.`,sheet:'def'}); }
  if(def>=.6){ const n=wins.filter(stars).length; if(n) out.push({n:n,k:`Defence · ${fmt(def,2)}`,t:`${n} win${n===1?'':'s'} against teams with an alpha — your defence took him out of his night.`,sheet:'def'}); }
  if(ts>=.58){ const n=wins.filter(stoppers).length; if(n) out.push({n:n,k:`Efficiency · TS% ${Math.round(ts*100)}`,t:`${n} win${n===1?'':'s'} over top defences. Efficient scorers still score when the shots get harder.`,sheet:'ts'}); }
  if(!out.length) out.push({n:0,k:'Even',t:'No single trait decided the season. The record is the talent.',sheet:''});
  return out.sort((a,b)=>Math.abs(b.n)-Math.abs(a.n)).slice(0,3); }
/* the best five those packs allowed: one man per pack, five slots, under the cap.
   Greedy by engine net, then single-swap hill-climb until nothing improves. */
function bestFromPacks(packs){ if(!packs||packs.length<5) return null;
  const legal=f=>f.reduce((a,p)=>a+price(p),0)<=CAP;
  const arrange=f=>f.length<5?f:bestLineup(f).map(id=>E.P[id]);
  const cands=packs.map(pk=>pk.players.filter(p=>p.capPct!=null));
  let five=[]; for(const c of cands){ let best=null,bv=-1e9; for(const p of c){ const f=five.concat([p]); if(!legal(f)) continue; const g=f.slice(); while(g.length<5) g.push(g[g.length-1]); const v=E.rate(g).net; if(v>bv){bv=v;best=p;} } if(best) five.push(best); }
  if(five.length<5) return null;
  let cur=five, cv=fiveNet(arrange(cur)), improved=true, guard=0;
  while(improved&&guard++<30){ improved=false; for(let i=0;i<5;i++) for(const p of cands[i]){ if(p.id===cur[i].id) continue; const f=cur.slice(); f[i]=p; if(!legal(f)) continue; const v=fiveNet(arrange(f)); if(v>cv+1e-6){ cur=f; cv=v; improved=true; } } }
  return {five:arrange(cur),net:cv}; }
/* expected wins for a five against the field (200-team sample, home/away split) */
function expectedWins(five){ let e=0; for(let i=0;i<300;i++){ const x=FIELD[(i*4463)%FIELD.length]; e+=gameP(five,x.five,i%2?1:-1); } return Math.round(82*e/300); }
/* OVR · OFF · DEF for one man — his own contribution to the engine's offence line (no usage tax, since a
   single man cannot exceed 100) and his defence score, each as a league percentile; OVR is their sum. */
const zW=(p,k,v)=>{const m=B.weights.SM[p.season+':'+k]; return m?(E.trust?E.trust(p):1)*(v-m[0])/m[1]:0;};
function manOff(p){ const c=B.weights.off.coef; const st=k=>p100(p,k); let x=0;
  x+=c[0]*zW(p,'pts',st('pts'))+c[1]*zW(p,'ast',st('ast'))+c[2]*zW(p,'fg3m',st('fg3m'))+c[3]*zW(p,'tov',st('tov'))+c[4]*zW(p,'fta',st('fta'))+c[5]*zW(p,'fga',st('fga'));
  x+=(c[6]*zW(p,'ts',adv(p,'ts'))+c[7]*zW(p,'threePAr',adv(p,'threePAr'))+c[8]*zW(p,'rebPct',adv(p,'rebPct')))/5; x+=c[9]*(adv(p,'usg')*100-20); return x; }
const MANQ=(()=>{ const pool=B.players.filter(p=>p.min>=15); const o=pool.map(manOff), pd=pool.map(E.playerDef), d=pd.map(v=>v*B.weights.def.coef/5), n=o.map((v,i)=>v-d[i]); const srt=a=>a.slice().sort((x,y)=>x-y); return {o:srt(o),d:srt(pd),n:srt(n)}; })();
function ovr(p){ const q=(arr,v)=>{let lo=0,hi=arr.length; while(lo<hi){const m=(lo+hi)>>1; if(arr[m]<v) lo=m+1; else hi=m;} return Math.max(1,Math.round(99*lo/arr.length));}; const o=manOff(p), pd=E.playerDef(p), d=pd*B.weights.def.coef/5; return {ovr:q(MANQ.n,o-d),off:q(MANQ.o,o),def:q(MANQ.d,pd)}; }
/* the all-time ladder: real regular-season records in the field, and where this record sits */
const LADDER=B.teams.map(t=>({id:t.id,team:t.team,season:t.season,w:t.record.w,l:t.record.l,gp:t.record.w+t.record.l})).filter(t=>t.gp>=80).sort((a,b)=>b.w-a.w||a.l-b.l);
function ladderRank(w){ return LADDER.filter(t=>t.w>w).length+1; }
function startSeason(seed){ if(!S.team) return; S.season=playSeason(myFive(),seed==null?(Math.random()*2**32)>>>0:seed); S.seasons.unshift({date:dayKey(),team:S.team.slice(),w:S.season.w,l:S.season.l,net:S.season.net,cost:myFive().reduce((a,p)=>a+price(p),0)});
  if(S.season.w>S.bestW||!S.bestTeam){ S.bestW=S.season.w; S.bestL=S.season.l; S.bestTeam=S.team.slice(); S.bestNet=S.season.net; }
  S.tab='season'; S.view=null; save(); render(); }

/* ---------- persistent state ---------- */
const STORE='beatball.v3';
const S={tab:'build',view:null,team:null,packs:null,picks:[],slots:{},draftIdx:0,draftDaily:false,season:null,seasons:[],bestW:0,bestL:0,bestTeam:null,bestNet:null,run:null,rings:0,best:0,runs:0,played:{},lastRun:null,sheet:null,vs:null,swaps:null};
function save(){ try{ localStorage.setItem(STORE,JSON.stringify({seasons:S.seasons.slice(0,60),bestW:S.bestW,bestL:S.bestL,bestTeam:S.bestTeam,bestNet:S.bestNet,dailyPlayed:S.dailyPlayed})); }catch(e){} }
function load(){ try{ const j=JSON.parse(localStorage.getItem(STORE)||'null'); if(j){ delete j.team; Object.assign(S,j); } }catch(e){} S.seasons=S.seasons||[]; }
const myFive=()=>S.team?S.team.map(id=>E.P[id]).filter(Boolean):null;

/* ---------- stat vocabulary: official definitions, shown on tap ---------- */
const STAT_INFO={
  usg:{n:'USG%',t:'Usage rate',d:'Share of team possessions a player ends with a shot, free throws or a turnover while he is on the floor.',w:'Five men add up to 100%. Past that, somebody gives up shots — the engine takes it from the ball-handlers.',f:'(FGA + 0.44·FTA + TOV) ÷ team possessions on floor',k:'usg',x:100},
  ts:{n:'TS%',t:'True shooting',d:'Scoring efficiency counting twos, threes and free throws in one number.',w:'The single best efficiency stat. 60% is elite, 50% is a problem.',f:'PTS ÷ (2 × (FGA + 0.44·FTA))',k:'ts',x:100},
  efg:{n:'eFG%',t:'Effective field goal %',d:'Field-goal % with threes counted as 1.5 makes.',w:'Rewards shooters honestly; a 40% three-point shooter is a 60% eFG shooter.',f:'(FGM + 0.5·3PM) ÷ FGA',k:'efg',x:100},
  threePAr:{n:'3PAr',t:'Three-point attempt rate',d:'Share of field-goal attempts taken from three.',w:'Spacing. A five that does not shoot lets the other rim protector stay home.',f:'3PA ÷ FGA',k:'threePAr',x:100},
  astPct:{n:'AST%',t:'Assist rate',d:'Share of teammates\' made baskets a player assisted while on the floor.',w:'Who starts the offence. Creators carry the usage tax when the ball is scarce.',f:'AST ÷ (teammate FGM on floor)',k:'astPct',x:100},
  rebPct:{n:'REB%',t:'Rebound rate',d:'Share of available rebounds a player grabbed while on the floor.',w:'Possessions. In the data a five\'s REB% edge is worth about a point of net rating.',f:'REB ÷ (team + opponent REB on floor)',k:'rebPct',x:100},
  tovPct:{n:'TOV%',t:'Turnover rate',d:'Turnovers per 100 plays a player ends.',w:'The stat the old engine underweighted most: turnovers cost more than raw scoring buys.',f:'TOV ÷ (FGA + 0.44·FTA + TOV) × 100',k:'tovPct',x:1},
  ortg:{n:'ORtg',t:'Offensive rating (on-court)',d:'Points the team scored per 100 possessions while he was on the floor.',w:'A team stat worn by the player — it includes his teammates.',f:'team PTS ÷ possessions × 100, on-court',k:'ortg',x:1},
  drtg:{n:'DRtg',t:'Defensive rating (on-court)',d:'Points the team allowed per 100 possessions while he was on the floor. Lower is better.',w:'There is no official individual-defence stat. 60% of a card\'s DEF is this number — his team\'s defence with him on the floor.',f:'opponent PTS ÷ possessions × 100, on-court',k:'drtg',x:1,low:true},
  netrtg:{n:'NetRtg',t:'Net rating (on-court)',d:'ORtg minus DRtg while he was on the floor.',w:'The number the whole game runs on: a series is decided by the two fives\' predicted net ratings.',f:'ORtg − DRtg',k:'netrtg',x:1},
  pie:{n:'PIE',t:'Player impact estimate',d:'nba.com\'s one-number summary: a player\'s share of all the good things in the games he played.',w:'A decent all-in-one — but it is not in the engine, because it double-counts the box score.',f:'(player good stuff) ÷ (game good stuff)',k:'pie',x:100},
  def:{n:'DEF',t:'Beatball defence (on-court)',d:'60% on-court DRtg against that season\'s league, 40% box defence (STL, BLK, REB%, height). In standard deviations.',w:'The honest version: individual defence cannot be separated from the team in any official stat, so this one says so.',f:'0.6·z(league DRtg − on-court DRtg) + 0.4·z(box)',k:null},
};
/* percentile tables: shipped with the bundle (computed on the full pool) when present, else built here */
const Qtab=B.meta.q||null;
const qPct=(arr,v)=>{ if(!arr) return null; let lo=0,hi=arr.length; while(lo<hi){const m=(lo+hi)>>1; if(arr[m]<v) lo=m+1; else hi=m;} return lo/arr.length; };
const DIST=(()=>{ if(Qtab) return Qtab.all; const pool=B.players.filter(p=>p.min>=15); const out={}; for(const k of ADV){ out[k]=pool.map(p=>adv(p,k)).sort((a,b)=>a-b); } for(const k of ['fg3m','stl','blk','pts','ast','reb','tov']){ out['p100:'+k]=pool.map(p=>p100(p,k)).sort((a,b)=>a-b); } out.def=pool.map(p=>E.playerDef(p)).sort((a,b)=>a-b); return out;})();
const POS_DIST=(()=>{ if(Qtab) return Object.fromEntries(SLOTS.map(sl=>[sl,Qtab[sl]])); const pool=B.players.filter(p=>p.min>=15); const out={}; for(const sl of SLOTS){ const ps=pool.filter(p=>p.eligible[0]===sl); const d={}; for(const k of ADV) d[k]=ps.map(p=>adv(p,k)).sort((a,b)=>a-b); for(const k of ['fg3m','stl','blk']) d['p100:'+k]=ps.map(p=>p100(p,k)).sort((a,b)=>a-b); d.def=ps.map(E.playerDef).sort((a,b)=>a-b); out[sl]=d; } return out;})();
const posPctile=(sl,k,v)=>qPct(POS_DIST[sl]&&POS_DIST[sl][k],v);
const POS_AVG=(()=>{ if(B.meta.posAvg) return B.meta.posAvg; const pool=B.players.filter(p=>p.min>=15); const out={}; for(const sl of SLOTS){ const ps=pool.filter(p=>p.eligible[0]===sl); const m={}; for(const k of ADV) m[k]=mean(ps.map(p=>adv(p,k))); for(const k of ['fg3m','stl','blk']) m['p100:'+k]=mean(ps.map(p=>p100(p,k))); m.def=mean(ps.map(E.playerDef)); out[sl]=m; } return out;})();
const pctile=(k,v)=>qPct(DIST[k],v);

/* ---------- role tag + the three stats a card shows ---------- */
/* Roles — the six kinds of man a five is built from, judged by what he does with the ball.
   Bigs: playmaking → stretch → inside. Guards & wings: main handler → scorer → 3&D. ROTATION for the rest. */
const isBigP=p=>p.eligible[0]==='C'||p.eligible[0]==='PF';
const isBigRole=p=>p.eligible[0]==='C'||(p.eligible[0]==='PF'&&(adv(p,'rebPct')>=.13||((p.ht||0)>=82&&adv(p,'astPct')<.20)));   // Dirk is a big, Durant at PF is a wing   // LeBron-at-PF is a wing, Draymond is a big
function tagOf(p){ const u=adv(p,'usg')*100, t3=adv(p,'threePAr'), a=adv(p,'astPct')*100;
  if(isBigRole(p)){ if(a>=20) return ['PLAYMAKING BIG','pm']; if(t3>=.18) return ['STRETCH BIG','st']; return ['INSIDE BIG','in']; }
  if(a>=30) return ['MAIN HANDLER','mh'];
  if(t3>=.40&&a<15&&u<28) return ['3&D','td'];
  if(u>=24) return ['SCORER','sc'];
  if(t3>=.30) return ['3&D','td'];
  return ['ROTATION','ro']; }
const ROLE_LONG={mh:'On-ball hub — starts and creates the offence',sc:'The scoring option, on or off the ball',in:'Paint scoring, boards, rim protection',st:'Paint presence plus threes',pm:'Inside plus a passing hub',td:'Off-ball shooting and defence, low usage',ro:'Fills minutes without carrying usage'};
function cardStats(p){ const pos=p.eligible[0];
  if(pos==='PG') return [['USG%',pct(adv(p,'usg')),'usg'],['AST%',pct(adv(p,'astPct')),'astPct'],['TOV%',fmt(adv(p,'tovPct'),1),'tovPct']];
  if(pos==='C'||pos==='PF') return [['REB%',pct(adv(p,'rebPct')),'rebPct'],['BLK/100',fmt(p100(p,'blk')),null],['DEF',fmt(E.playerDef(p),2),'def']];
  return [['3PAr',fmt(adv(p,'threePAr'),2),'threePAr'],['eFG%',pct(adv(p,'efg')),'efg'],['DEF',fmt(E.playerDef(p),2),'def']]; }
const line=p=>`${fmt(pg(p,'pts'))} / ${fmt(pg(p,'reb'))} / ${fmt(pg(p,'ast'))}`;

/* ---------- the player card: the unit of the game. Rows summarise it; the pack shows it. ---------- */
/* one line, always: size and tracking by length so the longest surname in the league still fits 136px */
const nameStyle=ln=>'font-size:20px;letter-spacing:-.015em;white-space:nowrap';   // one size for everyone; a long name fades out at the edge instead of shrinking
function cardHTML(p,opts={}){ const [tw,tc]=tagOf(p); const tier=tierOf(p), L=TIER_LOOK[tier]; const first=p.name.split(' ').slice(0,-1).join(' '), ln=last(p);
  const club=colorsOf(p); const c1=club.body;
  /* laid-back: the club colour at half strength, desaturated toward the page, never the pure hue */
  const bg=`linear-gradient(165deg,color-mix(in srgb,${c1} 52%,#111317) 0%,color-mix(in srgb,${c1} 34%,#0E1013) 55%,color-mix(in srgb,${c1} 20%,#0E1013) 100%)`; const acc=club.frame;
  return `<div class="kc narrow ${opts.cls||''}" style="--bgc:${bg}" ${opts.attr||''}>
    <div class="khead"><span class="kprice ${opts.over?'over':''}">${p.capPct!=null?(price(p)>CAP?`<small>OVER THE CAP</small>`:`$${price(p)}<small>M</small>`):'<small>NO SALARY</small>'}</span><button class="kdots" data-kinfo="${p.id}" aria-label="profile">···</button></div>
    <div class="kbody"><div class="kfirst">${first}</div><div class="kname" style="${nameStyle(ln)}">${ln}</div>
      <div class="ktag"><span>${tw}</span></div><div class="kmeta3">${p.jersey?`#${p.jersey} · `:''}${p.eligible.join(' · ')}</div>
      <div class="kstats">${(()=>{const o=ovr(p); return `<div class="kbig"><div><b>${o.off}</b><span>OFF</span></div><div><b>${o.def}</b><span>DEF</span></div><div><b>${Math.round(adv(p,'usg')*100)}</b><span>USG</span></div></div>`;})()}
      <div class="ksml"><div><b>${fmt(pg(p,'pts'))}</b><span>PTS</span></div><div><b>${fmt(pg(p,'reb'))}</b><span>REB</span></div><div><b>${fmt(pg(p,'ast'))}</b><span>AST</span></div><div><b>${fmt(adv(p,'threePAr'),2).replace(/^0/,'')}</b><span>3PAr</span></div></div></div></div>
    ${opts.signed?`<div class="ksigned you">✓ ${ln.toUpperCase()} · YOUR ${opts.signed}</div>`:''}</div>`; }
/* ---------- team-level official stats for the eight cells ---------- */
function teamCells(ps){ const r=E.rate(ps); const L=ps[0].season; 
  return [['ORTG',fmt(r.ortg+110,0),'ortg',r.ortg>=2?'g':r.ortg<=-2?'r':''],['DRTG',fmt(110+r.drtg,0),'drtg',r.drtg<=-2?'g':r.drtg>=2?'r':''],['NET',(r.net>=0?'+':'')+fmt(r.net,1),'netrtg',r.net>=5?'g':r.net<0?'r':''],
    ['USG% SUM',fmt(ps.reduce((a,p)=>a+adv(p,'usg'),0)*100,0),'usg',ps.reduce((a,p)=>a+adv(p,'usg'),0)>1.05?'r':''],['3PAr',fmt(mean(ps.map(p=>adv(p,'threePAr'))),2),'threePAr',''],['TS%',pct(mean(ps.map(p=>adv(p,'ts')))),'ts',''],
    ['REB%',pct(ps.reduce((a,p)=>a+adv(p,'rebPct'),0)),'rebPct',''],['DEF',fmt(mean(ps.map(E.playerDef)),2),'def',mean(ps.map(E.playerDef))>=.8?'g':mean(ps.map(E.playerDef))<0?'r':'']]; }

/* ---------- arrangement: a five is a set; slots are for reading ---------- */
function arrange(ps){ const best={score:-1,order:null}; const perm=(rest,cur)=>{ if(!rest.length){ const sc=cur.reduce((a,p,i)=>a+(p.eligible[0]===SLOTS[i]?2:p.eligible.includes(SLOTS[i])?1:0),0); if(sc>best.score){best.score=sc;best.order=cur.slice();} return; } for(let i=0;i<rest.length;i++) perm(rest.slice(0,i).concat(rest.slice(i+1)),cur.concat([rest[i]])); }; perm(ps,[]); return best.order; }
function feasible(ps){ // can these players fill distinct slots?
  const perm=(rest,used)=>{ if(!rest.length) return true; const p=rest[0]; return p.eligible.some(sl=>!used.has(sl)&&perm(rest.slice(1),new Set([...used,sl])))||(rest.length+used.size<=5&&SLOTS.some(sl=>!used.has(sl)&&perm(rest.slice(1),new Set([...used,sl])))); }; return perm(ps,new Set()); }

/* ---------- packs & draft ---------- */
function makePacks(rng){ const teams=shuffle(PACK_TEAMS,rng).slice(0,5); return teams.map(t=>({team:t,players:t.players.map(id=>E.P[id]).filter(p=>p&&p.capPct!=null).sort((a,b)=>price(b)-price(a))})); }
function startDraft(daily){ S.run=null; S.swaps=null; const rng=daily?mulberry32(daySeed(dayKey()+':packs')):mulberry32((Math.random()*2**32)>>>0); S.packs=makePacks(rng); S.picks=[]; S.slots={}; S.draftIdx=0; S.draftDaily=daily; S.rerolls=2; S.view='draft'; S.wheelRng=rng; spinWheel(); }
const packStuck=()=>{const pk=S.packs[S.draftIdx]; return pk&&!pk.players.some(p=>{const to=slotFor(p); return to&&canPick(p,to);});};
function reroll(){ if(S.rerolls<=0&&!packStuck()) return; if(packStuck()&&S.rerolls<=0){ /* free spin: a dead pack can never end a draft */ } const rng=S.wheelRng||Math.random; const used=new Set(S.packs.map(p=>p.team.id)); const t=shuffle(PACK_TEAMS.filter(t=>!used.has(t.id)),rng)[0]; S.packs[S.draftIdx]={team:t,players:t.players.map(id=>E.P[id]).filter(p=>p&&p.capPct!=null).sort((a,b)=>price(b)-price(a))}; if(S.rerolls>0) S.rerolls--; spinWheel(); }
/* the roulette: a wheel of clubs slows and stops on this pack's team. Free packs: Lock stops it wherever it is
   and that club becomes the pack. Today's packs: the club is fixed for everyone, the wheel is the reveal. */
function spinWheel(){ const pk=S.packs[S.draftIdx]; if(!pk) return; const rng=S.wheelRng||Math.random;
  const others=shuffle(PACK_TEAMS.filter(t=>t.id!==pk.team.id),rng).slice(0,9); const teams=shuffle(others.concat([pk.team]),rng);
  S.wheel={teams,idx:Math.floor(rng()*teams.length),target:teams.indexOf(pk.team),spinning:true,locked:false,t0:null}; S.pack=null; render();
  if(typeof requestAnimationFrame!=='function'){ S.wheel.spinning=false; S.wheel.idx=S.wheel.target; landWheel(); return; }
  let last=performance.now(), acc=0, start=last; const total=2400;
  const step=now=>{ const W=S.wheel; if(!W||!W.spinning) return; const t=Math.min(1,(now-start)/total); const interval=45+t*t*t*420; acc+=now-last; last=now;
    if(acc>=interval){ acc=0; W.idx=(W.idx+1)%W.teams.length; renderWheel(); }
    if(t<1) requestAnimationFrame(step); else { if(!S.draftDaily) W.target=W.idx; while(W.idx!==W.target){ W.idx=(W.idx+1)%W.teams.length; } W.spinning=false; landWheel(); } };
  requestAnimationFrame(step); }
function lockWheel(){ const W=S.wheel; if(!W||!W.spinning) return; W.spinning=false; if(!S.draftDaily){ W.target=W.idx; } else W.idx=W.target; landWheel(); }
function landWheel(){ const W=S.wheel; const team=W.teams[W.idx]; if(!S.draftDaily&&team.id!==S.packs[S.draftIdx].team.id){ S.packs[S.draftIdx]={team,players:team.players.map(id=>E.P[id]).filter(p=>p&&p.capPct!=null).sort((a,b)=>price(b)-price(a))}; }
  S.pack={faceup:true}; render(); }
function renderWheel(){ const el=$('wheelrows'); if(el){ el.innerHTML=wheelRows(); } }
function wheelRows(){ const W=S.wheel; const n=W.teams.length; return [-2,-1,0,1,2].map(d=>{const t=W.teams[(W.idx+d+n*2)%n]; return `<div class="wrow ${d===0?'hit':''}" style="--tc1:${t.c1};--tc2:${t.c2==='#000000'?'#8A9099':t.c2}"><span class="dot"></span><span class="wyr">${t.season}</span><b>${t.team}</b><em>${t.record.w}–${t.record.l}</em></div>`;}).join(''); }
const spent=()=>S.picks.reduce((a,p)=>a+price(p),0);
/* the draft board is five position columns; a pick signs a man INTO a slot, so the five is the five slots */
function slotFor(p){ if(!S.slots[p.eligible[0]]) return p.eligible[0]; return SLOTS.slice().sort((a,b)=>slotDist(p,a)-slotDist(p,b)).find(sl=>!S.slots[sl])||null; }
function canPick(p,slot){ if(S.picks.some(q=>q.id===p.id)) return false; const left=4-S.picks.length; return spent()+price(p)+left*1<=CAP; }
function pick(p,slot){ if(!canPick(p)||!S.pack) return; S.picks.push(p); S.draftIdx++;
  if(S.picks.length===5){ S.picksPacks=S.packs; S.wheel=null; S.pack=null; S.team=bestLineup(S.picks); startSeason(S.draftDaily?daySeed(dayKey()+':season'):null); return; } spinWheel(); }
/* the line-up: all 120 ways to put five men in five spots; keep the one with the highest net after position penalties */
function bestLineup(men){ let best=null; const perm=(arr,acc)=>{ if(!arr.length){ const v=fiveNet(acc); if(!best||v>best.v) best={v,five:acc.slice()}; return; } arr.forEach((p,i)=>perm(arr.filter((_,j)=>j!==i),acc.concat([p]))); }; perm(men,[]); return best.five.map(p=>p.id); }
function viewLineup(){ const five=S.lineup.map(id=>E.P[id]); const net=fiveNet(five), pen=oopPenalty(five), ew=expectedWins(five);
  return `<div class="stage"><div class="kick">Your line-up</div><div class="big" style="margin-top:6px;font-size:39px">Set the<br>positions.</div>
    <p class="sub" style="margin-top:8px">The engine placed them for the best net. Tap two men to swap them.</p>
    <div class="lineup">${SLOTS.map((sl,i)=>{const p=five[i]; const pen=slotPen(p,sl); const o=ovr(p); return `<button class="lu ${S.luSel===i?'sel':''} ${pen?'oop':''}" data-lu="${i}"><i>${sl}</i><b>${last(p)}</b><span>${tagOf(p)[0]} · natural ${p.eligible[0]}${pen?` · <u>−${fmt(pen,1)}</u>`:''}</span><em>${o.off}<small>OFF</small> ${o.def}<small>DEF</small></em></button>`;}).join('')}</div>
    <div class="cells"><div><b class="${net>0?'volt':''}">${net>=0?'+':''}${fmt(net,1)}</b><i>Net</i></div><div><b>${pen?'−'+fmt(pen,1):'0'}</b><i>Position cost</i></div><div><b>${ew}-${82-ew}</b><i>Expected</i></div><div><b>$${five.reduce((a,p)=>a+price(p),0)}M</b><i>Cost</i></div></div>
    <button class="big-cta" data-play-season>Play the season</button><button class="g2 wide" data-lu-best>Best line-up</button></div>`; }

/* ---------- the run: a playoff bracket ---------- */
function makeBracket(rng){ return TIERS.map(tier=>tier[Math.floor(rng()*tier.length)].id); }
function startRun(daily){ if(!S.team) return; const rng=daily?mulberry32(daySeed(dayKey()+':bracket')):mulberry32((Math.random()*2**32)>>>0);
  S.run={daily,bracket:makeBracket(rng),round:0,series:[],moves:2,seed:(rng()*2**32)>>>0,over:false,won:false,team:S.team.slice(),packs:S.packs,counts:!daily||S.dailyPlayed!==dayKey()}; S.runs++; if(daily) S.dailyPlayed=dayKey(); S.tab='run'; S.view=null; save(); render(); }
function playRound(){ const R=S.run; if(!R||R.over) return; const opp=FIELD_BY_ID[R.bracket[R.round]]; const rng=mulberry32(R.seed+R.round*97);
  const res=playSeries(myFive(),opp.five,R.round,rng); R.series.push({opp:opp.id,...res});
  S.played[opp.id]={win:res.win,net:res.net}; 
  if(res.win){ R.round++; if(R.round===4){ R.over=true; R.won=true; S.rings++; S.best=Math.max(S.best,16); S.trophies.unshift({date:dayKey(),team:S.team.slice(),bracket:R.bracket.slice(),daily:R.daily}); } }
  else { R.over=true; const wins=R.series.reduce((a,s)=>a+s.w,0); S.best=Math.max(S.best,wins); S.swaps=findSwaps(opp); }
  S.lastRun={won:R.won,round:R.round,wins:R.series.reduce((a,s)=>a+s.w,0),losses:R.series.reduce((a,s)=>a+s.l,0)}; save(); render(); }
function swapPlayer(outId,inP){ const R=S.run; if(!R||R.moves<=0||R.over) return; const idx=S.team.indexOf(outId); if(idx<0) return; const five=myFive(); five[idx]=inP; if(!feasible(five)) return; if(five.reduce((a,p)=>a+price(p),0)>CAP) return; S.team=arrange(five).map(p=>p.id); R.moves--; S.view=null; save(); render(); }
function findSwaps(opp){ // from your own packs, under the cap: the single swap that lifts the series most
  const mine=myFive(), packs=(S.run&&S.run.packs)||S.packs; if(!packs) return null;
  const pool=[]; packs.forEach(pk=>pk.players.forEach(p=>{ if(!mine.some(m=>m.id===p.id)) pool.push(p); }));
  const base=seriesProb(mine,opp.five,S.run.round).p; let best=null;
  for(let i=0;i<5;i++) for(const p of pool){ const f=mine.slice(); f[i]=p; if(f.reduce((a,q)=>a+price(q),0)>CAP||!feasible(f)) continue; const sp=seriesProb(f,opp.five,S.run.round).p; if(!best||sp>best.p) best={p:sp,out:mine[i],inn:p,five:f}; }
  if(!best) return null; return {base,...best,flips:best.p>=.5&&base<.5}; }

/* ---------- lesson: where the net rating came from ---------- */
/* attribution groups: the ridge features are collinear (points, attempts, usage overflow), so single
   coefficients mislead. Grouped, the numbers are honest: SCORING = volume net of the usage tax. */
const GROUPS=[['scoring','SCORING','volume, after the usage tax',[0,4,5,9],'usg'],['playmaking','PLAYMAKING','creation',[1],'astPct'],['shooting','SHOOTING','threes and spacing',[2,7],'threePAr'],
  ['efficiency','EFFICIENCY','true shooting',[6],'ts'],['turnovers','TURNOVERS','ball security',[3],'tovPct'],['glass','GLASS','rebounding',[8],'rebPct']];
function lessonRows(mine,theirs,round){ const rm=E.rate(mine), rt=E.rate(theirs); const fm=E.W.off.coef, xm=offFeatsOf(mine), xt=offFeatsOf(theirs);
  const rows=GROUPS.map(([k,n,w,idx,sheet])=>({k,n,w,sheet,pts:idx.reduce((a,i)=>a+(xm[i]-xt[i])*fm[i],0)}));
  rows.push({k:'def',n:'DEFENCE',w:'on-court',sheet:'def',pts:-(rm.drtg-rt.drtg)});
  rows.push({k:'home',n:'HOME COURT',w:'seed',sheet:'',pts:-HOME_NET[round]});
  return rows.sort((a,b)=>Math.abs(b.pts)-Math.abs(a.pts)); }
function offFeatsOf(ps){ // mirror of the engine's offence features (for attribution only)
  const W=E.W, z=(p,k,v)=>{const m=W.SM[p.season+':'+k];return (v-m[0])/m[1];}; const f=E.tax(ps), x=[];
  for(const k of ['pts','ast','fg3m','tov']) x.push(ps.reduce((a,p,i)=>a+z(p,k,p100(p,k))*f[i],0));
  for(const k of ['fta','fga']) x.push(ps.reduce((a,p)=>a+z(p,k,p100(p,k)),0));
  x.push(mean(ps.map(p=>z(p,'ts',adv(p,'ts'))))); x.push(mean(ps.map(p=>z(p,'threePAr',adv(p,'threePAr'))))); x.push(mean(ps.map(p=>z(p,'rebPct',adv(p,'rebPct'))))); x.push(ps.reduce((a,p)=>a+adv(p,'usg'),0)*100-100); return x; }

/* ============================ VIEWS ============================ */
const COURT=`<svg class="court" viewBox="0 0 390 520" preserveAspectRatio="xMidYMid slice"><g fill="none" stroke="var(--line-c)" stroke-width="2"><rect x="20" y="-40" width="350" height="600" rx="6"/><line x1="20" y1="260" x2="370" y2="260"/><circle cx="195" cy="260" r="58"/><rect x="120" y="-40" width="150" height="190"/><circle cx="195" cy="150" r="58"/><path d="M40 -40 v120 a155 155 0 0 0 310 0 v-120"/><rect x="120" y="370" width="150" height="190"/><circle cx="195" cy="370" r="58"/><path d="M40 560 v-120 a155 155 0 0 1 310 0 v120"/></g></svg>`;
const BRAND=`<div class="brand" data-home><span class="ball"></span><b>FANTASYBALL</b></div>`;
function tabs(){ return `<nav class="tabs">${[['build','Build'],['season','Season'],['you','You']].map(([k,l])=>`<span data-tab="${k}" class="${S.tab===k?'on':''}">${l}</span>`).join('')}</nav>`; }
function topBar(right){ return `<div class="top">${BRAND}<span class="streak">${right||''}</span></div>`; }
function playerRow(p,extra){ const [tw,tc]=tagOf(p); const cs=cardStats(p); const slot=p._slot||p.eligible[0]; const c=colorsOf(p);
  return `<div class="pr t-${tierOf(p)}" data-info="${p.id}"><span class="pos" style="color:${c.c2}">${slot}</span><span class="nm">${p.name}<em><span class="ptag ${tc}">${tw}</span>${p.abbr} ${short(p.season)} · ${line(p)}</em></span><span class="st">${cs.map(([n,v,k])=>`<i data-stat="${k||''}">${n} <b>${v}</b></i>`).join('')}</span>${extra||''}</div>`; }
function fiveBlock(ps,extra){ const ord=arrange(ps); return `<div class="ppl">${ord.map((p,i)=>{p._slot=SLOTS[i];return playerRow(p,extra?extra(p):'');}).join('')}</div>`; }
function cells(ps){ return `<div class="adv">${teamCells(ps).map(([n,v,k,c])=>`<div data-stat="${k}"><u>?</u><b class="${c}">${v}</b><i>${n}</i></div>`).join('')}</div>`; }

const recCls=(w,l)=>w>l?'volt':w===l?'':'mut';
function viewHome(){ const b=S.bestTeam;
  return `<div class="stage"><div class="big hero">Build<br>a five.<small>Five packs, a $100M cap. Your five plays a full 82-game season against real teams. The record is the score. The best five ever went 73-9.</small></div>
    <div class="cells"><div><b class="${b?'volt':''}">${b?`${S.bestW}-${S.bestL}`:'—'}</b><i>Your best</i></div><div><b>${S.seasons.length}</b><i>Seasons</i></div><div><b>73-9</b><i>The record</i></div><div><b>82-0</b><i>The dream</i></div></div>
    <button class="big-cta" data-draft="free">Build a five</button>
    <p class="sub dim">Engine v2 · fitted to 450 real playoff series · 76% correct · every game a fresh draw from the calibrated probability</p></div>`; }
function viewChooser(){ return `<div class="stage"><div class="big">How do you<br>want to build?</div>
    <button class="choice" data-draft="free"><b>Spin the wheel</b><span>Five clubs land on the wheel, one man from each. Luck picks the clubs, you pick the men.</span></button>
    <button class="choice soon"><b>Build my own</b><span>Search anyone, any season, under today's rules. Coming next.</span></button></div>`; }
function viewSeason(){ const sn=S.season, ps=myFive(); if(!sn||!ps) return `<div class="stage"><div class="big">No season yet.<small>Build a five and it plays 82 games.</small></div><button class="big-cta" data-draft="free">Build a five</button></div>`;
  const rank=ladderRank(sn.w); const above=LADDER[rank-2], below=LADDER[rank-1];
  const row=(t,k)=>`<div class="r dim"><span class="k">${k}</span><span>${t.team.split(' ').slice(-1)[0]} ${short2(t.season)}</span><b>${t.w}-${t.l}</b></div>`;
  const les=seasonLessons(ps,sn);
  return `<div class="stage">
    <div class="rec2"><div class="num ${recCls(sn.w,sn.l)}">${sn.w}-${sn.l}</div><div class="lab">Full season · 82 games · real opponents${sn.w===S.bestW&&S.bestTeam&&S.bestTeam.join()===S.team.join()?' · your best':''}</div>
      ${sn.ew!=null?`<div class="luck">Expected <b>${sn.ew}-${82-sn.ew}</b> · luck <b class="${sn.w-sn.ew>0?'volt':sn.w-sn.ew<0?'mut':''}">${sn.w-sn.ew>=0?'+':''}${sn.w-sn.ew}</b> <span>a season swings about ±4 on the same five</span></div>`:''}</div>
    <div class="five5">${SLOTS.map((sl,i)=>{const q=ps[i]; const k=q.eligible.indexOf(sl); return `<div class="f5 on ${k>0?'oop':''}" data-kinfo="${q.id}"><i>${sl}${k>0?` <u>${q.eligible[0]}</u>`:''}</i><b>${last(q)}</b><em>$${price(q)}M</em></div>`;}).join('')}</div>
    ${sn.pen?`<p class="oopnote">${SLOTS.filter((sl,i)=>ps[i].eligible.indexOf(sl)>0).length} out of position · −${fmt(sn.pen,1)} net. A man at his second spot gives up 0.5, at his third 1.0.</p>`:''}
    <div class="ladder">${LADDER.slice(0,3).map((t,i)=>row(t,i+1)).join('')}${rank>5?`<div class="r dim"><span class="k">·</span><span>${rank-5} more real seasons</span><b></b></div>`:''}${rank>4&&above?row(above,rank-1):''}
      <div class="r you"><span class="k">${rank}</span><span>Your five · season ${S.seasons.length}</span><b>${sn.w}-${sn.l}</b></div>${below?row(below,rank+1):''}<div class="r dim"><span class="k"></span><span>of ${LADDER.length} real seasons since 1996</span><b></b></div></div>
    <div class="cells"><div><b>${Math.round(110+sn.ortg)}</b><i>ORtg</i></div><div><b>${Math.round(110+sn.drtg)}</b><i>DRtg</i></div><div><b class="${sn.net>0?'volt':''}">${sn.net>=0?'+':''}${fmt(sn.net,1)}</b><i>Net</i></div><div><b>${sn.hw}-${sn.hl}</b><i>Home</i></div></div>
    <div class="les"><h2>Where the ${sn.l} losses came from</h2>${les.map(x=>`<div class="l" ${x.sheet?`data-stat="${x.sheet}"`:''}><b class="${x.n<0?'r':x.n>0?'h':''}">${x.n>0?'+':''}${x.n||'—'}</b><div><div class="k">${x.k}</div><div class="t">${x.t}</div></div></div>`).join('')}</div>
    ${bestBlock(ps)}
    <button class="big-cta" data-draft="free">Build again</button><button class="g2 wide" data-share>${S.shared?'Copied':'Share'}</button></div>`; }
function teamLine(f){ const r=E.rate(f); const usg=f.reduce((a,p)=>a+adv(p,'usg'),0)*100, t3=mean(f.map(p=>adv(p,'threePAr'))), def=mean(f.map(E.playerDef)), ts=mean(f.map(p=>adv(p,'ts'))), ast=mean(f.map(p=>adv(p,'astPct')))*100; return {net:r.net-oopPenalty(f),ortg:r.ortg,drtg:r.drtg,usg,t3,def,ts,ast,pen:oopPenalty(f),cost:f.reduce((a,p)=>a+price(p),0)}; }
function whyBetter(mine,best){ const a=teamLine(mine), b=teamLine(best); const out=[]; const d=(x,y)=>y-x;
  if(d(a.ortg,b.ortg)>1) out.push(`Offence +${fmt(d(a.ortg,b.ortg),1)}: ${b.ts-a.ts>=.015?`better shooting (TS ${Math.round(a.ts*100)} → ${Math.round(b.ts*100)})`:b.ast-a.ast>=3?`more creation (AST% ${Math.round(a.ast)} → ${Math.round(b.ast)})`:b.t3-a.t3>=.04?`more spacing (3PAr .${Math.round(a.t3*100)} → .${Math.round(b.t3*100)})`:'the ball gets shared better'}.`);
  if(d(a.drtg,b.drtg)<-1) out.push(`Defence ${fmt(-d(a.drtg,b.drtg),1)} better: team defence ${fmt(a.def,2)} → ${fmt(b.def,2)}.`);
  if(a.usg>108&&b.usg<a.usg-4) out.push(`Less overlap: usage ${Math.round(a.usg)} → ${Math.round(b.usg)}. Past 100, somebody stands in the corner.`);
  if(a.pen>b.pen+.4) out.push(`Fewer men out of position: −${fmt(a.pen,1)} → −${fmt(b.pen,1)}.`);
  if(b.cost<a.cost-8) out.push(`Cheaper too: $${a.cost}M → $${b.cost}M, and the savings bought a better man.`);
  if(!out.length) out.push('Small edges everywhere rather than one big one.');
  return out; }
function bestBlock(ps){ const bb=bestFromPacks(S.picksPacks); if(!bb) return '';
  const mine=SLOTS.map((sl,i)=>ps[i]); const same=bb.five.every((p,i)=>p.id===mine[i].id); const myNet=fiveNet(mine);
  if(same) return `<div class="les"><h2>The best five those packs allowed</h2><p class="bbnote">You built it. Nothing in those five packs beats this five under the cap.</p></div>`;
  const ew=expectedWins(bb.five), myEw=expectedWins(mine);
  const cell=(p,cls)=>{const o=ovr(p); return `<div class="cmpman ${cls}" data-kinfo="${p.id}"><b class="nm">${last(p)}</b><span class="rp">${tagOf(p)[0]} · $${price(p)}M</span></div><div class="cmpn ${cls}">${o.ovr}</div><div class="cmpn ${cls}">${o.off}</div><div class="cmpn ${cls}">${o.def}</div>`;};
  const rows=SLOTS.map((sl,i)=>{ const a=mine[i], b=bb.five[i]; const same=a.id===b.id; const f=mine.slice(); f[i]=b; const d=same?0:fiveNet(f)-myNet;
    return `<div class="cmprow ${same?'same':''}"><div class="cmpsl"><i>${sl}</i>${same?'<em>kept</em>':`<em class="${d>0?'up':'dn'}">${d>=0?'+':''}${fmt(d,1)}</em>`}</div>${cell(a,'a')}${cell(b,'b')}</div>`; }).join('');
  const T=teamLine(mine), U=teamLine(bb.five);
  return `<div class="les"><h2>The best five those packs allowed</h2><div class="bbtop"><b>${ew}-${82-ew}</b><span>expected · yours ${myEw}-${82-myEw}<br>net ${U.net>=0?'+':''}${fmt(U.net,1)} · yours ${T.net>=0?'+':''}${fmt(T.net,1)}</span></div>
    <div class="cmphead"><span></span><span class="ya">Yours</span><span>OVR</span><span>OFF</span><span>DEF</span><span class="yb">Best</span><span>OVR</span><span>OFF</span><span>DEF</span></div>${rows}
    <div class="why"><b>Why it wins</b>${whyBetter(mine,bb.five).map(t=>`<span>${t}</span>`).join('')}</div>
    <p class="bbnote">One man per pack, same cap. The number under each slot is the net change from that one swap alone. Tap a name for his profile.</p></div>`; }
function viewYou(){ const b=S.bestTeam; const above=S.seasons.filter(x=>x.w>41).length, s60=S.seasons.filter(x=>x.w>=60).length, s70=S.seasons.filter(x=>x.w>=70).length;
  return `<div class="stage">
    <div class="rec2"><div class="num ${b?'volt':'mut'}">${b?`${S.bestW}-${S.bestL}`:'—'}</div><div class="lab">Best season · ${S.seasons.length} played</div></div>
    <div class="cells"><div><b>${above}</b><i>Above .500</i></div><div><b>${s60}</b><i>60-win</i></div><div><b>${s70}</b><i>70-win</i></div><div><b class="${S.bestNet>0?'volt':''}">${S.bestNet!=null?(S.bestNet>=0?'+':'')+fmt(S.bestNet,1):'—'}</b><i>Best net</i></div></div>
    <div class="hist">${S.seasons.slice(0,30).map((x,i)=>`<div class="h ${x.w===S.bestW&&x.team.join()===(S.bestTeam||[]).join()?'best':''}"><div><b>${x.w}-${x.l}</b><br><span>${x.team.map(id=>E.P[id]?last(E.P[id]):'?').join(' · ')}</span></div><em>${x.date.slice(5)}</em><em>$${x.cost}M</em></div>`).join('')||'<p class="sub">No seasons yet.</p>'}</div>
    <p class="sub dim" style="margin-top:16px">Engine v2 · fitted to 450 real playoff series · 76% correct · every game a fresh draw from the calibrated probability.</p>
    <button class="g2 wide ${S.resetArmed?'hot':''}" data-reset>${S.resetArmed?'Tap again to reset everything':'Reset everything'}</button></div>`; }
function viewDraft(){ const pk=S.packs[S.draftIdx]; if(!pk) return viewTeam(); const left=CAP-spent(); const W=S.wheel;
  const tone=clubTone(pk.team); const tc1=tone.body, tc2=tone.frame;
  const dock=`<div class="dock"><div class="cap"><span>Your five · pack ${S.draftIdx+1} of 5</span><b>$${left}M</b></div>
    <div class="five5">${[0,1,2,3,4].map(i=>{const q=S.picks[i]; return `<div class="f5 ${q?'on':''}" ${q?`data-kinfo="${q.id}"`:''}><i>${q?q.eligible[0]:'·'}</i>${q?`<b>${last(q)}</b><em>$${price(q)}M</em>`:'<b class="open">open</b>'}</div>`;}).join('')}</div></div>`;
  if(!S.pack) return `<div class="stage draft wheelstage">
    <div class="wheel ${W&&W.spinning?'live':''}" data-lock><div id="wheelrows">${W?wheelRows():''}</div></div>
    <p class="sub dim" style="text-align:center;margin-top:14px">${W&&W.spinning?'Tap to stop':''}</p></div>${dock}`;
  /* every man appears exactly once: in his primary column, unless a column would be empty —
     then up to two men who can also play it are MOVED there from the columns that can spare them */
  const colMen={}; SLOTS.forEach(sl=>colMen[sl]=pk.players.filter(p=>p.eligible[0]===sl));
  SLOTS.forEach(sl=>{ if(colMen[sl].length) return; let moved=0;
    for(const from of SLOTS.slice().sort((a,b)=>colMen[b].length-colMen[a].length)){ if(moved>=2) break; if(from===sl) continue;
      const cand=colMen[from].filter(p=>p.eligible.includes(sl)); for(const p of cand){ if(moved>=2||colMen[from].length<=1) break; colMen[from]=colMen[from].filter(q=>q.id!==p.id); colMen[sl].push(p); moved++; } } });
  const col=sl=>{ const men=colMen[sl];
    return `<div class="kcol"><div class="kchead"><b>${sl}</b><i>${men.length}</i></div>
      ${men.map(p=>{ const ok=canPick(p); const already=S.picks.some(q=>q.id===p.id);
        return cardHTML(p,{cls:already?'gone':ok?'':'no',attr:ok?`data-pick="${p.id}" data-now="1"`:`data-nopick="${p.id}"`,over:!ok&&!already&&spent()+price(p)+(4-S.picks.length)>CAP}); }).join('')||'<p class="sub dim" style="margin:0">nobody at this spot</p>'}</div>`; };
  const [city,nick]=splitTeam(pk.team.team);
  const any=pk.players.some(p=>{const to=slotFor(p); return to&&canPick(p,to);});
  return `<div class="stage draft" style="--c1:${tc1};--c2:${tc2}">
    <div class="hdY"><div class="hdl"><div class="n">${city}</div><div class="nn ${nick.length>=12?'l12':nick.length>=10?'l10':''}">${nick}</div></div><div class="yr">${short2(pk.team.season)}</div></div>
    <div class="kboard">${SLOTS.map(col).join('')}</div>
    ${any?'':'<p class="sub dim"><b style="color:var(--hot)">Nobody here fits an open slot under the cap.</b></p>'}
    <div class="row2"><button class="g2 ${any?'':'hot'}" data-reroll ${(S.rerolls>0||!any)?'':'disabled'}>Spin again<em>${any?`${S.rerolls} left`:'free — nobody fits'}</em></button><button class="g2" data-home>Quit</button></div>
    </div>${dock}`; }
const splitTeam=t=>{ const w=t.split(' '); return [w.slice(0,-1).join(' '),w.slice(-1)[0]]; };
const short2=s=>"'"+s.slice(2,4)+'-'+s.slice(-2);   // "1996-97" → "'96-97"
/* slot by slot: your man against theirs. Tap either for the card. */
function matchupBlock(mine,theirs){ const A=arrange(mine), Bv=arrange(theirs);
  const cell=(p,side)=>{const [tw,tc]=tagOf(p); return `<div class="mu ${side}" data-info="${p.id}"><b>${last(p)}</b><em><span class="ptag ${tc}">${tw}</span>${fmt(pg(p,'pts'))} pts · DEF ${fmt(E.playerDef(p),2)}</em></div>`;};
  return `<div class="muwrap"><div class="muhead"><span>YOUR FIVE</span><span>THEIRS</span></div>${SLOTS.map((sl,i)=>`<div class="murow">${cell(A[i],'a')}<i>${sl}</i>${cell(Bv[i],'b')}</div>`).join('')}</div>`; }
function viewRun(){ const R=S.run; if(!R) return `<div class="stage">${COURT}<div class="kick">RUN</div><div class="h" style="font-size:26px;margin-top:8px">No run in progress.</div><p class="sub">Build a five on the TEAM tab, then start today's run.</p><button class="big-cta" data-tab="team">Go to team</button></div>`;
  const mine=myFive(); const w=R.series.reduce((a,s)=>a+s.w,0), l=R.series.reduce((a,s)=>a+s.l,0);
  const node=(i)=>{ const opp=FIELD_BY_ID[R.bracket[i]]; const s=R.series[i];
    if(s) return `<div class="rnd ${s.win?'won':'lost'} ${i===3?'final':''}"><div class="rl">${ROUND_NAME[i]}</div><div class="ser"><div><b>${opp.t.abbr} ${short(opp.t.season)}<em>${opp.t.record.w}–${opp.t.record.l}</em></b><div class="g">${s.games.map(g=>`<i class="${g.win?'w':'l'}"></i>`).join('')}</div></div><div class="sc ${s.win?'':'l'}">${s.w}–${s.l}<small>${pct(s.sp)} SERIES</small></div></div></div>`;
    if(i===R.round&&!R.over){ const sp=seriesProb(mine,opp.five,i); const rows=lessonRows(mine,opp.five,i).filter(r=>r.k!=='home'); const bad=rows.filter(r=>r.pts<0).slice(0,2), good=rows.filter(r=>r.pts>0).slice(0,1); const rank=FIELD.indexOf(opp)+1;
      return `<div class="rnd now ${i===3?'final':''}"><div class="rl">${ROUND_NAME[i]}</div><div class="hero">
        <div class="bug"><div class="side"><div class="nm"><i style="background:var(--ink)"></i>Your five</div><div class="sub">$${mine.reduce((a,q)=>a+price(q),0)}M · net ${sp.A.net>=0?'+':''}${fmt(sp.A.net,1)}</div><div class="sc">${pct(sp.p)}</div></div>
          <div class="mid">${ROUND_TIER[i]}<br>${HOME_NET[i]?`they hold home court`:'neutral court'}</div>
          <div class="side r" data-team="${opp.id}"><div class="nm">${opp.t.abbr}<i style="background:${opp.t.c1};box-shadow:0 0 0 2px ${opp.t.c2==='#000000'?'#8A9099':opp.t.c2} inset;margin:0 0 0 7px"></i></div><div class="sub">${opp.t.season} · ${opp.t.record.w}–${opp.t.record.l}</div><div class="sc">${pct(1-sp.p)}</div></div></div>
        <div class="bugcap"><span>${opp.t.team} · #${rank} of ${FIELD.length} fives</span><span>${pct(gameProb(sp.p))} per game · ${R.moves} move${R.moves===1?'':'s'} left</span></div>
        ${matchupBlock(mine,opp.five)}
        <div class="hread"><b>The read.</b> ${bad.map(r=>`<b>${r.n} ${fmt(r.pts,1)}</b> — ${lessonText(r,mine,opp.five)}`).join(' ')}${good.length?` <b>Your edge: ${good[0].n} +${fmt(good[0].pts,1)}</b> — ${lessonText(good[0],mine,opp.five)}`:''}</div>
        <div class="hcta"><button class="big-cta" data-play>Play the series</button>${R.moves?`<button class="g2 wide" data-fix>Fix the five · ${R.moves} left</button>`:''}</div></div></div>`; }
    return `<div class="rnd sealed"><div class="rl">${ROUND_NAME[i]}</div><div class="ser"><b>?? <em>${ROUND_TIER[i]}</em></b></div></div>`; };
  let over='';
  if(R.over){ const lastS=R.series[R.series.length-1]; const opp=FIELD_BY_ID[lastS.opp];
    if(R.won) over=`<div class="lost win"><div class="lh"><div class="lk">RUN OVER · CHAMPION</div><div class="lt">${w}–${l}<small>SIXTEEN WINS · A RING · ${S.rings}× CHAMPION</small></div></div></div>`;
    else { const rows=lessonRows(mine,opp.five,R.round); const sw=S.swaps;
      over=`<div class="lost"><div class="lh"><div class="lk">RUN OVER · LOST ${ROUND_NAME[R.round]} ${lastS.w}–${lastS.l}</div><div class="lt">${w}–${l}<small>${opp.t.abbr} ${short(opp.t.season)} · SERIES WAS ${pct(lastS.sp)} · BEST ${S.best}</small></div></div>
        <div class="les"><div class="lesh">THE LESSON · WHERE THE NET RATING WENT</div>${rows.slice(0,4).map(r=>`<div class="lr"><b class="${r.pts>=0?'g':'r'}">${r.pts>=0?'+':''}${fmt(r.pts,1)}</b><div><div class="k" data-stat="${r.sheet}"><u>${r.n}</u> · ${r.w}</div><div class="t">${lessonText(r,mine,opp.five)}</div></div></div>`).join('')}</div>
        ${sw?`<div class="swap"><div class="sh">${sw.flips?'THE ONE MOVE THAT WINS IT':'THE BEST MOVE YOU HAD'} · FROM YOUR OWN PACKS</div>
          <div class="pair"><div class="pc"><b>${sw.out.name}</b><em>${sw.out.eligible[0]} · ${sw.out.abbr} ${short(sw.out.season)} · $${price(sw.out)}<br>${cardStats(sw.out).map(([n,v])=>n+' '+v).join(' · ')}</em></div><div class="arr">→</div><div class="pc in"><b>${sw.inn.name}</b><em>${sw.inn.eligible[0]} · ${sw.inn.abbr} ${short(sw.inn.season)} · $${price(sw.inn)}<br>${cardStats(sw.inn).map(([n,v])=>n+' '+v).join(' · ')}</em></div></div>
          <div class="why">Series ${pct(sw.base)} → <span class="m">${pct(sw.p)}</span>. ${swapWhy(sw)} ${sw.flips?'':'<b>No single swap flips this one — it takes two.</b>'}</div></div>`:''}</div>
        <div class="row2">${sw?`<button class="g2 hot" data-applyswap>Make the move and re-run<em>${last(sw.inn)} in · new bracket from round 1</em></button>`:''}<button class="g2" data-run="free">Re-run as is<em>same five, new bracket</em></button></div>`; } }
  return `<div class="stage">${COURT}<div class="rec" style="padding:11px 16px"><div><div class="big" style="font-size:30px">${w}–${l}<small>${R.daily?"TODAY'S CHALLENGE"+(R.counts?'':' · PRACTICE'):'RUN'} · ${R.over?'OVER':ROUND_NAME[R.round]}</small></div></div><div class="side">${R.over?'':'WINS TO A RING'}<b>${R.over?(R.won?'':'—'):16-w}</b></div></div>
    ${over}<div class="brk">${[0,1,2,3].map(node).join('')}</div>
    ${!R.over?`<p class="sub dim">A series is best-of-seven. The higher seed keeps home court: +0.5 net in round 2, +1 in the conference finals, +1.5 in the finals — half of what the data says home court is worth over a series.</p>`:''}</div>`; }
function lessonText(r,mine,theirs){ const m5=k=>mean(mine.map(p=>k==='usg'?adv(p,'usg')*100:['ts','threePAr','rebPct','astPct'].includes(k)?adv(p,k)*100:k==='tovPct'?adv(p,k):p100(p,k))), t5=k=>mean(theirs.map(p=>k==='usg'?adv(p,'usg')*100:['ts','threePAr','rebPct','astPct'].includes(k)?adv(p,k)*100:k==='tovPct'?adv(p,k):p100(p,k)));
  const you=r.pts>=0, lo=mine.slice(), nm=last;
  if(r.k==='def'){ const worst=lo.sort((a,b)=>E.playerDef(a)-E.playerDef(b))[0]; return you?`Your five defends better — ${fmt(mean(mine.map(E.playerDef)),2)} to ${fmt(mean(theirs.map(E.playerDef)),2)}. Keep that.`:`They defend at ${fmt(mean(theirs.map(E.playerDef)),2)} to your ${fmt(mean(mine.map(E.playerDef)),2)}. ${nm(worst)} (${fmt(E.playerDef(worst),2)}) is the softest spot.`; }
  if(r.k==='home') return 'The higher seed\'s edge. Only a better five takes it away.';
  if(r.k==='scoring'){ const u=mine.reduce((a,p)=>a+adv(p,'usg'),0)*100, ut=theirs.reduce((a,p)=>a+adv(p,'usg'),0)*100; return `Five men's per-100 scoring adds to ${fmt(m5('pts')*5,0)} against their ${fmt(t5('pts')*5,0)}, usage at ${fmt(u,0)}% vs ${fmt(ut,0)}%.${u>108?' Past 100% the tax bites: somebody stands in the corner.':''}${!you&&u<=108?' Pay for a scorer, or win it elsewhere.':''}`; }
  if(r.k==='playmaking') return `${fmt(m5('ast')*5,1)} assists per 100 to their ${fmt(t5('ast')*5,1)}.${you?'':' A 6-assist man starts the offence for everyone else.'}`;
  if(r.k==='shooting') return `3PAr .${fmt(m5('threePAr'),0).padStart(2,'0')} vs .${fmt(t5('threePAr'),0).padStart(2,'0')}, ${fmt(m5('fg3m')*5,1)} threes per 100 to their ${fmt(t5('fg3m')*5,1)}.${you?'':' Under .30 lets a rim protector stay home.'}`;
  if(r.k==='efficiency') return `TS% ${fmt(m5('ts'),0)} vs ${fmt(t5('ts'),0)}.${you?'':' 58%+ is the bar for a five that wants to score.'}`;
  if(r.k==='turnovers') return `${fmt(m5('tov')*5,1)} turnovers per 100 to their ${fmt(t5('tov')*5,1)}.${you?'':' Ball-handlers with TOV% under 12.'}`;
  if(r.k==='glass') return `REB% ${fmt(m5('rebPct')*5,0)} vs ${fmt(t5('rebPct')*5,0)}.${you?'':' Worth about a point of net rating per five in the data.'}`;
  return ''; }
function swapWhy(sw){ const a=E.rate(sw.five.map(p=>p)), b=E.rate(myFive()); const dn=a.net-b.net; const parts=[]; if(Math.abs(a.ortg-b.ortg)>=.3) parts.push(`offence ${a.ortg-b.ortg>=0?'+':''}${fmt(a.ortg-b.ortg,1)}`); if(Math.abs(a.drtg-b.drtg)>=.3) parts.push(`defence ${-(a.drtg-b.drtg)>=0?'+':''}${fmt(-(a.drtg-b.drtg),1)}`);
  return `Net rating ${dn>=0?'+':''}${fmt(dn,1)} (${parts.join(', ')||'about even'}). Costs $${price(sw.inn)-price(sw.out)>=0?'+':''}${price(sw.inn)-price(sw.out)}M.`; }
function viewFix(){ const R=S.run; const opp=FIELD_BY_ID[R.bracket[R.round]]; const mine=myFive(); const base=seriesProb(mine,opp.five,R.round).p;
  const pool=[]; (R.packs||[]).forEach(pk=>pk.players.forEach(p=>{ if(!mine.some(m=>m.id===p.id)) pool.push(p); }));
  const opts=[]; for(let i=0;i<5;i++) for(const p of pool){ const f=mine.slice(); f[i]=p; if(f.reduce((a,q)=>a+price(q),0)>CAP||!feasible(f)) continue; opts.push({out:mine[i],inn:p,p:seriesProb(f,opp.five,R.round).p}); }
  opts.sort((a,b)=>b.p-a.p);
  return `<div class="stage">${COURT}<div class="kick">Fix the five · ${R.moves} MOVE${R.moves===1?'':'S'} LEFT · VS ${opp.t.abbr} ${short(opp.t.season)}</div><div class="h" style="font-size:22px;margin:8px 0 4px">Series now: ${pct(base)}</div><p class="sub">Every legal swap from your five packs, ranked by what it does to this series. Cap $${CAP}M.</p>
    <div class="ppl">${opts.slice(0,14).map(o=>`<div class="pr" data-swap="${o.out.id}|${o.inn.id}"><span class="pos">${o.out.eligible[0]}</span><span class="nm">${last(o.out)} → ${o.inn.name}<em>${o.inn.abbr} ${short(o.inn.season)} · $${price(o.inn)}M · ${cardStats(o.inn).map(([n,v])=>n+' '+v).join(' · ')}</em></span><span class="st"><i>SERIES <b class="${o.p>=base?'g':'r'}">${pct(o.p)}</b></i></span></div>`).join('')||'<p class="sub">No legal swap under the cap.</p>'}</div>
    <button class="g2 wide" data-tab="run">Back</button></div>`; }

function viewRecord(){ const ps=myFive(); if(!ps) return viewTeam();
  const tile=x=>{ const p=E.series(ps,x.five,0).p; const played=S.played[x.id]; const net=E.series(ps,x.five,0).net; const cls=Math.abs(net)<1.5?'cf':net>0?(net>=8?'w3':net>=4?'w2':'w1'):(net<=-8?'l3':net<=-4?'l2':'l1');
    return `<div class="${cls} ${played?'p':''}" data-team="${x.id}" title="${x.t.team} ${x.t.season}">${x.t.abbr}<i>${short(x.t.season)}</i></div>`; };
  const tierRec=tier=>{let w=0;tier.forEach(x=>{if(E.series(ps,x.five,0).p>=.5)w++;});return `${w}–${tier.length-w}`;};
  return `<div class="stage">${COURT}<div class="rec"><div><div class="big" style="font-size:28px">${recordVsField(ps).replace(' PROJECTED','')}<small>VS THE FIELD · ${FIELD.length} REAL FIVES · NEUTRAL COURT</small></div></div><div class="side">PLAYED<b>${Object.keys(S.played).length}</b></div></div>
    <div class="kick" style="margin-top:12px">DEPTH = NET EDGE · DOT = PLAYED · TAP A TILE TO PLAY IT</div>
    ${[3,2,1,0].map(i=>`<div class="tierlab"><span>${ROUND_NAME[i]} · ${ROUND_TIER[i]}</span><b>${tierRec(TIERS[i])}</b></div><div class="heat">${TIERS[i].map(tile).join('')}</div>`).join('')}
    <div class="legend2"><span><i style="background:rgba(63,224,138,.55)"></i>+8 NET</span><span><i style="background:rgba(63,224,138,.2)"></i>+1</span><span><i style="background:var(--gold)"></i>±1.5</span><span><i style="background:rgba(255,79,94,.55)"></i>−8</span><span>● PLAYED</span></div>
    <button class="g2 wide" data-tab="team">Back</button></div>`; }

function viewVs(){ const ps=myFive(); const q=(S.vsQuery||'').toLowerCase();
  const list=FIELD.filter(x=>!q||(x.t.team+' '+x.t.season+' '+x.t.abbr).toLowerCase().includes(q)).slice(0,40);
  const res=S.vs?(()=>{const x=FIELD_BY_ID[S.vs]; const r=E.series(ps,x.five,0); const g=gameProb(r.p); const rows=lessonRows(ps,x.five,0).filter(r=>r.k!=='home').slice(0,4);
    return `<div class="lost ${r.p>=.5?'win':''}" style="margin-top:10px"><div class="lh"><div class="lk">VS ${x.t.team.toUpperCase()} ${x.t.season} · NEUTRAL COURT</div><div class="lt">${pct(r.p)}<small>SERIES · ${pct(g)} PER GAME · NET ${r.net>=0?'+':''}${fmt(r.net,1)}</small></div></div>
      <div class="les">${rows.map(rw=>`<div class="lr"><b class="${rw.pts>=0?'g':'r'}">${rw.pts>=0?'+':''}${fmt(rw.pts,1)}</b><div><div class="k"><u data-stat="${rw.sheet}">${rw.n}</u> · ${rw.w}</div><div class="t">${lessonText(rw,ps,x.five)}</div></div></div>`).join('')}</div>
      ${fiveBlock(x.five)}</div>`;})():'';
  return `<div class="stage">${COURT}<div class="kick">Vs anyone · ${FIELD.length} REAL FIVES</div><input class="search" id="vsq" placeholder="team, season or abbreviation" value="${S.vsQuery||''}">
    ${res}<div class="ppl" style="margin-top:8px">${list.map(x=>`<div class="pr" data-vs-pick="${x.id}"><span class="pos" style="color:${x.t.c2}">${x.t.abbr}</span><span class="nm">${x.t.team} ${x.t.season}<em>${x.t.record.w}–${x.t.record.l} · ${x.five.map(last).join(', ')}</em></span><span class="st"><i>NET <b>${x.net>=0?'+':''}${fmt(x.net,1)}</b></i></span></div>`).join('')}</div>
    <button class="g2 wide" data-tab="team">Back</button></div>`; }
function viewReal(){ const q=(S.vsQuery||'').toLowerCase(); const list=FIELD.filter(x=>!q||(x.t.team+' '+x.t.season+' '+x.t.abbr).toLowerCase().includes(q)).slice(0,40);
  return `<div class="stage">${COURT}<div class="kick">START FROM A REAL TEAM</div><input class="search" id="vsq" placeholder="team, season or abbreviation" value="${S.vsQuery||''}">
    <div class="ppl" style="margin-top:8px">${list.map(x=>`<div class="pr" data-real-pick="${x.id}"><span class="pos" style="color:${x.t.c2}">${x.t.abbr}</span><span class="nm">${x.t.team} ${x.t.season}<em>${x.t.record.w}–${x.t.record.l} · ${x.five.map(last).join(', ')}</em></span><span class="st"><i>NET <b>${x.net>=0?'+':''}${fmt(x.net,1)}</b></i></span></div>`).join('')}</div>
    <p class="sub dim">Real fives have no cap and no packs — you can run them, but the lesson's "one move" needs packs.</p><button class="g2 wide" data-tab="team">Back</button></div>`; }
function viewTonight(){ return `<div class="stage">${COURT}<div class="kick">TONIGHT</div><div class="h" style="font-size:26px;margin-top:8px">Opens with the season.</div><p class="sub">Every night's real NBA games: pick the winner, the margin, the impact players, their lines. Points for what you call, a ladder for the crew. Tip-off is late October.</p></div>`; }
/* ---------- sheets: stat definitions with the league distribution; player and team cards ---------- */
function statSheet(k){ const I=STAT_INFO[k]; if(!I) return ''; const ps=myFive(); const a=DIST[I.k||'def']||[]; const bins=Array(12).fill(0); const lo=a[Math.floor(a.length*.01)],hi=a[Math.floor(a.length*.99)];
  a.forEach(v=>{const i=clamp(Math.floor((v-lo)/(hi-lo)*12),0,11);bins[i]++;}); const mx=Math.max(...bins);
  const mark=(v,label,cls)=>`<span class="mk ${cls}" style="left:${clamp((v-lo)/(hi-lo)*100,0,100)}%"><b>${label}</b></span>`;
  const you=ps?mean(ps.map(p=>I.k?adv(p,I.k):E.playerDef(p))):null; const sc=v=>I.k==null?fmt(v,2):I.x===100?pct(v):fmt(v,1);
  return `<div class="sheet"><div class="grab"></div><div class="sk">STAT · ${I.t.toUpperCase()}</div><div class="sn">${I.n}<small>${I.t}</small></div><div class="sd">${I.d} <b>Why it matters:</b> ${I.w}</div><div class="form">${I.f}</div>
    <div class="dist">${bins.map(b=>`<i style="height:${Math.round(100*b/mx)}%"></i>`).join('')}${you!=null?mark(you,'YOUR FIVE '+sc(you),'y'):''}</div><div class="dl"><span>${sc(lo)}${I.low?' · BEST':''}</span><span>${a.length} PLAYER-SEASONS · 15+ MPG</span><span>${sc(hi)}${I.low?' · WORST':''}</span></div><button class="g2 wide" data-close>Close</button></div>`; }
/* the eleven bars: label, value shown, distribution key, value getter, higher-is-better, sheet key */
const BAR_GROUPS_OLD=[
  ['SCORING','#FF7A3D',[['USG%',p=>pct(adv(p,'usg')),'usg',p=>adv(p,'usg'),true,'usg'],['TS%',p=>pct(adv(p,'ts')),'ts',p=>adv(p,'ts'),true,'ts'],['FTr',p=>fmt(adv(p,'ftr'),2).replace(/^0/,''),'ftr',p=>adv(p,'ftr'),true,null]]],
  ['SHOOTING','#3FE08A',[['3PAr',p=>fmt(adv(p,'threePAr'),2).replace(/^0/,''),'threePAr',p=>adv(p,'threePAr'),true,'threePAr'],['eFG%',p=>pct(adv(p,'efg')),'efg',p=>adv(p,'efg'),true,'efg'],['3PM/100',p=>fmt(p100(p,'fg3m')),'p100:fg3m',p=>p100(p,'fg3m'),true,null]]],
  ['PLAYMAKING','#FFD24A',[['AST%',p=>pct(adv(p,'astPct')),'astPct',p=>adv(p,'astPct'),true,'astPct'],['TOV%',p=>fmt(adv(p,'tovPct'),1),'tovPct',p=>adv(p,'tovPct'),false,'tovPct']]],
  ['DEFENCE · GLASS','#4DE3FF',[['DEF',p=>fmt(E.playerDef(p),2),'def',p=>E.playerDef(p),true,'def'],['REB%',p=>pct(adv(p,'rebPct')),'rebPct',p=>adv(p,'rebPct'),true,'rebPct'],['STL/100',p=>fmt(p100(p,'stl')),'p100:stl',p=>p100(p,'stl'),true,null]]]];
const BAR_GROUPS=[
  ['OFFENCE','#FF7A3D',[['USG%',p=>pct(adv(p,'usg')),'usg',p=>adv(p,'usg'),true,'usg'],['TS%',p=>pct(adv(p,'ts')),'ts',p=>adv(p,'ts'),true,'ts'],['3PAr',p=>fmt(adv(p,'threePAr'),2).replace(/^0/,''),'threePAr',p=>adv(p,'threePAr'),true,'threePAr'],['AST%',p=>pct(adv(p,'astPct')),'astPct',p=>adv(p,'astPct'),true,'astPct'],['TOV%',p=>fmt(adv(p,'tovPct'),1),'tovPct',p=>adv(p,'tovPct'),false,'tovPct'],['FTr',p=>fmt(adv(p,'ftr'),2).replace(/^0/,''),'ftr',p=>adv(p,'ftr'),true,null]]],
  ['DEFENCE','#4DE3FF',[['DEF',p=>fmt(E.playerDef(p),2),'def',p=>E.playerDef(p),true,'def'],['REB%',p=>pct(adv(p,'rebPct')),'rebPct',p=>adv(p,'rebPct'),true,'rebPct'],['STL/100',p=>fmt(p100(p,'stl')),'p100:stl',p=>p100(p,'stl'),true,null],['BLK/100',p=>fmt(p100(p,'blk')),'p100:blk',p=>p100(p,'blk'),true,null]]]];
const STRONG={'USG%':'Carries the offence — usage','TS%':'Scores efficiently — true shooting','FTr':'Lives at the line','3PAr':'Takes his shots from three','eFG%':'Makes them — effective FG','3PM/100':'Real volume from three','AST%':'Creates for everyone else','TOV%':'Keeps the ball — turnover rate','DEF':'Team defends with him on the floor','REB%':'Owns his share of the glass','STL/100':'Hands in the passing lanes'};
const WEAK={'USG%':'A small part of the offence','TS%':'Inefficient for the volume','FTr':'Never gets to the line','3PAr':'Does not shoot threes','eFG%':'Misses too many','3PM/100':'No volume from three','AST%':'Creates little','TOV%':'Turnovers travel with him','DEF':'Team defends worse with him on','REB%':'Gives up the glass','STL/100':'Passive hands'};
function playerSheet(id){ const p=E.P[id]; if(!p) return ''; const [tw,tc]=tagOf(p); const tier=tierOf(p); const pos=p.eligible[0]; const pav=POS_AVG[pos]; const badges=ACC[p.id]||[];
  const POSN=pos;
  const O=ovr(p);
  const barsHTML=BAR_GROUPS.map(([g,c,rows])=>`<div class="grp2" style="--gc:${c}"><div class="gh2"><b>${g} <big>${g==='OFFENCE'?O.off:O.def}</big></b><span>vs ${pos}</span></div>${rows.map(([l,show,dk,get,hi,sheet])=>{ let q=posPctile(pos,dk,get(p)); if(q==null) q=.5; if(!hi) q=1-q;
    return `<div class="bar2 ${q>=.5?'lead':''}" ${sheet?`data-stat="${sheet}"`:''}><span class="bl">${l}</span><div class="trk2"><i style="width:${Math.round(q*100)}%"></i><u style="left:50%"></u><b>${show(p)}</b></div></div>`;}).join('')}</div>`).join('');
  const strong=[],weak=[]; BAR_GROUPS.forEach(([g,c,rows])=>rows.forEach(([l,show,dk,get,hi])=>{ let q=posPctile(pos,dk,get(p)); if(q==null) return; if(!hi) q=1-q; if(q>=.85) strong.push(`+ ${STRONG[l]} · ${Math.round(q*100)}th`); if(q<=.25) weak.push(`− ${WEAK[l]} · ${Math.round(q*100)}th`); }));
  const sw=(strong.length||weak.length)?`<div class="sw"><div class="swc"><b>Strengths</b>${strong.slice(0,4).map(t=>`<span>${t}</span>`).join('')||'<span>Nothing above the 85th percentile.</span>'}</div><div class="swc w"><b>Weaknesses</b>${weak.slice(0,4).map(t=>`<span>${t}</span>`).join('')||'<span>Nothing below the 25th.</span>'}</div></div>`:'';
  const drafting=S.view==='draft'&&S.pack; let foot;
  if(!drafting) foot='';
  else if(S.picks.some(q=>q.id===p.id)) foot=`<button class="g2 wide" disabled>Signed</button>`;
  else if(p.capPct==null) foot=`<button class="g2 wide" disabled>No salary</button>`;
  else { const over=spent()+price(p)+(4-S.picks.length)-CAP;
    foot=over>0?`<button class="g2 wide" disabled>Over the cap · $${over}M</button>`:`<button class="g2 hot wide" data-pick="${p.id}" data-now="1">Sign · $${price(p)}M</button>`; }
  const club=colorsOf(p); const team=TEAM_OF[p.abbr+':'+p.season]; const roleKey=tc;
  return `<div class="sheet ps wash" style="--c1:${club.body}"><div class="psbody"><div class="grab"></div>
    <div class="ph"><div class="r1"><span><i></i>${team?team.team:p.abbr}</span><span>${short2(p.season)}</span></div>
      <div class="first">${p.name.split(' ').slice(0,-1).join(' ')}</div>
      <div class="r2"><b>${last(p)}</b><b class="pr">${p.capPct!=null?`$${price(p)}M`:'—'}</b></div></div>
    <div class="tagline"><span class="ktag"><span>${tw}</span></span><em>${p.jersey?'#'+p.jersey+' · ':''}${p.eligible.join(' · ')}${p.ht?" · "+Math.floor(p.ht/12)+"'"+p.ht%12:''} · ${p.gp} GP</em></div>
    <p class="rolewhy">${ROLE_LONG[roleKey]||''}</p>
    <div class="avg">${[['pts','PTS'],['reb','REB'],['ast','AST'],['stl','STL'],['blk','BLK'],['fg3m','3PM']].map(([k,l])=>`<div><b>${fmt(pg(p,k))}</b><i>${l}</i></div>`).join('')}</div>
    <div class="avgcap"><span>Per game · ${fmt(p.min)} min</span><span>${p.gs} starts · FG ${pg(p,'fga')?Math.round(100*pg(p,'fgm')/pg(p,'fga')):'–'}% · 3P ${pg(p,'fg3a')?Math.round(100*pg(p,'fg3m')/pg(p,'fg3a')):'–'}%</span></div>
    ${barsHTML}<div class="legend3"><span><i></i>${pos} median</span><span>Bar = percentile among ${pos}s · tap a row for the definition</span></div>${sw}</div>
    ${foot?`<div class="psfoot">${foot}</div>`:''}</div>`; }
function slotSheet(id){ const p=E.P[id]; if(!p) return '';
  const rows=SLOTS.map(sl=>{ const taken=S.slots[sl]?E.P[S.slots[sl]]:null; const pen=slotPen(p,sl); const ok=!taken&&canPick(p,sl);
    return `<button class="slotopt ${taken?'taken':ok?'':'no'} ${pen===0?'nat':''}" ${ok?`data-pick="${p.id}" data-slot="${sl}" data-now="1"`:''}><i>${sl}</i><b>${taken?last(taken):pen===0?'Natural spot':pen===.5?'One over':pen===1?'Two over':pen===1.5?'Three over':'Four over'}</b><em>${taken?'taken':pen===0?'no penalty':`−${fmt(pen,1)} net`}</em></button>`; }).join('');
  return `<div class="sheet slotsheet"><div class="grab"></div><div class="kick">Where does ${last(p)} play?</div><p class="sub" style="margin-top:4px">Natural spot ${p.eligible[0]}${p.eligible.length>1?' · also '+p.eligible.slice(1).join(', '):''} · $${price(p)}M</p>
    <div class="slotgrid">${rows}</div><button class="g2 wide" data-close>Back</button></div>`; }
function teamSheet(id){ const x=FIELD_BY_ID[id]; if(!x) return ''; const r=E.rate(x.five); const ps=myFive(); const sp=ps?E.series(ps,x.five,0):null;
  return `<div class="sheet"><div class="grab"></div><div class="sk">${x.t.season} · ${x.t.record.w}–${x.t.record.l} · ORtg ${fmt(x.t.ortg,1)} · DRtg ${fmt(x.t.drtg,1)}</div><div class="sn" style="color:${x.t.c2}">${x.t.team}<small>NET ${r.net>=0?'+':''}${fmt(r.net,1)} (five)</small></div>
    ${fiveBlock(x.five)}${cells(x.five)}${sp?`<div class="row2"><button class="g2 hot" data-vs-go="${x.id}">Play a series · ${pct(sp.p)}<em>neutral court</em></button><button class="g2" data-close>Close</button></div>`:`<button class="g2 wide" data-close>Close</button>`}</div>`; }

/* ---------- render + events ---------- */
function render(){ let body='';
  if(S.view==='home') body=viewHome(); else if(S.view==='draft') body=viewDraft(); else if(S.view==='fix') body=viewFix(); else if(S.view==='record') body=viewRecord(); else if(S.view==='vs') body=viewVs(); else if(S.view==='real') body=viewReal();
  else if(S.view==='chooser') body=viewChooser();
  else if(S.view==='lineup') body=viewLineup();
  else body=S.tab==='build'?viewHome():S.tab==='season'?viewSeason():viewYou();
  const right=S.bestTeam?`Best ${S.bestW}-${S.bestL}`:'';
  const wash=(S.view==='draft'&&S.pack&&S.packs&&S.packs[S.draftIdx])?` style="--c1:${clubTone(S.packs[S.draftIdx].team).wash}"`:'';
  HOST.className='mode'+(S.view==='draft'?' drafting':''); HOST.setAttribute('style',(wash||'').replace(/^ style="|"$/g,'')); HOST.innerHTML=`${body}${tabs()}${S.sheet?`<div class="scrim" data-close></div>${S.sheet.kind==='stat'?statSheet(S.sheet.id):S.sheet.kind==='player'?playerSheet(S.sheet.id):teamSheet(S.sheet.id)}`:''}`; window.__shell&&window.__shell.meta(right);
  const q=$('vsq'); if(q){ q.addEventListener('input',e=>{S.vsQuery=e.target.value; const v=S.view; render(); const q2=$('vsq'); if(q2){q2.focus(); q2.setSelectionRange(q2.value.length,q2.value.length);} }); }
  }
/* swipe down on a sheet closes it: only when the sheet body is scrolled to the top */
(function(){ let y0=null, sc=null; document.addEventListener('touchstart',e=>{ const sh=e.target.closest&&e.target.closest('.sheet'); if(!sh) return; const body=sh.querySelector('.psbody')||sh; y0=e.touches[0].clientY; sc=body.scrollTop; },{passive:true});
  document.addEventListener('touchend',e=>{ if(y0==null) return; const dy=e.changedTouches[0].clientY-y0; if(sc<=0&&dy>90&&S.sheet){ S.sheet=null; render(); } y0=null; },{passive:true}); })();
document.addEventListener('click',e=>{ const c=s=>e.target.closest(s);
  let el;
  if(c('[data-close]')){ S.sheet=null; render(); return; }
  if(el=c('[data-stat]')){ if(el.dataset.stat){ S.sheet={kind:'stat',id:el.dataset.stat}; render(); return; } }
  if(el=c('[data-vs-go]')){ S.sheet=null; S.vs=el.dataset.vsGo; S.view='vs'; render(); return; }
  if(el=c('[data-team]')){ S.sheet={kind:'team',id:el.dataset.team}; render(); return; }
  if(el=c('[data-kinfo]')){ S.sheet={kind:'player',id:el.dataset.kinfo}; render(); return; }
  if(el=c('[data-pick]')){ S.sheet=null; pick(E.P[el.dataset.pick]); return; }
  if(el=c('[data-lu]')){ const i=+el.dataset.lu; if(S.luSel==null||S.luSel===i){ S.luSel=S.luSel===i?null:i; } else { const t=S.lineup[S.luSel]; S.lineup[S.luSel]=S.lineup[i]; S.lineup[i]=t; S.luSel=null; } render(); return; }
  if(c('[data-lu-best]')){ S.lineup=bestLineup(S.picks); S.luSel=null; render(); return; }
  if(c('[data-play-season]')){ S.team=S.lineup.slice(); S.luSel=null; startSeason(S.draftDaily?daySeed(dayKey()+':season'):null); return; }
  if(el=c('[data-nopick]')){ S.sheet={kind:'player',id:el.dataset.nopick}; render(); return; }
  if(c('[data-lock]')){ lockWheel(); return; }
  if(c('[data-reroll]')){ reroll(); return; }
  if(el=c('[data-swap]')){ const [o,i]=el.dataset.swap.split('|'); swapPlayer(o,E.P[i]); return; }
  if(el=c('[data-vs-pick]')){ S.vs=el.dataset.vsPick; render(); return; }
  if(el=c('[data-real-pick]')){ const x=FIELD_BY_ID[el.dataset.realPick]; S.team=x.five.map(p=>p.id); S.packs=null; S.picksPacks=null; S.run=null; S.swaps=null; S.view=null; S.tab='team'; save(); render(); return; }
  if(el=c('[data-info]')){ S.sheet={kind:'player',id:el.dataset.info}; render(); return; }
  if(el=c('[data-tab]')){ S.tab=el.dataset.tab; S.view=null; S.sheet=null; S.resetArmed=false; render(); return; }
  if(c('[data-chooser]')){ S.view='chooser'; render(); return; }
  if(c('[data-share]')){ const sn=S.season, ps=myFive(); if(!sn||!ps) return; const cost=ps.reduce((a,p)=>a+price(p),0);
    const txt=`Fantasyball — ${sn.w}-${sn.l}\n${SLOTS.map((sl,i)=>`${sl} ${ps[i].name} '${ps[i].season.slice(2,4)}`).join(' · ')}\n$${cost}M · net ${sn.net>=0?'+':''}${fmt(sn.net,1)} · #${ladderRank(sn.w)} of ${LADDER.length} real seasons`;
    const done=()=>{ S.shared=true; render(); setTimeout(()=>{S.shared=false; render();},2500); };
    if(navigator.share){ navigator.share({text:txt}).then(done).catch(()=>{}); } else if(navigator.clipboard){ navigator.clipboard.writeText(txt).then(done).catch(()=>{}); } return; }
  if(el=c('[data-draft]')){ startDraft(el.dataset.draft==='daily'); return; }
  if(el=c('[data-run]')){ if(!S.team){ startDraft(el.dataset.run==='daily'); return; } if(S.run&&!S.run.over){ S.tab='run'; render(); return; } startRun(el.dataset.run==='daily'); return; }
  if(c('[data-play]')){ playRound(); return; }
  if(c('[data-fix]')){ if(S.run&&S.run.moves>0) { S.view='fix'; render(); } return; }
  if(c('[data-applyswap]')){ const sw=S.swaps; if(sw){ S.team=arrange(sw.five).map(p=>p.id); save(); startRun(false); } return; }
  if(c('[data-record]')){ S.view='record'; render(); return; }
  if(c('[data-vs]')){ S.view='vs'; S.vs=null; S.vsQuery=''; render(); return; }
  if(c('[data-real]')){ S.view='real'; S.vsQuery=''; render(); return; }
  if(c('[data-edit]')){ if(S.packs){ S.picks=[]; S.slots={}; S.draftIdx=0; S.view='draft'; spinWheel(); } else { S.view='real'; S.vsQuery=''; render(); } return; }
  if(c('[data-home]')){ S.view='home'; S.tab='build'; S.sheet=null; S.wheel=null; S.pack=null; render(); return; }
  if(c('[data-continue]')){ S.view=null; S.tab='team'; render(); return; }
  if(c('[data-reset]')){ if(!S.resetArmed){ S.resetArmed=true; render(); return; } try{localStorage.removeItem(STORE);}catch(e){} S.team=null; S.season=null; S.seasons=[]; S.bestW=0; S.bestL=0; S.bestTeam=null; S.bestNet=null; S.packs=null; S.slots={}; S.picks=[]; S.dailyPlayed=null; S.resetArmed=false; S.tab='build'; S.view='home'; render(); return; }
  if(c('[data-release]')){ if(!S.releaseArmed){ S.releaseArmed=true; render(); return; } S.team=null; S.run=null; S.packs=null; S.picksPacks=null; S.slots={}; S.picks=[]; S.releaseArmed=false; S.swaps=null; save(); render(); return; }
});
   // roguelike: every launch starts from the wheel. Only the record persists.
window.__packs={S,E,FIELD,render,startDraft,startSeason,playSeason,pick,expectedWins,bestLineup,tagOf,ovr,cardHTML,slotFor,oopPenalty,init(){ load(); S.team=null; S.season=null; S.view='home'; S.tab='build'; render(); }};
})();
