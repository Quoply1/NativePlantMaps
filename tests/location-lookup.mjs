import assert from 'node:assert/strict';
import worker from '../dist/_worker.js';
const originalFetch=globalThis.fetch;let calls=[];
try{
 globalThis.fetch=async url=>{calls.push(String(url));if(String(url).includes('zippopotam'))return new Response(JSON.stringify({places:[{'place name':'Montclair',state:'New Jersey','state abbreviation':'NJ',latitude:'40.8',longitude:'-74.2'}]}));return new Response(JSON.stringify({results:[{name:'Montclair',admin1:'New Jersey',country_code:'US',feature_code:'PPL',latitude:40.8,longitude:-74.2,population:40000},{name:'Montclair',admin1:'California',country_code:'US',feature_code:'PPL',latitude:34.08,longitude:-117.7,population:50000},{name:'Montclair',admin1:'New Jersey',country_code:'CA',feature_code:'PPL',latitude:40.8,longitude:-74.2,population:1}]}));};
 const get=async q=>{const r=await worker.fetch(new Request('https://test/api/city-suggestions?query='+encodeURIComponent(q)),{});return {status:r.status,data:await r.json()}};
 let result=await get('07042');assert.equal(result.data.results[0].stateCode,'NJ');assert.equal(result.data.results[0].postalCode,'07042');assert.equal(calls.at(-1),'https://api.zippopotam.us/us/07042');
 result=await get('07042-1234');assert.equal(result.data.results[0].postalCode,'07042');
 result=await get('Montclair, NJ');assert.equal(result.data.results.length,1);assert.equal(result.data.results[0].stateCode,'NJ');assert.equal(new URL(calls.at(-1)).searchParams.get('name'),'Montclair');
 result=await get('Montclair New Jersey');assert.equal(result.data.results.length,1);assert.equal(result.data.results[0].stateCode,'NJ');
 result=await get('Montclair');assert.equal(result.data.results.length,2);assert.equal(result.data.results[0].stateCode,'CA');
 globalThis.fetch=async()=>new Response('',{status:404});result=await get('00000');assert.deepEqual(result.data.results,[]);assert.equal(result.status,200);
 globalThis.fetch=async()=>{throw new Error('offline')};result=await get('07042');assert.equal(result.status,502);assert.match(result.data.error,/temporarily unavailable/);
 result=await get('x');assert.deepEqual(result.data.results,[]);
}finally{globalThis.fetch=originalFetch}
console.log('Passed ZIP/ZIP+4 lookup, town and state disambiguation, U.S.-only results, state codes, missing ZIPs and recoverable upstream failure.');
