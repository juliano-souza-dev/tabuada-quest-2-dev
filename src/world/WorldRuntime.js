const __tqDevStamp=globalThis.__TQ_DEV_STAMP__||Date.now();
globalThis.__TQ_DEV_STAMP__=__tqDevStamp;
const [
  { GameAudio },
  { normalizeOceanConfig,applyOceanPreset,computeOceanFrame,cameraFollowStep },
  { WORLD_ENVIRONMENT_PRESETS,environmentPreset },
  { computeWorldWeatherCycle },
  { normalizeEntityMotion,applyEntityMotionPreset,computeEntityMotionFrame,defaultEntityMotion },
  { normalizeEntityEffect,applyEntityEffectPreset,computeEntityEffectFrame,listEntityEffectPresets },
  { EntityWebGLEffectRenderer },
  { resolveEntityPresentation },
  { normalizeJoystickVector,screenPointToWorld,targetNavigationVector },
  { directionForHeading,resolveDirectionalSource,directionalRegionStyle },
  { hasTimelineSpriteAnimation,timelineAnimationFrame,atlasFrameStyle },
  { OceanWebGLRenderer },
  { NavalCombatWebGLRenderer },
  { ShopOverlay },
  { ShipyardOverlay },
  { MobileHudOverlay },
  {
    normalizeCollision,
    inferCollisionAction,
    collisionMessage,
    collisionActionLabel,
    resolveCircleVsEntity,
    removeVelocityIntoNormal,
    contourVelocity
  }
]=await Promise.all([
  import("./GameAudio.js?v="+__tqDevStamp),
  import("./WorldOceanEffect.mjs?v="+__tqDevStamp),
  import("./WorldEnvironmentPresets.mjs?v="+__tqDevStamp),
  import("./WorldWeatherCycle.mjs?v="+__tqDevStamp),
  import("./WorldEntityMotion.mjs?v="+__tqDevStamp),
  import("./WorldEntityEffects.mjs?v="+__tqDevStamp),
  import("./EntityWebGLEffectRenderer.mjs?v="+__tqDevStamp),
  import("./WorldEntityPresentation.mjs?v="+__tqDevStamp),
  import("./WorldNavigationInput.mjs?v="+__tqDevStamp),
  import("./WorldDirectionalSprite.mjs?v="+__tqDevStamp),
  import("./WorldSpriteAnimation.mjs?v="+__tqDevStamp),
  import("./OceanWebGLRenderer.mjs?v="+__tqDevStamp),
  import("./NavalCombatWebGLRenderer.mjs?v="+__tqDevStamp),
  import("./ShopOverlay.js?v="+__tqDevStamp),
  import("./ShipyardOverlay.js?v="+__tqDevStamp),
  import("./MobileHudOverlay.js?v="+__tqDevStamp),
  import("./WorldCollision.mjs?v="+__tqDevStamp)
]);
const clamp=(value,min,max)=>Math.min(max,Math.max(min,value));
const shortestAngleDelta=(from,to)=>((((Number(to)||0)-(Number(from)||0)+540)%360)-180);
const lerpAngle=(from,to,t)=>(Number(from)||0)+shortestAngleDelta(from,to)*clamp(Number(t)||0,0,1);
const distance=(a,b)=>Math.hypot((a.x||0)-(b.x||0),(a.y||0)-(b.y||0));
const hashString=value=>{
  let hash=2166136261;
  for(const ch of String(value||"")){
    hash^=ch.charCodeAt(0);
    hash=Math.imul(hash,16777619);
  }
  return hash>>>0;
};
const createSeededRandom=seed=>{
  let state=(Number(seed)>>>0)||0x9e3779b9;
  return ()=>{
    state+=0x6D2B79F5;
    let t=state;
    t=Math.imul(t^(t>>>15),t|1);
    t^=t+Math.imul(t^(t>>>7),t|61);
    return ((t^(t>>>14))>>>0)/4294967296;
  };
};
const normalizeNpcPopulation=input=>{
  const value=input&&typeof input==="object"?input:{};
  const spread=value.spread&&typeof value.spread==="object"?value.spread:{};
  const movement=value.movement&&typeof value.movement==="object"?value.movement:{};
  const types=Array.isArray(value.types)?value.types:[];
  return {
    enabled:value.enabled===true,
    seed:Math.max(1,Math.floor(Number(value.seed)||1)),
    spread:{
      mode:["random","random-spaced"].includes(String(spread.mode))?String(spread.mode):"random-spaced",
      margin:clamp(Number(spread.margin??320),0,2000),
      minDistance:clamp(Number(spread.minDistance??360),0,1800)
    },
    movement:{
      mode:"straight",
      speed:clamp(Number(movement.speed??80),0,1200)
    },
    types:types.slice(0,12).map(item=>({
      npcId:String(item?.npcId||item?.shipId||""),
      shipId:String(item?.shipId||""),
      count:clamp(Math.floor(Number(item?.count)||0),0,50),
      enabled:item?.enabled!==false,
      unlockAfterMission:String(item?.unlockAfterMission||"").trim(),
      spawn:{
        mode:["random","random-spaced"].includes(String(item?.spawn?.mode))?String(item.spawn.mode):String(spread.mode||"random-spaced"),
        margin:clamp(Number(item?.spawn?.margin??spread.margin??320),0,2000),
        minDistance:clamp(Number(item?.spawn?.minDistance??spread.minDistance??360),0,1800),
        seed:Math.max(0,Math.floor(Number(item?.spawn?.seed)||0))
      },
      hp:clamp(Math.floor(Number(item?.hp)||3),1,500000000),
      respawn:item?.respawn===true,
      respawnDelaySec:clamp(Number(item?.respawnDelaySec??30),1,86400),
      devFrozen:item?.devFrozen===true,
      hitRewardGold:Math.max(0,Math.floor(Number(item?.hitRewardGold)||0)),
      rewards:item?.rewards&&typeof item.rewards==="object"?structuredClone(item.rewards):{},
      allowedAmmoIds:normalizeNpcAmmoIds(item?.allowedAmmoIds)
    })).filter(item=>(item.npcId||item.shipId)&&item.count>0)
  };
};
const normalizeTreasurePopulation=input=>{
  const value=input&&typeof input==="object"?input:{};
  const spread=value.spread&&typeof value.spread==="object"?value.spread:{};
  return {
    enabled:value.enabled===true,
    seed:Math.max(1,Math.floor(Number(value.seed)||1)),
    spread:{
      mode:["random","random-spaced"].includes(String(spread.mode))?String(spread.mode):"random-spaced",
      margin:clamp(Number(spread.margin??220),0,2000),
      minDistance:clamp(Number(spread.minDistance??180),0,1800)
    },
    types:(Array.isArray(value.types)?value.types:[]).slice(0,16).map(item=>({
      treasureId:String(item?.treasureId||""),
      count:clamp(Math.floor(Number(item?.count)||0),0,100),
      respawn:item?.respawn===true,
      spawnIntervalSec:clamp(Number(item?.spawnIntervalSec??5),0,3600),
      respawnDelaySec:clamp(Number(item?.respawnDelaySec??30),1,3600)
    })).filter(item=>item.treasureId&&item.count>0)
  };
};
const normalizeAmmoInventory=input=>{
  const value=input&&typeof input==="object"?input:{};
  const stock=value.stock&&typeof value.stock==="object"?value.stock:{};
  const normalizedStock={};
  for(const [ammoId,quantity] of Object.entries(stock)){
    const id=String(ammoId||"").trim();
    if(id)normalizedStock[id]=Math.max(0,Math.floor(Number(quantity)||0));
  }
  return {
    selectedAmmoId:String(value.selectedAmmoId||""),
    stock:normalizedStock
  };
};
const normalizeNpcAmmoIds=input=>{
  const values=Array.isArray(input)?input:[];
  return [...new Set(values.map(value=>String(value||"").trim()).filter(Boolean))];
};

const ammoDamageFactor=ammo=>clamp(Number(ammo?.damageFactor??1)||1,.1,2);
const cannonDamagePerShot=cannon=>Math.max(.1,Number(cannon?.damagePerShot)||1);
const navalShotDamage=(cannon,ammo)=>Math.round(cannonDamagePerShot(cannon)*ammoDamageFactor(ammo)*100)/100;

const resolvePlayerHullHp=(player,fallbackCombat={})=>{
  const combat=player?.combat&&typeof player.combat==="object"?player.combat:{};
  const modifiers=player?.combatModifiers&&typeof player.combatModifiers==="object"?player.combatModifiers:{};
  const base=clamp(Math.floor(Number(combat.hp??fallbackCombat?.playerHp)||50),50,500000000);
  const flat=clamp(Math.floor(Number(modifiers.maxHpFlat??modifiers.hpFlat)||0),-499999950,500000000);
  const pct=clamp(Number(modifiers.maxHpPct??modifiers.hpPct)||0,-.9,10);
  return clamp(Math.round(base*(1+pct)+flat),50,500000000);
};

const normalizePlayerWaterEffects=player=>{
  const fx=player?.effects||{};
  return {
    wakeActive:fx.wakeActive!==false,
    wakeScale:clamp(Number(fx.wakeScale??1),.35,2.5),
    wakeOpacity:clamp(Number(fx.wakeOpacity??.78),0,1),
    wakeWidth:clamp(Number(fx.wakeWidth??66),18,220),
    wakeLength:clamp(Number(fx.wakeLength??240),50,520),
    wakeRate:clamp(Number(fx.wakeRate??55),30,220),
    wakeMinSpeed:clamp(Number(fx.wakeMinSpeed??35),0,280),
    shadowActive:fx.shadowActive!==false,
    shadowOpacity:clamp(Number(fx.shadowOpacity??.34),0,.9),
    shadowBlur:clamp(Number(fx.shadowBlur??9),0,30),
    shadowOffset:clamp(Number(fx.shadowOffset??12),-40,80),
    shadowScaleX:clamp(Number(fx.shadowScaleX??.72),.25,1.5),
    shadowScaleY:clamp(Number(fx.shadowScaleY??.28),.12,1),
    idleBalanceActive:fx.idleBalanceActive!==false,
    idleBalanceMaxSpeed:clamp(Number(fx.idleBalanceMaxSpeed??8),0,80),
    idleRoll:clamp(Number(fx.idleRoll??2.4),0,12),
    idleHeave:clamp(Number(fx.idleHeave??3.2),0,24),
    idlePeriod:clamp(Number(fx.idlePeriod??3600),800,8000)
  };
};

export class WorldRuntime {
  constructor(root,config,options={}){
    this.root=root;
    this.config=structuredClone(config);
    this.playerDisplayName=String(options.playerName||this.config.player?.name||"Jogador").trim()||"Jogador";
    this.config.ocean=normalizeOceanConfig(this.config.ocean||{});
    this.editorEnabled=options.editorEnabled===true;
    this.audio=new GameAudio(options.soundCatalog||{sounds:[]});
    this.graphicsSettings={
      clouds:options.graphicsSettings?.clouds!==false,
      oceanWaves:options.graphicsSettings?.oceanWaves!==false,
      reducedAmmoFx:options.graphicsSettings?.reducedAmmoFx===true
    };
    this.onGraphicsSettingsChange=typeof options.onGraphicsSettingsChange==="function"?options.onGraphicsSettingsChange:null;
    this.depthMaskEditId=null;
    this.mode=this.editorEnabled?"edit":"play";
    this.environmentCycleStartedAt=performance.now();
    this.environmentCycleSignature="";
    this.onEnterScene=options.onEnterScene||null;
    this.onEnterWorld=options.onEnterWorld||null;
    this.canEnterWorld=typeof options.canEnterWorld==="function"?options.canEnterWorld:()=>true;
    this.onSelectionChange=options.onSelectionChange||null;
    this.onEntityChange=options.onEntityChange||null;
    this.createPedagogyChallenge=typeof options.createPedagogyChallenge==="function"?options.createPedagogyChallenge:null;
    this.onPedagogyResult=typeof options.onPedagogyResult==="function"?options.onPedagogyResult:null;
    this.onTreasureCollected=typeof options.onTreasureCollected==="function"?options.onTreasureCollected:null;
    this.onCombatVictory=typeof options.onCombatVictory==="function"?options.onCombatVictory:null;
    this.onBossDefeated=typeof options.onBossDefeated==="function"?options.onBossDefeated:null;
    this.onRewardCollected=typeof options.onRewardCollected==="function"?options.onRewardCollected:null;
    this.onExecuteAction=typeof options.onExecuteAction==="function"?options.onExecuteAction:null;
    this.resolveShip=typeof options.resolveShip==="function"?options.resolveShip:null;
    this.resolveNpc=typeof options.resolveNpc==="function"?options.resolveNpc:null;
    this.resolveTreasure=typeof options.resolveTreasure==="function"?options.resolveTreasure:null;
    this.getMissionProgress=typeof options.getMissionProgress==="function"?options.getMissionProgress:()=>({});
    this.getTutorialGuide=typeof options.getTutorialGuide==="function"?options.getTutorialGuide:()=>null;
    this.onTutorialAttack=typeof options.onTutorialAttack==="function"?options.onTutorialAttack:()=>{};
    this.onTutorialNpcDestroyed=typeof options.onTutorialNpcDestroyed==="function"?options.onTutorialNpcDestroyed:()=>{};
    this.isMissionComplete=typeof options.isMissionComplete==="function"?options.isMissionComplete:()=>false;
    this.canUseShop=typeof options.canUseShop==="function"?options.canUseShop:()=>true;
    this.canRepairPlayer=typeof options.canRepairPlayer==="function"?options.canRepairPlayer:()=>true;
    this.shouldForceRepair=typeof options.shouldForceRepair==="function"?options.shouldForceRepair:()=>false;
    this.onRepairCompleted=typeof options.onRepairCompleted==="function"?options.onRepairCompleted:null;
    this.canSelectAmmo=typeof options.canSelectAmmo==="function"?options.canSelectAmmo:()=>true;
    this.canAttackEntity=typeof options.canAttackEntity==="function"?options.canAttackEntity:()=>true;
    this.attackLockMessage=typeof options.attackLockMessage==="function"?options.attackLockMessage:()=>"Alvo bloqueado.";
    this.shopBalances=typeof options.shopBalances==="function"?options.shopBalances:()=>({gold:0,rubies:0});
    this.onShopPurchase=typeof options.onShopPurchase==="function"?options.onShopPurchase:null;
    this.getConsumableQuantity=typeof options.getConsumableQuantity==="function"?options.getConsumableQuantity:()=>0;
    this.onConsumeItem=typeof options.onConsumeItem==="function"?options.onConsumeItem:null;
    this.onRuntimeStateChange=typeof options.onRuntimeStateChange==="function"?options.onRuntimeStateChange:null;
    this.getShipyardState=typeof options.getShipyardState==="function"?options.getShipyardState:null;
    this.onEquipShip=typeof options.onEquipShip==="function"?options.onEquipShip:null;
    this.onEquipCannon=typeof options.onEquipCannon==="function"?options.onEquipCannon:null;
    this.onRemoveCannon=typeof options.onRemoveCannon==="function"?options.onRemoveCannon:null;
    this.shipCatalog=Array.isArray(options.shipCatalog)?structuredClone(options.shipCatalog):[];
    this.contextGuideTarget=null;
    this.shopOverlay=new ShopOverlay({
      ammoCatalog:Array.isArray(options.ammoCatalog)?options.ammoCatalog:[],
      cannonCatalog:Array.isArray(options.cannonCatalog)?options.cannonCatalog:[],
      shipCatalog:this.shipCatalog,
      getBalances:()=>this.shopBalances(),
      onPurchase:request=>this.onShopPurchase?.(request),
      canOpen:()=>this.canUseShop()===true,
      getTutorialStage:()=>String(this.getTutorialGuide?.()?.stage||""),
      onLocked:()=>this.showGameplayToast("🔒 A loja será liberada após derrotar o Corsário da Tabuada Sombria.",2200)
    });
    this.shipyardOverlay=new ShipyardOverlay({
      getState:()=>this.getShipyardState?.()||{},
      onEquipShip:async id=>this.syncShipyardAction(this.onEquipShip,id),
      onEquipCannon:async id=>this.syncShipyardAction(this.onEquipCannon,id),
      onRemoveCannon:async (cannonId,shipId)=>this.syncShipyardAction(this.onRemoveCannon,cannonId,shipId)
    });
    const regionNumber=Math.max(1,Number(this.config.region)||Number(String(this.config.id||"").match(/^r(\d+)/i)?.[1])||1);
    this.mobileHud=new MobileHudOverlay({
      missions:Array.isArray(options.missionCatalog)?options.missionCatalog:[],
      region:regionNumber,
      onMissionsOpen:()=>options.onMissionsOpen?.(),
      getState:()=>{
        const target=this.combatTarget&&this.isClickableCombatShip(this.combatTarget)?this.combatTarget:null;
        const targetInRange=Boolean(target&&this.isNavalTargetInRange(target));
        const targetHp=target?this.navalHpState(target):{current:0,max:1};
        const ammo=(Array.isArray(this.ammoCatalog)?this.ammoCatalog:[]).map(item=>{
          const id=String(item?.id||"");
          return {
            id,
            name:String(item?.name||id),
            image:String(item?.effects?.texture||""),
            quantity:Math.max(0,Number(this.state?.ammo?.stock?.[id])||0),
            selected:String(this.state?.ammo?.selectedAmmoId||"")===id
          };
        }).filter(item=>item.id&&item.quantity>0);
        const balances=this.shopBalances?.()||{};
        const minimapPoints=[
          {x:Number(this.player.x)||0,y:Number(this.player.y)||0,player:true},
          ...this.entities
            .filter(entity=>String(entity?.type||"")==="ship"&&!this.collected.has(entity.id)&&!this.navalDestroying.has(String(entity.id||""))&&entity?.el?.hidden!==true)
            .slice(0,40)
            .map(entity=>({
              x:Number(entity.visualX??entity.x)||0,
              y:Number(entity.visualY??entity.y)||0,
              hostile:Boolean(this.navalHostile.has(String(entity.id||""))||entity.boss===true)
            }))
        ];
        const halloweenHud=Boolean(
          String(this.config.event||"").toLowerCase()==="halloween"
          ||String(this.config.meta?.event||"").toLowerCase()==="halloween"
          ||this.config.meta?.halloween===true
          ||this.config.region?.halloween===true
          ||this.config.environment?.halloween?.active===true
          ||String(this.config.environment?.preset||"").toLowerCase().includes("halloween")
          ||String(this.config.player?.src||"").toLowerCase().includes("halloween")
        );
        return {
          hudTheme:halloweenHud?"halloween":"standard",
          gold:Math.max(0,Number(balances.gold)||0),
          rubies:Math.max(0,Number(balances.rubies)||0),
          level:Math.max(1,regionNumber),
          minimap:{
            bounds:{width:Number(this.config.width)||1,height:Number(this.config.height)||1},
            points:minimapPoints
          },
          attacking:this.navalAutoFire===true,
          hasCannons:Array.isArray(this.playerCannonIds)&&this.playerCannonIds.length>0,
          hasAmmo:this.hasPlayerAmmo(),
          graphicsSettings:structuredClone(this.graphicsSettings),
          cameraDetached:this.playCameraDetached===true,
          cameraRecenterRemainingMs:this.playCameraDetached&&this.playCameraRecenterAt>0
            ?Math.max(0,this.playCameraRecenterAt-performance.now())
            :0,
          repairAvailable:this.canRepairPlayer({hp:this.navalPlayerHp,maxHp:this.navalPlayerMaxHp})===true&&!this.isPlayerInNavalCombat(),
          missionProgress:this.getMissionProgress()||{},
          tutorialGuide:(()=>{
            const guide=this.getTutorialGuide?.()||null;
            if(!guide)return null;
            const stage=String(guide.stage||"");
            if(stage==="attack-ship"||stage==="attack-ship-2"){
              const locked=this.entities.find(entity=>entity.tutorialCombatTarget&&!this.collected.has(entity.id)&&!this.navalDestroying.has(entity.id))||null;
              const phase=String(locked?.tutorialCombatPhase||"follow");
              if(phase==="ready-fire")return {...guide,title:"Ataque!",text:"Toque em Atirar para abrir fogo contra o corsário."};
              if(phase==="firing")return {...guide,title:"Mantenha o ataque",text:"Continue atacando. Quando ele fugir, vá atrás dele."};
              if(phase==="chase")return {...guide,title:"Ele está fugindo!",text:"Siga a seta e alcance o corsário para terminar o combate."};
              return {...guide,title:"Encontre o alvo",text:"Siga a seta até entrar na área de combate do corsário."};
            }
            return guide;
          })(),
          playerHp:Number(this.navalPlayerHp||0),
          playerMaxHp:Number(this.navalPlayerMaxHp||0),
          hullReinforcementQuantity:this.getConsumableQuantity("hull-reinforcement"),
          hullReinforcementActive:Boolean(this.hullReinforcement?.hp>0&&Date.now()<this.hullReinforcement.expiresAt),
          target:{
            visible:targetInRange,
            name:target?String(target.label||target.shipName||target.name||"Navio inimigo"):"",
            hp:Number(targetHp.current||0),
            maxHp:Number(targetHp.max||1)
          },
          ammo
        };
      },
      onAttack:()=>{
        if(!Array.isArray(this.playerCannonIds)||this.playerCannonIds.length===0){
          this.contextGuideTarget="shipyard";
          this.showGameplayToast("⚓ Você precisa de canhões. Siga a seta até o Arsenal Naval.",2600);
          this.updateTutorialGuideArrow();
          return false;
        }
        this.contextGuideTarget=null;
        const stage=String(this.getTutorialGuide?.()?.stage||"");
        if(stage==="missions-hunt"){
          const target=this.combatTarget&&this.combatTarget.tutorialMissionCorsair===true
            ?this.combatTarget
            :this.nearestCombatTarget();
          if(target){
            if(this.combatTarget!==target)this.selectCombatTarget(target,{preserveMovement:true});
            if(!this.isNavalTargetInRange(target)){
              this.showGameplayToast("🏴‍☠️ Aproxime-se mais do corsário para disparar.",1800);
              return false;
            }
          }
        }
        return this.activateNearby();
      },
      onCancel:()=>this.stopNavalAutoFire({keepTarget:true,message:"Ataque cancelado."}),
      onFollow:()=>this.toggleCombatFollow(),
      onCenterCamera:()=>{
        this.playCameraDetached=false;
        this.playCameraRecenterAt=0;
        this.playCameraOffset.x=0;
        this.playCameraOffset.y=0;
        if(this.recenterButton)this.recenterButton.hidden=true;
        this.updateCamera(true);
        return true;
      },
      onUseHullReinforcement:()=>this.useHullReinforcement(),
      onRepair:()=>{
        if(this.canRepairPlayer({hp:this.navalPlayerHp,maxHp:this.navalPlayerMaxHp})!==true){this.showGameplayToast("🔒 Conserto ainda bloqueado.",1600);return false;}
        return this.beginPlayerRepair({forced:false});
      },
      onSelectAmmo:ammoId=>this.selectPlayerAmmo(ammoId),
      onShop:()=>{
        if(this.canUseShop()!==true){this.showGameplayToast("🔒 A loja será liberada após derrotar o Corsário da Tabuada Sombria.",2200);return false;}
        this.shopOverlay?.open?.();return true;
      },
      onShipyard:()=>{this.shipyardOverlay?.open?.();return true;},
      onGraphicsSettingsChange:settings=>this.applyGraphicsSettings(settings,{persist:true})
    });

    // Ship behavior is global. A map stores which ship is selected, but the
    // current catalog profile wins over stale copies of speed/physics/combat.
    const configuredPlayerShipId=String(this.config.player?.shipId||"");
    if(configuredPlayerShipId&&this.resolveShip){
      try{
        const profile=this.resolveShip(configuredPlayerShipId,"player");
        if(profile&&typeof profile==="object"){
          this.config.player={
            ...(this.config.player||{}),
            ...structuredClone(profile),
            shipId:configuredPlayerShipId,
            combatModifiers:structuredClone(this.config.player?.combatModifiers||{})
          };
        }
      }catch(error){
        console.warn("[TabuadaQuest] Player ship resolve failed",configuredPlayerShipId,error);
      }
    }

    this.config.npcPopulation=normalizeNpcPopulation(this.config.npcPopulation||{});
    this.config.treasurePopulation=normalizeTreasurePopulation(this.config.treasurePopulation||{});
    this.generatedTreasureIds=new Set();
    this.generatedNpcIds=new Set();
    this.challengeActive=null;
    this.challengeTimer=0;
    this.repairActive=null;
    this.combatActive=null;
    this.endPedagogyProtection();
    this.combatTimer=0;
    this.combatSpriteTimers={player:0,enemy:0};
    this.combatFxTimer=0;
    this.state=structuredClone(options.state||{});
    const savedHullReinforcement=this.state.hullReinforcement&&typeof this.state.hullReinforcement==="object"
      ?this.state.hullReinforcement
      :null;
    this.hullReinforcement=savedHullReinforcement
      &&Number(savedHullReinforcement.hp)>0
      &&Number(savedHullReinforcement.expiresAt)>Date.now()
      ?{
        hp:Math.max(0,Number(savedHullReinforcement.hp)||0),
        expiresAt:Number(savedHullReinforcement.expiresAt)||0
      }
      :{hp:0,expiresAt:0};
    this.state.ammo=normalizeAmmoInventory(this.state.ammo||{});
    this.ammoCatalog=Array.isArray(options.ammoCatalog)?structuredClone(options.ammoCatalog):[];
    this.testAmmoUnlimited=false;
    const initialTestAmmoQuantity=Math.max(0,Math.floor(Number(options.testAmmoQuantity)||0));
    if(Number.isFinite(Number(options.testAmmoQuantity))){
      const initialAmmoId=String(options.testAmmoId||this.state.ammo.selectedAmmoId||this.ammoCatalog?.[0]?.id||"");
      this.state.ammo.stock[initialAmmoId]=initialTestAmmoQuantity;
    }
    const initialAllTestAmmoQuantity=Math.max(0,Math.floor(Number(options.initialAllTestAmmoQuantity)||0));
    if(Number.isFinite(Number(options.initialAllTestAmmoQuantity))){
      for(const ammo of this.ammoCatalog){
        const ammoId=String(ammo?.id||"").trim();
        if(ammoId&&ammo?.available!==false)this.state.ammo.stock[ammoId]=initialAllTestAmmoQuantity;
      }
    }
    this.cannonCatalog=Array.isArray(options.cannonCatalog)?structuredClone(options.cannonCatalog):[];
    this.onStarterCannonEarned=typeof options.onStarterCannonEarned==="function"?options.onStarterCannonEarned:null;
    this.onStarterAmmoEarned=typeof options.onStarterAmmoEarned==="function"?options.onStarterAmmoEarned:null;
    this.onAmmoChange=typeof options.onAmmoChange==="function"?options.onAmmoChange:null;
    const defaultCannonId=String(this.cannonCatalog[0]?.id||"");
    const productionCannonIds=Array.isArray(options.playerCannonIds)?options.playerCannonIds.map(String):null;
    const requestedCannonIds=productionCannonIds||(
      Array.isArray(options.testCannonIds)?options.testCannonIds.map(String):[defaultCannonId]
    );
    const validatedCannonIds=requestedCannonIds.filter(id=>this.cannonCatalog.some(item=>String(item?.id||"")===id));
    this.playerCannonIds=validatedCannonIds;
    const requestedTestAmmoId=String(options.testAmmoId||"").trim();
    if(requestedTestAmmoId&&this.ammoCatalog.some(item=>String(item?.id||"")===requestedTestAmmoId))this.state.ammo.selectedAmmoId=requestedTestAmmoId;
    this.player={
      x:Number(this.state.player?.x??config.player?.x??config.width/2),
      y:Number(this.state.player?.y??config.player?.y??config.height/2),
      rotation:Number(this.state.player?.rotation??0),
      direction:String(this.state.player?.direction??config.player?.direction??"n"),
      vx:0,vy:0
    };
    this.camera={
      x:Number(config.editor?.cameraX??this.player.x),
      y:Number(config.editor?.cameraY??this.player.y)
    };
    this.zoom=Number(config.editor?.zoom??0.58);
    this.globalCameraLocked=Number.isFinite(Number(options.globalCamera?.playZoom));
    this.playZoom=clamp(Number(options.globalCamera?.playZoom??config.camera?.playZoom??0.4841),.30,1.4);
    this.combatCameraZoom=this.playZoom;
    this.playerAuthorityCorrection=null;
    this.playCameraOffset={x:0,y:0};
    this.playCameraDetached=false;
    this.playCameraRecenterAt=0;
    this.suppressNavigationClick=false;
    this.playerIdleBalanceMix=0;
    this.playerIdleVisual={roll:0,heave:0};
    this.editorPreviewActive=false;
    this.editorPreviewAnchor=null;
    this.editorPreviewStartedAt=0;
    this.collected=new Set(this.state.collected||[]);
    this.keys=new Set();
    this.cameraKeys=new Set();
    this.pointerDirections=new Set();
    this.joystick={x:0,y:0,active:false,pointerId:null};
    this.navigationTarget=null;
    this.treasureTarget=null;
    this.treasureReady=null;
    this.pedagogyInvulnerableUntil=0;
    this.entityEffectRenderers=new Map();
    this.entityEffectOrigins=new Map();
    this.entityById=new Map();
    this.entities=(config.entities||[]).map((entity,index)=>{
      const normalized={
        ...structuredClone(entity),
        rotation:Number(entity.rotation||0),
        skewX:Number(entity.skewX||0),
        skewY:Number(entity.skewY||0),
        index,
        anchorX:Number(entity.x??0),
        anchorY:Number(entity.y??0),
        el:null
      };
      normalized.effect=normalizeEntityEffect(normalized.effect||{},normalized);
      if(String(normalized.type||"")==="ship"){
        normalized.combat={
          ...(normalized.combat&&typeof normalized.combat==="object"?structuredClone(normalized.combat):{}),
          hp:clamp(Math.floor(Number(normalized.combat?.hp)||3),1,500000000),
          attackRange:clamp(Number(normalized.combat?.attackRange??1200),200,6000),
          attackCooldownMs:clamp(Number(normalized.combat?.attackCooldownMs??900),300,5000),
          damage:clamp(Math.floor(Number(normalized.combat?.damage)||1),1,20)
        };
        normalized.collision=normalizeCollision({
          ...(normalized.collision||{}),
          action:"none"
        },normalized);
      }else{
        normalized.collision=normalizeCollision(normalized.collision||{},normalized);
      }
      normalized.visualX=Number(normalized.x||0);
      normalized.visualY=Number(normalized.y||0);
      normalized.visualRotation=Number(normalized.rotation||0);
      return normalized;
    });
    this.rebuildNpcPopulation({render:false});
    this.rebuildTreasurePopulation({render:false});
    this.rebuildEntityIndex();
    this.selectedId=null;
    this.lastTime=0;
    this.raf=0;
    this.nearby=null;
    this.contactEntity=null;
    this.combatTarget=null;
    this.navalAutoFire=false;
    this.navalNextShotAt=0;
    this.treasureCombatLockUntil=0;
    this.treasureCombatWasBlocking=false;
    this.navalAttackRange=clamp(Number(config.combat?.attackRange??1200),200,6000);
    this.navalAttackCooldown=clamp(Number(config.combat?.attackCooldownMs??900),300,5000);
    this.navalHp=new Map();
    this.navalHostile=new Map();
    const restoredNpcHp=this.state?.navalNpcHp&&typeof this.state.navalNpcHp==="object"?this.state.navalNpcHp:{};
    for(const entity of this.entities){
      if(String(entity?.type||"")!=="ship"||!entity?.id)continue;
      const id=String(entity.id);
      const max=Math.max(1,Math.min(500000000,Number(entity.combat?.hp)||3));
      const saved=Number(restoredNpcHp[id]);
      this.navalHp.set(id,Number.isFinite(saved)?clamp(saved,0,max):max);
    }
    this.navalPlayerMaxHp=resolvePlayerHullHp(this.config.player,this.config.combat||{});
    this.navalPlayerHp=clamp(
      Math.floor(Number(this.state.navalPlayerHp??this.navalPlayerMaxHp)||this.navalPlayerMaxHp),
      0,
      this.navalPlayerMaxHp
    );
    this.navalDestroying=new Set();
    this.navalDestroyTimers=new Map();
    this.damageNumberElements=new Set();
    this.regionTransitionActive=null;
    this.regionExitDismissedId=null;
    this.collisionAvoidance={entityId:null,side:0,until:0};
    this.lastWakeSpawn=0;
    this.lastWakeSample=0;
    this.wakeParticleCount=0;
    this.wakeSamples=[];
    this.minimapLastRender=0;
    this.cleanups=[];
  }


  rebuildEntityIndex(){
    if(!(this.entityById instanceof Map))this.entityById=new Map();
    this.entityById.clear();
    for(const entity of this.entities||[]){
      if(entity?.id)this.entityById.set(String(entity.id),entity);
    }
    return this.entityById;
  }

  entityByIdGet(id){
    const key=String(id||"");
    if(!key)return null;
    return this.entityById?.get(key)||null;
  }

  treasureSpawnPoint(random,occupied,population){
    const area=this.getPlayableBounds();
    const margin=Math.max(0,Number(population.spread.margin)||0);
    const left=Math.min(area.right,area.left+margin),right=Math.max(left,area.right-margin);
    const top=Math.min(area.bottom,area.top+margin),bottom=Math.max(top,area.bottom-margin);
    const minDistance=Math.max(0,Number(population.spread.minDistance)||0);
    let fallback={x:(left+right)/2,y:(top+bottom)/2};
    for(let attempt=0;attempt<80;attempt++){
      const point={x:left+(right-left)*random(),y:top+(bottom-top)*random()};fallback=point;
      if(population.spread.mode!=="random-spaced"||!occupied.some(other=>distance(point,other)<minDistance))return point;
    }
    return fallback;
  }

  createGeneratedTreasure({typeConfig,index,population,random,occupied}){
    const profile=this.resolveTreasure?.(typeConfig.treasureId);
    if(!profile)return null;
    const point=this.treasureSpawnPoint(random,occupied,population);occupied.push(point);
    const entity={
      id:"treasure.auto."+String(typeConfig.treasureId).replace(/[^a-z0-9._-]+/gi,"-")+"."+(index+1),
      type:"treasure",label:String(profile.name||typeConfig.treasureId),src:String(profile.asset||""),
      width:Math.max(24,Number(profile.width)||88),height:Math.max(24,Number(profile.height)||88),
      x:point.x,y:point.y,z:18,rotation:0,lockAspect:true,runtimeGenerated:true,runtimeTreasure:true,
      treasureId:String(typeConfig.treasureId),treasureRewards:structuredClone(profile.rewards||{}),
      treasureRespawn:typeConfig.respawn===true,treasureRespawnDelayMs:Math.max(1000,Number(typeConfig.respawnDelaySec||30)*1000),
      treasureSpawnAt:performance.now()+Math.max(0,Number(typeConfig.spawnIntervalSec)||0)*1000*(index+1),
      treasurePending:true,treasureRespawnAt:0,
      motion:normalizeEntityMotion(profile.behavior?.motion||{active:true,preset:"calm",speed:38,heave:24,pitch:20,roll:10,sway:8},"treasure"),
      effect:{category:"treasure",preset:"none"},
      collision:{active:false,shape:"ellipse",scaleX:.72,scaleY:.72,padding:0,action:"none",message:""}
    };
    entity.index=this.entities.length;entity.anchorX=entity.x;entity.anchorY=entity.y;entity.visualX=entity.x;entity.visualY=entity.y;entity.visualRotation=0;entity.skewX=0;entity.skewY=0;
    entity.effect=normalizeEntityEffect(entity.effect||{},entity);entity.collision=normalizeCollision(entity.collision||{},entity);return entity;
  }

  rebuildTreasurePopulation({render=true}={}){
    if(!this.entities)return;
    this.entities=this.entities.filter(entity=>!entity.runtimeTreasure);this.generatedTreasureIds.clear();
    const population=normalizeTreasurePopulation(this.config.treasurePopulation||{});this.config.treasurePopulation=population;
    if(population.enabled&&population.types.length&&this.resolveTreasure){
      const random=createSeededRandom(hashString((this.config.id||"world")+".treasure")^population.seed);
      const occupied=[{x:Number(this.player?.x??this.config.player?.x??this.config.width/2),y:Number(this.player?.y??this.config.player?.y??this.config.height/2)},...this.entities.map(e=>({x:Number(e.x)||0,y:Number(e.y)||0}))];
      let total=0;
      for(const typeConfig of population.types){
        for(let i=0;i<typeConfig.count&&total<240;i++,total++){
          const entity=this.createGeneratedTreasure({typeConfig,index:total,population,random,occupied});
          if(entity){
            // Never resurrect a non-respawning treasure already collected in persisted world state.
            // Recreating it with the same deterministic id made it visible again while the reward
            // claim correctly stayed blocked, which looked like "treasure gives no reward".
            if(typeConfig.respawn===true)this.collected.delete(entity.id);
            this.entities.push(entity);
            this.generatedTreasureIds.add(entity.id);
          }
        }
      }
    }
    this.entities.forEach((e,i)=>e.index=i);
    this.rebuildEntityIndex();
    if(render&&this.entityLayer)this.renderEntities();
  }

  rollTreasureRewards(entity){
    const source=entity?.treasureRewards||{};
    const result={gold:0,rubies:0,ammoRewards:[]};
    const roll=(key)=>{
      const rule=source[key]&&typeof source[key]==="object"?source[key]:{};
      const chance=clamp(Number(rule.chance)||0,0,100);
      if(Math.random()*100>=chance)return 0;
      const min=Math.max(0,Math.floor(Number(rule.min)||0)),max=Math.max(min,Math.floor(Number(rule.max)||min));
      return min+Math.floor(Math.random()*(max-min+1));
    };
    result.gold=roll("gold");
    result.rubies=roll("rubies");
    for(const rule of Array.isArray(source.ammo)?source.ammo:[]){
      const chance=clamp(Number(rule?.chance)||0,0,100);
      if(Math.random()*100>=chance)continue;
      const min=Math.max(0,Math.floor(Number(rule?.min)||0));
      const max=Math.max(min,Math.floor(Number(rule?.max)||min));
      const quantity=min+Math.floor(Math.random()*(max-min+1));
      const id=String(rule?.id||rule?.ammoId||"").trim();
      if(id&&quantity>0)result.ammoRewards.push({id,quantity});
    }
    return result;
  }

  updateTreasurePopulation(time=performance.now()){
    const population=this.config.treasurePopulation;
    if(!population?.enabled)return;
    for(const entity of this.entities){
      if(!entity?.runtimeTreasure)continue;

      const respawnDue=Number(entity.treasureRespawnAt)>0&&Number(time)>=Number(entity.treasureRespawnAt);
      if(this.collected.has(entity.id)&&!respawnDue){
        if(entity.el)entity.el.hidden=true;
        continue;
      }

      if(entity.treasurePending&&Number(time)>=Number(entity.treasureSpawnAt||0)){
        entity.treasurePending=false;
        entity.collision=normalizeCollision({
          ...entity.collision,
          active:false,
          action:"none",
          padding:0
        },entity);
        if(entity.el)entity.el.hidden=false;
        this.applyEntityVisual(entity);
      }

      if(entity.treasureRespawnAt>0&&Number(time)>=Number(entity.treasureRespawnAt)){
        const occupied=this.entities
          .filter(e=>e!==entity&&!this.collected.has(e.id)&&!e.treasurePending)
          .map(e=>({x:Number(e.x)||0,y:Number(e.y)||0}));
        occupied.push({x:Number(this.player.x)||0,y:Number(this.player.y)||0});

        const random=createSeededRandom(hashString(entity.id+".treasure."+Math.floor(time)));
        const point=this.treasureSpawnPoint(random,occupied,population);
        entity.x=point.x;
        entity.y=point.y;
        entity.anchorX=point.x;
        entity.anchorY=point.y;
        entity.visualX=point.x;
        entity.visualY=point.y;
        entity.treasureRespawnAt=0;
        entity.treasurePending=false;
        this.collected.delete(entity.id);
        entity.collision=normalizeCollision({
          ...entity.collision,
          active:false,
          action:"none",
          padding:0
        },entity);
        if(entity.el)entity.el.hidden=false;
        this.applyEntityVisual(entity);
      }

      if(entity.treasurePending&&entity.el)entity.el.hidden=true;
    }
  }

  treasureCollectionRadius(entity){
    const playerRadius=this.playerCollisionRadius();
    const treasureRadius=Math.max(
      24,
      Math.max(Number(entity?.width)||88,Number(entity?.height)||88)*.48
    );
    return playerRadius+treasureRadius+18;
  }

  treasureCollectionCandidate(){
    if(this.mode!=="play"||this.challengeActive||this.regionTransitionActive)return null;
    let nearest=null;
    let nearestDistance=Infinity;
    for(const entity of this.entities){
      if(String(entity?.type||"")!=="treasure")continue;
      if(this.collected.has(entity.id)||entity.treasurePending||Number(entity.treasureRespawnAt)>0)continue;
      const x=Number(entity.visualX??entity.x);
      const y=Number(entity.visualY??entity.y);
      if(!Number.isFinite(x)||!Number.isFinite(y))continue;
      const d=Math.hypot(x-(Number(this.player.x)||0),y-(Number(this.player.y)||0));
      if(d>this.treasureCollectionRadius(entity)||d>=nearestDistance)continue;
      nearest=entity;
      nearestDistance=d;
    }
    return nearest;
  }

  treasureCombatLocked(){
    const target=this.combatTarget;
    const targetId=String(target?.id||"");
    const targetAlive=Boolean(target&&targetId&&!this.collected.has(targetId)&&!this.navalDestroying.has(targetId));
    const targetInSight=Boolean(targetAlive&&this.isClickableCombatShip(target)&&this.isNavalTargetInRange(target));
    const tutorialStage=String(this.getTutorialGuide?.()?.stage||"");
    const blocking=this.navalAutoFire===true||(tutorialStage!=="collect-10"&&targetInSight);
    if(blocking){
      this.treasureCombatWasBlocking=true;
      return true;
    }
    if(this.treasureCombatWasBlocking){
      this.treasureCombatWasBlocking=false;
      const cooldown=String(this.getTutorialGuide?.()?.stage||"")==="collect-10"?2000:20000;
      this.treasureCombatLockUntil=Math.max(Number(this.treasureCombatLockUntil)||0,Date.now()+cooldown);
    }
    return Date.now()<Number(this.treasureCombatLockUntil||0);
  }

  updateTreasureCollection(){
    const entity=this.treasureCollectionCandidate();
    this.treasureReady=entity||null;
    if(!entity)return false;

    // Treasure collection is automatic only while the player is not in naval
    // combat. A nearby treasure never interrupts an active fight.
    if(this.treasureCombatLocked())return false;

    this.treasureReady=null;
    this.treasureTarget=null;
    this.stopNavalAutoFire({keepTarget:false});
    this.clearCombatTarget({hideAction:true});
    this.clearNavigationTarget({brake:true});
    this.beginTreasureChallenge(entity);
    return true;
  }

  pedagogyProtectionActive(){
    return Boolean(this.challengeActive||this.combatActive||this.repairActive||Date.now()<Number(this.pedagogyInvulnerableUntil||0));
  }

  beginPedagogyProtection(){
    this.pedagogyInvulnerableUntil=Number.MAX_SAFE_INTEGER;
    return true;
  }

  endPedagogyProtection(){
    const until=Date.now()+15000;
    this.pedagogyInvulnerableUntil=until;
    return until;
  }

  npcShipProfile(shipId){
    if(!shipId||!this.resolveShip)return null;
    try{
      const profile=this.resolveShip(String(shipId),"npc");
      return profile&&typeof profile==="object"?structuredClone(profile):null;
    }catch(error){
      console.warn("[TabuadaQuest] NPC ship resolve failed",shipId,error);
      return null;
    }
  }

  npcSpawnPoint(random,occupied,population){
    const area=this.getPlayableBounds();
    const margin=Math.max(0,Number(population.spread.margin)||0);
    const left=Math.min(area.right,area.left+margin);
    const right=Math.max(left,area.right-margin);
    const top=Math.min(area.bottom,area.top+margin);
    const bottom=Math.max(top,area.bottom-margin);
    const minDistance=Math.max(0,Number(population.spread.minDistance)||0);
    const spaced=population.spread.mode==="random-spaced";
    let fallback={x:(left+right)/2,y:(top+bottom)/2};

    for(let attempt=0;attempt<80;attempt++){
      const point={
        x:left+(right-left)*random(),
        y:top+(bottom-top)*random()
      };
      fallback=point;
      if(!spaced||!occupied.some(other=>distance(point,other)<minDistance))return point;
    }
    return fallback;
  }

  createGeneratedNpc({shipId,index,typeConfig,population,random,occupied}){
    const npcId=String(typeConfig?.npcId||"");
    const npcProfile=npcId&&this.resolveNpc?this.resolveNpc(npcId):null;
    const backingShipId=String(npcProfile?.shipId||typeConfig?.shipId||shipId||"");
    const shipProfile=backingShipId?this.npcShipProfile(backingShipId):null;
    if(!shipProfile){
      console.warn("[TabuadaQuest] NPC generation skipped: unresolved ship profile",{npcId,shipId:backingShipId});
      return null;
    }
    const profile={
      ...shipProfile,
      ...(npcProfile&&typeof npcProfile==="object"?structuredClone(npcProfile):{}),
      sprite:shipProfile.sprite?structuredClone(shipProfile.sprite):null,
      src:String(shipProfile.src||shipProfile.sprite?.src||""),
      entityKind:String(npcProfile?.entityKind||shipProfile.entityKind||"ship"),
      spriteAnimationMode:String(npcProfile?.spriteAnimationMode||shipProfile.spriteAnimationMode||""),
      animations:npcProfile?.animations&&typeof npcProfile.animations==="object"
        ?structuredClone(npcProfile.animations)
        :(shipProfile.animations&&typeof shipProfile.animations==="object"?structuredClone(shipProfile.animations):{}),
      motion:npcProfile?.motion&&typeof npcProfile.motion==="object"
        ?structuredClone(npcProfile.motion)
        :(shipProfile.motion&&typeof shipProfile.motion==="object"?structuredClone(shipProfile.motion):null),
      width:Number(npcProfile?.width??shipProfile.width)||180,
      height:Number(npcProfile?.height??shipProfile.height)||180,
      combat:{
        ...(shipProfile.combat&&typeof shipProfile.combat==="object"?structuredClone(shipProfile.combat):{}),
        ...(npcProfile?.combat&&typeof npcProfile.combat==="object"?structuredClone(npcProfile.combat):{})
      },
      navigation:{
        ...(shipProfile.navigation&&typeof shipProfile.navigation==="object"?structuredClone(shipProfile.navigation):{}),
        ...(npcProfile?.navigation&&typeof npcProfile.navigation==="object"?structuredClone(npcProfile.navigation):{})
      }
    };
    let point;
    const nearMin=Math.max(0,Number(typeConfig?.spawn?.nearPlayerMin)||0);
    const nearMax=Math.max(nearMin,Number(typeConfig?.spawn?.nearPlayerMax)||0);
    if(nearMax>0&&this.player){
      const area=this.getPlayableBounds();
      const angle=random()*Math.PI*2;
      const radius=nearMin+(nearMax-nearMin)*random();
      point={
        x:clamp((Number(this.player.x)||0)+Math.cos(angle)*radius,area.left+180,area.right-180),
        y:clamp((Number(this.player.y)||0)+Math.sin(angle)*radius,area.top+180,area.bottom-180)
      };
      for(let attempt=0;attempt<24&&occupied.some(other=>distance(point,other)<Math.max(220,Number(population.spread.minDistance)||0));attempt++){
        const a=random()*Math.PI*2;
        const r=nearMin+(nearMax-nearMin)*random();
        point={
          x:clamp((Number(this.player.x)||0)+Math.cos(a)*r,area.left+180,area.right-180),
          y:clamp((Number(this.player.y)||0)+Math.sin(a)*r,area.top+180,area.bottom-180)
        };
      }
    }else{
      point=this.npcSpawnPoint(random,occupied,population);
    }
    occupied.push(point);
    const heading=random()*360-180;
    const sprite=profile.sprite&&typeof profile.sprite==="object"?structuredClone(profile.sprite):null;
    const src=String(profile.src||sprite?.src||"");
    const entity={
      id:"npc.auto."+String(npcId||backingShipId||shipId).replace(/[^a-z0-9._-]+/gi,"-")+"."+(index+1),
      type:"ship",
      role:"npc",
      shipId:backingShipId,
      npcId,
      shipName:String(shipProfile.shipName||shipProfile.name||backingShipId),
      label:String(npcProfile?.name||shipProfile.shipName||shipProfile.name||backingShipId),
      src,
      sprite,
      entityKind:String(profile.entityKind||"ship"),
      spriteAnimationMode:String(profile.spriteAnimationMode||""),
      animations:profile.animations&&typeof profile.animations==="object"?structuredClone(profile.animations):{},
      width:Math.max(32,Number(profile.width)||180),
      height:Math.max(32,Number(profile.height)||180),
      x:point.x,
      y:point.y,
      z:22,
      rotation:heading,
      direction:directionForHeading(heading,null,{hysteresis:0}),
      lockAspect:true,
      runtimeGenerated:true,
      respawn:typeConfig?.respawn===true,
      respawnDelayMs:Math.max(1000,Number(typeConfig?.respawnDelaySec??30)*1000),
      boss:profile.boss===true||profile.coopBoss===true||profile.combat?.boss===true,
      coopBoss:profile.coopBoss===true||profile.boss===true||profile.combat?.boss===true,
      coopBossId:String(profile.coopBossId||npcId||""),
      rewardShipId:String(profile.rewardShipId||typeConfig?.rewardShipId||""),
      bossSpawnCycle:1,
      npcSpawnCycle:1,
      devFrozen:this.editorEnabled===true&&typeConfig?.devFrozen===true,
      hitRewardGold:Math.max(0,Math.floor(Number(typeConfig?.hitRewardGold)||0)),
      rewards:typeConfig?.rewards&&typeof typeConfig.rewards==="object"?structuredClone(typeConfig.rewards):{},
      npcAttitude:String(profile.npcAttitude||profile.combat?.attitude||"retaliate"),
      npcBehavior:String(profile.navigation?.behavior||profile.npcBehavior||"roam"),
      npcNavigation:{
        mode:String(profile.navigation?.behavior||profile.npcBehavior||"roam")==="stationary"?"stationary":"sailing",
        minSpeed:String(profile.navigation?.behavior||profile.npcBehavior||"roam")==="stationary"?0:Math.max(0,Number(profile.navigation?.minSpeed??profile.minSpeed)||0),
        speed:String(profile.navigation?.behavior||profile.npcBehavior||"roam")==="stationary"?0:Math.max(0,Number(profile.navigation?.speed??profile.speed??population.movement.speed)||0),
        acceleration:String(profile.navigation?.behavior||profile.npcBehavior||"roam")==="stationary"?0:Math.max(0,Math.min(3000,Number(profile.navigation?.acceleration??profile.acceleration??((Math.max(0,Number(profile.navigation?.speed??profile.speed??population.movement.speed)||0))*3.1))||0)),
        braking:clamp(Number(profile.navigation?.braking??this.config.player?.braking??.12),.01,.98),
        heading,
        targetHeading:heading,
        vx:0,
        vy:0,
        elapsed:0,
        courseCycle:0,
        nextCourseChange:3.5+random()*4.5
      },
      combatSprite:profile.combatSprite?structuredClone(profile.combatSprite):null,
      combatVisual:profile.combatVisual?structuredClone(profile.combatVisual):(profile.combat?structuredClone(profile.combat):null),
      combat:{
        hp:clamp(Math.floor(Number(profile.combat?.hp??typeConfig.hp)||3),1,500000000),
        attackRange:clamp(Number(profile.combat?.attackRange??profile.combatVisual?.attackRange??1200),200,6000),
        attackCooldownMs:clamp(Number(profile.combat?.attackCooldownMs??profile.combatVisual?.attackCooldownMs??900),300,5000),
        damage:clamp(Math.floor(Number(profile.combat?.damage??profile.combatVisual?.damage)||1),1,200),
        maxTargets:clamp(Math.floor(Number(profile.combat?.maxTargets)||1),1,2),
        rewardMinDamageRatio:clamp(Number(profile.combat?.rewardMinDamageRatio)||0,0,1),
        cannonLoadout:Array.isArray(profile.combat?.cannonLoadout)?structuredClone(profile.combat.cannonLoadout):[],
        ammoId:String(profile.combat?.ammoId||""),
        ammoUnlimited:profile.combat?.ammoUnlimited===true,
        fixedDamagePerShot:Math.max(0,Number(profile.combat?.fixedDamagePerShot)||0),
        requiredAmmoEvent:String(typeConfig?.requiredAmmoEvent||profile.combat?.requiredAmmoEvent||"")
      },
      motion:normalizeEntityMotion(
        profile.motion&&typeof profile.motion==="object"
          ?profile.motion
          :{active:true,preset:"navigation",speed:45,heave:26,pitch:18,roll:10,sway:8},
        "ship"
      ),
      effect:{category:"ship",preset:"none",active:false},
      collision:{
        active:true,
        shape:"ellipse",
        scaleX:.46,
        scaleY:.60,
        padding:8,
        action:"none",
        message:""
      }
    };

    entity.index=this.entities.length;
    entity.anchorX=entity.x;
    entity.anchorY=entity.y;
    entity.visualX=entity.x;
    entity.visualY=entity.y;
    entity.visualRotation=entity.rotation;
    entity.skewX=0;
    entity.skewY=0;
    entity.effect=normalizeEntityEffect(entity.effect||{},entity);
    entity.collision=normalizeCollision(entity.collision||{},entity);
    return entity;
  }

  spawnTutorialCorsairForSecondDuel(){
    if(String(this.getTutorialGuide?.()?.stage||"")!=="attack-ship-2")return null;
    const live=this.entities.find(entity=>this.isClickableCombatShip(entity)&&entity.tutorialDefeated!==true&&!this.collected.has(entity.id)&&!this.navalDestroying.has(entity.id));
    if(live)return live;
    const defeated=this.entities.find(entity=>String(entity?.type||"")==="ship"&&entity.tutorialDefeated===true)||null;
    const population=normalizeNpcPopulation(this.config.npcPopulation||{});
    const typeConfig=population.types.find(type=>type.enabled!==false)||null;
    if(!typeConfig)return null;
    const occupied=this.entities.filter(entity=>!this.collected.has(entity.id)&&!this.navalDestroying.has(entity.id)).map(entity=>({x:Number(entity.x)||0,y:Number(entity.y)||0}));
    occupied.push({x:Number(this.player?.x)||0,y:Number(this.player?.y)||0});
    const random=createSeededRandom(hashString(String(this.config.id||"world")+".tutorial-second-corsair."+Date.now()));
    const tutorialType={...typeConfig,respawn:false,spawn:{...(typeConfig.spawn||{}),nearPlayerMin:650,nearPlayerMax:1000}};
    const entity=this.createGeneratedNpc({shipId:tutorialType.shipId||tutorialType.npcId,index:this.entities.length,typeConfig:tutorialType,population,random,occupied});
    if(!entity)return null;
    entity.id="npc.tutorial.corsair.second."+Date.now().toString(36);
    entity.tutorialSecondCorsair=true;
    entity.tutorialCombatTarget=false;
    entity.tutorialCombatPhase="";
    entity.tutorialDefeated=false;
    entity.index=this.entities.length;
    this.entities.push(entity);
    this.generatedNpcIds.add(entity.id);
    this.entityById?.set(String(entity.id),entity);
    this.navalHp.set(String(entity.id),Math.max(1,Math.min(500000000,Number(entity.combat?.hp)||3)));
    this.renderEntities();
    return entity;
  }

  restoreTutorialCorsairMissionFleet(){
    if(String(this.getTutorialGuide?.()?.stage||"")!=="missions-hunt")return [];
    const progress=this.getMissionProgress?.()||{};
    const defeated=Math.max(0,Math.min(5,Math.floor(Number(progress.R1_TUTORIAL_CORSARIOS_5)||0)));
    const requiredIds=Array.from({length:5-defeated},(_,offset)=>"npc.tutorial.mission.corsair."+(defeated+offset+1));
    const liveById=new Map(this.entities
      .filter(entity=>entity?.tutorialMissionCorsair===true&&!this.collected.has(entity.id)&&!this.navalDestroying.has(entity.id))
      .map(entity=>[String(entity.id),entity]));
    const missing=requiredIds.filter(id=>!liveById.has(id));
    if(missing.length)this.spawnTutorialCorsairMissionFleet(missing);
    const targets=requiredIds.map(id=>this.entityById?.get(id)||this.entities.find(entity=>String(entity?.id||"")===id)).filter(Boolean);
    for(const entity of targets){
      entity.tutorialCombatTarget=true;
      entity.tutorialCombatPhase="hunt";
    }
    this.syncAutomaticCombatTarget();
    this.updateTutorialGuideArrow();
    return targets;
  }

  spawnTutorialCorsairMissionFleet(slots=5){
    if(String(this.getTutorialGuide?.()?.stage||"")!=="missions-hunt")return [];
    const progress=this.getMissionProgress?.()||{};
    const defeated=Math.max(0,Math.min(5,Math.floor(Number(progress.R1_TUTORIAL_CORSARIOS_5)||0)));
    const ids=Array.isArray(slots)
      ?slots.map(String)
      :Array.from({length:Math.max(0,5-defeated)},(_,offset)=>"npc.tutorial.mission.corsair."+(defeated+offset+1));
    const population=normalizeNpcPopulation(this.config.npcPopulation||{});
    const typeConfig=population.types.find(type=>type.enabled!==false)||null;
    if(!typeConfig)return [];
    const occupied=this.entities.filter(entity=>!this.collected.has(entity.id)&&!this.navalDestroying.has(entity.id)).map(entity=>({x:Number(entity.x)||0,y:Number(entity.y)||0}));
    occupied.push({x:Number(this.player?.x)||0,y:Number(this.player?.y)||0});
    const spawned=[];
    for(const id of ids){
      const existing=this.entityById?.get(id)||this.entities.find(entity=>String(entity?.id||"")===id);
      if(existing&&!this.collected.has(id)&&!this.navalDestroying.has(id)){spawned.push(existing);continue;}
      if(this.collected.has(id))continue;
      const random=createSeededRandom(hashString(String(this.config.id||"world")+"."+id));
      const missionType={...typeConfig,respawn:false,spawn:{...(typeConfig.spawn||{}),nearPlayerMin:700,nearPlayerMax:1500}};
      const entity=this.createGeneratedNpc({shipId:missionType.shipId||missionType.npcId,index:this.entities.length,typeConfig:missionType,population,random,occupied});
      if(!entity)continue;
      entity.id=id;
      entity.npcId=String(entity.npcId||missionType.npcId||missionType.shipId||"tutorial-corsair");
      entity.tutorialMissionCorsair=true;
      entity.tutorialCombatTarget=true;
      entity.tutorialCombatPhase="hunt";
      entity.tutorialDefeated=false;
      entity.index=this.entities.length;
      this.entities.push(entity);
      this.generatedNpcIds.add(id);
      this.entityById?.set(id,entity);
      this.navalHp.set(id,Math.max(1,Math.min(500000000,Number(entity.combat?.hp)||3)));
      occupied.push({x:Number(entity.x)||0,y:Number(entity.y)||0});
      spawned.push(entity);
    }
    this.renderEntities();
    return spawned;
  }

  rebuildNpcPopulation({render=true}={}){
    if(!this.entities)return;
    // NPC refresh must never remove runtime treasures. Both NPCs and treasures
    // are runtimeGenerated, so filtering only by runtimeGenerated erased every
    // treasure when a mission completion rebuilt the NPC population.
    for(const entity of this.entities){
      const runtimeNpc=entity?.runtimeGenerated===true&&entity?.runtimeTreasure!==true&&String(entity?.type||"")==="ship";
      if(runtimeNpc&&entity.id)this.navalHp?.delete(String(entity.id));
    }
    this.entities=this.entities.filter(entity=>{
      const runtimeNpc=entity?.runtimeGenerated===true&&entity?.runtimeTreasure!==true&&String(entity?.type||"")==="ship";
      return !runtimeNpc;
    });
    this.generatedNpcIds.clear();

    const population=normalizeNpcPopulation(this.config.npcPopulation||{});
    this.config.npcPopulation=population;
    if(population.enabled&&population.types.length&&this.resolveShip){
      const random=createSeededRandom(hashString(this.config.id||"world")^population.seed);
      const occupied=[
        {x:Number(this.player?.x??this.config.player?.x??this.config.width/2),y:Number(this.player?.y??this.config.player?.y??this.config.height/2)},
        ...this.entities.map(entity=>({x:Number(entity.x)||0,y:Number(entity.y)||0}))
      ];
      let total=0;
      for(const typeConfig of population.types){
        if(typeConfig.enabled===false)continue;
        if(typeConfig.unlockAfterMission&&!this.isMissionComplete(typeConfig.unlockAfterMission))continue;
        const typePopulation={...population,spread:{...population.spread,...(typeConfig.spawn||{})}};
        const typeRandom=typeConfig.spawn?.seed>0?createSeededRandom(hashString(this.config.id||"world")^Number(typeConfig.spawn.seed)):random;
        for(let index=0;index<typeConfig.count&&total<80;index++,total++){
          const entity=this.createGeneratedNpc({
            shipId:typeConfig.shipId||typeConfig.npcId,
            index:total,
            typeConfig,
            population:typePopulation,
            random:typeRandom,
            occupied
          });
          if(!entity)continue;
          entity.index=this.entities.length;
          this.entities.push(entity);
          this.generatedNpcIds.add(entity.id);
        }
      }
    }

    this.entities.forEach((entity,index)=>entity.index=index);
    this.rebuildEntityIndex();
    if(render&&this.entityLayer)this.renderEntities();
  }

  updateNpcNavigation(entity,dt){
    if(this.mode!=="play"||!entity?.runtimeGenerated||this.navalDestroying.has(entity.id))return;
    const nav=entity.npcNavigation;
    const tutorialAttack=["attack-ship","attack-ship-2"].includes(String(this.getTutorialGuide?.()?.stage||""));
    const tutorialHold=tutorialAttack&&entity.tutorialCombatTarget===true&&entity.tutorialCombatPhase!=="chase";
    if(entity.devFrozen||entity.bossCombatStopped===true||tutorialHold){
      if(nav){
        nav.vx=0;
        nav.vy=0;
        nav.targetHeading=Number(entity.rotation)||Number(nav.heading)||0;
      }
      entity.anchorX=entity.x;
      entity.anchorY=entity.y;
      return;
    }
    if(!nav)return;
    const maxSpeed=Math.max(0,Number(nav.speed)||0);
    if(entity.npcBehavior==="stationary"||nav.mode==="stationary"||maxSpeed<=0){
      nav.vx=0;
      nav.vy=0;
      entity.anchorX=entity.x;
      entity.anchorY=entity.y;
      return;
    }

    const safeDt=clamp(Number(dt)||1/60,.001,.08);
    nav.elapsed=Math.max(0,Number(nav.elapsed)||0)+safeDt;
    nav.courseCycle=Math.max(0,Math.floor(Number(nav.courseCycle)||0));

    const area=this.getPlayableBounds();
    const halfW=Math.max(8,Number(entity.width)||96)/2;
    const halfH=Math.max(8,Number(entity.height)||96)/2;
    const left=area.left+halfW,right=area.right-halfW,top=area.top+halfH,bottom=area.bottom-halfH;
    const edgeMargin=Math.max(90,Math.min(320,maxSpeed*2.1));

    const nearEdge=
      entity.x<=left+edgeMargin||entity.x>=right-edgeMargin
      ||entity.y<=top+edgeMargin||entity.y>=bottom-edgeMargin;

    if(nearEdge){
      const centerX=(left+right)/2;
      const centerY=(top+bottom)/2;
      nav.targetHeading=Math.atan2(centerY-entity.y,centerX-entity.x)*180/Math.PI+90;
      nav.nextCourseChange=Math.max(Number(nav.nextCourseChange)||0,nav.elapsed+2.5);
    }else if(nav.elapsed>=(Number(nav.nextCourseChange)||0)){
      nav.courseCycle+=1;
      const seeded=createSeededRandom(hashString(entity.id+"."+nav.courseCycle));
      const current=Number(nav.targetHeading??nav.heading??entity.rotation)||0;
      nav.targetHeading=current+(seeded()-.5)*110;
      nav.nextCourseChange=nav.elapsed+3.5+seeded()*5.5;
    }

    const targetHeading=Number(nav.targetHeading??nav.heading??entity.rotation)||0;
    const targetRad=targetHeading*Math.PI/180;
    const desiredX=Math.sin(targetRad);
    const desiredY=-Math.cos(targetRad);
    const accel=Math.max(100,Number(nav.acceleration)||1100);
    const minSpeed=clamp(Number(nav.minSpeed)||0,0,maxSpeed);
    // Match NPC/boss damping to the player's ship physics. Previously NPCs
    // defaulted to .22 while the player uses .12, making bosses retain much
    // more velocity and visibly outrun an equally configured player ship.
    const braking=clamp(Number(nav.braking??this.config.player?.braking??.12),.01,.98);
    const drag=Math.pow(braking,safeDt);

    nav.vx=((Number(nav.vx)||0)+desiredX*accel*safeDt)*drag;
    nav.vy=((Number(nav.vy)||0)+desiredY*accel*safeDt)*drag;

    let actualSpeed=Math.hypot(nav.vx,nav.vy);
    if(actualSpeed>0&&actualSpeed<minSpeed){
      const scale=minSpeed/actualSpeed;
      nav.vx*=scale;
      nav.vy*=scale;
      actualSpeed=minSpeed;
    }
    if(actualSpeed>maxSpeed){
      const scale=maxSpeed/actualSpeed;
      nav.vx*=scale;
      nav.vy*=scale;
      actualSpeed=maxSpeed;
    }

    let nextX=entity.x+nav.vx*safeDt;
    let nextY=entity.y+nav.vy*safeDt;
    if(nextX<left||nextX>right){
      nextX=clamp(nextX,left,right);
      nav.vx*=-.28;
      nav.targetHeading=Math.atan2((top+bottom)/2-nextY,(left+right)/2-nextX)*180/Math.PI+90;
    }
    if(nextY<top||nextY>bottom){
      nextY=clamp(nextY,top,bottom);
      nav.vy*=-.28;
      nav.targetHeading=Math.atan2((top+bottom)/2-nextY,(left+right)/2-nextX)*180/Math.PI+90;
    }

    // NPC ships use the same collision primitives as the player. Islands are
    // treated as navigation obstacles, and the resulting velocity follows the
    // island contour instead of allowing the ship to pass through the land.
    const npcRadius=clamp(
      Math.min(Number(entity.width)||96,Number(entity.height)||96)*.23,
      12,
      180
    );
    const now=performance.now();
    for(let pass=0;pass<4;pass++){
      let collided=false;
      for(const obstacle of this.entities){
        if(!obstacle||obstacle===entity||this.collected.has(obstacle.id))continue;
        const obstacleType=String(obstacle.type||"");
        const obstacleCategory=String(obstacle.effect?.category||"");
        const islandObstacle=obstacleType==="island"
          ||obstacleCategory==="island"
          ||(obstacleType==="location"&&Boolean(obstacle.scene));
        if(!islandObstacle)continue;

        obstacle.collision=normalizeCollision(obstacle.collision||{},obstacle);
        if(!obstacle.collision.active)continue;

        const hit=resolveCircleVsEntity(
          {x:nextX,y:nextY},
          npcRadius,
          obstacle,
          obstacle.collision
        );
        if(!hit.collided)continue;

        collided=true;
        nextX=hit.x;
        nextY=hit.y;

        const cleaned=removeVelocityIntoNormal(
          {x:nav.vx,y:nav.vy},
          hit.normalX,
          hit.normalY
        );
        const remembered=nav.avoidEntityId===obstacle.id&&Number(nav.avoidUntil)>now
          ?Number(nav.avoidSide)||0
          :0;
        const contour=contourVelocity(
          cleaned,
          hit.normalX,
          hit.normalY,
          {x:desiredX,y:desiredY},
          {
            side:remembered,
            minSpeed:Math.max(28,minSpeed||maxSpeed*.42),
            maxSpeed:Math.max(45,maxSpeed),
            strength:.88
          }
        );
        nav.vx=contour.x;
        nav.vy=contour.y;
        nav.avoidEntityId=obstacle.id;
        nav.avoidSide=contour.side;
        nav.avoidUntil=now+1250;
        nav.targetHeading=Math.atan2(nav.vy,nav.vx)*180/Math.PI+90;
        nav.nextCourseChange=Math.max(Number(nav.nextCourseChange)||0,nav.elapsed+1.8);
      }
      if(!collided)break;
    }

    entity.x=clamp(nextX,left,right);
    entity.y=clamp(nextY,top,bottom);
    actualSpeed=Math.hypot(nav.vx,nav.vy);
    if(actualSpeed>4){
      entity.rotation=Math.atan2(nav.vy,nav.vx)*180/Math.PI+90;
      nav.heading=entity.rotation;
    }
    entity.direction=directionForHeading(entity.rotation,entity.direction,{hysteresis:4});
    entity.anchorX=entity.x;
    entity.anchorY=entity.y;
  }

  applyEntityTimelineVisual(entity,time=performance.now()){
    const el=entity?.el;
    if(!el||!hasTimelineSpriteAnimation(entity))return false;
    const spriteEl=el.querySelector(".tq-world-entity__timeline-sprite");
    const frame=timelineAnimationFrame(entity,time,(Number(entity.index)||0)*37);
    const style=frame?atlasFrameStyle(entity.sprite,frame.frame):null;
    if(!spriteEl||!frame||!style)return false;

    Object.assign(spriteEl.style,style);
    el.dataset.renderMode="atlas";
    el.dataset.animationName=frame.name;
    el.dataset.animationFrame=String(frame.frame);
    el.style.backgroundImage="";
    el.style.backgroundSize="";
    el.style.backgroundPosition="";
    el.style.backgroundRepeat="";
    el.style.clipPath="";
    el.style.webkitClipPath="";

    const img=el.querySelector(":scope > img:not(.tq-world-island-depth-layer)");
    if(img)img.hidden=true;
    return true;
  }

  applyEntityDirectionalVisual(entity){
    const el=entity?.el;
    if(!el)return false;
    const sprite=entity.sprite;
    const img=el.querySelector("img");
    if(!sprite?.src||!sprite?.regions){
      el.dataset.direction="";
      if(el.dataset.renderMode==="atlas")el.dataset.renderMode="sprite";
      el.style.backgroundImage="";
      el.style.backgroundSize="";
      el.style.backgroundPosition="";
      el.style.backgroundRepeat="";
      el.style.clipPath="";
      el.style.webkitClipPath="";
      if(img)img.hidden=false;
      return false;
    }
    entity.direction=directionForHeading(Number(entity.rotation)||0,entity.direction,{hysteresis:2});
    const style=directionalRegionStyle(sprite,entity.direction);
    if(!style)return false;
    Object.assign(el.style,style);
    el.dataset.direction=entity.direction;
    el.dataset.renderMode="atlas";
    if(img)img.hidden=true;
    return true;
  }

  mount(){
    this.root.innerHTML="";
    this.root.classList.add("tq-world-test-active");

    this.host=document.createElement("main");
    this.host.className="tq-world-host";
    this.host.innerHTML=`
      <div class="tq-world-viewport">
        <canvas class="tq-world-ocean-webgl" data-world-ocean-webgl aria-hidden="true"></canvas>
        <div class="tq-world-ocean-stack" aria-hidden="true">
          <div class="tq-world-ocean-layer tq-world-ocean-layer--deep" data-ocean-layer="deep"></div>
          <div class="tq-world-ocean-layer tq-world-ocean-layer--wave" data-ocean-layer="wave"></div>
          <div class="tq-world-ocean-layer tq-world-ocean-layer--foam" data-ocean-layer="foam"></div>
        </div>
        <div class="tq-world-clouds" data-world-clouds aria-hidden="true"></div>
        <div class="tq-world-weather" data-world-weather aria-hidden="true"></div>
        <div class="tq-world-stage">
          <div class="tq-world-playable-boundary" data-world-playable-boundary aria-hidden="true"></div>
          <div class="tq-world-player-wake-layer" data-world-player-wake aria-hidden="true"></div>
          <div class="tq-world-player-shadow" data-world-player-shadow aria-hidden="true"></div>
          <div class="tq-world-entities"></div>
          <div class="tq-world-nav-target" hidden aria-hidden="true"></div>
          <div class="tq-world-player" role="img" aria-label="Navio do jogador"></div>
          <span class="tq-world-player-name" data-world-player-name aria-hidden="true"></span>
        </div>
        <canvas class="tq-world-naval-webgl" data-world-naval-webgl aria-hidden="true"></canvas>
      </div>
      <section class="tq-world-hud">
        <strong data-world-mode></strong>
        <span data-world-name></span>
        <span data-world-coords></span>
        <span data-world-progress></span>
        <span data-world-direction></span>
        <span data-world-zoom></span>
      </section>
      <aside class="tq-world-minimap" data-world-minimap aria-label="Minimapa">
        <canvas data-world-minimap-canvas aria-hidden="true"></canvas>
        <img class="tq-world-minimap__frame" data-world-minimap-frame alt="" aria-hidden="true">
        <span class="tq-world-minimap__north" aria-hidden="true">N</span>
      </aside>
      <div class="tq-world-action" hidden>
        <div class="tq-world-action__surface">
          <span class="tq-world-action__message" data-world-action-message></span>
          <button type="button" data-world-action></button>
        </div>
      </div>
      <div class="tq-world-region-transition" data-world-region-transition hidden>
        <section class="tq-world-region-transition__card" role="dialog" aria-modal="true" aria-labelledby="tq-world-region-transition-title">
          <small>LIMITE DA REGIÃO</small>
          <h2 id="tq-world-region-transition-title">Navegar para outro mar?</h2>
          <p data-world-region-transition-message></p>
          <div class="tq-world-region-transition__actions">
            <button type="button" data-world-region-transition-cancel>Continuar nesta região</button>
            <button type="button" class="is-primary" data-world-region-transition-confirm>Navegar</button>
          </div>
        </section>
      </div>
      <div class="tq-world-gameplay-toast" data-world-gameplay-toast role="status" aria-live="polite" hidden></div>
      <div class="tq-world-challenge" data-world-challenge hidden>
        <section class="tq-world-challenge__card" role="dialog" aria-modal="true" aria-labelledby="tq-world-challenge-title">
          <button type="button" class="tq-world-challenge__close" data-world-challenge-close aria-label="Fechar desafio">×</button>
          <small data-world-challenge-kicker>BAÚ DO TESOURO</small>
          <h2 id="tq-world-challenge-title" data-world-challenge-title>Resolva para recolher</h2>
          <strong class="tq-world-challenge__prompt" data-world-challenge-prompt></strong>
          <div class="tq-world-repair-hp" data-world-repair-hp hidden><div class="tq-world-repair-hp__track"><span data-world-repair-hp-fill></span></div><b data-world-repair-hp-label></b></div>
          <div class="tq-world-combat__options" data-world-repair-options aria-label="Escolha a resposta"></div>
          <p class="tq-world-challenge__feedback" data-world-challenge-feedback aria-live="polite"></p>
        </section>
      </div>
      <div class="tq-world-combat" data-world-combat hidden>
        <section class="tq-world-combat__card" role="dialog" aria-modal="true" aria-labelledby="tq-world-combat-title">
          <button type="button" class="tq-world-combat__close" data-world-combat-close aria-label="Sair do combate">×</button>
          <small>DUELO NAVAL</small>
          <h2 id="tq-world-combat-title" data-world-combat-title>Navio inimigo</h2>
          <div class="tq-world-combat__arena tq-world-combat__arena--day" data-world-combat-arena>
            <div class="tq-world-combat__ship tq-world-combat__ship--player" data-world-combat-player-ship></div>
            <div class="tq-world-combat__trajectory" aria-hidden="true">
              <span class="tq-world-combat__shot" data-world-combat-shot></span>
              <span class="tq-world-combat__splash" data-world-combat-splash>💦</span>
              <span class="tq-world-combat__hit" data-world-combat-hit>💥</span>
            </div>
            <div class="tq-world-combat__ship tq-world-combat__ship--enemy" data-world-combat-enemy-ship></div>
          </div>
          <div class="tq-world-combat__hp">
            <span>Você <b data-world-combat-player-hp>❤❤❤</b></span>
            <span>Inimigo <b data-world-combat-enemy-hp>❤❤❤</b></span>
          </div>
          <strong class="tq-world-combat__prompt" data-world-combat-prompt></strong>
          <div class="tq-world-combat__options" data-world-combat-options aria-label="Escolha a resposta"></div>
          <p class="tq-world-combat__feedback" data-world-combat-feedback aria-live="polite"></p>
        </section>
      </div>
      <div class="tq-world-controls" aria-label="Controles de navegação">
        <div class="tq-world-joystick" data-world-joystick aria-label="Joystick analógico">
          <div class="tq-world-joystick__base">
            <div class="tq-world-joystick__thumb" data-world-joystick-thumb></div>
          </div>
        </div>
        <button type="button" class="tq-world-recenter" data-world-recenter hidden aria-label="Centralizar câmera no navio">🎯 Navio</button>
      </div>`;

    this.root.append(this.host);
    // Mount the production HUD in every runtime. In DEV it stays hidden while
    // editing and becomes identical to production as soon as mode === "play".
    this.shopOverlay?.mount?.(this.host);
    this.shipyardOverlay?.mount?.(this.host);
    this.mobileHud?.mount?.(this.host);
    this.viewport=this.host.querySelector(".tq-world-viewport");
    this.oceanCanvas=this.host.querySelector("[data-world-ocean-webgl]");
    this.oceanRenderer=null;
    this.oceanRendererInit=null;
    this.navalCanvas=this.host.querySelector("[data-world-naval-webgl]");
    this.navalRenderer=new NavalCombatWebGLRenderer(this.navalCanvas);
    this.navalRenderer.init();
    this.stage=this.host.querySelector(".tq-world-stage");
    this.cloudsEl=this.host.querySelector("[data-world-clouds]");
    this.weatherEl=this.host.querySelector("[data-world-weather]");
    this.playableBoundaryEl=this.host.querySelector("[data-world-playable-boundary]");
    this.entityLayer=this.host.querySelector(".tq-world-entities");
    this.tutorialArrowEl=null;
    this.playerWakeLayer=this.host.querySelector("[data-world-player-wake]");
    this.playerShadowEl=this.host.querySelector("[data-world-player-shadow]");
    this.playerEl=this.host.querySelector(".tq-world-player");
    this.playerNameEl=this.host.querySelector("[data-world-player-name]");
    if(this.playerNameEl)this.playerNameEl.textContent=this.playerDisplayName;
    this.navTargetEl=this.host.querySelector(".tq-world-nav-target");
    this.joystickEl=this.host.querySelector("[data-world-joystick]");
    this.joystickThumbEl=this.host.querySelector("[data-world-joystick-thumb]");
    this.recenterButton=this.host.querySelector("[data-world-recenter]");
    this.coordsEl=this.host.querySelector("[data-world-coords]");
    this.progressEl=this.host.querySelector("[data-world-progress]");
    this.directionEl=this.host.querySelector("[data-world-direction]");
    this.zoomEl=this.host.querySelector("[data-world-zoom]");
    this.modeEl=this.host.querySelector("[data-world-mode]");
    this.nameEl=this.host.querySelector("[data-world-name]");
    if(!this.editorEnabled){
      const telemetry=this.host.querySelector(".tq-world-hud");
      if(telemetry){
        telemetry.hidden=true;
        telemetry.style.display="none";
        telemetry.setAttribute("aria-hidden","true");
        telemetry.style.pointerEvents="none";
      }
    }
    this.actionWrap=this.host.querySelector(".tq-world-action");
    this.actionMessage=this.host.querySelector("[data-world-action-message]");
    this.actionButton=this.host.querySelector("[data-world-action]");
    this.regionTransitionWrap=this.host.querySelector("[data-world-region-transition]");
    this.regionTransitionMessage=this.host.querySelector("[data-world-region-transition-message]");
    this.regionTransitionCancel=this.host.querySelector("[data-world-region-transition-cancel]");
    this.regionTransitionConfirm=this.host.querySelector("[data-world-region-transition-confirm]");
    this.minimapEl=this.host.querySelector("[data-world-minimap]");
    this.minimapCanvas=this.host.querySelector("[data-world-minimap-canvas]");
    this.minimapFrameEl=this.host.querySelector("[data-world-minimap-frame]");
    this.minimapCtx=this.minimapCanvas?.getContext?.("2d")||null;
    this.gameplayToast=this.host.querySelector("[data-world-gameplay-toast]");
    this.gameplayToastTimer=0;
    this.challengeWrap=this.host.querySelector("[data-world-challenge]");
    this.challengeKicker=this.host.querySelector("[data-world-challenge-kicker]");
    this.challengeTitle=this.host.querySelector("[data-world-challenge-title]");
    this.challengeForm=this.host.querySelector("[data-world-challenge-form]");
    this.challengePrompt=this.host.querySelector("[data-world-challenge-prompt]");
    this.challengeAnswer=this.host.querySelector("[data-world-challenge-answer]");
    this.challengeFeedback=this.host.querySelector("[data-world-challenge-feedback]");
    this.challengeSubmit=this.host.querySelector("[data-world-challenge-submit]");
    this.challengeClose=this.host.querySelector("[data-world-challenge-close]");
    this.repairOptions=this.host.querySelector("[data-world-repair-options]");
    this.repairHp=this.host.querySelector("[data-world-repair-hp]");
    this.repairHpFill=this.host.querySelector("[data-world-repair-hp-fill]");
    this.repairHpLabel=this.host.querySelector("[data-world-repair-hp-label]");
    this.combatWrap=this.host.querySelector("[data-world-combat]");
    this.combatArena=this.host.querySelector("[data-world-combat-arena]");
    this.combatOptions=this.host.querySelector("[data-world-combat-options]");
    this.combatFeedback=this.host.querySelector("[data-world-combat-feedback]");
    this.combatPrompt=this.host.querySelector("[data-world-combat-prompt]");
    this.combatTitle=this.host.querySelector("[data-world-combat-title]");
    this.combatClose=this.host.querySelector("[data-world-combat-close]");
    this.combatPlayerHp=this.host.querySelector("[data-world-combat-player-hp]");
    this.combatEnemyHp=this.host.querySelector("[data-world-combat-enemy-hp]");
    this.combatPlayerShip=this.host.querySelector("[data-world-combat-player-ship]");
    this.combatEnemyShip=this.host.querySelector("[data-world-combat-enemy-ship]");
    this.combatShot=this.host.querySelector("[data-world-combat-shot]");
    this.combatSplash=this.host.querySelector("[data-world-combat-splash]");
    this.combatHit=this.host.querySelector("[data-world-combat-hit]");
    this.oceanEls={
      deep:this.host.querySelector('[data-ocean-layer="deep"]'),
      wave:this.host.querySelector('[data-ocean-layer="wave"]'),
      foam:this.host.querySelector('[data-ocean-layer="foam"]')
    };

    this.stage.style.width=this.config.width+"px";
    this.stage.style.height=this.config.height+"px";
    this.applyPlayableAreaVisual();
    this.applyOceanStatic();
    this.initOceanRenderer();
    this.applyEnvironmentVisual();
    this.applyGraphicsSettings(this.graphicsSettings,{persist:false});
    this.playerEl.style.backgroundRepeat="no-repeat";
    if(this.config.player?.width)this.playerEl.style.width=Math.max(24,Number(this.config.player.width)||108)+"px";
    if(this.config.player?.height)this.playerEl.style.height=Math.max(24,Number(this.config.player.height)||150)+"px";
    this.nameEl.textContent=this.config.name||this.config.id||"Mundo";

    this.renderEntities();
    this.bindControls();
    const unlockAudio=()=>this.audio?.unlock();
    this.host.addEventListener("pointerdown",unlockAudio,{once:true});
    this.host.addEventListener("keydown",unlockAudio,{once:true});
    this.cleanups.push(()=>{this.host?.removeEventListener("pointerdown",unlockAudio);this.host?.removeEventListener("keydown",unlockAudio)});
    this.bindChallengeControls();
    this.bindCombatControls();
    this.bindRegionTransitionControls();
    this.bindCameraPan();
    this.resize();
    this.onResize=()=>this.resize();
    window.addEventListener("resize",this.onResize);
    this.cleanups.push(()=>window.removeEventListener("resize",this.onResize));

    this.setMode(this.mode);
    if(String(this.getTutorialGuide?.()?.stage||"")==="missions-hunt"){
      this.restoreTutorialCorsairMissionFleet();
    }
    this.renderMinimap(true);
    this.lastTime=performance.now();
    this.raf=requestAnimationFrame(t=>this.tick(t));
    return this;
  }

  renderEntities(){
    if(!this.entityLayer)return;
    for(const renderer of this.entityEffectRenderers.values())renderer?.destroy?.();
    this.entityEffectRenderers.clear();
    this.entityLayer.replaceChildren();
    this.gizmoEl=null;

    for(const entity of this.entities){
      const presentation=resolveEntityPresentation(entity);
      const el=document.createElement("div");
      el.className="tq-world-entity tq-world-entity--"+(entity.type||"object");
      el.dataset.entityId=entity.id;
      el.dataset.renderMode=presentation.renderMode;
      el.dataset.logicalType=entity.type||"object";
      el.dataset.entityKind=String(entity.entityKind||"");
      const timelineAnimated=hasTimelineSpriteAnimation(entity);
      el.classList.toggle("tq-world-entity--monster",String(entity.entityKind||"")==="monster");
      if(String(entity.type||"")==="region-exit"){
        const dx=Number(entity.x||0)-Number(this.config.width||0)/2;
        const dy=Number(entity.y||0)-Number(this.config.height||0)/2;
        const direction=Math.abs(dx)>Math.abs(dy)?(dx<0?"left":"right"):(dy<0?"up":"down");
        el.dataset.exitDirection=direction;
        el.dataset.exitLabel=String(entity.destinationWorldName||entity.label||"Saída de região");
      }
      el.style.zIndex=String(entity.z??10);

      if(presentation.hasSprite){
        if(timelineAnimated){
          const shadow=document.createElement("span");
          shadow.className="tq-world-monster-shadow";
          shadow.setAttribute("aria-hidden","true");
          el.append(shadow);

          const animatedSprite=document.createElement("span");
          animatedSprite.className="tq-world-entity__timeline-sprite";
          animatedSprite.setAttribute("aria-hidden","true");
          el.append(animatedSprite);

          const waterFront=document.createElement("span");
          waterFront.className="tq-world-monster-water-front";
          waterFront.setAttribute("aria-hidden","true");
          el.append(waterFront);

          const waveRing=document.createElement("span");
          waveRing.className="tq-world-monster-wave-ring";
          waveRing.setAttribute("aria-hidden","true");
          el.append(waveRing);

          if(String(entity.entityKind||"")==="monster"){
            const bubbles=document.createElement("span");
            bubbles.className="tq-world-monster-bubbles";
            bubbles.setAttribute("aria-hidden","true");
            for(let bubbleIndex=0;bubbleIndex<6;bubbleIndex++){
              const bubble=document.createElement("i");
              bubble.style.setProperty("--bubble-index",String(bubbleIndex));
              bubble.style.setProperty("--bubble-left",(13+bubbleIndex*14)+"%");
              bubble.style.setProperty("--bubble-delay",(-bubbleIndex*.47)+"s");
              bubble.style.setProperty("--bubble-duration",(2.7+(bubbleIndex%3)*.55)+"s");
              bubble.style.setProperty("--bubble-size",(5+(bubbleIndex%4)*2)+"px");
              bubbles.append(bubble);
            }
            el.append(bubbles);
          }
        }

        const img=document.createElement("img");
        img.src=entity.src||"";
        img.alt=entity.label||entity.type||"Objeto";
        el.append(img);

        const canvas=document.createElement("canvas");
        canvas.className="tq-world-entity__webgl";
        canvas.hidden=true;
        canvas.setAttribute("aria-hidden","true");
        el.append(canvas);
      }

      if(String(entity.type||"")==="island"){
        const depthLayer=document.createElement("img");
        depthLayer.className="tq-world-island-depth-layer";
        depthLayer.src=entity.src||"";
        depthLayer.alt="";
        depthLayer.setAttribute("aria-hidden","true");
        el.append(depthLayer);

        const depthEditor=document.createElement("div");
        depthEditor.className="tq-world-depth-mask-editor";
        depthEditor.hidden=true;
        depthEditor.innerHTML='<svg viewBox="0 0 1000 1000" preserveAspectRatio="none" aria-hidden="true"><polygon></polygon><g></g></svg>';
        el.append(depthEditor);

        const waterCanvas=document.createElement("canvas");
        waterCanvas.className="tq-world-island-water-canvas";
        waterCanvas.hidden=true;
        waterCanvas.setAttribute("aria-hidden","true");
        el.append(waterCanvas);
      }

      const collider=document.createElement("span");
      collider.className="tq-world-entity__collider";
      collider.setAttribute("aria-hidden","true");
      el.append(collider);

      const isNamedShip=String(entity.type||"")==="ship"
        &&(entity.role==="npc"||entity.runtimeGenerated===true||Boolean(entity.npcId));
      if(isNamedShip){
        const name=document.createElement("span");
        name.className="tq-world-ship-name";
        name.textContent=String(entity.label||entity.shipName||"Navio");
        name.setAttribute("aria-hidden","true");
        entity.nameEl=name;
      }else entity.nameEl=null;

      entity.el=el;
      this.syncCombatClickableEntity(entity);
      this.applyEntityVisual(entity);
      if(this.collected.has(entity.id))el.hidden=true;
      if(this.editorEnabled&&!entity.runtimeGenerated)this.bindEntityEditing(entity);
      this.entityLayer.append(el);
      if(entity.nameEl)this.entityLayer.append(entity.nameEl);
      this.syncEntityEffectRenderer(entity);
    }

    this.ensureGizmo();
    this.applySelectionVisual();
    this.syncGizmo();
    this.updateProgress();
  }

  isClickableCombatShip(entity){
    return Boolean(
      entity
      &&String(entity.type||"")==="ship"
      &&!this.collected.has(entity.id)
      &&!this.navalDestroying.has(entity.id)
    );
  }

  syncCombatClickableEntity(entity){
    const el=entity?.el;
    if(!el)return;
    const clickable=this.isClickableCombatShip(entity);
    el.dataset.combatClickable=clickable?"true":"false";
    el.classList.toggle("is-combat-clickable",clickable);
    if(el.dataset.combatClickBound==="1")return;
    el.dataset.combatClickBound="1";
    el.addEventListener("click",event=>{
      if(this.mode!=="play"||this.challengeActive||this.combatActive||!this.isClickableCombatShip(entity))return;
      event.preventDefault();
      event.stopPropagation();
      this.selectCombatTarget(entity);
    });
  }

  navalTargetDistance(entity){
    if(!entity)return Infinity;
    return Math.hypot(
      Number(entity.x||0)-Number(this.player?.x||0),
      Number(entity.y||0)-Number(this.player?.y||0)
    );
  }

  playerNavalCombatStats(){
    let profile=null;
    const shipId=String(this.config.player?.shipId||"");
    if(shipId&&this.resolveShip){
      try{profile=this.resolveShip(shipId,"player")||null}catch{}
    }
    const base={
      attackRange:clamp(Number(
        this.config.player?.combat?.attackRange
        ??profile?.combat?.attackRange
        ??profile?.combatVisual?.attackRange
        ??this.config.combat?.attackRange
        ??this.navalAttackRange
        ??1200
      ),200,6000),
      attackCooldownMs:clamp(Number(
        this.config.player?.combat?.attackCooldownMs
        ??profile?.combat?.attackCooldownMs
        ??profile?.combatVisual?.attackCooldownMs
        ??this.config.combat?.attackCooldownMs
        ??this.navalAttackCooldown
        ??900
      ),300,5000),
      damage:clamp(Math.floor(Number(
        this.config.player?.combat?.damage
        ??profile?.combat?.damage
        ??profile?.combatVisual?.damage
        ??1
      )||1),1,20)
    };
    const modifiers=this.config.player?.combatModifiers&&typeof this.config.player.combatModifiers==="object"
      ?this.config.player.combatModifiers
      :{};
    const rangePct=clamp(Number(modifiers.attackRangePct)||0,-.8,5);
    const rangeFlat=clamp(Number(modifiers.attackRangeFlat)||0,-5000,10000);
    const cooldownPct=clamp(Number(modifiers.attackCooldownPct)||0,-.8,5);
    const damageFlat=clamp(Math.floor(Number(modifiers.damageFlat)||0),-19,100);
    return {
      maxHp:resolvePlayerHullHp(this.config.player,this.config.combat||{}),
      attackRange:clamp(base.attackRange*(1+rangePct)+rangeFlat,100,12000),
      attackCooldownMs:clamp(base.attackCooldownMs*(1+cooldownPct),150,10000),
      damage:clamp(base.damage+damageFlat,1,99)
    };
  }

  npcCombatLoadout(entity){
    const combat=entity?.combat&&typeof entity.combat==="object"?entity.combat:{};
    const raw=Array.isArray(combat.cannonLoadout)?combat.cannonLoadout:[];
    const cannons=[];
    for(const item of raw){
      const cannonId=String(item?.cannonId||item?.id||"").trim();
      const cannon=this.cannonCatalog.find(entry=>String(entry?.id||"")===cannonId);
      const quantity=clamp(Math.floor(Number(item?.quantity)||0),0,64);
      if(!cannon||quantity<=0)continue;
      for(let i=0;i<quantity;i++)cannons.push(cannon);
    }
    const ammoId=String(combat.ammoId||"").trim();
    const ammo=this.ammoCatalog.find(entry=>String(entry?.id||"")===ammoId)||null;
    return {
      cannons,
      ammo,
      ammoUnlimited:combat.ammoUnlimited===true
    };
  }

  entityNavalCombatStats(entity){
    const combat=entity?.combat&&typeof entity.combat==="object"?entity.combat:{};
    const loadout=this.npcCombatLoadout(entity);
    const equipped=loadout.cannons;
    const configuredRange=Number(combat.attackRange??1200);
    const maxRange=equipped.length
      ?Math.max(...equipped.map(cannon=>Math.max(1,Number(cannon?.range)||0)))
      :configuredRange;
    const cooldown=equipped.length
      ?Math.min(...equipped.map(cannon=>clamp(Number(cannon?.attackCooldownMs)||900,150,10000)))
      :Number(combat.attackCooldownMs??900);
    const projectileSpeed=Math.max(
      120,
      Number(loadout.ammo?.projectileSpeed)
      ||(equipped.length?Math.max(...equipped.map(cannon=>Number(cannon?.projectileSpeed)||0)):0)
      ||620
    );
    return {
      attackRange:clamp(maxRange,200,6000),
      attackCooldownMs:clamp(cooldown,150,10000),
      damage:clamp(Math.floor(Number(combat.damage)||1),1,200),
      projectileSpeed,
      cannonCount:Math.max(1,equipped.length||1),
      loadout
    };
  }

  syncEquippedCannonsFromShipyard(){
    const yard=this.getShipyardState?.()||{};
    const active=(Array.isArray(yard.ships)?yard.ships:[]).find(ship=>ship?.equipped===true);
    const ids=(Array.isArray(active?.cannons)?active.cannons:[])
      .map(cannon=>String(cannon?.id||cannon||""))
      .filter(id=>id&&this.cannonCatalog.some(cannon=>String(cannon?.id||"")===id));
    this.playerCannonIds=ids;
    if(!ids.length)this.stopNavalAutoFire({keepTarget:false});
    return ids;
  }

  async syncShipyardAction(action,...args){
    if(typeof action!=="function")return {ok:false,message:"Ação do estaleiro indisponível."};
    const result=await action(...args);
    if(result!==false&&result?.ok!==false)this.syncEquippedCannonsFromShipyard();
    return result;
  }

  playerCannonsInRange(entity){
    if(!this.isClickableCombatShip(entity))return [];
    const distance=this.navalTargetDistance(entity);
    const cannons=(Array.isArray(this.playerCannonIds)?this.playerCannonIds:[])
      .map(id=>this.cannonCatalog.find(item=>String(item?.id||"")===String(id)))
      .filter(Boolean);
    if(!cannons.length)return [];
    return cannons.filter(cannon=>distance<=Math.max(1,Number(cannon.range)||900));
  }

  playerEffectiveCannonRange(){
    const cannons=(Array.isArray(this.playerCannonIds)?this.playerCannonIds:[])
      .map(id=>this.cannonCatalog.find(item=>String(item?.id||"")===String(id)))
      .filter(Boolean);
    return cannons.length
      ?Math.max(...cannons.map(cannon=>Math.max(1,Number(cannon.range)||900)))
      :0;
  }

  isNavalTargetInRange(entity){
    if(!this.isClickableCombatShip(entity))return false;
    // O foco usa o maior alcance dentre os canhões equipados, inclusive
    // quando há somente um canhão no navio.
    return this.navalTargetDistance(entity)<=this.playerEffectiveCannonRange();
  }

  stopNavalAutoFire({keepTarget=true,message=""}={}){
    this.navalAutoFire=false;
    this.navalNextShotAt=0;
    if(!keepTarget){
      this.clearCombatTarget({hideAction:true});
      return;
    }
    const entity=this.combatTarget;
    if(!entity)return;
    if(this.actionButton)this.actionButton.textContent="⚔ Atacar";
    if(message&&this.actionMessage)this.actionMessage.textContent=message;
  }

  clearCombatTarget({hideAction=true}={}){
    this.navalAutoFire=false;
    this.navalNextShotAt=0;
    if(this.combatTarget?.el)this.combatTarget.el.classList.remove("is-combat-target");
    this.combatTarget=null;
    this.host?.classList.remove("has-combat-target");
    if(hideAction&&this.actionWrap)this.actionWrap.hidden=true;
  }

  nearestCombatTarget(){
    if(this.mode!=="play"||this.challengeActive||this.combatActive||this.navalPlayerHp<=0)return null;
    let nearest=null;
    let nearestDistance=Infinity;
    for(const entity of this.entities){
      if(!this.isClickableCombatShip(entity))continue;
      const tutorialStage=String(this.getTutorialGuide?.()?.stage||"");
      if(["attack-ship","attack-ship-2"].includes(tutorialStage)&&entity.tutorialDefeated===true)continue;
      if(tutorialStage==="missions-hunt"&&entity.tutorialMissionCorsair!==true)continue;
      const distance=this.navalTargetDistance(entity);
      if(!Number.isFinite(distance)||distance>=nearestDistance)continue;
      nearest=entity;
      nearestDistance=distance;
    }
    return nearest;
  }

  syncAutomaticCombatTarget(){
    if(this.mode!=="play"||this.challengeActive||this.combatActive||this.navalPlayerHp<=0)return false;
    // While an attack order is active, keep the current target locked.
    if(this.navalAutoFire===true&&this.combatTarget&&this.isClickableCombatShip(this.combatTarget))return false;
    const nearest=this.nearestCombatTarget();
    if(!nearest){
      if(this.combatTarget)this.clearCombatTarget({hideAction:true});
      return false;
    }
    if(["attack-ship","attack-ship-2"].includes(String(this.getTutorialGuide?.()?.stage||""))&&this.isNavalTargetInRange(nearest)&&nearest.tutorialCombatPhase!=="chase"){
      nearest.tutorialCombatTarget=true;
      nearest.tutorialCombatPhase=nearest.tutorialCombatPhase||"ready-fire";
      if(nearest.npcNavigation){nearest.npcNavigation.vx=0;nearest.npcNavigation.vy=0;}
      if(!this.tutorialIsolatedTargetId){
        this.tutorialIsolatedTargetId=String(nearest.id);
        for(const other of this.entities){
          if(other===nearest||!this.isClickableCombatShip(other))continue;
          other.tutorialHiddenForDuel=true;
          if(other.el)other.el.hidden=true;
        }
      }
    }
    if(this.combatTarget===nearest)return false;
    return this.selectCombatTarget(nearest,{preserveMovement:true});
  }

  selectCombatTarget(entity,{preserveMovement=false}={}){
    if(!this.isClickableCombatShip(entity)||this.mode!=="play"||this.challengeActive||this.combatActive)return false;
    const keepAutoFire=this.navalAutoFire===true;
    if(this.combatTarget&&this.combatTarget!==entity&&this.combatTarget.el){
      this.combatTarget.el.classList.remove("is-combat-target");
      // Switching targets must not disarm an already active attack order.
      // Transfer the armed state to the newly selected ship instead.
      this.navalNextShotAt=0;
    }
    this.combatTarget=entity;
    this.host?.classList.add("has-combat-target");
    this.navalAutoFire=keepAutoFire;
    this.nearby=entity;
    // Combat selection always takes priority over the optional repair action.
    // Otherwise a stale data-world-action="repair" makes the shared action
    // button reopen repair instead of attacking the newly selected enemy.
    if(this.actionButton)delete this.actionButton.dataset.worldAction;
    entity.el?.classList.add("is-combat-target");
    if(!preserveMovement){
      this.clearNavigationTarget({brake:true});
      this.keys.clear();
      this.cameraKeys.clear();
      this.pointerDirections.clear();
      this.resetJoystick();
    }

    const label=String(entity.label||entity.shipName||"Navio inimigo");
    const hp=this.navalHpState(entity);
    const targetDistance=Math.round(this.navalTargetDistance(entity));
    if(this.actionMessage){
      this.actionMessage.textContent=this.isNavalTargetInRange(entity)
        ?label+" · casco "+hp.current+"/"+hp.max+" · "+targetDistance+" px"
        :label+" · FORA DE ALCANCE · "+targetDistance+" / "+Math.round(this.playerEffectiveCannonRange())+" px";
    }
    if(this.actionButton){
      this.actionButton.disabled=this.navalPlayerHp<=0;
      this.actionButton.textContent=this.navalPlayerHp<=0
        ?"☠ Navio derrotado"
        :(this.navalAutoFire
          ?(this.isNavalTargetInRange(entity)?"🔥 Atacando":"⏸ Fora de alcance")
          :"⚔ Atacar");
    }
    if(this.navalPlayerHp<=0&&this.actionMessage){
      this.actionMessage.textContent="Seu navio foi derrotado · seu casco 0/"+this.navalPlayerMaxHp;
    }
    if(this.actionWrap)this.actionWrap.hidden=false;
    if(this.navalPlayerHp>0&&this.navalAutoFire&&this.isNavalTargetInRange(entity)){
      this.navalNextShotAt=0;
      queueMicrotask(()=>this.updateDirectNavalCombat(performance.now()));
    }
    return true;
  }

  applyEntityVisual(entity){
    const el=entity.el;
    if(!el)return;
    el.style.left=entity.x+"px";
    el.style.top=entity.y+"px";
    el.style.width=(entity.width||96)+"px";
    el.style.height=(entity.height||96)+"px";
    const timelineAnimated=hasTimelineSpriteAnimation(entity);
    const baseRotation=timelineAnimated?0:Number(entity.rotation||0);
    el.style.transform=`translate(-50%,-50%) rotate(${baseRotation}deg) skewX(${Number(entity.skewX||0)}deg) skewY(${Number(entity.skewY||0)}deg)`;
    if(entity.nameEl){
      entity.nameEl.textContent=String(entity.label||entity.shipName||"Navio");
      entity.nameEl.style.left=(Number(entity.x)||0)+"px";
      entity.nameEl.style.top=((Number(entity.y)||0)+Math.max(18,Number(entity.height)||96)*.54+10)+"px";
      entity.nameEl.hidden=el.hidden===true;
    }
    const logicalOnly=el.dataset.renderMode==="logical";
    el.classList.toggle("is-logical-only",logicalOnly);
    el.style.visibility=logicalOnly&&this.mode==="play"?"hidden":"visible";
    const img=el.querySelector("img");
    if(img&&img.getAttribute("src")!==String(entity.src||"")){
      img.removeAttribute("data-island-water-load-bound");
      img.src=entity.src||"";
    }
    if(String(entity.type||"")==="island"){
      const depthLayer=el.querySelector(".tq-world-island-depth-layer");
      const depthPoints=Array.isArray(entity.depthMask?.points)?entity.depthMask.points:[];
      const depthActive=entity.depthMask?.active!==false&&depthPoints.length>=3;
      const depthPolygon=depthPoints.map(point=>(clamp(Number(point.x)||0,0,1)*100).toFixed(3)+"% "+(clamp(Number(point.y)||0,0,1)*100).toFixed(3)+"%").join(",");
      if(depthLayer){
        if(depthLayer.getAttribute("src")!==String(entity.src||""))depthLayer.src=entity.src||"";
        depthLayer.hidden=!depthActive;
        depthLayer.style.clipPath=depthActive?"polygon("+depthPolygon+")":"";
        depthLayer.style.webkitClipPath=depthActive?"polygon("+depthPolygon+")":"";
      }
      this.refreshDepthMaskEditor(entity);
      const raw=entity.waterIntegration&&typeof entity.waterIntegration==="object"?entity.waterIntegration:{};
      const active=raw.active!==false;
      const immersion=clamp(Number(raw.immersion??.18),0,.55);
      const foam=clamp(Number(raw.foam??.65),0,1);
      const foamWidth=clamp(Number(raw.foamWidth??.12),.02,.35);
      const wetness=clamp(Number(raw.wetness??.5),0,1);
      const shadow=clamp(Number(raw.submergedShadow??.42),0,1);
      el.classList.toggle("has-water-integration",active);
      el.style.setProperty("--island-immersion",String(immersion));
      el.style.setProperty("--island-foam",String(foam));
      el.style.setProperty("--island-foam-width",String(foamWidth));
      el.style.setProperty("--island-wetness",String(wetness));
      el.style.setProperty("--island-submerged-shadow",String(shadow));

      if(img){
        if(active&&immersion>0){
          const fadeDepth=clamp(.035+immersion*.285,.035,.20);
          const solidStop=(1-fadeDepth)*100;
          const softStop=(1-fadeDepth*.42)*100;
          const islandMask="linear-gradient(to bottom,#000 0%,#000 "+solidStop.toFixed(2)+"%,rgba(0,0,0,.72) "+softStop.toFixed(2)+"%,transparent 100%)";
          img.style.maskImage=islandMask;
          img.style.webkitMaskImage=islandMask;
          img.style.maskRepeat="no-repeat";
          img.style.webkitMaskRepeat="no-repeat";
          img.style.maskSize="100% 100%";
          img.style.webkitMaskSize="100% 100%";
        }else{
          img.style.maskImage="";
          img.style.webkitMaskImage="";
          img.style.maskRepeat="";
          img.style.webkitMaskRepeat="";
          img.style.maskSize="";
          img.style.webkitMaskSize="";
        }
      }

      this.renderIslandWaterIntegration(entity,{active,immersion,foam,foamWidth,wetness,shadow});
    }else{
      el.classList.remove("has-water-integration");
      if(img){
        img.style.maskImage="";
        img.style.webkitMaskImage="";
        img.style.maskRepeat="";
        img.style.webkitMaskRepeat="";
        img.style.maskSize="";
        img.style.webkitMaskSize="";
      }
    }
    this.syncCombatClickableEntity(entity);
    const timelineApplied=this.applyEntityTimelineVisual(entity);
    if(!timelineApplied)this.applyEntityDirectionalVisual(entity);
    this.syncCollisionVisual(entity);
  }

  renderIslandWaterIntegration(entity,settings=null){
    const el=entity?.el;
    if(!el||String(entity.type||"")!=="island")return;
    const canvas=el.querySelector(".tq-world-island-water-canvas");
    const img=el.querySelector("img");
    if(!canvas||!img)return;

    const raw=settings||(()=>{
      const value=entity.waterIntegration&&typeof entity.waterIntegration==="object"?entity.waterIntegration:{};
      return {
        active:value.active!==false,
        immersion:clamp(Number(value.immersion??.18),0,.55),
        foam:clamp(Number(value.foam??.65),0,1),
        foamWidth:clamp(Number(value.foamWidth??.12),.02,.35),
        wetness:clamp(Number(value.wetness??.5),0,1),
        shadow:clamp(Number(value.submergedShadow??.42),0,1)
      };
    })();

    if(!raw.active){
      canvas.hidden=true;
      const ctx=canvas.getContext("2d");
      ctx?.clearRect(0,0,canvas.width,canvas.height);
      return;
    }

    if(!img.complete||!img.naturalWidth||!img.naturalHeight){
      canvas.hidden=true;
      if(!img.dataset.islandWaterLoadBound){
        img.dataset.islandWaterLoadBound="1";
        img.addEventListener("load",()=>{
          img.removeAttribute("data-island-water-load-bound");
          this.renderIslandWaterIntegration(entity);
        },{once:true});
      }
      return;
    }

    const width=Math.max(1,Number(entity.width)||96);
    const height=Math.max(1,Number(entity.height)||96);
    const maxSide=Math.max(width,height);
    const pad=Math.ceil(maxSide*(.10+raw.immersion*.10+raw.foamWidth*.07));
    const cssWidth=Math.ceil(width+pad*2);
    const cssHeight=Math.ceil(height+pad*2);
    const dpr=Math.min(2,Math.max(1,Number(window.devicePixelRatio)||1));
    const pixelWidth=Math.max(1,Math.round(cssWidth*dpr));
    const pixelHeight=Math.max(1,Math.round(cssHeight*dpr));

    if(canvas.width!==pixelWidth)canvas.width=pixelWidth;
    if(canvas.height!==pixelHeight)canvas.height=pixelHeight;
    canvas.style.width=cssWidth+"px";
    canvas.style.height=cssHeight+"px";
    canvas.style.left=(-pad)+"px";
    canvas.style.top=(-pad)+"px";
    canvas.hidden=false;

    const ctx=canvas.getContext("2d");
    if(!ctx)return;
    ctx.setTransform(dpr,0,0,dpr,0,0);
    ctx.clearRect(0,0,cssWidth,cssHeight);
    ctx.imageSmoothingEnabled=true;
    ctx.imageSmoothingQuality="high";

    const makeLayer=(color,blurPx,scaleX,scaleY,offsetY)=>{
      const layer=document.createElement("canvas");
      layer.width=pixelWidth;
      layer.height=pixelHeight;
      const lctx=layer.getContext("2d");
      if(!lctx)return null;
      lctx.setTransform(dpr,0,0,dpr,0,0);
      lctx.clearRect(0,0,cssWidth,cssHeight);
      lctx.save();
      lctx.translate(cssWidth/2,cssHeight/2+offsetY);
      lctx.scale(scaleX,scaleY);
      lctx.translate(-width/2,-height/2);
      lctx.filter=blurPx>0?("blur("+blurPx+"px)"):"none";
      lctx.drawImage(img,0,0,width,height);
      lctx.restore();
      lctx.filter="none";
      lctx.globalCompositeOperation="source-in";
      lctx.fillStyle=color;
      lctx.fillRect(0,0,cssWidth,cssHeight);

      // Water integration belongs to the shoreline, not around the full
      // silhouette. Fade the generated layer in only across the lower coast.
      const coastTop=pad+height*clamp(.54-raw.immersion*.22,.38,.58);
      const coastBottom=pad+height*1.06;
      const coastGradient=lctx.createLinearGradient(0,coastTop,0,coastBottom);
      coastGradient.addColorStop(0,"rgba(0,0,0,0)");
      coastGradient.addColorStop(.36,"rgba(0,0,0,.10)");
      coastGradient.addColorStop(.68,"rgba(0,0,0,.72)");
      coastGradient.addColorStop(1,"rgba(0,0,0,1)");
      lctx.globalCompositeOperation="destination-in";
      lctx.fillStyle=coastGradient;
      lctx.fillRect(0,0,cssWidth,cssHeight);
      lctx.globalCompositeOperation="source-over";
      return layer;
    };

    // Keep the contour tight to the beach. Large silhouette expansion creates
    // a visible oval halo around transparent island assets.
    const deepScaleX=1.006+raw.immersion*.045+raw.shadow*.012;
    const deepScaleY=1.008+raw.immersion*.055+raw.shadow*.014;
    const deepOffsetY=height*raw.immersion*.035;
    const deepBlur=2+raw.shadow*7;
    const deepAlpha=.06+raw.shadow*.34;
    const deep=makeLayer("rgba(5,38,54,"+deepAlpha.toFixed(3)+")",deepBlur,deepScaleX,deepScaleY,deepOffsetY);
    if(deep)ctx.drawImage(deep,0,0,cssWidth,cssHeight);

    const foamScaleX=1.003+raw.foamWidth*.055;
    const foamScaleY=1.004+raw.foamWidth*.075;
    const foamBlur=.45+raw.foamWidth*3.4;
    const foamAlpha=raw.foam*.46;
    const shallow=makeLayer("rgba(215,250,255,"+foamAlpha.toFixed(3)+")",foamBlur,foamScaleX,foamScaleY,height*raw.immersion*.012);
    if(shallow)ctx.drawImage(shallow,0,0,cssWidth,cssHeight);

    // Cut the original island footprint out of both generated layers.
    // Only the expanded contour remains visible around the transparent asset.
    ctx.save();
    ctx.globalCompositeOperation="destination-out";
    ctx.drawImage(img,pad,pad,width,height);
    ctx.restore();
  }

  syncCollisionVisual(entity){
    if(!entity?.el)return;
    entity.collision=normalizeCollision(entity.collision||{},entity);
    const collider=entity.el.querySelector(".tq-world-entity__collider");
    entity.el.classList.toggle("has-collision",entity.collision.active);
    entity.el.dataset.collisionShape=entity.collision.shape;
    if(!collider)return;
    const widthPct=entity.collision.scaleX*100;
    const heightPct=entity.collision.scaleY*100;
    const paddingX=(entity.collision.padding*2/Math.max(16,Number(entity.width)||96))*100;
    const paddingY=(entity.collision.padding*2/Math.max(16,Number(entity.height)||96))*100;
    collider.style.width=`calc(${widthPct}% + ${paddingX}%)`;
    collider.style.height=`calc(${heightPct}% + ${paddingY}%)`;
    collider.style.borderRadius=entity.collision.shape==="ellipse"?"50%":"10px";
  }

  syncEntityEffectRenderer(entity){
    if(!entity?.el)return;
    const effect=normalizeEntityEffect(entity.effect||{},entity);
    entity.effect=effect;
    const img=entity.el.querySelector("img");
    const canvas=entity.el.querySelector(".tq-world-entity__webgl");
    const atlasMode=hasTimelineSpriteAnimation(entity)||entity.el.dataset.renderMode==="atlas";
    // Atlas sprites are rendered by CSS background cropping. Never
    // reveal the raw <img>, otherwise the whole spritesheet is compressed
    // into the entity on top of the selected frame.
    const wantsWebGL=Boolean(
      !atlasMode
      &&effect.active
      &&effect.renderer==="webgl"
      &&entity.src
      &&canvas
    );

    entity.el.dataset.effectRenderer=effect.renderer;
    entity.el.dataset.effectPreset=effect.preset;

    if(!wantsWebGL){
      if(canvas)canvas.hidden=true;
      if(img)img.hidden=atlasMode;
      return;
    }

    let renderer=this.entityEffectRenderers.get(entity.id);
    if(!renderer&&canvas){
      renderer=new EntityWebGLEffectRenderer(canvas);
      this.entityEffectRenderers.set(entity.id,renderer);
    }

    renderer?.init?.(entity.src).then(ok=>{
      if(!entity.el?.isConnected)return;
      const current=normalizeEntityEffect(entity.effect||{},entity);
      const active=Boolean(ok&&current.active&&current.renderer==="webgl");
      if(canvas)canvas.hidden=!active;
      if(img)img.hidden=active;
    });
  }

  ensureGizmo(){
    if(!this.editorEnabled||!this.entityLayer)return null;
    if(this.gizmoEl?.isConnected)return this.gizmoEl;

    const gizmo=document.createElement("div");
    gizmo.className="tq-world-gizmo";
    gizmo.hidden=true;
    const resizeHandles=["nw","n","ne","e","se","s","sw","w"]
      .map(dir=>'<button type="button" class="tq-world-gizmo__resize tq-world-gizmo__resize--'+dir+'" data-world-resize-dir="'+dir+'" aria-label="Redimensionar '+dir+'" title="Redimensionar '+dir+'"></button>')
      .join("");
    gizmo.innerHTML=
      '<span class="tq-world-gizmo__stem"></span>'+
      '<button type="button" class="tq-world-gizmo__rotate" aria-label="Girar entidade" title="Girar"></button>'+
      resizeHandles+
      '<button type="button" class="tq-world-gizmo__skew tq-world-gizmo__skew--x" data-world-skew-axis="x" aria-label="Inclinar horizontalmente" title="Inclinar horizontalmente"></button>'+
      '<button type="button" class="tq-world-gizmo__skew tq-world-gizmo__skew--y" data-world-skew-axis="y" aria-label="Inclinar verticalmente" title="Inclinar verticalmente"></button>';
    this.entityLayer.append(gizmo);
    this.gizmoEl=gizmo;

    const activeEntity=()=>this.mode==="edit"&&this.selectedId
      ?this.entities.find(item=>item.id===this.selectedId)
      :null;
    const emit=(entity,commit)=>this.onEntityChange?.(structuredClone(this.cleanEntity(entity)),commit);

    const rotate=gizmo.querySelector(".tq-world-gizmo__rotate");
    rotate.addEventListener("pointerdown",event=>{
      const entity=activeEntity();
      if(!entity)return;
      event.preventDefault();event.stopPropagation();
      const rect=entity.el?.getBoundingClientRect();
      if(!rect)return;
      const center={x:rect.left+rect.width/2,y:rect.top+rect.height/2};
      try{rotate.setPointerCapture(event.pointerId)}catch{}

      const move=e=>{
        const angle=Math.atan2(e.clientY-center.y,e.clientX-center.x)*180/Math.PI+90;
        entity.rotation=((angle+180)%360+360)%360-180;
        this.applyEntityVisual(entity);
        this.syncGizmo();
        emit(entity,false);
      };
      const finish=e=>{
        try{if(rotate.hasPointerCapture(e.pointerId))rotate.releasePointerCapture(e.pointerId)}catch{}
        rotate.removeEventListener("pointermove",move);
        rotate.removeEventListener("pointerup",finish);
        rotate.removeEventListener("pointercancel",finish);
        emit(entity,true);
      };
      rotate.addEventListener("pointermove",move);
      rotate.addEventListener("pointerup",finish);
      rotate.addEventListener("pointercancel",finish);
    });

    gizmo.querySelectorAll("[data-world-resize-dir]").forEach(handle=>{
      handle.addEventListener("pointerdown",event=>{
        const entity=activeEntity();
        if(!entity)return;
        event.preventDefault();event.stopPropagation();

        const dir=String(handle.dataset.worldResizeDir||"se");
        const zoom=Math.max(.1,this.zoom||1);
        const angle=Number(entity.rotation||0)*Math.PI/180;
        const cos=Math.cos(angle);
        const sin=Math.sin(angle);
        const min=16;
        const start={
          px:event.clientX,
          py:event.clientY,
          x:Number(entity.x||0),
          y:Number(entity.y||0),
          width:Math.max(min,Number(entity.width||96)),
          height:Math.max(min,Number(entity.height||96))
        };
        const startLeft=-start.width/2;
        const startRight=start.width/2;
        const startTop=-start.height/2;
        const startBottom=start.height/2;

        try{handle.setPointerCapture(event.pointerId)}catch{}

        const move=e=>{
          const dx=(e.clientX-start.px)/zoom;
          const dy=(e.clientY-start.py)/zoom;
          const localX=dx*cos+dy*sin;
          const localY=-dx*sin+dy*cos;

          let left=startLeft;
          let right=startRight;
          let top=startTop;
          let bottom=startBottom;

          if(dir.includes("w"))left=Math.min(right-min,startLeft+localX);
          if(dir.includes("e"))right=Math.max(left+min,startRight+localX);
          if(dir.includes("n"))top=Math.min(bottom-min,startTop+localY);
          if(dir.includes("s"))bottom=Math.max(top+min,startBottom+localY);

          const localCenterX=(left+right)/2;
          const localCenterY=(top+bottom)/2;
          const worldCenterX=localCenterX*cos-localCenterY*sin;
          const worldCenterY=localCenterX*sin+localCenterY*cos;

          entity.x=clamp(start.x+worldCenterX,0,this.config.width);
          entity.y=clamp(start.y+worldCenterY,0,this.config.height);
          const freeSize=entity.type==="region-exit";
          entity.width=freeSize?Math.max(min,right-left):clamp(right-left,min,2400);
          entity.height=freeSize?Math.max(min,bottom-top):clamp(bottom-top,min,2400);
          entity.anchorX=entity.x;
          entity.anchorY=entity.y;

          this.applyEntityVisual(entity);
          this.syncGizmo();
          emit(entity,false);
        };

        const finish=e=>{
          try{if(handle.hasPointerCapture(e.pointerId))handle.releasePointerCapture(e.pointerId)}catch{}
          handle.removeEventListener("pointermove",move);
          handle.removeEventListener("pointerup",finish);
          handle.removeEventListener("pointercancel",finish);
          emit(entity,true);
        };

        handle.addEventListener("pointermove",move);
        handle.addEventListener("pointerup",finish);
        handle.addEventListener("pointercancel",finish);
      });
    });

    gizmo.querySelectorAll("[data-world-skew-axis]").forEach(handle=>{
      handle.addEventListener("pointerdown",event=>{
        const entity=activeEntity();
        if(!entity)return;
        event.preventDefault();event.stopPropagation();

        const axis=handle.dataset.worldSkewAxis==="y"?"y":"x";
        const zoom=Math.max(.1,this.zoom||1);
        const angle=Number(entity.rotation||0)*Math.PI/180;
        const cos=Math.cos(angle);
        const sin=Math.sin(angle);
        const start={
          px:event.clientX,
          py:event.clientY,
          value:axis==="x"?Number(entity.skewX||0):Number(entity.skewY||0),
          width:Math.max(1,Number(entity.width||96)),
          height:Math.max(1,Number(entity.height||96))
        };

        try{handle.setPointerCapture(event.pointerId)}catch{}

        const move=e=>{
          const dx=(e.clientX-start.px)/zoom;
          const dy=(e.clientY-start.py)/zoom;
          const localX=dx*cos+dy*sin;
          const localY=-dx*sin+dy*cos;
          const delta=axis==="x"?localX:localY;
          const size=axis==="x"?start.height:start.width;
          const value=clamp(start.value+Math.atan(delta/size)*180/Math.PI,-75,75);
          if(axis==="x")entity.skewX=value;
          else entity.skewY=value;

          this.applyEntityVisual(entity);
          this.syncGizmo();
          emit(entity,false);
        };

        const finish=e=>{
          try{if(handle.hasPointerCapture(e.pointerId))handle.releasePointerCapture(e.pointerId)}catch{}
          handle.removeEventListener("pointermove",move);
          handle.removeEventListener("pointerup",finish);
          handle.removeEventListener("pointercancel",finish);
          emit(entity,true);
        };

        handle.addEventListener("pointermove",move);
        handle.addEventListener("pointerup",finish);
        handle.addEventListener("pointercancel",finish);
      });
    });

    return gizmo;
  }

  syncGizmo(){
    const gizmo=this.ensureGizmo();
    if(!gizmo)return;
    const entity=this.entities.find(item=>item.id===this.selectedId);
    const visible=this.mode==="edit"&&entity&&!this.collected.has(entity.id);
    gizmo.hidden=!visible;
    if(!visible)return;

    gizmo.style.left=entity.x+"px";
    gizmo.style.top=entity.y+"px";
    gizmo.style.width=Math.max(16,Number(entity.width||96))+"px";
    gizmo.style.height=Math.max(16,Number(entity.height||96))+"px";
    gizmo.style.transform="translate(-50%,-50%) rotate("+Number(entity.rotation||0)+"deg)";
    const size=22/Math.max(.25,this.zoom||1);
    gizmo.style.setProperty("--gizmo-handle-size",size+"px");
    gizmo.style.setProperty("--gizmo-line-width",Math.max(1,2/Math.max(.25,this.zoom||1))+"px");
  }

  refreshDepthMaskEditor(entity){
    const editor=entity?.el?.querySelector(".tq-world-depth-mask-editor");
    if(!editor)return;
    const editing=this.mode==="edit"&&this.depthMaskEditId===entity.id;
    editor.hidden=!editing;
    const points=Array.isArray(entity.depthMask?.points)?entity.depthMask.points:[];
    const polygon=editor.querySelector("polygon");
    const group=editor.querySelector("g");
    if(polygon)polygon.setAttribute("points",points.map(p=>(clamp(Number(p.x)||0,0,1)*1000)+","+(clamp(Number(p.y)||0,0,1)*1000)).join(" "));
    if(group)group.innerHTML=points.map((p,i)=>'<circle cx="'+(clamp(Number(p.x)||0,0,1)*1000)+'" cy="'+(clamp(Number(p.y)||0,0,1)*1000)+'" r="13" data-depth-point="'+i+'"></circle>').join("");
  }

  setDepthMaskEditing(id,active=true){
    const entity=this.entities.find(item=>item.id===id&&String(item.type||"")==="island");
    this.depthMaskEditId=active&&entity?id:null;
    for(const item of this.entities)this.refreshDepthMaskEditor(item);
    return Boolean(this.depthMaskEditId);
  }

  clearDepthMask(id){
    const entity=this.entityByIdGet(id);
    if(!entity)return false;
    entity.depthMask={active:true,points:[]};
    this.applyEntityVisual(entity);
    this.onEntityChange?.(this.getEntity(id),true);
    return true;
  }

  bindEntityEditing(entity){
    const el=entity.el;
    if(!el)return;

    el.addEventListener("pointerdown",event=>{
      if(this.mode!=="edit")return;
      if(this.depthMaskEditId===entity.id&&String(entity.type||"")==="island"){
        event.preventDefault();event.stopPropagation();
        const rect=el.getBoundingClientRect();
        if(!rect.width||!rect.height)return;
        const x=clamp((event.clientX-rect.left)/rect.width,0,1);
        const y=clamp((event.clientY-rect.top)/rect.height,0,1);
        const points=Array.isArray(entity.depthMask?.points)?entity.depthMask.points:[];
        entity.depthMask={active:true,points:[...points,{x,y}]};
        this.applyEntityVisual(entity);
        this.onEntityChange?.(this.getEntity(entity.id),true);
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      this.selectEntity(entity.id);

      const start={
        px:event.clientX,
        py:event.clientY,
        x:Number(entity.x||0),
        y:Number(entity.y||0)
      };
      try{el.setPointerCapture(event.pointerId)}catch{}

      const move=e=>{
        const zoom=Math.max(.1,this.zoom||1);
        entity.x=clamp(start.x+(e.clientX-start.px)/zoom,0,this.config.width);
        entity.y=clamp(start.y+(e.clientY-start.py)/zoom,0,this.config.height);
        entity.anchorX=entity.x;
        entity.anchorY=entity.y;
        this.applyEntityVisual(entity);
        this.syncGizmo();
        this.onEntityChange?.(structuredClone(this.cleanEntity(entity)),false);
      };

      const end=e=>{
        try{if(el.hasPointerCapture(e.pointerId))el.releasePointerCapture(e.pointerId)}catch{}
        el.removeEventListener("pointermove",move);
        el.removeEventListener("pointerup",end);
        el.removeEventListener("pointercancel",end);
        this.onEntityChange?.(structuredClone(this.cleanEntity(entity)),true);
      };

      el.addEventListener("pointermove",move);
      el.addEventListener("pointerup",end);
      el.addEventListener("pointercancel",end);
    });
  }

  bindCameraPan(){
    let pan=null;
    const dragThreshold=4;
    let touchPan=null;

    const isBlockedTarget=target=>{
      const common=".tq-world-controls,.tq-world-action,.tq-world-hud,button,input,select,textarea,a,label";
      if(target?.closest?.(common))return true;
      if(this.mode==="edit"&&target?.closest?.(".tq-world-entity,.tq-world-gizmo"))return true;
      return false;
    };

    const beginPan=(clientX,clientY,pointerId=null)=>{
      pan={
        pointerId,
        px:clientX,
        py:clientY,
        lastX:clientX,
        lastY:clientY,
        dragging:false
      };
      if(this.mode==="edit")this.selectEntity(null);
    };

    const clampPlayCamera=()=>{
      if(!this.viewportSize)return;
      const zoom=Math.max(.1,this.playZoom||1);
      const halfW=Math.min(this.config.width/2,this.viewportSize.width/(2*zoom));
      const halfH=Math.min(this.config.height/2,this.viewportSize.height/(2*zoom));
      this.camera.x=clamp(this.camera.x,halfW,this.config.width-halfW);
      this.camera.y=clamp(this.camera.y,halfH,this.config.height-halfH);
    };

    const updatePan=(clientX,clientY)=>{
      if(!pan)return false;
      const totalX=clientX-pan.px;
      const totalY=clientY-pan.py;
      if(!pan.dragging&&Math.hypot(totalX,totalY)<dragThreshold)return false;
      if(!pan.dragging){
        pan.dragging=true;
        this.suppressNavigationClick=true;
        if(this.mode==="play"){
          this.playCameraDetached=true;
          this.playCameraRecenterAt=0;
          if(this.recenterButton)this.recenterButton.hidden=false;
        }
        this.host?.classList.add("is-camera-dragging");
      }

      const zoom=Math.max(.1,(this.mode==="play"?this.playZoom:this.zoom)||1);
      const dx=clientX-pan.lastX;
      const dy=clientY-pan.lastY;
      pan.lastX=clientX;
      pan.lastY=clientY;

      this.camera.x-=dx/zoom;
      this.camera.y-=dy/zoom;

      if(this.mode==="play"){
        clampPlayCamera();
        this.updateCamera(true);
      }else{
        this.clampEditorCamera();
        this.updateCamera(true);
      }
      return true;
    };

    const finishPan=({recenterDelayMs=3000}={})=>{
      const dragged=Boolean(pan?.dragging);
      this.host?.classList.remove("is-camera-dragging");
      if(this.mode==="play"&&dragged&&this.playCameraDetached){
        this.playCameraRecenterAt=performance.now()+Math.max(0,Number(recenterDelayMs)||0);
      }
      pan=null;
    };

    const down=event=>{
      if(event.isPrimary===false)return;
      if(event.pointerType==="mouse"&&event.button!==0)return;
      if(isBlockedTarget(event.target))return;

      beginPan(event.clientX,event.clientY,event.pointerId);
      try{this.viewport.setPointerCapture(event.pointerId)}catch{}
      if(this.mode==="edit"||event.pointerType==="mouse")event.preventDefault();
    };

    const move=event=>{
      if(!pan||event.pointerId!==pan.pointerId)return;
      if(updatePan(event.clientX,event.clientY))event.preventDefault();
    };

    const end=event=>{
      if(!pan||event.pointerId!==pan.pointerId)return;
      try{
        if(this.viewport.hasPointerCapture(event.pointerId))this.viewport.releasePointerCapture(event.pointerId);
      }catch{}
      finishPan({recenterDelayMs:event.pointerType==="touch"?30000:3000});
    };

    const touchStart=event=>{
      if(pan)return;
      // Keep HUD controls (especially the mobile joystick) independent from camera panning.
      // A second finger on the world may pan the camera while the first keeps steering.
      const touches=[...(event.changedTouches||[])];
      const touch=touches.find(item=>{
        const target=document.elementFromPoint?.(item.clientX,item.clientY)||event.target;
        return !isBlockedTarget(target);
      });
      if(!touch)return;
      if(!touch)return;
      touchPan=touch.identifier;
      beginPan(touch.clientX,touch.clientY,"touch:"+touch.identifier);
      if(this.mode==="edit")event.preventDefault();
    };

    const touchMove=event=>{
      if(touchPan===null||!pan)return;
      const touch=[...(event.touches||[])].find(item=>item.identifier===touchPan);
      if(!touch)return;
      updatePan(touch.clientX,touch.clientY);
      event.preventDefault();
    };

    const touchEnd=event=>{
      if(touchPan===null)return;
      const ended=[...(event.changedTouches||[])].some(item=>item.identifier===touchPan);
      if(!ended)return;
      const dragged=Boolean(pan?.dragging);
      touchPan=null;
      finishPan({recenterDelayMs:30000});
      if(dragged)event.preventDefault();
    };

    const wheel=event=>{
      if(this.mode!=="edit")return;
      event.preventDefault();
      const before=this.zoom;
      const factor=event.deltaY>0?.9:1.1;
      this.zoom=clamp(this.zoom*factor,.25,1.5);
      if(Math.abs(before-this.zoom)>.0001){
        this.clampEditorCamera();
        this.updateCamera(true);
      }
    };

    this.viewport.addEventListener("pointerdown",down);
    this.viewport.addEventListener("pointermove",move,{passive:false});
    this.viewport.addEventListener("pointerup",end);
    this.viewport.addEventListener("pointercancel",end);
    this.viewport.addEventListener("touchstart",touchStart,{passive:false});
    this.viewport.addEventListener("touchmove",touchMove,{passive:false});
    this.viewport.addEventListener("touchend",touchEnd,{passive:false});
    this.viewport.addEventListener("touchcancel",touchEnd,{passive:false});
    this.viewport.addEventListener("wheel",wheel,{passive:false});

    this.cleanups.push(()=>{
      touchPan=null;
      finishPan();
      this.viewport.removeEventListener("pointerdown",down);
      this.viewport.removeEventListener("pointermove",move);
      this.viewport.removeEventListener("pointerup",end);
      this.viewport.removeEventListener("pointercancel",end);
      this.viewport.removeEventListener("touchstart",touchStart);
      this.viewport.removeEventListener("touchmove",touchMove);
      this.viewport.removeEventListener("touchend",touchEnd);
      this.viewport.removeEventListener("touchcancel",touchEnd);
      this.viewport.removeEventListener("wheel",wheel);
    });
  }

  clearNavigationTarget({brake=false}={}){
    this.navigationTarget=null;
    if(this.navTargetEl)this.navTargetEl.hidden=true;
    if(brake){
      this.player.vx*=.28;
      this.player.vy*=.28;
    }
  }

  clearTreasureTarget(){
    this.treasureTarget=null;
  }

  treasureAtWorldPoint(point){
    if(!point)return null;
    return [...this.entities].reverse().find(entity=>{
      if(String(entity?.type||"")!=="treasure")return false;
      if(this.collected.has(entity.id)||entity.el?.hidden||entity.treasurePending)return false;
      const halfW=Math.max(20,Number(entity.width||88)/2);
      const halfH=Math.max(20,Number(entity.height||88)/2);
      return Math.abs(Number(point.x)-Number(entity.x||0))<=halfW
        &&Math.abs(Number(point.y)-Number(entity.y||0))<=halfH;
    })||null;
  }

  navigateToTreasure(entity){
    if(!entity||String(entity.type||"")!=="treasure"||this.collected.has(entity.id))return false;
    // A coleta nunca pode substituir uma batalha que já tem alvo travado.
    // O jogador precisa encerrar a distância do alvo ou selecionar outro navio.
    if(this.combatTarget||this.navalAutoFire||this.combatActive)return false;
    this.treasureTarget=entity;
    const travel=this.getPlayerTravelBounds();
    const target={
      x:clamp(Number(entity.x)||0,travel.left,travel.right),
      y:clamp(Number(entity.y)||0,travel.top,travel.bottom)
    };
    this.navigationTarget=target;
    this.keys.clear();
    this.pointerDirections.clear();
    this.resetJoystick();
    if(this.navTargetEl){
      this.navTargetEl.hidden=false;
      this.navTargetEl.style.left=target.x+"px";
      this.navTargetEl.style.top=target.y+"px";
    }
    return true;
  }

  resetJoystick(){
    this.joystick.x=0;
    this.joystick.y=0;
    this.joystick.active=false;
    this.joystick.pointerId=null;
    if(this.joystickThumbEl)this.joystickThumbEl.style.transform="translate3d(0,0,0)";
  }

  bindControls(){
    const shipKeyMap={
      ArrowUp:"up",
      ArrowDown:"down",
      ArrowLeft:"left",
      ArrowRight:"right"
    };
    const cameraKeyMap={
      KeyW:"up",
      KeyS:"down",
      KeyA:"left",
      KeyD:"right"
    };

    const keydown=e=>{
      if(this.mode!=="play"||this.challengeActive)return;
      if(e.code==="KeyF"){
        const target=e.target;
        const tagName=String(target?.tagName||"").toLowerCase();
        if(tagName==="input"||tagName==="textarea"||tagName==="select"||target?.isContentEditable)return;
        e.preventDefault();
        if(!this.combatTarget)this.syncAutomaticCombatTarget();
        if(this.combatTarget&&this.isClickableCombatShip(this.combatTarget))this.activateNearby();
        return;
      }
      const cameraDir=cameraKeyMap[e.code];
      if(cameraDir){
        e.preventDefault();
        this.cameraKeys.add(cameraDir);
        this.playCameraDetached=true;
        this.playCameraRecenterAt=0;
        if(this.recenterButton)this.recenterButton.hidden=false;
        return;
      }
      const shipDir=shipKeyMap[e.code];
      if(!shipDir)return;
      e.preventDefault();
      this.clearNavigationTarget();
      this.clearTreasureTarget();
      this.keys.add(shipDir);
    };
    const keyup=e=>{
      const cameraDir=cameraKeyMap[e.code];
      if(cameraDir){
        this.cameraKeys.delete(cameraDir);
        if(this.mode==="play"&&this.cameraKeys.size===0&&this.playCameraDetached){
          this.playCameraRecenterAt=performance.now()+3000;
        }
        return;
      }
      const shipDir=shipKeyMap[e.code];
      if(shipDir)this.keys.delete(shipDir);
    };

    window.addEventListener("keydown",keydown,{passive:false});
    window.addEventListener("keyup",keyup);
    this.cleanups.push(()=>{
      window.removeEventListener("keydown",keydown);
      window.removeEventListener("keyup",keyup);
    });

    const joystick=this.joystickEl;
    const thumb=this.joystickThumbEl;
    const updateJoystickPoint=(clientX,clientY)=>{
      if(!joystick||!thumb)return;
      const base=joystick.getBoundingClientRect();
      const centerX=base.left+base.width/2;
      const centerY=base.top+base.height/2;
      const thumbRadius=Math.max(10,thumb.getBoundingClientRect().width/2);
      const travel=Math.max(24,Math.min(base.width,base.height)/2-thumbRadius-8);
      const dx=Number(clientX)-centerX;
      const dy=Number(clientY)-centerY;
      const vector=normalizeJoystickVector(dx,dy,travel);
      this.joystick.x=vector.x;
      this.joystick.y=vector.y;

      const raw=Math.hypot(dx,dy);
      const visualScale=raw>0?Math.min(1,raw/travel):0;
      const visualX=raw>0?dx/raw*travel*visualScale:0;
      const visualY=raw>0?dy/raw*travel*visualScale:0;
      thumb.style.transform=`translate3d(${visualX}px,${visualY}px,0)`;
    };

    const touchCapable=("ontouchstart" in globalThis)||(Number(navigator?.maxTouchPoints)||0)>0;

    const joystickPointerStart=e=>{
      if(touchCapable||this.mode!=="play"||this.challengeActive||!joystick)return;
      e.preventDefault();
      e.stopPropagation();
      this.clearNavigationTarget();
      this.clearTreasureTarget();
      this.joystick.active=true;
      this.joystick.pointerId=e.pointerId;
      updateJoystickPoint(e.clientX,e.clientY);
    };
    const joystickPointerMove=e=>{
      if(touchCapable||!this.joystick.active||this.joystick.pointerId!==e.pointerId)return;
      e.preventDefault();
      updateJoystickPoint(e.clientX,e.clientY);
    };
    const joystickPointerEnd=e=>{
      if(touchCapable)return;
      if(this.joystick.pointerId!==null&&this.joystick.pointerId!==e.pointerId)return;
      this.resetJoystick();
    };

    const joystickTouchStart=e=>{
      if(!touchCapable||this.mode!=="play"||this.challengeActive||!joystick||!e.changedTouches?.length)return;
      // Multi-touch must remain available while steering: consume only the
      // joystick finger. A second finger can still press HUD/fire controls.
      const touch=[...(e.changedTouches||[])].find(item=>{
        const target=document.elementFromPoint?.(item.clientX,item.clientY);
        return target?.closest?.("[data-world-joystick]")===joystick;
      })||e.changedTouches[0];
      this.clearNavigationTarget();
      this.clearTreasureTarget();
      this.joystick.active=true;
      this.joystick.pointerId=touch.identifier;
      updateJoystickPoint(touch.clientX,touch.clientY);
    };
    const joystickTouchMove=e=>{
      if(!touchCapable||!this.joystick.active)return;
      const touches=[...(e.touches||[])];
      const touch=touches.find(item=>item.identifier===this.joystick.pointerId);
      if(!touch)return;
      // Do not prevent the whole multi-touch event: that used to swallow
      // taps from the second finger (Atirar, munição, etc.).
      updateJoystickPoint(touch.clientX,touch.clientY);
    };
    const joystickTouchEnd=e=>{
      if(!touchCapable||this.joystick.pointerId===null)return;
      const ended=[...(e.changedTouches||[])].some(item=>item.identifier===this.joystick.pointerId);
      if(!ended)return;
      this.resetJoystick();
    };

    joystick?.addEventListener("pointerdown",joystickPointerStart,{passive:false});
    globalThis.addEventListener?.("pointermove",joystickPointerMove,{passive:false});
    globalThis.addEventListener?.("pointerup",joystickPointerEnd);
    globalThis.addEventListener?.("pointercancel",joystickPointerEnd);

    joystick?.addEventListener("touchstart",joystickTouchStart,{passive:false});
    globalThis.addEventListener?.("touchmove",joystickTouchMove,{passive:false});
    globalThis.addEventListener?.("touchend",joystickTouchEnd,{passive:false});
    globalThis.addEventListener?.("touchcancel",joystickTouchEnd,{passive:false});

    const navigateToPointer=e=>{
      if(this.mode!=="play"||this.challengeActive)return;
      if(this.suppressNavigationClick){
        this.suppressNavigationClick=false;
        return;
      }
      if(e.button!==undefined&&e.button!==0)return;
      if(e.target?.closest?.(".tq-world-controls,.tq-world-action"))return;

      const rect=this.viewport.getBoundingClientRect();
      const clickedWorldPoint=screenPointToWorld(e.clientX,e.clientY,{
        viewportLeft:rect.left,
        viewportTop:rect.top,
        viewportWidth:rect.width,
        viewportHeight:rect.height,
        cameraX:this.camera.x,
        cameraY:this.camera.y,
        zoom:this.zoom,
        worldWidth:this.config.width,
        worldHeight:this.config.height,
        marginX:55,
        marginY:70
      });
      const clickedTreasure=this.treasureAtWorldPoint(clickedWorldPoint);
      if(clickedTreasure){
        // Durante combate, tesouros não recebem foco, não iniciam navegação e
        // tampouco podem abrir a continha de coleta.
        if(this.combatTarget||this.navalAutoFire||this.combatActive)return;
        this.navigateToTreasure(clickedTreasure);
        return;
      }

      const clickableCombatTarget=[...this.entities].reverse().find(entity=>{
        if(!this.isClickableCombatShip(entity)||entity.el?.hidden)return false;
        const halfW=Math.max(18,Number(entity.width||96)/2);
        const halfH=Math.max(18,Number(entity.height||96)/2);
        return Math.abs(clickedWorldPoint.x-Number(entity.x||0))<=halfW
          &&Math.abs(clickedWorldPoint.y-Number(entity.y||0))<=halfH;
      });
      if(clickableCombatTarget){
        this.selectCombatTarget(clickableCombatTarget);
        return;
      }
      if(e.target?.closest?.('[data-combat-clickable="true"]'))return;
      // O oceano só muda a rota. Um alvo naval fica travado até o jogador
      // selecionar outro navio ou ele efetivamente sair do alcance.
      this.clearTreasureTarget();

      const target=screenPointToWorld(e.clientX,e.clientY,{
        viewportLeft:rect.left,
        viewportTop:rect.top,
        viewportWidth:rect.width,
        viewportHeight:rect.height,
        cameraX:this.camera.x,
        cameraY:this.camera.y,
        zoom:this.zoom,
        worldWidth:this.config.width,
        worldHeight:this.config.height,
        marginX:55,
        marginY:70
      });
      const travel=this.getPlayerTravelBounds();
      target.x=clamp(target.x,travel.left,travel.right);
      target.y=clamp(target.y,travel.top,travel.bottom);
      this.navigationTarget=target;
      this.keys.clear();
      this.pointerDirections.clear();
      this.resetJoystick();

      if(this.navTargetEl){
        this.navTargetEl.hidden=false;
        this.navTargetEl.style.left=target.x+"px";
        this.navTargetEl.style.top=target.y+"px";
      }
    };

    this.viewport.addEventListener("click",navigateToPointer);

    const action=()=>{
      if(this.actionButton?.dataset?.worldAction==="repair"){
        this.beginPlayerRepair({forced:false});
        return;
      }
      const directAction=String(this.actionButton?.dataset?.interactionAction||"");
      if(directAction==="open-shipyard"){
        this.actionWrap.hidden=true;
        this.shipyardOverlay?.open?.();
        return;
      }
      if(directAction==="open-missions"){
        this.actionWrap.hidden=true;
        this.mobileHud?.openMissions?.();
        this.mobileHud?.onMissionsOpen?.();
        return;
      }
      this.activateNearby();
    };
    const recenter=event=>{
      event?.preventDefault?.();
      event?.stopPropagation?.();
      if(this.mode!=="play")return;
      this.playCameraDetached=false;
      this.playCameraRecenterAt=0;
      this.playCameraOffset.x=0;
      this.playCameraOffset.y=0;
      if(this.recenterButton)this.recenterButton.hidden=true;
      this.updateCamera(true);
    };
    this.actionButton.addEventListener("click",action);
    this.recenterButton?.addEventListener("click",recenter);
    this.cleanups.push(()=>{
      joystick?.removeEventListener("pointerdown",joystickPointerStart);
      globalThis.removeEventListener?.("pointermove",joystickPointerMove);
      globalThis.removeEventListener?.("pointerup",joystickPointerEnd);
      globalThis.removeEventListener?.("pointercancel",joystickPointerEnd);
      joystick?.removeEventListener("touchstart",joystickTouchStart);
      globalThis.removeEventListener?.("touchmove",joystickTouchMove);
      globalThis.removeEventListener?.("touchend",joystickTouchEnd);
      globalThis.removeEventListener?.("touchcancel",joystickTouchEnd);
      this.viewport.removeEventListener("click",navigateToPointer);
      this.actionButton.removeEventListener("click",action);
      this.recenterButton?.removeEventListener("click",recenter);
    });
  }

  setEditorPreviewActive(active=false){
    if(!this.editorEnabled)return;
    const next=Boolean(active);
    if(next===this.editorPreviewActive)return;
    if(next){
      this.editorPreviewAnchor={
        x:this.player.x,
        y:this.player.y,
        rotation:this.player.rotation,
        direction:this.player.direction
      };
      this.editorPreviewStartedAt=performance.now();
      this.player.vx=0;
      this.player.vy=0;
      this.clearPlayerWake();
    }else{
      const anchor=this.editorPreviewAnchor;
      if(anchor){
        this.player.x=anchor.x;
        this.player.y=anchor.y;
        this.player.rotation=anchor.rotation;
        this.player.direction=anchor.direction;
      }
      this.player.vx=0;
      this.player.vy=0;
      this.editorPreviewAnchor=null;
      this.editorPreviewStartedAt=0;
      this.clearPlayerWake();
      this.updatePlayerVisual(performance.now(),1/60);
    }
    this.editorPreviewActive=next;
  }

  updateEditorPreviewPlayer(time,dt){
    if(!this.editorPreviewActive||this.mode!=="edit")return;
    if(!this.editorPreviewAnchor){
      this.editorPreviewAnchor={x:this.player.x,y:this.player.y,rotation:this.player.rotation,direction:this.player.direction};
      this.editorPreviewStartedAt=Number(time)||performance.now();
    }
    const anchor=this.editorPreviewAnchor;
    const elapsed=Math.max(0,((Number(time)||0)-this.editorPreviewStartedAt)/1000);
    const travel=this.getPlayerTravelBounds();
    const radiusX=clamp((this.viewportSize?.width||900)*.13,80,170);
    const radiusY=clamp((this.viewportSize?.height||620)*.10,55,105);
    const omega=.72;
    const targetX=clamp(anchor.x+Math.sin(elapsed*omega)*radiusX,travel.left,travel.right);
    const targetY=clamp(anchor.y+Math.sin(elapsed*omega*2)*radiusY,travel.top,travel.bottom);
    const safeDt=Math.max(.001,Number(dt)||1/60);
    const vx=(targetX-this.player.x)/safeDt;
    const vy=(targetY-this.player.y)/safeDt;
    this.player.x=targetX;
    this.player.y=targetY;
    this.player.vx=vx;
    this.player.vy=vy;
    if(Math.hypot(vx,vy)>4){
      this.player.rotation=Math.atan2(vy,vx)*180/Math.PI+90;
    }
  }

  setMode(mode){
    if(!this.editorEnabled&&mode!=="play")return;
    this.mode=mode==="play"?"play":"edit";
    this.host?.classList.toggle("is-editor",this.mode==="edit");
    this.host?.classList.toggle("is-play",this.mode==="play");
    if(this.modeEl)this.modeEl.textContent=this.mode==="edit"?"REGIÃO · EDITAR":"";
    const technicalHud=this.host?.querySelector?.(".tq-world-hud");
    if(technicalHud)technicalHud.hidden=this.mode==="play";
    if(this.mode==="play"){
      this.keys.clear();
      this.pointerDirections.clear();
      this.resetJoystick();
      this.clearNavigationTarget();
      this.clearTreasureTarget();
      this.playCameraOffset.x=0;
      this.playCameraOffset.y=0;
      this.playCameraDetached=false;
      this.playCameraRecenterAt=0;
      if(this.recenterButton)this.recenterButton.hidden=true;
      this.zoom=this.playZoom;
      this.selectEntity(null);
    }else{
      this.keys.clear();
      this.pointerDirections.clear();
      this.resetJoystick();
      this.clearNavigationTarget();
      this.clearTreasureTarget();
      this.clearPlayerWake();
      this.nearby=null;
      this.clearCombatTarget({hideAction:true});
      this.closeRegionTransition();
      if(this.actionWrap)this.actionWrap.hidden=true;
      if(this.recenterButton)this.recenterButton.hidden=true;
      this.zoom=clamp(Number(this.zoom||.58),.25,1.5);
    }
    for(const entity of this.entities)this.applyEntityVisual(entity);
    this.resize();
    this.syncGizmo();
  }

  inputVector(){
    const active=new Set([...this.keys,...this.pointerDirections]);
    let x=(active.has("right")?1:0)-(active.has("left")?1:0);
    let y=(active.has("down")?1:0)-(active.has("up")?1:0);

    x+=Number(this.joystick.x)||0;
    y+=Number(this.joystick.y)||0;

    if(x||y){
      const length=Math.hypot(x,y)||1;
      if(length>1){x/=length;y/=length}
      return {x,y};
    }

    if(this.mode==="play"&&this.navigationTarget){
      const target=targetNavigationVector(this.player,this.navigationTarget);
      if(target.arrived){
        this.clearNavigationTarget({brake:true});
        return {x:0,y:0};
      }
      return {x:target.x,y:target.y};
    }

    return {x:0,y:0};
  }

  getPlayableBounds(){
    const worldWidth=Math.max(1,Number(this.config.width)||1);
    const worldHeight=Math.max(1,Number(this.config.height)||1);
    const raw=this.config.playableArea&&typeof this.config.playableArea==="object"?this.config.playableArea:{};
    const left=clamp(Number(raw.x??0)||0,0,Math.max(0,worldWidth-1));
    const top=clamp(Number(raw.y??0)||0,0,Math.max(0,worldHeight-1));
    const width=clamp(Number(raw.width??(worldWidth-left))||(worldWidth-left),1,worldWidth-left);
    const height=clamp(Number(raw.height??(worldHeight-top))||(worldHeight-top),1,worldHeight-top);
    return {left,top,right:left+width,bottom:top+height,width,height};
  }

  getPlayerTravelBounds(){
    const area=this.getPlayableBounds();
    const halfW=Math.max(24,Number(this.config.player?.width||110)/2);
    const halfH=Math.max(24,Number(this.config.player?.height||140)/2);
    if(area.width<=halfW*2||area.height<=halfH*2){
      return {
        left:area.left+area.width/2,
        right:area.left+area.width/2,
        top:area.top+area.height/2,
        bottom:area.top+area.height/2
      };
    }
    return {
      left:area.left+halfW,
      right:area.right-halfW,
      top:area.top+halfH,
      bottom:area.bottom-halfH
    };
  }

  applyPlayableAreaVisual(){
    if(!this.playableBoundaryEl)return;
    const area=this.getPlayableBounds();
    this.playableBoundaryEl.style.left=area.left+"px";
    this.playableBoundaryEl.style.top=area.top+"px";
    this.playableBoundaryEl.style.width=area.width+"px";
    this.playableBoundaryEl.style.height=area.height+"px";
  }

  resize(){
    const rect=this.viewport.getBoundingClientRect();
    this.viewportSize={width:rect.width,height:rect.height};
    this.oceanRenderer?.resize?.(rect.width,rect.height);
    this.clampEditorCamera();
    this.updateCamera(true);
    this.renderMinimap(true);
  }

  clampEditorCamera(){
    if(!this.viewportSize)return;
    const zoom=Math.max(.1,this.zoom||1);
    const halfW=Math.min(this.config.width/2,this.viewportSize.width/(2*zoom));
    const halfH=Math.min(this.config.height/2,this.viewportSize.height/(2*zoom));
    this.camera.x=clamp(this.camera.x,halfW,this.config.width-halfW);
    this.camera.y=clamp(this.camera.y,halfH,this.config.height-halfH);
  }

  playerCollisionRadius(){
    return clamp(
      Number(this.config.player?.collisionRadius)
        ||Math.min(Number(this.config.player?.width||110),Number(this.config.player?.height||150))*.24,
      12,
      180
    );
  }

  collisionDesiredVector(input){
    if(input&&Math.hypot(Number(input.x)||0,Number(input.y)||0)>.001)return input;
    if(this.navigationTarget){
      const dx=this.navigationTarget.x-this.player.x;
      const dy=this.navigationTarget.y-this.player.y;
      const length=Math.hypot(dx,dy)||1;
      return {x:dx/length,y:dy/length};
    }
    const speed=Math.hypot(this.player.vx,this.player.vy)||1;
    return {x:this.player.vx/speed,y:this.player.vy/speed};
  }

  resolvePlayerCollisions(candidate,input){
    const radius=this.playerCollisionRadius();
    const desired=this.collisionDesiredVector(input);
    let x=candidate.x;
    let y=candidate.y;
    let vx=this.player.vx;
    let vy=this.player.vy;
    let contact=null;
    const now=performance.now();

    for(let pass=0;pass<4;pass++){
      let changed=false;
      for(const entity of this.entities){
        if(this.collected.has(entity.id))continue;
        entity.collision=normalizeCollision(entity.collision||{},entity);
        if(!entity.collision.active)continue;

        const hit=resolveCircleVsEntity({x,y},radius,entity,entity.collision);
        if(!hit.collided)continue;

        const action=inferCollisionAction(entity,entity.collision);

        // Collectibles are trigger volumes, not solid obstacles. The previous
        // path pushed the player out and removed velocity before interaction.
        if(action==="collect"){
          if(!contact||hit.penetration>contact.penetration){
            contact={entity,penetration:hit.penetration};
          }
          continue;
        }

        changed=true;
        x=hit.x;
        y=hit.y;

        const cleaned=removeVelocityIntoNormal({x:vx,y:vy},hit.normalX,hit.normalY);
        vx=cleaned.x;
        vy=cleaned.y;

        if(action!=="none"){
          if(!contact||hit.penetration>contact.penetration){
            contact={entity,penetration:hit.penetration};
          }
          if(action==="interact"){
            // Functional islands are docks, not walls to auto-contour around.
            // Resolve penetration once and remove only velocity into the shore.
            // Tangential movement remains under the player's control, which
            // prevents the alternating contour correction that made the ship shake.
            const cleaned=removeVelocityIntoNormal({x:vx,y:vy},hit.normalX,hit.normalY);
            vx=Math.abs(cleaned.x)<1?0:cleaned.x;
            vy=Math.abs(cleaned.y)<1?0:cleaned.y;
            this.navigationTarget=null;
            this.collisionAvoidance={entityId:"",side:0,until:0};
          }
          continue;
        }

        const remembered=this.collisionAvoidance.entityId===entity.id&&this.collisionAvoidance.until>now
          ?this.collisionAvoidance.side
          :0;
        const playerMaxSpeed=Math.max(40,Number(this.config.player?.speed)||420);
        const playerMinSpeed=clamp(Number(this.config.player?.minSpeed)||0,0,playerMaxSpeed);
        const contour=contourVelocity(
          {x:vx,y:vy},
          hit.normalX,
          hit.normalY,
          desired,
          {
            side:remembered,
            minSpeed:Math.max(20,playerMinSpeed||playerMaxSpeed*.25),
            maxSpeed:playerMaxSpeed,
            strength:.72
          }
        );
        vx=contour.x;
        vy=contour.y;
        this.collisionAvoidance={entityId:entity.id,side:contour.side,until:now+520};
      }
      if(!changed)break;
    }

    return {x,y,vx,vy,contact:contact?.entity||null};
  }

  updatePlayer(dt){
    const input=this.inputVector();
    const accel=Math.max(100,Number(this.config.player?.acceleration)||1100);
    const maxSpeed=Math.max(40,Number(this.config.player?.speed)||420);
    const minSpeed=clamp(Number(this.config.player?.minSpeed)||0,0,maxSpeed);
    const braking=clamp(Number(this.config.player?.braking??.12),.01,.98);
    const drag=Math.pow(braking,dt);

    this.player.vx=(this.player.vx+input.x*accel*dt)*drag;
    this.player.vy=(this.player.vy+input.y*accel*dt)*drag;

    let speed=Math.hypot(this.player.vx,this.player.vy);
    const steering=Math.hypot(Number(input.x)||0,Number(input.y)||0);
    if(steering>.001&&speed>0&&speed<minSpeed){
      const scale=minSpeed/speed;
      this.player.vx*=scale;
      this.player.vy*=scale;
      speed=minSpeed;
    }
    if(speed>maxSpeed){
      const scale=maxSpeed/speed;
      this.player.vx*=scale;
      this.player.vy*=scale;
      speed=maxSpeed;
    }

    const travel=this.getPlayerTravelBounds();
    const candidate={
      x:clamp(this.player.x+this.player.vx*dt,travel.left,travel.right),
      y:clamp(this.player.y+this.player.vy*dt,travel.top,travel.bottom)
    };
    const resolved=this.resolvePlayerCollisions(candidate,input);
    this.player.x=clamp(resolved.x,travel.left,travel.right);
    this.player.y=clamp(resolved.y,travel.top,travel.bottom);
    this.player.vx=resolved.vx;
    this.player.vy=resolved.vy;
    // Do not clear a latched functional-island contact on the first frame after
    // penetration resolution. The interaction detector owns release hysteresis.
    if(resolved.contact){
      this.contactEntity=resolved.contact;
    }else if(this.contactEntity){
      const latched=this.contactEntity;
      const latchedAction=inferCollisionAction(latched,normalizeCollision(latched.collision||{},latched));
      const stillNear=latchedAction==="interact"&&resolveCircleVsEntity(
        this.player,
        this.playerCollisionRadius()+72,
        latched,
        latched.collision
      ).collided;
      if(!stillNear)this.contactEntity=null;
    }

    speed=Math.hypot(this.player.vx,this.player.vy);
    if(speed>8){
      this.player.rotation=Math.atan2(this.player.vy,this.player.vx)*180/Math.PI+90;
    }
  }

  syncLocalAuthority(state={}){
    if(this.mode!=="play"||!state||typeof state!=="object")return false;
    const x=Number(state.x),y=Number(state.y);
    if(!Number.isFinite(x)||!Number.isFinite(y))return false;

    // Local movement is predicted immediately. A normal server acknowledgement
    // is necessarily older than the player's current frame, so continuously
    // lerping back to it acts like a permanent brake. Only reconcile when the
    // authoritative position is far enough away to indicate a real divergence.
    const error=Math.hypot(
      x-(Number(this.player?.x)||0),
      y-(Number(this.player?.y)||0)
    );
    if(error<220){
      this.playerAuthorityCorrection=null;
      return false;
    }

    this.player.x=x;
    this.player.y=y;
    if(Number.isFinite(Number(state.vx)))this.player.vx=Number(state.vx);
    if(Number.isFinite(Number(state.vy)))this.player.vy=Number(state.vy);
    if(Number.isFinite(Number(state.rotation)))this.player.rotation=Number(state.rotation);
    if(state.direction)this.player.direction=String(state.direction);
    this.playerAuthorityCorrection=null;
    return true;
  }

  applyLocalAuthorityCorrection(){
    // Prediction remains authoritative for presentation between server acks.
    // Reconciliation is performed atomically in syncLocalAuthority only when
    // the divergence exceeds the safety threshold.
    return false;
  }

  playerWaterEffects(){
    return normalizePlayerWaterEffects(this.config.player||{});
  }

  clearPlayerWake(){
    this.playerWakeLayer?.replaceChildren();
    this.wakeParticleCount=0;
    this.lastWakeSpawn=0;
    this.lastWakeSample=0;
    this.wakeSamples=[];
  }

  updatePlayerWaterEffects(time){
    const effects=this.playerWaterEffects();
    const width=Math.max(24,Number(this.config.player?.width)||108);
    const height=Math.max(24,Number(this.config.player?.height)||150);
    const speed=Math.hypot(this.player.vx,this.player.vy);
    const wakeScale=effects.wakeScale;
    const wakeWidth=effects.wakeWidth*wakeScale;
    const wakeLength=effects.wakeLength*wakeScale;
    const wakeLifetime=clamp(1100+wakeLength*6.2,1600,6200);

    if(this.playerShadowEl){
      this.playerShadowEl.hidden=!effects.shadowActive;
      this.playerShadowEl.style.left=this.player.x+"px";
      const idle=this.playerIdleVisual||{roll:0,heave:0};
      this.playerShadowEl.style.top=(this.player.y+effects.shadowOffset+idle.heave*.35)+"px";
      this.playerShadowEl.style.width=(width*effects.shadowScaleX)+"px";
      this.playerShadowEl.style.height=(height*effects.shadowScaleY)+"px";
      this.playerShadowEl.style.opacity=String(effects.shadowOpacity);
      this.playerShadowEl.style.filter=`blur(${effects.shadowBlur}px)`;
      this.playerShadowEl.style.transform=`translate(-50%,-50%) rotate(${this.player.rotation+idle.roll*.35}deg)`;
    }

    // Keep the world-space trail history even after the ship slows down so the
    // foam can dissipate naturally instead of vanishing with the throttle.
    this.wakeSamples=(this.wakeSamples||[]).filter(sample=>
      Number(time)-Number(sample.time||0)<wakeLifetime
    );

    const webglWake=Boolean(
      this.config.ocean?.renderer==="webgl"
      &&this.oceanRenderer?.ready
    );

    if(
      (this.mode==="play"||this.editorPreviewActive)
      &&effects.wakeActive
      &&speed>=effects.wakeMinSpeed
      &&Number(time)-this.lastWakeSample>=effects.wakeRate
    ){
      this.lastWakeSample=Number(time);

      const angle=this.player.rotation*Math.PI/180;
      const forwardX=Math.sin(angle);
      const forwardY=-Math.cos(angle);
      const sternDistance=height*.35+8;
      const sample={
        x:this.player.x-forwardX*sternDistance,
        y:this.player.y-forwardY*sternDistance,
        heading:this.player.rotation,
        speedFactor:clamp(speed/Math.max(120,Number(this.config.player?.speed)||420),.18,1),
        time:Number(time)
      };

      const list=this.wakeSamples||[];
      const previous=list[list.length-1];
      if(!previous||distance(previous,sample)>=4){
        list.push(sample);
      }

      // Bound trail length in world space. This preserves old points through
      // curves while preventing an endlessly growing GPU vertex buffer.
      let totalDistance=0;
      let keepFrom=Math.max(0,list.length-1);
      const maxPath=wakeLength*(.95+sample.speedFactor*.38);
      for(let i=list.length-1;i>0;i--){
        totalDistance+=distance(list[i],list[i-1]);
        keepFrom=i-1;
        if(totalDistance>=maxPath)break;
      }
      if(keepFrom>0)list.splice(0,keepFrom);
      if(list.length>72)list.splice(0,list.length-72);
      this.wakeSamples=list;
    }

    if(webglWake){
      // The WebGL ocean pass draws the whole wake from wakeSamples in one
      // additional draw call. The old DOM particles remain only as fallback.
      this.playerWakeLayer?.replaceChildren();
      this.wakeParticleCount=0;
      return;
    }

    if(
      !(this.mode==="play"||this.editorPreviewActive)
      ||!effects.wakeActive
      ||speed<effects.wakeMinSpeed
      ||!this.playerWakeLayer
    )return;

    if(time-this.lastWakeSpawn<effects.wakeRate)return;
    this.lastWakeSpawn=time;

    const angle=this.player.rotation*Math.PI/180;
    const forwardX=Math.sin(angle);
    const forwardY=-Math.cos(angle);
    const rightX=Math.cos(angle);
    const rightY=Math.sin(angle);
    const sternDistance=height*.34+10;
    const baseX=this.player.x-forwardX*sternDistance;
    const baseY=this.player.y-forwardY*sternDistance;
    const speedFactor=clamp(speed/420,.2,1);
    const sideOffset=wakeWidth*.23;
    const drift=wakeLength*(.52+.48*speedFactor);
    const duration=clamp(900+wakeLength*4.8,1100,4200);

    const spawn=(side,center=false)=>{
      if(this.wakeParticleCount>=84){
        this.playerWakeLayer.firstElementChild?.remove();
        this.wakeParticleCount=Math.max(0,this.wakeParticleCount-1);
      }

      const puff=document.createElement("span");
      puff.className="tq-world-wake-puff"+(center?" tq-world-wake-puff--center":"");
      const lateral=center?0:side*sideOffset;
      puff.style.left=(baseX+rightX*lateral)+"px";
      puff.style.top=(baseY+rightY*lateral)+"px";
      puff.style.width=(center?wakeWidth*.52:wakeWidth)+"px";
      puff.style.height=(center?Math.max(16,wakeWidth*.46):Math.max(18,wakeWidth*.62))+"px";
      puff.style.setProperty("--wake-opacity",String(effects.wakeOpacity*(center?.55:1)));
      puff.style.setProperty("--wake-rotation",this.player.rotation+"deg");
      puff.style.setProperty("--wake-drift-x",(-forwardX*drift+rightX*side*wakeWidth*.22)+"px");
      puff.style.setProperty("--wake-drift-y",(-forwardY*drift+rightY*side*wakeWidth*.22)+"px");
      puff.style.setProperty("--wake-duration",duration+"ms");
      puff.addEventListener("animationend",()=>{
        if(puff.isConnected){
          puff.remove();
          this.wakeParticleCount=Math.max(0,this.wakeParticleCount-1);
        }
      },{once:true});
      this.playerWakeLayer.append(puff);
      this.wakeParticleCount+=1;
    };

    spawn(-1,false);
    spawn(1,false);
    if(Math.floor(time/effects.wakeRate)%2===0)spawn(0,true);
  }

  updatePlayerVisual(time=performance.now(),dt=1/60){
    const effects=this.playerWaterEffects();
    const speed=Math.hypot(this.player.vx,this.player.vy);
    const idle=(
      this.mode==="play"
      &&effects.idleBalanceActive
      &&speed<=effects.idleBalanceMaxSpeed
    );

    if(idle){
      const blend=1-Math.exp(-Math.max(.001,dt)*4.5);
      this.playerIdleBalanceMix+=(1-this.playerIdleBalanceMix)*blend;
    }else{
      this.playerIdleBalanceMix=0;
    }

    const phase=(Number(time)||0)/Math.max(800,effects.idlePeriod)*Math.PI*2;
    const roll=idle?Math.sin(phase)*effects.idleRoll*this.playerIdleBalanceMix:0;
    const heave=idle?Math.sin(phase*2+.65)*effects.idleHeave*this.playerIdleBalanceMix:0;
    this.playerIdleVisual={roll,heave};

    this.playerEl.style.left=this.player.x+"px";
    this.playerEl.style.top=(this.player.y+heave)+"px";
    if(this.playerNameEl){
      this.playerNameEl.textContent=this.playerDisplayName;
      this.playerNameEl.style.left=this.player.x+"px";
      this.playerNameEl.style.top=((this.player.y+heave)+Math.max(18,Number(this.config.player?.height)||150)*.54+12)+"px";
      this.playerNameEl.hidden=this.mode==="edit";
    }

    const sprite=this.config.player?.sprite;
    const directional=this.config.player?.directions;
    if(sprite?.src&&sprite?.regions){
      this.player.direction=directionForHeading(this.player.rotation,this.player.direction,{hysteresis:4});
      const style=directionalRegionStyle(sprite,this.player.direction);
      if(style)Object.assign(this.playerEl.style,style);
      this.playerEl.dataset.direction=this.player.direction;
      this.playerEl.dataset.renderMode="atlas";
      this.playerEl.style.transform=`translate(-50%,-50%) rotate(${roll}deg)`;
    }else if(directional&&typeof directional==="object"){
      this.player.direction=directionForHeading(this.player.rotation,this.player.direction,{hysteresis:4});
      const nextSrc=resolveDirectionalSource(directional,this.player.direction,this.config.player?.src||"");
      const safe=String(nextSrc||"").replace(/["\\]/g,"");
      this.playerEl.style.backgroundImage=safe?'url("'+safe+'")':"none";
      this.playerEl.style.backgroundSize="contain";
      this.playerEl.style.backgroundPosition="center";
      this.playerEl.style.transform=`translate(-50%,-50%) rotate(${roll}deg)`;
    }else{
      const safe=String(this.config.player?.src||"").replace(/["\\]/g,"");
      this.playerEl.style.backgroundImage=safe?'url("'+safe+'")':"none";
      this.playerEl.style.backgroundSize="contain";
      this.playerEl.style.backgroundPosition="center";
      this.playerEl.style.transform=`translate(-50%,-50%) rotate(${this.player.rotation+roll}deg)`;
    }
  }

  getEntityMotion(id){
    const entity=this.entityByIdGet(id);
    if(!entity)return null;
    return normalizeEntityMotion(entity.motion||defaultEntityMotion(entity.type),entity.type);
  }

  updateEntityMotion(id,patch={},commit=true){
    const entity=this.entityByIdGet(id);
    if(!entity)return null;
    const current=this.getEntityMotion(id)||defaultEntityMotion(entity.type);
    const next=patch.preset&&patch.preset!==current.preset
      ? applyEntityMotionPreset(current,patch.preset,entity.type)
      : current;
    entity.motion=normalizeEntityMotion({...next,...structuredClone(patch)},entity.type);
    this.applyEntityVisual(entity);
    this.syncGizmo();
    const clean=this.getEntity(id);
    this.onEntityChange?.(clean,commit);
    return structuredClone(entity.motion);
  }

  getEntityEffect(id){
    const entity=this.entityByIdGet(id);
    if(!entity)return null;
    entity.effect=normalizeEntityEffect(entity.effect||{},entity);
    return structuredClone(entity.effect);
  }

  listEntityEffectPresets(id){
    const effect=this.getEntityEffect(id);
    if(!effect)return [];
    return listEntityEffectPresets(effect.category);
  }

  updateEntityEffect(id,patch={},commit=true){
    const entity=this.entityByIdGet(id);
    if(!entity)return null;
    const current=this.getEntityEffect(id)||normalizeEntityEffect({},entity);
    const base=patch.preset&&patch.preset!==current.preset
      ?applyEntityEffectPreset(current,patch.preset,entity)
      :current;
    entity.effect=normalizeEntityEffect({...base,...structuredClone(patch)},entity);
    this.entityEffectOrigins.set(id,{x:Number(this.camera.x)||0,y:Number(this.camera.y)||0});
    this.applyEntityVisual(entity);
    this.syncEntityEffectRenderer(entity);
    this.syncGizmo();
    const clean=this.getEntity(id);
    this.onEntityChange?.(clean,commit);
    return structuredClone(entity.effect);
  }

  updateEntityMotionFrame(time,dt=1/60){
    for(const entity of this.entities){
      if(this.collected.has(entity.id)||!entity.el)continue;
      this.updateNpcNavigation(entity,dt);

      const motion=this.getEntityMotion(entity.id);
      const motionFrame=motion?.active
        ?computeEntityMotionFrame(motion,time,(entity.index+1)*1.71,entity.type)
        :{offsetX:0,offsetY:0,rotation:0,scaleY:1};

      const effect=this.getEntityEffect(entity.id)||normalizeEntityEffect({},entity);
      let origin=this.entityEffectOrigins.get(entity.id);
      if(!origin){
        origin={x:Number(this.camera.x)||0,y:Number(this.camera.y)||0};
        this.entityEffectOrigins.set(entity.id,origin);
      }
      const effectFrame=computeEntityEffectFrame(effect,time,(entity.index+1)*2.17,{
        entity,
        camera:this.camera,
        cameraOrigin:origin,
        worldWidth:this.config.width,
        worldHeight:this.config.height
      });

      const offsetX=Number(motionFrame.offsetX||0)+Number(effectFrame.offsetX||0);
      const offsetY=Number(motionFrame.offsetY||0)+Number(effectFrame.offsetY||0);
      const timelineAnimated=hasTimelineSpriteAnimation(entity);
      const hasDirectionalSprite=!timelineAnimated&&Boolean(entity.sprite?.src&&entity.sprite?.regions);
      const rotation=((hasDirectionalSprite||timelineAnimated)?0:Number(entity.rotation||0))+Number(motionFrame.rotation||0)+Number(effectFrame.rotation||0);
      const scaleX=Number(effectFrame.scaleX||1);
      const scaleY=Number(motionFrame.scaleY||1)*Number(effectFrame.scaleY||1);

      entity.visualX=entity.x+offsetX;
      entity.visualY=entity.y+offsetY;
      entity.visualRotation=Number(entity.rotation||0);
      entity.el.style.left=entity.visualX+"px";
      entity.el.style.top=entity.visualY+"px";
      entity.el.style.opacity=String(effect.active?effectFrame.opacity:1);
      entity.el.style.transform=`translate(-50%,-50%) rotate(${rotation}deg) skewX(${Number(entity.skewX||0)}deg) skewY(${Number(entity.skewY||0)}deg) scale(${scaleX},${scaleY})`;
      if(entity.nameEl){
        entity.nameEl.style.left=entity.visualX+"px";
        entity.nameEl.style.top=(entity.visualY+Math.max(18,Number(entity.height)||96)*Math.abs(scaleY)*.54+10)+"px";
        entity.nameEl.hidden=entity.el.hidden===true;
      }
      if(timelineAnimated)this.applyEntityTimelineVisual(entity,time);
      else if(hasDirectionalSprite)this.applyEntityDirectionalVisual(entity);

      const img=entity.el.querySelector(":scope > img:not(.tq-world-island-depth-layer)");
      const canvas=entity.el.querySelector(".tq-world-entity__webgl");
      const blur=effect.active?Number(effectFrame.blur||0):0;
      const depthLayer=entity.el.querySelector(".tq-world-island-depth-layer");
      const maskedDepth=String(entity.type||"")==="island"&&Array.isArray(entity.depthMask?.points)&&entity.depthMask.points.length>=3;
      if(img)img.style.filter=maskedDepth?"drop-shadow(0 6px 4px #001a2e80)":`drop-shadow(0 6px 4px #001a2e80) blur(${blur}px)`;
      if(depthLayer)depthLayer.style.filter=`blur(${blur}px)`;

      const atlasMode=timelineAnimated||hasDirectionalSprite||entity.el.dataset.renderMode==="atlas";
      if(effect.active&&effect.renderer==="webgl"&&!atlasMode){
        const renderer=this.entityEffectRenderers.get(entity.id);
        const rendered=renderer?.render?.(time,effect,entity.width||96,entity.height||96)===true;
        if(canvas)canvas.hidden=!rendered;
        if(img)img.hidden=rendered;
      }else{
        if(canvas)canvas.hidden=true;
        if(img)img.hidden=atlasMode;
      }
    }
  }

  updateCameraKeyboard(dt=1/60){
    if(this.mode!=="play"||!this.cameraKeys?.size||!this.viewportSize)return false;
    let x=(this.cameraKeys.has("right")?1:0)-(this.cameraKeys.has("left")?1:0);
    let y=(this.cameraKeys.has("down")?1:0)-(this.cameraKeys.has("up")?1:0);
    if(!x&&!y)return false;
    const length=Math.hypot(x,y)||1;
    x/=length;y/=length;
    const zoom=Math.max(.1,this.playZoom||1);
    const speed=720/zoom;
    const halfW=Math.min(this.config.width/2,this.viewportSize.width/(2*zoom));
    const halfH=Math.min(this.config.height/2,this.viewportSize.height/(2*zoom));
    this.playCameraDetached=true;
    this.playCameraRecenterAt=0;
    this.camera.x=clamp(this.camera.x+x*speed*dt,halfW,this.config.width-halfW);
    this.camera.y=clamp(this.camera.y+y*speed*dt,halfH,this.config.height-halfH);
    if(this.recenterButton)this.recenterButton.hidden=false;
    return true;
  }

  updateCamera(immediate=false,dt=1/60){
    if(!this.viewportSize)return;
    const vw=this.viewportSize.width;
    const vh=this.viewportSize.height;

    if(this.mode==="play"){
      // Keep gameplay camera scale fixed. Combat never changes zoom or entity size.
      this.combatCameraZoom=this.playZoom;
      this.zoom=this.playZoom;

      const halfW=Math.min(this.config.width/2,vw/(2*this.playZoom));
      const halfH=Math.min(this.config.height/2,vh/(2*this.playZoom));

      if(this.playCameraDetached&&this.playCameraRecenterAt>0&&performance.now()>=this.playCameraRecenterAt){
        this.playCameraDetached=false;
        this.playCameraRecenterAt=0;
        if(this.recenterButton)this.recenterButton.hidden=true;
      }

      if(this.playCameraDetached){
        this.camera.x=clamp(this.camera.x,halfW,this.config.width-halfW);
        this.camera.y=clamp(this.camera.y,halfH,this.config.height-halfH);
      }else{
        const target={
          x:clamp(Number(this.player?.x)||0,halfW,this.config.width-halfW),
          y:clamp(Number(this.player?.y)||0,halfH,this.config.height-halfH)
        };
        if(immediate){
          this.camera.x=target.x;
          this.camera.y=target.y;
        }else{
          const next=cameraFollowStep(this.camera,target,dt,4.5);
          this.camera.x=next.x;
          this.camera.y=next.y;
        }
      }
    }else{
      this.clampEditorCamera();
    }

    const zoom=Math.max(.1,this.zoom||1);
    const tx=Math.round(vw/2-this.camera.x*zoom);
    const ty=Math.round(vh/2-this.camera.y*zoom);
    this.stage.style.transform=`translate3d(${tx}px,${ty}px,0) scale(${zoom})`;
    this.syncGizmo();
  }

  bindRegionTransitionControls(){
    const cancel=()=>this.closeRegionTransition({dismiss:true});
    const confirm=()=>this.confirmRegionTransition();
    this.regionTransitionCancel?.addEventListener("click",cancel);
    this.regionTransitionConfirm?.addEventListener("click",confirm);
    this.cleanups.push(()=>{
      this.regionTransitionCancel?.removeEventListener("click",cancel);
      this.regionTransitionConfirm?.removeEventListener("click",confirm);
    });
  }

  openRegionTransition(entity){
    if(!entity||this.regionTransitionActive)return;
    if(this.canEnterWorld&&!this.canEnterWorld(entity))return;
    this.stopForChallenge();
    this.regionTransitionActive=entity;
    const destination=String(entity.destinationWorldName||entity.destinationWorldId||"próxima região");
    const message=String(entity.transitionMessage||"Deseja navegar para "+destination+"?");
    if(this.regionTransitionMessage)this.regionTransitionMessage.textContent=message;
    if(this.regionTransitionConfirm)this.regionTransitionConfirm.textContent=String(entity.transitionActionLabel||"Navegar");
    if(this.regionTransitionWrap)this.regionTransitionWrap.hidden=false;
  }

  closeRegionTransition({dismiss=false}={}){
    if(dismiss&&this.regionTransitionActive?.id)this.regionExitDismissedId=this.regionTransitionActive.id;
    this.regionTransitionActive=null;
    if(this.regionTransitionWrap)this.regionTransitionWrap.hidden=true;
  }

  confirmRegionTransition(){
    const entity=this.regionTransitionActive;
    if(!entity)return;
    const clean=this.cleanEntity(entity);
    const state=this.getState();
    const interaction=this.entityInteraction(entity);
    this.closeRegionTransition();

    if(interaction?.actionId==="enter-region"&&this.onExecuteAction){
      this.onExecuteAction(interaction,clean,state);
      return;
    }
    if(entity.destinationWorldId&&this.onEnterWorld)this.onEnterWorld(clean,state);
  }

  bindChallengeControls(){
    const submit=event=>{
      event.preventDefault();
      this.submitTreasureAnswer();
    };
    const close=()=>this.closeTreasureChallenge();
    this.challengeForm?.addEventListener("submit",submit);
    const chooseRepair=event=>{
      const button=event.target.closest?.("[data-repair-answer]");
      if(!button||button.disabled)return;
      this.submitTreasureAnswer(button.dataset.repairAnswer,button);
    };
    this.challengeClose?.addEventListener("click",close);
    this.repairOptions?.addEventListener("click",chooseRepair);
    this.cleanups.push(()=>{
      this.challengeForm?.removeEventListener("submit",submit);
      this.challengeClose?.removeEventListener("click",close);
      this.repairOptions?.removeEventListener("click",chooseRepair);
    });
  }

  bindCombatControls(){
    const choose=event=>{
      const button=event.target.closest?.("[data-combat-answer]");
      if(!button||button.disabled)return;
      this.submitCombatAnswer(button.dataset.combatAnswer,button);
    };
    const close=()=>this.closeCombat();
    this.combatOptions?.addEventListener("click",choose);
    this.combatClose?.addEventListener("click",close);
    this.cleanups.push(()=>{
      this.combatOptions?.removeEventListener("click",choose);
      this.combatClose?.removeEventListener("click",close);
    });
  }

  combatHearts(value,max=3){
    const count=Math.max(0,Math.min(max,Number(value)||0));
    return "❤".repeat(count)+"♡".repeat(Math.max(0,max-count));
  }

  updateCombatHud(){
    const active=this.combatActive;
    if(!active)return;
    const maxEnemy=Math.max(1,Number(active.enemyMaxHp)||3);
    const maxPlayer=Math.max(1,Number(active.playerMaxHp)||3);
    if(this.combatEnemyHp)this.combatEnemyHp.textContent=this.combatHearts(active.enemyHp,maxEnemy);
    if(this.combatPlayerHp)this.combatPlayerHp.textContent=this.combatHearts(active.playerHp,maxPlayer);
    this.updateCombatDamageState();
  }

  updateCombatDamageState(){
    const active=this.combatActive;
    if(!active)return;
    const sync=(ship,hp,max)=>{
      if(!ship)return;
      ship.classList.remove("is-damaged","is-critical","is-defeated");
      const safeHp=Math.max(0,Number(hp)||0);
      const safeMax=Math.max(1,Number(max)||3);
      if(safeHp<=0){
        ship.classList.add("is-defeated");
      }else if(safeHp<=Math.max(1,Math.floor(safeMax/3))){
        ship.classList.add("is-critical");
      }else if(safeHp<safeMax){
        ship.classList.add("is-damaged");
      }
    };
    sync(this.combatPlayerShip,active.playerHp,active.playerMaxHp);
    sync(this.combatEnemyShip,active.enemyHp,active.enemyMaxHp);
  }

  playCombatShipAction(side="player",action="fire"){
    const ship=side==="enemy"?this.combatEnemyShip:this.combatPlayerShip;
    if(!ship)return;
    const className=action==="hit"?"is-taking-hit":"is-firing";
    ship.classList.remove(className);
    void ship.offsetWidth;
    ship.classList.add(className);
    setTimeout(()=>ship.classList.remove(className),action==="hit"?1280:980);
  }

  playCombatDamageFx(side="player"){
    this.playCombatShipAction(side,"hit");
  }

  clearCombatFx(){
    for(const el of [this.combatShot,this.combatSplash,this.combatHit]){
      if(!el)continue;
      el.className=el.className.split(" ").filter(token=>!token.startsWith("is-")).join(" ");
      el.hidden=true;
    }
  }

  playCombatFx({from="player",hit=false}={}){
    if(this.combatFxTimer){
      clearTimeout(this.combatFxTimer);
      this.combatFxTimer=0;
    }
    this.clearCombatFx();
    this.playCombatShipAction(from,"fire");
    if(this.combatShot){
      this.combatShot.hidden=false;
      this.combatShot.classList.add(from==="enemy"?"is-enemy-shot":"is-player-shot",hit?"is-hit":"is-miss");
    }
    const target=hit?this.combatHit:this.combatSplash;
    if(target){
      target.hidden=false;
      target.classList.add(from==="enemy"?"is-enemy-result":"is-player-result");
    }
    this.combatFxTimer=setTimeout(()=>{
      this.combatFxTimer=0;
      this.clearCombatFx();
    },1280);
  }

  clearAnswerFeedback({wrap=this.challengeWrap,feedback=this.challengeFeedback,options=this.repairOptions}={}){
    wrap?.classList.remove("is-answer-correct","is-answer-wrong");
    if(feedback)delete feedback.dataset.state;
    options?.querySelectorAll("button").forEach(button=>{
      button.classList.remove("is-correct","is-wrong","is-muted","is-reveal-correct");
    });
  }

  showAnswerFeedback({correct=false,selectedButton=null,expected=null,message="",wrap=this.challengeWrap,feedback=this.challengeFeedback,options=this.repairOptions,revealExpected=true}={}){
    this.clearAnswerFeedback({wrap,feedback,options});
    const state=correct===true?"correct":"wrong";
    wrap?.classList.add("is-answer-"+state);
    if(feedback){
      feedback.dataset.state=state;
      feedback.textContent=String(message||"");
    }
    const buttons=[...(options?.querySelectorAll("button")||[])];
    for(const button of buttons){
      const raw=button.dataset.repairAnswer??button.dataset.combatAnswer??button.textContent;
      const isExpected=expected!==null&&String(raw??"").trim()===String(expected).trim();
      if(button===selectedButton)button.classList.add(correct===true?"is-correct":"is-wrong");
      else button.classList.add("is-muted");
      if(correct!==true&&revealExpected&&isExpected){
        button.classList.remove("is-muted");
        button.classList.add("is-correct","is-reveal-correct");
      }
    }
    try{
      if(navigator.vibrate)navigator.vibrate(correct===true?35:[45,55,45]);
    }catch{}
  }

  combatChoices(challenge){
    const a=Math.max(1,Number(challenge?.a)||1);
    const b=Math.max(1,Number(challenge?.b)||1);
    const correct=a*b;
    const candidates=[
      correct,
      a*Math.max(1,b-1),
      a*Math.min(10,b+1),
      Math.max(1,a-1)*b,
      Math.min(10,a+1)*b,
      correct+a,
      Math.max(1,correct-a),
      correct+b,
      Math.max(1,correct-b),
      Math.max(1,correct-1),
      Math.min(100,correct+1)
    ].map(value=>Math.max(1,Math.min(100,Math.round(value))));
    const unique=[correct,...candidates.filter(value=>value!==correct)];
    const selected=[correct];
    for(const value of unique){
      if(selected.length>=4)break;
      if(!selected.includes(value))selected.push(value);
    }
    for(let delta=2;selected.length<4&&delta<=12;delta++){
      for(const value of [correct-delta,correct+delta]){
        const safe=Math.max(1,Math.min(100,value));
        if(!selected.includes(safe))selected.push(safe);
        if(selected.length>=4)break;
      }
    }
    return selected.slice(0,4).sort(()=>Math.random()-.5);
  }

  renderCombatChoices(challenge){
    if(!this.combatOptions)return;
    this.combatOptions.replaceChildren();
    if(!challenge?.available)return;
    const choices=this.combatChoices(challenge);
    for(const value of choices){
      const button=document.createElement("button");
      button.type="button";
      button.className="tq-world-combat__option";
      button.dataset.combatAnswer=String(value);
      button.textContent=String(value);
      this.combatOptions.append(button);
    }
  }

  combatSource(side="player",entity=null){
    return side==="enemy"?(entity||this.combatActive?.entity):this.config.player;
  }

  v2CombatAtlas(source,animationName="idle"){
    const combat=source?.combatVisual||source?.combat;
    const sprite=combat?.useNavigationAtlas===true
      ?source?.sprite
      :combat?.sprite;
    const animation=combat?.animations?.[animationName];
    if(sprite?.src){
      const imageWidth=Math.max(1,Number(sprite.imageWidth)||0);
      const imageHeight=Math.max(1,Number(sprite.imageHeight)||0);
      let columns=Math.max(1,Number(sprite.columns)||4);
      let rows=Math.max(1,Number(sprite.rows)||4);
      let frameWidth=Math.max(1,Number(sprite.cellWidth||sprite.frameWidth)||400);
      let frameHeight=Math.max(1,Number(sprite.cellHeight||sprite.frameHeight)||400);
      const declaredGridValid=
        imageWidth>0&&imageHeight>0
        &&columns*frameWidth===imageWidth
        &&rows*frameHeight===imageHeight;
      if(!declaredGridValid&&imageWidth>0&&imageHeight>0){
        const supported=[400,600,800].find(size=>
          imageWidth%size===0
          &&imageHeight%size===0
          &&imageWidth/size<=32
          &&imageHeight/size<=32
        );
        if(supported){
          columns=Math.max(1,Math.round(imageWidth/supported));
          rows=Math.max(1,Math.round(imageHeight/supported));
          frameWidth=supported;
          frameHeight=supported;
        }
      }
      return {
        src:String(sprite.src),
        columns,
        rows,
        imageWidth,
        imageHeight,
        frameWidth,
        frameHeight,
        idleFrame:Number(combat?.animations?.idle?.frames?.[0])||0,
        animations:{
          [animationName]:{
            frames:Array.isArray(animation?.frames)?animation.frames.map(Number).filter(Number.isFinite):[],
            frameMs:Number(animation?.frameMs)||140,
            loop:animation?.loop===true
          }
        }
      };
    }
    const descriptor=combat?.compiled?.[animationName];
    if(!descriptor?.src)return null;
    const frameCount=Math.max(1,Number(descriptor.frameCount)||1);
    return {
      src:descriptor.src,
      columns:Math.max(1,Number(descriptor.columns)||1),
      rows:Math.max(1,Number(descriptor.rows)||1),
      frameWidth:Number(descriptor.frameWidth)||400,
      frameHeight:Number(descriptor.frameHeight)||400,
      idleFrame:0,
      animations:{
        [animationName]:{
          frames:Array.from({length:frameCount},(_,index)=>index),
          frameMs:Number(descriptor.frameMs)||140,
          loop:descriptor.loop!==false
        }
      }
    };
  }

  combatSpriteConfig(){
    // Combat keeps the current directional ship frame. Visual feedback is dynamic.
    return null;
  }

  combatShipElement(side="player"){
    return side==="enemy"?this.combatEnemyShip:this.combatPlayerShip;
  }

  applyCombatSpriteFrame(side="player",frame=0,entity=null,animationName="idle"){
    const sprite=this.combatSpriteConfig(side,entity,animationName);
    const shipEl=this.combatShipElement(side);
    if(!sprite||!shipEl)return false;
    const columns=Math.max(1,Number(sprite.columns)||4);
    const rows=Math.max(1,Number(sprite.rows)||4);
    const index=Math.max(0,Math.min(columns*rows-1,Number(frame)||0));
    const column=index%columns;
    const row=Math.floor(index/columns);
    const safe=String(sprite.src||"").replace(/["\\]/g,"");
    shipEl.style.backgroundImage=safe?'url("'+safe+'")':"none";
    shipEl.style.backgroundSize=(columns*100)+"% "+(rows*100)+"%";
    shipEl.style.backgroundPosition=
      (columns===1?0:(column/(columns-1))*100)+"% "+
      (rows===1?0:(row/(rows-1))*100)+"%";
    shipEl.style.backgroundRepeat="no-repeat";
    return true;
  }

  playCombatSpriteAnimation(side="player",name="fireRight",entity=null){
    const sprite=this.combatSpriteConfig(side,entity,name);
    const animation=sprite?.animations?.[name];
    const frames=Array.isArray(animation?.frames)?animation.frames:[];
    if(!sprite||!frames.length)return false;
    const currentTimer=this.combatSpriteTimers?.[side];
    if(currentTimer)clearTimeout(currentTimer);
    const frameMs=Math.max(60,Math.min(500,Number(animation.frameMs)||135));
    let cursor=0;
    const step=()=>{
      if(!this.combatActive)return;
      this.applyCombatSpriteFrame(side,frames[cursor],entity,name);
      cursor+=1;
      if(cursor<frames.length){
        this.combatSpriteTimers[side]=setTimeout(step,frameMs);
      }else{
        this.combatSpriteTimers[side]=setTimeout(()=>{
          this.combatSpriteTimers[side]=0;
          const idle=this.combatSpriteConfig(side,entity,"idle");
          if(idle)this.applyCombatSpriteFrame(side,Number(idle.idleFrame)||0,entity,"idle");
          else this.syncCombatShip(side,entity);
        },frameMs);
      }
    };
    step();
    return true;
  }

  syncCombatShip(side="player",entity=null){
    const shipEl=this.combatShipElement(side);
    if(!shipEl)return;
    const combatSprite=this.combatSpriteConfig(side,entity,"idle");
    if(combatSprite){
      this.applyCombatSpriteFrame(side,Number(combatSprite.idleFrame)||0,entity,"idle");
      shipEl.classList.add("has-combat-sprite");
    }else{
      shipEl.classList.remove("has-combat-sprite");
      if(side==="player"&&this.playerEl){
        this.updatePlayerVisual(performance.now(),1/60);
        const source=this.playerEl.style;
        for(const property of ["backgroundImage","backgroundSize","backgroundPosition","backgroundRepeat"]){
          shipEl.style[property]=source[property]||"";
        }
      }else{
        const safe=String(entity?.src||"").replace(/["\\]/g,"");
        shipEl.style.backgroundImage=safe?'url("'+safe+'")':"none";
        shipEl.style.backgroundSize="contain";
        shipEl.style.backgroundPosition="center";
        shipEl.style.backgroundRepeat="no-repeat";
      }
    }
    const source=this.combatSource(side,entity);
    const style=source?.combatVisual||source?.combat||{};
    const recoil=Math.max(0,Number(style.recoil)||18);
    const shake=Math.max(0,Number(style.shake)||5);
    shipEl.style.setProperty("--ship-recoil",recoil+"px");
    shipEl.style.setProperty("--ship-recoil-neg",(-recoil)+"px");
    shipEl.style.setProperty("--ship-shake",shake+"px");
    shipEl.style.setProperty("--ship-shake-neg",(-shake)+"px");
    shipEl.dataset.muzzleFlash=style.muzzleFlash===false?"off":"on";
    shipEl.dataset.smoke=style.smoke===false?"off":"on";
    shipEl.dataset.impact=style.impact===false?"off":"on";
    shipEl.style.removeProperty("transform");
  }

  syncCombatPlayerShip(){
    this.syncCombatShip("player");
  }

  syncCombatEnemyShip(entity=this.combatActive?.entity){
    this.syncCombatShip("enemy",entity);
  }

  closeCombat(){
    if(this.combatTimer){clearTimeout(this.combatTimer);this.combatTimer=0}
    for(const side of ["player","enemy"]){
      if(this.combatSpriteTimers?.[side])clearTimeout(this.combatSpriteTimers[side]);
      if(this.combatSpriteTimers)this.combatSpriteTimers[side]=0;
    }
    if(this.combatFxTimer){clearTimeout(this.combatFxTimer);this.combatFxTimer=0}
    this.combatActive=null;
    for(const ship of [this.combatPlayerShip,this.combatEnemyShip]){
      ship?.classList.remove("is-taking-hit","is-firing","is-damaged","is-critical","is-defeated");
    }
    this.clearAnswerFeedback({wrap:this.combatWrap,feedback:this.combatFeedback,options:this.combatOptions});
    if(this.combatWrap)this.combatWrap.hidden=true;
    if(this.combatFeedback)this.combatFeedback.textContent="";
    if(this.combatOptions)this.combatOptions.replaceChildren();
    this.clearCombatFx();
  }

  async loadCombatRound(){
    const active=this.combatActive;
    if(!active)return;
    let challenge=null;
    try{
      challenge=this.createPedagogyChallenge
        ?await this.createPedagogyChallenge({entity:this.cleanEntity(active.entity),worldState:this.getState()})
        :null;
    }catch(error){
      console.warn("Combat pedagogy challenge creation failed",error);
    }
    if(!this.combatActive||this.combatActive.entity.id!==active.entity.id)return;
    active.challenge=challenge;
    this.clearAnswerFeedback({wrap:this.combatWrap,feedback:this.combatFeedback,options:this.combatOptions});
    if(this.combatPrompt)this.combatPrompt.textContent=challenge?.available?String(challenge.prompt||""):"Desafio indisponível";
    if(this.combatFeedback)this.combatFeedback.textContent=challenge?.available?"Escolha uma das quatro respostas.":"Não foi possível gerar uma conta para este combate.";
    this.renderCombatChoices(challenge);
    this.updateCombatHud();
  }

  async beginCombat(entity){
    if(!entity||this.combatActive||this.challengeActive||this.mode!=="play")return;
    this.beginPedagogyProtection();
    this.stopForChallenge();
    this.clearCombatTarget({hideAction:false});
    this.actionWrap.hidden=true;
    const enemyMaxHp=Math.max(1,Math.min(20,Number(entity.combat?.hp)||3));
    const playerMaxHp=Math.max(1,Math.min(9,Number(this.config.combat?.playerHp)||3));
    this.combatActive={entity,enemyMaxHp,enemyHp:enemyMaxHp,playerMaxHp,playerHp:playerMaxHp,challenge:null};
    this.applyEnvironmentVisual();
    if(this.combatTitle)this.combatTitle.textContent=String(entity.label||"Navio inimigo");
    if(this.combatWrap)this.combatWrap.hidden=false;
    this.syncCombatPlayerShip();
    this.syncCombatEnemyShip(entity);
    this.updateCombatHud();
    this.clearCombatFx();
    await this.loadCombatRound();
  }

  submitCombatAnswer(raw,selectedButton=null){
    const active=this.combatActive;
    const challenge=active?.challenge;
    if(!active||!challenge?.available||typeof challenge.evaluate!=="function")return;
    if(String(raw??"").trim()==="")return;
    const result=challenge.evaluate(raw)||{};
    this.onPedagogyResult?.({
      entityId:String(active.entity.id||""),
      challengeId:String(challenge.id||""),
      operation:String(challenge.operation||challenge.kind||"multiplication"),
      a:Number(challenge.a),b:Number(challenge.b),answer:result.answer,
      correct:result.correct===true,region:Number(challenge.region)||null,
      bonus:false,countsTowardPlanned:challenge.countsTowardPlanned!==false
    });
    this.combatOptions?.querySelectorAll("button").forEach(button=>{button.disabled=true});

    if(result.correct===true){
      active.enemyHp=Math.max(0,active.enemyHp-1);
      this.showAnswerFeedback({
        correct:true,selectedButton,expected:result.expected,
        message:"✓ ACERTOU! Seu canhão atingiu o inimigo.",
        wrap:this.combatWrap,feedback:this.combatFeedback,options:this.combatOptions
      });
      this.playCombatSpriteAnimation("player","fireRight");
      this.playCombatFx({from:"player",hit:true});
      setTimeout(()=>this.playCombatDamageFx("enemy"),820);
      if(active.enemyHp>0)setTimeout(()=>{
        this.playCombatSpriteAnimation("enemy","fireLeft",active.entity);
        this.playCombatFx({from:"enemy",hit:false});
      },1120);
    }else{
      active.playerHp=Math.max(0,active.playerHp-1);
      this.showAnswerFeedback({
        correct:false,selectedButton,expected:result.expected,
        message:"✕ ERROU. O inimigo acertou seu navio.",
        wrap:this.combatWrap,feedback:this.combatFeedback,options:this.combatOptions
      });
      this.playCombatSpriteAnimation("player","fireRight");
      this.playCombatFx({from:"player",hit:false});
      setTimeout(()=>{
        this.playCombatSpriteAnimation("enemy","fireLeft",active.entity);
        this.playCombatFx({from:"enemy",hit:true});
      },1120);
      setTimeout(()=>this.playCombatDamageFx("player"),1900);
    }
    this.updateCombatHud();

    if(active.enemyHp<=0){
      this.completeCollection(active.entity);
      this.onCombatVictory?.({
        entity:this.cleanEntity(active.entity),
        rewards:structuredClone(active.entity?.rewards||{})
      });
      if(this.combatFeedback){
        const rewards=active.entity?.rewards||{};
        const parts=[];
        if(Number(rewards.coins)>0)parts.push(Number(rewards.coins)+" moedas");
        if(Number(rewards.xp)>0)parts.push(Number(rewards.xp)+" XP");
        if(rewards.itemId)parts.push((Number(rewards.quantity)||1)+"× "+String(rewards.itemId));
        if(rewards.shipId)parts.push("navio "+String(rewards.shipId));
        this.combatFeedback.textContent=parts.length
          ?"Navio inimigo derrotado! Recompensa: "+parts.join(" · ")+"."
          :"Navio inimigo derrotado!";
      }
      this.combatTimer=setTimeout(()=>this.closeCombat(),2650);
      return;
    }
    if(active.playerHp<=0){
      if(this.combatFeedback)this.combatFeedback.textContent="Seu navio perdeu o duelo. Afaste-se e tente novamente.";
      this.combatTimer=setTimeout(()=>this.closeCombat(),3150);
      return;
    }
    this.combatTimer=setTimeout(async()=>{
      this.combatTimer=0;
      await this.loadCombatRound();
    },2850);
  }

  async loadPlayerRepairRound(){
    const active=this.repairActive;
    if(!active)return;
    let challenge=null;
    const repairEntity={id:"player-repair",type:"repair",label:"Reparo do navio"};
    try{
      challenge=this.createPedagogyChallenge
        ?await this.createPedagogyChallenge({entity:repairEntity,worldState:this.getState()})
        :null;
    }catch(error){
      console.warn("Repair pedagogy challenge creation failed",error);
    }
    if(!this.repairActive||this.repairActive!==active)return;
    active.challenge=challenge;
    this.clearAnswerFeedback();
    this.challengeActive={entity:repairEntity,challenge,kind:"repair"};
    if(this.challengeWrap){this.applyPopupLayout("repair-ship");this.challengeWrap.hidden=false;this.challengeWrap.classList.remove("is-treasure-challenge");this.challengeWrap.classList.add("is-repair-challenge")}
    if(this.challengeForm){this.challengeForm.hidden=true;this.challengeForm.style.display="none"}
    if(this.repairHp){this.repairHp.hidden=false;const pct=Math.max(0,Math.min(100,this.navalPlayerHp/Math.max(1,this.navalPlayerMaxHp)*100));if(this.repairHpFill)this.repairHpFill.style.width=pct+"%";if(this.repairHpLabel)this.repairHpLabel.textContent="Casco "+this.navalPlayerHp+"/"+this.navalPlayerMaxHp;}
    if(this.repairOptions){
      this.repairOptions.hidden=false;
      this.repairOptions.replaceChildren();
      if(challenge?.available){
        for(const value of this.combatChoices(challenge)){
          const button=document.createElement("button");
          button.type="button";
          button.className="tq-world-combat__option";
          button.dataset.repairAnswer=String(value);
          button.textContent=String(value);
          this.repairOptions.append(button);
        }
      }
    }
    if(this.challengePrompt)this.challengePrompt.textContent=challenge?.available
      ?String(challenge.prompt||"")
      :"Desafio indisponível";
    if(this.challengeFeedback)this.challengeFeedback.textContent=challenge?.available
      ?"Cada acerto recupera 25% do casco total. Casco: "+this.navalPlayerHp+"/"+this.navalPlayerMaxHp
      :"Não foi possível gerar uma conta de multiplicação.";
    if(this.challengeAnswer){
      this.challengeAnswer.value="";
      this.challengeAnswer.disabled=!challenge?.available;
    }
    if(this.challengeSubmit)this.challengeSubmit.disabled=!challenge?.available;
    if(this.challengeClose){
      this.challengeClose.hidden=active.forced===true;
      this.challengeClose.disabled=active.forced===true;
    }
    queueMicrotask(()=>this.challengeAnswer?.focus?.());
  }

  async beginPlayerRepair({forced=false}={}){
    if(this.mode!=="play"||this.navalPlayerHp>=this.navalPlayerMaxHp)return false;
    if(!forced&&this.canRepairPlayer({hp:this.navalPlayerHp,maxHp:this.navalPlayerMaxHp})!==true)return false;
    if(this.repairActive){
      if(forced===true&&this.repairActive.forced!==true){
        this.beginPedagogyProtection();
        this.repairActive.forced=true;
        this.repairActive.challenge=null;
        this.stopForChallenge();
        this.clearCombatTarget({hideAction:true});
        this.navalAutoFire=false;
        this.navalNextShotAt=0;
        if(this.challengeTimer){clearTimeout(this.challengeTimer);this.challengeTimer=0}
        this.challengeActive=null;
        await this.loadPlayerRepairRound();
        return true;
      }
      return false;
    }
    if(!forced&&(this.navalPlayerHp<=0||this.isPlayerInNavalCombat()))return false;
    this.beginPedagogyProtection();
    this.stopForChallenge();
    this.clearCombatTarget({hideAction:true});
    this.navalAutoFire=false;
    this.navalNextShotAt=0;
    this.repairActive={forced:forced===true,challenge:null};
    await this.loadPlayerRepairRound();
    return true;
  }

  closePlayerRepair({completed=false}={}){
    const active=this.repairActive;
    if(!active)return false;
    if(active.forced&&!completed&&this.navalPlayerHp<this.navalPlayerMaxHp)return false;
    this.repairActive=null;
    this.challengeActive=null;
    this.endPedagogyProtection();
    if(this.challengeTimer){clearTimeout(this.challengeTimer);this.challengeTimer=0}
    if(this.challengeWrap){this.challengeWrap.hidden=true;this.challengeWrap.classList.remove("is-repair-challenge");this.challengeWrap.style.removeProperty("--tq-popup-layout")}
    if(this.challengeForm){this.challengeForm.hidden=false;this.challengeForm.style.removeProperty("display")}
    if(this.repairHp)this.repairHp.hidden=true;
    if(this.repairOptions){this.repairOptions.hidden=true;this.repairOptions.replaceChildren()}
    this.clearAnswerFeedback();
    if(this.challengeFeedback)this.challengeFeedback.textContent="";
    if(this.challengeAnswer){
      this.challengeAnswer.value="";
      this.challengeAnswer.disabled=false;
    }
    if(this.challengeSubmit)this.challengeSubmit.disabled=false;
    if(this.challengeClose){
      this.challengeClose.hidden=false;
      this.challengeClose.disabled=false;
    }
    if(completed){
      this.playerEl?.classList.remove("is-player-sunk");
      this.onRuntimeStateChange?.();
      this.onRepairCompleted?.({hp:this.navalPlayerHp,maxHp:this.navalPlayerMaxHp});
    }
    return true;
  }

  stopForChallenge(){
    this.keys.clear();
    this.pointerDirections.clear();
    this.resetJoystick();
    this.clearNavigationTarget({brake:true});
    this.player.vx=0;
    this.player.vy=0;
  }

  closeTreasureChallenge(){
    if(this.repairActive){
      this.closePlayerRepair({completed:false});
      return;
    }
    if(this.challengeTimer){
      clearTimeout(this.challengeTimer);
      this.challengeTimer=0;
    }
    this.challengeActive=null;
    this.endPedagogyProtection();
    if(this.challengeKicker)this.challengeKicker.textContent="BAÚ DO TESOURO";
    if(this.challengeTitle)this.challengeTitle.textContent="Resolva para recolher";
    if(this.challengeWrap){this.challengeWrap.hidden=true;this.challengeWrap.classList.remove("is-treasure-challenge");this.challengeWrap.style.removeProperty("--tq-popup-layout")}
    if(this.challengeForm){this.challengeForm.hidden=true;this.challengeForm.style.display="none"}
    if(this.repairOptions){this.repairOptions.hidden=true;this.repairOptions.replaceChildren()}
    if(this.challengeFeedback)this.challengeFeedback.textContent="";
    if(this.challengeAnswer){
      this.challengeAnswer.value="";
      this.challengeAnswer.disabled=false;
    }
    if(this.challengeSubmit)this.challengeSubmit.disabled=false;
  }

  hasPlayerAmmo(){
    return (Array.isArray(this.ammoCatalog)?this.ammoCatalog:[]).some(item=>{
      if(!item||item.available===false)return false;
      const id=String(item.id||"");
      return id&&Math.max(0,Math.floor(Number(this.state?.ammo?.stock?.[id])||0))>0;
    });
  }

  async beginStarterAmmoChallenge(){
    if(this.challengeActive||this.mode!=="play"||this.navalPlayerHp<=0)return false;
    if(this.hasPlayerAmmo())return false;
    this.beginPedagogyProtection();

    this.stopNavalAutoFire({keepTarget:true});
    this.stopForChallenge();
    if(this.actionWrap)this.actionWrap.hidden=true;

    const entity={
      id:"starter-ammo-rescue",
      type:"ammo-rescue",
      label:"Munição básica"
    };
    let challenge=null;
    try{
      challenge=this.createPedagogyChallenge
        ?await this.createPedagogyChallenge({entity,worldState:this.getState()})
        :null;
    }catch(error){
      console.warn("Starter ammo challenge creation failed",error);
    }

    this.challengeActive={entity,challenge,kind:"starter-ammo"};
    this.clearAnswerFeedback();
    if(this.challengeKicker)this.challengeKicker.textContent="SEM MUNIÇÃO";
    if(this.challengeTitle)this.challengeTitle.textContent="Ganhe 1000 munições básicas";
    if(this.challengeWrap)this.challengeWrap.hidden=false;
    if(this.challengeForm){this.challengeForm.hidden=true;this.challengeForm.style.display="none"}
    if(this.repairHp)this.repairHp.hidden=true;
    if(this.challengeFeedback)this.challengeFeedback.textContent=
      "Você ficou sem munição. Acerte a multiplicação para receber 1000 Bolas de Canhão.";
    if(this.repairOptions){
      this.repairOptions.hidden=false;
      this.repairOptions.replaceChildren();
      if(challenge?.available){
        for(const value of this.combatChoices(challenge)){
          const button=document.createElement("button");
          button.type="button";
          button.className="tq-world-combat__option";
          button.dataset.repairAnswer=String(value);
          button.textContent=String(value);
          this.repairOptions.append(button);
        }
      }
    }

    if(!challenge?.available){
      if(this.challengePrompt)this.challengePrompt.textContent="Desafio indisponível";
      if(this.challengeFeedback)this.challengeFeedback.textContent=
        String(challenge?.message||"Não foi possível gerar a multiplicação agora.");
      return false;
    }
    if(this.challengePrompt)this.challengePrompt.textContent=String(challenge.prompt||"");
    return true;
  }

  resolveStarterAmmoChallenge(result,challenge,selectedButton=null){
    const detail={
      entityId:"starter-ammo-rescue",
      challengeId:String(challenge?.id||""),
      operation:String(challenge?.operation||challenge?.kind||"multiplication"),
      a:Number(challenge?.a),
      b:Number(challenge?.b),
      answer:result?.answer,
      correct:result?.correct===true,
      region:Number(challenge?.region)||null,
      bonus:false,
      countsTowardPlanned:challenge?.countsTowardPlanned!==false
    };
    this.onPedagogyResult?.(detail);

    if(result?.correct!==true){
      this.showAnswerFeedback({
        correct:false,selectedButton,expected:result?.expected,revealExpected:false,
        message:"✕ Ainda não. Tente outra alternativa para receber a munição."
      });
      return false;
    }

    const ammoId="cannonball-standard";
    const ammo=this.ammoCatalog.find(item=>String(item?.id||"")===ammoId&&item?.available!==false);
    if(!ammo){
      if(this.challengeFeedback)this.challengeFeedback.textContent=
        "Acertou, mas a munição básica não está disponível no catálogo.";
      return false;
    }

    const starterAmmoQuantity=1000;
    if(!this.state.ammo)this.state.ammo=normalizeAmmoInventory({});
    this.state.ammo.stock[ammoId]=Math.max(0,Math.floor(Number(this.state.ammo.stock?.[ammoId])||0))+starterAmmoQuantity;
    this.state.ammo.selectedAmmoId=ammoId;
    this.onAmmoChange?.(structuredClone(this.state.ammo));
    this.onStarterAmmoEarned?.({
      ammoId,
      ammoName:String(ammo.name||"Bola de Canhão"),
      quantity:starterAmmoQuantity,
      total:this.state.ammo.stock[ammoId]
    });

    this.showAnswerFeedback({
      correct:true,selectedButton,expected:result?.expected,
      message:"✓ Acertou! +"+starterAmmoQuantity+" Bolas de Canhão recebidas e equipadas."
    });
    this.showGameplayToast("🎁 +"+starterAmmoQuantity+" Bolas de Canhão");
    this.challengeTimer=setTimeout(()=>this.closeTreasureChallenge(),850);
    return true;
  }

  async beginStarterCannonChallenge(){
    if(this.challengeActive||this.mode!=="play"||this.navalPlayerHp<=0)return false;
    if(Array.isArray(this.playerCannonIds)&&this.playerCannonIds.length>0)return false;
    this.stopNavalAutoFire({keepTarget:true});
    this.contextGuideTarget="shipyard";
    if(this.actionWrap)this.actionWrap.hidden=true;
    this.showGameplayToast("⚓ Sem canhão equipado. Siga a seta até o Arsenal Naval.",2600);
    this.updateTutorialGuideArrow();
    return false;
  }

  resolveStarterCannonChallenge(result,challenge,selectedButton=null){
    const detail={
      entityId:"starter-cannon-rescue",
      challengeId:String(challenge?.id||""),
      operation:String(challenge?.operation||challenge?.kind||"multiplication"),
      a:Number(challenge?.a),
      b:Number(challenge?.b),
      answer:result?.answer,
      correct:result?.correct===true,
      region:Number(challenge?.region)||null,
      bonus:false,
      countsTowardPlanned:challenge?.countsTowardPlanned!==false
    };
    this.onPedagogyResult?.(detail);

    if(result?.correct!==true){
      this.showAnswerFeedback({
        correct:false,selectedButton,expected:result?.expected,revealExpected:false,
        message:"✕ Ainda não. Tente outra alternativa para conquistar o canhão."
      });
      return false;
    }

    const granted=this.onStarterCannonEarned?.()||{ok:false};
    if(granted?.ok===false){
      if(this.challengeFeedback)this.challengeFeedback.textContent=
        "Acertou, mas não foi possível conceder o canhão. Tente novamente.";
      return false;
    }

    this.syncEquippedCannonsFromShipyard();
    const name=String(granted?.cannonName||"Canhão do Marujo");
    this.showAnswerFeedback({
      correct:true,selectedButton,expected:result?.expected,
      message:granted?.alreadyOwned
        ?"✓ Você já possui o canhão inicial."
        :"✓ Acertou! "+name+" recebido e equipado automaticamente."
    });
    this.showGameplayToast(granted?.alreadyOwned
      ?"⚓ Canhão inicial disponível"
      :"🎁 "+name+" equipado");
    this.challengeTimer=setTimeout(()=>{
      this.closeTreasureChallenge();
    },850);
    return true;
  }

  async beginTreasureChallenge(entity){
    if(!entity||this.challengeActive||this.mode!=="play")return false;
    this.beginPedagogyProtection();
    this.treasureTarget=null;
    this.stopForChallenge();
    this.actionWrap.hidden=true;

    // Lock immediately. The proximity collector runs every frame and the
    // pedagogy provider is async, so only one challenge may be created per treasure.
    this.challengeActive={entity,challenge:null,pending:true};

    let challenge=null;
    try{
      challenge=this.createPedagogyChallenge
        ?await this.createPedagogyChallenge({
          entity:this.cleanEntity(entity),
          worldState:this.getState()
        })
        :null;
    }catch(error){
      console.warn("Pedagogy challenge creation failed",error);
    }

    if(this.challengeActive?.entity!==entity)return false;
    this.challengeActive={entity,challenge,pending:false};
    this.clearAnswerFeedback();
    if(this.challengeWrap){this.applyPopupLayout("collect-treasure");this.challengeWrap.hidden=false;this.challengeWrap.classList.add("is-treasure-challenge")}
    if(this.challengeFeedback)this.challengeFeedback.textContent="";
    if(this.challengeForm){this.challengeForm.hidden=true;this.challengeForm.style.display="none"}
    if(this.repairOptions){
      this.repairOptions.hidden=false;
      this.repairOptions.replaceChildren();
      if(challenge?.available){
        for(const value of this.combatChoices(challenge)){
          const button=document.createElement("button");
          button.type="button";button.className="tq-world-combat__option";
          button.dataset.repairAnswer=String(value);button.textContent=String(value);
          this.repairOptions.append(button);
        }
      }
    }

    if(!challenge?.available){
      if(this.challengePrompt)this.challengePrompt.textContent="Desafio indisponível";
      if(this.challengeFeedback)this.challengeFeedback.textContent=
        String(challenge?.message||"As regras pedagógicas desta conta ainda não estão disponíveis.");
      if(this.challengeAnswer)this.challengeAnswer.disabled=true;
      if(this.challengeSubmit)this.challengeSubmit.disabled=true;
      this.repairOptions?.querySelectorAll("button").forEach(button=>{button.disabled=true});
      return;
    }

    if(this.challengePrompt)this.challengePrompt.textContent=String(challenge.prompt||"");
  }

  discardTreasure(entity){
    if(!entity||this.collected.has(entity.id))return false;
    this.collected.add(entity.id);
    if(entity.el)entity.el.hidden=true;
    this.treasureTarget=null;
    this.contactEntity=null;
    this.nearby=null;
    if(this.actionWrap)this.actionWrap.hidden=true;
    if(entity.runtimeTreasure&&entity.treasureRespawn===true){
      entity.treasureRespawnAt=performance.now()+Math.max(1000,Number(entity.treasureRespawnDelayMs)||30000);
    }
    this.updateProgress();
    return true;
  }

  playTreasureSuccess(entity){
    const el=entity?.el;
    if(!el?.animate)return;
    try{
      el.animate([
        {transform:el.style.transform,filter:"brightness(1) drop-shadow(0 0 0 rgba(255,190,60,0))",opacity:1},
        {transform:el.style.transform+" scale(1.24)",filter:"brightness(1.7) drop-shadow(0 0 22px rgba(255,190,60,.95))",opacity:1,offset:.55},
        {transform:el.style.transform+" scale(.72)",filter:"brightness(2) drop-shadow(0 0 34px rgba(255,220,100,1))",opacity:.15}
      ],{duration:620,easing:"cubic-bezier(.2,.8,.2,1)",fill:"forwards"});
    }catch{}
  }

  completeCollection(entity,{challenge=null}={}){
    if(!entity||this.collected.has(entity.id))return false;
    this.collected.add(entity.id);
    if(entity.el)entity.el.hidden=true;
    this.contactEntity=null;
    this.nearby=null;
    if(this.combatTarget?.id===entity.id)this.clearCombatTarget({hideAction:false});
    this.actionWrap.hidden=true;
    this.updateProgress();
    if(entity.type==="treasure"){
      const rolled=entity.runtimeTreasure?this.rollTreasureRewards(entity):null;
      if(rolled)entity.rewards=rolled;
      this.audio?.play("treasure-success");
      this.onTreasureCollected?.({entity:this.cleanEntity(entity),challenge,rewards:rolled?structuredClone(rolled):undefined});
      if(entity.runtimeTreasure&&entity.treasureRespawn===true)entity.treasureRespawnAt=performance.now()+Math.max(1000,Number(entity.treasureRespawnDelayMs)||30000);
    }
    const rewards=entity.rewards&&typeof entity.rewards==="object"?entity.rewards:null;
    const rewardParts=[];
    const gold=Math.max(0,Number(rewards?.gold??rewards?.coins)||0);
    const rubies=Math.max(0,Number(rewards?.rubies)||0);
    const xp=Math.max(0,Number(rewards?.xp)||0);
    if(gold)rewardParts.push("+"+gold+" ouro");
    if(rubies)rewardParts.push("+"+rubies+" rubi"+(rubies===1?"":"s"));
    if(xp)rewardParts.push("+"+xp+" XP");
    for(const ammoReward of Array.isArray(rewards?.ammoRewards)?rewards.ammoRewards:[]){
      const qty=Math.max(0,Math.floor(Number(ammoReward?.quantity)||0));
      if(qty>0)rewardParts.push("+"+qty+" munições");
    }
    if(rewards?.itemName||rewards?.itemId)rewardParts.push(String(rewards.itemName||rewards.itemId));
    if(rewards?.shipName||rewards?.shipId)rewardParts.push(String(rewards.shipName||rewards.shipId));
    const collectedLabel=entity.type==="treasure"?"Tesouro encontrado":String(entity.label||"Item")+" coletado";
    this.showGameplayToast(collectedLabel+(rewardParts.length?" · "+rewardParts.join(" · "):""));
    if(entity.type!=="treasure"&&rewards&&(Number(rewards.coins)>0||Number(rewards.xp)>0||Number(rewards.gold)>0||Number(rewards.rubies)>0||rewards.itemId||rewards.shipId)){
      this.onRewardCollected?.({
        entity:this.cleanEntity(entity),
        rewards:structuredClone(rewards)
      });
    }
    return true;
  }

  submitTreasureAnswer(selectedRaw=null,selectedButton=null){
    const active=this.challengeActive;
    const entity=active?.entity;
    const challenge=active?.challenge;
    if(!entity||!challenge?.available||typeof challenge.evaluate!=="function")return;

    const raw=selectedRaw??this.challengeAnswer?.value??"";
    if(String(raw).trim()===""){
      if(this.challengeFeedback)this.challengeFeedback.textContent="Escolha uma alternativa.";
      return;
    }

    const result=challenge.evaluate(raw)||{};

    if(active?.kind==="starter-cannon"){
      this.resolveStarterCannonChallenge(result,challenge,selectedButton);
      return;
    }
    if(active?.kind==="starter-ammo"){
      this.resolveStarterAmmoChallenge(result,challenge,selectedButton);
      return;
    }

    if(this.repairActive){
      this.repairOptions?.querySelectorAll("button").forEach(button=>{button.disabled=true});
      const detail={
        entityId:"player-repair",
        challengeId:String(challenge.id||""),
        operation:String(challenge.operation||challenge.kind||"multiplication"),
        a:Number(challenge.a),
        b:Number(challenge.b),
        answer:result.answer,
        correct:result.correct===true,
        region:Number(challenge.region)||null,
        bonus:false,
        countsTowardPlanned:challenge.countsTowardPlanned!==false
      };
      this.onPedagogyResult?.(detail);
      if(result.correct===true){
        const repairGain=Math.max(1,Math.ceil(this.navalPlayerMaxHp*.25));
        this.navalPlayerHp=Math.min(this.navalPlayerMaxHp,this.navalPlayerHp+repairGain);
        if(this.repairHp){const pct=Math.max(0,Math.min(100,this.navalPlayerHp/Math.max(1,this.navalPlayerMaxHp)*100));if(this.repairHpFill)this.repairHpFill.style.width=pct+"%";if(this.repairHpLabel)this.repairHpLabel.textContent="Casco "+this.navalPlayerHp+"/"+this.navalPlayerMaxHp;this.repairHp.animate?.([{transform:"scale(1)"},{transform:"scale(1.035)"},{transform:"scale(1)"}],{duration:360,easing:"ease-out"});}
        this.showAnswerFeedback({
          correct:true,selectedButton,expected:result.expected,
          message:"✓ Acertou! +25% do casco · "+this.navalPlayerHp+"/"+this.navalPlayerMaxHp
        });
        if(this.navalPlayerHp>=this.navalPlayerMaxHp){
          this.challengeTimer=setTimeout(()=>this.closePlayerRepair({completed:true}),650);
          return;
        }
      }else{
        this.showAnswerFeedback({
          correct:false,selectedButton,expected:result.expected,
          message:"✕ Resposta incorreta. A correta ficou marcada em verde."
        });
      }
      if(this.challengeAnswer)this.challengeAnswer.disabled=true;
      if(this.challengeSubmit)this.challengeSubmit.disabled=true;
      this.challengeTimer=setTimeout(async()=>{
        this.challengeTimer=0;
        await this.loadPlayerRepairRound();
      },result.correct===true?650:900);
      return;
    }

    const detail={
      entityId:String(entity.id||""),
      challengeId:String(challenge.id||""),
      operation:String(challenge.operation||challenge.kind||"multiplication"),
      a:Number(challenge.a),
      b:Number(challenge.b),
      answer:result.answer,
      correct:result.correct===true,
      region:Number(challenge.region)||null,
      bonus:challenge.bonus===true,
      countsTowardPlanned:challenge.countsTowardPlanned!==false
    };
    this.onPedagogyResult?.(detail);

    if(this.challengeAnswer)this.challengeAnswer.disabled=true;
    if(this.challengeSubmit)this.challengeSubmit.disabled=true;

    if(result.correct===true){
      this.showAnswerFeedback({
        correct:true,selectedButton,expected:result.expected,
        message:"✓ ACERTOU! Tesouro conquistado!"
      });
      this.playTreasureSuccess(entity);
      this.challengeTimer=setTimeout(()=>{
        this.challengeTimer=0;
        this.completeCollection(entity,{challenge});
        this.closeTreasureChallenge();
      },620);
      return;
    }

    this.showAnswerFeedback({
      correct:false,selectedButton,expected:result.expected,
      message:"✕ ERROU. A resposta correta ficou marcada em verde."
    });
    // Wrong answers never consume, hide, move or respawn the treasure.
    // Close only the pedagogy challenge; collection remains available at the
    // exact same world position for a future attempt.
    this.challengeTimer=setTimeout(()=>this.closeTreasureChallenge(),700);
  }

  entityInteraction(entity){
    if(!entity||typeof entity!=="object")return null;
    const interaction=entity.interaction&&typeof entity.interaction==="object"
      ?structuredClone(entity.interaction)
      :null;
    if(interaction?.actionId)return interaction;

    if(entity.type==="region-exit"&&entity.destinationWorldId){
      return {
        actionId:"enter-region",
        params:{
          regionId:String(entity.destinationWorldId),
          spawnId:String(entity.destinationSpawnId||"")
        }
      };
    }
    if(entity.interaction==="shipyard")return {actionId:"open-shipyard",params:{}};
    if(entity.interaction==="missions")return {actionId:"open-missions",params:{}};
    if(entity.scene){
      return {
        actionId:"open-scene",
        params:{sceneId:String(entity.scene)}
      };
    }
    return null;
  }

  updateNearby(){
    if(this.challengeActive||this.combatActive){
      this.actionWrap.hidden=true;
      return;
    }
    if(this.mode!=="play"){
      this.nearby=null;
      this.contactEntity=null;
      this.clearCombatTarget({hideAction:true});
      return;
    }


    // Physical interactions must outrank an automatically selected combat
    // target. Otherwise any NPC anywhere in the world can steal the interaction
    // slot and make nearby treasures/region exits impossible to use.
    let entity=this.contactEntity&&!this.collected.has(this.contactEntity.id)
      ?this.contactEntity
      :null;

    // Interaction hysteresis: once docked at a functional island, keep the
    // prompt latched a little outside the collision edge. This prevents the
    // collision resolver from toggling the prompt every frame at the shoreline.
    if(!entity&&this.nearby&&!this.collected.has(this.nearby.id)){
      const previous=this.nearby;
      const previousAction=inferCollisionAction(previous,normalizeCollision(previous.collision||{},previous));
      if(previousAction==="interact"){
        const latchRadius=this.playerCollisionRadius()+72;
        if(resolveCircleVsEntity(this.player,latchRadius,previous,previous.collision).collided)entity=previous;
      }
    }

    if(!entity){
      const radius=this.playerCollisionRadius()+18;
      for(const candidate of this.entities){
        if(this.collected.has(candidate.id))continue;
        candidate.collision=normalizeCollision(candidate.collision||{},candidate);
        if(!candidate.collision.active)continue;
        if(String(candidate.type||"")==="treasure")continue;
        const candidateAction=inferCollisionAction(candidate,candidate.collision);
        if(candidateAction==="none"||candidateAction==="combat")continue;
        if(resolveCircleVsEntity(this.player,radius,candidate,candidate.collision).collided){
          entity=candidate;
          break;
        }
      }
    }

    if(entity){
      this.nearby=entity;
      if(this.actionButton)delete this.actionButton.dataset.worldAction;
      const collision=normalizeCollision(entity.collision||{},entity);
      const action=inferCollisionAction(entity,collision);
      const interaction=this.entityInteraction(entity);

      if(action==="enter-world"||interaction?.actionId==="enter-region"){
        this.actionWrap.hidden=true;
        const canEnter=!this.canEnterWorld||this.canEnterWorld(entity);
        if(!canEnter){
          if(this.regionTransitionActive?.id===entity.id)this.closeRegionTransition();
          return;
        }
        if(this.regionExitDismissedId!==entity.id&&!this.regionTransitionActive)this.openRegionTransition(entity);
        return;
      }

      if(action!=="none"&&action!=="combat"){
        const asset=String(this.config.ui?.interactionMessageAsset||this.config.interactionMessageAsset||"");
        const safeAsset=asset.replace(/["\\]/g,"");
        this.actionWrap.classList.toggle("has-message-asset",Boolean(safeAsset));
        this.actionWrap.style.setProperty("--tq-world-message-asset",safeAsset?'url("'+safeAsset+'")':"none");
        if(this.actionMessage)this.actionMessage.textContent=collisionMessage(entity,collision);
        this.actionButton.textContent=collisionActionLabel(entity,collision);
        const directAction=String(interaction?.actionId||"");
        if(directAction==="open-shipyard"||directAction==="open-missions"){
          this.actionButton.dataset.interactionAction=directAction;
        }else{
          delete this.actionButton.dataset.interactionAction;
        }
        this.actionButton.disabled=false;
        this.actionWrap.hidden=false;
        return;
      }
    }

    // No immediate map interaction: combat UI can use the interaction slot.
    if(this.actionButton)delete this.actionButton.dataset.interactionAction;
    if(this.combatTarget){
      if(this.isClickableCombatShip(this.combatTarget)){
        const combatEntity=this.combatTarget;
        this.nearby=combatEntity;
        const asset=String(this.config.ui?.interactionMessageAsset||this.config.interactionMessageAsset||"");
        const safeAsset=asset.replace(/["\\]/g,"");
        this.actionWrap.classList.toggle("has-message-asset",Boolean(safeAsset));
        this.actionWrap.style.setProperty("--tq-world-message-asset",safeAsset?'url("'+safeAsset+'")':"none");
        const hp=this.navalHpState(combatEntity);
        const distanceToTarget=Math.round(this.navalTargetDistance(combatEntity));
        const playerHull=" · seu casco "+this.navalPlayerHp+"/"+this.navalPlayerMaxHp;
        if(this.navalPlayerHp<=0){
          if(this.actionMessage)this.actionMessage.textContent="Seu navio foi derrotado"+playerHull;
          if(this.actionButton){
            this.actionButton.textContent="☠ Navio derrotado";
            this.actionButton.disabled=true;
          }
          this.actionWrap.hidden=false;
          return;
        }
        if(this.actionButton)this.actionButton.disabled=false;
        if(this.actionMessage)this.actionMessage.textContent=this.isNavalTargetInRange(combatEntity)
          ?String(combatEntity.label||combatEntity.shipName||"Navio inimigo")+" · casco "+hp.current+"/"+hp.max+" · "+distanceToTarget+" px"+playerHull
          :String(combatEntity.label||combatEntity.shipName||"Navio inimigo")+" · FORA DE ALCANCE · "+distanceToTarget+" / "+Math.round(this.playerEffectiveCannonRange())+" px"+playerHull;
        if(this.actionButton)this.actionButton.textContent=this.navalAutoFire
          ?(this.isNavalTargetInRange(combatEntity)?"🔥 Atacando":"⏸ Fora de alcance")
          :"⚔ Atacar";
        this.actionWrap.hidden=false;
        return;
      }
      this.clearCombatTarget({hideAction:true});
    }

    this.nearby=null;
    this.regionExitDismissedId=null;
    if(this.actionButton)delete this.actionButton.dataset.worldAction;
    if(this.actionWrap)this.actionWrap.hidden=true;
  }

  navalHpState(entity){
    if(!entity?.id)return {current:0,max:0};
    const id=String(entity.id);
    const max=Math.max(1,Math.min(500000000,Number(entity.combat?.hp)||3));
    if(!this.navalHp.has(id))this.navalHp.set(id,max);
    return {current:Math.max(0,Number(this.navalHp.get(id))||0),max};
  }

  isPlayerInNavalCombat(){
    if(this.combatActive||this.navalAutoFire===true)return true;
    for(const entity of this.entities||[]){
      if(!entity||entity.devFrozen||entity.npcAttitude!=="hostile"||!this.isClickableCombatShip(entity))continue;
      if(this.collected.has(entity.id)||this.navalDestroying.has(entity.id))continue;
      const stats=this.entityNavalCombatStats(entity);
      if(this.navalTargetDistance(entity)<=stats.attackRange)return true;
    }
    return false;
  }


  navalDamageVisuals(){
    const visuals=[];
    for(const entity of this.entities){
      if(!entity?.id||this.collected.has(entity.id)||this.navalDestroying.has(entity.id))continue;
      if(String(entity.type||"")!=="ship")continue;
      const hp=this.navalHpState(entity);
      if(hp.current<=0||hp.max<=0)continue;
      const damageRatio=clamp(1-(hp.current/hp.max),0,1);
      if(damageRatio<.5)continue;
      visuals.push({
        id:String(entity.id),
        x:Number(entity.visualX??entity.x)||0,
        y:Number(entity.visualY??entity.y)||0,
        size:Math.max(48,Number(entity.width)||96,Number(entity.height)||96),
        kind:String(entity.entityKind||"")==="monster"?"monster":"ship",
        damageRatio
      });
    }
    return visuals;
  }

  showGameplayToast(message,duration=1500){
    const el=this.gameplayToast;if(!el||!message)return;
    if(this.gameplayToastTimer)clearTimeout(this.gameplayToastTimer);
    el.textContent=String(message);el.hidden=false;el.classList.remove("is-leaving");
    this.gameplayToastTimer=setTimeout(()=>{el.classList.add("is-leaving");setTimeout(()=>{el.hidden=true;el.classList.remove("is-leaving")},180)},Math.max(700,Number(duration)||1500));
  }

  rollNpcRewards(entity){
    const source=entity?.rewards&&typeof entity.rewards==="object"?entity.rewards:{};
    const result={};
    const gold=Math.max(0,Math.floor(Number(source.gold??source.coins)||0));
    if(gold>0)result.gold=gold;

    const rubyRule=source.rubies&&typeof source.rubies==="object"?source.rubies:null;
    if(rubyRule){
      const chance=clamp(Number(rubyRule.chance)||0,0,100);
      if(Math.random()*100<chance){
        const min=Math.max(0,Math.floor(Number(rubyRule.min)||0));
        const max=Math.max(min,Math.floor(Number(rubyRule.max)||min));
        result.rubies=min+Math.floor(Math.random()*(max-min+1));
      }else{
        result.rubies=0;
      }
    }else if(Number(source.rubies)>0){
      result.rubies=Math.max(0,Math.floor(Number(source.rubies)||0));
    }

    if(Number(source.xp)>0)result.xp=Math.max(0,Math.floor(Number(source.xp)||0));
    if(source.itemId)result.itemId=String(source.itemId);
    if(source.quantity)result.quantity=Math.max(1,Math.floor(Number(source.quantity)||1));
    if(source.shipId)result.shipId=String(source.shipId);
    return result;
  }

  beginNavalDestruction(entity){
    if(!entity?.id||this.collected.has(entity.id))return false;
    const id=String(entity.id);
    if(this.navalDestroying.has(id))return false;

    this.navalDestroying.add(id);
    const tutorialStageAtKill=String(this.getTutorialGuide?.()?.stage||"");
    if(["attack-ship","attack-ship-2"].includes(tutorialStageAtKill)&&entity.tutorialCombatTarget===true){
      entity.tutorialDefeated=true;
      entity.tutorialDefeatedStage=tutorialStageAtKill;
      entity.tutorialCombatTarget=false;
      entity.tutorialCombatPhase="";
      this.navalAutoFire=false;
      this.treasureCombatWasBlocking=false;
      this.treasureCombatLockUntil=Date.now()+(tutorialStageAtKill==="attack-ship-2"?2000:20000);
      Promise.resolve(this.onTutorialNpcDestroyed?.(entity)).catch(error=>console.warn("[TabuadaQuest] tutorial destruction hook failed",error));
      if(this.combatTarget===entity)this.clearCombatTarget({hideAction:true});
      this.navalHostile.delete(id);
    }
    if(String(this.tutorialIsolatedTargetId||"")===id){
      this.tutorialIsolatedTargetId="";
      for(const other of this.entities){
        if(other.tutorialHiddenForDuel){
          other.tutorialHiddenForDuel=false;
          if(other.el)other.el.hidden=false;
        }
      }
    }
    this.showGameplayToast((entity.label||entity.shipName||"Navio")+" destruído");
    if(entity.nameEl)entity.nameEl.hidden=true;
    this.navalHostile.delete(id);
    if(this.combatTarget?.id===id)this.clearCombatTarget({hideAction:true});
    if(this.contactEntity?.id===id)this.contactEntity=null;
    if(this.nearby?.id===id)this.nearby=null;

    entity.collision=normalizeCollision({
      ...(entity.collision||{}),
      active:false,
      action:"none"
    },entity);
    this.syncCombatClickableEntity(entity);
    this.syncCollisionVisual(entity);

    const duration=1100;
    const point={
      x:Number(entity.visualX??entity.x)||0,
      y:Number(entity.visualY??entity.y)||0
    };
    const size=Math.max(48,Number(entity.width)||96,Number(entity.height)||96);
    this.navalRenderer?.destroyShip?.({at:point,size,duration});
    if(entity.el)entity.el.hidden=true;

    if(entity.runtimeGenerated&&!this.isCoopBoss(entity)){
      const rewards=this.rollNpcRewards(entity);
      // Halloween event reward: every defeated regular NPC ship grants 5 purple cannonballs.
      rewards.ammo={
        id:"cannonball-halloween-purple",
        quantity:5
      };
      const spawnCycle=Math.max(1,Math.floor(Number(entity.npcSpawnCycle)||1));
      // Regular NPC rewards are repeatable. A deterministic claim based only on
      // slot + spawn cycle survives page/server resets and can incorrectly block
      // a later legitimate kill. Use a per-defeat token while still keeping the
      // callback idempotent for this destruction.
      const defeatToken=String(entity.npcRewardClaimToken||(
        entity.npcRewardClaimToken="npc-kill-"+Date.now()+"-"+Math.random().toString(36).slice(2,10)
      ));
      const claimKey=String(this.config.id||"world")+":"+id+":spawn:"+spawnCycle+":"+defeatToken;
      this.onRewardCollected?.({
        entity:this.cleanEntity(entity),
        rewards:structuredClone(rewards),
        claimKey
      });
      const parts=[];
      if(Number(rewards.gold)>0)parts.push("+"+Number(rewards.gold)+" ouro");
      if(Number(rewards.rubies)>0)parts.push("+"+Number(rewards.rubies)+" rubi"+(Number(rewards.rubies)===1?"":"s"));
      parts.push("+5 Bolas de Canhão Halloween Roxas");
      if(parts.length)this.showGameplayToast((entity.label||entity.shipName||"Navio")+" destruído · "+parts.join(" · "),1900);
    }

    const respawnDelay=entity.tutorialDefeated===true
      ?0
      :(entity.runtimeGenerated&&entity.respawn===true?Math.max(0,Number(entity.respawnDelayMs)||0):0);
    const timer=setTimeout(()=>{
      this.navalDestroyTimers.delete(id);
      this.navalDestroying.delete(id);
      if(entity.runtimeGenerated&&entity.respawn===true&&entity.tutorialDefeated!==true){
        const wasTutorialDefeated=false;
        const tutorialDefeatedStage=entity.tutorialDefeatedStage;
        const population=normalizeNpcPopulation(this.config.npcPopulation||{});
        const occupied=this.entities
          .filter(other=>other!==entity&&!this.collected.has(other.id)&&!this.navalDestroying.has(other.id))
          .map(other=>({x:Number(other.x)||0,y:Number(other.y)||0}));
        occupied.push({x:Number(this.player?.x)||0,y:Number(this.player?.y)||0});
        const random=createSeededRandom(hashString(id+".respawn."+Date.now()));
        const point=this.npcSpawnPoint(random,occupied,population);
        const heading=random()*360-180;
        entity.x=point.x;
        entity.y=point.y;
        entity.anchorX=point.x;
        entity.anchorY=point.y;
        entity.visualX=point.x;
        entity.visualY=point.y;
        entity.rotation=heading;
        entity.visualRotation=heading;
        entity.direction=directionForHeading(heading,null,{hysteresis:0});
        entity.bossCombatStopped=false;
        if(entity.npcNavigation){
          entity.npcNavigation.heading=heading;
          entity.npcNavigation.targetHeading=heading;
          entity.npcNavigation.vx=0;
          entity.npcNavigation.vy=0;
          entity.npcNavigation.elapsed=0;
          entity.npcNavigation.courseCycle=0;
          entity.npcNavigation.nextCourseChange=3.5+random()*4.5;
        }
        entity.collision=normalizeCollision({
          ...(entity.collision||{}),active:true,action:"none"
        },entity);
        this.navalHp.set(id,Math.max(1,Math.min(500000000,Number(entity.combat?.hp)||3)));
        entity.npcSpawnCycle=Math.max(1,Math.floor(Number(entity.npcSpawnCycle)||1))+1;
        entity.npcRewardClaimToken="";
        if(entity.el)entity.el.hidden=false;
        this.applyEntityVisual(entity);
        if(wasTutorialDefeated){
          entity.tutorialDefeated=true;
          entity.tutorialDefeatedStage=tutorialDefeatedStage;
          entity.tutorialCombatTarget=false;
          entity.tutorialCombatPhase="";
        }
        this.syncCombatClickableEntity(entity);
        this.syncCollisionVisual(entity);
        return;
      }
      if(entity.tutorialDefeated===true){
        // Tutorial kills are terminal for this runtime entity. Remove every
        // gameplay/render reference so the defeated slot cannot become a ghost target.
        this.collected.add(id);
        this.navalHp.delete(id);
        this.navalHostile.delete(id);
        if(this.combatTarget?.id===id)this.clearCombatTarget({hideAction:true});
        if(this.contactEntity?.id===id)this.contactEntity=null;
        if(this.nearby?.id===id)this.nearby=null;
        entity.collision=normalizeCollision({...entity.collision,active:false,action:"none"},entity);
        entity.el?.remove?.();
        entity.el=null;
        entity.nameEl=null;
        this.entities=this.entities.filter(other=>other!==entity&&String(other?.id||"")!==id);
        this.entityById?.delete?.(id);
        this.rebuildEntityIndex();
        this.mobileHud?.sync?.();
        return;
      }
      this.completeCollection(entity);
    },respawnDelay>0?Math.max(duration,respawnDelay):duration);
    this.navalDestroyTimers.set(id,timer);
    return true;
  }

  showNavalDamageNumber({x=0,y=0,amount=0,received=false}={}){
    if(!this.entityLayer||!(Number(amount)>0))return;
    if(!(this.damageNumberElements instanceof Set))this.damageNumberElements=new Set();
    // Damage labels are cosmetic. Capping concurrent nodes prevents long fights
    // and multi-cannon volleys from flooding the DOM and triggering GC/layout spikes.
    if(this.damageNumberElements.size>=28)return;
    const el=document.createElement("span");
    this.damageNumberElements.add(el);
    el.className="tq-world-damage-number"+(received?" is-received":"");
    const raw=Math.max(0.1,Number(amount)||0.1);
    const display=Math.round(raw*10)/10;
    el.textContent=Number.isInteger(display)?String(display):display.toFixed(1);
    el.style.left=(Number(x)||0)+"px";
    el.style.top=(Number(y)||0)+"px";
    this.entityLayer.append(el);
    let removed=false;
    const remove=()=>{
      if(removed)return;
      removed=true;
      this.damageNumberElements.delete(el);
      el.remove();
    };
    el.addEventListener("animationend",remove,{once:true});
    setTimeout(remove,1200);
  }

  applyDirectNavalDamage(entity,amount=1,{burstIndex=0,burstTotal=1}={}){
    if(!entity||this.collected.has(entity.id)||this.navalDestroying.has(entity.id))return;
    const hp=this.navalHpState(entity);
    const applied=Math.max(0.1,Number(amount)||0.1);
    const next=Math.max(0,Math.round((hp.current-applied)*10)/10);
    this.navalHp.set(String(entity.id),next);
    const dealt=Math.max(0,Math.round((hp.current-next)*10)/10);
    if(dealt>0&&this.isCoopBoss(entity)){
      entity.bossCombatStopped=true;
      if(entity.npcNavigation){
        entity.npcNavigation.vx=0;
        entity.npcNavigation.vy=0;
        entity.npcNavigation.targetHeading=Number(entity.rotation)||Number(entity.npcNavigation.heading)||0;
      }
    }
    const total=Math.max(1,Number(burstTotal)||1);
    const index=Math.max(0,Math.min(total-1,Number(burstIndex)||0));
    // Um ataque com vários canhões chega quase no mesmo instante. Espalhar os
    // números evita que um impacto esconda o outro sobre o alvo.
    const center=index-(total-1)/2;
    const offsetX=center*66;
    const offsetY=-Math.abs(center)*22-Math.floor(index/4)*28;
    this.showNavalDamageNumber({
      x:(Number(entity.visualX??entity.x)||0)+offsetX,
      y:(Number(entity.visualY??entity.y)||0)-Math.max(18,(Number(entity.height)||96)*.36)+offsetY,
      amount:dealt
    });
    if(next<=0){
      this.beginNavalDestruction(entity);
      return;
    }

    if(["attack-ship","attack-ship-2"].includes(String(this.getTutorialGuide?.()?.stage||""))&&entity.tutorialCombatTarget===true&&entity.tutorialCombatPhase!=="chase"&&next/hp.max<=.10){
      entity.tutorialCombatPhase="chase";
      if(entity.npcNavigation){
        entity.npcNavigation.mode="sailing";
        entity.npcNavigation.vx=0;
        entity.npcNavigation.vy=0;
        entity.npcNavigation.nextCourseChange=0;
      }
      // Fugir muda a navegação do alvo, não cancela uma ordem de ataque já ativa.
      // Se sair do alcance, o autofire fica armado e volta a disparar assim que o jogador o alcançar.
      this.navalNextShotAt=Math.min(Number(this.navalNextShotAt)||Date.now(),Date.now()+this.navalAttackCooldown);
      if(this.actionMessage)this.actionMessage.textContent="🏴‍☠️ O corsário está fugindo. Persiga-o, o ataque continua ativo.";
      this.showGameplayToast?.("🏴‍☠️ Ele está fugindo! Persiga-o, seus canhões continuam armados.",2600);
    }

    if(this.actionMessage){
      this.actionMessage.textContent=String(entity.label||entity.shipName||"Navio inimigo")+" · casco "+next+"/"+hp.max;
    }
  }

  navalEntityVelocity(entity){
    const npcNav=entity?.npcNavigation&&typeof entity.npcNavigation==="object"?entity.npcNavigation:null;
    const nav=entity?.nav&&typeof entity.nav==="object"?entity.nav:{};
    return {
      x:Number(npcNav?.vx??nav.vx??entity?.vx)||0,
      y:Number(npcNav?.vy??nav.vy??entity?.vy)||0
    };
  }

  navalOrientedHitbox(entity){
    const direction=String(entity?.direction||entity?.nav?.direction||"n").toLowerCase();
    const angles={n:-Math.PI/2,nne:-3*Math.PI/8,ne:-Math.PI/4,ene:-Math.PI/8,e:0,ese:Math.PI/8,se:Math.PI/4,sse:3*Math.PI/8,s:Math.PI/2,ssw:5*Math.PI/8,sw:3*Math.PI/4,wsw:7*Math.PI/8,w:Math.PI,wnw:-7*Math.PI/8,nw:-3*Math.PI/4,nnw:-5*Math.PI/8};
    return {
      x:Number(entity?.x)||0,y:Number(entity?.y)||0,
      angle:Number.isFinite(angles[direction])?angles[direction]:-Math.PI/2,
      halfLength:Math.max(26,(Number(entity?.height)||140)*.36),
      halfWidth:Math.max(18,(Number(entity?.width)||100)*.30)
    };
  }

  navalPointHitsHull(point,entity){
    const box=this.navalOrientedHitbox(entity);
    const dx=Number(point?.x||0)-box.x,dy=Number(point?.y||0)-box.y;
    const c=Math.cos(-box.angle),sn=Math.sin(-box.angle);
    const along=dx*c-dy*sn,across=dx*sn+dy*c;
    return Math.abs(along)<=box.halfLength&&Math.abs(across)<=box.halfWidth;
  }

  predictNavalIntercept(shooter,target,projectileSpeed){
    const sx=Number(shooter?.x)||0,sy=Number(shooter?.y)||0;
    const tx=Number(target?.x)||0,ty=Number(target?.y)||0;
    const v=this.navalEntityVelocity(target),rx=tx-sx,ry=ty-sy,speed=Math.max(1,Number(projectileSpeed)||1);
    const a=v.x*v.x+v.y*v.y-speed*speed,b=2*(rx*v.x+ry*v.y),c=rx*rx+ry*ry;
    let t=0;
    if(Math.abs(a)<1e-6)t=Math.abs(b)>1e-6?-c/b:0;
    else{
      const d=b*b-4*a*c;
      if(d>=0){const q=Math.sqrt(d),t1=(-b-q)/(2*a),t2=(-b+q)/(2*a);t=[t1,t2].filter(n=>n>0).sort((x,y)=>x-y)[0]||0;}
    }
    if(!(t>0))t=Math.sqrt(c)/speed;
    t=clamp(t,.05,8);
    return {x:tx+v.x*t,y:ty+v.y*t,time:t};
  }

  navalShooterPose(source,{player=false}={}){
    const raw=source&&typeof source==="object"?source:{};
    const direction=String(raw.direction||raw.nav?.direction||"").toLowerCase();
    const directionDegrees={n:0,nne:22.5,ne:45,ene:67.5,e:90,ese:112.5,se:135,sse:157.5,s:180,ssw:-157.5,sw:-135,wsw:-112.5,w:-90,wnw:-67.5,nw:-45,nnw:-22.5};
    const fallbackRotation=Number.isFinite(directionDegrees[direction])?directionDegrees[direction]:0;
    const rotation=Number(raw.rotation??raw.visualRotation);
    return {
      x:Number(raw.visualX??raw.x)||0,
      y:Number(raw.visualY??raw.y)||0,
      rotation:Number.isFinite(rotation)?rotation:fallbackRotation,
      width:Math.max(32,Number(player?this.config.player?.width:raw.width)||230),
      height:Math.max(32,Number(player?this.config.player?.height:raw.height)||230)
    };
  }

  navalBatteryLayout(count){
    const total=clamp(Math.floor(Number(count)||0),0,64);
    if(total<=0)return [];
    if(total===1)return [{index:0,side:"bow",slot:0,total:1}];
    const bowCount=total%2===1?1:0;
    const broadsideCount=total-bowCount;
    const perSide=Math.floor(broadsideCount/2);
    const layout=[];
    for(let i=0;i<perSide;i++)layout.push({index:layout.length,side:"port",slot:i,total:perSide});
    for(let i=0;i<perSide;i++)layout.push({index:layout.length,side:"starboard",slot:i,total:perSide});
    if(bowCount)layout.push({index:layout.length,side:"bow",slot:0,total:1});
    return layout;
  }

  navalTargetBatterySide(shooter,target,hasBow=false){
    const pose=this.navalShooterPose(shooter);
    const theta=pose.rotation*Math.PI/180;
    const forward={x:Math.sin(theta),y:-Math.cos(theta)};
    const right={x:Math.cos(theta),y:Math.sin(theta)};
    const tx=Number(target?.visualX??target?.x)||0;
    const ty=Number(target?.visualY??target?.y)||0;
    const dx=tx-pose.x;
    const dy=ty-pose.y;
    const forwardDot=dx*forward.x+dy*forward.y;
    const rightDot=dx*right.x+dy*right.y;
    if(hasBow&&forwardDot>0&&Math.abs(forwardDot)>Math.abs(rightDot)*1.15)return "bow";
    return rightDot>=0?"starboard":"port";
  }

  navalCannonHardpoint(shooter,descriptor,{player=false}={}){
    const pose=this.navalShooterPose(shooter,{player});
    const theta=pose.rotation*Math.PI/180;
    const forward={x:Math.sin(theta),y:-Math.cos(theta)};
    const right={x:Math.cos(theta),y:Math.sin(theta)};
    const halfLength=Math.max(24,pose.height*.26);
    const halfBeam=Math.max(18,pose.width*.19);
    let along=0,across=0;
    if(descriptor.side==="bow"){
      along=halfLength*.92;
      across=0;
    }else{
      const slots=Math.max(1,Number(descriptor.total)||1);
      const ratio=slots===1?0:(Number(descriptor.slot)/(slots-1)-.5);
      along=ratio*halfLength*1.15;
      across=(descriptor.side==="starboard"?1:-1)*halfBeam;
    }
    return {
      x:pose.x+forward.x*along+right.x*across,
      y:pose.y+forward.y*along+right.y*across,
      side:descriptor.side
    };
  }

  navalActiveBattery(shooter,cannons,target,{player=false}={}){
    const list=Array.isArray(cannons)?cannons.filter(Boolean):[];
    if(!list.length)return [];
    const targetSide=this.navalTargetBatterySide(shooter,target,false);
    return list.map((cannon,index)=>{
      const descriptor={
        index,
        side:targetSide,
        slot:index,
        total:list.length
      };
      return {
        instanceId:String(cannon?.id||"cannon")+"#"+index,
        descriptor,
        cannon,
        hardpoint:this.navalCannonHardpoint(shooter,descriptor,{player})
      };
    });
  }

  renderCannonProjectile({from,to,duration=620,ammo=null,impactKind="ship"}={}){
    return this.navalRenderer?.fire?.({from,to,duration,ammo,impactKind})===true;
  }

  renderCannonImpact({at,ammo=null,kind="ship",size=1}={}){
    if(!at)return false;
    return this.navalRenderer?.impact?.({at:{x:Number(at.x)||0,y:Number(at.y)||0},ammo,kind,size})===true;
  }

  fireDirectNavalProjectile(entity){
    if(!this.isClickableCombatShip(entity)||this.mode!=="play"||this.navalPlayerHp<=0)return false;
    if(this.canAttackEntity(entity)!==true){
      this.stopNavalAutoFire({keepTarget:true,message:String(this.attackLockMessage(entity)||"Alvo bloqueado.")});
      return false;
    }
    // playerCannonIds is already the runtime snapshot of the equipped battery.
    // Re-reading the shipyard on every projectile can transiently return an
    // empty overlay state and disarm the shot even though the HUD sees cannons.
    if(!Array.isArray(this.playerCannonIds)||this.playerCannonIds.length===0){
      this.stopNavalAutoFire({keepTarget:true,message:"Nenhum canhão equipado neste navio."});
      return false;
    }
    const targetDistance=this.navalTargetDistance(entity);
    let selectedAmmoId=String(this.state.ammo?.selectedAmmoId||"");
    let ammo=this.ammoCatalog.find(item=>String(item?.id||"")===selectedAmmoId&&item?.available!==false)||null;
    // Selection state can arrive from persistence/server/dev tools. Revalidate
    // at the actual use boundary so locked event ammo can never be fired.
    if(ammo&&this.canSelectAmmo(ammo)!==true){
      this.showGameplayToast("🔒 Esta munição de evento ainda não foi liberada.",1800);
      this.stopNavalAutoFire({keepTarget:true});
      return false;
    }
    const requiredAmmoEvent=String(entity?.requiredAmmoEvent||entity?.combat?.requiredAmmoEvent||"").toLowerCase();
    if(requiredAmmoEvent&&String(ammo?.event||"").toLowerCase()!==requiredAmmoEvent){
      this.showGameplayToast("🎃 O Terror só recebe dano de munição do evento.",2000);
      return false;
    }
    let ammoStock=Math.max(0,Math.floor(Number(this.state.ammo?.stock?.[selectedAmmoId])||0));
    if(!selectedAmmoId||!ammo||ammoStock<=0){
      const switched=this.autoSwitchAmmoIfEmpty({announce:Boolean(selectedAmmoId)});
      selectedAmmoId=String(this.state.ammo?.selectedAmmoId||"");
      ammo=this.ammoCatalog.find(item=>String(item?.id||"")===selectedAmmoId&&item?.available!==false)||null;
      ammoStock=Math.max(0,Math.floor(Number(this.state.ammo?.stock?.[selectedAmmoId])||0));
      if(!switched||!selectedAmmoId||!ammo||ammoStock<=0){
        this.stopNavalAutoFire({keepTarget:true,message:!ammo?"Munição inválida ou inexistente.":"Sem munição disponível."});
        return false;
      }
    }
    const cannons=(Array.isArray(this.playerCannonIds)?this.playerCannonIds:[])
      .map(id=>this.cannonCatalog.find(item=>String(item?.id||"")===id))
      .filter(Boolean);
    if(!cannons.length)return false;
    const shooter={...this.player,width:this.config.player?.width,height:this.config.player?.height};
    const battery=this.navalActiveBattery(shooter,cannons,entity,{player:true});
    const eligible=battery.filter(item=>targetDistance<=Math.max(1,Number(item.cannon?.range)||900));
    if(!eligible.length)return false;


    const ammoUnlimited=false;
    let ammoRemaining=ammoStock;
    if(ammoRemaining<=0){
      if(this.actionMessage)this.actionMessage.textContent=!ammo?"Munição inválida ou não carregada.":"Sem munição: "+String(ammo?.name||selectedAmmoId)+".";
      return false;
    }

    const volleyShots=[];
    const targetImpactKind=String(entity?.entityKind||"")==="monster"?"monster":"ship";
    let firedCount=0;
    let maxDuration=0;

    for(const batteryShot of eligible){
      if(ammoRemaining<=0)break;
      const cannon=batteryShot.cannon;
      const muzzle=batteryShot.hardpoint;
      const projectileSpeed=Math.max(120,Number(ammo?.projectileSpeed)||Number(cannon.projectileSpeed)||620);
      const intercept=this.predictNavalIntercept(muzzle,entity,projectileSpeed);
      const duration=clamp(intercept.time*1000,80,8000);
      const shotDamage=navalShotDamage(cannon,ammo);
      const predictedImpact={x:intercept.x,y:intercept.y};

      volleyShots.push({cannon,muzzle,predictedImpact,duration,shotDamage});
      maxDuration=Math.max(maxDuration,duration);

      const visualShot={
        from:muzzle,
        to:{x:intercept.x,y:intercept.y},
        duration
      };
      this.renderCannonProjectile({...visualShot,ammo,impactKind:targetImpactKind});

      firedCount+=1;
      ammoRemaining=Math.max(0,ammoRemaining-1);
      this.state.ammo.stock[selectedAmmoId]=ammoRemaining;
    }

    if(!firedCount)return false;
    if(["attack-ship","attack-ship-2"].includes(String(this.getTutorialGuide?.()?.stage||""))){
      entity.tutorialCombatTarget=true;
      if(!entity.tutorialCombatCalibrated){
        const perHit=Math.max(.1,Number(volleyShots[0]?.shotDamage)||1);
        const exactHp=Math.round(perHit*19.5*10)/10;
        entity.combat={...(entity.combat||{}),hp:exactHp};
        this.navalHp.set(String(entity.id),exactHp);
        entity.tutorialCombatCalibrated=true;
      }
      if(entity.tutorialCombatPhase!=="chase")entity.tutorialCombatPhase="firing";
      if(!this.tutorialIsolatedTargetId){
        this.tutorialIsolatedTargetId=String(entity.id);
        for(const other of this.entities){
          if(other===entity||!this.isClickableCombatShip(other))continue;
          other.tutorialHiddenForDuel=true;
          if(other.el)other.el.hidden=true;
        }
      }
      this.onTutorialAttack?.(entity);
    }
    this.audio?.play("cannon-shot");
    if(ammoRemaining<=0)this.autoSwitchAmmoIfEmpty({announce:true});
    this.onAmmoChange?.(structuredClone(this.state.ammo));

    const resolveVolley=()=>{
      if(this.collected.has(entity.id)||this.navalDestroying.has(entity.id))return;
      let totalDamage=0;
      let hitCount=0;
      for(const shot of volleyShots){
        if(!this.navalPointHitsHull(shot.predictedImpact,entity))continue;
        totalDamage+=shot.shotDamage;
        hitCount+=1;
      }
      if(hitCount<=0){
        this.audio?.play?.("cannon-impact-water");
        const missAt=volleyShots[0]?.predictedImpact;
        if(missAt)this.renderCannonImpact({at:missAt,ammo,kind:"water",size:.9});
        return;
      }
      this.audio?.play("cannon-impact-ship");
      this.renderCannonImpact({
        at:{x:Number(entity.visualX??entity.x)||0,y:Number(entity.visualY??entity.y)||0},
        ammo,
        kind:targetImpactKind,
        size:clamp(Math.max(Number(entity.width)||96,Number(entity.height)||96)/150,.75,1.55)
      });

      this.applyDirectNavalDamage(entity,totalDamage,{burstIndex:0,burstTotal:1});
    };

    setTimeout(resolveVolley,Math.max(80,maxDuration));

    const id=String(entity.id);
    if(!entity.devFrozen&&entity.npcAttitude!=="peaceful"){
      const hostile=this.navalHostile.get(id)||{nextShotAt:0};
      this.navalHostile.set(id,hostile);
    }

    if(this.actionMessage){
      const currentHp=this.navalHpState(entity);
      this.actionMessage.textContent=String(entity.label||entity.shipName||"Navio inimigo")
        +" · "+firedCount+" canhão"+(firedCount===1?"":"ões")+" disparado"+(firedCount===1?"":"s")
        +(ammoUnlimited?"":" · munição "+ammoRemaining)
        +" · casco "+currentHp.current+"/"+currentHp.max;
    }
    return true;
  }

  toggleCombatFollow(){
    this.followCombatTarget=false;
    this.showGameplayToast("📷 A câmera acompanha seu navio automaticamente.",1300);
    return false;
  }

  useHullReinforcement(){
    if(this.hullReinforcement?.hp>0&&Date.now()<this.hullReinforcement.expiresAt)return false;
    if(Math.max(0,Number(this.getConsumableQuantity("hull-reinforcement"))||0)<=0){
      this.showGameplayToast("Sem Reforço de Casco.",1300);return false;
    }

    // Activate before consuming so the inventory checkpoint captures both sides
    // of the transaction atomically: item removed + temporary effect active.
    const previous={...(this.hullReinforcement||{hp:0,expiresAt:0})};
    this.hullReinforcement={hp:1000000,expiresAt:Date.now()+300000};
    const consumed=this.onConsumeItem?.("hull-reinforcement");
    if(consumed===false){
      this.hullReinforcement=previous;
      return false;
    }
    this.onRuntimeStateChange?.();
    this.showGameplayToast("🛡 Reforço de Casco ativado · +1.000.000 HP · 5 min",2200);
    return true;
  }

  activateHullReinforcement(){
    this.hullReinforcement={hp:1000000,expiresAt:Date.now()+300000};
    this.onRuntimeStateChange?.();
    this.showGameplayToast("🛡 Reforço de Casco ativado · +1.000.000 HP · 5 min",2200);
    return true;
  }

  applyDirectPlayerNavalDamage(amount=1,source=null){
    if(this.pedagogyProtectionActive())return false;
    if(this.repairActive?.forced===true)return false;
    if(this.navalPlayerHp<=0)return false;
    let incoming=Math.max(1,Number(amount)||1);
    if(["attack-ship","attack-ship-2"].includes(String(this.getTutorialGuide?.()?.stage||""))&&source?.tutorialCombatTarget===true){
      incoming=Math.min(incoming,Math.max(1,this.navalPlayerMaxHp*.03));
    }
    const immunityQty=Math.max(0,Math.floor(Number(this.getConsumableQuantity("halloween-immunity-charm"))||0));
    if(immunityQty>0){
      incoming=Math.max(.1,Math.round(incoming*.5*10)/10);
    }
    const now=Date.now();
    if(this.hullReinforcement?.hp>0&&now<this.hullReinforcement.expiresAt){
      const absorbed=Math.min(this.hullReinforcement.hp,incoming);
      this.hullReinforcement.hp-=absorbed;
      incoming-=absorbed;
      this.onRuntimeStateChange?.();
      if(incoming<=0)return true;
    }else if(this.hullReinforcement){
      this.hullReinforcement.hp=0;
      this.hullReinforcement.expiresAt=0;
      this.onRuntimeStateChange?.();
    }
    const previousHp=this.navalPlayerHp;
    this.navalPlayerHp=Math.max(0,Math.round((this.navalPlayerHp-incoming)*10)/10);

    // HP is gameplay state, so publish every hit immediately instead of waiting
    // for the HUD polling interval or for the defeat branch.
    this.mobileHud?.sync?.();
    this.onRuntimeStateChange?.();

    this.showNavalDamageNumber({
      x:Number(this.player?.x)||0,
      y:(Number(this.player?.y)||0)-Math.max(22,(Number(this.config.player?.height)||150)*.36),
      amount:Math.max(0,Math.round((previousHp-this.navalPlayerHp)*10)/10),
      received:true
    });
    if(this.actionMessage){
      const sourceLabel=String(source?.label||source?.shipName||"Navio inimigo");
      this.actionMessage.textContent=this.navalPlayerHp>0
        ?sourceLabel+" revidou · seu casco "+this.navalPlayerHp+"/"+this.navalPlayerMaxHp
        :"Seu navio foi derrotado.";
    }
    if(this.navalPlayerHp>0&&this.shouldForceRepair({hp:this.navalPlayerHp,maxHp:this.navalPlayerMaxHp})===true){
      this.navalAutoFire=false;this.navalNextShotAt=0;
      this.showGameplayToast("🔧 Casco abaixo de 750. Repare o navio por inteiro para continuar.",2400);
      setTimeout(()=>this.beginPlayerRepair({forced:true}),0);
    }
    if(this.navalPlayerHp<=0){
      this.hullReinforcement={hp:0,expiresAt:0};
      this.onRuntimeStateChange?.();
    this.followCombatTarget=false;
      this.navalAutoFire=false;
      this.navalNextShotAt=0;
      this.navalHostile.clear();
      this.closeCombat();
      this.challengeActive=null;
      this.stopForChallenge();
      this.navalRenderer?.destroyShip?.({
        at:{x:this.player.x,y:this.player.y},
        size:Math.max(48,Number(this.config.player?.width)||108,Number(this.config.player?.height)||150),
        duration:1500
      });
      this.playerEl?.classList.add("is-player-sunk");
      setTimeout(()=>this.beginPlayerRepair({forced:true}),0);
      if(this.actionButton){
        this.actionButton.textContent="☠ Navio derrotado";
        this.actionButton.disabled=true;
      }
      if(this.actionMessage)this.actionMessage.textContent=
        "Seu navio foi derrotado · seu casco 0/"+this.navalPlayerMaxHp;
    }
    return true;
  }

  fireNpcNavalProjectile(entity){
    if(!this.isClickableCombatShip(entity)||this.mode!=="play"||entity.devFrozen)return false;
    const stats=this.entityNavalCombatStats(entity);
    const loadout=stats.loadout||{cannons:[],ammo:null,ammoUnlimited:false};
    const maxTargets=this.isCoopBoss(entity)?clamp(Math.floor(Number(entity.combat?.maxTargets)||1),1,2):1;
    const candidates=[
      ...(this.navalPlayerHp>0&&this.repairActive?.forced!==true?[{
        id:"local",
        local:true,
        x:Number(this.player?.x)||0,
        y:Number(this.player?.y)||0,
        distance:Math.hypot((Number(entity.x)||0)-(Number(this.player?.x)||0),(Number(entity.y)||0)-(Number(this.player?.y)||0))
      }]:[])
    ]
      .filter(target=>target.distance<=stats.attackRange)
      .sort((a,b)=>a.distance-b.distance)
      .slice(0,maxTargets);
    if(!candidates.length)return false;

    const target=candidates[0];
    const battery=this.navalActiveBattery(entity,loadout.cannons,target);
    if(!battery.length)return false;
    const volleyCount=battery.length;
    let firedCount=0;
    for(let shotIndex=0;shotIndex<volleyCount;shotIndex++){
      const batteryShot=battery[shotIndex];
      const cannon=batteryShot.cannon;
      const muzzle=batteryShot.hardpoint;
      const shotTarget=candidates[shotIndex%candidates.length]||target;
      const delay=shotIndex*55;
      setTimeout(()=>{
        if(this.collected.has(entity.id)||this.navalDestroying.has(entity.id))return;
        const targetDistance=Math.hypot(muzzle.x-shotTarget.x,muzzle.y-shotTarget.y);
        const duration=clamp(targetDistance/Math.max(120,stats.projectileSpeed||620)*1000,220,2200);
        const fired=this.renderCannonProjectile({
          from:muzzle,
          to:{x:shotTarget.x,y:shotTarget.y},
          duration,
          ammo:loadout.ammo||undefined
        })===true;
        if(!fired)return;
        firedCount+=1;
        this.audio?.play("cannon-shot");
        if(shotTarget.local){
          setTimeout(()=>{
            if(this.navalPlayerHp<=0||this.repairActive?.forced===true||this.collected.has(entity.id)||this.navalDestroying.has(entity.id))return;
            this.audio?.play("cannon-impact-ship");
            this.renderCannonImpact({
              at:{x:Number(this.player?.x)||shotTarget.x,y:Number(this.player?.y)||shotTarget.y},
              ammo:loadout.ammo||null,
              kind:"ship",
              size:clamp(Math.max(Number(this.config.player?.width)||108,Number(this.config.player?.height)||150)/150,.75,1.45)
            });
            const fixedDamage=Math.max(0,Number(entity?.combat?.fixedDamagePerShot)||0);
            const shotDamage=fixedDamage>0?fixedDamage:(loadout.ammo?navalShotDamage(cannon,loadout.ammo):clamp(Number(stats.damage)||1,.1,100000000));
            this.applyDirectPlayerNavalDamage(shotDamage,entity);
          },duration);
        }
      },delay);
    }
    return volleyCount>0;
  }

  updateDirectNavalCombat(time=performance.now()){
    if(this.mode!=="play"||this.combatActive)return;
    // A forced repair only disables the destroyed local ship; the local world keeps simulating.
    if(this.challengeActive&&!this.repairActive?.forced)return;

    const target=this.combatTarget;
    if(this.navalPlayerHp>0&&this.navalAutoFire){
      if(!target||!this.isClickableCombatShip(target)){
        this.stopNavalAutoFire({keepTarget:false});
      }else{
        const playerStats=this.playerNavalCombatStats();
        const dist=this.navalTargetDistance(target);
        const equippedCannons=(this.playerCannonIds||[]).map(id=>this.cannonCatalog.find(item=>String(item?.id||"")===String(id))).filter(Boolean);
        const effectiveRange=this.playerEffectiveCannonRange();
        const inRangeCannons=this.playerCannonsInRange(target);
        const effectiveCooldown=inRangeCannons.length
          ?Math.min(...inRangeCannons.map(cannon=>clamp(Number(cannon.attackCooldownMs)||1200,150,10000)))
          :(equippedCannons.length?Math.min(...equippedCannons.map(cannon=>clamp(Number(cannon.attackCooldownMs)||1200,150,10000))):playerStats.attackCooldownMs);
        if(!inRangeCannons.length){
          // Keep the attack armed. Range only pauses the shots. As soon as the
          // target comes back into range, the same target resumes automatically.
          this.navalNextShotAt=0;
          if(this.actionButton)this.actionButton.textContent="⏸ Fora de alcance";
          if(this.actionMessage)this.actionMessage.textContent=
            String(target.label||target.shipName||"Navio inimigo")
            +" · FORA DE ALCANCE · "+Math.round(dist)
            +" / "+Math.round(effectiveRange)+" px";
        }else if(Number(time)>=Number(this.navalNextShotAt||0)){
          if(this.fireDirectNavalProjectile(target)){
            this.navalNextShotAt=Number(time)+effectiveCooldown;
          }else{
            this.navalNextShotAt=Number(time)+180;
          }
        }
      }
    }

    for(const [id,state] of [...this.navalHostile.entries()]){
      const entity=this.entityByIdGet(id);
      if(!entity||entity.devFrozen||!this.isClickableCombatShip(entity)||this.collected.has(entity.id)||this.navalDestroying.has(entity.id)){
        this.navalHostile.delete(id);
        continue;
      }
      const stats=this.entityNavalCombatStats(entity);
      if(this.navalTargetDistance(entity)>stats.attackRange)continue;
      if(Number(time)<Number(state.nextShotAt||0))continue;
      if(this.fireNpcNavalProjectile(entity)){
        state.nextShotAt=Number(time)+stats.attackCooldownMs;
        this.navalHostile.set(id,state);
      }else{
        state.nextShotAt=Number(time)+180;
      }
    }
  }

  refreshShopCatalogs(){
    this.shopOverlay?.setCatalogs?.({
      ammoCatalog:this.ammoCatalog,
      cannonCatalog:this.cannonCatalog,
      shipCatalog:this.shipCatalog
    });
  }

  applyPopupLayout(trigger){
    const layout=this.entities.find(entity=>String(entity?.type||"")==="popup"&&entity?.popupMapping?.popupType==="math"&&entity?.popupMapping?.trigger===trigger&&entity?.src);
    if(!this.challengeWrap)return;
    if(layout?.src){
      const safe=String(layout.src).replace(/["\\]/g,"");
      this.challengeWrap.style.setProperty("--tq-popup-layout",'url("'+safe+'")');
    }else this.challengeWrap.style.removeProperty("--tq-popup-layout");
  }

  ammoAutoSortValue(item){
    const shop=item?.shop&&typeof item.shop==="object"?item.shop:{};
    const currency=String(shop.currency||"gold").toLowerCase();
    const currencyRank=currency==="gold"?0:(currency==="rubies"||currency==="ruby"?1:2);
    const price=Math.max(0,Number(shop.price)||0);
    const pack=Math.max(1,Number(shop.packQuantity)||1);
    const unit=shop.purchasable===false&&currencyRank>=2?Number.POSITIVE_INFINITY:(price/pack);
    return {currencyRank,unit,price};
  }

  cheapestStockedAmmo(excludeId=""){
    const excluded=String(excludeId||"");
    const stocked=(Array.isArray(this.ammoCatalog)?this.ammoCatalog:[])
      .filter(item=>{
        const id=String(item?.id||"");
        return id&&id!==excluded&&item?.available!==false
          &&this.canSelectAmmo(item)===true
          &&Math.max(0,Math.floor(Number(this.state?.ammo?.stock?.[id])||0))>0;
      })
      .sort((a,b)=>{
        const av=this.ammoAutoSortValue(a);
        const bv=this.ammoAutoSortValue(b);
        return av.currencyRank-bv.currencyRank
          ||av.unit-bv.unit
          ||av.price-bv.price
          ||String(a?.name||a?.id||"").localeCompare(String(b?.name||b?.id||""),"pt-BR");
      });
    return stocked[0]||null;
  }

  autoSwitchAmmoIfEmpty({announce=false}={}){
    if(!this.state.ammo)this.state.ammo=normalizeAmmoInventory({});
    const currentId=String(this.state.ammo.selectedAmmoId||"");
    const currentQty=Math.max(0,Math.floor(Number(this.state.ammo.stock?.[currentId])||0));
    if(currentId&&currentQty>0)return null;
    const next=this.cheapestStockedAmmo(currentId);
    this.state.ammo.selectedAmmoId=String(next?.id||"");
    if(next&&announce){
      const quantity=Math.max(0,Math.floor(Number(this.state.ammo.stock?.[next.id])||0));
      this.showGameplayToast?.("💣 "+String(next.name||next.id)+" equipada · ×"+quantity,1600);
      if(this.actionMessage)this.actionMessage.textContent="Munição esgotada · equipada "+String(next.name||next.id)+" · "+quantity;
    }
    return next;
  }

  replaceAmmoInventory(ammo={}, {emit=true}={}){
    this.state.ammo=normalizeAmmoInventory(ammo);
    this.autoSwitchAmmoIfEmpty({announce:false});
    const snapshot={
      selectedAmmoId:String(this.state.ammo.selectedAmmoId||""),
      stock:{...(this.state.ammo.stock||{})}
    };
    if(emit)this.onAmmoChange?.(snapshot);
    return snapshot;
  }

  selectPlayerAmmo(ammoId){
    const id=String(ammoId||"").trim();
    if(!id)return false;
    const item=(Array.isArray(this.ammoCatalog)?this.ammoCatalog:[]).find(entry=>String(entry?.id||"")===id&&entry?.available!==false);
    const quantity=Math.max(0,Number(this.state?.ammo?.stock?.[id])||0);
    if(!item||quantity<=0)return false;
    if(this.canSelectAmmo(item)!==true){
      this.showGameplayToast("🔒 Esta munição de evento ainda não foi liberada.",1800);
      return false;
    }
    if(!this.state.ammo)this.state.ammo=normalizeAmmoInventory({});
    this.state.ammo.selectedAmmoId=id;
    this.onAmmoChange?.(structuredClone(this.state.ammo));
    return true;
  }

  cyclePlayerAmmo(){
    const available=(Array.isArray(this.ammoCatalog)?this.ammoCatalog:[])
      .filter(item=>item&&item.available!==false&&this.canSelectAmmo(item)===true);
    if(!available.length)return null;

    const stocked=available.filter(item=>{
      const id=String(item.id||"");
      return Math.max(0,Math.floor(Number(this.state?.ammo?.stock?.[id])||0))>0;
    });
    if(!stocked.length)return null;
    const pool=stocked;
    const current=String(this.state?.ammo?.selectedAmmoId||"");
    let index=pool.findIndex(item=>String(item.id||"")===current);
    index=(index+1)%pool.length;
    const next=pool[index]||pool[0];
    if(!this.state.ammo)this.state.ammo=normalizeAmmoInventory({});
    this.state.ammo.selectedAmmoId=String(next.id||"");
    this.onAmmoChange?.(structuredClone(this.state.ammo));
    if(this.actionMessage){
      const quantity=String(Math.max(0,Math.floor(Number(this.state.ammo.stock?.[next.id])||0)));
      this.actionMessage.textContent="Munição equipada: "+String(next.name||next.id)+" · "+quantity;
    }
    return structuredClone(next);
  }

  activateNearby(){
    // Resolve the visible island action from the live collision contact first.
    // "nearby" can be stale for one frame while the shoreline latch changes.
    const contactCandidate=this.contactEntity&&!this.collected.has(this.contactEntity.id)?this.contactEntity:null;
    const nearbyCandidate=this.nearby&&!this.collected.has(this.nearby.id)?this.nearby:null;
    const mapEntity=contactCandidate||nearbyCandidate;
    const mapInteraction=mapEntity?this.entityInteraction(mapEntity):null;
    if(mapInteraction?.actionId==="open-shipyard"){
      this.actionWrap.hidden=true;
      this.shipyardOverlay?.open?.();
      return;
    }
    if(mapInteraction?.actionId==="open-missions"){
      this.actionWrap.hidden=true;
      this.mobileHud?.openMissions?.();
      this.mobileHud?.onMissionsOpen?.();
      return;
    }

    if(this.navalPlayerHp<=0){
      if(this.actionButton){
        this.actionButton.disabled=true;
        this.actionButton.textContent="☠ Navio derrotado";
      }
      if(this.actionMessage)this.actionMessage.textContent=
        "Seu navio foi derrotado · seu casco 0/"+this.navalPlayerMaxHp;
      if(this.actionWrap)this.actionWrap.hidden=false;
      return;
    }
    if(!Array.isArray(this.playerCannonIds)||this.playerCannonIds.length===0){
      this.beginStarterCannonChallenge();
      return;
    }
    if(!this.hasPlayerAmmo()){
      this.beginStarterAmmoChallenge();
      return;
    }
    const tutorialMissionHunt=String(this.getTutorialGuide?.()?.stage||"")==="missions-hunt";
    const missionTarget=tutorialMissionHunt
      ?(this.combatTarget?.tutorialMissionCorsair===true?this.combatTarget:this.nearestCombatTarget())
      :null;
    const entity=missionTarget
      ||(this.combatTarget&&this.isClickableCombatShip(this.combatTarget)?this.combatTarget:this.nearby);
    if(!entity||this.mode!=="play")return;

    const collision=normalizeCollision(entity.collision||{},entity);
    const action=inferCollisionAction(entity,collision);

    if(this.combatTarget?.id===entity.id&&this.isClickableCombatShip(entity)){
      if(this.navalAutoFire===true){
        // Repeated fire commands must not reset the weapon clock. The battery
        // owns its cadence; input only starts the attack once.
        return;
      }
      if(this.canAttackEntity(entity)!==true){
        this.navalAutoFire=false;
        const message=String(this.attackLockMessage(entity)||"Alvo bloqueado.");
        if(this.actionButton)this.actionButton.textContent="🔒 Bloqueado";
        if(this.actionMessage)this.actionMessage.textContent=message;
        this.showGameplayToast(message,2200);
        return;
      }
      if(!this.isNavalTargetInRange(entity)){
        const stats=this.playerNavalCombatStats();
        if(this.actionMessage)this.actionMessage.textContent=
          String(entity.label||entity.shipName||"Navio inimigo")
          +" · FORA DE ALCANCE · "+Math.round(this.navalTargetDistance(entity))
          +" / "+Math.round(stats.attackRange)+" px";
        return;
      }
      this.navalAutoFire=true;
      this.navalNextShotAt=0;
      if(this.actionButton)this.actionButton.textContent="🔥 Atacando";
      this.updateDirectNavalCombat(performance.now());
      return;
    }

    if(action==="combat"&&String(entity.type||"")==="ship"){
      if(this.navalAutoFire===true&&this.combatTarget?.id===entity.id)return;
      this.selectCombatTarget(entity);
      if(this.canAttackEntity(entity)!==true){
        this.navalAutoFire=false;
        const message=String(this.attackLockMessage(entity)||"Alvo bloqueado.");
        if(this.actionButton)this.actionButton.textContent="🔒 Bloqueado";
        if(this.actionMessage)this.actionMessage.textContent=message;
        this.showGameplayToast(message,2200);
        return;
      }
      if(this.isNavalTargetInRange(entity)){
        this.navalAutoFire=true;
        this.navalNextShotAt=0;
        if(this.actionButton)this.actionButton.textContent="🔥 Atacando";
        this.updateDirectNavalCombat(performance.now());
      }
      return;
    }

    if(action==="collect"){
      this.completeCollection(entity);
      return;
    }

    const interaction=this.entityInteraction(entity);
    if(interaction?.actionId==="open-shipyard"){
      this.actionWrap.hidden=true;
      this.shipyardOverlay?.open?.();
      return;
    }
    if(interaction?.actionId==="open-missions"){
      this.actionWrap.hidden=true;
      this.mobileHud?.openMissions?.();
      this.mobileHud?.onMissionsOpen?.();
      return;
    }

    if(interaction?.actionId==="open-scene"&&this.onExecuteAction){
      this.actionWrap.hidden=true;
      this.onExecuteAction(interaction,this.cleanEntity(entity),this.getState());
      return;
    }

    if(action==="enter-scene"&&entity.scene&&this.onEnterScene){
      this.actionWrap.hidden=true;
      this.onEnterScene(this.cleanEntity(entity),this.getState());
      return;
    }

    if(interaction?.actionId==="enter-region"||action==="enter-world"){
      this.openRegionTransition(entity);
      return;
    }

    if(interaction&&this.onExecuteAction){
      this.actionWrap.hidden=true;
      this.onExecuteAction(interaction,this.cleanEntity(entity),this.getState());
    }
  }

  cleanEntity(entity){
    const {el,nameEl,index,anchorX,anchorY,visualX,visualY,visualRotation,...data}=entity;
    return data;
  }

  refreshShipProfile(shipId){
    const id=String(shipId||"");
    if(!id||!this.resolveShip)return false;
    let changed=false;

    if(String(this.config.player?.shipId||"")===id){
      try{
        const profile=this.resolveShip(id,"player");
        if(profile&&typeof profile==="object"){
          this.updatePlayerConfig({
            ...structuredClone(profile),
            shipId:id,
            combatModifiers:structuredClone(this.config.player?.combatModifiers||{})
          });
          changed=true;
        }
      }catch(error){
        console.warn("[TabuadaQuest] Player ship refresh failed",id,error);
      }
    }

    const usesNpc=(this.config.npcPopulation?.types||[])
      .some(type=>String(type?.shipId||"")===id||String(type?.npcId||"")===id);
    if(usesNpc){
      this.rebuildNpcPopulation({render:true});
      changed=true;
    }
    return changed;
  }

  getOcean(){
    return structuredClone(normalizeOceanConfig(this.config.ocean||{}));
  }

  getPlayerConfig(){
    return structuredClone(this.config.player||{});
  }

  updatePlayerConfig(patch={}){
    const next={...(this.config.player||{}),...structuredClone(patch)};
    if(patch.directions){
      next.directions={...(this.config.player?.directions||{}),...structuredClone(patch.directions)};
    }
    if(patch.sprite){
      next.sprite={...(this.config.player?.sprite||{}),...structuredClone(patch.sprite)};
      if(patch.sprite.regions)next.sprite.regions={...(this.config.player?.sprite?.regions||{}),...structuredClone(patch.sprite.regions)};
    }
    if(patch.effects){
      next.effects={...(this.config.player?.effects||{}),...structuredClone(patch.effects)};
    }
    if(patch.combat){
      next.combat={...(this.config.player?.combat||{}),...structuredClone(patch.combat)};
    }
    if(patch.combatModifiers){
      next.combatModifiers={
        ...(this.config.player?.combatModifiers||{}),
        ...structuredClone(patch.combatModifiers)
      };
    }
    if(patch.width!==undefined)next.width=clamp(Number(patch.width)||108,24,1200);
    if(patch.height!==undefined)next.height=clamp(Number(patch.height)||150,24,1200);
    if(patch.direction!==undefined)next.direction=String(patch.direction||"n").toLowerCase();

    const previousMaxHp=Math.max(50,Number(this.navalPlayerMaxHp)||resolvePlayerHullHp(this.config.player,this.config.combat||{}));
    this.config.player=next;
    if(patch.combat?.hp!==undefined||patch.combatModifiers){
      const nextMaxHp=resolvePlayerHullHp(next,this.config.combat||{});
      const delta=nextMaxHp-previousMaxHp;
      this.navalPlayerMaxHp=nextMaxHp;
      this.navalPlayerHp=delta>0
        ?clamp((Number(this.navalPlayerHp)||previousMaxHp)+delta,0,nextMaxHp)
        :clamp(Number(this.navalPlayerHp??nextMaxHp),0,nextMaxHp);
      if(this.actionButton)this.actionButton.disabled=this.navalPlayerHp<=0;
    }
    if(next.width)this.playerEl.style.width=next.width+"px";
    if(next.height)this.playerEl.style.height=next.height+"px";
    if(next.direction){
      this.player.direction=next.direction;
      if(patch.direction!==undefined){
        const headings={n:0,nne:22.5,ne:45,ene:67.5,e:90,ese:112.5,se:135,sse:157.5,s:180,ssw:-157.5,sw:-135,wsw:-112.5,w:-90,wnw:-67.5,nw:-45,nnw:-22.5};
        if(Number.isFinite(headings[next.direction]))this.player.rotation=headings[next.direction];
      }
    }
    this.updatePlayerVisual();
    this.updatePlayerWaterEffects(performance.now());
    return this.getPlayerConfig();
  }

  environmentConfig(time=performance.now()){
    const id=String(this.config.environment?.preset||"day");
    const preset=WORLD_ENVIRONMENT_PRESETS[id]?id:"day";
    const env=this.config.environment||{};
    const clouds=env.clouds&&typeof env.clouds==="object"?env.clouds:{};
    const elapsed=Math.max(0,(Number(time)||0)-Number(this.environmentCycleStartedAt||0));
    const cycle=computeWorldWeatherCycle(env.cycle||{},elapsed);
    return {
      preset,
      weather:String(cycle.active?cycle.weather:(env.weather||environmentPreset(preset).weather||"none")),
      cycle,
      clouds:{
        active:clouds.active!==false,
        density:clamp(Number(clouds.density??.5),0,1),
        opacity:clamp(Number(clouds.opacity??.5),0,1),
        scale:clamp(Number(clouds.scale??1),.4,2.5),
        speed:clamp(Number(clouds.speed??18),0,120),
        direction:clamp(Number(clouds.direction??0),-180,180),
        parallax:clamp(Number(clouds.parallax??.18),0,1)
      }
    };
  }

  updateEnvironmentCycle(time=performance.now()){
    const env=this.environmentConfig(time);
    const signature=env.cycle?.active
      ?env.cycle.phase+"|"+env.weather
      :"static|"+env.weather;
    if(signature===this.environmentCycleSignature)return false;
    this.environmentCycleSignature=signature;
    this.applyEnvironmentVisual(time);
    return true;
  }

  applyEnvironmentVisual(time=performance.now()){
    const env=this.environmentConfig(time);
    this.environmentCycleSignature=env.cycle?.active
      ?env.cycle.phase+"|"+env.weather
      :"static|"+env.weather;
    if(this.combatArena){
      this.combatArena.className="tq-world-combat__arena tq-world-combat__arena--"+env.preset;
      this.combatArena.dataset.environment=env.preset;
      const ocean=normalizeOceanConfig(this.config.ocean||{});
      const deep=ocean.layers?.deep||{};
      const rawWaterSource=String(deep.background||ocean.background||"");
      const waterSource=(rawWaterSource==="none"||rawWaterSource==="__none__")
        ?""
        :rawWaterSource.replace(/["\\]/g,"");
      if(waterSource){
        this.combatArena.style.setProperty("--combat-water-image",'url("'+waterSource+'")');
        const tile=Math.max(96,Math.min(520,Number(ocean.tileSize||256)*Number(deep.tileScale||1)));
        this.combatArena.style.setProperty("--combat-water-size",tile+"px auto");
      }else{
        this.combatArena.style.setProperty("--combat-water-image","none");
        this.combatArena.style.removeProperty("--combat-water-size");
      }
    }
    if(this.cloudsEl){
      const clouds=env.clouds;
      const count=clouds.active?Math.round(4+clouds.density*12):0;
      const signature=[count,clouds.opacity,clouds.scale,clouds.speed,clouds.direction,clouds.parallax].join("|");
      if(this.cloudsEl.dataset.signature!==signature){
        this.cloudsEl.dataset.signature=signature;
        this.cloudsEl.replaceChildren();
        this.cloudsEl.hidden=!clouds.active||count===0;
        this.cloudsEl.style.setProperty("--cloud-opacity",String(clouds.opacity));
        this.cloudsEl.style.setProperty("--cloud-scale",String(clouds.scale));
        this.cloudsEl.style.setProperty("--cloud-speed",String(clouds.speed));
        this.cloudsEl.style.setProperty("--cloud-direction",String(clouds.direction));
        this.cloudsEl.style.setProperty("--cloud-parallax",String(clouds.parallax));
        for(let i=0;i<count;i++){
          const cloud=document.createElement("i");
          cloud.style.setProperty("--x",(((i*29+11)%97))+"%");
          cloud.style.setProperty("--y",(8+((i*17)%58))+"%");
          cloud.style.setProperty("--size",(120+((i*47)%180))+"px");
          cloud.style.setProperty("--depth",String(.55+((i%5)*.12)));
          cloud.style.setProperty("--delay",(-((i*911)%12000))+"ms");
          const angle=clouds.direction*Math.PI/180;
          const dx=Math.cos(angle),dy=Math.sin(angle);
          cloud.style.setProperty("--from-x",(-28*dx)+"vw");
          cloud.style.setProperty("--from-y",(-28*dy)+"vh");
          cloud.style.setProperty("--to-x",(128*dx)+"vw");
          cloud.style.setProperty("--to-y",(128*dy)+"vh");
          cloud.style.setProperty("--dur",(clouds.speed<=0?86400:(Math.max(6,44-clouds.speed*.3)+(i%5)*2.6))+"s");
          this.cloudsEl.append(cloud);
        }
      }
    }
    if(!this.weatherEl)return;
    const weather=["rain","snow","halloween","halloween-rain"].includes(env.weather)?env.weather:"none";
    if(this.weatherEl.dataset.weather===weather)return;
    this.weatherEl.dataset.weather=weather;
    this.weatherEl.className="tq-world-weather tq-world-weather--"+weather;
    this.weatherEl.replaceChildren();
    const kinds=weather==="halloween-rain"
      ?[...Array(42).fill("rain"),...Array(16).fill("halloween")]
      :Array(weather==="rain"?42:weather==="snow"?34:weather==="halloween"?16:0).fill(weather);
    kinds.forEach((kind,i)=>{
      const p=document.createElement("i");
      p.dataset.weatherKind=kind;
      p.style.setProperty("--i",String(i));
      p.style.setProperty("--x",((i*37)%101)+"%");
      p.style.setProperty("--delay",(-((i*173)%2400))+"ms");
      p.style.setProperty("--dur",(kind==="rain"?(700+(i%7)*70):kind==="snow"?(3600+(i%9)*260):(4200+(i%8)*340))+"ms");
      this.weatherEl.append(p);
    });
  }

  applyEnvironmentPreset(id="day"){
    const key=WORLD_ENVIRONMENT_PRESETS[id]?id:"day";
    const preset=environmentPreset(key);
    this.config.environment={...(this.config.environment||{}),preset:key,weather:preset.weather};
    this.updateOcean(preset.ocean);
    this.updatePlayerConfig({effects:preset.ship});
    this.applyEnvironmentVisual();
    return this.getWorld();
  }

  setGlobalCamera(patch={}){
    if(patch.playZoom!==undefined){
      this.globalCameraLocked=true;
      this.playZoom=clamp(Number(patch.playZoom)||0.4841,.30,1.4);
      if(this.mode==="play")this.zoom=this.playZoom;
    }
    return {playZoom:this.playZoom};
  }

  updateWorld(patch={},commit=true){
    if(patch.name!==undefined)this.config.name=String(patch.name||this.config.id||"Mundo");
    if(patch.width!==undefined)this.config.width=clamp(Number(patch.width)||390,390,20000);
    if(patch.height!==undefined)this.config.height=clamp(Number(patch.height)||844,844,20000);
    if(patch.camera&&typeof patch.camera==="object"){
      const cameraPatch=structuredClone(patch.camera);
      if(this.globalCameraLocked)delete cameraPatch.playZoom;
      this.config.camera={
        ...(this.config.camera||{}),
        ...cameraPatch
      };
      if(!this.globalCameraLocked&&patch.camera.playZoom!==undefined){
        this.playZoom=clamp(Number(patch.camera.playZoom)||0.4841,.30,1.4);
        this.config.camera.playZoom=this.playZoom;
        if(this.mode==="play")this.zoom=this.playZoom;
      }
    }
    if(patch.playableArea&&typeof patch.playableArea==="object"){
      this.config.playableArea={
        ...(this.config.playableArea||{}),
        ...structuredClone(patch.playableArea)
      };
    }
    if(patch.ui&&typeof patch.ui==="object"){
      this.config.ui={
        ...(this.config.ui||{}),
        ...structuredClone(patch.ui)
      };
    }
    if(patch.environment&&typeof patch.environment==="object"){
      this.config.environment={
        ...(this.config.environment||{}),
        ...structuredClone(patch.environment)
      };
      this.environmentCycleStartedAt=performance.now();
      this.environmentCycleSignature="";
      this.applyEnvironmentVisual();
    }
    if(patch.minimap&&typeof patch.minimap==="object"){
      this.config.minimap={
        ...(this.config.minimap||{}),
        ...structuredClone(patch.minimap)
      };
      if(Array.isArray(patch.minimap.types)){
        this.config.minimap.types=[...patch.minimap.types];
      }
      this.minimapLastRender=0;
      this.renderMinimap(true);
    }
    if(patch.test&&typeof patch.test==="object"){
      this.config.test={
        ...(this.config.test||{}),
        ...structuredClone(patch.test)
      };
      if(patch.test.ammoId!==undefined&&this.state?.ammo){
        this.state.ammo.selectedAmmoId=String(patch.test.ammoId||"");
      }
      if(Array.isArray(patch.test.cannonIds)){
        const validIds=patch.test.cannonIds.map(String).filter(id=>this.cannonCatalog.some(item=>String(item?.id||"")===id));
        this.playerCannonIds=validIds;
        this.config.test.cannonIds=[...this.playerCannonIds];
      }
    }

    const area=this.getPlayableBounds();
    this.config.playableArea={x:area.left,y:area.top,width:area.width,height:area.height};

    if(this.stage){
      this.stage.style.width=this.config.width+"px";
      this.stage.style.height=this.config.height+"px";
    }
    this.applyPlayableAreaVisual();

    const travel=this.getPlayerTravelBounds();
    this.player.x=clamp(this.player.x,travel.left,travel.right);
    this.player.y=clamp(this.player.y,travel.top,travel.bottom);

    if(patch.treasurePopulation&&typeof patch.treasurePopulation==="object"){
      this.config.treasurePopulation=normalizeTreasurePopulation({...this.config.treasurePopulation,...structuredClone(patch.treasurePopulation),spread:{...(this.config.treasurePopulation?.spread||{}),...(patch.treasurePopulation.spread||{})},types:Array.isArray(patch.treasurePopulation.types)?structuredClone(patch.treasurePopulation.types):structuredClone(this.config.treasurePopulation?.types||[])});
      this.rebuildTreasurePopulation({render:false});
    }

    if(patch.npcPopulation&&typeof patch.npcPopulation==="object"){
      this.config.npcPopulation=normalizeNpcPopulation({
        ...(this.config.npcPopulation||{}),
        ...structuredClone(patch.npcPopulation),
        spread:{
          ...(this.config.npcPopulation?.spread||{}),
          ...(patch.npcPopulation.spread||{})
        },
        movement:{
          ...(this.config.npcPopulation?.movement||{}),
          ...(patch.npcPopulation.movement||{})
        },
        types:Array.isArray(patch.npcPopulation.types)
          ?structuredClone(patch.npcPopulation.types)
          :structuredClone(this.config.npcPopulation?.types||[])
      });
      this.rebuildNpcPopulation({render:false});
    }

    for(const entity of this.entities){
      entity.x=clamp(Number(entity.x||0),0,this.config.width);
      entity.y=clamp(Number(entity.y||0),0,this.config.height);
      entity.anchorX=entity.x;
      entity.anchorY=entity.y;
      this.applyEntityVisual(entity);
    }
    if((patch.npcPopulation||patch.treasurePopulation)&&this.entityLayer)this.renderEntities();
    this.clampEditorCamera();
    this.updateCamera(true);
    if(this.nameEl)this.nameEl.textContent=this.config.name||this.config.id||"Mundo";
    return this.getWorld();
  }

  applyGraphicsSettings(next={}, {persist=false}={}){
    const current=this.graphicsSettings||{};
    this.graphicsSettings={
      clouds:next.clouds!==undefined?next.clouds!==false:current.clouds!==false,
      oceanWaves:next.oceanWaves!==undefined?next.oceanWaves!==false:current.oceanWaves!==false,
      reducedAmmoFx:next.reducedAmmoFx!==undefined?next.reducedAmmoFx===true:current.reducedAmmoFx===true
    };
    if(this.cloudsEl)this.cloudsEl.hidden=this.graphicsSettings.clouds===false;
    if(this.oceanCanvas)this.oceanCanvas.hidden=false;
    this.navalRenderer?.setReducedFx?.(this.graphicsSettings.reducedAmmoFx===true);
    this.initOceanRenderer();
    if(persist)this.onGraphicsSettingsChange?.(structuredClone(this.graphicsSettings));
    return structuredClone(this.graphicsSettings);
  }

  updateOcean(patch={}){
    const current=this.config.ocean||{};
    const preset=patch.preset;
    const base=preset&&preset!==current.preset?applyOceanPreset(current,preset):current;
    const next={...base,...structuredClone(patch)};
    if(patch.background!==undefined){
      const background=String(patch.background||"none");
      next.layers={...(base.layers||{})};
      for(const key of ["deep","wave","foam"]){
        next.layers[key]={...(base.layers?.[key]||{}),background};
      }
    }
    if(patch.layers){
      next.layers={...(base.layers||{})};
      for(const [key,value] of Object.entries(patch.layers)){
        next.layers[key]={...(base.layers?.[key]||{}),...structuredClone(value||{})};
      }
    }
    const previousBackground=String(current.background||"");
    const previousRenderer=String(current.renderer||"webgl");
    this.config.ocean=normalizeOceanConfig(next);
    this.applyOceanStatic();

    const rendererChanged=String(this.config.ocean.renderer)!==previousRenderer;
    const backgroundChanged=String(this.config.ocean.background||"")!==previousBackground;

    if(rendererChanged){
      this.resetOceanRenderer();
      this.initOceanRenderer();
    }else if(backgroundChanged&&this.config.ocean.renderer==="webgl"){
      if(this.oceanRenderer?.ready){
        this.oceanRenderer.loadTexture(this.config.ocean.background).catch(error=>{
          console.warn("[TabuadaQuest] Ocean texture reload failed:",error);
        });
      }else{
        this.initOceanRenderer();
      }
    }
    return this.getOcean();
  }

  resetOceanRenderer(){
    this.oceanRenderer?.destroy?.();
    this.oceanRenderer=null;
    this.oceanRendererInit=null;
    this.host?.classList.remove("is-webgl-ocean");
  }

  async initOceanRenderer(){
    const ocean=normalizeOceanConfig(this.config.ocean||{});
    if(ocean.renderer!=="webgl"||!this.oceanCanvas){
      this.host?.classList.remove("is-webgl-ocean");
      return false;
    }
    if(this.oceanRendererInit)return this.oceanRendererInit;

    const renderer=new OceanWebGLRenderer(this.oceanCanvas);
    this.oceanRenderer=renderer;
    this.oceanRendererInit=renderer.init(ocean.background).then(ok=>{
      if(ok&&this.oceanRenderer===renderer){
        this.host?.classList.add("is-webgl-ocean");
        if(this.viewportSize)renderer.resize(this.viewportSize.width,this.viewportSize.height);
        return true;
      }
      if(this.oceanRenderer===renderer)this.host?.classList.remove("is-webgl-ocean");
      return false;
    }).catch(error=>{
      console.warn("[TabuadaQuest] Ocean WebGL init failed:",error);
      if(this.oceanRenderer===renderer)this.host?.classList.remove("is-webgl-ocean");
      return false;
    });
    return this.oceanRendererInit;
  }

  applyOceanStatic(){
    const ocean=normalizeOceanConfig(this.config.ocean||{});
    this.config.ocean=ocean;
    for(const key of ["deep","wave","foam"]){
      const el=this.oceanEls?.[key];
      const layer=ocean.layers?.[key];
      if(!el||!layer)continue;
      const rawBackground=String(layer.background||ocean.background||"");
      const textureless=rawBackground==="none"||rawBackground==="__none__";
      const safeBackground=textureless?"":rawBackground.replace(/["\\]/g,"");
      el.style.backgroundImage=safeBackground?'url("'+safeBackground+'")':"none";
      el.style.backgroundColor="#0875a7";
      el.style.backgroundSize=(ocean.tileSize*layer.tileScale)+"px auto";
      el.style.backgroundRepeat="repeat";
      el.style.opacity=String(layer.opacity);
      el.style.transformOrigin="center center";
    }
    this.applyEnvironmentVisual();
  }

  updateOceanFrame(time){
    const ocean=this.config.ocean||normalizeOceanConfig({});
    const wavesEnabled=this.graphicsSettings?.oceanWaves!==false;
    const renderOcean=wavesEnabled?ocean:{
      ...ocean,
      speed:Number(ocean.speed||0)*.38,
      swell:Number(ocean.swell||0)*.30,
      distortion:Number(ocean.distortion||0)*.28,
      waveMix:Number(ocean.waveMix||0)*.42,
      foamMix:Number(ocean.foamMix||0)*.30,
      sparkleIntensity:Number(ocean.sparkleIntensity||0)*.22
    };
    const webglRendered=ocean.renderer==="webgl"
      &&this.oceanRenderer?.render?.({
        time,
        camera:this.camera,
        zoom:this.mode==="play"?this.playZoom:this.zoom,
        ocean:renderOcean,
        width:this.viewportSize?.width||1,
        height:this.viewportSize?.height||1,
        wake:(()=>{
          const fx=this.playerWaterEffects();
          return {
            active:(this.mode==="play"||this.editorPreviewActive)&&fx.wakeActive,
            samples:this.wakeSamples||[],
            width:fx.wakeWidth*fx.wakeScale,
            opacity:fx.wakeOpacity,
            lifetime:clamp(1100+(fx.wakeLength*fx.wakeScale)*6.2,1600,6200)
          };
        })()
      });

    if(webglRendered)return;

    const frame=computeOceanFrame(renderOcean,time,this.camera);
    for(const key of ["deep","wave","foam"]){
      const el=this.oceanEls?.[key];
      const layerFrame=frame.layers?.[key];
      if(!el||!layerFrame)continue;
      el.style.backgroundPosition=layerFrame.offsetX.toFixed(2)+"px "+layerFrame.offsetY.toFixed(2)+"px";
      el.style.transform="scale("+frame.scale.toFixed(5)+")";
      el.style.filter="brightness("+frame.brightness.toFixed(2)+"%) saturate("+frame.saturation+"%)";
    }
  }

  getWorld(){
    const world=structuredClone(this.config);
    world.entities=this.entities.filter(entity=>!entity.runtimeGenerated).map(entity=>structuredClone(this.cleanEntity(entity)));
    world.editor={
      ...(world.editor||{}),
      cameraX:this.camera.x,
      cameraY:this.camera.y,
      zoom:this.mode==="edit"?this.zoom:(world.editor?.zoom??.58)
    };
    return world;
  }

  getEntity(id){
    const entity=this.entityByIdGet(id);
    return entity?structuredClone(this.cleanEntity(entity)):null;
  }

  getSelected(){
    return this.selectedId?this.getEntity(this.selectedId):null;
  }

  selectEntity(id){
    this.selectedId=id&&this.entities.some(entity=>entity.id===id)?id:null;
    this.applySelectionVisual();
    this.syncGizmo();
    this.onSelectionChange?.(this.getSelected());
  }

  applySelectionVisual(){
    for(const entity of this.entities){
      entity.el?.classList.toggle("is-selected",entity.id===this.selectedId&&this.mode==="edit");
    }
  }

  updateEntity(id,patch={},commit=true){
    const entity=this.entityByIdGet(id);
    if(!entity)return null;
    const previousType=entity.type;
    const effectPatch=patch.effect&&typeof patch.effect==="object"?structuredClone(patch.effect):null;
    const collisionPatch=patch.collision&&typeof patch.collision==="object"?structuredClone(patch.collision):null;
    const plainPatch=structuredClone(patch);
    delete plainPatch.effect;
    delete plainPatch.collision;
    Object.assign(entity,plainPatch);
    if(effectPatch)entity.effect=normalizeEntityEffect({...entity.effect,...effectPatch},entity);
    if(collisionPatch)entity.collision=normalizeCollision({...entity.collision,...collisionPatch},entity);
    entity.x=clamp(Number(entity.x??0),0,this.config.width);
    entity.y=clamp(Number(entity.y??0),0,this.config.height);
    const freeSize=entity.type==="region-exit";
    entity.width=freeSize?Math.max(16,Number(entity.width??96)):clamp(Number(entity.width??96),16,2400);
    entity.height=freeSize?Math.max(16,Number(entity.height??96)):clamp(Number(entity.height??96),16,2400);
    entity.rotation=Number(entity.rotation||0);
    entity.skewX=clamp(Number(entity.skewX||0),-75,75);
    entity.skewY=clamp(Number(entity.skewY||0),-75,75);
    entity.effect=normalizeEntityEffect(entity.effect||{},entity);
    entity.collision=normalizeCollision(entity.collision||{},entity);
    entity.anchorX=entity.x;
    entity.anchorY=entity.y;
    entity.visualX=entity.x;
    entity.visualY=entity.y;
    entity.visualRotation=entity.rotation;
    if(previousType!==entity.type)this.renderEntities();
    else{
      this.applyEntityVisual(entity);
      if(effectPatch||patch.src!==undefined)this.syncEntityEffectRenderer(entity);
      if(collisionPatch||patch.type!==undefined||patch.width!==undefined||patch.height!==undefined)this.syncCollisionVisual(entity);
      this.syncGizmo();
    }
    this.selectedId=id;
    this.applySelectionVisual();
    const clean=this.getEntity(id);
    this.onSelectionChange?.(clean);
    this.onEntityChange?.(clean,commit);
    return clean;
  }

  getEntityCollision(id){
    const entity=this.entityByIdGet(id);
    if(!entity)return null;
    entity.collision=normalizeCollision(entity.collision||{},entity);
    return structuredClone(entity.collision);
  }

  updateEntityCollision(id,patch={},commit=true){
    const entity=this.entityByIdGet(id);
    if(!entity)return null;
    entity.collision=normalizeCollision({...entity.collision,...structuredClone(patch)},entity);
    this.syncCollisionVisual(entity);
    const clean=this.getEntity(id);
    this.onEntityChange?.(clean,commit);
    return structuredClone(entity.collision);
  }

  addEntity(raw){
    const base=String(raw.id||"entity").replace(/[^a-z0-9._-]+/gi,"-");
    let id=base,n=2;
    while(this.entities.some(entity=>entity.id===id))id=base+"-"+n++;

    const entity={
      ...structuredClone(raw),
      id,
      x:clamp(Number(raw.x??this.camera.x),0,this.config.width),
      y:clamp(Number(raw.y??this.camera.y),0,this.config.height),
      rotation:Number(raw.rotation||0),
      skewX:clamp(Number(raw.skewX||0),-75,75),
      skewY:clamp(Number(raw.skewY||0),-75,75),
      effect:normalizeEntityEffect(raw.effect||{},raw),
      collision:normalizeCollision(raw.collision||{},raw),
      index:this.entities.length,
      anchorX:0,
      anchorY:0,
      visualX:0,
      visualY:0,
      visualRotation:Number(raw.rotation||0),
      el:null
    };
    entity.anchorX=entity.x;
    entity.anchorY=entity.y;
    entity.visualX=entity.x;
    entity.visualY=entity.y;
    this.entities.push(entity);
    this.entityById?.set(String(entity.id),entity);
    this.renderEntities();
    this.selectEntity(id);
    const clean=this.getEntity(id);
    this.onEntityChange?.(clean,true);
    return clean;
  }

  deleteEntity(id){
    const index=this.entities.findIndex(entity=>entity.id===id);
    if(index<0)return false;
    const [removed]=this.entities.splice(index,1);
    if(removed?.id)this.entityById?.delete(String(removed.id));
    this.entities.forEach((entity,i)=>entity.index=i);
    if(this.selectedId===id)this.selectedId=null;
    this.renderEntities();
    this.onSelectionChange?.(null);
    this.onEntityChange?.(null,true);
    return true;
  }

  getCameraCenter(){
    return {x:this.camera.x,y:this.camera.y,zoom:this.zoom};
  }

  minimapConfig(){
    const raw=this.config.minimap&&typeof this.config.minimap==="object"
      ?this.config.minimap
      :{};
    return {
      frameAsset:"./assets/ui/ui_minimap_frame_pirate_cartoon_hq.webp",
      ...raw
    };
  }

  minimapEnabled(){
    return this.minimapConfig().enabled!==false;
  }

  minimapLogicalType(entity){
    const explicit=String(entity?.type||"").toLowerCase();
    const effectType=String(entity?.effect?.category||"").toLowerCase();
    const compositionType=String(entity?.compositionType||"").toLowerCase();
    const src=String(entity?.src||"").toLowerCase();

    if(explicit==="ship"||explicit==="island"||explicit==="background")return explicit;
    if(explicit==="location"){
      if(effectType==="island"||src.includes("/islands/")||/ilha|island/.test(src))return "island";
      if(effectType==="background")return "background";
      return "location";
    }
    if(explicit&&explicit!=="object")return explicit;
    if(effectType&&effectType!=="generic"&&effectType!=="sea-item")return effectType;
    if(compositionType==="ship"||src.includes("/ships/"))return "ship";
    if(src.includes("/islands/")||/ilha|island/.test(src))return "island";
    return explicit||effectType||"object";
  }

  minimapEntities(){
    const config=this.minimapConfig();
    const visibleTypes=new Set(
      Array.isArray(config.types)&&config.types.length
        ?config.types.map(value=>String(value).toLowerCase())
        :["location","island","ship","region-exit"]
    );
    if(config.showLocations===false){
      visibleTypes.delete("location");
      visibleTypes.delete("island");
    }
    if(config.showShips===false)visibleTypes.delete("ship");

    return this.entities.filter(entity=>{
      if(entity.minimap?.hidden===true||entity.visible===false)return false;
      if(this.collected.has(entity.id))return false;
      return visibleTypes.has(this.minimapLogicalType(entity));
    });
  }

  renderMinimap(force=false,time=performance.now()){
    if(!this.minimapEl||!this.minimapCanvas||!this.minimapCtx)return;
    const enabled=this.minimapEnabled()&&this.mode==="play";
    this.minimapEl.hidden=!enabled;
    if(!enabled)return;

    const frameAsset=String(this.minimapConfig().frameAsset??"").trim();
    const hasFrame=Boolean(frameAsset);
    this.minimapEl.classList.toggle("has-frame",hasFrame);
    if(this.minimapFrameEl){
      if(hasFrame){
        if(this.minimapFrameEl.getAttribute("src")!==frameAsset)this.minimapFrameEl.src=frameAsset;
        this.minimapFrameEl.hidden=false;
      }else{
        this.minimapFrameEl.hidden=true;
        this.minimapFrameEl.removeAttribute("src");
      }
    }
    if(!force&&time-this.minimapLastRender<100)return;
    this.minimapLastRender=time;

    const rect=this.minimapCanvas.getBoundingClientRect();
    const width=Math.max(1,Math.round(rect.width||148));
    const height=Math.max(1,Math.round(rect.height||148));
    const dpr=Math.max(1,Math.min(3,globalThis.devicePixelRatio||1));
    const pixelWidth=Math.round(width*dpr);
    const pixelHeight=Math.round(height*dpr);
    if(this.minimapCanvas.width!==pixelWidth||this.minimapCanvas.height!==pixelHeight){
      this.minimapCanvas.width=pixelWidth;
      this.minimapCanvas.height=pixelHeight;
    }

    const ctx=this.minimapCtx;
    ctx.setTransform(dpr,0,0,dpr,0,0);
    ctx.clearRect(0,0,width,height);

    const area=this.getPlayableBounds();
    const pad=10;
    const drawWidth=Math.max(1,width-pad*2);
    const drawHeight=Math.max(1,height-pad*2);
    const scale=Math.min(drawWidth/area.width,drawHeight/area.height);
    const mapWidth=area.width*scale;
    const mapHeight=area.height*scale;
    const offsetX=(width-mapWidth)/2;
    const offsetY=(height-mapHeight)/2;
    const project=(x,y)=>({
      x:offsetX+(Number(x)-area.left)*scale,
      y:offsetY+(Number(y)-area.top)*scale
    });

    ctx.save();
    ctx.fillStyle="rgba(5,38,55,.88)";
    ctx.fillRect(offsetX,offsetY,mapWidth,mapHeight);
    ctx.strokeStyle="rgba(206,242,255,.75)";
    ctx.lineWidth=1;
    ctx.strokeRect(offsetX+.5,offsetY+.5,Math.max(0,mapWidth-1),Math.max(0,mapHeight-1));

    for(const entity of this.minimapEntities()){
      const point=project(entity.visualX??entity.x,entity.visualY??entity.y);
      const logicalType=this.minimapLogicalType(entity);
      ctx.save();
      ctx.translate(point.x,point.y);

      if(logicalType==="ship"){
        const bossShip=this.isCoopBoss(entity);
        ctx.rotate((Number(entity.visualRotation??entity.rotation)||0)*Math.PI/180);
        ctx.beginPath();
        ctx.moveTo(0,-6);
        ctx.lineTo(4.5,5);
        ctx.lineTo(0,2.8);
        ctx.lineTo(-4.5,5);
        ctx.closePath();
        // Minimap ship colors: bosses yellow, remote players green, regular NPCs red.
        ctx.fillStyle=bossShip
          ?"rgba(255,213,74,.99)"
          :"rgba(255,111,92,.98)";
        ctx.strokeStyle=bossShip
          ?"rgba(255,250,210,.99)"
          :"rgba(255,235,228,.98)";
        ctx.lineWidth=1.5;
        ctx.fill();
        ctx.stroke();
      }else if(logicalType==="island"){
        const radius=Math.max(4.5,Math.min(10,Math.max(Number(entity.width||180),Number(entity.height||140))*scale*.22));
        ctx.beginPath();
        ctx.ellipse(0,0,radius,radius*.68,0,0,Math.PI*2);
        ctx.fillStyle="rgba(102,187,106,.98)";
        ctx.strokeStyle="rgba(226,255,210,.98)";
        ctx.lineWidth=1.5;
        ctx.fill();
        ctx.stroke();
      }else if(logicalType==="region-exit"){
        const dx=Number(entity.x||0)-Number(this.config.width||0)/2;
        const dy=Number(entity.y||0)-Number(this.config.height||0)/2;
        const angle=Math.abs(dx)>Math.abs(dy)
          ?(dx<0?-Math.PI/2:Math.PI/2)
          :(dy<0?0:Math.PI);
        ctx.rotate(angle);
        ctx.beginPath();
        ctx.moveTo(0,-8);
        ctx.lineTo(6,3);
        ctx.lineTo(2.5,3);
        ctx.lineTo(2.5,7);
        ctx.lineTo(-2.5,7);
        ctx.lineTo(-2.5,3);
        ctx.lineTo(-6,3);
        ctx.closePath();
        ctx.fillStyle="rgba(126,231,255,.98)";
        ctx.strokeStyle="rgba(232,252,255,.98)";
        ctx.lineWidth=1.5;
        ctx.fill();
        ctx.stroke();
      }else{
        ctx.rotate(Math.PI/4);
        ctx.fillStyle="rgba(255,204,92,.98)";
        ctx.strokeStyle="rgba(255,249,215,.98)";
        ctx.lineWidth=1.5;
        ctx.fillRect(-4.5,-4.5,9,9);
        ctx.strokeRect(-4.5,-4.5,9,9);
      }

      ctx.restore();
    }

    if(this.minimapConfig().showCamera!==false&&this.viewportSize&&this.zoom>0){
      const viewW=Math.min(area.width,this.viewportSize.width/this.zoom);
      const viewH=Math.min(area.height,this.viewportSize.height/this.zoom);
      const left=Math.max(area.left,Math.min(area.right-viewW,this.camera.x-viewW/2));
      const top=Math.max(area.top,Math.min(area.bottom-viewH,this.camera.y-viewH/2));
      const view=project(left,top);
      ctx.strokeStyle="rgba(255,255,255,.42)";
      ctx.lineWidth=1;
      ctx.strokeRect(view.x,view.y,Math.max(2,viewW*scale),Math.max(2,viewH*scale));
    }

    const player=project(this.player.x,this.player.y);
    ctx.save();
    ctx.translate(player.x,player.y);
    ctx.rotate((Number(this.player.rotation)||0)*Math.PI/180);
    ctx.beginPath();
    ctx.moveTo(0,-7);
    ctx.lineTo(5.5,6);
    ctx.lineTo(0,3.5);
    ctx.lineTo(-5.5,6);
    ctx.closePath();
    // The local player is always white so it stands apart from remote players.
    ctx.fillStyle="#ffffff";
    ctx.strokeStyle="rgba(2,24,37,.95)";
    ctx.lineWidth=2;
    ctx.fill();
    ctx.stroke();
    ctx.restore();

    ctx.restore();
  }

  updateProgress(){
    const total=this.entities.filter(e=>e.type==="barrel").length;
    const collected=this.entities.filter(e=>e.type==="barrel"&&this.collected.has(e.id)).length;
    if(this.progressEl)this.progressEl.textContent=`Barris: ${collected}/${total}`;
  }




  isCoopBoss(entity){
    return Boolean(entity&&String(entity.type||"")==="ship"&&(entity.coopBoss===true||entity.boss===true||entity.combat?.boss===true||entity.npcRole==="boss"));
  }

  coopBossId(entity){
    return String(entity?.coopBossId||entity?.npcId||entity?.id||"").replace(/[^a-z0-9._-]+/gi,"-");
  }


  updateTutorialGuideArrow(){
    const guide=this.getTutorialGuide?.();
    const stage=String(guide?.stage||"");
    if(this.contextGuideTarget==="shipyard"){
      const shipyard=this.entities.find(entity=>entity?.interaction==="shipyard")||null;
      if(shipyard&&distance(this.player,shipyard)>Math.max(300,Number(shipyard.width||0)*.55)){
        guide||(this.contextGuideTarget="shipyard");
      }else{
        this.contextGuideTarget=null;
      }
    }
    if(!guide&&!this.contextGuideTarget){
      this.tutorialArrowEl?.remove();
      this.tutorialArrowEl=null;
      return;
    }
    let target=this.contextGuideTarget==="shipyard"
      ?(this.entities.find(entity=>entity?.interaction==="shipyard")||null)
      :null;
    if(!target&&(stage==="treasure"||stage==="collect-10"||stage==="prepare-next-map")){

      target=this.entities
        .filter(entity=>String(entity?.type||"")==="treasure"&&!this.collected.has(entity.id)&&entity?.el?.hidden!==true)
        .sort((a,b)=>distance(this.player,a)-distance(this.player,b))[0]||null;
    }else if(stage==="sail-next-map"){
      target=this.entities
        .filter(entity=>String(entity?.type||"")==="region-exit"&&String(entity?.destinationWorldId||"")==="r2-costa-corsarios")
        .sort((a,b)=>distance(this.player,a)-distance(this.player,b))[0]||null;
    }else if(stage==="attack-ship"||stage==="attack-ship-2"||stage==="missions-hunt"){
      const locked=this.entities.find(entity=>entity.tutorialCombatTarget&&!this.collected.has(entity.id)&&!this.navalDestroying.has(entity.id))||null;
      if(stage!=="missions-hunt"&&locked?.tutorialCombatPhase==="ready-fire"){
        const fireButton=this.mobileHud?.wrap?.querySelector?.('[data-hud-action="fire"]');
        const rect=fireButton?.getBoundingClientRect?.();
        if(rect&&rect.width>0&&rect.height>0){
          if(!this.tutorialArrowEl){
            const arrow=document.createElement("div");
            arrow.className="tq-tutorial-guide-arrow";
            arrow.textContent="➤";
            document.body.append(arrow);
            this.tutorialArrowEl=arrow;
          }else if(this.tutorialArrowEl.parentElement!==document.body){
            document.body.append(this.tutorialArrowEl);
          }
          const x=rect.left+rect.width/2;
          const y=Math.max(32,rect.top-34);
          this.tutorialArrowEl.style.position="fixed";
          this.tutorialArrowEl.style.left=x+"px";
          this.tutorialArrowEl.style.top=y+"px";
          this.tutorialArrowEl.style.transform="translate(-50%,-50%) rotate(1.5708rad)";
          this.tutorialArrowEl.style.zIndex="10050";
          return;
        }
      }
      if(stage!=="missions-hunt"&&locked?.tutorialCombatPhase==="firing"){
        this.tutorialArrowEl?.remove();
        this.tutorialArrowEl=null;
        return;
      }
      target=locked||this.entities
        .filter(entity=>this.isClickableCombatShip(entity)&&!entity.tutorialDefeated&&!this.collected.has(entity.id)&&!this.navalDestroying.has(entity.id)&&(stage!=="missions-hunt"||entity.tutorialMissionCorsair===true))
        .sort((a,b)=>distance(this.player,a)-distance(this.player,b))[0]||null;
    }
    if(!target){
      this.tutorialArrowEl?.remove();
      this.tutorialArrowEl=null;
      return;
    }
    if(!this.tutorialArrowEl){
      const arrow=document.createElement("div");
      arrow.className="tq-tutorial-guide-arrow";
      arrow.textContent="➤";
      this.host?.append(arrow);
      this.tutorialArrowEl=arrow;
    }else if(this.tutorialArrowEl.parentElement!==this.host){
      this.host?.append(this.tutorialArrowEl);
    }
    this.tutorialArrowEl.style.position="";
    this.tutorialArrowEl.style.zIndex="";
    const viewportW=Math.max(1,Number(this.viewportSize?.width)||this.viewport?.clientWidth||this.host?.clientWidth||1);
    const viewportH=Math.max(1,Number(this.viewportSize?.height)||this.viewport?.clientHeight||this.host?.clientHeight||1);
    const zoom=Math.max(.01,Number(this.mode==="play"?this.playZoom:this.zoom)||1);
    const px=viewportW/2+(Number(this.player?.x||0)-Number(this.camera?.x||0))*zoom;
    const py=viewportH/2+(Number(this.player?.y||0)-Number(this.camera?.y||0))*zoom;
    const tx=viewportW/2+(Number(target.visualX??target.x??0)-Number(this.camera?.x||0))*zoom;
    const ty=viewportH/2+(Number(target.visualY??target.y??0)-Number(this.camera?.y||0))*zoom;
    const angle=Math.atan2(ty-py,tx-px);
    const radius=Math.min(135,Math.max(72,Math.min(viewportW,viewportH)*.18));
    const left=clamp(px+Math.cos(angle)*radius,42,viewportW-42);
    const top=clamp(py+Math.sin(angle)*radius,42,viewportH-42);
    this.tutorialArrowEl.style.left=left+"px";
    this.tutorialArrowEl.style.top=top+"px";
    this.tutorialArrowEl.style.transform="translate(-50%,-50%) rotate("+angle+"rad)";
  }

  tick(time){
    // Do not turn frame drops into slow motion. A 40 ms cap makes the whole
    // simulation run slower whenever rendering falls below 25 FPS. Keep a
    // broader safety cap so movement remains tied to real elapsed time.
    const dt=Math.min(.10,Math.max(.001,(time-this.lastTime)/1000));
    this.lastTime=time;
    if(this.mode==="play"&&!this.challengeActive&&!this.combatActive&&this.navalPlayerHp>0)this.updatePlayer(dt);
    else if(this.editorPreviewActive)this.updateEditorPreviewPlayer(time,dt);
    if(this.mode==="play")this.applyLocalAuthorityCorrection(dt);
    this.updatePlayerVisual(time,dt);
    this.updatePlayerWaterEffects(time);
    // World simulation never freezes because the local player sank.
    this.updateEntityMotionFrame(time,dt);
    this.updateTreasurePopulation(time);
    this.treasureCombatLocked();
    const collectingTreasure=this.updateTreasureCollection();
    if(!collectingTreasure&&!this.challengeActive){
      this.syncAutomaticCombatTarget();
      this.updateDirectNavalCombat(time);
    }
    this.updateTutorialGuideArrow();
    this.updateCameraKeyboard(dt);
    this.updateCamera(false,dt);
    this.updateEnvironmentCycle(time);
    if(this.graphicsSettings?.clouds!==false&&this.cloudsEl&&!this.cloudsEl.hidden){
      const parallax=this.environmentConfig().clouds.parallax;
      this.cloudsEl.style.setProperty("--cloud-camera-x",(-this.camera.x*parallax)+"px");
      this.cloudsEl.style.setProperty("--cloud-camera-y",(-this.camera.y*parallax)+"px");
    }
    this.updateOceanFrame(time);
    this.navalRenderer?.render?.({
      time,
      camera:this.camera,
      zoom:this.mode==="play"?this.playZoom:this.zoom,
      width:this.viewportSize?.width||this.viewport?.clientWidth||1,
      height:this.viewportSize?.height||this.viewport?.clientHeight||1,
      damagedShips:this.navalDamageVisuals(),
      treasures:this.entities
        .filter(entity=>String(entity?.type||"")==="treasure"
          &&!this.collected.has(entity.id)
          &&!entity.treasurePending
          &&entity.el?.hidden!==true)
        .map(entity=>({
          x:Number(entity.visualX??entity.x)||0,
          y:Number(entity.visualY??entity.y)||0,
          size:Math.max(42,Number(entity.width)||0,Number(entity.height)||0),
          phase:(Math.abs(hashString(String(entity.id||"treasure")))%6283)/1000
        }))
    });
    this.updateNearby();
    this.renderMinimap(false,time);

    if(this.coordsEl){
      const target=this.mode==="edit"?this.camera:this.player;
      this.coordsEl.textContent=`x ${Math.round(target.x)} · y ${Math.round(target.y)}`;
    }
    if(this.directionEl)this.directionEl.textContent=(this.config.player?.sprite||this.config.player?.directions)?`Direção: ${String(this.player.direction||"n").toUpperCase()}`:"";
    if(this.zoomEl)this.zoomEl.textContent=this.mode==="edit"?`zoom ${Math.round(this.zoom*100)}%`:"";

    this.raf=requestAnimationFrame(t=>this.tick(t));
  }

  getState(){
    return {
      player:{x:this.player.x,y:this.player.y,vx:this.player.vx,vy:this.player.vy,rotation:this.player.rotation,direction:this.player.direction},
      collected:[...this.collected],
      navalPlayerHp:this.navalPlayerHp,
      navalNpcHp:Object.fromEntries(
        this.entities
          .filter(entity=>String(entity?.type||"")==="ship"&&entity?.id&&!this.collected.has(entity.id)&&!this.navalDestroying.has(String(entity.id)))
          .map(entity=>{
            const hp=this.navalHpState(entity);
            return [String(entity.id),Math.max(0,Number(hp.current)||0)];
          })
      ),
      hullReinforcement:this.hullReinforcement?.hp>0&&Date.now()<Number(this.hullReinforcement.expiresAt||0)
        ?{
          hp:Math.max(0,Number(this.hullReinforcement.hp)||0),
          expiresAt:Number(this.hullReinforcement.expiresAt)||0
        }
        :{hp:0,expiresAt:0},
      combat:this.combatActive?{enemyId:this.combatActive.entity?.id||null,enemyHp:this.combatActive.enemyHp,playerHp:this.combatActive.playerHp}:null
    };
  }

  destroy(){
    if(this.challengeTimer)clearTimeout(this.challengeTimer);
    if(this.combatTimer)clearTimeout(this.combatTimer);
    for(const side of ["player","enemy"]){
      if(this.combatSpriteTimers?.[side])clearTimeout(this.combatSpriteTimers[side]);
    }
    if(this.combatFxTimer)clearTimeout(this.combatFxTimer);
    this.challengeTimer=0;
    this.combatTimer=0;
    this.combatSpriteTimers={player:0,enemy:0};
    this.combatFxTimer=0;
    cancelAnimationFrame(this.raf);
    this.resetOceanRenderer();
    for(const timer of this.navalDestroyTimers.values())clearTimeout(timer);
    this.navalDestroyTimers.clear();
    this.navalDestroying.clear();
    this.audio?.destroy?.();
    this.audio=null;
    this.navalRenderer?.destroy?.();
    this.navalRenderer=null;
    for(const renderer of this.entityEffectRenderers.values())renderer?.destroy?.();
    this.entityEffectRenderers.clear();
    this.clearPlayerWake();
    for(const cleanup of this.cleanups.splice(0))cleanup();
    this.shopOverlay?.destroy?.();
    this.shipyardOverlay?.destroy?.();
    this.mobileHud?.destroy?.();
    this.root.classList.remove("tq-world-test-active");
    this.root.innerHTML="";
  }
}