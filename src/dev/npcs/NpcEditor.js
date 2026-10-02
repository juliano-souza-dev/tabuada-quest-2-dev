export class NpcEditor{
  constructor({getShips,getAmmo}={}){
    this.getShips=typeof getShips==="function"?getShips:()=>[];
    this.getAmmo=typeof getAmmo==="function"?getAmmo:()=>[];
    this.catalog={schema:"tq.npc-catalog",version:1,npcs:[]};
    this.drafts=[];
    this.selectedId=null;
    this.storageKey="tq.dev.npc-drafts:v1";
    this.el=null;
  }
  async mount(parent){
    this.el=document.createElement("section");
    this.el.className="tq-dev__ships tq-dev__npcs";
    this.el.hidden=true;
    this.el.innerHTML='<header><div><strong>NPC</strong><small>Comportamento dos navios controlados pelo jogo</small></div><button type="button" data-npc-close aria-label="Fechar">×</button></header><div class="tq-ships__body"><aside class="tq-ships__sidebar"><button type="button" class="tq-ships__new" data-npc-new>＋ Novo NPC</button><div class="tq-ships__list" data-npc-list></div></aside><main class="tq-ships__editor" data-npc-editor></main></div>';
    parent.append(this.el);
    this.el.querySelector("[data-npc-close]").addEventListener("click",()=>this.setVisible(false));
    this.el.querySelector("[data-npc-new]").addEventListener("click",()=>this.createNpc());
    await this.load();
  }
  async load(){
    try{const r=await fetch("./src/config/npc-catalog.json?v=20261002-1610",{cache:"no-store"});if(r.ok)this.catalog=await r.json()}catch(e){console.warn("NPC catalog load failed",e)}
    try{const d=JSON.parse(localStorage.getItem(this.storageKey)||"[]");this.drafts=Array.isArray(d)?d:[]}catch{this.drafts=[]}
    this.selectedId=this.all()[0]?.id||null;this.render();
  }
  all(){const m=new Map((this.catalog.npcs||[]).map(x=>[x.id,structuredClone(x)]));for(const x of this.drafts)m.set(x.id,structuredClone(x));return [...m.values()]}
  current(){return this.all().find(x=>x.id===this.selectedId)||null}
  saveDraft(value){const i=this.drafts.findIndex(x=>x.id===value.id);if(i>=0)this.drafts[i]=value;else this.drafts.push(value);localStorage.setItem(this.storageKey,JSON.stringify(this.drafts));globalThis.dispatchEvent(new CustomEvent("tq:npcprofilechange",{detail:{npcId:value.id}}))}
  createNpc(){const ships=this.getShips();if(!ships.length)return;let n=1,id="npc-"+n;while(this.all().some(x=>x.id===id))id="npc-"+(++n);const npc={id,name:"Novo NPC",shipId:ships[0].id,navigation:{minSpeed:0,speed:80,acceleration:250,behavior:"roam"},combat:{hp:3,attitude:"retaliate",attackRange:1200,attackCooldownMs:900,damage:1,allowedAmmoIds:["cannonball-standard"]}};this.saveDraft(npc);this.selectedId=id;this.render()}
  setVisible(show){if(this.el)this.el.hidden=!show;if(show)this.render()}
  render(){if(!this.el)return;const list=this.el.querySelector("[data-npc-list]");list.innerHTML=this.all().map(x=>'<button type="button" class="'+(x.id===this.selectedId?'active':'')+'" data-npc-id="'+this.e(x.id)+'"><strong>'+this.e(x.name)+'</strong><small>'+this.e(x.id)+'</small></button>').join("");list.querySelectorAll("[data-npc-id]").forEach(b=>b.onclick=()=>{this.selectedId=b.dataset.npcId;this.render()});this.renderEditor()}
  renderEditor(){const host=this.el.querySelector("[data-npc-editor]"),npc=this.current();if(!npc){host.innerHTML='<div class="tq-ships__empty">Crie ou selecione um NPC.</div>';return}const ships=this.getShips();host.innerHTML='<section class="tq-ships__panel"><div class="tq-ships__panel-title"><div><strong>Perfil NPC</strong><small>O visual vem do catálogo de Navios.</small></div></div><div class="tq-ships__settings tq-ships__settings--v2"><label><span>Nome</span><input data-n-name value="'+this.e(npc.name)+'"></label><label><span>Navio</span><select data-n-ship>'+ships.map(s=>'<option value="'+this.e(s.id)+'" '+(s.id===npc.shipId?'selected':'')+'>'+this.e(s.name||s.id)+'</option>').join("")+'</select></label><label><span>Velocidade mínima</span><input data-n-min type="number" min="0" max="1200" value="'+Number(npc.navigation?.minSpeed||0)+'"></label><label><span>Velocidade máxima</span><input data-n-speed type="number" min="0" max="1200" value="'+Number(npc.navigation?.speed||80)+'"></label><label><span>Aceleração</span><input data-n-accel type="number" min="0" max="3000" value="'+Number(npc.navigation?.acceleration||250)+'"></label><label><span>Vida / casco</span><input data-n-hp type="number" min="1" max="99" value="'+Number(npc.combat?.hp||3)+'"></label><label><span>Comportamento no mar</span><select data-n-behavior><option value="roam" '+(npc.navigation?.behavior==="roam"?'selected':'')+'>Navegação livre</option><option value="patrol" '+(npc.navigation?.behavior==="patrol"?'selected':'')+'>Patrulha</option><option value="stationary" '+(npc.navigation?.behavior==="stationary"?'selected':'')+'>Parado</option></select></label><label><span>Atitude</span><select data-n-attitude><option value="hostile" '+(npc.combat?.attitude==="hostile"?'selected':'')+'>Hostil</option><option value="retaliate" '+(npc.combat?.attitude==="retaliate"?'selected':'')+'>Revida quando atacado</option><option value="peaceful" '+(npc.combat?.attitude==="peaceful"?'selected':'')+'>Pacífico</option></select></label></div></section>';
    const save=()=>{const v=structuredClone(npc);v.name=host.querySelector("[data-n-name]").value;v.shipId=host.querySelector("[data-n-ship]").value;v.navigation={...(v.navigation||{}),minSpeed:Number(host.querySelector("[data-n-min]").value)||0,speed:Number(host.querySelector("[data-n-speed]").value)||0,acceleration:Number(host.querySelector("[data-n-accel]").value)||0,behavior:host.querySelector("[data-n-behavior]").value};v.combat={...(v.combat||{}),hp:Math.max(1,Number(host.querySelector("[data-n-hp]").value)||3),attitude:host.querySelector("[data-n-attitude]").value};this.saveDraft(v);this.render()};host.querySelectorAll("input,select").forEach(x=>x.addEventListener("change",save))
  }
  resolve(id){return this.all().find(x=>x.id===String(id||""))||null}
  e(v){return String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]))}
}