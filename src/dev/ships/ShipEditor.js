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
    this.tabByShip=new Map();
    this.previewTimer=0;
    this.storageKey="tq.dev.ship-drafts:v3";
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
    value.schema="tq.ship";
    value.version=2;
    value.type=value.type==="npc"?"npc":"player";
    value.name=String(value.name||value.id||"Navio");
    const profile=(value.type==="npc"?value.npc:value.player)||value.runtime||value.player||value.npc||{};
    value.navigation=value.navigation&&typeof value.navigation==="object"?value.navigation:{};
    value.navigation={
      width:Number(value.navigation.width??profile.width??230),
      height:Number(value.navigation.height??profile.height??230),
      speed:Number(value.navigation.speed??420),
      acceleration:Number(value.navigation.acceleration??1100),
      braking:Number(value.navigation.braking??.12),
      roll:Number(value.navigation.roll??2.4),
      heave:Number(value.navigation.heave??3.2),
      sway:Number(value.navigation.sway??0),
      periodMs:Number(value.navigation.periodMs??3600),
      wake:value.navigation.wake!==false,
      shadow:value.navigation.shadow!==false,
      src:value.navigation.src||profile.src||profile.sprite?.src||"",
      sprite:clone(value.navigation.sprite||profile.sprite||null),
      compiled:clone(value.navigation.compiled||{})
    };
    value.combat=value.combat&&typeof value.combat==="object"?value.combat:{};
    value.combat={
      recoil:Number(value.combat.recoil??18),
      shake:Number(value.combat.shake??5),
      muzzleFlash:value.combat.muzzleFlash!==false,
      smoke:value.combat.smoke!==false,
      impact:value.combat.impact!==false,
      compiled:clone(value.combat.compiled||{})
    };
    value.animations=value.animations&&typeof value.animations==="object"?value.animations:{};
    value.animationGroups=value.animationGroups&&typeof value.animationGroups==="object"?value.animationGroups:{};
    for(const key of Object.keys(value.animations)){
      if(!value.animationGroups[key]){
        value.animationGroups[key]=["fireRight","fireLeft","hit","critical","defeat"].includes(key)?"combat":"navigation";
      }
    }
    if(profile.combatSprite&&!Object.keys(value.animations).some(key=>value.animationGroups[key]==="combat")){
      for(const key of ["fireRight","fireLeft"]){
        const legacy=profile.combatSprite.animations?.[key];
        if(!legacy)continue;
        value.animations[key]={
          frameMs:Number(legacy.frameMs)||135,
          loop:false,
          cellWidth:Number(profile.combatSprite.frameWidth)||400,
          cellHeight:Number(profile.combatSprite.frameHeight)||400,
          frames:[]
        };
        value.animationGroups[key]="combat";
      }
      value.combat.legacySprite=clone(profile.combatSprite);
    }
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
    const ship=this.normalizeShip({
      id,
      name:"Novo navio",
      type:"player",
      available:true,
      animations:{
        idle:{frameMs:140,loop:true,cellWidth:400,cellHeight:400,frames:[]},
        fireRight:{frameMs:135,loop:false,cellWidth:400,cellHeight:400,frames:[]},
        fireLeft:{frameMs:135,loop:false,cellWidth:400,cellHeight:400,frames:[]},
        hit:{frameMs:120,loop:false,cellWidth:400,cellHeight:400,frames:[]},
        critical:{frameMs:160,loop:true,cellWidth:400,cellHeight:400,frames:[]},
        defeat:{frameMs:180,loop:false,cellWidth:400,cellHeight:400,frames:[]}
      },
      animationGroups:{idle:"navigation",fireRight:"combat",fireLeft:"combat",hit:"combat",critical:"combat",defeat:"combat"},
      editor:{draft:true,createdAt:Date.now(),updatedAt:Date.now()}
    });
    this.drafts.push(ship);
    this.save();
    this.selectedId=id;
    this.tabByShip.set(id,"general");
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
    const tab=this.tabByShip.get(ship.id)||"general";
    const group=tab==="combat"?"combat":"navigation";
    const keys=Object.keys(ship.animations||{}).filter(key=>(ship.animationGroups?.[key]||"navigation")===group);
    if(!keys.length)return null;
    let key=this.animationByShip.get(ship.id);
    if(!key||!ship.animations[key]||!keys.includes(key)){
      key=keys.includes("idle")?"idle":keys[0];
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
    ship.animationGroups=ship.animationGroups||{};
    ship.animationGroups[final]=(this.tabByShip.get(ship.id)==="combat"?"combat":"navigation");
    this.animationByShip.set(ship.id,final);
    this.save();this.render();
  }

  deleteAnimation(){
    const ship=this.editableCurrent();
    const key=this.currentAnimationKey(ship);
    if(!ship||!key)return;
    delete ship.animations[key];
    if(ship.animationGroups)delete ship.animationGroups[key];
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
    const tab=this.tabByShip.get(ship.id)||"general";
    host.innerHTML=`
      <div class="tq-ships__tabs">
        <button type="button" data-ship-tab="general" class="${tab==="general"?"is-active":""}">⚙ Geral</button>
        <button type="button" data-ship-tab="navigation" class="${tab==="navigation"?"is-active":""}">🧭 Navegação</button>
        <button type="button" data-ship-tab="combat" class="${tab==="combat"?"is-active":""}">💥 Combate</button>
      </div>
      <div data-ship-v2-content></div>`;
    host.querySelectorAll("[data-ship-tab]").forEach(button=>button.addEventListener("click",()=>{
      this.tabByShip.set(ship.id,button.dataset.shipTab);
      this.renderEditor();
    }));
    const content=host.querySelector("[data-ship-v2-content]");
    if(tab==="general"){
      content.innerHTML=`
        <section class="tq-ships__panel">
          <div class="tq-ships__panel-title"><div><strong>Identidade do navio</strong><small>Uma definição para PLAYER ou NPC.</small></div><span>tq.ship v2</span></div>
          <div class="tq-ships__top">
            <label><span>Nome</span><input data-ship-name value="${this.escape(ship.name)}"></label>
            <label><span>ID</span><input value="${this.escape(ship.id)}" disabled></label>
            <label><span>Tipo</span><select data-ship-type><option value="player" ${ship.type!=="npc"?"selected":""}>Jogador</option><option value="npc" ${ship.type==="npc"?"selected":""}>NPC</option></select></label>
          </div>
          <div class="tq-ships__general-grid">
            <article><b>🧭 Navegação</b><span>${Object.keys(ship.animations||{}).filter(k=>(ship.animationGroups?.[k]||"navigation")==="navigation").length} animações</span><small>${Math.round(ship.navigation.speed)} px/s · ${Math.round(ship.navigation.width)}×${Math.round(ship.navigation.height)}</small></article>
            <article><b>💥 Combate</b><span>${Object.keys(ship.animations||{}).filter(k=>ship.animationGroups?.[k]==="combat").length} animações</span><small>recoil ${Math.round(ship.combat.recoil)} · shake ${Math.round(ship.combat.shake)}</small></article>
          </div>
          <div class="tq-ships__compile"><button type="button" class="is-primary" data-ship-export>⇩ JSON V2</button><small>Movimento e estilo de batalha pertencem ao navio; HP e pedagogia continuam no sistema de combate.</small></div>
        </section>`;
      content.querySelector("[data-ship-name]")?.addEventListener("change",e=>this.updateShip({name:e.currentTarget.value.trim()||ship.name}));
      content.querySelector("[data-ship-type]")?.addEventListener("change",e=>this.updateShip({type:e.currentTarget.value==="npc"?"npc":"player"}));
      content.querySelector("[data-ship-export]")?.addEventListener("click",()=>this.exportShipJson());
      return;
    }

    const section=tab==="combat"?"combat":"navigation";
    const keys=Object.keys(ship.animations||{}).filter(key=>(ship.animationGroups?.[key]||"navigation")===section);
    const animationKey=this.currentAnimationKey(ship);
    const anim=this.animation();
    const frames=Array.isArray(anim?.frames)?anim.frames:[];
    const settings=section==="navigation"?`
      <section class="tq-ships__panel">
        <div class="tq-ships__panel-title"><div><strong>Comportamento de navegação</strong><small>Personalidade física aplicada pelo runtime.</small></div></div>
        <div class="tq-ships__settings tq-ships__settings--v2">
          <label><span>Largura</span><input data-nav-width type="number" min="32" max="800" value="${Math.round(ship.navigation.width)}"></label>
          <label><span>Altura</span><input data-nav-height type="number" min="32" max="800" value="${Math.round(ship.navigation.height)}"></label>
          <label><span>Velocidade</span><input data-nav-speed type="number" min="40" max="1200" value="${Math.round(ship.navigation.speed)}"></label>
          <label><span>Aceleração</span><input data-nav-accel type="number" min="100" max="3000" value="${Math.round(ship.navigation.acceleration)}"></label>
          <label><span>Roll °</span><input data-nav-roll type="number" min="0" max="20" step=".1" value="${ship.navigation.roll}"></label>
          <label><span>Heave px</span><input data-nav-heave type="number" min="0" max="40" step=".1" value="${ship.navigation.heave}"></label>
          <label><span>Sway px</span><input data-nav-sway type="number" min="0" max="40" step=".1" value="${ship.navigation.sway}"></label>
          <label><span>Período ms</span><input data-nav-period type="number" min="500" max="10000" value="${Math.round(ship.navigation.periodMs)}"></label>
          <label class="tq-ships__check"><input data-nav-wake type="checkbox" ${ship.navigation.wake!==false?"checked":""}><span>Esteira</span></label>
          <label class="tq-ships__check"><input data-nav-shadow type="checkbox" ${ship.navigation.shadow!==false?"checked":""}><span>Sombra</span></label>
        </div>
      </section>`:`
      <section class="tq-ships__panel">
        <div class="tq-ships__panel-title"><div><strong>Estilo de batalha</strong><small>Resposta visual do navio durante o duelo.</small></div></div>
        <div class="tq-ships__settings tq-ships__settings--v2">
          <label><span>Recoil px</span><input data-combat-recoil type="number" min="0" max="80" value="${Math.round(ship.combat.recoil)}"></label>
          <label><span>Shake px</span><input data-combat-shake type="number" min="0" max="30" value="${Math.round(ship.combat.shake)}"></label>
          <label class="tq-ships__check"><input data-combat-flash type="checkbox" ${ship.combat.muzzleFlash!==false?"checked":""}><span>Flash</span></label>
          <label class="tq-ships__check"><input data-combat-smoke type="checkbox" ${ship.combat.smoke!==false?"checked":""}><span>Fumaça</span></label>
          <label class="tq-ships__check"><input data-combat-impact type="checkbox" ${ship.combat.impact!==false?"checked":""}><span>Impacto</span></label>
        </div>
        <div class="tq-ships__combat-flow"><span>idle</span><b>→</b><span>fireLeft / fireRight</span><b>→</b><span>hit / critical</span><b>→</b><span>defeat</span></div>
      </section>`;

    content.innerHTML=settings+`
      <section class="tq-ships__animation tq-ships__animation--v2">
        <div class="tq-ships__workspace tq-ships__workspace--v2">
          <section class="tq-ships__preview">
            <div class="tq-ships__preview-stage">${frames.length?'<img data-ship-preview alt="Preview do navio">':'<div class="tq-ships__preview-empty"><b>Sem frames</b><small>Adicione frames para esta animação.</small></div>'}</div>
            <small>Preview · ${this.escape(animationKey||"sem animação")}</small>
          </section>
          <section>
            <div class="tq-ships__animation-head">
              <label><span>Animação</span><select data-ship-animation>${keys.map(key=>'<option value="'+this.escape(key)+'" '+(key===animationKey?'selected':'')+'>'+this.escape(key)+'</option>').join("")}</select></label>
              <button type="button" data-animation-add>＋ Animação</button>
              <button type="button" data-animation-delete ${!animationKey||animationKey==="idle"?"disabled":""}>Excluir</button>
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
                  <b>#${index+1}</b><img src="${this.escape(frame.src)}" alt="Frame ${index+1}">
                  <small title="${this.escape(frame.src)}">${this.escape(frame.src.split("/").pop())}</small>
                  <div><button data-frame-left="${index}" ${index===0?"disabled":""}>←</button><button data-frame-right="${index}" ${index===frames.length-1?"disabled":""}>→</button><button data-frame-remove="${index}">×</button></div>
                </article>`).join("")}
              <button type="button" class="tq-ship-frame tq-ship-frame--add" data-frame-add>＋<small>Adicionar frame</small></button>
            </div>
            <div class="tq-ships__compile"><button type="button" class="is-primary" data-atlas-generate ${frames.length?"":"disabled"}>⚙ Gerar atlas WebP</button><button type="button" data-ship-export>⇩ JSON V2</button><small>Editor frame a frame; runtime em atlas.</small></div>`:'<div class="tq-ships__empty">Crie uma animação para adicionar frames.</div>'}
          </section>
        </div>
      </section>`;

    if(section==="navigation"){
      const read=()=>({
        navigation:{...ship.navigation,
          width:Math.max(32,Number(content.querySelector("[data-nav-width]")?.value)||230),
          height:Math.max(32,Number(content.querySelector("[data-nav-height]")?.value)||230),
          speed:Math.max(40,Number(content.querySelector("[data-nav-speed]")?.value)||420),
          acceleration:Math.max(100,Number(content.querySelector("[data-nav-accel]")?.value)||1100),
          roll:Math.max(0,Number(content.querySelector("[data-nav-roll]")?.value)||0),
          heave:Math.max(0,Number(content.querySelector("[data-nav-heave]")?.value)||0),
          sway:Math.max(0,Number(content.querySelector("[data-nav-sway]")?.value)||0),
          periodMs:Math.max(500,Number(content.querySelector("[data-nav-period]")?.value)||3600),
          wake:content.querySelector("[data-nav-wake]")?.checked!==false,
          shadow:content.querySelector("[data-nav-shadow]")?.checked!==false
        }
      });
      content.querySelectorAll("[data-nav-width],[data-nav-height],[data-nav-speed],[data-nav-accel],[data-nav-roll],[data-nav-heave],[data-nav-sway],[data-nav-period],[data-nav-wake],[data-nav-shadow]").forEach(el=>el.addEventListener("change",()=>this.updateShip(read())));
    }else{
      const read=()=>({combat:{...ship.combat,
        recoil:Math.max(0,Number(content.querySelector("[data-combat-recoil]")?.value)||0),
        shake:Math.max(0,Number(content.querySelector("[data-combat-shake]")?.value)||0),
        muzzleFlash:content.querySelector("[data-combat-flash]")?.checked!==false,
        smoke:content.querySelector("[data-combat-smoke]")?.checked!==false,
        impact:content.querySelector("[data-combat-impact]")?.checked!==false
      }});
      content.querySelectorAll("[data-combat-recoil],[data-combat-shake],[data-combat-flash],[data-combat-smoke],[data-combat-impact]").forEach(el=>el.addEventListener("change",()=>this.updateShip(read())));
    }
    content.querySelector("[data-ship-animation]")?.addEventListener("change",e=>{this.animationByShip.set(ship.id,e.currentTarget.value);this.renderEditor()});
    content.querySelector("[data-animation-add]")?.addEventListener("click",()=>{const name=prompt("Nome da animação",section==="combat"?"fireRight":"idle");if(name)this.addAnimation(name)});
    content.querySelector("[data-animation-delete]")?.addEventListener("click",()=>this.deleteAnimation());
    content.querySelector("[data-animation-ms]")?.addEventListener("change",e=>this.updateAnimation({frameMs:Math.max(40,Number(e.currentTarget.value)||140)}));
    content.querySelector("[data-animation-w]")?.addEventListener("change",e=>this.updateAnimation({cellWidth:Math.max(32,Number(e.currentTarget.value)||400)}));
    content.querySelector("[data-animation-h]")?.addEventListener("change",e=>this.updateAnimation({cellHeight:Math.max(32,Number(e.currentTarget.value)||400)}));
    content.querySelector("[data-animation-loop]")?.addEventListener("change",e=>this.updateAnimation({loop:e.currentTarget.checked}));
    content.querySelector("[data-frame-add]")?.addEventListener("click",()=>this.requestFrameAsset?.({shipId:ship.id,animationKey,section}));
    content.querySelectorAll("[data-frame-left]").forEach(b=>b.addEventListener("click",()=>this.moveFrame(Number(b.dataset.frameLeft),-1)));
    content.querySelectorAll("[data-frame-right]").forEach(b=>b.addEventListener("click",()=>this.moveFrame(Number(b.dataset.frameRight),1)));
    content.querySelectorAll("[data-frame-remove]").forEach(b=>b.addEventListener("click",()=>this.removeFrame(Number(b.dataset.frameRemove))));
    content.querySelector("[data-atlas-generate]")?.addEventListener("click",()=>this.generateAtlas());
    content.querySelector("[data-ship-export]")?.addEventListener("click",()=>this.exportShipJson());
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
    const section=ship.animationGroups?.[animationKey]==="combat"?"combat":"navigation";
    const animName=slug(animationKey);
    const fileBase=slug(ship.id)+"_"+section+"_"+animName;
    const descriptor={
      schema:"tq.ship-animation-atlas",
      version:2,
      shipId:ship.id,
      shipType:ship.type,
      section,
      animation:animationKey,
      src:"./assets/ships/generated/"+slug(ship.id)+"/"+fileBase+".webp",
      imageWidth:canvas.width,imageHeight:canvas.height,
      frameWidth:cellW,frameHeight:cellH,columns,rows,
      frameCount:frames.length,frameMs:Number(anim.frameMs)||140,loop:anim.loop!==false,
      frames:frames.map((_,index)=>({index,x:(index%columns)*cellW,y:Math.floor(index/columns)*cellH,width:cellW,height:cellH}))
    };
    const draft=this.editableCurrent();
    draft[section].compiled=draft[section].compiled||{};
    draft[section].compiled[animationKey]=clone(descriptor);
    this.save();
    const blob=await new Promise(resolve=>canvas.toBlob(resolve,"image/webp",.94));
    if(blob)this.downloadBlob(blob,fileBase+".webp");
    this.downloadBlob(new Blob([JSON.stringify(descriptor,null,2)],{type:"application/json"}),fileBase+".atlas.json");
  }

  exportShipJson(){
    const ship=this.current();
    if(!ship)return;
    const output=this.normalizeShip(ship);
    const navAnimations={},combatAnimations={};
    for(const [key,animation] of Object.entries(output.animations||{})){
      if(output.animationGroups?.[key]==="combat")combatAnimations[key]=clone(animation);
      else navAnimations[key]=clone(animation);
    }
    output.navigation={...output.navigation,animations:navAnimations};
    output.combat={...output.combat,animations:combatAnimations};
    delete output.animations;
    delete output.animationGroups;
    delete output.player;
    delete output.npc;
    delete output.runtime;
    this.downloadBlob(new Blob([JSON.stringify(output,null,2)],{type:"application/json"}),slug(output.id)+".ship.json");
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
