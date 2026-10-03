const clamp=(v,min,max)=>Math.min(max,Math.max(min,v));
const safeKey=value=>String(value||"").replace(/[.#$\[\]\/]/g,"_").slice(0,96);
const json=async response=>{
  const data=await response.json().catch(()=>null);
  if(!response.ok){
    console.error("[TQ Multiplayer] RTDB request failed",response.status,response.statusText,data);
    throw new Error("RTDB "+response.status+" "+response.statusText);
  }
  return data;
};

export class MultiplayerRuntime extends EventTarget{
  constructor(auth,config={},options={}){
    super();
    this.auth=auth;this.config=config||{};this.enabled=options.enabled!==false;
    this.databaseURL=String(config.databaseURL||("https://"+config.projectId+"-default-rtdb.firebaseio.com")).replace(/\/$/,"");
    this.worldId="";this.timer=0;this.pollTimer=0;this.lastPush=0;this.lastEventKey="";this.socket=null;this.socketReady=false;this.socketUrl=String(config.multiplayer?.websocketURL||options.websocketURL||"").trim();this.socketReconnect=0;
    this.snapshotHz=clamp(Number(options.snapshotHz)||10,5,20);this.pollMs=Math.max(80,Number(options.pollMs)||100);
    this.getLocalState=null;this.shipId="";this.displayName="";this.lastBossSnapshot="";this.pushInFlight=false;this.pollInFlight=false;
  }
  async request(path,{method="GET",body=null,query=""}={}){
    if(!this.enabled||!this.auth?.status?.().authenticated)return null;
    const token=await this.auth.ensureFreshToken();if(!token)return null;
    const url=this.databaseURL+"/"+path.replace(/^\/+|\/+$/g,"")+".json?auth="+encodeURIComponent(token)+(query?"&"+query:"");
    const response=await fetch(url,{method,headers:body?{"Content-Type":"application/json"}:undefined,body:body?JSON.stringify(body):undefined});
    return json(response);
  }
  connectSocket(){
    clearTimeout(this.socketReconnect);
    if(!this.socketUrl||!this.worldId||typeof WebSocket==="undefined")return false;
    try{this.socket?.close()}catch{}
    const ws=new WebSocket(this.socketUrl);this.socket=ws;this.socketReady=false;
    ws.addEventListener("open",()=>{if(ws!==this.socket)return;this.socketReady=true;const st=this.auth.status();ws.send(JSON.stringify({type:"join",worldId:this.worldId,uid:st.uid,name:this.displayName||st.displayName||"Pirata",shipId:this.shipId}));this.dispatchEvent(new CustomEvent("transport",{detail:{online:true,kind:"websocket"}}))});
    ws.addEventListener("message",event=>{if(ws!==this.socket)return;let data;try{data=JSON.parse(event.data)}catch{return}
      if(data.type==="snapshot"){const uid=String(this.auth.status().uid||"");this.dispatchEvent(new CustomEvent("players",{detail:{worldId:this.worldId,players:(data.players||[]).filter(p=>p.uid!==uid)}}));this.dispatchEvent(new CustomEvent("bosses",{detail:{worldId:this.worldId,bosses:data.bosses||{}}}));}
      else if(data.type==="boss.state"&&data.boss)this.dispatchEvent(new CustomEvent("bosses",{detail:{worldId:this.worldId,bosses:{[data.boss.bossId]:data.boss}}}));
      else if(data.type==="shot"||data.type==="boss-hit"||data.type==="player-left")this.dispatchEvent(new CustomEvent("event",{detail:data}));
    });
    const offline=()=>{if(ws!==this.socket)return;this.socketReady=false;this.dispatchEvent(new CustomEvent("transport",{detail:{online:false,kind:"websocket"}}));clearTimeout(this.socketReconnect);this.socketReconnect=setTimeout(()=>this.connectSocket(),3000)};
    ws.addEventListener("close",offline);ws.addEventListener("error",()=>{try{ws.close()}catch{}});
    return true;
  }
  socketSend(payload){if(!this.socketReady||this.socket?.readyState!==WebSocket.OPEN)return false;this.socket.send(JSON.stringify(payload));return true}
  async joinWorld(worldId,{getLocalState,shipId="",displayName=""}={}){
    await this.leaveWorld();this.worldId=safeKey(worldId);if(!this.worldId)return false;
    this.getLocalState=typeof getLocalState==="function"?getLocalState:null;this.shipId=String(shipId||"");this.displayName=String(displayName||"");
    console.info("[TQ Multiplayer] joining",this.worldId,this.databaseURL);
    this.connectSocket();
    await this.pushPresence(true);console.info("[TQ Multiplayer] presence online",this.worldId);this.timer=setInterval(()=>this.pushPresence(false).catch(()=>{}),Math.round(1000/this.snapshotHz));
    this.pollTimer=setInterval(()=>this.pollPlayers().catch(()=>{}),this.pollMs);await this.poll();return true;
  }
  localPayload(){
    const state=this.getLocalState?.()||{};const p=state.player||{};const status=this.auth.status();
    return {uid:status.uid,name:this.displayName||status.displayName||"Pirata",shipId:this.shipId,x:Number(p.x)||0,y:Number(p.y)||0,rotation:Number(p.rotation)||0,direction:String(p.direction||"n"),hp:Math.max(0,Number(state.navalPlayerHp)||0),updatedAt:Date.now(),online:true};
  }
  async pushPresence(force=false){
    if(!this.worldId||this.pushInFlight)return false;const now=Date.now();if(!force&&now-this.lastPush<80)return false;
    const uid=safeKey(this.auth.status().uid);if(!uid)return false;
    const local=this.localPayload();
    this.socketSend({type:"state",x:local.x,y:local.y,rotation:local.rotation,direction:local.direction,hp:local.hp});
    this.pushInFlight=true;
    try{
      await this.request("multiplayer/rooms/"+this.worldId+"/players/"+uid,{method:"PUT",body:this.localPayload()});
      this.lastPush=Date.now();
      return true;
    }finally{this.pushInFlight=false}
  }
  async pollPlayers(){
    if(!this.worldId)return;const uid=String(this.auth.status().uid||"");
    const players=await this.request("multiplayer/rooms/"+this.worldId+"/players",{query:"shallow=false"});
    if(players&&typeof players==="object"){
      const now=Date.now();const remote=Object.values(players).filter(p=>p&&p.uid!==uid&&now-Number(p.updatedAt||0)<8000).slice(0,4);
      this.dispatchEvent(new CustomEvent("players",{detail:{worldId:this.worldId,players:remote}}));
    }
  }
  async poll(){
    if(!this.worldId||this.pollInFlight)return;const uid=String(this.auth.status().uid||"");this.pollInFlight=true;
    try{
    await this.pollPlayers();
    const bosses=await this.request("multiplayer/rooms/"+this.worldId+"/bosses");
    this.dispatchEvent(new CustomEvent("bosses",{detail:{worldId:this.worldId,bosses:bosses&&typeof bosses==="object"?bosses:{}}}));
    const events=await this.request("multiplayer/rooms/"+this.worldId+"/events",{query:'orderBy="$key"&limitToLast=20'});
    if(events&&typeof events==="object"){
      const ordered=Object.entries(events).sort((a,b)=>a[0].localeCompare(b[0]));
      for(const [key,event] of ordered){if(this.lastEventKey&&key<=this.lastEventKey)continue;if(event?.uid!==uid)this.dispatchEvent(new CustomEvent("event",{detail:event}));this.lastEventKey=key;}
    }
    }finally{this.pollInFlight=false}
  }
  async sendShot(shot={}){
    if(!this.worldId)return false;const uid=String(this.auth.status().uid||"");if(!uid)return false;
    const event={type:"shot",uid,shotId:safeKey(shot.shotId||uid+"-"+Date.now()),from:shot.from||null,to:shot.to||null,ammoId:String(shot.ammoId||""),damage:Math.max(0,Number(shot.damage)||0),duration:Math.max(120,Number(shot.duration)||620),at:Date.now()};
    if(this.socketSend(event))return true;
    return false;
  }
  async ensureBoss(boss={}){
    if(!this.worldId)return null;const bossId=safeKey(boss.bossId);if(!bossId)return null;
    this.socketSend({type:"boss.ensure",bossId,entityId:String(boss.entityId||boss.bossId||""),name:String(boss.name||"Boss"),maxHp:Math.max(1,Number(boss.maxHp)||1)});
    return null;
  }
  async damageBoss(bossId,damage=1,meta={}){
    if(!this.worldId)return null;bossId=safeKey(bossId);if(!bossId)return null;
    this.socketSend({type:"boss.damage",bossId,damage:clamp(Number(damage)||1,1,5000),shotId:safeKey(meta.shotId||"")});
    return null;
  }
  async sendHit(){
    return false; // PvP disabled: players never damage other players.
  }
  async leaveWorld(){
    clearInterval(this.timer);clearInterval(this.pollTimer);clearTimeout(this.socketReconnect);this.timer=0;this.pollTimer=0;this.socketReady=false;try{this.socket?.close()}catch{}this.socket=null;
    if(this.worldId&&this.auth?.status?.().authenticated){const uid=safeKey(this.auth.status().uid);if(uid)await this.request("multiplayer/rooms/"+this.worldId+"/players/"+uid,{method:"DELETE"}).catch(()=>{});}
    this.worldId="";this.getLocalState=null;this.lastEventKey="";
  }
  destroy(){return this.leaveWorld()}
}
