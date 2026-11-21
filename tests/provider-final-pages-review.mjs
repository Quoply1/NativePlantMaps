import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import worker from '../dist/_worker.js';
const read=async name=>JSON.parse(await readFile(new URL('../'+name,import.meta.url),'utf8'));
const report=await read('provider-final-pages-review.json');
const vendors=await(await worker.fetch(new Request('https://preview.test/api/vendors'),{})).json();
assert.equal(report.reviewedLastPages.length,142);assert.equal(new Set(report.reviewedLastPages.map(x=>x.id)).size,142);
for(const row of report.reviewedLastPages){assert.ok(row.originalPage>=10&&row.originalPage<=12);assert.ok(row.outcome);assert.ok(row.image||row.reason);}
for(const id of report.closedListings)assert.ok(!vendors.some(v=>v.id===id),'Closed nursery exposed: '+id);
assert.equal(vendors.length,590);
const env={ASSETS:{async fetch(request){const name=new URL(request.url).pathname.split('/').pop();const data=await readFile(new URL('../dist/assets/providers/'+name,import.meta.url));return new Response(request.method==='HEAD'?null:data,{headers:{'content-type':'image/webp'}});}}};
for(const change of report.changes){
 const vendor=vendors.find(v=>v.id===change.id);assert.ok(vendor,change.id);assert.deepEqual(vendor.preview,change.preview);
 assert.ok(change.sourcePage&&change.sourceImage&&change.visualReview,change.id);
 const url=new URL(change.preview.image);url.host='preview.test';const res=await worker.fetch(new Request(url),env);assert.equal(res.status,200);const bytes=Buffer.from(await res.arrayBuffer());assert.equal(createHash('sha256').update(bytes).digest('hex'),change.asset.sha256,change.id);assert.ok(change.asset.width>=100&&change.asset.height>=70);
 const head=await worker.fetch(new Request(url,{method:'HEAD'}),env);assert.equal(head.status,200);assert.equal((await head.arrayBuffer()).byteLength,0);
}
for(const [id,url]of Object.entries(report.websiteCorrections)){const v=vendors.find(x=>x.id===id);assert.equal(v.website,url);assert.equal(v.websiteStatus,'verified');assert.ok(!v.websiteLabel);}
const queens=vendors.find(v=>v.id==='queens-nursery-memphis');assert.ok(queens.sources.some(s=>s.url.includes('picktnproducts.org')&&!s.verificationPending),'Keep independent Pick TN reference after official website upgrade');
const chiappini=vendors.find(v=>v.id==='chiappini-farm-native-nursery-hawthorne');assert.equal(chiappini.website,'https://chiappinifarm.com/');assert.ok(chiappini.preview);
for(const id of ['milkweed-monarchy-williamsport','overhill-gardens-tn','cattail-corner-howard-lake','nearly-native-nursery'])assert.equal(vendors.find(v=>v.id===id).preview.type,'logo');
console.log(`Passed ${report.changes.length} current image files and SHA hashes, 142 audit outcomes, seven official links, retained independent evidence, and two closed-listing exclusions.`);
