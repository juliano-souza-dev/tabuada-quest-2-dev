import { SceneRuntime } from "./SceneRuntime.js?v=20260930-2256";
import { WorldRuntime } from "../world/WorldRuntime.js?v=20260930-2256";

const clone=value=>structuredClone(value);
const isPath=value=>typeof value==="string"&&(value.startsWith("./")||value.startsWith("/")||value.endsWith(".json"));

export class GameRuntime {
  static async load(root,manifestUrl="./src/config/game.manifest.json",options={}){
    const response=await fetch(manifestUrl,{cache:"no-store"});
    if(!response.ok)throw new Error("Game manifest load failed: "+response.status);
    const manifest=await response.json();
    const runtime=new GameRuntime(root,manifest,{...options,manifestUrl});
    await runtime.init();
    return runtime;
  }

  constructor(root,manifest={},options={}){
    this.root=root;
    this.manifest=clone(manifest);
    this.manifestUrl=options.manifestUrl||"";
    this.sceneCatalog=null;
    this.worldCatalog=null;
    this.sceneRuntime=null;
    this.worldRuntime=null;
    this.sceneHost=null;
    this.worldHost=null;
    this.current=null;
    this.history=[];
    this.worldStates={};
    this.flags={};
    this.inventory=[];
    this.persistenceKey=String(this.manifest.persistence?.sessionKey||"tq.game.runtime:v1");
    this.restoreSession=this.manifest.persistence?.restoreSession!==false;
    this.cleanups=[];
  }

  async init(){
    if(!this.root)throw new Error("GameRuntime requires a root element");
    this.root.innerHTML="";
    this.root.classList.add("tq-game-runtime");

    this.sceneHost=document.createElement("div");
    this.sceneHost.className="tq-game-runtime__scene";
    this.worldHost=document.createElement("div");
    this.worldHost.className="tq-game-runtime__world";
    this.worldHost.hidden=true;
    this.root.append(this.sceneHost,this.worldHost);

    const catalogs=this.manifest.catalogs||{};
    const [sceneCatalog,worldCatalog]=await Promise.all([
      this.loadJson(catalogs.scenes||"./src/config/scene-catalog.json"),
      this.loadJson(catalogs.worlds||"./src/config/world-catalog.json")
    ]);
    this.sceneCatalog=sceneCatalog;
    this.worldCatalog=worldCatalog;

    this.sceneRuntime=new SceneRuntime(
      this.sceneHost,
      this.manifest.reference||{width:390,height:844},
      {editorEnabled:false}
    );
    this.installNavigationActions();

    if(this.restoreSession)this.restorePersistedState();

    const save=()=>this.saveState();
    const visibility=()=>{if(document.visibilityState==="hidden")save()};
    globalThis.addEventListener?.("pagehide",save);
    document.addEventListener?.("visibilitychange",visibility);
    this.cleanups.push(()=>{
      globalThis.removeEventListener?.("pagehide",save);
      document.removeEventListener?.("visibilitychange",visibility);
    });

    return this;
  }

  async loadJson(url){
    const response=await fetch(url,{cache:"no-store"});
    if(!response.ok)throw new Error("Game resource load failed: "+url+" ("+response.status+")");
    return response.json();
  }

  installNavigationActions(){
    this.sceneRuntime.registerAction("game.back",()=>this.back(),{label:"Voltar"});
    this.sceneRuntime.registerAction("game.openScene",({node})=>{
      const target=node.targetScene||node.scene||node.target;
      if(!target)throw new Error("game.openScene requires targetScene, scene or target");
      return this.openScene(target);
    },{label:"Abrir cena"});
    this.sceneRuntime.registerAction("game.openWorld",({node})=>{
      const target=node.targetWorld||node.world||node.target;
      if(!target)throw new Error("game.openWorld requires targetWorld, world or target");
      return this.openWorld(target);
    },{label:"Abrir mundo"});
    this.sceneRuntime.registerAction("game.goto",({node})=>{
      const target=node.target||node.targetScene||node.targetWorld||node.scene||node.world;
      const kind=String(node.targetKind||"").toLowerCase();
      if(kind==="world")return this.openWorld(target);
      if(kind==="scene")return this.openScene(target);
      if(typeof target==="string"&&target.startsWith("world:"))return this.openWorld(target.slice(6));
      if(typeof target==="string"&&target.startsWith("scene:"))return this.openScene(target.slice(6));
      throw new Error("game.goto requires targetKind or a scene:/world: target");
    },{label:"Navegar"});
  }

  registerAction(id,handler,options={}){
    this.sceneRuntime.registerAction(id,handler,options);
    return this;
  }

  sceneEntry(ref){
    if(ref&&typeof ref==="object"){
      if(ref.path)return {...ref};
      if(ref.id)ref=ref.id;
    }
    const scenes=Array.isArray(this.sceneCatalog?.scenes)?this.sceneCatalog.scenes:[];
    if(typeof ref==="string"){
      const found=scenes.find(entry=>entry.id===ref||entry.path===ref);
      if(found)return {...found};
      if(isPath(ref))return {id:null,path:ref};
    }
    throw new Error("Unknown scene: "+String(ref));
  }

  worldEntry(ref){
    if(ref&&typeof ref==="object"){
      if(ref.path)return {...ref};
      if(ref.id)ref=ref.id;
    }
    const worlds=Array.isArray(this.worldCatalog?.worlds)?this.worldCatalog.worlds:[];
    if(typeof ref==="string"){
      const found=worlds.find(entry=>entry.id===ref||entry.path===ref);
      if(found)return {...found};
      if(isPath(ref))return {id:null,path:ref};
    }
    throw new Error("Unknown world: "+String(ref));
  }

  routeSnapshot(){
    return this.current?clone(this.current):null;
  }

  captureCurrentState(){
    if(this.current?.kind==="world"&&this.worldRuntime){
      const id=this.current.id||this.worldRuntime.config?.id;
      if(id)this.worldStates[id]=this.worldRuntime.getState();
    }
  }

  pushCurrentToHistory(){
    const route=this.routeSnapshot();
    if(route)this.history.push(route);
  }

  async openScene(ref,{pushHistory=true}={}){
    const entry=this.sceneEntry(ref);
    this.captureCurrentState();
    if(pushHistory)this.pushCurrentToHistory();

    if(this.worldRuntime){
      this.worldRuntime.destroy();
      this.worldRuntime=null;
    }
    this.worldHost.hidden=true;
    this.sceneHost.hidden=false;

    const scene=await this.sceneRuntime.load(entry.path);
    this.sceneRuntime.setMode("play");
    this.current={kind:"scene",id:scene.id||entry.id||null,path:entry.path};
    this.saveState();
    this.emitChange();
    return scene;
  }

  async openWorld(ref,{pushHistory=true,state=null}={}){
    const entry=this.worldEntry(ref);
    this.captureCurrentState();
    if(pushHistory)this.pushCurrentToHistory();

    if(this.worldRuntime){
      this.worldRuntime.destroy();
      this.worldRuntime=null;
    }

    const world=await this.loadJson(entry.path);
    const worldId=world.id||entry.id;
    const restored=state||this.worldStates[worldId]||null;

    this.sceneHost.hidden=true;
    this.worldHost.hidden=false;
    this.worldRuntime=new WorldRuntime(this.worldHost,world,{
      editorEnabled:false,
      state:restored||{},
      onEnterScene:(entity,worldState)=>{
        if(worldId)this.worldStates[worldId]=clone(worldState||this.worldRuntime?.getState?.()||{});
        return this.openScene(entity.scene,{pushHistory:true});
      }
    });
    this.worldRuntime.mount();
    this.worldRuntime.setMode("play");

    this.current={kind:"world",id:worldId||null,path:entry.path};
    this.saveState();
    this.emitChange();
    return this.worldRuntime.getWorld();
  }

  async back(){
    this.captureCurrentState();
    const previous=this.history.pop();
    if(!previous)return false;
    if(previous.kind==="world")await this.openWorld(previous,{pushHistory:false});
    else await this.openScene(previous,{pushHistory:false});
    this.saveState();
    return true;
  }

  async start(override=null){
    const requested=override||(this.restoreSession&&this.current?this.current:this.manifest.start)||{kind:"scene",id:"login"};
    const kind=String(requested.kind||requested.type||"scene").toLowerCase();
    if(kind==="world")return this.openWorld(requested,{pushHistory:false});
    return this.openScene(requested,{pushHistory:false});
  }

  getState(){
    this.captureCurrentState();
    return {
      schema:"tq.game-state",
      version:1,
      current:this.routeSnapshot(),
      history:clone(this.history),
      worldStates:clone(this.worldStates),
      flags:clone(this.flags),
      inventory:clone(this.inventory)
    };
  }

  restorePersistedState(){
    try{
      const raw=sessionStorage.getItem(this.persistenceKey);
      if(!raw)return false;
      const state=JSON.parse(raw);
      if(state?.schema!=="tq.game-state")return false;
      this.current=state.current?clone(state.current):null;
      this.history=Array.isArray(state.history)?clone(state.history):[];
      this.worldStates=state.worldStates&&typeof state.worldStates==="object"?clone(state.worldStates):{};
      this.flags=state.flags&&typeof state.flags==="object"?clone(state.flags):{};
      this.inventory=Array.isArray(state.inventory)?clone(state.inventory):[];
      return true;
    }catch{
      return false;
    }
  }

  saveState(){
    try{
      const state={
        schema:"tq.game-state",
        version:1,
        current:this.routeSnapshot(),
        history:clone(this.history),
        worldStates:clone(this.worldStates),
        flags:clone(this.flags),
        inventory:clone(this.inventory)
      };
      sessionStorage.setItem(this.persistenceKey,JSON.stringify(state));
      return true;
    }catch(error){
      console.warn("GameRuntime state save failed",error);
      return false;
    }
  }

  clearSavedState(){
    try{sessionStorage.removeItem(this.persistenceKey)}catch{}
  }

  emitChange(){
    globalThis.dispatchEvent?.(new CustomEvent("tq:gameroutechange",{
      detail:{current:this.routeSnapshot(),history:clone(this.history)}
    }));
  }

  destroy(){
    this.captureCurrentState();
    this.saveState();
    this.worldRuntime?.destroy?.();
    this.worldRuntime=null;
    this.sceneRuntime?.resizeObserver?.disconnect?.();
    for(const cleanup of this.cleanups.splice(0))cleanup();
    this.root?.classList.remove("tq-game-runtime");
    if(this.root)this.root.innerHTML="";
  }
}
