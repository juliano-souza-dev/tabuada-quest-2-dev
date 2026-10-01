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
    this.directionByShip=new Map();
    this.previewTimer=0;
    this.storageKey="tq.dev.ship-drafts:v3";
    this.el=null;
  }

  async mount(parent){
    this.el=document.createElement("section");
    this.el.className="tq-dev__ships";
    this.el.hidden=true;
    this.el.innerHTML=`
      <header><div><strong>Navios</strong><small>Configuração por spritesheet / atlas</small></div><button type="button" data-ships-close aria-label="Fechar">×</button></header>
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
      const response=await fetch("./src/config/ship-catalog.json?v=20261001-2232",{cache:"no-store"});
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
    const declaredSpriteMode=value.spriteMode;
    value.spriteMode=declaredSpriteMode==="combined"?"combined":"split";
    value.autoFrame=value.autoFrame!==false;
    value.cellSize=[400,600,800].includes(Number(value.cellSize))?Number(value.cellSize):400;
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
    const navSprite=value.navigation.sprite&&typeof value.navigation.sprite==="object"?value.navigation.sprite:{};
    value.navigation.sprite={
      src:String(navSprite.src||value.navigation.src||profile.sprite?.src||profile.src||""),
      columns:Math.max(1,Number(navSprite.columns)||4),
      rows:Math.max(1,Number(navSprite.rows)||4),
      imageWidth:Math.max(1,Number(navSprite.imageWidth)||1600),
      imageHeight:Math.max(1,Number(navSprite.imageHeight)||1600),
      cellWidth:Math.max(1,Number(navSprite.cellWidth)||Math.round((Number(navSprite.imageWidth)||1600)/(Number(navSprite.columns)||4))),
      cellHeight:Math.max(1,Number(navSprite.cellHeight)||Math.round((Number(navSprite.imageHeight)||1600)/(Number(navSprite.rows)||4))),
      regions:clone(navSprite.regions||{}),
      directionFrames:clone(navSprite.directionFrames||{}),
      initialDirection:String(navSprite.initialDirection||value.navigation.initialDirection||"n")
    };
    if(value.autoFrame)this.frameSpriteByCell(value.navigation.sprite,value.cellSize,{navigation:true});
    const directionOrder=["n","nne","ne","ene","e","ese","se","sse","s","ssw","sw","wsw","w","wnw","nw","nnw"];
    const columns=value.navigation.sprite.columns;
    const cellWidth=value.navigation.sprite.cellWidth;
    const cellHeight=value.navigation.sprite.cellHeight;
    for(let index=0;index<directionOrder.length;index++){
      const key=directionOrder[index];
      if(!Number.isFinite(Number(value.navigation.sprite.directionFrames[key]))){
        const region=value.navigation.sprite.regions[key];
        if(region&&cellWidth>0&&cellHeight>0){
          value.navigation.sprite.directionFrames[key]=Math.max(0,Math.round(Number(region.y||0)/cellHeight)*columns+Math.round(Number(region.x||0)/cellWidth));
        }else value.navigation.sprite.directionFrames[key]=index;
      }
      const frame=Math.max(0,Number(value.navigation.sprite.directionFrames[key])||0);
      if(!value.navigation.sprite.regions[key]){
        value.navigation.sprite.regions[key]={
          x:(frame%columns)*cellWidth,
          y:Math.floor(frame/columns)*cellHeight,
          width:cellWidth,
          height:cellHeight
        };
      }
    }
    value.navigation.src=value.navigation.sprite.src||value.navigation.src||"";
    value.combat=value.combat&&typeof value.combat==="object"?value.combat:{};
    value.combat={
      recoil:Number(value.combat.recoil??18),
      shake:Number(value.combat.shake??5),
      muzzleFlash:value.combat.muzzleFlash!==false,
      smoke:value.combat.smoke!==false,
      impact:value.combat.impact!==false,
      compiled:clone(value.combat.compiled||{}),
      sprite:clone(value.combat.sprite||profile.combatSprite||null)
    };
    const combatSprite=value.combat.sprite&&typeof value.combat.sprite==="object"?value.combat.sprite:{};
    value.combat.sprite={
      src:String(combatSprite.src||""),
      columns:Math.max(1,Number(combatSprite.columns)||4),
      rows:Math.max(1,Number(combatSprite.rows)||4),
      imageWidth:Math.max(1,Number(combatSprite.imageWidth)||1600),
      imageHeight:Math.max(1,Number(combatSprite.imageHeight)||1600),
      cellWidth:Math.max(1,Number(combatSprite.cellWidth||combatSprite.frameWidth)||400),
      cellHeight:Math.max(1,Number(combatSprite.cellHeight||combatSprite.frameHeight)||400)
    };
    if(value.autoFrame&&value.spriteMode!=="combined")this.frameSpriteByCell(value.combat.sprite,value.cellSize);

    if(!declaredSpriteMode&&value.navigation.sprite.src&&value.combat.sprite.src===value.navigation.sprite.src){
      value.spriteMode="combined";
    }
    if(value.spriteMode==="combined"){
      value.combat.useNavigationAtlas=true;
      delete value.combat.sprite;
    }else{
      value.combat.useNavigationAtlas=false;
      // Legacy repair only when the declared split combat grid does not match the image.
      const combatImageW=value.combat.sprite.imageWidth;
      const combatImageH=value.combat.sprite.imageHeight;
      const combatGridValid=
        value.combat.sprite.columns*value.combat.sprite.cellWidth===combatImageW
        &&value.combat.sprite.rows*value.combat.sprite.cellHeight===combatImageH;
      if(value.combat.sprite.src&&!combatGridValid){
        const preferred=value.cellSize;
        if(
          combatImageW%preferred===0
          &&combatImageH%preferred===0
          &&combatImageW/preferred<=32
          &&combatImageH/preferred<=32
        ){
          value.combat.sprite.columns=Math.max(1,Math.round(combatImageW/preferred));
          value.combat.sprite.rows=Math.max(1,Math.round(combatImageH/preferred));
          value.combat.sprite.cellWidth=preferred;
          value.combat.sprite.cellHeight=preferred;
        }
      }
    }
    value.animations=value.animations&&typeof value.animations==="object"?value.animations:{};
    if(value.combat?.animations&&typeof value.combat.animations==="object"){
      for(const [key,animation] of Object.entries(value.combat.animations)){
        if(!value.animations[key])value.animations[key]=clone(animation);
      }
    }
    value.animationGroups=value.animationGroups&&typeof value.animationGroups==="object"?value.animationGroups:{};
    for(const key of Object.keys(value.animations)){
      if(!value.animationGroups[key]){
        value.animationGroups[key]=["fireRight","fireLeft","hit","critical","defeat"].includes(key)?"combat":"navigation";
      }
    }
    if(profile.combatSprite&&!Object.keys(value.animations).some(key=>value.animationGroups[key]==="combat")){
      value.animations.idle={
        frameMs:140,
        loop:true,
        cellWidth:Number(profile.combatSprite.frameWidth)||400,
        cellHeight:Number(profile.combatSprite.frameHeight)||400,
        frames:[Number(profile.combatSprite.idleFrame)||0]
      };
      value.animationGroups.idle="combat";
      for(const [key,legacy] of Object.entries(profile.combatSprite.animations||{})){
        value.animations[key]={
          frameMs:Number(legacy.frameMs)||135,
          loop:legacy.loop===true,
          cellWidth:Number(profile.combatSprite.frameWidth)||400,
          cellHeight:Number(profile.combatSprite.frameHeight)||400,
          frames:Array.isArray(legacy.frames)?legacy.frames.map(Number).filter(Number.isFinite):[]
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
      spriteMode:"combined",
      autoFrame:true,
      cellSize:400,
      animations:{
        idle:{frameMs:140,loop:true,cellWidth:400,cellHeight:400,frames:[0]},
        fireRight:{frameMs:135,loop:false,cellWidth:400,cellHeight:400,frames:[4,5,6,7]},
        fireLeft:{frameMs:135,loop:false,cellWidth:400,cellHeight:400,frames:[]},
        hit:{frameMs:120,loop:false,cellWidth:400,cellHeight:400,frames:[]},
        critical:{frameMs:160,loop:true,cellWidth:400,cellHeight:400,frames:[]},
        defeat:{frameMs:180,loop:false,cellWidth:400,cellHeight:400,frames:[]}
      },
      animationGroups:{idle:"combat",fireRight:"combat",fireLeft:"combat",hit:"combat",critical:"combat",defeat:"combat"},
      editor:{draft:true,createdAt:Date.now(),updatedAt:Date.now()}
    });
    this.drafts.push(ship);
    this.save();
    this.selectedId=id;
    this.tabByShip.set(id,"general");
    this.directionByShip.set(id,"n");
    this.render();
  }

  updateShip(patch){
    const ship=this.editableCurrent();
    if(!ship)return;
    Object.assign(ship,clone(patch),{editor:{...(ship.editor||{}),draft:true,updatedAt:Date.now()}});
    this.save();
    this.render();
  }

  directionKeys(){
    return ["n","nne","ne","ene","e","ese","se","sse","s","ssw","sw","wsw","w","wnw","nw","nnw"];
  }

  directionInfo(){
    return {
      n:["↑","Para cima"],nne:["↗","Quase para cima, levemente à direita"],
      ne:["↗","Diagonal para cima e direita"],ene:["→","Quase para direita, levemente para cima"],
      e:["→","Para direita"],ese:["→","Quase para direita, levemente para baixo"],
      se:["↘","Diagonal para baixo e direita"],sse:["↘","Quase para baixo, levemente à direita"],
      s:["↓","Para baixo"],ssw:["↙","Quase para baixo, levemente à esquerda"],
      sw:["↙","Diagonal para baixo e esquerda"],wsw:["←","Quase para esquerda, levemente para baixo"],
      w:["←","Para esquerda"],wnw:["←","Quase para esquerda, levemente para cima"],
      nw:["↖","Diagonal para cima e esquerda"],nnw:["↖","Quase para cima, levemente à esquerda"]
    };
  }

  atlasCellOptions(){
    return [400,600,800];
  }

  normalizeCellSize(value){
    const size=Number(value);
    return this.atlasCellOptions().includes(size)?size:400;
  }

  frameSpriteByCell(sprite,cellSize,{navigation=false}={}){
    if(!sprite||typeof sprite!=="object")return sprite;
    const size=this.normalizeCellSize(cellSize);
    const imageWidth=Math.max(1,Number(sprite.imageWidth)||size*4);
    const imageHeight=Math.max(1,Number(sprite.imageHeight)||size*4);
    const columns=Math.max(1,Math.floor(imageWidth/size));
    const rows=Math.max(1,Math.floor(imageHeight/size));
    sprite.imageWidth=imageWidth;
    sprite.imageHeight=imageHeight;
    sprite.cellWidth=size;
    sprite.cellHeight=size;
    sprite.columns=Math.min(32,columns);
    sprite.rows=Math.min(32,rows);
    sprite.autoFrameExact=imageWidth%size===0&&imageHeight%size===0;
    if(navigation){
      sprite.directionFrames=sprite.directionFrames||{};
      for(let index=0;index<this.directionKeys().length;index++){
        const key=this.directionKeys()[index];
        if(!Number.isFinite(Number(sprite.directionFrames[key])))sprite.directionFrames[key]=index;
      }
    }
    return sprite;
  }

  syncCombinedAtlas(ship){
    if(!ship||ship.spriteMode!=="combined")return;
    ship.navigation=ship.navigation||{};
    ship.navigation.sprite=ship.navigation.sprite||{};
    ship.combat=ship.combat||{};
    ship.combat.useNavigationAtlas=true;
    delete ship.combat.sprite;
  }

  applyAutoFraming(ship){
    if(!ship||ship.autoFrame===false)return;
    const size=this.normalizeCellSize(ship.cellSize);
    ship.cellSize=size;
    ship.navigation=ship.navigation||{};
    ship.navigation.sprite=ship.navigation.sprite||{};
    this.frameSpriteByCell(ship.navigation.sprite,size,{navigation:true});
    this.syncNavigationRegions(ship);
    if(ship.spriteMode==="combined"){
      this.syncCombinedAtlas(ship);
    }else{
      ship.combat=ship.combat||{};
      ship.combat.sprite=ship.combat.sprite||{};
      this.frameSpriteByCell(ship.combat.sprite,size);
    }
  }

  updateAtlasSettings(patch={}){
    const ship=this.editableCurrent();
    if(!ship)return;
    const previousMode=ship.spriteMode;
    Object.assign(ship,clone(patch));
    ship.spriteMode=ship.spriteMode==="combined"?"combined":"split";
    ship.autoFrame=ship.autoFrame!==false;
    ship.cellSize=this.normalizeCellSize(ship.cellSize);
    if(ship.spriteMode==="combined"){
      this.syncCombinedAtlas(ship);
    }else if(previousMode==="combined"){
      ship.combat=ship.combat||{};
      ship.combat.useNavigationAtlas=false;
      ship.combat.sprite={
        src:"",
        columns:4,
        rows:4,
        imageWidth:(ship.cellSize||400)*4,
        imageHeight:(ship.cellSize||400)*4,
        cellWidth:ship.cellSize||400,
        cellHeight:ship.cellSize||400
      };
    }
    if(ship.autoFrame)this.applyAutoFraming(ship);
    ship.editor={...(ship.editor||{}),draft:true,updatedAt:Date.now()};
    this.save();
    this.renderEditor();
  }

  atlasControlsHtml(ship){
    const mode=ship.spriteMode==="combined"?"combined":"split";
    const size=this.normalizeCellSize(ship.cellSize);
    const sprite=ship.navigation?.sprite||{};
    const imageWidth=Math.max(0,Number(sprite.imageWidth)||0);
    const imageHeight=Math.max(0,Number(sprite.imageHeight)||0);
    const gridText=sprite.src
      ?imageWidth+"×"+imageHeight+" → "+Math.max(1,Number(sprite.columns)||1)+"×"+Math.max(1,Number(sprite.rows)||1)+" células"
      :"Selecione um spritesheet para calcular a grade.";
    const exact=sprite.src&&ship.autoFrame!==false?sprite.autoFrameExact!==false:true;
    return `
      <section class="tq-ships__panel tq-ships__atlas-settings">
        <div class="tq-ships__panel-title"><div><strong>Fonte dos sprites</strong><small>Use um atlas único para navegação + combate ou dois atlas separados.</small></div><span>${mode==="combined"?"ATLAS ÚNICO":"2 ATLAS"}</span></div>
        <div class="tq-ships__atlas-settings-grid">
          <label><span>Modo do atlas</span><select data-atlas-mode><option value="combined" ${mode==="combined"?"selected":""}>Atlas único</option><option value="split" ${mode==="split"?"selected":""}>Atlas separado</option></select></label>
          <label class="tq-ships__check tq-ships__auto-frame"><input data-atlas-auto type="checkbox" ${ship.autoFrame!==false?"checked":""}><span>Enquadramento automático</span></label>
          <label><span>Tamanho da célula</span><select data-atlas-cell ${ship.autoFrame===false?"disabled":""}>${this.atlasCellOptions().map(value=>'<option value="'+value+'" '+(value===size?'selected':'')+'>'+value+' × '+value+'</option>').join("")}</select></label>
        </div>
        <small class="tq-world-editor-note">${mode==="combined"
          ?"O mesmo arquivo alimenta as 16 direções e os ranges de combate."
          :"Navegação e combate podem usar arquivos diferentes."} Com enquadramento automático, linhas e colunas são calculadas pelas dimensões reais do arquivo.</small>
        <div class="tq-ships__atlas-status ${exact?"is-ok":"is-warning"}"><b>${gridText}</b><span>${ship.autoFrame===false?"Grade manual.":exact?"Enquadramento exato em "+size+"×"+size+".":"A imagem não é múltipla exata de "+size+" px; haverá sobra fora da grade."}</span></div>
      </section>`;
  }

  bindAtlasControls(content){
    content.querySelector("[data-atlas-mode]")?.addEventListener("change",event=>this.updateAtlasSettings({spriteMode:event.currentTarget.value}));
    content.querySelector("[data-atlas-auto]")?.addEventListener("change",event=>this.updateAtlasSettings({autoFrame:event.currentTarget.checked}));
    content.querySelector("[data-atlas-cell]")?.addEventListener("change",event=>this.updateAtlasSettings({cellSize:Number(event.currentTarget.value)}));
  }

  syncNavigationRegions(ship){
    const sprite=ship?.navigation?.sprite;
    if(!sprite)return;
    const columns=Math.max(1,Number(sprite.columns)||4);
    const rows=Math.max(1,Number(sprite.rows)||4);
    const imageWidth=Math.max(1,Number(sprite.imageWidth)||columns*400);
    const imageHeight=Math.max(1,Number(sprite.imageHeight)||rows*400);
    const cellWidth=Math.max(1,Number(sprite.cellWidth)||Math.floor(imageWidth/columns));
    const cellHeight=Math.max(1,Number(sprite.cellHeight)||Math.floor(imageHeight/rows));
    sprite.columns=columns;sprite.rows=rows;sprite.imageWidth=imageWidth;sprite.imageHeight=imageHeight;
    sprite.cellWidth=cellWidth;sprite.cellHeight=cellHeight;
    sprite.directionFrames=sprite.directionFrames||{};
    sprite.regions=sprite.regions||{};
    const maxFrame=columns*rows-1;
    for(const key of this.directionKeys()){
      const frame=Math.max(0,Math.min(maxFrame,Number(sprite.directionFrames[key])||0));
      sprite.directionFrames[key]=frame;
      sprite.regions[key]={
        x:(frame%columns)*cellWidth,
        y:Math.floor(frame/columns)*cellHeight,
        width:cellWidth,
        height:cellHeight
      };
    }
    ship.navigation.src=sprite.src||"";
  }

  setSpriteAsset(shipId,section,src){
    const current=this.allShips().find(item=>item.id===shipId);
    if(!current)return false;
    const ship=this.drafts.find(item=>item.id===shipId)||this.editableCurrent();
    if(!ship)return false;
    const requested=section==="combat"?"combat":"navigation";
    const target=ship.spriteMode==="combined"?"navigation":requested;
    ship[target]=ship[target]||{};
    ship[target].sprite=ship[target].sprite&&typeof ship[target].sprite==="object"
      ?ship[target].sprite
      :{columns:4,rows:4,cellWidth:ship.cellSize||400,cellHeight:ship.cellSize||400};
    ship[target].sprite.src=String(src||"");
    if(target==="navigation")ship.navigation.src=String(src||"");
    if(ship.spriteMode==="combined")this.syncCombinedAtlas(ship);
    ship.editor={...(ship.editor||{}),draft:true,updatedAt:Date.now()};
    this.save();

    this.loadImage(src).then(image=>{
      const draft=this.drafts.find(item=>item.id===shipId);
      if(!draft)return;
      const sprite=draft?.[target]?.sprite;
      if(!sprite)return;
      const imageWidth=image.naturalWidth||image.width||sprite.imageWidth||1600;
      const imageHeight=image.naturalHeight||image.height||sprite.imageHeight||1600;
      sprite.imageWidth=imageWidth;
      sprite.imageHeight=imageHeight;

      if(draft.autoFrame!==false){
        this.frameSpriteByCell(sprite,draft.cellSize||400,{navigation:target==="navigation"});
      }else{
        sprite.columns=Math.max(1,Number(sprite.columns)||4);
        sprite.rows=Math.max(1,Number(sprite.rows)||4);
        sprite.cellWidth=Math.max(1,Math.floor(imageWidth/sprite.columns));
        sprite.cellHeight=Math.max(1,Math.floor(imageHeight/sprite.rows));
      }

      if(target==="navigation")this.syncNavigationRegions(draft);
      if(draft.spriteMode==="combined"){
        this.syncCombinedAtlas(draft);
      }else if(requested==="combat"&&target==="combat"){
        draft.combat.sprite={...sprite};
      }

      this.save();
      if(this.selectedId===shipId)this.renderEditor();
    }).catch(error=>console.warn("Ship spritesheet load failed",error));

    this.renderEditor();
    return true;
  }

  updateNavigationSprite(patch={}){
    const ship=this.editableCurrent();
    if(!ship)return;
    ship.navigation.sprite={...(ship.navigation.sprite||{}),...clone(patch)};
    if(ship.autoFrame!==false&&("imageWidth" in patch||"imageHeight" in patch||"src" in patch)){
      this.frameSpriteByCell(ship.navigation.sprite,ship.cellSize||400,{navigation:true});
    }
    this.syncNavigationRegions(ship);
    if(ship.spriteMode==="combined")this.syncCombinedAtlas(ship);
    this.save();this.renderEditor();
  }

  updateCombatSprite(patch={}){
    const ship=this.editableCurrent();
    if(!ship)return;
    if(ship.spriteMode==="combined"){
      ship.navigation.sprite={...(ship.navigation.sprite||{}),...clone(patch)};
      if(ship.autoFrame!==false)this.frameSpriteByCell(ship.navigation.sprite,ship.cellSize||400,{navigation:true});
      this.syncNavigationRegions(ship);
      this.syncCombinedAtlas(ship);
    }else{
      ship.combat.sprite={...(ship.combat.sprite||{}),...clone(patch)};
      if(ship.autoFrame!==false&&("imageWidth" in patch||"imageHeight" in patch||"src" in patch)){
        this.frameSpriteByCell(ship.combat.sprite,ship.cellSize||400);
      }
    }
    this.save();this.renderEditor();
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

  addFrameTo(shipId,animationKey,src,section=null){
    let ship=this.drafts.find(item=>item.id===shipId)||null;
    if(!ship&&this.selectedId===shipId)ship=this.editableCurrent();
    if(!ship)return false;
    const targetSection=section==="combat"?"combat":"navigation";
    this.tabByShip.set(ship.id,targetSection);
    const key=animationKey&&ship.animations?.[animationKey]?animationKey:this.currentAnimationKey(ship);
    if(!key)return false;
    ship.animationGroups=ship.animationGroups||{};
    ship.animationGroups[key]=targetSection;
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

  combinedActionCombatHtml(ship){
    const sprite=ship.navigation?.sprite||{};
    const columns=Math.max(1,Number(sprite.columns)||4);
    const rows=Math.max(1,Number(sprite.rows)||4);
    const total=columns*rows;
    const keys=["idle","fireRight","fireLeft","hit","critical","defeat"];
    const animationRows=keys.map(key=>{
      const anim=ship.animations?.[key]||{};
      const nums=Array.isArray(anim.frames)?anim.frames.filter(v=>Number.isFinite(Number(v))).map(Number):[];
      const start=nums.length?Math.min(...nums):0;
      const finish=nums.length?Math.max(...nums):start;
      return `<tr>
        <td><b>${key}</b></td>
        <td><input data-action-start="${key}" type="number" min="1" max="${total}" value="${start+1}"></td>
        <td><input data-action-end="${key}" type="number" min="1" max="${total}" value="${finish+1}"></td>
        <td><input data-action-ms="${key}" type="number" min="40" max="1000" value="${Number(anim.frameMs)||140}"></td>
        <td><input data-action-loop="${key}" type="checkbox" ${anim.loop===true?"checked":""}></td>
      </tr>`;
    }).join("");
    return `
      <section class="tq-ships__panel tq-ships__action-combat">
        <div class="tq-ships__panel-title">
          <div><strong>Ações de combate</strong><small>Ranges do mesmo atlas usado para navegação. Nenhum segundo sprite é necessário.</small></div>
          <span>MESMO ATLAS</span>
        </div>
        <div class="tq-ships__settings tq-ships__settings--v2">
          <label><span>Recoil px</span><input data-action-recoil type="number" min="0" max="80" value="${Math.round(ship.combat.recoil)}"></label>
          <label><span>Shake px</span><input data-action-shake type="number" min="0" max="30" value="${Math.round(ship.combat.shake)}"></label>
          <label class="tq-ships__check"><input data-action-flash type="checkbox" ${ship.combat.muzzleFlash!==false?"checked":""}><span>Flash</span></label>
          <label class="tq-ships__check"><input data-action-smoke type="checkbox" ${ship.combat.smoke!==false?"checked":""}><span>Fumaça</span></label>
          <label class="tq-ships__check"><input data-action-impact type="checkbox" ${ship.combat.impact!==false?"checked":""}><span>Impacto</span></label>
        </div>
        <table class="tq-ships__anim-table">
          <thead><tr><th>Ação</th><th>Início</th><th>Fim</th><th>ms</th><th>Loop</th></tr></thead>
          <tbody>${animationRows}</tbody>
        </table>
        <small class="tq-world-editor-note">Os frames acima pertencem ao atlas único. Navegação usa o mapeamento direcional e combate usa apenas estes ranges.</small>
      </section>`;
  }

  bindCombinedActionCombat(content,ship){
    const sprite=ship.navigation?.sprite||{};
    const total=Math.max(1,(Number(sprite.columns)||4)*(Number(sprite.rows)||4));
    const keys=["idle","fireRight","fireLeft","hit","critical","defeat"];
    const saveStyle=()=>{
      const draft=this.editableCurrent();
      if(!draft)return;
      draft.combat={
        ...(draft.combat||{}),
        recoil:Math.max(0,Number(content.querySelector("[data-action-recoil]")?.value)||0),
        shake:Math.max(0,Number(content.querySelector("[data-action-shake]")?.value)||0),
        muzzleFlash:content.querySelector("[data-action-flash]")?.checked!==false,
        smoke:content.querySelector("[data-action-smoke]")?.checked!==false,
        impact:content.querySelector("[data-action-impact]")?.checked!==false,
        useNavigationAtlas:true
      };
      delete draft.combat.sprite;
      this.save();
    };
    content.querySelectorAll("[data-action-recoil],[data-action-shake],[data-action-flash],[data-action-smoke],[data-action-impact]")
      .forEach(el=>el.addEventListener("change",saveStyle));

    const saveAnim=key=>{
      const draft=this.editableCurrent();
      if(!draft)return;
      draft.animations=draft.animations||{};
      const start=Math.max(0,Math.min(total-1,(Number(content.querySelector('[data-action-start="'+key+'"]')?.value)||1)-1));
      const finish=Math.max(start,Math.min(total-1,(Number(content.querySelector('[data-action-end="'+key+'"]')?.value)||start+1)-1));
      draft.animations[key]={
        ...(draft.animations[key]||{}),
        frames:Array.from({length:finish-start+1},(_,i)=>start+i),
        frameMs:Math.max(40,Number(content.querySelector('[data-action-ms="'+key+'"]')?.value)||140),
        loop:content.querySelector('[data-action-loop="'+key+'"]')?.checked===true,
        cellWidth:Number(sprite.cellWidth)||draft.cellSize||400,
        cellHeight:Number(sprite.cellHeight)||draft.cellSize||400
      };
      draft.animationGroups=draft.animationGroups||{};
      draft.animationGroups[key]="combat";
      draft.combat={...(draft.combat||{}),useNavigationAtlas:true};
      delete draft.combat.sprite;
      this.save();
    };
    for(const key of keys){
      content.querySelectorAll('[data-action-start="'+key+'"],[data-action-end="'+key+'"],[data-action-ms="'+key+'"],[data-action-loop="'+key+'"]')
        .forEach(el=>el.addEventListener("change",()=>saveAnim(key)));
    }
  }

  renderEditor(){
    const host=this.el.querySelector("[data-ship-editor]");
    const ship=this.current();
    if(!ship){host.innerHTML='<div class="tq-ships__empty">Selecione ou crie um navio.</div>';return}
    let tab=this.tabByShip.get(ship.id)||"general";
    if(ship.spriteMode==="combined"&&tab==="combat"){
      tab="navigation";
      this.tabByShip.set(ship.id,tab);
    }
    host.innerHTML=`
      <div class="tq-ships__tabs">
        <button type="button" data-ship-tab="general" class="${tab==="general"?"is-active":""}">⚙ Geral</button>
        <button type="button" data-ship-tab="navigation" class="${tab==="navigation"?"is-active":""}">${ship.spriteMode==="combined"?"⚡ Ação":"🧭 Navegação"}</button>
        ${ship.spriteMode==="split"?'<button type="button" data-ship-tab="combat" class="'+(tab==="combat"?"is-active":"")+'">💥 Combate</button>':""}
      </div>
      <div data-ship-v2-content></div>`;
    host.querySelectorAll("[data-ship-tab]").forEach(button=>button.addEventListener("click",()=>{
      this.tabByShip.set(ship.id,button.dataset.shipTab);
      this.renderEditor();
    }));
    const content=host.querySelector("[data-ship-v2-content]");

    if(tab==="general"){
      content.innerHTML=this.atlasControlsHtml(ship)+`
        <section class="tq-ships__panel">
          <div class="tq-ships__panel-title"><div><strong>Identidade do navio</strong><small>Uma definição para PLAYER ou NPC.</small></div><span>tq.ship v2</span></div>
          <div class="tq-ships__top">
            <label><span>Nome</span><input data-ship-name value="${this.escape(ship.name)}"></label>
            <label><span>ID</span><input value="${this.escape(ship.id)}" disabled></label>
            <label><span>Tipo</span><select data-ship-type><option value="player" ${ship.type!=="npc"?"selected":""}>Jogador</option><option value="npc" ${ship.type==="npc"?"selected":""}>NPC</option></select></label>
          </div>
          <div class="tq-ships__general-grid">
            ${ship.spriteMode==="combined"
              ?'<article><b>⚡ Ação</b><span>Um atlas · navegação + combate</span><small>'+Math.round(ship.navigation.speed)+' px/s · recoil '+Math.round(ship.combat.recoil)+'</small></article><article><b>▦ Grade</b><span>'+ship.cellSize+'×'+ship.cellSize+'</span><small>um único asset para todas as ações</small></article>'
              :'<article><b>🧭 Navegação</b><span>Spritesheet direcional</span><small>'+Math.round(ship.navigation.speed)+' px/s · '+Math.round(ship.navigation.width)+'×'+Math.round(ship.navigation.height)+'</small></article><article><b>💥 Combate</b><span>Atlas + animações</span><small>recoil '+Math.round(ship.combat.recoil)+' · shake '+Math.round(ship.combat.shake)+'</small></article>'}
          </div>
          <div class="tq-ships__compile"><button type="button" class="is-primary" data-ship-export>⇩ JSON V2</button><small>O runtime consome spritesheets; frames individuais ficam fora do fluxo principal.</small></div>
        </section>`;
      this.bindAtlasControls(content);
      content.querySelector("[data-ship-name]")?.addEventListener("change",e=>this.updateShip({name:e.currentTarget.value.trim()||ship.name}));
      content.querySelector("[data-ship-type]")?.addEventListener("change",e=>this.updateShip({type:e.currentTarget.value==="npc"?"npc":"player"}));
      content.querySelector("[data-ship-export]")?.addEventListener("click",()=>this.exportShipJson());
      return;
    }

    if(tab==="navigation"){
      const sprite=ship.navigation.sprite||{};
      const keys=this.directionKeys();
      const info=this.directionInfo();
      const selected=this.directionByShip.get(ship.id)||sprite.initialDirection||"n";
      this.directionByShip.set(ship.id,selected);
      const columns=Math.max(1,Number(sprite.columns)||4);
      const rows=Math.max(1,Number(sprite.rows)||4);
      const maxFrame=columns*rows-1;
      const cellStyle=key=>{
        if(!sprite.src)return "";
        const frame=Math.max(0,Math.min(maxFrame,Number(sprite.directionFrames?.[key])||0));
        const col=frame%columns,row=Math.floor(frame/columns);
        const x=columns===1?0:(col/(columns-1))*100;
        const y=rows===1?0:(row/(rows-1))*100;
        return 'background-image:url(&quot;'+this.escape(sprite.src)+'&quot;);background-size:'+(columns*100)+'% '+(rows*100)+'%;background-position:'+x+'% '+y+'%;';
      };
      const selectedFrame=Math.max(0,Math.min(maxFrame,Number(sprite.directionFrames?.[selected])||0));
      content.innerHTML=this.atlasControlsHtml(ship)+`
        <section class="tq-ships__panel">
          <div class="tq-ships__panel-title"><div><strong>Comportamento de navegação</strong><small>Física do navio no oceano.</small></div></div>
          <div class="tq-ships__settings tq-ships__settings--v2">
            <label><span>Largura</span><input data-nav-width type="number" min="32" max="800" value="${Math.round(ship.navigation.width)}"></label>
            <label><span>Altura</span><input data-nav-height type="number" min="32" max="800" value="${Math.round(ship.navigation.height)}"></label>
            <label><span>Velocidade</span><input data-nav-speed type="number" min="40" max="1200" value="${Math.round(ship.navigation.speed)}"></label>
            <label><span>Aceleração</span><input data-nav-accel type="number" min="100" max="3000" value="${Math.round(ship.navigation.acceleration)}"></label>
            <label><span>Roll °</span><input data-nav-roll type="number" min="0" max="20" step=".1" value="${ship.navigation.roll}"></label>
            <label><span>Heave px</span><input data-nav-heave type="number" min="0" max="40" step=".1" value="${ship.navigation.heave}"></label>
            <label class="tq-ships__check"><input data-nav-wake type="checkbox" ${ship.navigation.wake!==false?"checked":""}><span>Esteira</span></label>
            <label class="tq-ships__check"><input data-nav-shadow type="checkbox" ${ship.navigation.shadow!==false?"checked":""}><span>Sombra</span></label>
          </div>
        </section>

        <section class="tq-ships__panel tq-ships__sprite-panel">
          <div class="tq-ships__panel-title"><div><strong>Sprite de navegação</strong><small>${ship.spriteMode==="combined"?"Atlas único: navegação e combate compartilham este arquivo.":"Atlas exclusivo para as 16 direções."}</small></div><button type="button" data-nav-sprite-pick>▦ ${ship.spriteMode==="combined"?"Escolher atlas único":"Escolher sprite"}</button></div>
          <div class="tq-ships__sprite-meta">
            <label class="tq-ships__sprite-path"><span>Asset</span><input value="${this.escape(sprite.src||"")}" readonly placeholder="Nenhum spritesheet selecionado"></label>
            <label><span>Colunas</span><input data-nav-columns type="number" min="1" max="32" value="${columns}" ${ship.autoFrame!==false?"readonly":""}></label>
            <label><span>Linhas</span><input data-nav-rows type="number" min="1" max="32" value="${rows}" ${ship.autoFrame!==false?"readonly":""}></label>
            <label><span>Célula W</span><input value="${Math.round(Number(sprite.cellWidth)||400)}" readonly></label>
            <label><span>Célula H</span><input value="${Math.round(Number(sprite.cellHeight)||400)}" readonly></label>
          </div>

          <div class="tq-ships__direction-toolbar">
            <button type="button" data-dir-prev>← Anterior</button>
            <button type="button" data-dir-copy>Copiar anterior</button>
            <button type="button" data-dir-next>Próxima →</button>
            <span><b>${keys.indexOf(selected)+1}/16</b> posições</span>
          </div>

          <div class="tq-ships__direction-grid">
            ${keys.map(key=>`
              <button type="button" class="tq-ships__direction-card ${key===selected?"is-selected":""}" data-direction="${key}">
                <span class="tq-ships__direction-arrow">${info[key][0]}</span>
                <span class="tq-ships__direction-thumb" style="${cellStyle(key)}">${sprite.src?"":"＋"}</span>
                <small>${this.escape(info[key][1])}</small>
                <em>#${Math.max(0,Math.min(maxFrame,Number(sprite.directionFrames?.[key])||0))+1}</em>
              </button>`).join("")}
          </div>

          <div class="tq-ships__direction-config">
            <div class="tq-ships__direction-preview" style="${cellStyle(selected)}"></div>
            <label><span>Direção</span><strong>${this.escape(info[selected][1])}</strong></label>
            <label><span>Frame do atlas</span><input data-dir-frame type="number" min="1" max="${columns*rows}" value="${selectedFrame+1}"></label>
            <label><span>Posição inicial</span><select data-nav-initial>${keys.map(key=>'<option value="'+key+'" '+(sprite.initialDirection===key?'selected':'')+'>'+info[key][1]+'</option>').join("")}</select></label>
          </div>
          <small class="tq-world-editor-note">Clique em uma direção para configurá-la. Cada direção aponta para uma célula do mesmo spritesheet. ${ship.autoFrame!==false?"Grade calculada automaticamente em células de "+ship.cellSize+"×"+ship.cellSize+".":"Grade manual ativa."}</small>
        </section>
        ${ship.spriteMode==="combined"?this.combinedActionCombatHtml(ship):""}`;

      this.bindAtlasControls(content);
      const updateNav=patch=>this.updateShip({navigation:{...ship.navigation,...patch}});
      const values=()=>({
        width:Math.max(32,Number(content.querySelector("[data-nav-width]")?.value)||230),
        height:Math.max(32,Number(content.querySelector("[data-nav-height]")?.value)||230),
        speed:Math.max(40,Number(content.querySelector("[data-nav-speed]")?.value)||420),
        acceleration:Math.max(100,Number(content.querySelector("[data-nav-accel]")?.value)||1100),
        roll:Math.max(0,Number(content.querySelector("[data-nav-roll]")?.value)||0),
        heave:Math.max(0,Number(content.querySelector("[data-nav-heave]")?.value)||0),
        wake:content.querySelector("[data-nav-wake]")?.checked!==false,
        shadow:content.querySelector("[data-nav-shadow]")?.checked!==false
      });
      content.querySelectorAll("[data-nav-width],[data-nav-height],[data-nav-speed],[data-nav-accel],[data-nav-roll],[data-nav-heave],[data-nav-wake],[data-nav-shadow]").forEach(el=>el.addEventListener("change",()=>updateNav(values())));
      content.querySelector("[data-nav-sprite-pick]")?.addEventListener("click",()=>this.requestFrameAsset?.({shipId:ship.id,section:"navigation",mode:"sprite"}));
      const resizeGrid=()=>{
        const cols=Math.max(1,Number(content.querySelector("[data-nav-columns]")?.value)||4);
        const rws=Math.max(1,Number(content.querySelector("[data-nav-rows]")?.value)||4);
        const imageWidth=Math.max(1,Number(sprite.imageWidth)||cols*400);
        const imageHeight=Math.max(1,Number(sprite.imageHeight)||rws*400);
        this.updateNavigationSprite({columns:cols,rows:rws,cellWidth:Math.floor(imageWidth/cols),cellHeight:Math.floor(imageHeight/rws)});
      };
      content.querySelector("[data-nav-columns]")?.addEventListener("change",resizeGrid);
      content.querySelector("[data-nav-rows]")?.addEventListener("change",resizeGrid);
      content.querySelectorAll("[data-direction]").forEach(button=>button.addEventListener("click",()=>{this.directionByShip.set(ship.id,button.dataset.direction);this.renderEditor()}));
      const selectOffset=delta=>{
        const i=keys.indexOf(selected);
        this.directionByShip.set(ship.id,keys[(i+delta+keys.length)%keys.length]);
        this.renderEditor();
      };
      content.querySelector("[data-dir-prev]")?.addEventListener("click",()=>selectOffset(-1));
      content.querySelector("[data-dir-next]")?.addEventListener("click",()=>selectOffset(1));
      content.querySelector("[data-dir-copy]")?.addEventListener("click",()=>{
        const i=keys.indexOf(selected),prev=keys[(i-1+keys.length)%keys.length];
        const frame=Number(sprite.directionFrames?.[prev])||0;
        this.updateNavigationSprite({directionFrames:{...(sprite.directionFrames||{}),[selected]:frame}});
      });
      content.querySelector("[data-dir-frame]")?.addEventListener("change",e=>{
        const frame=Math.max(0,Math.min(columns*rows-1,(Number(e.currentTarget.value)||1)-1));
        this.updateNavigationSprite({directionFrames:{...(sprite.directionFrames||{}),[selected]:frame}});
      });
      content.querySelector("[data-nav-initial]")?.addEventListener("change",e=>this.updateNavigationSprite({initialDirection:e.currentTarget.value}));
      if(ship.spriteMode==="combined")this.bindCombinedActionCombat(content,ship);
      return;
    }

    const sprite=ship.combat.sprite||{};
    const columns=Math.max(1,Number(sprite.columns)||4);
    const rows=Math.max(1,Number(sprite.rows)||4);
    const total=columns*rows;
    const combatKeys=["idle","fireRight","fireLeft","hit","critical","defeat"];
    const animationRows=combatKeys.map(key=>{
      const anim=ship.animations?.[key]||{};
      const nums=Array.isArray(anim.frames)?anim.frames.filter(v=>Number.isFinite(Number(v))).map(Number):[];
      const start=nums.length?Math.min(...nums):0;
      const finish=nums.length?Math.max(...nums):start;
      return `<tr>
        <td><b>${key}</b></td>
        <td><input data-combat-start="${key}" type="number" min="1" max="${total}" value="${start+1}"></td>
        <td><input data-combat-end="${key}" type="number" min="1" max="${total}" value="${finish+1}"></td>
        <td><input data-combat-ms="${key}" type="number" min="40" max="1000" value="${Number(anim.frameMs)||140}"></td>
        <td><input data-combat-loop="${key}" type="checkbox" ${anim.loop===true?"checked":""}></td>
      </tr>`;
    }).join("");

    content.innerHTML=this.atlasControlsHtml(ship)+`
      <section class="tq-ships__panel">
        <div class="tq-ships__panel-title"><div><strong>Estilo de batalha</strong><small>Resposta visual do navio durante o duelo.</small></div></div>
        <div class="tq-ships__settings tq-ships__settings--v2">
          <label><span>Recoil px</span><input data-combat-recoil type="number" min="0" max="80" value="${Math.round(ship.combat.recoil)}"></label>
          <label><span>Shake px</span><input data-combat-shake type="number" min="0" max="30" value="${Math.round(ship.combat.shake)}"></label>
          <label class="tq-ships__check"><input data-combat-flash type="checkbox" ${ship.combat.muzzleFlash!==false?"checked":""}><span>Flash</span></label>
          <label class="tq-ships__check"><input data-combat-smoke type="checkbox" ${ship.combat.smoke!==false?"checked":""}><span>Fumaça</span></label>
          <label class="tq-ships__check"><input data-combat-impact type="checkbox" ${ship.combat.impact!==false?"checked":""}><span>Impacto</span></label>
        </div>
      </section>

      <section class="tq-ships__panel tq-ships__sprite-panel">
        <div class="tq-ships__panel-title"><div><strong>Sprite de combate</strong><small>${ship.spriteMode==="combined"?"Usando o mesmo atlas da navegação; configure apenas os ranges abaixo.":"Atlas de combate separado; as animações apontam para intervalos de células."}</small></div>${ship.spriteMode==="combined"?'<button type="button" data-combined-sprite-pick>▦ Trocar atlas único</button>':'<button type="button" data-combat-sprite-pick>▦ Escolher sprite</button>'}</div>
        <div class="tq-ships__sprite-meta">
          <label class="tq-ships__sprite-path"><span>Asset</span><input value="${this.escape(sprite.src||"")}" readonly placeholder="Nenhum spritesheet selecionado"></label>
          <label><span>Colunas</span><input data-combat-columns type="number" min="1" max="32" value="${columns}" ${ship.autoFrame!==false?"readonly":""}></label>
          <label><span>Linhas</span><input data-combat-rows type="number" min="1" max="32" value="${rows}" ${ship.autoFrame!==false?"readonly":""}></label>
          <label><span>Célula W</span><input value="${Math.round(Number(sprite.cellWidth)||400)}" readonly></label>
          <label><span>Célula H</span><input value="${Math.round(Number(sprite.cellHeight)||400)}" readonly></label>
        </div>
        <div class="tq-ships__combat-sprite-preview" style="${sprite.src?'background-image:url(&quot;'+this.escape(sprite.src)+'&quot;);':''}"></div>
        <table class="tq-ships__anim-table">
          <thead><tr><th>Animação</th><th>Início</th><th>Fim</th><th>ms</th><th>Loop</th></tr></thead>
          <tbody>${animationRows}</tbody>
        </table>
        <div class="tq-ships__compile"><button type="button" class="is-primary" data-ship-export>⇩ JSON V2</button><small>Ex.: fireRight 5–8 representa frames [4,5,6,7] no runtime.</small></div>
      </section>`;

    this.bindAtlasControls(content);
    const readStyle=()=>({combat:{...ship.combat,
      recoil:Math.max(0,Number(content.querySelector("[data-combat-recoil]")?.value)||0),
      shake:Math.max(0,Number(content.querySelector("[data-combat-shake]")?.value)||0),
      muzzleFlash:content.querySelector("[data-combat-flash]")?.checked!==false,
      smoke:content.querySelector("[data-combat-smoke]")?.checked!==false,
      impact:content.querySelector("[data-combat-impact]")?.checked!==false
    }});
    content.querySelectorAll("[data-combat-recoil],[data-combat-shake],[data-combat-flash],[data-combat-smoke],[data-combat-impact]").forEach(el=>el.addEventListener("change",()=>this.updateShip(readStyle())));
    content.querySelector("[data-combat-sprite-pick]")?.addEventListener("click",()=>this.requestFrameAsset?.({shipId:ship.id,section:"combat",mode:"sprite"}));
    content.querySelector("[data-combined-sprite-pick]")?.addEventListener("click",()=>this.requestFrameAsset?.({shipId:ship.id,section:"navigation",mode:"sprite"}));
    const resizeCombat=()=>{
      const cols=Math.max(1,Number(content.querySelector("[data-combat-columns]")?.value)||4);
      const rws=Math.max(1,Number(content.querySelector("[data-combat-rows]")?.value)||4);
      const imageWidth=Math.max(1,Number(sprite.imageWidth)||cols*400);
      const imageHeight=Math.max(1,Number(sprite.imageHeight)||rws*400);
      this.updateCombatSprite({columns:cols,rows:rws,cellWidth:Math.floor(imageWidth/cols),cellHeight:Math.floor(imageHeight/rws)});
    };
    content.querySelector("[data-combat-columns]")?.addEventListener("change",resizeCombat);
    content.querySelector("[data-combat-rows]")?.addEventListener("change",resizeCombat);
    const saveAnim=key=>{
      const shipDraft=this.editableCurrent();
      if(!shipDraft)return;
      shipDraft.animations=shipDraft.animations||{};
      const start=Math.max(0,Math.min(total-1,(Number(content.querySelector('[data-combat-start="'+key+'"]')?.value)||1)-1));
      const finish=Math.max(start,Math.min(total-1,(Number(content.querySelector('[data-combat-end="'+key+'"]')?.value)||start+1)-1));
      shipDraft.animations[key]={
        ...(shipDraft.animations[key]||{}),
        frames:Array.from({length:finish-start+1},(_,i)=>start+i),
        frameMs:Math.max(40,Number(content.querySelector('[data-combat-ms="'+key+'"]')?.value)||140),
        loop:content.querySelector('[data-combat-loop="'+key+'"]')?.checked===true,
        cellWidth:Number(sprite.cellWidth)||400,
        cellHeight:Number(sprite.cellHeight)||400
      };
      shipDraft.animationGroups=shipDraft.animationGroups||{};
      shipDraft.animationGroups[key]="combat";
      this.save();
    };
    for(const key of combatKeys){
      content.querySelectorAll('[data-combat-start="'+key+'"],[data-combat-end="'+key+'"],[data-combat-ms="'+key+'"],[data-combat-loop="'+key+'"]').forEach(el=>el.addEventListener("change",()=>saveAnim(key)));
    }
    content.querySelector("[data-ship-export]")?.addEventListener("click",()=>this.exportShipJson());
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
    output.navigation={...output.navigation,sprite:clone(output.navigation.sprite||{})};
    output.combat={...output.combat,animations:{}};
    if(output.spriteMode==="split"){
      output.combat.sprite=clone(output.combat.sprite||{});
      output.combat.useNavigationAtlas=false;
    }else{
      output.combat.useNavigationAtlas=true;
      delete output.combat.sprite;
    }
    for(const [key,animation] of Object.entries(output.animations||{})){
      if(output.animationGroups?.[key]==="combat")output.combat.animations[key]=clone(animation);
    }
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
