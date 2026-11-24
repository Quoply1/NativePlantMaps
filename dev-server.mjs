import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {resolve,extname} from 'node:path';
import worker from './dist/_worker.js';
const mime={'.webp':'image/webp','.png':'image/png','.jpg':'image/jpeg','.svg':'image/svg+xml'};
const assets={async fetch(request){const path=new URL(request.url).pathname;if(path!=='/social-preview.png'&&!/^\/assets\/providers\/[\w.-]+$/.test(path))return new Response('Not found',{status:404});try{const data=await readFile(resolve('dist','.'+path));return new Response(request.method==='HEAD'?null:data,{headers:{'content-type':mime[extname(path)]||'application/octet-stream'}})}catch{return new Response('Not found',{status:404})}}};
createServer(async(req,res)=>{try{const chunks=[];for await(const c of req)chunks.push(c);const request=new Request('http://'+req.headers.host+req.url,{method:req.method,headers:req.headers,...(!['GET','HEAD'].includes(req.method)?{body:Buffer.concat(chunks)}:{})});const response=await worker.fetch(request,{ASSETS:assets});res.writeHead(response.status,Object.fromEntries(response.headers));res.end(Buffer.from(await response.arrayBuffer()));}catch(error){console.error(error);res.writeHead(500);res.end('Preview error');}}).listen(Number(process.argv[process.argv.indexOf('--port')+1])||Number(process.env.PORT)||3000,'0.0.0.0');
