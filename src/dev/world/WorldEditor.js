import { WorldRuntime } from "../../world/WorldRuntime.js?v=20261002-1805";

export class WorldEditor {
  constructor(root,{sceneRuntime,pedagogyRuntime,onPedagogyResult,resolveShip,resolveNpc,resolveTreasure,getCannonCatalog,getAmmoCatalog,getSoundCatalog}={}){
    this.root=root;
    this.sceneRuntime=sceneRuntime||null;
    this.pedagogyRuntime=pedagogyRuntime||null;
    this.onPedagogyResult=typeof onPedagogyResult==="function"?onPedagogyResult:null;
    this.resolveShip=typeof resolveShip==="function"?resolveShip:null;
    this.resolveNpc=typeof resolveNpc==="function"?resolveNpc:null;
    this.resolveTreasure=typeof resolveTreasure==="function"?resolveTreasure:null;
    this.getCannonCatalog=typeof getCannonCatalog==="function"?getCannonCatalog:()=>({defaultCannonId:"cannon-basic",cannons:[]});
    this.getAmmoCatalog=typeof getAmmoCatalog==="function"?getAmmoCatalog:()=>({defaultAmmoId:"cannonball-standard",ammo:[]});
    this.getSoundCatalog=typeof getSoundCatalog==="function"?getSoundCatalog:()=>({sounds:[]});
    this.runtime=null;
    this.entry=null;
    this.sourceWorld=null;
    this.storageKey=null;
    this.host=null;
    this.active=false;
    this.suspended=false;
  }

  async open(entry){
    if(!entry?.path)throw new Error("World entry has no path");
    const response=await fetch(entry.path,{cache:"no-store"});
    if(!response.ok)throw new Error("World load failed: "+response.status);
    return this.openSource(entry,await response.json());
  }

  async openLocal(entry,world){
    if(!entry?.id||!world?.id)throw new Error("Invalid local world");
    return this.openSource({...entry,local:true},world);
  }

  openSource(entry,source){
    this.close({showScene:false});
    this.entry=structuredClone(entry);
    this.sourceWorld=structuredClone(source);
    this.storageKey="tq.dev.world-draft:"+source.id;

    let world=structuredClone(source);
    try{
      const saved=localStorage.getItem(this.storageKey);
      if(saved){
        const draft=JSON.parse(saved);
        const sourceRevision=source.meta?.sourceRevision??null;
        const draftRevision=draft.meta?.sourceRevision??null;
        if(draft?.schema===source.schema&&draft?.id===source.id&&draftRevision===sourceRevision){
          world=draft;
          const sourceLayoutRevision=source.meta?.layoutRevision??null;
          const draftLayoutRevision=draft.meta?.layoutRevision??null;
          if(sourceLayoutRevision&&sourceLayoutRevision!==draftLayoutRevision){
            world.width=source.width;
            world.height=source.height;
            world.playableArea=structuredClone(source.playableArea||null);
            world.meta={...(world.meta||{}),layoutRevision:sourceLayoutRevision};
          }
        }else{
          localStorage.removeItem(this.storageKey);
        }
      }
    }catch(error){
      console.warn("World draft restore failed",error);
    }

    this.host=document.createElement("div");
    this.host.className="tq-world-editor-root";
    this.root.append(this.host);
    if(this.sceneRuntime?.stageHost)this.sceneRuntime.stageHost.style.display="none";

    const cannonCatalog=this.getCannonCatalog()||{};
    const availableCannons=(Array.isArray(cannonCatalog.cannons)?cannonCatalog.cannons:[]).filter(item=>item?.available!==false);
    const defaultCannonId=String(cannonCatalog.defaultCannonId||availableCannons[0]?.id||"cannon-basic");
    const requestedCannonIds=Array.isArray(world.test?.cannonIds)?world.test.cannonIds.map(String):[];
    const ammoCatalog=this.getAmmoCatalog()||{};
    const availableAmmo=(Array.isArray(ammoCatalog.ammo)?ammoCatalog.ammo:[]).filter(item=>item?.available!==false);
    const defaultAmmoId=String(ammoCatalog.defaultAmmoId||availableAmmo[0]?.id||"cannonball-standard");
    const testAmmoId=String(world.test?.ammoId||defaultAmmoId);
    const testAmmoQuantity=Math.max(0,Math.floor(Number(world.test?.ammoQuantity??50)||0));
    this.runtime=new WorldRuntime(this.host,world,{
      editorEnabled:true,
      cannonCatalog:availableCannons,
      testCannonIds:requestedCannonIds.length?requestedCannonIds:[defaultCannonId],
      ammoCatalog:availableAmmo,
      testAmmoId,
      testAmmoQuantity,
      soundCatalog:this.getSoundCatalog(),
      resolveShip:this.resolveShip,
      resolveNpc:this.resolveNpc,
      resolveTreasure:this.resolveTreasure,
      createPedagogyChallenge:context=>this.pedagogyRuntime?.createChallenge?.({
        ...context,
        kind:context?.entity?.type==="treasure"?"treasure":"world-interaction",
        worldId:world.id,
        entityId:context?.entity?.id,
        entityType:context?.entity?.type
      })??{
        available:false,
        code:"pedagogy_rules_unavailable",
        message:"Regras pedagógicas não disponíveis nesta conta."
      },
      onPedagogyResult:result=>this.onPedagogyResult?.(result),
      onTreasureCollected:payload=>{
        window.dispatchEvent(new CustomEvent("tq:treasurecollected",{detail:payload}));
      },
      onCombatVictory:payload=>{
        window.dispatchEvent(new CustomEvent("tq:combatvictory",{detail:payload}));
      },
      onRewardCollected:payload=>{
        window.dispatchEvent(new CustomEvent("tq:rewardcollected",{detail:payload}));
      },
      onEnterScene:(entity,state)=>{
        window.dispatchEvent(new CustomEvent("tq:worldenterscene",{detail:{entity,state}}));
      },
      onEnterWorld:(entity,state)=>{
        window.dispatchEvent(new CustomEvent("tq:worldenterworld",{detail:{entity,state}}));
      },
      onExecuteAction:(interaction,entity,state)=>{
        window.dispatchEvent(new CustomEvent("tq:worldexecuteaction",{detail:{interaction,entity,state}}));
      },
      onSelectionChange:entity=>{
        window.dispatchEvent(new CustomEvent("tq:worldselectionchange",{detail:{entity}}));
      },
      onEntityChange:(entity,commit)=>{
        if(commit)this.persist();
        window.dispatchEvent(new CustomEvent("tq:worldentitychange",{detail:{entity,commit}}));
      }
    });
    this.runtime.mount();
    this.active=true;
    this.suspended=false;
    window.dispatchEvent(new CustomEvent("tq:worldopen",{detail:{world:this.runtime.getWorld(),entry:this.entry}}));
    return this.runtime.getWorld();
  }

  persist(){
    if(!this.active||!this.runtime||!this.storageKey)return;
    try{
      localStorage.setItem(this.storageKey,JSON.stringify(this.runtime.getWorld()));
    }catch(error){
      console.warn("World draft save failed",error);
    }
  }

  emitWorldChange(){
    const world=this.getWorld();
    window.dispatchEvent(new CustomEvent("tq:worldchange",{detail:{world,entry:this.entry}}));
    return world;
  }

  setMode(mode){
    if(!this.runtime)return;
    this.runtime.setMode(mode==="play"?"play":"edit");
    this.runtime.setEditorPreviewActive?.(mode==="config");
  }

  addAsset(asset){
    if(!this.runtime||!asset)return null;
    const path=String(asset.path||"");
    const src="./"+path;
    const stem=String(asset.name||"asset")
      .replace(/\.[^.]+$/,"")
      .replace(/[^a-z0-9]+/gi,"-")
      .replace(/^-|-$/g,"")
      .toLowerCase()||"asset";
    const center=this.runtime.getCameraCenter();

    let type="object";
    let width=96,height=96;
    let extra={};

    if(path.includes("/barris/")){
      type="barrel";width=78;height=78;extra={
        motion:{active:true,preset:"calm",speed:38,heave:24,pitch:20,roll:10,sway:8},
        effect:{category:"sea-item",preset:"none"},
        collision:{active:true,shape:"ellipse",scaleX:.72,scaleY:.72,padding:4,action:"auto",message:""}
      };
    }else if(path.includes("/baus/")){
      type="treasure";width=88;height=88;extra={
        motion:{active:true,preset:"calm",speed:38,heave:24,pitch:20,roll:10,sway:8},
        effect:{category:"treasure",preset:"none"},
        collision:{active:true,shape:"ellipse",scaleX:.72,scaleY:.72,padding:4,action:"auto",message:""}
      };
    }else if(path.includes("/ships/")){
      type="ship";width=110;height=150;extra={
        motion:{active:true,preset:"navigation",speed:55,heave:46,pitch:42,roll:24,sway:14},
        effect:{category:"ship",preset:"none"},
        combat:{hp:3},
        collision:{active:true,shape:"ellipse",scaleX:.46,scaleY:.60,padding:8,action:"none",message:""}
      };
    }else if(path.includes("/backgrounds/")||path.includes("/regions/islands/")){
      const category=/\/islands\/|ilha|island/i.test(path)?"island":"background";
      type=category;width=280;height=190;
      extra={
        renderMode:"sprite",
        showLabel:false,
        interactionRadius:230,
        motion:{active:false,preset:"none",speed:50,heave:0,pitch:0,roll:0,sway:0},
        effect:{category,preset:"none"},
        collision:category==="island"
          ?{active:true,shape:"ellipse",scaleX:.72,scaleY:.52,padding:10,action:"auto",message:""}
          :{active:false,shape:"box",scaleX:1,scaleY:1,padding:0,action:"none",message:""}
      };
    }

    const entity=this.runtime.addEntity({
      id:(this.runtime.config.id||"world")+"."+stem,
      type,
      label:String(asset.name||stem).replace(/\.[^.]+$/,""),
      src,
      x:center.x,
      y:center.y,
      width,
      height,
      z:20,
      rotation:0,
      lockAspect:true,
      ...extra
    });
    this.persist();
    this.emitWorldChange();
    return entity;
  }

  addRegionExit({destinationWorldId="",label="Saída de região"}={}){
    if(!this.runtime)return null;
    const center=this.runtime.getCameraCenter();
    const stamp=Date.now().toString(36);
    const entity=this.runtime.addEntity({
      id:(this.runtime.config.id||"world")+".region-exit."+stamp,
      type:"region-exit",
      label:String(label||"Saída de região"),
      src:"",
      renderMode:"logical",
      showLabel:false,
      x:center.x,
      y:center.y,
      width:420,
      height:180,
      z:90,
      rotation:0,
      lockAspect:false,
      destinationWorldId:String(destinationWorldId||""),
      interaction:{
        actionId:"enter-region",
        params:{regionId:String(destinationWorldId||""),spawnId:""}
      },
      transitionMessage:"",
      transitionActionLabel:"Navegar",
      motion:{active:false,preset:"none",speed:0,heave:0,pitch:0,roll:0,sway:0},
      effect:{category:"generic",preset:"none",active:false},
      collision:{active:true,shape:"box",scaleX:1,scaleY:1,padding:0,action:"enter-world",message:""}
    });
    this.runtime.selectEntity(entity?.id);
    this.persist();
    this.emitWorldChange();
    return entity;
  }

  updateEntity(id,patch,commit=true){
    const entity=this.runtime?.updateEntity(id,patch,commit)||null;
    if(commit){this.persist();this.emitWorldChange()}
    return entity;
  }

  getEntityMotion(id){
    return this.runtime?.getEntityMotion(id)||null;
  }

  updateEntityMotion(id,patch,commit=true){
    const motion=this.runtime?.updateEntityMotion(id,patch,commit)||null;
    if(commit){this.persist();this.emitWorldChange()}
    return motion;
  }

  getEntityEffect(id){
    return this.runtime?.getEntityEffect(id)||null;
  }

  setDepthMaskEditing(id,active=true){
    return this.runtime?.setDepthMaskEditing(id,active)||false;
  }

  clearDepthMask(id){
    const changed=this.runtime?.clearDepthMask(id)||false;
    if(changed){this.persist();this.emitWorldChange()}
    return changed;
  }

  getEntityCollision(id){
    return this.runtime?.getEntityCollision(id)||null;
  }

  updateEntityCollision(id,patch,commit=true){
    const collision=this.runtime?.updateEntityCollision(id,patch,commit)||null;
    if(commit){this.persist();this.emitWorldChange()}
    return collision;
  }

  listEntityEffectPresets(id){
    return this.runtime?.listEntityEffectPresets(id)||[];
  }

  updateEntityEffect(id,patch,commit=true){
    const effect=this.runtime?.updateEntityEffect(id,patch,commit)||null;
    if(commit){this.persist();this.emitWorldChange()}
    return effect;
  }

  deleteEntity(id){
    const deleted=this.runtime?.deleteEntity(id)||false;
    if(deleted){this.persist();this.emitWorldChange()}
    return deleted;
  }

  updateWorld(patch,commit=true){
    const world=this.runtime?.updateWorld(patch,commit)||null;
    if(commit){this.persist();this.emitWorldChange()}
    return world;
  }

  updateOcean(patch,commit=true){
    const ocean=this.runtime?.updateOcean(patch)||null;
    if(commit){this.persist();this.emitWorldChange()}
    return ocean;
  }

  applyEnvironmentPreset(id,commit=true){
    const world=this.runtime?.applyEnvironmentPreset(id)||null;
    if(commit){this.persist();this.emitWorldChange()}
    return world;
  }

  getSelected(){
    return this.runtime?.getSelected()||null;
  }

  selectEntity(id){
    this.runtime?.selectEntity(id);
    return this.getSelected();
  }

  getWorld(){
    return this.runtime?.getWorld()||null;
  }

  getOcean(){
    return this.runtime?.getOcean()||null;
  }

  getPlayerConfig(){
    return this.runtime?.getPlayerConfig()||null;
  }

  updatePlayerConfig(patch,commit=true){
    const player=this.runtime?.updatePlayerConfig(patch)||null;
    if(commit){this.persist();this.emitWorldChange()}
    return player;
  }

  suspend(){
    if(!this.active||!this.host)return;
    this.persist();
    this.host.hidden=true;
    this.suspended=true;
  }

  resume(){
    if(!this.active||!this.host)return;
    if(this.sceneRuntime?.stageHost)this.sceneRuntime.stageHost.style.display="none";
    this.host.hidden=false;
    this.suspended=false;
    this.runtime?.resize();
  }

  resetDraft(){
    if(this.storageKey)localStorage.removeItem(this.storageKey);
  }

  exportWorld(){
    const world=this.getWorld();
    if(!world)return;
    world.meta={...(world.meta||{}),exportedFrom:"tabuada-quest-dev",schema:"tq.world",version:1};
    const blob=new Blob([JSON.stringify(world,null,2)],{type:"application/json"});
    const url=URL.createObjectURL(blob);
    const a=document.createElement("a");
    const id=(world.id||"world").replace(/[^a-z0-9._-]+/gi,"-");
    a.href=url;
    a.download=id+".world.json";
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(()=>URL.revokeObjectURL(url),0);
  }

  close({showScene=true}={}){
    if(this.runtime){
      this.persist();
      this.runtime.destroy();
    }
    this.runtime=null;
    this.host?.remove();
    this.host=null;
    this.active=false;
    this.suspended=false;
    if(showScene&&this.sceneRuntime?.stageHost)this.sceneRuntime.stageHost.style.display="";
    window.dispatchEvent(new CustomEvent("tq:worldclose"));
  }
}
