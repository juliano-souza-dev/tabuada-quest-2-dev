const asset=name=>new URL("../../assets/hud/"+name,import.meta.url).href;

const ASSETS={
  attack:asset("halloween_hud_btn_iniciar_ataque.webp"),
  cancel:asset("halloween_hud_btn_cancelar_ataque.webp"),
  repair:asset("halloween_hud_btn_consertar_navio.webp"),
  ammo:asset("halloween_hud_btn_trocar_municao.webp"),
  missions:asset("halloween_hud_missoes.webp")
};

const objectiveLabel=objective=>{
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
  return (labels[type]||"Complete o objetivo")+(target?" · "+target:"");
};

export class MobileHudOverlay{
  constructor(options={}){
    this.options=options;
    this.getState=typeof options.getState==="function"?options.getState:()=>({});
    this.onAttack=typeof options.onAttack==="function"?options.onAttack:null;
    this.onCancel=typeof options.onCancel==="function"?options.onCancel:null;
    this.onRepair=typeof options.onRepair==="function"?options.onRepair:null;
    this.onAmmo=typeof options.onAmmo==="function"?options.onAmmo:null;
    this.missions=Array.isArray(options.missions)?options.missions:[];
    this.region=Math.max(1,Number(options.region)||1);
    this.root=null;
    this.wrap=null;
    this.timer=0;
    this.cleanups=[];
  }

  button(kind,label){
    const button=document.createElement("button");
    button.type="button";
    button.className="tq-mobile-hud__button tq-mobile-hud__button--"+kind;
    button.dataset.hudAction=kind;
    button.setAttribute("aria-label",label);
    button.style.backgroundImage=`url("${ASSETS[kind]}")`;
    return button;
  }

  mount(root){
    if(!root||this.root)return this;
    this.root=root;
    const wrap=document.createElement("div");
    wrap.className="tq-mobile-hud";
    const attack=this.button("attack","Iniciar ataque");
    const cancel=this.button("cancel","Cancelar ataque");
    const repair=this.button("repair","Consertar navio");
    const ammo=this.button("ammo","Trocar munição");
    const missions=this.button("missions","Missões");
    cancel.hidden=true;
    wrap.append(missions,repair,ammo,attack,cancel);

    const drawer=document.createElement("section");
    drawer.className="tq-mobile-hud__missions";
    drawer.hidden=true;
    drawer.innerHTML=`
      <button type="button" class="tq-mobile-hud__missions-scrim" data-mission-close aria-label="Fechar missões"></button>
      <div class="tq-mobile-hud__missions-card" role="dialog" aria-modal="true" aria-label="Missões">
        <header><div><small>REGIÃO ${this.region}</small><strong>Missões</strong></div><button type="button" data-mission-close aria-label="Fechar">×</button></header>
        <div class="tq-mobile-hud__missions-list"></div>
      </div>`;
    root.append(wrap,drawer);
    this.wrap=wrap;
    this.drawer=drawer;

    const bind=(el,fn)=>{
      const handler=event=>{event.preventDefault();event.stopPropagation();fn?.()};
      el.addEventListener("click",handler);
      this.cleanups.push(()=>el.removeEventListener("click",handler));
    };
    bind(attack,this.onAttack);
    bind(cancel,this.onCancel);
    bind(repair,this.onRepair);
    bind(ammo,async()=>{
      const result=await this.onAmmo?.();
      if(result?.name)this.toast("Munição: "+result.name);
    });
    bind(missions,()=>this.openMissions());
    drawer.querySelectorAll("[data-mission-close]").forEach(el=>bind(el,()=>this.closeMissions()));

    this.renderMissions();
    this.sync();
    this.timer=globalThis.setInterval(()=>this.sync(),180);
    this.cleanups.push(()=>globalThis.clearInterval(this.timer));
    return this;
  }

  renderMissions(){
    const host=this.drawer?.querySelector(".tq-mobile-hud__missions-list");
    if(!host)return;
    const list=this.missions
      .filter(item=>Number(item?.region)===this.region)
      .sort((a,b)=>Number(a.order||0)-Number(b.order||0));
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
      card.innerHTML=`
        <div class="tq-mobile-hud__mission-number"></div>
        <div class="tq-mobile-hud__mission-copy"><strong></strong><span></span></div>
        <div class="tq-mobile-hud__mission-reward"></div>`;
      card.querySelector(".tq-mobile-hud__mission-number").textContent=String(mission.order||"•");
      card.querySelector(".tq-mobile-hud__mission-copy strong").textContent=String(mission.name||mission.id||"Missão");
      card.querySelector(".tq-mobile-hud__mission-copy span").textContent=objectiveLabel(mission.objective);
      const rewards=[];
      if(Number(reward.gold)>0)rewards.push("🪙 "+Number(reward.gold));
      if(Number(reward.rubies)>0)rewards.push("💎 "+Number(reward.rubies));
      card.querySelector(".tq-mobile-hud__mission-reward").textContent=rewards.join("  ");
      host.append(card);
    }
  }

  openMissions(){
    if(!this.drawer)return;
    this.drawer.hidden=false;
    document.documentElement.classList.add("tq-missions-open");
  }

  closeMissions(){
    if(!this.drawer)return;
    this.drawer.hidden=true;
    document.documentElement.classList.remove("tq-missions-open");
  }

  toast(message){
    if(!this.wrap)return;
    let toast=this.wrap.querySelector(".tq-mobile-hud__toast");
    if(!toast){
      toast=document.createElement("div");
      toast.className="tq-mobile-hud__toast";
      this.wrap.append(toast);
    }
    toast.textContent=String(message||"");
    toast.classList.remove("is-visible");
    void toast.offsetWidth;
    toast.classList.add("is-visible");
    globalThis.setTimeout(()=>toast?.classList.remove("is-visible"),1500);
  }

  sync(){
    if(!this.wrap)return;
    const state=this.getState()||{};
    const attack=this.wrap.querySelector('[data-hud-action="attack"]');
    const cancel=this.wrap.querySelector('[data-hud-action="cancel"]');
    const repair=this.wrap.querySelector('[data-hud-action="repair"]');
    const ammo=this.wrap.querySelector('[data-hud-action="ammo"]');
    const attacking=state.attacking===true;
    if(attack){
      attack.hidden=attacking;
      attack.disabled=!state.hasTarget||state.playerHp<=0;
      attack.classList.toggle("is-disabled",attack.disabled);
    }
    if(cancel)cancel.hidden=!attacking;
    if(repair){
      repair.disabled=!(state.playerHp>0&&state.playerHp<state.playerMaxHp&&!state.inCombat);
      repair.classList.toggle("is-disabled",repair.disabled);
    }
    if(ammo){
      ammo.disabled=state.inChallenge===true;
      ammo.classList.toggle("is-disabled",ammo.disabled);
    }
  }

  destroy(){
    this.closeMissions();
    for(const cleanup of this.cleanups.splice(0)){try{cleanup()}catch{}}
    this.wrap?.remove();
    this.drawer?.remove();
    this.wrap=null;
    this.drawer=null;
    this.root=null;
  }
}
