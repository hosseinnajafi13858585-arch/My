import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const read = (p) => fs.readFileSync(new URL('../' + p, import.meta.url), 'utf8');
const files = ['index.html','index-1.html','mizan-enhancements.js','sw.js','manifest.webmanifest','icon.svg','apple-touch-icon.png'];
for (const p of files) assert.ok(fs.existsSync(new URL('../' + p, import.meta.url)), 'Missing required file: ' + p);
for (const p of ['mizan-enhancements.js','sw.js']) new vm.Script(read(p), { filename: p });
for (const p of ['index.html','index-1.html']) {
  const html = read(p);
  const scripts = [...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script\s*>/gi)];
  let count = 0;
  for (let i=0; i<scripts.length; i++) {
    const attrs=scripts[i][1]||'', body=scripts[i][2]||'';
    if (/\bsrc\s*=/.test(attrs) || !body.trim() || /type\s*=\s*["']application\/json["']/i.test(attrs)) continue;
    new vm.Script(body, { filename: p + ':inline-' + (i+1) });
    count++;
  }
  assert.ok(count > 0, 'No inline scripts validated in ' + p);
  const staticMarkup=html.replace(/<script\b[^>]*>[\s\S]*?<\/script\s*>/gi,'').replace(/<style\b[^>]*>[\s\S]*?<\/style\s*>/gi,'');
  const ids=[...staticMarkup.matchAll(/\bid=["']([^"']+)["']/g)].map(m=>m[1]);
  const duplicates=ids.filter((id,i)=>ids.indexOf(id)!==i);
  assert.deepEqual([...new Set(duplicates)], [], 'Duplicate static HTML ids in ' + p);
  for (const m of staticMarkup.matchAll(/(?:src|href)=["'](\.\/[^"'?#]+)(?:\?[^"']*)?["']/g)) {
    const local=m[1].replace(/^\.\//,'');
    assert.ok(fs.existsSync(new URL('../'+local,import.meta.url)), p+' references missing local asset '+local);
  }
  console.log(p+': '+count+' inline scripts; static IDs and local assets OK');
}
const manifest=JSON.parse(read('manifest.webmanifest'));
assert.equal(manifest.display,'standalone');
assert.ok(manifest.start_url && manifest.scope && manifest.icons?.length);
assert.ok(manifest.icons.some(icon=>String(icon.sizes).includes('192x192')),'192px install icon missing');
assert.ok(manifest.icons.some(icon=>String(icon.sizes).includes('512x512')),'512px install icon missing');
const appleIcon=fs.readFileSync(new URL('../apple-touch-icon.png',import.meta.url));
assert.deepEqual([...appleIcon.subarray(0,8)],[137,80,78,71,13,10,26,10],'Apple touch icon is not a valid PNG');
assert.equal(appleIcon.readUInt32BE(16),180,'Apple touch icon width must be 180px');
assert.equal(appleIcon.readUInt32BE(20),180,'Apple touch icon height must be 180px');
for (const icon of manifest.icons) if (icon.src.startsWith('./')) assert.ok(fs.existsSync(new URL('../'+icon.src.slice(2),import.meta.url)), 'Missing manifest icon '+icon.src);
const sw=read('sw.js');
const shell=sw.match(/const SHELL_FILES=\[([\s\S]*?)\];/);
assert.ok(shell,'Service worker shell list missing');
for (const item of [...shell[1].matchAll(/'([^']+)'/g)].map(m=>m[1])) {
  const path=item.split('?')[0].replace(/^\.\//,'');
  assert.ok(fs.existsSync(new URL('../'+path,import.meta.url)), 'Service worker precache file missing: '+path);
}
assert.match(sw,/supabase\.co/,'Service worker must never cache Supabase API/auth responses');
assert.match(sw,/CRITICAL_CDN_FILES=.*supabase-js/,'Critical Supabase client must be precached for offline startup');
assert.match(read('index.html'),/mizan-cloud-snapshot-/,'Offline snapshot key missing');
assert.match(read('index.html'),/auth\.getSession\(\)/,'Offline entry must require an existing Supabase session');
assert.match(read('index.html'),/beforeinstallprompt/,'Android install prompt handler missing');
assert.match(read('index.html'),/apple-mobile-web-app-capable/,'iOS web app metadata missing');
assert.match(read('index-1.html'),/mizan-premium-motion-v1/,'App motion layer missing');
assert.match(read('index-1.html'),/mizan-enhancements\.js\?v=22/,'Enhancement cache version mismatch');
const appHtml=read('index-1.html');
assert.match(appHtml,/function syncParentModalLayer\(open\)/,'Modal layer synchronization missing');
assert.match(appHtml,/syncParentModalLayer\(true\)/,'Opening a modal must suppress floating navigation');
assert.match(appHtml,/syncParentModalLayer\(false\)/,'Closing a modal must restore floating navigation');
const dateHelpers=appHtml.match(/function isoToTehranDateTimeInput[\s\S]*?(?=function openReminderForm)/)?.[0];
assert.ok(dateHelpers,'Tehran datetime helpers are missing');
const dateTest=new Function(dateHelpers+"return {iso:tehranDateTimeInputToISO('2026-11-25T09:30'),local:isoToTehranDateTimeInput('2026-11-25T06:00:00.000Z')};")();
assert.equal(dateTest.iso,'2026-11-25T06:00:00.000Z');
assert.equal(dateTest.local,'2026-11-25T09:30');
assert.match(read('mizan-enhancements.js'),/toLocaleDateString\('fa-IR-u-ca-persian',\{timeZone:'Asia\/Tehran'\}\)/,'Document dates must use Tehran timezone');
assert.match(appHtml,/table==='personal_debt'\?'updated_at':'created_at'/,'Personal debt queries must sort by the existing updated_at column');
assert.match(appHtml,/payload\.updated_at=new Date\(\)\.toISOString\(\)/,'Personal debt updates must refresh updated_at');
assert.match(appHtml,/parentPatch\.updated_at=new Date\(\)\.toISOString\(\)/,'Debt payments must refresh updated_at');
const enhancementHtml=read('mizan-enhancements.js');
assert.match(appHtml,/function scheduleRowsHtml\(count,total,firstDate\)/,'Custom installment schedule generator missing');
assert.match(appHtml,/fip-amount-/,'Per-installment amount input missing');
assert.match(appHtml,/fip-due-/,'Per-installment Jalali due date input missing');
assert.match(appHtml,/syncInstallmentReminder\(plan,x\)/,'Installment reminder sync missing');
assert.match(appHtml,/Reminders\.add\(payload\)/,'New installment must create an app reminder');
assert.match(appHtml,/requestInstallmentNotificationPermission/,'Installment notification permission flow missing');
assert.match(appHtml,/checkInstallmentNotifications/,'Installment notification scheduler missing');
assert.match(appHtml,/جمع اقساط/,'Installment total display missing');
assert.match(enhancementHtml,/function normalizeMarketPayload\(payload\)/,'Market payload normalizer missing');
assert.match(enhancementHtml,/USD_IRR_FREE/,'Market feed must map USD symbol');
assert.match(enhancementHtml,/EUR_IRR_FREE/,'Market feed must map EUR symbol');
assert.match(enhancementHtml,/GOLD_18K_IRR/,'Market feed must map 18K gold symbol');
assert.match(enhancementHtml,/COIN_EMAMI_IRR/,'Market feed must map Emami coin symbol');
assert.match(enhancementHtml,/USDT_IRR/,'Market feed must map Tether symbol');
assert.match(enhancementHtml,/raw\.githubusercontent\.com\/iran-market/,'Market must use the public JSON feed');
assert.match(enhancementHtml,/mizan-market-cache-v2/,'Market offline cache missing');
assert.doesNotMatch(enhancementHtml,/منبع رایگان/,'Market UI must not display the phrase منبع رایگان');
const marketHelpers=enhancementHtml.match(/function normalizeMarketPayload\(payload\)[\s\S]*?(?=async function saveMarketHistory)/)?.[0];
assert.ok(marketHelpers,'Market normalization helper extraction failed');
const marketFixture={meta:{published_at:'2026-11-25T08:00:00.000Z'},data:[
  {symbol:'USD_IRR_FREE',name_fa:'دلار',currency:'IRR',price:2584650,change_pct:1,timestamp_tehran:'2026-11-25T11:30:00+03:30',source:'tgju'},
  {symbol:'EUR_IRR_FREE',name_fa:'یورو',currency:'IRT',price:300000,change_pct:0.2,timestamp_tehran:'2026-11-25T11:30:00+03:30',source:'tgju'},
  {symbol:'GOLD_18K_IRR',name_fa:'طلای ۱۸',currency:'IRT',price:26500000,change_pct:-0.5,timestamp_tehran:'2026-11-25T11:30:00+03:30',source:'tgju'},
  {symbol:'COIN_EMAMI_IRR',name_fa:'سکه امامی',currency:'IRT',price:290000000,change_pct:0,timestamp_tehran:'2026-11-25T11:30:00+03:30',source:'tgju'},
  {symbol:'USDT_IRR',name_fa:'تتر',currency:'IRT',price:260000,change_pct:null,timestamp_tehran:'2026-11-25T11:30:00+03:30',source:'nobitex'}
]};
const normalized=new Function(marketHelpers+'return normalizeMarketPayload('+JSON.stringify(marketFixture)+');')();
assert.equal(normalized.length,5);
assert.equal(normalized[0].id,'USD_IRR_FREE');
assert.equal(normalized[0].price,258465);
assert.equal(normalized[0].currency,'IRT');
assert.equal(normalized[2].price,26500000);
const enhancementHelpers=enhancementHtml.match(/function tehranDateTimeParts[\s\S]*?(?=function getClient)/)?.[0];
assert.ok(enhancementHelpers,'Cloud reminder timezone helpers are missing');
const enhancementDateTest=new Function(enhancementHelpers+"return {iso:tehranDateTimeToISO('2026-11-26','09:30'),parts:tehranDateTimeParts('2026-11-26T06:00:00.000Z'),weekly:shiftGregorianDate('2026-11-26','weekly'),monthly:shiftGregorianDate('2026-01-31','monthly'),yearly:shiftGregorianDate('2024-02-29','yearly')};")();
assert.equal(enhancementDateTest.iso,'2026-11-26T06:00:00.000Z');
assert.equal(enhancementDateTest.parts.hour,'09');
assert.equal(enhancementDateTest.parts.minute,'30');
assert.equal(enhancementDateTest.weekly,'2026-12-03');
assert.equal(enhancementDateTest.monthly,'2026-02-28');
assert.equal(enhancementDateTest.yearly,'2025-02-28');
assert.match(enhancementHtml,/formatTehranTime\(x\.due_at\)/,'Cloud reminder display must use Tehran time');
assert.doesNotMatch(enhancementHtml,/new Date\(iso \+ 'T' \+ time/,'Cloud reminder must not parse Tehran time in device timezone');
assert.doesNotMatch(['index.html','index-1.html','mizan-enhancements.js','sw.js'].map(read).join('\n'),/sb_secret_[A-Za-z0-9_-]+|service_role/i,'Privileged Supabase secret detected in public client code');
console.log('PWA manifest, install hooks, offline auth guard, precache assets, and public-key safety checks passed.');
