const CACHE_NAME='bep-si-report-local-only-v59';
const ASSETS=['./','./index.html','./test-first-app.js','./src/ui-polish.js','./src/test-pull.js','./src/compact-detail.js','./src/app-update.js','./src/test-export.js','./src/modal-scroll-fix.js','./src/mcp-ui-shell.js','./src/mcp-import-ui.js','./src/mcp-customer-manage-style.js','./src/mcp-order-actions.js','./src/business-ui-shells.js','./src/data-hub-shell.js','./src/data-hub-force.js','./src/polish.css','./data-model.js','./local-db.js','./manifest.webmanifest','./icons/icon.svg','./favicon.ico'];
self.addEventListener('install',e=>{e.waitUntil(caches.open(CACHE_NAME).then(c=>c.addAll(ASSETS)).then(()=>self.skipWaiting()))});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE_NAME).map(k=>caches.delete(k)))).then(()=>self.clients.claim()))});
self.addEventListener('message',e=>{if(e.data&&e.data.type==='SKIP_WAITING')self.skipWaiting()});
async function first(req){const c=await caches.open(CACHE_NAME);try{const r=await fetch(req);if(r&&r.ok)c.put(req,r.clone());return r}catch(err){return await c.match(req)||await c.match('./index.html')}}
self.addEventListener('fetch',e=>{if(e.request.method!=='GET')return;const u=new URL(e.request.url);if(u.origin!==self.location.origin)return;e.respondWith(first(e.request))});
