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
    this.overlay=null;this.content=null;this.message=null;
  }
  mount(root){
    if(this.overlay)return this;
    const overlay=element("div","tq-shipyard");overlay.hidden=true;
    const scrim=element("button","tq-shipyard__scrim");scrim.type="button";scrim.setAttribute("aria-label","Fechar estaleiro");
    const panel=element("section","tq-shipyard__panel");panel.setAttribute("role","dialog");panel.setAttribute("aria-modal","true");panel.setAttribute("aria-label","Estaleiro");
    const header=element("header","tq-shipyard__header");header.append(element("strong","","⚓ Estaleiro"));
    const close=element("button","tq-shipyard__close","×");close.type="button";close.setAttribute("aria-label","Fechar estaleiro");header.append(close);
    this.content=element("div","tq-shipyard__content");this.message=element("p","tq-shipyard__message");this.message.setAttribute("aria-live","polite");
    panel.append(header,this.content,this.message);overlay.append(scrim,panel);root.append(overlay);this.overlay=overlay;
    scrim.addEventListener("click",()=>this.close());close.addEventListener("click",()=>this.close());return this;
  }
  open(){if(!this.overlay)return;this.overlay.hidden=false;this.render();this.overlay.querySelector(".tq-shipyard__close")?.focus()}
  close(){if(this.overlay)this.overlay.hidden=true}
  setMessage(value,isError=false){if(!this.message)return;this.message.textContent=String(value||"");this.message.classList.toggle("is-error",isError)}
  async run(action,...args){
    if(typeof action!=="function"){this.setMessage("Esta ação ainda não está disponível nesta tela.",true);return}
    try{const result=await action(...args);const success=result!==false&&result?.ok!==false;this.setMessage(result?.message||(success?"Estaleiro atualizado.":"Operação não concluída."),!success);this.render()}
    catch(error){console.error("[TabuadaQuest] Shipyard action failed",error);this.setMessage("Não foi possível concluir a operação.",true)}
  }
  render(){
    if(!this.content)return;
    const state=this.getState()||{},ships=Array.isArray(state.ships)?state.ships:[],cannons=Array.isArray(state.cannons)?state.cannons:[],storage=state.storage&&typeof state.storage==="object"?state.storage:{};
    this.content.replaceChildren();this.content.append(element("h3","tq-shipyard__title","Sua frota"));
    if(!ships.length)this.content.append(element("p","tq-shipyard__empty","Você ainda não possui navios. Visite a loja para ampliar a frota."));
    for(const ship of ships){
      const card=element("article","tq-shipyard__ship"+(ship.equipped?" is-equipped":""));const top=element("div","tq-shipyard__ship-top");top.append(element("strong","",String(ship.name||ship.id||"Navio")));if(ship.equipped)top.append(element("span","tq-shipyard__badge","Em uso"));card.append(top);
      const use=element("button","tq-shipyard__action",ship.equipped?"Navio ativo":"Usar este navio");use.type="button";use.disabled=ship.equipped===true;use.addEventListener("click",()=>this.run(this.onEquipShip,String(ship.id||"")));card.append(use);
      const installed=Array.isArray(ship.cannons)?ship.cannons:[],cannonList=element("div","tq-shipyard__installed");cannonList.append(element("small","","Canhões instalados"));if(!installed.length)cannonList.append(element("span","tq-shipyard__none","Nenhum canhão equipado"));
      for(const cannon of installed){const row=element("div","tq-shipyard__installed-row");row.append(element("span","",String(cannon.name||cannon.id||"Canhão")));const remove=element("button","tq-shipyard__remove","Guardar");remove.type="button";remove.addEventListener("click",()=>this.run(this.onRemoveCannon,String(cannon.id||""),String(ship.id||"")));row.append(remove);cannonList.append(row)}
      card.append(cannonList);this.content.append(card);
    }
    this.content.append(element("h3","tq-shipyard__title","Depósito de canhões"));const available=cannons.filter(cannon=>Math.max(0,Number(storage[cannon?.id])||0)>0);
    if(!available.length){this.content.append(element("p","tq-shipyard__empty","Não há canhões guardados no depósito."));return}
    const stock=element("div","tq-shipyard__stock");for(const cannon of available){const button=element("button","tq-shipyard__stock-item");button.type="button";button.textContent=`Equipar ${cannon.name||cannon.id} ×${Math.max(0,Number(storage[cannon.id])||0)}`;button.addEventListener("click",()=>this.run(this.onEquipCannon,String(cannon.id||"")));stock.append(button)}this.content.append(stock);
  }
  destroy(){this.overlay?.remove();this.overlay=null;this.content=null;this.message=null}
}
