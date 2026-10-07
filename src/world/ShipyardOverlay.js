const element=(tag,className,text)=>{
  const node=document.createElement(tag);
  if(className)node.className=className;
  if(text!==undefined)node.textContent=text;
  return node;
};

export class ShipyardOverlay {
  constructor({getState,onEquipShip,onEquipCannon,onRemoveCannon}={}){
    this.getState=getState||(()=>({}));
    this.onEquipShip=onEquipShip;
    this.onEquipCannon=onEquipCannon;
    this.onRemoveCannon=onRemoveCannon;
    this.overlay=null;
    this.content=null;
    this.message=null;
    this.activeTab="ships";
  }

  mount(root){
    if(this.overlay)return this;
    const overlay=element("div","tq-shipyard");overlay.hidden=true;
    const scrim=element("button","tq-shipyard__scrim");scrim.type="button";scrim.setAttribute("aria-label","Fechar estaleiro");
    const panel=element("section","tq-shipyard__panel");panel.setAttribute("role","dialog");panel.setAttribute("aria-modal","true");panel.setAttribute("aria-label","Estaleiro");
    const header=element("header","tq-shipyard__header");header.append(element("strong","","⚓ Estaleiro"));
    const close=element("button","tq-shipyard__close","×");close.type="button";close.setAttribute("aria-label","Fechar estaleiro");header.append(close);
    this.content=element("div","tq-shipyard__content");
    this.message=element("p","tq-shipyard__message");
    this.message.setAttribute("aria-live","polite");
    panel.append(header,this.content,this.message);
    overlay.append(scrim,panel);
    root.append(overlay);
    this.overlay=overlay;
    scrim.addEventListener("click",()=>this.close());
    close.addEventListener("click",()=>this.close());
    return this;
  }

  open(){
    if(!this.overlay)return;
    this.overlay.hidden=false;
    this.render();
    this.overlay.querySelector(".tq-shipyard__close")?.focus();
  }

  close(){
    if(this.overlay)this.overlay.hidden=true;
  }

  setMessage(value,isError=false){
    if(!this.message)return;
    this.message.textContent=String(value||"");
    this.message.classList.toggle("is-error",isError);
  }

  async run(action,...args){
    if(typeof action!=="function"){
      this.setMessage("Esta ação ainda não está disponível nesta tela.",true);
      return;
    }
    try{
      const result=await action(...args);
      const success=result!==false&&result?.ok!==false;
      this.setMessage(result?.message||(success?"Estaleiro atualizado.":"Operação não concluída."),!success);
      this.render();
    }catch(error){
      console.error("[TabuadaQuest] Shipyard action failed",error);
      this.setMessage("Não foi possível concluir a operação.",true);
    }
  }

  renderTabs(tabs){
    const nav=element("nav","tq-shipyard__tabs");
    nav.setAttribute("aria-label","Áreas do estaleiro");

    const shipsTab=element("button","tq-shipyard__tab","🚢 Navios");
    shipsTab.type="button";
    shipsTab.disabled=tabs.ships===false;
    shipsTab.classList.toggle("is-active",this.activeTab==="ships");
    shipsTab.setAttribute("aria-pressed",String(this.activeTab==="ships"));
    shipsTab.addEventListener("click",()=>{
      this.activeTab="ships";
      this.render();
    });

    const cannonsTab=element("button","tq-shipyard__tab","💥 Canhões");
    cannonsTab.type="button";
    cannonsTab.disabled=tabs.cannons===false;
    cannonsTab.classList.toggle("is-active",this.activeTab==="cannons");
    cannonsTab.setAttribute("aria-pressed",String(this.activeTab==="cannons"));
    cannonsTab.addEventListener("click",()=>{
      this.activeTab="cannons";
      this.render();
    });

    nav.append(shipsTab,cannonsTab);
    return nav;
  }

  renderShipCard(ship){
    const card=element("article","tq-shipyard__ship"+(ship.equipped?" is-equipped":""));
    const top=element("div","tq-shipyard__ship-top");
    top.append(element("strong","",String(ship.name||ship.id||"Navio")));
    if(ship.equipped)top.append(element("span","tq-shipyard__badge","Em uso"));
    card.append(top);

    const use=element("button","tq-shipyard__action",ship.equipped?"Navio ativo":"Usar este navio");
    use.type="button";
    use.disabled=ship.equipped===true;
    use.addEventListener("click",()=>this.run(this.onEquipShip,String(ship.id||"")));
    card.append(use);
    return card;
  }

  renderShipsTab(ships){
    const fragment=document.createDocumentFragment();
    fragment.append(element("h3","tq-shipyard__title","Sua frota"));

    if(!ships.length){
      fragment.append(element("p","tq-shipyard__empty","Você ainda não possui navios. Visite a loja para ampliar a frota."));
      return fragment;
    }

    for(const ship of ships)fragment.append(this.renderShipCard(ship));
    return fragment;
  }

  renderInstalledCannons(activeShip){
    const installed=Array.isArray(activeShip?.cannons)?activeShip.cannons:[];
    const capacity=Math.max(0,Math.floor(Number(activeShip?.combat?.cannonSlots)||0));
    const section=element("section","tq-shipyard__section");
    const head=element("div","tq-shipyard__section-head");
    head.append(element("strong","","Canhões instalados"));
    head.append(element("span","tq-shipyard__count",capacity?installed.length+"/"+capacity:String(installed.length)));
    section.append(head);

    const list=element("div","tq-shipyard__installed");
    if(!installed.length){
      list.append(element("span","tq-shipyard__none","Nenhum canhão equipado neste navio."));
    }else{
      for(const cannon of installed){
        const row=element("div","tq-shipyard__installed-row");
        row.append(element("span","",String(cannon.name||cannon.id||"Canhão")));
        const remove=element("button","tq-shipyard__remove","Guardar");
        remove.type="button";
        remove.addEventListener("click",()=>this.run(
          this.onRemoveCannon,
          String(cannon.id||""),
          String(activeShip.id||"")
        ));
        row.append(remove);
        list.append(row);
      }
    }
    section.append(list);
    return section;
  }

  renderCannonStorage(cannons,storage,activeShip){
    const section=element("section","tq-shipyard__section");
    section.append(element("strong","tq-shipyard__section-title","Depósito"));

    const available=cannons.filter(cannon=>Math.max(0,Number(storage[cannon?.id])||0)>0);
    if(!available.length){
      section.append(element("p","tq-shipyard__empty","Não há canhões guardados no depósito."));
      return section;
    }

    const stock=element("div","tq-shipyard__stock");
    for(const cannon of available){
      const quantity=Math.max(0,Number(storage[cannon.id])||0);
      const button=element("button","tq-shipyard__stock-item");
      button.type="button";
      button.dataset.tutorialEquipCannon="true";
      button.disabled=!activeShip;
      button.textContent=activeShip
        ?`Equipar ${cannon.name||cannon.id} ×${quantity}`
        :`${cannon.name||cannon.id} ×${quantity}`;
      button.addEventListener("click",()=>this.run(this.onEquipCannon,String(cannon.id||"")));
      stock.append(button);
    }
    section.append(stock);
    return section;
  }

  renderCannonsTab(ships,cannons,storage){
    const fragment=document.createDocumentFragment();
    fragment.append(element("h3","tq-shipyard__title","Arsenal de canhões"));

    const activeShip=ships.find(ship=>ship?.equipped===true)||null;
    if(!activeShip){
      fragment.append(element("p","tq-shipyard__empty","Selecione primeiro um navio na aba Navios para gerenciar os canhões."));
      fragment.append(this.renderCannonStorage(cannons,storage,null));
      return fragment;
    }

    const active=element("div","tq-shipyard__active-ship");
    active.append(element("small","","Navio selecionado"));
    active.append(element("strong","",String(activeShip.name||activeShip.id||"Navio")));
    fragment.append(active);
    fragment.append(this.renderInstalledCannons(activeShip));
    fragment.append(this.renderCannonStorage(cannons,storage,activeShip));
    return fragment;
  }

  render(){
    if(!this.content)return;

    const state=this.getState()||{};
    const ships=Array.isArray(state.ships)?state.ships:[];
    const cannons=Array.isArray(state.cannons)?state.cannons:[];
    const storage=state.storage&&typeof state.storage==="object"?state.storage:{};
    const tabs=state.tabs&&typeof state.tabs==="object"?state.tabs:{ships:true,cannons:true};

    if(tabs.ships===false)this.activeTab="cannons";
    if(tabs.cannons===false)this.activeTab="ships";

    this.content.replaceChildren();
    this.content.append(this.renderTabs(tabs));
    this.content.append(
      this.activeTab==="cannons"
        ?this.renderCannonsTab(ships,cannons,storage)
        :this.renderShipsTab(ships)
    );
  }

  destroy(){
    this.overlay?.remove();
    this.overlay=null;
    this.content=null;
    this.message=null;
  }
}
