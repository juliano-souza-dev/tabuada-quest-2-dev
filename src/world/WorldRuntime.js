import { normalizeOceanConfig, applyOceanPreset, computeOceanFrame } from "./WorldOceanEffect.mjs?v=20260930-0450";
import { WorldOceanWebGL } from "./WorldOceanWebGL.mjs?v=20260930-0450";
import { normalizeEntityMotion, applyEntityMotionPreset, computeEntityMotionFrame, defaultEntityMotion } from "./WorldEntityMotion.mjs?v=20260930-0450";
import { resolveEntityPresentation, normalizeDepthPresentation, applyDepthPreset, computeParallaxPoint } from "./WorldEntityPresentation.mjs?v=20260930-0450";
import { NAVIGATION_DEFAULTS, applyCounterSteer, computeCameraFollowTarget, expSmoothingFactor, smoothAngle, velocityHeading } from "./WorldNavigation.mjs?v=20260930-0450";
const clamp=(value,min,max)=>Math.min(max,Math.max(min,value));
const distance=(a,b)=>Math.hypot((a.x||0)-(b.x||0),(a.y||0)-(b.y||0));
const transformMatrix=(rotation=0,skewX=0,skewY=0,scaleX=1,scaleY=1)=>{
  const r=Number(rotation||0)*Math.PI/180;
  const tx=Math.tan(Number(skewX||0)*Math.PI/180);
  const ty=Math.tan(Number(skewY||0)*Math.PI/180);
  const sx=Math.max(.01,Math.abs(Number(scaleX||1)));
  const sy=Math.max(.01,Math.abs(Number(scaleY||1)));
  const cos=Math.cos(r),sin=Math.sin(r);
  return {
    a:sx*(cos-sin*ty),
    b:sx*(sin+cos*ty),
    c:sy*(cos*tx-sin),
    d:sy*(sin*tx+cos)
  };
};
const transformVector=(matrix,x,y)=>({x:matrix.a*x+matrix.c*y,y:matrix.b*x+matrix.d*y});
const inverseVector=(matrix,x,y)=>{
  const det=matrix.a*matrix.d-matrix.b*matrix.c;
  if(Math.abs(det)<1e-8)return {x:0,y:0};
  return {x:(matrix.d*x-matrix.c*y)/det,y:(matrix.a*y-matrix.b*x)/det};
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
      vx:0,vy:0
    };
    this.camera={
      x:Number(config.editor?.cameraX??this.player.x),
      y:Number(config.editor?.cameraY??this.player.y)
    };
    this.zoom=Number(config.editor?.zoom??0.58);
    this.playZoom=1;
    this.collected=new Set(this.state.collected||[]);
    this.keys=new Set();
    this.pointerDirections=new Set();
    this.navigationTarget=null;
    this.entities=(config.entities||[]).map((entity,index)=>({
      ...structuredClone(entity),
      scaleX:Number.isFinite(Number(entity.scaleX))?Number(entity.scaleX):1,
      scaleY:Number.isFinite(Number(entity.scaleY))?Number(entity.scaleY):1,
      skewX:Number(entity.skewX||0),
      skewY:Number(entity.skewY||0),
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
        <div class="tq-world-stage">
          <div class="tq-world-ocean"></div>
          <canvas class="tq-world-ocean-webgl" hidden aria-hidden="true"></canvas>
          <div class="tq-world-entities"></div>
          <div class="tq-world-nav-target" hidden aria-hidden="true"></div>
          <img class="tq-world-player" alt="Navio do jogador" draggable="false">
        </div>
      </div>
      <section class="tq-world-hud">
        <strong data-world-mode></strong>
        <span data-world-name></span>
        <span data-world-coords></span>
        <span data-world-progress></span>
        <span data-world-zoom></span>
      </section>
      <div class="tq-world-action" hidden>
        <button type="button" data-world-action></button>
      </div>
      <div class="tq-world-controls" aria-label="Controles de navegação">
        <div class="tq-world-dpad">
          <button type="button" data-dir="up" aria-label="Navegar para cima">▲</button>
          <button type="button" data-dir="left" aria-label="Navegar para esquerda">◀</button>
          <button type="button" data-dir="right" aria-label="Navegar para direita">▶</button>
          <button type="button" data-dir="down" aria-label="Navegar para baixo">▼</button>
        </div>
        <div class="tq-world-help">WASD / setas · toque/clique para navegar<br>controles touch também disponíveis</div>
      </div>`;

    this.root.append(this.host);
    this.viewport=this.host.querySelector(".tq-world-viewport");
    this.stage=this.host.querySelector(".tq-world-stage");
    this.entityLayer=this.host.querySelector(".tq-world-entities");
    this.playerEl=this.host.querySelector(".tq-world-player");
    this.navTargetEl=this.host.querySelector(".tq-world-nav-target");
    this.coordsEl=this.host.querySelector("[data-world-coords]");
    this.progressEl=this.host.querySelector("[data-world-progress]");
    this.zoomEl=this.host.querySelector("[data-world-zoom]");
    this.modeEl=this.host.querySelector("[data-world-mode]");
    this.nameEl=this.host.querySelector("[data-world-name]");
    this.actionWrap=this.host.querySelector(".tq-world-action");
    this.actionButton=this.host.querySelector("[data-world-action]");
    this.oceanEl=this.host.querySelector(".tq-world-ocean");
    this.oceanCanvas=this.host.querySelector(".tq-world-ocean-webgl");

    this.stage.style.width=this.config.width+"px";
    this.stage.style.height=this.config.height+"px";
    this.applyOceanStatic();
    this.oceanWebGL=new WorldOceanWebGL(this,this.oceanCanvas,this.oceanEl);
    this.oceanWebGL.setBackground(this.config.ocean?.background);
    const playerConfig=this.getPlayerConfig();
    this.playerEl.src=playerConfig.src;
    this.playerEl.style.width=playerConfig.width+"px";
    this.playerEl.style.height=playerConfig.height+"px";
    this.nameEl.textContent=this.config.name||this.config.id||"Mundo";

    this.renderEntities();
    this.bindControls();
    if(this.editorEnabled)this.bindEditorCamera();
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
    this.depthLayers=new Map();

    for(const depth of ["far","gameplay","foreground"]){
      const layer=document.createElement("div");
      layer.className="tq-world-depth-layer tq-world-depth-layer--"+depth;
      layer.dataset.depthLayer=depth;
      this.entityLayer.append(layer);
      this.depthLayers.set(depth,layer);
    }

    for(const entity of this.entities){
      const presentation=resolveEntityPresentation(entity);
      const el=document.createElement("div");
      el.className="tq-world-entity tq-world-entity--"+(entity.type||"object");
      el.dataset.entityId=entity.id;
      el.dataset.renderMode=presentation.renderMode;
      el.dataset.logicalType=entity.type||"object";
      el.dataset.depth=presentation.depth;
      el.style.zIndex=String(entity.z??10);

      if(presentation.hasSprite){
        const img=document.createElement("img");
        img.src=entity.src||"";
        img.alt=entity.label||entity.type||"Objeto";
        img.draggable=false;
        el.append(img);
      }

      entity.el=el;
      this.depthLayerFor(entity)?.append(el);
      this.applyEntityVisual(entity);
      if(this.collected.has(entity.id))el.hidden=true;
      if(this.editorEnabled)this.bindEntityEditing(entity);
    }

    this.ensureGizmo();
    this.applySelectionVisual();
    this.syncGizmo();
    this.updateProgress();
  }

  depthLayerFor(entity){
    const depth=resolveEntityPresentation(entity).depth;
    return this.depthLayers?.get(depth)||this.depthLayers?.get("gameplay")||this.entityLayer;
  }

  entityVisualPoint(entity,offsetX=0,offsetY=0){
    const presentation=resolveEntityPresentation(entity);
    return computeParallaxPoint({
      x:Number(entity.x||0)+Number(offsetX||0),
      y:Number(entity.y||0)+Number(offsetY||0)
    },this.camera,presentation);
  }

  applyEntityVisual(entity,frame=entity.motionFrame||null){
    const el=entity.el;
    if(!el)return;
    const presentation=resolveEntityPresentation(entity);
    const point=this.entityVisualPoint(entity,frame?.offsetX||0,frame?.offsetY||0);
    const visualScale=presentation.scale;
    const layer=this.depthLayerFor(entity);
    if(layer&&el.parentElement!==layer)layer.append(el);

    el.dataset.depth=presentation.depth;
    el.style.left=point.x+"px";
    el.style.top=point.y+"px";
    el.style.width=(Number(entity.width||96)*visualScale)+"px";
    el.style.height=(Number(entity.height||96)*visualScale)+"px";
    el.style.opacity=String(presentation.opacity);
    const scaleX=Math.max(.01,Math.abs(Number(entity.scaleX??1)));
    const scaleY=Math.max(.01,Math.abs(Number(entity.scaleY??1)))*Number(frame?.scaleY||1);
    el.style.transform=`translate(-50%,-50%) rotate(${Number(entity.rotation||0)+Number(frame?.rotation||0)}deg) skew(${Number(entity.skewX||0)}deg,${Number(entity.skewY||0)}deg) scale(${scaleX},${scaleY})`;

    const logicalOnly=el.dataset.renderMode==="logical";
    el.classList.toggle("is-logical-only",logicalOnly);
    el.style.visibility=logicalOnly&&this.mode==="play"?"hidden":"visible";

    const safeSrc=String(entity.src||"").replace(/["\\]/g,"");
    el.style.setProperty("--entity-mask",safeSrc?'url("'+safeSrc+'")':"none");
    el.style.setProperty("--entity-tint",presentation.tint);
    el.style.setProperty("--entity-tint-strength",String(presentation.tintStrength));

    const img=el.querySelector("img");
    if(img){
      if(img.getAttribute("src")!==String(entity.src||""))img.src=entity.src||"";
      const shadowY=(2+presentation.shadow*8).toFixed(2);
      const shadowBlur=(3+presentation.shadow*8).toFixed(2);
      const shadowAlpha=(0.08+presentation.shadow*.5).toFixed(3);
      img.style.filter=`blur(${presentation.blur}px) drop-shadow(0 ${shadowY}px ${shadowBlur}px rgba(0,18,34,${shadowAlpha}))`;
    }
  }

  ensureGizmo(){
    if(!this.editorEnabled||!this.entityLayer)return null;
    if(this.gizmoEl?.isConnected)return this.gizmoEl;

    const gizmo=document.createElement("div");
    gizmo.className="tq-world-gizmo";
    gizmo.hidden=true;
    const resizeHandles=["nw","n","ne","e","se","s","sw","w"].map(dir=>'<button type="button" class="tq-world-gizmo__resize tq-world-gizmo__resize--'+dir+'" data-gizmo-resize="'+dir+'" aria-label="Redimensionar '+dir+'" title="Redimensionar"></button>').join("");
    gizmo.innerHTML='<span class="tq-world-gizmo__stem"></span><button type="button" class="tq-world-gizmo__rotate" aria-label="Girar entidade" title="Girar"></button>'+resizeHandles+'<button type="button" class="tq-world-gizmo__skew tq-world-gizmo__skew--x" data-gizmo-skew="x" aria-label="Inclinar horizontalmente" title="Skew X"></button><button type="button" class="tq-world-gizmo__skew tq-world-gizmo__skew--y" data-gizmo-skew="y" aria-label="Inclinar verticalmente" title="Skew Y"></button>';
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

    for(const resize of gizmo.querySelectorAll("[data-gizmo-resize]")){
      const dir=resize.dataset.gizmoResize||"se";
      resize.addEventListener("pointerdown",event=>{
        if(this.mode!=="edit"||!this.selectedId)return;
        const entity=this.entities.find(item=>item.id===this.selectedId);
        if(!entity)return;
        event.preventDefault();event.stopPropagation();

        const zoom=Math.max(.1,this.zoom||1);
        const presentation=resolveEntityPresentation(entity);
        const visualScale=Math.max(.05,presentation.scale||1);
        const parallax=Math.max(.05,presentation.parallax||1);
        const startWidth=Math.max(16,Number(entity.width||96));
        const startHeight=Math.max(16,Number(entity.height||96));
        const startX=Number(entity.x||0),startY=Number(entity.y||0);
        const matrix=transformMatrix(entity.rotation,entity.skewX,entity.skewY,entity.scaleX,entity.scaleY);
        const start={px:event.clientX,py:event.clientY};
        try{resize.setPointerCapture(event.pointerId)}catch{}

        const move=e=>{
          const stageDx=(e.clientX-start.px)/zoom;
          const stageDy=(e.clientY-start.py)/zoom;
          const local=inverseVector(matrix,stageDx,stageDy);
          const dx=local.x/visualScale,dy=local.y/visualScale;
          let left=-startWidth/2,right=startWidth/2,top=-startHeight/2,bottom=startHeight/2;

          if(dir.includes("w"))left+=dx;
          if(dir.includes("e"))right+=dx;
          if(dir.includes("n"))top+=dy;
          if(dir.includes("s"))bottom+=dy;

          const min=16;
          if(right-left<min){if(dir.includes("w"))left=right-min;else right=left+min}
          if(bottom-top<min){if(dir.includes("n"))top=bottom-min;else bottom=top+min}

          if(entity.lockAspect!==false&&dir.length===2){
            const ratio=startWidth/startHeight;
            let width=right-left,height=bottom-top;
            if(Math.abs(width-startWidth)/startWidth>=Math.abs(height-startHeight)/startHeight)height=width/ratio;
            else width=height*ratio;
            if(dir.includes("w"))left=right-width;else right=left+width;
            if(dir.includes("n"))top=bottom-height;else bottom=top+height;
          }

          const nextWidth=clamp(right-left,16,2400);
          const nextHeight=clamp(bottom-top,16,2400);
          const centerLocal={x:(left+right)/2,y:(top+bottom)/2};
          const centerStage=transformVector(matrix,centerLocal.x*visualScale,centerLocal.y*visualScale);

          entity.width=nextWidth;
          entity.height=nextHeight;
          entity.x=clamp(startX+centerStage.x/parallax,0,this.config.width);
          entity.y=clamp(startY+centerStage.y/parallax,0,this.config.height);
          entity.anchorX=entity.x;entity.anchorY=entity.y;
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
    }

    for(const skew of gizmo.querySelectorAll("[data-gizmo-skew]")){
      const axis=skew.dataset.gizmoSkew;
      skew.addEventListener("pointerdown",event=>{
        if(this.mode!=="edit"||!this.selectedId)return;
        const entity=this.entities.find(item=>item.id===this.selectedId);
        if(!entity)return;
        event.preventDefault();event.stopPropagation();
        const zoom=Math.max(.1,this.zoom||1);
        const presentation=resolveEntityPresentation(entity);
        const visualScale=Math.max(.05,presentation.scale||1);
        const rotation=Number(entity.rotation||0)*Math.PI/180;
        const cos=Math.cos(rotation),sin=Math.sin(rotation);
        const start={px:event.clientX,py:event.clientY,value:Number(axis==="x"?entity.skewX:entity.skewY)||0};
        try{skew.setPointerCapture(event.pointerId)}catch{}

        const move=e=>{
          const dx=(e.clientX-start.px)/zoom;
          const dy=(e.clientY-start.py)/zoom;
          const localX=dx*cos+dy*sin;
          const localY=-dx*sin+dy*cos;
          const size=Math.max(1,(axis==="x"?Number(entity.height||96):Number(entity.width||96))*visualScale);
          const delta=axis==="x"?localX:localY;
          const value=clamp(start.value+Math.atan(delta/size)*180/Math.PI,-75,75);
          if(axis==="x")entity.skewX=value;else entity.skewY=value;
          this.applyEntityVisual(entity);
          this.syncGizmo();
          this.onEntityChange?.(structuredClone(this.cleanEntity(entity)),false);
        };
        const end=e=>{
          try{if(skew.hasPointerCapture(e.pointerId))skew.releasePointerCapture(e.pointerId)}catch{}
          skew.removeEventListener("pointermove",move);
          skew.removeEventListener("pointerup",end);
          skew.removeEventListener("pointercancel",end);
          this.onEntityChange?.(structuredClone(this.cleanEntity(entity)),true);
        };
        skew.addEventListener("pointermove",move);
        skew.addEventListener("pointerup",end);
        skew.addEventListener("pointercancel",end);
      });
    }

    return gizmo;
  }

  syncGizmo(){
    const gizmo=this.ensureGizmo();
    if(!gizmo)return;
    const entity=this.entities.find(item=>item.id===this.selectedId);
    const visible=this.mode==="edit"&&entity&&!this.collected.has(entity.id);
    gizmo.hidden=!visible;
    if(!visible)return;

    const presentation=resolveEntityPresentation(entity);
    const point=this.entityVisualPoint(entity);
    gizmo.style.left=point.x+"px";
    gizmo.style.top=point.y+"px";
    const scaleX=Math.max(.01,Math.abs(Number(entity.scaleX??1)));
    const scaleY=Math.max(.01,Math.abs(Number(entity.scaleY??1)));
    gizmo.style.width=Math.max(16,Number(entity.width||96)*presentation.scale*scaleX)+"px";
    gizmo.style.height=Math.max(16,Number(entity.height||96)*presentation.scale*scaleY)+"px";
    gizmo.style.transform="translate(-50%,-50%) rotate("+Number(entity.rotation||0)+"deg) skew("+Number(entity.skewX||0)+"deg,"+Number(entity.skewY||0)+"deg)";
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
        const parallax=Math.max(.05,resolveEntityPresentation(entity).parallax||1);
        entity.x=clamp(start.x+(e.clientX-start.px)/(zoom*parallax),0,this.config.width);
        entity.y=clamp(start.y+(e.clientY-start.py)/(zoom*parallax),0,this.config.height);
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

  bindEditorCamera(){
    let pan=null;

    const beginPan=event=>{
      pan={
        pointerId:event.pointerId,
        px:event.clientX,
        py:event.clientY,
        x:this.camera.x,
        y:this.camera.y
      };
    };

    const down=event=>{
      if(this.mode!=="edit")return;
      if(event.target.closest?.(".tq-world-entity"))return;

      // Pinch/multi-touch zoom is intentionally disabled. A second touch is ignored.
      if(pan&&pan.pointerId!==event.pointerId)return;

      event.preventDefault();
      beginPan(event);
      this.selectEntity(null);
      try{this.viewport.setPointerCapture(event.pointerId)}catch{}
    };

    const move=event=>{
      if(this.mode!=="edit"||!pan||pan.pointerId!==event.pointerId)return;
      event.preventDefault();
      const zoom=Math.max(.1,this.zoom||1);
      this.camera.x=pan.x-(event.clientX-pan.px)/zoom;
      this.camera.y=pan.y-(event.clientY-pan.py)/zoom;
      this.clampEditorCamera();
      this.updateCamera(true);
    };

    const end=event=>{
      if(!pan||pan.pointerId!==event.pointerId)return;
      pan=null;
      try{if(this.viewport.hasPointerCapture(event.pointerId))this.viewport.releasePointerCapture(event.pointerId)}catch{}
    };

    const wheel=event=>{
      if(this.mode!=="edit")return;
      event.preventDefault();
      const factor=event.deltaY>0?.9:1.1;
      this.setEditorZoomAt(this.zoom*factor,event.clientX,event.clientY);
    };

    this.viewport.addEventListener("pointerdown",down);
    this.viewport.addEventListener("pointermove",move);
    this.viewport.addEventListener("pointerup",end);
    this.viewport.addEventListener("pointercancel",end);
    this.viewport.addEventListener("wheel",wheel,{passive:false});

    this.cleanups.push(()=>{
      pan=null;
      this.viewport.removeEventListener("pointerdown",down);
      this.viewport.removeEventListener("pointermove",move);
      this.viewport.removeEventListener("pointerup",end);
      this.viewport.removeEventListener("pointercancel",end);
      this.viewport.removeEventListener("wheel",wheel);
    });
  }

  bindControls(){
    const keyMap={
      ArrowUp:"up",KeyW:"up",
      ArrowDown:"down",KeyS:"down",
      ArrowLeft:"left",KeyA:"left",
      ArrowRight:"right",KeyD:"right"
    };

    const clearNavigationTarget=()=>{
      this.navigationTarget=null;
      if(this.navTargetEl)this.navTargetEl.hidden=true;
    };

    const keydown=e=>{
      if(this.mode!=="play")return;
      const dir=keyMap[e.code];
      if(!dir)return;
      e.preventDefault();
      clearNavigationTarget();
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

    for(const button of this.host.querySelectorAll("[data-dir]")){
      const dir=button.dataset.dir;
      const start=e=>{
        if(this.mode!=="play")return;
        e.preventDefault();
        clearNavigationTarget();
        this.pointerDirections.add(dir);
        try{button.setPointerCapture(e.pointerId)}catch{}
      };
      const end=e=>{
        this.pointerDirections.delete(dir);
        try{if(button.hasPointerCapture(e.pointerId))button.releasePointerCapture(e.pointerId)}catch{}
      };
      button.addEventListener("pointerdown",start);
      button.addEventListener("pointerup",end);
      button.addEventListener("pointercancel",end);
      button.addEventListener("pointerleave",end);
      this.cleanups.push(()=>{
        button.removeEventListener("pointerdown",start);
        button.removeEventListener("pointerup",end);
        button.removeEventListener("pointercancel",end);
        button.removeEventListener("pointerleave",end);
      });
    }

    const navigateToPointer=event=>{
      if(this.mode!=="play")return;
      if(event.button!==undefined&&event.button!==0)return;
      const rect=this.viewport.getBoundingClientRect();
      const zoom=Math.max(.1,this.zoom||1);
      const x=clamp(this.camera.x+(event.clientX-rect.left-rect.width/2)/zoom,55,this.config.width-55);
      const y=clamp(this.camera.y+(event.clientY-rect.top-rect.height/2)/zoom,70,this.config.height-70);
      this.navigationTarget={x,y};
      if(this.navTargetEl){
        this.navTargetEl.hidden=false;
        this.navTargetEl.style.left=x+"px";
        this.navTargetEl.style.top=y+"px";
      }
    };

    const blockContextMenu=e=>{
      if(this.host.contains(e.target))e.preventDefault();
    };
    const blockDrag=e=>{
      if(e.target?.closest?.(".tq-world-host"))e.preventDefault();
    };

    this.viewport.addEventListener("click",navigateToPointer);
    this.host.addEventListener("contextmenu",blockContextMenu);
    this.host.addEventListener("dragstart",blockDrag);

    const action=()=>this.activateNearby();
    this.actionButton.addEventListener("click",action);
    this.cleanups.push(()=>{
      this.viewport.removeEventListener("click",navigateToPointer);
      this.host.removeEventListener("contextmenu",blockContextMenu);
      this.host.removeEventListener("dragstart",blockDrag);
      this.actionButton.removeEventListener("click",action);
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
      this.zoom=this.playZoom;
      this.selectEntity(null);
    }else{
      this.navigationTarget=null;
      if(this.navTargetEl)this.navTargetEl.hidden=true;
      this.nearby=null;
      if(this.actionWrap)this.actionWrap.hidden=true;
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

    if(!x&&!y&&this.mode==="play"&&this.navigationTarget){
      const dx=this.navigationTarget.x-this.player.x;
      const dy=this.navigationTarget.y-this.player.y;
      const remaining=Math.hypot(dx,dy);
      if(remaining<=18){
        this.navigationTarget=null;
        if(this.navTargetEl)this.navTargetEl.hidden=true;
      }else{
        x=dx/remaining;
        y=dy/remaining;
      }
    }

    if(x||y){
      const length=Math.hypot(x,y)||1;
      x/=length;y/=length;
    }
    return {x,y};
  }

  resize(){
    const rect=this.viewport.getBoundingClientRect();
    this.viewportSize={width:rect.width,height:rect.height};
    if(this.mode==="edit")this.zoom=this.clampEditorZoom(this.zoom);
    this.clampEditorCamera();
    this.updateCamera(true);
  }

  editorMinZoom(){
    if(!this.viewportSize)return .25;
    const cover=Math.max(
      this.viewportSize.width/Math.max(1,this.config.width),
      this.viewportSize.height/Math.max(1,this.config.height)
    );
    return clamp(cover,.25,1.5);
  }

  clampEditorZoom(value){
    return clamp(Number(value)||.58,this.editorMinZoom(),1.5);
  }

  editorScreenToWorld(clientX,clientY,zoom=this.zoom){
    const rect=this.viewport.getBoundingClientRect();
    const safeZoom=Math.max(.1,Number(zoom)||1);
    return {
      x:this.camera.x+(clientX-rect.left-rect.width/2)/safeZoom,
      y:this.camera.y+(clientY-rect.top-rect.height/2)/safeZoom
    };
  }

  setEditorZoomAt(value,clientX,clientY,anchorWorld=null){
    if(this.mode!=="edit"||!this.viewportSize)return;
    const rect=this.viewport.getBoundingClientRect();
    const anchor=anchorWorld||this.editorScreenToWorld(clientX,clientY,this.zoom);
    const next=this.clampEditorZoom(value);
    const offsetX=clientX-rect.left-rect.width/2;
    const offsetY=clientY-rect.top-rect.height/2;

    this.zoom=next;
    this.camera.x=anchor.x-offsetX/next;
    this.camera.y=anchor.y-offsetY/next;
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
    const accel=520;
    const maxSpeed=NAVIGATION_DEFAULTS.maxSpeed;
    const drag=Math.pow(0.0008,dt);

    this.player.vx=applyCounterSteer(this.player.vx,input.x);
    this.player.vy=applyCounterSteer(this.player.vy,input.y);

    this.player.vx=(this.player.vx+input.x*accel*dt)*drag;
    this.player.vy=(this.player.vy+input.y*accel*dt)*drag;

    const rawSpeed=Math.hypot(this.player.vx,this.player.vy);
    if(rawSpeed>maxSpeed){
      const scale=maxSpeed/rawSpeed;
      this.player.vx*=scale;
      this.player.vy*=scale;
    }

    this.player.x=clamp(this.player.x+this.player.vx*dt,55,this.config.width-55);
    this.player.y=clamp(this.player.y+this.player.vy*dt,70,this.config.height-70);

    const targetRotation=velocityHeading(
      this.player.vx,
      this.player.vy,
      this.player.rotation,
      NAVIGATION_DEFAULTS.minHeadingSpeed
    );
    this.player.rotation=smoothAngle(
      this.player.rotation,
      targetRotation,
      dt,
      NAVIGATION_DEFAULTS.rotationSharpness
    );
  }

  updatePlayerVisual(){
    this.playerEl.style.left=this.player.x+"px";
    this.playerEl.style.top=this.player.y+"px";
    this.playerEl.style.transform=`translate(-50%,-50%) rotate(${this.player.rotation}deg)`;
  }

  getEntityPresentation(id){
    const entity=this.entities.find(item=>item.id===id);
    return entity?structuredClone(resolveEntityPresentation(entity)):null;
  }

  updateEntityPresentation(id,patch={},commit=true){
    const entity=this.entities.find(item=>item.id===id);
    if(!entity)return null;
    const current=resolveEntityPresentation(entity);
    const visual={depth:current.depth,parallax:current.parallax,scale:current.scale,opacity:current.opacity,blur:current.blur,tint:current.tint,tintStrength:current.tintStrength,shadow:current.shadow};
    entity.presentation=patch.depth&&patch.depth!==current.depth
      ? applyDepthPreset(visual,patch.depth)
      : normalizeDepthPresentation({...visual,...structuredClone(patch)});
    this.applyEntityVisual(entity,entity.motionFrame||null);
    this.syncGizmo();
    const clean=this.getEntity(id);
    this.onSelectionChange?.(clean);
    this.onEntityChange?.(clean,commit);
    return structuredClone(entity.presentation);
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
      entity.motionFrame=motion?.active
        ? computeEntityMotionFrame(motion,time,(entity.index+1)*1.71,entity.type)
        : null;
      this.applyEntityVisual(entity,entity.motionFrame);
    }
  }

  updateCamera(immediate=false,dt=1/60){
    if(!this.viewportSize)return;
    const vw=this.viewportSize.width;
    const vh=this.viewportSize.height;

    if(this.mode==="play"){
      const zoom=this.playZoom;
      const target=computeCameraFollowTarget(this.player,this.camera,{
        viewportWidth:vw,
        viewportHeight:vh,
        zoom,
        worldWidth:this.config.width,
        worldHeight:this.config.height,
        deadZone:NAVIGATION_DEFAULTS.cameraDeadZone
      });
      const factor=immediate?1:expSmoothingFactor(dt,NAVIGATION_DEFAULTS.cameraSharpness);
      this.camera.x+=(target.x-this.camera.x)*factor;
      this.camera.y+=(target.y-this.camera.y)*factor;
      this.zoom=zoom;
    }else{
      this.clampEditorCamera();
    }

    const zoom=Math.max(.1,this.zoom||1);
    const tx=Math.round(vw/2-this.camera.x*zoom);
    const ty=Math.round(vh/2-this.camera.y*zoom);
    this.stage.style.transform=`translate3d(${tx}px,${ty}px,0) scale(${zoom})`;
    for(const entity of this.entities)this.applyEntityVisual(entity,entity.motionFrame||null);
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
    const {el,index,anchorX,anchorY,motionFrame,...data}=entity;
    return data;
  }

  getPlayerConfig(){
    const player=this.config.player||{};
    return {
      src:String(player.src||""),
      x:Number(player.x??this.config.width/2),
      y:Number(player.y??this.config.height/2),
      width:Math.max(24,Number(player.width??108)),
      height:Math.max(24,Number(player.height??150))
    };
  }

  updatePlayerConfig(patch={},commit=true){
    const current=this.getPlayerConfig();
    const next={
      ...current,
      ...structuredClone(patch)
    };
    next.src=String(next.src||"");
    next.x=clamp(Number(next.x)||this.config.width/2,0,this.config.width);
    next.y=clamp(Number(next.y)||this.config.height/2,0,this.config.height);
    next.width=clamp(Number(next.width)||108,24,1200);
    next.height=clamp(Number(next.height)||150,24,1200);

    this.config.player=next;
    this.player.x=next.x;
    this.player.y=next.y;
    if(this.playerEl){
      this.playerEl.src=next.src;
      this.playerEl.style.width=next.width+"px";
      this.playerEl.style.height=next.height+"px";
      this.updatePlayerVisual();
    }
    this.updateCamera(true);
    return this.getPlayerConfig();
  }

  getOcean(){
    return structuredClone(normalizeOceanConfig(this.config.ocean||{}));
  }

  updateWorld(patch={},commit=true){
    if(patch.name!==undefined)this.config.name=String(patch.name||this.config.id||"Mundo");
    if(patch.width!==undefined)this.config.width=clamp(Number(patch.width)||390,390,20000);
    if(patch.height!==undefined)this.config.height=clamp(Number(patch.height)||844,844,20000);
    if(this.stage){
      this.stage.style.width=this.config.width+"px";
      this.stage.style.height=this.config.height+"px";
    }
    this.player.x=clamp(this.player.x,55,this.config.width-55);
    this.player.y=clamp(this.player.y,70,this.config.height-70);
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
    this.config.ocean=normalizeOceanConfig({...base,...structuredClone(patch)});
    this.applyOceanStatic();
    return this.getOcean();
  }

  applyOceanStatic(){
    if(!this.oceanEl)return;
    const ocean=normalizeOceanConfig(this.config.ocean||{});
    this.config.ocean=ocean;
    const safeBackground=String(ocean.background||"").replace(/["\\]/g,"");
    this.oceanEl.style.backgroundImage=safeBackground?'url("'+safeBackground+'")':"none";
    this.oceanEl.style.backgroundSize=ocean.tileSize+"px auto";
    this.oceanEl.style.backgroundRepeat="repeat";
    this.oceanEl.style.transformOrigin="center center";
    this.oceanWebGL?.setBackground(ocean.background);
    if(!ocean.active){
      if(this.oceanCanvas)this.oceanCanvas.hidden=true;
      this.oceanEl.hidden=false;
    }
  }

  updateOceanFrame(time){
    if(!this.oceanEl)return;
    const ocean=normalizeOceanConfig(this.config.ocean||{});
    const webglActive=this.oceanWebGL?.render(time,ocean)===true;
    if(webglActive){
      this.oceanEl.hidden=true;
      this.oceanCanvas.hidden=false;
      return;
    }
    this.oceanEl.hidden=false;
    if(this.oceanCanvas)this.oceanCanvas.hidden=true;
    const frame=computeOceanFrame(ocean,time);
    this.oceanEl.style.backgroundPosition=frame.offsetX.toFixed(2)+"px "+frame.offsetY.toFixed(2)+"px";
    this.oceanEl.style.transform="scale("+frame.scale.toFixed(5)+")";
    this.oceanEl.style.filter="brightness("+frame.brightness.toFixed(2)+"%) saturate("+frame.saturation+"%)";
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
    entity.scaleX=clamp(Math.abs(Number(entity.scaleX??1))||1,.05,20);
    entity.scaleY=clamp(Math.abs(Number(entity.scaleY??1))||1,.05,20);
    entity.rotation=Number(entity.rotation||0);
    entity.skewX=clamp(Number(entity.skewX||0),-75,75);
    entity.skewY=clamp(Number(entity.skewY||0),-75,75);
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
      scaleX:clamp(Math.abs(Number(raw.scaleX??1))||1,.05,20),
      scaleY:clamp(Math.abs(Number(raw.scaleY??1))||1,.05,20),
      rotation:Number(raw.rotation||0),
      skewX:clamp(Number(raw.skewX||0),-75,75),
      skewY:clamp(Number(raw.skewY||0),-75,75),
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
    this.updateOceanFrame(time);
    this.updateEntityMotionFrame(time);
    this.updateCamera(false,dt);
    this.updateNearby();

    if(this.coordsEl){
      const target=this.mode==="edit"?this.camera:this.player;
      this.coordsEl.textContent=`x ${Math.round(target.x)} · y ${Math.round(target.y)}`;
    }
    if(this.zoomEl)this.zoomEl.textContent=this.mode==="edit"?`zoom ${Math.round(this.zoom*100)}%`:"";

    this.raf=requestAnimationFrame(t=>this.tick(t));
  }

  getState(){
    return {
      player:{x:this.player.x,y:this.player.y,rotation:this.player.rotation},
      collected:[...this.collected]
    };
  }

  destroy(){
    cancelAnimationFrame(this.raf);
    this.oceanWebGL?.destroy();
    this.oceanWebGL=null;
    for(const cleanup of this.cleanups.splice(0))cleanup();
    this.root.classList.remove("tq-world-test-active");
    this.root.innerHTML="";
  }
}
