// boot log + error trap: if anything throws, show the stage and the full stack on screen
window.__t0=Date.now();window.__stage='html';
window.__log=function(m){var b=document.getElementById('bootlog');if(b)b.textContent+='\n'+m+' · '+(Date.now()-window.__t0)+'ms';};
function __show(t){var a=document.getElementById('app');if(a)a.innerHTML='<pre style="padding:20px;color:#FF5A1F;font:12px/1.5 monospace;white-space:pre-wrap">'+t+'\n'+(Date.now()-window.__t0)+'ms after start</pre>';}
window.addEventListener('error',function(e){
  // an opaque "Script error." with no file/line comes from outside the page (a Safari extension, the PWA shell) — not ours, ignore it
  if(e.message==='Script error.'&&!e.filename&&!e.lineno) return;
  if(!e.message&&e.target&&e.target!==window){__show('resource failed: '+(e.target.tagName||'')+' '+String(e.target.src||e.target.href||'').slice(0,80));return;}
  var d=(e.error&&e.error.stack)?e.error.stack:(e.message+' @ '+e.filename+':'+e.lineno+':'+e.colno);
  __show('stage: '+window.__stage+'\n'+d);
},true);
window.addEventListener('unhandledrejection',function(e){__show('promise · stage: '+window.__stage+'\n'+(e.reason&&e.reason.stack||e.reason));});
window.__log('boot 1 · scripts start');
