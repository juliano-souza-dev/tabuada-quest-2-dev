const {onRequest}=require("firebase-functions/v2/https");
const {initializeApp}=require("firebase-admin/app");
const {getAuth}=require("firebase-admin/auth");
const {getDatabase}=require("firebase-admin/database");

initializeApp();

const REGION="southamerica-east1";
const clamp=(value,min,max)=>Math.min(max,Math.max(min,Number(value)||0));
const safeKey=value=>String(value||"").trim().replace(/[^a-zA-Z0-9._-]/g,"-").slice(0,128);

function cors(res){
  res.set("Access-Control-Allow-Origin","*");
  res.set("Access-Control-Allow-Headers","Authorization, Content-Type");
  res.set("Access-Control-Allow-Methods","POST, OPTIONS");
}
async function authenticated(req){
  const header=String(req.get("authorization")||"");
  if(!header.startsWith("Bearer "))throw Object.assign(new Error("unauthenticated"),{status:401});
  return getAuth().verifyIdToken(header.slice(7));
}
function jsonBody(req){return req.body&&typeof req.body==="object"?req.body:{};}

exports.bossDamage=onRequest({region:REGION,cors:false},async(req,res)=>{
  cors(res);if(req.method==="OPTIONS"){res.status(204).end();return}
  if(req.method!=="POST"){res.status(405).json({error:"method_not_allowed"});return}
  try{
    const user=await authenticated(req),body=jsonBody(req);
    const worldId=safeKey(body.worldId),bossId=safeKey(body.bossId),shotId=safeKey(body.shotId);
    const damage=clamp(Math.floor(body.damage),1,5000);
    if(!worldId||!bossId||!shotId){res.status(400).json({error:"invalid_request"});return}
    const db=getDatabase(),bossRef=db.ref(`multiplayer/rooms/${worldId}/bosses/${bossId}`);
    let applied=false;
    const result=await bossRef.transaction(current=>{
      if(!current||current.defeated===true)return;
      const recent=current.recentShots&&typeof current.recentShots==="object"?current.recentShots:{};
      if(recent[shotId])return;
      const maxHp=Math.max(1,Number(current.maxHp)||1),hp=Math.max(0,Number(current.hp??maxHp)-damage);
      const entries=Object.entries({...recent,[shotId]:Date.now()}).sort((a,b)=>Number(b[1])-Number(a[1])).slice(0,64);
      applied=true;
      return {...current,maxHp,hp,defeated:hp<=0,updatedAt:Date.now(),lastHitBy:user.uid,lastShotId:shotId,recentShots:Object.fromEntries(entries)};
    },undefined,false);
    const boss=result.snapshot.val();
    if(!boss){res.status(404).json({error:"boss_not_found"});return}
    if(applied)await db.ref(`multiplayer/rooms/${worldId}/events`).push({type:"boss-hit",uid:user.uid,bossId,damage,hp:Number(boss.hp)||0,maxHp:Number(boss.maxHp)||1,defeated:boss.defeated===true,shotId,at:Date.now()});
    res.json({ok:true,applied,boss:{bossId,hp:Number(boss.hp)||0,maxHp:Number(boss.maxHp)||1,defeated:boss.defeated===true}});
  }catch(error){res.status(error.status||500).json({error:error.message||"server_error"})}
});

exports.ensureBoss=onRequest({region:REGION,cors:false},async(req,res)=>{
  cors(res);if(req.method==="OPTIONS"){res.status(204).end();return}
  if(req.method!=="POST"){res.status(405).json({error:"method_not_allowed"});return}
  try{
    await authenticated(req);const body=jsonBody(req);
    const worldId=safeKey(body.worldId),bossId=safeKey(body.bossId);
    if(!worldId||!bossId){res.status(400).json({error:"invalid_request"});return}
    const maxHp=clamp(Math.floor(body.maxHp),1,100000);
    const ref=getDatabase().ref(`multiplayer/rooms/${worldId}/bosses/${bossId}`);
    const result=await ref.transaction(current=>current||{bossId,entityId:String(body.entityId||bossId).slice(0,128),name:String(body.name||"Boss").slice(0,80),maxHp,hp:maxHp,phase:1,defeated:false,updatedAt:Date.now()},undefined,false);
    res.json({ok:true,boss:result.snapshot.val()});
  }catch(error){res.status(error.status||500).json({error:error.message||"server_error"})}
});
