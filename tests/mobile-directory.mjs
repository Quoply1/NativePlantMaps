import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const page = readFileSync(new URL('../index.html',import.meta.url),'utf8');
const section = page.slice(page.indexOf('    function selectVendor('),page.indexOf('    function renderPublicReviews('));
let compact=true,fullscreen=false,scrollWrites=0,sidebarWrites=0,revealed=null,focused=false,fullscreenExits=0,renders=0;
const sidebar={get scrollTop(){return 120},set scrollTop(value){sidebarWrites++}};
const card={focus(options){focused=options.preventScroll},scrollIntoView(options){revealed=options}};
const workspace={classList:{contains(name){return fullscreen&&name==='map-fullscreen'}}};
const context=vm.createContext({scheduleDirectoryState(){},renderPlantPlanning(){return ""},
 vendors:[{id:'first',lat:null,lng:null},{id:'second',lat:null,lng:null}],
 selectedId:null,currentPage:1,PAGE_SIZE:50,clusterFocusIds:null,clusterFocusCount:0,vendorPopup:null,
 window:{accessMap:null,scrollX:0,scrollY:500,scrollTo(){scrollWrites++},matchMedia(query){return {matches:query.includes('max-width')?compact:true}}},
 document:{getElementById(id){return id==='cards'?sidebar:workspace},querySelector(){return card},querySelectorAll(){return []}},
 rankListings:rows=>rows,filtered:()=>context.vendors,syncSelectedCards(){},render(){renders++},
 toggleMapFullscreen(active){fullscreen=active;fullscreenExits++},refreshMapLayers(){}
});
vm.runInContext(section,context);
context.selectVendor('first');context.selectVendor('second');
assert.equal(context.selectedId,'second');
assert.equal(scrollWrites,0,'Mobile sidebar selection must not reset the document scroll');
assert.equal(sidebarWrites,0,'Mobile selection must not cancel touch scrolling by resetting a nested container');
assert.equal(renders,0,'Existing cards must retain their DOM on selection');
fullscreen=true;context.selectVendor('first',{fromMap:true});
assert.equal(fullscreen,false);assert.equal(fullscreenExits,1,'Pin selection must release full-screen map body locking');
assert.equal(focused,true);assert.equal(revealed.block,'start','Mobile pin selection reveals the card in document flow');
compact=false;context.selectVendor('second');
assert.equal(scrollWrites,1,'Desktop selection preserves its viewport');assert.equal(sidebarWrites,1);
context.selectVendor('first',{fromMap:true});assert.equal(revealed.block,'nearest');
const mobileCss=page.slice(page.indexOf('/* Use document scrolling on small screens'));
assert.ok(/max-width:1000px/.test(mobileCss));assert.ok(/#cards\{[^}]*max-height:none!important[^}]*overflow:visible/.test(mobileCss));
assert.ok(/\.directory\{[^}]*overflow:visible/.test(mobileCss));
console.log('Passed mobile document scrolling, selection without scroll resets, full-screen exit, map-pin reveal, and desktop preservation.');
