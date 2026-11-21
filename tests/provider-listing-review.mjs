import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import worker from '../dist/_worker.js';
const report=JSON.parse(await readFile(new URL('../provider-listing-review.json',import.meta.url),'utf8'));
const vendors=await (await worker.fetch(new Request('https://preview.test/api/vendors'),{})).json();
assert.equal(vendors.length,587);
const mediaStatus=JSON.parse(await readFile(new URL('../provider-media-status.json',import.meta.url),'utf8'));
const direct=JSON.parse(await readFile(new URL('../provider-direct-links-review.json',import.meta.url),'utf8'));
const excluded=new Set([...mediaStatus.exclusions,...direct.archivedListings]);
const currentProfiles=new Map(mediaStatus.profileUpdates.map(item=>[item.id,item.text]));
const current=JSON.parse(await readFile(new URL('../provider-final-pages-review.json',import.meta.url),'utf8'));
const replacements=new Map([...current.changes,...direct.mediaChanges].map(change=>[change.id,change]));
assert.equal(report.reviewedLastPages.length,142);
assert.equal(new Set(report.reviewedLastPages.map(x=>x.id)).size,142);
assert.ok(report.reviewedLastPages.every(x=>x.outcome&&x.originalPage>=10&&x.originalPage<=12));
assert.ok(report.reviewedLastPages.filter(x=>x.outcome==='image-unresolved').every(x=>x.reason));
const environment={ASSETS:{async fetch(request){const name=new URL(request.url).pathname.split('/').pop();const bytes=await readFile(new URL('../dist/assets/providers/'+name,import.meta.url));return new Response(request.method==='HEAD'?null:bytes,{headers:{'content-type':'image/webp'}});}}};
for(const change of report.changes){
 const vendor=vendors.find(v=>v.id===change.id);if(!vendor){assert.ok(excluded.has(change.id),change.id);continue;}assert.ok(vendor,change.id);assert.deepEqual(vendor.preview,replacements.get(change.id)?.preview||change.preview);
 const asset=new URL(change.preview.image);asset.host='preview.test';
 const response=await worker.fetch(new Request(asset),environment);assert.equal(response.status,200);
 const bytes=Buffer.from(await response.arrayBuffer());assert.equal(createHash('sha256').update(bytes).digest('hex'),change.asset.sha256);
 assert.ok(change.asset.width>70&&change.asset.height>50,change.id);
 assert.ok(change.sourcePage&&change.sourceImage,change.id);
}
const segmenter=new Intl.Segmenter('en',{granularity:'sentence'});
for(const profile of report.profiles){const vendor=vendors.find(v=>v.id===profile.id);if(!vendor){assert.ok(excluded.has(profile.id),profile.id);continue;}assert.equal(vendor.nurseryInformation,currentProfiles.get(profile.id)||profile.text);assert.equal(Array.from(segmenter.segment(profile.text)).length,2,profile.id+' needs two complete sentences');assert.ok(!/listed by|verification|why it.s listed/i.test(profile.text));}
for(const id of ['agrecol-native-nursery','natives-in-harmony','native-utah-plants-provo','primeval-forest-nursery','cache-valley-native-plants','garden-guru-rockford','warners-nursery-flagstaff','white-river-nursery','ash-creek-native-nursery-cornelius','red-buffalo-nursery-richmond-il','berridge-nurseries-phoenix','sunrise-nursery-athens','earth-first-native-plant-nursery','draggin-wing-high-desert-nursery','takao-nursery','miller-hill-farm-vt','humble-roots-nursery-mosier','goffle-brook','willamette-gardens','watermark-woods','digit-gardens-phoenix','armadillo-gardens'])assert.ok(report.changes.some(x=>x.id===id),'Requested media missing: '+id);
for(const id of ['natives-in-harmony','draggin-wing-high-desert-nursery'])assert.equal(report.changes.find(x=>x.id===id).provenance,'user attachment');
const page=await readFile(new URL('../index.html',import.meta.url),'utf8');assert.ok(!page.includes('<h3>Why it’s listed</h3>'));assert.ok(page.includes('<h3>About the nursery</h3>'));assert.ok(page.includes('focusAfterOpen:false'));
console.log(`Passed: ${report.changes.length} local image assets, source provenance, every requested correction, all 142 final-page audit outcomes, and ${report.profiles.length} two-sentence nursery profiles.`);
