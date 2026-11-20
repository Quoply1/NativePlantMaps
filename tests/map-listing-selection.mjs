import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const page = readFileSync(new URL('../index.html',import.meta.url),'utf8');
const section = (start,end) => page.slice(page.indexOf('    function '+start+'('),page.indexOf('    function '+end+'('));
const nodes = new Map();
const node = id => {
  if(!nodes.has(id))nodes.set(id,{value:'',innerHTML:'',textContent:'',hidden:false,querySelectorAll:()=>[]});
  return nodes.get(id);
};
const events = new Map();
let focused = null,scrolled = null,flyCount = 0,ecoregionRemoved = 0,popupHtml = '';
class MapStub {
  on(type,layer,handler){events.set(type+':'+(typeof layer==='string'?layer:''),typeof layer==='function'?layer:handler)}
  addControl(){} addSource(){} addLayer(){} fitBounds(){}
  flyTo(){flyCount++}
}
class PopupStub {
  setLngLat(){return this} setHTML(value){popupHtml=value;return this} addTo(){return this} remove(){}
}
const maplibregl = {Map:MapStub,Popup:PopupStub,NavigationControl:class{},AttributionControl:class{}};
const context = vm.createContext({
  vendors:Array.from({length:125},(_,i)=>({id:'vendor-'+i,name:'Nursery '+i,state:'TX',area:'Test town',lat:30,lng:-98,website:'https://nursery.example/',native:'confirmed'})),
  selectedId:null,clusterFocusIds:null,clusterFocusCount:0,currentPage:1,lastPageSignature:'',PAGE_SIZE:50,
  nearbySearch:null,stateSearch:null,ecoregionSearch:null,stateLabels:{},vendorPopup:null,
  ecoregionPopup:{remove(){ecoregionRemoved++}},
  window:{maplibregl,matchMedia:()=>({matches:true})},maplibregl,
  document:{getElementById:node,querySelector(selector){
    const id=selector.match(/^\.card\[data-id="([^"]+)"\]$/)?.[1];
    if(id&&node('cards').innerHTML.includes('data-id="'+id+'"'))return {focus(){focused=id},scrollIntoView(){scrolled=id}};
    return null;
  }},
  saved:()=>({}),html:String,rankListings:items=>[...items],listingDescription:()=>'',evidenceSummary:()=>'',seasonalListing:()=>false,badgeClass:()=>'',
  nurseryWebsiteLink:()=>'<a href="https://nursery.example/">Visit website</a>',nurseryPreview:()=>'',nurserySources:()=>'',sourceHost:()=>'',statusLabel:()=>'',
  refreshMapLayers(){},renderPagination(){},addEcoregionLayer(){},vendorFeatureCollection:()=>({type:'FeatureCollection',features:[]}),
  stateBoundaryUrl:'/api/state-boundaries',nationalBounds:[[-125,25],[-66,49]],
});
context.filtered = () => context.vendors;
vm.runInContext(section('render','renderPagination')+section('selectVendor','renderPublicReviews')+section('showVendorPopup','initMap').split('    // These color groups')[0]+section('initMap','refreshMapLayers'),context);
context.initMap();events.get('load:')();
const pin = id => events.get('click:vendor-points')({features:[{properties:{id}}]});
context.render();
pin('vendor-112');
assert.equal(context.selectedId,'vendor-112');
assert.equal(context.currentPage,3);
assert.ok(node('cards').innerHTML.includes('class="card selected" data-id="vendor-112"'));
assert.equal(focused,'vendor-112');assert.equal(scrolled,'vendor-112');
assert.equal(flyCount,0,'Pin selection should preserve the map view');
assert.ok(ecoregionRemoved>0,'Nursery selection removes the lower-priority ecoregion popup');
assert.ok(!popupHtml.includes('Open listing'));assert.ok(popupHtml.includes('Visit website'));
pin('vendor-112');assert.equal(context.selectedId,'vendor-112','Repeated pin clicks keep the listing expanded');
context.clusterFocusIds=['vendor-0'];context.clusterFocusCount=1;context.selectedId=null;context.render();
pin('vendor-112');assert.equal(context.clusterFocusIds,null);assert.equal(context.currentPage,3);
assert.ok(node('cards').innerHTML.includes('class="card selected" data-id="vendor-112"'),'Changing out of a cluster must preserve the selected listing page');
context.selectVendor('vendor-112');assert.equal(context.selectedId,null,'Sidebar Details still toggles closed');
context.selectVendor('vendor-15');assert.equal(context.selectedId,'vendor-15');assert.equal(context.currentPage,1);assert.equal(flyCount,1);
const before=context.selectedId;pin('missing');assert.equal(context.selectedId,before);
context.window.accessMap=null;context.selectVendor('vendor-70',{fromMap:true});assert.equal(context.selectedId,'vendor-70');assert.equal(context.currentPage,2);
console.log('Passed: actual map pin handler opens and reveals the correct paginated sidebar card, repeated clicks stay open, cluster transitions work, ecoregion popups close, sidebar toggle and fallback selection remain supported.');
