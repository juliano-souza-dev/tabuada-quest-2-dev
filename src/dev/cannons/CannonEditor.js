import { CannonPreview } from "./CannonPreview.js?v=20261002-1700";
const clone=value=>value==null?value:JSON.parse(JSON.stringify(value));
const slug=value=>String(value||"cannon").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-z0-9]+/g,"-").replace(/^-+|-+$/g,"")||"cannon";

export class CannonEditor{
  constructor({requestAsset}={}){
    this.requestAsset=typeof requestAsset==="function"?requestAsset:null;
    this.catalog={schema:"tq.cannon-catalog",version:3,defaultCannonId:"",cannons:[]};
    this.selectedId=null;this.el=null;
    this.storageKey="tq.dev.cannon-catalog-live:v2";
    this.legacyStorageKey="tq.dev.cannon-catalog-live:v1";
    this.trashKey="tq.dev.cannon-trash:v1";
    this.trash=[];
    this.preview=new CannonPreview();
  }
  async mount(parent){
    this.el=document.createElement("section");this.el.className="tq-dev__ships tq-dev__cannons";this.el.hidden=true;
    this.el.innerHTML='<header><div><strong>Canhões</strong><small>Catálogo naval · alterações salvas automaticamente</small></div><button type="button" data-cannon-close aria-label="Fechar">×</button></header><div class="tq-ships__body"><aside class="tq-ships__sidebar"><button type="button" class="tq-ships__new" data-cannon-new>＋ Novo canhão</button><div class="tq-ships__list" data-cannon-list></div><button type="button" class="tq-ships__new" data-cannon-trash-toggle>🗑 Lixeira</button><div class="tq-ships__list" data-cannon-trash hidden></div></aside><main class="tq-ships__editor" data-cannon-editor></main></div>';
    parent.append(this.el);
    this.el.querySelector("[data-cannon-close]").onclick=()=>this.setVisible(false);
    this.el.querySelector("[data-cannon-new]").onclick=()=>this.create();
    this.el.querySelector("[data-cannon-trash-toggle]").onclick=()=>{const t=this.el.querySelector("[data-cannon-trash]");t.hidden=!t.hidden;this.renderTrash()};
    await this.load();
  }
  async load(){
    let repoCannons=[];
    try{
      const r=await fetch("./src/config/cannon-catalog.json?v=20261002-2136",{cache:"no-store"});
      if(r.ok){
        this.catalog=await r.json();
        repoCannons=Array.isArray(this.catalog.cannons)?this.catalog.cannons:[];
      }
    }catch(e){console.warn("Cannon catalog load failed",e)}
    try{const trash=JSON.parse(localStorage.getItem(this.trashKey)||"[]");this.trash=Array.isArray(trash)?trash:[]}catch{this.trash=[]}
    const trashedIds=new Set(this.trash.map(item=>String(item?.id||"")));
    let local=null;
    try{local=JSON.parse(localStorage.getItem(this.storageKey)||"null")}catch{}
    const repoIds=new Set(repoCannons.map(item=>String(item?.id||"")));
    const byId=new Map(repoCannons.map(item=>[String(item.id),this.normalize(item)]));
    if(Array.isArray(local)){
      for(const item of local){
        const id=String(item?.id||"");if(!id)continue;
        const base=byId.get(id);
        byId.set(id,this.normalize(base?{...base,...item}:{...item}));
      }
    }else{
      let legacy=null;
      try{legacy=JSON.parse(localStorage.getItem(this.legacyStorageKey)||"null")}catch{}
      if(Array.isArray(legacy)){
        for(const item of legacy){
          const id=String(item?.id||"");
          if(id&&!repoIds.has(id))byId.set(id,this.normalize(item));
        }
      }
    }
    this.catalog.version=3;
    this.catalog.cannons=[...byId.values()].filter(item=>!trashedIds.has(String(item.id)));
    try{localStorage.setItem(this.storageKey,JSON.stringify(this.catalog.cannons))}catch(error){console.warn("Cannon catalog migration save failed",error)}
    this.selectedId=this.catalog.cannons[0]?.id||null;this.render();this.emit();
  }
  normalize(raw={}){
    const legacyCurrency=String(raw.shop?.currency||"gold");
    const legacyPrice=Math.max(0,Number(raw.shop?.price)||0);
    const gold=Math.max(0,Number(raw.shop?.gold??(legacyCurrency==="gold"?legacyPrice:0))||0);
    const rubies=Math.max(0,Number(raw.shop?.rubies??(legacyCurrency==="rubies"?legacyPrice:0))||0);
    const unlockRegion=raw.progression?.unlockRegion==null?null:Math.max(1,Math.floor(Number(raw.progression.unlockRegion)||1));
    return {
      id:String(raw.id||"cannon"),code:String(raw.code||""),name:String(raw.name||"Novo canhão"),asset:String(raw.asset||""),available:raw.available!==false,
      function:String(raw.function||""),event:String(raw.event||""),variantOf:String(raw.variantOf||""),
      progression:{unlock:String(raw.progression?.unlock||""),unlockRegion},
      damageMultiplier:Math.max(.1,Math.min(5,Number(raw.damageMultiplier)||1)),
      range:Math.max(100,Number(raw.range)||900),projectileSpeed:Math.max(100,Number(raw.projectileSpeed)||620),
      attackCooldownMs:Math.max(100,Number(raw.attackCooldownMs)||1200),
      shop:{
        purchasable:raw.shop?.purchasable===true,currency:legacyCurrency,price:legacyPrice,
        gold,rubies,label:String(raw.shop?.label||"")
      },
      acquisition:{
        shop:raw.acquisition?.shop??raw.shop?.purchasable===true,
        shipBossReward:raw.acquisition?.shipBossReward===true,
        event:raw.acquisition?.event===true
      }
    };
  }
  all(){return (this.catalog.cannons||[]).filter(x=>x.available!==false).map(clone)}
  allIncludingInactive(){return (this.catalog.cannons||[]).map(clone)}
  getCatalog(){return {...clone(this.catalog),cannons:this.all()}}
  current(){return (this.catalog.cannons||[]).find(x=>x.id===this.selectedId)||null}
  persist(){
    localStorage.setItem(this.storageKey,JSON.stringify(this.catalog.cannons||[]));
    localStorage.setItem(this.trashKey,JSON.stringify(this.trash||[]));this.emit();
  }
  emit(){globalThis.dispatchEvent(new CustomEvent("tq:cannonprofilechange",{detail:{cannonId:this.selectedId}}))}
  create(){
    let base="novo-canhao",id=base,n=2;const used=new Set([...(this.catalog.cannons||[]),...this.trash].map(x=>x.id));
    while(used.has(id))id=base+"-"+n++;
    const cannon=this.normalize({id,code:"DEV",name:"Novo canhão",asset:"",available:true,progression:{unlock:"DEV"},damageMultiplier:1,range:900,projectileSpeed:620,attackCooldownMs:1200,shop:{purchasable:true,currency:"gold",price:100,gold:100,rubies:0},acquisition:{shop:true,shipBossReward:false,event:false}});
    this.catalog.cannons.push(cannon);this.selectedId=id;this.persist();this.render();
  }
  update(patch){
    const cannon=this.current();if(!cannon)return;
    Object.assign(cannon,patch);this.persist();this.renderList();
  }
  trashCurrent(){
    const cannon=this.current();if(!cannon)return;
    this.trash.push({...clone(cannon),available:false,trashedAt:Date.now()});
    this.catalog.cannons=this.catalog.cannons.filter(x=>x.id!==cannon.id);
    if(this.catalog.defaultCannonId===cannon.id)this.catalog.defaultCannonId=this.catalog.cannons[0]?.id||"";
    this.selectedId=this.catalog.cannons[0]?.id||null;this.persist();this.render();
  }
  restore(id){
    const i=this.trash.findIndex(x=>x.id===id);if(i<0)return;
    const cannon=this.normalize({...this.trash[i],available:true});delete cannon.trashedAt;
    this.trash.splice(i,1);this.catalog.cannons.push(cannon);this.selectedId=cannon.id;this.persist();this.render();
  }
  setAsset(asset){const c=this.current();if(!c)return;c.asset=String(asset||"");this.persist();this.renderEditor()}
  setVisible(show){if(this.el)this.el.hidden=!show;if(show)this.render();else this.preview?.stop?.()}
  render(){if(!this.el)return;this.renderList();this.renderTrash();this.renderEditor()}
  renderList(){
    const list=this.el?.querySelector("[data-cannon-list]");if(!list)return;
    list.innerHTML=(this.catalog.cannons||[]).map(x=>'<button type="button" class="'+(x.id===this.selectedId?'active':'')+'" data-cannon-id="'+this.e(x.id)+'"><strong>'+this.e(x.name)+'</strong><small>'+this.e(x.code||x.id)+' · '+this.e(x.progression?.unlock||"DEV")+' · ×'+Number(x.damageMultiplier||1).toFixed(2)+'</small></button>').join("");
    list.querySelectorAll("[data-cannon-id]").forEach(b=>b.onclick=()=>{this.selectedId=b.dataset.cannonId;this.render()});
  }
  renderTrash(){
    const box=this.el?.querySelector("[data-cannon-trash]");if(!box)return;
    box.innerHTML=this.trash.length?this.trash.map(x=>'<button type="button" data-cannon-restore="'+this.e(x.id)+'"><strong>'+this.e(x.name)+'</strong><small>↩ Restaurar</small></button>').join(""):'<small class="tq-ships__empty">Lixeira vazia.</small>';
    box.querySelectorAll("[data-cannon-restore]").forEach(b=>b.onclick=()=>this.restore(b.dataset.cannonRestore));
  }
  renderEditor(){
    const h=this.el?.querySelector("[data-cannon-editor]"),c=this.current();if(!h)return;
    this.preview?.stop?.();
    if(!c){h.innerHTML='<div class="tq-ships__empty">Crie ou restaure um canhão.</div>';return}
    const cadence=(1000/Math.max(100,c.attackCooldownMs)).toFixed(2);
    h.innerHTML='<div class="tq-cannon-workspace"><div class="tq-cannon-controls"><section class="tq-ships__panel tq-cannon-editor-card">'+
      '<div class="tq-ships__panel-title tq-cannon-editor-head"><div><strong>Configuração do canhão</strong><small>Autosave ativo · alterações entram imediatamente no combate DEV.</small></div><button type="button" class="tq-ships__new tq-cannon-trash-action" data-cannon-trash>🗑 Mover para lixeira</button></div>'+
      '<div class="tq-cannon-grid">'+
        '<section class="tq-cannon-group tq-cannon-group--identity"><h4>Identidade</h4><div class="tq-cannon-identity">'+
          '<label class="tq-cannon-field"><span>Nome</span><input data-c-name value="'+this.e(c.name)+'"></label>'+
          '<label class="tq-cannon-field"><span>ID de progressão</span><input data-c-code value="'+this.e(c.code)+'"></label>'+
          '<label class="tq-cannon-field"><span>Desbloqueio</span><input data-c-unlock value="'+this.e(c.progression?.unlock||"")+'" placeholder="R1 / Evento"></label>'+
          '<label class="tq-cannon-field"><span>Função</span><input data-c-function value="'+this.e(c.function||"")+'"></label>'+
          '<div class="tq-cannon-asset"><span>Asset do canhão</span><div class="tq-cannon-asset-row">'+(c.asset?'<img src="'+this.e(c.asset)+'" alt="">':'<span class="tq-cannon-asset-empty">∅</span>')+'<div><button type="button" class="tq-ships__new" data-c-asset>▦ Escolher asset</button><small>'+this.e(c.asset||"Nenhum asset selecionado")+'</small></div></div></div>'+
        '</div></section>'+
        '<section class="tq-cannon-group tq-cannon-group--combat"><h4>Combate</h4>'+
          '<label class="tq-cannon-slider"><span><b>Multiplicador de dano</b><output data-c-damage-out>×'+Number(c.damageMultiplier||1).toFixed(2)+'</output></span><input data-c-damage type="range" min="0.5" max="3" step="0.05" value="'+Number(c.damageMultiplier||1)+'"></label>'+
          '<label class="tq-cannon-slider"><span><b>Alcance</b><output data-c-range-out>'+Math.round(c.range)+' px</output></span><input data-c-range type="range" min="100" max="6000" step="25" value="'+c.range+'"></label>'+
          '<label class="tq-cannon-slider"><span><b>Velocidade de disparo</b><output data-c-rate-out>'+cadence+' tiro/s</output></span><input data-c-rate type="range" min="0.2" max="10" step="0.1" value="'+cadence+'"></label>'+
          '<label class="tq-cannon-slider"><span><b>Velocidade do projétil</b><output data-c-projectile-out>'+Math.round(c.projectileSpeed)+' px/s</output></span><input data-c-projectile type="range" min="100" max="3000" step="20" value="'+c.projectileSpeed+'"></label>'+
        '</section>'+
        '<section class="tq-cannon-group tq-cannon-group--purchase"><h4>Compra e obtenção</h4><div class="tq-cannon-purchase-grid">'+
          '<label class="tq-cannon-field"><span>Ouro</span><input data-c-gold type="number" min="0" max="999999" step="1" value="'+Number(c.shop.gold||0)+'"></label>'+
          '<label class="tq-cannon-field"><span>Rubis</span><input data-c-rubies type="number" min="0" max="999999" step="1" value="'+Number(c.shop.rubies||0)+'"></label>'+
        '</div><div class="tq-cannon-acquisition">'+
          '<label><input data-c-shop type="checkbox" '+(c.acquisition.shop?"checked":"")+'><span><b>Loja</b><small>Disponível para compra no estaleiro.</small></span></label>'+
          '<label><input data-c-boss type="checkbox" '+(c.acquisition.shipBossReward?"checked":"")+'><span><b>Navio / Boss</b><small>Pode ser concedido como recompensa.</small></span></label>'+
          '<label><input data-c-event type="checkbox" '+(c.acquisition.event?"checked":"")+'><span><b>Evento</b><small>Obtido por evento especial.</small></span></label>'+
        '</div></section>'+
      '</div></section></div><aside class="tq-cannon-simulator-column"><div data-cannon-preview-host></div></aside></div>';
    const sync=()=>{
      c.name=h.querySelector("[data-c-name]").value.trim()||"Canhão";
      c.code=h.querySelector("[data-c-code]").value.trim();
      c.progression={...(c.progression||{}),unlock:h.querySelector("[data-c-unlock]").value.trim()};
      const regionMatch=c.progression.unlock.match(/^R(\d+)$/i);
      c.progression.unlockRegion=regionMatch?Math.max(1,Number(regionMatch[1])||1):null;
      c.function=h.querySelector("[data-c-function]").value.trim();
      c.damageMultiplier=Math.max(.5,Math.min(3,Number(h.querySelector("[data-c-damage]").value)||1));
      c.range=Math.max(100,Number(h.querySelector("[data-c-range]").value)||900);
      const rate=Math.max(.1,Number(h.querySelector("[data-c-rate]").value)||1);
      c.attackCooldownMs=Math.round(1000/rate);
      c.projectileSpeed=Math.max(100,Number(h.querySelector("[data-c-projectile]").value)||620);
      const gold=Math.max(0,Number(h.querySelector("[data-c-gold]").value)||0);
      const rubies=Math.max(0,Number(h.querySelector("[data-c-rubies]").value)||0);
      const shopEnabled=h.querySelector("[data-c-shop]").checked;
      const eventEnabled=h.querySelector("[data-c-event]").checked;
      c.shop={...(c.shop||{}),purchasable:shopEnabled,gold,rubies,currency:gold>0?"gold":(rubies>0?"rubies":"gold"),price:gold>0?gold:rubies,label:eventEnabled?"Evento":""};
      c.acquisition={shop:shopEnabled,shipBossReward:h.querySelector("[data-c-boss]").checked,event:eventEnabled};
      c.event=eventEnabled?(c.event||"event"):"";
      h.querySelector("[data-c-damage-out]").textContent="×"+c.damageMultiplier.toFixed(2);
      h.querySelector("[data-c-range-out]").textContent=Math.round(c.range)+" px";
      h.querySelector("[data-c-rate-out]").textContent=rate.toFixed(2)+" tiro/s";
      h.querySelector("[data-c-projectile-out]").textContent=Math.round(c.projectileSpeed)+" px/s";
      this.persist();this.renderList();this.preview?.update?.(c);
    };
    h.querySelectorAll("input,select").forEach(x=>x.addEventListener(x.type==="range"?"input":"change",sync));
    h.querySelector("[data-c-name]").addEventListener("input",sync);
    h.querySelector("[data-c-asset]")?.addEventListener("click",()=>this.requestAsset?.({cannonId:c.id,currentAsset:c.asset}));
    this.preview?.mount?.(h.querySelector("[data-cannon-preview-host]"),c);
    h.querySelector("[data-cannon-trash]").onclick=()=>this.trashCurrent();
  }
  e(v){return String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]))}
}
