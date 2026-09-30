import { normalizeOceanConfig, applyOceanPreset, computeOceanFrame, cameraFollowStep } from "./WorldOceanEffect.mjs?v=20260930-1912";
import { normalizeEntityMotion, applyEntityMotionPreset, computeEntityMotionFrame, defaultEntityMotion } from "./WorldEntityMotion.mjs?v=20260930-1912";
import { normalizeEntityEffect, applyEntityEffectPreset, computeEntityEffectFrame, listEntityEffectPresets } from "./WorldEntityEffects.mjs?v=20260930-1912";
import { EntityWebGLEffectRenderer } from "./EntityWebGLEffectRenderer.mjs?v=20260930-1912";
import { resolveEntityPresentation } from "./WorldEntityPresentation.mjs?v=20260930-1912";
import { normalizeJoystickVector, screenPointToWorld, targetNavigationVector } from "./WorldNavigationInput.mjs?v=20260930-1912";
import { directionForHeading, resolveDirectionalSource, directionalRegionStyle } from "./WorldDirectionalSprite.mjs?v=20260930-1912";
import { OceanWebGLRenderer } from "./OceanWebGLRenderer.mjs?v=20260930-1912";
import {
  normalizeCollision,
  inferCollisionAction,
  collisionMessage,
  collisionActionLabel,
  resolveCircleVsEntity,
  removeVelocityIntoNormal,
  contourVelocity
} from "./WorldCollision.mjs?v=20260930-2123";
import { computeShipOceanMotion } from "./WorldShipOceanMotion.mjs?v=20260930-2230";
const clamp=(value,min,max)=>Math.min(max,Math.max(min,value));
const distance=(a,b)=>Math.hypot((a.x||0)-(b.x||0),(a.y||0)-(b.y||0));
const normalizePlayerWaterEffects=player=>{
  const fx=player?.effects||{};
  return {
    wakeActive:fx.wakeActive!==false,
    wakeOpacity:clamp(Number(fx.wakeOpacity??.72),0,1),
    wakeWidth:clamp(Number(fx.wakeWidth??54),18,180),
    wakeLength:clamp(Number(fx.wakeLength??150),50,420),
    wakeRate:clamp(Number(fx.wakeRate??70),35,220),
    wakeMinSpeed:clamp(Number(fx.wakeMinSpeed??48),0,280),
    shadowActive:fx.shadowActive!==false,
    shadowOpacity:clamp(Number(fx.shadowOpacity??.34),0,.9),
    shadowBlur:clamp(Number(fx.shadowBlur??9),0,30),
    shadowOffset:clamp(Number(fx.shadowOffset??12),-40,80),
    shadowScaleX:clamp(Number(fx.shadowScaleX??.72),.25,1.5),
    shadowScaleY:clamp(Number(fx.shadowScaleY??.28),.12,1),
    oceanMotionActive:fx.oceanMotionActive!==false,
    oceanResponse:clamp(Number(fx.oceanResponse??1),0,2)
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
    this.onSelectionChange=options.onSelectionChange||null;
    this.onEntityChange=options.onEntityChange||null;
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
    this.playZoom=1;
    this.playCameraOffset={x:0,y:0};
    this.playCameraDetached=false;
    this.suppressNavigationClick=false;
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
    this.selectedId=null;
    this.lastTime=0;
    this.raf=0;
    this.nearby=null;
    this.contactEntity=null;
    this.collisionAvoidance={entityId:null,side:0,until:0};
    this.lastWakeSpawn=0;
    this.wakeParticleCount=0;
    this.playerOceanMotion={offsetX:0,offsetY:0,roll:0,scaleX:1,scaleY:1,energy:0};
    this.cleanups=[];
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
      <div class="tq-world-action" hidden>
        <div class="tq-world-action__surface">
          <span class="tq-world-action__message" data-world-action-message></span>
          <button type="button" data-world-action></button>
        </div>
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
    this.playerEl.style.backgroundRepeat="no-repeat";
    if(this.config.player?.width)this.playerEl.style.width=Math.max(24,Number(this.config.player.width)||108)+"px";
    if(this.config.player?.height)this.playerEl.style.height=Math.max(24,Number(this.config.player.height)||150)+"px";
    this.nameEl.textContent=this.config.name||this.config.id||"Mundo";

    this.renderEntities();
    this.bindControls();
    this.bindCameraPan();
    this.resize();
    this.onResize=()=>this.resize();
    window.addEventListener("resize",this.onResize);
    this.cleanups.push(()=>window.removeEventListener("resize",this.onResize));

    this.setMode(this.mode);
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
      if(this.editorEnabled)this.bindEntityEditing(entity);
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
    const wantsWebGL=Boolean(effect.active&&effect.renderer==="webgl"&&entity.src&&canvas);

    entity.el.dataset.effectRenderer=effect.renderer;
    entity.el.dataset.effectPreset=effect.preset;

    if(!wantsWebGL){
      if(canvas)canvas.hidden=true;
      if(img)img.hidden=false;
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
          entity.width=clamp(right-left,min,2400);
          entity.height=clamp(bottom-top,min,2400);
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
      this.host?.classList.remove("is-camera-dragging");
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
      if(this.mode!=="play")return;
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
      if(touchCapable||this.mode!=="play"||!joystick)return;
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
      if(!touchCapable||this.mode!=="play"||!joystick||!e.changedTouches?.length)return;
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
      if(this.mode!=="play")return;
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

  setMode(mode){
    if(!this.editorEnabled&&mode!=="play")return;
    this.mode=mode==="play"?"play":"edit";
    this.host?.classList.toggle("is-editor",this.mode==="edit");
    this.host?.classList.toggle("is-play",this.mode==="play");
    if(this.modeEl)this.modeEl.textContent=this.mode==="edit"?"MUNDO · EDITAR":"MUNDO · PLAY";
    if(this.mode==="play"){
      this.keys.clear();
      this.pointerDirections.clear();
      this.resetJoystick();
      this.clearNavigationTarget();
      this.playCameraOffset.x=0;
      this.playCameraOffset.y=0;
      this.playCameraDetached=false;
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

  playerMaxSpeed(){
    return clamp(Number(this.config.player?.maxSpeed??420)||420,60,1000);
  }

  resolvePlayerCollisions(candidate,input){
    const radius=this.playerCollisionRadius();
    const desired=this.collisionDesiredVector(input);
    const maxSpeed=this.playerMaxSpeed();
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
            minSpeed:this.navigationTarget?maxSpeed*.35:maxSpeed*.25,
            maxSpeed:this.navigationTarget?maxSpeed*.68:maxSpeed*.55,
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
    const maxSpeed=this.playerMaxSpeed();
    const inputMagnitude=clamp(Math.hypot(input.x,input.y),0,1);
    const targetVx=input.x*maxSpeed;
    const targetVy=input.y*maxSpeed;

    const accelResponse=1-Math.exp(-dt*6.8);
    const coastResponse=1-Math.exp(-dt*3.4);
    const response=inputMagnitude>.001?accelResponse:coastResponse;

    this.player.vx+=(targetVx-this.player.vx)*response;
    this.player.vy+=(targetVy-this.player.vy)*response;

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
  }

  updatePlayerWaterEffects(time){
    const effects=this.playerWaterEffects();
    const width=Math.max(24,Number(this.config.player?.width)||108);
    const height=Math.max(24,Number(this.config.player?.height)||150);
    const speed=Math.hypot(this.player.vx,this.player.vy);

    if(this.playerShadowEl){
      this.playerShadowEl.hidden=!effects.shadowActive;
      const rocking=this.playerOceanMotion||{offsetX:0,offsetY:0,scaleX:1,scaleY:1,energy:0};
      this.playerShadowEl.style.left=(this.player.x+rocking.offsetX*.18)+"px";
      this.playerShadowEl.style.top=(this.player.y+effects.shadowOffset+rocking.offsetY*.12)+"px";
      this.playerShadowEl.style.width=(width*effects.shadowScaleX)+"px";
      this.playerShadowEl.style.height=(height*effects.shadowScaleY)+"px";
      this.playerShadowEl.style.opacity=String(effects.shadowOpacity);
      this.playerShadowEl.style.filter=`blur(${effects.shadowBlur}px)`;
      this.playerShadowEl.style.transform=`translate(-50%,-50%) rotate(${this.player.rotation}deg)`;
    }

    if(
      this.mode!=="play"
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
    const speedFactor=clamp(speed/this.playerMaxSpeed(),.2,1);
    const sideOffset=effects.wakeWidth*.23;
    const drift=effects.wakeLength*(.52+.48*speedFactor);
    const duration=clamp(900+effects.wakeLength*4.8,1100,2900);

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
      puff.style.width=(center?effects.wakeWidth*.52:effects.wakeWidth)+"px";
      puff.style.height=(center?Math.max(16,effects.wakeWidth*.46):Math.max(18,effects.wakeWidth*.62))+"px";
      puff.style.setProperty("--wake-opacity",String(effects.wakeOpacity*(center?.55:1)));
      puff.style.setProperty("--wake-rotation",this.player.rotation+"deg");
      puff.style.setProperty("--wake-drift-x",(-forwardX*drift+rightX*side*effects.wakeWidth*.22)+"px");
      puff.style.setProperty("--wake-drift-y",(-forwardY*drift+rightY*side*effects.wakeWidth*.22)+"px");
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

  updatePlayerVisual(time=performance.now()){
    const effects=this.playerWaterEffects();
    const ocean=normalizeOceanConfig(this.config.ocean||{});
    const rocking=this.mode==="play"&&effects.oceanMotionActive&&ocean.active
      ?computeShipOceanMotion(ocean,this.player,time,1)
      :{offsetX:0,offsetY:0,roll:0,scaleX:1,scaleY:1,energy:0};
    this.playerOceanMotion=rocking;

    this.playerEl.style.left=(this.player.x+rocking.offsetX)+"px";
    this.playerEl.style.top=(this.player.y+rocking.offsetY)+"px";

    const sprite=this.config.player?.sprite;
    const directional=this.config.player?.directions;
    const rockTransform=`rotate(${rocking.roll.toFixed(3)}deg) scale(${rocking.scaleX.toFixed(5)},${rocking.scaleY.toFixed(5)})`;

    if(sprite?.src&&sprite?.regions){
      this.player.direction=directionForHeading(this.player.rotation,this.player.direction,{hysteresis:4});
      const style=directionalRegionStyle(sprite,this.player.direction);
      if(style)Object.assign(this.playerEl.style,style);
      this.playerEl.dataset.direction=this.player.direction;
      this.playerEl.dataset.renderMode="atlas";
      this.playerEl.style.transform=`translate(-50%,-50%) ${rockTransform}`;
    }else if(directional&&typeof directional==="object"){
      this.player.direction=directionForHeading(this.player.rotation,this.player.direction,{hysteresis:4});
      const nextSrc=resolveDirectionalSource(directional,this.player.direction,this.config.player?.src||"");
      const safe=String(nextSrc||"").replace(/["\\]/g,"");
      this.playerEl.style.backgroundImage=safe?'url("'+safe+'")':"none";
      this.playerEl.style.backgroundSize="contain";
      this.playerEl.style.backgroundPosition="center";
      this.playerEl.style.transform=`translate(-50%,-50%) ${rockTransform}`;
    }else{
      const safe=String(this.config.player?.src||"").replace(/["\\]/g,"");
      this.playerEl.style.backgroundImage=safe?'url("'+safe+'")':"none";
      this.playerEl.style.backgroundSize="contain";
      this.playerEl.style.backgroundPosition="center";
      this.playerEl.style.transform=`translate(-50%,-50%) rotate(${(this.player.rotation+rocking.roll).toFixed(3)}deg) scale(${rocking.scaleX.toFixed(5)},${rocking.scaleY.toFixed(5)})`;
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

  updateEntityMotionFrame(time){
    for(const entity of this.entities){
      if(this.collected.has(entity.id)||!entity.el)continue;

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
      const rotation=Number(entity.rotation||0)+Number(motionFrame.rotation||0)+Number(effectFrame.rotation||0);
      const scaleX=Number(effectFrame.scaleX||1);
      const scaleY=Number(motionFrame.scaleY||1)*Number(effectFrame.scaleY||1);

      entity.visualX=entity.x+offsetX;
      entity.visualY=entity.y+offsetY;
      entity.visualRotation=rotation;
      entity.el.style.left=entity.visualX+"px";
      entity.el.style.top=entity.visualY+"px";
      entity.el.style.opacity=String(effect.active?effectFrame.opacity:1);
      entity.el.style.transform=`translate(-50%,-50%) rotate(${rotation}deg) skewX(${Number(entity.skewX||0)}deg) skewY(${Number(entity.skewY||0)}deg) scale(${scaleX},${scaleY})`;

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
        if(img)img.hidden=false;
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

  updateNearby(){
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
      this.actionWrap.hidden=true;
      return;
    }

    const collision=normalizeCollision(entity.collision||{},entity);
    const action=inferCollisionAction(entity,collision);
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

    if(action==="collect"){
      this.collected.add(entity.id);
      if(entity.el)entity.el.hidden=true;
      this.contactEntity=null;
      this.nearby=null;
      this.actionWrap.hidden=true;
      this.updateProgress();
      return;
    }

    if(action==="enter-scene"&&entity.scene&&this.onEnterScene){
      this.actionWrap.hidden=true;
      this.onEnterScene(this.cleanEntity(entity),this.getState());
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
    if(patch.maxSpeed!==undefined){
      next.maxSpeed=clamp(Number(patch.maxSpeed)||420,60,1000);
      const currentSpeed=Math.hypot(this.player.vx,this.player.vy);
      if(currentSpeed>next.maxSpeed){
        const scale=next.maxSpeed/currentSpeed;
        this.player.vx*=scale;
        this.player.vy*=scale;
      }
    }
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
    const now=performance.now();
    this.updatePlayerVisual(now);
    this.updatePlayerWaterEffects(now);
    return this.getPlayerConfig();
  }

  updateWorld(patch={},commit=true){
    if(patch.name!==undefined)this.config.name=String(patch.name||this.config.id||"Mundo");
    if(patch.width!==undefined)this.config.width=clamp(Number(patch.width)||390,390,20000);
    if(patch.height!==undefined)this.config.height=clamp(Number(patch.height)||844,844,20000);
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

    for(const entity of this.entities){
      entity.x=clamp(Number(entity.x||0),0,this.config.width);
      entity.y=clamp(Number(entity.y||0),0,this.config.height);
      entity.anchorX=entity.x;
      entity.anchorY=entity.y;
      this.applyEntityVisual(entity);
    }
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

    if(
      String(this.config.ocean.renderer)!==previousRenderer
      ||String(this.config.ocean.background||"")!==previousBackground
    ){
      this.resetOceanRenderer();
      this.initOceanRenderer();
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
      const safeBackground=String(layer.background||ocean.background||"").replace(/["\\]/g,"");
      el.style.backgroundImage=safeBackground?'url("'+safeBackground+'")':"none";
      el.style.backgroundSize=(ocean.tileSize*layer.tileScale)+"px auto";
      el.style.backgroundRepeat="repeat";
      el.style.opacity=String(layer.opacity);
      el.style.transformOrigin="center center";
    }
  }

  updateOceanFrame(time){
    const ocean=normalizeOceanConfig(this.config.ocean||{});
    const webglRendered=ocean.renderer==="webgl"
      &&this.oceanRenderer?.render?.({
        time,
        camera:this.camera,
        zoom:this.mode==="play"?this.playZoom:this.zoom,
        ocean,
        width:this.viewportSize?.width||1,
        height:this.viewportSize?.height||1
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
    world.entities=this.entities.map(entity=>structuredClone(this.cleanEntity(entity)));
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
    entity.width=clamp(Number(entity.width??96),16,2400);
    entity.height=clamp(Number(entity.height??96),16,2400);
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

  updateProgress(){
    const total=this.entities.filter(e=>e.type==="barrel").length;
    const collected=this.entities.filter(e=>e.type==="barrel"&&this.collected.has(e.id)).length;
    if(this.progressEl)this.progressEl.textContent=`Barris: ${collected}/${total}`;
  }

  tick(time){
    const dt=Math.min(.04,Math.max(.001,(time-this.lastTime)/1000));
    this.lastTime=time;
    if(this.mode==="play")this.updatePlayer(dt);
    this.updatePlayerVisual(time);
    this.updatePlayerWaterEffects(time);
    this.updateEntityMotionFrame(time);
    this.updateCamera(false,dt);
    this.updateOceanFrame(time);
    this.updateNearby();

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
      collected:[...this.collected]
    };
  }

  destroy(){
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
