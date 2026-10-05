import { SceneRuntime } from "./SceneRuntime.js?v=20260930-2350";
import { WorldRuntime } from "../world/WorldRuntime.js?v=20261005-hud-assets-v3";
import { PedagogyRuntime } from "./pedagogy/PedagogyRuntime.js?v=20261003-2113-repair-region";
import { ActionRuntime } from "./actions/ActionRuntime.js?v=20261001-1848";

const clone=value=>structuredClone(value);
const isPath=value=>typeof value==="string"&&(value.startsWith("./")||value.startsWith("/")||value.endsWith(".json"));
const unique=list=>[...new Set((Array.isArray(list)?list:[]).map(String).filter(Boolean))];
const LEGACY_DEFAULT_SHIP_ID="pirate-default";
const CURRENT_DEFAULT_SHIP_ID="ship-pirate-galleon-navio";
const migrateLegacyShipId=id=>String(id||"")===LEGACY_DEFAULT_SHIP_ID?CURRENT_DEFAULT_SHIP_ID:String(id||"");
const normalizeGlobalAmmo=input=>{
  const value=input&&typeof input==="object"?input:{};
  const source=value.stock&&typeof value.stock==="object"?value.stock:{};
  const stock={};
  for(const [rawId,rawQty] of Object.entries(source)){
    const id=String(rawId||"").trim();
    const qty=Math.max(0,Math.floor(Number(rawQty)||0));
    if(id&&qty>0)stock[id]=qty;
  }
  return {selectedAmmoId:String(value.selectedAmmoId||""),stock};
};
const normalizeGraphicsSettings=input=>{
  const value=input&&typeof input==="object"?input:{};
  return {
    clouds:value.clouds!==false,
    oceanWaves:value.oceanWaves!==false,
    reducedAmmoFx:value.reducedAmmoFx===true
  };
};

export class GameRuntime {
  static async load(root,manifestUrl="./src/config/game.manifest.json",options={}){
    let manifest=options.contentStore?.json?.(manifestUrl)||null;
    if(!manifest){
      const response=await fetch(manifestUrl,{cache:"no-store"});
      if(!response.ok)throw new Error("Game manifest load failed: "+response.status);
      manifest=await response.json();
    }
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
    this.worldOverrides=new Map();
    this.shipCatalog=null;
    this.npcCatalog=null;
    this.treasureCatalog=null;
    this.ammoCatalog=null;
    this.cannonCatalog=null;
    this.missionCatalog=null;
    this.pedagogyCurriculum=null;
    this.actionCatalog=null;
    this.soundCatalog=null;
    this.actionRuntime=null;
    this.sceneRuntime=null;
    this.worldRuntime=null;
    this.sceneHost=null;
    this.worldHost=null;
    this.current=null;
    this.history=[];
    this.worldStates={};
    this.flags={};
    this.graphicsSettings=normalizeGraphicsSettings({});
    this.inventory=[];
    this.consumables={};
    this.rewards={coins:0,gold:0,rubies:0,xp:0,claims:[],claimDetails:{}};
    this.rewardClaimsInFlight=new Set();
    this.playerShips={ownedShips:[],equippedShip:null};
    this.playerCannons={owned:{},equippedByShip:{}};
    this.playerAmmo={selectedAmmoId:"",stock:{}};
    this.playerStateStore=null;
    this.contentStore=options.contentStore||null;
    this.contentSource=this.contentStore?.status?.().ready?"canonical":"bootstrap";
    this.multiplayer=null;
    this.multiplayerCleanups=[];
    this.coopParty={partyId:"",members:[]};
    this.ammoSyncTimer=0;
    this.accountState={};
    this.pedagogyRuntime=new PedagogyRuntime({getState:()=>this.accountState});
    this.authenticated=false;
    this.pendingAuthRoute=null;
    this.started=false;
    this.persistenceKey=String(this.manifest.persistence?.sessionKey||"tq.game.runtime:v1");
    this.restoreSession=this.manifest.persistence?.restoreSession!==false;
    this.localRestored=false;
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
    const [sceneCatalog,worldCatalog,shipCatalog,npcCatalog,treasureCatalog,ammoCatalog,cannonCatalog,missionCatalog,pedagogyCurriculum,actionCatalog,soundCatalog]=await Promise.all([
      this.loadJson(catalogs.scenes||"./src/config/scene-catalog.json"),
      this.loadJson(catalogs.worlds||"./src/config/world-catalog.json"),
      this.loadJson(catalogs.ships||"./src/config/ship-catalog.json"),
      this.loadJson(catalogs.npcs||"./src/config/npc-catalog.json"),
      this.loadJson(catalogs.treasures||"./src/config/treasure-catalog.json"),
      this.loadJson(catalogs.ammo||"./src/config/ammo-catalog.json"),
      this.loadJson(catalogs.cannons||"./src/config/cannon-catalog.json"),
      this.loadJson(catalogs.missions||"./src/config/mission-catalog.json"),
      this.loadJson(catalogs.pedagogy||"./src/config/pedagogy-curriculum.json"),
      this.loadJson(catalogs.actions||"./src/config/action-catalog.json"),
      this.loadJson(catalogs.sounds||"./src/config/sound-catalog.json")
    ]);
    this.sceneCatalog=sceneCatalog;
    this.worldCatalog=worldCatalog;
    this.shipCatalog=shipCatalog;
    this.npcCatalog=npcCatalog;
    this.treasureCatalog=treasureCatalog;
    this.ammoCatalog=ammoCatalog;
    this.cannonCatalog=cannonCatalog;
    this.missionCatalog=missionCatalog;
    this.pedagogyCurriculum=pedagogyCurriculum;
    this.actionCatalog=actionCatalog;
    this.soundCatalog=soundCatalog;
    this.pedagogyRuntime.setCurriculum(pedagogyCurriculum);
    this.ensurePlayerShips();
    this.ensurePlayerCannons();

    this.sceneRuntime=new SceneRuntime(
      this.sceneHost,
      this.manifest.reference||{width:390,height:844},
      {editorEnabled:false}
    );
    this.actionRuntime=new ActionRuntime({catalog:this.actionCatalog});
    this.installNavigationActions();
    this.installGameActions();

    if(this.restoreSession)this.localRestored=this.restorePersistedState();

    const save=()=>this.saveState();
    const visibility=()=>{if(document.visibilityState==="hidden")save()};
    const onlineRewardSync=()=>{
      this.syncRewardClaimMarkers().catch(error=>console.warn("Reward claim marker sync failed",error));
    };
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

      const multiplayerTestActive=this.manifest?.multiplayerTest?.enabled===true;
      const authRoute=multiplayerTestActive
        ?clone(this.manifest.afterAuth||{kind:"world",id:"r1-enseada-aprendizes"})
        :(accountRoute||clone(this.manifest.afterAuth||{kind:"world",id:"r1-enseada-aprendizes"}));

      if(!this.started){
        if(this.authenticated)this.pendingAuthRoute=authRoute;
        return;
      }

      const route=multiplayerTestActive&&wasLogin&&this.authenticated
        ?authRoute
        :(accountRoute||(wasLogin&&this.authenticated?authRoute:this.routeSnapshot()));
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

    const localAutosave=setInterval(()=>{
      if(this.current?.kind==="world")this.saveState();
    },3000);

    globalThis.addEventListener?.("pagehide",save);
    globalThis.addEventListener?.("online",onlineRewardSync);
    globalThis.addEventListener?.("tq:auth-entry-ready",authReady);
    globalThis.addEventListener?.("tq:auth-signed-out",signedOut);
    document.addEventListener?.("visibilitychange",visibility);
    this.cleanups.push(()=>{
      globalThis.removeEventListener?.("pagehide",save);
      globalThis.removeEventListener?.("online",onlineRewardSync);
      globalThis.removeEventListener?.("tq:auth-entry-ready",authReady);
      globalThis.removeEventListener?.("tq:auth-signed-out",signedOut);
      document.removeEventListener?.("visibilitychange",visibility);
      clearInterval(localAutosave);
    });

    return this;
  }

  async loadJson(url){
    const test=this.manifest?.multiplayerTest||{};
    const forceLocal=test.enabled===true&&test.useLocalWorldContent===true&&(
      String(url||"").includes("/r1-enseada-aprendizes.world.json")
      ||String(url||"").includes("/npc-catalog.json")
      ||String(url||"").includes("/world-catalog.json")
    );
    const canonical=forceLocal?null:this.contentStore?.json?.(url);
    if(canonical&&typeof canonical==="object"){
      this.contentSource="canonical";
      return clone(canonical);
    }

    const response=await fetch(url,{cache:"no-store"});
    if(!response.ok)throw new Error("Game resource load failed: "+url+" ("+response.status+")");
    return response.json();
  }

  setContentStore(store){
    this.contentStore=store||null;
    this.contentSource=this.contentStore?.status?.().ready?"canonical":"bootstrap";
    return this;
  }

  async reloadCanonicalContent(store=this.contentStore){
    if(store)this.setContentStore(store);
    if(!this.contentStore?.status?.().ready)return false;

    const catalogs=this.manifest.catalogs||{};
    const load=path=>{
      const value=this.contentStore?.json?.(path);
      return value&&typeof value==="object"?clone(value):null;
    };

    const preserveTestManifest=this.manifest?.multiplayerTest?.enabled===true;
    const manifest=preserveTestManifest?null:load(this.manifestUrl||"./src/config/game.manifest.json");
    if(manifest){
      this.manifest=manifest;
      this.restoreSession=this.manifest.persistence?.restoreSession!==false;
    }

    const keepLocalTestWorld=this.manifest?.multiplayerTest?.enabled===true&&this.manifest?.multiplayerTest?.useLocalWorldContent===true;
    const next={
      sceneCatalog:load(catalogs.scenes||"./src/config/scene-catalog.json"),
      worldCatalog:keepLocalTestWorld?this.worldCatalog:load(catalogs.worlds||"./src/config/world-catalog.json"),
      shipCatalog:load(catalogs.ships||"./src/config/ship-catalog.json"),
      npcCatalog:keepLocalTestWorld?this.npcCatalog:load(catalogs.npcs||"./src/config/npc-catalog.json"),
      treasureCatalog:load(catalogs.treasures||"./src/config/treasure-catalog.json"),
      ammoCatalog:load(catalogs.ammo||"./src/config/ammo-catalog.json"),
      cannonCatalog:load(catalogs.cannons||"./src/config/cannon-catalog.json"),
      missionCatalog:load(catalogs.missions||"./src/config/mission-catalog.json"),
      pedagogyCurriculum:load(catalogs.pedagogy||"./src/config/pedagogy-curriculum.json"),
      actionCatalog:load(catalogs.actions||"./src/config/action-catalog.json"),
      soundCatalog:load(catalogs.sounds||"./src/config/sound-catalog.json")
    };

    for(const [key,value] of Object.entries(next)){
      if(value)this[key]=value;
    }
    if(next.pedagogyCurriculum)this.pedagogyRuntime.setCurriculum(next.pedagogyCurriculum);
    if(next.actionCatalog)this.actionRuntime?.setCatalog?.(next.actionCatalog);
    this.ensurePlayerShips();
    this.ensurePlayerCannons();
    this.ensurePlayerAmmo();
    this.ensureStarterLoadout();
    this.contentSource="canonical";
    globalThis.dispatchEvent?.(new CustomEvent("tq:canonical-content-ready",{detail:{
      releaseId:this.contentStore.status().releaseId,
      resources:this.contentStore.status().resources
    }}));
    return true;
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

  installGameActions(){
    this.actionRuntime
      .register("open-scene",({params})=>{
        const target=params.sceneId||params.target;
        if(!target)throw new Error("open-scene requires sceneId");
        return this.openScene(target);
      })
      .register("enter-region",({params})=>{
        const target=params.regionId||params.worldId||params.target;
        if(!target)throw new Error("enter-region requires regionId");
        return this.openWorld(target,{pushHistory:true,spawnId:params.spawnId||null});
      })
      .register("resume-game",()=>this.resumeGame())
      .register("go-back",()=>this.back())
      .register("complete-region",()=>this.completeCurrentRegion());

    for(const definition of this.actionRuntime.list()){
      this.sceneRuntime.registerAction(definition.id,({node})=>{
        const params={};
        for(const param of definition.params||[])params[param.key]=node?.[param.key]??"";
        return this.executeAction({actionId:definition.id,params},{nodeId:node?.id||"",sceneId:this.current?.kind==="scene"?this.current.id:""});
      },{label:definition.name||definition.id});
    }
  }

  executeAction(action,context={}){
    return this.actionRuntime.execute(action,context);
  }

  async resumeGame(){
    const route=this.routeSnapshot()||clone(this.current)||clone(this.manifest.afterAuth||this.manifest.start);
    if(route?.kind==="world")return this.openWorld(route,{pushHistory:false});
    if(route?.kind==="scene")return this.openScene(route,{pushHistory:false});
    const fallback=clone(this.manifest.afterAuth||{kind:"world",id:"r1-enseada-aprendizes"});
    return fallback.kind==="world"
      ?this.openWorld(fallback,{pushHistory:false})
      :this.openScene(fallback,{pushHistory:false});
  }

  requiredMissionStatus(regionNumber){
    const region=Math.max(0,Math.floor(Number(regionNumber)||0));
    if(!region)return {region,required:[],completed:[],pending:[],complete:true};
    const missions=(Array.isArray(this.missionCatalog?.missions)?this.missionCatalog.missions:[])
      .filter(mission=>Number(mission?.region)===region&&mission?.required===true);
    const missionState=this.accountState?.game?.missions&&typeof this.accountState.game.missions==="object"
      ?this.accountState.game.missions
      :{};
    const progress=missionState.progress&&typeof missionState.progress==="object"
      ?missionState.progress
      :{};
    const required=missions.map(mission=>{
      const id=String(mission?.id||"").trim();
      const target=Math.max(1,Math.floor(Number(mission?.objective?.target)||1));
      const current=Math.max(0,Math.floor(Number(progress[id])||0));
      return {
        id,
        name:String(mission?.name||id),
        target,
        current,
        complete:current>=target
      };
    });
    const completed=required.filter(item=>item.complete);
    const pending=required.filter(item=>!item.complete);
    return {region,required,completed,pending,complete:pending.length===0};
  }

  canShowRegionTransition(targetWorldId,fromWorldId=this.current?.kind==="world"?this.current.id:""){
    const target=String(targetWorldId||"").trim();
    const from=String(fromWorldId||"").trim();
    if(!target||!from)return true;

    const fromIndex=Math.max(0,Number(from.match(/^r(\d+)/i)?.[1])||0);
    const targetIndex=Math.max(0,Number(target.match(/^r(\d+)/i)?.[1])||0);
    if(!fromIndex||!targetIndex)return true;
    if(targetIndex<=fromIndex)return true;

    const status=this.requiredMissionStatus(fromIndex);
    if(!status.complete){
      globalThis.dispatchEvent?.(new CustomEvent("tq:regionlocked",{detail:{
        fromWorldId:from,
        targetWorldId:target,
        region:fromIndex,
        pending:clone(status.pending)
      }}));
      return false;
    }

    const completed=new Set(
      Array.isArray(this.flags?.completedRegions)
        ?this.flags.completedRegions.map(value=>String(value||""))
        :[]
    );
    if(!completed.has(from)){
      completed.add(from);
      this.flags={...(this.flags||{}),completedRegions:[...completed]};
      this.saveState();
      this.syncCloud("region-auto-complete");
      globalThis.dispatchEvent?.(new CustomEvent("tq:regioncomplete",{detail:{
        regionId:from,
        region:fromIndex,
        source:"missions"
      }}));
    }
    return true;
  }

  completeCurrentRegion(){
    const regionId=this.current?.kind==="world"?String(this.current.id||""):"";
    const region=Math.max(0,Number(regionId.match(/^r(\d+)/i)?.[1])||0);
    if(!regionId||!region)return false;
    const status=this.requiredMissionStatus(region);
    if(!status.complete){
      globalThis.dispatchEvent?.(new CustomEvent("tq:regionlocked",{detail:{
        fromWorldId:regionId,
        targetWorldId:"",
        region,
        pending:clone(status.pending)
      }}));
      return false;
    }
    this.flags={
      ...(this.flags||{}),
      completedRegions:[...new Set([...(Array.isArray(this.flags?.completedRegions)?this.flags.completedRegions:[]),regionId])]
    };
    this.saveState();
    this.syncCloud("region-complete");
    globalThis.dispatchEvent?.(new CustomEvent("tq:regioncomplete",{detail:{regionId,region,source:"missions"}}));
    return true;
  }

  syncCloud(reason="manual"){
    if(!this.playerStateStore)return false;
    try{
      this.captureCurrentState();
      const account=this.exportAccountState();
      this.accountState=clone(account);
      this.playerStateStore.save(account,{sync:true});
      globalThis.dispatchEvent?.(new CustomEvent("tq:cloudsync",{detail:{reason,at:Date.now()}}));
      return true;
    }catch(error){
      console.warn("Cloud sync failed",reason,error);
      return false;
    }
  }

  registerAction(id,handler,options={}){
    this.sceneRuntime.registerAction(id,handler,options);
    return this;
  }

  attachMultiplayer(service){
    this.multiplayer=service||null;
    return this;
  }

  stopMultiplayerWorld(){
    for(const cleanup of this.multiplayerCleanups.splice(0))cleanup();
    this.worldRuntime?.setServerWorldAuthority?.(false);
    this.coopParty={partyId:"",members:[]};
    this.multiplayer?.leaveWorld?.().catch?.(()=>{});
  }

  partySize(){
    return Math.max(1,Array.isArray(this.coopParty?.members)?this.coopParty.members.length:0);
  }

  grantPartyRewardShare(event={}){
    const claimKey=String(event.claimKey||"").trim();
    if(!claimKey)return false;
    const localClaim="party-share:"+claimKey;
    const claims=Array.isArray(this.rewards?.claims)?[...this.rewards.claims]:[];
    if(claims.includes(localClaim))return false;
    const gold=Math.max(0,Math.round((Number(event.gold)||0)*100)/100);
    const xp=Math.max(0,Math.round((Number(event.xp)||0)*100)/100);
    if(gold<=0&&xp<=0)return false;
    claims.push(localClaim);
    this.rewards={
      ...this.rewards,
      coins:Math.max(0,Number(this.rewards?.coins)||0)+gold,
      gold:Math.max(0,Number(this.rewards?.gold ?? this.rewards?.coins)||0)+gold,
      xp:Math.max(0,Number(this.rewards?.xp)||0)+xp,
      claims
    };
    this.saveState();
    this.syncCloud("party-reward");
    this.worldRuntime?.shopOverlay?.refreshBalances?.();
    this.worldRuntime?.showGameplayToast?.("🤝 Grupo · +"+gold+" ouro"+(xp>0?" · +"+xp+" XP":""),1500);
    return true;
  }

  recordPartyNpcDefeat({entity,partyMembers=[]}={}){
    const uid=String(this.multiplayer?.auth?.status?.().uid||"");
    if(!uid||!Array.isArray(partyMembers)||!partyMembers.map(String).includes(uid)||!entity?.npcId)return false;
    const base=this.accountState&&typeof this.accountState==="object"?clone(this.accountState):{};
    const game=base.game&&typeof base.game==="object"?base.game:{};
    const missionState=game.missions&&typeof game.missions==="object"?clone(game.missions):{};
    const progress=missionState.progress&&typeof missionState.progress==="object"?clone(missionState.progress):{};
    const claimed=new Set(Array.isArray(missionState.claimedRewards)?missionState.claimedRewards.map(String):[]);
    const currentRegion=Math.max(0,Number(String(this.current?.id||"").match(/^r(\d+)/i)?.[1])||0);
    let changed=false;
    for(const mission of Array.isArray(this.missionCatalog?.missions)?this.missionCatalog.missions:[]){
      const objective=mission?.objective&&typeof mission.objective==="object"?mission.objective:{};
      if(String(objective.type||"")!=="defeat_npc"||Number(mission.region)!==currentRegion)continue;
      const requiredNpcId=String(objective.npcId||objective.targetNpcId||"").trim();
      if(requiredNpcId&&requiredNpcId!==String(entity.npcId))continue;
      const id=String(mission.id||"").trim();if(!id)continue;
      const target=Math.max(1,Math.floor(Number(objective.target)||1));
      const previous=Math.max(0,Math.floor(Number(progress[id])||0));
      const next=Math.min(target,previous+1);
      if(next===previous)continue;
      progress[id]=next;changed=true;
      if(next>=target&&!claimed.has(id)){
        const reward=mission?.reward&&typeof mission.reward==="object"?mission.reward:{};
        const cannonId=String(reward.cannonId||"").trim();
        const quantity=Math.max(1,Math.floor(Number(reward.cannonQuantity)||1));
        if(cannonId&&this.grantCannon(cannonId,quantity,{save:false}))claimed.add(id);
      }
    }
    if(!changed)return false;
    this.accountState={
      ...base,
      game:{
        ...game,
        missions:{...missionState,progress,claimedRewards:[...claimed]}
      }
    };
    this.saveState();
    this.syncCloud("party-mission-progress");
    this.worldRuntime?.showGameplayToast?.("🤝 Derrota contou para as missões do grupo",1300);
    return true;
  }

  handlePartyEvent(data={}){
    const type=String(data.type||"");
    if(type==="party.invite"){
      const accepted=globalThis.confirm?.(String(data.fromName||"Pirata")+" quer formar um grupo cooperativo. Aceitar?");
      if(!accepted){
        this.multiplayer?.declinePartyInvite?.(data.inviteId);
        return false;
      }
      const answer=globalThis.prompt?.("Para entrar no grupo, responda: "+Number(data.a)+" × "+Number(data.b)+" = ?");
      if(answer===null){
        this.multiplayer?.declinePartyInvite?.(data.inviteId);
        return false;
      }
      this.multiplayer?.acceptPartyInvite?.(data.inviteId,Number(answer));
      return true;
    }
    if(type==="party.updated"){
      this.coopParty={
        partyId:String(data.partyId||""),
        members:Array.isArray(data.members)?clone(data.members).slice(0,6):[]
      };
      this.worldRuntime?.showGameplayToast?.(
        this.coopParty.members.length>1
          ?"🤝 Grupo cooperativo · "+this.coopParty.members.length+"/6 jogadores"
          :"Grupo cooperativo encerrado",
        1800
      );
      return true;
    }
    if(type==="party.challenge.failed"){
      this.worldRuntime?.showGameplayToast?.("Conta incorreta. Convite não aceito.",1800);
      return false;
    }
    if(type==="party.reward")return this.grantPartyRewardShare(data);
    if(type==="party.error"){
      const map={party_full:"Grupo já está cheio.",player_unavailable:"Jogador indisponível.",invite_expired:"Convite expirou."};
      this.worldRuntime?.showGameplayToast?.(map[data.reason]||"Não foi possível atualizar o grupo.",1800);
      return false;
    }
    return false;
  }

  startMultiplayerWorld(worldId){
    if(!this.multiplayer||!this.worldRuntime)return false;
    const multiplayerAuthenticated=this.multiplayer.auth?.status?.().authenticated===true;
    if(!this.authenticated&&multiplayerAuthenticated)this.authenticated=true;
    if(!multiplayerAuthenticated)return false;
    this.stopMultiplayerWorld();
    const onPlayers=event=>this.worldRuntime?.syncRemotePlayers?.(event.detail?.players||[],{serverTime:event.detail?.serverTime,full:event.detail?.full===true});
    const onAuthority=event=>this.worldRuntime?.syncLocalAuthority?.(event.detail||{});
    const onEntities=event=>this.worldRuntime?.syncServerEntities?.(event.detail?.entities||{});
    const onProjectiles=event=>this.worldRuntime?.syncServerProjectiles?.(event.detail?.projectiles||{},{
      serverTime:event.detail?.serverTime,
      full:event.detail?.full===true
    });
    const onEvent=event=>{
      const detail=event.detail||{};
      if((detail.type==="ammo.state"||detail.type==="fire.volley.accepted"||detail.type==="fire.rejected")&&detail.ammo){
        this.replacePlayerAmmo(detail.ammo,{save:true,syncServer:false,reason:"server-authority"});
        this.worldRuntime?.handleMultiplayerEvent?.({...detail,ammo:null});
        return;
      }
      this.worldRuntime?.handleMultiplayerEvent?.(detail);
    };
    const onParty=event=>this.handlePartyEvent(event.detail||{});
    const onBosses=event=>this.worldRuntime?.syncCoopBosses?.(event.detail?.bosses||{});
    const onTransport=event=>{
      const online=event.detail?.online===true&&event.detail?.authority==="server";
      this.worldRuntime?.setServerWorldAuthority?.(online);
      if(online&&this.worldRuntime){
        this.worldRuntime?.showGameplayToast?.("🌐 Servidor online · mundo multiplayer sincronizado",1800);
        this.multiplayer?.ensureWorld?.(this.worldRuntime.dynamicWorldSeed?.()||{});
        globalThis.dispatchEvent?.(new CustomEvent("tq:network-mode",{detail:{mode:"online",worldId}}));
        return;
      }
      if(event.detail?.reason==="server_disconnected"){
        this.worldRuntime?.showGameplayToast?.("⚠️ Servidor caiu · entrando no modo offline",4200);
        globalThis.dispatchEvent?.(new CustomEvent("tq:network-mode",{detail:{
          mode:"offline",
          reason:"server_disconnected",
          worldId
        }}));
      }
    };
    this.multiplayer.addEventListener?.("players",onPlayers);
    this.multiplayer.addEventListener?.("authority",onAuthority);
    this.multiplayer.addEventListener?.("entities",onEntities);
    this.multiplayer.addEventListener?.("projectiles",onProjectiles);
    this.multiplayer.addEventListener?.("event",onEvent);
    this.multiplayer.addEventListener?.("party",onParty);
    this.multiplayer.addEventListener?.("bosses",onBosses);
    this.multiplayer.addEventListener?.("transport",onTransport);
    this.multiplayerCleanups.push(
      ()=>this.multiplayer?.removeEventListener?.("players",onPlayers),
      ()=>this.multiplayer?.removeEventListener?.("authority",onAuthority),
      ()=>this.multiplayer?.removeEventListener?.("entities",onEntities),
      ()=>this.multiplayer?.removeEventListener?.("projectiles",onProjectiles),
      ()=>this.multiplayer?.removeEventListener?.("event",onEvent),
      ()=>this.multiplayer?.removeEventListener?.("party",onParty),
      ()=>this.multiplayer?.removeEventListener?.("bosses",onBosses),
      ()=>this.multiplayer?.removeEventListener?.("transport",onTransport)
    );
    const runtime=this.worldRuntime;
    const coopTransport={
      uid:String(this.multiplayer.auth?.status?.().uid||""),
      ensureBoss:boss=>this.multiplayer.ensureBoss?.(boss),
      damageBoss:(bossId,damage,meta)=>this.multiplayer.damageBoss?.(bossId,damage,meta),
      damageEntity:(entityId,damage,meta)=>this.multiplayer.damageEntity?.(entityId,damage,meta),
      fireProjectile:shot=>this.multiplayer.fireProjectile?.(shot)===true,
      fireVolley:volley=>this.multiplayer.fireVolley?.(volley)===true,
      setChallengeProtection:(active,until)=>this.multiplayer.setChallengeProtection?.(active,until)===true,
      inviteParty:targetUid=>this.multiplayer.inviteParty?.(targetUid)===true,
      leaveParty:()=>this.multiplayer.leaveParty?.()===true,
      sharePartyReward:payload=>this.multiplayer.sharePartyReward?.(payload)===true
    };
    const ship=this.getEquippedShip();
    this.multiplayer.joinWorld(worldId,{getLocalState:()=>runtime?.getState?.()||{},getCannonIds:()=>this.getShipCannons(this.playerShips.equippedShip),getAmmoInventory:()=>clone(this.playerAmmo),shipId:ship?.id||"",displayName:this.accountState?.profile?.displayName||""})
      .then(()=>{
        if(this.worldRuntime!==runtime)return;
        runtime.setCoopTransport?.(coopTransport);
        this.multiplayer?.ensureWorld?.(runtime.dynamicWorldSeed?.()||{});
      })
      .catch(error=>console.warn("Multiplayer join failed",error));
    return true;
  }

  attachPlayerStateStore(store){
    this.playerStateStore=store||null;
    const status=this.playerStateStore?.status?.();
    this.authenticated=status?.authenticated===true;

    // Legacy tq.game.runtime localStorage was a second source of truth and could
    // diverge from the authenticated account. PlayerStateStore is now the only
    // account persistence path: Firebase when online, account-scoped cache offline.
    if(this.playerStateStore){
      try{localStorage.removeItem(this.persistenceKey)}catch{}
      this.localRestored=false;
    }

    const state=this.playerStateStore?.load?.();
    if(state)this.importAccountState(state);
    queueMicrotask(()=>this.syncRewardClaimMarkers().catch(()=>{}));
    return this;
  }

  async syncRewardClaimMarkers(){
    const reserve=this.playerStateStore?.reserveRewardClaim;
    const status=this.playerStateStore?.status?.();
    if(typeof reserve!=="function"||!status?.authenticated||status?.online===false||globalThis.navigator?.onLine===false)return false;
    const claims=Array.isArray(this.rewards?.claims)?this.rewards.claims:[];
    const details=this.rewards?.claimDetails&&typeof this.rewards.claimDetails==="object"?this.rewards.claimDetails:{};
    let synced=0;
    for(const claimKey of claims){
      const detail=details[claimKey];
      if(!detail||typeof detail!=="object")continue;
      const result=await this.playerStateStore.reserveRewardClaim(claimKey,{
        schema:"tq.reward-claim",
        version:1,
        rewards:clone(detail.rewards||{}),
        worldId:String(detail.worldId||""),
        entityId:String(detail.entityId||""),
        grantedAt:Number(detail.grantedAt)||0
      });
      if(result?.ok||result?.code==="duplicate")synced++;
    }
    return synced;
  }

  importAccountState(state){
    if(!state||typeof state!=="object")return false;
    this.accountState=clone(state);

    const game=state.game&&typeof state.game==="object"?state.game:{};
    const runtime=game.runtime&&typeof game.runtime==="object"
      ?game.runtime
      :(state.schema==="tq.game-state"?state:null);
    this.graphicsSettings=normalizeGraphicsSettings(game.settings?.graphics||runtime?.settings?.graphics||{});

    if(runtime){
      this.current=runtime.current?clone(runtime.current):this.current;
      this.history=Array.isArray(runtime.history)?clone(runtime.history):this.history;
      this.worldStates=runtime.worldStates&&typeof runtime.worldStates==="object"?clone(runtime.worldStates):this.worldStates;
      this.flags=runtime.flags&&typeof runtime.flags==="object"?clone(runtime.flags):this.flags;
      this.inventory=Array.isArray(runtime.inventory)?clone(runtime.inventory):this.inventory;
    }

    const rewardSource=game.rewards&&typeof game.rewards==="object"
      ?game.rewards
      :(runtime?.rewards&&typeof runtime.rewards==="object"?runtime.rewards:{});
    this.rewards={
      coins:Math.max(0,Number(rewardSource.coins)||0),
      gold:Math.max(0,Number(rewardSource.gold ?? rewardSource.coins)||0),
      rubies:Math.max(0,Number(rewardSource.rubies)||0),
      xp:Math.max(0,Number(rewardSource.xp)||0),
      claims:Array.isArray(rewardSource.claims)?unique(rewardSource.claims):[],
      claimDetails:rewardSource.claimDetails&&typeof rewardSource.claimDetails==="object"?clone(rewardSource.claimDetails):{}
    };

    const ships=(
      game.ships&&typeof game.ships==="object"?game.ships:
      state.ships&&typeof state.ships==="object"?state.ships:
      {}
    );
    this.playerShips={
      ownedShips:unique(ships.ownedShips),
      equippedShip:ships.equippedShip?String(ships.equippedShip):null
    };
    const cannons=(
      game.cannons&&typeof game.cannons==="object"?game.cannons:
      state.cannons&&typeof state.cannons==="object"?state.cannons:
      {}
    );
    this.playerCannons={
      owned:cannons.owned&&typeof cannons.owned==="object"?clone(cannons.owned):{},
      equippedByShip:cannons.equippedByShip&&typeof cannons.equippedByShip==="object"?clone(cannons.equippedByShip):{}
    };
    const ammo=(
      game.ammo&&typeof game.ammo==="object"?game.ammo:
      runtime?.ammo&&typeof runtime.ammo==="object"?runtime.ammo:
      state.ammo&&typeof state.ammo==="object"?state.ammo:
      {}
    );
    this.playerAmmo=normalizeGlobalAmmo(ammo);
    this.ensurePlayerShips();
    this.ensurePlayerCannons();
    this.ensurePlayerAmmo();
    this.ensureStarterLoadout();
    return true;
  }

  exportAccountState(){
    const base=this.accountState&&typeof this.accountState==="object"?clone(this.accountState):{};
    return {
      ...base,
      game:{
        ...(base.game&&typeof base.game==="object"?base.game:{}),
        settings:{
          ...((base.game?.settings&&typeof base.game.settings==="object")?base.game.settings:{}),
          graphics:clone(this.graphicsSettings)
        },
        runtime:this.runtimeSnapshot(),
        ships:{
          ownedShips:[...this.playerShips.ownedShips],
          equippedShip:this.playerShips.equippedShip
        },
        cannons:clone(this.playerCannons),
        ammo:clone(this.playerAmmo),
        rewards:clone(this.rewards)
      }
    };
  }

  shipEntry(id){
    return (Array.isArray(this.shipCatalog?.ships)?this.shipCatalog.ships:[]).find(ship=>ship.id===id)||null;
  }

  npcEntry(id){
    return (Array.isArray(this.npcCatalog?.npcs)?this.npcCatalog.npcs:[])
      .find(npc=>String(npc?.id||"")===String(id||""))||null;
  }

  treasureEntry(id){
    return (Array.isArray(this.treasureCatalog?.treasures)?this.treasureCatalog.treasures:[])
      .find(treasure=>treasure.id===id)||null;
  }

  getWalletBalances(){
    const account=this.accountState&&typeof this.accountState==="object"?this.accountState:{};
    const game=account.game&&typeof account.game==="object"?account.game:{};
    const candidates=[
      this.rewards,
      game.rewards,
      game.wallet,
      game.currency,
      game.currencies,
      account.wallet,
      account.currency,
      account.currencies
    ].filter(value=>value&&typeof value==="object");
    const firstNumber=(keys)=>{
      for(const source of candidates){
        for(const key of keys){
          const value=source?.[key];
          if(value!==undefined&&value!==null&&Number.isFinite(Number(value)))return Math.max(0,Number(value));
        }
      }
      return 0;
    };
    return {
      gold:firstNumber(["gold","coins","coin","ouro"]),
      rubies:firstNumber(["rubies","ruby","gems","gem","diamonds","diamond","rubis"])
    };
  }

  consumeItem(id,{worldId=this.current?.id}={}){
    const key=String(id||"");
    const qty=Math.max(0,Math.floor(Number(this.consumables?.[key])||0));
    if(!key||qty<=0)return false;
    this.consumables[key]=qty-1;
    if(worldId&&this.worldRuntime?.getState)this.worldStates[worldId]=clone(this.worldRuntime.getState());
    this.saveState();
    this.syncCloud("consume-item");
    globalThis.dispatchEvent?.(new CustomEvent("tq:itemconsumed",{detail:{id:key,quantity:this.consumables[key]}}));
    return true;
  }

  async purchaseShopItem({item,quantity}={}, {worldId=this.current?.id}={}){
    const product=item&&typeof item==="object"?item:null;
    const amount=Math.max(1,Math.floor(Number(quantity)||1));
    if(!product?.id||!["ammo","cannon","ship","item"].includes(String(product.type||""))){
      return {ok:false,message:"Item inválido para compra."};
    }
    if(String(product.type)==="ship"&&amount!==1){
      return {ok:false,message:"Navios devem ser comprados uma unidade por vez."};
    }

    if(product.type==="cannon"||product.type==="ammo"){
      const onboarding=this.accountState?.game?.onboarding||{};
      const configuredStarterLoadout=Boolean(this.manifest.player?.startingLoadout);
      const cannonReady=configuredStarterLoadout||onboarding.starterCannonChallengeCompleted===true;
      const ammoReady=configuredStarterLoadout||onboarding.starterAmmoChallengeCompleted===true;
      if(!cannonReady||!ammoReady){
        return {
          ok:false,
          code:"starter_training_required",
          message:"Complete primeiro os dois desafios iniciais: conquiste o primeiro canhão e depois a munição ao tentar atirar."
        };
      }
    }

    const currency=String(product.currency||"gold").toLowerCase();
    if(currency==="event")return {ok:false,message:"Este item só pode ser obtido durante o evento."};
    const walletKey=["rubies","ruby","gem","gems","diamond","diamonds"].includes(currency)?"rubies":"gold";
    const unitPrice=Math.max(0,Math.floor(Number(product.price)||0));
    const total=unitPrice*amount;
    const balances=this.getWalletBalances();
    const available=Math.max(0,Number(balances[walletKey])||0);
    const currencyName=walletKey==="rubies"?"rubis":"ouro";
    if(available<total){
      return {ok:false,message:`Saldo insuficiente: são necessários ${total.toLocaleString("pt-BR")} ${currencyName}.`};
    }

    if(product.type==="ship"&&this.playerShips.ownedShips.includes(String(product.id))){
      return {ok:false,message:"Você já possui este navio."};
    }

    if(product.type==="item"){
      const id=String(product.id);
      this.consumables[id]=Math.max(0,Math.floor(Number(this.consumables[id])||0))+amount;
    }else if(product.type==="ammo"){
      const id=String(product.id);
      const packQuantity=Math.max(1,Math.floor(Number(product.packQuantity)||1));
      const grantedQuantity=amount*packQuantity;
      if(!this.grantAmmo(id,grantedQuantity,{save:false,syncServer:true,source:"shop-purchase"})){
        return {ok:false,message:"Não foi possível adicionar a munição ao inventário."};
      }
    }else if(product.type==="cannon"){
      if(!this.grantCannon(String(product.id),amount,{save:false}))return {ok:false,message:"Não foi possível adicionar o canhão ao inventário."};
    }else if(!(await this.grantShip(String(product.id),{save:false}))){
      return {ok:false,message:"Não foi possível adicionar o navio ao inventário."};
    }

    this.rewards={...this.rewards,[walletKey]:Math.max(0,Number(this.rewards?.[walletKey])||0)-total};
    if(walletKey==="gold")this.rewards.coins=this.rewards.gold;
    if(worldId&&this.worldRuntime?.getState)this.worldStates[worldId]=clone(this.worldRuntime.getState());
    this.saveState();
    this.syncCloud("shop-purchase");
    globalThis.dispatchEvent?.(new CustomEvent("tq:shoppurchase",{detail:{item:clone(product),quantity:amount,total,currency:walletKey}}));
    await this.advanceMissions("purchase_upgrade",{worldId,amount:1});
    const purchasedUnits=product.type==="ammo"
      ?amount*Math.max(1,Math.floor(Number(product.packQuantity)||1))
      :amount;
    return {ok:true,message:`Compra realizada: ${purchasedUnits}× ${product.name||product.id}.`};
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
    let owned=unique(this.playerShips?.ownedShips)
      .map(migrateLegacyShipId)
      .filter(id=>validIds.has(id));
    owned=unique(owned);
    const defaultId=String(
      this.manifest.player?.defaultShipId
      ||this.shipCatalog?.defaultShipId
      ||available[0]?.id
      ||""
    );

    if(!owned.length&&defaultId&&validIds.has(defaultId)&&this.manifest.player?.grantDefaultShip!==false){
      owned=[defaultId];
    }

    let equipped=this.playerShips?.equippedShip?migrateLegacyShipId(this.playerShips.equippedShip):null;
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

  cannonEntry(id){
    return (Array.isArray(this.cannonCatalog?.cannons)?this.cannonCatalog.cannons:[])
      .find(cannon=>String(cannon?.id||"")===String(id||""))||null;
  }

  shipCannonCapacity(shipId){
    const ship=this.shipEntry(String(shipId||""));
    return Math.max(1,Math.floor(Number(ship?.combat?.cannonSlots)||1));
  }

  ensurePlayerCannons(){
    const validCannons=(Array.isArray(this.cannonCatalog?.cannons)?this.cannonCatalog.cannons:[])
      .filter(item=>item?.available!==false);
    const validIds=new Set(validCannons.map(item=>String(item.id)));
    const defaultId=String(this.cannonCatalog?.defaultCannonId||validCannons[0]?.id||"");
    const owned={};
    const sourceOwned=this.playerCannons?.owned&&typeof this.playerCannons.owned==="object"?this.playerCannons.owned:{};
    for(const [id,qty] of Object.entries(sourceOwned)){
      if(validIds.has(String(id))){
        const count=Math.max(0,Math.floor(Number(qty)||0));
        if(count>0)owned[String(id)]=count;
      }
    }
    if(this.manifest.player?.grantDefaultCannon===true&&defaultId&&validIds.has(defaultId)&&!Object.values(owned).some(qty=>Number(qty)>0))owned[defaultId]=1;

    const equippedByShip={};
    const sourceEquipped=this.playerCannons?.equippedByShip&&typeof this.playerCannons.equippedByShip==="object"
      ?this.playerCannons.equippedByShip:{};
    for(const shipId of this.playerShips.ownedShips){
      const capacity=this.shipCannonCapacity(shipId);
      const direct=Array.isArray(sourceEquipped[shipId])?sourceEquipped[shipId]:[];
      const legacy=shipId===CURRENT_DEFAULT_SHIP_ID&&Array.isArray(sourceEquipped[LEGACY_DEFAULT_SHIP_ID])
        ?sourceEquipped[LEGACY_DEFAULT_SHIP_ID]:[];
      const requested=[...direct,...legacy].map(String);
      const equipped=requested.filter(id=>validIds.has(id)).slice(0,capacity);
      equippedByShip[shipId]=equipped;
    }

    // Owned is total inventory including equipped units. Ensure counts cover all equipped copies.
    const equippedCounts={};
    for(const ids of Object.values(equippedByShip)){
      for(const id of ids)equippedCounts[id]=(equippedCounts[id]||0)+1;
    }
    for(const [id,count] of Object.entries(equippedCounts)){
      owned[id]=Math.max(Number(owned[id])||0,count);
    }

    this.playerCannons={owned,equippedByShip};
    return this.playerCannons;
  }

  ensurePlayerAmmo(){
    const validAmmo=(Array.isArray(this.ammoCatalog?.ammo)?this.ammoCatalog.ammo:[])
      .filter(item=>item?.available!==false);
    const validIds=new Set(validAmmo.map(item=>String(item.id)));
    const defaultId=String(this.ammoCatalog?.defaultAmmoId||validAmmo[0]?.id||"");
    const normalized=normalizeGlobalAmmo(this.playerAmmo);
    const stock={};
    for(const [id,qty] of Object.entries(normalized.stock)){
      if(validIds.has(id)&&qty>0)stock[id]=qty;
    }

    // Ammo is account-global. Legacy world snapshots are never allowed to
    // recreate stock that has already been spent.
    for(const state of Object.values(this.worldStates||{})){
      if(state&&typeof state==="object"&&"ammo" in state)delete state.ammo;
    }

    this.flags=this.flags&&typeof this.flags==="object"?this.flags:{};
    const ammoInventoryVersion=Math.max(0,Math.floor(Number(this.flags.ammoInventoryVersion)||0));
    if(ammoInventoryVersion<2){
      const hadTestGrant=Math.floor(Number(this.flags.multiplayerTestAmmoGrantVersion)||0)>=1;
      const hadStarterGrant=Math.floor(Number(this.flags.startingLoadoutVersion)||0)>=2;

      if(hadTestGrant){
        // multiplayerTest used Math.max(1000,current), so 1000 units per ammo
        // were synthetic. Remove that known synthetic floor once.
        for(const id of validIds){
          const current=Math.max(0,Math.floor(Number(stock[id])||0));
          if(current>0)stock[id]=Math.max(0,current-1000);
          if(!(stock[id]>0))delete stock[id];
        }
      }else if(hadStarterGrant){
        // v2 starter loadout granted 200 standard cannonballs.
        const id="cannonball-standard";
        const current=Math.max(0,Math.floor(Number(stock[id])||0));
        if(current>0)stock[id]=Math.max(0,current-200);
        if(!(stock[id]>0))delete stock[id];
      }

      this.flags.ammoInventoryVersion=2;
      this.flags.multiplayerTestAmmoGrantVersion=0;
      this.flags.legacyAmmoCleanupAt=Date.now();
    }

    let selectedAmmoId=validIds.has(normalized.selectedAmmoId)?normalized.selectedAmmoId:"";
    if(!selectedAmmoId||!(Number(stock[selectedAmmoId])>0)){
      selectedAmmoId=(defaultId&&Number(stock[defaultId])>0)
        ?defaultId
        :(Object.keys(stock).find(id=>Number(stock[id])>0)||"");
    }
    this.playerAmmo={selectedAmmoId,stock};
    return this.playerAmmo;
  }

  ammoQuantity(ammoId){
    this.ensurePlayerAmmo();
    return Math.max(0,Math.floor(Number(this.playerAmmo.stock?.[String(ammoId||"")])||0));
  }

  grantAmmo(ammoId,quantity,{save=true,syncServer=true,source="grant"}={}){
    this.ensurePlayerAmmo();
    const id=String(ammoId||"").trim();
    const amount=Math.max(0,Math.floor(Number(quantity)||0));
    const valid=(Array.isArray(this.ammoCatalog?.ammo)?this.ammoCatalog.ammo:[])
      .some(ammo=>String(ammo?.id||"")===id&&ammo?.available!==false);
    if(!id||!valid||amount<=0)return false;
    this.playerAmmo.stock[id]=this.ammoQuantity(id)+amount;
    if(!this.playerAmmo.selectedAmmoId)this.playerAmmo.selectedAmmoId=id;
    this.worldRuntime?.replaceAmmoInventory?.(this.playerAmmo,{emit:false});
    if(syncServer)this.multiplayer?.syncAmmoInventory?.(this.playerAmmo,{reason:source});
    if(save)this.saveState();
    return true;
  }

  replacePlayerAmmo(ammo,{save=true,syncServer=false,reason="runtime"}={}){
    this.playerAmmo=normalizeGlobalAmmo(ammo);
    this.ensurePlayerAmmo();
    this.worldRuntime?.replaceAmmoInventory?.(this.playerAmmo,{emit:false});
    if(syncServer)this.multiplayer?.syncAmmoInventory?.(this.playerAmmo,{reason});
    if(save)this.saveState();
    return clone(this.playerAmmo);
  }

  ensureStarterLoadout(){
    const loadout=this.manifest.player?.startingLoadout;
    if(!loadout||typeof loadout!=="object")return false;
    const version=Math.max(1,Math.floor(Number(loadout.version)||1));
    this.flags=this.flags&&typeof this.flags==="object"?this.flags:{};
    this.ensurePlayerShips();
    this.ensurePlayerCannons();
    this.ensurePlayerAmmo();
    if(Math.floor(Number(this.flags.startingLoadoutVersion)||0)>=version)return false;

    const shipId=String(this.playerShips.equippedShip||"");
    const capacity=this.shipCannonCapacity(shipId);
    const equipped=shipId?this.getShipCannons(shipId):[];
    for(const item of Array.isArray(loadout.cannons)?loadout.cannons:[]){
      const id=String(item?.id||"");
      const cannon=this.cannonEntry(id);
      if(!cannon||cannon.available===false)continue;
      const quantity=Math.max(0,Math.floor(Number(item?.quantity)||0));
      if(quantity<=0)continue;
      this.playerCannons.owned[id]=Math.max(Number(this.playerCannons.owned[id])||0,quantity);
      if(item?.equip===true&&shipId){
        let equippedCount=equipped.filter(value=>value===id).length;
        while(equippedCount<quantity&&equipped.length<capacity){
          equipped.push(id);
          equippedCount++;
        }
      }
    }
    if(shipId)this.playerCannons.equippedByShip[shipId]=equipped;
    this.ensurePlayerCannons();

    for(const item of Array.isArray(loadout.ammo)?loadout.ammo:[]){
      const id=String(item?.id||"");
      const valid=(Array.isArray(this.ammoCatalog?.ammo)?this.ammoCatalog.ammo:[])
        .some(ammo=>String(ammo?.id||"")===id&&ammo?.available!==false);
      if(!valid)continue;
      const quantity=Math.max(0,Math.floor(Number(item?.quantity)||0));
      if(quantity<=0)continue;
      this.playerAmmo.stock[id]=Math.max(Number(this.playerAmmo.stock[id])||0,quantity);
      if(item?.select===true&&!this.playerAmmo.selectedAmmoId)this.playerAmmo.selectedAmmoId=id;
    }
    this.ensurePlayerAmmo({migrateWorldStates:false});
    this.flags.startingLoadoutVersion=version;

    const base=this.accountState&&typeof this.accountState==="object"?clone(this.accountState):{};
    const game=base.game&&typeof base.game==="object"?base.game:{};
    const onboarding=game.onboarding&&typeof game.onboarding==="object"?game.onboarding:{};
    this.accountState={
      ...base,
      game:{
        ...game,
        onboarding:{
          ...onboarding,
          starterCannonChallengeCompleted:Array.isArray(loadout.cannons)&&loadout.cannons.length>0
            ?true
            :onboarding.starterCannonChallengeCompleted===true,
          starterAmmoChallengeCompleted:Array.isArray(loadout.ammo)&&loadout.ammo.length>0
            ?true
            :onboarding.starterAmmoChallengeCompleted===true,
          startingLoadoutVersion:version,
          startingLoadoutGrantedAt:Number(onboarding.startingLoadoutGrantedAt)||Date.now()
        }
      }
    };
    return true;
  }

  getShipCannons(shipId=this.playerShips.equippedShip){
    this.ensurePlayerCannons();
    const id=String(shipId||"");
    return [...(Array.isArray(this.playerCannons.equippedByShip[id])?this.playerCannons.equippedByShip[id]:[])];
  }

  getCannonStorage(){
    this.ensurePlayerCannons();
    const equippedCounts={};
    for(const ids of Object.values(this.playerCannons.equippedByShip||{})){
      for(const id of ids||[])equippedCounts[id]=(equippedCounts[id]||0)+1;
    }
    const result={};
    for(const [id,total] of Object.entries(this.playerCannons.owned||{})){
      result[id]=Math.max(0,Math.floor(Number(total)||0)-Math.floor(Number(equippedCounts[id])||0));
    }
    return result;
  }

  equipCannonToShip(cannonId,shipId=this.playerShips.equippedShip,{save=true}={}){
    this.ensurePlayerCannons();
    const cid=String(cannonId||"");
    const sid=String(shipId||"");
    if(!cid||!sid||!this.playerShips.ownedShips.includes(sid)||!this.cannonEntry(cid))return {ok:false,code:"invalid"};
    const equipped=this.getShipCannons(sid);
    const capacity=this.shipCannonCapacity(sid);
    if(equipped.length>=capacity)return {ok:false,code:"ship_full",message:"O navio já está com todos os espaços de canhão ocupados."};
    const storage=this.getCannonStorage();
    if((Number(storage[cid])||0)<=0)return {ok:false,code:"not_in_storage",message:"Esse canhão não está disponível no estaleiro."};
    equipped.push(cid);
    this.playerCannons.equippedByShip[sid]=equipped;
    if(save)this.saveState();
    globalThis.dispatchEvent?.(new CustomEvent("tq:cannonequipped",{detail:{shipId:sid,cannonId:cid}}));
    return {ok:true};
  }

  removeCannonFromShip(cannonId,shipId=this.playerShips.equippedShip,{save=true}={}){
    this.ensurePlayerCannons();
    const cid=String(cannonId||"");
    const sid=String(shipId||"");
    const equipped=this.getShipCannons(sid);
    const index=equipped.indexOf(cid);
    if(index<0)return {ok:false,code:"not_equipped"};
    equipped.splice(index,1);
    this.playerCannons.equippedByShip[sid]=equipped;
    if(save)this.saveState();
    globalThis.dispatchEvent?.(new CustomEvent("tq:cannonremoved",{detail:{shipId:sid,cannonId:cid}}));
    return {ok:true};
  }

  grantCannon(cannonId,quantity=1,{save=true}={}){
    this.ensurePlayerCannons();
    const cid=String(cannonId||"");
    if(!this.cannonEntry(cid))return false;
    this.playerCannons.owned[cid]=Math.max(0,Number(this.playerCannons.owned[cid])||0)+Math.max(1,Math.floor(Number(quantity)||1));
    if(save)this.saveState();
    return true;
  }

  grantStarterCannon(){
    this.ensurePlayerCannons();
    const cannonId=String(this.cannonCatalog?.defaultCannonId||"cannon-basic");
    const cannon=this.cannonEntry(cannonId);
    if(!cannon)return {ok:false};

    const ownedTotal=Object.values(this.playerCannons.owned||{})
      .reduce((sum,value)=>sum+Math.max(0,Math.floor(Number(value)||0)),0);
    if(ownedTotal>0){
      return {
        ok:true,
        alreadyOwned:true,
        cannonId,
        cannonName:String(cannon.name||"Canhão do Marujo"),
        equippedCannonIds:this.getShipCannons()
      };
    }

    this.playerCannons.owned[cannonId]=1;
    const shipId=String(this.playerShips.equippedShip||"");
    if(shipId){
      const equipped=this.getShipCannons(shipId);
      if(equipped.length<this.shipCannonCapacity(shipId)){
        equipped.push(cannonId);
        this.playerCannons.equippedByShip[shipId]=equipped;
      }
    }

    const base=this.accountState&&typeof this.accountState==="object"?clone(this.accountState):{};
    const game=base.game&&typeof base.game==="object"?base.game:{};
    this.accountState={
      ...base,
      game:{
        ...game,
        onboarding:{
          ...(game.onboarding&&typeof game.onboarding==="object"?game.onboarding:{}),
          starterCannonChallengeCompleted:true,
          starterCannonCompletedAt:Date.now()
        }
      }
    };

    this.saveState();
    globalThis.dispatchEvent?.(new CustomEvent("tq:cannonearned",{
      detail:{cannonId,source:"multiplication-rescue",equipped:true,shipId}
    }));
    return {
      ok:true,
      cannonId,
      cannonName:String(cannon.name||"Canhão do Marujo"),
      equippedCannonIds:this.getShipCannons(shipId),
      equipped:true,
      shipId
    };
  }

  markStarterAmmoChallengeCompleted(){
    const base=this.accountState&&typeof this.accountState==="object"?clone(this.accountState):{};
    const game=base.game&&typeof base.game==="object"?base.game:{};
    this.accountState={
      ...base,
      game:{
        ...game,
        onboarding:{
          ...(game.onboarding&&typeof game.onboarding==="object"?game.onboarding:{}),
          starterAmmoChallengeCompleted:true,
          starterAmmoCompletedAt:Date.now()
        }
      }
    };
    this.saveState();
    return true;
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
    this.ensurePlayerCannons();
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
    const forceMapPlayer=world?.test?.forcePlayerProfile===true;
    const ship=forceMapPlayer?null:this.getEquippedShip();
    const shipPlayer=ship?.player&&typeof ship.player==="object"?clone(ship.player):{};

    const navigation={
      x:Number(spawn.x??legacy.x??world.width/2),
      y:Number(spawn.y??legacy.y??world.height/2),
      direction:String(spawn.direction??legacy.direction??shipPlayer.sprite?.initialDirection??"n")
    };

    if(forceMapPlayer){
      return {
        ...legacy,
        ...navigation,
        effects:legacy.effects&&typeof legacy.effects==="object"?clone(legacy.effects):{},
        shipId:legacy.shipId||null
      };
    }

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

  shipRuntimeProfile(ship,role="player"){
    if(!ship||typeof ship!=="object")return {};
    const preferred=role==="npc"?ship.npc:ship.player;
    const fallback=ship.runtime||ship.player||ship.npc;
    const legacy=preferred&&typeof preferred==="object"
      ?clone(preferred)
      :(fallback&&typeof fallback==="object"?clone(fallback):{});
    const navigation=ship.navigation&&typeof ship.navigation==="object"?clone(ship.navigation):null;
    const combat=ship.combat&&typeof ship.combat==="object"?clone(ship.combat):null;
    const spriteMode=ship.spriteMode==="combined"?"combined":"split";
    if(combat&&spriteMode==="combined"){
      combat.useNavigationAtlas=true;
      delete combat.sprite;
    }
    if(!navigation&&!combat)return legacy;
    const effects={
      ...(legacy.effects&&typeof legacy.effects==="object"?legacy.effects:{}),
      ...(navigation?{
        wakeActive:navigation.wake!==false,
        shadowActive:navigation.shadow!==false,
        idleBalanceActive:true,
        idleRoll:Number(navigation.roll??2.4),
        idleHeave:Number(navigation.heave??3.2),
        idlePeriod:Number(navigation.periodMs??3600)
      }:{})
    };
    return {
      ...legacy,
      ...(navigation||{}),
      spriteMode,
      src:navigation?.src||legacy.src||"",
      sprite:navigation?.sprite||legacy.sprite||null,
      width:Number(navigation?.width??legacy.width??230),
      height:Number(navigation?.height??legacy.height??230),
      speed:Number(navigation?.speed??legacy.speed??420),
      acceleration:Number(navigation?.acceleration??legacy.acceleration??1100),
      braking:Number(navigation?.braking??legacy.braking??.12),
      effects,
      combatVisual:combat||legacy.combatVisual||null,
      combatSprite:legacy.combatSprite||null
    };
  }

  resolveWorldShipEntity(entity){
    const legacy=entity&&typeof entity==="object"?clone(entity):{};
    if(legacy.type!=="ship"||!legacy.shipId)return legacy;
    const ship=this.shipEntry(String(legacy.shipId));
    if(!ship||ship.available===false)return legacy;
    const role=String(legacy.role||ship.type||"npc").toLowerCase()==="player"?"player":"npc";
    const profile=this.shipRuntimeProfile(ship,role);
    return {
      ...profile,
      ...legacy,
      shipId:ship.id,
      role,
      shipName:ship.name||legacy.shipName||legacy.label||ship.id,
      sprite:legacy.sprite||profile.sprite||null,
      combatSprite:legacy.combatSprite||profile.combatSprite||null
    };
  }

  resolveWorldShips(world){
    const entities=Array.isArray(world?.entities)?world.entities:[];
    world.entities=entities.map(entity=>this.resolveWorldShipEntity(entity));
    return world;
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

  setWorldOverride(world={}){
    const snapshot=world&&typeof world==="object"?clone(world):null;
    const id=String(snapshot?.id||"").trim();
    if(!id)return false;
    this.worldOverrides.set(id,snapshot);
    if(!this.worldCatalog||typeof this.worldCatalog!=="object")this.worldCatalog={worlds:[]};
    if(!Array.isArray(this.worldCatalog.worlds))this.worldCatalog.worlds=[];
    if(!this.worldCatalog.worlds.some(entry=>String(entry?.id||"")===id)){
      this.worldCatalog.worlds.push({
        id,
        name:String(snapshot.name||id),
        type:String(snapshot.type||"ocean"),
        path:null,
        flowTestOverride:true
      });
    }
    return true;
  }

  worldEntry(ref){
    if(ref&&typeof ref==="object"){
      if(ref.path)return {...ref};
      if(ref.id)ref=ref.id;
    }
    const worlds=Array.isArray(this.worldCatalog?.worlds)?this.worldCatalog.worlds:[];
    if(typeof ref==="string"){
      if(this.worldOverrides.has(ref))return {id:ref,path:null,flowTestOverride:true};
      const found=worlds.find(entry=>entry.id===ref||entry.path===ref);
      if(found)return {...found};
      if(ref==="ocean-prototype"){
        const fallbackId=String(this.manifest.afterAuth?.id||"r1-enseada-aprendizes");
        const fallback=worlds.find(entry=>entry.id===fallbackId)||worlds[0];
        if(fallback){
          console.warn("[TQ Game] migrated obsolete world id",ref,"->",fallback.id);
          return {...fallback};
        }
      }
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
      const state=this.worldRuntime.getState();
      if(state?.ammo){
        this.playerAmmo=normalizeGlobalAmmo(state.ammo);
        this.ensurePlayerAmmo({migrateWorldStates:false});
        delete state.ammo;
      }
      if(id)this.worldStates[id]=state;
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
      this.stopMultiplayerWorld();
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

  async advanceMissions(type,context={}){
    const eventType=String(type||"").trim();
    if(!eventType)return {changed:false,completed:[]};
    const worldId=String(context.worldId||this.current?.id||"");
    const runtimeRegion=Number(this.worldRuntime?.config?.region?.index)||Number(this.worldRuntime?.config?.meta?.regionIndex)||Number(this.worldRuntime?.config?.region)||0;
    const region=Math.max(0,Number(context.region)||Number(worldId.match(/^r(\d+)/i)?.[1])||runtimeRegion||0);
    const base=this.accountState&&typeof this.accountState==="object"?clone(this.accountState):{};
    const game=base.game&&typeof base.game==="object"?base.game:{};
    const missionState=game.missions&&typeof game.missions==="object"?clone(game.missions):{};
    const progress=missionState.progress&&typeof missionState.progress==="object"?clone(missionState.progress):{};
    const claimed=new Set(Array.isArray(missionState.claimedRewards)?missionState.claimedRewards.map(String):[]);
    const completed=[];
    let changed=false;

    for(const mission of Array.isArray(this.missionCatalog?.missions)?this.missionCatalog.missions:[]){
      if(Number(mission?.region)!==region)continue;
      const objective=mission?.objective&&typeof mission.objective==="object"?mission.objective:{};
      if(String(objective.type||"")!==eventType)continue;
      if(eventType==="defeat_npc"){
        const requiredNpcId=String(objective.npcId||objective.targetNpcId||"").trim();
        if(requiredNpcId&&requiredNpcId!==String(context.npcId||""))continue;
      }
      if(eventType==="collect_rare_treasure"&&context.rare!==true)continue;

      const id=String(mission.id||"").trim();
      if(!id)continue;
      const target=Math.max(1,Math.floor(Number(objective.target)||1));
      const amount=Math.max(1,Math.floor(Number(context.amount)||1));
      const previous=Math.max(0,Math.floor(Number(progress[id])||0));
      const next=Math.min(target,previous+amount);
      if(next!==previous){progress[id]=next;changed=true;}
      if(next<target||claimed.has(id))continue;

      const reward=mission?.reward&&typeof mission.reward==="object"?mission.reward:{};
      const gold=Math.max(0,Number(reward.gold ?? reward.coins)||0);
      const rubies=Math.max(0,Number(reward.rubies)||0);
      const xp=Math.max(0,Number(reward.xp)||0);
      const current=this.rewards&&typeof this.rewards==="object"?this.rewards:{coins:0,gold:0,rubies:0,xp:0,claims:[],claimDetails:{}};
      this.rewards={
        ...current,
        coins:Math.max(0,Number(current.coins)||0)+gold,
        gold:Math.max(0,Number(current.gold ?? current.coins)||0)+gold,
        rubies:Math.max(0,Number(current.rubies)||0)+rubies,
        xp:Math.max(0,Number(current.xp)||0)+xp
      };

      const cannonId=String(reward.cannonId||"").trim();
      const cannonQuantity=Math.max(1,Math.floor(Number(reward.cannonQuantity)||1));
      if(cannonId)this.grantCannon(cannonId,cannonQuantity,{save:false});
      const shipId=String(reward.shipId||"").trim();
      if(shipId){
        await this.grantShip(shipId,{equip:reward.equipShip===true,save:false});
        if(reward.equipShip===true&&this.playerShips.ownedShips.includes(shipId)){
          this.playerShips.equippedShip=shipId;
          this.ensurePlayerShips();
        }
      }

      claimed.add(id);
      completed.push(id);
      changed=true;
      globalThis.dispatchEvent?.(new CustomEvent("tq:missionreward",{detail:{
        missionId:id,gold,rubies,xp,cannonId,
        quantity:cannonId?cannonQuantity:0,
        shipId,equipped:shipId?reward.equipShip===true:false
      }}));
      const rewardParts=[];
      if(gold>0)rewardParts.push("+"+gold+" ouro");
      if(rubies>0)rewardParts.push("+"+rubies+" rubis");
      if(xp>0)rewardParts.push("+"+xp+" XP");
      if(cannonId)rewardParts.push(String(reward.cannonQuantity||1)+"× canhão");
      if(shipId)rewardParts.push("navio "+String(shipId));
      globalThis.setTimeout(()=>{
        this.worldRuntime?.showGameplayToast?.(
          "🏆 Parabéns! "+String(mission.name||id)+" concluída"+(rewardParts.length?" · "+rewardParts.join(" · "):""),
          4200
        );
      },850);
    }

    if(!changed)return {changed:false,completed:[]};
    this.accountState={
      ...base,
      game:{
        ...game,
        rewards:clone(this.rewards),
        missions:{...missionState,progress,claimedRewards:[...claimed]}
      }
    };
    this.worldRuntime?.shopOverlay?.refreshBalances?.();
    this.saveState();
    this.syncCloud("mission-progress");
    return {changed:true,completed,rewards:clone(this.rewards)};
  }

  async handleCombatVictory({entity,rewards,claimKey:explicitClaimKey=""}={}){
    const cleanEntity=entity&&typeof entity==="object"?clone(entity):{};
    let configured=rewards&&typeof rewards==="object"?clone(rewards):clone(cleanEntity.rewards||{});
    const worldId=String(this.current?.id||"");
    const partyMembers=Array.isArray(this.coopParty?.members)?this.coopParty.members:[];
    const partyActive=partyMembers.length>1&&this.multiplayer?.socketReady===true;
    if(partyActive){
      const shareGold=Math.max(0,Math.floor(Number(configured.gold ?? configured.coins)||0));
      const shareXp=Math.max(0,Math.floor(Number(configured.xp)||0));
      if((shareGold>0||shareXp>0)&&this.multiplayer?.sharePartyReward?.({
        claimKey:String(explicitClaimKey||worldId+":"+String(cleanEntity.id||"")),
        gold:shareGold,
        xp:shareXp
      })===true){
        configured={...configured,gold:0,coins:0,xp:0};
      }
    }
    const claimKey=String(explicitClaimKey||worldId+":"+String(cleanEntity.id||""));
    if(!cleanEntity.id||!claimKey)return false;

    const currentClaims=Array.isArray(this.rewards?.claims)?this.rewards.claims:[];
    if(currentClaims.includes(claimKey)||this.rewardClaimsInFlight.has(claimKey)){
      globalThis.dispatchEvent?.(new CustomEvent("tq:rewarddebug",{detail:{
        stage:"blocked-duplicate-local",
        worldId,
        entityId:String(cleanEntity.id),
        claimKey,
        duplicateClaim:true
      }}));
      return false;
    }

    this.rewardClaimsInFlight.add(claimKey);
    try{
      const normalizeConfigured=value=>{
        const source=value&&typeof value==="object"?value:{};
        const itemId=String(source.itemId||"").trim();
        const ammoRewards=[];
        const pushAmmo=value=>{
          if(!value||typeof value!=="object")return;
          const id=String(value.id||value.ammoId||"").trim();
          const quantity=Math.max(0,Math.floor(Number(value.quantity)||0));
          if(id&&quantity>0)ammoRewards.push({id,quantity});
        };
        if(Array.isArray(source.ammoRewards))source.ammoRewards.forEach(pushAmmo);
        else if(source.ammo&&Array.isArray(source.ammo))source.ammo.forEach(pushAmmo);
        else pushAmmo(source.ammo);
        return {
          coins:Math.max(0,Number(source.coins)||0),
          gold:Math.max(0,Number(source.gold ?? source.coins)||0),
          rubies:Math.max(0,Number(source.rubies)||0),
          xp:Math.max(0,Number(source.xp)||0),
          itemId,
          quantity:itemId?Math.max(1,Number(source.quantity)||1):0,
          shipId:String(source.shipId||"").trim(),
          ammoRewards
        };
      };

      let normalized=normalizeConfigured(configured);
      let authority="local-offline";
      const storeStatus=this.playerStateStore?.status?.();
      const canReserve=typeof this.playerStateStore?.reserveRewardClaim==="function"
        &&storeStatus?.authenticated===true
        &&storeStatus?.online!==false
        &&globalThis.navigator?.onLine!==false;

      if(canReserve){
        const reservation=await this.playerStateStore.reserveRewardClaim(claimKey,{
          schema:"tq.reward-claim",
          version:1,
          rewards:clone(normalized),
          worldId,
          entityId:String(cleanEntity.id),
          grantedAt:Date.now()
        });

        if(reservation?.ok){
          authority="firebase-reserved";
        }else if(reservation?.code==="duplicate"){
          const existingRewards=reservation?.claim?.payload?.rewards;
          // Another online device already reserved this exact account reward.
          // Mirror the authoritative payload locally once so both devices
          // converge to the same account balance without double-paying it.
          if(existingRewards&&typeof existingRewards==="object"){
            normalized=normalizeConfigured(existingRewards);
            configured=clone(existingRewards);
            authority="firebase-mirror";
          }else{
            globalThis.dispatchEvent?.(new CustomEvent("tq:rewarddebug",{detail:{
              stage:"blocked-duplicate-firebase",
              worldId,
              entityId:String(cleanEntity.id),
              claimKey,
              duplicateClaim:true
            }}));
            return false;
          }
        }else{
          authority="local-fallback";
        }
      }

      // A concurrent callback may have completed while the Firebase reservation
      // was in flight. Re-check before mutating any economy state.
      if(Array.isArray(this.rewards?.claims)&&this.rewards.claims.includes(claimKey)){
        globalThis.dispatchEvent?.(new CustomEvent("tq:rewarddebug",{detail:{
          stage:"blocked-duplicate-race",
          worldId,
          entityId:String(cleanEntity.id),
          claimKey,
          duplicateClaim:true
        }}));
        return false;
      }

      const base=this.accountState&&typeof this.accountState==="object"?clone(this.accountState):{};
      const game=base.game&&typeof base.game==="object"?base.game:{};
      const rewardState=this.rewards&&typeof this.rewards==="object"
        ?this.rewards
        :{coins:0,gold:0,rubies:0,xp:0,claims:[],claimDetails:{}};
      const claims=Array.isArray(rewardState.claims)?[...rewardState.claims]:[];
      const claimDetails=rewardState.claimDetails&&typeof rewardState.claimDetails==="object"
        ?clone(rewardState.claimDetails)
        :{};
      const beforeBalances={
        gold:Math.max(0,Number(rewardState.gold ?? rewardState.coins)||0),
        rubies:Math.max(0,Number(rewardState.rubies)||0),
        xp:Math.max(0,Number(rewardState.xp)||0)
      };

      globalThis.dispatchEvent?.(new CustomEvent("tq:rewarddebug",{detail:{
        stage:"attempt",
        worldId,
        entityId:String(cleanEntity.id),
        claimKey,
        duplicateClaim:false,
        authority,
        before:clone(beforeBalances),
        reward:clone(normalized)
      }}));

      claims.push(claimKey);
      const {coins,gold,rubies,xp,itemId,quantity,shipId,ammoRewards=[]}=normalized;
      const grantedAmmo=[];
      if(ammoRewards.length){
        this.ensurePlayerAmmo();
        const validIds=new Set((Array.isArray(this.ammoCatalog?.ammo)?this.ammoCatalog.ammo:[])
          .filter(ammo=>ammo?.available!==false)
          .map(ammo=>String(ammo?.id||"")));
        for(const ammoReward of ammoRewards){
          const ammoId=String(ammoReward?.id||"").trim();
          const ammoQuantity=Math.max(0,Math.floor(Number(ammoReward?.quantity)||0));
          if(!ammoId||ammoQuantity<=0||!validIds.has(ammoId))continue;
          const before=this.ammoQuantity(ammoId);
          const granted=this.grantAmmo(ammoId,ammoQuantity,{save:false,syncServer:false,source:"reward"});
          const after=this.ammoQuantity(ammoId);
          if(granted&&after===before+ammoQuantity){
            grantedAmmo.push({id:ammoId,quantity:ammoQuantity,before,after});
          }else{
            console.error("[TQ rewards] ammo grant failed",{
              ammoId,ammoQuantity,before,after,claimKey,worldId,entityId:String(cleanEntity.id)
            });
          }
        }
        this.worldRuntime?.replaceAmmoInventory?.(this.playerAmmo,{emit:false});
        if(grantedAmmo.length){
          this.multiplayer?.syncAmmoInventory?.(this.playerAmmo,{reason:"reward"});
        }
      }

      if(itemId){
        for(let count=0;count<quantity;count++)this.inventory.push(itemId);
      }
      if(shipId){
        const ship=this.shipEntry(shipId);
        if(ship&&ship.available!==false&&!this.playerShips.ownedShips.includes(ship.id)){
          this.playerShips.ownedShips.push(ship.id);
          this.ensurePlayerShips();
        }
      }

      claimDetails[claimKey]={
        worldId,
        entityId:String(cleanEntity.id),
        rewards:clone(normalized),
        grantedAt:Date.now(),
        authority
      };
      this.rewards={
        coins:Number(rewardState.coins||0)+coins,
        gold:Number(rewardState.gold ?? rewardState.coins ?? 0)+gold,
        rubies:Number(rewardState.rubies||0)+rubies,
        xp:Number(rewardState.xp||0)+xp,
        claims,
        claimDetails
      };

      this.accountState={
        ...base,
        game:{
          ...game,
          rewards:clone(this.rewards),
          missions:game.missions&&typeof game.missions==="object"?clone(game.missions):{}
        }
      };

      if(cleanEntity.npcId){
        await this.advanceMissions("defeat_npc",{worldId,npcId:String(cleanEntity.npcId),amount:1});
      }

      const balances=this.getWalletBalances();
      const detail={
        worldId,
        entityId:String(cleanEntity.id),
        claimKey,
        authority,
        rewards:clone(normalized),
        balances:clone(balances)
      };
      globalThis.dispatchEvent?.(new CustomEvent("tq:rewarddebug",{detail:{
        stage:"granted",
        worldId,
        entityId:String(cleanEntity.id),
        claimKey,
        authority,
        duplicateClaim:false,
        before:clone(beforeBalances),
        reward:clone(normalized),
        grantedAmmo:clone(grantedAmmo),
        ammo:clone(this.playerAmmo),
        after:clone(balances),
        claimsCount:claims.length
      }}));
      this.worldRuntime?.shopOverlay?.refreshBalances?.();
      globalThis.dispatchEvent?.(new CustomEvent("tq:rewardgranted",{detail:clone(detail)}));
      this.saveState();
      const syncRequested=this.syncCloud("reward-claim");
      globalThis.dispatchEvent?.(new CustomEvent("tq:rewarddebug",{detail:{
        stage:"sync-requested",
        worldId,
        entityId:String(cleanEntity.id),
        claimKey,
        authority,
        local:clone(this.getWalletBalances()),
        syncRequested:Boolean(syncRequested)
      }}));
      return detail;
    }finally{
      this.rewardClaimsInFlight.delete(claimKey);
    }
  }

  async handleBossDefeated({bossId,spawnId,entity,rewards,contribution,defeated=false,hp=null,maxHp=null}={}){
    const stableBossId=String(bossId||entity?.coopBossId||entity?.id||"").trim();
    if(!stableBossId)return false;
    if(defeated!==true||Math.max(0,Number(hp))>0){
      console.warn("[TQ boss reward] blocked non-authoritative defeat",{bossId:stableBossId,defeated,hp,maxHp});
      return false;
    }
    const minimumRatio=Math.max(0,Math.min(1,Number(contribution?.minimumRatio??entity?.combat?.rewardMinDamageRatio)||0));
    const damageRatio=Math.max(0,Math.min(1,Number(contribution?.damageRatio)||0));
    if(minimumRatio>0&&damageRatio<minimumRatio){
      globalThis.dispatchEvent?.(new CustomEvent("tq:bossrewardineligible",{detail:{
        bossId:stableBossId,
        damage:Math.max(0,Number(contribution?.damage)||0),
        damageRatio,
        minimumRatio
      }}));
      return false;
    }

    const claimKey="boss:"+stableBossId+":"+String(spawnId||"1");
    const configuredRewards=rewards&&typeof rewards==="object"?clone(rewards):{};
    const ammoRewards=Array.isArray(configuredRewards.ammoRewards)?configuredRewards.ammoRewards.slice():[];
    ammoRewards.push({id:"orb-volcanic-lava",quantity:1000});
    if(stableBossId==="boss-halloween-dreadnought")ammoRewards.push({id:"terror-rose",quantity:1000});
    configuredRewards.ammoRewards=ammoRewards;
    const rewardResult=await this.handleCombatVictory({entity,rewards:configuredRewards,claimKey});
    if(!rewardResult)return false;

    await this.advanceMissions("defeat_boss",{worldId:String(this.current?.id||""),amount:1});
    if(Number(String(this.current?.id||"").match(/^r(\d+)/i)?.[1])===12){
      await this.advanceMissions("defeat_final_boss",{worldId:String(this.current?.id||""),amount:1});
    }

    const rewardShipId=String(entity?.rewardShipId||"").trim();
    const alreadyOwned=rewardShipId&&this.playerShips.ownedShips.includes(rewardShipId);
    if(rewardShipId&&!alreadyOwned){
      const granted=await this.grantShip(rewardShipId,{equip:true,save:false});
      if(granted){
        this.playerShips.equippedShip=rewardShipId;
        this.ensurePlayerShips();
        this.saveState();
        this.syncCloud("boss-event-ship");
        globalThis.dispatchEvent?.(new CustomEvent("tq:bossshipgranted",{detail:{
          bossId:stableBossId,
          spawnId:String(spawnId||"1"),
          shipId:rewardShipId,
          equipped:true,
          damage:Math.max(0,Number(contribution?.damage)||0),
          damageRatio,
          minimumRatio
        }}));
      }
    }
    return rewardResult;
  }

  async handleTreasureCollected({entity,challenge,rewards}={}){
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

    // Mission progress is driven by the successful collection event itself.
    // It must not depend on the reward/claim pipeline, especially in DEV flow-test.
    await this.advanceMissions("collect_treasure",{worldId,region,amount:1,rare:false});

    // Treasure rewards are granted separately. WorldRuntime may emit the generic
    // reward callback later; using the same claim key keeps payout idempotent.
    const resolvedRewards=rewards&&typeof rewards==="object"
      ?clone(rewards)
      :(cleanEntity.rewards&&typeof cleanEntity.rewards==="object"?clone(cleanEntity.rewards):{});
    if(cleanEntity.id){
      await this.handleCombatVictory({
        entity:cleanEntity,
        rewards:resolvedRewards,
        claimKey:chestKey
      });
    }

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

    let sourceWorld;
    const testWorld=this.manifest?.multiplayerTest||{};
    const forceLocalTestWorld=testWorld.enabled===true
      &&testWorld.useLocalWorldContent===true
      &&String(entry.id||"")===String(testWorld.worldId||"r1-enseada-aprendizes");
    const overriddenWorld=entry.id?this.worldOverrides.get(String(entry.id)):null;
    if(overriddenWorld){
      sourceWorld=clone(overriddenWorld);
    }else if(forceLocalTestWorld){
      const localPath="./src/world/r1-enseada-aprendizes.world.json";
      const response=await fetch(localPath+"?v=20261004-1600-r1-authoritative-reset",{cache:"no-store"});
      if(!response.ok)throw new Error("Local multiplayer test world load failed: "+response.status);
      sourceWorld=await response.json();
      entry.path=localPath;
      this.contentSource="local-multiplayer-test";
    }else{
      try{
        sourceWorld=await this.loadJson(entry.path);
      }catch(error){
        const fallback=entry.id&&this.worldEntry(entry.id);
        if(!fallback?.path||fallback.path===entry.path)throw error;
        console.warn("[TQ Game] stale world path recovered",entry.path,"->",fallback.path);
        sourceWorld=await this.loadJson(fallback.path);
        entry.path=fallback.path;
      }
    }
    const world=this.resolveWorldShips(clone(sourceWorld));
    world.player=this.resolveWorldPlayer(world);
    const worldId=world.id||entry.id;
    this.ensurePlayerAmmo();
    this.ensureStarterLoadout();

    // Production sync arena: use the real inventory/loadout pipeline rather than
    // runtime-only test overrides, so combat behaves exactly like normal play.
    const testConfig=this.manifest?.multiplayerTest||{};
    if(testConfig.enabled===true&&worldId===String(testConfig.worldId||"")){
      const ammoFloor=Math.max(0,Math.floor(Number(testConfig.grantAllAmmo)||0));
      const ammoGrantVersion=1;
      const alreadyGranted=Math.floor(Number(this.flags?.multiplayerTestAmmoGrantVersion)||0)>=ammoGrantVersion;
      if(ammoFloor>0&&!alreadyGranted){
        for(const ammo of Array.isArray(this.ammoCatalog?.ammo)?this.ammoCatalog.ammo:[]){
          const ammoId=String(ammo?.id||"").trim();
          if(ammoId&&ammo?.available!==false)this.playerAmmo.stock[ammoId]=Math.max(ammoFloor,Math.floor(Number(this.playerAmmo.stock[ammoId])||0));
        }
        this.flags=this.flags&&typeof this.flags==="object"?this.flags:{};
        this.flags.multiplayerTestAmmoGrantVersion=ammoGrantVersion;
      }
      if(!this.playerAmmo.selectedAmmoId){
        this.playerAmmo.selectedAmmoId=String(this.ammoCatalog?.defaultAmmoId||this.ammoCatalog?.ammo?.[0]?.id||"");
      }
      this.ensurePlayerAmmo({migrateWorldStates:false});
    }

    // Reconcile legacy reward claims with world collection state.
    //
    // Older builds regenerated deterministic treasure ids and removed them from
    // state.collected during world construction. The reward claim, however,
    // remained persisted. That left a split-brain state:
    //   rewards.claims = chest already paid
    //   worldState.collected = chest appears available again
    // The player could solve the chest again, but payout was correctly rejected
    // as a duplicate. Rebuild the missing collected state from canonical claims.
    const restoredSource=state||this.worldStates[worldId]||null;
    const restored=restoredSource&&typeof restoredSource==="object"
      ?clone(restoredSource)
      :{};
    const collected=new Set(Array.isArray(restored.collected)?restored.collected.map(String):[]);
    const claimPrefix=String(worldId)+":";
    const staticTreasureIds=new Set(
      (Array.isArray(world.entities)?world.entities:[])
        .filter(entity=>String(entity?.type||"")==="treasure")
        .map(entity=>String(entity?.id||""))
        .filter(Boolean)
    );
    const respawningTreasureIds=new Set(
      (Array.isArray(world.treasurePopulation?.types)?world.treasurePopulation.types:[])
        .filter(type=>type?.respawn===true)
        .map(type=>String(type?.treasureId||""))
        .filter(Boolean)
    );
    let reconciledTreasureClaims=0;
    for(const rawClaim of Array.isArray(this.rewards?.claims)?this.rewards.claims:[]){
      const claim=String(rawClaim||"");
      if(!claim.startsWith(claimPrefix))continue;
      const entityId=claim.slice(claimPrefix.length);
      if(!entityId)continue;

      let isNonRespawnTreasure=staticTreasureIds.has(entityId);
      if(entityId.startsWith("treasure.auto.")){
        const suffix=entityId.slice("treasure.auto.".length);
        const lastDot=suffix.lastIndexOf(".");
        const treasureId=lastDot>0?suffix.slice(0,lastDot):suffix;
        isNonRespawnTreasure=!respawningTreasureIds.has(treasureId);
      }
      if(!isNonRespawnTreasure||collected.has(entityId))continue;
      collected.add(entityId);
      reconciledTreasureClaims++;
    }
    restored.collected=[...collected];
    restored.ammo=clone(this.playerAmmo);
    if(reconciledTreasureClaims>0){
      this.worldStates[worldId]=clone(restored);
      console.info("[TQ rewards] reconciled claimed treasures into world state",{
        worldId,
        count:reconciledTreasureClaims
      });
    }

    this.sceneHost.hidden=true;
    this.worldHost.hidden=false;

    const forceTestLoadout=world?.test?.forceLoadout===true;
    const availableCannons=(Array.isArray(this.cannonCatalog?.cannons)?this.cannonCatalog.cannons:[])
      .filter(item=>item?.available!==false);
    const strongestCannonCount=Math.max(0,Math.floor(Number(world?.test?.strongestCannonCount)||0));
    const strongestCannon=availableCannons.reduce((best,item)=>{
      if(!best)return item;
      const itemPower=Number(item?.damagePerShot)||Number(item?.damageMultiplier)||0;
      const bestPower=Number(best?.damagePerShot)||Number(best?.damageMultiplier)||0;
      return itemPower>bestPower?item:best;
    },null);
    const effectLabCannonIds=forceTestLoadout&&strongestCannon&&strongestCannonCount
      ?Array.from({length:strongestCannonCount},()=>String(strongestCannon.id))
      :[];

    this.worldRuntime=new WorldRuntime(this.worldHost,world,{
      editorEnabled:false,
      globalCamera:clone(this.manifest.worldDefaults?.camera||{}),
      state:restored||{},
      soundCatalog:this.soundCatalog&&typeof this.soundCatalog==="object"?clone(this.soundCatalog):{sounds:[]},
      ammoCatalog:Array.isArray(this.ammoCatalog?.ammo)?clone(this.ammoCatalog.ammo):[],
      cannonCatalog:Array.isArray(this.cannonCatalog?.cannons)?clone(this.cannonCatalog.cannons):Array.isArray(this.cannonCatalog)?clone(this.cannonCatalog):[],
      graphicsSettings:clone(this.graphicsSettings),
      playerName:String(this.accountState?.profile?.displayName||"Jogador"),
      onGraphicsSettingsChange:settings=>{
        this.graphicsSettings=normalizeGraphicsSettings(settings);
        this.saveState();
        this.syncCloud("graphics-settings");
      },
      playerCannonIds:forceTestLoadout?null:this.getShipCannons(this.playerShips.equippedShip),
      testCannonIds:forceTestLoadout?effectLabCannonIds:[],
      testAmmoId:String(world?.test?.ammoId||""),
      testAmmoQuantity:forceTestLoadout?Math.max(0,Math.floor(Number(world?.test?.ammoQuantity)||0)):undefined,
      initialAllTestAmmoQuantity:forceTestLoadout?Math.max(0,Math.floor(Number(world?.test?.allAmmoQuantity)||0)):undefined,
      onStarterCannonEarned:()=>this.grantStarterCannon(),
      onStarterAmmoEarned:()=>{
        this.markStarterAmmoChallengeCompleted();
        this.multiplayer?.syncAmmoInventory?.(this.playerAmmo,{reason:"starter-ammo-reward"});
        queueMicrotask(()=>this.saveState());
      },
      onAmmoChange:ammo=>{
        this.playerAmmo=normalizeGlobalAmmo(ammo);
        this.ensurePlayerAmmo();
        if(this.current?.kind==="world"&&this.worldRuntime?.getState){
          const snapshot=this.worldRuntime.getState();
          if(snapshot&&typeof snapshot==="object"){
            delete snapshot.ammo;
            this.worldStates[worldId]=clone(snapshot);
          }
        }
        this.saveState();
        clearTimeout(this.ammoSyncTimer);
        this.ammoSyncTimer=setTimeout(()=>{
          this.ammoSyncTimer=0;
          this.syncCloud("ammo-consumed");
        },900);
      },
      shipCatalog:Array.isArray(this.shipCatalog?.ships)?clone(this.shipCatalog.ships):Array.isArray(this.shipCatalog)?clone(this.shipCatalog):[],
      missionCatalog:Array.isArray(this.missionCatalog?.missions)?clone(this.missionCatalog.missions):[],
      getMissionProgress:()=>clone(this.accountState?.game?.missions?.progress||{}),
      shopBalances:()=>this.getWalletBalances(),
      onShopPurchase:request=>this.purchaseShopItem(request,{worldId}),
      getConsumableQuantity:id=>Math.max(0,Math.floor(Number(this.consumables?.[String(id||"")])||0)),
      onConsumeItem:id=>this.consumeItem(id,{worldId}),
      onInviteParty:player=>{
        const uid=String(player?.uid||"");
        if(!uid)return false;
        const sent=this.multiplayer?.inviteParty?.(uid)===true;
        this.worldRuntime?.showGameplayToast?.(sent?"Convite cooperativo enviado para "+String(player?.name||"Pirata"):"Servidor multiplayer indisponível.",1500);
        return sent;
      },
      onPartyNpcDefeat:payload=>this.recordPartyNpcDefeat(payload),
      onRuntimeStateChange:()=>{
        if(this.current?.kind==="world"&&this.worldRuntime?.getState){
          const snapshot=this.worldRuntime.getState();
          if(snapshot&&typeof snapshot==="object"){
            delete snapshot.ammo;
            this.worldStates[worldId]=clone(snapshot);
          }
        }
        this.saveState();
      },
      getShipyardState:()=>({
        ships:this.listOwnedShips().map(ship=>({id:ship.id,name:ship.name||ship.id,equipped:ship.id===this.playerShips.equippedShip,cannons:this.getShipCannons(ship.id).map(id=>this.cannonEntry(id)).filter(Boolean).map(c=>({id:c.id,name:c.name||c.id}))})),
        cannons:(Array.isArray(this.cannonCatalog?.cannons)?this.cannonCatalog.cannons:[]).map(c=>({id:c.id,name:c.name||c.id})),
        storage:this.getCannonStorage()
      }),
      onEquipShip:async id=>{const ok=await this.equipShip(id);return ok?{ok:true,message:"Navio equipado."}:{ok:false,message:"Não foi possível equipar este navio."};},
      onEquipCannon:id=>{const result=this.equipCannonToShip(id);return result.ok?{ok:true,message:"Canhão equipado."}:result;},
      onRemoveCannon:(id,shipId)=>{const result=this.removeCannonFromShip(id,shipId);return result.ok?{ok:true,message:"Canhão guardado."}:result;},
      resolveShip:(shipId,role="npc")=>{
        const ship=this.shipEntry(shipId);
        if(!ship||ship.available===false)return null;
        return {
          ...this.shipRuntimeProfile(ship,role),
          shipId:ship.id,
          shipName:ship.name||ship.id,
          name:ship.name||ship.id
        };
      },
      resolveNpc:npcId=>{
        const npc=this.npcEntry(String(npcId||""));
        return npc?clone(npc):null;
      },
      resolveTreasure:treasureId=>{
        const treasure=this.treasureEntry(String(treasureId||""));
        return treasure?clone(treasure):null;
      },
      createPedagogyChallenge:({entity})=>{
        const starterRescue=entity?.type==="cannon-rescue"||entity?.type==="ammo-rescue";
        const repairChallenge=entity?.type==="repair";
        const mapPedagogyRegion=repairChallenge?Math.max(0,Math.floor(Number(entry?.region)||0)):0;
        return this.pedagogyRuntime.createChallenge({
          kind:entity?.type==="treasure"?"treasure":((starterRescue||repairChallenge)?"combat":"world-interaction"),
          worldId,
          entityId:entity?.id,
          entityType:entity?.type,
          pedagogyRegion:mapPedagogyRegion||undefined,
          useRegionFamilies:repairChallenge&&mapPedagogyRegion>0,
          minimumFactor:starterRescue?2:1,
          minimumProduct:starterRescue?6:1
        });
      },
      onPedagogyResult:result=>this.recordPedagogyResult({
        ...result,
        worldId
      }),
      onTreasureCollected:payload=>this.handleTreasureCollected(payload),
      onBossDefeated:payload=>this.handleBossDefeated(payload),
      onRewardCollected:payload=>this.handleCombatVictory(payload),
      onEnterScene:(entity,worldState)=>{
        if(worldId)this.worldStates[worldId]=clone(worldState||this.worldRuntime?.getState?.()||{});
        return this.openScene(entity.scene,{pushHistory:true});
      },
      canEnterWorld:entity=>this.canShowRegionTransition(entity?.destinationWorldId,worldId),
      onEnterWorld:(entity,worldState)=>{
        if(worldId)this.worldStates[worldId]=clone(worldState||this.worldRuntime?.getState?.()||{});
        const target=entity?.destinationWorldId;
        if(!target)return false;
        return this.openWorld(target,{pushHistory:true});
      },
      onExecuteAction:(interaction,entity,worldState)=>{
        if(worldId)this.worldStates[worldId]=clone(worldState||this.worldRuntime?.getState?.()||{});
        return this.executeAction(interaction,{entity:clone(entity||{}),worldId});
      }
    });
    this.worldRuntime.mount();
    this.worldRuntime.setMode("play");
    this.startMultiplayerWorld(worldId);

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
    if(override&&authRequired&&!this.authenticated){
      this.pendingAuthRoute=clone(override);
      requested=login;
    }else if(override){
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
      settings:{graphics:clone(this.graphicsSettings)},
      inventory:clone(this.inventory),
      consumables:clone(this.consumables),
      ammo:clone(this.playerAmmo),
      rewards:clone(this.rewards)
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
      },
      cannons:clone(this.playerCannons),
      ammo:clone(this.playerAmmo)
    };
  }

  restorePersistedState(){
    try{
      const raw=localStorage.getItem(this.persistenceKey);
      if(!raw)return false;
      const state=JSON.parse(raw);
      if(state?.schema!=="tq.game-state")return false;
      this.current=state.current?clone(state.current):null;
      this.history=Array.isArray(state.history)?clone(state.history):[];
      this.worldStates=state.worldStates&&typeof state.worldStates==="object"?clone(state.worldStates):{};
      this.flags=state.flags&&typeof state.flags==="object"?clone(state.flags):{};
      this.graphicsSettings=normalizeGraphicsSettings(state.settings?.graphics||{});
      this.inventory=Array.isArray(state.inventory)?clone(state.inventory):[];
      this.consumables=state.consumables&&typeof state.consumables==="object"?clone(state.consumables):{};
      this.rewards=state.rewards&&typeof state.rewards==="object"
        ?{
          coins:Math.max(0,Number(state.rewards.coins)||0),
          gold:Math.max(0,Number(state.rewards.gold ?? state.rewards.coins)||0),
          rubies:Math.max(0,Number(state.rewards.rubies)||0),
          xp:Math.max(0,Number(state.rewards.xp)||0),
          claims:unique(state.rewards.claims),
          claimDetails:state.rewards.claimDetails&&typeof state.rewards.claimDetails==="object"?clone(state.rewards.claimDetails):{}
        }
        :{coins:0,gold:0,rubies:0,xp:0,claims:[],claimDetails:{}};
      if(state.ships&&typeof state.ships==="object"){
        this.playerShips={
          ownedShips:unique(state.ships.ownedShips),
          equippedShip:state.ships.equippedShip?String(state.ships.equippedShip):null
        };
      }
      if(state.cannons&&typeof state.cannons==="object"){
        this.playerCannons={
          owned:state.cannons.owned&&typeof state.cannons.owned==="object"?clone(state.cannons.owned):{},
          equippedByShip:state.cannons.equippedByShip&&typeof state.cannons.equippedByShip==="object"?clone(state.cannons.equippedByShip):{}
        };
      }
      this.playerAmmo=normalizeGlobalAmmo(state.ammo||{});
      this.ensurePlayerShips();
      this.ensurePlayerCannons();
      this.ensurePlayerAmmo();
      this.ensureStarterLoadout();
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
        },
        cannons:clone(this.playerCannons),
        ammo:clone(this.playerAmmo)
      };
      localStorage.setItem(this.persistenceKey,JSON.stringify(state));
      return true;
    }catch{
      return false;
    }
  }

  saveState(){
    try{
      this.captureCurrentState();

      if(this.playerStateStore){
        const account=this.exportAccountState();
        this.accountState=clone(account);
        // Runtime autosaves are cache-only. Durable cloud writes happen through
        // syncCloud()/explicit checkpoints, keeping Firestore out of live combat.
        this.playerStateStore.save(account,{sync:false});
        return true;
      }

      // Fallback only for runtimes without an authenticated PlayerStateStore
      // (DEV/editor/local harness). Production player state never uses this path.
      this.writeSessionState();
      return true;
    }catch(error){
      console.warn("GameRuntime state save failed",error);
      return false;
    }
  }

  clearSavedState(){
    try{localStorage.removeItem(this.persistenceKey)}catch{}
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
    clearTimeout(this.ammoSyncTimer);
    this.ammoSyncTimer=0;
    this.captureCurrentState();
    this.saveState();
    this.stopMultiplayerWorld();
    this.worldRuntime?.destroy?.();
    this.worldRuntime=null;
    this.sceneRuntime?.resizeObserver?.disconnect?.();
    for(const cleanup of this.cleanups.splice(0))cleanup();
    this.root?.classList.remove("tq-game-runtime");
    if(this.root)this.root.innerHTML="";
  }
}