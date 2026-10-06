const CACHE_NAME="tq-pwa-runtime-20261006-halloween-10-mission-gate-v1";
const CACHE_PREFIX="tq-pwa-runtime-";
const CORE_URLS=[
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./src/pwa-entry.js",
  "./src/runtime/PwaGate.js",
  "./src/game.js",
  "./src/styles/app.css",
  "./src/styles/world-test.css"
];

self.addEventListener("install",event=>{
  event.waitUntil((async()=>{
    const cache=await caches.open(CACHE_NAME);
    await Promise.allSettled(CORE_URLS.map(async url=>{
      try{
        const response=await fetch(url,{cache:"no-store"});
        if(response.ok)await cache.put(url,response.clone());
      }catch{}
    }));
    await self.skipWaiting();
  })());
});

self.addEventListener("activate",event=>{
  event.waitUntil((async()=>{
    const names=await caches.keys();
    await Promise.all(names
      .filter(name=>name.startsWith(CACHE_PREFIX)&&name!==CACHE_NAME)
      .map(name=>caches.delete(name)));
    await self.clients.claim();
  })());
});

self.addEventListener("message",event=>{
  if(event.data?.type==="SKIP_WAITING")self.skipWaiting();
});

self.addEventListener("fetch",event=>{
  const request=event.request;
  if(request.method!=="GET")return;
  const url=new URL(request.url);
  if(url.origin!==self.location.origin)return;

  event.respondWith((async()=>{
    const cache=await caches.open(CACHE_NAME);
    try{
      const response=await fetch(request,{cache:"no-store"});
      if(response.ok&&response.type==="basic"){
        cache.put(request,response.clone()).catch(()=>{});
      }
      return response;
    }catch{
      const cached=await cache.match(request,{ignoreSearch:true});
      if(cached)return cached;
      if(request.mode==="navigate"){
        return (await cache.match("./index.html"))||(await cache.match("./"));
      }
      throw new Error("Offline and resource is not cached");
    }
  })());
});
