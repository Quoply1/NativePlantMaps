import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const page=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const nodes={};const node=id=>nodes[id]??={innerHTML:'',textContent:'',hidden:false,querySelector:()=>({addEventListener(){},focus(){}}),querySelectorAll:()=>[]};
const context=vm.createContext({document:{getElementById:node}});
const labels=page.match(/const stateLabels=\{[^\n]+/)[0];
const escape=page.match(/const html=s=>[^\n]+/)[0];
const societies=page.slice(page.indexOf('    const stateSocieties='),page.indexOf('    // Regional starters'));
const guide=page.slice(page.indexOf('    // Regional starters'),page.indexOf('    async function start()'));
vm.runInContext(labels+'\n'+escape+'\n'+societies+'\n'+guide,context);
vm.runInContext(`
for(const state of Object.keys(stateLabels)){
 if(!plantGuides[statePlantGuides[state]])throw Error('Missing state: '+state);
 renderStateResources(state);
 if(!document.getElementById('planting-profile').innerHTML.includes(stateLabels[state]))throw Error('Missing state heading');
 for(const habitat of Object.keys(habitatLabels))renderPlantingProfile({state},statePlantGuides[state],habitat);
}
renderPlantingProfile({state:'NJ'},undefined,'wet');
`,context);
assert.match(nodes['planting-profile'].innerHTML,/Swamp milkweed/);
assert.doesNotMatch(nodes['planting-profile'].innerHTML,/Butterfly milkweed/);
vm.runInContext("renderPlantingProfile({ecoregion:'Unmatched <region>'})",context);
assert.match(nodes['planting-profile'].innerHTML,/not been matched/);
assert.match(nodes['planting-profile'].innerHTML,/&lt;region&gt;/);
assert.doesNotMatch(nodes['planting-profile'].innerHTML,/class="plant-card"/);
vm.runInContext("renderPlantingProfile({state:'AZ'},'sonoran','wet')",context);
assert.match(nodes['planting-profile'].innerHTML,/No reviewed examples/);
vm.runInContext("renderPlantingProfile({state:'NJ'});renderStateResources('')",context);
assert.equal(nodes['selected-state-resources'].hidden,true);
assert.doesNotMatch(nodes['planting-profile'].innerHTML,/Pica Bella/);
assert.equal(vm.runInContext("guideForEcoregion('Sonoran Basin and Range')",context),'sonoran');
console.log('Passed: 51 state profiles, habitat branches, unmatched ecoregions, empty results, escaping and selection reset.');

vm.runInContext(`
for(const [key,region] of Object.entries(njEcoregions)){
 const context={ecoregion:region.aliases?.[0]||region.name,key:key+'  '+region.name};
 for(const habitat of ['sun','shade','wet']){
  renderPlantingProfile(context,undefined,habitat);
  if(plantingGuide!==region.guide)throw Error('Wrong ecoregion: '+key);
  const plants=plantGuides[plantingGuide].plants.filter(p=>p[2]===habitat);
  if(!plants.length||plants.some(p=>!plantPhotos[p[1]]))throw Error('Missing plant photo: '+key+' '+habitat);
 }
}
renderPlantingProfile({state:'NJ',ecoregion:'Atlantic Coastal Pine Barrens',key:'8.5.4'},undefined,'wet');
`,context);
assert.match(nodes['planting-profile'].innerHTML,/Hummingbird/);
assert.doesNotMatch(nodes['planting-profile'].innerHTML,/Emerald Blue|Shamrock|Sweetfern/);
vm.runInContext("renderPlantingProfile({ecoregion:'Northern Appalachian and Atlantic Maritime Highlands',key:'5.3.1  Northern Appalachian and Atlantic Maritime Highlands'},undefined,'sun')",context);
assert.match(nodes['planting-profile'].innerHTML,/Emerald Blue/);
assert.doesNotMatch(nodes['planting-profile'].innerHTML,/Beach plum|Hummingbird/);
console.log('Passed: all five New Jersey ecoregion keys, habitat photo coverage and separate cultivar suggestions.');
