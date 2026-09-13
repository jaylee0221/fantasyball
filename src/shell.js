/* ============================================================================
   FANTASYBALL — shell. One brand bar, one mode row, one host per mode.
   Modes: Tonight (soon) · Packs · Build · History. Each module renders into its
   own host and only handles events inside it.
   ============================================================================ */
'use strict';
(function(){
  const MODES=[['tonight','Tonight'],['packs','Packs'],['build','Build']];
  const STORE='fantasyball.shell.v1';
  let mode='packs'; try{ mode=localStorage.getItem(STORE)||'packs'; }catch(e){}
  const phone=document.querySelector('#app .phone');
  phone.insertAdjacentHTML('afterbegin',`<div class="top"><div class="brand" data-mode="packs"><span class="ball"></span><b>FANTASYBALL</b></div><span class="meta" id="shell-meta"></span></div><nav class="modes" id="modes"></nav>`);
  const meta=t=>{ const m=document.getElementById('shell-meta'); if(m) m.textContent=t||''; };
  function paintModes(){ document.getElementById('modes').innerHTML=MODES.map(([k,l])=>`<span data-mode="${k}" class="${k===mode?'on':''}">${l}</span>`).join(''); }
  function show(m){ mode=m; try{ localStorage.setItem(STORE,m); }catch(e){}
    for(const [k] of MODES){ const h=document.getElementById('mode-'+k); if(h) h.hidden=true; }
    if(m==='tonight'){ const h=document.getElementById('mode-tonight'); h.hidden=false; h.innerHTML=`<div class="stage"><div class="big" style="font-size:40px">Tonight.<small>This season's games — pick a side before tip-off, get graded against the engine and the crew the morning after. Lands when the nightly data job is live.</small></div><button class="big-cta" data-mode="packs">Play Packs meanwhile</button></div>`; meta(''); }
    else if(m==='packs'){ document.getElementById('mode-packs').hidden=false; window.__packs.render(); }
    else { document.getElementById('mode-build').hidden=false; window.__build.render(); }
    paintModes(); window.scrollTo(0,0); }
  document.addEventListener('click',e=>{ const el=e.target.closest&&e.target.closest('[data-mode]'); if(el){ show(el.dataset.mode); } },true);
  window.__shell={show,meta,get mode(){return mode;}};
  window.__packs.init(); window.__build.init(); show(mode);
})();
