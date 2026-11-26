import {readFileSync} from 'node:fs';import vm from 'node:vm';import assert from 'node:assert/strict';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8'),page=read('index.html'),guide=JSON.parse(read('ecoregion-guides.json')),review=JSON.parse(read('plant-planning-review.json'));
const context=vm.createContext({guideData:guide});vm.runInContext(page.match(/const html=s=>[^\n]+/)[0]+'\n'+read('client-experience.js'),context);
assert.equal(Object.keys(guide.planning).length,Object.keys(guide.species).length);assert.equal(review.species.length,Object.keys(guide.species).length);assert.ok(review.species.length>=215);
let catalogs=0;
for(const [id,species]of Object.entries(guide.species)){
 const plan=guide.planning[id];assert.ok(plan,id);assert.ok(plan.height,id+' height');assert.ok(plan.bloom,id+' bloom');assert.ok(plan.sources.length,id+' sources');
 for(const source of plan.sources)assert.ok(/^https?:\/\//.test(source.url),id);
 const markup=context.renderPlantPlanning(id);assert.match(markup,/Mature height/);assert.match(markup,/Mature spread/);assert.match(markup,/Bloom time/);assert.match(markup,/Spacing &amp; establishment care|Spacing & establishment care/);assert.match(markup,/Establishment watering/);
 if(plan.wateringGroup){assert.ok(guide.wateringGuidance[plan.wateringGroup]);assert.ok(markup.includes(guide.wateringGuidance[plan.wateringGroup].source.url));assert.match(markup,/General guidance; adapt to your site/);}
 if(plan.catalog){catalogs++;assert.match(markup,/current stock and shipping are not confirmed/);assert.ok(markup.includes(plan.catalog.url.replaceAll('&','&amp;')));}
 assert.ok(!/available now|in stock now|inventory confirmed/i.test(markup));
}
assert.ok(catalogs>=58);assert.ok(guide.planningMetadata.counts.bloomMonths>=118);assert.ok(guide.planning.saguaro.wateringGroup==='cactus');
assert.match(guide.planning.uluhe.height,/not a fixed garden height/);assert.match(guide.planning.blackSpruce.bloom,/Non-flowering/);
assert.match(guide.planning.swampMilkweed.bloom,/July|September/);
assert.ok(guide.planning.prairieClover.spacing.toLowerCase().includes('spread'));
assert.ok(page.indexOf('${renderPlantPlanning(id)}')>page.indexOf('<p class="plant-field-note">'));
console.log('Passed complete sourced plant plans, mature height and bloom coverage, explicit missing spread, labeled spacing allowances, establishment guidance, regional caveats, and 58 catalog links without stock claims.');
