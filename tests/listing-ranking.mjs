import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import worker from '../dist/_worker.js';

const read = path => readFileSync(new URL(path, import.meta.url), 'utf8');
const page = read('../index.html');
const helpers = page.slice(page.indexOf('    function sourceHost('), page.indexOf('    function sourceEvidence('));
const context = vm.createContext({URL, publicHttpUrl: raw => {
  try { const url = new URL(raw); return /^https?:$/.test(url.protocol) ? url.href : ''; } catch { return ''; }
}});
vm.runInContext(helpers, context);
const {rankListings, listingQuality, sourceConfidence, verifiedSourceSites} = context;
const basic = {id:'basic',name:'Basic',website:'https://grower.example/',websiteStatus:'verified',category:'retail',nativeTier:'specialist',sources:[]};
const complete = {...basic,id:'complete',name:'Complete',websiteProfile:{catalogUrl:'https://grower.example/plants',visitingUrl:'https://grower.example/visit'},preview:{image:'https://grower.example/greenhouse.jpg',type:'photo'},sources:[{label:'University supplier list',url:'https://extension.example.edu/nurseries'}]};
const social = {...basic,id:'small',name:'Small grower',website:'https://www.facebook.com/smallgrower/',sources:Array.from({length:50},(_,i)=>({url:'https://unknown'+i+'.example/',verificationPending:true}))};
assert.equal(rankListings([social,complete,basic])[0].id, 'complete');
assert.equal(listingQuality(social), listingQuality({...social,sources:[]}));
assert.equal(sourceConfidence(social), sourceConfidence({...social,sources:[]}));
const duplicated = {...complete,sources:[...complete.sources,{url:'https://grower.example/about'},...Array.from({length:8},(_,i)=>({url:'https://extension.example.edu/list-'+i,label:'University supplier list'}))]};
assert.equal(listingQuality(duplicated), listingQuality(complete));
assert.equal(sourceConfidence(duplicated), sourceConfidence(complete));
const chapters = {...basic,sources:[{url:'https://chapter1.wildones.org/suppliers'},{url:'https://chapter2.wildones.org/suppliers'}]};
assert.equal(verifiedSourceSites(chapters).size, 2, 'Wild Ones chapters are one independent organization plus the seller');
const shop = {...complete,websiteProfile:{...complete.websiteProfile,catalogUrl:'https://grower-shop.myshopify.com/'},sources:[{url:'https://grower-shop.myshopify.com/products/'}]};
assert.equal(verifiedSourceSites(shop).size, 1, 'Seller-owned ordering pages are not independent references');
const trade = {...complete,id:'trade',category:'wholesale'};
assert.ok(listingQuality(trade) < listingQuality(complete));
assert.ok(listingQuality({...basic,searchDistance:5}) > listingQuality({...basic,searchDistance:70}));
assert.ok(listingQuality({...complete,searchDistance:70}) > listingQuality({...social,searchDistance:1}));
const input = [social,basic,complete];
assert.deepEqual(Array.from(rankListings(input),x=>x.id), Array.from(rankListings(input),x=>x.id));
assert.equal(input[0], social, 'Ranking must not mutate the filtered list');

const response = await worker.fetch(new Request('https://test.invalid/api/vendors'), {});
assert.equal(response.status, 200);
const vendors = await response.json();
const report = JSON.parse(read('../nursery-expansion-research.json'));
const directory = JSON.parse(read('../ecoregion-search.json'));
assert.equal(new Set(vendors.map(v=>v.id)).size, vendors.length);
assert.equal(report.addedLocations, report.listings.length);
for (const listing of report.listings) {
  const vendor = vendors.find(v=>v.id===listing.id);
  assert.ok(vendor, 'Public listing missing: '+listing.id);
  assert.equal(vendor.websiteStatus, 'verified');
  assert.ok(vendor.preview?.image.startsWith('https://'), 'Official media missing: '+listing.id);
  assert.ok(Number.isFinite(vendor.lat) && Number.isFinite(vendor.lng));
  assert.ok(vendor.sources.every(s=>!s.verificationPending));
  assert.ok(Object.values(directory).some(region=>region.vendorIds.includes(vendor.id)), 'Ecoregion membership missing: '+listing.id);
}
const jersey = Array.from(rankListings(vendors.filter(v=>v.state==='NJ')));
const mississippi = Array.from(rankListings(vendors.filter(v=>v.state==='MS')));
const backhouse = mississippi.findIndex(v=>/backhouse/i.test(v.name));
assert.ok(backhouse > 0, 'Backhouse remains discoverable without being the first Mississippi suggestion');
assert.ok(jersey.slice(0,3).every(v=>v.websiteStatus==='verified' && !/facebook\.com/.test(v.website)));
console.log(`Passed: verified evidence ranking, seller/domain deduplication, public access and proximity, stable ordering; ${report.addedLocations} additions and ${vendors.length} public listings.`);
console.log('New Jersey first results:', jersey.slice(0,5).map(v=>v.name).join('; '));
console.log('National first results:', Array.from(rankListings(vendors)).slice(0,8).map(v=>v.name).join('; '));
