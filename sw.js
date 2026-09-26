/* DBD Base 2.0 FINAL — stale cache retirement. */
self.addEventListener('install',event=>event.waitUntil(self.skipWaiting()));
self.addEventListener('activate',event=>event.waitUntil((async()=>{try{const keys=await caches.keys();await Promise.all(keys.filter(k=>String(k).startsWith('dbd-')).map(k=>caches.delete(k)));await self.clients.claim();await self.registration.unregister();}catch(e){}})()));
self.addEventListener('fetch',()=>{});
