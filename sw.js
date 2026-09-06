/* DBD Base v1.0 r4 — cache retirement. */
/* DBD Base v1.0 — retire stale experimental caches. */
self.addEventListener('install',event=>event.waitUntil(self.skipWaiting()));
self.addEventListener('activate',event=>event.waitUntil((async()=>{try{const keys=await caches.keys();await Promise.all(keys.filter(k=>String(k).startsWith('dbd-')).map(k=>caches.delete(k)));await self.clients.claim();await self.registration.unregister();}catch(e){}})()));
self.addEventListener('fetch',()=>{});
