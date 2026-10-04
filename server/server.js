import {WebSocketServer} from "ws";
import http from "node:http";
import {readFileSync} from "node:fs";

const PORT=Number(process.env.PORT)||8080;
const PROTOCOL_VERSION="20261004-authoritative-v4";
const TICK_HZ=20, SNAPSHOT_MS=Math.round(1000/TICK_HZ), FULL_SNAPSHOT_MS=4000, STALE_MS=60000;
const rooms=new Map();
const monitor={messages:0,stateUpdates:0,shots:0,entityHits:0,rejectedShots:0};
const ALLOW_LEGACY_DIRECT_DAMAGE=String(process.env.ALLOW_LEGACY_DIRECT_DAMAGE||"").toLowerCase()==="true";
const loadCatalog=relativePath=>{
  try{return JSON.parse(readFileSync(new URL(relativePath,import.meta.url),"utf8"))}
  catch(error){console.error("[RT] catalog load failed",relativePath,error);return {}}
};
const ammoCatalog=loadCatalog("../src/config/ammo-catalog.json");
const cannonCatalog=loadCatalog("../src/config/cannon-catalog.json");
const ammoById=new Map((Array.isArray(ammoCatalog.ammo)?ammoCatalog.ammo:[]).map(item=>[String(item?.id||""),item]));
const cannonById=new Map((Array.isArray(cannonCatalog.cannons)?cannonCatalog.cannons:[]).map(item=>[String(item?.id||""),item]));
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
    projectiles:new Map(),
    bounds:{left:0,top:0,right:60000,bottom:12000},
    initialized:false,
    revision:"",
    emptySince:0,
    lastFullSnapshotAt:0
  });
  return rooms.get(id);
}
function publicPlayer(p){return {uid:p.uid,name:p.name,shipId:p.shipId,x:p.x,y:p.y,vx:p.vx||0,vy:p.vy||0,rotation:p.rotation,direction:p.direction,hp:p.hp,updatedAt:p.updatedAt,online:true}}
function directionForRotation(rotation){
  const names=["n","nne","ne","ene","e","ese","se","sse","s","ssw","sw","wsw","w","wnw","nw","nnw"];
  const n=((Number(rotation)||0)%360+360)%360;
  return names[Math.round(n/22.5)%16];
}
function publicEntity(e){
  return {
    id:e.id,serverSlot:e.serverSlot,npcId:e.npcId,shipId:e.shipId,name:e.name,
    x:e.x,y:e.y,rotation:e.rotation,direction:e.direction,
    vx:e.vx,vy:e.vy,hp:e.hp,maxHp:e.maxHp,
    boss:e.boss,defeated:e.defeated,stopped:e.stopped,
    spawnId:e.spawnId,respawnAt:e.respawnAt||0,
    contributors:{...(e.contributors||{})},updatedAt:e.updatedAt
  };
}
function publicProjectile(p,now=Date.now()){
  const createdAt=Number(p?.createdAt)||now;
  const resolvesAt=Math.max(createdAt+1,Number(p?.resolvesAt)||createdAt+1);
  const progress=clamp((now-createdAt)/(resolvesAt-createdAt),0,1);
  const from=p?.from&&typeof p.from==="object"?p.from:{x:0,y:0};
  const to=p?.to&&typeof p.to==="object"?p.to:from;
  return {
    id:p.id,shotId:p.shotId||p.id,
    ownerType:p.ownerType,ownerId:p.ownerId,ownerUid:p.ownerUid,
    targetType:p.targetType,targetId:p.targetId,
    ammoId:p.ammoId,cannonId:p.cannonId,
    damage:p.damage,projectileSpeed:p.projectileSpeed,duration:p.duration,
    createdAt,resolvesAt,progress,
    from:{x:Number(from.x)||0,y:Number(from.y)||0},
    to:{x:Number(to.x)||0,y:Number(to.y)||0},
    x:(Number(from.x)||0)+((Number(to.x)||0)-(Number(from.x)||0))*progress,
    y:(Number(from.y)||0)+((Number(to.y)||0)-(Number(from.y)||0))*progress
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
  e.aggroUid="";
  const rng=seeded(hashString(e.id+"."+e.spawnId));
  e.rotation=rng()*360-180;
  e.direction=directionForRotation(e.rotation);
  e.courseCycle=0;
  e.nextCourseAt=now+3500+rng()*5500;
  e.updatedAt=now;
  return true;
}
function stateDelta(r,now=Date.now()){
  return {
    type:"state.delta",worldId:r.id,serverTime:now,
    players:[...r.players.values()].map(p=>({uid:p.uid,name:p.name,shipId:p.shipId,x:p.x,y:p.y,vx:p.vx||0,vy:p.vy||0,rotation:p.rotation,direction:p.direction,hp:p.hp,updatedAt:p.updatedAt,online:true})),
    entities:Object.fromEntries([...r.entities].map(([id,e])=>[id,{
      id:e.id,x:e.x,y:e.y,rotation:e.rotation,direction:e.direction,
      vx:e.vx,vy:e.vy,hp:e.hp,maxHp:e.maxHp,defeated:e.defeated,stopped:e.stopped,
      respawnAt:e.respawnAt||0,spawnId:e.spawnId,updatedAt:e.updatedAt
    }])),
    projectiles:Object.fromEntries([...r.projectiles].map(([id,p])=>[id,publicProjectile(p,now)]))
  };
}
function snapshot(r){
  const now=Date.now();
  for(const e of r.entities.values())maybeRespawnEntity(e,now);
  return {
    type:"snapshot",worldId:r.id,serverTime:now,
    players:[...r.players.values()].map(publicPlayer),
    entities:Object.fromEntries([...r.entities].map(([id,e])=>[id,publicEntity(e)])),
    projectiles:Object.fromEntries([...r.projectiles].map(([id,p])=>[id,publicProjectile(p,now)])),
    bosses:bossMap(r)
  };
}
function ensureWorld(r,m){
  const incomingRevision=key(m.revision||"");
  if(r.initialized&&incomingRevision&&incomingRevision===r.revision)return false;
  if(r.initialized&&incomingRevision&&incomingRevision!==r.revision){
    r.entities.clear();
    r.projectiles.clear();
    r.shots.clear();
    r.initialized=false;
    log("WORLD~ ",`world=${r.id} revision=${r.revision||"legacy"}->${incomingRevision}`);
  }
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
    const maxHp=clamp(raw.maxHp??raw.hp,1,500000000);
    const speed=clamp(raw.speed,0,1200);
    const rotation=Number(raw.rotation)||0;
    r.entities.set(id,{
      id,serverSlot:Math.max(0,Math.floor(Number(raw.serverSlot)||0)),npcId:key(raw.npcId||""),shipId:key(raw.shipId||""),name:String(raw.name||"NPC").slice(0,80),
      x:Number(raw.x)||0,y:Number(raw.y)||0,rotation,direction:String(raw.direction||directionForRotation(rotation)).slice(0,8),
      vx:0,vy:0,speed,minSpeed:clamp(raw.minSpeed,0,speed),acceleration:clamp(raw.acceleration||speed*3.1,0,3000),
      hp:maxHp,maxHp,boss:raw.boss===true,hostile:raw.hostile!==false,aggroUid:"",defeated:false,stopped:false,
      respawn:raw.respawn===true,respawnDelayMs:clamp(raw.respawnDelayMs||30000,1000,86400000),
      respawnAt:0,spawnId:Math.max(1,Number(raw.spawnId)||1),contributors:{},
      attackRange:clamp(raw.attackRange||900,100,12000),
      attackCooldownMs:clamp(raw.attackCooldownMs||1200,150,10000),
      projectileSpeed:clamp(raw.projectileSpeed||720,120,4000),
      damage:clamp(raw.damage||1,.1,5000),
      ammoId:key(raw.ammoId||""),
      volleyCount:clamp(raw.volleyCount||1,1,32),
      hitRadius:clamp(raw.hitRadius||90,24,260),
      hitRewardGold:Math.max(0,Math.floor(Number(raw.hitRewardGold)||0)),
      nextAttackAt:now+500+(hashString(id)%900),
      courseCycle:0,nextCourseAt:now+3500+(hashString(id)%5500),updatedAt:now
    });
  }
  r.revision=incomingRevision||r.revision||"legacy";
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
  if(uid)e.aggroUid=uid;
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

function projectileId(prefix="shot"){return key(prefix+"-"+Date.now()+"-"+Math.random().toString(36).slice(2,9))}
function predictProjectileIntercept(from,target,projectileSpeed){
  const speed=Math.max(1,Number(projectileSpeed)||720);
  const tx=Number(target?.x)||0,ty=Number(target?.y)||0;
  const vx=Number(target?.vx)||0,vy=Number(target?.vy)||0;
  const rx=tx-(Number(from?.x)||0),ry=ty-(Number(from?.y)||0);
  const a=vx*vx+vy*vy-speed*speed;
  const b=2*(rx*vx+ry*vy);
  const c=rx*rx+ry*ry;
  let t=0;
  if(Math.abs(a)<1e-6){
    if(Math.abs(b)>1e-6)t=-c/b;
  }else{
    const disc=b*b-4*a*c;
    if(disc>=0){
      const root=Math.sqrt(disc);
      const t1=(-b-root)/(2*a),t2=(-b+root)/(2*a);
      const candidates=[t1,t2].filter(value=>Number.isFinite(value)&&value>0);
      if(candidates.length)t=Math.min(...candidates);
    }
  }
  if(!(t>0))t=Math.sqrt(c)/speed;
  t=clamp(t,0,8);
  return {x:tx+vx*t,y:ty+vy*t,time:t};
}
function spawnProjectile(r,data={}){
  const now=Date.now();
  const id=key(data.shotId||projectileId(data.ownerType||"shot"));
  if(!id||r.projectiles.has(id))return null;
  const from={x:Number(data.from?.x)||0,y:Number(data.from?.y)||0};
  const to={x:Number(data.to?.x)||0,y:Number(data.to?.y)||0};
  const speed=clamp(data.projectileSpeed||720,120,4000);
  const distance=Math.hypot(to.x-from.x,to.y-from.y);
  const duration=clamp(data.duration||distance/speed*1000,120,8000);
  const projectile={
    id,shotId:id,
    ownerType:String(data.ownerType||"player"),
    ownerId:key(data.ownerId||""),
    ownerUid:key(data.ownerUid||""),
    targetType:String(data.targetType||"entity"),
    targetId:key(data.targetId||""),
    from,to,
    ammoId:key(data.ammoId||""),
    cannonId:key(data.cannonId||""),
    damage:clamp(data.damage||1,.1,5000),
    projectileSpeed:speed,
    duration,
    createdAt:now,
    resolvesAt:now+duration
  };
  r.projectiles.set(id,projectile);
  broadcast(r,{type:"projectile.spawn",...publicProjectile(projectile,now)});
  return projectile;
}
function resolveProjectile(r,p,now=Date.now()){
  if(!p||now<Number(p.resolvesAt||0))return false;
  let hit=false,event=null;
  if(p.targetType==="entity"){
    const e=r.entities.get(key(p.targetId));
    if(e&&!e.defeated){
      const radius=clamp(e.hitRadius||90,24,260);
      const miss=Math.hypot((Number(e.x)||0)-p.to.x,(Number(e.y)||0)-p.to.y);
      hit=miss<=radius;
      if(hit){
        const damage=Math.min(p.damage,Math.max(0,e.hp));
        e.hp=Math.max(0,Math.round((e.hp-damage)*10)/10);
        if(p.ownerUid){
          e.contributors[p.ownerUid]=Math.max(0,Number(e.contributors[p.ownerUid])||0)+damage;
          e.aggroUid=p.ownerUid;
        }
        e.defeated=e.hp<=0;
        e.updatedAt=now;
        if(e.defeated&&e.respawn)e.respawnAt=now+e.respawnDelayMs;
        event={
          type:"projectile.hit",shotId:p.id,ownerType:p.ownerType,ownerId:p.ownerId,ownerUid:p.ownerUid,
          targetType:"entity",targetId:e.id,npcId:e.npcId,boss:e.boss,
          rewardGold:Math.max(0,Math.floor(Number(e.hitRewardGold)||0)),
          damage,hp:e.hp,maxHp:e.maxHp,defeated:e.defeated,stopped:e.stopped,
          respawnAt:e.respawnAt||0,spawnId:e.spawnId,contributors:{...e.contributors},at:now
        };
      }
    }
  }else if(p.targetType==="player"){
    const target=r.players.get(key(p.targetId));
    if(target&&target.hp>0){
      const miss=Math.hypot((Number(target.x)||0)-p.to.x,(Number(target.y)||0)-p.to.y);
      hit=miss<=95;
      if(hit){
        const damage=Math.min(p.damage,Math.max(0,target.hp));
        target.hp=Math.max(0,Math.round((target.hp-damage)*10)/10);
        event={
          type:"projectile.hit",shotId:p.id,ownerType:p.ownerType,ownerId:p.ownerId,
          targetType:"player",targetId:target.uid,damage,hp:target.hp,maxHp:null,at:now
        };
      }
    }
  }
  if(hit&&event)broadcast(r,event);
  else broadcast(r,{type:"projectile.miss",shotId:p.id,ownerType:p.ownerType,ownerId:p.ownerId,targetType:p.targetType,targetId:p.targetId,to:p.to,at:now});
  r.projectiles.delete(p.id);
  return true;
}
function maybeFireNpc(r,e,now=Date.now()){
  if(e.hostile===false||!e.aggroUid||e.defeated||e.stopped||e.hp<=0||now<Number(e.nextAttackAt||0))return false;
  const target=r.players.get(key(e.aggroUid));
  if(!target||!(target.hp>0))return false;
  const best=Math.hypot((Number(target.x)||0)-e.x,(Number(target.y)||0)-e.y);
  if(best>e.attackRange)return false;
  e.nextAttackAt=now+e.attackCooldownMs;
  const shots=Math.max(1,Math.min(16,Math.floor(Number(e.volleyCount)||1)));
  for(let i=0;i<shots;i++){
    const delay=i*55;
    const lead=delay/1000;
    const from={x:e.x,y:e.y};
    const to={x:(Number(target.x)||0),y:(Number(target.y)||0)};
    spawnProjectile(r,{
      shotId:projectileId("npc"),
      ownerType:"entity",ownerId:e.id,targetType:"player",targetId:target.uid,
      from,to,ammoId:e.ammoId,damage:e.damage,projectileSpeed:e.projectileSpeed,
      duration:Math.max(120,best/e.projectileSpeed*1000+delay)
    });
  }
  return true;
}

const server=http.createServer((req,res)=>{
  if(req.url==="/health"){
    const players=[...rooms.values()].reduce((sum,r)=>sum+r.players.size,0);
    const entities=[...rooms.values()].reduce((sum,r)=>sum+r.entities.size,0);
    const projectiles=[...rooms.values()].reduce((sum,r)=>sum+r.projectiles.size,0);
    res.writeHead(200,{"content-type":"application/json"});
    res.end(JSON.stringify({ok:true,protocolVersion:PROTOCOL_VERSION,rooms:rooms.size,players,entities,projectiles,uptime:process.uptime()}));
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
      const cannonIds=Array.isArray(m.cannonIds)?m.cannonIds.map(key).filter(id=>cannonById.has(id)).slice(0,64):[];
      current.players.set(uid,{ws,uid,name:String(m.name||"Pirata").slice(0,40),shipId:key(m.shipId),cannonIds,x:Number(m.x)||0,y:Number(m.y)||0,vx:Number(m.vx)||0,vy:Number(m.vy)||0,rotation:Number(m.rotation)||0,direction:String(m.direction||"n").slice(0,8),hp:Math.max(0,Number(m.hp)||0),nextFireAt:0,lastVolleyId:"",updatedAt:Date.now()});
      send(ws,{type:"joined",worldId,uid,tickHz:TICK_HZ,authority:"server",protocolVersion:PROTOCOL_VERSION});
      log("JOIN   ",`uid=${uid} world=${worldId} players=${current.players.size}`);
      return;
    }
    if(!current||!uid)return;
    const p=current.players.get(uid);if(!p)return;

    if(m.type==="world.ensure"){
      const changed=ensureWorld(current,m);
      current.lastFullSnapshotAt=Date.now();
      if(changed)broadcast(current,snapshot(current));
      else send(ws,snapshot(current));
      return;
    }
    if(m.type==="state"){
      monitor.stateUpdates++;
      const now=Date.now();
      const seq=Math.max(0,Math.floor(Number(m.seq)||0));
      const requestedX=Number(m.x),requestedY=Number(m.y);
      const nextX=Number.isFinite(requestedX)?requestedX:p.x;
      const nextY=Number.isFinite(requestedY)?requestedY:p.y;
      const elapsed=Math.max(.02,Math.min(.25,(now-Number(p.updatedAt||now-50))/1000));
      const dx=nextX-p.x,dy=nextY-p.y,distance=Math.hypot(dx,dy);
      const maxTravel=1800*elapsed+90;
      const travelScale=distance>maxTravel?maxTravel/Math.max(1,distance):1;
      p.shipId=key(m.shipId||p.shipId);
      p.cannonIds=Array.isArray(m.cannonIds)?m.cannonIds.map(key).filter(id=>cannonById.has(id)).slice(0,64):[];
      p.x=clamp(p.x+dx*travelScale,current.bounds.left,current.bounds.right);
      p.y=clamp(p.y+dy*travelScale,current.bounds.top,current.bounds.bottom);
      p.vx=Number(m.vx)||0;p.vy=Number(m.vy)||0;
      p.rotation=Number(m.rotation)||0;p.direction=String(m.direction||"n").slice(0,8);
      p.hp=Math.max(0,Number(m.hp)||0);p.updatedAt=now;
      send(ws,{type:"state.ack",seq,x:p.x,y:p.y,vx:p.vx,vy:p.vy,rotation:p.rotation,direction:p.direction,serverTime:now});
      return;
    }
    if(m.type==="fire.request"||m.type==="projectile.fire"){
      monitor.shots++;
      const authoritative=m.type==="fire.request";
      const targetId=key(m.targetId),target=current.entities.get(targetId);
      if(!target||target.defeated||target.hp<=0){
        monitor.rejectedShots++;
        log("FIRE-X ",`uid=${uid} reason=invalid_target target=${targetId}`);
        send(ws,{type:"fire.rejected",reason:"invalid_target",shotId:key(m.shotId),targetId,at:Date.now()});
        return;
      }

      const ammoId=key(m.ammoId),cannonId=key(m.cannonId);
      const ammo=ammoById.get(ammoId),cannon=cannonById.get(cannonId);
      const equippedCannons=Array.isArray(p.cannonIds)?p.cannonIds:[];
      if(authoritative&&(!cannonId||!equippedCannons.includes(cannonId))){
        monitor.rejectedShots++;
        log("FIRE-X ",`uid=${uid} reason=cannon_not_equipped cannon=${cannonId||"none"} ship=${p.shipId||"none"}`);
        send(ws,{type:"fire.rejected",reason:"cannon_not_equipped",shotId:key(m.shotId),targetId,ammoId,cannonId,at:Date.now()});
        return;
      }
      if(authoritative&&(!ammo||ammo.available===false||!cannon||cannon.available===false)){
        monitor.rejectedShots++;
        log("FIRE-X ",`uid=${uid} reason=invalid_loadout ammo=${ammoId} cannon=${cannonId}`);
        send(ws,{type:"fire.rejected",reason:"invalid_loadout",shotId:key(m.shotId),targetId,ammoId,cannonId,at:Date.now()});
        return;
      }

      const now=Date.now();
      const cooldown=clamp(cannon?.attackCooldownMs||m.attackCooldownMs||950,150,10000);
      const volleyId=key(m.volleyId||m.shotId||"");
      const sameVolley=authoritative&&volleyId&&volleyId===String(p.lastVolleyId||"");
      if(authoritative&&!sameVolley&&now<Number(p.nextFireAt||0)){
        monitor.rejectedShots++;
        send(ws,{type:"fire.rejected",reason:"cooldown",shotId:key(m.shotId),targetId,ammoId,cannonId,retryAt:p.nextFireAt,at:now});
        return;
      }

      const range=clamp(cannon?.range||m.range||1200,100,12000);
      const playerDistance=Math.hypot((Number(p.x)||0)-target.x,(Number(p.y)||0)-target.y);
      if(playerDistance>range+180){
        monitor.rejectedShots++;
        send(ws,{type:"fire.rejected",reason:"out_of_range",shotId:key(m.shotId),targetId,ammoId,cannonId,range,distance:playerDistance,at:now});
        return;
      }

      const rawFrom={x:Number(m.from?.x)||Number(p.x)||0,y:Number(m.from?.y)||Number(p.y)||0};
      const fromDistance=Math.hypot(rawFrom.x-(Number(p.x)||0),rawFrom.y-(Number(p.y)||0));
      const from=fromDistance<=320?rawFrom:{x:Number(p.x)||0,y:Number(p.y)||0};
      if(target.boss){target.stopped=true;target.vx=0;target.vy=0}

      const projectileSpeed=clamp(
        authoritative?(Number(ammo?.projectileSpeed)||Number(cannon?.projectileSpeed)||720):(Number(m.projectileSpeed)||720),
        120,4000
      );
      const damage=authoritative
        ?clamp((Number(ammo?.damage)||1)*clamp(Number(cannon?.damageMultiplier)||1,.1,100),.1,5000)
        :clamp(Number(m.damage)||1,.1,5000);

      if(authoritative&&!sameVolley){
        p.lastVolleyId=volleyId;
        p.nextFireAt=now+cooldown;
      }
      const intercept=predictProjectileIntercept(from,target,projectileSpeed);
      const projectile=spawnProjectile(current,{
        shotId:key(m.shotId||projectileId("player")),
        ownerType:"player",ownerId:uid,ownerUid:uid,
        targetType:"entity",targetId:target.id,
        from,to:{x:intercept.x,y:intercept.y},ammoId,cannonId,damage,projectileSpeed,
        duration:Math.max(120,intercept.time*1000)
      });
      if(projectile){
        log("FIRE+  ",`uid=${uid} target=${target.id} cannon=${cannonId} x${Number(cannon?.damageMultiplier)||1} ammo=${ammoId} damage=${damage} shot=${projectile.id}`);
        send(ws,{type:"fire.accepted",shotId:projectile.id,targetId:target.id,ammoId,cannonId,damage,createdAt:projectile.createdAt,resolvesAt:projectile.resolvesAt});
        }
      return;
    }
    if(m.type==="shot"){
      monitor.shots++;
      const shotId=key(m.shotId||uid+"-"+Date.now());if(current.shots.has(shotId))return;
      const event={type:"shot",uid,shotId,from:m.from||null,to:m.to||null,ammoId:key(m.ammoId),damage:clamp(m.damage,0,5000),duration:clamp(m.duration||620,120,8000),at:Date.now()};
      current.shots.set(shotId,event);broadcast(current,event,ws);return;
    }
    if(m.type==="entity.damage"||m.type==="boss.damage"){
      if(!ALLOW_LEGACY_DIRECT_DAMAGE){
        send(ws,{type:"fire.rejected",reason:"direct_damage_disabled",at:Date.now()});
        return;
      }
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
    for(const e of r.entities.values()){
      simulateEntity(r,e,dt,now);
      maybeFireNpc(r,e,now);
    }
    for(const p of [...r.projectiles.values()])resolveProjectile(r,p,now);
    if(r.players.size){
      r.emptySince=0;
      broadcast(r,stateDelta(r,now));
      if(!r.lastFullSnapshotAt||now-r.lastFullSnapshotAt>=FULL_SNAPSHOT_MS){
        r.lastFullSnapshotAt=now;
        broadcast(r,snapshot(r));
      }
    }else if(!r.emptySince)r.emptySince=now;
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
