const clamp=(v,min,max)=>Math.min(max,Math.max(min,v));
const safeKey=value=>String(value||"").replace(/[.#$\[\]\/]/g,"_").slice(0,96);
const json=async response=>response.ok?response.json().catch(()=>null):null;

export class MultiplayerRuntime extends EventTarget{
  constructor(auth,config={},options={}){
    super();
    this.auth=auth;this.config=config||{};this.enabled=options.enabled!==false;
    this.databaseURL=String(config.databaseURL||("https://"+config.projectId+"-default-rtdb.firebaseio.com")).replace(/\/$/,"");
    this.worldId="";this.timer=0;this.pollTimer=0;this.lastPush=0;this.lastEventKey="";
    this.snapshotHz=clamp(Number(options.snapshotHz)||5,2,10);this.pollMs=Math.max(180,Number(options.pollMs)||250);
    this.getLocalState=null;this.shipId="";this.displayName="";
  }
  async request(path,{method="GET",body=null,query=""}={}){
    if(!this.enabled||!this.auth?.status?.().authenticated)return null;
    const token=await this.auth.ensureFreshToken();if(!token)return null;
    const url=this.databaseURL+"/"+path.replace(/^\/+|\/+$/g,"")+".json?auth="+encodeURIComponent(token)+(query?"&"+query:"");
    const response=await fetch(url,{method,headers:body?{"Content-Type":"application/json"}:undefined,body:body?JSON.stringify(body):undefined});
    return json(response);
  }
  async joinWorld(worldId,{getLocalState,shipId="",displayName=""}={}){
    await this.leaveWorld();this.worldId=safeKey(worldId);if(!this.worldId)return false;
    this.getLocalState=typeof getLocalState==="function"?getLocalState:null;this.shipId=String(shipId||"");this.displayName=String(displayName||"");
    await this.pushPresence(true);this.timer=setInterval(()=>this.pushPresence(false).catch(()=>{}),Math.round(1000/this.snapshotHz));
    this.pollTimer=setInterval(()=>this.poll().catch(()=>{}),this.pollMs);await this.poll();return true;
  }
  localPayload(){
    const state=this.getLocalState?.()||{};const p=state.player||{};const status=this.auth.status();
    return {uid:status.uid,name:this.displayName||status.displayName||"Pirata",shipId:this.shipId,x:Number(p.x)||0,y:Number(p.y)||0,rotation:Number(p.rotation)||0,direction:String(p.direction||"n"),hp:Math.max(0,Number(state.navalPlayerHp)||0),updatedAt:Date.now(),online:true};
  }
  async pushPresence(force=false){
    if(!this.worldId)return false;const now=Date.now();if(!force&&now-this.lastPush<80)return false;this.lastPush=now;
    const uid=safeKey(this.auth.status().uid);if(!uid)return false;
    await this.request("multiplayer/rooms/"+this.worldId+"/players/"+uid,{method:"PUT",body:this.localPayload()});return true;
  }
  async poll(){
    if(!this.worldId)return;const uid=String(this.auth.status().uid||"");
    const players=await this.request("multiplayer/rooms/"+this.worldId+"/players",{query:"shallow=false"});
    if(players&&typeof players==="object"){
      const now=Date.now();const remote=Object.values(players).filter(p=>p&&p.uid!==uid&&now-Number(p.updatedAt||0)<8000).slice(0,4);
      this.dispatchEvent(new CustomEvent("players",{detail:{worldId:this.worldId,players:remote}}));
    }
    const events=await this.request("multiplayer/rooms/"+this.worldId+"/events",{query:'orderBy="$key"&limitToLast=20'});
    if(events&&typeof events==="object"){
      const ordered=Object.entries(events).sort((a,b)=>a[0].localeCompare(b[0]));
      for(const [key,event] of ordered){if(this.lastEventKey&&key<=this.lastEventKey)continue;if(event?.uid!==uid)this.dispatchEvent(new CustomEvent("event",{detail:event}));this.lastEventKey=key;}
    }
  }
  async sendShot(shot={}){
    if(!this.worldId)return false;const uid=String(this.auth.status().uid||"");if(!uid)return false;
    const event={type:"shot",uid,shotId:safeKey(shot.shotId||uid+"-"+Date.now()),from:shot.from||null,to:shot.to||null,ammoId:String(shot.ammoId||""),damage:Math.max(0,Number(shot.damage)||0),duration:Math.max(120,Number(shot.duration)||620),at:Date.now()};
    await this.request("multiplayer/rooms/"+this.worldId+"/events",{method:"POST",body:event});return true;
  }
  async sendHit(hit={}){
    if(!this.worldId)return false;const uid=String(this.auth.status().uid||"");const targetUid=safeKey(hit.targetUid);if(!uid||!targetUid)return false;
    const event={type:"hit",uid,targetUid,shotId:safeKey(hit.shotId||""),damage:clamp(Number(hit.damage)||1,1,5000),at:Date.now()};
    await this.request("multiplayer/rooms/"+this.worldId+"/events",{method:"POST",body:event});return true;
  }
  async leaveWorld(){
    clearInterval(this.timer);clearInterval(this.pollTimer);this.timer=0;this.pollTimer=0;
    if(this.worldId&&this.auth?.status?.().authenticated){const uid=safeKey(this.auth.status().uid);if(uid)await this.request("multiplayer/rooms/"+this.worldId+"/players/"+uid,{method:"DELETE"}).catch(()=>{});}
    this.worldId="";this.getLocalState=null;this.lastEventKey="";
  }
  destroy(){return this.leaveWorld()}
}
