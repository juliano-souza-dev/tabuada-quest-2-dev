const DEFAULT_FRAME=new URL("../../assets/hud/moldura_de_loja_pirata_halloween_200kb-1.webp",import.meta.url).href;
const DEFAULT_SLOT=new URL("../../assets/hud/painel_de_loja_pirata_de_halloween_200kb.webp",import.meta.url).href;
const SHOP_BUTTON=new URL("../../assets/hud/halloween_hud_loja.webp",import.meta.url).href;

const clamp=(value,min,max)=>Math.min(max,Math.max(min,value));
const money=value=>new Intl.NumberFormat("pt-BR").format(Math.max(0,Math.floor(Number(value)||0)));

const HULL_REINFORCEMENT={id:"hull-reinforcement",type:"item",name:"Reforço de Casco",description:"+1.000.000 de proteção por até 5 min. Afundou, perdeu.",image:"",price:4,currency:"gold",purchasable:true};
const normalizeItems=(source,type)=>{
  const list=Array.isArray(source)?source:[];
  return list.filter(item=>item&&item.available!==false&&item.shop?.purchasable===true).map(item=>({
    id:String(item.id||""),
    type,
    name:String(item.name||item.id||"Item"),
    description:type==="ammo"
      ?`Dano ${Number(item.damage)||0} · Velocidade ${Number(item.projectileSpeed)||0} · Pacote ${Math.max(1,Math.floor(Number(item.shop?.packQuantity)||1))}`
      :type==="cannon"
        ?String(item.description||"Canhão para combate naval")
        :String(item.description||"Navio disponível"),
    image:String(item.effects?.texture||item.asset||item.image||item.sprite||""),
    price:Math.max(0,Number(item.shop?.price??item.price??0)||0),
    currency:String(item.shop?.currency||item.currency||"gold").toLowerCase(),
    packQuantity:Math.max(1,Math.floor(Number(item.shop?.packQuantity)||1)),
    purchasable:true
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
      ships:normalizeItems(options.shipCatalog,"ship"),
      items:[HULL_REINFORCEMENT]
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
    this.feedbackMessage=null;
    this.feedbackClose=null;
    this.feedbackTimer=0;
    this.purchaseInFlight=false;
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
          <button type="button" data-shop-category="items" aria-label="Itens"></button>
        </nav>
        <div class="tq-world-shop__list" data-shop-list></div>
        <div class="tq-world-shop__feedback" data-shop-feedback aria-live="polite" role="status" aria-atomic="true">
          <span data-shop-feedback-message></span>
          <button type="button" data-shop-feedback-close aria-label="Fechar mensagem">×</button>
        </div>
      </section>`;

    root.append(launcher,overlay);
    this.overlay=overlay;
    this.panel=overlay.querySelector(".tq-world-shop__panel");
    this.list=overlay.querySelector("[data-shop-list]");
    this.feedback=overlay.querySelector("[data-shop-feedback]");
    this.feedbackMessage=overlay.querySelector("[data-shop-feedback-message]");
    this.feedbackClose=overlay.querySelector("[data-shop-feedback-close]");

    const open=()=>this.open();
    launcher.addEventListener("click",open);
    this.cleanups.push(()=>launcher.removeEventListener("click",open),()=>launcher.remove());

    overlay.querySelectorAll("[data-shop-close]").forEach(button=>{
      const close=()=>this.close();
      button.addEventListener("click",close);
      this.cleanups.push(()=>button.removeEventListener("click",close));
    });
    const dismissFeedback=()=>this.dismissFeedback();
    this.feedbackClose?.addEventListener("click",dismissFeedback);
    this.cleanups.push(()=>this.feedbackClose?.removeEventListener("click",dismissFeedback));

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
    const onWalletChange=()=>{
      this.refreshBalances();
      if(this.overlay&&!this.overlay.hidden)this.render();
    };
    globalThis.addEventListener?.("keydown",onKey);
    globalThis.addEventListener?.("tq:rewardgranted",onWalletChange);
    globalThis.addEventListener?.("tq:shoppurchase",onWalletChange);
    this.cleanups.push(
      ()=>globalThis.removeEventListener?.("keydown",onKey),
      ()=>globalThis.removeEventListener?.("tq:rewardgranted",onWalletChange),
      ()=>globalThis.removeEventListener?.("tq:shoppurchase",onWalletChange)
    );
    this.refreshBalances();
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
    this.dismissFeedback();
    this.overlay.hidden=true;
    this.overlay.classList.remove("is-open");
    document.documentElement.classList.remove("tq-shop-open");
  }

  setFeedback(message,type="info"){
    this.dismissFeedback();
    const text=String(message||"");
    if(!this.feedback||!this.feedbackMessage||!text)return;
    this.feedbackMessage.textContent=text;
    this.feedback.dataset.state=type;
    this.feedback.classList.add("is-visible");
    this.feedbackTimer=globalThis.setTimeout?.(()=>this.dismissFeedback(),4500)||0;
  }

  dismissFeedback(){
    if(this.feedbackTimer){globalThis.clearTimeout?.(this.feedbackTimer);this.feedbackTimer=0}
    if(this.feedbackMessage)this.feedbackMessage.textContent="";
    if(this.feedback){
      this.feedback.dataset.state="";
      this.feedback.classList.remove("is-visible");
    }
  }

  refreshBalances(){
    const balances=this.getBalances()||{};
    const gold=this.overlay?.querySelector("[data-shop-gold]");
    const rubies=this.overlay?.querySelector("[data-shop-rubies]");
    if(gold)gold.textContent=money(balances.gold??balances.coins);
    if(rubies)rubies.textContent=money(balances.rubies);
  }

  setCatalogs({ammoCatalog,cannonCatalog,shipCatalog}={}){
    if(Array.isArray(ammoCatalog))this.catalogs.ammo=normalizeItems(ammoCatalog,"ammo");
    if(Array.isArray(cannonCatalog))this.catalogs.cannons=normalizeItems(cannonCatalog,"cannon");
    if(Array.isArray(shipCatalog))this.catalogs.ships=normalizeItems(shipCatalog,"ship");
    if(this.overlay&&!this.overlay.hidden)this.render();
    return this;
  }

  quantityFor(id){
    return clamp(Math.floor(Number(this.quantities.get(id))||1),1,99);
  }

  priceLabel(item,quantity=1){
    const total=Math.max(0,Number(item?.price)||0)*Math.max(1,Math.floor(Number(quantity)||1));
    const currency=String(item?.currency||"gold").toLowerCase();
    if(currency==="rubies"||currency==="ruby"||currency==="gem"||currency==="diamonds"){
      return money(total)+" rubi"+(total===1?"":"s");
    }
    if(currency==="event")return "Evento";
    return money(total)+" ouro";
  }

  refreshItemPrice(id){
    const item=(this.catalogs[this.category]||[]).find(candidate=>candidate.id===id);
    const price=this.list?.querySelector(`[data-shop-price="${CSS.escape(id)}"]`);
    if(!item||!price)return;
    const quantity=this.quantityFor(id);
    const label=this.priceLabel(item,quantity);
    price.textContent=label;
    price.parentElement?.setAttribute("aria-label",`Preço total: ${label}. Quantidade: ${quantity}.`);
  }

  changeQuantity(id,delta){
    this.quantities.set(id,clamp(this.quantityFor(id)+Number(delta||0),1,99));
    const value=this.list?.querySelector(`[data-shop-quantity="${CSS.escape(id)}"]`);
    if(value)value.textContent=String(this.quantityFor(id));
    this.refreshItemPrice(id);
  }

  async purchase(item){
    const quantity=this.quantityFor(item.id);
    if(this.purchaseInFlight)return;
    this.setFeedback("");
    if(!item.purchasable){
      this.setFeedback("Este item não está disponível para compra.","error");
      return;
    }
    const currency=String(item.currency||"gold").toLowerCase();
    if(currency==="event"){
      this.setFeedback("Este item só pode ser obtido durante o evento.","error");
      return;
    }
    const walletKey=["rubies","ruby","gem","gems","diamond","diamonds"].includes(currency)?"rubies":"gold";
    const total=Math.max(0,Math.floor(Number(item.price)||0))*quantity;
    const balances=this.getBalances()||{};
    const available=Math.max(0,Number(balances[walletKey])||0);
    if(available<total){
      const currencyName=walletKey==="rubies"?"rubis":"ouro";
      this.setFeedback(`Saldo insuficiente: são necessários ${money(total)} ${currencyName}.`,"error");
      return;
    }
    if(!this.onPurchase){
      this.setFeedback("A compra não está disponível agora. Tente novamente.","error");
      return;
    }
    const buyButton=this.list?.querySelector(`[data-shop-price="${CSS.escape(item.id)}"]`)?.closest(".tq-world-shop__slot")?.querySelector("[data-buy]");
    this.purchaseInFlight=true;
    if(buyButton){buyButton.disabled=true;buyButton.setAttribute("aria-busy","true")}
    try{
      const result=await this.onPurchase({item:{...item},quantity});
      if(result?.ok!==true){
        this.setFeedback(result?.message||"Compra não concluída. Nenhum item foi adicionado.","error");
        return;
      }
      this.setFeedback(result.message||`${quantity}× ${item.name} adquirido.`,"success");
      this.refreshBalances();
    }catch(error){
      this.setFeedback(String(error?.message||error||"Compra não concluída."),"error");
    }finally{
      this.purchaseInFlight=false;
      if(buyButton){buyButton.disabled=false;buyButton.removeAttribute("aria-busy")}
    }
  }

  render(){
    if(!this.list)return;
    this.refreshBalances();
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
        <div class="tq-world-shop__price" data-currency="${item.currency}"><span class="tq-world-shop__price-label">Preço</span><b data-shop-price="${item.id}"></b></div>
        <div class="tq-world-shop__quantity">
          <button type="button" data-dec aria-label="Diminuir quantidade">−</button>
          <b data-shop-quantity="${item.id}">${this.quantityFor(item.id)}</b>
          <button type="button" data-inc aria-label="Aumentar quantidade">+</button>
        </div>
        <button type="button" class="tq-world-shop__buy" data-buy>Comprar</button>`;
      row.querySelector(".tq-world-shop__item-name").textContent=item.name;
      row.querySelector(".tq-world-shop__item-info").textContent=item.description;
      row.querySelector("[data-dec]").addEventListener("click",()=>this.changeQuantity(item.id,-1));
      row.querySelector("[data-inc]").addEventListener("click",()=>this.changeQuantity(item.id,1));
      row.querySelector("[data-buy]").addEventListener("click",()=>this.purchase(item));
      this.list.append(row);
      this.refreshItemPrice(item.id);
    }
  }

  destroy(){
    this.close();
    for(const cleanup of this.cleanups.splice(0)){try{cleanup()}catch{}}
    this.overlay?.remove();
    this.overlay=null;
    this.panel=null;
    this.list=null;
    this.feedback=null;
    this.feedbackMessage=null;
    this.feedbackClose=null;
    this.root=null;
  }
}
