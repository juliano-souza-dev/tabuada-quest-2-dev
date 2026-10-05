export class HudLayoutEditor {
  constructor({root=document.body, runtime=null}={}){
    this.root=root;
    this.runtime=runtime;
    this.storageKey="tq.dev.hud-layout.v1";
    this.state=this.load();
    this.selectedId=null;
    this.drag=null;
    this.resize=null;
  }

  defaultState(){
    return {
      schema:"tq.hud-layout",
      version:1,
      viewport:{width:390,height:844,name:"mobile"},
      elements:[]
    };
  }

  load(){
    try{
      const raw=localStorage.getItem(this.storageKey);
      const parsed=raw?JSON.parse(raw):null;
      if(parsed?.schema==="tq.hud-layout"&&Array.isArray(parsed.elements))return parsed;
    }catch{}
    return this.defaultState();
  }

  save(){
    try{localStorage.setItem(this.storageKey,JSON.stringify(this.state))}catch{}
  }

  mount(devRoot){
    if(this.el)return;
    const toolbar=devRoot?.querySelector?.(".tq-dev__bar");
    if(toolbar&&!toolbar.querySelector("[data-hud-layout]")){
      const button=document.createElement("button");
      button.type="button";
      button.dataset.hudLayout="";
      button.innerHTML="🧩 <span>HUD</span>";
      button.title="Montar HUD e exportar JSON";
      const scenes=toolbar.querySelector("[data-scenes]");
      if(scenes?.nextSibling)toolbar.insertBefore(button,scenes.nextSibling);else toolbar.append(button);
      button.addEventListener("click",()=>this.setVisible(this.el.hidden));
    }

    this.el=document.createElement("section");
    this.el.className="tq-hud-editor";
    this.el.hidden=true;
    this.el.innerHTML=`
      <header class="tq-hud-editor__header">
        <div><strong>HUD Layout</strong><small>Monte visualmente e exporte o JSON</small></div>
        <button type="button" data-hud-close aria-label="Fechar">×</button>
      </header>
      <div class="tq-hud-editor__toolbar">
        <label>Viewport
          <select data-hud-preset>
            <option value="390x844">Mobile 390×844</option>
            <option value="360x800">Mobile 360×800</option>
            <option value="412x915">Mobile 412×915</option>
            <option value="844x390">Landscape 844×390</option>
          </select>
        </label>
        <button type="button" data-hud-add-image>＋ Imagem</button>
        <button type="button" data-hud-add-text>＋ Texto</button>
        <button type="button" data-hud-add-block>＋ Bloco</button>
        <button type="button" data-hud-import>Importar JSON</button>
        <button type="button" data-hud-export class="is-primary">Exportar JSON</button>
        <button type="button" data-hud-clear>Limpar</button>
      </div>
      <div class="tq-hud-editor__body">
        <aside class="tq-hud-editor__layers">
          <strong>Camadas</strong>
          <div data-hud-layers></div>
        </aside>
        <main class="tq-hud-editor__stage-wrap">
          <div class="tq-hud-editor__game-preview" data-hud-game-preview>
            <div class="tq-hud-editor__stage" data-hud-stage></div>
          </div>
        </main>
        <aside class="tq-hud-editor__inspector">
          <strong>Elemento</strong>
          <div data-hud-inspector class="tq-hud-editor__empty">Selecione um elemento.</div>
        </aside>
      </div>
      <input type="file" accept="application/json,.json" data-hud-file hidden>
    `;
    devRoot.append(this.el);
    this.installStyles();
    this.bind();
    this.render();
  }

  installStyles(){
    if(document.querySelector("#tq-hud-editor-style"))return;
    const style=document.createElement("style");
    style.id="tq-hud-editor-style";
    style.textContent=`
      .tq-hud-editor{position:fixed;inset:12px;z-index:10080;background:#111827;color:#f9fafb;border:1px solid #374151;border-radius:16px;box-shadow:0 24px 80px #0009;overflow:hidden;font:13px/1.35 system-ui,sans-serif}
      .tq-hud-editor[hidden]{display:none!important}.tq-hud-editor button,.tq-hud-editor input,.tq-hud-editor select{font:inherit}
      .tq-hud-editor__header{height:56px;padding:0 16px;display:flex;align-items:center;justify-content:space-between;background:#0b1220;border-bottom:1px solid #273244}
      .tq-hud-editor__header div{display:grid}.tq-hud-editor__header small{color:#93a4b8}.tq-hud-editor__header button{font-size:26px;background:none;color:white;border:0}
      .tq-hud-editor__toolbar{min-height:50px;padding:8px 10px;display:flex;gap:8px;align-items:center;flex-wrap:wrap;background:#162033;border-bottom:1px solid #273244}
      .tq-hud-editor button,.tq-hud-editor select,.tq-hud-editor input{background:#202c40;color:#f8fafc;border:1px solid #3b4a62;border-radius:8px;padding:7px 9px}
      .tq-hud-editor button{cursor:pointer}.tq-hud-editor button:hover{background:#2a3a54}.tq-hud-editor button.is-primary{background:#2563eb;border-color:#3b82f6}
      .tq-hud-editor__body{height:calc(100% - 108px);display:grid;grid-template-columns:200px minmax(320px,1fr) 280px;min-height:0}
      .tq-hud-editor__layers,.tq-hud-editor__inspector{padding:12px;overflow:auto;background:#111827}.tq-hud-editor__layers{border-right:1px solid #273244}.tq-hud-editor__inspector{border-left:1px solid #273244}
      .tq-hud-editor__layer{display:flex;width:100%;justify-content:space-between;margin-top:8px;text-align:left}.tq-hud-editor__layer.is-selected{outline:2px solid #60a5fa}
      .tq-hud-editor__stage-wrap{overflow:auto;display:grid;place-items:center;padding:36px;background:#0b1220}
      .tq-hud-editor__game-preview{position:relative;flex:none;overflow:hidden;box-shadow:0 0 0 1px #93c5fd,0 20px 60px #0008;background:#06131d}
      .tq-hud-editor__game-preview::before{content:"";position:absolute;inset:0;background:var(--tq-hud-preview-image,none) center/cover no-repeat;opacity:.96;pointer-events:none}
      .tq-hud-editor__game-preview::after{content:"GAMEPLAY";position:absolute;left:8px;bottom:6px;font-size:10px;letter-spacing:.12em;color:#ffffff88;pointer-events:none}
      .tq-hud-editor__stage{position:relative;flex:none;background:transparent;overflow:hidden;touch-action:none;z-index:1}
      .tq-hud-editor__item{position:absolute;box-sizing:border-box;user-select:none;touch-action:none;cursor:move;outline:1px dashed transparent}
      .tq-hud-editor__item.is-selected{outline:2px solid #fde047}.tq-hud-editor__item img{width:100%;height:100%;object-fit:contain;pointer-events:none}
      .tq-hud-editor__item-text{display:flex;align-items:center;justify-content:center;text-align:center;font-weight:700;text-shadow:0 1px 2px #000}
      .tq-hud-editor__item-block{border:1px solid #ffffff55;background:#0f172acc;border-radius:12px}
      .tq-hud-editor__resize{position:absolute;right:-7px;bottom:-7px;width:15px;height:15px;border-radius:50%;background:#fde047;border:2px solid #111827;cursor:nwse-resize}
      .tq-hud-editor__inspector label{display:grid;gap:4px;margin:10px 0;color:#cbd5e1}.tq-hud-editor__inspector input,.tq-hud-editor__inspector select{width:100%;box-sizing:border-box}
      .tq-hud-editor__grid{display:grid;grid-template-columns:1fr 1fr;gap:8px}.tq-hud-editor__empty{color:#94a3b8;margin-top:12px}
      .tq-hud-editor__row{display:flex;gap:6px;margin-top:10px}.tq-hud-editor__row>*{flex:1}
      @media(max-width:900px){.tq-hud-editor{inset:0;border-radius:0}.tq-hud-editor__body{grid-template-columns:1fr}.tq-hud-editor__layers{display:none}.tq-hud-editor__inspector{position:absolute;right:8px;bottom:8px;width:min(270px,70vw);max-height:52%;border:1px solid #3b4a62;border-radius:12px;box-shadow:0 10px 40px #0008}.tq-hud-editor__stage-wrap{padding:18px}}
    `;
    document.head.append(style);
  }

  bind(){
    this.el.querySelector("[data-hud-close]").addEventListener("click",()=>this.setVisible(false));
    this.el.querySelector("[data-hud-add-image]").addEventListener("click",()=>this.addElement("image"));
    this.el.querySelector("[data-hud-add-text]").addEventListener("click",()=>this.addElement("text"));
    this.el.querySelector("[data-hud-add-block]").addEventListener("click",()=>this.addElement("block"));
    this.el.querySelector("[data-hud-export]").addEventListener("click",()=>this.exportJson());
    this.el.querySelector("[data-hud-import]").addEventListener("click",()=>this.el.querySelector("[data-hud-file]").click());
    this.el.querySelector("[data-hud-file]").addEventListener("change",event=>this.importFile(event.target.files?.[0]));
    this.el.querySelector("[data-hud-clear]").addEventListener("click",()=>{if(confirm("Limpar o layout do HUD?")){this.state.elements=[];this.selectedId=null;this.commit()}});
    this.el.querySelector("[data-hud-preset]").addEventListener("change",event=>{
      const [width,height]=event.target.value.split("x").map(Number);
      this.state.viewport={...this.state.viewport,width,height,name:width>height?"landscape":"mobile"};
      this.commit();
    });
  }

  setVisible(show){
    if(!this.el)return;
    this.el.hidden=!show;
    if(show){
      this.syncGameplayPreview();
      this.render();
    }
  }

  syncGameplayPreview(){
    const preview=this.el?.querySelector("[data-hud-game-preview]");
    if(!preview)return;
    const viewport=this.state.viewport||{width:390,height:844};
    preview.style.width=viewport.width+"px";
    preview.style.height=viewport.height+"px";
    const host=this.runtime?.host||this.runtime?.root||document.querySelector("#app");
    let source="";
    const canvas=host?.querySelector?.("canvas");
    if(canvas&&canvas.width&&canvas.height){
      try{source=canvas.toDataURL("image/png")}catch{}
    }
    if(source){
      preview.style.setProperty("--tq-hud-preview-image",`url("${source}")`);
      return;
    }
    const backgroundNode=host&&[host,...host.querySelectorAll("*")].find(node=>{
      const value=getComputedStyle(node).backgroundImage;
      return value&&value!=="none";
    });
    const backgroundImage=backgroundNode?getComputedStyle(backgroundNode).backgroundImage:"";
    if(backgroundImage&&backgroundImage!=="none"){
      preview.style.setProperty("--tq-hud-preview-image",backgroundImage);
      return;
    }
    preview.style.setProperty("--tq-hud-preview-image","linear-gradient(#0b3550,#0f6b83)");
  }

  addElement(type){
    const id=type+"-"+Date.now().toString(36);
    const base={id,type,name:type==="image"?"Imagem":type==="text"?"Texto":"Bloco",x:24,y:24,width:type==="text"?140:96,height:type==="text"?44:96,zIndex:this.state.elements.length+1,anchor:"top-left",opacity:1,visible:true};
    if(type==="image")Object.assign(base,{src:"./assets/",fit:"contain"});
    if(type==="text")Object.assign(base,{text:"Texto HUD",fontSize:18,color:"#ffffff"});
    if(type==="block")Object.assign(base,{background:"rgba(15,23,42,.8)",borderRadius:12});
    this.state.elements.push(base);
    this.selectedId=id;
    this.commit();
  }

  commit(){
    this.save();
    this.render();
    window.dispatchEvent(new CustomEvent("tq:hudlayoutchange",{detail:{layout:structuredClone(this.state)}}));
  }

  render(){
    if(!this.el)return;
    const stage=this.el.querySelector("[data-hud-stage]");
    const viewport=this.state.viewport||{width:390,height:844};
    const preview=this.el.querySelector("[data-hud-game-preview]");
    if(preview){
      preview.style.width=viewport.width+"px";
      preview.style.height=viewport.height+"px";
    }
    stage.style.width=viewport.width+"px";
    stage.style.height=viewport.height+"px";
    stage.innerHTML="";
    const sorted=[...this.state.elements].sort((a,b)=>(a.zIndex||0)-(b.zIndex||0));
    for(const element of sorted){
      const node=document.createElement("div");
      node.className="tq-hud-editor__item tq-hud-editor__item-"+element.type+(element.id===this.selectedId?" is-selected":"");
      node.dataset.id=element.id;
      Object.assign(node.style,{left:element.x+"px",top:element.y+"px",width:element.width+"px",height:element.height+"px",zIndex:String(element.zIndex||1),opacity:String(element.opacity??1),display:element.visible===false?"none":""});
      if(element.type==="image"){
        const img=document.createElement("img");img.src=element.src||"";img.alt=element.name||"";img.style.objectFit=element.fit||"contain";node.append(img);
      }else if(element.type==="text"){
        node.textContent=element.text||"Texto HUD";node.style.fontSize=(element.fontSize||18)+"px";node.style.color=element.color||"#fff";
      }
      const handle=document.createElement("span");handle.className="tq-hud-editor__resize";node.append(handle);
      node.addEventListener("pointerdown",event=>this.startPointer(event,element.id,event.target===handle));
      stage.append(node);
    }
    this.renderLayers();
    this.renderInspector();
  }

  startPointer(event,id,isResize){
    event.preventDefault();
    event.stopPropagation();
    this.selectedId=id;
    const item=this.state.elements.find(e=>e.id===id);if(!item)return;
    const data={id,startX:event.clientX,startY:event.clientY,x:item.x,y:item.y,width:item.width,height:item.height};
    if(isResize)this.resize=data;else this.drag=data;
    const move=e=>this.movePointer(e);
    const up=()=>{window.removeEventListener("pointermove",move);window.removeEventListener("pointerup",up);this.drag=null;this.resize=null;this.commit()};
    window.addEventListener("pointermove",move);
    window.addEventListener("pointerup",up,{once:true});
    this.render();
  }

  movePointer(event){
    const data=this.drag||this.resize;if(!data)return;
    const item=this.state.elements.find(e=>e.id===data.id);if(!item)return;
    const dx=event.clientX-data.startX,dy=event.clientY-data.startY;
    if(this.resize){
      item.width=Math.max(16,Math.round(data.width+dx));
      item.height=Math.max(16,Math.round(data.height+dy));
    }else{
      const vp=this.state.viewport;
      item.x=Math.max(-item.width+16,Math.min(vp.width-16,Math.round(data.x+dx)));
      item.y=Math.max(-item.height+16,Math.min(vp.height-16,Math.round(data.y+dy)));
    }
    this.save();
    this.renderStageOnly();
  }

  renderStageOnly(){
    const selected=this.selectedId;
    const stage=this.el.querySelector("[data-hud-stage]");
    for(const node of stage.querySelectorAll("[data-id]")){
      const item=this.state.elements.find(e=>e.id===node.dataset.id);if(!item)continue;
      node.style.left=item.x+"px";node.style.top=item.y+"px";node.style.width=item.width+"px";node.style.height=item.height+"px";
      node.classList.toggle("is-selected",item.id===selected);
    }
    this.renderInspector();
  }

  renderLayers(){
    const host=this.el.querySelector("[data-hud-layers]");
    host.innerHTML="";
    [...this.state.elements].sort((a,b)=>(b.zIndex||0)-(a.zIndex||0)).forEach(element=>{
      const button=document.createElement("button");
      button.className="tq-hud-editor__layer"+(element.id===this.selectedId?" is-selected":"");
      button.innerHTML="<span>"+this.escape(element.name||element.id)+"</span><small>"+element.type+"</small>";
      button.addEventListener("click",()=>{this.selectedId=element.id;this.render()});
      host.append(button);
    });
  }

  renderInspector(){
    const host=this.el.querySelector("[data-hud-inspector]");
    const item=this.state.elements.find(e=>e.id===this.selectedId);
    if(!item){host.className="tq-hud-editor__empty";host.textContent="Selecione um elemento.";return}
    host.className="";
    host.innerHTML=`
      <label>Nome<input data-field="name" value="${this.escapeAttr(item.name||"")}"></label>
      ${item.type==="image"?`<label>Asset / src<input data-field="src" value="${this.escapeAttr(item.src||"")}"></label><label>Ajuste<select data-field="fit"><option value="contain">contain</option><option value="cover">cover</option><option value="fill">fill</option></select></label>`:""}
      ${item.type==="text"?`<label>Texto<input data-field="text" value="${this.escapeAttr(item.text||"")}"></label><div class="tq-hud-editor__grid"><label>Tamanho<input data-field="fontSize" type="number" value="${Number(item.fontSize)||18}"></label><label>Cor<input data-field="color" value="${this.escapeAttr(item.color||"#fff")}"></label></div>`:""}
      <div class="tq-hud-editor__grid">
        <label>X<input data-field="x" type="number" value="${item.x}"></label>
        <label>Y<input data-field="y" type="number" value="${item.y}"></label>
        <label>Largura<input data-field="width" type="number" min="1" value="${item.width}"></label>
        <label>Altura<input data-field="height" type="number" min="1" value="${item.height}"></label>
        <label>Camada<input data-field="zIndex" type="number" value="${item.zIndex||1}"></label>
        <label>Opacidade<input data-field="opacity" type="number" min="0" max="1" step=".05" value="${item.opacity??1}"></label>
      </div>
      <label>Âncora<select data-field="anchor">
        <option value="top-left">top-left</option><option value="top-center">top-center</option><option value="top-right">top-right</option>
        <option value="center-left">center-left</option><option value="center">center</option><option value="center-right">center-right</option>
        <option value="bottom-left">bottom-left</option><option value="bottom-center">bottom-center</option><option value="bottom-right">bottom-right</option>
      </select></label>
      <div class="tq-hud-editor__row"><button data-duplicate>Duplicar</button><button data-delete>Excluir</button></div>
    `;
    host.querySelector('[data-field="anchor"]').value=item.anchor||"top-left";
    if(item.type==="image")host.querySelector('[data-field="fit"]').value=item.fit||"contain";
    host.querySelectorAll("[data-field]").forEach(input=>{
      input.addEventListener("input",()=>{
        const key=input.dataset.field;
        let value=input.value;
        if(["x","y","width","height","zIndex","opacity","fontSize"].includes(key))value=Number(value);
        item[key]=value;
        this.commit();
      });
    });
    host.querySelector("[data-delete]").addEventListener("click",()=>{this.state.elements=this.state.elements.filter(e=>e.id!==item.id);this.selectedId=null;this.commit()});
    host.querySelector("[data-duplicate]").addEventListener("click",()=>{
      const copy=structuredClone(item);copy.id=item.type+"-"+Date.now().toString(36);copy.name=(item.name||item.type)+" cópia";copy.x+=12;copy.y+=12;copy.zIndex=this.state.elements.length+1;this.state.elements.push(copy);this.selectedId=copy.id;this.commit();
    });
  }

  exportJson(){
    const payload=structuredClone(this.state);
    payload.exportedAt=new Date().toISOString();
    const blob=new Blob([JSON.stringify(payload,null,2)],{type:"application/json"});
    const link=document.createElement("a");
    link.href=URL.createObjectURL(blob);
    link.download="tabuada-quest-hud-layout.json";
    link.click();
    setTimeout(()=>URL.revokeObjectURL(link.href),0);
  }

  async importFile(file){
    if(!file)return;
    try{
      const payload=JSON.parse(await file.text());
      if(payload?.schema!=="tq.hud-layout"||!Array.isArray(payload.elements))throw new Error("invalid");
      this.state=payload;this.selectedId=null;this.commit();
    }catch{alert("JSON de HUD inválido.")}
    this.el.querySelector("[data-hud-file]").value="";
  }

  escape(value){return String(value??"").replace(/[&<>"]/g,ch=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[ch]))}
  escapeAttr(value){return this.escape(value).replace(/'/g,"&#39;")}
}
