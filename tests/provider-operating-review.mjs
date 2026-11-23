import {readFileSync} from 'node:fs';
import assert from 'node:assert/strict';
import worker from '../dist/_worker.js';
const report=JSON.parse(readFileSync(new URL('../provider-operating-review.json',import.meta.url),'utf8'));
const rows=await(await worker.fetch(new Request('https://preview.test/api/vendors'),{})).json();
assert.equal(report.listings.length,587);assert.equal(new Set(report.listings.map(r=>r.id)).size,587);
assert.equal(rows.length,report.counts.activeAfterReview);
const hidden=[...report.withheldListings.map(r=>r.id),...report.closedListings,...report.duplicates.map(r=>r.id)];
for(const id of hidden)assert.ok(!rows.some(r=>r.id===id),id);
for(const update of report.accessUpdates){
 if(hidden.includes(update.id))continue;
 const row=rows.find(r=>r.id===update.id);assert.ok(row,update.id);assert.equal(row.availability,update.patch.availability);assert.ok(row.operationCheck.source?.startsWith('http'));assert.notEqual(row.operatingStatus,'closed');
}
for(const r of report.listings)assert.ok(r.checkedOn&&r.status&&r.limit,r.id);
assert.equal(rows.find(r=>r.id==='van-berkum-nursery-deerfield').category,'wholesale');
assert.equal(rows.find(r=>r.id==='moosa-creek-nursery').category,'retail');
assert.equal(rows.find(r=>r.id==='moosa-creek-nursery').websiteProfile.tradeOnly,false);
assert.ok(rows.find(r=>r.id==='growild-inc').sources.length>=2);
assert.match(rows.find(r=>r.id==='grow-wild-ithaca').availability,/May 2027/);
console.log('Passed complete 587-record review coverage, archived/held/duplicate suppression, seasonal retention, current access notices, and wholesale/retail distinctions.');
