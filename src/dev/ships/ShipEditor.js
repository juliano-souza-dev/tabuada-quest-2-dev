const clone=value=>structuredClone(value);
const slug=value=>String(value||"")
  .normalize("NFD").replace(/[\u0300-\u036f]/g,"")
  .toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-+|-+$/g,"").slice(0,64)||"navio";

export class ShipEditor{
  constructor({requestFrameAsset}={}){
    this.requestFrameAsset=typeof requestFrameAsset==="function"?requestFrameAsset:null;
    this.catalog=null;
    this.drafts=[];
    this.selectedId=null;
    this.animationByShip=new Map();
    this.previewTimer=0;
    this.storageKey="tq.dev.ship-drafts:v2";
    this.el=null;
  }

  async mount(parent){
    this.el=document.createElement("section");
    this.el.className="tq-dev__ships";
    this.el.hidden=true;
    this.el.innerHTML=`
      <header><div><strong>Navios</strong><small>Editor frame a frame · runtime em atlas</small></div><button type="button" data-ships-close aria-label="Fechar">×</button></header>
      <div class="tq-ships__body">
        <aside class="tq-ships__sidebar">
          <button type="button" class="tq-ships__new" data-ship-new>＋ Novo navio</button>
          <div class="tq-ships__list" data-ships-list></div>
        </aside>
        <main class="tq-ships__editor" data-ship-editor>
          <div class="tq-ships__empty">Selecione ou crie um navio.</div>
        </main>
      </div>`;
    parent.append(this.el);
    this.el.querySelector("[data-ships-close]").addEventListener("click",()=>this.setVisible(false));
    this.el.querySelector("[data-ship-new]").addEventListener("click",()=>this.createShip());
    await this.load();
  }

  async load(){
    try{
      const response=await fetch("./src/config/ship-catalog.json?v=20261001-1338",{cache:"no-store"});
      if(!response.ok)throw new Error("HTTP "+response.status);
      this.catalog=await response.json();
    }catch(error){
      console.warn("Ship catalog load failed",error);
      this.catalog={schema:"tq.ship-catalog",version:2,ships:[]};
    }
    try{
      const value=JSON.parse(localStorage.getItem(this.storageKey)||"[]");
      this.drafts=Array.isArray(value)?value.filter(ship=>ship?.id):[];
    }catch{this.drafts=[]}
    const first=this.allShips()[0];
    if(first&&!this.selectedId)this.selectedId=first.id;
    this.render();
  }

  repositoryShips(){
    return Array.isArray(this.catalog?.ships)?this.catalog.ships:[];
  }

  normalizeShip(ship){
    const value=clone(ship||{});
    value.type=value.type==="npc"?"npc":"player";
    value.name=String(value.name||value.id||"Navio");
    value.animations=value.animations&&typeof value.animations==="object"?value.animations:{};
    return value;
  }

  allShips(){
    const byId=new Map(this.repositoryShips().map(ship=>[ship.id,this.normalizeShip(ship)]));
    for(const draft of this.drafts)byId.set(draft.id,this.normalizeShip(draft));
    return [...byId.values()].sort((a,b)=>String(a.name).localeCompare(String(b.name),"pt-BR"));
  }

  current(){
    return this.allShips().find(ship=>ship.id===this.selectedId)||null;
  }

  editableCurrent(){
    const current=this.current();
    if(!current)return null;
    let draft=this.drafts.find(ship=>ship.id===current.id);
    if(!draft){
      draft=this.normalizeShip(current);
      draft.editor={...(draft.editor||{}),draft:true,updatedAt:Date.now()};
      this.drafts.push(draft);
      this.save();
    }
    return draft;
  }

  save(){
    try{localStorage.setItem(this.storageKey,JSON.stringify(this.drafts))}catch(error){console.warn("Ship draft save failed",error)}
  }

  setVisible(show){
    if(!this.el)return;
    this.el.hidden=!show;
    if(show)this.render();
    else this.stopPreview();
  }

  select(id){
    this.selectedId=id;
    const ship=this.allShips().find(item=>item.id===id);
    if(ship&&!this.animationByShip.has(id)){
      const keys=Object.keys(ship.animations||{});
      this.animationByShip.set(id,ship.animations?.idle?"idle":(keys[0]||null));
    }
    this.render();
  }

  createShip(){
    const id="ship-"+Date.now();
    const ship={
      schema:"tq.ship",
      version:1,
      id,
      name:"Novo navio",
      type:"player",
      available:true,
      animations:{
        idle:{frameMs:140,loop:true,cellWidth:400,cellHeight:400,frames:[]}
      },
      editor:{draft:true,createdAt:Date.now(),updatedAt:Date.now()}
    };
    this.drafts.push(ship);
    this.save();
    this.selectedId=id;
    this.animationByShip.set(id,"idle");
    this.render();
  }

  updateShip(patch){
    const ship=this.editableCurrent();
    if(!ship)return;
    Object.assign(ship,clone(patch),{editor:{...(ship.editor||{}),draft:true,updatedAt:Date.now()}});
    this.save();
    this.render();
  }

  currentAnimationKey(ship=this.current()){
    if(!ship)return null;
    const keys=Object.keys(ship.animations||{});
    if(!keys.length)return null;
    let key=this.animationByShip.get(ship.id);
    if(!key||!ship.animations[key]){
      key=ship.animations.idle?"idle":keys[0];
      this.animationByShip.set(ship.id,key);
    }
    return key;
  }

  animation(){
    const ship=this.current();
    const key=this.currentAnimationKey(ship);
    return key?ship?.animations?.[key]||null:null;
  }

  addAnimation(name){
    const key=slug(name||"animacao");
    const ship=this.editableCurrent();
    if(!ship)return;
    ship.animations=ship.animations||{};
    let final=key,n=2;
    while(ship.animations[final])final=key+"-"+n++;
    ship.animations[final]={frameMs:140,loop:true,cellWidth:400,cellHeight:400,frames:[]};
    this.animationByShip.set(ship.id,final);
    this.save();this.render();
  }

  deleteAnimation(){
    const ship=this.editableCurrent();
    const key=this.currentAnimationKey(ship);
    if(!ship||!key)return;
    delete ship.animations[key];
    const next=ship.animations.idle?"idle":(Object.keys(ship.animations)[0]||null);
    this.animationByShip.set(ship.id,next);
    this.save();this.render();
  }

  updateAnimation(patch){
    const ship=this.editableCurrent();
    const key=this.currentAnimationKey(ship);
    if(!ship||!key)return;
    ship.animations[key]={...ship.animations[key],...clone(patch)};
    this.save();this.render();
  }

  addFrameTo(shipId,animationKey,src){
    let ship=this.drafts.find(item=>item.id===shipId)||null;
    if(!ship&&this.selectedId===shipId)ship=this.editableCurrent();
    if(!ship)return false;
    const key=animationKey&&ship.animations?.[animationKey]?animationKey:this.currentAnimationKey(ship);
    if(!key)return false;
    const anim=ship.animations[key];
    anim.frames=Array.isArray(anim.frames)?anim.frames:[];
    anim.frames.push({src:String(src),duration:null});
    this.animationByShip.set(ship.id,key);
    this.selectedId=ship.id;
    this.save();this.render();
    return true;
  }

  addFrame(src){
    const ship=this.current();
    const key=this.currentAnimationKey(ship);
    return ship&&key?this.addFrameTo(ship.id,key,src):false;
  }

  moveFrame(index,delta){
    const ship=this.editableCurrent();
    const key=this.currentAnimationKey(ship);
    const frames=ship?.animations?.[key]?.frames;
    if(!Array.isArray(frames))return;
    const target=index+delta;
    if(target<0||target>=frames.length)return;
    [frames[index],frames[target]]=[frames[target],frames[index]];
    this.save();this.render();
  }

  removeFrame(index){
    const ship=this.editableCurrent();
    const key=this.currentAnimationKey(ship);
    const frames=ship?.animations?.[key]?.frames;
    if(!Array.isArray(frames))return;
    frames.splice(index,1);
    this.save();this.render();
  }

  stopPreview(){
    if(this.previewTimer){clearTimeout(this.previewTimer);this.previewTimer=0}
  }

  startPreview(){
    this.stopPreview();
    const image=this.el?.querySelector("[data-ship-preview]");
    const anim=this.animation();
    const frames=Array.isArray(anim?.frames)?anim.frames:[];
    if(!image||!frames.length){if(image)image.removeAttribute("src");return}
    let i=0;
    const step=()=>{
      const current=this.animation();
      const list=Array.isArray(current?.frames)?current.frames:[];
      if(!list.length)return;
      i=i%list.length;
      image.src=list[i].src;
      const duration=Math.max(40,Number(list[i].duration)||Number(current.frameMs)||140);
      i+=1;
      if(i>=list.length&&!current.loop){i=list.length-1;return}
      this.previewTimer=setTimeout(step,duration);
    };
    step();
  }

  render(){
    if(!this.el)return;
    this.renderList();
    this.renderEditor();
  }

  renderList(){
    const list=this.el.querySelector("[data-ships-list]");
    const ships=this.allShips();
    list.innerHTML=ships.length?ships.map(ship=>`
      <button type="button" class="tq-ship-item ${ship.id===this.selectedId?"is-current":""}" data-ship-id="${this.escape(ship.id)}">
        <span><b>${this.escape(ship.name)}</b><small>${ship.type==="npc"?"NPC":"JOGADOR"} · ${this.escape(ship.id)}</small></span>
        <strong>${this.drafts.some(d=>d.id===ship.id)?"RASCUNHO":"CATÁLOGO"}</strong>
      </button>`).join(""):'<div class="tq-ships__empty">Nenhum navio cadastrado.</div>';
    list.querySelectorAll("[data-ship-id]").forEach(button=>button.addEventListener("click",()=>this.select(button.dataset.shipId)));
  }

  renderEditor(){
    const host=this.el.querySelector("[data-ship-editor]");
    const ship=this.current();
    if(!ship){host.innerHTML='<div class="tq-ships__empty">Selecione ou crie um navio.</div>';return}
    const keys=Object.keys(ship.animations||{});
    const animationKey=this.currentAnimationKey(ship);
    const anim=this.animation();
    const frames=Array.isArray(anim?.frames)?anim.frames:[];
    host.innerHTML=`
      <div class="tq-ships__top">
        <label><span>Nome</span><input data-ship-name value="${this.escape(ship.name)}"></label>
        <label><span>ID</span><input data-ship-id-input value="${this.escape(ship.id)}" disabled></label>
        <label><span>Tipo</span><select data-ship-type><option value="player" ${ship.type!=="npc"?"selected":""}>Jogador</option><option value="npc" ${ship.type==="npc"?"selected":""}>NPC</option></select></label>
      </div>
      <div class="tq-ships__workspace">
        <section class="tq-ships__preview">
          <div class="tq-ships__preview-stage">${frames.length?'<img data-ship-preview alt="Preview do navio">':'<div class="tq-ships__preview-empty" data-ship-preview-empty><b>Sem frames</b><small>Adicione o primeiro frame desta animação.</small></div>'}</div>
          <small>Preview frame a frame</small>
        </section>
        <section class="tq-ships__animation">
          <div class="tq-ships__animation-head">
            <label><span>Animação</span><select data-ship-animation>${keys.map(key=>'<option value="'+this.escape(key)+'" '+(key===animationKey?'selected':'')+'>'+this.escape(key)+'</option>').join("")}</select></label>
            <button type="button" data-animation-add>＋ Animação</button>
            <button type="button" data-animation-delete ${animationKey?"":"disabled"}>Excluir</button>
          </div>
          ${anim?`
          <div class="tq-ships__settings">
            <label><span>Frame ms</span><input data-animation-ms type="number" min="40" max="2000" value="${Number(anim.frameMs)||140}"></label>
            <label><span>Célula W</span><input data-animation-w type="number" min="32" max="2048" value="${Number(anim.cellWidth)||400}"></label>
            <label><span>Célula H</span><input data-animation-h type="number" min="32" max="2048" value="${Number(anim.cellHeight)||400}"></label>
            <label class="tq-ships__check"><input data-animation-loop type="checkbox" ${anim.loop!==false?"checked":""}><span>Loop</span></label>
          </div>
          <div class="tq-ships__frames">
            ${frames.map((frame,index)=>`
              <article class="tq-ship-frame">
                <b>#${index+1}</b>
                <img src="${this.escape(frame.src)}" alt="Frame ${index+1}">
                <small title="${this.escape(frame.src)}">${this.escape(frame.src.split("/").pop())}</small>
                <div><button data-frame-left="${index}" ${index===0?"disabled":""}>←</button><button data-frame-right="${index}" ${index===frames.length-1?"disabled":""}>→</button><button data-frame-remove="${index}">×</button></div>
              </article>`).join("")}
            <button type="button" class="tq-ship-frame tq-ship-frame--add" data-frame-add>＋<small>Adicionar frame</small></button>
          </div>
          <div class="tq-ships__compile">
            <button type="button" class="is-primary" data-atlas-generate ${frames.length?"":"disabled"}>⚙ Gerar atlas WebP</button>
            <button type="button" data-ship-export>⇩ JSON do navio</button>
            <small>O editor trabalha com arquivos individuais. O atlas é gerado por animação para reduzir trocas de textura no runtime.</small>
          </div>`:'<div class="tq-ships__empty">Crie uma animação para adicionar frames.</div>'}
        </section>
      </div>`;

    host.querySelector("[data-ship-name]")?.addEventListener("change",e=>this.updateShip({name:e.currentTarget.value.trim()||ship.name}));
    host.querySelector("[data-ship-type]")?.addEventListener("change",e=>this.updateShip({type:e.currentTarget.value==="npc"?"npc":"player"}));
    host.querySelector("[data-ship-animation]")?.addEventListener("change",e=>{this.animationByShip.set(ship.id,e.currentTarget.value);this.renderEditor()});
    host.querySelector("[data-animation-add]")?.addEventListener("click",()=>{const name=prompt("Nome da animação","combat-fire");if(name)this.addAnimation(name)});
    host.querySelector("[data-animation-delete]")?.addEventListener("click",()=>this.deleteAnimation());
    host.querySelector("[data-animation-ms]")?.addEventListener("change",e=>this.updateAnimation({frameMs:Math.max(40,Number(e.currentTarget.value)||140)}));
    host.querySelector("[data-animation-w]")?.addEventListener("change",e=>this.updateAnimation({cellWidth:Math.max(32,Number(e.currentTarget.value)||400)}));
    host.querySelector("[data-animation-h]")?.addEventListener("change",e=>this.updateAnimation({cellHeight:Math.max(32,Number(e.currentTarget.value)||400)}));
    host.querySelector("[data-animation-loop]")?.addEventListener("change",e=>this.updateAnimation({loop:e.currentTarget.checked}));
    host.querySelector("[data-frame-add]")?.addEventListener("click",()=>this.requestFrameAsset?.({shipId:ship.id,animationKey}));
    host.querySelectorAll("[data-frame-left]").forEach(b=>b.addEventListener("click",()=>this.moveFrame(Number(b.dataset.frameLeft),-1)));
    host.querySelectorAll("[data-frame-right]").forEach(b=>b.addEventListener("click",()=>this.moveFrame(Number(b.dataset.frameRight),1)));
    host.querySelectorAll("[data-frame-remove]").forEach(b=>b.addEventListener("click",()=>this.removeFrame(Number(b.dataset.frameRemove))));
    host.querySelector("[data-atlas-generate]")?.addEventListener("click",()=>this.generateAtlas());
    host.querySelector("[data-ship-export]")?.addEventListener("click",()=>this.exportShipJson());
    this.startPreview();
  }

  async loadImage(src){
    return new Promise((resolve,reject)=>{
      const image=new Image();
      image.onload=()=>resolve(image);
      image.onerror=()=>reject(new Error("Falha ao carregar "+src));
      image.src=src;
    });
  }

  async generateAtlas(){
    const ship=this.current();
    const anim=this.animation();
    const frames=Array.isArray(anim?.frames)?anim.frames:[];
    if(!ship||!anim||!frames.length)return;
    const images=await Promise.all(frames.map(frame=>this.loadImage(frame.src)));
    const cellW=Math.max(32,Number(anim.cellWidth)||400);
    const cellH=Math.max(32,Number(anim.cellHeight)||400);
    const columns=Math.min(4,frames.length);
    const rows=Math.ceil(frames.length/columns);
    const canvas=document.createElement("canvas");
    canvas.width=cellW*columns;canvas.height=cellH*rows;
    const ctx=canvas.getContext("2d");
    ctx.clearRect(0,0,canvas.width,canvas.height);
    images.forEach((image,index)=>{
      const col=index%columns,row=Math.floor(index/columns);
      const scale=Math.min(cellW/image.naturalWidth,cellH/image.naturalHeight);
      const w=image.naturalWidth*scale,h=image.naturalHeight*scale;
      ctx.drawImage(image,col*cellW+(cellW-w)/2,row*cellH+(cellH-h)/2,w,h);
    });
    const animationKey=this.currentAnimationKey(ship);
    const animName=slug(animationKey);
    const fileBase=slug(ship.id)+"_"+animName;
    const descriptor={
      schema:"tq.ship-animation-atlas",
      version:1,
      shipId:ship.id,
      shipType:ship.type,
      animation:animationKey,
      src:"./assets/ships/generated/"+slug(ship.id)+"/"+fileBase+".webp",
      imageWidth:canvas.width,imageHeight:canvas.height,
      frameWidth:cellW,frameHeight:cellH,columns,rows,
      frameCount:frames.length,frameMs:Number(anim.frameMs)||140,loop:anim.loop!==false,
      frames:frames.map((_,index)=>({index,x:(index%columns)*cellW,y:Math.floor(index/columns)*cellH,width:cellW,height:cellH}))
    };
    const blob=await new Promise(resolve=>canvas.toBlob(resolve,"image/webp",.94));
    if(blob)this.downloadBlob(blob,fileBase+".webp");
    this.downloadBlob(new Blob([JSON.stringify(descriptor,null,2)],{type:"application/json"}),fileBase+".atlas.json");
  }

  exportShipJson(){
    const ship=this.current();
    if(!ship)return;
    this.downloadBlob(new Blob([JSON.stringify(ship,null,2)],{type:"application/json"}),slug(ship.id)+".ship.json");
  }

  downloadBlob(blob,name){
    const url=URL.createObjectURL(blob);
    const a=document.createElement("a");a.href=url;a.download=name;document.body.append(a);a.click();a.remove();
    setTimeout(()=>URL.revokeObjectURL(url),0);
  }

  escape(value){
    return String(value??"").replace(/[&<>"']/g,char=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[char]));
  }
}
