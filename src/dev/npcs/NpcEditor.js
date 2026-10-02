export class NpcEditor{
  constructor({getShips,getAmmo}={}){
    this.getShips=typeof getShips==="function"?getShips:()=>[];
    this.getAmmo=typeof getAmmo==="function"?getAmmo:()=>[];
    this.catalog={schema:"tq.npc-catalog",version:1,npcs:[]};
    this.drafts=[];this.trash=[];this.permanentlyDeletedIds=new Set();this.selectedId=null;
    this.storageKey="tq.dev.npc-drafts:v1";
    this.trashStorageKey="tq.dev.npc-trash:v1";
    this.permanentDeleteStorageKey="tq.dev.npc-permanent-deleted:v1";
    this.el=null;
  }
  async mount(parent){
    this.el=document.createElement("section");this.el.className="tq-dev__ships tq-dev__npcs";this.el.hidden=true;
    this.el.innerHTML='<header><div><strong>NPC</strong><small>Comportamento dos navios controlados pelo jogo</small></div><button type="button" data-npc-close aria-label="Fechar">×</button></header><div class="tq-ships__body"><aside class="tq-ships__sidebar"><button type="button" class="tq-ships__new" data-npc-new>＋ Novo NPC</button><button type="button" class="tq-npc-trash-toggle" data-npc-trash-toggle>🗑 Lixeira <b data-npc-trash-count>0</b></button><div class="tq-ships__list" data-npc-list></div><section class="tq-npc-trash" data-npc-trash hidden><div class="tq-npc-trash__head"><strong>Lixeira</strong><small>NPCs removidos</small></div><div data-npc-trash-list></div></section></aside><main class="tq-ships__editor" data-npc-editor></main></div>';
    parent.append(this.el);
    this.el.querySelector("[data-npc-close]").onclick=()=>this.setVisible(false);
    this.el.querySelector("[data-npc-new]").onclick=()=>this.createNpc();
    this.el.querySelector("[data-npc-trash-toggle]").onclick=()=>{const x=this.el.querySelector("[data-npc-trash]");x.hidden=!x.hidden};
    await this.load();
  }
  async load(){
    try{const r=await fetch("./src/config/npc-catalog.json?v=20261002-1610",{cache:"no-store"});if(r.ok)this.catalog=await r.json()}catch(e){console.warn("NPC catalog load failed",e)}
    try{const d=JSON.parse(localStorage.getItem(this.storageKey)||"[]");this.drafts=Array.isArray(d)?d:[]}catch{this.drafts=[]}
    try{const d=JSON.parse(localStorage.getItem(this.trashStorageKey)||"[]");this.trash=Array.isArray(d)?d:[]}catch{this.trash=[]}
    try{const d=JSON.parse(localStorage.getItem(this.permanentDeleteStorageKey)||"[]");this.permanentlyDeletedIds=new Set(Array.isArray(d)?d.map(String):[])}catch{this.permanentlyDeletedIds=new Set()}
    this.selectedId=this.all()[0]?.id||null;this.render();
  }
  trashedIds(){return new Set(this.trash.map(x=>String(x.id)))}
  all(){const removed=this.trashedIds(),deleted=this.permanentlyDeletedIds,m=new Map((this.catalog.npcs||[]).filter(x=>!removed.has(String(x.id))&&!deleted.has(String(x.id))).map(x=>[x.id,structuredClone(x)]));for(const x of this.drafts)if(!removed.has(String(x.id))&&!deleted.has(String(x.id)))m.set(x.id,structuredClone(x));return [...m.values()]}
  current(){return this.all().find(x=>x.id===this.selectedId)||null}
  persistDrafts(){localStorage.setItem(this.storageKey,JSON.stringify(this.drafts))}
  persistTrash(){localStorage.setItem(this.trashStorageKey,JSON.stringify(this.trash))}
  persistPermanentDeletes(){localStorage.setItem(this.permanentDeleteStorageKey,JSON.stringify([...this.permanentlyDeletedIds]))}
  saveDraft(value){const i=this.drafts.findIndex(x=>x.id===value.id);if(i>=0)this.drafts[i]=value;else this.drafts.push(value);this.persistDrafts();globalThis.dispatchEvent(new CustomEvent("tq:npcprofilechange",{detail:{npcId:value.id}}))}
  createNpc(){const ships=this.getShips();if(!ships.length)return;let n=1,id="npc-"+n;while(this.all().some(x=>x.id===id)||this.trash.some(x=>x.id===id)||this.permanentlyDeletedIds.has(id))id="npc-"+(++n);const npc={id,name:"Novo NPC",shipId:ships[0].id,navigation:{minSpeed:0,speed:80,acceleration:250,behavior:"roam"},combat:{hp:3,attitude:"retaliate",attackRange:1200,attackCooldownMs:900,damage:1,allowedAmmoIds:(this.getAmmo()[0]?.id?[this.getAmmo()[0].id]:[])}};this.saveDraft(npc);this.selectedId=id;this.render()}
  moveToTrash(id){const npc=this.all().find(x=>x.id===id);if(!npc)return;this.trash=this.trash.filter(x=>x.id!==id);this.trash.unshift({...structuredClone(npc),deletedAt:Date.now()});this.drafts=this.drafts.filter(x=>x.id!==id);this.persistTrash();this.persistDrafts();this.selectedId=this.all()[0]?.id||null;globalThis.dispatchEvent(new CustomEvent("tq:npcprofilechange",{detail:{npcId:id,deleted:true}}));this.render()}
  restoreNpc(id){const i=this.trash.findIndex(x=>x.id===id);if(i<0)return;const npc=structuredClone(this.trash[i]);delete npc.deletedAt;this.trash.splice(i,1);this.saveDraft(npc);this.persistTrash();this.selectedId=id;this.render()}
  deleteForever(id){const item=this.trash.find(x=>String(x.id)===String(id));if(!item)return;if(!globalThis.confirm?.('Apagar definitivamente o NPC "'+String(item.name||item.id)+'"? Esta ação não pode ser desfeita.'))return;const key=String(id);this.trash=this.trash.filter(x=>String(x.id)!==key);this.drafts=this.drafts.filter(x=>String(x.id)!==key);this.permanentlyDeletedIds.add(key);this.persistTrash();this.persistDrafts();this.persistPermanentDeletes();if(this.selectedId===key)this.selectedId=this.all()[0]?.id||null;globalThis.dispatchEvent(new CustomEvent("tq:npcprofilechange",{detail:{npcId:key,deleted:true,permanent:true}}));this.render()}
  setVisible(show){if(this.el)this.el.hidden=!show;if(show)this.render()}
  render(){
    if(!this.el)return;
    const list=this.el.querySelector("[data-npc-list]");
    list.innerHTML=this.all().map(x=>'<button type="button" class="tq-ship-item '+(x.id===this.selectedId?'is-current':'')+'" data-npc-id="'+this.e(x.id)+'"><span><b>'+this.e(x.name)+'</b><small>'+this.e(x.id)+'</small></span></button>').join("");
    list.querySelectorAll("[data-npc-id]").forEach(b=>b.onclick=()=>{this.selectedId=b.dataset.npcId;this.render()});
    this.el.querySelector("[data-npc-trash-count]").textContent=String(this.trash.length);
    const trash=this.el.querySelector("[data-npc-trash-list]");
    trash.innerHTML=this.trash.length?this.trash.map(x=>'<article class="tq-npc-trash__item"><span><b>'+this.e(x.name)+'</b><small>'+this.e(x.id)+'</small></span><div><button type="button" data-npc-restore="'+this.e(x.id)+'">↩ Restaurar</button><button type="button" class="tq-npc-delete-forever" data-npc-delete="'+this.e(x.id)+'">Apagar definitivamente</button></div></article>').join(""):'<small class="tq-npc-trash__empty">A lixeira está vazia.</small>';
    trash.querySelectorAll("[data-npc-restore]").forEach(b=>b.onclick=()=>this.restoreNpc(b.dataset.npcRestore));
    trash.querySelectorAll("[data-npc-delete]").forEach(b=>b.onclick=()=>this.deleteForever(b.dataset.npcDelete));
    this.renderEditor();
  }
  shipVisual(ship){
    const sprite=ship?.navigation?.sprite||ship?.sprite||{};
    const src=String(sprite.src||ship?.navigation?.src||ship?.src||"");
    const columns=Math.max(1,Number(sprite.columns)||4),rows=Math.max(1,Number(sprite.rows)||4);
    const frame=Math.max(0,Number(sprite.directionFrames?.e??sprite.initialFrame??4)||0),col=frame%columns,row=Math.floor(frame/columns);
    return {src,backgroundSize:(columns*100)+"% "+(rows*100)+"%",backgroundPosition:(columns===1?0:(col/(columns-1))*100)+"% "+(rows===1?0:(row/(rows-1))*100)+"%"};
  }
  renderEditor(){
    const host=this.el.querySelector("[data-npc-editor]"),npc=this.current();
    if(!npc){host.innerHTML='<div class="tq-ships__empty">Crie ou selecione um NPC.</div>';return}
    const ships=this.getShips(),ship=ships.find(s=>String(s.id)===String(npc.shipId))||null,visual=this.shipVisual(ship);
    const slider=(key,label,min,max,step,value,unit="")=>'<label class="tq-npc-slider"><span>'+label+' <output data-npc-output="'+key+'">'+Number(value)+unit+'</output></span><input type="range" data-n-'+key+' min="'+min+'" max="'+max+'" step="'+step+'" value="'+Number(value)+'"></label>';
    host.innerHTML='<div class="tq-npc-workspace"><div class="tq-npc-controls"><section class="tq-ships__panel"><div class="tq-ships__panel-title"><div><strong>Perfil NPC</strong><small>Identidade e navio utilizado por este personagem.</small></div><button type="button" class="tq-npc-delete" data-npc-trash-current>🗑 Mover para lixeira</button></div><div class="tq-npc-identity"><label><span>Nome</span><input data-n-name value="'+this.e(npc.name)+'"></label><label><span>Navio</span><select data-n-ship>'+ships.map(s=>'<option value="'+this.e(s.id)+'" '+(s.id===npc.shipId?'selected':'')+'>'+this.e(s.name||s.id)+'</option>').join("")+'</select></label></div></section><section class="tq-ships__panel"><div class="tq-ships__panel-title"><div><strong>Navegação e resistência</strong><small>Ajuste fino com atualização imediata no simulador.</small></div></div><div class="tq-npc-sliders">'+slider("min","Velocidade mínima",0,1200,1,npc.navigation?.minSpeed||0," px/s")+slider("speed","Velocidade máxima",0,1200,1,npc.navigation?.speed||80," px/s")+slider("accel","Aceleração",0,3000,10,npc.navigation?.acceleration||250," px/s²")+slider("hp","Vida / casco",1,950000,100,npc.combat?.hp||3," HP")+'</div><div class="tq-npc-selects"><label><span>Comportamento no mar</span><select data-n-behavior><option value="roam" '+(npc.navigation?.behavior==="roam"?'selected':'')+'>Navegação livre</option><option value="patrol" '+(npc.navigation?.behavior==="patrol"?'selected':'')+'>Patrulha</option><option value="stationary" '+(npc.navigation?.behavior==="stationary"?'selected':'')+'>Parado</option></select></label><label><span>Atitude</span><select data-n-attitude><option value="hostile" '+(npc.combat?.attitude==="hostile"?'selected':'')+'>Hostil</option><option value="retaliate" '+(npc.combat?.attitude==="retaliate"?'selected':'')+'>Revida quando atacado</option><option value="peaceful" '+(npc.combat?.attitude==="peaceful"?'selected':'')+'>Pacífico</option></select></label></div></section></div><aside class="tq-npc-simulator"><section class="tq-ships__panel"><div class="tq-ships__panel-title"><div><strong>Simulador</strong><small>Prévia do comportamento configurado.</small></div><span>AO VIVO</span></div><div class="tq-npc-sim-stage" data-npc-sim-stage><div class="tq-npc-sim-sea"></div><div class="tq-npc-sim-ship" data-npc-sim-ship '+(!visual.src?'is-empty':'')+'" style="'+(visual.src?'background-image:url(&quot;'+this.e(visual.src)+'&quot;);background-size:'+visual.backgroundSize+';background-position:'+visual.backgroundPosition+';':'')+'">'+(!visual.src?'⛵':'')+'</div></div><div class="tq-npc-sim-stats"><span>Velocidade <b data-sim-speed>'+Number(npc.navigation?.speed||80)+'</b></span><span>Aceleração <b data-sim-accel>'+Number(npc.navigation?.acceleration||250)+'</b></span><span>Casco <b data-sim-hp>'+Number(npc.combat?.hp||3)+'</b></span></div></section></aside></div>';
    const read=()=>{const v=structuredClone(npc);v.name=host.querySelector("[data-n-name]").value;v.shipId=host.querySelector("[data-n-ship]").value;v.navigation={...(v.navigation||{}),minSpeed:Number(host.querySelector("[data-n-min]").value)||0,speed:Number(host.querySelector("[data-n-speed]").value)||0,acceleration:Number(host.querySelector("[data-n-accel]").value)||0,behavior:host.querySelector("[data-n-behavior]").value};v.combat={...(v.combat||{}),hp:Math.max(1,Math.min(950000,Number(host.querySelector("[data-n-hp]").value)||3)),attitude:host.querySelector("[data-n-attitude]").value};return v};
    const preview=()=>{for(const key of ["min","speed","accel","hp"]){const input=host.querySelector("[data-n-"+key+"]"),out=host.querySelector('[data-npc-output="'+key+'"]');if(out)out.textContent=input.value+(key==="hp"?" HP":key==="accel"?" px/s²":" px/s")}host.querySelector("[data-sim-speed]").textContent=host.querySelector("[data-n-speed]").value;host.querySelector("[data-sim-accel]").textContent=host.querySelector("[data-n-accel]").value;host.querySelector("[data-sim-hp]").textContent=host.querySelector("[data-n-hp]").value;const sim=host.querySelector("[data-npc-sim-ship]"),speed=Number(host.querySelector("[data-n-speed]").value)||0,behavior=host.querySelector("[data-n-behavior]").value;sim.style.setProperty("--npc-sim-duration",Math.max(1.2,8-speed/180)+"s");sim.classList.toggle("is-stationary",behavior==="stationary")};
    host.querySelectorAll('input[type="range"]').forEach(x=>x.addEventListener("input",preview));
    host.querySelectorAll("input,select").forEach(x=>x.addEventListener("change",()=>{this.saveDraft(read());this.render()}));
    host.querySelector("[data-npc-trash-current]").onclick=()=>this.moveToTrash(npc.id);
    preview();
  }
  worldProfiles(){const ships=new Set((this.getShips()||[]).map(ship=>String(ship?.id||"")).filter(Boolean));return this.all().filter(npc=>{const shipId=String(npc?.shipId||"");return Boolean(shipId&&ships.has(shipId))})}\n  resolve(id){return this.all().find(x=>x.id===String(id||""))||null}\n  resolveForWorld(id){return this.worldProfiles().find(x=>x.id===String(id||""))||null}
  e(v){return String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]))}
}