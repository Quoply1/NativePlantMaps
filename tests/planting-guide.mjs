import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const read = path => readFileSync(new URL(path, import.meta.url), 'utf8');
const page = read('../index.html');
const data = JSON.parse(read('../ecoregion-guides.json'));
const directory = JSON.parse(read('../ecoregion-search.json'));
const nodes = new Map();
const polygon = (west, south) => ({type:'Polygon', coordinates:[[
  [west, south], [west+0.3, south], [west+0.3, south+0.3], [west, south+0.3], [west, south]
]]});
const stateFeature = (code, west, south) => ({properties:{STUSAB:code}, geometry:polygon(west,south)});
const regionFeature = (key, west, south) => ({properties:{NA_L3KEY:key}, geometry:polygon(west,south)});
const stateFeatures = [
  stateFeature('NJ',-75,40),stateFeature('HI',-156,20),
  ...['PA','DE','MD','DC','VA'].map((code,i)=>stateFeature(code,-76+i*0.1,39))
];
const epaFeatures = data.stateRegions.NJ.map((key,i) => regionFeature(key,-75+i*0.02,40));
const hawaiiFeatures = ['moist forests','dry forests','high shrublands','low shrublands'].map((name,i) => ({
  properties:{ECO_NAME:'Hawaii tropical '+name}, geometry:polygon(-156+i*0.02,20)
}));
const featuresByUrl = {
  '/api/state-boundaries':stateFeatures,
  '/api/epa-ecoregion-boundaries':epaFeatures,
  '/api/hawaii-ecoregion-boundaries':hawaiiFeatures
};
const requested = [];
const node = id => {
  if (!nodes.has(id)) nodes.set(id, {
    innerHTML: '', textContent: '', open: false, hidden: false, listeners: {},
    get firstElementChild(){return this.innerHTML ? {} : null},
    replaceChildren(){this.innerHTML=''},
    addEventListener(type,handler){this.listeners[type]=handler},
    querySelectorAll(selector){
      if(id!=='plant-map-stage'||selector!=='[data-planting-key]')return [];
      if(this.markup!==this.innerHTML){
        this.markup=this.innerHTML;
        this.shapes=[...this.innerHTML.matchAll(/data-planting-key="([^"]+)"/g)].map(([,key])=>({
          dataset:{plantingKey:key},listeners:{},
          addEventListener(type,handler){this.listeners[type]=handler}
        }));
      }
      return this.shapes;
    }
  });
  return nodes.get(id);
};
node('ecoregion-guide-data').textContent = JSON.stringify(data);
node('ecoregion-directory-data').textContent = JSON.stringify(directory);
const context = vm.createContext({revealSearchMap(){},syncMapEcoregionSelection(){},setDirectoryView(){},clearMapArea(){},clearPlaceConnection(){},connectPlaceToPlants(){},renderPlaceSummary(){},renderTrustDetails(){return ''},bindDirectoryExtras(){},matchesPlantFilters(){return true},renderPlantFilterControls(){return ''},renderPlantActions(){return ''},bindPlantExtras(){},scheduleDirectoryState(){},renderPlantPlanning(){return ""},
  document: {getElementById: node},
  AbortSignal,
  fetch: async url => {
    requested.push(url);
    return {ok:true,json:async()=>({type:'FeatureCollection',features:featuresByUrl[url]})};
  },
  encodeURIComponent
});
const escape = page.match(/const html=s=>[^\n]+/)[0];
const guide = page.slice(page.indexOf('    const guideData='), page.indexOf('    function renderStateResources'));
const states = page.match(/const stateLabels=\{[^\n]+/)[0];
const regions = page.match(/const macroRegions=\{[^\n]+/)[0];
const evalGuide = script => vm.runInContext(script, context);
evalGuide(regions + '\n' + states + '\n' + escape + "\nconst stateBoundaryUrl='/api/state-boundaries';\n" + guide);
vm.runInContext('setupEcoregionPicker()', context);

assert.equal(Object.keys(data.regions).filter(key => !key.startsWith('OC')).length, 104);
assert.equal(Object.keys(data.regions).filter(key => key.startsWith('OC')).length, 4);
for (const [key, region] of Object.entries(data.regions)) {
  vm.runInContext('renderPlantingProfile(' + JSON.stringify(key + '  ' + region.name) + ')', context);
  assert.equal(evalGuide('selectedPlantingKey'), key);
  assert.ok(region.plants.length >= 5, key);
  assert.equal(new Set(region.plants).size, region.plants.length, key);
  assert.ok(region.plants.some(id => data.plantSources[id]), key);
  assert.ok(directory[key].bounds.flat().every(Number.isFinite), key);
  assert.equal((node('planting-profile').innerHTML.match(/class="plant-card"/g) || []).length, region.plants.length);
  for (const id of region.plants) {
    const [name, scientific, habitat, conditions, native] = data.species[id];
    assert.ok(name && conditions && native && data.photos[scientific]?.license, id);
    assert.ok(['open', 'shade', 'wet'].includes(habitat), id);
    assert.ok(node('planting-profile').innerHTML.includes(scientific), key + ' ' + scientific);
  }
}
vm.runInContext("renderPlantingProfile('10.2.2 Sonoran Desert')", context);
assert.match(node('planting-profile').innerHTML, /Fairy duster/);
assert.doesNotMatch(node('planting-profile').innerHTML, /data-habitat="wet"|Sweetfern/);
vm.runInContext("renderPlantingProfile('8.5.4 Atlantic Coastal Pine Barrens', 'wet')", context);
assert.match(node('planting-profile').innerHTML, /Hummingbird/);
assert.doesNotMatch(node('planting-profile').innerHTML, /Sweetfern/);
vm.runInContext("renderPlantingProfile('0.0.0 Water')", context);
assert.match(node('planting-profile').innerHTML, /outside the current U.S./);
assert.equal(evalGuide('selectedPlantingKey'), '');
assert.doesNotMatch(page, /statePlantGuides|New Jersey ecoregion/);
console.log('Passed: 108 ecoregion profiles, EPA key parsing, photo and native-range coverage, habitat filters and unsupported areas.');

const searchHelpers = page.slice(page.indexOf('    function normalizedEcoregionQuery'), page.indexOf('    async function updateCitySuggestions'));
const normalize = page.match(/function normalizedPlaceQuery[^\n]+/)[0];
vm.runInContext(normalize + '\n' + searchHelpers, context);
// Geometry tests exercise the selection bridge; full directory behavior is covered separately.
context.applyEcoregionSearch=key=>evalGuide('renderPlantingProfile('+JSON.stringify(key)+')');
assert.equal(vm.runInContext("exactEcoregion('hawaii tropical dry forest')", context), 'OC0202');
assert.equal(vm.runInContext("ecoregionSearchMatches('pine barrens')[0][0]", context), '8.5.4');
assert.equal(vm.runInContext("exactEcoregion('10.2.2')", context), '10.2.2');
assert.ok(directory['10.2.2'].vendorIds.length > 0);
assert.ok(directory['7.1.9'].vendorIds.some(id => !directory['10.2.2'].vendorIds.includes(id)));
console.log('Passed: nationwide catalog expansion, ecoregion name and code search, and provider boundary index.');


assert.equal(Object.keys(data.stateRegions).length, 51);
const optionValues = () => [...node('plant-ecoregion-names').innerHTML.matchAll(/data-planting-key="([^"]+)"/g)].map(match=>match[1]);
assert.equal(evalGuide('Object.keys(stateLabels).every(code=>guideData.stateRegions[code]?.length)'), true);
assert.equal(evalGuide('new Set(Object.values(plantingRegions).flatMap(region=>plantingEntries(region.states).map(([key])=>key))).size'), 108);

evalGuide("renderPlantingProfile('10.2.2')");
assert.equal(evalGuide('plantingRegion'), 'southwest');
assert.match(node('plant-regions').innerHTML, /Mid-Atlantic/);
await evalGuide("updateEcoregionPicker('NJ')");
assert.deepEqual(optionValues().sort(), ['5.3.1', '8.3.1', '8.4.1', '8.5.1', '8.5.4']);
assert.equal(evalGuide('selectedPlantingKey'), '');
assert.doesNotMatch(node('planting-profile').innerHTML, /Fairy duster/);
assert.match(node('plant-map-stage').innerHTML, /clip-path="url\(#plant-map-clip\)"/);
assert.equal((node('plant-map-stage').innerHTML.match(/class="eco-shape"/g) || []).length,5);
assert.equal(node('plant-name-picker').open,false);
const pineBarrensShape=node('plant-map-stage').querySelectorAll('[data-planting-key]').find(shape=>shape.dataset.plantingKey==='8.5.4');
pineBarrensShape.listeners.click();
let prevented=false;
pineBarrensShape.listeners.keydown({key:'Enter',preventDefault(){prevented=true}});
assert.equal(prevented,true);
assert.equal(evalGuide('selectedPlantingKey'),'8.5.4');
assert.match(node('planting-profile').innerHTML,/Atlantic Coastal Pine Barrens/);
await evalGuide("updateEcoregionPicker('NY')");
assert.equal(evalGuide('selectedPlantingKey'), '8.5.4');
assert.equal(node('plant-name-picker').open,true);
assert.match(node('plant-map-status').textContent,/temporarily unavailable/);

const pending = evalGuide("updateEcoregionPicker('NJ')");
await evalGuide("updateEcoregionPicker('HI')");
await pending;
assert.deepEqual(optionValues().sort(), ['OC0106', 'OC0202', 'OC0701', 'OC0702']);
assert.match(node('plant-map-stage').innerHTML,/Interactive ecoregion map of Hawaiʻi/);
assert.equal((node('plant-map-stage').innerHTML.match(/class="eco-shape"/g) || []).length,4);
assert.equal(requested.filter(url=>url==='/api/epa-ecoregion-boundaries').length,1);
evalGuide("plantingRegion=''; updateEcoregionPicker('')");
assert.equal(node('plant-map-panel').hidden,true);
assert.deepEqual(optionValues(),[]);
node('plant-regions').listeners.click({target:{closest:()=>({dataset:{plantingRegion:'midatlantic'}})}});
await evalGuide("updateEcoregionPicker('')");
assert.equal(evalGuide('plantingRegion'),'midatlantic');
assert.equal(node('plant-map-panel').hidden,false);
assert.match(node('plant-map-stage').innerHTML,/Interactive ecoregion map of Mid-Atlantic/);
assert.equal(node('plant-name-picker').open,true);
assert.equal(evalGuide("plantingMapExtent([],false,true)(-157,20).every(Number.isFinite)"),true);
console.log('Passed: region coverage, state filtering, map geometry, name selection, Hawaiʻi, stale requests, and boundary failure fallback.');
