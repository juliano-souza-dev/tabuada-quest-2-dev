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
    this.keyPrefix=options.keyPrefix||"tq.player.state.v1";
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

  load(){
    const auth=this.auth.status();
    if(!auth.authenticated||!auth.uid)return null;

    const key=this.accountKey(auth.uid);
    const scoped=parsePayload(this.storage?.getItem?.(key));
    if(scoped)return scoped;

    const legacy=parsePayload(this.storage?.getItem?.(this.legacyKey));
    if(legacy){
      try{
        this.storage?.setItem?.(key,JSON.stringify(legacy));
        this.storage?.removeItem?.(this.legacyKey);
      }catch{}
      return legacy;
    }
    return null;
  }

  save(state,{sync=true}={}){
    const auth=this.auth.status();
    if(!auth.authenticated||!auth.uid)return state;
    const payload=JSON.stringify(state);
    try{this.storage?.setItem?.(this.accountKey(auth.uid),payload)}catch{}
    this.writeMeta(auth.uid,{updatedAt:Date.now(),pendingSync:Boolean(sync)});
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
      return state
        ? {ok:true,code:"restored",state}
        : {ok:false,code:"remote_state_empty",state:null};
    }catch{
      return {ok:false,code:"restore_failed",state:null};
    }
  }

  async restore(){
    const result=await this.fetchRemote();
    if(result.ok&&result.state)this.save(result.state,{sync:false});
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
