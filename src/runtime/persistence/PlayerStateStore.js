function parsePayload(raw){
  if(!raw)return null;
  try{return JSON.parse(raw)}catch{return null}
}

const hashClaimKey=value=>{
  const text=String(value||"");
  let h1=0x811c9dc5,h2=0x9e3779b9;
  for(let i=0;i<text.length;i++){
    const code=text.charCodeAt(i);
    h1=Math.imul(h1^code,0x01000193)>>>0;
    h2=Math.imul(h2^(code+i),0x85ebca6b)>>>0;
  }
  return h1.toString(36)+"-"+h2.toString(36)+"-"+text.length.toString(36);
};

const parseClaimDocument=document=>{
  const fields=document?.fields||{};
  return {
    claimKey:String(fields.claimKey?.stringValue||""),
    payload:parsePayload(String(fields.payload?.stringValue||""))||{},
    createdAt:String(fields.createdAt?.timestampValue||"")
  };
};

export class PlayerStateStore extends EventTarget {
  constructor(auth, config, options={}){
    super();
    this.auth=auth;
    this.config=config||{};
    this.storage=options.storage||globalThis.localStorage;
    this.keyPrefix=options.keyPrefix||"tq.player.state.v6";
    this.progressEpoch=7;
    this.legacyKey=options.legacyKey||"tabuadaQuest.playerState";
    this.syncTimer=0;
    this.syncDelay=Math.max(250,Number(options.syncDelay)||1600);

    globalThis.addEventListener?.("online",()=>this.syncNow().catch(()=>{}));
  }

  accountKey(uid){
    return this.keyPrefix+"."+String(uid||"").trim();
  }

  metaKey(uid){
    return this.accountKey(uid)+".meta";
  }

  readMeta(uid){
    try{return JSON.parse(this.storage?.getItem?.(this.metaKey(uid))||"{}")||{}}catch{return {}}
  }

  writeMeta(uid,patch={}){
    if(!uid)return;
    const next={...this.readMeta(uid),...patch};
    try{this.storage?.setItem?.(this.metaKey(uid),JSON.stringify(next))}catch{}
  }

  hasPendingLocal(){
    const auth=this.auth.status();
    return Boolean(auth.uid&&this.readMeta(auth.uid).pendingSync);
  }

  status(){
    const auth=this.auth.status();
    return Object.freeze({
      authenticated:auth.authenticated,
      uid:auth.uid,
      online:auth.online,
      canPlay:Boolean(auth.authenticated),
      accountRequired:true,
      offlineAllowed:Boolean(auth.authenticated)
    });
  }

  isCurrentProgress(state){
    return Number(state?.progressEpoch)===this.progressEpoch;
  }

  migrateProgress(state){
    if(!state||typeof state!=="object")return null;
    const epoch=Number(state.progressEpoch||0);
    if(epoch===this.progressEpoch)return state;
    // Epoch 6 is the immediately previous account format. Preserve its actual
    // progress and upgrade the marker instead of treating it as an empty game.
    if(epoch===6)return {...state,progressEpoch:this.progressEpoch};
    return null;
  }

  load(){
    const auth=this.auth.status();
    if(!auth.authenticated||!auth.uid)return null;
    const scoped=parsePayload(this.storage?.getItem?.(this.accountKey(auth.uid)));
    const migrated=this.migrateProgress(scoped);
    if(migrated&&Number(scoped?.progressEpoch)!==this.progressEpoch){
      try{this.storage?.setItem?.(this.accountKey(auth.uid),JSON.stringify(migrated))}catch{}
    }
    return migrated;
  }

  save(state,{sync=true}={}){
    const auth=this.auth.status();
    if(!auth.authenticated||!auth.uid)return state;
    const payload=JSON.stringify({...state,progressEpoch:this.progressEpoch});
    try{this.storage?.setItem?.(this.accountKey(auth.uid),payload)}catch{}
    const previous=this.readMeta(auth.uid);
    this.writeMeta(auth.uid,{
      updatedAt:Date.now(),
      // A local-only autosave must never cancel a durable checkpoint that is
      // already waiting for Firestore.
      pendingSync:Boolean(sync)||previous.pendingSync===true
    });
    if(sync)this.scheduleSync();
    return state;
  }

  clearCurrentAccount(){
    const auth=this.auth.status();
    if(!auth.uid)return false;
    try{
      this.storage?.removeItem?.(this.accountKey(auth.uid));
      this.storage?.removeItem?.(this.metaKey(auth.uid));
      return true;
    }catch{return false}
  }

  firestoreUrl(uid){
    return "https://firestore.googleapis.com/v1/projects/"
      +encodeURIComponent(this.config.projectId)
      +"/databases/(default)/documents/players/"
      +encodeURIComponent(String(uid||""))
      +"/state/current";
  }

  rewardClaimsCollectionUrl(uid){
    return "https://firestore.googleapis.com/v1/projects/"
      +encodeURIComponent(this.config.projectId)
      +"/databases/(default)/documents/players/"
      +encodeURIComponent(String(uid||""))
      +"/rewardClaims";
  }

  rewardClaimUrl(uid,claimKey){
    return this.rewardClaimsCollectionUrl(uid)+"/"+encodeURIComponent(hashClaimKey(claimKey));
  }

  async reserveRewardClaim(claimKey,payload={}){
    const auth=this.auth.status();
    const key=String(claimKey||"").trim();
    if(!key)return {ok:false,code:"invalid_claim",claim:null};
    if(!auth.authenticated||!auth.uid)return {ok:false,code:"auth_required",claim:null};
    if(globalThis.navigator?.onLine===false)return {ok:false,code:"offline",claim:null};

    try{
      const token=await this.auth.ensureFreshToken();
      if(!token)return {ok:false,code:"auth_required",claim:null};

      const documentId=hashClaimKey(key);
      const existingResponse=await fetch(this.rewardClaimUrl(auth.uid,key),{
        headers:{Authorization:"Bearer "+token}
      });
      if(existingResponse.ok){
        const document=await existingResponse.json().catch(()=>null);
        const result={ok:false,code:"duplicate",claim:parseClaimDocument(document)};
        this.emit("reward-claim",result);
        return result;
      }

      const response=await fetch(
        this.rewardClaimsCollectionUrl(auth.uid)+"?documentId="+encodeURIComponent(documentId),
        {
          method:"POST",
          headers:{
            Authorization:"Bearer "+token,
            "Content-Type":"application/json"
          },
          body:JSON.stringify({
            fields:{
              claimKey:{stringValue:key},
              payload:{stringValue:JSON.stringify(payload&&typeof payload==="object"?payload:{})},
              createdAt:{timestampValue:new Date().toISOString()}
            }
          })
        }
      );

      if(response.ok){
        const document=await response.json().catch(()=>null);
        const claim=parseClaimDocument(document);
        const result={ok:true,code:"reserved",claim};
        this.emit("reward-claim",result);
        return result;
      }

      if(response.status===409){
        const existing=await fetch(this.rewardClaimUrl(auth.uid,key),{
          headers:{Authorization:"Bearer "+token}
        });
        const document=existing.ok?await existing.json().catch(()=>null):null;
        const result={ok:false,code:"duplicate",claim:parseClaimDocument(document)};
        this.emit("reward-claim",result);
        return result;
      }

      const result={ok:false,code:"claim_unavailable",claim:null,status:response.status};
      this.emit("reward-claim",result);
      return result;
    }catch{
      const result={ok:false,code:"claim_unavailable",claim:null};
      this.emit("reward-claim",result);
      return result;
    }
  }

  async fetchRemote(){
    const auth=this.auth.status();
    if(!auth.authenticated||!auth.uid)return {ok:false,code:"auth_required",state:null};
    if(globalThis.navigator?.onLine===false)return {ok:false,code:"restore_offline",state:null};

    try{
      const token=await this.auth.ensureFreshToken();
      if(!token)return {ok:false,code:"auth_required",state:null};

      const response=await fetch(this.firestoreUrl(auth.uid),{
        headers:{Authorization:"Bearer "+token}
      });

      if(response.status===404)return {ok:false,code:"remote_state_empty",state:null};
      if(!response.ok)return {ok:false,code:"restore_failed",state:null};

      const document=await response.json();
      const raw=String(document?.fields?.payload?.stringValue||"");
      const state=parsePayload(raw);
      const migrated=this.migrateProgress(state);
      return migrated
        ? {ok:true,code:Number(state?.progressEpoch)===this.progressEpoch?"restored":"restored_migrated",state:migrated}
        : {ok:false,code:"remote_state_reset",state:null};
    }catch{
      return {ok:false,code:"restore_failed",state:null};
    }
  }

  async restore(){
    const result=await this.fetchRemote();
    if(result.ok&&result.state){
      const auth=this.auth.status();
      const local=this.load();
      const meta=auth.uid?this.readMeta(auth.uid):{};
      // Never let an older cloud snapshot overwrite newer gameplay that is
      // already durable in the account-scoped local cache.
      if(local&&meta.pendingSync===true){
        result.state=local;
        result.code="restored_local_pending";
        this.scheduleSync();
      }else{
        this.save(result.state,{sync:false});
      }
    }
    this.emit("restore",result);
    return result;
  }

  scheduleSync(){
    clearTimeout(this.syncTimer);
    this.syncTimer=setTimeout(()=>this.syncNow().catch(()=>{}),this.syncDelay);
  }

  async syncNow(){
    clearTimeout(this.syncTimer);
    this.syncTimer=0;

    const auth=this.auth.status();
    if(!auth.authenticated||!auth.uid)return {ok:false,code:"auth_required"};
    if(globalThis.navigator?.onLine===false)return {ok:false,code:"sync_pending"};

    const state=this.load();
    if(!state)return {ok:false,code:"local_state_empty"};
    const localMeta=this.readMeta(auth.uid);

    try{
      const token=await this.auth.ensureFreshToken();
      if(!token)return {ok:false,code:"auth_required"};

      const response=await fetch(this.firestoreUrl(auth.uid),{
        method:"PATCH",
        headers:{
          Authorization:"Bearer "+token,
          "Content-Type":"application/json"
        },
        body:JSON.stringify({
          fields:{
            payload:{stringValue:JSON.stringify(state)},
            deviceUpdatedAt:{integerValue:String(Number(localMeta.updatedAt)||Date.now())},
            clientSyncedAt:{timestampValue:new Date().toISOString()}
          }
        })
      });

      const result={ok:response.ok,code:response.ok?"synced":"sync_pending"};
      if(response.ok)this.writeMeta(auth.uid,{pendingSync:false,lastSyncedAt:Date.now()});
      this.emit("sync",result);
      return result;
    }catch{
      const result={ok:false,code:"sync_pending"};
      this.emit("sync",result);
      return result;
    }
  }

  emit(type,detail){
    this.dispatchEvent(new CustomEvent(type,{detail}));
    globalThis.dispatchEvent?.(new CustomEvent("tq:player-"+type,{detail}));
  }
}
