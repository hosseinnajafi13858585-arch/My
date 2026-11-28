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
  const cloudMergeChecks=await page.evaluate(()=>{
    const merge=window.MizanMergeStartupKeys;
    const eq=(a,b)=>{const sort=o=>Object.fromEntries(Object.keys(o).sort().map(k=>[k,o[k]]));return JSON.stringify(sort(a))===JSON.stringify(sort(b));};
    const localWins=merge({a:'base-a',b:'base-b',c:'remote-c'},{a:'offline-a'},{a:'base-a',b:'base-b'},true);
    const remoteWinsUnchanged=merge({a:'remote-a',c:'remote-c'},{a:'base-a',b:'offline-b'},{a:'base-a'},true);
    const missingRemoteRow=merge({}, {a:'base-a',b:'base-b'}, {a:'base-a',b:'base-b'}, false);
    const noSnapshot=merge({a:'remote-a'},{a:'legacy-a',b:'legacy-b'},null,true);
    const emptyLocalExisting=merge({a:'remote-a'}, {}, {a:'base-a'}, true);
    const emptyLocalMissing=merge({}, {}, {a:'base-a'}, false);
    return{localEditsAndDeletions:eq(localWins,{a:'offline-a',c:'remote-c'}),remoteUnchangedKeysPreserved:eq(remoteWinsUnchanged,{a:'remote-a',b:'offline-b',c:'remote-c'}),missingRemoteRestoresSnapshot:eq(missingRemoteRow,{a:'base-a',b:'base-b'}),noSnapshotLegacyMerge:eq(noSnapshot,{a:'remote-a',b:'legacy-b'}),emptyLocalDoesNotDeleteRemote:eq(emptyLocalExisting,{a:'remote-a'}),emptyLocalMissingRowRestoresSnapshot:eq(emptyLocalMissing,{a:'base-a'})};
  });
  if(Object.values(cloudMergeChecks).some(value=>!value))throw new Error('Offline/cloud merge regression: '+JSON.stringify(cloudMergeChecks));
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
  const motionName=await page.locator('.panel').evaluate(el=>getComputedStyle(el).animationName);
  if(motionName!=='mznLoginIn') throw new Error('Login motion layer did not activate');
  await page.evaluate(()=>{
    const event=new Event('beforeinstallprompt',{cancelable:true});
    event.preventDefault=()=>{};
    event.prompt=async()=>{window.__mizanInstallPrompted=true;};
    event.userChoice=Promise.resolve({outcome:'accepted'});
    window.dispatchEvent(event);
  });
  if(!(await page.locator('#install-app').isVisible())) throw new Error('Android install affordance did not appear');
  await page.locator('#install-app').click();
  await page.waitForFunction(()=>window.__mizanInstallPrompted===true);
  const iosContext=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,userAgent:'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'});
  const iosPage=await iosContext.newPage();
  await iosPage.goto('http://127.0.0.1:4173/index.html',{waitUntil:'domcontentloaded'});
  await iosPage.locator('#install-app').waitFor({state:'visible',timeout:10000});
  let iosInstallMessage='';
  iosPage.on('dialog',async dialog=>{iosInstallMessage=dialog.message();await dialog.dismiss();});
  await iosPage.locator('#install-app').click();
  if(!iosInstallMessage.includes('Add to Home Screen')) throw new Error('iOS Add to Home Screen instructions did not appear');
  await iosContext.close();
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
  if(!offlineGate) throw new Error('Offline unauthenticated visit should stay on the login gate');
  await page.evaluate(()=>{
    const uid='00000000-0000-4000-8000-000000000001';
    const now=Math.floor(Date.now()/1000);
    const session={access_token:'eyJhbGciOiJub25lIn0.eyJleHAiOjQxMDAwMDAwMDB9.',token_type:'bearer',expires_in:86400,expires_at:now+86400,refresh_token:'offline-smoke-test-token',user:{id:uid,aud:'authenticated',role:'authenticated',email:'offline-smoke@example.invalid',app_metadata:{provider:'email',providers:['email']},user_metadata:{username:'owner',full_name:'آزمایش'},created_at:new Date().toISOString()}};
    localStorage.setItem('sb-jrhihuaswonlcdkhoabf-auth-token',JSON.stringify(session));
  });
  await page.reload({waitUntil:'domcontentloaded'});
  await page.locator('#email').waitFor({state:'visible',timeout:15000});
  if(!(await page.locator('#gate').isVisible()))throw new Error('Offline session without a local snapshot must not unlock the app');
  await page.evaluate(()=>{
    const uid='00000000-0000-4000-8000-000000000001';
    localStorage.setItem('mizan-cloud-snapshot-'+uid,JSON.stringify({schema:1,ownerUsername:'owner',keys:{}}));
  });
  await page.reload({waitUntil:'domcontentloaded'});
  await page.locator('#workspace').waitFor({state:'visible',timeout:20000});
  const gateAfterSession=await page.locator('#gate').isVisible();
  if(gateAfterSession) throw new Error('Offline authenticated session unexpectedly returned to login gate');
  const appFrame=page.frameLocator('#appframe');
  await appFrame.locator('#page-content').waitFor({state:'attached',timeout:20000});
  await appFrame.locator('#app').waitFor({state:'visible',timeout:20000});
  const offlineAppText=await appFrame.locator('#app').innerText();
  if(!offlineAppText.trim()) throw new Error('Authenticated offline app shell did not render');
  const modalGuardInstalled=await appFrame.locator('#app').evaluate(()=>window.__mizanModalLayerSyncInstalled===true);
  if(!modalGuardInstalled)throw new Error('Modal layer synchronization did not initialize');
  const appOverflow=await appFrame.locator('html').evaluate(el=>el.scrollWidth>window.innerWidth);
  if(appOverflow)throw new Error('Horizontal overflow in the authenticated app at iPhone width');
  const visibleButtons=await appFrame.locator('#app button').count();
  if(visibleButtons<5)throw new Error('Core dashboard controls did not render');
  const pageSections=await appFrame.locator('#page-content > *').count();
  if(pageSections<1) throw new Error('Offline dashboard content did not render');
  const routes=['today','months','month-detail','reminders','records','finance','achievements','settings','users','audit','dashboard','market','documents','assistant','reminders-db','calendar','more'];
  for(const route of routes){
    await appFrame.locator('#app').evaluate((el,name)=>window.App.navigate(name),route);
    const sectionCount=await appFrame.locator('#page-content').evaluate(el=>el.children.length);
    if(sectionCount<1)throw new Error('App route did not render: '+route);
    const routeText=await appFrame.locator('#page-content').innerText();
    if(routeText.includes('خطا در بارگذاری صفحه'))throw new Error('App route threw a render error: '+route);
    const mobileRouteOverflow=await appFrame.locator('html').evaluate(el=>el.scrollWidth>el.clientWidth+1);
    if(mobileRouteOverflow)throw new Error('Horizontal overflow on mobile route: '+route);
  }
  await appFrame.locator('#app').evaluate(()=>window.App.navigate('today'));
  const monthFixture=await appFrame.locator('#app').evaluate(()=>{
    const year=1405,mi=8,month=mi+1,key=Store.mkey(year,mi),previous=localStorage.getItem(key);window.__mznMonthFixture={key,previous};
    const early=Jalali.fmt(year,month,1),late=Jalali.fmt(year,month,2),data=Store.blank();
    function pair(extra){return [{date:late,amount:200,notes:'late',hours:8,startTime:'10:00',endTime:'18:00',type:'full',reason:'late',...extra},{date:early,amount:100,notes:'early',hours:7,startTime:'09:00',endTime:'16:00',type:'full',reason:'early',...extra}];}
    data.hours=pair();data.websiteSales=pair();data.storeSales=pair();data.leaves=pair();data.expenses=pair();data.deductions=pair();data.benefits=pair();
    const saved=Store.saveMonth(year,mi,data);
    window.__mznSettleListenerReady=false;window.__mznNativeAddEventListener=EventTarget.prototype.addEventListener;EventTarget.prototype.addEventListener=function(type,listener,options){if(this&&this.id==='md-settle'&&type==='click')window.__mznSettleListenerReady=true;return window.__mznNativeAddEventListener.call(this,type,listener,options);};
    App.openMonth(year,mi);
    return{year,mi,key,previous,early,late,earlyLabel:Fmt.fullDate(early),lateLabel:Fmt.fullDate(late),saved};
  });
  if(!monthFixture.saved)throw new Error('Could not seed isolated monthly date-order fixture');
  await appFrame.locator('#md-settle').waitFor({state:'visible',timeout:10000});
  await appFrame.locator('#app').evaluate(()=>new Promise(resolve=>{var started=Date.now();function poll(){if(window.__mznSettleListenerReady||Date.now()-started>5000){EventTarget.prototype.addEventListener=window.__mznNativeAddEventListener;delete window.__mznNativeAddEventListener;resolve();}else setTimeout(poll,10);}poll();}));
  const settleListenerReady=await appFrame.locator('#app').evaluate(()=>window.__mznSettleListenerReady===true);
  if(!settleListenerReady)throw new Error('Month settlement button click handler was not attached');
  const monthOrder=await appFrame.locator('#app').evaluate(()=>{
    const tables=[...document.querySelectorAll('#page-content table.dt')];
    return{tables:tables.length,rows:tables.map(table=>[...table.querySelectorAll('tbody tr')].map(row=>row.cells[0]?.textContent?.trim()||'')),editIndices:tables.map(table=>table.querySelector('tbody tr:first-child button.ed')?.getAttribute('data-ei')||null)};
  });
  if(monthOrder.tables!==7||monthOrder.rows.some(rows=>rows.length!==2)||monthOrder.rows.some(rows=>rows[0]!==monthFixture.earlyLabel||rows[1]!==monthFixture.lateLabel)||monthOrder.editIndices.some(index=>index!=='1'))throw new Error('Monthly records are not date-sorted or original edit indices were not preserved: '+JSON.stringify(monthOrder));
  const quotaSafety=await appFrame.locator('#app').evaluate(()=>{
    const year=1405,mi=8,key=Store.mkey(year,mi),before=localStorage.getItem(key),originalSet=Storage.prototype.setItem,originalRemove=Storage.prototype.removeItem;
    let saveResult,settleResult,deleteResult;
    Storage.prototype.setItem=function(k,v){if(k===key)throw new DOMException('Quota exceeded','QuotaExceededError');return originalSet.call(this,k,v);};
    try{saveResult=Store.saveMonth(year,mi,Object.assign(Store.loadMonth(year,mi),{fixedSalary:999999999}));settleResult=Store.settleMonth(year,mi);}finally{Storage.prototype.setItem=originalSet;}
    Storage.prototype.removeItem=function(k){if(k===key)throw new DOMException('Storage unavailable','QuotaExceededError');return originalRemove.call(this,k);};
    try{deleteResult=Store.deleteMonth(year,mi);}finally{Storage.prototype.removeItem=originalRemove;}
    return{saveRejected:saveResult===false,settlementRejected:settleResult===false,deleteRejected:deleteResult===false,notLocked:!Store.isMonthSettled(year,mi),dataUnchanged:localStorage.getItem(key)===before};
  });
  if(!quotaSafety.saveRejected||!quotaSafety.settlementRejected||!quotaSafety.deleteRejected||!quotaSafety.notLocked||!quotaSafety.dataUnchanged)throw new Error('Storage quota failures were not safely detected: '+JSON.stringify(quotaSafety));
  await appFrame.locator('#app').evaluate(()=>{window.__mznConfirmCalled=false;window.confirm=function(){window.__mznConfirmCalled=true;return true;};});
  await appFrame.locator('#app').evaluate(()=>new Promise(resolve=>setTimeout(resolve,100)));
  await appFrame.locator('#md-settle').click();
  await appFrame.locator('#app').evaluate(()=>new Promise(resolve=>setTimeout(resolve,100)));
  const settlementAction=await appFrame.locator('#app').evaluate(()=>({confirmCalled:window.__mznConfirmCalled===true,locked:Store.isMonthSettled(1405,8),message:document.body.innerText.slice(-350)}));
  if(!settlementAction.confirmCalled||!settlementAction.locked)throw new Error('Month settlement click did not persist the lock: '+JSON.stringify(settlementAction));
  await appFrame.locator('#app').evaluate(()=>window.App.openMonth(1405,8));
  await appFrame.locator('#md-settle').waitFor({state:'detached',timeout:10000});
  const settlement=await appFrame.locator('#app').evaluate(()=>{
    const year=1405,mi=8,locked=Store.isMonthSettled(year,mi),saved=Store.loadMonth(year,mi),stats=Payroll.compute(saved),changed=Object.assign({},saved,{fixedSalary:999999999});
    const toolbars=[...document.querySelectorAll('#page-content .toolbar')].map(el=>({text:el.innerText,buttons:[...el.querySelectorAll('button')].map(b=>({id:b.id,text:b.innerText,rects:b.getClientRects().length}))})),addButtons=[...document.querySelectorAll('#page-content button[id^="add-"]')].map(b=>({id:b.id,text:b.innerText,rects:b.getClientRects().length,display:getComputedStyle(b).display,visibility:getComputedStyle(b).visibility}));return{locked,saveBlocked:Store.saveMonth(year,mi,changed)===false,deleteBlocked:Store.deleteMonth(year,mi)===false,snapshotNet:stats.netSalary,toolbarHidden:!addButtons.some(b=>b.rects>0)&&!toolbars.some(t=>t.buttons.some(b=>b.rects>0)),toolbarDebug:toolbars,addButtonDebug:addButtons,editHidden:!document.querySelector('table.dt button.ed'),settleHidden:!document.getElementById('md-settle')};
  });
  if(!settlement.locked||!settlement.saveBlocked||!settlement.deleteBlocked||!settlement.toolbarHidden||!settlement.editHidden||!settlement.settleHidden)throw new Error('Month settlement lock failed: '+JSON.stringify(settlement));
  await appFrame.locator('#app').evaluate(()=>{const f=window.__mznMonthFixture;if(f){if(f.previous===null)localStorage.removeItem(f.key);else localStorage.setItem(f.key,f.previous);delete window.__mznMonthFixture;}window.App.navigate('today');});
  const marketFixture={meta:{unit:'toman',stale:false,updated_at:'2026-11-25T08:00:00.000Z'},data:[
    {symbol:'USD_IRR_FREE',name_fa:'دلار آمریکا',currency:'IRT',price:285000,change_pct:1,timestamp:'2026-11-25T08:00:00.000Z',timestamp_tehran:'2026-11-25T11:30:00+03:30',source:'tgju'},
    {symbol:'EUR_IRR_FREE',name_fa:'یورو',currency:'IRT',price:313000,change_pct:.5,timestamp:'2026-11-25T08:00:00.000Z',timestamp_tehran:'2026-11-25T11:30:00+03:30',source:'tgju'},
    {symbol:'GBP_IRR_FREE',name_fa:'پوند انگلیس',currency:'IRT',price:374000,change_pct:.4,timestamp:'2026-11-25T08:00:00.000Z',timestamp_tehran:'2026-11-25T11:30:00+03:30',source:'tgju'},
    {symbol:'GOLD_18K_IRR',name_fa:'طلای ۱۸ عیار',currency:'IRT',price:25200000,change_pct:-.5,timestamp:'2026-11-25T08:00:00.000Z',timestamp_tehran:'2026-11-25T11:30:00+03:30',source:'tgju'},
    {symbol:'COIN_EMAMI_IRR',name_fa:'سکه امامی',currency:'IRT',price:264000000,change_pct:.7,timestamp:'2026-11-25T08:00:00.000Z',timestamp_tehran:'2026-11-25T11:30:00+03:30',source:'tgju'},
    {symbol:'USDT_IRR',name_fa:'تتر',currency:'IRT',price:291000,change_pct:1.8,timestamp:'2026-11-25T08:00:00.000Z',timestamp_tehran:'2026-11-25T11:30:00+03:30',source:'nobitex'}
  ]};
  const marketResponse={status:200,contentType:'application/json',body:JSON.stringify(marketFixture)};
  await page.route('https://raw.githubusercontent.com/iran-market/iran-market.github.io/main/data/popular.json',route=>route.fulfill(marketResponse));
  await page.route('https://cdn.jsdelivr.net/gh/iran-market/iran-market.github.io@main/data/popular.json',route=>route.fulfill(marketResponse));
  await appFrame.locator('#app').evaluate(()=>window.App.navigate('market'));
  await appFrame.locator('.mzn-market-status').waitFor({state:'visible',timeout:10000});
  await appFrame.locator('.mzn-market-card').first().waitFor({state:'visible',timeout:10000}).catch(()=>{});
  const marketState=await appFrame.locator('.mzn-market').evaluate(el=>({cards:el.querySelectorAll('.mzn-market-card').length,status:(el.querySelector('#mzn-market-status')||{}).textContent||'',text:el.innerText.slice(0,900)}));
  if(marketState.cards!==6)throw new Error('Market feed did not render six fixture symbols: '+JSON.stringify(marketState));
  const marketText=await appFrame.locator('.mzn-market').innerText();
  if(!marketText.includes('طلای ۱۸ عیار')||!marketText.includes('سکه امامی')||!marketText.includes('تتر'))throw new Error('Market symbols did not render correctly');
  if(marketText.includes('منبع رایگان'))throw new Error('Market page still exposes the forbidden source label');
  await appFrame.locator('#app').evaluate(()=>window.App.navigate('achievements'));
  await appFrame.locator('#app').evaluate(()=>new Promise(resolve=>setTimeout(resolve,80)));
  await appFrame.locator('#add-goal').click();
  await appFrame.locator('#app').evaluate(()=>new Promise(resolve=>setTimeout(resolve,80)));
  const navState=await appFrame.locator('#app').evaluate(()=>{
    const nav=window.parent.document.querySelector('.global-nav');
    return {guard:window.__mizanModalGuardInstalled,modal:!!document.querySelector('.modal-back'),iframeBody:document.body.className,parentBody:window.parent.document.body.className,navFound:!!nav,navPointer:nav?window.parent.getComputedStyle(nav).pointerEvents:'missing',modalApi:!!window.Modal,modalApiGuard:!!(window.Modal&&window.Modal.__mizanGuardInstalled)};
  });
  const navSuppressed=!!navState.navFound&&navState.iframeBody.includes('mzn-modal-open')&&navState.parentBody.includes('mzn-modal-open')&&navState.navPointer==='none';
  if(!navSuppressed)throw new Error('Floating navigation should hide while a modal is open: '+JSON.stringify(navState));
  await appFrame.locator('#gf-t').fill('تست آفلاین هدف');
  await appFrame.locator('#gf-target').fill('100000');
  await appFrame.locator('#gf-current').fill('25000');
  await appFrame.locator('#gf-sv').click();
  await appFrame.locator('#goal-list').getByText('تست آفلاین هدف').waitFor({state:'visible',timeout:10000});
  const navRestored=await appFrame.locator('#app').evaluate(()=>{const nav=window.parent.document.querySelector('.global-nav');return !!nav&&!document.body.classList.contains('mzn-modal-open')&&!window.parent.document.body.classList.contains('mzn-modal-open')&&window.parent.getComputedStyle(nav).pointerEvents!=='none';});
  if(!navRestored)throw new Error('Floating navigation did not return after modal close');
  await appFrame.locator('#app').evaluate(()=>window.App.navigate('reminders'));
  await appFrame.locator('#app').evaluate(()=>new Promise(resolve=>setTimeout(resolve,80)));
  await appFrame.locator('#add-rem').click();
  await appFrame.locator('#rf-t').fill('تست ساعت تهران');
  await appFrame.locator('#rf-dt').fill('2026-11-26T09:30');
  await appFrame.locator('#rf-sv').click();
  await appFrame.locator('.reminder-item').waitFor({state:'visible',timeout:10000});
  const savedReminder=await appFrame.locator('#app').evaluate(()=>window.Reminders.load().find(x=>x.title==='تست ساعت تهران')?.dateTime||null);
  if(savedReminder!=='2026-11-26T06:00:00.000Z')throw new Error('Reminder time was not saved as Tehran time: '+savedReminder);
  await appFrame.locator('#app').evaluate(()=>window.App.navigate('settings'));
  await appFrame.locator('#stor-body').waitFor({state:'visible'});
  await appFrame.locator('#stor-body').getByText('داده‌های محلی میزان',{exact:true}).waitFor({state:'visible',timeout:10000});
  await appFrame.locator('#stor-ref').click();
  await appFrame.locator('#stor-body').getByText('کش‌های برنامه',{exact:true}).waitFor({state:'visible',timeout:10000});
  await page.locator('.global-nav .nav-tab[data-page="more"]').click();
  const moreActive=await page.locator('.global-nav .nav-tab[data-page="more"]').getAttribute('class');
  if(!moreActive.includes('active'))throw new Error('Floating navigation did not switch pages');
  const themeBefore=await appFrame.locator('#app').evaluate(()=>document.documentElement.getAttribute('data-theme'));
  await appFrame.locator('#tb-theme').click();
  const themeAfter=await appFrame.locator('#app').evaluate(()=>document.documentElement.getAttribute('data-theme'));
  if(themeBefore===themeAfter)throw new Error('Theme toggle did not change the app theme');
  await appFrame.locator('#tb-theme').click();

  await page.setViewportSize({width:1365,height:900});
  const desktopOverflowRoutes=[];
  for(const route of routes){
    await appFrame.locator('#app').evaluate((el,name)=>window.App.navigate(name),route);
    const overflow=await appFrame.locator('html').evaluate(el=>el.scrollWidth>el.clientWidth+1);
    if(overflow)desktopOverflowRoutes.push(route);
  }
  if(desktopOverflowRoutes.length)throw new Error('Horizontal overflow on desktop routes: '+desktopOverflowRoutes.join(', '));
  await page.setViewportSize({width:390,height:844});
  await appFrame.locator('#app').evaluate(()=>window.App.navigate('today'));
  if(pageErrors.length) throw new Error('Browser runtime errors: '+pageErrors.join(' | '));
  console.log(JSON.stringify({result:'passed',viewport:'390x844',desktopViewport:'1365x900',mobileRouteOverflow:false,desktopRouteOverflow:false,manifest:true,appleTouchIcon:true,passwordToggle:true,recoveryMode:true,loginMotion:motionName,androidInstallPrompt:true,iosAddToHomeScreen:true,serviceWorkerControlled:controlled,criticalLibraryCached:cacheState.criticalLibraryCached,offlineUnauthenticatedGate:true,offlineAuthenticatedSession:true,missingSnapshotBlocked:true,authenticatedOfflineDashboard:true,modalGuardInstalled,appOverflow:false,visibleButtons,pageSections,routeCount:routes.length,monthlyDateOrder:true,monthlyEditIndexPreserved:true,monthSettlementLock:true,monthStorageFailureSafety:true,goalCreate:true,reminderTehranTime:true,storageMonitor:true,navInteraction:true,themeToggle:true,pageErrors},null,2));
} finally {
  if(browser) await browser.close();
  await new Promise(resolve=>server.close(resolve));
}
