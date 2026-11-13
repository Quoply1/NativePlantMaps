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
