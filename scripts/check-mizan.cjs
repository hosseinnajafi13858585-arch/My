'use strict';
const fs=require('node:fs');
const vm=require('node:vm');
const html=fs.readFileSync('index-1.html','utf8');
const entryHtml=fs.readFileSync('index.html','utf8');
const ext=fs.readFileSync('mizan-enhancements.js','utf8');
const sw=fs.readFileSync('sw.js','utf8');
const manifest=JSON.parse(fs.readFileSync('manifest.webmanifest','utf8'));
let inlineCount=0;
for(const [file,source] of [['index.html',entryHtml],['index-1.html',html]]){
  for(const match of source.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)){
    const attrs=match[1],code=match[2];
    if(/\bsrc\s*=/.test(attrs))continue;
    const type=(attrs.match(/\btype\s*=\s*["']([^"']+)/i)||[])[1]||'text/javascript';
    if(!/javascript|ecmascript|module/i.test(type)||!code.trim())continue;
    new vm.Script(code,{filename:file+':inline-'+(++inlineCount)});
  }
}
new vm.Script(ext,{filename:'mizan-enhancements.js'});
new vm.Script(sw,{filename:'sw.js'});
if(!html.includes('viewport-fit=cover')||!entryHtml.includes('viewport-fit=cover'))throw Error('Missing mobile viewport');
for(const page of ['compare','behavior','weather'])if(!html.includes("case'"+page+"'")||!ext.includes(page+': render'))throw Error('Missing route '+page);
if(/function renderAssistant|function assistantReply|function forecast\(/.test(ext)||/case'assistant'|پیش‌بینی شفاف پایان ماه/.test(html))throw Error('Removed feature still referenced');
if(!ext.includes('function weatherSeason')||!ext.includes('weatherSeason(d.timezone)'))throw Error('Weather season mapping missing');
const qfn=ext.match(/function dailyQuote\(\)\{([\s\S]*?)\n  \}/);if(!qfn)throw Error('Motivation bank missing');
const starts=qfn[1].match(/var starts=\[([\s\S]*?)\];/),ends=qfn[1].match(/var ends=\[([\s\S]*?)\];/);if(!starts||!ends)throw Error('Motivation lists missing');
const count=(starts[1].match(/,/g)||[]).length+1;const endCount=(ends[1].match(/,/g)||[]).length+1;if(count*endCount<200)throw Error('Motivation bank must contain at least 200 unique combinations');
if(!ext.includes('weatherLastCoords.accuracy')||!ext.includes('navigator.geolocation.watchPosition')||!ext.includes('weatherRefreshTimer=window.setInterval')||!ext.includes('api.bigdatacloud.net/data/reverse-geocode-client'))throw Error('Live GPS weather missing');
if(!ext.includes('api.coingecko.com/api/v3/simple/price')||!ext.includes("if(bitcoin)items.push(bitcoin)"))throw Error('Bitcoin market quote missing');
if(!html.includes('mzn-home-weather-wrap')||!ext.includes('homeWeather.appendChild(weatherCard)'))throw Error('Home weather placement missing');
if(!html.includes('window.__mizanModalGuardInstalled=true')||!html.includes('api.__mizanGuardInstalled=true')||!html.includes('mzn-parent-modal-guard-style')||!html.includes('body.mzn-modal-open .global-nav'))throw Error('Modal navigation guard missing');
if(!entryHtml.includes('mzn-theme-christmas')||!entryHtml.includes('mzn-theme-nowruz'))throw Error('Login seasonal theme missing');
if(!ext.includes('function installSeasonalDecorations()')||!ext.includes('کریسمس مبارک')||!ext.includes('نوروز پیروز')||!ext.includes('سبزه')||!ext.includes('prefers-reduced-motion:reduce')||!ext.includes('mznTreeSway')||!ext.includes('mznBloom'))throw Error('Seasonal greetings, Haft-Seen decorations or reduced-motion support missing');
if(!html.includes('settleMonth:settleMonth')||!html.includes('md-settle')||!html.includes('isMonthSettled')||!html.includes('localeCompare(String(b.item.date'))throw Error('Monthly settlement lock or date sorting missing');
if(!html.includes('brand-date{display:none!important}')||!html.includes('topbar-in{display:flex!important'))throw Error('Compact header styles missing');
for(const icon of manifest.icons||[])if(!fs.existsSync(icon.src.replace(/^\.\//,'')))throw Error('Missing manifest icon '+icon.src);
const shell=(sw.match(/const SHELL_FILES=\[([\s\S]*?)\];/)||[])[1];
if(!shell)throw Error('Missing service worker shell list');
for(const item of shell.matchAll(/["'](\.\/[^"']+)["']/g)){const file=item[1].split('?')[0].replace(/^\.\//,'');if(!fs.existsSync(file))throw Error('Missing shell asset '+file);}
for(const [file,source] of [['index.html',entryHtml],['index-1.html',html]]){
  for(const m of source.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/gi)){
    const css=m[1];if((css.match(/{/g)||[]).length!==(css.match(/}/g)||[]).length)throw Error('Unbalanced CSS braces in '+file);
  }
}
console.log('Mizan static checks passed. Inline scripts:',inlineCount,'; HTML, CSS, PWA assets, weather seasons, routes and service worker checks passed.');
