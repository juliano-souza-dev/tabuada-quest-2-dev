import { WorldEditor } from "./world/WorldEditor.js?v=20261002-0927";
import { ShipEditor } from "./ships/ShipEditor.js?v=20261002-0038";
import { NpcEditor } from "./npcs/NpcEditor.js?v=20261002-1031";
import { AmmoEditor } from "./ammo/AmmoEditor.js?v=20261002-0927";
export class DevOverlay {
  constructor(root,runtime,options={}){
    this.root=root;this.runtime=runtime;this.mode="edit";this.selected=null;this.linkScale=true;this.areaEditSession=null;
    this.assetTree=null;this.assetDirectoryPath="assets";this.assetNodeIndex=new Map();this.assetByPath=new Map();this.assetPickTarget=null;
    this.sceneResolver=options.sceneResolver||null;this.sceneCatalog=null;this.localScenes=[];this.actionCatalog=null;
    this.pedagogyRuntime=options.pedagogyRuntime||null;this.onPedagogyResult=typeof options.onPedagogyResult==="function"?options.onPedagogyResult:null;
    this.workspace="scene";this.worldCatalog=null;this.localWorlds=[];
    this.shipEditor=new ShipEditor({requestFrameAsset:context=>this.openShipFramePicker(context)});
    this.ammoEditor=new AmmoEditor();
    this.cannonCatalog={defaultCannonId:"cannon-basic",cannons:[]};
    this.npcEditor=new NpcEditor({getShips:()=>((this.shipEditor?.allShips?.()||[]).filter(ship=>ship?.type==="npc")),getAmmo:()=>this.ammoEditor?.all?.()||[]});
    this.worldEditor=new WorldEditor(this.runtime.root,{
      sceneRuntime:this.runtime,
      pedagogyRuntime:this.pedagogyRuntime,
      onPedagogyResult:this.onPedagogyResult,
      resolveShip:(shipId,role)=>this.resolveWorldShipProfile(shipId,role)
    });
    this.sceneBeforeWorld=null;this.worldSceneBackButton=null;
    this.localSceneStorageKey="tq.dev.local-scenes:v1";this.localWorldStorageKey="tq.dev.local-worlds:v1";this.sceneGroupStorageKey="tq.dev.scene-groups:v1";
    this.worldAtlasSelectionMode=null;
    this.sceneGroupOpen=new Set();
    this.configAreaOpenState=new Set();
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
        <button data-worlds>🗺️ <span>Regiões</span></button>
        <button data-flow>⌁ <span>Fluxo</span></button>
        <button data-ships>🚢 <span>Navios</span></button>
        <button data-npcs>☠ <span>NPC</span></button>
        <button data-ammo>💣 <span>Munições</span></button>
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
        <header><div><strong>Regiões</strong><small>Áreas navegáveis e conexões do jogo</small></div><button data-worlds-close aria-label="Fechar">×</button></header>
        <div class="tq-worlds__body">
          <div class="tq-world-list" data-worlds-list></div>
          <button type="button" class="tq-worlds__create-open" data-world-create-open>＋ Criar nova região</button>
          <form class="tq-worlds__create" data-world-create-form hidden>
            <strong>Criar nova região</strong>
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
          <div class="tq-worlds__hint">Crie regiões, configure o oceano, conecte destinos e teste o fluxo no Play.</div>
        </div>
      </section>
      <section class="tq-dev__flow" hidden>
        <header><div><strong>Fluxo</strong><small>Cenas, ações e regiões conectadas</small></div><button data-flow-close aria-label="Fechar">×</button></header>
        <div class="tq-flow__body">
          <div class="tq-flow__legend"><span>▣ Cena</span><span>⚙ Ação</span><span>🌊 Região</span></div>
          <div class="tq-flow__canvas" data-flow-canvas></div>
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
    this.el.querySelector("[data-scenes]").addEventListener("click",()=>this.toggleScenes(this.el.querySelector(".tq-dev__scenes").hidden));
    this.el.querySelector("[data-scenes-close]").addEventListener("click",()=>this.toggleScenes(false));
    this.el.querySelector("[data-worlds]").addEventListener("click",()=>this.toggleWorlds(this.el.querySelector(".tq-dev__worlds").hidden));
    this.el.querySelector("[data-worlds-close]").addEventListener("click",()=>this.toggleWorlds(false));
    this.el.querySelector("[data-flow]").addEventListener("click",()=>this.toggleFlow(this.el.querySelector(".tq-dev__flow").hidden));
    this.el.querySelector("[data-flow-close]").addEventListener("click",()=>this.toggleFlow(false));
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
    this.el.querySelector("[data-ships]").addEventListener("click",()=>this.toggleShips(this.shipEditor?.el?.hidden!==false));
    this.el.querySelector("[data-npcs]").addEventListener("click",()=>this.toggleNpcs(this.npcEditor?.el?.hidden!==false));
    this.el.querySelector("[data-ammo]").addEventListener("click",()=>this.ammoEditor.setVisible(this.ammoEditor?.el?.hidden!==false));
    this.el.querySelector("[data-assets]").addEventListener("click",()=>this.toggleAssets(this.el.querySelector(".tq-dev__assets").hidden));
    this.el.querySelector("[data-assets-close]").addEventListener("click",()=>this.toggleAssets(false));
    this.el.querySelector("[data-asset-search]").addEventListener("input",()=>this.renderAssets());
    this.el.querySelector("[data-asset-up]").addEventListener("click",()=>this.navigateAssetDirectory(this.parentAssetPath(this.assetDirectoryPath)));
    this.shipEditorReady=this.shipEditor.mount(this.el);
    this.ammoEditorReady=this.ammoEditor.mount(this.el);
    this.cannonCatalogReady=fetch("./src/config/cannon-catalog.json?v=20261002-0953",{cache:"no-store"}).then(r=>r.ok?r.json():Promise.reject(new Error("Cannon catalog "+r.status))).then(catalog=>{this.cannonCatalog=catalog;return catalog}).catch(error=>{console.warn("[TabuadaQuest] Cannon catalog failed",error);return this.cannonCatalog});
    this.npcEditorReady=this.npcEditor.mount(this.el);
    this.loadAssets();
    this.loadCompositionTypes();
    this.sceneCatalogReady=this.loadSceneCatalog();
    this.worldCatalogReady=this.loadWorldCatalog();
    this.actionCatalogReady=this.loadActionCatalog();
    this.mountMold();
    this.enableToolbarDrag();
    this.enablePanelDrag();
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
      if(!this.el.querySelector(".tq-dev__flow")?.hidden)this.renderFlow();
    });
    window.addEventListener("tq:worldchange",()=>{
      if(this.workspace!=="world")return;
      this.syncLocalWorldFromEditor();
      if(this.mode==="config"&&!this.selected)this.renderWorldInspector();
      this.renderWorlds();
    });
    window.addEventListener("tq:shipprofilechange",event=>{
      const shipId=String(event.detail?.shipId||"");
      if(!shipId||this.workspace!=="world"||!this.worldEditor?.runtime)return;
      const changed=this.worldEditor.runtime.refreshShipProfile?.(shipId)===true;
      if(!changed)return;
      if(this.mode==="config"&&!this.selected)this.renderWorldInspector();
    });
    window.addEventListener("tq:worldenterscene",e=>{
      if(this.workspace!=="world")return;
      const entity=e.detail?.entity;
      if(entity?.scene)this.openWorldLinkedScene(entity);
    });
    window.addEventListener("tq:worldenterworld",e=>{
      if(this.workspace!=="world")return;
      const target=e.detail?.entity?.destinationWorldId;
      if(target)this.openWorld(target,{preserveMode:true,preservePlayer:true});
    });
    window.addEventListener("tq:worldexecuteaction",e=>{
      if(this.workspace!=="world")return;
      const interaction=e.detail?.interaction||{};
      const params=interaction.params||{};
      if(interaction.actionId==="enter-region"&&params.regionId){
        this.openWorld(params.regionId,{preserveMode:true,preservePlayer:true});
        return;
      }
      if(interaction.actionId==="open-scene"&&params.sceneId){
        this.openWorldLinkedScene({id:e.detail?.entity?.id||"",scene:params.sceneId});
      }
    });
  }

  closeToolPanels(except=""){
    const panels={
      scenes:".tq-dev__scenes",
      regions:".tq-dev__worlds",
      flow:".tq-dev__flow",
      assets:".tq-dev__assets",
      config:".tq-dev__panel"
    };
    for(const [key,selector] of Object.entries(panels)){
      if(key===except)continue;
      const panel=this.el?.querySelector(selector);
      if(panel)panel.hidden=true;
    }
    if(except!=="ships")this.shipEditor?.setVisible(false);
    if(except!=="npcs")this.npcEditor?.setVisible(false);
    if(except!=="assets")this.assetPickTarget=null;
  }

  bindCollapsedAreas(container){
    if(!container)return;
    container.querySelectorAll("[data-area-toggle]").forEach(button=>{
      const body=button.nextElementSibling;
      if(!body)return;
      const label=String(button.querySelector("strong")?.textContent||"area").trim();
      const scope=this.workspace==="world"
        ?("world:"+(this.selected?.id||this.worldEditor?.entry?.id||"root"))
        :("scene:"+(this.selected?.id||this.runtime?.scene?.id||"root"));
      const key=scope+":"+label;
      const open=this.configAreaOpenState.has(key);
      body.hidden=!open;
      button.setAttribute("aria-expanded",String(open));
      const caret=button.querySelector("span");
      if(caret)caret.textContent=open?"▾":"▸";
      button.addEventListener("click",()=>{
        const nextOpen=body.hidden;
        body.hidden=!nextOpen;
        button.setAttribute("aria-expanded",String(nextOpen));
        if(caret)caret.textContent=nextOpen?"▾":"▸";
        if(nextOpen)this.configAreaOpenState.add(key);
        else this.configAreaOpenState.delete(key);
      });
    });
  }

  async loadActionCatalog(){
    try{
      const response=await fetch("./src/config/action-catalog.json?v=20261001-1848",{cache:"no-store"});
      if(!response.ok)throw new Error("HTTP "+response.status);
      this.actionCatalog=await response.json();
    }catch(error){
      console.warn("Action catalog load failed",error);
      this.actionCatalog={schema:"tq.action-catalog",version:1,actions:[]};
    }
    this.registerDevFlowActions();
    this.renderFlow();
    return this.actionCatalog;
  }

  registerDevFlowActions(){
    if(!this.runtime?.registerAction)return;
    for(const action of this.actionDefinitions()){
      try{
        this.runtime.registerAction(action.id,({node})=>{
          const params={};
          for(const param of action.params||[])params[param.key]=node?.[param.key]??"";
          if(action.id==="open-scene"&&params.sceneId)return this.openScene(params.sceneId);
          if(action.id==="enter-region"&&params.regionId)return this.openWorld(params.regionId,{preserveMode:true,preservePlayer:true});
          if(action.id==="resume-game"){
            const current=this.worldEditor?.entry?.id;
            if(current)return this.openWorld(current,{preserveMode:true,preservePlayer:true});
            const first=this.allWorldEntries()[0];
            if(first)return this.openWorld(first.id,{preserveMode:true,preservePlayer:true});
          }
          if(action.id==="go-back"){
            if(this.workspace==="world"||this.workspace==="scene-linked")return this.exitWorldWorkspace({restoreScene:true});
          }
        },{label:action.name||action.id});
      }catch{}
    }
  }

  actionDefinitions(){
    return Array.isArray(this.actionCatalog?.actions)?this.actionCatalog.actions:[];
  }

  actionDefinition(id){
    return this.actionDefinitions().find(action=>action.id===String(id||""))||null;
  }

  async sceneDocument(entry){
    if(!entry?.id)return null;
    const local=this.localScenes.find(item=>item.entry.id===entry.id);
    if(local)return structuredClone(local.scene);
    if(this.runtime?.scene?.id===entry.id)return structuredClone(this.runtime.scene);
    if(!entry.path)return null;
    try{
      const response=await fetch(entry.path,{cache:"no-store"});
      if(!response.ok)throw new Error("HTTP "+response.status);
      return await response.json();
    }catch(error){
      console.warn("Scene load for flow validation failed",entry.id,error);
      return null;
    }
  }

  async flowSceneLinks(){
    const links=[];
    for(const entry of this.allSceneEntries()){
      const scene=await this.sceneDocument(entry);
      if(!scene)continue;
      for(const node of Array.isArray(scene.nodes)?scene.nodes:[]){
        const actionId=String(node?.action||"");
        if(actionId==="open-scene"&&node.sceneId){
          links.push({fromKind:"scene",fromId:entry.id,actionId,toKind:"scene",toId:String(node.sceneId),label:node.id||"nó"});
        }else if(actionId==="enter-region"&&node.regionId){
          links.push({fromKind:"scene",fromId:entry.id,actionId,toKind:"region",toId:String(node.regionId),label:node.id||"nó"});
        }
      }
    }
    return links;
  }

  async flowRegionLinks(){
    const links=[];
    for(const entry of this.allWorldEntries()){
      const world=await this.worldDocument(entry);
      if(!world)continue;
      for(const entity of Array.isArray(world.entities)?world.entities:[]){
        const actionId=String(entity?.interaction?.actionId||"");
        const params=entity?.interaction?.params||{};
        if(actionId==="enter-region"&&params.regionId){
          links.push({fromKind:"region",fromId:entry.id,actionId,toKind:"region",toId:String(params.regionId),label:entity.label||entity.id||"region-exit"});
        }else if(entity?.type==="region-exit"&&entity.destinationWorldId){
          links.push({fromKind:"region",fromId:entry.id,actionId:"enter-region",toKind:"region",toId:String(entity.destinationWorldId),label:entity.label||entity.id||"region-exit"});
        }else if(actionId==="open-scene"&&params.sceneId){
          links.push({fromKind:"region",fromId:entry.id,actionId,toKind:"scene",toId:String(params.sceneId),label:entity.label||entity.id||"objeto"});
        }else if(entity?.scene){
          links.push({fromKind:"region",fromId:entry.id,actionId:"open-scene",toKind:"scene",toId:String(entity.scene),label:entity.label||entity.id||"objeto"});
        }
      }
    }
    return links;
  }

  async renderFlow(){
    const canvas=this.el?.querySelector("[data-flow-canvas]");
    if(!canvas)return;
    const scenes=this.allSceneEntries();
    const regions=this.allWorldEntries();
    const actions=this.actionDefinitions();
    const [regionLinks,sceneLinks]=await Promise.all([this.flowRegionLinks(),this.flowSceneLinks()]);
    const links=[...sceneLinks,...regionLinks];

    const card=(kind,id,name,meta="")=>
      '<article class="tq-flow-card tq-flow-card--'+kind+'"><small>'+kind.toUpperCase()+'</small><b>'+this.escapeHtml(name||id)+'</b><span>'+this.escapeHtml(id)+'</span>'+(meta?'<em>'+this.escapeHtml(meta)+'</em>':'')+'</article>';

    const connections=links.length?links.map(link=>{
      const from=link.fromKind==="region"
        ?(regions.find(item=>item.id===link.fromId)?.name||link.fromId)
        :(scenes.find(item=>item.id===link.fromId)?.name||link.fromId);
      const to=link.toKind==="region"
        ?(regions.find(item=>item.id===link.toId)?.name||link.toId)
        :(scenes.find(item=>item.id===link.toId)?.name||link.toId);
      const action=this.actionDefinition(link.actionId)?.name||link.actionId;
      return '<div class="tq-flow-link"><span>'+this.escapeHtml(from)+'</span><b>→ '+this.escapeHtml(action)+' →</b><span>'+this.escapeHtml(to)+'</span><small>'+this.escapeHtml(link.label||"")+'</small></div>';
    }).join(""):'<div class="tq-flow-empty">Nenhuma conexão configurada ainda.</div>';

    canvas.innerHTML=
      '<div class="tq-flow-columns">'+
        '<section><h3>▣ Cenas</h3>'+scenes.map(scene=>card("scene",scene.id,scene.name||scene.id,scene.context||"")).join("")+'</section>'+
        '<section><h3>⚙ Ações</h3>'+actions.map(action=>card("action",action.id,action.name||action.id,action.category||"")).join("")+'</section>'+
        '<section><h3>🌊 Regiões</h3>'+regions.map(region=>card("region",region.id,region.name||region.id,region.type||"ocean")).join("")+'</section>'+
      '</div>'+
      '<section class="tq-flow-links"><h3>Conexões atuais</h3>'+connections+'</section>';
  }

  toggleFlow(show){
    const panel=this.el.querySelector(".tq-dev__flow");
    if(!panel)return;
    if(show){
      this.closeToolPanels("flow");
      panel.hidden=false;
      Promise.all([this.sceneCatalogReady,this.worldCatalogReady,this.actionCatalogReady]).then(()=>this.renderFlow());
    }else panel.hidden=true;
  }

  resolveWorldShipProfile(shipId,role="npc"){
    let npcProfile=null;
    if(role==="npc"){
      npcProfile=this.npcEditor?.resolve?.(shipId)||null;
      if(npcProfile)shipId=npcProfile.shipId;
    }
    const catalogShips=(this.shipEditor?.repositoryShips?.()||[])
      .map(ship=>this.shipEditor.normalizeShip(ship));
    const ship=catalogShips.find(item=>item.id===String(shipId||""));
    if(!ship)return null;
    const navigation=ship.navigation&&typeof ship.navigation==="object"?structuredClone(ship.navigation):{};
    const combatAnimations={};
    for(const [key,animation] of Object.entries(ship.animations||{})){
      if(ship.animationGroups?.[key]==="combat")combatAnimations[key]=structuredClone(animation);
    }
    const combat={
      ...(ship.combat&&typeof ship.combat==="object"?structuredClone(ship.combat):{}),
      animations:combatAnimations
    };
    combat.useNavigationAtlas=false;
    delete combat.sprite;
    delete combat.compiled;
    delete combat.legacySprite;
    const npcNav=npcProfile?.navigation||{};
    const npcCombat=npcProfile?.combat||{};
    if(npcProfile){
      navigation.minSpeed=Number(npcNav.minSpeed??navigation.minSpeed??0);
      navigation.speed=Number(npcNav.speed??navigation.speed??80);
      navigation.acceleration=Number(npcNav.acceleration??navigation.acceleration??250);
      combat.hp=Number(npcCombat.hp??combat.hp??3);
      combat.attackRange=Number(npcCombat.attackRange??combat.attackRange??1200);
      combat.attackCooldownMs=Number(npcCombat.attackCooldownMs??combat.attackCooldownMs??900);
      combat.damage=Number(npcCombat.damage??combat.damage??1);
    }
    return {
      npcId:npcProfile?.id||null,
      npcAttitude:String(npcCombat.attitude||"retaliate"),
      npcBehavior:String(npcNav.behavior||"roam"),
      shipId:ship.id,
      spriteMode:ship.spriteMode==="combined"?"combined":"split",
      shipName:ship.name||ship.id,
      name:ship.name||ship.id,
      role,
      src:String(navigation.src||navigation.sprite?.src||""),
      sprite:navigation.sprite?structuredClone(navigation.sprite):null,
      width:Number(navigation.width)||230,
      height:Number(navigation.height)||230,
      minSpeed:Math.max(0,Number(navigation.minSpeed)||0),
      speed:Number(navigation.speed)||420,
      acceleration:Number(navigation.acceleration)||1100,
      braking:Number(navigation.braking??.12),
      effects:{
        wakeActive:navigation.wake!==false,
        shadowActive:navigation.shadow!==false,
        idleBalanceActive:true,
        idleRoll:Number(navigation.roll??2.4),
        idleHeave:Number(navigation.heave??3.2),
        idlePeriod:Number(navigation.periodMs??3600)
      },
      combat:{
        hp:role==="player"
          ?Math.max(50,Math.min(1000,Math.floor(Number(combat.hp)||50)))
          :Math.max(1,Math.min(99,Math.floor(Number(combat.hp)||3))),
        attackRange:Math.max(200,Math.min(6000,Number(combat.attackRange)||1200)),
        attackCooldownMs:Math.max(300,Math.min(5000,Number(combat.attackCooldownMs)||900)),
        damage:Math.max(1,Math.min(20,Math.floor(Number(combat.damage)||1)))
      },
      combatVisual:combat
    };
  }

  persistentPlayerShipProfile(player){
    if(!player||typeof player!=="object")return null;
    const keys=[
      "shipId","shipName","src","sprite","directions","width","height",
      "minSpeed","speed","acceleration","braking","effects","combat","combatModifiers","combatVisual"
    ];
    const profile={};
    for(const key of keys){
      if(player[key]!==undefined)profile[key]=structuredClone(player[key]);
    }
    return Object.keys(profile).length?profile:null;
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
        const response=await fetch("./src/config/scene-catalog.json?v=20260930-1851",{cache:"no-store"});
        if(!response.ok)throw new Error("HTTP "+response.status);
        this.sceneCatalog=await response.json();
      }
      this.loadLocalScenes();
      this.sceneGroupOpen.clear();
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
    if(show){
      this.closeToolPanels("scenes");
      panel.hidden=false;
      this.renderScenes();
    }else panel.hidden=true;
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
      this.sceneGroupOpen.clear();
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
      const response=await fetch("./src/config/world-catalog.json?v=20261001-2307",{cache:"no-store"});
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
    const oceanAssets=(this.assetCatalog||[])
      .filter(asset=>asset?.type==="image")
      .map(asset=>String(asset.path||""))
      .filter(path=>path.startsWith("assets/oceans/"));
    const unique=[...new Set(oceanAssets)].sort((a,b)=>a.localeCompare(b,"pt-BR"));
    const none='<option value="none" '+(String(selected)==="none"?'selected':'')+'>Sem background · azul opaco</option>';
    const options=unique.map(path=>{
      const value="./"+path;
      const label=path.slice("assets/oceans/".length)||path.split("/").pop();
      return '<option value="'+this.escapeHtml(value)+'" '+(value===selected?'selected':'')+'>'+this.escapeHtml(label)+'</option>';
    }).join("");
    return none+options;
  }

  async worldDocument(entry){
    if(!entry?.id)return null;
    if(this.worldEditor?.entry?.id===entry.id&&this.worldEditor?.active){
      const current=this.worldEditor.getWorld();
      if(current)return structuredClone(current);
    }
    const local=this.localWorlds.find(item=>item.entry.id===entry.id);
    if(local)return structuredClone(local.world);
    if(!entry.path)return null;
    try{
      const response=await fetch(entry.path,{cache:"no-store"});
      if(!response.ok)throw new Error("HTTP "+response.status);
      return await response.json();
    }catch(error){
      console.warn("World load for link validation failed",entry.id,error);
      return null;
    }
  }

  async worldInboundLinks(targetId){
    const links=[];
    for(const entry of this.allWorldEntries()){
      if(entry.id===targetId)continue;
      const world=await this.worldDocument(entry);
      if(!world)continue;
      for(const entity of Array.isArray(world.entities)?world.entities:[]){
        const actionTarget=entity?.interaction?.actionId==="enter-region"
          ?String(entity.interaction?.params?.regionId||"")
          :"";
        const legacyTarget=entity?.type==="region-exit"?String(entity.destinationWorldId||""):"";
        if(actionTarget!==String(targetId)&&legacyTarget!==String(targetId))continue;
        links.push({
          worldId:entry.id,
          worldName:entry.name||entry.id,
          entityId:entity.id||"",
          entityLabel:entity.label||"Saída de região"
        });
      }
    }
    return links;
  }

  async deleteWorld(id){
    const entry=this.allWorldEntries().find(world=>world.id===id);
    if(!entry)return false;

    const links=await this.worldInboundLinks(id);
    if(links.length){
      const description=links.map(link=>"- "+link.worldName+" ("+link.worldId+") · "+link.entityLabel).join("\n");
      alert("Esta região não pode ser apagada porque ainda recebe link de acesso:\n\n"+description+"\n\nRemova ou altere esses region exits primeiro.");
      return false;
    }

    if(!entry.local){
      alert("Este mundo está versionado no repositório. A exclusão pelo editor está disponível para mundos criados no próprio editor. Para este mundo versionado, remova o arquivo e a entrada do world-catalog no repositório.");
      return false;
    }

    const confirmed=confirm('Apagar definitivamente a região "'+(entry.name||entry.id)+'"?');
    if(!confirmed)return false;

    this.localWorlds=this.localWorlds.filter(item=>item.entry.id!==id);
    this.saveLocalWorlds();

    if(this.worldEditor?.entry?.id===id){
      this.exitWorldWorkspace({restoreScene:true});
    }

    this.renderWorlds();
    return true;
  }

  renderWorlds(){
    const list=this.el?.querySelector("[data-worlds-list]");
    const actions=this.el?.querySelector("[data-worlds-actions]");
    if(!list||!actions)return;
    const worlds=this.allWorldEntries();
    const current=this.worldEditor?.entry?.id||"";

    list.innerHTML=worlds.length?worlds.map(world=>
      '<div class="tq-world-item '+(world.id===current?'is-current':'')+'">'+
        '<button type="button" class="tq-world-item__open" data-world-open="'+this.escapeHtml(world.id)+'">'+
          '<span><b>'+this.escapeHtml(world.name||world.id)+'</b><small>'+this.escapeHtml(world.type||"ocean")+' · '+this.escapeHtml(world.id)+(world.local?' · LOCAL':'')+'</small></span>'+
          '<strong>'+(world.id===current?'ABERTO':'EDITAR')+'</strong>'+
        '</button>'+
        '<button type="button" class="tq-world-item__delete" data-world-delete="'+this.escapeHtml(world.id)+'" '+(world.local?'':'disabled')+' title="'+(world.local?'Apagar mundo':'Região versionada no repositório')+'">🗑</button>'+
      '</div>'
    ).join(""):'<div class="tq-scenes__empty">Nenhuma região cadastrada.</div>';

    list.querySelectorAll("[data-world-open]").forEach(button=>button.addEventListener("click",()=>this.openWorld(button.dataset.worldOpen)));
    list.querySelectorAll("[data-world-delete]").forEach(button=>button.addEventListener("click",()=>this.deleteWorld(button.dataset.worldDelete)));

    actions.innerHTML=this.worldEditor?.active
      ? '<button type="button" data-world-ocean-config>⚙ Oceano</button><button type="button" data-world-region-exit-add>⇄ Saída de região</button><button type="button" data-world-export>⇩ JSON</button><button type="button" data-world-exit>← Cenas</button>'
      : '';

    actions.querySelector("[data-world-ocean-config]")?.addEventListener("click",()=>{
      this.worldEditor.selectEntity(null);
      this.selected=null;
      this.setMode("config");
    });
    actions.querySelector("[data-world-region-exit-add]")?.addEventListener("click",()=>{
      const destinations=this.allWorldEntries().filter(world=>world.id!==this.worldEditor?.entry?.id);
      const entity=this.worldEditor.addRegionExit({destinationWorldId:destinations[0]?.id||""});
      this.selected=entity||null;
      this.toggleWorlds(false);
      this.setMode("config");
      this.renderWorldInspector();
    });
    actions.querySelector("[data-world-export]")?.addEventListener("click",()=>this.worldEditor.exportWorld());
    actions.querySelector("[data-world-exit]")?.addEventListener("click",()=>this.exitWorldWorkspace({restoreScene:true}));
  }

  toggleWorlds(show){
    const panel=this.el.querySelector(".tq-dev__worlds");
    if(show){
      this.closeToolPanels("regions");
      panel.hidden=false;
      this.renderWorlds();
      if(!this.el.querySelector("[data-world-create-form]").hidden)this.populateCreateWorldBackgrounds();
    }else panel.hidden=true;
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
      error.textContent="Já existe uma região com este ID.";
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
      playerSpawn:{
        x:width/2,
        y:Math.max(120,height-420),
        direction:"n"
      },
      player:{
        x:width/2,
        y:Math.max(120,height-420),
        direction:"n",
        src:"./assets/ships/events/halloween/navio_pirata_halloween_tabuada.webp"
      },
      ocean:{active:true,renderer:"webgl",background,preset,...presetDefaults},
      minimap:{enabled:true,frameAsset:"./assets/ui/ui_minimap_frame_pirate_cartoon_hq.webp",showLocations:true,showShips:true,showCamera:true,types:["location","island","ship"]},
      entities:[],
      npcPopulation:{
        enabled:false,
        seed:1,
        spread:{mode:"random-spaced",margin:320,minDistance:360},
        movement:{mode:"straight",speed:80},
        types:[]
      },
      camera:{playZoom:1},
      editor:{cameraX:width/2,cameraY:height/2,zoom:.55},
      meta:{schema:"tq.world",version:1,sourceRevision:revision,editorVersion:1,createdFrom:"tabuada-quest-dev"}
    };
    const entry={id,name,type:"ocean",path:null,local:true};
    this.localWorlds.push({entry,world});
    this.saveLocalWorlds();

    if(this.workspace==="scene"&&!this.sceneBeforeWorld)this.sceneBeforeWorld=structuredClone(this.runtime.scene||null);
    await this.shipEditorReady;
    await this.worldEditor.openLocal(entry,world);
    this.workspace="world";
    this.selected=null;
    if(this.mold)this.mold.hidden=true;
    this.showCreateWorldForm(false);
    this.toggleWorlds(false);
    this.setMode("edit");
    this.renderWorlds();
  }

  async openWorld(id,{preserveMode=false,preservePlayer=false}={}){
    const entry=this.allWorldEntries().find(world=>world.id===id);
    if(!entry)return;
    const previousMode=this.mode;
    const carriedPlayer=preservePlayer
      ?this.persistentPlayerShipProfile(this.worldEditor?.getPlayerConfig?.())
      :null;
    try{
      await this.shipEditorReady;
      if(this.workspace==="scene"&&!this.sceneBeforeWorld)this.sceneBeforeWorld=structuredClone(this.runtime.scene||null);
      this.removeWorldSceneBackButton();
      const local=this.localWorlds.find(item=>item.entry.id===id);
      if(local)await this.worldEditor.openLocal(local.entry,local.world);
      else await this.worldEditor.open(entry);
      this.workspace="world";
      this.selected=null;
      if(carriedPlayer)this.worldEditor.updatePlayerConfig(carriedPlayer,false);
      if(this.mold)this.mold.hidden=true;
      this.toggleWorlds(false);
      this.setMode(preserveMode&&["edit","config","play"].includes(previousMode)?previousMode:"edit");
      this.renderWorlds();
    }catch(error){
      console.error("World open failed",error);
      const list=this.el.querySelector("[data-worlds-list]");
      if(list)list.insertAdjacentHTML("afterbegin",'<div class="tq-scenes__error">Falha ao abrir a região.</div>');
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
        content.innerHTML='<div class="tq-dev__empty">Abra um região para configurar o oceano.</div>';
        return;
      }

      const presetOptions=[["calm","Calmo"],["adventure","Aventura"],["storm","Tempestade"]]
        .map(([value,label])=>'<option value="'+value+'" '+(ocean.preset===value?'selected':'')+'>'+label+'</option>').join("");
      const environmentPreset=String(world.environment?.preset||"day");
      const cloudConfig={
        active:world.environment?.clouds?.active!==false,
        density:Number(world.environment?.clouds?.density??.5),
        opacity:Number(world.environment?.clouds?.opacity??.5),
        scale:Number(world.environment?.clouds?.scale??1),
        speed:Number(world.environment?.clouds?.speed??18),
        direction:Number(world.environment?.clouds?.direction??0),
        parallax:Number(world.environment?.clouds?.parallax??.18)
      };
      const environmentOptions=[["day","Dia"],["night","Noite"],["storm","Tempestade"],["snow","Nevando"],["halloween","Halloween"]]
        .map(([value,label])=>'<option value="'+value+'" '+(environmentPreset===value?'selected':'')+'>'+label+'</option>').join("");
      const backgroundOptions=this.worldBackgroundOptions(ocean.background);
      const number=(key,label,min,max,step="1")=>'<label class="tq-world-field"><span>'+label+'</span><input data-ocean-prop="'+key+'" type="number" min="'+min+'" max="'+max+'" step="'+step+'" value="'+this.escapeHtml(ocean[key]??"")+'"></label>';
      const cameraPlayZoom=Math.max(.55,Math.min(1.4,Number(world.camera?.playZoom??1)));
      const testAmmo=Array.isArray(this.ammoEditor?.all?.())?this.ammoEditor.all().filter(item=>item?.available!==false):[];
      const selectedTestAmmoId=String(world.test?.ammoId||this.ammoEditor?.catalog?.defaultAmmoId||testAmmo[0]?.id||"cannonball-standard");
      const testAmmoOptions=testAmmo.map(item=>'<option value="'+this.escapeHtml(item.id)+'" '+(selectedTestAmmoId===String(item.id)?'selected':'')+'>'+this.escapeHtml(item.name||item.id)+'</option>').join("");
      const testCannons=(Array.isArray(this.cannonCatalog?.cannons)?this.cannonCatalog.cannons:[]).filter(item=>item?.available!==false);
      const defaultTestCannonId=String(this.cannonCatalog?.defaultCannonId||testCannons[0]?.id||"cannon-basic");
      const selectedTestCannonIds=(Array.isArray(world.test?.cannonIds)&&world.test.cannonIds.length?world.test.cannonIds:[defaultTestCannonId]).map(String);
      const testCannonOptions=testCannons.map(item=>'<option value="'+this.escapeHtml(item.id)+'">'+this.escapeHtml(item.name||item.id)+' · alcance '+Math.round(Number(item.range)||0)+' · '+Math.round(Number(item.projectileSpeed)||0)+' px/s</option>').join("");
      const testCannonRows=selectedTestCannonIds.map((id,index)=>{const cannon=testCannons.find(item=>String(item.id)===id);return '<div class="tq-world-npc-row"><strong>'+this.escapeHtml(cannon?.name||id)+'</strong><small>alcance '+Math.round(Number(cannon?.range)||0)+' · velocidade '+Math.round(Number(cannon?.projectileSpeed)||0)+' px/s</small><button type="button" data-test-cannon-remove="'+index+'" '+(selectedTestCannonIds.length<=1?'disabled':'')+'>Remover</button></div>'}).join("");
      const player=this.worldEditor?.getPlayerConfig()||world.player||{};
      const npcPopulation=world.npcPopulation&&typeof world.npcPopulation==="object"
        ?structuredClone(world.npcPopulation)
        :{enabled:false,seed:1,spread:{mode:"random-spaced",margin:320,minDistance:360},movement:{mode:"straight",speed:80},types:[]};
      npcPopulation.spread={mode:"random-spaced",margin:320,minDistance:360,...(npcPopulation.spread||{})};
      npcPopulation.movement={mode:"straight",speed:80,...(npcPopulation.movement||{})};
      npcPopulation.types=Array.isArray(npcPopulation.types)?npcPopulation.types:[];
      const availableShips=(this.shipEditor?.repositoryShips?.()||[])
        .map(ship=>this.shipEditor.normalizeShip(ship));
      const npcProfiles=this.npcEditor?.all?.()||[];
      const npcOptions=selected=>npcProfiles.map(npc=>
        '<option value="'+this.escapeHtml(npc.id)+'" '+(String(selected||"")===npc.id?'selected':'')+'>'+this.escapeHtml(npc.name||npc.id)+'</option>'
      ).join("");
      const npcRows=npcPopulation.types.map((item,index)=>
        '<div class="tq-world-npc-row" data-npc-row="'+index+'">'+
          '<label class="tq-world-field"><span>NPC</span><select data-npc-type-id="'+index+'">'+npcOptions(item.npcId||item.shipId)+'</select></label>'+
          '<label class="tq-world-field"><span>Quantidade</span><input data-npc-type-count="'+index+'" type="number" min="0" max="50" value="'+Math.max(0,Number(item.count)||0)+'"></label>'+
          '<label class="tq-world-field"><span>Respawn</span><select data-npc-type-respawn="'+index+'"><option value="false" '+(item.respawn===true?'':'selected')+'>Não</option><option value="true" '+(item.respawn===true?'selected':'')+'>Sim</option></select></label>'+
          '<label class="tq-world-field"><span>Moedas</span><input data-npc-reward-coins="'+index+'" type="number" min="0" value="'+Math.max(0,Number(item.rewards?.coins)||0)+'"></label>'+
          '<label class="tq-world-field"><span>XP</span><input data-npc-reward-xp="'+index+'" type="number" min="0" value="'+Math.max(0,Number(item.rewards?.xp)||0)+'"></label>'+
          '<label class="tq-world-field"><span>Item recompensa</span><input data-npc-reward-item="'+index+'" value="'+this.escapeHtml(item.rewards?.itemId||'')+'"></label>'+
          '<label class="tq-world-field"><span>Quantidade item</span><input data-npc-reward-quantity="'+index+'" type="number" min="1" value="'+Math.max(1,Number(item.rewards?.quantity)||1)+'"></label>'+
          '<button type="button" class="tq-world-npc-remove" data-npc-type-remove="'+index+'" aria-label="Remover NPC">×</button>'+
        '</div>'
      ).join("");
      const directionLabels={n:"N",ne:"NE",e:"E",se:"SE",s:"S",sw:"SW",w:"W",nw:"NW"};
      const sprite=player.sprite||{};
      const spriteSrc=String(sprite.src||"");
      const inferredPlayerShip=availableShips.find(ship=>
        String(ship.navigation?.src||ship.navigation?.sprite?.src||"")===spriteSrc
      )?.id||"";
      const selectedPlayerShipId=String(player.shipId||inferredPlayerShip||"");
      const selectedPlayerShip=availableShips.find(ship=>ship.id===selectedPlayerShipId)||null;
      const playerShipOptions=
        (!selectedPlayerShipId?'<option value="" selected disabled>Selecione um navio do catálogo</option>':'')+
        availableShips.map(ship=>
          '<option value="'+this.escapeHtml(ship.id)+'" '+(selectedPlayerShipId===ship.id?'selected':'')+'>'+this.escapeHtml(ship.name||ship.id)+'</option>'
        ).join("");
      const playerEffects={
        wakeActive:player.effects?.wakeActive!==false,
        wakeScale:Number(player.effects?.wakeScale??1),
        wakeOpacity:Number(player.effects?.wakeOpacity??.78),
        wakeWidth:Number(player.effects?.wakeWidth??66),
        wakeLength:Number(player.effects?.wakeLength??240),
        shadowActive:player.effects?.shadowActive!==false,
        shadowOpacity:Number(player.effects?.shadowOpacity??.34),
        shadowBlur:Number(player.effects?.shadowBlur??9),
        shadowOffset:Number(player.effects?.shadowOffset??12)
      };
      const spriteColumns=Math.max(1,Number(sprite.columns)||8);
      const spriteRows=Math.max(1,Number(sprite.rows)||1);
      const regions=sprite.regions||{};
      const preferPointMode=Boolean(globalThis.matchMedia?.("(pointer: coarse)")?.matches||globalThis.matchMedia?.("(max-width: 768px)")?.matches);
      const directionVisual={
        n:{icon:"↑",label:"Para cima"},
        nne:{icon:"↗",label:"Quase para cima, levemente à direita"},
        ne:{icon:"↗",label:"Diagonal para cima e direita"},
        ene:{icon:"→",label:"Quase para direita, levemente para cima"},
        e:{icon:"→",label:"Para direita"},
        ese:{icon:"→",label:"Quase para direita, levemente para baixo"},
        se:{icon:"↘",label:"Diagonal para baixo e direita"},
        sse:{icon:"↘",label:"Quase para baixo, levemente à direita"},
        s:{icon:"↓",label:"Para baixo"},
        ssw:{icon:"↙",label:"Quase para baixo, levemente à esquerda"},
        sw:{icon:"↙",label:"Diagonal para baixo e esquerda"},
        wsw:{icon:"←",label:"Quase para esquerda, levemente para baixo"},
        w:{icon:"←",label:"Para esquerda"},
        wnw:{icon:"←",label:"Quase para esquerda, levemente para cima"},
        nw:{icon:"↖",label:"Diagonal para cima e esquerda"},
        nnw:{icon:"↖",label:"Quase para cima, levemente à esquerda"}
      };
      const spriteImageWidth=Math.max(1,Number(sprite.imageWidth)||1);
      const spriteImageHeight=Math.max(1,Number(sprite.imageHeight)||1);
      const firstMissing=Object.keys(directionVisual).find(key=>!regions[key])||"n";
      const previewStyle=key=>{
        const r=regions[key];
        if(!r||spriteImageWidth<=1||spriteImageHeight<=1)return "";
        const sizeX=spriteImageWidth/Math.max(1,r.width)*100;
        const sizeY=spriteImageHeight/Math.max(1,r.height)*100;
        const posX=spriteImageWidth<=r.width?0:r.x/(spriteImageWidth-r.width)*100;
        const posY=spriteImageHeight<=r.height?0:r.y/(spriteImageHeight-r.height)*100;
        const polygon=Array.isArray(r.points)&&r.points.length>=3
          ? r.points.map(point=>{
            const px=Math.max(0,Math.min(100,((Number(point.x)-Number(r.x))/Math.max(1,Number(r.width)))*100));
            const py=Math.max(0,Math.min(100,((Number(point.y)-Number(r.y))/Math.max(1,Number(r.height)))*100));
            return px.toFixed(2)+"% "+py.toFixed(2)+"%";
          }).join(",")
          : "";
        return 'background-image:url(&quot;'+this.escapeHtml(spriteSrc)+'&quot;);background-size:'+sizeX+'% '+sizeY+'%;background-position:'+posX+'% '+posY+'%;'+(polygon?'clip-path:polygon('+polygon+');':'');
      };
      const directionRegionCards=Object.entries(directionVisual).map(([key,info])=>{
        const configured=Boolean(regions[key]);
        return '<button type="button" class="tq-world-direction16__item '+(configured?'is-configured':'')+'" data-player-region-edit="'+key+'" title="'+this.escapeHtml(info.label)+'">'+
          '<span class="tq-world-direction16__icon">'+info.icon+'</span>'+
          '<span class="tq-world-direction16__thumb" style="'+previewStyle(key)+'">'+(configured?'':'＋')+'</span>'+
          '<small>'+this.escapeHtml(info.label)+'</small>'+
        '</button>';
      }).join("");
      const grid4Cells=Array.from({length:16},(_,index)=>
        '<button type="button" class="tq-world-atlas-grid4__cell" data-atlas-grid-cell="'+index+'" aria-label="Quadro '+(index+1)+'"></button>'
      ).join("");
      const shaderRange=(key,label,min,max,step="1",suffix="")=>{
        const value=Number(ocean[key]??0);
        return '<label class="tq-world-motion-range"><span><b>'+label+'</b><output data-ocean-output="'+key+'">'+value+suffix+'</output></span>'+
          '<input data-ocean-prop="'+key+'" type="range" min="'+min+'" max="'+max+'" step="'+step+'" value="'+value+'" data-ocean-suffix="'+suffix+'"></label>';
      };
      const playerEffectRange=(key,label,min,max,step="1",suffix="")=>{
        const value=Number(playerEffects[key]??0);
        const shown=Math.round(value*100)/100;
        return '<label class="tq-world-motion-range"><span><b>'+label+'</b><output data-player-effect-output="'+key+'">'+shown+suffix+'</output></span>'+
          '<input data-player-effect-prop="'+key+'" type="range" min="'+min+'" max="'+max+'" step="'+step+'" value="'+value+'" data-player-effect-suffix="'+suffix+'"></label>';
      };

      title.textContent=(world.name||world.id)+" · região oceânica";
      content.innerHTML=
        '<div class="tq-inspector">'+
          '<section class="tq-config-area"><button type="button" class="tq-config-area__head" data-area-toggle aria-expanded="false"><strong>Região</strong><span>▸</span></button><div class="tq-config-area__body" hidden>'+
            '<label class="tq-world-field"><span>Nome</span><input data-world-root-prop="name" type="text" value="'+this.escapeHtml(world.name||"")+'"></label>'+
            '<label class="tq-world-field"><span>ID</span><input value="'+this.escapeHtml(world.id)+'" readonly></label>'+
            '<label class="tq-world-field"><span>Largura</span><input data-world-root-prop="width" type="number" min="390" max="20000" value="'+world.width+'"></label>'+
            '<label class="tq-world-field"><span>Altura</span><input data-world-root-prop="height" type="number" min="844" max="20000" value="'+world.height+'"></label>'+
          '</div></section>'+
          '<section class="tq-config-area tq-config-area--npc-map">'+
            '<label class="tq-field tq-field--check"><span>NPCs ativos nesta região</span><input data-npc-enabled type="checkbox" '+(npcPopulation.enabled===true?'checked':'')+'></label>'+
            '<button type="button" class="tq-config-area__head" data-area-toggle aria-expanded="false"><strong>🚢 NPCs do mapa</strong><span>▸</span></button><div class="tq-config-area__body" hidden>'+
            '<div class="tq-worlds__create-grid">'+
              '<label class="tq-world-field"><span>Espalhamento</span><select data-npc-spread-mode><option value="random-spaced" '+(npcPopulation.spread.mode==="random-spaced"?'selected':'')+'>Aleatório espaçado</option><option value="random" '+(npcPopulation.spread.mode==="random"?'selected':'')+'>Aleatório livre</option></select></label>'+
              '<label class="tq-world-field"><span>Margem das bordas</span><input data-npc-spread-margin type="number" min="0" max="2000" value="'+Math.max(0,Number(npcPopulation.spread.margin)||0)+'"></label>'+
              '<label class="tq-world-field"><span>Distância mínima</span><input data-npc-spread-distance type="number" min="0" max="1800" value="'+Math.max(0,Number(npcPopulation.spread.minDistance)||0)+'"></label>'+
              '<label class="tq-world-field"><span>Velocidade dos NPCs</span><input data-npc-movement-speed type="number" min="0" max="1200" value="'+Math.max(0,Number(npcPopulation.movement.speed)||0)+'"></label>'+
            '</div>'+
            '<div class="tq-world-npc-types">'+(npcRows||'<div class="tq-world-editor-note">Nenhum tipo de NPC configurado.</div>')+'</div>'+
            '<div class="tq-world-npc-actions"><button type="button" data-npc-type-add '+(npcProfiles.length?'':'disabled')+'>＋ Adicionar tipo</button><button type="button" data-npc-redistribute>⟳ Redistribuir</button><small>Seed '+Math.max(1,Number(npcPopulation.seed)||1)+'</small></div>'+
            '<small class="tq-world-editor-note">NPCs usam o modelo visual e os atributos de combate do catálogo, mas velocidade e vida são configuradas nesta região. O navio do jogador usa os atributos globais do catálogo.</small>'+
          '</div></section>'+
          '<section class="tq-config-area tq-config-area--ocean-background"><button type="button" class="tq-config-area__head" data-area-toggle aria-expanded="false"><strong>🌊 Fundo do oceano</strong><span>▸</span></button><div class="tq-config-area__body" hidden>'+
            '<label class="tq-world-field"><span>Textura / background</span><select data-ocean-prop="background">'+backgroundOptions+'</select></label>'+
            '<small class="tq-world-editor-note">Escolha a textura base deste mar. Esta configuração pertence ao região atual e pode ser diferente em cada região.</small>'+
          '</div></section>'+
          '<section class="tq-config-area"><button type="button" class="tq-config-area__head" data-area-toggle aria-expanded="false"><strong>💣 Munição de teste</strong><span>▸</span></button><div class="tq-config-area__body" hidden>'+
            '<label class="tq-world-field"><span>Munição ativa</span><select data-world-test-ammo>'+testAmmoOptions+'</select></label>'+
            '<small class="tq-world-editor-note">Usada somente neste ambiente de teste. O estoque é ilimitado aqui e não altera o inventário real do jogador.</small>'+
          '</div></section>'+
          '<section class="tq-config-area"><button type="button" class="tq-config-area__head" data-area-toggle aria-expanded="false"><strong>🧨 Canhões de teste</strong><span>▸</span></button><div class="tq-config-area__body" hidden>'+
            '<div class="tq-world-npc-types">'+testCannonRows+'</div>'+
            '<label class="tq-world-field"><span>Adicionar canhão</span><select data-test-cannon-add><option value="">Selecione...</option>'+testCannonOptions+'</select></label>'+
            '<small class="tq-world-editor-note">Loadout exclusivo do DEV. Cada canhão dispara um projétil próprio e mantém alcance, velocidade e cadência individuais.</small>'+
          '</div></section>'+
          '<section class="tq-config-area"><button type="button" class="tq-config-area__head" data-area-toggle aria-expanded="false"><strong>Câmera do jogo</strong><span>▸</span></button><div class="tq-config-area__body" hidden>'+
            '<label class="tq-world-motion-range"><span><b>Zoom da câmera</b><output data-world-camera-output="playZoom">'+cameraPlayZoom.toFixed(2)+'x</output></span>'+
              '<input data-world-camera-prop="playZoom" type="range" min="0.55" max="1.40" step="0.01" value="'+cameraPlayZoom+'">'+
            '</label>'+
            '<div class="tq-world-camera-scale"><small>0.55x · mais longe</small><small>1.00x · padrão</small><small>1.40x · mais perto</small></div>'+
            '<small class="tq-world-editor-note">Esse valor é salvo neste oceano. Afeta somente o enquadramento visual no Play, sem mudar velocidade, física ou colisões.</small>'+
          '</div></section>'+
          '<section class="tq-config-area"><button type="button" class="tq-config-area__head" data-area-toggle aria-expanded="false"><strong>Minimapa</strong><span>▸</span></button><div class="tq-config-area__body" hidden>'+
            '<label class="tq-field tq-field--check"><span>Minimapa ativo</span><input data-world-minimap-prop="enabled" type="checkbox" '+(world.minimap?.enabled!==false?'checked':'')+'></label>'+
            '<label class="tq-world-field"><span>Moldura</span><select data-world-minimap-prop="frameAsset">'+
              '<option value="./assets/ui/ui_minimap_frame_pirate_cartoon_hq.webp" '+(String(world.minimap?.frameAsset||"./assets/ui/ui_minimap_frame_pirate_cartoon_hq.webp")==="./assets/ui/ui_minimap_frame_pirate_cartoon_hq.webp"?'selected':'')+'>Pirata padrão</option>'+
              '<option value="./assets/ui/ui_minimap_frame_pirate_halloween_hq.webp" '+(String(world.minimap?.frameAsset||"")==="./assets/ui/ui_minimap_frame_pirate_halloween_hq.webp"?'selected':'')+'>Halloween</option>'+
              '<option value="" '+(world.minimap?.frameAsset===""?'selected':'')+'>Sem moldura</option>'+
            '</select></label>'+
            '<label class="tq-field tq-field--check"><span>Mostrar ilhas/localizações</span><input data-world-minimap-prop="showLocations" type="checkbox" '+(world.minimap?.showLocations!==false?'checked':'')+'></label>'+
            '<label class="tq-field tq-field--check"><span>Mostrar outros navios</span><input data-world-minimap-prop="showShips" type="checkbox" '+(world.minimap?.showShips!==false?'checked':'')+'></label>'+
            '<label class="tq-field tq-field--check"><span>Mostrar área da câmera</span><input data-world-minimap-prop="showCamera" type="checkbox" '+(world.minimap?.showCamera!==false?'checked':'')+'></label>'+
            '<small class="tq-world-editor-note">A moldura padrão é a versão pirata normal. Halloween só é usada quando este oceano escolher explicitamente essa opção.</small>'+
          '</div></section>'+
          '<section class="tq-config-area"><button type="button" class="tq-config-area__head" data-area-toggle aria-expanded="false"><strong>Mensagens de colisão</strong><span>▸</span></button><div class="tq-config-area__body" hidden>'+
            '<label class="tq-world-field"><span>Asset da mensagem</span><input data-world-ui-prop="interactionMessageAsset" type="text" value="'+this.escapeHtml(world.ui?.interactionMessageAsset||"")+'" placeholder="./assets/..."></label>'+
            '<small class="tq-world-editor-note">Se houver um asset, a mensagem de colisão é escrita sobre ele. Se ficar vazio, o jogo usa uma caixa de texto padrão.</small>'+
          '</div></section>'+
          '<section class="tq-config-area"><button type="button" class="tq-config-area__head" data-area-toggle aria-expanded="false"><strong>Área jogável</strong><span>▸</span></button><div class="tq-config-area__body" hidden>'+
            '<small class="tq-world-editor-note">Limite real de navegação. Deixe espaço externo para câmera, horizonte e decoração.</small>'+
            '<div class="tq-worlds__create-grid">'+
              '<label class="tq-world-field"><span>X inicial</span><input data-world-playable-prop="x" type="number" min="0" max="'+world.width+'" value="'+Number(world.playableArea?.x??0)+'"></label>'+
              '<label class="tq-world-field"><span>Y inicial</span><input data-world-playable-prop="y" type="number" min="0" max="'+world.height+'" value="'+Number(world.playableArea?.y??0)+'"></label>'+
              '<label class="tq-world-field"><span>Largura jogável</span><input data-world-playable-prop="width" type="number" min="200" max="'+world.width+'" value="'+Number(world.playableArea?.width??world.width)+'"></label>'+
              '<label class="tq-world-field"><span>Altura jogável</span><input data-world-playable-prop="height" type="number" min="200" max="'+world.height+'" value="'+Number(world.playableArea?.height??world.height)+'"></label>'+
            '</div>'+
          '</div></section>'+
          '<section class="tq-config-area"><button type="button" class="tq-config-area__head" data-area-toggle aria-expanded="false"><strong>Navio do jogador</strong><span>▸</span></button><div class="tq-config-area__body" hidden>'+
            '<label class="tq-world-field"><span>Navio do catálogo</span><select data-player-ship-id>'+playerShipOptions+'</select></label>'+
            (selectedPlayerShip
              ?'<div class="tq-world-editor-note"><strong>'+this.escapeHtml(selectedPlayerShip.name||selectedPlayerShip.id)+'</strong> · '+Math.round(Number(selectedPlayerShip.navigation?.width)||230)+'×'+Math.round(Number(selectedPlayerShip.navigation?.height)||230)+' px · '+Math.round(Number(selectedPlayerShip.navigation?.speed)||420)+' px/s · casco '+Math.max(50,Math.min(1000,Math.round(Number(selectedPlayerShip.combat?.hp)||50)))+' HP · alcance '+Math.round(Number(selectedPlayerShip.combat?.attackRange)||1200)+' px</div>'
              :'<small class="tq-world-editor-note">Selecione um navio já pronto no catálogo. Criação, spritesheet, física e combate são configurados no editor de Navios.</small>')+
            '<small class="tq-world-editor-note">Esta região salva apenas qual navio será usado pelo jogador. O perfil completo continua pertencendo ao catálogo. A vida base vem do navio; itens e tripulação podem ampliar o casco até 1000 HP.</small>'+
          '</div></section>'+
          '<section class="tq-config-area"><button type="button" class="tq-config-area__head" data-area-toggle aria-expanded="false"><strong>Ambiente</strong><span>▸</span></button><div class="tq-config-area__body" hidden>'+
            '<label class="tq-world-field"><span>Predefinição</span><select data-environment-preset>'+environmentOptions+'</select></label>'+
            '<div class="tq-world-player-fx">'+
              '<strong>Nuvens</strong>'+
              '<label class="tq-field tq-field--check"><span>Nuvens ativas</span><input data-cloud-prop="active" type="checkbox" '+(cloudConfig.active?'checked':'')+'></label>'+
              '<label class="tq-world-motion-range"><span>Densidade</span><input data-cloud-prop="density" type="range" min="0" max="1" step=".05" value="'+cloudConfig.density+'"><output>'+Math.round(cloudConfig.density*100)+'%</output></label>'+
              '<label class="tq-world-motion-range"><span>Opacidade</span><input data-cloud-prop="opacity" type="range" min="0" max="1" step=".05" value="'+cloudConfig.opacity+'"><output>'+Math.round(cloudConfig.opacity*100)+'%</output></label>'+
              '<label class="tq-world-motion-range"><span>Escala</span><input data-cloud-prop="scale" type="range" min=".4" max="2.5" step=".05" value="'+cloudConfig.scale+'"><output>'+cloudConfig.scale.toFixed(2)+'×</output></label>'+
              '<label class="tq-world-motion-range"><span>Velocidade</span><input data-cloud-prop="speed" type="range" min="0" max="120" step="1" value="'+cloudConfig.speed+'"><output>'+Math.round(cloudConfig.speed)+'</output></label>'+
              '<label class="tq-world-motion-range"><span>Direção</span><input data-cloud-prop="direction" type="range" min="-180" max="180" step="5" value="'+cloudConfig.direction+'"><output>'+Math.round(cloudConfig.direction)+'°</output></label>'+
              '<label class="tq-world-motion-range"><span>Parallax</span><input data-cloud-prop="parallax" type="range" min="0" max="1" step=".05" value="'+cloudConfig.parallax+'"><output>'+Math.round(cloudConfig.parallax*100)+'%</output></label>'+
            '</div>'+
            '<small class="tq-world-editor-note">As nuvens são independentes de chuva e neve. Elas continuam visíveis em Configuração para ajuste ao vivo e usam a mesma configuração no Play.</small>'+
          '</div></section>'+
          '<section class="tq-config-area"><button type="button" class="tq-config-area__head" data-area-toggle aria-expanded="false"><strong>WebGL · textura e cor</strong><span>▸</span></button><div class="tq-config-area__body" hidden>'+
            '<label class="tq-field tq-field--check"><span>Movimento ativo</span><input data-ocean-prop="active" type="checkbox" '+(ocean.active?'checked':'')+'></label>'+
            '<label class="tq-world-field"><span>Renderer</span><select data-ocean-prop="renderer"><option value="webgl" '+(ocean.renderer==="webgl"?'selected':'')+'>WebGL2</option><option value="css" '+(ocean.renderer==="css"?'selected':'')+'>CSS fallback</option></select></label>'+
            '<label class="tq-world-field"><span>Predefinição</span><select data-ocean-prop="preset">'+presetOptions+'</select></label>'+
            shaderRange("tileSize","Escala da textura",240,1600,10," px")+
            shaderRange("brightness","Brilho",50,150,1,"%")+
            shaderRange("saturation","Saturação",0,180,1,"%")+
            shaderRange("contrast","Contraste",50,150,1,"%")+
            shaderRange("tintR","Tom vermelho",50,150,1,"%")+
            shaderRange("tintG","Tom verde",50,150,1,"%")+
            shaderRange("tintB","Tom azul",50,150,1,"%")+
            '<small class="tq-world-editor-note">WebGL2 é o renderer principal. CSS fica apenas como fallback de compatibilidade.</small>'+
          '</div></section>'+
          '<section class="tq-config-area"><button type="button" class="tq-config-area__head" data-area-toggle aria-expanded="false"><strong>WebGL · movimento</strong><span>▸</span></button><div class="tq-config-area__body" hidden>'+
            shaderRange("speed","Velocidade",0,100,1)+
            shaderRange("directionX","Direção horizontal",-1,1,.01)+
            shaderRange("directionY","Direção vertical",-1,1,.01)+
            shaderRange("swell","Ondulação",0,100,1)+
            shaderRange("distortion","Distorção UV",0,100,1)+
            '<small class="tq-world-ocean-note">Direção controla o fluxo global. Ondulação e distorção alteram a deformação da superfície na GPU.</small>'+
          '</div></section>'+
          '<section class="tq-config-area"><button type="button" class="tq-config-area__head" data-area-toggle aria-expanded="false"><strong>WebGL · ondas e profundidade</strong><span>▸</span></button><div class="tq-config-area__body" hidden>'+
            shaderRange("waveFrequencyA","Frequência de onda A",2,60,1)+
            shaderRange("waveFrequencyB","Frequência de onda B",2,60,1)+
            shaderRange("waveMix","Mistura das ondas",0,100,1,"%")+
            shaderRange("foamMix","Espuma / cristas",0,100,1,"%")+
            '<small class="tq-world-editor-note">As duas frequências cruzadas quebram o padrão repetitivo e criam leitura de profundidade sem mover camadas DOM.</small>'+
          '</div></section>'+
          '<section class="tq-config-area"><button type="button" class="tq-config-area__head" data-area-toggle aria-expanded="false"><strong>WebGL · luz e reflexo</strong><span>▸</span></button><div class="tq-config-area__body" hidden>'+
            shaderRange("sparkleIntensity","Intensidade dos reflexos",0,100,1,"%")+
            shaderRange("sparkleSharpness","Nitidez dos reflexos",2,48,1)+
            '<small class="tq-world-editor-note">Controla os brilhos especulares dourados calculados no fragment shader.</small>'+
          '</div></section>'+
        '</div>';

      this.bindCollapsedAreas(content);

      content.querySelectorAll("[data-world-root-prop]").forEach(input=>input.addEventListener("change",()=>{
        const key=input.dataset.worldRootProp;
        const value=["width","height"].includes(key)?Number(input.value):input.value;
        this.worldEditor.updateWorld({[key]:value},true);
        this.syncLocalWorldFromEditor();
        this.renderWorlds();
        this.renderWorldInspector();
      }));

      const saveNpcPopulation=next=>{
        this.worldEditor.updateWorld({npcPopulation:next},true);
        this.syncLocalWorldFromEditor();
        this.renderWorldInspector();
      };
      const currentNpcPopulation=()=>structuredClone(this.worldEditor?.getWorld()?.npcPopulation||npcPopulation);

      content.querySelector("[data-npc-enabled]")?.addEventListener("change",event=>{
        const next=currentNpcPopulation();
        next.enabled=event.currentTarget.checked;
        saveNpcPopulation(next);
      });
      content.querySelector("[data-npc-spread-mode]")?.addEventListener("change",event=>{
        const next=currentNpcPopulation();
        next.spread={...(next.spread||{}),mode:event.currentTarget.value};
        saveNpcPopulation(next);
      });
      content.querySelector("[data-npc-spread-margin]")?.addEventListener("change",event=>{
        const next=currentNpcPopulation();
        next.spread={...(next.spread||{}),margin:Math.max(0,Number(event.currentTarget.value)||0)};
        saveNpcPopulation(next);
      });
      content.querySelector("[data-npc-spread-distance]")?.addEventListener("change",event=>{
        const next=currentNpcPopulation();
        next.spread={...(next.spread||{}),minDistance:Math.max(0,Number(event.currentTarget.value)||0)};
        saveNpcPopulation(next);
      });
      content.querySelector("[data-npc-movement-speed]")?.addEventListener("change",event=>{
        const next=currentNpcPopulation();
        next.movement={mode:"straight",speed:Math.max(0,Number(event.currentTarget.value)||0)};
        saveNpcPopulation(next);
      });
      content.querySelector("[data-npc-type-add]")?.addEventListener("click",()=>{
        const firstNpc=this.npcEditor?.all?.()?.[0];
        if(!firstNpc)return;
        const next=currentNpcPopulation();
        next.types=Array.isArray(next.types)?next.types:[];
        next.types.push({npcId:firstNpc.id,shipId:String(firstNpc.shipId||""),count:1,respawn:false,rewards:{coins:0,xp:0,itemId:"",quantity:1}});
        next.enabled=true;
        saveNpcPopulation(next);
      });
      content.querySelector("[data-npc-redistribute]")?.addEventListener("click",()=>{
        const next=currentNpcPopulation();
        next.seed=Math.max(1,Number(next.seed)||1)+1;
        saveNpcPopulation(next);
      });
      content.querySelectorAll("[data-npc-type-remove]").forEach(button=>button.addEventListener("click",()=>{
        const index=Number(button.dataset.npcTypeRemove);
        const next=currentNpcPopulation();
        next.types=(Array.isArray(next.types)?next.types:[]).filter((_,i)=>i!==index);
        saveNpcPopulation(next);
      }));
      const updateNpcType=(index,patch)=>{
        const next=currentNpcPopulation();
        next.types=Array.isArray(next.types)?next.types:[];
        next.types[index]={...(next.types[index]||{}),...patch};
        saveNpcPopulation(next);
      };
      content.querySelectorAll("[data-npc-type-id]").forEach(input=>input.addEventListener("change",()=>updateNpcType(Number(input.dataset.npcTypeId),{npcId:input.value,shipId:String(this.npcEditor?.resolve?.(input.value)?.shipId||"")})));
      content.querySelectorAll("[data-npc-type-count]").forEach(input=>input.addEventListener("change",()=>updateNpcType(Number(input.dataset.npcTypeCount),{count:Math.max(0,Number(input.value)||0)})));
      content.querySelectorAll("[data-npc-reward-coins]").forEach(input=>input.addEventListener("change",()=>{const i=Number(input.dataset.npcRewardCoins),n=currentNpcPopulation(),r={...(n.types?.[i]?.rewards||{}),coins:Math.max(0,Number(input.value)||0)};updateNpcType(i,{rewards:r})}));
      content.querySelectorAll("[data-npc-reward-xp]").forEach(input=>input.addEventListener("change",()=>{const i=Number(input.dataset.npcRewardXp),n=currentNpcPopulation(),r={...(n.types?.[i]?.rewards||{}),xp:Math.max(0,Number(input.value)||0)};updateNpcType(i,{rewards:r})}));
      content.querySelectorAll("[data-npc-reward-item]").forEach(input=>input.addEventListener("change",()=>{const i=Number(input.dataset.npcRewardItem),n=currentNpcPopulation(),r={...(n.types?.[i]?.rewards||{}),itemId:input.value};updateNpcType(i,{rewards:r})}));
      content.querySelectorAll("[data-npc-reward-quantity]").forEach(input=>input.addEventListener("change",()=>{const i=Number(input.dataset.npcRewardQuantity),n=currentNpcPopulation(),r={...(n.types?.[i]?.rewards||{}),quantity:Math.max(1,Number(input.value)||1)};updateNpcType(i,{rewards:r})}));
      content.querySelectorAll("[data-npc-type-respawn]").forEach(input=>input.addEventListener("change",()=>updateNpcType(Number(input.dataset.npcTypeRespawn),{respawn:input.value==="true"})));

      const saveTestCannons=cannonIds=>{
        const ids=cannonIds.length?cannonIds:[defaultTestCannonId];
        this.worldEditor.updateWorld({test:{...(this.worldEditor.getWorld()?.test||{}),cannonIds:ids}},true);
        if(this.worldEditor?.runtime)this.worldEditor.runtime.testCannonIds=[...ids];
        this.syncLocalWorldFromEditor();
        this.renderWorldInspector();
      };
      content.querySelector("[data-test-cannon-add]")?.addEventListener("change",event=>{
        const id=String(event.currentTarget.value||"");
        if(id)saveTestCannons([...selectedTestCannonIds,id]);
      });
      content.querySelectorAll("[data-test-cannon-remove]").forEach(button=>button.addEventListener("click",()=>{
        const index=Number(button.dataset.testCannonRemove);
        saveTestCannons(selectedTestCannonIds.filter((_,i)=>i!==index));
      }));

      content.querySelector("[data-world-test-ammo]")?.addEventListener("change",event=>{
        const ammoId=String(event.currentTarget.value||"");
        this.worldEditor.updateWorld({test:{...(this.worldEditor.getWorld()?.test||{}),ammoId}},true);
        if(this.worldEditor?.runtime?.state?.ammo)this.worldEditor.runtime.state.ammo.selectedAmmoId=ammoId;
        this.syncLocalWorldFromEditor();
      });

      content.querySelectorAll("[data-world-camera-prop]").forEach(input=>{
        const apply=commit=>{
          const key=input.dataset.worldCameraProp;
          const value=Number(input.value);
          const output=content.querySelector('[data-world-camera-output="'+key+'"]');
          if(output)output.value=value.toFixed(2)+"x";
          this.worldEditor.updateWorld({camera:{[key]:value}},commit);
          if(commit)this.syncLocalWorldFromEditor();
        };
        input.addEventListener("input",()=>apply(false));
        input.addEventListener("change",()=>apply(true));
      });

      content.querySelectorAll("[data-world-playable-prop]").forEach(input=>input.addEventListener("change",()=>{
        const key=input.dataset.worldPlayableProp;
        this.worldEditor.updateWorld({playableArea:{[key]:Number(input.value)}},true);
        this.syncLocalWorldFromEditor();
        this.renderWorldInspector();
      }));

      content.querySelectorAll("[data-world-ui-prop]").forEach(input=>input.addEventListener("change",()=>{
        const key=input.dataset.worldUiProp;
        this.worldEditor.updateWorld({ui:{[key]:input.value}},true);
        this.syncLocalWorldFromEditor();
        this.renderWorldInspector();
      }));

      content.querySelectorAll("[data-world-minimap-prop]").forEach(input=>input.addEventListener("change",()=>{
        const key=input.dataset.worldMinimapProp;
        const value=input.type==="checkbox"?input.checked:input.value;
        this.worldEditor.updateWorld({minimap:{[key]:value}},true);
        this.syncLocalWorldFromEditor();
        this.renderWorldInspector();
      }));

      content.querySelector("[data-player-sprite-pick]")?.addEventListener("click",()=>this.openWorldPlayerSpritePicker());

      const atlasCanvas=content.querySelector("[data-atlas-canvas]");
      const atlasImageBox=content.querySelector("[data-atlas-imagebox]");
      const atlasPointsLayer=content.querySelector("[data-atlas-points]");
      const atlasMagnifier=content.querySelector("[data-atlas-magnifier]");
      const directionOrder=["n","nne","ne","ene","e","ese","se","sse","s","ssw","sw","wsw","w","wnw","nw","nnw"];
      let selectionMode=["rectangle","points","grid4"].includes(this.worldAtlasSelectionMode)
        ?this.worldAtlasSelectionMode
        :(preferPointMode?"points":"rectangle");
      const isPointMode=()=>selectionMode==="points";
      const isGridMode=()=>selectionMode==="grid4";
      let atlasDirection=firstMissing;
      let pendingRegion=null;
      let previousRegion=null;
      let polygonPoints=[];
      let polygonClosed=false;

      const clampValue=(value,min,max)=>Math.min(max,Math.max(min,value));
      const imageMetrics=()=>{
        const img=atlasImageBox?.querySelector("img");
        if(!img)return null;
        const rect=img.getBoundingClientRect();
        return {
          img,
          rect,
          naturalW:img.naturalWidth||rect.width||1,
          naturalH:img.naturalHeight||rect.height||1
        };
      };
      const eventPoint=event=>{
        const metrics=imageMetrics();
        if(!metrics)return null;
        return {
          x:clampValue((event.clientX-metrics.rect.left)/metrics.rect.width*metrics.naturalW,0,metrics.naturalW),
          y:clampValue((event.clientY-metrics.rect.top)/metrics.rect.height*metrics.naturalH,0,metrics.naturalH)
        };
      };
      const regionFromPoints=points=>{
        if(!Array.isArray(points)||points.length<3)return null;
        const xs=points.map(point=>Number(point.x));
        const ys=points.map(point=>Number(point.y));
        const x=Math.min(...xs),y=Math.min(...ys);
        const right=Math.max(...xs),bottom=Math.max(...ys);
        return {
          x,y,
          width:Math.max(1,right-x),
          height:Math.max(1,bottom-y),
          points:points.map(point=>({x:Number(point.x),y:Number(point.y)}))
        };
      };
      const savedPolygon=direction=>{
        const points=regions[direction]?.points;
        return Array.isArray(points)&&points.length>=3
          ? points.map(point=>({x:Number(point.x),y:Number(point.y)})).filter(point=>Number.isFinite(point.x)&&Number.isFinite(point.y))
          : [];
      };
      const showMagnifier=(event,point)=>{
        if(!isPointMode()||!atlasMagnifier||!point)return;
        const metrics=imageMetrics();
        if(!metrics)return;
        const box=atlasImageBox.getBoundingClientRect();
        const localX=event.clientX-box.left;
        const localY=event.clientY-box.top;
        const size=88;
        atlasMagnifier.hidden=false;
        atlasMagnifier.style.left=clampValue(localX-size/2,0,Math.max(0,box.width-size))+"px";
        atlasMagnifier.style.top=clampValue(localY-size-42,0,Math.max(0,box.height-size))+"px";
        atlasMagnifier.style.backgroundImage='url("'+String(spriteSrc).replace(/["\\]/g,"")+'")';
        atlasMagnifier.style.backgroundSize=(metrics.rect.width*3)+"px "+(metrics.rect.height*3)+"px";
        atlasMagnifier.style.backgroundPosition=(point.x/metrics.naturalW*100)+"% "+(point.y/metrics.naturalH*100)+"%";
      };
      const hideMagnifier=()=>{if(atlasMagnifier)atlasMagnifier.hidden=true};

      const showSavedRegion=direction=>{
        const selection=content.querySelector("[data-atlas-selection]");
        const metrics=imageMetrics();
        const region=regions[direction];
        if(!selection||!metrics||!region){
          if(selection)selection.hidden=true;
          return;
        }
        const hasPolygon=Array.isArray(region.points)&&region.points.length>=3;
        selection.hidden=isPointMode()&&hasPolygon;
        if(selection.hidden)return;
        selection.style.left=(region.x/metrics.naturalW*100)+"%";
        selection.style.top=(region.y/metrics.naturalH*100)+"%";
        selection.style.width=(region.width/metrics.naturalW*100)+"%";
        selection.style.height=(region.height/metrics.naturalH*100)+"%";
      };

      const updatePolygonGeometry=()=>{
        const metrics=imageMetrics();
        const line=content.querySelector("[data-atlas-polygon-line]");
        const fill=content.querySelector("[data-atlas-polygon-fill]");
        if(!metrics||!line||!fill)return;
        const normalized=polygonPoints.map(point=>(point.x/metrics.naturalW*100).toFixed(4)+","+(point.y/metrics.naturalH*100).toFixed(4));
        const linePoints=polygonClosed&&normalized.length>=3?[...normalized,normalized[0]]:normalized;
        line.setAttribute("points",linePoints.join(" "));
        fill.setAttribute("points",polygonClosed&&normalized.length>=3?normalized.join(" "):"");
        atlasPointsLayer?.querySelectorAll("[data-atlas-point-index]").forEach(handle=>{
          const index=Number(handle.dataset.atlasPointIndex);
          const point=polygonPoints[index];
          if(!point)return;
          handle.style.left=(point.x/metrics.naturalW*100)+"%";
          handle.style.top=(point.y/metrics.naturalH*100)+"%";
        });
      };

      const renderPolygon=()=>{
        const polygon=content.querySelector("[data-atlas-polygon]");
        if(polygon)polygon.hidden=!isPointMode();
        if(!isPointMode())return;
        const selection=content.querySelector("[data-atlas-selection]");
        if(selection&&polygonPoints.length)selection.hidden=true;
        if(atlasPointsLayer){
          atlasPointsLayer.innerHTML=polygonPoints.map((point,index)=>
            '<button type="button" class="tq-world-atlas-point '+(index===0?'is-first':'')+'" data-atlas-point-index="'+index+'" aria-label="Ponto '+(index+1)+'"></button>'
          ).join("");
        }
        updatePolygonGeometry();
        const status=content.querySelector("[data-atlas-point-status]");
        if(status)status.textContent=polygonPoints.length+" ponto"+(polygonPoints.length===1?"":"s")+(polygonClosed?" · contorno fechado":"");
        const undo=content.querySelector("[data-atlas-undo]");
        const clear=content.querySelector("[data-atlas-clear]");
        const close=content.querySelector("[data-atlas-close]");
        const confirm=content.querySelector("[data-atlas-confirm]");
        if(undo)undo.disabled=polygonPoints.length===0;
        if(clear)clear.disabled=polygonPoints.length===0;
        if(close)close.disabled=polygonPoints.length<3||polygonClosed;
        if(confirm)confirm.disabled=polygonPoints.length<3;
      };

      const selectRegion=direction=>{
        atlasDirection=direction;
        pendingRegion=null;
        polygonPoints=savedPolygon(direction);
        polygonClosed=polygonPoints.length>=3;
        content.querySelectorAll("[data-player-region-edit]").forEach(btn=>btn.classList.toggle("is-active",btn.dataset.playerRegionEdit===direction));
        const info=directionVisual[direction];
        const icon=content.querySelector("[data-atlas-direction-icon]");
        const label=content.querySelector("[data-atlas-direction-label]");
        if(icon)icon.textContent=info.icon;
        if(label)label.textContent=info.label;
        showSavedRegion(direction);
        renderPolygon();
      };

      const stepDirection=delta=>{
        const index=directionOrder.indexOf(atlasDirection);
        selectRegion(directionOrder[(index+delta+directionOrder.length)%directionOrder.length]);
      };
      const advanceAfterSave=()=>{
        const currentIndex=directionOrder.indexOf(atlasDirection);
        const nextIndex=currentIndex>=directionOrder.length-1?0:currentIndex+1;
        const nextDirection=directionOrder[nextIndex];
        this.renderWorldInspector();
        requestAnimationFrame(()=>this.el.querySelector('[data-player-region-edit="'+nextDirection+'"]')?.click());
      };
      const saveRegion=region=>{
        const metrics=imageMetrics();
        if(!metrics||!region)return;
        this.worldEditor.updatePlayerConfig({sprite:{
          imageWidth:metrics.naturalW,
          imageHeight:metrics.naturalH,
          regions:{[atlasDirection]:region}
        }},true);
        this.syncLocalWorldFromEditor();
        advanceAfterSave();
      };

      const setSelectionMode=mode=>{
        if(!["rectangle","points","grid4"].includes(mode))return;
        selectionMode=mode;
        this.worldAtlasSelectionMode=mode;
        const wizard=content.querySelector("[data-atlas-wizard]");
        wizard?.classList.toggle("is-point-mode",isPointMode());
        wizard?.classList.toggle("is-grid-mode",isGridMode());
        content.querySelectorAll("[data-atlas-mode]").forEach(button=>button.classList.toggle("is-active",button.dataset.atlasMode===selectionMode));
        const help=content.querySelector("[data-atlas-help]");
        if(help){
          help.textContent=isGridMode()
            ?"Toque no quadrado 4×4 que contém este navio. A célula inteira será usada."
            :(isPointMode()
              ?"Toque ponto a ponto ao redor do navio. Arraste qualquer ponto para ajustar com precisão."
              :"Arraste uma caixa somente em volta desse navio.");
        }
        if(!isPointMode()){
          hideMagnifier();
          const polygon=content.querySelector("[data-atlas-polygon]");
          if(polygon)polygon.hidden=true;
          if(atlasPointsLayer)atlasPointsLayer.innerHTML="";
        }else{
          renderPolygon();
        }
        showSavedRegion(atlasDirection);
      };
      content.querySelectorAll("[data-atlas-mode]").forEach(button=>button.addEventListener("click",()=>setSelectionMode(button.dataset.atlasMode)));
      setSelectionMode(selectionMode);

      content.querySelectorAll("[data-player-region-edit]").forEach(btn=>btn.addEventListener("click",()=>selectRegion(btn.dataset.playerRegionEdit)));
      content.querySelector("[data-atlas-prev]")?.addEventListener("click",()=>stepDirection(-1));
      content.querySelector("[data-atlas-next]")?.addEventListener("click",()=>stepDirection(1));
      content.querySelector("[data-atlas-copy-size]")?.addEventListener("click",()=>{
        const source=previousRegion||directionOrder.map(key=>regions[key]).find(Boolean);
        if(!source)return;
        const current=regions[atlasDirection]||source;
        this.worldEditor.updatePlayerConfig({sprite:{regions:{[atlasDirection]:{x:current.x,y:current.y,width:source.width,height:source.height}}}},true);
        this.syncLocalWorldFromEditor();
        this.renderWorldInspector();
      });
      content.querySelector("[data-atlas-grid4]")?.addEventListener("click",event=>{
        if(!isGridMode())return;
        const cell=event.target.closest?.("[data-atlas-grid-cell]");
        if(!cell)return;
        event.preventDefault();
        event.stopPropagation();
        const metrics=imageMetrics();
        if(!metrics)return;
        const index=Number(cell.dataset.atlasGridCell);
        if(!Number.isInteger(index)||index<0||index>15)return;
        const column=index%4;
        const row=Math.floor(index/4);
        const width=metrics.naturalW/4;
        const height=metrics.naturalH/4;
        saveRegion({
          x:column*width,
          y:row*height,
          width,
          height
        });
      });

      content.querySelector("[data-atlas-grid-fill]")?.addEventListener("click",()=>{
        if(!isGridMode())return;
        const metrics=imageMetrics();
        if(!metrics)return;
        const width=metrics.naturalW/4;
        const height=metrics.naturalH/4;
        const filledRegions={};
        directionOrder.forEach((direction,index)=>{
          const column=index%4;
          const row=Math.floor(index/4);
          filledRegions[direction]={
            x:column*width,
            y:row*height,
            width,
            height
          };
        });
        this.worldAtlasSelectionMode="grid4";
        this.worldEditor.updatePlayerConfig({sprite:{
          imageWidth:metrics.naturalW,
          imageHeight:metrics.naturalH,
          regions:filledRegions
        }},true);
        this.syncLocalWorldFromEditor();
        this.renderWorldInspector();
      });

      content.querySelector("[data-atlas-undo]")?.addEventListener("click",()=>{
        if(!isPointMode()||!polygonPoints.length)return;
        polygonClosed=false;
        polygonPoints.pop();
        renderPolygon();
      });
      content.querySelector("[data-atlas-clear]")?.addEventListener("click",()=>{
        polygonPoints=[];
        polygonClosed=false;
        renderPolygon();
        showSavedRegion(atlasDirection);
      });
      content.querySelector("[data-atlas-close]")?.addEventListener("click",()=>{
        if(polygonPoints.length<3)return;
        polygonClosed=true;
        renderPolygon();
      });
      content.querySelector("[data-atlas-confirm]")?.addEventListener("click",()=>{
        const region=regionFromPoints(polygonPoints);
        if(!region)return;
        polygonClosed=true;
        saveRegion(region);
      });

      atlasPointsLayer?.addEventListener("pointerdown",event=>{
        if(!isPointMode())return;
        const handle=event.target.closest?.("[data-atlas-point-index]");
        if(!handle)return;
        event.preventDefault();
        event.stopPropagation();
        const index=Number(handle.dataset.atlasPointIndex);
        if(!Number.isInteger(index)||!polygonPoints[index])return;
        polygonClosed=false;
        try{handle.setPointerCapture(event.pointerId)}catch{}
        const move=e=>{
          const point=eventPoint(e);
          if(!point)return;
          polygonPoints[index]=point;
          handle.style.left=(point.x/(imageMetrics()?.naturalW||1)*100)+"%";
          handle.style.top=(point.y/(imageMetrics()?.naturalH||1)*100)+"%";
          updatePolygonGeometry();
          showMagnifier(e,point);
        };
        const end=e=>{
          try{if(handle.hasPointerCapture(e.pointerId))handle.releasePointerCapture(e.pointerId)}catch{}
          handle.removeEventListener("pointermove",move);
          handle.removeEventListener("pointerup",end);
          handle.removeEventListener("pointercancel",end);
          hideMagnifier();
          renderPolygon();
        };
        handle.addEventListener("pointermove",move);
        handle.addEventListener("pointerup",end);
        handle.addEventListener("pointercancel",end);
      });

      selectRegion(firstMissing);
      atlasImageBox?.querySelector("img")?.addEventListener("load",()=>{
        showSavedRegion(atlasDirection);
        renderPolygon();
      });

      atlasCanvas?.addEventListener("pointerdown",event=>{
        const metrics=imageMetrics();
        if(!metrics||!atlasImageBox)return;
        if(isGridMode())return;
        if(isPointMode()){
          if(event.target.closest?.("[data-atlas-point-index]"))return;
          event.preventDefault();
          const startPoint=eventPoint(event);
          if(!startPoint)return;
          showMagnifier(event,startPoint);
          try{atlasCanvas.setPointerCapture(event.pointerId)}catch{}
          let currentPoint=startPoint;
          const move=e=>{
            currentPoint=eventPoint(e)||currentPoint;
            showMagnifier(e,currentPoint);
          };
          const finish=e=>{
            currentPoint=eventPoint(e)||currentPoint;
            try{if(atlasCanvas.hasPointerCapture(e.pointerId))atlasCanvas.releasePointerCapture(e.pointerId)}catch{}
            atlasCanvas.removeEventListener("pointermove",move);
            atlasCanvas.removeEventListener("pointerup",finish);
            atlasCanvas.removeEventListener("pointercancel",finish);
            hideMagnifier();
            if(polygonPoints.length>=3){
              const first=polygonPoints[0];
              const threshold=22/Math.max(1,metrics.rect.width)*metrics.naturalW;
              if(Math.hypot(currentPoint.x-first.x,currentPoint.y-first.y)<=threshold){
                polygonClosed=true;
                renderPolygon();
                return;
              }
            }
            polygonClosed=false;
            polygonPoints.push(currentPoint);
            renderPolygon();
          };
          atlasCanvas.addEventListener("pointermove",move);
          atlasCanvas.addEventListener("pointerup",finish);
          atlasCanvas.addEventListener("pointercancel",finish);
          return;
        }

        event.preventDefault();
        const startPoint=eventPoint(event);
        const selection=content.querySelector("[data-atlas-selection]");
        previousRegion=regions[atlasDirection]||previousRegion;
        try{atlasCanvas.setPointerCapture(event.pointerId)}catch{}

        const draw=currentPoint=>{
          const x=Math.min(startPoint.x,currentPoint.x);
          const y=Math.min(startPoint.y,currentPoint.y);
          const width=Math.max(1,Math.abs(currentPoint.x-startPoint.x));
          const height=Math.max(1,Math.abs(currentPoint.y-startPoint.y));
          pendingRegion={x,y,width,height};
          selection.hidden=false;
          selection.style.left=(x/metrics.naturalW*100)+"%";
          selection.style.top=(y/metrics.naturalH*100)+"%";
          selection.style.width=(width/metrics.naturalW*100)+"%";
          selection.style.height=(height/metrics.naturalH*100)+"%";
        };

        draw(startPoint);
        const move=e=>draw(eventPoint(e)||startPoint);
        const finish=e=>{
          draw(eventPoint(e)||startPoint);
          atlasCanvas.removeEventListener("pointermove",move);
          atlasCanvas.removeEventListener("pointerup",finish);
          atlasCanvas.removeEventListener("pointercancel",finish);
          if(!pendingRegion||pendingRegion.width<3||pendingRegion.height<3)return;
          saveRegion(pendingRegion);
        };
        atlasCanvas.addEventListener("pointermove",move);
        atlasCanvas.addEventListener("pointerup",finish);
        atlasCanvas.addEventListener("pointercancel",finish);
      });

      content.querySelector("[data-player-ship-id]")?.addEventListener("change",event=>{
        const shipId=String(event.currentTarget.value||"");
        if(!shipId)return;
        const profile=this.resolveWorldShipProfile(shipId,"player");
        if(!profile)return;
        this.worldEditor.updatePlayerConfig({
          ...profile,
          shipId,
          shipName:profile.shipName||profile.name||shipId,
          combat:structuredClone(profile.combat||{}),
          combatVisual:structuredClone(profile.combatVisual||{})
        },true);
        this.syncLocalWorldFromEditor();
        this.renderWorldInspector();
      });

      content.querySelectorAll("[data-player-prop]").forEach(input=>input.addEventListener("change",()=>{
        const key=input.dataset.playerProp;
        const value=["width","height"].includes(key)?Number(input.value):input.value;
        this.worldEditor.updatePlayerConfig({[key]:value},true);
        this.syncLocalWorldFromEditor();
        this.renderWorldInspector();
      }));

      const playerEffectNumeric=new Set(["wakeOpacity","wakeWidth","wakeLength","shadowOpacity","shadowBlur","shadowOffset"]);
      content.querySelectorAll("[data-player-effect-prop]").forEach(input=>{
        const apply=commit=>{
          const key=input.dataset.playerEffectProp;
          const value=input.type==="checkbox"?input.checked:(playerEffectNumeric.has(key)?Number(input.value):input.value);
          const output=content.querySelector('[data-player-effect-output="'+key+'"]');
          if(output){
            const suffix=input.dataset.playerEffectSuffix||"";
            output.value=String(Math.round(Number(value)*100)/100)+suffix;
          }
          this.worldEditor.updatePlayerConfig({effects:{[key]:value}},commit);
          if(commit)this.syncLocalWorldFromEditor();
        };
        if(input.type==="range")input.addEventListener("input",()=>apply(false));
        input.addEventListener("change",()=>apply(true));
      });

      content.querySelectorAll("[data-cloud-prop]").forEach(input=>{
        const apply=commit=>{
          const key=input.dataset.cloudProp;
          const current=structuredClone(this.worldEditor?.getWorld()?.environment?.clouds||cloudConfig);
          const value=input.type==="checkbox"?input.checked:Number(input.value);
          current[key]=value;
          this.worldEditor.updateWorld({environment:{clouds:current}},commit);
          if(input.type==="range"){
            const output=input.parentElement?.querySelector("output");
            if(output){
              output.value=key==="scale"?(Number(value).toFixed(2)+"×")
                :(["density","opacity","parallax"].includes(key)?(Math.round(Number(value)*100)+"%")
                :(key==="direction"?(Math.round(Number(value))+"°"):String(Math.round(Number(value)))));
            }
          }
          if(commit)this.syncLocalWorldFromEditor();
        };
        if(input.type==="range")input.addEventListener("input",()=>apply(false));
        input.addEventListener("change",()=>apply(true));
      });

      content.querySelector("[data-environment-preset]")?.addEventListener("change",event=>{
        this.worldEditor.applyEnvironmentPreset(event.target.value,true);
        this.syncLocalWorldFromEditor();
        this.renderWorldInspector();
      });

      const numeric=new Set([
        "speed","directionX","directionY","swell","tileSize","brightness","saturation","contrast","tintR","tintG","tintB",
        "distortion","waveFrequencyA","waveFrequencyB","waveMix","foamMix",
        "sparkleIntensity","sparkleSharpness"
      ]);
      content.querySelectorAll("[data-ocean-prop]").forEach(input=>{
        const apply=(commit)=>{
          const key=input.dataset.oceanProp;
          const value=input.type==="checkbox"?input.checked:(numeric.has(key)?Number(input.value):input.value);
          const output=content.querySelector('[data-ocean-output="'+key+'"]');
          if(output){
            const suffix=input.dataset.oceanSuffix||"";
            output.value=String(Math.round(Number(value)*100)/100)+suffix;
          }
          this.worldEditor.updateOcean({[key]:value},commit);
          if(commit)this.syncLocalWorldFromEditor();
          if(commit&&(key==="preset"||key==="renderer"||key==="background"))this.renderWorldInspector();
        };
        if(input.type==="range")input.addEventListener("input",()=>apply(false));
        input.addEventListener("change",()=>apply(true));
      });
      return;
    }

    const motion=this.worldEditor.getEntityMotion(entity.id)||{active:false,preset:"none",speed:50,heave:0,pitch:0,roll:0,sway:0};
    const effect=this.worldEditor.getEntityEffect(entity.id)||{category:"generic",preset:"none",active:false,renderer:"dom",mode:"none",speed:50,intensity:0,range:0,parallax:1,opacity:1,blur:0,distortion:0,glow:0,rotateToPath:false};
    const collision=this.worldEditor.getEntityCollision(entity.id)||{active:false,shape:"ellipse",scaleX:.72,scaleY:.72,padding:0,action:"auto",message:""};
    const waterIntegration={
      active:entity.waterIntegration?.active!==false,
      immersion:Number(entity.waterIntegration?.immersion??.18),
      foam:Number(entity.waterIntegration?.foam??.65),
      foamWidth:Number(entity.waterIntegration?.foamWidth??.12),
      wetness:Number(entity.waterIntegration?.wetness??.5),
      submergedShadow:Number(entity.waterIntegration?.submergedShadow??.42)
    };
    const combat=entity.combat&&typeof entity.combat==="object"?entity.combat:{hp:3};
    const rewards=entity.rewards&&typeof entity.rewards==="object"?entity.rewards:{};
    const shipOptions=(this.shipEditor?.allShips?.()||[]).map(ship=>
      '<option value="'+this.escapeHtml(ship.id)+'" '+(entity.shipId===ship.id?'selected':'')+'>'+this.escapeHtml(ship.name||ship.id)+'</option>'
    ).join("");
    const effectPresetItems=this.worldEditor.listEntityEffectPresets(entity.id)||[];
    const num=(key,label,min="",max="",step="0.01")=>'<label class="tq-world-field"><span>'+label+'</span><input data-world-prop="'+key+'" type="number" '+(min!==""?'min="'+min+'" ':'')+(max!==""?'max="'+max+'" ':'')+'step="'+step+'" value="'+this.escapeHtml(entity[key]??"")+'"></label>';
    const text=(key,label)=>'<label class="tq-world-field"><span>'+label+'</span><input data-world-prop="'+key+'" type="text" value="'+this.escapeHtml(entity[key]??"")+'"></label>';
    const motionRange=(key,label)=>'<label class="tq-world-motion-range"><span><b>'+label+'</b><output data-motion-output="'+key+'">'+Math.round(Number(motion[key]||0))+'</output></span><input data-motion-prop="'+key+'" type="range" min="0" max="100" step="1" value="'+Number(motion[key]||0)+'"></label>';
    const effectRange=(key,label,min,max,step,suffix="")=>'<label class="tq-world-motion-range"><span><b>'+label+'</b><output data-effect-output="'+key+'">'+(Math.round(Number(effect[key]||0)*100)/100)+suffix+'</output></span><input data-effect-prop="'+key+'" data-effect-suffix="'+suffix+'" type="range" min="'+min+'" max="'+max+'" step="'+step+'" value="'+Number(effect[key]??0)+'"></label>';
    const collisionRange=(key,label,min,max,step,suffix="")=>'<label class="tq-world-motion-range"><span><b>'+label+'</b><output data-collision-output="'+key+'">'+(Math.round(Number(collision[key]||0)*100)/100)+suffix+'</output></span><input data-collision-prop="'+key+'" data-collision-suffix="'+suffix+'" type="range" min="'+min+'" max="'+max+'" step="'+step+'" value="'+Number(collision[key]??0)+'"></label>';
    const typeOptions=["object","barrel","treasure","ship","location","island","background","region-exit"].map(value=>'<option value="'+value+'" '+(entity.type===value?'selected':'')+'>'+value+'</option>').join("");
    const effectCategories=[["generic","Genérico"],["treasure","Baú / tesouro"],["sea-item","Item ao mar"],["island","Ilha"],["background","Background / profundidade"],["ship","Navio aleatório"]]
      .map(([value,label])=>'<option value="'+value+'" '+(effect.category===value?'selected':'')+'>'+label+'</option>').join("");
    const effectPresets=effectPresetItems.map(item=>'<option value="'+item.id+'" '+(effect.preset===item.id?'selected':'')+'>'+this.escapeHtml(item.label||item.id)+'</option>').join("");
    const motionPresets=[["none","Sem balanço"],["calm","Mar calmo"],["navigation","Navegação natural"],["rough","Mar agitado"],["heavy","Objeto pesado"]]
      .map(([value,label])=>'<option value="'+value+'" '+(motion.preset===value?'selected':'')+'>'+label+'</option>').join("");
    const destinationWorldOptions=this.allWorldEntries().filter(world=>world.id!==this.worldEditor?.entry?.id).map(world=>
      '<option value="'+this.escapeHtml(world.id)+'" '+(entity.destinationWorldId===world.id?'selected':'')+'>'+this.escapeHtml(world.name||world.id)+' · '+this.escapeHtml(world.id)+'</option>'
    ).join("");
    const legacyInteraction=entity.type==="region-exit"&&entity.destinationWorldId
      ?{actionId:"enter-region",params:{regionId:entity.destinationWorldId,spawnId:entity.destinationSpawnId||""}}
      :(entity.scene?{actionId:"open-scene",params:{sceneId:entity.scene}}:null);
    const interaction=entity.interaction&&typeof entity.interaction==="object"?entity.interaction:(legacyInteraction||{actionId:"",params:{}});
    const actionOptions='<option value="">Nenhuma função</option>'+this.actionDefinitions().map(action=>
      '<option value="'+this.escapeHtml(action.id)+'" '+(interaction.actionId===action.id?'selected':'')+'>'+this.escapeHtml(action.name||action.id)+'</option>'
    ).join("");
    const selectedAction=this.actionDefinition(interaction.actionId);
    const sceneOptions=this.allSceneEntries().map(scene=>
      '<option value="'+this.escapeHtml(scene.id)+'" '+(String(interaction.params?.sceneId||"")===scene.id?'selected':'')+'>'+this.escapeHtml(scene.name||scene.id)+'</option>'
    ).join("");
    const regionOptions=this.allWorldEntries().filter(region=>region.id!==this.worldEditor?.entry?.id).map(region=>
      '<option value="'+this.escapeHtml(region.id)+'" '+(String(interaction.params?.regionId||entity.destinationWorldId||"")===region.id?'selected':'')+'>'+this.escapeHtml(region.name||region.id)+'</option>'
    ).join("");
    const actionParamFields=(selectedAction?.params||[]).map(param=>{
      const value=interaction.params?.[param.key]??"";
      if(param.type==="scene")return '<label class="tq-world-field"><span>'+this.escapeHtml(param.label||param.key)+'</span><select data-entity-action-param="'+this.escapeHtml(param.key)+'"><option value="">Selecione</option>'+sceneOptions+'</select></label>';
      if(param.type==="region")return '<label class="tq-world-field"><span>'+this.escapeHtml(param.label||param.key)+'</span><select data-entity-action-param="'+this.escapeHtml(param.key)+'"><option value="">Selecione</option>'+regionOptions+'</select></label>';
      return '<label class="tq-world-field"><span>'+this.escapeHtml(param.label||param.key)+'</span><input data-entity-action-param="'+this.escapeHtml(param.key)+'" type="text" value="'+this.escapeHtml(value)+'"></label>';
    }).join("");

    title.textContent=entity.id+" · "+(entity.type||"object");
    content.innerHTML=
      '<div class="tq-inspector">'+
        '<section class="tq-config-area"><button type="button" class="tq-config-area__head" data-area-toggle aria-expanded="false"><strong>Entidade</strong><span>▸</span></button><div class="tq-config-area__body" hidden>'+
          '<label class="tq-world-field"><span>ID</span><input value="'+this.escapeHtml(entity.id)+'" readonly></label>'+
          '<label class="tq-world-field"><span>Tipo lógico</span><select data-world-prop="type">'+typeOptions+'</select></label>'+
          text("label","Nome")+
          text("src","Asset")+
          '<small class="tq-world-editor-note">Tipo lógico não altera a aparência do asset. Região, location e background continuam sendo renderizados como o sprite original.</small>'+
        '</div></section>'+
        '<section class="tq-config-area"><button type="button" class="tq-config-area__head" data-area-toggle aria-expanded="false"><strong>Transformação</strong><span>▸</span></button><div class="tq-config-area__body" hidden>'+
          num("x","Position X")+num("y","Position Y")+
          num("width","Width",16,entity.type==="region-exit"?"":2400)+num("height","Height",16,entity.type==="region-exit"?"":2400)+
          '<label class="tq-field tq-field--check"><span>Manter proporção</span><input data-world-prop="lockAspect" type="checkbox" '+(entity.lockAspect!==false?'checked':'')+'></label>'+
          '<label class="tq-world-motion-range"><span><b>Rotação</b><output data-world-transform-output="rotation">'+Math.round(Number(entity.rotation||0))+'°</output></span><input data-world-prop="rotation" type="range" min="-180" max="180" step="1" value="'+Number(entity.rotation||0)+'"></label>'+
          '<label class="tq-world-motion-range"><span><b>Inclinação X</b><output data-world-transform-output="skewX">'+Math.round(Number(entity.skewX||0))+'°</output></span><input data-world-prop="skewX" type="range" min="-75" max="75" step="1" value="'+Number(entity.skewX||0)+'"></label>'+
          '<label class="tq-world-motion-range"><span><b>Inclinação Y</b><output data-world-transform-output="skewY">'+Math.round(Number(entity.skewY||0))+'°</output></span><input data-world-prop="skewY" type="range" min="-75" max="75" step="1" value="'+Number(entity.skewY||0)+'"></label>'+
          '<div class="tq-world-transform-actions"><button type="button" data-world-rotate="-90">↶ -90°</button><button type="button" data-world-rotate="0">0°</button><button type="button" data-world-rotate="90">↷ +90°</button></div>'+
          '<small class="tq-world-editor-note">Direto no asset: 8 alças redimensionam por cima, baixo, lados e cantos; círculo superior gira; alças roxas inclinam em X e Y.</small>'+
        '</div></section>'+
        '<section class="tq-config-area"><button type="button" class="tq-config-area__head" data-area-toggle aria-expanded="false"><strong>Efeito do objeto</strong><span>▸</span></button><div class="tq-config-area__body" hidden>'+
          '<label class="tq-world-field"><span>Categoria</span><select data-effect-prop="category">'+effectCategories+'</select></label>'+
          '<label class="tq-world-field"><span>Efeito</span><select data-effect-prop="preset">'+effectPresets+'</select></label>'+
          '<label class="tq-field tq-field--check"><span>Ativo</span><input data-effect-prop="active" type="checkbox" '+(effect.active?'checked':'')+'></label>'+
          '<div class="tq-world-effect-engine"><span>Motor</span><strong>'+this.escapeHtml(String(effect.renderer||"dom").toUpperCase())+'</strong><small>'+this.escapeHtml(String(effect.mode||"none"))+'</small></div>'+
          effectRange("speed","Velocidade",0,100,1)+
          effectRange("intensity","Intensidade",0,100,1)+
          effectRange("range","Alcance / percurso",0,2400,10," px")+
          effectRange("parallax","Parallax",0,1,.01)+
          effectRange("opacity","Opacidade",.08,1,.01)+
          effectRange("blur","Desfoque de profundidade",0,8,.1," px")+
          effectRange("distortion","Distorção WebGL",0,100,1)+
          effectRange("glow","Brilho WebGL",0,100,1)+
          '<label class="tq-field tq-field--check"><span>Orientar no percurso</span><input data-effect-prop="rotateToPath" type="checkbox" '+(effect.rotateToPath?'checked':'')+'></label>'+
          '<small class="tq-world-editor-note">Cada asset pode usar efeito próprio. Parallax compõe profundidade; WebGL distorce/brilha o sprite na GPU; navios podem navegar em percurso automático ao redor do ponto onde foram posicionados.</small>'+
        '</div></section>'+
        '<section class="tq-config-area"><button type="button" class="tq-config-area__head" data-area-toggle aria-expanded="false"><strong>Balanço / água</strong><span>▸</span></button><div class="tq-config-area__body" hidden>'+
          '<label class="tq-field tq-field--check"><span>Efeito ativo</span><input data-motion-prop="active" type="checkbox" '+(motion.active?'checked':'')+'></label>'+
          '<label class="tq-world-field"><span>Predefinição</span><select data-motion-prop="preset">'+motionPresets+'</select></label>'+
          motionRange("speed","Velocidade")+
          motionRange("heave","Elevação pela água")+
          motionRange("pitch","Inclinação pela onda")+
          motionRange("roll","Balanço lateral")+
          motionRange("sway","Deriva lateral")+
          '<small class="tq-world-editor-note">Usa a mesma linguagem do motor de composição de navios: heave, pitch, roll e sway. O preview roda no próprio mundo.</small>'+
        '</div></section>'+
        (entity.type==="island"
          ? '<section class="tq-config-area tq-config-area--island-water"><button type="button" class="tq-config-area__head" data-area-toggle aria-expanded="false"><strong>🌊 Imersão na água</strong><span>▸</span></button><div class="tq-config-area__body" hidden>'+
              '<label class="tq-field tq-field--check"><span>Integração com oceano</span><input data-island-water-prop="active" type="checkbox" '+(waterIntegration.active?'checked':'')+'></label>'+
              '<label class="tq-world-motion-range"><span><b>Profundidade visual</b><output data-island-water-output="immersion">'+Math.round(waterIntegration.immersion*100)+'%</output></span><input data-island-water-prop="immersion" type="range" min="0" max=".55" step=".01" value="'+waterIntegration.immersion+'"></label>'+
              '<label class="tq-world-motion-range"><span><b>Intensidade da espuma</b><output data-island-water-output="foam">'+Math.round(waterIntegration.foam*100)+'%</output></span><input data-island-water-prop="foam" type="range" min="0" max="1" step=".01" value="'+waterIntegration.foam+'"></label>'+
              '<label class="tq-world-motion-range"><span><b>Largura da espuma</b><output data-island-water-output="foamWidth">'+Math.round(waterIntegration.foamWidth*100)+'%</output></span><input data-island-water-prop="foamWidth" type="range" min=".02" max=".35" step=".01" value="'+waterIntegration.foamWidth+'"></label>'+
              '<label class="tq-world-motion-range"><span><b>Faixa molhada</b><output data-island-water-output="wetness">'+Math.round(waterIntegration.wetness*100)+'%</output></span><input data-island-water-prop="wetness" type="range" min="0" max="1" step=".01" value="'+waterIntegration.wetness+'"></label>'+
              '<label class="tq-world-motion-range"><span><b>Sombra submersa</b><output data-island-water-output="submergedShadow">'+Math.round(waterIntegration.submergedShadow*100)+'%</output></span><input data-island-water-prop="submergedShadow" type="range" min="0" max="1" step=".01" value="'+waterIntegration.submergedShadow+'"></label>'+
              '<small class="tq-world-editor-note">Integra visualmente a base da ilha ao oceano com espuma costeira e profundidade local, sem alterar o asset original.</small>'+
            '</div></section>'
          : '')+
        '<section class="tq-config-area"><button type="button" class="tq-config-area__head" data-area-toggle aria-expanded="false"><strong>Colisão</strong><span>▸</span></button><div class="tq-config-area__body" hidden>'+
          '<label class="tq-field tq-field--check"><span>Colisão ativa</span><input data-collision-prop="active" type="checkbox" '+(collision.active?'checked':'')+'></label>'+
          '<label class="tq-world-field"><span>Forma</span><select data-collision-prop="shape"><option value="ellipse" '+(collision.shape==="ellipse"?'selected':'')+'>Elipse</option><option value="box" '+(collision.shape==="box"?'selected':'')+'>Caixa</option></select></label>'+
          collisionRange("scaleX","Largura da área",.1,1.5,.01)+
          collisionRange("scaleY","Altura da área",.1,1.5,.01)+
          collisionRange("padding","Margem",0,500,1," px")+
          '<label class="tq-world-field"><span>Função ao tocar</span><select data-collision-prop="action">'+
            '<option value="auto" '+(collision.action==="auto"?'selected':'')+'>Automática pelo tipo</option>'+
            '<option value="none" '+(collision.action==="none"?'selected':'')+'>Nenhuma · contornar</option>'+
            '<option value="collect" '+(collision.action==="collect"?'selected':'')+'>Recolher item</option>'+
            '<option value="enter-scene" '+(collision.action==="enter-scene"?'selected':'')+'>Acessar cena / ilha</option>'+
            '<option value="enter-world" '+(collision.action==="enter-world"?'selected':'')+'>Navegar para outro mar</option>'+
            '<option value="combat" '+(collision.action==="combat"?'selected':'')+'>Combate naval</option>'+
          '</select></label>'+
          '<label class="tq-world-field"><span>Mensagem</span><input data-collision-prop="message" type="text" maxlength="240" value="'+this.escapeHtml(collision.message||"")+'" placeholder="Deixe vazio para mensagem automática"></label>'+
          '<small class="tq-world-editor-note">Se houver função, tocar na área mostra a mensagem e o botão da ação. Sem função, o navio desliza e contorna o obstáculo em vez de insistir contra ele.</small>'+
        '</div></section>'+
        (entity.type==="ship"
          ? '<section class="tq-config-area tq-config-area--combat"><button type="button" class="tq-config-area__head" data-area-toggle aria-expanded="false"><strong>⚔ Combate naval</strong><span>▸</span></button><div class="tq-config-area__body" hidden>'+
              '<label class="tq-world-field"><span>Navio do catálogo</span><select data-world-prop="shipId"><option value="">Asset local / sem catálogo</option>'+shipOptions+'</select></label>'+
              '<label class="tq-world-field"><span>HP do inimigo</span><input data-entity-combat-prop="hp" type="number" min="1" max="20" value="'+Math.max(1,Number(combat.hp)||3)+'"></label>'+
              '<small class="tq-world-editor-note">Todo navio colocado no oceano participa automaticamente do combate naval livre: é clicável, atacável e não abre desafio de tabuada.</small>'+
            '</div></section>'
          : '')+
        (!["background","region-exit"].includes(String(entity.type||""))
          ? '<section class="tq-config-area tq-config-area--rewards"><button type="button" class="tq-config-area__head" data-area-toggle aria-expanded="false"><strong>🎁 Recompensas</strong><span>▸</span></button><div class="tq-config-area__body" hidden>'+
              '<label class="tq-world-field"><span>Moedas</span><input data-entity-reward-prop="coins" type="number" min="0" max="999999" value="'+Math.max(0,Number(rewards.coins)||0)+'"></label>'+
              '<label class="tq-world-field"><span>XP</span><input data-entity-reward-prop="xp" type="number" min="0" max="999999" value="'+Math.max(0,Number(rewards.xp)||0)+'"></label>'+
              '<label class="tq-world-field"><span>Item / recompensa ID</span><input data-entity-reward-prop="itemId" type="text" value="'+this.escapeHtml(rewards.itemId||"")+'" placeholder="ex.: mapa-tesouro-01"></label>'+
              '<label class="tq-world-field"><span>Quantidade do item</span><input data-entity-reward-prop="quantity" type="number" min="1" max="999" value="'+Math.max(1,Number(rewards.quantity)||1)+'"></label>'+
              '<label class="tq-world-field"><span>Desbloquear navio</span><select data-entity-reward-prop="shipId"><option value="">Nenhum</option>'+((this.shipEditor?.allShips?.()||[]).map(ship=>'<option value="'+this.escapeHtml(ship.id)+'" '+(rewards.shipId===ship.id?'selected':'')+'>'+this.escapeHtml(ship.name||ship.id)+'</option>').join(""))+'</select></label>'+
              '<small class="tq-world-editor-note">Esta recompensa é concedida uma única vez quando a entidade é conquistada, recolhida ou derrotada.</small>'+
            '</div></section>'
          : '')+
        '<section class="tq-config-area tq-config-area--function"><button type="button" class="tq-config-area__head" data-area-toggle aria-expanded="false"><strong>⚙ Função / ação</strong><span>▸</span></button><div class="tq-config-area__body" hidden>'+
          '<label class="tq-world-field"><span>Ao interagir</span><select data-entity-action-id>'+actionOptions+'</select></label>'+
          actionParamFields+
          (selectedAction?'<small class="tq-world-editor-note">'+this.escapeHtml(selectedAction.description||"Ação configurada pelo catálogo do repositório.")+'</small>':'<small class="tq-world-editor-note">Selecione uma função publicada em action-catalog.json.</small>')+
        '</div></section>'+
        '<section class="tq-config-area"><button type="button" class="tq-config-area__head" data-area-toggle aria-expanded="false"><strong>Comportamento</strong><span>▸</span></button><div class="tq-config-area__body" hidden>'+
          num("interactionRadius","Raio de interação",0,2000)+
          text("scene","Cena vinculada")+
          (entity.type==="region-exit"
            ? '<label class="tq-world-field"><span>Região linkada</span><select data-world-prop="destinationWorldId"><option value="">Selecione o mundo de destino</option>'+destinationWorldOptions+'</select></label>'+
              '<small class="tq-world-editor-note">Este region exit funcionará como link para o mundo selecionado. O mundo de destino não poderá ser apagado enquanto este link existir.</small>'+
              '<label class="tq-world-field"><span>Texto do popup</span><input data-world-prop="transitionMessage" type="text" maxlength="240" value="'+this.escapeHtml(entity.transitionMessage||"")+'" placeholder="Deseja navegar para a próxima região?"></label>'+
              '<label class="tq-world-field"><span>Texto do botão</span><input data-world-prop="transitionActionLabel" type="text" maxlength="48" value="'+this.escapeHtml(entity.transitionActionLabel||"Navegar")+'"></label>'+
              '<small class="tq-world-editor-note">Esta área existe apenas como gatilho lógico. No Play ela fica invisível e abre automaticamente a confirmação quando o navio toca a área.</small>'
            : '')+
        '</div></section>'+
        '<section class="tq-config-area"><button type="button" class="tq-config-area__head" data-area-toggle aria-expanded="false"><strong>Ações</strong><span>▸</span></button><div class="tq-config-area__body tq-world-inspector-actions" hidden>'+
          (entity.scene?'<button type="button" class="is-primary" data-world-open-scene>Editar cena vinculada</button>':"")+
          '<button type="button" class="is-danger" data-world-delete>Excluir entidade</button>'+
        '</div></section>'+
      '</div>';

    this.bindCollapsedAreas(content);

    const numeric=new Set(["x","y","width","height","rotation","skewX","skewY","interactionRadius"]);
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

      if(key==="type"&&value==="region-exit"){
        Object.assign(patch,{
          renderMode:"logical",
          src:"",
          showLabel:false,
          lockAspect:false,
          destinationWorldId:entity.destinationWorldId||this.allWorldEntries().find(world=>world.id!==this.worldEditor?.entry?.id)?.id||"",
          interaction:{
            actionId:"enter-region",
            params:{
              regionId:entity.destinationWorldId||this.allWorldEntries().find(world=>world.id!==this.worldEditor?.entry?.id)?.id||"",
              spawnId:""
            }
          }
        });
        this.worldEditor.updateEntityCollision(entity.id,{active:true,shape:"box",scaleX:1,scaleY:1,padding:0,action:"enter-world"},true);
      }
      if(key==="destinationWorldId"){
        const linked=this.allWorldEntries().find(world=>world.id===value);
        patch.destinationWorldName=linked?.name||"";
        patch.interaction={
          actionId:"enter-region",
          params:{...(entity.interaction?.params||{}),regionId:String(value||""),spawnId:String(entity.interaction?.params?.spawnId||entity.destinationSpawnId||"")}
        };
      }
      const updated=this.worldEditor.updateEntity(entity.id,patch,true);
      this.selected=updated||this.selected;
      if(key==="type"||key==="width"||key==="height"||key==="lockAspect")this.renderWorldInspector();
    };

    content.querySelectorAll("[data-world-prop]").forEach(input=>{
      if(["rotation","skewX","skewY"].includes(input.dataset.worldProp)){
        input.addEventListener("input",()=>{
          const key=input.dataset.worldProp;
          const value=Number(input.value);
          const output=content.querySelector('[data-world-transform-output="'+key+'"]');
          if(output)output.value=Math.round(value)+"°";
          this.selected=this.worldEditor.updateEntity(entity.id,{[key]:value},false)||this.selected;
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

    content.querySelector("[data-entity-action-id]")?.addEventListener("change",event=>{
      const actionId=String(event.currentTarget.value||"");
      const definition=this.actionDefinition(actionId);
      const params={};
      for(const param of definition?.params||[])params[param.key]="";
      const patch={interaction:actionId?{actionId,params}:null};
      if(actionId==="enter-region"){
        patch.destinationWorldId="";
        patch.destinationWorldName="";
        this.worldEditor.updateEntityCollision(entity.id,{active:true,shape:"box",action:"enter-world"},true);
      }else if(actionId==="open-scene"){
        patch.scene="";
        this.worldEditor.updateEntityCollision(entity.id,{active:true,action:"enter-scene"},true);
      }
      this.selected=this.worldEditor.updateEntity(entity.id,patch,true)||this.selected;
      this.renderWorldInspector();
    });

    content.querySelectorAll("[data-entity-action-param]").forEach(input=>input.addEventListener("change",()=>{
      const key=input.dataset.entityActionParam;
      const current=this.worldEditor.getSelected()||entity;
      const nextInteraction={
        ...(current.interaction||interaction),
        params:{...(current.interaction?.params||interaction.params||{}),[key]:input.value}
      };
      const patch={interaction:nextInteraction};
      if(nextInteraction.actionId==="enter-region"&&key==="regionId"){
        const linked=this.allWorldEntries().find(region=>region.id===input.value);
        patch.destinationWorldId=input.value;
        patch.destinationWorldName=linked?.name||"";
      }
      if(nextInteraction.actionId==="enter-region"&&key==="spawnId")patch.destinationSpawnId=input.value;
      if(nextInteraction.actionId==="open-scene"&&key==="sceneId")patch.scene=input.value;
      this.selected=this.worldEditor.updateEntity(entity.id,patch,true)||this.selected;
      this.syncLocalWorldFromEditor();
      this.renderFlow();
    }));

    content.querySelectorAll("[data-entity-combat-prop]").forEach(input=>input.addEventListener("change",()=>{
      const key=input.dataset.entityCombatProp;
      const value=Math.max(1,Number(input.value)||3);
      const next={...(this.worldEditor.getSelected()?.combat||combat),[key]:value};
      delete next.enabled;
      delete next.clickable;
      this.selected=this.worldEditor.updateEntity(entity.id,{combat:next},true)||this.selected;
      this.worldEditor.updateEntityCollision(entity.id,{
        active:true,
        shape:"ellipse",
        action:"none"
      },true);
      this.selected=this.worldEditor.getSelected()||this.selected;
    }));

    const rewardNumeric=new Set(["coins","xp","quantity"]);
    content.querySelectorAll("[data-entity-reward-prop]").forEach(input=>input.addEventListener("change",()=>{
      const key=input.dataset.entityRewardProp;
      const value=rewardNumeric.has(key)?Math.max(key==="quantity"?1:0,Number(input.value)||0):input.value;
      const current=this.worldEditor.getSelected()?.rewards||rewards;
      this.selected=this.worldEditor.updateEntity(entity.id,{rewards:{...current,[key]:value}},true)||this.selected;
    }));

    const islandWaterNumeric=new Set(["immersion","foam","foamWidth","wetness","submergedShadow"]);
    content.querySelectorAll("[data-island-water-prop]").forEach(input=>{
      const apply=commit=>{
        const key=input.dataset.islandWaterProp;
        const value=input.type==="checkbox"?input.checked:Number(input.value);
        const current=this.worldEditor.getSelected()?.waterIntegration||waterIntegration;
        this.selected=this.worldEditor.updateEntity(entity.id,{waterIntegration:{...current,[key]:value}},commit)||this.selected;
        const output=content.querySelector('[data-island-water-output="'+key+'"]');
        if(output&&islandWaterNumeric.has(key))output.value=Math.round(Number(value)*100)+"%";
      };
      if(input.type==="range")input.addEventListener("input",()=>apply(false));
      input.addEventListener("change",()=>apply(true));
    });

    const collisionNumeric=new Set(["scaleX","scaleY","padding"]);
    content.querySelectorAll("[data-collision-prop]").forEach(input=>{
      const read=()=>input.type==="checkbox"
        ?input.checked
        :(collisionNumeric.has(input.dataset.collisionProp)?Number(input.value):input.value);
      const apply=(commit)=>{
        const key=input.dataset.collisionProp;
        const value=read();
        const output=content.querySelector('[data-collision-output="'+key+'"]');
        if(output){
          const suffix=input.dataset.collisionSuffix||"";
          output.value=String(Math.round(Number(value)*100)/100)+suffix;
        }
        this.worldEditor.updateEntityCollision(entity.id,{[key]:value},commit);
        this.selected=this.worldEditor.getSelected()||this.selected;
      };
      if(input.type==="range")input.addEventListener("input",()=>apply(false));
      input.addEventListener("change",()=>apply(true));
    });

    const effectNumeric=new Set(["speed","intensity","range","parallax","opacity","blur","distortion","glow"]);
    content.querySelectorAll("[data-effect-prop]").forEach(input=>{
      const read=()=>input.type==="checkbox"
        ?input.checked
        :(effectNumeric.has(input.dataset.effectProp)?Number(input.value):input.value);

      const apply=(commit)=>{
        const key=input.dataset.effectProp;
        const value=read();

        if(key==="category"){
          this.worldEditor.updateEntityEffect(entity.id,{category:value,preset:"none"},true);
          this.selected=this.worldEditor.getSelected()||this.selected;
          this.renderWorldInspector();
          return;
        }

        if(key==="preset"){
          this.worldEditor.updateEntityEffect(entity.id,{preset:value},true);
          this.selected=this.worldEditor.getSelected()||this.selected;
          this.renderWorldInspector();
          return;
        }

        const output=content.querySelector('[data-effect-output="'+key+'"]');
        if(output){
          const suffix=input.dataset.effectSuffix||"";
          output.value=String(Math.round(Number(value)*100)/100)+suffix;
        }
        this.worldEditor.updateEntityEffect(entity.id,{[key]:value},commit);
        this.selected=this.worldEditor.getSelected()||this.selected;
      };

      if(input.type==="range")input.addEventListener("input",()=>apply(false));
      input.addEventListener("change",()=>apply(true));
    });

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
      const r=await fetch("./src/config/composition-types.json?v=20260930-1851",{cache:"no-store"});
      const registry=await r.json();
      this.compositionTypes=registry.types||[];
      if(this.selected&&this.mode==="config")this.renderInspector();
    }catch(e){
      this.compositionTypes=[];
    }
  }
  async loadAssets(){
    try{
      const r=await fetch("./src/config/asset-tree.json?v=20261001-2119",{cache:"no-store"});
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
  toggleShips(show){
    if(show)this.closeToolPanels("ships");
    this.shipEditor.setVisible(show);
  }

  toggleNpcs(show){
    if(show)this.closeToolPanels("npcs");
    this.npcEditor.setVisible(show);
  }

  toggleAssets(show){
    const panel=this.el.querySelector(".tq-dev__assets");
    if(show){
      this.closeToolPanels("assets");
      panel.hidden=false;
      this.renderAssets();
    }else{
      panel.hidden=true;
      this.assetPickTarget=null;
    }
  }

  openShipFramePicker(context={}){
    this.assetPickTarget={
      kind:"ship-frame",
      shipId:String(context.shipId||this.shipEditor?.selectedId||""),
      animationKey:String(context.animationKey||""),
      section:context.section==="combat"?"combat":"navigation",
      mode:context.mode==="sprite"?"sprite":"frame"
    };
    if(this.assetNodeIndex.has("assets/ships"))this.assetDirectoryPath="assets/ships";
    const search=this.el.querySelector("[data-asset-search]");
    if(search)search.value="";
    this.toggleAssets(true);
  }

  openWorldPlayerSpritePicker(){
    if(this.workspace!=="world"||!this.worldEditor?.active)return;
    this.assetPickTarget={kind:"world-player-sprite"};
    if(this.assetNodeIndex.has("assets/ships"))this.assetDirectoryPath="assets/ships";
    const search=this.el.querySelector("[data-asset-search]");
    if(search)search.value="";
    this.toggleAssets(true);
  }

  applyAssetPick(asset){
    const target=this.assetPickTarget;
    if(!target||!asset)return false;

    if(target.kind==="ship-frame"){
      const src="./"+asset.path;
      const added=target.mode==="sprite"
        ?this.shipEditor?.setSpriteAsset?.(target.shipId,target.section,src)===true
        :this.shipEditor?.addFrameTo?.(target.shipId,target.animationKey,src,target.section)===true;
      this.assetPickTarget=null;
      this.toggleAssets(false);
      this.toggleShips(true);
      return added;
    }

    if(target.kind==="world-player-sprite"){
      const src="./"+asset.path;
      const current=this.worldEditor.getPlayerConfig()?.sprite||{};
      this.worldEditor.updatePlayerConfig({sprite:{src,regions:current.regions||{}},src},true);
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

  captureContinuity(){
    const visiblePanel=()=>{
      if(this.el?.querySelector(".tq-dev__assets")?.hidden===false)return "assets";
      if(this.shipEditor?.el?.hidden===false)return "ships";
      if(this.el?.querySelector(".tq-dev__scenes")?.hidden===false)return "scenes";
      if(this.el?.querySelector(".tq-dev__worlds")?.hidden===false)return "worlds";
      if(this.el?.querySelector(".tq-dev__panel")?.hidden===false)return "config";
      return null;
    };
    return {
      schema:"tq.app-continuity",
      version:1,
      timestamp:Date.now(),
      workspace:this.workspace||"scene",
      mode:this.mode||"edit",
      sceneId:this.runtime?.scene?.id||null,
      worldId:this.worldEditor?.entry?.id||null,
      selectedId:this.selected?.id||null,
      panel:visiblePanel(),
      assetDirectoryPath:this.assetDirectoryPath||"assets"
    };
  }

  async restoreContinuity(state){
    if(!state||state.schema!=="tq.app-continuity")return false;
    try{
      await Promise.allSettled([
        this.sceneCatalogReady||this.loadSceneCatalog(),
        this.worldCatalogReady||this.loadWorldCatalog()
      ]);

      if(state.workspace==="world"&&state.worldId){
        await this.openWorld(state.worldId);
        if(state.selectedId){
          this.selected=this.worldEditor.selectEntity(state.selectedId);
        }
      }else if(state.sceneId&&state.sceneId!==this.runtime?.scene?.id){
        await this.openScene(state.sceneId);
        if(state.selectedId){
          this.runtime.select?.(state.selectedId);
          this.selected=this.runtime.nodes?.get(state.selectedId)?.node||null;
        }
      }else if(state.selectedId){
        this.runtime.select?.(state.selectedId);
        this.selected=this.runtime.nodes?.get(state.selectedId)?.node||null;
      }

      if(["edit","config","play"].includes(state.mode))this.setMode(state.mode);

      if(state.panel==="assets"){
        if(state.assetDirectoryPath)this.assetDirectoryPath=state.assetDirectoryPath;
        this.toggleAssets(true);
      }else if(state.panel==="ships"){
        this.toggleShips(true);
      }else if(state.panel==="scenes"){
        this.toggleScenes(true);
      }else if(state.panel==="worlds"){
        this.toggleWorlds(true);
      }else if(state.panel==="config"){
        this.setMode("config");
      }
      return true;
    }catch(error){
      console.warn("App continuity restore failed",error);
      return false;
    }
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
    if(collapsed)this.closeToolPanels("");
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
  enablePanelDrag(){
    const desktop=globalThis.matchMedia?.("(min-width: 800px)");
    const configs=[
      [".tq-dev__panel","config"],
      [".tq-dev__scenes","scenes"],
      [".tq-dev__worlds","regions"],
      [".tq-dev__flow","flow"],
      [".tq-dev__assets","assets"]
    ];

    const clearPosition=panel=>{
      if(!panel)return;
      for(const key of ["left","top","right","bottom","width","height","maxWidth","maxHeight","transform","margin"])panel.style[key]="";
      panel.classList.remove("is-user-positioned");
    };

    const bind=panel=>{
      if(!panel)return;
      const handle=panel.querySelector(":scope > header");
      if(!handle)return;
      let drag=null;

      const move=event=>{
        if(!drag)return;
        const maxX=Math.max(0,window.innerWidth-panel.offsetWidth);
        const maxY=Math.max(0,window.innerHeight-panel.offsetHeight);
        panel.style.left=Math.min(maxX,Math.max(0,drag.left+event.clientX-drag.x))+"px";
        panel.style.top=Math.min(maxY,Math.max(0,drag.top+event.clientY-drag.y))+"px";
      };

      const end=event=>{
        if(!drag)return;
        try{handle.releasePointerCapture(event.pointerId)}catch{}
        drag=null;
      };

      handle.addEventListener("pointerdown",event=>{
        if(!desktop?.matches)return;
        if(event.button!==0)return;
        if(event.target.closest?.("button,input,select,textarea,a,label"))return;
        event.preventDefault();
        const rect=panel.getBoundingClientRect();
        drag={x:event.clientX,y:event.clientY,left:rect.left,top:rect.top};
        panel.style.position="fixed";
        panel.style.left=rect.left+"px";
        panel.style.top=rect.top+"px";
        panel.style.width=rect.width+"px";
        panel.style.height=rect.height+"px";
        panel.style.maxWidth="calc(100vw - 12px)";
        panel.style.maxHeight="calc(100vh - 12px)";
        panel.style.right="auto";
        panel.style.bottom="auto";
        panel.style.transform="none";
        panel.style.margin="0";
        panel.classList.add("is-user-positioned");
        try{handle.setPointerCapture(event.pointerId)}catch{}
      });

      handle.addEventListener("pointermove",move);
      handle.addEventListener("pointerup",end);
      handle.addEventListener("pointercancel",end);
    };

    configs.forEach(([selector])=>bind(this.el.querySelector(selector)));

    desktop?.addEventListener?.("change",()=>{
      if(desktop.matches)return;
      configs.forEach(([selector])=>clearPosition(this.el.querySelector(selector)));
    });

    window.addEventListener("resize",()=>{
      if(!desktop?.matches)return;
      configs.forEach(([selector])=>{
        const panel=this.el.querySelector(selector);
        if(!panel?.classList.contains("is-user-positioned"))return;
        const rect=panel.getBoundingClientRect();
        const maxX=Math.max(0,window.innerWidth-panel.offsetWidth);
        const maxY=Math.max(0,window.innerHeight-panel.offsetHeight);
        panel.style.left=Math.min(maxX,Math.max(0,rect.left))+"px";
        panel.style.top=Math.min(maxY,Math.max(0,rect.top))+"px";
      });
    });
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
    this.el.classList.toggle("is-play",mode==="play");
    if(mode==="config"){
      this.closeToolPanels("config");
      this.el.querySelector(".tq-dev__panel").hidden=false;
      this.renderInspector();
    }else{
      this.closeToolPanels("");
      this.el.querySelector(".tq-dev__panel").hidden=true;
    }
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
      {id:"behavior",title:"Comportamento",fields:[
        field("action","Ação","runtimeAction"),
        ...((this.actionDefinition(node.action)?.params||[]).map(param=>{
          if(param.type==="scene")return field(param.key,param.label||param.key,"actionScene");
          if(param.type==="region")return field(param.key,param.label||param.key,"actionRegion");
          return field(param.key,param.label||param.key,"text");
        })),
        field("locked","Locked","checkbox")
      ]},
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
    if(type==="actionScene"){
      const current=String(node[key]||"");
      const options=this.allSceneEntries().map(scene=>'<option value="'+this.escapeHtml(scene.id)+'" '+(current===scene.id?'selected':'')+'>'+this.escapeHtml(scene.name||scene.id)+'</option>').join("");
      return '<label class="tq-field"><span>'+label+'</span><select data-prop="'+key+'"><option value="">Selecione</option>'+options+'</select></label>';
    }
    if(type==="actionRegion"){
      const current=String(node[key]||"");
      const options=this.allWorldEntries().map(region=>'<option value="'+this.escapeHtml(region.id)+'" '+(current===region.id?'selected':'')+'>'+this.escapeHtml(region.name||region.id)+'</option>').join("");
      return '<label class="tq-field"><span>'+label+'</span><select data-prop="'+key+'"><option value="">Selecione</option>'+options+'</select></label>';
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
    const defaultOpen=null;

    content.innerHTML='<div class="tq-inspector">'+sections.map(section=>{
      const open=section.id===defaultOpen;
      return '<section class="tq-config-area" data-area="'+section.id+'"><button type="button" class="tq-config-area__head" data-area-toggle aria-expanded="'+open+'"><strong>'+section.title+'</strong><span>'+(open?'▾':'▸')+'</span></button><div class="tq-config-area__body" '+(open?'':'hidden')+'>'+section.fields.map(field=>this.fieldMarkup(node,field)).join("")+'</div></section>';
    }).join("")+'</div>';

    this.bindCollapsedAreas(content);

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

    if(key==="action"){
      this.runtime.updateNode(this.selected.id,{action:value},true);
      this.selected=this.runtime.nodes.get(this.selected.id).node;
      this.renderInspector();
      return;
    }

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
