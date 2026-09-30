import { WorldEditor } from "./world/WorldEditor.js?v=20260930-1318";
export class DevOverlay {
  constructor(root,runtime,options={}){
    this.root=root;this.runtime=runtime;this.mode="edit";this.selected=null;this.linkScale=true;this.areaEditSession=null;
    this.assetTree=null;this.assetDirectoryPath="assets";this.assetNodeIndex=new Map();this.assetByPath=new Map();this.assetPickTarget=null;
    this.sceneResolver=options.sceneResolver||null;this.sceneCatalog=null;this.localScenes=[];
    this.workspace="scene";this.worldCatalog=null;this.localWorlds=[];this.worldEditor=new WorldEditor(this.runtime.root,{sceneRuntime:this.runtime});this.sceneBeforeWorld=null;this.worldSceneBackButton=null;
    this.localSceneStorageKey="tq.dev.local-scenes:v1";this.localWorldStorageKey="tq.dev.local-worlds:v1";this.sceneGroupStorageKey="tq.dev.scene-groups:v1";
    try{this.sceneGroupOpen=new Set(JSON.parse(sessionStorage.getItem(this.sceneGroupStorageKey)||"[]"))}catch{this.sceneGroupOpen=new Set()}
  }
  mount(){
    this.el=document.createElement("aside");this.el.className="tq-dev";
    this.el.innerHTML=`
      <div class="tq-dev__bar" role="toolbar" aria-label="Ferramentas DEV">
        <button data-drag class="tq-dev__drag" aria-label="Arrastar ferramentas" title="Arrastar">⠿</button>
        <button data-mode="edit" class="active">✥ <span>Editar</span></button>
        <button data-mode="config">⚙ <span>Config</span></button>
        <button data-mode="play">▶ <span>Play</span></button>
        <button data-export>⇩ <span>JSON</span></button>
        <button data-mold>▣ <span>Molde</span></button>
        <button data-scenes>☷ <span>Cenas</span></button>
        <button data-worlds>🌊 <span>Mundos</span></button>
        <button data-assets>▦ <span>Assets</span></button>
        <button data-collapse aria-label="Recolher ferramentas" title="Recolher">‹</button>
      </div>
      <section class="tq-dev__scenes" hidden>
        <header><div><strong>Cenas</strong><small>Cenas criadas, agrupadas por tela lógica</small></div><button data-scenes-close aria-label="Fechar">×</button></header>
        <div class="tq-scenes__body">
          <div data-scenes-list></div>
          <button type="button" class="tq-scenes__create-open" data-scene-create-open>＋ Criar nova cena</button>
          <form class="tq-scenes__create" data-scene-create-form hidden>
            <strong>Criar nova cena</strong>
            <label><span>Tela lógica</span><select data-scene-screen></select></label>
            <label><span>Contexto</span><select data-scene-context><option value="default">DEFAULT</option><option value="event">EVENTO</option></select></label>
            <label data-scene-event-field hidden><span>Evento</span><select data-scene-event></select></label>
            <label><span>Nome</span><input data-scene-name type="text" autocomplete="off"></label>
            <div class="tq-scenes__create-error" data-scene-create-error hidden></div>
            <div class="tq-scenes__create-actions"><button type="button" data-scene-create-cancel>Cancelar</button><button type="submit" class="is-primary">Criar cena</button></div>
          </form>
        </div>
      </section>
      <section class="tq-dev__worlds" hidden>
        <header><div><strong>Mundos</strong><small>Oceanos e áreas navegáveis</small></div><button data-worlds-close aria-label="Fechar">×</button></header>
        <div class="tq-worlds__body">
          <div class="tq-world-list" data-worlds-list></div>
          <button type="button" class="tq-worlds__create-open" data-world-create-open>＋ Criar novo oceano</button>
          <form class="tq-worlds__create" data-world-create-form hidden>
            <strong>Criar novo oceano</strong>
            <label><span>Nome</span><input data-world-create-name type="text" value="Oceano Inicial" autocomplete="off"></label>
            <label><span>ID</span><input data-world-create-id type="text" value="oceano-inicial" autocomplete="off"></label>
            <div class="tq-worlds__create-grid">
              <label><span>Largura</span><input data-world-create-width type="number" min="800" max="20000" value="3000"></label>
              <label><span>Altura</span><input data-world-create-height type="number" min="1000" max="20000" value="4000"></label>
            </div>
            <label><span>Fundo do oceano</span><select data-world-create-background></select></label>
            <label><span>Movimento inicial</span><select data-world-create-preset><option value="calm">Calmo</option><option value="adventure" selected>Aventura</option><option value="storm">Tempestade</option></select></label>
            <div class="tq-scenes__create-error" data-world-create-error hidden></div>
            <div class="tq-scenes__create-actions"><button type="button" data-world-create-cancel>Cancelar</button><button type="submit" class="is-primary">Criar oceano</button></div>
          </form>
          <div class="tq-worlds__actions" data-worlds-actions></div>
          <div class="tq-worlds__hint">Crie oceanos, ajuste o movimento da água em Config → Oceano, adicione entidades por Assets e teste tudo no Play.</div>
        </div>
      </section>
      <section class="tq-dev__assets" hidden>
        <header><div><strong>Assets</strong><small data-assets-path>assets</small></div><button data-assets-close aria-label="Fechar">×</button></header>
        <div class="tq-assets__nav">
          <button type="button" data-asset-up aria-label="Pasta anterior" title="Pasta anterior">↑</button>
          <nav class="tq-assets__breadcrumbs" data-assets-breadcrumbs aria-label="Caminho de assets"></nav>
        </div>
        <div class="tq-assets__filters"><input data-asset-search type="search" placeholder="Buscar em /assets..."></div>
        <div class="tq-assets__grid" data-assets-grid></div>
      </section>
      <section class="tq-dev__panel" hidden>
        <header><div><strong>Config</strong><small data-node-title>Nenhum nó</small></div><button data-close aria-label="Fechar">×</button></header>
        <div class="tq-dev__content"><div class="tq-dev__empty">Selecione um nó para configurar.</div></div>
      </section>`;
    this.root.append(this.el);
    this.el.querySelectorAll("[data-mode]").forEach(b=>b.addEventListener("click",()=>this.setMode(b.dataset.mode)));
    this.el.querySelector("[data-close]").addEventListener("click",()=>this.setMode("edit"));
    this.el.querySelector("[data-export]").addEventListener("click",()=>this.exportScene());
    this.el.querySelector("[data-mold]").addEventListener("click",()=>this.toggleMold());
    this.el.querySelector("[data-scenes]").addEventListener("click",()=>this.toggleScenes(true));
    this.el.querySelector("[data-scenes-close]").addEventListener("click",()=>this.toggleScenes(false));
    this.el.querySelector("[data-worlds]").addEventListener("click",()=>this.toggleWorlds(true));
    this.el.querySelector("[data-worlds-close]").addEventListener("click",()=>this.toggleWorlds(false));
    this.el.querySelector("[data-world-create-open]").addEventListener("click",()=>this.showCreateWorldForm(true));
    this.el.querySelector("[data-world-create-cancel]").addEventListener("click",()=>this.showCreateWorldForm(false));
    this.el.querySelector("[data-world-create-form]").addEventListener("submit",event=>{event.preventDefault();this.createWorldFromForm()});
    this.el.querySelector("[data-world-create-name]").addEventListener("input",event=>{
      const id=this.el.querySelector("[data-world-create-id]");
      if(id?.dataset.manual!=="true")id.value=this.slugifyWorldId(event.currentTarget.value);
    });
    this.el.querySelector("[data-world-create-id]").addEventListener("input",event=>{event.currentTarget.dataset.manual="true"});
    this.el.querySelector("[data-scene-create-open]").addEventListener("click",()=>this.showCreateSceneForm(true));
    this.el.querySelector("[data-scene-create-cancel]").addEventListener("click",()=>this.showCreateSceneForm(false));
    this.el.querySelector("[data-scene-create-form]").addEventListener("submit",event=>{event.preventDefault();this.createSceneFromForm()});
    this.el.querySelector("[data-scene-screen]").addEventListener("change",()=>this.syncCreateSceneForm());
    this.el.querySelector("[data-scene-context]").addEventListener("change",()=>this.syncCreateSceneForm());
    this.el.querySelector("[data-scene-event]").addEventListener("change",()=>this.syncCreateSceneForm());
    this.el.querySelector("[data-scene-name]").addEventListener("input",event=>{event.currentTarget.dataset.manual="true"});
    this.el.querySelector("[data-assets]").addEventListener("click",()=>this.toggleAssets(true));
    this.el.querySelector("[data-assets-close]").addEventListener("click",()=>this.toggleAssets(false));
    this.el.querySelector("[data-asset-search]").addEventListener("input",()=>this.renderAssets());
    this.el.querySelector("[data-asset-up]").addEventListener("click",()=>this.navigateAssetDirectory(this.parentAssetPath(this.assetDirectoryPath)));
    this.loadAssets();
    this.loadCompositionTypes();
    this.loadSceneCatalog();
    this.loadWorldCatalog();
    this.mountMold();
    this.enableToolbarDrag();
    this.el.querySelector("[data-collapse]").addEventListener("click",()=>this.toggleCollapse());
    window.addEventListener("tq:selectionchange",e=>{this.selected=e.detail.node||null;this.renderInspector();});
    window.addEventListener("tq:nodechange",e=>{const node=e.detail?.node;if(node&&this.selected?.id===node.id){this.selected=node;this.syncInspector();}});
    window.addEventListener("tq:sceneload",()=>{if(this.workspace!=="world"){this.selected=null;this.renderScenes()}});
    window.addEventListener("tq:worldselectionchange",e=>{
      if(this.workspace!=="world")return;
      this.selected=e.detail?.entity||null;
      if(this.mode==="config")this.renderInspector();
    });
    window.addEventListener("tq:worldentitychange",e=>{
      if(this.workspace!=="world")return;
      const entity=e.detail?.entity;
      if(entity&&this.selected?.id===entity.id)this.selected=entity;
      if(e.detail?.commit){
        this.syncLocalWorldFromEditor();
        if(this.mode==="config")this.renderWorldInspector();
      }
      this.renderWorlds();
    });
    window.addEventListener("tq:worldchange",()=>{
      if(this.workspace!=="world")return;
      this.syncLocalWorldFromEditor();
      if(this.mode==="config"&&!this.selected)this.renderWorldInspector();
      this.renderWorlds();
    });
  }

  loadLocalScenes(){
    try{
      const value=JSON.parse(localStorage.getItem(this.localSceneStorageKey)||"[]");
      this.localScenes=Array.isArray(value)?value.filter(item=>item?.entry?.id&&item?.scene?.id):[];
    }catch{
      this.localScenes=[];
    }
    return this.localScenes;
  }

  saveLocalScenes(){
    try{localStorage.setItem(this.localSceneStorageKey,JSON.stringify(this.localScenes))}catch(error){console.warn("DEV local scenes save failed",error)}
  }

  async loadSceneCatalog(){
    try{
      if(this.sceneResolver?.catalog)this.sceneCatalog=structuredClone(this.sceneResolver.catalog);
      else{
        const response=await fetch("./src/config/scene-catalog.json?v=20260930-1318",{cache:"no-store"});
        if(!response.ok)throw new Error("HTTP "+response.status);
        this.sceneCatalog=await response.json();
      }
      this.loadLocalScenes();
      const current=this.runtime.scene?.id;
      const currentEntry=this.allSceneEntries().find(scene=>scene.id===current);
      if(currentEntry&&!this.sceneGroupOpen.size)this.sceneGroupOpen.add(currentEntry.screenId);
      this.renderScenes();
    }catch(error){
      console.warn("Scene catalog load failed",error);
      const list=this.el?.querySelector("[data-scenes-list]");
      if(list)list.innerHTML='<div class="tq-scenes__empty">Falha ao carregar o catálogo de cenas.</div>';
    }
  }

  allSceneEntries(){
    const repositoryScenes=Array.isArray(this.sceneCatalog?.scenes)?this.sceneCatalog.scenes:[];
    const entries=[...repositoryScenes];
    for(const item of this.localScenes){
      const local=item.entry;
      const alreadyPublished=repositoryScenes.some(scene =>
        scene.id===local.id ||
        (scene.screenId===local.screenId&&scene.context===local.context&&(local.context!=="event"||scene.eventId===local.eventId))
      );
      if(!alreadyPublished)entries.push(local);
    }
    return entries;
  }

  sceneScreen(screenId){
    return (this.sceneCatalog?.screens||[]).find(screen=>screen.id===screenId)||{id:screenId,label:screenId};
  }

  sceneEvent(eventId){
    return (this.sceneCatalog?.events||[]).find(event=>event.id===eventId)||{id:eventId,label:eventId};
  }

  saveSceneGroupState(){
    try{sessionStorage.setItem(this.sceneGroupStorageKey,JSON.stringify([...this.sceneGroupOpen]))}catch{}
  }

  toggleSceneGroup(screenId){
    if(this.sceneGroupOpen.has(screenId))this.sceneGroupOpen.delete(screenId);else this.sceneGroupOpen.add(screenId);
    this.saveSceneGroupState();
    this.renderScenes();
  }

  renderScenes(){
    const list=this.el?.querySelector("[data-scenes-list]");
    if(!list||!this.sceneCatalog)return;
    const entries=this.allSceneEntries();
    const currentId=this.runtime.scene?.id||"";
    const screenIds=[...new Set(entries.map(scene=>scene.screenId))];
    const screens=screenIds.map(id=>this.sceneScreen(id)).sort((a,b)=>String(a.label).localeCompare(String(b.label),"pt-BR"));

    list.innerHTML=screens.length?screens.map(screen=>{
      const scenes=entries.filter(scene=>scene.screenId===screen.id).sort((a,b)=>{
        if(a.context!==b.context)return a.context==="default"?-1:1;
        return String(a.name||a.id).localeCompare(String(b.name||b.id),"pt-BR");
      });
      const open=this.sceneGroupOpen.has(screen.id);
      const items=open?'<div class="tq-scene-group__items">'+scenes.map(scene=>{
        const context=scene.context==="event"?"EVENTO · "+this.sceneEvent(scene.eventId).label:"DEFAULT";
        return '<button type="button" class="tq-scene-item '+(scene.id===currentId?'is-current':'')+'" data-scene-open="'+this.escapeHtml(scene.id)+'"><span>'+this.escapeHtml(scene.name||scene.id)+'</span><small>'+this.escapeHtml(context)+'</small></button>';
      }).join("")+'</div>':"";
      return '<section class="tq-scene-group"><button type="button" class="tq-scene-group__head" data-scene-group="'+this.escapeHtml(screen.id)+'" aria-expanded="'+open+'"><span>'+(open?'▾':'▸')+' '+this.escapeHtml(screen.label)+'</span><b>'+scenes.length+'</b></button>'+items+'</section>';
    }).join(""):'<div class="tq-scenes__empty">Nenhuma cena criada.</div>';

    list.querySelectorAll("[data-scene-group]").forEach(button=>button.addEventListener("click",()=>this.toggleSceneGroup(button.dataset.sceneGroup)));
    list.querySelectorAll("[data-scene-open]").forEach(button=>button.addEventListener("click",()=>this.openScene(button.dataset.sceneOpen)));
  }

  toggleScenes(show){
    const panel=this.el.querySelector(".tq-dev__scenes");
    panel.hidden=!show;
    if(show){
      this.el.querySelector(".tq-dev__assets").hidden=true;
      this.el.querySelector(".tq-dev__panel").hidden=true;
      this.el.querySelector(".tq-dev__worlds").hidden=true;
      this.renderScenes();
    }
  }

  showCreateSceneForm(show){
    const form=this.el.querySelector("[data-scene-create-form]");
    const opener=this.el.querySelector("[data-scene-create-open]");
    form.hidden=!show;opener.hidden=show;
    const error=this.el.querySelector("[data-scene-create-error]");
    error.hidden=true;error.textContent="";
    if(!show)return;

    const screenSelect=this.el.querySelector("[data-scene-screen]");
    const eventSelect=this.el.querySelector("[data-scene-event]");
    screenSelect.innerHTML=(this.sceneCatalog?.screens||[]).map(screen=>'<option value="'+this.escapeHtml(screen.id)+'">'+this.escapeHtml(screen.label)+'</option>').join("");
    eventSelect.innerHTML=(this.sceneCatalog?.events||[]).map(event=>'<option value="'+this.escapeHtml(event.id)+'">'+this.escapeHtml(event.label)+'</option>').join("");
    const name=this.el.querySelector("[data-scene-name]");
    name.dataset.manual="false";
    this.syncCreateSceneForm();
  }

  syncCreateSceneForm(){
    const screenId=this.el.querySelector("[data-scene-screen]")?.value||"";
    const context=this.el.querySelector("[data-scene-context]")?.value||"default";
    const eventSelect=this.el.querySelector("[data-scene-event]");
    const eventField=this.el.querySelector("[data-scene-event-field]");
    const name=this.el.querySelector("[data-scene-name]");
    eventField.hidden=context!=="event";
    const screen=this.sceneScreen(screenId);
    const event=context==="event"?this.sceneEvent(eventSelect?.value):null;
    if(name?.dataset.manual!=="true")name.value=context==="event"?screen.label+" "+(event?.label||"Evento"):screen.label+" DEFAULT";
  }

  sceneCombinationExists(screenId,context,eventId){
    return this.allSceneEntries().find(scene=>scene.screenId===screenId&&scene.context===context&&(context!=="event"||scene.eventId===eventId))||null;
  }

  async createSceneFromForm(){
    const screenId=this.el.querySelector("[data-scene-screen]")?.value||"";
    const context=this.el.querySelector("[data-scene-context]")?.value||"default";
    const eventId=context==="event"?(this.el.querySelector("[data-scene-event]")?.value||""):null;
    const name=(this.el.querySelector("[data-scene-name]")?.value||"").trim();
    const error=this.el.querySelector("[data-scene-create-error]");

    if(!screenId||!name||(context==="event"&&!eventId)){
      error.textContent="Preencha a tela lógica, o contexto e o nome.";
      error.hidden=false;
      return;
    }

    const existing=this.sceneCombinationExists(screenId,context,eventId);
    if(existing){
      error.innerHTML='Já existe uma cena para esta combinação. <button type="button" data-open-existing>Abrir cena existente</button>';
      error.hidden=false;
      error.querySelector("[data-open-existing]")?.addEventListener("click",()=>this.openScene(existing.id));
      return;
    }

    const id=context==="event"?screenId+"."+eventId:screenId+".default";
    const revision="local-"+Date.now();
    const scene={
      schema:"tq.scene",
      version:1,
      id,
      name,
      screenId,
      context,
      eventId,
      reference:{...this.runtime.reference},
      root:{id:"viewport",kind:"viewport",canonical:true},
      nodes:[],
      meta:{schema:"tq.scene",version:1,sourceRevision:revision,createdFrom:"tabuada-quest-dev"}
    };
    const entry={id,name,screenId,context,eventId,path:null,local:true};
    this.localScenes.push({entry,scene});
    this.saveLocalScenes();
    this.sceneGroupOpen.add(screenId);
    this.saveSceneGroupState();
    this.runtime.loadScene(scene);
    this.selected=null;
    this.showCreateSceneForm(false);
    this.toggleScenes(false);
    this.setMode("edit");
  }

  async openScene(id){
    if(this.workspace==="world"||this.workspace==="scene-linked"){
      this.exitWorldWorkspace({restoreScene:false});
    }
    const local=this.localScenes.find(item=>item.entry.id===id);
    const entry=this.allSceneEntries().find(scene=>scene.id===id);
    if(!entry)return;

    try{
      if(local)this.runtime.loadScene(local.scene);
      else if(entry.path)await this.runtime.load(entry.path);
      else return;
      this.sceneGroupOpen.add(entry.screenId);
      this.saveSceneGroupState();
      this.selected=null;
      this.toggleScenes(false);
      this.setMode("edit");
      this.renderScenes();
    }catch(error){
      console.error("Scene open failed",error);
      const list=this.el.querySelector("[data-scenes-list]");
      if(list)list.insertAdjacentHTML("afterbegin",'<div class="tq-scenes__error">Falha ao abrir a cena.</div>');
    }
  }

  loadLocalWorlds(){
    try{
      const value=JSON.parse(localStorage.getItem(this.localWorldStorageKey)||"[]");
      this.localWorlds=Array.isArray(value)?value.filter(item=>item?.entry?.id&&item?.world?.id):[];
    }catch{
      this.localWorlds=[];
    }
    return this.localWorlds;
  }

  saveLocalWorlds(){
    try{localStorage.setItem(this.localWorldStorageKey,JSON.stringify(this.localWorlds))}catch(error){console.warn("DEV local worlds save failed",error)}
  }

  allWorldEntries(){
    const repository=Array.isArray(this.worldCatalog?.worlds)?this.worldCatalog.worlds:[];
    const entries=[...repository];
    for(const item of this.localWorlds){
      if(!repository.some(world=>world.id===item.entry.id))entries.push(item.entry);
    }
    return entries;
  }

  syncLocalWorldFromEditor(){
    const id=this.worldEditor?.entry?.id;
    if(!id||!this.worldEditor?.entry?.local)return;
    const item=this.localWorlds.find(entry=>entry.entry.id===id);
    const world=this.worldEditor.getWorld();
    if(item&&world){
      item.world=structuredClone(world);
      item.entry.name=world.name||item.entry.name;
      this.saveLocalWorlds();
    }
  }

  slugifyWorldId(value){
    return String(value||"")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g,"")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g,"-")
      .replace(/^-+|-+$/g,"")
      .slice(0,64)||"oceano";
  }

  async loadWorldCatalog(){
    try{
      const response=await fetch("./src/config/world-catalog.json?v=20260930-1318",{cache:"no-store"});
      if(!response.ok)throw new Error("HTTP "+response.status);
      this.worldCatalog=await response.json();
    }catch(error){
      console.warn("World catalog load failed",error);
      this.worldCatalog={schema:"tq.world-catalog",version:1,worlds:[]};
    }
    this.loadLocalWorlds();
    this.renderWorlds();
  }

  worldBackgroundOptions(selected=""){
    const backgrounds=(this.assetCatalog||[]).filter(asset=>String(asset.path||"").startsWith("assets/backgrounds/"));
    const preferred=["assets/backgrounds/scene-ocean.webp",...backgrounds.map(asset=>asset.path)];
    const unique=[...new Set(preferred)];
    return unique.map(path=>{
      const value="./"+path;
      const label=path.split("/").pop();
      return '<option value="'+this.escapeHtml(value)+'" '+(value===selected?'selected':'')+'>'+this.escapeHtml(label)+'</option>';
    }).join("");
  }

  renderWorlds(){
    const list=this.el?.querySelector("[data-worlds-list]");
    const actions=this.el?.querySelector("[data-worlds-actions]");
    if(!list||!actions)return;
    const worlds=this.allWorldEntries();
    const current=this.worldEditor?.entry?.id||"";

    list.innerHTML=worlds.length?worlds.map(world=>
      '<button type="button" class="tq-world-item '+(world.id===current?'is-current':'')+'" data-world-open="'+this.escapeHtml(world.id)+'">'+
        '<span><b>'+this.escapeHtml(world.name||world.id)+'</b><small>'+this.escapeHtml(world.type||"ocean")+' · '+this.escapeHtml(world.id)+(world.local?' · LOCAL':'')+'</small></span>'+
        '<strong>'+(world.id===current?'ABERTO':'EDITAR')+'</strong>'+
      '</button>'
    ).join(""):'<div class="tq-scenes__empty">Nenhum mundo cadastrado.</div>';

    list.querySelectorAll("[data-world-open]").forEach(button=>button.addEventListener("click",()=>this.openWorld(button.dataset.worldOpen)));

    actions.innerHTML=this.worldEditor?.active
      ? '<button type="button" data-world-ocean-config>⚙ Oceano</button><button type="button" data-world-export>⇩ JSON</button><button type="button" data-world-exit>← Cenas</button>'
      : '';

    actions.querySelector("[data-world-ocean-config]")?.addEventListener("click",()=>{
      this.worldEditor.selectEntity(null);
      this.selected=null;
      this.setMode("config");
    });
    actions.querySelector("[data-world-export]")?.addEventListener("click",()=>this.worldEditor.exportWorld());
    actions.querySelector("[data-world-exit]")?.addEventListener("click",()=>this.exitWorldWorkspace({restoreScene:true}));
  }

  toggleWorlds(show){
    const panel=this.el.querySelector(".tq-dev__worlds");
    panel.hidden=!show;
    if(show){
      this.el.querySelector(".tq-dev__assets").hidden=true;
      this.el.querySelector(".tq-dev__scenes").hidden=true;
      this.el.querySelector(".tq-dev__panel").hidden=true;
      this.renderWorlds();
      if(!this.el.querySelector("[data-world-create-form]").hidden)this.populateCreateWorldBackgrounds();
    }
  }

  populateCreateWorldBackgrounds(){
    const select=this.el.querySelector("[data-world-create-background]");
    if(!select)return;
    const current=select.value||"./assets/backgrounds/scene-ocean.webp";
    select.innerHTML=this.worldBackgroundOptions(current);
    if([...select.options].some(option=>option.value===current))select.value=current;
  }

  showCreateWorldForm(show){
    const form=this.el.querySelector("[data-world-create-form]");
    const opener=this.el.querySelector("[data-world-create-open]");
    form.hidden=!show;
    opener.hidden=show;
    const error=this.el.querySelector("[data-world-create-error]");
    error.hidden=true;
    error.textContent="";
    if(!show)return;
    const name=this.el.querySelector("[data-world-create-name]");
    const id=this.el.querySelector("[data-world-create-id]");
    id.dataset.manual="false";
    if(!name.value)name.value="Oceano Inicial";
    id.value=this.slugifyWorldId(name.value);
    this.populateCreateWorldBackgrounds();
  }

  async createWorldFromForm(){
    const name=(this.el.querySelector("[data-world-create-name]")?.value||"").trim();
    const id=this.slugifyWorldId(this.el.querySelector("[data-world-create-id]")?.value||name);
    const width=Math.max(800,Math.min(20000,Number(this.el.querySelector("[data-world-create-width]")?.value)||3000));
    const height=Math.max(1000,Math.min(20000,Number(this.el.querySelector("[data-world-create-height]")?.value)||4000));
    const background=this.el.querySelector("[data-world-create-background]")?.value||"./assets/backgrounds/scene-ocean.webp";
    const preset=this.el.querySelector("[data-world-create-preset]")?.value||"adventure";
    const error=this.el.querySelector("[data-world-create-error]");

    if(!name||!id){
      error.textContent="Informe um nome e um ID para o oceano.";
      error.hidden=false;
      return;
    }
    if(this.allWorldEntries().some(world=>world.id===id)){
      error.textContent="Já existe um mundo com este ID.";
      error.hidden=false;
      return;
    }

    const presetDefaults={
      calm:{speed:12,directionX:.55,directionY:.18,swell:12,tileSize:760,brightness:100,saturation:95},
      adventure:{speed:28,directionX:.82,directionY:.32,swell:28,tileSize:720,brightness:102,saturation:105},
      storm:{speed:56,directionX:1,directionY:.62,swell:62,tileSize:660,brightness:88,saturation:82}
    }[preset];

    const revision="local-"+Date.now();
    const world={
      schema:"tq.world",
      version:1,
      id,
      name,
      type:"ocean",
      width,
      height,
      player:{
        x:width/2,
        y:Math.max(120,height-420),
        src:"./assets/ships/events/halloween/navio_pirata_halloween_tabuada.webp"
      },
      ocean:{active:true,background,preset,...presetDefaults},
      entities:[],
      editor:{cameraX:width/2,cameraY:height/2,zoom:.55},
      meta:{schema:"tq.world",version:1,sourceRevision:revision,editorVersion:1,createdFrom:"tabuada-quest-dev"}
    };
    const entry={id,name,type:"ocean",path:null,local:true};
    this.localWorlds.push({entry,world});
    this.saveLocalWorlds();

    if(this.workspace==="scene"&&!this.sceneBeforeWorld)this.sceneBeforeWorld=structuredClone(this.runtime.scene||null);
    await this.worldEditor.openLocal(entry,world);
    this.workspace="world";
    this.selected=null;
    if(this.mold)this.mold.hidden=true;
    this.showCreateWorldForm(false);
    this.toggleWorlds(false);
    this.setMode("edit");
    this.renderWorlds();
  }

  async openWorld(id){
    const entry=this.allWorldEntries().find(world=>world.id===id);
    if(!entry)return;
    try{
      if(this.workspace==="scene"&&!this.sceneBeforeWorld)this.sceneBeforeWorld=structuredClone(this.runtime.scene||null);
      this.removeWorldSceneBackButton();
      const local=this.localWorlds.find(item=>item.entry.id===id);
      if(local)await this.worldEditor.openLocal(local.entry,local.world);
      else await this.worldEditor.open(entry);
      this.workspace="world";
      this.selected=null;
      if(this.mold)this.mold.hidden=true;
      this.toggleWorlds(false);
      this.setMode("edit");
      this.renderWorlds();
    }catch(error){
      console.error("World open failed",error);
      const list=this.el.querySelector("[data-worlds-list]");
      if(list)list.insertAdjacentHTML("afterbegin",'<div class="tq-scenes__error">Falha ao abrir o mundo.</div>');
    }
  }

  exitWorldWorkspace({restoreScene=true}={}){
    this.syncLocalWorldFromEditor();
    this.removeWorldSceneBackButton();
    this.worldEditor?.close({showScene:true});
    this.workspace="scene";
    this.selected=null;
    if(restoreScene&&this.sceneBeforeWorld)this.runtime.loadScene(structuredClone(this.sceneBeforeWorld));
    this.sceneBeforeWorld=null;
    this.setMode("edit");
    this.renderWorlds();
  }

  removeWorldSceneBackButton(){
    this.worldSceneBackButton?.remove();
    this.worldSceneBackButton=null;
  }

  async openWorldLinkedScene(entity){
    if(!entity?.scene||!this.worldEditor?.active)return;
    try{
      const selectedId=entity.id;
      this.worldEditor.suspend();
      if(this.runtime.stageHost)this.runtime.stageHost.style.display="";
      this.workspace="scene-linked";
      this.selected=null;
      await this.runtime.load(entity.scene);

      this.removeWorldSceneBackButton();
      const back=document.createElement("button");
      back.type="button";
      back.className="tq-world-editor-back";
      back.textContent="← Voltar ao mundo";
      back.addEventListener("click",()=>{
        this.removeWorldSceneBackButton();
        if(this.runtime.stageHost)this.runtime.stageHost.style.display="none";
        this.workspace="world";
        this.worldEditor.resume();
        this.selected=this.worldEditor.selectEntity(selectedId);
        this.setMode("edit");
      });
      document.body.append(back);
      this.worldSceneBackButton=back;
      this.setMode("edit");
    }catch(error){
      console.error("World linked scene open failed",error);
      this.workspace="world";
      this.worldEditor.resume();
      if(this.runtime.stageHost)this.runtime.stageHost.style.display="none";
    }
  }

  renderWorldInspector(){
    const content=this.el.querySelector(".tq-dev__content");
    const title=this.el.querySelector("[data-node-title]");
    const entity=this.selected;

    if(!entity){
      const world=this.worldEditor?.getWorld();
      const ocean=this.worldEditor?.getOcean();
      if(!world||!ocean){
        title.textContent="Oceano";
        content.innerHTML='<div class="tq-dev__empty">Abra um mundo para configurar o oceano.</div>';
        return;
      }

      const presetOptions=[["calm","Calmo"],["adventure","Aventura"],["storm","Tempestade"]]
        .map(([value,label])=>'<option value="'+value+'" '+(ocean.preset===value?'selected':'')+'>'+label+'</option>').join("");
      const backgroundOptions=this.worldBackgroundOptions(ocean.background);
      const number=(key,label,min,max,step="1")=>'<label class="tq-world-field"><span>'+label+'</span><input data-ocean-prop="'+key+'" type="number" min="'+min+'" max="'+max+'" step="'+step+'" value="'+this.escapeHtml(ocean[key]??"")+'"></label>';
      const player=this.worldEditor?.getPlayerConfig()||world.player||{};
      const directionLabels={n:"N",ne:"NE",e:"E",se:"SE",s:"S",sw:"SW",w:"W",nw:"NW"};
      const directionSlots=Object.entries(directionLabels).map(([key,label])=>{
        const src=player.directions?.[key]||"";
        return '<button type="button" class="tq-world-direction-slot" data-player-direction-pick="'+key+'" title="Escolher asset para '+label+'">'+
          '<span>'+label+'</span>'+
          (src?'<img src="'+this.escapeHtml(src)+'" alt="" loading="lazy">':'<i>＋</i>')+
          '<small>'+this.escapeHtml(src?src.split("/").pop():"Selecionar")+'</small>'+
        '</button>';
      }).join("");
      const layerLabels={deep:"Água profunda",wave:"Cristas / ondas",foam:"Espuma / detalhe"};
      const layerRange=(layer,key,label,min,max,step)=>{
        const value=Number(ocean.layers?.[layer]?.[key]??0);
        return '<label class="tq-world-motion-range"><span><b>'+label+'</b><output data-ocean-layer-output="'+layer+':'+key+'">'+value+'</output></span>'+
          '<input data-ocean-layer="'+layer+'" data-ocean-layer-prop="'+key+'" type="range" min="'+min+'" max="'+max+'" step="'+step+'" value="'+value+'"></label>';
      };
      const layerCards=Object.entries(layerLabels).map(([layer,label])=>{
        const data=ocean.layers?.[layer]||{};
        return '<div class="tq-world-ocean-layer-card"><strong>'+label+'</strong>'+
          '<label class="tq-world-field"><span>Textura</span><select data-ocean-layer="'+layer+'" data-ocean-layer-prop="background">'+this.worldBackgroundOptions(data.background||ocean.background)+'</select></label>'+
          layerRange(layer,"parallax","Parallax",0,1,.01)+
          layerRange(layer,"driftX","Deriva X",-120,120,1)+
          layerRange(layer,"driftY","Deriva Y",-120,120,1)+
          layerRange(layer,"tileScale","Escala da camada",.2,2.5,.01)+
          layerRange(layer,"opacity","Opacidade",0,1,.01)+
        '</div>';
      }).join("");

      title.textContent=(world.name||world.id)+" · oceano";
      content.innerHTML=
        '<div class="tq-inspector">'+
          '<section class="tq-config-area"><button type="button" class="tq-config-area__head" data-area-toggle aria-expanded="true"><strong>Mundo</strong><span>▾</span></button><div class="tq-config-area__body">'+
            '<label class="tq-world-field"><span>Nome</span><input data-world-root-prop="name" type="text" value="'+this.escapeHtml(world.name||"")+'"></label>'+
            '<label class="tq-world-field"><span>ID</span><input value="'+this.escapeHtml(world.id)+'" readonly></label>'+
            '<label class="tq-world-field"><span>Largura</span><input data-world-root-prop="width" type="number" min="390" max="20000" value="'+world.width+'"></label>'+
            '<label class="tq-world-field"><span>Altura</span><input data-world-root-prop="height" type="number" min="844" max="20000" value="'+world.height+'"></label>'+
          '</div></section>'+
          '<section class="tq-config-area"><button type="button" class="tq-config-area__head" data-area-toggle aria-expanded="true"><strong>Navio do jogador</strong><span>▾</span></button><div class="tq-config-area__body">'+
            '<div class="tq-world-direction-grid">'+directionSlots+'</div>'+
            '<div class="tq-worlds__create-grid">'+
              '<label class="tq-world-field"><span>Largura</span><input data-player-prop="width" type="number" min="24" max="1200" value="'+this.escapeHtml(player.width??108)+'"></label>'+
              '<label class="tq-world-field"><span>Altura</span><input data-player-prop="height" type="number" min="24" max="1200" value="'+this.escapeHtml(player.height??150)+'"></label>'+
            '</div>'+
            '<label class="tq-world-field"><span>Direção inicial</span><select data-player-prop="direction">'+Object.entries(directionLabels).map(([key,label])=>'<option value="'+key+'" '+(String(player.direction||"n")===key?'selected':'')+'>'+label+'</option>').join("")+'</select></label>'+
            '<small class="tq-world-editor-note">Cada slot representa a direção real da proa. Use Assets para escolher a vista correta de N, NE, E, SE, S, SW, W e NW.</small>'+
          '</div></section>'+
          '<section class="tq-config-area"><button type="button" class="tq-config-area__head" data-area-toggle aria-expanded="true"><strong>Visual do oceano</strong><span>▾</span></button><div class="tq-config-area__body">'+
            '<label class="tq-field tq-field--check"><span>Movimento ativo</span><input data-ocean-prop="active" type="checkbox" '+(ocean.active?'checked':'')+'></label>'+
            '<label class="tq-world-field"><span>Fundo</span><select data-ocean-prop="background">'+backgroundOptions+'</select></label>'+
            '<label class="tq-world-field"><span>Predefinição</span><select data-ocean-prop="preset">'+presetOptions+'</select></label>'+
            number("tileSize","Escala da textura",240,1600,10)+
            number("brightness","Brilho",50,150,1)+
            number("saturation","Saturação",0,180,1)+
          '</div></section>'+
          '<section class="tq-config-area"><button type="button" class="tq-config-area__head" data-area-toggle aria-expanded="true"><strong>Movimento da água</strong><span>▾</span></button><div class="tq-config-area__body">'+
            number("speed","Velocidade",0,100,1)+
            number("directionX","Direção horizontal",-1,1,.05)+
            number("directionY","Direção vertical",-1,1,.05)+
            number("swell","Ondulação",0,100,1)+
            '<small class="tq-world-ocean-note">As alterações aparecem imediatamente no oceano. Play usa a mesma configuração.</small>'+
          '</div></section>'+
          '<section class="tq-config-area"><button type="button" class="tq-config-area__head" data-area-toggle aria-expanded="true"><strong>Parallax do oceano</strong><span>▾</span></button><div class="tq-config-area__body">'+
            '<small class="tq-world-editor-note">Navios e entidades ficam em fator 1.0. As três camadas abaixo movem mais devagar que a câmera, criando profundidade.</small>'+
            layerCards+
          '</div></section>'+
        '</div>';

      content.querySelectorAll("[data-area-toggle]").forEach(button=>button.addEventListener("click",()=>{
        const body=button.nextElementSibling;
        body.hidden=!body.hidden;
        button.setAttribute("aria-expanded",String(!body.hidden));
        button.querySelector("span").textContent=body.hidden?"▸":"▾";
      }));

      content.querySelectorAll("[data-world-root-prop]").forEach(input=>input.addEventListener("change",()=>{
        const key=input.dataset.worldRootProp;
        const value=["width","height"].includes(key)?Number(input.value):input.value;
        this.worldEditor.updateWorld({[key]:value},true);
        this.syncLocalWorldFromEditor();
        this.renderWorlds();
      }));

      content.querySelectorAll("[data-player-direction-pick]").forEach(button=>button.addEventListener("click",()=>{
        this.openWorldPlayerAssetPicker(button.dataset.playerDirectionPick);
      }));

      content.querySelectorAll("[data-player-prop]").forEach(input=>input.addEventListener("change",()=>{
        const key=input.dataset.playerProp;
        const value=["width","height"].includes(key)?Number(input.value):input.value;
        this.worldEditor.updatePlayerConfig({[key]:value},true);
        this.syncLocalWorldFromEditor();
        this.renderWorldInspector();
      }));

      content.querySelectorAll("[data-ocean-layer-prop]").forEach(input=>{
        const apply=(commit)=>{
          const layer=input.dataset.oceanLayer;
          const key=input.dataset.oceanLayerProp;
          const value=key==="background"?input.value:Number(input.value);
          const output=content.querySelector('[data-ocean-layer-output="'+layer+':'+key+'"]');
          if(output)output.value=String(Math.round(value*100)/100);
          this.worldEditor.updateOcean({layers:{[layer]:{[key]:value}}},commit);
          if(commit)this.syncLocalWorldFromEditor();
        };
        if(input.type==="range")input.addEventListener("input",()=>apply(false));
        input.addEventListener("change",()=>apply(true));
      });

      const numeric=new Set(["speed","directionX","directionY","swell","tileSize","brightness","saturation"]);
      content.querySelectorAll("[data-ocean-prop]").forEach(input=>input.addEventListener("change",()=>{
        const key=input.dataset.oceanProp;
        const value=input.type==="checkbox"?input.checked:(numeric.has(key)?Number(input.value):input.value);
        this.worldEditor.updateOcean({[key]:value},true);
        this.syncLocalWorldFromEditor();
        if(key==="preset")this.renderWorldInspector();
      }));
      return;
    }

    const motion=this.worldEditor.getEntityMotion(entity.id)||{active:false,preset:"none",speed:50,heave:0,pitch:0,roll:0,sway:0};
    const num=(key,label,min="",max="",step="0.01")=>'<label class="tq-world-field"><span>'+label+'</span><input data-world-prop="'+key+'" type="number" '+(min!==""?'min="'+min+'" ':'')+(max!==""?'max="'+max+'" ':'')+'step="'+step+'" value="'+this.escapeHtml(entity[key]??"")+'"></label>';
    const text=(key,label)=>'<label class="tq-world-field"><span>'+label+'</span><input data-world-prop="'+key+'" type="text" value="'+this.escapeHtml(entity[key]??"")+'"></label>';
    const motionRange=(key,label)=>'<label class="tq-world-motion-range"><span><b>'+label+'</b><output data-motion-output="'+key+'">'+Math.round(Number(motion[key]||0))+'</output></span><input data-motion-prop="'+key+'" type="range" min="0" max="100" step="1" value="'+Number(motion[key]||0)+'"></label>';
    const typeOptions=["object","barrel","treasure","ship","location"].map(value=>'<option value="'+value+'" '+(entity.type===value?'selected':'')+'>'+value+'</option>').join("");
    const motionPresets=[["none","Sem balanço"],["calm","Mar calmo"],["navigation","Navegação natural"],["rough","Mar agitado"],["heavy","Objeto pesado"]]
      .map(([value,label])=>'<option value="'+value+'" '+(motion.preset===value?'selected':'')+'>'+label+'</option>').join("");

    title.textContent=entity.id+" · "+(entity.type||"object");
    content.innerHTML=
      '<div class="tq-inspector">'+
        '<section class="tq-config-area"><button type="button" class="tq-config-area__head" data-area-toggle aria-expanded="true"><strong>Entidade</strong><span>▾</span></button><div class="tq-config-area__body">'+
          '<label class="tq-world-field"><span>ID</span><input value="'+this.escapeHtml(entity.id)+'" readonly></label>'+
          '<label class="tq-world-field"><span>Tipo lógico</span><select data-world-prop="type">'+typeOptions+'</select></label>'+
          text("label","Nome")+
          text("src","Asset")+
          '<small class="tq-world-editor-note">Tipo lógico não altera a aparência do asset. Região, location e background continuam sendo renderizados como o sprite original.</small>'+
        '</div></section>'+
        '<section class="tq-config-area"><button type="button" class="tq-config-area__head" data-area-toggle aria-expanded="true"><strong>Transformação</strong><span>▾</span></button><div class="tq-config-area__body">'+
          num("x","Position X")+num("y","Position Y")+
          num("width","Width",16,2400)+num("height","Height",16,2400)+
          '<label class="tq-field tq-field--check"><span>Manter proporção</span><input data-world-prop="lockAspect" type="checkbox" '+(entity.lockAspect!==false?'checked':'')+'></label>'+
          '<label class="tq-world-motion-range"><span><b>Rotação</b><output data-world-rotation-output>'+Math.round(Number(entity.rotation||0))+'°</output></span><input data-world-prop="rotation" type="range" min="-180" max="180" step="1" value="'+Number(entity.rotation||0)+'"></label>'+
          '<div class="tq-world-transform-actions"><button type="button" data-world-rotate="-90">↶ -90°</button><button type="button" data-world-rotate="0">0°</button><button type="button" data-world-rotate="90">↷ +90°</button></div>'+
          '<small class="tq-world-editor-note">No canvas: arraste o objeto para mover, o círculo superior para girar e o canto inferior para redimensionar.</small>'+
        '</div></section>'+
        '<section class="tq-config-area"><button type="button" class="tq-config-area__head" data-area-toggle aria-expanded="true"><strong>Balanço / água</strong><span>▾</span></button><div class="tq-config-area__body">'+
          '<label class="tq-field tq-field--check"><span>Efeito ativo</span><input data-motion-prop="active" type="checkbox" '+(motion.active?'checked':'')+'></label>'+
          '<label class="tq-world-field"><span>Predefinição</span><select data-motion-prop="preset">'+motionPresets+'</select></label>'+
          motionRange("speed","Velocidade")+
          motionRange("heave","Elevação pela água")+
          motionRange("pitch","Inclinação pela onda")+
          motionRange("roll","Balanço lateral")+
          motionRange("sway","Deriva lateral")+
          '<small class="tq-world-editor-note">Usa a mesma linguagem do motor de composição de navios: heave, pitch, roll e sway. O preview roda no próprio mundo.</small>'+
        '</div></section>'+
        '<section class="tq-config-area"><button type="button" class="tq-config-area__head" data-area-toggle aria-expanded="true"><strong>Comportamento</strong><span>▾</span></button><div class="tq-config-area__body">'+
          num("interactionRadius","Raio de interação",0,2000)+
          text("scene","Cena vinculada")+
        '</div></section>'+
        '<section class="tq-config-area"><button type="button" class="tq-config-area__head" data-area-toggle aria-expanded="true"><strong>Ações</strong><span>▾</span></button><div class="tq-config-area__body tq-world-inspector-actions">'+
          (entity.scene?'<button type="button" class="is-primary" data-world-open-scene>Editar cena vinculada</button>':"")+
          '<button type="button" class="is-danger" data-world-delete>Excluir entidade</button>'+
        '</div></section>'+
      '</div>';

    content.querySelectorAll("[data-area-toggle]").forEach(button=>button.addEventListener("click",()=>{
      const body=button.nextElementSibling;
      body.hidden=!body.hidden;
      button.setAttribute("aria-expanded",String(!body.hidden));
      button.querySelector("span").textContent=body.hidden?"▸":"▾";
    }));

    const numeric=new Set(["x","y","width","height","rotation","interactionRadius"]);
    const commitWorldProp=input=>{
      const key=input.dataset.worldProp;
      const value=input.type==="checkbox"?input.checked:(numeric.has(key)?Number(input.value):input.value);
      const patch={[key]:value};

      if((key==="width"||key==="height")&&entity.lockAspect!==false){
        const width=Math.max(1,Number(entity.width||96));
        const height=Math.max(1,Number(entity.height||96));
        const ratio=width/height;
        if(key==="width")patch.height=Math.max(16,value/ratio);
        if(key==="height")patch.width=Math.max(16,value*ratio);
      }

      const updated=this.worldEditor.updateEntity(entity.id,patch,true);
      this.selected=updated||this.selected;
      if(key==="type"||key==="width"||key==="height"||key==="lockAspect")this.renderWorldInspector();
    };

    content.querySelectorAll("[data-world-prop]").forEach(input=>{
      if(input.dataset.worldProp==="rotation"){
        input.addEventListener("input",()=>{
          const value=Number(input.value);
          const output=content.querySelector("[data-world-rotation-output]");
          if(output)output.value=Math.round(value)+"°";
          this.selected=this.worldEditor.updateEntity(entity.id,{rotation:value},false)||this.selected;
        });
      }
      input.addEventListener("change",()=>commitWorldProp(input));
    });

    content.querySelectorAll("[data-world-rotate]").forEach(button=>button.addEventListener("click",()=>{
      const value=Number(button.dataset.worldRotate);
      const current=Number(this.worldEditor.getSelected()?.rotation||0);
      const rotation=value===0?0:Math.max(-180,Math.min(180,current+value));
      this.selected=this.worldEditor.updateEntity(entity.id,{rotation},true)||this.selected;
      this.renderWorldInspector();
    }));

    const motionNumeric=new Set(["speed","heave","pitch","roll","sway"]);
    content.querySelectorAll("[data-motion-prop]").forEach(input=>{
      const read=()=>input.type==="checkbox"?input.checked:(motionNumeric.has(input.dataset.motionProp)?Number(input.value):input.value);

      if(input.type==="range"){
        input.addEventListener("input",()=>{
          const key=input.dataset.motionProp;
          const value=read();
          const output=content.querySelector('[data-motion-output="'+key+'"]');
          if(output)output.value=String(Math.round(value));
          this.worldEditor.updateEntityMotion(entity.id,{[key]:value},false);
          this.selected=this.worldEditor.getSelected()||this.selected;
        });
      }

      input.addEventListener("change",()=>{
        const key=input.dataset.motionProp;
        const value=read();
        this.worldEditor.updateEntityMotion(entity.id,{[key]:value},true);
        this.selected=this.worldEditor.getSelected()||this.selected;
        if(key==="preset")this.renderWorldInspector();
      });
    });

    content.querySelector("[data-world-delete]")?.addEventListener("click",()=>{
      if(confirm("Excluir esta entidade do mundo?")){
        this.worldEditor.deleteEntity(entity.id);
        this.selected=null;
        this.renderWorldInspector();
      }
    });

    content.querySelector("[data-world-open-scene]")?.addEventListener("click",()=>this.openWorldLinkedScene(entity));
  }

  async loadCompositionTypes(){
    try{
      const r=await fetch("./src/config/composition-types.json?v=20260930-1318",{cache:"no-store"});
      const registry=await r.json();
      this.compositionTypes=registry.types||[];
      if(this.selected&&this.mode==="config")this.renderInspector();
    }catch(e){
      this.compositionTypes=[];
    }
  }
  async loadAssets(){
    try{
      const r=await fetch("./src/config/asset-tree.json?v=20260930-1318",{cache:"no-store"});
      const manifest=await r.json();
      this.assetTree=manifest.root||null;
      this.assetCatalog=manifest.assets||[];
      this.assetDirectoryPath=this.assetTree?.path||"assets";
      this.assetNodeIndex=new Map();
      this.assetByPath=new Map(this.assetCatalog.map(asset=>[asset.path,asset]));
      const indexNode=node=>{
        if(!node?.path)return;
        this.assetNodeIndex.set(node.path,node);
        if(node.type==="directory")for(const child of node.children||[])indexNode(child);
      };
      indexNode(this.assetTree);
      this.renderAssets();
      this.populateCreateWorldBackgrounds?.();
    }catch(e){
      console.warn("Asset tree load failed",e);
      const grid=this.el.querySelector("[data-assets-grid]");
      if(grid)grid.textContent="Falha ao carregar a árvore real de /assets.";
    }
  }
  toggleAssets(show){
    const panel=this.el.querySelector(".tq-dev__assets");panel.hidden=!show;
    if(!show)this.assetPickTarget=null;
    if(show){this.el.querySelector(".tq-dev__panel").hidden=true;this.el.querySelector(".tq-dev__scenes").hidden=true;this.el.querySelector(".tq-dev__worlds").hidden=true;this.renderAssets()}
  }
  openWorldPlayerAssetPicker(direction){
    if(this.workspace!=="world"||!this.worldEditor?.active)return;
    this.assetPickTarget={kind:"world-player-direction",direction:String(direction||"n")};
    if(this.assetNodeIndex.has("assets/ships"))this.assetDirectoryPath="assets/ships";
    const search=this.el.querySelector("[data-asset-search]");
    if(search)search.value="";
    this.toggleAssets(true);
  }

  applyAssetPick(asset){
    const target=this.assetPickTarget;
    if(!target||!asset)return false;

    if(target.kind==="world-player-direction"){
      const direction=target.direction;
      const src="./"+asset.path;
      this.worldEditor.updatePlayerConfig({directions:{[direction]:src},...(direction==="n"?{src}: {})},true);
      this.syncLocalWorldFromEditor();
      this.assetPickTarget=null;
      this.toggleAssets(false);
      this.setMode("config");
      this.selected=null;
      this.renderWorldInspector();
      return true;
    }

    return false;
  }

  escapeHtml(value){
    return String(value??"").replace(/[&<>"']/g,char=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[char]));
  }
  parentAssetPath(path){
    if(!path||path==="assets")return "assets";
    const parts=path.split("/");parts.pop();
    return parts.join("/")||"assets";
  }
  navigateAssetDirectory(path){
    const node=this.assetNodeIndex.get(path);
    if(!node||node.type!=="directory")return;
    this.assetDirectoryPath=path;
    const search=this.el.querySelector("[data-asset-search]");
    if(search)search.value="";
    this.renderAssets();
  }
  renderAssetBreadcrumbs(){
    const nav=this.el.querySelector("[data-assets-breadcrumbs]");
    const label=this.el.querySelector("[data-assets-path]");
    const up=this.el.querySelector("[data-asset-up]");
    if(!nav)return;
    const path=this.assetDirectoryPath||"assets";
    const parts=path.split("/");
    let current="";
    nav.innerHTML=parts.map((part,index)=>{
      current=current?current+"/"+part:part;
      const separator=index?'<span class="tq-assets__crumb-separator">›</span>':"";
      return separator+'<button type="button" data-asset-crumb="'+this.escapeHtml(current)+'">'+this.escapeHtml(part)+'</button>';
    }).join("");
    nav.querySelectorAll("[data-asset-crumb]").forEach(button=>button.addEventListener("click",()=>this.navigateAssetDirectory(button.dataset.assetCrumb)));
    if(label)label.textContent=path;
    if(up)up.disabled=path==="assets";
  }
  countAssetImages(node){
    if(!node)return 0;
    if(node.type==="image")return 1;
    return (node.children||[]).reduce((sum,child)=>sum+this.countAssetImages(child),0);
  }
  renderAssets(){
    const grid=this.el.querySelector("[data-assets-grid]");
    if(!grid||!this.assetTree)return;

    this.renderAssetBreadcrumbs();
    const query=this.el.querySelector("[data-asset-search]")?.value.trim().toLowerCase()||"";

    if(query){
      const matches=this.assetCatalog.filter(asset=>asset.path.toLowerCase().includes(query));
      grid.innerHTML=matches.length?matches.map(asset=>{
        const parent=this.parentAssetPath(asset.path);
        return '<button class="tq-asset-card" data-asset-file="'+this.escapeHtml(asset.path)+'"><img src="./'+this.escapeHtml(asset.path)+'" loading="lazy" alt=""><span>'+this.escapeHtml(asset.name)+'</span><small>'+this.escapeHtml(parent)+'</small></button>';
      }).join(""):'<div class="tq-assets__empty">Nenhuma imagem encontrada em /assets.</div>';
    }else{
      const directory=this.assetNodeIndex.get(this.assetDirectoryPath)||this.assetTree;
      const children=directory.children||[];
      grid.innerHTML=children.length?children.map(entry=>{
        if(entry.type==="directory"){
          const count=this.countAssetImages(entry);
          return '<button class="tq-asset-folder" data-asset-dir="'+this.escapeHtml(entry.path)+'"><span class="tq-asset-folder__icon" aria-hidden="true">📁</span><span>'+this.escapeHtml(entry.name)+'</span><small>'+count+' imagem'+(count===1?'':'s')+' nesta pasta</small></button>';
        }
        return '<button class="tq-asset-card" data-asset-file="'+this.escapeHtml(entry.path)+'"><img src="./'+this.escapeHtml(entry.path)+'" loading="lazy" alt=""><span>'+this.escapeHtml(entry.name)+'</span><small>'+this.escapeHtml(entry.path)+'</small></button>';
      }).join(""):'<div class="tq-assets__empty">Esta pasta não contém subpastas ou imagens.</div>';
    }

    grid.querySelectorAll("[data-asset-dir]").forEach(button=>button.addEventListener("click",()=>this.navigateAssetDirectory(button.dataset.assetDir)));
    grid.querySelectorAll("[data-asset-file]").forEach(button=>button.addEventListener("click",()=>{
      const asset=this.assetByPath.get(button.dataset.assetFile);
      if(!asset)return;
      if(this.assetPickTarget&&this.applyAssetPick(asset))return;
      this.insertAsset(asset);
    }));
  }
  insertAsset(asset){
    if(this.workspace==="world"&&this.worldEditor?.active){
      const entity=this.worldEditor.addAsset(asset);
      if(entity){
        this.selected=entity;
        this.toggleAssets(false);
        this.setMode("edit");
      }
      return;
    }
    const src="./"+asset.path;
    const stem=asset.name.replace(/\.[^.]+$/,"").replace(/[^a-z0-9]+/gi,"-").replace(/^-|-$/g,"").toLowerCase();
    const size=128,x=(this.runtime.reference.width-size)/2,y=(this.runtime.reference.height-size)/2;
    const raw={id:`${this.runtime.scene?.id||"scene"}.${stem}`,kind:"image",src,x,y,width:size,height:size,scaleX:1,scaleY:1,rotation:0,skewX:0,skewY:0,z:this.runtime.nodes.size+1,visible:true,locked:false,alt:asset.name};

    const inferred=this.inferCompositionType(raw);
    if(inferred?.autoApply){
      raw.compositionType=inferred.definition.id;
      raw.compositionSelection="inferred";
      raw.composition={};
      this.ensureCompositionAnimation(raw.composition,inferred.definition);
    }

    const suggestedAction=this.runtime.suggestAction?.(raw);
    if(suggestedAction)raw.action=suggestedAction.id;

    const node=this.runtime.addNode(raw);
    if(node){this.selected=node;this.toggleAssets(false);this.setMode("edit")}
  }
  toggleCollapse(){
    this.el.classList.toggle("is-collapsed");
    const collapsed=this.el.classList.contains("is-collapsed");
    const b=this.el.querySelector("[data-collapse]");
    b.textContent=collapsed?"›":"‹";
    b.setAttribute("aria-label",collapsed?"Expandir ferramentas":"Recolher ferramentas");
    b.title=collapsed?"Expandir":"Recolher";
  }
  enableToolbarDrag(){
    const handle=this.el.querySelector("[data-drag]"),bar=this.el.querySelector(".tq-dev__bar");
    let drag=null;
    const move=e=>{
      if(!drag)return;
      const maxX=Math.max(0,window.innerWidth-bar.offsetWidth);
      const maxY=Math.max(0,window.innerHeight-bar.offsetHeight);
      const x=Math.min(maxX,Math.max(0,drag.left+e.clientX-drag.x));
      const y=Math.min(maxY,Math.max(0,drag.top+e.clientY-drag.y));
      bar.style.left=x+"px";bar.style.top=y+"px";bar.style.transform="none";
    };
    const end=e=>{if(!drag)return;try{handle.releasePointerCapture(e.pointerId)}catch{}drag=null;};
    handle.addEventListener("pointerdown",e=>{
      e.preventDefault();e.stopPropagation();
      const r=bar.getBoundingClientRect();drag={x:e.clientX,y:e.clientY,left:r.left,top:r.top};
      bar.style.position="fixed";bar.style.margin="0";bar.style.right="auto";
      handle.setPointerCapture(e.pointerId);
    });
    handle.addEventListener("pointermove",move);handle.addEventListener("pointerup",end);handle.addEventListener("pointercancel",end);
    bar.addEventListener("wheel",e=>{
      if(bar.scrollWidth<=bar.clientWidth)return;
      if(Math.abs(e.deltaY)<=Math.abs(e.deltaX))return;
      e.preventDefault();
      bar.scrollLeft+=e.deltaY;
    },{passive:false});
  }
  mountMold(){
    this.mold=document.createElement("div");
    this.mold.className="tq-dev-mold";
    this.mold.hidden=true;
    this.mold.setAttribute("aria-hidden","true");
    this.mold.innerHTML='<span>390 × 844</span>';
    this.runtime.stageHost.append(this.mold);
    this.positionMold();
    this.moldObserver=new ResizeObserver(()=>this.positionMold());
    this.moldObserver.observe(this.runtime.stageHost);
  }
  positionMold(){
    if(!this.mold)return;
    const s=this.runtime.viewportScale||1;
    this.mold.style.width=(this.runtime.reference.width*s)+"px";
    this.mold.style.height=(this.runtime.reference.height*s)+"px";
  }
  toggleMold(){
    if(this.workspace==="world")return;
    if(!this.mold)return;
    this.mold.hidden=!this.mold.hidden;
    this.el.querySelector("[data-mold]").classList.toggle("active",!this.mold.hidden);
    if(!this.mold.hidden)this.positionMold();
  }
  exportScene(){
    if(this.workspace==="world"&&this.worldEditor?.active){this.worldEditor.exportWorld();return;}
    const scene=structuredClone(this.runtime.scene||{});
    scene.reference={...this.runtime.reference};
    scene.root=scene.root||{id:"viewport",kind:"viewport",canonical:true};
    scene.nodes=[...this.runtime.nodes.values()].map(({node})=>structuredClone(node));
    scene.meta={...(scene.meta||{}),exportedFrom:"tabuada-quest-dev",schema:"tq.scene",version:1};
    const json=JSON.stringify(scene,null,2);
    const blob=new Blob([json],{type:"application/json"});
    const url=URL.createObjectURL(blob);
    const a=document.createElement("a");
    const id=(scene.id||"scene").replace(/[^a-z0-9._-]+/gi,"-");
    a.href=url;a.download=id+".scene.json";document.body.append(a);a.click();a.remove();
    setTimeout(()=>URL.revokeObjectURL(url),0);
  }
  setMode(mode){
    this.mode=mode;
    if(this.workspace==="world")this.worldEditor?.setMode(mode);
    else this.runtime.setMode(mode);
    this.el.querySelectorAll("[data-mode]").forEach(b=>b.classList.toggle("active",b.dataset.mode===mode));
    this.el.querySelector(".tq-dev__panel").hidden=mode!=="config";this.el.classList.toggle("is-play",mode==="play");
    if(mode==="config"){this.el.querySelector(".tq-dev__assets").hidden=true;this.el.querySelector(".tq-dev__scenes").hidden=true;this.el.querySelector(".tq-dev__worlds").hidden=true;this.renderInspector();}
  }

  normalizeInferencePath(value){
    return String(value??"")
      .split("?")[0]
      .split("#")[0]
      .replace(/^\.\//,"")
      .replace(/^\/+/, "")
      .toLowerCase();
  }

  inferCompositionType(node){
    const path=this.normalizeInferencePath(node?.src||node?.path||"");
    if(!path)return null;
    const filename=path.split("/").pop()||"";
    let best=null;

    for(const definition of this.compositionTypes||[]){
      const inference=definition.inference;
      if(!inference)continue;

      for(const rule of inference.rules||[]){
        let matched=false;
        if(rule.kind==="path-exact"){
          matched=path===this.normalizeInferencePath(rule.value);
        }else if(rule.kind==="path-prefix"){
          matched=path.startsWith(this.normalizeInferencePath(rule.value));
        }else if(rule.kind==="filename-token"){
          matched=(rule.values||[]).some(token=>filename.includes(String(token).toLowerCase()));
        }
        if(!matched)continue;

        const score=Number(rule.score??0);
        if(!best||score>best.score){
          const threshold=Number(inference.autoApplyMinScore??Infinity);
          best={
            definition,
            score,
            reason:rule.reason||"Regra de inferência",
            autoApply:score>=threshold
          };
        }
      }
    }

    return best;
  }

  applyAutomaticComposition(node){
    if(!node||node.compositionType||node.compositionSelection==="manual")return node;
    const inferred=this.inferCompositionType(node);
    if(!inferred?.autoApply)return node;

    node.composition=node.composition||{};
    this.ensureCompositionAnimation(node.composition,inferred.definition);
    this.runtime.updateNode(node.id,{
      compositionType:inferred.definition.id,
      compositionSelection:"inferred",
      composition:node.composition
    },true);
    return this.runtime.nodes.get(node.id)?.node||node;
  }

  compositionDefinition(node){
    return (this.compositionTypes||[]).find(type=>type.id===node?.compositionType)||null;
  }

  compositionPreset(definition,id){
    const presets=definition?.animation?.presets||[];
    return presets.find(preset=>preset.id===id)||presets[0]||null;
  }

  ensureCompositionAnimation(composition,definition){
    const controls=definition?.animation?.controls||[];
    const presetControl=controls.find(control=>control.control==="preset");
    const presetId=composition.animation?.preset||presetControl?.default||definition?.animation?.presets?.[0]?.id||null;
    const preset=this.compositionPreset(definition,presetId);
    const current=composition.animation||{};
    const defaults={...(preset?.defaults||{})};

    for(const control of controls){
      if(control.scope!=="animation"||control.control==="action"||control.control==="polygon-area")continue;
      if(control.default!==undefined&&defaults[control.id]===undefined)defaults[control.id]=control.default;
    }

    composition.animation={...defaults,...current};
    if(presetId&&!composition.animation.preset)composition.animation.preset=presetId;
    return composition.animation;
  }

  compositionControlValue(node,definition,control){
    const composition=node.composition||{};
    if(control.control==="polygon-area"||control.control==="action")return null;

    if(control.scope==="composition"){
      const value=composition[control.id];
      return value===undefined?control.default:value;
    }

    const animation=composition.animation||{};
    if(animation[control.id]!==undefined)return animation[control.id];

    const presetId=animation.preset||definition?.animation?.presets?.[0]?.id;
    const preset=this.compositionPreset(definition,presetId);
    if(preset?.defaults?.[control.id]!==undefined)return preset.defaults[control.id];
    return control.default;
  }

  configSections(node){
    const field=(key,label,type="number")=>[key,label,type];
    const definition=this.compositionDefinition(node);
    const sections=[
      {id:"identity",title:"Identificação",fields:[
        field("id","ID","readonly"),field("kind","Tipo","readonly"),field("parentId","Parent","readonly"),
        ...(node.kind==="image"?[field("src","Asset","text")]:[]),
        ...(node.kind==="function"?[field("function","Função","text")]:[])
      ]},
      {id:"transform",title:"Transformação",fields:[
        field("x","Position X"),field("y","Position Y"),
        ...(["image","text"].includes(node.kind)?[field("width","Width"),field("height","Height")]:[]),
        field("scaleX","Scale X"),field("scaleY","Scale Y"),field("rotation","Rotation"),
        field("skewX","Skew X"),field("skewY","Skew Y")
      ]},
      {id:"appearance",title:"Aparência",fields:[
        ...(node.kind==="text"?[field("text","Texto","text")]:[]),
        field("visible","Visible","checkbox")
      ]},
      {id:"layer",title:"Camada",fields:[field("z","Camada","layer")]},
      {
        id:"animation",
        title:definition?.animation?.sectionLabel||"Animação",
        fields:[
          field("compositionType","Tipo de animação","compositionType"),
          ...(definition?.animation?.controls||[]).map(control=>({compositionControl:control,definition}))
        ]
      },
      {id:"behavior",title:"Comportamento",fields:[field("action","Ação","runtimeAction"),field("locked","Locked","checkbox")]},
      {id:"danger",title:"Nó",fields:[field("__delete","Excluir nó","delete")]}
    ];
    return sections.filter(section=>section.fields.length);
  }

  compositionControlMarkup(node,definition,control){
    const value=this.compositionControlValue(node,definition,control);
    const data=' data-composition-control="'+control.id+'"';

    if(control.control==="checkbox"){
      return '<label class="tq-field tq-field--check tq-composition-toggle"><span>'+control.label+'</span><input type="checkbox"'+data+' '+(value!==false?'checked':'')+'></label>';
    }

    if(control.control==="range"){
      const min=Number(control.min??0),max=Number(control.max??100),step=Number(control.step??1);
      const safe=Math.max(min,Math.min(max,Number(value??control.default??min)));
      return '<label class="tq-field tq-composition-range"><span><b>'+control.label+'</b><output data-composition-output="'+control.id+'">'+Math.round(safe)+'</output></span><input type="range" min="'+min+'" max="'+max+'" step="'+step+'" value="'+safe+'"'+data+'></label>';
    }

    if(control.control==="preset"){
      const presets=definition?.animation?.presets||[];
      const options=presets.map(preset=>'<option value="'+preset.id+'" '+(preset.id===value?'selected':'')+'>'+preset.label+'</option>').join("");
      return '<label class="tq-field"><span>'+control.label+'</span><select'+data+'>'+options+'</select></label>';
    }

    if(control.control==="select"){
      const options=(control.options||[]).map(option=>{
        const item=typeof option==="string"?{value:option,label:option}:option;
        return '<option value="'+item.value+'" '+(item.value===value?'selected':'')+'>'+item.label+'</option>';
      }).join("");
      return '<label class="tq-field"><span>'+control.label+'</span><select'+data+'>'+options+'</select></label>';
    }

    if(control.control==="polygon-area"){
      const points=node.composition?.[control.id]?.points||[];
      const hint=control.hint?'<small>'+control.hint+'</small>':"";
      const mark=(control.buttonLabel||"Marcar ponto a ponto")+(points.length?" · "+points.length+" pontos":"");
      const clear=points.length?'<button type="button" data-composition-area-clear="'+control.id+'">'+(control.clearLabel||"Limpar área")+'</button>':"";
      return '<div class="tq-field tq-composition-area-field"><span>'+control.label+'</span>'+hint+'<button type="button" data-composition-area="'+control.id+'">'+mark+'</button>'+clear+'</div>';
    }

    if(control.control==="action"){
      return '<button type="button" class="tq-composition-action" data-composition-action="'+(control.action||control.id)+'">'+control.label+'</button>';
    }

    return "";
  }

  fieldMarkup(node,field){
    if(field?.compositionControl)return this.compositionControlMarkup(node,field.definition,field.compositionControl);

    const [key,label,type]=field;
    if(type==="readonly")return '<label class="tq-field"><span>'+label+'</span><input value="'+(node[key]??"")+'" readonly></label>';
    if(type==="checkbox")return '<label class="tq-field tq-field--check"><span>'+label+'</span><input data-prop="'+key+'" type="checkbox" '+(node[key]?'checked':'')+'></label>';
    if(type==="runtimeAction"){
      const current=String(node[key]||"");
      const options=(this.runtime.listActions?.()||[]).map(action=>'<option value="'+this.escapeHtml(action.id)+'" '+(current===action.id?'selected':'')+'>'+this.escapeHtml(action.label)+'</option>').join("");
      return '<label class="tq-field"><span>'+label+'</span><select data-prop="'+key+'"><option value="">Sem ação</option>'+options+'</select></label>';
    }
    if(type==="compositionType"){
      const current=node[key]??"";
      const options=(this.compositionTypes||[]).map(item=>'<option value="'+item.id+'" '+(current===item.id?'selected':'')+'>'+(item.label||item.id)+'</option>').join("");
      const inferred=this.inferCompositionType(node);
      let note="";
      if(inferred&&node.compositionSelection!=="manual"){
        const prefix=inferred.autoApply?"Inferência automática":"Sugestão";
        note='<small class="tq-inference-note">'+prefix+': '+this.escapeHtml(inferred.definition.label)+' · '+this.escapeHtml(inferred.reason)+'</small>';
      }
      return '<label class="tq-field"><span>'+label+'</span><select data-prop="'+key+'"><option value="">Sem animação</option>'+options+'</select>'+note+'</label>';
    }
    if(type==="delete")return '<button type="button" class="tq-delete-node" data-delete-node>Excluir nó</button>';
    if(type==="layer"){
      const buttons=Array.from({length:10},(_,index)=>index+1).map(value=>'<button type="button" data-layer="'+value+'" class="'+(Number(node[key])===value?'active':'')+'">'+value+'</button>').join("");
      return '<div class="tq-field tq-field--layer"><span>'+label+'</span><div class="tq-layer-grid">'+buttons+'</div></div>';
    }
    return '<label class="tq-field"><span>'+label+'</span><input data-prop="'+key+'" type="'+type+'" value="'+(node[key]??"")+'" '+(type==="number"?'step="0.01"':'')+'></label>';
  }

  applyCompositionPreset(node,definition,presetId){
    node.composition=node.composition||{};
    const preset=this.compositionPreset(definition,presetId);
    const previous=node.composition.animation||{};
    node.composition.animation={...previous,...(preset?.defaults||{}),preset:presetId};
    this.runtime.updateNode(node.id,{composition:node.composition},true);
  }

  patchCompositionControl(node,definition,control,value,commit=false){
    node.composition=node.composition||{};
    const animation=this.ensureCompositionAnimation(node.composition,definition);

    if(control.control==="preset"){
      this.applyCompositionPreset(node,definition,value);
      return;
    }

    if(control.scope==="composition")node.composition[control.id]=value;
    else animation[control.id]=value;

    const linked=control.linkedDefaults?.[value];
    if(linked&&control.scope==="animation")Object.assign(animation,linked);

    this.runtime.updateNode(node.id,{composition:node.composition},commit);
  }

  renderInspector(){
    if(this.workspace==="world"){this.renderWorldInspector();return;}
    const content=this.el.querySelector(".tq-dev__content");
    const title=this.el.querySelector("[data-node-title]");

    if(!this.selected){
      title.textContent="Nenhum nó";
      content.innerHTML='<div class="tq-dev__empty">Selecione um nó para configurar.</div>';
      return;
    }

    let node=this.selected;
    node=this.applyAutomaticComposition(node);
    this.selected=node;
    const definition=this.compositionDefinition(node);
    title.textContent=node.id+" · "+node.kind;
    const sections=this.configSections(node);
    const defaultOpen="animation";

    content.innerHTML='<div class="tq-inspector">'+sections.map(section=>{
      const open=section.id===defaultOpen;
      return '<section class="tq-config-area" data-area="'+section.id+'"><button type="button" class="tq-config-area__head" data-area-toggle aria-expanded="'+open+'"><strong>'+section.title+'</strong><span>'+(open?'▾':'▸')+'</span></button><div class="tq-config-area__body" '+(open?'':'hidden')+'>'+section.fields.map(field=>this.fieldMarkup(node,field)).join("")+'</div></section>';
    }).join("")+'</div>';

    content.querySelectorAll("[data-area-toggle]").forEach(button=>button.addEventListener("click",()=>{
      const body=button.nextElementSibling;
      const open=!body.hidden;
      body.hidden=open;
      button.setAttribute("aria-expanded",String(!open));
      button.querySelector("span").textContent=open?"▸":"▾";
    }));

    content.querySelectorAll("[data-prop]").forEach(input=>input.addEventListener("change",()=>this.applyInput(input)));

    if(definition){
      const controls=new Map((definition.animation?.controls||[]).map(control=>[control.id,control]));

      content.querySelectorAll("[data-composition-control]").forEach(input=>{
        const control=controls.get(input.dataset.compositionControl);
        if(!control)return;

        const readValue=()=>input.type==="checkbox"?input.checked:(input.type==="range"?Number(input.value):input.value);
        const updateOutput=()=>{
          const output=content.querySelector('[data-composition-output="'+control.id+'"]');
          if(output)output.value=String(Math.round(Number(input.value)));
        };

        if(input.type==="range"){
          input.addEventListener("input",()=>{
            this.patchCompositionControl(node,definition,control,readValue(),false);
            updateOutput();
          });
          input.addEventListener("change",()=>this.patchCompositionControl(node,definition,control,readValue(),true));
        }else{
          input.addEventListener("change",()=>{
            this.patchCompositionControl(node,definition,control,readValue(),true);
            this.selected=this.runtime.nodes.get(node.id)?.node||node;
            if(control.control==="preset"||control.linkedDefaults)this.renderInspector();
          });
        }
      });

      content.querySelectorAll("[data-composition-area]").forEach(button=>{
        const control=controls.get(button.dataset.compositionArea);
        if(control)button.addEventListener("click",()=>this.startCompositionAreaMarking(node,definition,control));
      });

      content.querySelectorAll("[data-composition-area-clear]").forEach(button=>{
        const control=controls.get(button.dataset.compositionAreaClear);
        if(!control)return;
        button.addEventListener("click",()=>{
          node.composition=node.composition||{};
          node.composition[control.id]={mode:control.mode||"polygon",points:[]};
          this.runtime.updateNode(node.id,{composition:node.composition},true);
          this.renderInspector();
        });
      });

      content.querySelectorAll("[data-composition-action]").forEach(button=>button.addEventListener("click",()=>{
        const action=button.dataset.compositionAction;
        if(action==="activate"){
          node.composition=node.composition||{};
          this.ensureCompositionAnimation(node.composition,definition);
          node.composition.active=true;
          this.runtime.updateNode(node.id,{composition:node.composition},true);
          this.selected=this.runtime.nodes.get(node.id)?.node||node;
          this.renderInspector();
        }
      }));
    }

    content.querySelector("[data-delete-node]")?.addEventListener("click",()=>{
      const id=node.id;
      if(confirm("Excluir este nó da cena?")){
        this.runtime.deleteNode(id);
        this.selected=null;
        this.renderInspector();
      }
    });

    content.querySelectorAll("[data-layer]").forEach(button=>button.addEventListener("click",()=>{
      const value=Number(button.dataset.layer);
      this.runtime.updateNode(node.id,{z:value},true);
      this.selected=this.runtime.nodes.get(node.id)?.node||node;
      this.renderInspector();
    }));
  }

  startCompositionAreaMarking(node,definition,control){
    const item=this.runtime.nodes.get(node.id);
    if(!item)return;

    this.cancelCompositionAreaMarking();

    const previousMode=this.runtime.mode;
    const previousPoints=(node.composition?.[control.id]?.points||[]).map(point=>({x:Number(point.x),y:Number(point.y)}));
    const draft=previousPoints.map(point=>({...point}));
    const maxPoints=Number(control.maxPoints??32);
    const minPoints=Number(control.minPoints??3);

    this.runtime.setMode("area");

    const overlay=document.createElementNS("http://www.w3.org/2000/svg","svg");
    overlay.dataset.compositionAreaOverlay=node.id;
    overlay.classList.add("tq-water-area-editor");
    overlay.setAttribute("preserveAspectRatio","none");

    const layout=this.runtime.resolveNodeLayout(node);
    const width=Math.max(1,layout.width||item.el.offsetWidth||1);
    const height=Math.max(1,layout.height||item.el.offsetHeight||1);

    Object.assign(overlay.style,{
      left:layout.x+"px",
      top:layout.y+"px",
      width:width+"px",
      height:height+"px",
      zIndex:String((node.z||0)+200000),
      transform:"rotate("+(node.rotation||0)+"deg) skew("+(node.skewX||0)+"deg,"+(node.skewY||0)+"deg) scale("+(node.scaleX||1)+","+(node.scaleY||1)+")",
      transformOrigin:"center center"
    });

    overlay.setAttribute("viewBox","0 0 "+width+" "+height);
    this.runtime.stage.append(overlay);

    const panel=document.createElement("section");
    panel.className="tq-water-editor-panel";
    panel.innerHTML=
      '<header><strong>'+(control.editorTitle||control.label||"Área")+'</strong><span data-area-count>0 pontos</span></header>'+
      '<small>'+(control.editorHint||control.hint||"Toque para criar o contorno.")+'</small>'+
      '<div class="tq-water-editor-actions">'+
        '<button type="button" data-area-undo>↶ Desfazer</button>'+
        '<button type="button" data-area-draft-clear>Limpar</button>'+
        '<button type="button" data-area-cancel>Cancelar</button>'+
        '<button type="button" class="is-primary" data-area-finish>✓ Concluir</button>'+
      '</div>';
    this.el.append(panel);

    const redraw=()=>{
      const polygon=draft.length>=minPoints?'<polygon points="'+draft.map(point=>(point.x*width)+","+(point.y*height)).join(" ")+'" class="tq-water-polygon"/>':"";
      const polyline=draft.length?'<polyline points="'+draft.map(point=>(point.x*width)+","+(point.y*height)).join(" ")+'" class="tq-water-line"/>':"";
      const dots=draft.map((point,index)=>'<g><circle cx="'+(point.x*width)+'" cy="'+(point.y*height)+'" r="'+(index===0?7:5)+'" class="'+(index===0?'is-first':'')+'"/><text x="'+(point.x*width+8)+'" y="'+(point.y*height-8)+'">'+(index+1)+'</text></g>').join("");
      overlay.innerHTML=polygon+polyline+dots;
      panel.querySelector("[data-area-count]").textContent=draft.length+" ponto"+(draft.length===1?"":"s");
      panel.querySelector("[data-area-finish]").disabled=draft.length<minPoints;
    };

    const addPoint=event=>{
      event.preventDefault();
      event.stopPropagation();
      if(draft.length>=maxPoints)return;

      const matrix=overlay.getScreenCTM();
      if(!matrix)return;

      const point=overlay.createSVGPoint();
      point.x=event.clientX;
      point.y=event.clientY;
      const local=point.matrixTransform(matrix.inverse());
      const x=Math.max(0,Math.min(1,local.x/width));
      const y=Math.max(0,Math.min(1,local.y/height));
      draft.push({x,y});
      redraw();
    };

    overlay.addEventListener("pointerdown",addPoint);

    const close=commit=>{
      overlay.remove();
      panel.remove();
      this.areaEditSession=null;
      this.runtime.setMode(previousMode==="play"?"play":"config");

      if(commit){
        node.composition=node.composition||{};
        this.ensureCompositionAnimation(node.composition,definition);
        node.composition.active=true;
        node.composition[control.id]={mode:control.mode||"polygon",points:draft.map(point=>({...point}))};
        this.runtime.updateNode(node.id,{composition:node.composition},true);
        this.selected=this.runtime.nodes.get(node.id)?.node||node;
      }

      this.renderInspector();
    };

    panel.querySelector("[data-area-undo]").addEventListener("click",()=>{draft.pop();redraw();});
    panel.querySelector("[data-area-draft-clear]").addEventListener("click",()=>{draft.splice(0,draft.length);redraw();});
    panel.querySelector("[data-area-cancel]").addEventListener("click",()=>close(false));
    panel.querySelector("[data-area-finish]").addEventListener("click",()=>{if(draft.length>=minPoints)close(true);});

    this.areaEditSession={overlay,panel,cancel:()=>close(false)};
    redraw();
  }

  cancelCompositionAreaMarking(){
    if(this.areaEditSession?.cancel)this.areaEditSession.cancel();
  }

  applyInput(input){
    if(!this.selected)return;
    const key=input.dataset.prop;
    let value=input.type==="checkbox"?input.checked:input.type==="number"?Number(input.value):input.value;
    if(key==="compositionType"&&!value)value=null;
    if(key==="action"&&!value)value=null;

    if(key==="compositionType"){
      const patch={compositionType:value,compositionSelection:"manual"};
      if(value){
        const definition=(this.compositionTypes||[]).find(type=>type.id===value);
        const composition={};
        if(definition)this.ensureCompositionAnimation(composition,definition);
        patch.composition=composition;
      }else{
        patch.composition={};
      }
      this.runtime.updateNode(this.selected.id,patch,true);
      this.selected=this.runtime.nodes.get(this.selected.id).node;
      this.renderInspector();
      return;
    }

    const patch={[key]:value};
    if(this.linkScale&&key==="scaleX")patch.scaleY=value;
    if(this.linkScale&&key==="scaleY")patch.scaleX=value;
    this.runtime.updateNode(this.selected.id,patch,true);
    this.selected=this.runtime.nodes.get(this.selected.id).node;
    this.syncInspector();
  }
  syncInspector(){
    if(this.workspace==="world"){if(this.mode==="config")this.renderWorldInspector();return;}
    if(!this.selected||!this.el)return;
    this.el.querySelectorAll("[data-prop]").forEach(input=>{const v=this.selected[input.dataset.prop];if(input.type==="checkbox")input.checked=Boolean(v);else if(document.activeElement!==input)input.value=v??"";});
  }
}
