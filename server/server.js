import {WebSocketServer} from "ws";
import http from "node:http";

const PORT=Number(process.env.PORT)||8080;
const TICK_HZ=20, SNAPSHOT_MS=Math.round(1000/TICK_HZ), STALE_MS=15000;
const rooms=new Map();
const clamp=(v,min,max)=>Math.min(max,Math.max(min,Number(v)||0));
const key=v=>String(v||"").replace(/[^a-zA-Z0-9._-]/g,"-").slice(0,96);
const send=(ws,data)=>{if(ws.readyState===ws.OPEN)ws.send(JSON.stringify(data))};
const broadcast=(room,data,except=null)=>{const raw=JSON.stringify(data);for(const p of room.players.values())if(p.ws!==except&&p.ws.readyState===p.ws.OPEN)p.ws.send(raw)};
function room(id){if(!rooms.has(id))rooms.set(id,{id,players:new Map(),bosses:new Map(),shots:new Map()});return rooms.get(id)}
function publicPlayer(p){return {uid:p.uid,name:p.name,shipId:p.shipId,x:p.x,y:p.y,rotation:p.rotation,direction:p.direction,hp:p.hp,updatedAt:p.updatedAt,online:true}}
function snapshot(r){return {type:"snapshot",worldId:r.id,serverTime:Date.now(),players:[...r.players.values()].map(publicPlayer),bosses:Object.fromEntries([...r.bosses].map(([id,b])=>[id,b]))}}
const server=http.createServer((req,res)=>{if(req.url==="/health"){res.writeHead(200,{"content-type":"application/json"});res.end(JSON.stringify({ok:true,rooms:rooms.size,uptime:process.uptime()}));return}res.writeHead(404);res.end()});
const wss=new WebSocketServer({server,maxPayload:16*1024});
wss.on("connection",ws=>{
  let current=null,uid="";
  ws.on("message",raw=>{
    let m;try{m=JSON.parse(String(raw))}catch{return}
    if(m.type==="join"){
      const worldId=key(m.worldId),id=key(m.uid);if(!worldId||!id)return;
      current=room(worldId);uid=id;
      current.players.set(uid,{ws,uid,name:String(m.name||"Pirata").slice(0,40),shipId:key(m.shipId),x:Number(m.x)||0,y:Number(m.y)||0,rotation:Number(m.rotation)||0,direction:String(m.direction||"n").slice(0,8),hp:Math.max(0,Number(m.hp)||0),updatedAt:Date.now()});
      send(ws,{type:"joined",worldId,uid,tickHz:TICK_HZ});return;
    }
    if(!current||!uid)return;
    const p=current.players.get(uid);if(!p)return;
    if(m.type==="state"){
      p.x=Number(m.x)||0;p.y=Number(m.y)||0;p.rotation=Number(m.rotation)||0;p.direction=String(m.direction||"n").slice(0,8);p.hp=Math.max(0,Number(m.hp)||0);p.updatedAt=Date.now();return;
    }
    if(m.type==="shot"){
      const shotId=key(m.shotId||uid+"-"+Date.now());if(current.shots.has(shotId))return;
      const event={type:"shot",uid,shotId,from:m.from||null,to:m.to||null,ammoId:key(m.ammoId),damage:clamp(m.damage,0,5000),duration:clamp(m.duration||620,120,3000),at:Date.now()};
      current.shots.set(shotId,event);broadcast(current,event,ws);return;
    }
    if(m.type==="boss.ensure"){
      const bossId=key(m.bossId);if(!bossId)return;
      if(!current.bosses.has(bossId)){const maxHp=clamp(m.maxHp,1,100000);current.bosses.set(bossId,{bossId,entityId:key(m.entityId||bossId),name:String(m.name||"Boss").slice(0,80),maxHp,hp:maxHp,phase:1,defeated:false,updatedAt:Date.now()})}
      send(ws,{type:"boss.state",boss:current.bosses.get(bossId)});return;
    }
    if(m.type==="boss.damage"){
      const bossId=key(m.bossId),shotId=key(m.shotId);const b=current.bosses.get(bossId);if(!b||b.defeated||!shotId||current.shots.has("hit:"+shotId))return;
      current.shots.set("hit:"+shotId,{at:Date.now()});const damage=clamp(m.damage,1,5000);b.hp=Math.max(0,b.hp-damage);b.defeated=b.hp<=0;b.updatedAt=Date.now();b.lastHitBy=uid;
      broadcast(current,{type:"boss-hit",uid,bossId,shotId,damage,hp:b.hp,maxHp:b.maxHp,defeated:b.defeated,at:Date.now()});return;
    }
  });
  ws.on("close",()=>{if(current&&uid){current.players.delete(uid);broadcast(current,{type:"player-left",uid,at:Date.now()});if(!current.players.size)rooms.delete(current.id)}});
});
setInterval(()=>{const now=Date.now();for(const r of rooms.values()){for(const [id,p] of r.players)if(now-p.updatedAt>STALE_MS){try{p.ws.close()}catch{}r.players.delete(id)}for(const [id,s] of r.shots)if(now-Number(s.at||0)>10000)r.shots.delete(id);broadcast(r,snapshot(r))}},SNAPSHOT_MS);
server.listen(PORT,"0.0.0.0",()=>console.log(`Tabuada Quest realtime server on 0.0.0.0:${PORT} @ ${TICK_HZ}Hz`));
