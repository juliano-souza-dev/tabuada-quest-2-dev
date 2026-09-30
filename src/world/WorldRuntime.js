import { normalizeOceanConfig, applyOceanPreset, computeOceanFrame, cameraFollowStep } from "./WorldOceanEffect.mjs?v=20260930-1812";
import { normalizeEntityMotion, applyEntityMotionPreset, computeEntityMotionFrame, defaultEntityMotion } from "./WorldEntityMotion.mjs?v=20260930-0904";
import { resolveEntityPresentation } from "./WorldEntityPresentation.mjs?v=20260930-0904";
import { normalizeJoystickVector, screenPointToWorld, targetNavigationVector } from "./WorldNavigationInput.mjs?v=20260930-0904";
import { directionForHeading, resolveDirectionalSource, directionalRegionStyle } from "./WorldDirectionalSprite.mjs?v=20260930-1452";
import { OceanWebGLRenderer } from "./OceanWebGLRenderer.mjs?v=20260930-1812";
const clamp=(value,min,max)=>Math.min(max,Math.max(min,value));
const distance=(a,b)=>Math.hypot((a.x||0)-(b.x||0),(a.y||0)-(b.y||0));

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
    this.entities=(config.entities||[]).map((entity,index)=>({
      ...structuredClone(entity),
      index,
      anchorX:Number(entity.x??0),
      anchorY:Number(entity.y??0),
      el:null
    }));
    this.selectedId=null;
    this.lastTime=0;
    this.raf=0;
    this.nearby=null;
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
        <button type="button" data-world-action></button>
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
      }

      entity.el=el;
      this.applyEntityVisual(entity);
      if(this.collected.has(entity.id))el.hidden=true;
      if(this.editorEnabled)this.bindEntityEditing(entity);
      this.entityLayer.append(el);
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
    el.style.transform=`translate(-50%,-50%) rotate(${Number(entity.rotation||0)}deg)`;
    const logicalOnly=el.dataset.renderMode==="logical";
    el.classList.toggle("is-logical-only",logicalOnly);
    el.style.visibility=logicalOnly&&this.mode==="play"?"hidden":"visible";
    const img=el.querySelector("img");
    if(img&&img.getAttribute("src")!==String(entity.src||""))img.src=entity.src||"";
  }

  ensureGizmo(){
    if(!this.editorEnabled||!this.entityLayer)return null;
    if(this.gizmoEl?.isConnected)return this.gizmoEl;

    const gizmo=document.createElement("div");
    gizmo.className="tq-world-gizmo";
    gizmo.hidden=true;
    gizmo.innerHTML='<span class="tq-world-gizmo__stem"></span><button type="button" class="tq-world-gizmo__rotate" aria-label="Girar entidade" title="Girar"></button><button type="button" class="tq-world-gizmo__resize" aria-label="Redimensionar entidade" title="Redimensionar"></button>';
    this.entityLayer.append(gizmo);
    this.gizmoEl=gizmo;

    const rotate=gizmo.querySelector(".tq-world-gizmo__rotate");
    rotate.addEventListener("pointerdown",event=>{
      if(this.mode!=="edit"||!this.selectedId)return;
      const entity=this.entities.find(item=>item.id===this.selectedId);
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
        this.onEntityChange?.(structuredClone(this.cleanEntity(entity)),false);
      };
      const end=e=>{
        try{if(rotate.hasPointerCapture(e.pointerId))rotate.releasePointerCapture(e.pointerId)}catch{}
        rotate.removeEventListener("pointermove",move);
        rotate.removeEventListener("pointerup",end);
        rotate.removeEventListener("pointercancel",end);
        this.onEntityChange?.(structuredClone(this.cleanEntity(entity)),true);
      };
      rotate.addEventListener("pointermove",move);
      rotate.addEventListener("pointerup",end);
      rotate.addEventListener("pointercancel",end);
    });

    const resize=gizmo.querySelector(".tq-world-gizmo__resize");
    resize.addEventListener("pointerdown",event=>{
      if(this.mode!=="edit"||!this.selectedId)return;
      const entity=this.entities.find(item=>item.id===this.selectedId);
      if(!entity)return;
      event.preventDefault();event.stopPropagation();
      const rect=entity.el?.getBoundingClientRect();
      if(!rect)return;
      const center={x:rect.left+rect.width/2,y:rect.top+rect.height/2};
      const startDistance=Math.max(1,Math.hypot(event.clientX-center.x,event.clientY-center.y));
      const startWidth=Math.max(16,Number(entity.width||96));
      const startHeight=Math.max(16,Number(entity.height||96));
      const startAngle=Number(entity.rotation||0)*Math.PI/180;
      const start={x:event.clientX,y:event.clientY};
      try{resize.setPointerCapture(event.pointerId)}catch{}

      const move=e=>{
        if(entity.lockAspect!==false){
          const scale=Math.max(.12,Math.hypot(e.clientX-center.x,e.clientY-center.y)/startDistance);
          entity.width=clamp(startWidth*scale,16,2400);
          entity.height=clamp(startHeight*scale,16,2400);
        }else{
          const zoom=Math.max(.1,this.zoom||1);
          const dx=(e.clientX-start.x)/zoom;
          const dy=(e.clientY-start.y)/zoom;
          const localX=dx*Math.cos(-startAngle)-dy*Math.sin(-startAngle);
          const localY=dx*Math.sin(-startAngle)+dy*Math.cos(-startAngle);
          entity.width=clamp(startWidth+localX*2,16,2400);
          entity.height=clamp(startHeight+localY*2,16,2400);
        }
        this.applyEntityVisual(entity);
        this.syncGizmo();
        this.onEntityChange?.(structuredClone(this.cleanEntity(entity)),false);
      };
      const end=e=>{
        try{if(resize.hasPointerCapture(e.pointerId))resize.releasePointerCapture(e.pointerId)}catch{}
        resize.removeEventListener("pointermove",move);
        resize.removeEventListener("pointerup",end);
        resize.removeEventListener("pointercancel",end);
        this.onEntityChange?.(structuredClone(this.cleanEntity(entity)),true);
      };
      resize.addEventListener("pointermove",move);
      resize.addEventListener("pointerup",end);
      resize.addEventListener("pointercancel",end);
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

  updatePlayer(dt){
    const input=this.inputVector();
    // Navigation tuning: keep inertia without crushing the terminal speed.
    // The previous 0.0008 drag limited full-throttle speed to ~73 world px/s.
    const accel=1100;
    const maxSpeed=420;
    const drag=Math.pow(0.12,dt);

    this.player.vx=(this.player.vx+input.x*accel*dt)*drag;
    this.player.vy=(this.player.vy+input.y*accel*dt)*drag;

    const speed=Math.hypot(this.player.vx,this.player.vy);
    if(speed>maxSpeed){
      const scale=maxSpeed/speed;
      this.player.vx*=scale;
      this.player.vy*=scale;
    }

    const travel=this.getPlayerTravelBounds();
    this.player.x=clamp(this.player.x+this.player.vx*dt,travel.left,travel.right);
    this.player.y=clamp(this.player.y+this.player.vy*dt,travel.top,travel.bottom);

    if(speed>8){
      this.player.rotation=Math.atan2(this.player.vy,this.player.vx)*180/Math.PI+90;
    }
  }

  updatePlayerVisual(){
    this.playerEl.style.left=this.player.x+"px";
    this.playerEl.style.top=this.player.y+"px";

    const sprite=this.config.player?.sprite;
    const directional=this.config.player?.directions;
    if(sprite?.src&&sprite?.regions){
      this.player.direction=directionForHeading(this.player.rotation,this.player.direction,{hysteresis:4});
      const style=directionalRegionStyle(sprite,this.player.direction);
      if(style)Object.assign(this.playerEl.style,style);
      this.playerEl.dataset.direction=this.player.direction;
      this.playerEl.dataset.renderMode="atlas";
      this.playerEl.style.transform="translate(-50%,-50%)";
    }else if(directional&&typeof directional==="object"){
      this.player.direction=directionForHeading(this.player.rotation,this.player.direction,{hysteresis:4});
      const nextSrc=resolveDirectionalSource(directional,this.player.direction,this.config.player?.src||"");
      const safe=String(nextSrc||"").replace(/["\\]/g,"");
      this.playerEl.style.backgroundImage=safe?'url("'+safe+'")':"none";
      this.playerEl.style.backgroundSize="contain";
      this.playerEl.style.backgroundPosition="center";
      this.playerEl.style.transform="translate(-50%,-50%)";
    }else{
      const safe=String(this.config.player?.src||"").replace(/["\\]/g,"");
      this.playerEl.style.backgroundImage=safe?'url("'+safe+'")':"none";
      this.playerEl.style.backgroundSize="contain";
      this.playerEl.style.backgroundPosition="center";
      this.playerEl.style.transform=`translate(-50%,-50%) rotate(${this.player.rotation}deg)`;
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

  updateEntityMotionFrame(time){
    for(const entity of this.entities){
      if(this.collected.has(entity.id)||!entity.el)continue;
      const motion=this.getEntityMotion(entity.id);
      if(!motion?.active){
        this.applyEntityVisual(entity);
        continue;
      }
      const frame=computeEntityMotionFrame(motion,time,(entity.index+1)*1.71,entity.type);
      entity.el.style.left=(entity.x+frame.offsetX)+"px";
      entity.el.style.top=(entity.y+frame.offsetY)+"px";
      entity.el.style.transform=`translate(-50%,-50%) rotate(${Number(entity.rotation||0)+frame.rotation}deg) scale(1,${frame.scaleY})`;
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
      this.actionWrap.hidden=true;
      return;
    }

    let best=null;
    let bestDistance=Infinity;
    for(const entity of this.entities){
      if(this.collected.has(entity.id))continue;
      const threshold=entity.interactionRadius??(entity.type==="location"?230:105);
      const d=distance(this.player,entity);
      if(d<=threshold&&d<bestDistance){
        best=entity;
        bestDistance=d;
      }
    }

    this.nearby=best;
    if(!best){
      this.actionWrap.hidden=true;
      return;
    }

    this.actionWrap.hidden=false;
    this.actionButton.textContent=best.type==="location"
      ? "Entrar: "+(best.label||best.id)
      : "Coletar "+(best.label||best.type||"objeto");
  }

  activateNearby(){
    const entity=this.nearby;
    if(!entity||this.mode!=="play")return;

    if(["barrel","treasure","object"].includes(entity.type)){
      this.collected.add(entity.id);
      if(entity.el)entity.el.hidden=true;
      this.updateProgress();
      this.updateNearby();
      return;
    }

    if(entity.type==="location"&&entity.scene&&this.onEnterScene){
      this.onEnterScene(this.cleanEntity(entity),this.getState());
    }
  }

  cleanEntity(entity){
    const {el,index,anchorX,anchorY,...data}=entity;
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
    Object.assign(entity,structuredClone(patch));
    entity.x=clamp(Number(entity.x??0),0,this.config.width);
    entity.y=clamp(Number(entity.y??0),0,this.config.height);
    entity.width=clamp(Number(entity.width??96),16,2400);
    entity.height=clamp(Number(entity.height??96),16,2400);
    entity.rotation=Number(entity.rotation||0);
    entity.anchorX=entity.x;
    entity.anchorY=entity.y;
    if(previousType!==entity.type)this.renderEntities();
    else{
      this.applyEntityVisual(entity);
      this.syncGizmo();
    }
    this.selectedId=id;
    this.applySelectionVisual();
    const clean=this.getEntity(id);
    this.onSelectionChange?.(clean);
    this.onEntityChange?.(clean,commit);
    return clean;
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
      index:this.entities.length,
      anchorX:0,
      anchorY:0,
      el:null
    };
    entity.anchorX=entity.x;
    entity.anchorY=entity.y;
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
    this.updatePlayerVisual();
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
    for(const cleanup of this.cleanups.splice(0))cleanup();
    this.root.classList.remove("tq-world-test-active");
    this.root.innerHTML="";
  }
}
