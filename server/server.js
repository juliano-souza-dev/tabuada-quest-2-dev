import {WebSocketServer} from "ws";
import http from "node:http";

const PORT=Number(process.env.PORT)||8080;
const TICK_HZ=20, SNAPSHOT_MS=Math.round(1000/TICK_HZ), STALE_MS=15000;
const rooms=new Map();
const monitor={messages:0,stateUpdates:0,shots:0,entityHits:0};
const log=(event,detail="")=>console.log(`[RT ${new Date().toISOString()}] ${event}${detail?` ${detail}`:""}`);
const clamp=(v,min,max)=>Math.min(max,Math.max(min,Number(v)||0));
const key=v=>String(v||"").replace(/[^a-zA-Z0-9._-]/g,"-").slice(0,96);
const send=(ws,data)=>{if(ws.readyState===ws.OPEN)ws.send(JSON.stringify(data))};
const broadcast=(room,data,except=null)=>{const raw=JSON.stringify(data);for(const p of room.players.values())if(p.ws!==except&&p.ws.readyState===p.ws.OPEN)p.ws.send(raw)};
const hashString=value=>{let h=2166136261;for(const ch of String(value||"")){h^=ch.charCodeAt(0);h=Math.imul(h,16777619)}return h>>>0};
const seeded=(seed)=>{let s=(Number(seed)>>>0)||0x9e3779b9;return()=>{s+=0x6D2B79F5;let t=s;t=Math.imul(t^(t>>>15),t|1);t^=t+Math.imul(t^(t>>>7),t|61);return((t^(t>>>14))>>>0)/4294967296}};

function room(id){
  if(!rooms.has(id))rooms.set(id,{
    id,
    players:new Map(),
    entities:new Map(),
    shots:new Map(),
    bounds:{left:0,top:0,right:60000,bottom:12000},
    initialized:false,
    emptySince:0
  });
  return rooms.get(id);
}
function publicPlayer(p){return {uid:p.uid,name:p.name,shipId:p.shipId,x:p.x,y:p.y,rotation:p.rotation,direction:p.direction,hp:p.hp,updatedAt:p.updatedAt,online:true}}
function directionForRotation(rotation){
  const names=["n","nne","ne","ene","e","ese","se","sse","s","ssw","sw","wsw","w","wnw","nw","nnw"];
  const n=((Number(rotation)||0)%360+360)%360;
  return names[Math.round(n/22.5)%16];
}
function publicEntity(e){
  return {
    id:e.id,npcId:e.npcId,shipId:e.shipId,name:e.name,
    x:e.x,y:e.y,rotation:e.rotation,direction:e.direction,
    vx:e.vx,vy:e.vy,hp:e.hp,maxHp:e.maxHp,
    boss:e.boss,defeated:e.defeated,stopped:e.stopped,
    spawnId:e.spawnId,respawnAt:e.respawnAt||0,
    contributors:{...(e.contributors||{})},updatedAt:e.updatedAt
  };
}
function bossMap(r){
  const out={};
  for(const e of r.entities.values()){
    if(!e.boss)continue;
    out[key(e.npcId||e.id)]={...publicEntity(e),bossId:key(e.npcId||e.id),entityId:e.id};
  }
  return out;
}
function maybeRespawnEntity(e,now=Date.now()){
  if(!e?.defeated||!e.respawnAt||now<e.respawnAt)return false;
  e.hp=e.maxHp;
  e.defeated=false;
  e.stopped=false;
  e.respawnAt=0;
  e.spawnId=Math.max(1,Number(e.spawnId)||1)+1;
  e.contributors={};
  const rng=seeded(hashString(e.id+"."+e.spawnId));
  e.rotation=rng()*360-180;
  e.direction=directionForRotation(e.rotation);
  e.courseCycle=0;
  e.nextCourseAt=now+3500+rng()*5500;
  e.updatedAt=now;
  return true;
}
function snapshot(r){
  const now=Date.now();
  for(const e of r.entities.values())maybeRespawnEntity(e,now);
  return {
    type:"snapshot",worldId:r.id,serverTime:now,
    players:[...r.players.values()].map(publicPlayer),
    entities:Object.fromEntries([...r.entities].map(([id,e])=>[id,publicEntity(e)])),
    bosses:bossMap(r)
  };
}
function ensureWorld(r,m){
  if(r.initialized)return false;
  const bounds=m.bounds&&typeof m.bounds==="object"?m.bounds:{};
  r.bounds={
    left:Number(bounds.left)||0,
    top:Number(bounds.top)||0,
    right:Math.max(1000,Number(bounds.right)||60000),
    bottom:Math.max(1000,Number(bounds.bottom)||12000)
  };
  const now=Date.now();
  for(const raw of Array.isArray(m.entities)?m.entities:[]){
    const id=key(raw.id);if(!id||r.entities.has(id))continue;
    const maxHp=clamp(raw.maxHp??raw.hp,1,50000000);
    const speed=clamp(raw.speed,0,1200);
    const rotation=Number(raw.rotation)||0;
    r.entities.set(id,{
      id,npcId:key(raw.npcId||""),shipId:key(raw.shipId||""),name:String(raw.name||"NPC").slice(0,80),
      x:Number(raw.x)||0,y:Number(raw.y)||0,rotation,direction:String(raw.direction||directionForRotation(rotation)).slice(0,8),
      vx:0,vy:0,speed,minSpeed:clamp(raw.minSpeed,0,speed),acceleration:clamp(raw.acceleration||speed*3.1,0,3000),
      hp:maxHp,maxHp,boss:raw.boss===true,defeated:false,stopped:false,
      respawn:raw.respawn===true,respawnDelayMs:clamp(raw.respawnDelayMs||30000,1000,86400000),
      respawnAt:0,spawnId:Math.max(1,Number(raw.spawnId)||1),contributors:{},
      courseCycle:0,nextCourseAt:now+3500+(hashString(id)%5500),updatedAt:now
    });
  }
  r.initialized=true;
  return true;
}
function simulateEntity(r,e,dt,now){
  if(maybeRespawnEntity(e,now))return;
  if(e.defeated||e.stopped||e.speed<=0){e.vx=0;e.vy=0;return}
  if(now>=Number(e.nextCourseAt||0)){
    e.courseCycle=(Number(e.courseCycle)||0)+1;
    const rng=seeded(hashString(e.id+"."+e.courseCycle));
    e.rotation+=((rng()-.5)*100);
    e.nextCourseAt=now+3500+rng()*5500;
  }
  const rad=e.rotation*Math.PI/180;
  e.vx=Math.sin(rad)*e.speed;
  e.vy=-Math.cos(rad)*e.speed;
  let nx=e.x+e.vx*dt,ny=e.y+e.vy*dt;
  const b=r.bounds,margin=70;
  if(nx<b.left+margin||nx>b.right-margin){e.rotation=-e.rotation;nx=clamp(nx,b.left+margin,b.right-margin)}
  if(ny<b.top+margin||ny>b.bottom-margin){e.rotation=180-e.rotation;ny=clamp(ny,b.top+margin,b.bottom-margin)}
  e.x=nx;e.y=ny;e.direction=directionForRotation(e.rotation);e.updatedAt=now;
}
function applyEntityDamage(r,uid,m){
  const entityId=key(m.entityId||m.bossId),shotId=key(m.shotId);
  const e=r.entities.get(entityId)||[...r.entities.values()].find(x=>key(x.npcId)===entityId);
  if(!e||!shotId||r.shots.has("hit:"+shotId))return null;
  const now=Date.now();maybeRespawnEntity(e,now);if(e.defeated)return null;
  r.shots.set("hit:"+shotId,{at:now});
  const requested=clamp(m.damage,0.1,5000);
  const damage=Math.min(requested,Math.max(0,e.hp));
  e.hp=Math.max(0,Math.round((e.hp-damage)*10)/10);
  e.contributors[uid]=Math.max(0,Number(e.contributors[uid])||0)+damage;
  e.stopped=e.boss?true:e.stopped;
  if(e.stopped){e.vx=0;e.vy=0}
  e.defeated=e.hp<=0;
  e.updatedAt=now;
  if(e.defeated&&e.respawn)e.respawnAt=now+e.respawnDelayMs;
  return {
    type:"entity-hit",uid,entityId:e.id,npcId:e.npcId,shotId,damage,hp:e.hp,maxHp:e.maxHp,
    boss:e.boss,defeated:e.defeated,stopped:e.stopped,respawnAt:e.respawnAt||0,
    spawnId:e.spawnId,contributors:{...e.contributors},at:now
  };
}

const server=http.createServer((req,res)=>{
  if(req.url==="/health"){
    const players=[...rooms.values()].reduce((sum,r)=>sum+r.players.size,0);
    const entities=[...rooms.values()].reduce((sum,r)=>sum+r.entities.size,0);
    res.writeHead(200,{"content-type":"application/json"});
    res.end(JSON.stringify({ok:true,rooms:rooms.size,players,entities,uptime:process.uptime()}));
    return;
  }
  res.writeHead(404);res.end();
});
const wss=new WebSocketServer({server,maxPayload:128*1024});
wss.on("connection",ws=>{
  log("SOCKET+ ",`clients=${wss.clients.size}`);
  let current=null,uid="";
  ws.on("message",raw=>{
    monitor.messages++;
    let m;try{m=JSON.parse(String(raw))}catch{return}
    if(m.type==="join"){
      const worldId=key(m.worldId),id=key(m.uid);if(!worldId||!id)return;
      current=room(worldId);uid=id;
      current.players.set(uid,{ws,uid,name:String(m.name||"Pirata").slice(0,40),shipId:key(m.shipId),x:Number(m.x)||0,y:Number(m.y)||0,rotation:Number(m.rotation)||0,direction:String(m.direction||"n").slice(0,8),hp:Math.max(0,Number(m.hp)||0),updatedAt:Date.now()});
      send(ws,{type:"joined",worldId,uid,tickHz:TICK_HZ,authority:"server"});
      log("JOIN   ",`uid=${uid} world=${worldId} players=${current.players.size}`);
      return;
    }
    if(!current||!uid)return;
    const p=current.players.get(uid);if(!p)return;

    if(m.type==="world.ensure"){
      ensureWorld(current,m);
      send(ws,snapshot(current));
      return;
    }
    if(m.type==="state"){
      monitor.stateUpdates++;
      p.x=Number(m.x)||0;p.y=Number(m.y)||0;p.rotation=Number(m.rotation)||0;p.direction=String(m.direction||"n").slice(0,8);p.hp=Math.max(0,Number(m.hp)||0);p.updatedAt=Date.now();return;
    }
    if(m.type==="shot"){
      monitor.shots++;
      const shotId=key(m.shotId||uid+"-"+Date.now());if(current.shots.has(shotId))return;
      const event={type:"shot",uid,shotId,from:m.from||null,to:m.to||null,ammoId:key(m.ammoId),damage:clamp(m.damage,0,5000),duration:clamp(m.duration||620,120,8000),at:Date.now()};
      current.shots.set(shotId,event);broadcast(current,event,ws);return;
    }
    if(m.type==="entity.damage"||m.type==="boss.damage"){
      monitor.entityHits++;
      const event=applyEntityDamage(current,uid,m);
      if(event){
        broadcast(current,event);
        if(event.boss)broadcast(current,{...event,type:"boss-hit",bossId:key(event.npcId||event.entityId)});
      }
      return;
    }
    if(m.type==="boss.ensure"){
      // Compatibility shim for older clients. World authority now owns boss creation.
      const bossId=key(m.bossId);
      if(!bossId)return;
      const e=[...current.entities.values()].find(x=>x.boss&&key(x.npcId||x.id)===bossId);
      if(e)send(ws,{type:"boss.state",boss:{...publicEntity(e),bossId,entityId:e.id}});
      return;
    }
  });
  ws.on("close",()=>{
    if(current&&uid){
      current.players.delete(uid);
      broadcast(current,{type:"player-left",uid,at:Date.now()});
      if(!current.players.size)current.emptySince=Date.now();
      log("LEAVE  ",`uid=${uid} world=${current.id} players=${current.players.size}`);
    }else log("SOCKET- ",`clients=${wss.clients.size}`);
  });
});

setInterval(()=>{
  const now=Date.now(),dt=SNAPSHOT_MS/1000;
  for(const [roomId,r] of rooms){
    for(const [id,p] of r.players)if(now-p.updatedAt>STALE_MS){try{p.ws.close()}catch{}r.players.delete(id)}
    for(const [id,s] of r.shots)if(now-Number(s.at||0)>15000)r.shots.delete(id);
    for(const e of r.entities.values())simulateEntity(r,e,dt,now);
    if(r.players.size){r.emptySince=0;broadcast(r,snapshot(r))}
    else if(!r.emptySince)r.emptySince=now;
    if(!r.players.size&&r.emptySince&&now-r.emptySince>15*60*1000)rooms.delete(roomId);
  }
},SNAPSHOT_MS);

setInterval(()=>{
  const players=[...rooms.values()].reduce((sum,r)=>sum+r.players.size,0);
  const entities=[...rooms.values()].reduce((sum,r)=>sum+r.entities.size,0);
  log("STATUS ",`clients=${wss.clients.size} rooms=${rooms.size} players=${players} entities=${entities} msg=${monitor.messages} state=${monitor.stateUpdates} shots=${monitor.shots} hits=${monitor.entityHits}`);
  monitor.messages=0;monitor.stateUpdates=0;monitor.shots=0;monitor.entityHits=0;
},5000);

server.listen(PORT,"0.0.0.0",()=>console.log(`Tabuada Quest authoritative realtime server on 0.0.0.0:${PORT} @ ${TICK_HZ}Hz`));
