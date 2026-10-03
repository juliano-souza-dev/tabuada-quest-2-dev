const DEFAULT_FRAME=new URL("../../assets/hud/moldura_de_loja_pirata_halloween_200kb-1.webp",import.meta.url).href;
const DEFAULT_SLOT=new URL("../../assets/hud/painel_de_loja_pirata_de_halloween_200kb.webp",import.meta.url).href;
const SHOP_BUTTON=new URL("../../assets/hud/halloween_hud_loja.webp",import.meta.url).href;

const clamp=(value,min,max)=>Math.min(max,Math.max(min,value));
const money=value=>new Intl.NumberFormat("pt-BR").format(Math.max(0,Math.floor(Number(value)||0)));

const normalizeItems=(source,type)=>{
  const list=Array.isArray(source)?source:[];
  return list.filter(item=>item&&item.available!==false).map(item=>({
    id:String(item.id||""),
    type,
    name:String(item.name||item.id||"Item"),
    description:type==="ammo"
      ?`Dano ${Number(item.damage)||0} · Velocidade ${Number(item.projectileSpeed)||0}`
      :type==="cannon"
        ?String(item.description||"Canhão para combate naval")
        :String(item.description||"Navio disponível"),
    image:String(item.effects?.texture||item.asset||item.image||item.sprite||""),
    price:Math.max(0,Number(item.shop?.price??item.price??0)||0),
    currency:String(item.shop?.currency||item.currency||"gold").toLowerCase(),
    purchasable:item.shop?.purchasable!==false
  })).filter(item=>item.id);
};

export class ShopOverlay{
  constructor(options={}){
    this.options=options;
    this.frameAsset=String(options.frameAsset||DEFAULT_FRAME);
    this.slotAsset=String(options.slotAsset||DEFAULT_SLOT);
    this.catalogs={
      ammo:normalizeItems(options.ammoCatalog,"ammo"),
      cannons:normalizeItems(options.cannonCatalog,"cannon"),
      ships:normalizeItems(options.shipCatalog,"ship")
    };
    this.getBalances=typeof options.getBalances==="function"?options.getBalances:()=>({gold:0,rubies:0});
    this.onPurchase=typeof options.onPurchase==="function"?options.onPurchase:null;
    this.category="ammo";
    this.quantities=new Map();
    this.root=null;
    this.overlay=null;
    this.panel=null;
    this.list=null;
    this.feedback=null;
    this.cleanups=[];
  }

  mount(root){
    if(!root||this.root)return this;
    this.root=root;
    const launcher=document.createElement("button");
    launcher.type="button";
    launcher.className="tq-world-shop-launcher";
    launcher.setAttribute("aria-label","Abrir loja");
    launcher.innerHTML="<span aria-hidden=\"true\"></span><b>Loja</b>";
    launcher.style.backgroundImage=`url("${SHOP_BUTTON}")`;

    const overlay=document.createElement("div");
    overlay.className="tq-world-shop";
    overlay.hidden=true;
    overlay.innerHTML=`
      <button type="button" class="tq-world-shop__scrim" data-shop-close aria-label="Fechar loja"></button>
      <section class="tq-world-shop__panel" role="dialog" aria-modal="true" aria-label="Loja">
        <img class="tq-world-shop__frame" src="${this.frameAsset}" alt="" aria-hidden="true">
        <button type="button" class="tq-world-shop__close" data-shop-close aria-label="Fechar loja">×</button>
        <div class="tq-world-shop__balances" aria-label="Moedas">
          <span class="tq-world-shop__balance tq-world-shop__balance--gold"><b data-shop-gold>0</b></span>
          <span class="tq-world-shop__balance tq-world-shop__balance--ruby"><b data-shop-rubies>0</b></span>
        </div>
        <nav class="tq-world-shop__tabs" aria-label="Categorias da loja">
          <button type="button" data-shop-category="ammo" class="is-active" aria-label="Munições"></button>
          <button type="button" data-shop-category="cannons" aria-label="Canhões"></button>
          <button type="button" data-shop-category="ships" aria-label="Navios"></button>
          <button type="button" data-shop-category="crew" aria-label="Tripulação" disabled></button>
          <button type="button" data-shop-category="items" aria-label="Itens" disabled></button>
        </nav>
        <div class="tq-world-shop__list" data-shop-list></div>
        <p class="tq-world-shop__feedback" data-shop-feedback aria-live="polite"></p>
      </section>`;

    root.append(launcher,overlay);
    this.overlay=overlay;
    this.panel=overlay.querySelector(".tq-world-shop__panel");
    this.list=overlay.querySelector("[data-shop-list]");
    this.feedback=overlay.querySelector("[data-shop-feedback]");

    const open=()=>this.open();
    launcher.addEventListener("click",open);
    this.cleanups.push(()=>launcher.removeEventListener("click",open),()=>launcher.remove());

    overlay.querySelectorAll("[data-shop-close]").forEach(button=>{
      const close=()=>this.close();
      button.addEventListener("click",close);
      this.cleanups.push(()=>button.removeEventListener("click",close));
    });

    overlay.querySelectorAll("[data-shop-category]").forEach(button=>{
      const handler=()=>{
        if(button.disabled)return;
        this.category=String(button.dataset.shopCategory||"ammo");
        overlay.querySelectorAll("[data-shop-category]").forEach(tab=>tab.classList.toggle("is-active",tab===button));
        this.render();
      };
      button.addEventListener("click",handler);
      this.cleanups.push(()=>button.removeEventListener("click",handler));
    });

    const onKey=event=>{if(event.key==="Escape"&&!overlay.hidden)this.close()};
    globalThis.addEventListener?.("keydown",onKey);
    this.cleanups.push(()=>globalThis.removeEventListener?.("keydown",onKey));
    this.render();
    return this;
  }

  open(){
    if(!this.overlay)return;
    this.overlay.hidden=false;
    this.overlay.classList.add("is-open");
    this.refreshBalances();
    this.render();
    document.documentElement.classList.add("tq-shop-open");
    this.panel?.focus?.();
  }

  close(){
    if(!this.overlay)return;
    this.overlay.hidden=true;
    this.overlay.classList.remove("is-open");
    document.documentElement.classList.remove("tq-shop-open");
  }

  refreshBalances(){
    const balances=this.getBalances()||{};
    const gold=this.overlay?.querySelector("[data-shop-gold]");
    const rubies=this.overlay?.querySelector("[data-shop-rubies]");
    if(gold)gold.textContent=money(balances.gold??balances.coins);
    if(rubies)rubies.textContent=money(balances.rubies);
  }

  quantityFor(id){
    return clamp(Math.floor(Number(this.quantities.get(id))||1),1,99);
  }

  changeQuantity(id,delta){
    this.quantities.set(id,clamp(this.quantityFor(id)+Number(delta||0),1,99));
    const value=this.list?.querySelector(`[data-shop-quantity="${CSS.escape(id)}"]`);
    if(value)value.textContent=String(this.quantityFor(id));
  }

  async purchase(item){
    const quantity=this.quantityFor(item.id);
    if(this.feedback)this.feedback.textContent="";
    if(!item.purchasable){
      if(this.feedback)this.feedback.textContent="Este item não está disponível para compra.";
      return;
    }
    try{
      if(this.onPurchase){
        const result=await this.onPurchase({item:{...item},quantity});
        if(result?.ok===false)throw new Error(result.message||"Compra não concluída.");
        if(this.feedback)this.feedback.textContent=result?.message||`${quantity}× ${item.name} adquirido.`;
      }else{
        globalThis.dispatchEvent?.(new CustomEvent("tq:shop-purchase-request",{detail:{item:{...item},quantity}}));
        if(this.feedback)this.feedback.textContent=`${quantity}× ${item.name} selecionado para compra.`;
      }
      this.refreshBalances();
    }catch(error){
      if(this.feedback)this.feedback.textContent=String(error?.message||error||"Compra não concluída.");
    }
  }

  render(){
    if(!this.list)return;
    const items=this.catalogs[this.category]||[];
    this.list.innerHTML="";
    if(!items.length){
      const empty=document.createElement("div");
      empty.className="tq-world-shop__empty";
      empty.textContent="Nenhum item disponível nesta categoria.";
      this.list.append(empty);
      return;
    }
    for(const item of items){
      const row=document.createElement("article");
      row.className="tq-world-shop__slot";
      row.style.backgroundImage=`url("${this.slotAsset}")`;
      const image=item.image?`<img src="${item.image}" alt="">`:"";
      row.innerHTML=`
        <div class="tq-world-shop__item-image">${image}</div>
        <strong class="tq-world-shop__item-name"></strong>
        <p class="tq-world-shop__item-info"></p>
        <div class="tq-world-shop__price" data-currency="${item.currency}"><span></span><b></b></div>
        <div class="tq-world-shop__quantity">
          <button type="button" data-dec aria-label="Diminuir quantidade">−</button>
          <b data-shop-quantity="${item.id}">${this.quantityFor(item.id)}</b>
          <button type="button" data-inc aria-label="Aumentar quantidade">+</button>
        </div>
        <button type="button" class="tq-world-shop__buy" data-buy>Comprar</button>`;
      row.querySelector(".tq-world-shop__item-name").textContent=item.name;
      row.querySelector(".tq-world-shop__item-info").textContent=item.description;
      const priceLabel=item.currency==="rubies"||item.currency==="ruby"||item.currency==="gem"||item.currency==="diamonds"
        ? "💎 "+money(item.price)
        : item.currency==="event"
          ? "Evento"
          : "🪙 "+money(item.price);
      row.querySelector(".tq-world-shop__price b").textContent=priceLabel;
      row.querySelector("[data-dec]").addEventListener("click",()=>this.changeQuantity(item.id,-1));
      row.querySelector("[data-inc]").addEventListener("click",()=>this.changeQuantity(item.id,1));
      row.querySelector("[data-buy]").addEventListener("click",()=>this.purchase(item));
      this.list.append(row);
    }
  }

  destroy(){
    this.close();
    for(const cleanup of this.cleanups.splice(0)){try{cleanup()}catch{}}
    this.overlay?.remove();
    this.overlay=null;
    this.panel=null;
    this.list=null;
    this.root=null;
  }
}
