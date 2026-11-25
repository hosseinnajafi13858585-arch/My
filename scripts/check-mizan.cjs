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
if(!entryHtml.includes('mzn-theme-christmas')||!entryHtml.includes('mzn-theme-nowruz'))throw Error('Login seasonal theme missing');
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
