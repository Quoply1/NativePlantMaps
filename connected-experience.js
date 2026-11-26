// Connected place-to-plant flow and progressive directory controls.
let providerMode='all',localEcoregion='',placeConnectionRequest=0,connectionStatus='',mapArea=null,manualMapPosition='',directoryView='list';
const plantFilters={light:'',moisture:'',planttype:'',wildlife:''};
const shoppingKey='nativeplantmaps-shopping-v1';
function filtered(){return baseFiltered().filter(v=>(providerMode!=='garden'||isGardenStore(v))&&(providerMode!=='seasonal'||seasonalListing(v))&&(!mapArea||v.lat!=null&&v.lng!=null&&pointWithinArea(v.lng,v.lat,mapArea)));}
function pointWithinArea(lng,lat,bounds){return lat>=bounds[1]&&lat<=bounds[3]&&(bounds[0]<=bounds[2]?lng>=bounds[0]&&lng<=bounds[2]:lng>=bounds[0]||lng<=bounds[2]);}
function clearMapArea(){mapArea=null;manualMapPosition='';document.getElementById('search-map-area')?.setAttribute('hidden','');}
function clearPlaceConnection(){++placeConnectionRequest;localEcoregion='';connectionStatus='';document.getElementById('place-summary').hidden=true;}
async function connectPlaceToPlants(city){
  const request=++placeConnectionRequest;localEcoregion='';connectionStatus='Finding plants suited to this area…';renderPlaceSummary();
  try{const hawaii=city.stateCode==='HI'||city.lat<24&&city.lng< -150;const features=await loadPlantingBoundaries(hawaii?'/api/hawaii-ecoregion-boundaries':'/api/epa-ecoregion-boundaries');if(request!==placeConnectionRequest||!nearbySearch)return;
    localEcoregion=ecoregionAtPoint(city,features);connectionStatus=localEcoregion?'':'The location center is outside the available ecoregion boundaries. Choose an area on the plant map.';
    if(localEcoregion){plantingState='';plantingRegion=Object.keys(plantingRegions).find(id=>plantingRegions[id].states.includes(city.stateCode))||plantingRegion;updateEcoregionPicker('');renderPlantingProfile(localEcoregion,selectedHabitat);const toggle=document.getElementById('ecoregion-toggle');if(!localEcoregion.startsWith('OC')&&toggle.getAttribute('aria-pressed')!=='true')toggle.click();syncMapEcoregionSelection();}
  }catch{if(request!==placeConnectionRequest)return;connectionStatus='Plant boundaries could not load. Nearby nurseries are still available; try Find my ecoregion again.';}
  renderPlaceSummary();scheduleDirectoryState();
}
function renderPlaceSummary(){
  const root=document.getElementById('place-summary');if(!root)return;
  const key=nearbySearch?localEcoregion:ecoregionSearch?.key;
  root.hidden=!nearbySearch&&!ecoregionSearch;if(root.hidden)return;
  const region=guideData.regions[key],count=filtered().length;
  if(!region){root.innerHTML='<p class="section-kicker">Your local planting guide</p><p>'+html(connectionStatus||'Finding your ecoregion…')+'</p>';return;}
  root.innerHTML='<div class="place-summary-copy"><p class="section-kicker">Your ecoregion</p><h2>'+html(region.name)+'</h2><p>'+count+' '+(nearbySearch?'nearby nurseries':'nurseries in this region')+' · Plants for your local habitats.</p><div class="place-summary-actions"><a href="#flora-guide">Explore plants</a><a href="#cards" data-browse-nurseries>Browse nurseries</a></div></div>';
}
function appendConnectedState(params){
  if(providerMode!=='all')params.set('kind',providerMode);if(directoryView!=='list')params.set('view',directoryView);
  if(manualMapPosition)params.set('map',manualMapPosition);if(mapArea)params.set('area',mapArea.map(n=>n.toFixed(4)).join(','));

}
function readConnectedState(params){
  providerMode=['garden','seasonal'].includes(params.get('kind'))?params.get('kind'):'all';
  if(['garden','seasonal'].includes(activeFilter)){providerMode=activeFilter;activeFilter='all';}
  document.getElementById('provider-kind').value=providerMode;
  setDirectoryView(params.get('view')==='map'?'map':'list');
  const parts=(params.get('area')||'').split(',').map(Number);mapArea=parts.length===4&&parts.every(Number.isFinite)&&parts[0]>=-200&&parts[0]<=180&&parts[2]>=-200&&parts[2]<=180&&parts[1]>=-90&&parts[3]<=90&&parts[1]<parts[3]?parts:null;
  Object.keys(plantFilters).forEach(key=>plantFilters[key]='');
  localEcoregion='';manualMapPosition='';
}
async function restoreConnectedState(){const zip=listingSearch?.match(/,\s*[^()]+\s+\((\d{5})\)$/)?.[1];if(!nearbySearch&&zip){try{const response=await fetch('/api/city-suggestions?query='+zip);const data=await response.json();if(response.ok&&data.results?.length===1){applyNearbyCity(data.results[0]);return;}}catch{}}if(nearbySearch)await connectPlaceToPlants(nearbySearch);else renderPlaceSummary();renderSales();}
function validPlantFilter(key,value){return ({light:['sun','shade'],moisture:['dry','moist','wet'],planttype:['tree','shrub','grass','fern','vine','cactus','other'],wildlife:['pollinators','birds','host']})[key]?.includes(value);}
function setDirectoryView(view){directoryView=view==='map'?'map':'list';document.getElementById('map-workspace').dataset.mobileView=directoryView;document.querySelectorAll('[data-directory-view]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.directoryView===directoryView)));if(directoryView==='map')requestAnimationFrame(()=>window.accessMap?.resize());scheduleDirectoryState();}
function restoreMapPosition(value){
  const [type,...values]=(value||'').split(','),p=values.map(Number);if(p.length!==3&&p.length!==4||!p.every(Number.isFinite))return false;
  if(type==='v'&&p.length===3&&p[0]>=-200&&p[0]<=180&&p[1]>=18&&p[1]<=72&&p[2]>=1&&p[2]<=18){manualMapPosition=value;if(window.accessMap)window.accessMap.jumpTo({center:p.slice(0,2),zoom:p[2]});else return false;return true;}
  if(type==='s'&&p.length===4&&Math.abs(p[0])<=3000&&Math.abs(p[1])<=3000&&p[2]>=12&&p[2]<=2000&&Math.abs(p[3]-p[2]*.65)<1){manualMapPosition=value;sketchView={x:p[0],y:p[1],w:p[2],h:p[3]};renderSketchMap();return true;}return false;
}
function mapWasMoved(){
  ++mapFrameRequest;
  const map=window.accessMap;if(map){const c=map.getCenter();manualMapPosition=['v',c.lng.toFixed(4),c.lat.toFixed(4),map.getZoom().toFixed(2)].join(',');}
  else manualMapPosition=['s',sketchView.x.toFixed(3),sketchView.y.toFixed(3),sketchView.w.toFixed(3),sketchView.h.toFixed(3)].join(',');
  document.getElementById('search-map-area').hidden=false;scheduleDirectoryState();
}
function setupMapExperience(map){syncMapEcoregionSelection();map.addSource('directory-hover',{type:'geojson',data:{type:'FeatureCollection',features:[]}});map.addLayer({id:'directory-hover-ring',type:'circle',source:'directory-hover',paint:{'circle-color':'transparent','circle-radius':13,'circle-stroke-color':'#a34b24','circle-stroke-width':3}});map.on('moveend',event=>{if(event.originalEvent)mapWasMoved();});map.on('dragend',mapWasMoved);map.on('zoomend',event=>{if(event.originalEvent)mapWasMoved();});}
function areaFromMap(){
  if(window.accessMap){const b=window.accessMap.getBounds();return [b.getWest(),b.getSouth(),b.getEast(),b.getNorth()];}
  // The schematic has separate Alaska and Hawaiʻi insets; never treat those as mainland coordinates.
  const cx=sketchView.x+sketchView.w/2,cy=sketchView.y+sketchView.h/2;
  if(cx<245&&cy<190)return [ -180+(sketchView.x-35)/210*55,72-(sketchView.y+sketchView.h-30)/120*22,-180+(sketchView.x+sketchView.w-35)/210*55,72-(sketchView.y-30)/120*22];
  if(cx<370&&cy>470)return [-161+(sketchView.x-255)/110*7,23-(sketchView.y+sketchView.h-485)/100*6,-161+(sketchView.x+sketchView.w-255)/110*7,23-(sketchView.y-485)/100*6];
  return [-125+(sketchView.x-350)/600*59,50-(sketchView.y+sketchView.h-65)/535*26,-125+(sketchView.x+sketchView.w-350)/600*59,50-(sketchView.y-65)/535*26];
}
function highlightNursery(id,on){
  const v=vendors.find(item=>String(item.id)===String(id));
  if(window.accessMap?.getSource('directory-hover'))window.accessMap.getSource('directory-hover').setData({type:'FeatureCollection',features:on&&v?.lat!=null&&v?.lng!=null?[{type:'Feature',geometry:{type:'Point',coordinates:[v.lng,v.lat]},properties:{}}]:[]});
  // A separate ring remains visible even when the nursery belongs to a cluster.
  const svg=document.querySelector('#fallback-svg');svg?.querySelector('.listing-hover-ring')?.remove();
  if(svg&&on&&v?.lat!=null&&v?.lng!=null){const [x,y]=sketchProject(v.lat,v.lng,v.state),scale=sketchView.w/Math.max(1,document.getElementById('map').clientWidth||800),ring=document.createElementNS('http://www.w3.org/2000/svg','circle');Object.entries({cx:x,cy:y,r:13*scale,fill:'none',stroke:'#a34b24','stroke-width':3*scale,class:'listing-hover-ring','aria-hidden':'true','pointer-events':'none'}).forEach(([key,value])=>ring.setAttribute(key,String(value)));svg.append(ring);}
}
function renderTrustDetails(v){
  const raw=v.sourceReview?.checkedOn||v.lastVerified||v.websiteProfile?.checkedOn||v.operationCheck?.checkedOn,date=/^\d{4}-\d{2}-\d{2}$/.test(raw||'')?raw:'';
  // Sourcing badges require an explicit claim with its own evidence link.
  const badges=(v.sourcingClaims||[]).filter(x=>x.label&&publicHttpUrl(x.url)).map(x=>'<a class="sourcing-badge" href="'+html(x.url)+'" target="_blank" rel="noreferrer">'+html(x.label)+'</a>').join('');
  return '<div class="listing-trust">'+(date?'<p>Sources reviewed <time datetime="'+date+'">'+html(new Date(date+'T12:00:00Z').toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'}))+'</time></p>':'<p>Listing-specific check date not recorded.</p>')+badges+'<details><summary>What this listing confirms</summary><p>Linked sources document a native-plant offering. Other plants may be sold too; check each species’ local range, seed origin and current availability.</p></details></div>';
}
function bindDirectoryExtras(root){
  root.querySelectorAll('.card').forEach(card=>{card.addEventListener('pointerenter',()=>highlightNursery(card.dataset.id,true));card.addEventListener('pointerleave',()=>highlightNursery(card.dataset.id,false));card.addEventListener('focusin',()=>highlightNursery(card.dataset.id,true));card.addEventListener('focusout',()=>highlightNursery(card.dataset.id,false));});
  root.querySelectorAll('[data-quick-report]').forEach(button=>button.addEventListener('click',()=>openQuickReport(button.dataset.vendorId,button.dataset.quickReport)));
  renderSales();
}
function openQuickReport(id,type){
  const v=vendors.find(v=>String(v.id)===String(id));if(!v)return;
  const dialog=document.getElementById('community-dialog');document.getElementById('community-dialog-title').textContent=v.name;
  document.getElementById('community-dialog-description').textContent='Reports go privately to the editor. Manual review has no guaranteed turnaround; a report never immediately changes a listing.';
  document.getElementById('community-dialog-body').innerHTML='<form id="quick-report-form"><p>'+(type==='incorrect'?'Flag a closure or incorrect listing.':'Report that you saw native plants here today.')+'</p><label>Optional note<textarea name="note" maxlength="1000" placeholder="Plants seen, what changed, or a useful source link"></textarea></label>'+(type==='incorrect'?'<label>Issue<select name="issue"><option>Incorrect information</option><option>Possibly closed</option></select></label>':'')+'<div class="trap" aria-hidden="true"><input name="company" tabindex="-1" aria-hidden="true"></div><button type="submit">Send report</button><p role="status" id="quick-report-status"></p></form>';
  document.getElementById('quick-report-form').addEventListener('submit',async event=>{event.preventDefault();const form=event.currentTarget,b=form.querySelector('button'),status=document.getElementById('quick-report-status'),data=Object.fromEntries(new FormData(form));b.disabled=true;status.textContent='Sending…';try{const r=await fetch('/api/vendor-reports',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({vendorId:id,type:type==='incorrect'?'stock_update':'stock_seen',plantNames:type==='incorrect'?data.issue:'Native plants observed (species not supplied)',note:data.note,company:data.company,observedOn:new Date().toISOString().slice(0,10)})});const result=await r.json();if(!r.ok)throw Error(result.error||'Could not save report');status.textContent='Saved privately for editor review. Thank you.';}catch(e){status.textContent=e.message;b.disabled=false;}});
  if(!dialog.open)dialog.showModal();dialog.querySelector('textarea').focus();
}
function plantTraits(id){
  const s=guideData.species[id],note=guideData.fieldNotes[id]||'',conditions=s[3].toLowerCase();
  const type=/\bcactus|\bcacti|opuntia|carnegiea/i.test(s[1]+' '+note)?'cactus':/\bfern\b|\bferns\b/i.test(note)?'fern':/\bvine\b|\bclimbing\b/i.test(note)?'vine':/\btree\b|\bconifer\b/i.test(note)?'tree':/\bshrub\b/i.test(note)?'shrub':/\bgrass\b|\bsedge\b|\bbunchgrass\b/i.test(note)?'grass':'other';
  return {light:conditions.split(' · ')[0],moisture:conditions.split(' · ').slice(1).join(' '),type,note:note.toLowerCase()};
}
function matchesPlantFilters(id){const t=plantTraits(id);return (!plantFilters.light||t.light.includes(plantFilters.light))&&(!plantFilters.moisture||t.moisture.includes(plantFilters.moisture))&&(!plantFilters.planttype||t.type===plantFilters.planttype)&&(!plantFilters.wildlife||({pollinators:/\bbees?\b|butterfl|hummingbird|pollinators|pollinating insects|flower flies/,birds:/\bbirds?\b|hummingbird/,host:/caterpillar|\bhost\b/})[plantFilters.wildlife].test(t.note));}
function shoppingList(){try{const ids=JSON.parse(localStorage.getItem(shoppingKey)||'[]');return Array.isArray(ids)?ids.filter(id=>guideData.species[id]):[];}catch{return [];}}
function renderPlantFilterControls(){return '<details id="shopping-list"><summary>Saved plants ('+shoppingList().length+')</summary>'+renderShoppingList()+'</details><p><a href="https://nativeplantfinder.nwf.org/" target="_blank" rel="noreferrer">NWF Native Plant Finder</a> · <a href="/browse/">State nursery directories</a></p><details class="society-resources"><summary>State native plant societies</summary><ul>'+Object.entries(stateSocieties).map(([code,society])=>'<li><a href="'+html(society.url)+'" target="_blank" rel="noreferrer">'+html(stateLabels[code])+': '+html(society.name)+'</a></li>').join('')+'</ul></details>';
}
function renderPlantActions(id){return '<div class="plant-actions"><button type="button" data-save-plant="'+html(id)+'" aria-pressed="'+shoppingList().includes(id)+'">'+(shoppingList().includes(id)?'Saved':'Save plant')+'</button><button type="button" data-find-plant="'+html(id)+'">Find growers nearby</button></div>';}
function renderShoppingList(){const ids=shoppingList();return '<p>Saved on this browser. Export includes saved plants and the currently filtered nurseries. Availability is not confirmed.</p>'+(ids.length?'<ul>'+ids.map(id=>'<li>'+html(guideData.species[id][0])+' <button type="button" data-remove-plant="'+html(id)+'">Remove</button></li>').join('')+'</ul><button type="button" data-export-plan>Export shopping CSV</button>':'<p>No saved plants yet.</p>');}
function bindPlantExtras(root){
  root.querySelectorAll('[data-plant-filter]').forEach(select=>select.addEventListener('change',()=>{plantFilters[select.dataset.plantFilter]=select.value;renderPlantingProfile(selectedPlantingKey,selectedHabitat);}));
  root.querySelector('[data-clear-plant-filters]')?.addEventListener('click',()=>{Object.keys(plantFilters).forEach(key=>plantFilters[key]='');renderPlantingProfile(selectedPlantingKey,selectedHabitat)});
  root.querySelectorAll('[data-save-plant],[data-remove-plant]').forEach(button=>button.addEventListener('click',()=>{const id=button.dataset.savePlant||button.dataset.removePlant,set=new Set(shoppingList());if(set.has(id))set.delete(id);else set.add(id);try{localStorage.setItem(shoppingKey,JSON.stringify([...set]));}catch{button.textContent='Storage unavailable';return;}renderPlantingProfile(selectedPlantingKey,selectedHabitat);root.querySelector('[data-save-plant="'+id+'"]')?.focus({preventScroll:true});}));
  root.querySelector('[data-export-plan]')?.addEventListener('click',exportShoppingCsv);
  root.querySelectorAll('[data-find-plant]').forEach(button=>button.addEventListener('click',()=>findPlantGrowers(button.dataset.findPlant)));
}
function findPlantGrowers(id){
  const [name,scientific]=guideData.species[id],matches=filtered().filter(v=>(v.fieldReports||[]).some(r=>String(r.plantNames||'').toLowerCase().includes(scientific.toLowerCase())));
  const dialog=document.getElementById('community-dialog');document.getElementById('community-dialog-title').textContent='Find '+name;document.getElementById('community-dialog-description').textContent='These are native-plant sources in your current search. Ask about this species, seed origin and current inventory; a listing does not confirm stock.';
  const catalog=guideData.planning[id]?.catalog;document.getElementById('community-dialog-body').innerHTML=(catalog?'<p><a href="'+html(catalog.url)+'" target="_blank" rel="noreferrer">'+html(catalog.label||'Nursery catalog reference')+'</a>. Catalog reference only; stock and shipping are not confirmed.</p>':'')+(matches.length?'<h3>Past visitor mentions</h3><p>Reports describe a previous visit, not current stock.</p><ul>'+matches.map(v=>'<li>'+html(v.name)+'</li>').join('')+'</ul>':'')+'<h3>Growers to ask</h3><ul>'+rankListings(filtered()).filter(v=>nurseryPrimaryUrl(v)).slice(0,10).map(v=>'<li><a href="'+html(nurseryPrimaryUrl(v))+'" target="_blank" rel="noreferrer">'+html(v.name)+'</a> · '+html(v.state)+'</li>').join('')+'</ul>'+(!filtered().length?'<p>Search a town or widen your radius to find growers.</p>':'');if(!dialog.open)dialog.showModal();
}
function exportShoppingCsv(){
  const keys=['record_type','name','scientific_name','state','website','ecoregion','height','spread','bloom','spacing','establishment_watering','inventory_note'];
  const rows=[...rankListings(filtered()).map(v=>['nursery',v.name,'',v.state,nurseryPrimaryUrl(v),'','','','','','','Ask the seller; no species inventory is confirmed.']),...shoppingList().map(id=>{const p=guideData.planning[id]||{};return ['plant',guideData.species[id][0],guideData.species[id][1],'',p.catalog?.url||'',guideData.regions[selectedPlantingKey]?.name||'',p.height||'',p.spread||'',p.bloom||'',p.spacing||'',p.watering||guideData.wateringGuidance[p.wateringGroup]?.text||'','Catalog reference only; stock and shipping are not confirmed.'];})];
  const quote=value=>'"'+String(value??'').replaceAll('"','""')+'"',csv=[keys,...rows].map(row=>row.map(quote).join(',')).join('\r\n');const a=document.createElement('a'),url=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}));a.href=url;a.download='nativeplantmaps-shopping-plan.csv';a.click();URL.revokeObjectURL(url);
}
function saleCalendar(v,event){
  const date=event.date,end=event.endDate||date;if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||!/^\d{4}-\d{2}-\d{2}$/.test(end)||end<date||!Number.isFinite(Date.parse(date+'T00:00:00Z'))||new Date(date+'T00:00:00Z').toISOString().slice(0,10)!==date||!Number.isFinite(Date.parse(end+'T00:00:00Z'))||new Date(end+'T00:00:00Z').toISOString().slice(0,10)!==end)return '';
  const next=new Date(end+'T00:00:00Z');next.setUTCDate(next.getUTCDate()+1);const escape=x=>String(x).replace(/\\/g,'\\\\').replace(/\r?\n/g,'\\n').replace(/,/g,'\\,').replace(/;/g,'\\;');
  return ['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//NativePlantMaps//Sales//EN','BEGIN:VEVENT','UID:'+escape(v.id+'-'+date+'@nativeplantmaps.pages.dev'),'DTSTAMP:'+new Date().toISOString().replace(/[-:]/g,'').replace(/\.\d{3}Z/,'Z'),'DTSTART;VALUE=DATE:'+date.replaceAll('-',''),'DTEND;VALUE=DATE:'+next.toISOString().slice(0,10).replaceAll('-',''),'SUMMARY:'+escape(event.title||v.name+' plant sale'),'LOCATION:'+escape(event.location||v.address||v.area),'URL:'+escape(event.source||v.website),'END:VEVENT','END:VCALENDAR',''].join('\r\n');
}
function renderSales(){
  const root=document.getElementById('sale-results');if(!root)return;const now=new Date(),today=new Date(now.getTime()-now.getTimezoneOffset()*60000).toISOString().slice(0,10),all=filtered(),events=all.flatMap(v=>(v.saleEvents||[]).filter(e=>e.source&&saleCalendar(v,e)).map(e=>({v,e}))).sort((a,b)=>a.e.date.localeCompare(b.e.date)),upcoming=events.filter(({e})=>(e.endDate||e.date)>=today),undated=all.filter(v=>seasonalListing(v)&&!(v.saleEvents||[]).some(e=>(e.endDate||e.date)>=today));
  root.innerHTML=(upcoming.length?'<ul>'+upcoming.map(({v,e},i)=>'<li><strong>'+html(e.date)+(e.endDate&&e.endDate!==e.date?' – '+html(e.endDate):'')+'</strong> · <a href="'+html(publicHttpUrl(e.source))+'" target="_blank" rel="noreferrer">'+html(e.title||v.name)+'</a><p>'+html(e.location||v.address)+' · '+html(e.note||'Check current hours with the organizer.')+'</p> <button type="button" data-sale-calendar="'+i+'">Add to calendar</button></li>').join('')+'</ul>':'<p>No dated upcoming sales are confirmed for these filters.</p>')+'<details><summary>Seasonal growers with dates to check ('+undated.length+')</summary><ul>'+undated.map(v=>'<li>'+((nurseryPrimaryUrl(v))?'<a href="'+html(nurseryPrimaryUrl(v))+'" target="_blank" rel="noreferrer">'+html(v.name)+'</a>':html(v.name))+' · '+html(v.state)+'</li>').join('')+'</ul></details>';
  root.querySelectorAll('[data-sale-calendar]').forEach(button=>button.addEventListener('click',()=>{const {v,e}=upcoming[Number(button.dataset.saleCalendar)],url=URL.createObjectURL(new Blob([saleCalendar(v,e)],{type:'text/calendar;charset=utf-8'})),a=document.createElement('a');a.href=url;a.download=v.id+'-sale.ics';a.click();URL.revokeObjectURL(url);}));
}
function setupConnectedExperience(){
  document.getElementById('provider-kind').addEventListener('change',event=>{providerMode=event.target.value;selectedId=null;currentPage=1;render();refreshMapLayers();scheduleDirectoryState();});
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)renderSales()});setInterval(renderSales,15*60*1000);
  document.querySelectorAll('[data-directory-view]').forEach(button=>button.addEventListener('click',()=>setDirectoryView(button.dataset.directoryView)));
  document.getElementById('search-map-area').addEventListener('click',()=>{const bounds=areaFromMap();clearPlaceConnection();nearbySearch=null;ecoregionSearch=null;stateSearch=null;listingSearch='';document.getElementById('state-filter').value='';document.getElementById('search').value='';mapArea=bounds;renderPlantingProfile('');selectedId=null;clusterFocusIds=null;currentPage=1;document.getElementById('search-status').textContent='Showing nurseries in the visible map area.';document.getElementById('search-map-area').hidden=true;render();refreshMapLayers();});
  document.getElementById('use-location').addEventListener('click',()=>{const button=document.getElementById('use-location'),status=document.getElementById('search-status');if(!navigator.geolocation){status.textContent='Location is unavailable in this browser. Enter a town or ZIP instead.';return;}button.disabled=true;const generation=placeConnectionRequest;status.textContent='Waiting for browser location permission…';navigator.geolocation.getCurrentPosition(position=>{button.disabled=false;if(generation!==placeConnectionRequest)return;const lat=Math.round(position.coords.latitude*100)/100,lng=Math.round(position.coords.longitude*100)/100;applyNearbyCity({lat,lng,label:'your approximate location'});},error=>{button.disabled=false;status.textContent=error.code===1?'Location permission was declined. Enter a town or ZIP instead.':'Your location could not be found. Enter a town or ZIP instead.';},{enableHighAccuracy:false,timeout:10000,maximumAge:300000});});
  document.addEventListener('click',event=>{if(event.target.closest('[data-browse-nurseries]'))setDirectoryView('list');const link=event.target.closest('a[href^="#plant-"]');if(!link)return;const id=link.hash.slice(7);if(guideData.species[id]){Object.keys(plantFilters).forEach(key=>plantFilters[key]='');renderPlantingProfile(localEcoregion||selectedPlantingKey,'all');document.getElementById('state-info-tab').click();}});
}

function revealSearchMap(){setDirectoryView('map');document.getElementById('map-workspace').scrollIntoView({block:'start',behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'});}
function syncMapEcoregionSelection(){
 document.querySelectorAll('#fallback-svg [data-planting-key]').forEach(shape=>{const active=shape.dataset.plantingKey===selectedPlantingKey;shape.classList.toggle('search-ecoregion-selected',active);shape.setAttribute('aria-pressed',String(active));});
 const map=window.accessMap,key=selectedPlantingKey||'';
 if(map?.getLayer?.('epa-ecoregions-outline')){const raw=['get','NA_L3KEY'],code=['slice',raw,0,['index-of',' ',raw]];map.setPaintProperty('epa-ecoregions-outline','line-width',['case',['==',code,key],4,1.35]);map.setPaintProperty('epa-ecoregions-outline','line-color',['case',['==',code,key],'#162e24','#607460']);}
}
