// boots index.html headlessly and walks both modes
const fs=require('fs'),vm=require('vm');const APP=process.argv[2]==='beatball'?'beatball':'fantasyball';const html=fs.readFileSync(__dirname+'/../'+(process.argv[2]==='beatball'?'beatball/index.html':'index.html'),'utf8');
const scripts=[...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m=>m[1]);
// a tiny DOM: elements with innerHTML/hidden/contains, getElementById over a registry, querySelector for .phone
const els={}; function mk(id){ const el={id,innerHTML:'',hidden:false,className:'',_attrs:{},children:[],parent:null,setAttribute(k,v){this._attrs[k]=v;},getAttribute(k){return this._attrs[k];},addEventListener(){},contains(t){ let x=t; while(x){ if(x===this) return true; x=x.parent; } return false; },querySelector(){return null;},insertAdjacentHTML(pos,h){ this.innerHTML=h+this.innerHTML; },focus(){},setSelectionRange(){},get textContent(){return this._t||'';},set textContent(v){this._t=v;}}; els[id]=el; return el; }
const app=mk('app'); const phone=mk('phone'); phone.parent=app; ['mode-tonight','mode-packs','mode-build','shell-meta','modes'].forEach(id=>{ const e=mk(id); e.parent=phone; });
const listeners={click:[],input:[],touchstart:[],touchend:[]};
const doc={getElementById:id=>els[id]||null,querySelector:sel=>sel==='#app .phone'?phone:null,querySelectorAll:()=>[],addEventListener(t,f,opt){ (listeners[t]=listeners[t]||[]).push(f); }};
const win={console,Math,Date,JSON,Set,Map,Array,Object,Number,String,parseInt,parseFloat,isNaN,Infinity,NaN,Error,setTimeout,clearTimeout,encodeURIComponent,decodeURIComponent,document:doc,localStorage:{_:{},getItem(k){return this._[k]??null},setItem(k,v){this._[k]=String(v)},removeItem(k){delete this._[k]}},location:{search:''},navigator:{},performance:{now:()=>Date.now()},scrollTo(){},addEventListener(){}};
win.window=win; vm.createContext(win); const t0=Date.now();
scripts.forEach((s,i)=>{ if(s.includes("getElementById('app').innerHTML=")) return; vm.runInContext(s,win,{filename:'s'+i}); }); console.log('boot',Date.now()-t0,'ms');
const P=win.__packs, Bm=win.__build, shell=win.__shell;
function click(host,attr,val){ const h=els[host]; const re=new RegExp(attr+(val!=null?'="'+String(val).replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'"':'(=|[\\s>])')); if(!re.test(h.innerHTML)) throw new Error('no '+attr+(val!=null?'='+val:'')+' in '+host);
  const el={dataset:{},parent:h}; const key=attr.replace(/^data-/,'').replace(/-([a-z])/g,(m,c)=>c.toUpperCase()); el.dataset[key]=val!=null?String(val):''; el.closest=sel=>{const m=sel.match(/^\[([^\]=]+)(?:="([^"]*)")?\]$/); return (m&&m[1]===attr&&(m[2]==null||m[2]===String(val)))?el:null;}; for(const f of listeners.click) f({target:el}); }
const has=(host,t)=>els[host].innerHTML.includes(t); let fails=0; const ok=(c,m)=>{ if(!c){fails++;console.log('FAIL',m);} else console.log('ok  ',m); };
ok(shell.mode==='packs'&&!els['mode-packs'].hidden&&has('mode-packs','data-draft'),'shell boots into Packs');
click('mode-packs','data-draft'); const S=P.S; if(!S.pack) click('mode-packs','data-lock'); ok(S.view==='draft'&&S.pack&&has('mode-packs','class="kboard"')&&has('mode-packs','class="flip"')&&!has('mode-packs','class="lst"'),'packs: wheel → cards flip in, no rows');
ok(!/\+\d+\.\d/.test(els['mode-packs'].innerHTML)&&!/#\d+ of/.test(els['mode-packs'].innerHTML),'packs: no value, no rank on cards');
click('mode-packs','data-player',S.packs[0].players[0].id); ok(has('mode-packs','class="bars2"')&&has('mode-packs','Sign ·')&&!/\+\d+\.\d<\/b><\/div><\/div>/.test(els['mode-packs'].innerHTML),'packs: ··· opens a read-only profile with Sign'); click('mode-packs','data-pclose');
ok(S.packs.every(pk=>pk.team.record.w>=45),'packs: every club on the wheel won 45+');
for(let i=0;i<5;i++){ if(!S.pack) break; const m=[...els['mode-packs'].innerHTML.matchAll(/data-pick="([^"]+)"/g)]; if(!m.length){ if(has('mode-packs','data-reroll')){ click('mode-packs','data-reroll'); if(!S.pack) click('mode-packs','data-lock'); i--; continue; } break; } const ids=[...new Set(m.map(x=>x[1]))]; const el={dataset:{pick:ids[Math.min(ids.length-1,S.picks.length>=2?ids.length-1:0)]},parent:els['mode-packs']}; el.closest=sel=>sel==='[data-pick]'?el:null; for(const f of listeners.click) f({target:el}); if(S.pack===null&&S.picks.length<5) click('mode-packs','data-lock'); }
ok(S.team&&S.team.length===5&&S.season&&S.season.w+S.season.l+(S.season.t||0)===82,'packs: five signed → 82 games ('+APP+'): '+(S.season&&S.season.w+'-'+S.season.l));
ok(APP==='beatball'?has('mode-packs','Expected')&&has('mode-packs','Net'):has('mode-packs','Category profile')&&has('mode-packs','Where the'),'packs: result extras for '+APP);
ok(has('mode-packs','The best five those packs allowed'),'packs: coach block');
click('mode-packs','data-player',S.team[0]); ok(has('mode-packs','class="bars2"')&&(APP!=='beatball'||has('mode-packs','Engine')),'packs: profile from the five'+(APP==='beatball'?' with the engine row':'')); click('mode-packs','data-pclose');
// switch mode
const modeEl={dataset:{mode:'build'},parent:phone}; modeEl.closest=sel=>sel==='[data-mode]'?modeEl:null; for(const f of listeners.click) f({target:modeEl});
ok(shell.mode==='build'&&els['mode-packs'].hidden&&!els['mode-build'].hidden&&has('mode-build','King of'),'shell → Build shows the fantasy ranking');
const marion=Bm.D.players.find(p=>p.n==='Shawn Marion'&&p.s==='2005-06'); click('mode-build','data-player',marion.id); ok(has('mode-build','class="bars2"'),'build: player sheet'); click('mode-build','data-add',marion.id); ok(Bm.S.five.length===1&&has('mode-build','class="dock"'),'build: added, dock');
for(const [n,s] of [['Steve Nash','2005-06'],['Stephen Curry','2015-16'],['Kevin Garnett','2003-04'],['Marcus Camby','2006-07']]){ const p=Bm.D.players.find(x=>x.n===n&&x.s===s); Bm.S.five.push(p.id); } Bm.render();
click('mode-build','data-matchup'); click('mode-build','data-save-five'); ok(Bm.S.view==='result'&&has('mode-build','against every real starting five'),'build: save → result vs field');
const back={dataset:{mode:'packs'},parent:phone}; back.closest=sel=>sel==='[data-mode]'?back:null; for(const f of listeners.click) f({target:back}); ok(shell.mode==='packs'&&!els['mode-packs'].hidden&&has('mode-packs','Build again'),'shell → back to Packs keeps its season');
ok(!/NaN|undefined/.test(els['mode-packs'].innerHTML+els['mode-build'].innerHTML),'no NaN/undefined');
console.log(fails?'FAILURES '+fails:'ALL PASS');
