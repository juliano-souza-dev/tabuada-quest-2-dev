export class HudLayoutEditor{
  constructor(){
    this.storageKey="tq.dev.live-hud-layout.v1";
    this.offsets=this.loadOffsets();
    this.active=false;
    this.el=null;
    this.toolbarButton=null;
    this.raf=0;
    this.drag=null;
  }

  loadOffsets(){
    try{
      const value=JSON.parse(localStorage.getItem(this.storageKey)||"{}");
      return value&&typeof value==="object"?value:{};
    }catch{
      return {};
    }
  }

  saveOffsets(){
    try{localStorage.setItem(this.storageKey,JSON.stringify(this.offsets))}catch{}
  }

  mount(devRoot){
    if(this.toolbarButton)return;
    const toolbar=devRoot?.querySelector?.(".tq-dev__bar");
    if(!toolbar)return;

    const button=document.createElement("button");
    button.type="button";
    button.dataset.hudLayout="";
    button.innerHTML="🧩 <span>HUD</span>";
    button.title="Editar a posição do HUD atual";
    const scenes=toolbar.querySelector("[data-scenes]");
    if(scenes?.nextSibling)toolbar.insertBefore(button,scenes.nextSibling);
    else toolbar.append(button);
    button.addEventListener("click",()=>this.toggle());
    this.toolbarButton=button;

    this.installStyles();
  }

  installStyles(){
    if(document.querySelector("#tq-live-hud-editor-style"))return;
    const style=document.createElement("style");
    style.id="tq-live-hud-editor-style";
    style.textContent=`
      .tq-live-hud-editor{
        position:fixed;
        inset:0;
        z-index:10070;
        pointer-events:none;
      }

      .tq-live-hud-editor__handle{
        position:fixed;
        box-sizing:border-box;
        border:2px dashed #ffd84d;
        background:rgba(255,216,77,.08);
        border-radius:10px;
        pointer-events:auto;
        touch-action:none;
        cursor:move;
      }

      .tq-live-hud-editor__handle::before{
        content:attr(data-label);
        position:absolute;
        left:0;
        top:-20px;
        max-width:160px;
        padding:2px 6px;
        border-radius:5px;
        background:#111827;
        color:#fff3b0;
        font:700 10px/1.3 system-ui,sans-serif;
        white-space:nowrap;
        pointer-events:none;
      }

      .tq-live-hud-editor__handle.is-dragging{
        border-style:solid;
        background:rgba(255,216,77,.16);
      }

      .tq-live-hud-editor__tools{
        position:fixed;
        left:50%;
        bottom:12px;
        transform:translateX(-50%);
        z-index:10071;
        display:flex;
        gap:7px;
        align-items:center;
        padding:7px;
        border:1px solid #475569;
        border-radius:12px;
        background:rgba(15,23,42,.95);
        box-shadow:0 10px 35px #0008;
        pointer-events:auto;
        font:12px system-ui,sans-serif;
      }

      .tq-live-hud-editor__tools strong{
        color:#fde68a;
        padding:0 5px;
      }

      .tq-live-hud-editor__tools button{
        border:1px solid #52627a;
        border-radius:8px;
        padding:7px 9px;
        color:#f8fafc;
        background:#243047;
        cursor:pointer;
      }

      .tq-live-hud-editor__tools button:hover{
        background:#334155;
      }
    `;
    document.head.append(style);
  }

  resolveRenderer(){
    return globalThis.TabuadaQuest?.dev?.worldEditor?.runtime?.mobileHud?.pixiHud
      ||globalThis.TabuadaQuest?.runtime?.mobileHud?.pixiHud
      ||null;
  }

  toggle(){
    if(this.active)this.disable();
    else this.enable();
  }

  enable(){
    const renderer=this.resolveRenderer();
    if(!renderer?.ready){
      window.alert("Abra uma região com a HUD visível antes de ativar o modo HUD.");
      return false;
    }

    this.active=true;
    this.toolbarButton?.classList.add("active");
    renderer.setLayoutOffsets?.(this.offsets);
    this.mountOverlay();
    this.renderHandles();
    this.loop();
    return true;
  }

  disable(){
    this.active=false;
    this.toolbarButton?.classList.remove("active");
    cancelAnimationFrame(this.raf);
    this.raf=0;
    this.drag=null;
    this.el?.remove();
    this.el=null;
  }

  mountOverlay(){
    this.el?.remove();
    const overlay=document.createElement("div");
    overlay.className="tq-live-hud-editor";
    overlay.innerHTML=`
      <div data-hud-handles></div>
      <div class="tq-live-hud-editor__tools">
        <strong>HUD · EDITAR</strong>
        <button type="button" data-hud-export>Exportar JSON</button>
        <button type="button" data-hud-reset>Resetar posições</button>
        <button type="button" data-hud-finish>Concluir</button>
      </div>
    `;
    document.body.append(overlay);
    overlay.querySelector("[data-hud-export]").addEventListener("click",()=>this.exportJson());
    overlay.querySelector("[data-hud-reset]").addEventListener("click",()=>this.reset());
    overlay.querySelector("[data-hud-finish]").addEventListener("click",()=>this.disable());
    this.el=overlay;
  }

  labels(){
    return {
      top:"Status / moedas",
      minimap:"Minimapa",
      joystick:"Movimento",
      ammo:"Munição",
      fire:"Atirar",
      follow:"Seguir",
      center:"Centralizar",
      repair:"Reparar",
      shield:"Reforço",
      shipyard:"Estaleiro",
      groups:"Grupos",
      missions:"Missões",
      shop:"Loja",
      config:"Config"
    };
  }

  renderHandles(){
    if(!this.active||!this.el)return;
    const renderer=this.resolveRenderer();
    const rects=renderer?.editorRects||{};
    const host=this.el.querySelector("[data-hud-handles]");
    if(!host)return;

    const labels=this.labels();
    const existing=new Map([...host.querySelectorAll("[data-hud-key]")].map(node=>[node.dataset.hudKey,node]));

    for(const [key,rect] of Object.entries(rects)){
      if(!rect||rect.width<=0||rect.height<=0)continue;
      let handle=existing.get(key);
      if(!handle){
        handle=document.createElement("div");
        handle.className="tq-live-hud-editor__handle";
        handle.dataset.hudKey=key;
        handle.dataset.label=labels[key]||key;
        handle.addEventListener("pointerdown",event=>this.startDrag(event,key));
        host.append(handle);
      }
      handle.hidden=false;
      handle.style.left=Math.round(rect.left)+"px";
      handle.style.top=Math.round(rect.top)+"px";
      handle.style.width=Math.round(rect.width)+"px";
      handle.style.height=Math.round(rect.height)+"px";
      existing.delete(key);
    }

    for(const node of existing.values())node.remove();
  }

  startDrag(event,key){
    const renderer=this.resolveRenderer();
    if(!renderer)return;
    event.preventDefault();
    event.stopPropagation();

    const current=this.offsets[key]||{x:0,y:0};
    this.drag={
      key,
      startX:event.clientX,
      startY:event.clientY,
      offsetX:Number(current.x)||0,
      offsetY:Number(current.y)||0,
      node:event.currentTarget
    };
    this.drag.node.classList.add("is-dragging");

    const move=moveEvent=>this.onDrag(moveEvent);
    const end=endEvent=>{
      endEvent.preventDefault();
      window.removeEventListener("pointermove",move,true);
      window.removeEventListener("pointerup",end,true);
      window.removeEventListener("pointercancel",end,true);
      this.drag?.node?.classList.remove("is-dragging");
      this.drag=null;
      this.saveOffsets();
      this.renderHandles();
    };

    window.addEventListener("pointermove",move,true);
    window.addEventListener("pointerup",end,true);
    window.addEventListener("pointercancel",end,true);
  }

  onDrag(event){
    if(!this.drag)return;
    event.preventDefault();
    const dx=event.clientX-this.drag.startX;
    const dy=event.clientY-this.drag.startY;
    this.offsets[this.drag.key]={
      x:Math.round(this.drag.offsetX+dx),
      y:Math.round(this.drag.offsetY+dy)
    };

    this.resolveRenderer()?.setLayoutOffsets?.(this.offsets);
    this.renderHandles();
  }

  reset(){
    this.offsets={};
    this.saveOffsets();
    this.resolveRenderer()?.setLayoutOffsets?.({});
    this.renderHandles();
  }

  exportJson(){
    const renderer=this.resolveRenderer();
    const root=renderer?.root?.getBoundingClientRect?.();
    const payload={
      schema:"tq.hud-layout",
      version:2,
      mode:"live-hud-offsets",
      viewport:{
        width:Math.round(root?.width||innerWidth||0),
        height:Math.round(root?.height||innerHeight||0)
      },
      offsets:structuredClone(this.offsets)
    };

    const blob=new Blob([JSON.stringify(payload,null,2)],{type:"application/json"});
    const link=document.createElement("a");
    link.href=URL.createObjectURL(blob);
    link.download="tabuada-quest-hud-layout.json";
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(()=>URL.revokeObjectURL(link.href),0);
  }

  loop(){
    if(!this.active)return;
    this.renderHandles();
    this.raf=requestAnimationFrame(()=>this.loop());
  }
}
