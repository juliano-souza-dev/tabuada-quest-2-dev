import { SceneRuntime } from "./SceneRuntime.js?v=20260930-2350";
import { WorldRuntime } from "../world/WorldRuntime.js?v=20261001-0947";
import { PedagogyRuntime } from "./pedagogy/PedagogyRuntime.js?v=20261001-0854";

const clone=value=>structuredClone(value);
const isPath=value=>typeof value==="string"&&(value.startsWith("./")||value.startsWith("/")||value.endsWith(".json"));
const unique=list=>[...new Set((Array.isArray(list)?list:[]).map(String).filter(Boolean))];

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
    this.shipCatalog=null;
    this.pedagogyCurriculum=null;
    this.sceneRuntime=null;
    this.worldRuntime=null;
    this.sceneHost=null;
    this.worldHost=null;
    this.current=null;
    this.history=[];
    this.worldStates={};
    this.flags={};
    this.inventory=[];
    this.playerShips={ownedShips:[],equippedShip:null};
    this.playerStateStore=null;
    this.accountState={};
    this.pedagogyRuntime=new PedagogyRuntime({getState:()=>this.accountState});
    this.authenticated=false;
    this.pendingAuthRoute=null;
    this.started=false;
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
    const [sceneCatalog,worldCatalog,shipCatalog,pedagogyCurriculum]=await Promise.all([
      this.loadJson(catalogs.scenes||"./src/config/scene-catalog.json"),
      this.loadJson(catalogs.worlds||"./src/config/world-catalog.json"),
      this.loadJson(catalogs.ships||"./src/config/ship-catalog.json"),
      this.loadJson(catalogs.pedagogy||"./src/config/pedagogy-curriculum.json")
    ]);
    this.sceneCatalog=sceneCatalog;
    this.worldCatalog=worldCatalog;
    this.shipCatalog=shipCatalog;
    this.pedagogyCurriculum=pedagogyCurriculum;
    this.pedagogyRuntime.setCurriculum(pedagogyCurriculum);
    this.ensurePlayerShips();

    this.sceneRuntime=new SceneRuntime(
      this.sceneHost,
      this.manifest.reference||{width:390,height:844},
      {editorEnabled:false}
    );
    this.installNavigationActions();

    if(this.restoreSession)this.restorePersistedState();

    const save=()=>this.saveState();
    const visibility=()=>{if(document.visibilityState==="hidden")save()};
    const authReady=event=>{
      const state=event?.detail?.state;
      this.authenticated=event?.detail?.status?.authenticated===true;
      const wasLogin=this.current?.kind==="scene"&&this.current.id==="login";
      let accountRoute=null;

      if(state){
        const game=state.game&&typeof state.game==="object"?state.game:{};
        const runtime=game.runtime&&typeof game.runtime==="object"
          ?game.runtime
          :(state.schema==="tq.game-state"?state:null);
        accountRoute=runtime?.current?clone(runtime.current):null;
        if(accountRoute?.kind==="scene"&&accountRoute.id==="login")accountRoute=null;
        this.importAccountState(state);
      }

      const authRoute=accountRoute||clone(this.manifest.afterAuth||{kind:"world",id:"ocean-prototype"});

      if(!this.started){
        if(this.authenticated)this.pendingAuthRoute=authRoute;
        return;
      }

      const route=accountRoute||(wasLogin&&this.authenticated?authRoute:this.routeSnapshot());
      if(!route)return;
      queueMicrotask(()=>{
        const task=route.kind==="world"
          ?this.openWorld(route,{pushHistory:false})
          :this.openScene(route,{pushHistory:false});
        Promise.resolve(task).catch(error=>console.warn("Account state route restore failed",error));
      });
    };

    const signedOut=()=>{
      this.authenticated=false;
      this.pendingAuthRoute=null;
      const login={kind:"scene",id:String(this.manifest.auth?.loginSceneId||"login")};
      if(this.started){
        queueMicrotask(()=>this.openScene(login,{pushHistory:false}).catch(error=>console.warn("Login restore failed",error)));
      }
    };

    globalThis.addEventListener?.("pagehide",save);
    globalThis.addEventListener?.("tq:auth-entry-ready",authReady);
    globalThis.addEventListener?.("tq:auth-signed-out",signedOut);
    document.addEventListener?.("visibilitychange",visibility);
    this.cleanups.push(()=>{
      globalThis.removeEventListener?.("pagehide",save);
      globalThis.removeEventListener?.("tq:auth-entry-ready",authReady);
      globalThis.removeEventListener?.("tq:auth-signed-out",signedOut);
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
    this.sceneRuntime.registerAction("game.equipShip",({node})=>{
      const shipId=node.shipId||node.targetShip||node.target;
      if(!shipId)throw new Error("game.equipShip requires shipId, targetShip or target");
      return this.equipShip(shipId);
    },{label:"Equipar navio"});
    this.sceneRuntime.registerAction("game.grantShip",({node})=>{
      const shipId=node.shipId||node.targetShip||node.target;
      if(!shipId)throw new Error("game.grantShip requires shipId, targetShip or target");
      return this.grantShip(shipId,{equip:node.equip===true});
    },{label:"Desbloquear navio"});
  }

  registerAction(id,handler,options={}){
    this.sceneRuntime.registerAction(id,handler,options);
    return this;
  }

  attachPlayerStateStore(store){
    this.playerStateStore=store||null;
    const status=this.playerStateStore?.status?.();
    this.authenticated=status?.authenticated===true;
    const state=this.playerStateStore?.load?.();
    if(state)this.importAccountState(state);
    return this;
  }

  importAccountState(state){
    if(!state||typeof state!=="object")return false;
    this.accountState=clone(state);

    const game=state.game&&typeof state.game==="object"?state.game:{};
    const runtime=game.runtime&&typeof game.runtime==="object"
      ?game.runtime
      :(state.schema==="tq.game-state"?state:null);

    if(runtime){
      this.current=runtime.current?clone(runtime.current):this.current;
      this.history=Array.isArray(runtime.history)?clone(runtime.history):this.history;
      this.worldStates=runtime.worldStates&&typeof runtime.worldStates==="object"?clone(runtime.worldStates):this.worldStates;
      this.flags=runtime.flags&&typeof runtime.flags==="object"?clone(runtime.flags):this.flags;
      this.inventory=Array.isArray(runtime.inventory)?clone(runtime.inventory):this.inventory;
    }

    const ships=(
      game.ships&&typeof game.ships==="object"?game.ships:
      state.ships&&typeof state.ships==="object"?state.ships:
      {}
    );
    this.playerShips={
      ownedShips:unique(ships.ownedShips),
      equippedShip:ships.equippedShip?String(ships.equippedShip):null
    };
    this.ensurePlayerShips();
    this.writeSessionState();
    return true;
  }

  exportAccountState(){
    const base=this.accountState&&typeof this.accountState==="object"?clone(this.accountState):{};
    return {
      ...base,
      game:{
        ...(base.game&&typeof base.game==="object"?base.game:{}),
        runtime:this.runtimeSnapshot(),
        ships:{
          ownedShips:[...this.playerShips.ownedShips],
          equippedShip:this.playerShips.equippedShip
        }
      }
    };
  }

  shipEntry(id){
    return (Array.isArray(this.shipCatalog?.ships)?this.shipCatalog.ships:[]).find(ship=>ship.id===id)||null;
  }

  listAvailableShips(){
    return (Array.isArray(this.shipCatalog?.ships)?this.shipCatalog.ships:[])
      .filter(ship=>ship.available!==false)
      .map(ship=>clone(ship));
  }

  listOwnedShips(){
    const owned=new Set(this.playerShips.ownedShips);
    return this.listAvailableShips().filter(ship=>owned.has(ship.id));
  }

  ensurePlayerShips(){
    const available=this.listAvailableShips();
    const validIds=new Set(available.map(ship=>ship.id));
    let owned=unique(this.playerShips?.ownedShips).filter(id=>validIds.has(id));
    const defaultId=String(
      this.manifest.player?.defaultShipId
      ||this.shipCatalog?.defaultShipId
      ||available[0]?.id
      ||""
    );

    if(!owned.length&&defaultId&&validIds.has(defaultId)&&this.manifest.player?.grantDefaultShip!==false){
      owned=[defaultId];
    }

    let equipped=this.playerShips?.equippedShip?String(this.playerShips.equippedShip):null;
    if(!equipped||!owned.includes(equipped)||!validIds.has(equipped)){
      equipped=owned[0]||defaultId||null;
    }

    this.playerShips={ownedShips:owned,equippedShip:equipped};
    return this.playerShips;
  }

  getEquippedShip(){
    this.ensurePlayerShips();
    return this.playerShips.equippedShip?clone(this.shipEntry(this.playerShips.equippedShip)):null;
  }

  async grantShip(id,{equip=false,save=true}={}){
    const ship=this.shipEntry(String(id||""));
    if(!ship||ship.available===false)return false;
    if(!this.playerShips.ownedShips.includes(ship.id))this.playerShips.ownedShips.push(ship.id);
    if(equip||!this.playerShips.equippedShip)this.playerShips.equippedShip=ship.id;
    this.ensurePlayerShips();
    if(save)this.saveState();
    globalThis.dispatchEvent?.(new CustomEvent("tq:shipgranted",{detail:{ship:clone(ship),equipped:this.playerShips.equippedShip}}));
    return true;
  }

  async equipShip(id,{save=true,reloadWorld=true}={}){
    const shipId=String(id||"");
    const ship=this.shipEntry(shipId);
    if(!ship||ship.available===false||!this.playerShips.ownedShips.includes(shipId))return false;
    if(this.playerShips.equippedShip===shipId)return true;

    this.playerShips.equippedShip=shipId;
    if(save)this.saveState();
    globalThis.dispatchEvent?.(new CustomEvent("tq:shipequipped",{detail:{ship:clone(ship)}}));

    if(reloadWorld&&this.current?.kind==="world"){
      this.captureCurrentState();
      const route=this.routeSnapshot();
      await this.openWorld(route,{pushHistory:false});
    }
    return true;
  }

  resolveWorldPlayer(world){
    const legacy=world?.player&&typeof world.player==="object"?clone(world.player):{};
    const spawn=world?.playerSpawn&&typeof world.playerSpawn==="object"?clone(world.playerSpawn):{};
    const ship=this.getEquippedShip();
    const shipPlayer=ship?.player&&typeof ship.player==="object"?clone(ship.player):{};

    const navigation={
      x:Number(spawn.x??legacy.x??world.width/2),
      y:Number(spawn.y??legacy.y??world.height/2),
      direction:String(spawn.direction??legacy.direction??"n")
    };

    return {
      ...legacy,
      ...shipPlayer,
      ...navigation,
      effects:{
        ...(legacy.effects&&typeof legacy.effects==="object"?legacy.effects:{}),
        ...(shipPlayer.effects&&typeof shipPlayer.effects==="object"?shipPlayer.effects:{})
      },
      shipId:ship?.id||legacy.shipId||null
    };
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

  recordPedagogyResult(result={}){
    const base=this.accountState&&typeof this.accountState==="object"?clone(this.accountState):{};
    const game=base.game&&typeof base.game==="object"?base.game:{};
    const pedagogy=game.pedagogy&&typeof game.pedagogy==="object"?game.pedagogy:{};
    const activity=Array.isArray(pedagogy.activity)?pedagogy.activity.slice(-199):[];
    activity.push({
      at:Date.now(),
      worldId:String(result.worldId||""),
      entityId:String(result.entityId||""),
      challengeId:String(result.challengeId||""),
      operation:String(result.operation||"multiplication"),
      a:Number(result.a),
      b:Number(result.b),
      answer:result.answer===null||result.answer===undefined||result.answer===""?null:(Number.isFinite(Number(result.answer))?Number(result.answer):null),
      correct:result.correct===true,
      region:Number(result.region)||null,
      bonus:result.bonus===true,
      countsTowardPlanned:result.countsTowardPlanned!==false
    });
    this.accountState={
      ...base,
      game:{
        ...game,
        pedagogy:{
          ...pedagogy,
          activity
        }
      }
    };
    this.saveState();
    globalThis.dispatchEvent?.(new CustomEvent("tq:pedagogyresult",{detail:clone(activity.at(-1))}));
  }

  handleTreasureCollected({entity,challenge}={}){
    const cleanEntity=entity&&typeof entity==="object"?clone(entity):{};
    const base=this.accountState&&typeof this.accountState==="object"?clone(this.accountState):{};
    const game=base.game&&typeof base.game==="object"?base.game:{};
    const pedagogy=game.pedagogy&&typeof game.pedagogy==="object"?game.pedagogy:{};
    const bonus=pedagogy.bonus&&typeof pedagogy.bonus==="object"?pedagogy.bonus:{};
    const openedChestIds=Array.isArray(bonus.openedChestIds)?[...bonus.openedChestIds]:[];
    const worldId=String(challenge?.context?.worldId||this.current?.id||"");
    const chestKey=worldId+":"+String(cleanEntity.id||"");
    const region=Number(challenge?.region)||Number(pedagogy.progress?.region)||1;
    const chestsOpenedByRegion={
      ...(bonus.chestsOpenedByRegion&&typeof bonus.chestsOpenedByRegion==="object"?bonus.chestsOpenedByRegion:{})
    };

    if(cleanEntity.id&&!openedChestIds.includes(chestKey)){
      openedChestIds.push(chestKey);
      chestsOpenedByRegion[String(region)]=Number(chestsOpenedByRegion[String(region)]||0)+1;
    }

    this.accountState={
      ...base,
      game:{
        ...game,
        pedagogy:{
          ...pedagogy,
          bonus:{
            ...bonus,
            openedChestIds,
            chestsOpenedByRegion,
            totalChestChallenges:Object.values(chestsOpenedByRegion).reduce((sum,value)=>sum+Number(value||0),0)
          }
        }
      }
    };

    globalThis.dispatchEvent?.(new CustomEvent("tq:treasurecollected",{
      detail:{
        entity:cleanEntity,
        region,
        challenge:challenge?{
          id:challenge.id,
          operation:challenge.operation,
          a:challenge.a,
          b:challenge.b,
          bonus:challenge.bonus===true,
          countsTowardPlanned:challenge.countsTowardPlanned!==false
        }:null
      }
    }));
    this.saveState();
  }

  async openWorld(ref,{pushHistory=true,state=null}={}){
    const entry=this.worldEntry(ref);
    this.captureCurrentState();
    if(pushHistory)this.pushCurrentToHistory();

    if(this.worldRuntime){
      this.worldRuntime.destroy();
      this.worldRuntime=null;
    }

    const sourceWorld=await this.loadJson(entry.path);
    const world=clone(sourceWorld);
    world.player=this.resolveWorldPlayer(world);
    const worldId=world.id||entry.id;
    const restored=state||this.worldStates[worldId]||null;

    this.sceneHost.hidden=true;
    this.worldHost.hidden=false;
    this.worldRuntime=new WorldRuntime(this.worldHost,world,{
      editorEnabled:false,
      state:restored||{},
      createPedagogyChallenge:({entity})=>this.pedagogyRuntime.createChallenge({
        kind:entity?.type==="treasure"?"treasure":(entity?.type==="ship"&&entity?.combat?.enabled===true?"combat":"world-interaction"),
        worldId,
        entityId:entity?.id,
        entityType:entity?.type
      }),
      onPedagogyResult:result=>this.recordPedagogyResult({
        ...result,
        worldId
      }),
      onTreasureCollected:payload=>this.handleTreasureCollected(payload),
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
    const authRequired=this.manifest.auth?.required===true;
    const login={kind:"scene",id:String(this.manifest.auth?.loginSceneId||"login")};

    let requested=null;
    if(override){
      requested=override;
    }else if(authRequired&&!this.authenticated){
      requested=login;
    }else{
      requested=this.pendingAuthRoute
        ||(this.restoreSession&&this.current?this.current:null)
        ||(this.authenticated?this.manifest.afterAuth:null)
        ||this.manifest.start
        ||login;
    }

    this.pendingAuthRoute=null;
    const kind=String(requested.kind||requested.type||"scene").toLowerCase();
    this.started=true;
    if(kind==="world")return this.openWorld(requested,{pushHistory:false});
    return this.openScene(requested,{pushHistory:false});
  }

  runtimeSnapshot(){
    return {
      schema:"tq.game-state",
      version:2,
      current:this.routeSnapshot(),
      history:clone(this.history),
      worldStates:clone(this.worldStates),
      flags:clone(this.flags),
      inventory:clone(this.inventory)
    };
  }

  getState(){
    this.captureCurrentState();
    return {
      ...this.runtimeSnapshot(),
      ships:{
        availableShips:this.listAvailableShips().map(ship=>ship.id),
        ownedShips:[...this.playerShips.ownedShips],
        equippedShip:this.playerShips.equippedShip
      }
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
      if(state.ships&&typeof state.ships==="object"){
        this.playerShips={
          ownedShips:unique(state.ships.ownedShips),
          equippedShip:state.ships.equippedShip?String(state.ships.equippedShip):null
        };
      }
      this.ensurePlayerShips();
      return true;
    }catch{
      return false;
    }
  }

  writeSessionState(){
    try{
      const state={
        ...this.runtimeSnapshot(),
        ships:{
          ownedShips:[...this.playerShips.ownedShips],
          equippedShip:this.playerShips.equippedShip
        }
      };
      sessionStorage.setItem(this.persistenceKey,JSON.stringify(state));
      return true;
    }catch{
      return false;
    }
  }

  saveState(){
    try{
      this.captureCurrentState();
      this.writeSessionState();
      if(this.playerStateStore){
        const account=this.exportAccountState();
        this.accountState=clone(account);
        this.playerStateStore.save(account,{sync:true});
      }
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
      detail:{
        current:this.routeSnapshot(),
        history:clone(this.history),
        equippedShip:this.playerShips.equippedShip
      }
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
