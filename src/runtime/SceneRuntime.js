import { createCompositionEngine } from "./composition/registry.js?v=20260930-0020";
import { computeViewportMetrics, enforceViewportBackgroundLayout, resolveViewportNodeLayout } from "./layout/ViewportLayout.mjs?v=20260930-0020";
export class SceneRuntime {
  constructor(root, reference={width:390,height:844}, options={}) {
    this.root=root; this.reference=reference; this.editorEnabled=options.editorEnabled===true; this.mode=this.editorEnabled?"edit":"play";
    this.selectedId=null; this.nodes=new Map(); this.animationChannels=new Map(); this.actions=new Map(); this.actionBusy=new Set();
    this.compositions=createCompositionEngine(this); this.storageKey=null; this.mount();
  }
  mount(){
    this.root.innerHTML="";
    this.stageHost=document.createElement("main"); this.stageHost.className="tq-stage-host";
    this.stage=document.createElement("section"); this.stage.className="tq-stage";
    this.stage.dataset.nodeId="viewport"; this.stage.dataset.canonicalParent="true";
    this.stageHost.append(this.stage); this.root.append(this.stageHost);
    this.stage.addEventListener("pointerdown",e=>{if(this.mode==="edit"&&e.target===this.stage)this.select(null)});
    this.resizeObserver=new ResizeObserver(()=>this.fit()); this.resizeObserver.observe(this.stageHost); this.fit();
  }
  fit(){
    const r=this.stageHost.getBoundingClientRect();
    // 390x844 is a coordinate system, never a physical screen boundary.
    const metrics=computeViewportMetrics(r,this.reference);
    this.viewportScale=metrics.viewportScale;
    this.logicalViewport=metrics.logicalViewport;
    this.sceneOffset=metrics.sceneOffset;
    this.stage.style.width=this.logicalViewport.width+"px"; this.stage.style.height=this.logicalViewport.height+"px";
    this.stage.style.transform=`translate(-50%,-50%) scale(${this.viewportScale})`;
    if(this.nodes?.size){
      for(const {node,el} of this.nodes.values())this.applyTransform(el,node);
    }
  }

  resolveNodeLayout(node){
    return resolveViewportNodeLayout(node,{
      reference:this.reference,
      logicalViewport:this.logicalViewport,
      sceneOffset:this.sceneOffset
    });
  }
  async load(url){
    const res=await fetch(url,{cache:"no-store"}); if(!res.ok)throw new Error(`Scene load failed: ${res.status}`);
    return this.loadScene(await res.json());
  }
  loadScene(sourceScene){
    if(!sourceScene?.id)throw new Error("Invalid scene: missing id");
    this.scene=structuredClone(sourceScene);
    this.storageKey=null;

    if(this.editorEnabled){
      this.storageKey="tq.dev.scene-draft:"+sourceScene.id;
      try{
        const saved=localStorage.getItem(this.storageKey);
        if(saved){
          const draft=JSON.parse(saved);
          const sourceRevision=sourceScene.meta?.sourceRevision??null;
          const draftRevision=draft?.meta?.sourceRevision??null;
          if(draft?.schema===sourceScene.schema&&draft?.id===sourceScene.id&&draftRevision===sourceRevision)this.scene=draft;
          else localStorage.removeItem(this.storageKey);
        }
      }catch(err){console.warn("DEV draft restore failed",err)}
    }

    this.reference=this.scene.reference||this.reference;
    this.fit();
    this.render();
    this.dispatchEvent("sceneload",{scene:this.scene});
    return this.scene;
  }
  render(){
    this.compositions.reset();
    this.animationChannels.clear();
    this.stage.replaceChildren(); this.nodes.clear();
    for(const node of [...this.scene.nodes].sort((a,b)=>(a.z??0)-(b.z??0))) this.stage.append(this.createNode(node));
    if(this.editorEnabled) for(const {node,el} of this.nodes.values()) { this.attachEditHandles(node,el); this.attachRotateHandle(node,el); this.attachSkewHandles(node,el); }
    for(const {node} of this.nodes.values())this.syncComposition(node);
  }
  normalizeNode(node){
    node.parentId="viewport";
    node.x=Number(node.x??0); node.y=Number(node.y??0);
    node.scaleX=Number(node.scaleX??1); node.scaleY=Number(node.scaleY??1);
    node.rotation=Number(node.rotation??0); node.skewX=Number(node.skewX??0); node.skewY=Number(node.skewY??0); node.z=Number(node.z??0); node.visible=node.visible!==false; node.locked=Boolean(node.locked);
    if(node.compositionType!=null)node.compositionType=String(node.compositionType);
    if(node.action!=null)node.action=String(node.action);
    enforceViewportBackgroundLayout(node);
    return node;
  }
  createNode(raw){
    const node=this.normalizeNode(raw);
    const el=node.kind==="text"?document.createElement("div"):document.createElement("img");
    el.className="tq-node"; el.dataset.nodeId=node.id; el.dataset.parentId="viewport";
    if(node.kind==="image"){el.src=node.src;el.alt=node.alt||"";el.draggable=false}else el.textContent=node.text||"";
    this.applyTransform(el,node);
    this.syncActionElement(node,el);
    el.addEventListener("pointerdown",e=>{
      if(!this.editorEnabled||this.mode!=="edit"||node.locked)return;
      e.preventDefault();e.stopPropagation();this.select(node.id);this.beginDrag(e,node,el);
    });
    el.addEventListener("click",e=>{if(this.mode==="play"&&node.action)this.invokeNodeAction(node,e)});
    el.addEventListener("keydown",e=>{
      if(this.mode!=="play"||!node.action||!["Enter"," "].includes(e.key))return;
      e.preventDefault();this.invokeNodeAction(node,e);
    });
    this.nodes.set(node.id,{node,el}); return el;
  }
  attachEditHandles(node,el){
    if(node.kind!=="image")return;
    const handle=document.createElement("span");handle.className="tq-resize-handle";handle.setAttribute("aria-label","Redimensionar");
    el.addEventListener("load",()=>this.ensureNodeSize(node,el),{once:true});
    // Replaced elements cannot host children reliably, so handle is managed by the stage.
    for(const dir of ["nw","n","ne","e","se","s","sw","w"]){
      const h=document.createElement("button");h.type="button";h.className="tq-node-handle tq-resize-"+dir;h.dataset.forNode=node.id;h.dataset.resizeDir=dir;h.hidden=true;this.stage.append(h);
      h.addEventListener("pointerdown",e=>{e.preventDefault();e.stopPropagation();this.beginResize(e,node,el,h,dir)});
    }
  }
  attachRotateHandle(node,el){
    const h=document.createElement("button");h.type="button";h.className="tq-rotate-handle";h.dataset.forNode=node.id;h.hidden=true;this.stage.append(h);
    h.addEventListener("pointerdown",e=>{e.preventDefault();e.stopPropagation();this.beginRotate(e,node,h)});
  }
  beginRotate(event,node,handle){
    handle.setPointerCapture(event.pointerId);
    const rotate=e=>{
      const r=this.stage.getBoundingClientRect(),s=this.viewportScale||1,layout=this.resolveNodeLayout(node);
      const cx=r.left+(layout.x+layout.width/2)*s,cy=r.top+(layout.y+layout.height/2)*s;
      node.rotation=Math.atan2(e.clientY-cy,e.clientX-cx)*180/Math.PI+90;
      this.applyTransform(this.nodes.get(node.id).el,node);this.dispatchEvent("nodechange",{node,parentId:"viewport"});
    };
    const end=e=>{if(handle.hasPointerCapture(e.pointerId))handle.releasePointerCapture(e.pointerId);handle.removeEventListener("pointermove",rotate);handle.removeEventListener("pointerup",end);handle.removeEventListener("pointercancel",end);this.dispatchEvent("nodecommit",{node,parentId:"viewport"});};
    handle.addEventListener("pointermove",rotate);handle.addEventListener("pointerup",end);handle.addEventListener("pointercancel",end);
  }
  attachSkewHandles(node,el){
    for(const axis of ["x","y"]){
      const h=document.createElement("button");h.type="button";h.className="tq-skew-handle tq-skew-"+axis;h.dataset.forNode=node.id;h.dataset.axis=axis;h.hidden=true;this.stage.append(h);
      h.addEventListener("pointerdown",e=>{e.preventDefault();e.stopPropagation();this.beginSkew(e,node,h,axis)});
    }
  }
  beginSkew(event,node,handle,axis){
    handle.setPointerCapture(event.pointerId);
    const start={px:event.clientX,py:event.clientY,value:axis==="x"?node.skewX:node.skewY};
    const move=e=>{
      const scale=this.viewportScale||1,delta=axis==="x"?(e.clientX-start.px)/scale:(e.clientY-start.py)/scale;
      const size=Math.max(1,axis==="x"?(node.height??1):(node.width??1));
      const value=Math.max(-75,Math.min(75,start.value+Math.atan(delta/size)*180/Math.PI));
      if(axis==="x")node.skewX=value;else node.skewY=value;
      this.applyTransform(this.nodes.get(node.id).el,node);this.dispatchEvent("nodechange",{node,parentId:"viewport"});
    };
    const end=e=>{if(handle.hasPointerCapture(e.pointerId))handle.releasePointerCapture(e.pointerId);handle.removeEventListener("pointermove",move);handle.removeEventListener("pointerup",end);handle.removeEventListener("pointercancel",end);this.dispatchEvent("nodecommit",{node,parentId:"viewport"});};
    handle.addEventListener("pointermove",move);handle.addEventListener("pointerup",end);handle.addEventListener("pointercancel",end);
  }
  ensureNodeSize(node,el){
    if(node.width==null)node.width=el.naturalWidth||el.getBoundingClientRect().width/(this.viewportScale||1);
    if(node.height==null)node.height=el.naturalHeight||el.getBoundingClientRect().height/(this.viewportScale||1);
    this.applyTransform(el,node);this.positionHandle(node);
  }
  positionHandle(node){
    const layout=this.resolveNodeLayout(node),x=layout.x,y=layout.y,w=layout.width,h=layout.height,show=this.selectedId===node.id&&this.mode==="edit"&&!node.locked;
    const spots={nw:[x,y],n:[x+w/2,y],ne:[x+w,y],e:[x+w,y+h/2],se:[x+w,y+h],s:[x+w/2,y+h],sw:[x,y+h],w:[x,y+h/2]};
    for(const hnd of this.stage.querySelectorAll(".tq-node-handle"))if(hnd.dataset.forNode===node.id){const p=spots[hnd.dataset.resizeDir]||spots.se;hnd.hidden=!show;hnd.style.left=p[0]+"px";hnd.style.top=p[1]+"px";hnd.style.zIndex=(node.z??0)+100000;}
    const rh=[...this.stage.querySelectorAll(".tq-rotate-handle")].find(el=>el.dataset.forNode===node.id);if(rh){rh.hidden=!show;rh.style.left=(x+w/2)+"px";rh.style.top=(y-38)+"px";rh.style.zIndex=(node.z??0)+100000;}
    for(const axis of ["x","y"]){const sh=[...this.stage.querySelectorAll(".tq-skew-handle")].find(el=>el.dataset.forNode===node.id&&el.dataset.axis===axis);if(sh){sh.hidden=!show;sh.style.left=(axis==="x"?x+w/2:x-24)+"px";sh.style.top=(axis==="x"?y+h+24:y+h/2)+"px";sh.style.zIndex=(node.z??0)+100000;}}
  }
  beginResize(event,node,el,handle,dir="se"){
    handle.setPointerCapture(event.pointerId);const scale=this.viewportScale||1,min=24;
    const start={px:event.clientX,py:event.clientY,x:node.x,y:node.y,w:node.width??el.offsetWidth,h:node.height??el.offsetHeight};
    const move=e=>{
      const dx=(e.clientX-start.px)/scale,dy=(e.clientY-start.py)/scale;
      let left=start.x,top=start.y,right=start.x+start.w,bottom=start.y+start.h;
      if(dir.includes("w"))left=Math.min(right-min,start.x+dx);
      if(dir.includes("e"))right=Math.max(left+min,start.x+start.w+dx);
      if(dir.includes("n"))top=Math.min(bottom-min,start.y+dy);
      if(dir.includes("s"))bottom=Math.max(top+min,start.y+start.h+dy);
      node.x=left;node.y=top;node.width=right-left;node.height=bottom-top;
      this.applyTransform(el,node);this.positionHandle(node);this.dispatchEvent("nodechange",{node,parentId:"viewport"});
    };
    const end=e=>{if(handle.hasPointerCapture(e.pointerId))handle.releasePointerCapture(e.pointerId);handle.removeEventListener("pointermove",move);handle.removeEventListener("pointerup",end);handle.removeEventListener("pointercancel",end);this.dispatchEvent("nodecommit",{node,parentId:"viewport"});};
    handle.addEventListener("pointermove",move);handle.addEventListener("pointerup",end);handle.addEventListener("pointercancel",end);
  }
  normalizeActionPath(value){
    return String(value??"").split("?")[0].split("#")[0].replace(/^\.\//,"").replace(/^\/+/, "").toLowerCase();
  }
  registerAction(id,handler,options={}){
    const actionId=String(id||"").trim();
    if(!actionId||typeof handler!=="function")throw new TypeError("Invalid runtime action");
    this.actions.set(actionId,{
      id:actionId,
      label:String(options.label||actionId),
      handler,
      assetPaths:(options.assetPaths||[]).map(value=>this.normalizeActionPath(value))
    });
    for(const {node,el} of this.nodes.values())this.syncActionElement(node,el);
    return this;
  }
  listActions(){
    return [...this.actions.values()].map(({id,label})=>({id,label}));
  }
  suggestAction(node){
    const path=this.normalizeActionPath(node?.src||node?.path||"");
    if(!path)return null;
    return [...this.actions.values()].find(action=>action.assetPaths.includes(path))||null;
  }
  syncActionElement(node,el=this.nodes.get(node.id)?.el){
    if(!el)return;
    const action=node.action?this.actions.get(String(node.action)):null;
    const enabled=Boolean(action)&&this.mode==="play";
    el.classList.toggle("is-action",Boolean(action));
    el.classList.toggle("is-action-busy",this.actionBusy.has(node.id));
    if(!action){
      delete el.dataset.action;
      el.removeAttribute("role");
      el.removeAttribute("tabindex");
      el.removeAttribute("aria-disabled");
      return;
    }
    el.dataset.action=action.id;
    el.setAttribute("role","button");
    el.setAttribute("tabindex",enabled?"0":"-1");
    el.setAttribute("aria-label",String(node.actionLabel||action.label||node.alt||action.id));
    el.setAttribute("aria-disabled",this.actionBusy.has(node.id)?"true":"false");
  }
  async invokeNodeAction(node,event){
    if(this.mode!=="play"||!node?.action||this.actionBusy.has(node.id))return false;
    const action=this.actions.get(String(node.action));
    if(!action)return false;

    this.actionBusy.add(node.id);
    this.syncActionElement(node);
    this.dispatchEvent("actionstart",{action:action.id,node});
    try{
      await action.handler({runtime:this,node,event,action});
      this.dispatchEvent("actioncomplete",{action:action.id,node});
      return true;
    }catch(error){
      console.error("Runtime action failed",action.id,error);
      this.dispatchEvent("actionerror",{action:action.id,node,error:String(error?.message||error)});
      return false;
    }finally{
      this.actionBusy.delete(node.id);
      this.syncActionElement(node);
    }
  }
  syncComposition(node){return this.compositions.syncNode(node);}
  setAnimationTransform(id,channel="default",transform={}){
    if(typeof channel==="object"){transform=channel;channel="default"}
    let channels=this.animationChannels.get(id);
    if(!channels){channels=new Map();this.animationChannels.set(id,channels)}
    channels.set(String(channel),{
      x:Number(transform.x??0),
      y:Number(transform.y??0),
      rotation:Number(transform.rotation??0),
      scaleX:Number.isFinite(Number(transform.scaleX))?Math.max(.01,Number(transform.scaleX)):1,
      scaleY:Number.isFinite(Number(transform.scaleY))?Math.max(.01,Number(transform.scaleY)):1
    });
    const item=this.nodes.get(id);
    if(item)this.applyTransform(item.el,item.node,{skipCompositionSync:true});
  }
  clearAnimationTransform(id,channel=null){
    const channels=this.animationChannels.get(id);
    if(!channels)return;
    if(channel==null)channels.clear();else channels.delete(String(channel));
    if(!channels.size)this.animationChannels.delete(id);
    const item=this.nodes.get(id);
    if(item)this.applyTransform(item.el,item.node,{skipCompositionSync:true});
  }
  getAnimationTransform(id,{excludeChannels=[]}={}){
    const excluded=new Set(excludeChannels.map(String));
    const result={x:0,y:0,rotation:0,scaleX:1,scaleY:1};
    const channels=this.animationChannels.get(id);
    if(!channels)return result;
    for(const [name,transform] of channels){
      if(excluded.has(name))continue;
      result.x+=Number(transform.x)||0;
      result.y+=Number(transform.y)||0;
      result.rotation+=Number(transform.rotation)||0;
      result.scaleX*=Number.isFinite(Number(transform.scaleX))?Number(transform.scaleX):1;
      result.scaleY*=Number.isFinite(Number(transform.scaleY))?Number(transform.scaleY):1;
    }
    return result;
  }
  getAnimatedWorldState(id,options={}){
    const item=this.nodes.get(id);
    if(!item)return null;
    const node=item.node;
    const layout=this.resolveNodeLayout(node);
    const motion=this.getAnimationTransform(id,options);
    const scaleX=node.scaleX*motion.scaleX;
    const scaleY=node.scaleY*motion.scaleY;
    const width=layout.width*Math.abs(scaleX);
    const height=layout.height*Math.abs(scaleY);
    const centerX=layout.x+motion.x+layout.width/2;
    const centerY=layout.y+motion.y+layout.height/2;
    return {
      id,
      node,
      x:layout.x+motion.x,
      y:layout.y+motion.y,
      width,
      height,
      baseWidth:layout.width,
      baseHeight:layout.height,
      centerX,
      centerY,
      rotation:node.rotation+motion.rotation,
      scaleX,
      scaleY,
      motion
    };
  }
  applyTransform(el,node,options={}){
    const layout=this.resolveNodeLayout(node);
    const motion=this.getAnimationTransform(node.id);
    el.style.left=layout.x+"px";el.style.top=layout.y+"px";
    el.style.width=layout.width+"px";el.style.height=layout.height+"px";
    el.style.zIndex=node.z;
    el.style.transform=`translate(${motion.x}px,${motion.y}px) rotate(${node.rotation+motion.rotation}deg) skew(${node.skewX}deg,${node.skewY}deg) scale(${node.scaleX*motion.scaleX},${node.scaleY*motion.scaleY})`;
    el.hidden=node.visible===false;this.positionHandle(node);
    if(!options.skipCompositionSync)this.compositions.get(node.id)?.sync?.();
  }
  addNode(raw){
    if(!this.editorEnabled)return null;
    const base=(raw.id||"node").replace(/[^a-z0-9._-]+/gi,"-");
    let id=base,n=2;while(this.nodes.has(id))id=base+"-"+n++;
    const node=this.normalizeNode({...raw,id,parentId:"viewport"});
    this.scene.nodes.push(node);
    const el=this.createNode(node);this.stage.append(el);
    this.attachEditHandles(node,el);this.attachRotateHandle(node,el);this.attachSkewHandles(node,el);
    this.select(node.id);this.syncComposition(node);this.dispatchEvent("nodecommit",{node,parentId:"viewport",created:true});
    return node;
  }
  deleteNode(id){
    if(!this.editorEnabled)return false;
    const item=this.nodes.get(id);if(!item)return false;
    this.stage.querySelectorAll('[data-for-node="'+CSS.escape(id)+'"]').forEach(el=>el.remove());
    this.compositions.destroyNode(id);this.animationChannels.delete(id);item.el.remove();this.nodes.delete(id);
    if(this.scene?.nodes)this.scene.nodes=this.scene.nodes.filter(node=>node.id!==id);
    if(this.selectedId===id)this.select(null);
    this.persistDraft();this.dispatchEvent("nodecommit",{node:null,id,parentId:"viewport",deleted:true});
    return true;
  }
  updateNode(id,patch,commit=false){const item=this.nodes.get(id);if(!item)return;Object.assign(item.node,patch);this.normalizeNode(item.node);this.applyTransform(item.el,item.node);this.syncActionElement(item.node,item.el);this.syncComposition(item.node);this.dispatchEvent(commit?"nodecommit":"nodechange",{node:item.node,parentId:"viewport"});}
  select(id){
    this.selectedId=id;
    for(const [nodeId,{el}] of this.nodes)el.classList.toggle("is-selected",nodeId===id);
    for(const {node} of this.nodes.values())this.positionHandle(node);
    this.dispatchEvent("selectionchange",{id,node:id?this.nodes.get(id)?.node:null,parentId:"viewport"});
  }
  beginDrag(event,node,el){
    el.setPointerCapture(event.pointerId);
    const layout=this.resolveNodeLayout(node);
    const coverScale=node?.layout?.mode==="viewport-cover"
      ?Math.max(.01,Number(layout?.width||node.width||1)/Math.max(1,Number(node.width||1)))
      :1;
    const start={px:event.clientX,py:event.clientY,x:node.x,y:node.y,coverScale};
    const move=e=>{
      const scale=(this.viewportScale||1)*start.coverScale;
      node.x=start.x+(e.clientX-start.px)/scale;node.y=start.y+(e.clientY-start.py)/scale;
      this.applyTransform(el,node);this.dispatchEvent("nodechange",{node,parentId:"viewport"});
    };
    const end=e=>{if(el.hasPointerCapture(e.pointerId))el.releasePointerCapture(e.pointerId);el.removeEventListener("pointermove",move);el.removeEventListener("pointerup",end);el.removeEventListener("pointercancel",end);this.dispatchEvent("nodecommit",{node,parentId:"viewport"});};
    el.addEventListener("pointermove",move);el.addEventListener("pointerup",end);el.addEventListener("pointercancel",end);
  }
  setMode(mode){if(!this.editorEnabled&&mode!=="play")return;this.mode=mode;this.stage.dataset.mode=mode;if(mode==="play")this.select(null);else for(const {node} of this.nodes.values())this.positionHandle(node);for(const {node,el} of this.nodes.values())this.syncActionElement(node,el);this.dispatchEvent("modechange",{mode});}
  persistDraft(){if(!this.editorEnabled||!this.storageKey||!this.scene)return;try{localStorage.setItem(this.storageKey,JSON.stringify(this.scene))}catch(err){console.warn("DEV draft save failed",err)}}
  dispatchEvent(name,detail){if(this.editorEnabled&&(name==="nodechange"||name==="nodecommit"))this.persistDraft();window.dispatchEvent(new CustomEvent("tq:"+name,{detail}))}
}
