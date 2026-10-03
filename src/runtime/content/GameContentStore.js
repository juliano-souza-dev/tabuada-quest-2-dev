const parseJson=raw=>{
  try{return raw?JSON.parse(raw):null}catch{return null}
};

const cleanPath=value=>{
  const raw=String(value||"").split("?")[0].split("#")[0].replace(/\\/g,"/");
  return raw.replace(/^\.\//,"").replace(/^\//,"");
};

const fieldValue=value=>{
  if(value===null||value===undefined)return null;
  if(Object.prototype.hasOwnProperty.call(value,"stringValue"))return String(value.stringValue||"");
  if(Object.prototype.hasOwnProperty.call(value,"integerValue"))return Number(value.integerValue)||0;
  if(Object.prototype.hasOwnProperty.call(value,"doubleValue"))return Number(value.doubleValue)||0;
  if(Object.prototype.hasOwnProperty.call(value,"booleanValue"))return value.booleanValue===true;
  if(Object.prototype.hasOwnProperty.call(value,"timestampValue"))return String(value.timestampValue||"");
  if(value.mapValue?.fields){
    return Object.fromEntries(Object.entries(value.mapValue.fields).map(([k,v])=>[k,fieldValue(v)]));
  }
  if(Array.isArray(value.arrayValue?.values))return value.arrayValue.values.map(fieldValue);
  return null;
};

const documentData=document=>{
  const fields=document?.fields||{};
  return Object.fromEntries(Object.entries(fields).map(([key,value])=>[key,fieldValue(value)]));
};

export class GameContentStore extends EventTarget {
  constructor(auth,config,options={}){
    super();
    this.auth=auth;
    this.config=config||{};
    this.storage=options.storage||globalThis.localStorage;
    this.keyPrefix=options.keyPrefix||"tq.game.content.v1";
    this.currentReleaseId="";
    this.resources=new Map();
    this.lastResult=null;
  }

  cfg(){
    return this.config?.gameContent&&typeof this.config.gameContent==="object"
      ?this.config.gameContent
      :{};
  }

  status(){
    const auth=this.auth?.status?.()||{};
    return Object.freeze({
      authenticated:auth.authenticated===true,
      online:auth.online!==false,
      releaseId:this.currentReleaseId,
      resources:this.resources.size,
      ready:this.resources.size>0
    });
  }

  pointerCacheKey(uid){
    return this.keyPrefix+"."+String(uid||"")+".pointer";
  }

  releaseCacheKey(uid,releaseId){
    return this.keyPrefix+"."+String(uid||"")+".release."+String(releaseId||"");
  }

  firestoreBase(){
    return "https://firestore.googleapis.com/v1/projects/"
      +encodeURIComponent(this.config.projectId)
      +"/databases/(default)/documents";
  }

  pointerPath(){
    return String(this.cfg().pointerDocument||"gameConfig/current").replace(/^\/+|\/+$/g,"");
  }

  pointerUrl(){
    return this.firestoreBase()+"/"+this.pointerPath().split("/").map(encodeURIComponent).join("/");
  }

  resourcesUrl(releaseId,pageToken=""){
    const releaseCollection=String(this.cfg().releaseCollection||"gameReleases");
    const base=this.firestoreBase()+"/"+encodeURIComponent(releaseCollection)+"/"+encodeURIComponent(releaseId)+"/resources";
    const params=new URLSearchParams({pageSize:"300"});
    if(pageToken)params.set("pageToken",pageToken);
    return base+"?"+params.toString();
  }

  readCachedPointer(uid){
    return parseJson(this.storage?.getItem?.(this.pointerCacheKey(uid)));
  }

  readCachedRelease(uid,releaseId){
    const cached=parseJson(this.storage?.getItem?.(this.releaseCacheKey(uid,releaseId)));
    if(!cached||!cached.resources||typeof cached.resources!=="object")return null;
    return cached;
  }

  writeCachedRelease(uid,releaseId,resources,meta={}){
    const payload={
      schema:"tq.game-content-cache",
      version:1,
      releaseId,
      savedAt:Date.now(),
      meta,
      resources:Object.fromEntries(resources)
    };
    try{
      this.storage?.setItem?.(this.releaseCacheKey(uid,releaseId),JSON.stringify(payload));
      this.storage?.setItem?.(this.pointerCacheKey(uid),JSON.stringify({releaseId,savedAt:payload.savedAt,meta}));
    }catch{}
  }

  activate(releaseId,resources,result={}){
    this.currentReleaseId=String(releaseId||"");
    this.resources=new Map(resources instanceof Map?resources:Object.entries(resources||{}));
    this.lastResult={...result,releaseId:this.currentReleaseId,resourceCount:this.resources.size};
    this.dispatchEvent(new CustomEvent("change",{detail:this.lastResult}));
    globalThis.dispatchEvent?.(new CustomEvent("tq:game-content",{detail:this.lastResult}));
    return this.lastResult;
  }

  has(path){
    return this.resources.has(cleanPath(path));
  }

  text(path){
    return this.resources.get(cleanPath(path))?.payload??null;
  }

  json(path){
    const raw=this.text(path);
    return raw===null?null:parseJson(raw);
  }

  async authHeaders(){
    const token=await this.auth?.ensureFreshToken?.();
    return token?{Authorization:"Bearer "+token}:null;
  }

  async fetchPointer(headers){
    const response=await fetch(this.pointerUrl(),{headers,cache:"no-store"});
    if(response.status===404)return {ok:false,code:"content_pointer_missing"};
    if(!response.ok)return {ok:false,code:"content_pointer_failed",status:response.status};
    const data=documentData(await response.json());
    const releaseId=String(data.releaseId||data.currentReleaseId||"").trim();
    if(!releaseId)return {ok:false,code:"content_release_missing"};
    return {ok:true,releaseId,meta:data};
  }

  async fetchResources(releaseId,headers){
    const resources=new Map();
    let pageToken="";
    do{
      const response=await fetch(this.resourcesUrl(releaseId,pageToken),{headers,cache:"no-store"});
      if(!response.ok)return {ok:false,code:"content_resources_failed",status:response.status};
      const body=await response.json().catch(()=>({}));
      for(const document of Array.isArray(body.documents)?body.documents:[]){
        const data=documentData(document);
        const path=cleanPath(data.path);
        const payload=String(data.payload||"");
        if(path&&payload)resources.set(path,{path,payload,sha:String(data.sha||""),updatedAt:String(data.updatedAt||"")});
      }
      pageToken=String(body.nextPageToken||"");
    }while(pageToken);

    return resources.size
      ?{ok:true,resources}
      :{ok:false,code:"content_release_empty"};
  }

  async prepare({preferRemote=true,allowCache=true}={}){
    const auth=this.auth?.status?.()||{};
    const uid=String(auth.uid||"");
    if(!auth.authenticated||!uid){
      return this.activate("",new Map(),{ok:false,code:"content_auth_required",source:"none"});
    }

    if(preferRemote&&auth.online!==false&&globalThis.navigator?.onLine!==false){
      try{
        const headers=await this.authHeaders();
        if(headers){
          const pointer=await this.fetchPointer(headers);
          if(pointer.ok){
            const fetched=await this.fetchResources(pointer.releaseId,headers);
            if(fetched.ok){
              this.writeCachedRelease(uid,pointer.releaseId,fetched.resources,pointer.meta||{});
              return this.activate(pointer.releaseId,fetched.resources,{
                ok:true,code:"content_remote_ready",source:"firestore",meta:pointer.meta||{}
              });
            }
          }
        }
      }catch(error){
        console.warn("[TabuadaQuest] Firestore content download failed",error);
      }
    }

    if(allowCache){
      const pointer=this.readCachedPointer(uid);
      const releaseId=String(pointer?.releaseId||"");
      const cached=releaseId?this.readCachedRelease(uid,releaseId):null;
      if(cached){
        return this.activate(releaseId,cached.resources,{
          ok:true,code:"content_cache_ready",source:"cache",offline:auth.online===false
        });
      }
    }

    return this.activate("",new Map(),{
      ok:false,
      code:auth.online===false?"content_cache_missing":"content_remote_unavailable",
      source:"none"
    });
  }
}

export {cleanPath as normalizeGameContentPath};
