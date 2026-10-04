
const objectiveLabel=(objective,progress=0)=>{
  const type=String(objective?.type||"");
  const target=Math.max(0,Number(objective?.target)||0);
  const labels={
    collect_treasure:"Colete tesouros",
    collect_rare_treasure:"Colete tesouros raros",
    collect_item:"Colete itens",
    defeat_npc:"Derrote navios",
    defeat_boss:"Derrote o chefe",
    defeat_elite:"Derrote o inimigo de elite",
    purchase_upgrade:"Compre uma melhoria",
    visit_point:"Visite pontos do mapa",
    travel_cargo:"Complete a rota de carga",
    repair_ship:"Repare seu navio"
  };
  const base=objective?.targetLabel&&type==="defeat_npc"
    ?"Derrote "+String(objective.targetLabel)
    :(labels[type]||"Complete o objetivo");
  const current=Math.max(0,Math.min(target,Math.floor(Number(progress)||0)));
  return base+(target?" · "+current+"/"+target:"");
};

const iconButton=(kind,label,icon)=>{
  const button=document.createElement("button");
  button.type="button";
  button.className="tq-combat-dock__button tq-combat-dock__button--"+kind;
  button.dataset.hudAction=kind;
  button.setAttribute("aria-label",label);
  button.innerHTML='<span aria-hidden="true">'+icon+'</span><small>'+label+'</small>';
  return button;
};

export class MobileHudOverlay{
  constructor(options={}){
    this.getState=typeof options.getState==="function"?options.getState:()=>({});
    this.onAttack=typeof options.onAttack==="function"?options.onAttack:null;
    this.onRepair=typeof options.onRepair==="function"?options.onRepair:null;
    this.onCancel=typeof options.onCancel==="function"?options.onCancel:null;
    this.onFollow=typeof options.onFollow==="function"?options.onFollow:null;
    this.onSelectAmmo=typeof options.onSelectAmmo==="function"?options.onSelectAmmo:null;
    this.onShop=typeof options.onShop==="function"?options.onShop:null;
    this.onShipyard=typeof options.onShipyard==="function"?options.onShipyard:null;
    this.missions=Array.isArray(options.missions)?options.missions:[];
    this.region=Math.max(1,Number(options.region)||1);
    this.root=null;
    this.wrap=null;
    this.drawer=null;
    this.ammoMenu=null;
    this.timer=0;
    this.lastAmmoSignature="";
    this.cleanups=[];
  }

  mount(root){
    if(!root||this.root)return this;
    this.root=root;

    const wrap=document.createElement("div");
    wrap.className="tq-mobile-combat-ui";
    wrap.innerHTML=
      '<section class="tq-target-status" data-target-status hidden aria-live="polite">'+
        '<strong data-target-name></strong>'+
        '<div class="tq-hpbar tq-hpbar--enemy"><span data-target-fill></span><b data-target-hp></b></div>'+
      '</section>'+
      '<section class="tq-player-status" aria-label="Vida do jogador">'+
        '<small>CASCO</small>'+
        '<div class="tq-hpbar tq-hpbar--player"><span data-player-fill></span><b data-player-hp></b></div>'+
      '</section>'+
      '<div class="tq-combat-dock" data-combat-dock></div>'+
      '<div class="tq-ammo-popover" data-ammo-popover hidden><div class="tq-ammo-popover__list" data-ammo-list></div></div>'+
      '<div class="tq-mobile-hud__toast" data-hud-toast></div>';

    const dock=wrap.querySelector("[data-combat-dock]");
    const ammo=iconButton("ammo","Munição","💣");
    const fire=iconButton("fire","Atirar","🔥");
    const follow=iconButton("follow","Seguir","🎯");
    const repair=iconButton("repair","Reparar","🔧");
    const missions=iconButton("missions","Missões","📜");
    const shop=iconButton("shop","Loja","🪙");
    const shipyard=iconButton("shipyard","Estaleiro","⚓");
    fire.classList.add("is-primary");
    dock.append(ammo,fire,follow,repair,missions,shop,shipyard);
    follow.hidden=true;

    const drawer=document.createElement("section");
    drawer.className="tq-mobile-hud__missions";
    drawer.hidden=true;
    drawer.innerHTML=
      '<button type="button" class="tq-mobile-hud__missions-scrim" data-mission-close aria-label="Fechar missões"></button>'+
      '<div class="tq-mobile-hud__missions-card" role="dialog" aria-modal="true" aria-label="Missões">'+
        '<header><div><small>REGIÃO '+this.region+'</small><strong>Missões</strong></div><button type="button" data-mission-close aria-label="Fechar">×</button></header>'+
        '<div class="tq-mobile-hud__missions-list"></div>'+
      '</div>';

    root.append(wrap,drawer);
    this.wrap=wrap;
    this.drawer=drawer;
    this.ammoMenu=wrap.querySelector("[data-ammo-popover]");

    const bind=(el,fn)=>{
      const handler=event=>{event.preventDefault();event.stopPropagation();fn?.(event)};
      el.addEventListener("click",handler);
      this.cleanups.push(()=>el.removeEventListener("click",handler));
    };

    bind(ammo,()=>this.toggleAmmoMenu());
    bind(fire,()=>{
      const state=this.getState()||{};
      if(state.attacking===true)this.onCancel?.();
      else this.onAttack?.();
    });
    bind(follow,()=>this.onFollow?.());
    bind(repair,()=>this.onRepair?.());
    bind(missions,()=>this.openMissions());
    bind(shop,()=>this.onShop?.());
    bind(shipyard,()=>{
      const result=this.onShipyard?.();
      if(result===false||result==null)this.toast("Estaleiro em preparação.");
    });
    drawer.querySelectorAll("[data-mission-close]").forEach(el=>bind(el,()=>this.closeMissions()));

    this.renderMissions();
    this.sync();
    this.timer=globalThis.setInterval(()=>this.sync(),120);
    this.cleanups.push(()=>globalThis.clearInterval(this.timer));
    return this;
  }

  renderMissions(){
    const host=this.drawer?.querySelector(".tq-mobile-hud__missions-list");
    if(!host)return;
    const progress=this.getState()?.missionProgress||{};
    const list=this.missions.filter(item=>Number(item?.region)===this.region).sort((a,b)=>Number(a.order||0)-Number(b.order||0));
    host.innerHTML="";
    if(!list.length){
      const empty=document.createElement("p");
      empty.className="tq-mobile-hud__missions-empty";
      empty.textContent="Nenhuma missão cadastrada para esta região.";
      host.append(empty);
      return;
    }
    for(const mission of list){
      const card=document.createElement("article");
      card.className="tq-mobile-hud__mission";
      const reward=mission.reward||{};
      card.innerHTML=
        '<div class="tq-mobile-hud__mission-number"></div>'+
        '<div class="tq-mobile-hud__mission-copy"><strong></strong><span></span></div>'+
        '<div class="tq-mobile-hud__mission-reward"></div>';
      card.querySelector(".tq-mobile-hud__mission-number").textContent=String(mission.order||"•");
      card.querySelector(".tq-mobile-hud__mission-copy strong").textContent=String(mission.name||mission.id||"Missão");
      card.querySelector(".tq-mobile-hud__mission-copy span").textContent=objectiveLabel(mission.objective,progress?.[mission.id]);
      const rewards=[];
      if(Number(reward.gold)>0)rewards.push("🪙 "+Number(reward.gold));
      if(Number(reward.rubies)>0)rewards.push("💎 "+Number(reward.rubies));
      card.querySelector(".tq-mobile-hud__mission-reward").textContent=rewards.join("  ");
      host.append(card);
    }
  }

  openMissions(){
    this.closeAmmoMenu();
    if(!this.drawer)return;
    this.renderMissions();
    this.drawer.hidden=false;
    document.documentElement.classList.add("tq-missions-open");
  }

  closeMissions(){
    if(!this.drawer)return;
    this.drawer.hidden=true;
    document.documentElement.classList.remove("tq-missions-open");
  }

  toggleAmmoMenu(){
    if(!this.ammoMenu)return;
    this.ammoMenu.hidden=!this.ammoMenu.hidden;
    if(!this.ammoMenu.hidden)this.renderAmmoMenu(this.getState()?.ammo||[]);
  }

  closeAmmoMenu(){
    if(this.ammoMenu)this.ammoMenu.hidden=true;
  }

  renderAmmoMenu(ammoList=[]){
    const host=this.ammoMenu?.querySelector("[data-ammo-list]");
    if(!host)return;
    host.innerHTML="";
    const items=Array.isArray(ammoList)?ammoList.filter(item=>Number(item.quantity)>0):[];
    if(!items.length){
      const empty=document.createElement("div");
      empty.className="tq-ammo-popover__empty";
      empty.textContent="Sem munição";
      host.append(empty);
      return;
    }
    for(const item of items){
      const button=document.createElement("button");
      button.type="button";
      button.className="tq-ammo-popover__item";
      button.classList.toggle("is-selected",item.selected===true);
      const image=item.image?'<img src="'+item.image+'" alt="">':'<span aria-hidden="true">💣</span>';
      button.innerHTML=image+'<div><strong></strong><small></small></div>';
      button.querySelector("strong").textContent=String(item.name||item.id||"Munição");
      button.querySelector("small").textContent="× "+String(Math.max(0,Number(item.quantity)||0));
      button.addEventListener("click",event=>{
        event.preventDefault();
        event.stopPropagation();
        this.onSelectAmmo?.(String(item.id||""));
        this.closeAmmoMenu();
      });
      host.append(button);
    }
  }

  toast(message){
    const toast=this.wrap?.querySelector("[data-hud-toast]");
    if(!toast)return;
    toast.textContent=String(message||"");
    toast.classList.remove("is-visible");
    void toast.offsetWidth;
    toast.classList.add("is-visible");
    globalThis.setTimeout(()=>toast?.classList.remove("is-visible"),1300);
  }

  sync(){
    if(!this.wrap)return;
    const state=this.getState()||{};

    const targetWrap=this.wrap.querySelector("[data-target-status]");
    const targetVisible=Boolean(state.target?.visible);
    if(targetWrap){
      targetWrap.hidden=!targetVisible;
      if(targetVisible){
        const max=Math.max(1,Number(state.target.maxHp)||1);
        const hp=Math.max(0,Math.min(max,Number(state.target.hp)||0));
        const pct=Math.max(0,Math.min(100,hp/max*100));
        targetWrap.querySelector("[data-target-name]").textContent=String(state.target.name||"Navio inimigo");
        targetWrap.querySelector("[data-target-fill]").style.width=pct+"%";
        targetWrap.querySelector("[data-target-hp]").textContent=hp+" / "+max;
      }
    }

    const pmax=Math.max(1,Number(state.playerMaxHp)||1);
    const php=Math.max(0,Math.min(pmax,Number(state.playerHp)||0));
    const ppct=Math.max(0,Math.min(100,php/pmax*100));
    const playerFill=this.wrap.querySelector("[data-player-fill]");
    const playerHp=this.wrap.querySelector("[data-player-hp]");
    if(playerFill)playerFill.style.width=ppct+"%";
    if(playerHp)playerHp.textContent=php+" / "+pmax;

    const fire=this.wrap.querySelector('[data-hud-action="fire"]');
    if(fire){
      const attacking=state.attacking===true;
      const hasCannons=state.hasCannons!==false;
      const hasAmmo=state.hasAmmo!==false;
      fire.disabled=!attacking&&(php<=0||((hasCannons&&hasAmmo)&&!targetVisible));
      fire.classList.toggle("is-cancel",attacking);
      fire.classList.toggle("is-disabled",fire.disabled);
      fire.querySelector("span").textContent=attacking?"✕":"🔥";
      fire.querySelector("small").textContent=attacking?"Cancelar":"Atirar";
      fire.setAttribute("aria-label",attacking?"Cancelar ataque":"Atirar");
    }

    const follow=this.wrap.querySelector('[data-hud-action="follow"]');
    if(follow){
      const canFollow=state.attacking===true&&targetVisible;
      follow.hidden=!canFollow;
      follow.disabled=!canFollow;
      follow.classList.toggle("is-active",state.following===true);
      follow.querySelector("span").textContent=state.following===true?"◎":"🎯";
      follow.querySelector("small").textContent=state.following===true?"Seguindo":"Seguir";
      follow.setAttribute("aria-label",state.following===true?"Parar de seguir alvo":"Seguir alvo");
    }

    const repair=this.wrap.querySelector('[data-hud-action="repair"]');
    if(repair){
      const canRepair=php>0&&php<pmax&&!state.attacking&&state.repairAvailable===true;
      repair.hidden=!canRepair;
      repair.disabled=!canRepair;
      repair.classList.toggle("is-disabled",!canRepair);
    }

    const ammo=Array.isArray(state.ammo)?state.ammo.filter(item=>Number(item.quantity)>0):[];
    const signature=ammo.map(item=>[item.id,item.quantity,item.selected===true?1:0].join(":")).join("|");
    if(signature!==this.lastAmmoSignature){
      this.lastAmmoSignature=signature;
      if(this.ammoMenu&&!this.ammoMenu.hidden)this.renderAmmoMenu(ammo);
    }
  }

  destroy(){
    this.closeMissions();
    this.closeAmmoMenu();
    for(const cleanup of this.cleanups.splice(0)){try{cleanup()}catch{}}
    this.wrap?.remove();
    this.drawer?.remove();
    this.wrap=null;
    this.drawer=null;
    this.root=null;
  }
}
