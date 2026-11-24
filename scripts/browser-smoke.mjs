import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.webmanifest':'application/manifest+json','.svg':'image/svg+xml','.png':'image/png'};
const server=http.createServer((req,res)=>{
  const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
  const relative=pathname.replace(/^\/+/,'')||'index.html';
  const file=path.resolve(root,relative);
  if(!file.startsWith(root+path.sep)&&file!==root){res.writeHead(403);return res.end('Forbidden');}
  fs.stat(file,(err,stat)=>{
    if(err||!stat.isFile()){res.writeHead(404);return res.end('Not found');}
    res.writeHead(200,{'Content-Type':mime[path.extname(file)]||'application/octet-stream','Cache-Control':'no-store'});
    fs.createReadStream(file).pipe(res);
  });
});
await new Promise(resolve=>server.listen(4173,'127.0.0.1',resolve));
let browser;
try{
  browser=await chromium.launch({headless:true});
  const context=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:2});
  const page=await context.newPage();
  const pageErrors=[];
  page.on('pageerror',e=>pageErrors.push(e.message));
  await page.goto('http://127.0.0.1:4173/index.html',{waitUntil:'domcontentloaded'});
  await page.locator('#email').waitFor({state:'visible',timeout:15000});
  await page.locator('#password').waitFor({state:'visible'});
  if(await page.title()!=='Mizan') throw new Error('Login page title did not load');
  const iconLink=await page.locator('link[rel="apple-touch-icon"]').getAttribute('href');
  const iconResponse=await page.request.get('http://127.0.0.1:4173/'+iconLink.replace(/^\.\//,''));
  if(!iconResponse.ok()) throw new Error('Apple touch icon is not reachable');
  const manifestLink=await page.locator('link[rel="manifest"]').getAttribute('href');
  const manifestResponse=await page.request.get('http://127.0.0.1:4173/'+manifestLink.replace(/^\.\//,''));
  if(!manifestResponse.ok()) throw new Error('PWA manifest is not reachable');
  const manifest=await manifestResponse.json();
  if(manifest.display!=='standalone'||!manifest.icons?.length) throw new Error('PWA manifest is incomplete');
  const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>window.innerWidth);
  if(overflow) throw new Error('Horizontal overflow on 390px mobile viewport');
  await page.locator('#toggle-password').click();
  if(await page.locator('#password').getAttribute('type')!=='text') throw new Error('Password reveal control failed');
  await page.locator('#toggle-password').click();
  if(await page.locator('#password').getAttribute('type')!=='password') throw new Error('Password hide control failed');
  await page.locator('#forgot').click();
  if(!(await page.locator('#heading').textContent()).includes('بازیابی')) throw new Error('Password recovery mode did not open');
  await page.locator('#submit').waitFor({state:'visible'});
  await page.evaluate(async()=>{await navigator.serviceWorker.ready;});
  await page.reload({waitUntil:'domcontentloaded'});
  await page.locator('#email').waitFor({state:'visible',timeout:15000});
  const controlled=await page.evaluate(()=>!!navigator.serviceWorker.controller);
  if(!controlled) throw new Error('Service worker did not take control after reload');
  const cacheState=await page.evaluate(async()=>{
    const names=await caches.keys();let found=false;
    for(const name of names){const c=await caches.open(name);const keys=await c.keys();if(keys.some(k=>k.url.includes('cdn.jsdelivr.net/npm/@supabase/supabase-js')))found=true;}
    return {names,criticalLibraryCached:found};
  });
  if(!cacheState.criticalLibraryCached) throw new Error('Supabase client was not cached for offline startup');
  await context.setOffline(true);
  await page.reload({waitUntil:'domcontentloaded'});
  await page.locator('#email').waitFor({state:'visible',timeout:15000});
  const offlineGate=await page.locator('#gate').isVisible();
  if(!offlineGate) throw new Error('Offline login shell did not render');
  if(pageErrors.length) throw new Error('Browser runtime errors: '+pageErrors.join(' | '));
  console.log(JSON.stringify({result:'passed',viewport:'390x844',manifest:true,appleTouchIcon:true,passwordToggle:true,recoveryMode:true,serviceWorkerControlled:controlled,criticalLibraryCached:cacheState.criticalLibraryCached,offlineShell:true,pageErrors},null,2));
} finally {
  if(browser) await browser.close();
  await new Promise(resolve=>server.close(resolve));
}
