const clamp=(value,min,max)=>Math.min(max,Math.max(min,Number(value)||0));

const SEA_PRESETS={
  still:{
    label:"Parado",
    description:"Sem balanço. Ideal para objetos presos, encalhados ou mágicos.",
    motion:{active:false,preset:"none",speed:0,heave:0,pitch:0,roll:0,sway:0},
    effect:{category:"treasure",preset:"none"},
    immersion:0
  },
  floating:{
    label:"Boiando",
    description:"Balanço suave acompanhando o movimento do mar.",
    motion:{active:true,preset:"calm",speed:38,heave:24,pitch:12,roll:10,sway:8},
    effect:{category:"treasure",preset:"none"},
    immersion:.08
  },
  submerged:{
    label:"Semi-naufragado",
    description:"Fica parcialmente submerso e balança de forma mais pesada.",
    motion:{active:true,preset:"heavy",speed:28,heave:12,pitch:7,roll:7,sway:4},
    effect:{category:"treasure",preset:"none"},
    immersion:.42
  },
  drifting:{
    label:"À deriva",
    description:"Balança e deriva lateralmente sobre o oceano.",
    motion:{active:true,preset:"calm",speed:34,heave:18,pitch:10,roll:9,sway:12},
    effect:{category:"treasure",preset:"sea-drift"},
    immersion:.10
  },
  glowing:{
    label:"Boiando + brilho",
    description:"Balanço leve com brilho mágico para tesouros raros ou de evento.",
    motion:{active:true,preset:"calm",speed:34,heave:18,pitch:8,roll:7,sway:5},
    effect:{category:"treasure",preset:"treasure-glint"},
    immersion:.06
  }
};

const normalizeBehavior=input=>{
  const raw=input&&typeof input==="object"?input:{};
  const preset=SEA_PRESETS[raw.preset]?raw.preset:"floating";
  const base=SEA_PRESETS[preset];
  const motion=raw.motion&&typeof raw.motion==="object"?raw.motion:{};
  const effect=raw.effect&&typeof raw.effect==="object"?raw.effect:{};
  return {
    preset,
    immersion:clamp(raw.immersion??base.immersion,0,.65),
    motion:{
      ...base.motion,
      ...motion,
      active:motion.active===undefined?base.motion.active:motion.active!==false,
      speed:clamp(motion.speed??base.motion.speed,0,100),
      heave:clamp(motion.heave??base.motion.heave,0,100),
      pitch:clamp(motion.pitch??base.motion.pitch,0,100),
      roll:clamp(motion.roll??base.motion.roll,0,100),
      sway:clamp(motion.sway??base.motion.sway,0,100)
    },
    effect:{
      ...base.effect,
      ...effect,
      category:"treasure",
      preset:String(effect.preset||base.effect.preset||"none")
    }
  };
};

export class TreasureEditor{
  constructor({requestAsset}={}){
    this.requestAsset=typeof requestAsset==="function"?requestAsset:null;
    this.catalog={schema:"tq.treasure-catalog",version:2,treasures:[]};
    this.drafts=[];this.selectedId=null;this.storageKey="tq.dev.treasure-drafts:v2";this.el=null;
  }

  async mount(parent){
    this.el=document.createElement("section");this.el.className="tq-dev__ships tq-dev__treasures";this.el.hidden=true;
    this.el.innerHTML='<header><div><strong>Tesouros</strong><small>Coletáveis, recompensas e comportamento no mar</small></div><button type="button" data-treasure-close aria-label="Fechar">×</button></header><div class="tq-ships__body"><aside class="tq-ships__sidebar"><button type="button" class="tq-ships__new" data-treasure-new>＋ Novo tesouro</button><div class="tq-ships__list" data-treasure-list></div></aside><main class="tq-ships__editor" data-treasure-editor></main></div>';
    parent.append(this.el);
    this.el.querySelector("[data-treasure-close]").onclick=()=>this.setVisible(false);
    this.el.querySelector("[data-treasure-new]").onclick=()=>this.createTreasure();
    await this.load();
  }

  async load(){
    try{
      const r=await fetch("./src/config/treasure-catalog.json?v=20261003-0430",{cache:"no-store"});
      if(r.ok)this.catalog=await r.json();
    }catch(e){console.warn("Treasure catalog load failed",e)}
    try{
      const d=JSON.parse(localStorage.getItem(this.storageKey)||"[]");
      this.drafts=Array.isArray(d)?d:[];
    }catch{this.drafts=[]}
    this.selectedId=this.all()[0]?.id||null;
    this.render();
  }

  all(){
    const m=new Map((this.catalog.treasures||[]).map(x=>[x.id,structuredClone(x)]));
    for(const x of this.drafts)m.set(x.id,structuredClone(x));
    return [...m.values()];
  }

  current(){return this.all().find(x=>x.id===this.selectedId)||null}
  resolve(id){
    const value=this.all().find(x=>x.id===String(id||""))||null;
    if(!value)return null;
    return {...value,behavior:normalizeBehavior(value.behavior)};
  }

  saveDraft(v){
    const normalized={...v,behavior:normalizeBehavior(v.behavior)};
    const i=this.drafts.findIndex(x=>x.id===normalized.id);
    if(i>=0)this.drafts[i]=normalized;else this.drafts.push(normalized);
    localStorage.setItem(this.storageKey,JSON.stringify(this.drafts));
    globalThis.dispatchEvent(new CustomEvent("tq:treasureprofilechange",{detail:{treasureId:normalized.id}}));
  }

  createTreasure(){
    let n=1,id="tesouro-"+n;
    while(this.all().some(x=>x.id===id))id="tesouro-"+(++n);
    const v={
      id,name:"Novo tesouro",asset:"",width:88,height:88,
      behavior:normalizeBehavior({preset:"floating"}),
      rewards:{gold:{min:1,max:10,chance:100},rubies:{min:1,max:1,chance:0}}
    };
    this.saveDraft(v);this.selectedId=id;this.render();
  }

  setVisible(show){if(this.el)this.el.hidden=!show;if(show)this.render()}
  setAsset(id,src){const v=this.resolve(id);if(!v)return false;v.asset=String(src||"");this.saveDraft(v);this.selectedId=id;this.render();return true}

  render(){
    if(!this.el)return;
    const list=this.el.querySelector("[data-treasure-list]");
    list.innerHTML=this.all().map(x=>'<button type="button" class="'+(x.id===this.selectedId?'active':'')+'" data-treasure-id="'+this.e(x.id)+'"><strong>'+this.e(x.name)+'</strong><small>'+this.e(x.id)+'</small></button>').join("");
    list.querySelectorAll("[data-treasure-id]").forEach(b=>b.onclick=()=>{this.selectedId=b.dataset.treasureId;this.render()});
    this.renderEditor();
  }

  renderEditor(){
    const host=this.el.querySelector("[data-treasure-editor]"),v=this.resolve(this.selectedId);
    if(!v){host.innerHTML='<div class="tq-ships__empty">Crie ou selecione um tesouro.</div>';return}
    const g=v.rewards?.gold||{},r=v.rewards?.rubies||{},behavior=normalizeBehavior(v.behavior),motion=behavior.motion;
    const presetOptions=Object.entries(SEA_PRESETS).map(([id,p])=>'<option value="'+id+'" '+(behavior.preset===id?'selected':'')+'>'+this.e(p.label)+'</option>').join("");
    const effectOptions=[
      ["none","Sem efeito"],
      ["treasure-glint","Brilho mágico · WebGL"],
      ["float","Flutuação visual"],
      ["sea-drift","Deriva visual"]
    ].map(([id,label])=>'<option value="'+id+'" '+(String(behavior.effect?.preset||"none")===id?'selected':'')+'>'+label+'</option>').join("");

    host.innerHTML=
      '<section class="tq-ships__panel"><div class="tq-ships__panel-title"><div><strong>Tipo de tesouro</strong><small>Asset e dimensões do coletável.</small></div></div><div class="tq-ships__settings tq-ships__settings--v2">'+
        '<label><span>Nome</span><input data-t-name value="'+this.e(v.name)+'"></label>'+
        '<label><span>Asset</span><input data-t-asset value="'+this.e(v.asset||"")+'" placeholder="./assets/..."></label>'+
        '<button type="button" data-t-pick>▦ Escolher asset</button>'+
        '<label><span>Largura</span><input data-t-width type="number" min="24" max="512" value="'+Number(v.width||88)+'"></label>'+
        '<label><span>Altura</span><input data-t-height type="number" min="24" max="512" value="'+Number(v.height||88)+'"></label>'+
      '</div></section>'+
      '<section class="tq-ships__panel"><div class="tq-ships__panel-title"><div><strong>🌊 Comportamento no mar</strong><small>Define se o tesouro fica parado, boia, deriva ou aparece semi-naufragado.</small></div></div><div class="tq-ships__settings tq-ships__settings--v2">'+
        '<label><span>Comportamento</span><select data-t-behavior>'+presetOptions+'</select></label>'+
        '<label><span>Efeito visual</span><select data-t-effect>'+effectOptions+'</select></label>'+
        '<label><span>Imersão (%)</span><input data-t-immersion type="number" min="0" max="65" step="1" value="'+Math.round(behavior.immersion*100)+'"></label>'+
        '<label><span>Velocidade</span><input data-t-motion="speed" type="range" min="0" max="100" step="1" value="'+motion.speed+'"><output>'+Math.round(motion.speed)+'</output></label>'+
        '<label><span>Balanço vertical</span><input data-t-motion="heave" type="range" min="0" max="100" step="1" value="'+motion.heave+'"><output>'+Math.round(motion.heave)+'</output></label>'+
        '<label><span>Inclinação</span><input data-t-motion="roll" type="range" min="0" max="100" step="1" value="'+motion.roll+'"><output>'+Math.round(motion.roll)+'</output></label>'+
        '<label><span>Compressão da onda</span><input data-t-motion="pitch" type="range" min="0" max="100" step="1" value="'+motion.pitch+'"><output>'+Math.round(motion.pitch)+'</output></label>'+
        '<label><span>Deriva lateral</span><input data-t-motion="sway" type="range" min="0" max="100" step="1" value="'+motion.sway+'"><output>'+Math.round(motion.sway)+'</output></label>'+
      '</div><small class="tq-world-editor-note">'+this.e(SEA_PRESETS[behavior.preset]?.description||"")+'</small></section>'+
      '<section class="tq-ships__panel"><div class="tq-ships__panel-title"><div><strong>🪙 Ouro</strong><small>Quantidade aleatória e chance de conceder.</small></div></div><div class="tq-ships__settings tq-ships__settings--v2">'+this.rewardFields("gold",g)+'</div></section>'+
      '<section class="tq-ships__panel"><div class="tq-ships__panel-title"><div><strong>💎 Rubis</strong><small>Sorteio separado do ouro.</small></div></div><div class="tq-ships__settings tq-ships__settings--v2">'+this.rewardFields("rubies",r)+'</div></section>';

    const read=()=>{
      const n=structuredClone(v);
      n.name=host.querySelector("[data-t-name]").value;
      n.asset=host.querySelector("[data-t-asset]").value;
      n.width=Math.max(24,Number(host.querySelector("[data-t-width]").value)||88);
      n.height=Math.max(24,Number(host.querySelector("[data-t-height]").value)||88);
      const currentBehavior=normalizeBehavior(n.behavior);
      currentBehavior.preset=String(host.querySelector("[data-t-behavior]").value||"floating");
      currentBehavior.immersion=clamp(Number(host.querySelector("[data-t-immersion]").value)/100,0,.65);
      currentBehavior.effect={category:"treasure",preset:String(host.querySelector("[data-t-effect]").value||"none")};
      host.querySelectorAll("[data-t-motion]").forEach(input=>{
        currentBehavior.motion[input.dataset.tMotion]=clamp(input.value,0,100);
      });
      currentBehavior.motion.active=currentBehavior.preset!=="still";
      n.behavior=currentBehavior;
      n.rewards={gold:this.readReward(host,"gold"),rubies:this.readReward(host,"rubies")};
      return n;
    };

    const save=()=>{this.saveDraft(read());this.render()};
    host.querySelectorAll('input:not([type="range"]),select[data-t-effect]').forEach(x=>x.addEventListener("change",save));
    host.querySelector("[data-t-behavior]")?.addEventListener("change",event=>{
      const preset=String(event.currentTarget.value||"floating");
      const n=read();
      n.behavior=normalizeBehavior({preset});
      this.saveDraft(n);
      this.render();
    });
    host.querySelectorAll("[data-t-motion]").forEach(input=>{
      input.addEventListener("input",()=>{const output=input.parentElement?.querySelector("output");if(output)output.value=String(Math.round(Number(input.value)||0))});
      input.addEventListener("change",save);
    });
    host.querySelector("[data-t-pick]")?.addEventListener("click",()=>this.requestAsset?.({treasureId:v.id}));
  }

  rewardFields(k,x){return '<label><span>Mínimo</span><input data-r-min="'+k+'" type="number" min="0" value="'+Math.max(0,Number(x.min)||0)+'"></label><label><span>Máximo</span><input data-r-max="'+k+'" type="number" min="0" value="'+Math.max(0,Number(x.max)||0)+'"></label><label><span>Probabilidade (%)</span><input data-r-chance="'+k+'" type="number" min="0" max="100" step="1" value="'+Math.max(0,Math.min(100,Number(x.chance)||0))+'"></label>'}
  readReward(host,k){const min=Math.max(0,Math.floor(Number(host.querySelector('[data-r-min="'+k+'"]').value)||0));const max=Math.max(min,Math.floor(Number(host.querySelector('[data-r-max="'+k+'"]').value)||min));return{min,max,chance:Math.max(0,Math.min(100,Number(host.querySelector('[data-r-chance="'+k+'"]').value)||0))}}
  e(v){return String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]))}
}
