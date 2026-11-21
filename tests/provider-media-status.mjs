import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import worker from '../dist/_worker.js';
const report=JSON.parse(await readFile(new URL('../provider-media-status.json',import.meta.url),'utf8'));
const publicRows=await(await worker.fetch(new Request('https://preview.test/api/vendors'),{})).json();
assert.equal(publicRows.length,588);
assert.deepEqual(publicRows.map(x=>x.id).sort(),report.listings.filter(x=>x.directoryStatus==='active').map(x=>x.id).sort());
for(const id of report.exclusions)assert.ok(!publicRows.some(x=>x.id===id));
const page=await readFile(new URL('../index.html',import.meta.url),'utf8');
const source=page.slice(page.indexOf('    function nurseryPreview('),page.indexOf('    function nurserySources('));
const context=vm.createContext({URL,html:String,publicHttpUrl:raw=>{try{const u=new URL(raw);return /^https?:$/.test(u.protocol)?u.href:''}catch{return''}}});vm.runInContext(source,context);
const checked=new Set();let displayed=0;
for(const row of publicRows){
 const status=report.listings.find(x=>x.id===row.id);assert.ok(status,row.id);
 const markup=context.nurseryPreview(row);
 if(!row.preview?.image){assert.equal(status.imageStatus,'missing');assert.equal(markup,'');continue;}
 assert.ok(markup,row.id+' has an image but the card would hide it');displayed++;assert.deepEqual(row.preview,status.preview);
 if(status.assetPath&&!checked.has(status.assetPath)){const bytes=await readFile(new URL('../'+status.assetPath,import.meta.url));const sha=createHash('sha1').update('blob '+bytes.length+'\0').update(bytes).digest('hex');assert.equal(sha,status.assetBlobSha,row.id);checked.add(status.assetPath);}
}
assert.equal(displayed,report.counts.withRenderableImage);
for(const id of ['night-song-native-plant-nursery-canton','chickadee-natives-folsom','the-prairie-flower-spencer','greenscape-gardens-manchester','green-mountain-natives']){const row=report.listings.find(x=>x.id===id);assert.equal(row.imageStatus,'packaged-logo');assert.ok(row.assetBlobSha);}
const ete=publicRows.find(x=>x.id==='earth-tech-environmental-bonita-springs');assert.equal(ete.category,'wholesale');assert.equal(ete.websiteProfile.tradeOnly,true);assert.equal(ete.preview.type,'photo');
assert.equal(publicRows.find(x=>x.id==='mill-creek-greenhouses').preview.type,'photo');
console.log('Passed current image presence, renderer visibility, packaged asset hashes, two listing exclusions, retained logos, and wholesale classification. External image pixel/browser checks remain explicitly unverified.');
