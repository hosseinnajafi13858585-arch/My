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
assert.match(read('index-1.html'),/mizan-enhancements\.js\?v=13/,'Enhancement cache version mismatch');
const appHtml=read('index-1.html');
const dateHelpers=appHtml.match(/function isoToTehranDateTimeInput[\\s\\S]*?(?=function openReminderForm)/)?.[0];
assert.ok(dateHelpers,'Tehran datetime helpers are missing');
const dateTest=new Function(dateHelpers+"return {iso:tehranDateTimeInputToISO('2026-11-25T09:30'),local:isoToTehranDateTimeInput('2026-11-25T06:00:00.000Z')};")();
assert.equal(dateTest.iso,'2026-11-25T06:00:00.000Z');
assert.equal(dateTest.local,'2026-11-25T09:30');
assert.match(read('mizan-enhancements.js'),/toLocaleDateString\\('fa-IR-u-ca-persian',\\{timeZone:'Asia\\/Tehran'\\}\\)/,'Document dates must use Tehran timezone');
assert.doesNotMatch(['index.html','index-1.html','mizan-enhancements.js','sw.js'].map(read).join('\n'),/sb_secret_[A-Za-z0-9_-]+|service_role/i,'Privileged Supabase secret detected in public client code');
console.log('PWA manifest, install hooks, offline auth guard, precache assets, and public-key safety checks passed.');
