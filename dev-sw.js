const CACHE_NAME="tq-dev-assets-v1";

self.addEventListener("install",event=>{
  self.skipWaiting();
});

self.addEventListener("activate",event=>{
  event.waitUntil((async()=>{
    const keys=await caches.keys();
    await Promise.all(keys
      .filter(key=>key.startsWith("tq-dev-assets-")&&key!==CACHE_NAME)
      .map(key=>caches.delete(key)));
    await self.clients.claim();
  })());
});

self.addEventListener("fetch",event=>{
  const request=event.request;
  if(request.method!=="GET")return;
  const url=new URL(request.url);
  if(url.origin!==self.location.origin)return;

  const scopePath=new URL(self.registration.scope).pathname;
  const assetsPath=scopePath.replace(/\/?$/,"/")+"assets/";
  if(!url.pathname.startsWith(assetsPath))return;

  event.respondWith((async()=>{
    const cache=await caches.open(CACHE_NAME);
    const cached=await cache.match(request,{ignoreSearch:true});
    if(cached)return cached;

    const response=await fetch(request);
    if(response.ok)await cache.put(request,response.clone());
    return response;
  })());
});
