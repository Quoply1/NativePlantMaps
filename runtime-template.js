const PAGE = __PAGE__;
const SEED = __SEED__;
const ADMIN_PAGE = '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Review suggestions · Native Plant Access Map</title><style>body{font:15px/1.5 system-ui,sans-serif;margin:0;background:#f5f3ea;color:#20342d}main{max-width:900px;margin:36px auto;padding:0 18px}h1{font:36px Georgia,serif;color:#183e35}a{color:#28614e}button{border:0;border-radius:6px;padding:8px 11px;background:#285b4b;color:white;cursor:pointer;font-weight:700}.reject{background:#a8563e}.card{background:#fffefa;border:1px solid #d8ded4;border-radius:10px;padding:16px;margin:12px 0}.meta{color:#68776f;font-size:12px}.actions{display:flex;gap:8px;margin-top:12px}.empty{padding:20px;background:#fffefa;border-radius:8px}</style></head><body><main><p><a href="/">← Public directory</a></p><h1>Review place suggestions</h1><p>Access is limited to the directory editor. Sign in through the configured editor access policy to review pending suggestions. Approving a place publishes the listing; it does not mark its native plants as independently verified.</p><p><span>Editor access is managed by the site host.</span></p><div id="status" aria-live="polite">Loading pending suggestions…</div><div id="items"></div><script>\n'+
'const h=s=>String(s??"").replace(/[&<>"\x27]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","\x27":"&#39;"}[c]));\n'+
'async function load(){const status=document.querySelector("#status"),root=document.querySelector("#items");try{const r=await fetch("/api/admin/submissions");const j=await r.json();if(!r.ok)throw new Error(j.error||"Could not load suggestions");status.textContent=j.submissions.length?j.submissions.length+" pending suggestions":"No pending suggestions";root.innerHTML=j.submissions.map(x=>"<article class=card data-id=\""+x.id+"\"><h2>"+h(x.name)+"</h2><div class=meta>"+h(x.category)+" · "+h(x.area)+", "+h(x.state)+" · Submitted "+h(x.submittedAt)+"</div><p><b>Address / service area:</b> "+h(x.address)+"</p><p><b>Native offering / access:</b> "+h(x.nativeDescription)+"</p><p><b>Access note:</b> "+h(x.access||"None provided")+"</p><p><a href=\""+h(x.website)+"\" target=_blank rel=noreferrer>Website ↗</a> · <a href=\""+h(x.evidenceUrl)+"\" target=_blank rel=noreferrer>Evidence ↗</a> · <a href=\"https://www.google.com/maps/search/?api=1&query="+encodeURIComponent(x.name+" "+x.address)+"\" target=_blank rel=noreferrer>Google Maps ↗</a></p><div class=actions><button data-decision=approved>Approve listing</button><button class=reject data-decision=rejected>Reject</button></div></article>").join("");root.querySelectorAll("button[data-decision]").forEach(b=>b.addEventListener("click",()=>review(b.closest(".card").dataset.id,b.dataset.decision)))}catch(e){status.textContent=e.message+" · If this is an editor page, use the sign-in link above."}}\n'+
'async function review(id,decision){const status=document.querySelector("#status");try{const r=await fetch("/api/admin/review",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({id:Number(id),decision})});const j=await r.json();if(!r.ok)throw new Error(j.error||"Review failed");load()}catch(e){status.textContent=e.message}}\n'+
'load();</script></main></body></html>';

const json = (body, status = 200, extra = {}) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", "x-content-type-options": "nosniff", ...extra } });
const validUrl = value => { try { const u = new URL(value); return (u.protocol === "https:" || u.protocol === "http:") && u.hostname.includes("."); } catch { return false; } };
const clean = (value, max) => typeof value === "string" ? value.trim().slice(0, max) : "";
const accessJwksCache = new Map();
function decodeBase64Url(value) {
  const base64=value.replace(/-/g,"+").replace(/_/g,"/");
  const binary=atob(base64+"=".repeat((4-base64.length%4)%4));
  return Uint8Array.from(binary,c=>c.charCodeAt(0));
}
function accessIssuer(env) {
  const domain=(env.NATIVE_ACCESS_TEAM_DOMAIN||"").trim().replace(/^https:\/\//i,"").replace(/\/$/,"").toLowerCase();
  if(!/^[a-z0-9-]+\.cloudflareaccess\.com$/.test(domain))return null;
  return `https://${domain}`;
}
async function getAccessKeys(issuer, forceRefresh=false) {
  const cached=accessJwksCache.get(issuer);
  if(!forceRefresh&&cached&&cached.expires>Date.now())return cached.keys;
  const response=await fetch(`${issuer}/cdn-cgi/access/certs`,{headers:{accept:"application/json"}});
  if(!response.ok)throw new Error("Access signing keys unavailable");
  const body=await response.json();
  if(!Array.isArray(body.keys))throw new Error("Invalid Access signing keys");
  accessJwksCache.set(issuer,{keys:body.keys,expires:Date.now()+5*60*1000});
  return body.keys;
}
async function isAdmin(request, env) {
  const issuer=accessIssuer(env),audience=(env.NATIVE_ACCESS_AUD||"").trim(),allowed=(env.NATIVE_ADMIN_EMAIL||"").trim().toLowerCase();
  const token=request.headers.get("cf-access-jwt-assertion")||"";
  if(!issuer||!audience||!allowed||!token)return false;
  try {
    const parts=token.split(".");if(parts.length!==3)return false;
    const header=JSON.parse(new TextDecoder().decode(decodeBase64Url(parts[0])));
    const claims=JSON.parse(new TextDecoder().decode(decodeBase64Url(parts[1])));
    if(header.alg!=="RS256"||typeof header.kid!=="string")return false;
    const now=Math.floor(Date.now()/1000);
    if(claims.iss!==issuer||!Array.isArray(claims.aud)||!claims.aud.includes(audience)||!Number.isFinite(claims.exp)||claims.exp<=now||(Number.isFinite(claims.nbf)&&claims.nbf>now+60))return false;
    if(String(claims.email||"").trim().toLowerCase()!==allowed)return false;
    let keys=await getAccessKeys(issuer),jwk=keys.find(key=>key.kid===header.kid&&key.kty==="RSA");
    if(!jwk){keys=await getAccessKeys(issuer,true);jwk=keys.find(key=>key.kid===header.kid&&key.kty==="RSA");}
    if(!jwk)return false;
    const publicKey=await crypto.subtle.importKey("jwk",jwk,{name:"RSASSA-PKCS1-v1_5",hash:"SHA-256"},false,["verify"]);
    return await crypto.subtle.verify("RSASSA-PKCS1-v1_5",publicKey,decodeBase64Url(parts[2]),new TextEncoder().encode(`${parts[0]}.${parts[1]}`));
  } catch { return false; }
}
function isSameOrigin(request) { const origin=request.headers.get("origin"); return !origin || origin===new URL(request.url).origin; }
function publicSubmission(row) {
  const mapQuery=encodeURIComponent(row.name+" "+row.address), sources=[{label:"Submitted evidence link · reviewed for directory inclusion",url:row.evidence_url}];
  if(row.website!==row.evidence_url)sources.push({label:"Place website",url:row.website});
  const areaName={northeast:"Northeast",midatlantic:"Mid-Atlantic",greatlakes:"Great Lakes",appalachia:"Appalachia",south:"South",plains:"Great Plains",mountainwest:"Mountain West",southwest:"Southwest",pacific:"Pacific"}[row.region]||"United States";
  return {id:"community-"+row.id,name:row.name,area:row.area,borough:areaName,state:row.state,address:row.address,lat:null,lng:null,access:row.access||"Confirm current access directly with the provider.",native:"unverified",nativeBasis:"Community-submitted description: "+row.native_description+" Directory listing approved; native species and current stock have not been independently verified.",availability:row.access||"Contact the provider before visiting.",reviewNote:"Community submission reviewed for directory inclusion. Native status remains unverified until supported by current evidence.",reviewUrl:"https://www.google.com/maps/search/?api=1&query="+mapQuery,website:row.website,sources,category:row.category,focus:row.region,regionGroup:row.region,nativeTier:"unverified",approx:true};
}
async function approvedRows(env) {
  if(!env.DB)return [];
  const {results=[]}=await env.DB.prepare("SELECT id,name,category,region,area,state,address,website,evidence_url,native_description,access FROM community_submissions WHERE status = ? ORDER BY name COLLATE NOCASE LIMIT 500").bind("approved").all();
  return results.map(publicSubmission);
}
async function handleSubmission(request,env) {
  if(!isSameOrigin(request))return json({error:"Cross-site submissions are not accepted."},403);
  if(!env.DB)return json({error:"Submission service is temporarily unavailable."},503);
  if(!request.headers.get("content-type")?.includes("application/json"))return json({error:"Send the form as JSON."},415);
  let body;try{body=await request.json()}catch{return json({error:"The submission could not be read."},400)}
  if(clean(body.company,200))return json({ok:true},202);
  const name=clean(body.name,120),category=clean(body.category,20),region=clean(body.region,30),area=clean(body.area,100),state=clean(body.state,2),address=clean(body.address,240),website=clean(body.website,500),evidenceUrl=clean(body.evidenceUrl,500),nativeDescription=clean(body.nativeDescription,1200),access=clean(body.access,500);
  if(name.length<2||area.length<2||address.length<3||nativeDescription.length<12)return json({error:"Please complete the required fields with a little more detail."},400);
  if(!["retail","seasonal","community","delivery"].includes(category))return json({error:"Choose a listed place type."},400);
  const regionStates={northeast:["ME","NH","VT","MA","RI","CT","NY"],midatlantic:["NJ","PA","DE","MD","DC","VA"],greatlakes:["IL","IN","MI","MN","OH","WI"],appalachia:["WV","KY","TN","NC"],south:["SC","GA","FL","AL","MS","LA","AR","TX"],plains:["IA","KS","MO","NE","ND","OK","SD"],mountainwest:["CO","ID","MT","NV","UT","WY"],southwest:["AZ","NM"],pacific:["AK","CA","HI","OR","WA"]};
  if(!regionStates[region]?.includes(state))return json({error:"Choose the correct broad region for this state."},400);
  if(!["AK","AL","AZ","AR","CA","CO","CT","DE","FL","GA","HI","ID","IL","IN","IA","KS","KY","LA","ME","MD","MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ","NM","NY","NC","ND","OH","OK","OR","PA","RI","SC","SD","TN","TX","UT","VT","VA","WA","WV","WI","WY","DC"].includes(state))return json({error:"Choose one of the 50 states or the District of Columbia."},400);
  if(!validUrl(website)||!validUrl(evidenceUrl))return json({error:"Enter valid website and evidence links that start with http or https."},400);
  try{await env.DB.prepare("INSERT INTO community_submissions (name,category,region,area,state,address,website,evidence_url,native_description,access,status) VALUES (?,?,?,?,?,?,?,?,?,?,'pending')").bind(name,category,region,area,state,address,website,evidenceUrl,nativeDescription,access).run();return json({ok:true,status:"pending"},201)}catch{return json({error:"The submission could not be saved. Please try again later."},503)}
}
export default {
  async fetch(request,env) {
    const url=new URL(request.url),path=url.pathname.replace(/\/+$/,"")||"/";
    if(request.method==="GET"&&(path==="/"||path==="/index.html"))return new Response(PAGE,{headers:{"content-type":"text/html; charset=utf-8","x-content-type-options":"nosniff"}});
    if(request.method==="GET"&&path==="/admin")return await isAdmin(request,env)?new Response(ADMIN_PAGE,{headers:{"content-type":"text/html; charset=utf-8","cache-control":"no-store","x-content-type-options":"nosniff"}}):json({error:"Editor sign-in is required."},401);
    if(request.method==="GET"&&path==="/api/vendors")try{return json([...SEED,...await approvedRows(env)],200,{"cache-control":"public, max-age=60"})}catch{return json({error:"The directory database is temporarily unavailable."},503)}
    if(request.method==="POST"&&path==="/api/submissions")return handleSubmission(request,env);
    if(path.startsWith("/api/admin/")) {
      if(!await isAdmin(request,env))return json({error:"Editor sign-in is required."},401);
      if(request.method==="GET"&&path==="/api/admin/submissions") {
        if(!env.DB)return json({error:"The review database is unavailable."},503);
        try{const {results=[]}=await env.DB.prepare("SELECT id,name,category,region,area,state,address,website,evidence_url,native_description,access,submitted_at FROM community_submissions WHERE status = ? ORDER BY submitted_at ASC LIMIT 100").bind("pending").all();return json({submissions:results.map(x=>({id:x.id,name:x.name,category:x.category,region:x.region,area:x.area,state:x.state,address:x.address,website:x.website,evidenceUrl:x.evidence_url,nativeDescription:x.native_description,access:x.access,submittedAt:x.submitted_at}))})}catch{return json({error:"Could not read pending suggestions."},503)}
      }
      if(request.method==="POST"&&path==="/api/admin/review") {
        if(!isSameOrigin(request))return json({error:"Cross-site review requests are not accepted."},403);
        let body;try{body=await request.json()}catch{return json({error:"Invalid review request."},400)}
        const id=Number(body.id),decision=clean(body.decision,20);
        if(!Number.isInteger(id)||id<1||!["approved","rejected"].includes(decision))return json({error:"Invalid review decision."},400);
        try{const result=await env.DB.prepare("UPDATE community_submissions SET status = ?, reviewed_at = CURRENT_TIMESTAMP WHERE id = ? AND status = 'pending'").bind(decision,id).run();if(!result.meta?.changes)return json({error:"This suggestion has already been reviewed or no longer exists."},404);return json({ok:true,status:decision})}catch{return json({error:"Could not update this suggestion."},503)}
      }
    }
    return json({error:"Not found."},404);
  }
};
