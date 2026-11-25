import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import worker from '../dist/_worker.js';
const read=name=>readFileSync(new URL('../'+name,import.meta.url),'utf8');
const page=read('index.html'),experience=read('client-experience.js');
const guide=JSON.parse(read('ecoregion-guides.json')),directory=JSON.parse(read('ecoregion-search.json'));
const vendors=await(await worker.fetch(new Request('https://test/api/vendors'),{})).json();
const nodes=new Map(),buttons=['all','specialist','documented','seasonal','garden'].map(type=>({dataset:{filter:type},attrs:{},classList:{toggle(){}},setAttribute(k,v){this.attrs[k]=v}}));
const node=id=>{if(!nodes.has(id))nodes.set(id,{value:'',textContent:'',innerHTML:'',hidden:false,attrs:{},setAttribute(k,v){this.attrs[k]=v},getAttribute(k){return this.attrs[k]||'false'},click(){if(id==='ecoregion-toggle'){this.attrs['aria-pressed']=this.getAttribute('aria-pressed')==='true'?'false':'true'}}});return nodes.get(id)};
let queued=null,frames=0;const location={href:'https://test/'};Object.defineProperty(location,'hash',{get(){return new URL(this.href).hash}});
const svg={isConnected:true,setAttribute(k,v){this[k]=v}};
const context=vm.createContext({revealSearchMap(){},syncMapEcoregionSelection(){},URL,URLSearchParams,Map,Set,Math,Number,location,history:{pushState(_,__,url){location.href=String(url)}},queueMicrotask(fn){queued=fn},setTimeout(fn){queued=fn;return 1},clearTimeout(){queued=null},
 vendors,guideData:guide,ecoregionDirectory:directory,stateLabels:{NJ:'New Jersey',AZ:'Arizona',AK:'Alaska',HI:'Hawaii'},stateBounds:{NJ:[[-75.6,38.9],[-73.8,41.4]],AZ:[[-114.9,31.3],[-109,37]]},stateBoundaryUrl:'/api/state-boundaries',
 stateSearch:null,nearbySearch:null,ecoregionSearch:null,listingSearch:'',selectedId:null,activeFilter:'all',currentPage:1,lastPageSignature:'',searchRadius:50,PAGE_SIZE:50,searchRequest:0,searchTimer:0,clusterFocusIds:null,clusterFocusCount:0,selectedPlantingKey:'',plantingRegion:'',plantingRegions:{midatlantic:{states:['NJ']},southwest:{states:['AZ']}},
 hawaiiPlantingKeys:{'Hawaii tropical moist forests':'OC0106'},stateBoundaryFeatures:[{}],sketchFlight:0,sketchView:{x:0,y:0,w:1000,h:650},
 sketchProject:(lat,lng,state)=>state==='AK'?[(lng+190)*5,(72-lat)*5]:state==='HI'?[(lng+161)*15,(23-lat)*15]:[(lng+125)*10,(50-lat)*10],
 window:{accessMap:null,matchMedia:()=>({matches:true})},document:{getElementById:node,querySelector:()=>svg,querySelectorAll:selector=>selector==='[data-filter]'?buttons:[]},html:String,
 appendConnectedState(){},readConnectedState(){},restoreMapPosition(){return false},clearMapArea(){},clearPlaceConnection(){},connectPlaceToPlants(){},render(){context.scheduleDirectoryState()},refreshMapLayers(){},renderStateResources(){},updateEcoregionPicker(){},closeCitySuggestions(){},renderSketchMap(){frames++},resetMap(){context.sketchView={x:0,y:0,w:1000,h:650}},rankListings:rows=>[...rows].sort((a,b)=>a.name.localeCompare(b.name)),seasonalListing:v=>v.category==='seasonal',isGardenStore:()=>false,
 ecoregionKey:value=>String(value||'').split(' ')[0] in guide.regions?String(value).split(' ')[0]:'',plantingPolygons:g=>g.type==='Polygon'?[g.coordinates]:g.type==='MultiPolygon'?g.coordinates:[],
 distanceMiles:(a,b,c,d)=>Math.hypot(a-c,b-d)*69,
 loadPlantingBoundaries:async()=>[],
});
vm.runInContext(experience,context);
context.renderPlantingProfile=(key,habitat='all')=>{context.selectedPlantingKey=key;vm.runInContext('selectedHabitat='+JSON.stringify(habitat),context)};
const section=(a,b)=>page.slice(page.indexOf('    function '+a+'('),page.indexOf('    function '+b+'('));
vm.runInContext(section('applyStateSearch','stateCodeForQuery')+page.slice(page.indexOf('    function applyEcoregionSearch('),page.indexOf('    async function updateCitySuggestions'))+section('applyNearbyCity','applyListingSearch')+section('baseFiltered','publicHttpUrl')+';function filtered(){return baseFiltered()}',context);
context.activeFilter='specialist';context.applyEcoregionSearch('10.2.2');assert.equal(context.activeFilter,'specialist');assert.equal(context.filtered().length,2);
context.applyEcoregionSearch('10.2.2');assert.equal(context.filtered().length,2);context.applyStateSearch('AZ');assert.equal(context.ecoregionSearch.key,'10.2.2');assert.equal(context.activeFilter,'specialist');
context.applyStateSearch('NJ');assert.equal(context.ecoregionSearch,null);assert.equal(context.activeFilter,'specialist');assert.match(node('search-status').textContent,/does not overlap/);
context.applyNearbyCity({lat:40.83,lng:-74.21,label:'Montclair, New Jersey'});assert.equal(node('state-filter').value,'');assert.equal(context.activeFilter,'specialist');assert.ok(context.sketchView.w<1000);assert.ok(frames>0);
vm.runInContext('directoryReady=true',context);context.scheduleDirectoryState();queued();assert.match(location.href,/type=specialist/);assert.match(location.href,/near=Montclair/);
location.href='https://test/?state=NJ&eco=8.5.4&type=specialist&radius=25&habitat=wet&listing=earth-first-native-nursery#planting-profile';
await context.restoreDirectoryState();assert.equal(context.stateSearch,'NJ');assert.equal(context.activeFilter,'specialist');assert.equal(context.ecoregionSearch.key,'8.5.4');assert.equal(context.searchRadius,25);assert.equal(vm.runInContext('selectedHabitat',context),'wet');assert.ok(context.filtered().every(v=>v.state==='NJ'));
location.href='https://test/?page=12';await context.restoreDirectoryState();assert.equal(context.currentPage,12);assert.equal(context.lastPageSignature,context.rankListings(context.filtered()).map(v=>v.id).join('|'));
location.href='https://test/?type=invalid&radius=-1&state=ZZ&eco=not-real&lat=NaN&lng=0&near=invalid&page=999999';await context.restoreDirectoryState();assert.equal(context.activeFilter,'all');assert.equal(context.searchRadius,50);assert.equal(context.stateSearch,null);assert.equal(context.ecoregionSearch,null);assert.equal(context.nearbySearch,null);assert.equal(context.currentPage,12);
location.href='https://test/?radius=125';await context.restoreDirectoryState();assert.equal(context.searchRadius,100);assert.equal(node('search-radius').value,'100');
const ring=[[0,0],[10,0],[10,10],[0,10],[0,0]],hole=[[3,3],[7,3],[7,7],[3,7],[3,3]];
assert.equal(context.pointInRing(5,5,ring),true);assert.equal(context.pointInRing(12,5,ring),false);assert.equal(context.pointInRing(0,5,ring),true);
assert.equal(context.ecoregionAtPoint({lat:2,lng:2},[{properties:{NA_L3KEY:'8.3.1'},geometry:{type:'Polygon',coordinates:[ring,hole]}}]),'8.3.1');
assert.equal(context.ecoregionAtPoint({lat:5,lng:5},[{properties:{NA_L3KEY:'8.3.1'},geometry:{type:'Polygon',coordinates:[ring,hole]}}]),'');
assert.equal(context.pointInRing(-179,52,[[178,50],[-178,50],[-178,54],[178,54],[178,50]]),true);
context.frameMapBounds([[-151,60],[-149,62]],'AK',0);assert.ok(context.sketchView.w<1000);assert.ok(context.sketchView.x<300);
context.frameMapBounds([[-158,20],[-156,22]],'HI',0);assert.ok(context.sketchView.w<1000);
// Clicking Search area must not invalidate the in-flight geocoder request.
let outsideHandler,closed=0;
const clickContext=vm.createContext({document:{addEventListener(_,handler){outsideHandler=handler}},closeCitySuggestions(){closed++}});
const outside=page.match(/document\.addEventListener\('click',event=>\{if\(!event\.target\.closest\('\.city-search,#search-area'\)\)closeCitySuggestions\(\)\}\)/)?.[0];assert.ok(outside);vm.runInContext(outside,clickContext);outsideHandler({target:{closest:()=>true}});assert.equal(closed,0);outsideHandler({target:{closest:()=>false}});assert.equal(closed,1);
console.log('Passed filter preservation, compatible state/ecoregion intersection, URL refresh restoration, pagination, invalid links, town map framing, Alaska/Hawaii projections, polygon holes and dateline lookup.');
// ZIP selection uses the actual spherical distance calculation and provider data.
vm.runInContext(section('distanceMiles','normalizedPlaceQuery'),context);
context.activeFilter='all';context.searchRadius=50;context.applyNearbyCity({lat:40.8131,lng:-74.2165,label:'ZIP 07042',stateCode:'NJ'});
assert.ok(context.filtered().length>=15,'ZIP 07042 must show the documented nearby providers');
assert.ok(context.filtered().some(v=>v.id==='newtown-native-nursery'));
assert.equal(context.ecoregionSearch,null,'A ZIP radius search must not be narrowed to ecoregion membership');
assert.equal(context.stateSearch,null);assert.equal(node('state-filter').value,'');
console.log('Passed ZIP 07042 nearby results using actual distances and clearing geographic restrictions.');
node('search').value=context.nearbySearch.label;
context.cityInput=node('search');vm.runInContext(page.slice(page.indexOf('async function submitPlaceSearch(){'),page.indexOf("    cityInput.addEventListener('keydown'")),context);
await context.submitPlaceSearch();assert.ok(context.nearbySearch);assert.equal(context.listingSearch,'');assert.ok(context.filtered().length>=15);
console.log('Passed resubmitting a selected ZIP without converting it to a nursery-name query.');
