import {readFile, readdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import worker from '../dist/_worker.js';

const report=JSON.parse(await readFile(new URL('../provider-background-review.json',import.meta.url),'utf8'));
const latest=JSON.parse(await readFile(new URL('../provider-listing-review.json',import.meta.url),'utf8'));
const current=JSON.parse(await readFile(new URL('../provider-final-pages-review.json',import.meta.url),'utf8'));
const status=JSON.parse(await readFile(new URL('../provider-media-status.json',import.meta.url),'utf8'));
const excluded=new Set(status.exclusions);
const replacements=new Map([...latest.changes,...current.changes].map(change=>[change.id,change]));
const imageDir=new URL('../dist/assets/providers/',import.meta.url);
const files=new Set(await readdir(imageDir));
let delegated=0;
const env={ASSETS:{async fetch(request){
  delegated++;
  const name=new URL(request.url).pathname.split('/').pop();
  assert.ok(files.has(name),'Only packaged image assets may reach the static binding');
  const bytes=await readFile(new URL(name,imageDir));
  return new Response(request.method==='HEAD'?null:bytes,{headers:{'content-type':'image/webp'}});
}}};
const response=await worker.fetch(new Request('https://preview.example/api/vendors'),env);
const vendors=await response.json();
const alphaWebP=bytes=>{
  assert.equal(bytes.toString('ascii',0,4),'RIFF');assert.equal(bytes.toString('ascii',8,12),'WEBP');
  for(let offset=12;offset+8<=bytes.length;){
    const tag=bytes.toString('ascii',offset,offset+4),size=bytes.readUInt32LE(offset+4),data=offset+8;
    if(tag==='ALPH'||tag==='VP8X'&&(bytes[data]&16)||tag==='VP8L'&&(bytes[data+4]&16))return true;
    offset=data+size+(size%2);
  }
  return false;
};
assert.equal(report.logoPreviewsReviewed,report.changes.length+report.unchanged.length);
const checkedAssets=new Set();
for(const change of report.changes){
  const vendor=vendors.find(v=>v.id===change.id);if(!vendor){assert.ok(excluded.has(change.id),change.id);continue;}assert.ok(vendor,change.id);
  if(!change.preview&&replacements.has(change.id)){assert.deepEqual(vendor.preview,replacements.get(change.id).preview);continue;}
  if(!change.preview){assert.ok(!vendor.preview,'Misattributed directory logo must stay removed');assert.equal(vendor.websiteStatus,'directory');continue;}
  const current=replacements.get(change.id)?.preview||change.preview;assert.equal(vendor.preview.image,current.image);assert.equal(vendor.preview.type,current.type);
  const url=new URL(change.preview.image);url.host='preview.example';
  const get=await worker.fetch(new Request(url),env);assert.equal(get.status,200);assert.equal(get.headers.get('content-type'),'image/webp');
  const bytes=Buffer.from(await get.arrayBuffer());
  assert.equal(createHash('sha256').update(bytes).digest('hex'),change.asset.sha256);
  if(change.preview.type==='logo')assert.ok(alphaWebP(bytes),'Packaged logo has no alpha channel: '+vendor.id);
  const head=await worker.fetch(new Request(url,{method:'HEAD'}),env);assert.equal(head.status,200);assert.equal((await head.arrayBuffer()).byteLength,0);
  checkedAssets.add(change.asset.name);
}
const before=delegated;
const missing=await worker.fetch(new Request('https://preview.example/assets/providers/README.md'),env);
assert.equal(missing.status,404);assert.equal(delegated,before,'Unlisted files must not be forwarded to static storage');
// First-party media must render from the current preview/custom domain rather than production.
const page=await readFile(new URL('../index.html',import.meta.url),'utf8');
const helpers=page.slice(page.indexOf('    function nurseryPreview('),page.indexOf('    function nurserySources('));
const context=vm.createContext({URL,html:String,publicHttpUrl:raw=>{try{const url=new URL(raw);return /^https?:$/.test(url.protocol)?url.href:''}catch{return''}}});
vm.runInContext(helpers,context);
const texas=vendors.find(v=>v.id==='natives-of-texas');
assert.ok(context.nurseryPreview(texas).includes('src="/assets/providers/'));
assert.ok(context.nurseryPreview({...texas,preview:{...texas.preview,image:'https://other.example/photo.webp'}}).includes('src="https://other.example/photo.webp"'));
assert.ok(report.unchanged.every(x=>x.transparentFraction>0),'Every originally opaque logo needs an explicit resolution');
console.log(`Passed: ${report.logoPreviewsReviewed} logo reviews, ${report.changes.length} corrections, ${checkedAssets.size} packaged images, alpha channels, static GET/HEAD routing, preview-domain paths, and removal of misattributed logos.`);
