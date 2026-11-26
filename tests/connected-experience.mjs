import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import worker from '../dist/_worker.js';
const read=file=>readFileSync(new URL('../'+file,import.meta.url),'utf8');
const guide=JSON.parse(read('ecoregion-guides.json'));
const vendors=await(await worker.fetch(new Request('https://test/api/vendors'),{})).json();
const response=await worker.fetch(new Request('https://test/'),{}),page=await response.text();
// Inspect actual HTTP HTML before any client code is executed.
assert.match(page,/<span id="resultCount"[^>]*>580 providers/);
assert.equal((page.match(/id="nursery-/g)||[]).length,50);
assert.ok(!page.includes('Loading nurseries…'));assert.ok(!page.includes('__INITIAL_'));assert.ok(!page.includes('__CONNECTED_'));
for(const match of page.matchAll(/<script([^>]*)>([\s\S]*?)<\/script>/g)){if(!/application\/(json|ld\+json)/.test(match[1]))new vm.Script(match[2]);}
const states=JSON.parse(read('state-labels.json'));
for(const code of Object.keys(states)){const r=await worker.fetch(new Request('https://test/'+code.toLowerCase()+'/'),{});assert.equal(r.status,200);const content=await r.text();assert.match(content,/works without JavaScript/);for(const v of vendors.filter(v=>v.state===code))assert.ok(content.includes('id="nursery-'+v.id+'"'),v.id);assert.ok(!/<script/.test(content));}
const full=await(await worker.fetch(new Request('https://test/browse/'),{})).text();assert.equal((full.match(/id="nursery-/g)||[]).length,580);
const sitemap=await(await worker.fetch(new Request('https://test/sitemap.xml'),{})).text();assert.match(sitemap,/\/wi\//);assert.equal((await worker.fetch(new Request('https://test/zz/'),{})).status,404);
let exportedBlob,downloadName='';const downloadURL={createObjectURL(blob){exportedBlob=blob;return 'blob:test'},revokeObjectURL(){}};const nodes=new Map();const node=id=>{if(!nodes.has(id))nodes.set(id,{dataset:{},hidden:true,innerHTML:'',textContent:'',setAttribute(k,v){this[k]=v},querySelectorAll(){return []},getAttribute(){return 'true'},click(){}});return nodes.get(id)};
let base=vendors,features=[],requested=[],profiles=[],frameCount=0;
const memory=new Map(),context=vm.createContext({URL:Object.assign(URL,downloadURL),URLSearchParams,Math,Number,Date,Set,Map,JSON,Blob,TextEncoder,guideData:guide,baseFiltered:()=>base,seasonalListing:v=>v.category==='seasonal',isGardenStore:v=>/garden center/i.test(v.name),
 rankListings:rows=>rows,vendors,html:value=>String(value??''),publicHttpUrl:value=>/^https?:/.test(value||'')?value:'',nurseryPrimaryUrl:v=>v.websiteStatus==='verified'?v.website:'',
 listingSearch:'',activeFilter:'all',nearbySearch:{label:'Madison, Wisconsin',lat:43.07,lng:-89.38},ecoregionSearch:null,plantingState:'',plantingRegion:'',selectedHabitat:'all',selectedPlantingKey:'',stateLabels:states,stateSocieties:{},plantingRegions:{greatlakes:{states:['WI']}},
 updateEcoregionPicker(){},loadPlantingBoundaries:async url=>{requested.push(url);return features},ecoregionAtPoint:()=>features[0]?.key||'',renderPlantingProfile:(key)=>{profiles.push(key);context.selectedPlantingKey=key},plantOrderForRegion:key=>guide.regions[key].plants,
 document:{getElementById:node,querySelectorAll:()=>[],createElement(){return {click(){downloadName=this.download}}}},window:{accessMap:null},requestAnimationFrame:fn=>fn(),renderSketchMap:()=>frameCount++,scheduleDirectoryState(){},localStorage:{getItem:key=>memory.get(key),setItem:(k,v)=>memory.set(k,v)},sketchView:{x:0,y:0,w:1000,h:650},mapFrameRequest:0,
});
vm.runInContext(read('connected-experience.js'),context);
features=[{key:'8.2.1'}];await context.connectPlaceToPlants({label:'Madison, Wisconsin',stateCode:'WI',lat:43.07,lng:-89.38});assert.equal(context.nearbySearch.label,'Madison, Wisconsin');assert.equal(context.ecoregionSearch,null);assert.equal(profiles.at(-1),'8.2.1');assert.match(node('place-summary').innerHTML,/Explore plants/);assert.match(node('place-summary').innerHTML,/Browse nurseries/);assert.equal((node('place-summary').innerHTML.match(/href="#plant-/g)||[]).length,0);
vm.runInContext("providerMode='seasonal'",context);assert.ok(context.filtered().every(v=>v.category==='seasonal'));assert.ok(context.filtered().length>0);
vm.runInContext("providerMode='all';mapArea=[-90,42,-88,44]",context);assert.ok(context.filtered().every(v=>v.lng>=-90&&v.lng<=-88&&v.lat>=42&&v.lat<=44));
assert.equal(context.pointWithinArea(179,52,[170,50,-170,60]),true);assert.equal(context.pointWithinArea(0,52,[170,50,-170,60]),false);
const params=new URLSearchParams('kind=garden&view=map&area=-90,42,-88,44&light=shade&wildlife=host');context.readConnectedState(params);const saved=new URLSearchParams();context.appendConnectedState(saved);assert.equal(saved.get('kind'),'garden');assert.equal(saved.get('wildlife'),null);assert.equal(saved.get('light'),null);assert.equal(saved.get('view'),'map');
context.readConnectedState(new URLSearchParams('kind=unknown&area=NaN,1,2,3&wildlife=nonsense'));const clean=new URLSearchParams();context.appendConnectedState(clean);assert.equal(clean.get('kind'),null);assert.equal(clean.get('area'),null);assert.equal(clean.get('wildlife'),null);
assert.equal(context.restoreMapPosition('s,100,200,120,78'),true);assert.equal(context.sketchView.w,120);assert.equal(frameCount,1);assert.equal(context.restoreMapPosition('s,1,2,-10,6'),false);
memory.set('nativeplantmaps-shopping-v1',JSON.stringify(['swampMilkweed','fake','bluestem']));assert.deepEqual([...context.shoppingList()],['swampMilkweed','bluestem']);vm.runInContext("providerMode='all';mapArea=null",context);context.exportShoppingCsv();const csv=await exportedBlob.text();assert.match(csv,/"plant","Swamp milkweed","Asclepias incarnata"/);assert.match(csv,/"nursery"/);assert.equal(downloadName,'nativeplantmaps-shopping-plan.csv');memory.set('nativeplantmaps-shopping-v1','broken');assert.deepEqual([...context.shoppingList()],[]);
const event={date:'2026-12-17',endDate:'2026-12-20',title:'Native sale, open house',location:'Different nursery location',source:'https://example.org/sale'};
const ics=context.saleCalendar({id:'example',name:'Example',address:'Main nursery'},event);assert.match(ics,/DTEND;VALUE=DATE:20261221/);assert.match(ics,/Native sale\\, open house/);assert.match(ics,/LOCATION:Different nursery location/);assert.equal(context.saleCalendar({id:'x'},{date:'invalid'}),'');
const timed={id:'dated',name:'Dated sale',website:'https://example.org',saleEvents:[{date:'2000-01-01',source:'https://example.org'},{date:'2099-01-01',source:'https://example.org'}]};base=[timed];vm.runInContext("providerMode='all';mapArea=null",context);context.renderSales();assert.ok(!node('sale-results').innerHTML.includes('2000-01-01'));assert.match(node('sale-results').innerHTML,/2099-01-01/);
assert.match(read('index.html'),/Madison, WI or 53703/);assert.ok(!/Montclair|07042/.test(read('index.html')+read('client-experience.js')));assert.match(read('index.html'),/data-mobile-view=list/);assert.match(read('index.html'),/aria-hidden="true"[^>]*><label for="sub-company"/);assert.match(read('index.html'),/name="evidenceUrl" type="url" maxlength/);
console.log('Passed real no-JavaScript HTML for 51 state pages and all 580 sources, integrated place-to-plant connection, independent provider filters, URL state, map framing, saved plants, calendar dates and expired-sale suppression.');
// Browser geolocation is requested on a click only, uses a rounded location,
// and must not overwrite a town search made while permission was pending.
const handlers=new Map();for(const id of ['provider-kind','search-map-area','use-location'])node(id).addEventListener=(event,fn)=>handlers.set(id+':'+event,fn);
context.document.addEventListener=()=>{};context.setInterval=()=>{};
let success,error,options,locationCalls=[];
context.navigator={geolocation:{getCurrentPosition(a,b,c){success=a;error=b;options=c;}}};context.applyNearbyCity=city=>locationCalls.push(city);
context.setupConnectedExperience();assert.equal(success,undefined);handlers.get('use-location:click')();assert.equal(options.enableHighAccuracy,false);success({coords:{latitude:43.0775,longitude:-89.3831}});assert.equal(locationCalls[0].lat,43.08);assert.equal(locationCalls[0].lng,-89.38);
handlers.get('use-location:click')();error({code:1});assert.match(node('search-status').textContent,/permission was declined/);
handlers.get('use-location:click')();context.clearPlaceConnection();success({coords:{latitude:43.0775,longitude:-89.3831}});assert.equal(locationCalls.length,1);
let bound;const fakeDB={prepare(){return {bind(...args){bound=args;return this},async run(){return {success:true}}}}};
const submission={name:'Example Native Nursery',category:'retail',region:'greatlakes',area:'Madison',state:'WI',address:'Public nursery pickup area',website:'https://example.org',nativeDescription:'Sells documented native perennial plants.'};
const submitted=await worker.fetch(new Request('https://test/api/submissions',{method:'POST',headers:{'content-type':'application/json',origin:'https://test'},body:JSON.stringify(submission)}),{DB:fakeDB});assert.equal(submitted.status,201);assert.equal(bound[6],submission.website);assert.equal(bound[7],submission.website);
console.log('Passed click-only approximate geolocation, denial handling, pending-location race protection, and optional supporting-source fallback in the real submission API.');

let ring;context.document.querySelector=()=>({querySelector(){return null},append(node){ring=node}});context.document.createElementNS=()=>({attributes:{},setAttribute(k,v){this.attributes[k]=v}});context.sketchProject=()=>[50,60];context.highlightNursery(vendors[0].id,true);assert.equal(ring.attributes.class,'listing-hover-ring');assert.equal(ring.attributes.cx,'50');assert.equal(ring.attributes['pointer-events'],'none');
console.log('Passed a visible list-hover ring even when an individual nursery pin is clustered.');

context.nearbySearch=null;context.listingSearch='montclair, new jersey (07042)';context.fetch=async()=>({ok:true,json:async()=>({results:[{label:'ZIP 07042',lat:40.8131,lng:-74.2165}]})});await context.restoreConnectedState();assert.equal(locationCalls.at(-1).label,'ZIP 07042');console.log('Passed recovery of geocoded town labels accidentally stored as nursery-name queries.');
const controls=context.renderPlantFilterControls();assert.ok(!controls.includes('data-plant-filter'));assert.ok(!controls.includes('Clear plant filters'));
assert.ok(!read('index.html').includes('&&matchesPlantFilters(id)'));
assert.equal((read('index.html').match(/data-open-suggestion>Suggest a place<\/button>/g)||[]).length,0,'Remove the footer suggestion shortcut');
assert.ok(read('index.html').indexOf('Find my ecoregion</button><a class="explore-ecoregions"')>0);
for(const [key,entries] of Object.entries(guide.treeSites||{})){for(const id of Object.keys(entries)){assert.ok(guide.regions[key].plants.includes(id));assert.ok(guide.photos[guide.species[id][1]]);assert.ok(guide.planning[id].sources.length);assert.ok(entries[id].length>40);}}
for(const key of ['2.2.1','2.2.2','2.2.6'])assert.equal(guide.treeSites?.[key],undefined,'Do not add trees to naturally treeless regions');
console.log('Passed habitat-only browsing, retired-filter removal, footer cleanup, action order and sourced tree recommendation coverage.');
