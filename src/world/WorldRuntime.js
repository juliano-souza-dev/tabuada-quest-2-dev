import { normalizeOceanConfig, applyOceanPreset, computeOceanFrame, cameraFollowStep } from "./WorldOceanEffect.mjs?v=20261001-1512";
import { WORLD_ENVIRONMENT_PRESETS, environmentPreset } from "./WorldEnvironmentPresets.mjs?v=20261001-0850";
import { normalizeEntityMotion, applyEntityMotionPreset, computeEntityMotionFrame, defaultEntityMotion } from "./WorldEntityMotion.mjs?v=20260930-1912";
import { normalizeEntityEffect, applyEntityEffectPreset, computeEntityEffectFrame, listEntityEffectPresets } from "./WorldEntityEffects.mjs?v=20260930-1912";
import { EntityWebGLEffectRenderer } from "./EntityWebGLEffectRenderer.mjs?v=20260930-1912";
import { resolveEntityPresentation } from "./WorldEntityPresentation.mjs?v=20260930-1912";
import { normalizeJoystickVector, screenPointToWorld, targetNavigationVector } from "./WorldNavigationInput.mjs?v=20260930-1912";
import { directionForHeading, resolveDirectionalSource, directionalRegionStyle } from "./WorldDirectionalSprite.mjs?v=20260930-1912";
import { OceanWebGLRenderer } from "./OceanWebGLRenderer.mjs?v=20261001-2258";
import {
  normalizeCollision,
  inferCollisionAction,
  collisionMessage,
  collisionActionLabel,
  resolveCircleVsEntity,
  removeVelocityIntoNormal,
  contourVelocity
} from "./WorldCollision.mjs?v=20261001-1438";
const clamp=(value,min,max)=>Math.min(max,Math.max(min,value));
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
      speed:clamp(Number(movement.speed??80),0,420)
    },
    types:types.slice(0,12).map(item=>({
      shipId:String(item?.shipId||""),
      count:clamp(Math.floor(Number(item?.count)||0),0,50),
      combat:item?.combat===true,
      hp:clamp(Math.floor(Number(item?.hp)||3),1,20)
    })).filter(item=>item.shipId&&item.count>0)
  };
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
    this.config.ocean=normalizeOceanConfig(this.config.ocean||{});
    this.editorEnabled=options.editorEnabled===true;
    this.mode=this.editorEnabled?"edit":"play";
    this.onEnterScene=options.onEnterScene||null;
    this.onEnterWorld=options.onEnterWorld||null;
    this.onSelectionChange=options.onSelectionChange||null;
    this.onEntityChange=options.onEntityChange||null;
    this.createPedagogyChallenge=typeof options.createPedagogyChallenge==="function"?options.createPedagogyChallenge:null;
    this.onPedagogyResult=typeof options.onPedagogyResult==="function"?options.onPedagogyResult:null;
    this.onTreasureCollected=typeof options.onTreasureCollected==="function"?options.onTreasureCollected:null;
    this.onCombatVictory=typeof options.onCombatVictory==="function"?options.onCombatVictory:null;
    this.onRewardCollected=typeof options.onRewardCollected==="function"?options.onRewardCollected:null;
    this.onExecuteAction=typeof options.onExecuteAction==="function"?options.onExecuteAction:null;
    this.resolveShip=typeof options.resolveShip==="function"?options.resolveShip:null;
    this.config.npcPopulation=normalizeNpcPopulation(this.config.npcPopulation||{});
    this.generatedNpcIds=new Set();
    this.challengeActive=null;
    this.challengeTimer=0;
    this.combatActive=null;
    this.combatTimer=0;
    this.combatSpriteTimers={player:0,enemy:0};
    this.combatFxTimer=0;
    this.state=structuredClone(options.state||{});
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
    this.playZoom=clamp(Number(config.camera?.playZoom??1),.55,1.4);
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
    this.pointerDirections=new Set();
    this.joystick={x:0,y:0,active:false,pointerId:null};
    this.navigationTarget=null;
    this.entityEffectRenderers=new Map();
    this.entityEffectOrigins=new Map();
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
      normalized.collision=normalizeCollision(normalized.collision||{},normalized);
      normalized.visualX=Number(normalized.x||0);
      normalized.visualY=Number(normalized.y||0);
      normalized.visualRotation=Number(normalized.rotation||0);
      return normalized;
    });
    this.rebuildNpcPopulation({render:false});
    this.selectedId=null;
    this.lastTime=0;
    this.raf=0;
    this.nearby=null;
    this.contactEntity=null;
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
    const profile=this.npcShipProfile(shipId);
    if(!profile)return null;
    const point=this.npcSpawnPoint(random,occupied,population);
    occupied.push(point);
    const heading=random()*360-180;
    const sprite=profile.sprite&&typeof profile.sprite==="object"?structuredClone(profile.sprite):null;
    const src=String(profile.src||sprite?.src||"");
    const combatEnabled=typeConfig.combat===true;

    const entity={
      id:"npc.auto."+String(shipId).replace(/[^a-z0-9._-]+/gi,"-")+"."+(index+1),
      type:"ship",
      role:"npc",
      shipId:String(shipId),
      shipName:String(profile.shipName||profile.name||shipId),
      label:String(profile.shipName||profile.name||shipId),
      src,
      sprite,
      width:Math.max(32,Number(profile.width)||180),
      height:Math.max(32,Number(profile.height)||180),
      x:point.x,
      y:point.y,
      z:22,
      rotation:heading,
      direction:directionForHeading(heading,null,{hysteresis:0}),
      lockAspect:true,
      runtimeGenerated:true,
      npcNavigation:{
        mode:"straight",
        speed:Math.max(0,Number(population.movement.speed)||0),
        heading
      },
      combatSprite:profile.combatSprite?structuredClone(profile.combatSprite):null,
      combatVisual:profile.combatVisual?structuredClone(profile.combatVisual):(profile.combat?structuredClone(profile.combat):null),
      combat:{enabled:combatEnabled,hp:Math.max(1,Number(typeConfig.hp)||3)},
      motion:{active:true,preset:"navigation",speed:45,heave:26,pitch:18,roll:10,sway:8},
      effect:{category:"ship",preset:"none",active:false},
      collision:{
        active:true,
        shape:"ellipse",
        scaleX:.46,
        scaleY:.60,
        padding:8,
        action:combatEnabled?"combat":"none",
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

  rebuildNpcPopulation({render=true}={}){
    if(!this.entities)return;
    this.entities=this.entities.filter(entity=>!entity.runtimeGenerated);
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
        for(let index=0;index<typeConfig.count&&total<80;index++,total++){
          const entity=this.createGeneratedNpc({
            shipId:typeConfig.shipId,
            index:total,
            typeConfig,
            population,
            random,
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
    if(render&&this.entityLayer)this.renderEntities();
  }

  updateNpcNavigation(entity,dt){
    if(this.mode!=="play"||!entity?.runtimeGenerated)return;
    const nav=entity.npcNavigation;
    if(!nav||nav.mode!=="straight")return;
    const speed=Math.max(0,Number(nav.speed)||0);
    if(speed<=0)return;

    const heading=Number(nav.heading??entity.rotation)||0;
    const rad=heading*Math.PI/180;
    entity.x+=Math.sin(rad)*speed*dt;
    entity.y-=Math.cos(rad)*speed*dt;

    const area=this.getPlayableBounds();
    const halfW=Math.max(8,Number(entity.width)||96)/2;
    const halfH=Math.max(8,Number(entity.height)||96)/2;
    const left=area.left+halfW,right=area.right-halfW,top=area.top+halfH,bottom=area.bottom-halfH;
    if(entity.x<left)entity.x=right;
    else if(entity.x>right)entity.x=left;
    if(entity.y<top)entity.y=bottom;
    else if(entity.y>bottom)entity.y=top;

    entity.rotation=heading;
    entity.direction=directionForHeading(heading,entity.direction,{hysteresis:0});
    entity.anchorX=entity.x;
    entity.anchorY=entity.y;
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
        </div>
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
      <div class="tq-world-challenge" data-world-challenge hidden>
        <section class="tq-world-challenge__card" role="dialog" aria-modal="true" aria-labelledby="tq-world-challenge-title">
          <button type="button" class="tq-world-challenge__close" data-world-challenge-close aria-label="Fechar desafio">×</button>
          <small>BAÚ DO TESOURO</small>
          <h2 id="tq-world-challenge-title">Resolva para recolher</h2>
          <strong class="tq-world-challenge__prompt" data-world-challenge-prompt></strong>
          <form data-world-challenge-form>
            <label>
              <span>Sua resposta</span>
              <input type="number" inputmode="numeric" autocomplete="off" data-world-challenge-answer>
            </label>
            <button type="submit" data-world-challenge-submit>Responder</button>
          </form>
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
        <div class="tq-world-help">Joystick analógico · WASD / setas<br>toque ou clique no oceano para navegar</div>
        <button type="button" class="tq-world-recenter" data-world-recenter hidden aria-label="Centralizar câmera no navio">🎯 Navio</button>
      </div>`;

    this.root.append(this.host);
    this.viewport=this.host.querySelector(".tq-world-viewport");
    this.oceanCanvas=this.host.querySelector("[data-world-ocean-webgl]");
    this.oceanRenderer=null;
    this.oceanRendererInit=null;
    this.stage=this.host.querySelector(".tq-world-stage");
    this.cloudsEl=this.host.querySelector("[data-world-clouds]");
    this.weatherEl=this.host.querySelector("[data-world-weather]");
    this.playableBoundaryEl=this.host.querySelector("[data-world-playable-boundary]");
    this.entityLayer=this.host.querySelector(".tq-world-entities");
    this.playerWakeLayer=this.host.querySelector("[data-world-player-wake]");
    this.playerShadowEl=this.host.querySelector("[data-world-player-shadow]");
    this.playerEl=this.host.querySelector(".tq-world-player");
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
    this.challengeWrap=this.host.querySelector("[data-world-challenge]");
    this.challengeForm=this.host.querySelector("[data-world-challenge-form]");
    this.challengePrompt=this.host.querySelector("[data-world-challenge-prompt]");
    this.challengeAnswer=this.host.querySelector("[data-world-challenge-answer]");
    this.challengeFeedback=this.host.querySelector("[data-world-challenge-feedback]");
    this.challengeSubmit=this.host.querySelector("[data-world-challenge-submit]");
    this.challengeClose=this.host.querySelector("[data-world-challenge-close]");
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
    this.playerEl.style.backgroundRepeat="no-repeat";
    if(this.config.player?.width)this.playerEl.style.width=Math.max(24,Number(this.config.player.width)||108)+"px";
    if(this.config.player?.height)this.playerEl.style.height=Math.max(24,Number(this.config.player.height)||150)+"px";
    this.nameEl.textContent=this.config.name||this.config.id||"Mundo";

    this.renderEntities();
    this.bindControls();
    this.bindChallengeControls();
    this.bindCombatControls();
    this.bindRegionTransitionControls();
    this.bindCameraPan();
    this.resize();
    this.onResize=()=>this.resize();
    window.addEventListener("resize",this.onResize);
    this.cleanups.push(()=>window.removeEventListener("resize",this.onResize));

    this.setMode(this.mode);
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
      el.style.zIndex=String(entity.z??10);

      if(presentation.hasSprite){
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

      const collider=document.createElement("span");
      collider.className="tq-world-entity__collider";
      collider.setAttribute("aria-hidden","true");
      el.append(collider);

      entity.el=el;
      this.applyEntityVisual(entity);
      if(this.collected.has(entity.id))el.hidden=true;
      if(this.editorEnabled&&!entity.runtimeGenerated)this.bindEntityEditing(entity);
      this.entityLayer.append(el);
      this.syncEntityEffectRenderer(entity);
    }

    this.ensureGizmo();
    this.applySelectionVisual();
    this.syncGizmo();
    this.updateProgress();
  }

  applyEntityVisual(entity){
    const el=entity.el;
    if(!el)return;
    el.style.left=entity.x+"px";
    el.style.top=entity.y+"px";
    el.style.width=(entity.width||96)+"px";
    el.style.height=(entity.height||96)+"px";
    el.style.transform=`translate(-50%,-50%) rotate(${Number(entity.rotation||0)}deg) skewX(${Number(entity.skewX||0)}deg) skewY(${Number(entity.skewY||0)}deg)`;
    const logicalOnly=el.dataset.renderMode==="logical";
    el.classList.toggle("is-logical-only",logicalOnly);
    el.style.visibility=logicalOnly&&this.mode==="play"?"hidden":"visible";
    const img=el.querySelector("img");
    if(img&&img.getAttribute("src")!==String(entity.src||""))img.src=entity.src||"";
    this.applyEntityDirectionalVisual(entity);
    this.syncCollisionVisual(entity);
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
    const atlasMode=entity.el.dataset.renderMode==="atlas";
    // Directional atlases are rendered by CSS background cropping. Never
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

  bindEntityEditing(entity){
    const el=entity.el;
    if(!el)return;

    el.addEventListener("pointerdown",event=>{
      if(this.mode!=="edit")return;
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

    const finishPan=()=>{
      const dragged=Boolean(pan?.dragging);
      this.host?.classList.remove("is-camera-dragging");
      if(this.mode==="play"&&dragged&&this.playCameraDetached){
        this.playCameraRecenterAt=performance.now()+3000;
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
      finishPan();
    };

    const touchStart=event=>{
      if(pan)return;
      if(isBlockedTarget(event.target))return;
      const touch=event.touches?.[0];
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
      finishPan();
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

  resetJoystick(){
    this.joystick.x=0;
    this.joystick.y=0;
    this.joystick.active=false;
    this.joystick.pointerId=null;
    if(this.joystickThumbEl)this.joystickThumbEl.style.transform="translate3d(0,0,0)";
  }

  bindControls(){
    const keyMap={
      ArrowUp:"up",KeyW:"up",
      ArrowDown:"down",KeyS:"down",
      ArrowLeft:"left",KeyA:"left",
      ArrowRight:"right",KeyD:"right"
    };

    const keydown=e=>{
      if(this.mode!=="play"||this.challengeActive)return;
      const dir=keyMap[e.code];
      if(!dir)return;
      e.preventDefault();
      this.clearNavigationTarget();
      this.keys.add(dir);
    };
    const keyup=e=>{
      const dir=keyMap[e.code];
      if(dir)this.keys.delete(dir);
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
      e.preventDefault();
      e.stopPropagation();
      const touch=e.changedTouches[0];
      this.clearNavigationTarget();
      this.joystick.active=true;
      this.joystick.pointerId=touch.identifier;
      updateJoystickPoint(touch.clientX,touch.clientY);
    };
    const joystickTouchMove=e=>{
      if(!touchCapable||!this.joystick.active)return;
      const touches=[...(e.touches||[])];
      const touch=touches.find(item=>item.identifier===this.joystick.pointerId);
      if(!touch)return;
      e.preventDefault();
      updateJoystickPoint(touch.clientX,touch.clientY);
    };
    const joystickTouchEnd=e=>{
      if(!touchCapable||this.joystick.pointerId===null)return;
      const ended=[...(e.changedTouches||[])].some(item=>item.identifier===this.joystick.pointerId);
      if(!ended)return;
      e.preventDefault();
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

    const action=()=>this.activateNearby();
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
    if(this.modeEl)this.modeEl.textContent=this.mode==="edit"?"REGIÃO · EDITAR":"REGIÃO · PLAY";
    if(this.mode==="play"){
      this.keys.clear();
      this.pointerDirections.clear();
      this.resetJoystick();
      this.clearNavigationTarget();
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
      this.clearPlayerWake();
      this.nearby=null;
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
        changed=true;
        x=hit.x;
        y=hit.y;

        const action=inferCollisionAction(entity,entity.collision);
        const cleaned=removeVelocityIntoNormal({x:vx,y:vy},hit.normalX,hit.normalY);
        vx=cleaned.x;
        vy=cleaned.y;

        if(action!=="none"){
          if(!contact||hit.penetration>contact.penetration){
            contact={entity,penetration:hit.penetration};
          }
          continue;
        }

        const remembered=this.collisionAvoidance.entityId===entity.id&&this.collisionAvoidance.until>now
          ?this.collisionAvoidance.side
          :0;
        const contour=contourVelocity(
          {x:vx,y:vy},
          hit.normalX,
          hit.normalY,
          desired,
          {
            side:remembered,
            minSpeed:this.navigationTarget?145:105,
            maxSpeed:this.navigationTarget?285:230,
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
    const braking=clamp(Number(this.config.player?.braking??.12),.01,.98);
    const drag=Math.pow(braking,dt);

    this.player.vx=(this.player.vx+input.x*accel*dt)*drag;
    this.player.vy=(this.player.vy+input.y*accel*dt)*drag;

    let speed=Math.hypot(this.player.vx,this.player.vy);
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
    this.contactEntity=resolved.contact;

    speed=Math.hypot(this.player.vx,this.player.vy);
    if(speed>8){
      this.player.rotation=Math.atan2(this.player.vy,this.player.vx)*180/Math.PI+90;
    }
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
    const entity=this.entities.find(item=>item.id===id);
    if(!entity)return null;
    return normalizeEntityMotion(entity.motion||defaultEntityMotion(entity.type),entity.type);
  }

  updateEntityMotion(id,patch={},commit=true){
    const entity=this.entities.find(item=>item.id===id);
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
    const entity=this.entities.find(item=>item.id===id);
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
    const entity=this.entities.find(item=>item.id===id);
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
      const hasDirectionalSprite=Boolean(entity.sprite?.src&&entity.sprite?.regions);
      const rotation=(hasDirectionalSprite?0:Number(entity.rotation||0))+Number(motionFrame.rotation||0)+Number(effectFrame.rotation||0);
      const scaleX=Number(effectFrame.scaleX||1);
      const scaleY=Number(motionFrame.scaleY||1)*Number(effectFrame.scaleY||1);

      entity.visualX=entity.x+offsetX;
      entity.visualY=entity.y+offsetY;
      entity.visualRotation=Number(entity.rotation||0);
      entity.el.style.left=entity.visualX+"px";
      entity.el.style.top=entity.visualY+"px";
      entity.el.style.opacity=String(effect.active?effectFrame.opacity:1);
      entity.el.style.transform=`translate(-50%,-50%) rotate(${rotation}deg) skewX(${Number(entity.skewX||0)}deg) skewY(${Number(entity.skewY||0)}deg) scale(${scaleX},${scaleY})`;
      if(hasDirectionalSprite)this.applyEntityDirectionalVisual(entity);

      const img=entity.el.querySelector("img");
      const canvas=entity.el.querySelector(".tq-world-entity__webgl");
      const blur=effect.active?Number(effectFrame.blur||0):0;
      if(img)img.style.filter=`drop-shadow(0 6px 4px #001a2e80) blur(${blur}px)`;

      if(effect.active&&effect.renderer==="webgl"){
        const renderer=this.entityEffectRenderers.get(entity.id);
        const rendered=renderer?.render?.(time,effect,entity.width||96,entity.height||96)===true;
        if(canvas)canvas.hidden=!rendered;
        if(img)img.hidden=rendered;
      }else{
        if(canvas)canvas.hidden=true;
        if(img)img.hidden=Boolean(entity.sprite?.src&&entity.sprite?.regions);
      }
    }
  }

  updateCamera(immediate=false,dt=1/60){
    if(!this.viewportSize)return;
    const vw=this.viewportSize.width;
    const vh=this.viewportSize.height;

    if(this.mode==="play"){
      const zoom=this.playZoom;
      const halfW=Math.min(this.config.width/2,vw/(2*zoom));
      const halfH=Math.min(this.config.height/2,vh/(2*zoom));

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
          x:clamp(this.player.x,halfW,this.config.width-halfW),
          y:clamp(this.player.y,halfH,this.config.height-halfH)
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
      this.zoom=zoom;
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
    this.challengeClose?.addEventListener("click",close);
    this.cleanups.push(()=>{
      this.challengeForm?.removeEventListener("submit",submit);
      this.challengeClose?.removeEventListener("click",close);
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
    if(this.combatPrompt)this.combatPrompt.textContent=challenge?.available?String(challenge.prompt||""):"Desafio indisponível";
    if(this.combatFeedback)this.combatFeedback.textContent=challenge?.available?"Escolha uma das quatro respostas.":"Não foi possível gerar uma conta para este combate.";
    this.renderCombatChoices(challenge);
    this.updateCombatHud();
  }

  async beginCombat(entity){
    if(!entity||this.combatActive||this.challengeActive||this.mode!=="play")return;
    this.stopForChallenge();
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
    selectedButton?.classList.add(result.correct===true?"is-correct":"is-wrong");

    if(result.correct===true){
      active.enemyHp=Math.max(0,active.enemyHp-1);
      if(this.combatFeedback)this.combatFeedback.textContent="Acertou! Seu canhão atingiu o inimigo. O disparo dele caiu na água.";
      this.playCombatSpriteAnimation("player","fireRight");
      this.playCombatFx({from:"player",hit:true});
      setTimeout(()=>this.playCombatDamageFx("enemy"),820);
      if(active.enemyHp>0)setTimeout(()=>{
        this.playCombatSpriteAnimation("enemy","fireLeft",active.entity);
        this.playCombatFx({from:"enemy",hit:false});
      },1120);
    }else{
      active.playerHp=Math.max(0,active.playerHp-1);
      if(this.combatFeedback)this.combatFeedback.textContent="Errou. Seu tiro caiu na água e o inimigo acertou seu navio.";
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

  stopForChallenge(){
    this.keys.clear();
    this.pointerDirections.clear();
    this.resetJoystick();
    this.clearNavigationTarget({brake:true});
    this.player.vx=0;
    this.player.vy=0;
  }

  closeTreasureChallenge(){
    if(this.challengeTimer){
      clearTimeout(this.challengeTimer);
      this.challengeTimer=0;
    }
    this.challengeActive=null;
    if(this.challengeWrap)this.challengeWrap.hidden=true;
    if(this.challengeFeedback)this.challengeFeedback.textContent="";
    if(this.challengeAnswer){
      this.challengeAnswer.value="";
      this.challengeAnswer.disabled=false;
    }
    if(this.challengeSubmit)this.challengeSubmit.disabled=false;
  }

  async beginTreasureChallenge(entity){
    if(!entity||this.challengeActive||this.mode!=="play")return;
    this.stopForChallenge();
    this.actionWrap.hidden=true;

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

    this.challengeActive={entity,challenge};
    if(this.challengeWrap)this.challengeWrap.hidden=false;
    if(this.challengeFeedback)this.challengeFeedback.textContent="";
    if(this.challengeAnswer){
      this.challengeAnswer.value="";
      this.challengeAnswer.disabled=false;
    }
    if(this.challengeSubmit)this.challengeSubmit.disabled=false;

    if(!challenge?.available){
      if(this.challengePrompt)this.challengePrompt.textContent="Desafio indisponível";
      if(this.challengeFeedback)this.challengeFeedback.textContent=
        String(challenge?.message||"As regras pedagógicas desta conta ainda não estão disponíveis.");
      if(this.challengeAnswer)this.challengeAnswer.disabled=true;
      if(this.challengeSubmit)this.challengeSubmit.disabled=true;
      return;
    }

    if(this.challengePrompt)this.challengePrompt.textContent=String(challenge.prompt||"");
    queueMicrotask(()=>this.challengeAnswer?.focus?.());
  }

  completeCollection(entity,{challenge=null}={}){
    if(!entity||this.collected.has(entity.id))return false;
    this.collected.add(entity.id);
    if(entity.el)entity.el.hidden=true;
    this.contactEntity=null;
    this.nearby=null;
    this.actionWrap.hidden=true;
    this.updateProgress();
    if(entity.type==="treasure"){
      this.onTreasureCollected?.({
        entity:this.cleanEntity(entity),
        challenge
      });
    }
    const rewards=entity.rewards&&typeof entity.rewards==="object"?entity.rewards:null;
    if(rewards&&(Number(rewards.coins)>0||Number(rewards.xp)>0||rewards.itemId||rewards.shipId)){
      this.onRewardCollected?.({
        entity:this.cleanEntity(entity),
        rewards:structuredClone(rewards)
      });
    }
    return true;
  }

  submitTreasureAnswer(){
    const active=this.challengeActive;
    const entity=active?.entity;
    const challenge=active?.challenge;
    if(!entity||!challenge?.available||typeof challenge.evaluate!=="function")return;

    const raw=this.challengeAnswer?.value??"";
    if(String(raw).trim()===""){
      if(this.challengeFeedback)this.challengeFeedback.textContent="Digite uma resposta.";
      return;
    }

    const result=challenge.evaluate(raw)||{};
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
      if(this.challengeFeedback)this.challengeFeedback.textContent="Acertou! Tesouro conquistado.";
      this.completeCollection(entity,{challenge});
      this.challengeTimer=setTimeout(()=>this.closeTreasureChallenge(),650);
      return;
    }

    if(this.challengeFeedback)this.challengeFeedback.textContent="Resposta incorreta. O baú continua fechado.";
    this.challengeTimer=setTimeout(()=>this.closeTreasureChallenge(),900);
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
      this.actionWrap.hidden=true;
      return;
    }

    let entity=this.contactEntity&&!this.collected.has(this.contactEntity.id)
      ?this.contactEntity
      :null;

    if(!entity){
      const radius=this.playerCollisionRadius()+8;
      for(const candidate of this.entities){
        if(this.collected.has(candidate.id))continue;
        candidate.collision=normalizeCollision(candidate.collision||{},candidate);
        if(!candidate.collision.active)continue;
        if(inferCollisionAction(candidate,candidate.collision)==="none")continue;
        if(resolveCircleVsEntity(this.player,radius,candidate,candidate.collision).collided){
          entity=candidate;
          break;
        }
      }
    }

    this.nearby=entity;

    if(!entity){
      this.regionExitDismissedId=null;
      this.actionWrap.hidden=true;
      return;
    }

    const collision=normalizeCollision(entity.collision||{},entity);
    const action=inferCollisionAction(entity,collision);
    const interaction=this.entityInteraction(entity);
    if(action==="enter-world"||interaction?.actionId==="enter-region"){
      this.actionWrap.hidden=true;
      if(this.regionExitDismissedId!==entity.id&&!this.regionTransitionActive)this.openRegionTransition(entity);
      return;
    }
    if(action==="none"){
      this.actionWrap.hidden=true;
      return;
    }

    const asset=String(this.config.ui?.interactionMessageAsset||this.config.interactionMessageAsset||"");
    const safeAsset=asset.replace(/["\\]/g,"");
    this.actionWrap.classList.toggle("has-message-asset",Boolean(safeAsset));
    this.actionWrap.style.setProperty("--tq-world-message-asset",safeAsset?'url("'+safeAsset+'")':"none");
    if(this.actionMessage)this.actionMessage.textContent=collisionMessage(entity,collision);
    this.actionButton.textContent=collisionActionLabel(entity,collision);
    this.actionWrap.hidden=false;
  }

  activateNearby(){
    const entity=this.nearby;
    if(!entity||this.mode!=="play")return;

    const collision=normalizeCollision(entity.collision||{},entity);
    const action=inferCollisionAction(entity,collision);

    if(action==="combat"){
      this.beginCombat(entity);
      return;
    }

    if(action==="collect"){
      if(entity.type==="treasure"){
        this.beginTreasureChallenge(entity);
        return;
      }
      this.completeCollection(entity);
      return;
    }

    const interaction=this.entityInteraction(entity);
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
    const {el,index,anchorX,anchorY,visualX,visualY,visualRotation,...data}=entity;
    return data;
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
    if(patch.width!==undefined)next.width=clamp(Number(patch.width)||108,24,1200);
    if(patch.height!==undefined)next.height=clamp(Number(patch.height)||150,24,1200);
    if(patch.direction!==undefined)next.direction=String(patch.direction||"n").toLowerCase();

    this.config.player=next;
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

  environmentConfig(){
    const id=String(this.config.environment?.preset||"day");
    const preset=WORLD_ENVIRONMENT_PRESETS[id]?id:"day";
    const env=this.config.environment||{};
    const clouds=env.clouds&&typeof env.clouds==="object"?env.clouds:{};
    return {
      preset,
      weather:String(env.weather||environmentPreset(preset).weather||"none"),
      clouds:{
        active:clouds.active===true,
        density:clamp(Number(clouds.density??.5),0,1),
        opacity:clamp(Number(clouds.opacity??.5),0,1),
        scale:clamp(Number(clouds.scale??1),.4,2.5),
        speed:clamp(Number(clouds.speed??18),0,120),
        direction:clamp(Number(clouds.direction??0),-180,180),
        parallax:clamp(Number(clouds.parallax??.18),0,1)
      }
    };
  }

  applyEnvironmentVisual(){
    const env=this.environmentConfig();
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
    const weather=["rain","snow","halloween"].includes(env.weather)?env.weather:"none";
    if(this.weatherEl.dataset.weather===weather)return;
    this.weatherEl.dataset.weather=weather;
    this.weatherEl.className="tq-world-weather tq-world-weather--"+weather;
    this.weatherEl.replaceChildren();
    const count=weather==="rain"?42:weather==="snow"?34:weather==="halloween"?16:0;
    for(let i=0;i<count;i++){
      const p=document.createElement("i");
      p.style.setProperty("--i",String(i));
      p.style.setProperty("--x",((i*37)%101)+"%");
      p.style.setProperty("--delay",(-((i*173)%2400))+"ms");
      p.style.setProperty("--dur",(weather==="rain"?(700+(i%7)*70):weather==="snow"?(3600+(i%9)*260):(4200+(i%8)*340))+"ms");
      this.weatherEl.append(p);
    }
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

  updateWorld(patch={},commit=true){
    if(patch.name!==undefined)this.config.name=String(patch.name||this.config.id||"Mundo");
    if(patch.width!==undefined)this.config.width=clamp(Number(patch.width)||390,390,20000);
    if(patch.height!==undefined)this.config.height=clamp(Number(patch.height)||844,844,20000);
    if(patch.camera&&typeof patch.camera==="object"){
      this.config.camera={
        ...(this.config.camera||{}),
        ...structuredClone(patch.camera)
      };
      if(patch.camera.playZoom!==undefined){
        this.playZoom=clamp(Number(patch.camera.playZoom)||1,.55,1.4);
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
    if(patch.npcPopulation&&this.entityLayer)this.renderEntities();
    this.clampEditorCamera();
    this.updateCamera(true);
    if(this.nameEl)this.nameEl.textContent=this.config.name||this.config.id||"Mundo";
    return this.getWorld();
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
    const webglRendered=ocean.renderer==="webgl"
      &&this.oceanRenderer?.render?.({
        time,
        camera:this.camera,
        zoom:this.mode==="play"?this.playZoom:this.zoom,
        ocean,
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

    const frame=computeOceanFrame(ocean,time,this.camera);
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
    const entity=this.entities.find(item=>item.id===id);
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
    const entity=this.entities.find(item=>item.id===id);
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
    const entity=this.entities.find(item=>item.id===id);
    if(!entity)return null;
    entity.collision=normalizeCollision(entity.collision||{},entity);
    return structuredClone(entity.collision);
  }

  updateEntityCollision(id,patch={},commit=true){
    const entity=this.entities.find(item=>item.id===id);
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
    this.renderEntities();
    this.selectEntity(id);
    const clean=this.getEntity(id);
    this.onEntityChange?.(clean,true);
    return clean;
  }

  deleteEntity(id){
    const index=this.entities.findIndex(entity=>entity.id===id);
    if(index<0)return false;
    this.entities.splice(index,1);
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
        :["location","island","ship"]
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
        ctx.rotate((Number(entity.visualRotation??entity.rotation)||0)*Math.PI/180);
        ctx.beginPath();
        ctx.moveTo(0,-6);
        ctx.lineTo(4.5,5);
        ctx.lineTo(0,2.8);
        ctx.lineTo(-4.5,5);
        ctx.closePath();
        ctx.fillStyle="rgba(116,221,255,.96)";
        ctx.strokeStyle="rgba(225,250,255,.98)";
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

  tick(time){
    const dt=Math.min(.04,Math.max(.001,(time-this.lastTime)/1000));
    this.lastTime=time;
    if(this.mode==="play"&&!this.challengeActive&&!this.combatActive)this.updatePlayer(dt);
    else if(this.editorPreviewActive)this.updateEditorPreviewPlayer(time,dt);
    this.updatePlayerVisual(time,dt);
    this.updatePlayerWaterEffects(time);
    this.updateEntityMotionFrame(time,dt);
    this.updateCamera(false,dt);
    if(this.cloudsEl&&!this.cloudsEl.hidden){
      const parallax=this.environmentConfig().clouds.parallax;
      this.cloudsEl.style.setProperty("--cloud-camera-x",(-this.camera.x*parallax)+"px");
      this.cloudsEl.style.setProperty("--cloud-camera-y",(-this.camera.y*parallax)+"px");
    }
    this.updateOceanFrame(time);
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
      player:{x:this.player.x,y:this.player.y,rotation:this.player.rotation,direction:this.player.direction},
      collected:[...this.collected],
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
    for(const renderer of this.entityEffectRenderers.values())renderer?.destroy?.();
    this.entityEffectRenderers.clear();
    this.clearPlayerWake();
    for(const cleanup of this.cleanups.splice(0))cleanup();
    this.root.classList.remove("tq-world-test-active");
    this.root.innerHTML="";
  }
}
