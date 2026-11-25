// Shared directory state, map framing, location lookup and garden planning UI.
let directoryReady=false,restoringDirectory=false,stateWritePending=false,restoreRequest=0,mapFrameRequest=0,selectedHabitat='all',ecoregionOrigin='';
const directoryParams=['type','state','eco','q','near','lat','lng','radius','page','listing','garden','habitat','overlay','browse','from','kind','view','map','area','light','moisture','planttype','wildlife'];
function syncTypeFilter(){
  document.querySelectorAll('[data-filter]').forEach(button=>{
    const active=button.dataset.filter===activeFilter;
    button.classList.toggle('active',active);button.setAttribute('aria-pressed',String(active));
  });
}
function directoryStateParams(){
  const params=new URLSearchParams();
  if(activeFilter!=='all')params.set('type',activeFilter);
  const state=stateSearch||document.getElementById('state-filter').value;
  if(state)params.set('state',state);
  if(ecoregionSearch){params.set('eco',ecoregionSearch.key);if(ecoregionOrigin)params.set('from',ecoregionOrigin);}
  if(listingSearch)params.set('q',listingSearch);
  if(nearbySearch){params.set('near',nearbySearch.label);params.set('lat',String(nearbySearch.lat));params.set('lng',String(nearbySearch.lng));}
  if(searchRadius!==50)params.set('radius',String(searchRadius));
  if(currentPage>1)params.set('page',String(currentPage));
  if(selectedId)params.set('listing',String(selectedId));
  if(plantingRegion)params.set('browse',plantingRegion);
  if(selectedPlantingKey&&!ecoregionSearch)params.set('garden',selectedPlantingKey);
  if(selectedPlantingKey&&selectedHabitat!=='all')params.set('habitat',selectedHabitat);
  if(document.getElementById('ecoregion-toggle').getAttribute('aria-pressed')==='true')params.set('overlay','1');
  appendConnectedState(params);return params;
}
function scheduleDirectoryState(){
  if(!directoryReady||restoringDirectory||stateWritePending)return;
  stateWritePending=true;const generation=restoreRequest;
  queueMicrotask(()=>{
    stateWritePending=false;
    if(restoringDirectory||generation!==restoreRequest)return;
    const url=new URL(location.href),params=directoryStateParams();
    directoryParams.forEach(key=>url.searchParams.delete(key));
    params.forEach((value,key)=>url.searchParams.set(key,value));
    if(url.href!==location.href)history.pushState({nativePlantMaps:true},'',url);
  });
}
async function restoreDirectoryState(){
  const request=++restoreRequest;restoringDirectory=true;stateWritePending=false;
  try{
    const params=new URL(location.href).searchParams;
    activeFilter=['all','specialist','documented','garden','confirmed','seasonal'].includes(params.get('type'))?params.get('type'):'all';
    stateSearch=stateLabels[params.get('state')]?params.get('state'):null;
    document.getElementById('state-filter').value=stateSearch||'';
    const radius=Number(params.get('radius')||50);searchRadius=radius===125?100:[10,25,50,100,200].includes(radius)?radius:50;
    document.getElementById('search-radius').value=String(searchRadius);
    nearbySearch=null;ecoregionSearch=null;listingSearch='';clusterFocusIds=null;clusterFocusCount=0;selectedId=null;
    const eco=params.get('eco');
    if(guideData.regions[eco]&&ecoregionDirectory[eco]&&(!stateSearch||guideData.stateRegions[stateSearch]?.includes(eco)))ecoregionSearch={key:eco,name:guideData.regions[eco].name,vendorIds:new Set(ecoregionDirectory[eco].vendorIds)};
    const lat=Number(params.get('lat')),lng=Number(params.get('lng'));
    if(!ecoregionSearch&&params.get('near')&&params.has('lat')&&params.has('lng')&&lat>=18&&lat<=72&&lng>=-200&&lng<=-60){nearbySearch={label:params.get('near').slice(0,160),lat,lng};stateSearch=null;document.getElementById('state-filter').value='';}
    if(!ecoregionSearch&&!nearbySearch)listingSearch=(params.get('q')||'').slice(0,160).toLowerCase();
    document.getElementById('search').value=ecoregionSearch?.name||nearbySearch?.label||listingSearch||(stateSearch?stateLabels[stateSearch]:'');
    readConnectedState(params);syncTypeFilter();closeCitySuggestions();
    plantingRegion=plantingRegions[params.get('browse')]?params.get('browse'):'';
    updateEcoregionPicker(stateSearch||'');renderStateResources(stateSearch||'');
    ecoregionOrigin=ecoregionSearch?(params.get('from')||'').slice(0,160):'';
    const garden=ecoregionSearch?.key||params.get('garden');
    const habitat=['all','open','shade','wet'].includes(params.get('habitat'))?params.get('habitat'):'all';
    renderPlantingProfile(guideData.regions[garden]?garden:'',habitat);
    const matches=filtered(),id=params.get('listing');
    if(id&&matches.some(v=>String(v.id)===id))selectedId=id;
    lastPageSignature=rankListings(matches).map(v=>v.id).join('|');
    const count=clusterFocusIds?matches.filter(v=>clusterFocusIds.includes(String(v.id))).length:matches.length;
    currentPage=Math.max(1,Math.min(Math.ceil(count/PAGE_SIZE)||1,Math.floor(Number(params.get('page')))||1));
    if(selectedId){const index=rankListings(matches).findIndex(v=>String(v.id)===String(selectedId));currentPage=Math.floor(index/PAGE_SIZE)+1;}
    const toggle=document.getElementById('ecoregion-toggle'),overlay=params.get('overlay')==='1';
    if((toggle.getAttribute('aria-pressed')==='true')!==overlay)toggle.click();
    document.getElementById('search-status').textContent=ecoregionSearch?(ecoregionOrigin?ecoregionOrigin+': ':'Ecoregion: ')+ecoregionSearch.name+'. Filtered by mapped location.':nearbySearch?'Within '+searchRadius+' miles of '+nearbySearch.label:listingSearch?'Showing listings matching “'+listingSearch+'”.':stateSearch?'Showing nurseries in '+stateLabels[stateSearch]+'.':'';
    render();refreshMapLayers();
    restoringDirectory=false;
    if(!restoreMapPosition(params.get('map')))frameDirectoryMap({duration:0});
    if(request!==restoreRequest)return;
    if(location.hash==='#about')document.getElementById('about-map-tab').click();
    else document.getElementById('state-info-tab').click();
  }finally{if(request===restoreRequest)restoringDirectory=false;}
}
function geometryBounds(features,state=''){
  const points=[];
  const visit=coordinates=>{if(typeof coordinates?.[0]==='number'){let [lng,lat]=coordinates;if(state==='AK'&&lng>0)lng-=360;points.push([lng,lat]);}else coordinates?.forEach(visit);};
  features.forEach(feature=>visit(feature.geometry?.coordinates));
  if(!points.length)return null;
  return [[Math.min(...points.map(p=>p[0])),Math.min(...points.map(p=>p[1]))],[Math.max(...points.map(p=>p[0])),Math.max(...points.map(p=>p[1]))]];
}
async function boundsForState(code){
  if(stateBounds[code])return stateBounds[code];
  try{const features=await loadPlantingBoundaries(stateBoundaryUrl);const bounds=geometryBounds(features.filter(f=>f.properties?.STUSAB===code),code);if(bounds)stateBounds[code]=bounds;return bounds;}catch{
    const places=vendors.filter(v=>v.state===code&&v.lat!=null&&v.lng!=null);
    return places.length?geometryBounds(places.map(v=>({geometry:{coordinates:[v.lng,v.lat]}})),code):null;
  }
}
function frameMapBounds(bounds,state='',duration=450){
  if(!bounds||!bounds.flat().every(Number.isFinite))return;
  const reduced=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if(window.accessMap){window.accessMap.fitBounds(bounds,{padding:45,duration:reduced?0:duration,maxZoom:9});return;}
  const [[west,south],[east,north]]=bounds;
  const hint=state||((south+north)/2>50?'AK':(west+east)/2<-150?'HI':'');
  const points=[[west,south],[west,north],[east,south],[east,north]].map(([lng,lat])=>sketchProject(lat,lng,hint));
  const xs=points.map(p=>p[0]),ys=points.map(p=>p[1]);
  const w=Math.max(12,(Math.max(...xs)-Math.min(...xs))*1.3,(Math.max(...ys)-Math.min(...ys))*1.3/.65),h=w*.65;
  const end={x:(Math.min(...xs)+Math.max(...xs))/2-w/2,y:(Math.min(...ys)+Math.max(...ys))/2-h/2,w,h};
  const svg=document.querySelector('#fallback-svg'),start={...sketchView},token=++sketchFlight;
  if(!svg||!duration||reduced||!stateBoundaryFeatures.length){sketchView=end;renderSketchMap();return;}
  svg.querySelector?.('.sketch-regional-labels')?.setAttribute('visibility',end.w<450?'hidden':'visible');
  const began=performance.now();
  const step=now=>{if(token!==sketchFlight||!svg.isConnected)return;const t=Math.min(1,(now-began)/duration),ease=t*t*(3-2*t);sketchView=Object.fromEntries(Object.keys(end).map(key=>[key,start[key]+(end[key]-start[key])*ease]));svg.setAttribute('viewBox',`${sketchView.x} ${sketchView.y} ${sketchView.w} ${sketchView.h}`);if(t<1)requestAnimationFrame(step);else renderSketchMap();};step(began);
}
async function frameDirectoryMap({duration=450}={}){
  const request=++mapFrameRequest,state=stateSearch||document.getElementById('state-filter').value;
  let bounds=null,hint=state;
  const selected=selectedId&&vendors.find(v=>String(v.id)===String(selectedId));
  if(selected?.lat!=null&&selected?.lng!=null){bounds=[[selected.lng-.05,selected.lat-.04],[selected.lng+.05,selected.lat+.04]];hint=selected.state;}
  else if(ecoregionSearch){bounds=ecoregionDirectory[ecoregionSearch.key]?.bounds;if(state){const local=await boundsForState(state);if(local&&bounds){const clipped=[[Math.max(bounds[0][0],local[0][0]),Math.max(bounds[0][1],local[0][1])],[Math.min(bounds[1][0],local[1][0]),Math.min(bounds[1][1],local[1][1])]];if(clipped[0][0]<clipped[1][0]&&clipped[0][1]<clipped[1][1])bounds=clipped;}}}
  else if(nearbySearch){const {lat,lng}=nearbySearch,dy=searchRadius/69,dx=searchRadius/(69*Math.max(.25,Math.cos(lat*Math.PI/180)));bounds=[[lng-dx,lat-dy],[lng+dx,lat+dy]];}
  else if(state)bounds=await boundsForState(state);
  else if(listingSearch){const places=filtered().filter(v=>v.lat!=null&&v.lng!=null);if(places.length){bounds=geometryBounds(places.map(v=>({geometry:{coordinates:[v.lng,v.lat]}})));hint=places.every(v=>v.state===places[0].state)?places[0].state:'';}}
  if(request!==mapFrameRequest)return;
  if(bounds)frameMapBounds(bounds,hint,duration);else resetMap({duration});
}
function pointInRing(lng,lat,ring){
  if(!Array.isArray(ring)||ring.length<3)return false;
  const normalized=ring.map(([x,y])=>{while(x-lng>180)x-=360;while(x-lng< -180)x+=360;return [x,y];});
  let inside=false;
  for(let i=0,j=normalized.length-1;i<normalized.length;j=i++){
    const [xi,yi]=normalized[i],[xj,yj]=normalized[j],cross=(lng-xi)*(yj-yi)-(lat-yi)*(xj-xi);
    if(Math.abs(cross)<1e-9&&lng>=Math.min(xi,xj)&&lng<=Math.max(xi,xj)&&lat>=Math.min(yi,yj)&&lat<=Math.max(yi,yj))return true;
    if((yi>lat)!==(yj>lat)&&lng<(xj-xi)*(lat-yi)/(yj-yi)+xi)inside=!inside;
  }
  return inside;
}
function ecoregionAtPoint(city,features){
  const {lat,lng}=city;
  for(const feature of features){
    const key=ecoregionKey(feature.properties?.NA_L3KEY||hawaiiPlantingKeys[feature.properties?.ECO_NAME]);
    if(!key||city.stateCode&&!guideData.stateRegions[city.stateCode]?.includes(key))continue;
    if(plantingPolygons(feature.geometry).some(polygon=>pointInRing(lng,lat,polygon[0])&&!polygon.slice(1).some(hole=>pointInRing(lng,lat,hole))))return key;
  }
  return '';
}
let finderRequest=0;
function setupEcoregionFinder(){
  const dialog=document.getElementById('ecoregion-finder'),form=document.getElementById('finder-form'),input=document.getElementById('finder-place'),status=document.getElementById('finder-status'),choices=document.getElementById('finder-choices'),button=document.getElementById('finder-submit');
  document.querySelectorAll('[data-find-ecoregion]').forEach(trigger=>trigger.addEventListener('click',()=>{status.textContent='';choices.replaceChildren();if(!dialog.open)dialog.showModal();input.focus();}));
  const cancel=()=>{++finderRequest;button.disabled=false;};dialog.addEventListener('close',cancel);
  document.getElementById('finder-cancel').addEventListener('click',()=>dialog.close());
  const locate=async(city,request)=>{
    status.textContent='Finding the ecoregion around '+city.label+'…';choices.replaceChildren();button.disabled=true;
    try{
      const hawaii=city.stateCode==='HI'||city.lat<24&&city.lng< -150;
      const features=await loadPlantingBoundaries(hawaii?'/api/hawaii-ecoregion-boundaries':'/api/epa-ecoregion-boundaries');
      if(request!==finderRequest||!dialog.open)return;
      const key=ecoregionAtPoint(city,features);
      if(!key){status.textContent='This town or ZIP center falls outside the available land boundaries. Choose a nearby ecoregion on the map instead.';return;}
      if(city.stateCode){plantingRegion=Object.keys(plantingRegions).find(id=>plantingRegions[id].states.includes(city.stateCode))||plantingRegion;updateEcoregionPicker('');}
      applyEcoregionSearch(key,{preserveState:false,openGuide:true});ecoregionOrigin=city.label;
      document.getElementById('search-status').textContent=city.label+': '+guideData.regions[key].name+'. Based on the town or ZIP center; check the map if you live near a boundary.';
      dialog.close();document.getElementById('flora-guide').scrollIntoView({block:'start',behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'});
    }catch{if(request===finderRequest)status.textContent='Ecoregion boundaries could not load. Try again or choose an ecoregion by name.';}finally{if(request===finderRequest)button.disabled=false;}
  };
  form.addEventListener('submit',async event=>{
    event.preventDefault();const query=input.value.trim();if(query.length<2)return;
    const request=++finderRequest;choices.replaceChildren();status.textContent='Looking up your place…';button.disabled=true;
    try{
      const response=await fetch('/api/city-suggestions?query='+encodeURIComponent(query),{signal:AbortSignal.timeout(10000)}),data=await response.json();
      if(request!==finderRequest||!dialog.open)return;
      if(!response.ok)throw new Error(data.error||'Location lookup unavailable.');
      const results=(data.results||[]).filter(city=>Number.isFinite(city.lat)&&Number.isFinite(city.lng));
      if(!results.length){status.textContent='No matching U.S. town or ZIP code. Try a five-digit ZIP or add the state, such as Madison, WI.';return;}
      if(results.length===1){await locate(results[0],request);return;}
      status.textContent='Choose the matching town:';
      results.forEach(city=>{const choice=document.createElement('button');choice.type='button';choice.textContent=city.label;choice.addEventListener('click',()=>locate(city,++finderRequest));choices.append(choice);});
    }catch(error){if(request===finderRequest)status.textContent=error.message||'Location lookup could not load. Try again.';}finally{if(request===finderRequest)button.disabled=false;}
  });
}
function renderPlantPlanning(id){
  const plan=guideData.planning?.[id];if(!plan)return '';
  const water=guideData.wateringGuidance?.[plan.wateringGroup];
  const facts=[['Mature height',plan.height],['Mature spread',plan.spread],['Bloom time',plan.bloom]];
  const sources=(plan.sources||[]).map(source=>'<a href="'+html(source.url)+'" target="_blank" rel="noreferrer">'+html(source.label)+'</a>').join(' · ');
  const catalog=plan.catalog;
  return '<section class="plant-plan"><dl class="planning-summary">'+facts.map(([label,value])=>'<div><dt>'+label+'</dt><dd>'+html(value||'Not listed in these references')+'</dd></div>').join('')+'</dl><details class="plant-planning"><summary>Spacing & establishment care</summary><p><strong>Spacing</strong> '+html(plan.spacing||'Ask the nursery about spacing for its plant form and your planting layout.')+'</p><p><strong>Establishment watering</strong> '+html(plan.watering||water?.text||'Follow the nursery’s establishment guidance for your soil and climate.')+'</p>'+(plan.wateringNote?'<p class="planning-note"><strong>Species water needs</strong> '+html(plan.wateringNote)+'</p>':'')+(water?'<p class="planning-sources"><a href="'+html(water.source.url)+'" target="_blank" rel="noreferrer">'+html(water.source.label)+'</a> · General guidance; adapt to your site.</p>':'')+'<p class="planning-note">Bloom timing varies with climate and elevation. Sizes describe the species or stated local form; cultivars can differ. Spread-based spacing is a planning allowance.</p>'+(sources?'<p class="planning-sources">Growing references: '+sources+'</p>':'')+(catalog?'<p><a href="'+html(catalog.url)+'" target="_blank" rel="noreferrer">'+html(catalog.label||'Nursery plant information')+'</a><br><small>Catalog reference only; current stock and shipping are not confirmed.</small></p>':'')+'</details></section>';
}
function setupDirectoryExperience(){
  setupEcoregionFinder();setupConnectedExperience();
  window.addEventListener('popstate',async()=>{await restoreDirectoryState();await restoreConnectedState()});
  document.addEventListener('click',event=>{if(event.target.closest('[data-info-tab],a[href^="#"]'))scheduleDirectoryState();});
}
