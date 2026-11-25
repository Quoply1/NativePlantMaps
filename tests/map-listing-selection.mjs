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
let focused = null,scrolled = null,flyOptions = null,flyCount = 0,ecoregionRemoved = 0,popupHtml = '';
class MapStub {
  on(type,layer,handler){events.set(type+':'+(typeof layer==='string'?layer:''),typeof layer==='function'?layer:handler)}
  addControl(){} addSource(){} addLayer(){} fitBounds(){}
  stop(){} getCenter(){return {lat:38,lng:-77}} getZoom(){return 12}
  flyTo(options){flyCount++;flyOptions=options}
}
class PopupStub {
  setLngLat(){return this} setHTML(value){popupHtml=value;return this} addTo(){return this} remove(){}
}
const maplibregl = {Map:MapStub,Popup:PopupStub,NavigationControl:class{},AttributionControl:class{}};
const context = vm.createContext({mapArea:null,manualMapPosition:'',URL,location:{href:'https://test/'},setupMapExperience(){},restoreMapPosition(){return false},frameDirectoryMap(){},setDirectoryView(){},clearMapArea(){},clearPlaceConnection(){},connectPlaceToPlants(){},renderPlaceSummary(){},renderTrustDetails(){return ''},bindDirectoryExtras(){},matchesPlantFilters(){return true},renderPlantFilterControls(){return ''},renderPlantActions(){return ''},bindPlantExtras(){},scheduleDirectoryState(){},renderPlantPlanning(){return ""},
  vendors:Array.from({length:125},(_,i)=>({id:'vendor-'+i,name:'Nursery '+i,state:'TX',area:'Test town',lat:30,lng:-98,website:'https://nursery.example/',native:'confirmed'})),
  selectedId:null,clusterFocusIds:null,clusterFocusCount:0,currentPage:1,lastPageSignature:'',PAGE_SIZE:50,
  nearbySearch:null,stateSearch:null,ecoregionSearch:null,stateLabels:{},vendorPopup:null,
  ecoregionPopup:{remove(){ecoregionRemoved++}},
  window:{maplibregl,scrollX:0,scrollY:203,scrollTo(position){this.scrollX=position.left;this.scrollY=position.top},matchMedia:query=>({matches:!query.includes('max-width')})},maplibregl,
  document:{getElementById:node,querySelectorAll:()=>[],querySelector(selector){
    const id=selector.match(/^\.card\[data-id="([^"]+)"\]$/)?.[1];
    if(id&&node('cards').innerHTML.includes('data-id="'+id+'"'))return {focus(){focused=id},scrollIntoView(){scrolled=id}};
    return null;
  }},
  saved:()=>({}),html:String,rankListings:items=>[...items],listingDescription:()=>'',nurseryInformation:()=>'',seasonalListing:()=>false,accessLabels:()=>[],badgeClass:()=>'',
  nurseryWebsiteLink:()=>'<a href="https://nursery.example/">Visit website</a>',nurseryPreview:()=>'',nurserySources:()=>'',sourceHost:()=>'',statusLabel:()=>'',
  refreshMapLayers(){},renderPagination(){},addEcoregionLayer(){},vendorFeatureCollection:()=>({type:'FeatureCollection',features:[]}),
  distanceMiles:()=>1200,stateBoundaryUrl:'/api/state-boundaries',nationalBounds:[[-125,25],[-66,49]],
});
context.filtered = () => context.vendors;
vm.runInContext(section('render','renderPagination')+section('syncSelectedCards','renderPublicReviews')+section('showVendorPopup','initMap').split('    // These color groups')[0]+section('initMap','refreshMapLayers'),context);
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
assert.equal(flyOptions.duration,0,'Reduced-motion preference must be honored');
context.window.matchMedia=()=>({matches:false});const stableMarkup=node('cards').innerHTML;context.selectVendor('vendor-16');
assert.equal(context.window.scrollY,203,'Sidebar selection preserves the page viewport');
assert.equal(node('cards').innerHTML,stableMarkup,'Selecting another visible card must preserve card and image DOM');
assert.ok(flyOptions.duration>=1100 && flyOptions.duration<=2600);assert.equal(flyOptions.minZoom,4,'Long-distance flights should pull back before moving across the map');
assert.equal(flyOptions.zoom,12);
const before=context.selectedId;pin('missing');assert.equal(context.selectedId,before);
context.window.accessMap=null;context.selectVendor('vendor-70',{fromMap:true,confirmed:true});assert.equal(context.selectedId,'vendor-70');assert.equal(context.currentPage,2);
console.log('Passed: actual map pin handler opens and reveals the correct paginated sidebar card, repeated clicks stay open, cluster transitions work, ecoregion popups close, sidebar toggle and fallback selection remain supported.');

// The SVG map also animates its existing viewBox, and user input cancels an in-flight transition.
let frames=[],sketchRenders=0;const svg={isConnected:true,setAttribute(name,value){this[name]=value}};
const sketch=vm.createContext({sketchFlight:0,sketchView:{x:0,y:0,w:1000,h:650},sketchProject:()=>[850,200],
 document:{querySelector:()=>svg},window:{matchMedia:()=>({matches:false})},performance:{now:()=>0},
 requestAnimationFrame:callback=>frames.push(callback),renderSketchMap(){sketchRenders++}});
vm.runInContext(section('flyToSketchNursery','flyToNursery'),sketch);
sketch.flyToSketchNursery({lat:40,lng:-74});assert.equal(sketchRenders,0);assert.equal(sketch.sketchView.w,1000);
frames.shift()(900);assert.ok(sketch.sketchView.w>360,'Mid-flight view should pull back rather than snap to the destination');
const midView=JSON.stringify(sketch.sketchView);sketch.sketchFlight++;frames.shift()(2400);assert.equal(JSON.stringify(sketch.sketchView),midView,'New map input cancels the old animation');
sketch.window.matchMedia=()=>({matches:true});sketch.flyToSketchNursery({lat:40,lng:-74});assert.equal(sketch.sketchView.w,360);assert.equal(sketchRenders,1);
console.log('Passed: smooth SVG map viewBox movement, interruption handling, and reduced-motion selection.');
