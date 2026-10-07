
const formatHp=value=>{
  const rounded=Math.round((Number(value)||0)*10)/10;
  return Number.isInteger(rounded)?String(rounded):rounded.toFixed(1);
};

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
    repair_ship:"Repare seu navio",
    equip_cannon:"Equipe um canhão",
    prepare_ship:"Prepare seu navio"
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
    this.onCenterCamera=typeof options.onCenterCamera==="function"?options.onCenterCamera:null;
    this.onUseHullReinforcement=typeof options.onUseHullReinforcement==="function"?options.onUseHullReinforcement:null;
    this.onSelectAmmo=typeof options.onSelectAmmo==="function"?options.onSelectAmmo:null;
    this.onShop=typeof options.onShop==="function"?options.onShop:null;
    this.onShipyard=typeof options.onShipyard==="function"?options.onShipyard:null;
    this.onGraphicsSettingsChange=typeof options.onGraphicsSettingsChange==="function"?options.onGraphicsSettingsChange:null;
    this.missions=Array.isArray(options.missions)?options.missions:[];
    this.region=Math.max(1,Number(options.region)||1);
    this.root=null;
    this.wrap=null;
    this.drawer=null;
    this.settingsDrawer=null;
    this.ammoMenu=null;
    this.timer=0;
    this.lastAmmoSignature="";
    this.lastMissionSignature="";
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
      '<div class="tq-tutorial-hint" data-tutorial-guide hidden>'+
        '<span data-tutorial-icon>📜</span>'+
        '<strong data-tutorial-title></strong>'+
      '</div>'+
      '<div class="tq-mobile-hud__toast" data-hud-toast></div>';

    const dock=wrap.querySelector("[data-combat-dock]");
    const ammo=iconButton("ammo","Munição","💣");
    const fire=iconButton("fire","Atirar","🔥");
    const follow=iconButton("follow","Seguir","🎯");
    const center=iconButton("center","Centralizar","⌖");
    const shield=iconButton("shield","Reforço","🛡️");
    const repair=iconButton("repair","Reparar","🔧");
    const missions=iconButton("missions","Missões","📜");
    const shop=iconButton("shop","Loja","🪙");
    const shipyard=iconButton("shipyard","Estaleiro","⚓");
    const settings=iconButton("settings","Config","⚙️");
    fire.classList.add("is-primary");
    dock.append(ammo,fire,follow,center,shield,repair,missions,shop,shipyard,settings);
    follow.hidden=true;
    center.hidden=true;
    shield.hidden=true;

    const drawer=document.createElement("section");
    drawer.className="tq-mobile-hud__missions";
    drawer.hidden=true;
    drawer.innerHTML=
      '<button type="button" class="tq-mobile-hud__missions-scrim" data-mission-close aria-label="Fechar missões"></button>'+
      '<div class="tq-mobile-hud__missions-card" role="dialog" aria-modal="true" aria-label="Missões">'+
        '<header><div><small>REGIÃO '+this.region+'</small><strong>Missões</strong></div><button type="button" data-mission-close aria-label="Fechar">×</button></header>'+
        '<div class="tq-mobile-hud__missions-list"></div>'+
      '</div>';

    const settingsDrawer=document.createElement("section");
    settingsDrawer.className="tq-mobile-hud__settings";
    settingsDrawer.hidden=true;
    settingsDrawer.innerHTML=
      '<button type="button" class="tq-mobile-hud__settings-scrim" data-settings-close aria-label="Fechar configurações"></button>'+
      '<div class="tq-mobile-hud__settings-card" role="dialog" aria-modal="true" aria-label="Configurações">'+
        '<header><div><small>DESEMPENHO</small><strong>Configurações</strong></div><button type="button" data-settings-close aria-label="Fechar">×</button></header>'+
        '<div class="tq-mobile-hud__settings-list">'+
          '<label><span><strong>Nuvens</strong><small>Exibir camada de nuvens</small></span><input type="checkbox" data-setting-key="clouds"></label>'+
          '<label><span><strong>Ondas do mar</strong><small>Desmarcado: WebGL mais suave e leve</small></span><input type="checkbox" data-setting-key="oceanWaves"></label>'+
          '<label><span><strong>Efeitos de munição reduzidos</strong><small>Menos partículas, trilhas e brilho</small></span><input type="checkbox" data-setting-key="reducedAmmoFx"></label>'+
        '</div>'+
      '</div>';

    root.append(wrap,drawer,settingsDrawer);
    this.wrap=wrap;
    this.drawer=drawer;
    this.settingsDrawer=settingsDrawer;
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
    bind(center,()=>this.onCenterCamera?.());
    bind(shield,()=>this.onUseHullReinforcement?.());
    bind(repair,()=>this.onRepair?.());
    bind(missions,()=>this.openMissions());
    bind(settings,()=>this.openSettings());
    bind(shop,()=>this.onShop?.());
    bind(shipyard,()=>{
      const result=this.onShipyard?.();
      if(result===false||result==null)this.toast("Estaleiro em preparação.");
    });
    drawer.querySelectorAll("[data-mission-close]").forEach(el=>bind(el,()=>this.closeMissions()));
    settingsDrawer.querySelectorAll("[data-settings-close]").forEach(el=>bind(el,()=>this.closeSettings()));
    settingsDrawer.querySelectorAll("[data-setting-key]").forEach(input=>{
      const handler=()=>this.changeGraphicsSetting(String(input.dataset.settingKey||""),input.checked===true);
      input.addEventListener("change",handler);
      this.cleanups.push(()=>input.removeEventListener("change",handler));
    });

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
    const list=this.missions
      .filter(item=>Number(item?.region)===this.region||String(item?.event||"").toLowerCase()==="halloween")
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
      const unlockAfter=Array.isArray(mission.unlockAfter)?mission.unlockAfter:[];
      const locked=unlockAfter.some(id=>{
        const prerequisite=this.missions.find(item=>String(item?.id||"")===String(id));
        const target=Math.max(1,Number(prerequisite?.objective?.target)||1);
        return Math.max(0,Number(progress?.[id])||0)<target;
      });
      card.classList.toggle("is-locked",locked);
      card.innerHTML=
        '<div class="tq-mobile-hud__mission-number"></div>'+
        '<div class="tq-mobile-hud__mission-copy"><strong></strong><span></span></div>'+
        '<div class="tq-mobile-hud__mission-reward"></div>';
      card.querySelector(".tq-mobile-hud__mission-number").textContent=String(mission.order||"•");
      card.querySelector(".tq-mobile-hud__mission-copy strong").textContent=String(mission.name||mission.id||"Missão");
      card.querySelector(".tq-mobile-hud__mission-copy span").textContent=locked
        ?"🔒 Bloqueada · conclua as missões anteriores"
        :objectiveLabel(mission.objective,progress?.[mission.id]);
      const rewards=[];
      if(Number(reward.gold)>0)rewards.push("🪙 "+Number(reward.gold));
      if(Number(reward.rubies)>0)rewards.push("💎 "+Number(reward.rubies));
      card.querySelector(".tq-mobile-hud__mission-reward").textContent=rewards.join("  ");
      host.append(card);
    }
  }

  openSettings(){
    this.closeAmmoMenu();
    this.closeMissions();
    if(!this.settingsDrawer)return;
    const settings=this.getState()?.graphicsSettings||{};
    this.settingsDrawer.querySelectorAll("[data-setting-key]").forEach(input=>{
      const key=String(input.dataset.settingKey||"");
      input.checked=key==="reducedAmmoFx"?settings[key]===true:settings[key]!==false;
    });
    this.settingsDrawer.hidden=false;
    document.documentElement.classList.add("tq-settings-open");
  }

  closeSettings(){
    if(!this.settingsDrawer)return;
    this.settingsDrawer.hidden=true;
    document.documentElement.classList.remove("tq-settings-open");
  }

  changeGraphicsSetting(key,value){
    const current=this.getState()?.graphicsSettings||{};
    if(!["clouds","oceanWaves","reducedAmmoFx"].includes(key))return false;
    const next={
      clouds:current.clouds!==false,
      oceanWaves:current.oceanWaves!==false,
      reducedAmmoFx:current.reducedAmmoFx===true,
      [key]:value===true
    };
    this.onGraphicsSettingsChange?.(next);
    this.toast("Configuração atualizada.");
    return true;
  }

  openMissions(){
    this.closeAmmoMenu();
    this.closeSettings();
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
    const guide=state.tutorialGuide&&typeof state.tutorialGuide==="object"?state.tutorialGuide:null;
    const guideEl=this.wrap.querySelector("[data-tutorial-guide]");
    this.wrap.querySelectorAll(".is-tutorial-target").forEach(el=>{
      el.classList.remove("is-tutorial-target");
      el.removeAttribute("data-tutorial-label");
    });
    if(guideEl){
      if(!guide){
        guideEl.hidden=true;
      }else{
        const action=String(guide.action||"");
        const targetButton=action?this.wrap.querySelector('[data-hud-action="'+action+'"]'):null;
        if(targetButton&&!targetButton.hidden){
          guideEl.hidden=true;
          targetButton.classList.add("is-tutorial-target");
          targetButton.setAttribute("data-tutorial-label",String(guide.title||"Toque aqui"));
        }else{
          guideEl.hidden=false;
          const icon=guideEl.querySelector("[data-tutorial-icon]");
          const title=guideEl.querySelector("[data-tutorial-title]");
          if(icon)icon.textContent=String(guide.icon||"📜");
          if(title)title.textContent=String(guide.text||guide.title||"Objetivo atual");
        }
      }
    }

    const tutorialStage=String(guide?.stage||"");
    const tutorialActive=Boolean(guide);
    for(const button of this.wrap.querySelectorAll("[data-hud-action]")){
      const action=String(button.dataset.hudAction||"");
      const allowed=!tutorialActive||(tutorialStage==="shipyard"&&action==="shipyard")||(tutorialStage==="equip-cannon"&&action==="shipyard")||(tutorialStage==="attack-ship"&&action==="fire")||(tutorialStage==="repair-ship"&&action==="repair");
      button.hidden=!allowed;
      button.style.display=allowed?"":"none";
    }
    const playerStatus=this.wrap.querySelector(".tq-player-status");
    if(playerStatus)playerStatus.hidden=tutorialActive;
    const targetStatus=this.wrap.querySelector("[data-target-status]");
    if(targetStatus&&tutorialActive)targetStatus.hidden=true;

    const targetWrap=this.wrap.querySelector("[data-target-status]");
    const targetVisible=(!tutorialActive||tutorialStage==="attack-ship")&&Boolean(state.target?.visible);
    if(targetWrap){
      targetWrap.hidden=!targetVisible;
      if(targetVisible){
        const max=Math.max(1,Number(state.target.maxHp)||1);
        const hp=Math.max(0,Math.min(max,Number(state.target.hp)||0));
        const pct=Math.max(0,Math.min(100,hp/max*100));
        targetWrap.querySelector("[data-target-name]").textContent=String(state.target.name||"Navio inimigo");
        targetWrap.querySelector("[data-target-fill]").style.width=pct+"%";
        targetWrap.querySelector("[data-target-hp]").textContent=formatHp(hp)+" / "+formatHp(max);
      }
    }

    const pmax=Math.max(1,Number(state.playerMaxHp)||1);
    const php=Math.max(0,Math.min(pmax,Number(state.playerHp)||0));
    const ppct=Math.max(0,Math.min(100,php/pmax*100));
    const playerFill=this.wrap.querySelector("[data-player-fill]");
    const playerHp=this.wrap.querySelector("[data-player-hp]");
    if(playerFill)playerFill.style.width=ppct+"%";
    if(playerHp)playerHp.textContent=formatHp(php)+" / "+formatHp(pmax);

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
      follow.hidden=false;
      follow.disabled=!targetVisible;
      follow.classList.toggle("is-disabled",follow.disabled);
    }

    const center=this.wrap.querySelector('[data-hud-action="center"]');
    if(center){
      const detached=state.cameraDetached===true;
      center.hidden=false;
      center.disabled=false;
      center.classList.toggle("is-active",detached);
      const remaining=Math.max(0,Math.ceil((Number(state.cameraRecenterRemainingMs)||0)/1000));
      center.querySelector("small").textContent=remaining>0?"Centralizar "+remaining+"s":"Centralizar";
      center.setAttribute("aria-label","Centralizar câmera no seu navio");
    }

    const shield=this.wrap.querySelector('[data-hud-action="shield"]');
    if(shield){
      const qty=Math.max(0,Math.floor(Number(state.hullReinforcementQuantity)||0));
      const active=state.hullReinforcementActive===true;
      shield.hidden=qty<=0&&!active;
      shield.disabled=active||qty<=0;
      shield.classList.toggle("is-active",active);
      shield.querySelector("span").textContent=active?"🛡️":"🛡️";
      shield.querySelector("small").textContent=active?"Protegido":"Reforço "+qty;
      shield.setAttribute("aria-label",active?"Reforço de casco ativo":"Usar reforço de casco. Estoque: "+qty);
    }

    const repair=this.wrap.querySelector('[data-hud-action="repair"]');
    if(repair){
      const canRepair=php>0&&php<pmax&&!state.attacking&&state.repairAvailable===true;
      repair.hidden=!canRepair;
      repair.disabled=!canRepair;
      repair.classList.toggle("is-disabled",!canRepair);
    }

    const missionProgress=state.missionProgress&&typeof state.missionProgress==="object"?state.missionProgress:{};
    const missionSignature=JSON.stringify(missionProgress);
    if(missionSignature!==this.lastMissionSignature){
      this.lastMissionSignature=missionSignature;
      if(this.drawer&&!this.drawer.hidden)this.renderMissions();
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
    this.closeSettings();
    this.closeAmmoMenu();
    for(const cleanup of this.cleanups.splice(0)){try{cleanup()}catch{}}
    this.wrap?.remove();
    this.drawer?.remove();
    this.settingsDrawer?.remove();
    this.wrap=null;
    this.drawer=null;
    this.settingsDrawer=null;
    this.root=null;
  }
}
