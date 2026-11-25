'use strict';
const SHELL_CACHE='mizan-shell-v34';
const RUNTIME_CACHE='mizan-runtime-v34';
const SHELL_FILES=[
  './index.html',
  './index-1.html',
  './mizan-enhancements.js?v=19',
  './manifest.webmanifest',
  './icon.svg',
  './apple-touch-icon.png'
];
const CDN_HOSTS=new Set(['cdn.jsdelivr.net','fonts.googleapis.com','fonts.gstatic.com']);
const CRITICAL_CDN_FILES=['https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2'];
self.addEventListener('install',event=>{
  event.waitUntil(Promise.all([
    caches.open(SHELL_CACHE).then(cache=>cache.addAll(SHELL_FILES)),
    caches.open(RUNTIME_CACHE).then(cache=>Promise.all(CRITICAL_CDN_FILES.map(url=>cache.add(url).catch(error=>{console.warn('Critical offline library cache failed',url,error);return null;}))))
  ]).then(()=>self.skipWaiting()));
});
self.addEventListener('activate',event=>{
  event.waitUntil(
    caches.keys()
      .then(keys=>Promise.all(keys.filter(key=>key.startsWith('mizan-shell-')||key.startsWith('mizan-runtime-')).filter(key=>key!==SHELL_CACHE&&key!==RUNTIME_CACHE).map(key=>caches.delete(key))))
      .then(()=>self.clients.claim())
  );
});
async function cacheResponse(cacheName,request,response){
  if(response&&response.ok&&(response.type==='basic'||response.type==='cors'||response.type==='opaque')){
    const cache=await caches.open(cacheName);
    await cache.put(request,response.clone());
  }
  return response;
}
self.addEventListener('fetch',event=>{
  const request=event.request;
  if(request.method!=='GET')return;
  const url=new URL(request.url);
  const sameOrigin=url.origin===self.location.origin;
  const approvedCdn=CDN_HOSTS.has(url.hostname);
  if(!sameOrigin&&!approvedCdn)return;
  if(url.hostname.endsWith('supabase.co')||url.pathname.includes('/auth/v1/')||url.pathname.includes('/rest/v1/'))return;
  if(request.mode==='navigate'&&sameOrigin){
    event.respondWith((async()=>{
      try{
        const response=await fetch(request);
        if(response&&response.ok)await cacheResponse(SHELL_CACHE,request,response);
        return response;
      }catch(error){
        const exact=await caches.match(request);
        if(exact)return exact;
        const path=url.pathname.endsWith('/index-1.html')?'./index-1.html':'./index.html';
        return (await caches.match(path))||Response.error();
      }
    })());
    return;
  }
  event.respondWith((async()=>{
    const cacheName=sameOrigin?SHELL_CACHE:RUNTIME_CACHE;
    const cached=await caches.match(request);
    if(cached){
      if(approvedCdn){
        fetch(request).then(response=>cacheResponse(RUNTIME_CACHE,request,response)).catch(()=>{});
      }
      return cached;
    }
    try{
      const response=await fetch(request);
      return await cacheResponse(cacheName,request,response);
    }catch(error){
      return cached||Response.error();
    }
  })());
});
self.addEventListener('message',event=>{
  if(event.data&&event.data.type==='SKIP_WAITING')self.skipWaiting();
});
