const clamp=(v,min,max)=>Math.min(max,Math.max(min,Number(v)||0));
const safeKey=value=>String(value||"").replace(/[.#$\[\]\/]/g,"_").slice(0,96);
const serverKey=value=>String(value||"").replace(/[^a-zA-Z0-9._-]/g,"-").slice(0,96);

export class MultiplayerRuntime extends EventTarget{
  constructor(auth,config={},options={}){
    super();
    this.auth=auth;
    this.config=config||{};
    this.enabled=options.enabled!==false;
    this.worldId="";
    this.socket=null;
    this.socketReady=false;
    this.socketUrl=String(config.multiplayer?.websocketURL||options.websocketURL||"").trim();
    this.socketReconnect=0;
    this.reconnectAttempts=0;
    this.getLocalState=null;
    this.getCannonIds=null;
    this.shipId="";
    this.displayName="";
    this.pendingWorldEnsure=null;
    this.pendingBossEnsures=new Map();
    this.snapshotHz=clamp(Number(options.snapshotHz||config.multiplayer?.snapshotHz)||20,5,20);
    this.timer=0;
    this.stateSequence=0;
    this.lastAckSequence=0;
    this.intentionalClose=false;
    this.offlineFallbackLocked=false;
    this.protocolVersion="20261005-authoritative-v5-cannon-volley";
  }

  status(){
    return Object.freeze({
      online:this.socketReady===true,
      worldId:this.worldId,
      authority:this.socketReady?"server":"local",
      transport:"websocket"
    });
  }

  localPayload(){
    const state=this.getLocalState?.()||{};
    const p=state.player||{};
    const status=this.auth.status();
    return {
      uid:String(status.uid||""),
      name:this.displayName||status.displayName||"Pirata",
      shipId:this.shipId,
      cannonIds:(typeof this.getCannonIds==="function"?this.getCannonIds():[]).map(String).filter(Boolean).slice(0,64),
      x:Number(p.x)||0,
      y:Number(p.y)||0,
      vx:Number(p.vx)||0,
      vy:Number(p.vy)||0,
      rotation:Number(p.rotation)||0,
      direction:String(p.direction||"n"),
      hp:Math.max(0,Number(state.navalPlayerHp)||0),
      updatedAt:Date.now(),
      online:true
    };
  }

  connectSocket(){
    clearTimeout(this.socketReconnect);
    if(this.offlineFallbackLocked)return false;
    if(!this.enabled||!this.socketUrl||!this.worldId||typeof WebSocket==="undefined")return false;
    try{this.socket?.close()}catch{}
    this.intentionalClose=false;
    console.info("[TQ WS] connecting",this.socketUrl,this.worldId);
    const ws=new WebSocket(this.socketUrl);
    this.socket=ws;
    this.socketReady=false;

    ws.addEventListener("open",()=>{
      if(ws!==this.socket)return;
      this.socketReady=true;
      const st=this.auth.status(),local=this.localPayload();
      console.info("[TQ WS] open",this.worldId);
      ws.send(JSON.stringify({
        type:"join",worldId:this.worldId,uid:st.uid,
        name:this.displayName||st.displayName||"Pirata",
        shipId:this.shipId,cannonIds:local.cannonIds,x:local.x,y:local.y,vx:local.vx,vy:local.vy,rotation:local.rotation,
        direction:local.direction,hp:local.hp
      }));
      if(this.pendingWorldEnsure)ws.send(JSON.stringify(this.pendingWorldEnsure));
      for(const payload of this.pendingBossEnsures.values())ws.send(JSON.stringify(payload));
    });

    ws.addEventListener("message",event=>{
      if(ws!==this.socket)return;
      let data;try{data=JSON.parse(event.data)}catch{return}
      if(data.type==="joined"){
        const protocolOk=String(data.protocolVersion||"")===this.protocolVersion;
        this.dispatchEvent(new CustomEvent("joined",{detail:{...data,protocolOk,expectedProtocol:this.protocolVersion}}));
        if(!protocolOk){
          console.error("[TQ WS] protocol mismatch",{expected:this.protocolVersion,received:data.protocolVersion||"legacy"});
          this.socketReady=false;
          this.offlineFallbackLocked=true;
          this.dispatchEvent(new CustomEvent("transport",{detail:{
            online:false,kind:"websocket",authority:"local",
            reason:"protocol_mismatch",
            expectedProtocol:this.protocolVersion,
            receivedProtocol:String(data.protocolVersion||"legacy"),
            fallback:"offline"
          }}));
          try{ws.close()}catch{}
          return;
        }
        this.reconnectAttempts=0;
        this.dispatchEvent(new CustomEvent("transport",{detail:{online:true,kind:"websocket",authority:"server",protocolVersion:data.protocolVersion}}));
        if(this.pendingWorldEnsure)this.socketSend(this.pendingWorldEnsure);
        return;
      }
      if(data.type==="state.ack"){
        const seq=Math.max(0,Math.floor(Number(data.seq)||0));
        if(seq>=this.lastAckSequence){
          this.lastAckSequence=seq;
          this.dispatchEvent(new CustomEvent("authority",{detail:data}));
        }
        return;
      }
      if(data.type==="snapshot"||data.type==="state.delta"){
        const uid=String(this.auth.status().uid||"");
        this.dispatchEvent(new CustomEvent("players",{detail:{
          worldId:this.worldId,
          serverTime:data.serverTime,
          full:data.type==="snapshot",
          players:(data.players||[]).filter(p=>String(p.uid)!==uid)
        }}));
        this.dispatchEvent(new CustomEvent("entities",{detail:{
          worldId:this.worldId,
          serverTime:data.serverTime,
          full:data.type==="snapshot",
          entities:data.entities||{}
        }}));
        this.dispatchEvent(new CustomEvent("projectiles",{detail:{
          worldId:this.worldId,
          serverTime:data.serverTime,
          full:data.type==="snapshot",
          projectiles:data.projectiles||{}
        }}));
        if(data.type==="snapshot"){
          this.dispatchEvent(new CustomEvent("bosses",{detail:{
            worldId:this.worldId,
            bosses:data.bosses||{}
          }}));
        }
        return;
      }
      if(data.type==="boss.state"&&data.boss){
        this.dispatchEvent(new CustomEvent("bosses",{detail:{worldId:this.worldId,bosses:{[data.boss.bossId]:data.boss}}}));
        return;
      }
      if(["party.invite","party.invite.sent","party.updated","party.challenge.failed","party.reward","party.error"].includes(data.type)){
        this.dispatchEvent(new CustomEvent("party",{detail:data}));
        return;
      }
      if(["shot","entity-hit","boss-hit","projectile.spawn","projectile.hit","projectile.miss","fire.accepted","fire.volley.accepted","fire.rejected","player-left"].includes(data.type)){
        this.dispatchEvent(new CustomEvent("event",{detail:data}));
      }
    });

    const offline=()=>{
      if(ws!==this.socket)return;
      this.socketReady=false;
      clearTimeout(this.socketReconnect);
      this.socketReconnect=0;
      if(this.intentionalClose){
        this.intentionalClose=false;
        return;
      }
      console.warn("[TQ WS] server connection lost; switching temporarily to offline world");
      this.dispatchEvent(new CustomEvent("transport",{detail:{
        online:false,
        kind:"websocket",
        authority:"local",
        reason:"server_disconnected",
        fallback:"offline"
      }}));
      if(this.offlineFallbackLocked)return;
      this.reconnectAttempts=(Number(this.reconnectAttempts)||0)+1;
      const delay=Math.min(10000,500*(2**Math.min(6,this.reconnectAttempts-1)));
      this.socketReconnect=setTimeout(()=>{
        this.socketReconnect=0;
        this.connectSocket();
      },delay);
    };
    ws.addEventListener("close",offline);
    ws.addEventListener("error",()=>{try{ws.close()}catch{}});
    return true;
  }

  socketSend(payload){
    if(!this.socketReady||this.socket?.readyState!==WebSocket.OPEN)return false;
    this.socket.send(JSON.stringify(payload));
    return true;
  }

  async joinWorld(worldId,{getLocalState,getCannonIds,shipId="",displayName=""}={}){
    await this.leaveWorld();
    this.worldId=safeKey(worldId);
    if(!this.worldId)return false;
    this.offlineFallbackLocked=false;
    this.reconnectAttempts=0;
    this.intentionalClose=false;
    this.getLocalState=typeof getLocalState==="function"?getLocalState:null;
    this.getCannonIds=typeof getCannonIds==="function"?getCannonIds:null;
    this.shipId=String(shipId||"");
    this.displayName=String(displayName||"");
    console.info("[TQ Multiplayer] joining authoritative world",this.worldId);
    this.connectSocket();
    this.timer=setInterval(()=>this.pushRealtimeState(),Math.round(1000/this.snapshotHz));
    return true;
  }

  ensureWorld(seed={}){
    if(!this.worldId)return false;
    const payload={
      type:"world.ensure",
      revision:String(seed.revision||""),
      bounds:seed.bounds&&typeof seed.bounds==="object"?seed.bounds:{},
      entities:Array.isArray(seed.entities)?seed.entities:[]
    };
    this.pendingWorldEnsure=payload;
    return this.socketSend(payload);
  }

  pushRealtimeState(){
    if(!this.worldId||!this.socketReady)return false;
    const local=this.localPayload();
    const seq=++this.stateSequence;
    return this.socketSend({
      type:"state",seq,shipId:local.shipId,cannonIds:local.cannonIds,x:local.x,y:local.y,vx:local.vx,vy:local.vy,rotation:local.rotation,
      direction:local.direction,hp:local.hp
    });
  }

  async sendShot(shot={}){
    if(!this.worldId)return false;
    const uid=String(this.auth.status().uid||"");
    if(!uid)return false;
    return this.socketSend({
      type:"shot",uid,
      shotId:safeKey(shot.shotId||uid+"-"+Date.now()),
      from:shot.from||null,to:shot.to||null,
      ammoId:String(shot.ammoId||""),
      damage:Math.max(0,Number(shot.damage)||0),
      duration:Math.max(120,Number(shot.duration)||620),
      at:Date.now()
    });
  }

  fireRequest(shot={}){
    if(!this.worldId||!this.socketReady)return false;
    const uid=String(this.auth.status().uid||"");
    if(!uid)return false;
    return this.socketSend({
      type:"fire.request",
      shotId:safeKey(shot.shotId||uid+"-"+Date.now()),
      volleyId:safeKey(shot.volleyId||""),
      targetId:serverKey(shot.targetId||""),
      from:shot.from||null,
      ammoId:String(shot.ammoId||""),
      cannonId:String(shot.cannonId||"")
    });
  }

  fireProjectile(shot={}){
    // Compatibility alias. Authoritative servers receive only player intent;
    // damage/range/speed/cooldown are resolved from server-side catalogs.
    return this.fireRequest(shot);
  }

  fireVolley({volleyId="",targetId="",ammoId="",shots=[]}={}){
    if(!this.worldId||!this.socketReady)return false;
    const normalized=Array.isArray(shots)?shots.slice(0,64).map((shot,index)=>({
      shotId:safeKey(shot?.shotId||"shot-"+index),
      cannonId:safeKey(shot?.cannonId||""),
      from:shot?.from&&typeof shot.from==="object"?{
        x:Number(shot.from.x)||0,
        y:Number(shot.from.y)||0
      }:null
    })).filter(shot=>shot.cannonId):[];
    if(!normalized.length)return false;
    return this.socketSend({
      type:"fire.volley",
      volleyId:safeKey(volleyId||("volley-"+Date.now())),
      targetId:serverKey(targetId||""),
      ammoId:String(ammoId||""),
      shots:normalized
    });
  }

  setChallengeProtection(active=false,until=0){
    if(!this.worldId||!this.socketReady)return false;
    return this.socketSend({
      type:"challenge.protection",
      active:active===true,
      until:Math.max(0,Math.floor(Number(until)||0))
    });
  }

  inviteParty(targetUid){
    if(!this.worldId||!this.socketReady)return false;
    return this.socketSend({type:"party.invite",targetUid:safeKey(targetUid)});
  }

  acceptPartyInvite(inviteId,answer){
    if(!this.worldId||!this.socketReady)return false;
    return this.socketSend({type:"party.accept",inviteId:safeKey(inviteId),answer:Number(answer)});
  }

  declinePartyInvite(inviteId){
    if(!this.worldId||!this.socketReady)return false;
    return this.socketSend({type:"party.decline",inviteId:safeKey(inviteId)});
  }

  leaveParty(){
    if(!this.worldId||!this.socketReady)return false;
    return this.socketSend({type:"party.leave"});
  }

  sharePartyReward({claimKey="",gold=0,xp=0}={}){
    if(!this.worldId||!this.socketReady)return false;
    return this.socketSend({
      type:"party.reward",
      claimKey:safeKey(claimKey),
      gold:Math.max(0,Math.floor(Number(gold)||0)),
      xp:Math.max(0,Math.floor(Number(xp)||0))
    });
  }

  async ensureBoss(boss={}){
    const bossId=safeKey(boss.bossId);
    if(!bossId)return false;
    const payload={
      type:"boss.ensure",bossId,
      entityId:String(boss.entityId||boss.bossId||""),
      name:String(boss.name||"Boss"),
      maxHp:Math.max(1,Number(boss.maxHp)||1),
      respawnDelayMs:Math.max(1000,Number(boss.respawnDelayMs)||300000)
    };
    this.pendingBossEnsures.set(bossId,payload);
    return this.socketSend(payload);
  }

  async damageEntity(entityId,damage=1,meta={}){
    if(!this.worldId)return false;
    entityId=serverKey(entityId);
    if(!entityId)return false;
    return this.socketSend({
      type:"entity.damage",
      entityId,
      damage:clamp(Number(damage)||1,.1,5000),
      shotId:safeKey(meta.shotId||"")
    })===true;
  }

  async damageBoss(bossId,damage=1,meta={}){
    if(!this.worldId)return false;
    bossId=safeKey(bossId);
    if(!bossId)return false;
    return this.socketSend({
      type:"boss.damage",
      bossId,
      damage:clamp(Number(damage)||1,.1,5000),
      shotId:safeKey(meta.shotId||"")
    })===true;
  }

  async sendHit(){return false}

  async leaveWorld(){
    clearInterval(this.timer);
    clearTimeout(this.socketReconnect);
    this.timer=0;
    this.socketReconnect=0;
    this.reconnectAttempts=0;
    this.socketReady=false;
    this.intentionalClose=true;
    try{this.socket?.close()}catch{}
    this.socket=null;
    this.worldId="";
    this.getLocalState=null;
    this.getCannonIds=null;
    this.pendingWorldEnsure=null;
    this.pendingBossEnsures.clear();
    this.offlineFallbackLocked=false;
    return true;
  }

  destroy(){return this.leaveWorld()}
}
