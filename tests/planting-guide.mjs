import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const read = path => readFileSync(new URL(path, import.meta.url), 'utf8');
const page = read('../index.html');
const data = JSON.parse(read('../ecoregion-guides.json'));
const directory = JSON.parse(read('../ecoregion-search.json'));
const nodes = new Map();
const node = id => {
  if (!nodes.has(id)) nodes.set(id, {
    innerHTML: '', value: '', append(){}, addEventListener(){},
    querySelectorAll: () => []
  });
  return nodes.get(id);
};
node('ecoregion-guide-data').textContent = JSON.stringify(data);
node('ecoregion-directory-data').textContent = JSON.stringify(directory);
const context = vm.createContext({
  document: {getElementById: node, createElement: () => ({append(){}})},
  Option: class {},
  encodeURIComponent
});
const escape = page.match(/const html=s=>[^\n]+/)[0];
const guide = page.slice(page.indexOf('    const guideData='), page.indexOf('    function renderStateResources'));
vm.runInContext(escape + '\n' + guide, context);
vm.runInContext('setupEcoregionPicker()', context);

assert.equal(Object.keys(data.regions).filter(key => !key.startsWith('OC')).length, 104);
assert.equal(Object.keys(data.regions).filter(key => key.startsWith('OC')).length, 4);
for (const [key, region] of Object.entries(data.regions)) {
  vm.runInContext('renderPlantingProfile(' + JSON.stringify(key + '  ' + region.name) + ')', context);
  assert.equal(node('plant-ecoregion').value, key);
  assert.ok(region.plants.length >= 4, key);
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
assert.equal(node('plant-ecoregion').value, '');
assert.doesNotMatch(page, /statePlantGuides|New Jersey ecoregion/);
console.log('Passed: 108 ecoregion profiles, EPA key parsing, photo and native-range coverage, habitat filters and unsupported areas.');

const searchHelpers = page.slice(page.indexOf('    function normalizedEcoregionQuery'), page.indexOf('    async function updateCitySuggestions'));
const normalize = page.match(/function normalizedPlaceQuery[^\n]+/)[0];
vm.runInContext(normalize + '\n' + searchHelpers, context);
assert.equal(vm.runInContext("exactEcoregion('hawaii tropical dry forest')", context), 'OC0202');
assert.equal(vm.runInContext("ecoregionSearchMatches('pine barrens')[0][0]", context), '8.5.4');
assert.equal(vm.runInContext("exactEcoregion('10.2.2')", context), '10.2.2');
assert.ok(directory['10.2.2'].vendorIds.length > 0);
assert.ok(directory['7.1.9'].vendorIds.some(id => !directory['10.2.2'].vendorIds.includes(id)));
console.log('Passed: nationwide catalog expansion, ecoregion name and code search, and provider boundary index.');
