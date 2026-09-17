import os,sys,json as _json; os.chdir(os.path.dirname(os.path.abspath(__file__)))
APP='beatball' if 'beatball' in sys.argv else 'fantasyball'
flame=open('src/flame.txt').read(); trap=open('src/trap.js').read()
css=open('src/fonts.css').read()+open('src/style.css').read().replace('var(--flame)',f'url({flame})'); assert sum((c=='{')-(c=='}') for c in css)==0,'CSS braces'
eng=open('src/engine.js').read(); scorer=open('src/scorer-engine.js').read() if APP=='beatball' else ''; packs=open('src/packs.js').read(); build=open('src/build.js').read(); shell=open('src/shell.js').read()
data=open('data/bundle-lite.json').read()
html=f'''<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><title>{'beatball' if APP=='beatball' else 'Fantasyball'}</title><meta name="theme-color" content="#0E1013">
<meta name="apple-mobile-web-app-capable" content="yes"><meta name="apple-mobile-web-app-status-bar-style" content="black-translucent"><meta name="apple-mobile-web-app-title" content="{'beatball' if APP=='beatball' else 'Fantasyball'}"><meta name="mobile-web-app-capable" content="yes">
<link rel="apple-touch-icon" href="{flame}"><link rel="icon" href="{flame}">
<style>{css}</style></head><body><div id="app"><div style="padding:40px 20px;font:500 14px/1.5 -apple-system,sans-serif;color:#8A9099">Loading Fantasyball…</div></div><pre id="bootlog" hidden></pre><script>{trap}</script>
<script>window.__stage="data";const BEATBALL_V2=JSON.parse({_json.dumps(data)});</script>
<script>window.__stage="engine";</script><script>{eng if APP=='beatball' else ''}</script>
<script>window.__stage="app";</script>
<script>document.getElementById('app').innerHTML='<div class="phone"><div id="mode-tonight" class="mode" hidden></div><div id="mode-packs" class="mode" hidden></div><div id="mode-build" class="mode" hidden></div></div>';</script>
<script>{build}</script><script>{scorer}</script><script>{packs}</script><script>{shell}</script></body></html>'''
out='beatball/index.html' if APP=='beatball' else 'index.html'; os.makedirs(os.path.dirname(out) or '.',exist_ok=True); open(out,'w').write(html); print(out,len(html)//1024,'KB')
