import { AmmoPreviewGL } from "./AmmoPreviewGL.js?v=20261002-2022";
import { AMMO_FX_PRESETS, normalizeAmmoFx, applyAmmoFxPreset } from "../../world/fx/AmmoFxProfile.mjs?v=20261002-2012";

export class AmmoEditor{
  constructor({requestAsset}={}){
    this.requestAsset=typeof requestAsset==="function"?requestAsset:null;
    this.catalog={schema:"tq.ammo-catalog",version:1,defaultAmmoId:"",ammo:[]};
    this.drafts=[];
    this.selectedId=null;
    this.storageKey="tq.dev.ammo-drafts:v1";
    this.el=null;
    this.preview=null;
  }

  async mount(parent){
    this.el=document.createElement("section");
    this.el.className="tq-dev__ships tq-dev__ammo tq-dev__ammo-fx";
    this.el.hidden=true;
    this.el.innerHTML='<header><div><strong>Munições</strong><small>Construtor WebGL de projétil, rastro, disparo e impacto</small></div><button type="button" data-ammo-close aria-label="Fechar">×</button></header><div class="tq-ships__body"><aside class="tq-ships__sidebar"><button type="button" class="tq-ships__new" data-ammo-new>＋ Nova munição</button><button type="button" class="tq-ships__new tq-ammo-duplicate" data-ammo-duplicate>⧉ Duplicar</button><div class="tq-ships__list" data-ammo-list></div></aside><main class="tq-ships__editor" data-ammo-editor></main></div>';
    parent.append(this.el);
    this.el.querySelector("[data-ammo-close]").onclick=()=>this.setVisible(false);
    this.el.querySelector("[data-ammo-new]").onclick=()=>this.create();
    this.el.querySelector("[data-ammo-duplicate]").onclick=()=>this.duplicateCurrent();
    await this.load();
  }

  async load(){
    try{
      const r=await fetch("./src/config/ammo-catalog.json?v=20261002-2012",{cache:"no-store"});
      if(r.ok)this.catalog=await r.json();
    }catch(e){console.warn("Ammo catalog load failed",e)}
    try{
      const d=JSON.parse(localStorage.getItem(this.storageKey)||"[]");
      this.drafts=Array.isArray(d)?d:[];
    }catch{this.drafts=[]}
    this.selectedId=this.all()[0]?.id||null;
    this.render();
  }

  normalize(value={}){
    const v=structuredClone(value);
    v.id=String(v.id||"ammo-"+Date.now());
    v.name=String(v.name||v.id||"Munição");
    v.available=v.available!==false;
    v.damage=Math.max(0,Math.min(10000,Number(v.damage)||0));
    v.projectileSpeed=Math.max(80,Math.min(5000,Number(v.projectileSpeed)||720));
    v.size=Math.max(.2,Math.min(4,Number(v.size)||1));
    v.shop={
      purchasable:v.shop?.purchasable!==false,
      price:Math.max(0,Number(v.shop?.price)||0)
    };
    v.fx=normalizeAmmoFx(v);
    v.effects={
      ...(v.effects&&typeof v.effects==="object"?v.effects:{}),
      projectile:"profile-webgl",
      impact:"profile-webgl",
      waterSplash:"profile-webgl",
      renderer:"webgl2"
    };
    if(v.fx.projectile.texture)v.effects.texture=v.fx.projectile.texture;
    else delete v.effects.texture;
    return v;
  }

  all(){
    const m=new Map((this.catalog.ammo||[]).map(x=>[x.id,this.normalize(x)]));
    for(const x of this.drafts)m.set(x.id,this.normalize(x));
    return [...m.values()];
  }

  current(){return this.all().find(x=>x.id===this.selectedId)||null}

  save(value,{notify=true}={}){
    const v=this.normalize(value);
    const i=this.drafts.findIndex(x=>x.id===v.id);
    if(i>=0)this.drafts[i]=v;else this.drafts.push(v);
    try{localStorage.setItem(this.storageKey,JSON.stringify(this.drafts))}catch(error){console.warn("Ammo draft save failed",error)}
    if(notify)globalThis.dispatchEvent(new CustomEvent("tq:ammoprofilechange",{detail:{ammoId:v.id}}));
    return v;
  }

  create(){
    let n=1,id="ammo-"+n;
    while(this.all().some(x=>x.id===id))id="ammo-"+(++n);
    const value=applyAmmoFxPreset({
      id,name:"Nova munição",available:true,damage:10,projectileSpeed:720,size:1,
      effects:{renderer:"webgl2"},shop:{purchasable:true,price:1}
    },"standard");
    this.save(value);
    this.selectedId=id;
    this.render();
  }

  duplicateCurrent(){
    const source=this.current();
    if(!source)return;
    let n=1,id=source.id+"-copy";
    while(this.all().some(x=>x.id===id))id=source.id+"-copy-"+(++n);
    const copy=structuredClone(source);
    copy.id=id;
    copy.name=source.name+" cópia";
    this.save(copy);
    this.selectedId=id;
    this.render();
  }

  setVisible(show){
    if(!this.el)return;
    this.el.hidden=!show;
    if(show)this.render();
    else this.destroyPreview();
  }

  destroyPreview(){
    this.preview?.destroy?.();
    this.preview=null;
  }

  render(){
    if(!this.el)return;
    const list=this.el.querySelector("[data-ammo-list]");
    list.innerHTML=this.all().map(x=>'<button type="button" class="tq-ship-item '+(x.id===this.selectedId?'is-current':'')+'" data-ammo-id="'+this.e(x.id)+'"><span><b>'+this.e(x.name)+'</b><small>'+this.e(x.id)+'</small></span><em>WebGL</em></button>').join("");
    list.querySelectorAll("[data-ammo-id]").forEach(b=>b.onclick=()=>{this.selectedId=b.dataset.ammoId;this.render()});
    this.el.querySelector("[data-ammo-duplicate]").disabled=!this.current();
    this.renderEditor();
  }

  range(path,label,min,max,step,value,unit=""){
    return '<label class="tq-ammo-fx-range"><span>'+label+' <output data-fx-output="'+path+'">'+this.format(value)+unit+'</output></span><input type="range" data-fx="'+path+'" min="'+min+'" max="'+max+'" step="'+step+'" value="'+Number(value)+'" data-unit="'+this.e(unit)+'"></label>';
  }

  color(path,label,value){
    return '<label class="tq-ammo-fx-color"><span>'+label+'</span><div><input type="color" data-fx="'+path+'" value="'+this.e(value)+'"><code>'+this.e(value)+'</code></div></label>';
  }

  toggle(path,label,value){
    return '<label class="tq-ammo-fx-toggle"><span>'+label+'</span><input type="checkbox" data-fx="'+path+'" '+(value!==false?'checked':'')+'></label>';
  }

  renderEditor(){
    this.destroyPreview();
    const host=this.el.querySelector("[data-ammo-editor]");
    const ammo=this.current();
    if(!ammo){
      host.innerHTML='<div class="tq-ships__empty">Crie ou selecione uma munição.</div>';
      return;
    }
    const fx=normalizeAmmoFx(ammo);
    const presetOptions=Object.values(AMMO_FX_PRESETS).map(p=>'<option value="'+this.e(p.id)+'" '+(p.id===fx.preset?'selected':'')+'>'+this.e(p.label)+'</option>').join("");

    host.innerHTML=
      '<div class="tq-ammo-builder">'+
        '<div class="tq-ammo-builder__controls">'+
          '<section class="tq-ships__panel tq-ammo-basic"><div class="tq-ships__panel-title"><div><strong>Identidade e gameplay</strong><small>Stats da munição e preset visual inicial.</small></div><span class="tq-ammo-webgl-badge">WEBGL 2</span></div>'+
            '<div class="tq-ammo-basic__grid">'+
              '<label><span>Nome</span><input data-a-name value="'+this.e(ammo.name)+'"></label>'+
              '<label><span>Preset FX</span><select data-a-preset>'+presetOptions+'</select></label>'+
              '<label><span>Dano</span><input data-a-damage type="number" min="0" max="10000" value="'+Number(ammo.damage)+'"></label>'+
              '<label><span>Velocidade</span><input data-a-speed type="number" min="80" max="5000" value="'+Number(ammo.projectileSpeed)+'"></label>'+
              '<label><span>Tamanho</span><input data-a-size type="number" min=".2" max="4" step=".05" value="'+Number(ammo.size)+'"></label>'+
              '<label><span>Preço</span><input data-a-price type="number" min="0" value="'+Number(ammo.shop?.price||0)+'"></label>'+
              '<label class="tq-ammo-check"><span>Disponível</span><input data-a-available type="checkbox" '+(ammo.available!==false?'checked':'')+'></label>'+
              '<label class="tq-ammo-check"><span>Vendável</span><input data-a-buy type="checkbox" '+(ammo.shop?.purchasable!==false?'checked':'')+'></label>'+
            '</div>'+
          '</section>'+

          '<details class="tq-ammo-fx-section" open><summary><strong>💥 Disparo / Muzzle</strong><small>Flash e fumaça no nascimento do projétil.</small></summary><div class="tq-ammo-fx-grid">'+
            this.toggle("muzzle.enabled","Ativo",fx.muzzle.enabled)+
            this.range("muzzle.size","Escala",8,220,1,fx.muzzle.size," px")+
            this.range("muzzle.durationMs","Duração",40,1600,10,fx.muzzle.durationMs," ms")+
            this.range("muzzle.intensity","Intensidade",.05,3,.05,fx.muzzle.intensity,"")+
            this.range("muzzle.sparks","Fagulhas",0,64,1,fx.muzzle.sparks,"")+
            this.range("muzzle.starburst","Starburst",0,1.5,.05,fx.muzzle.starburst,"")+
            this.range("muzzle.smoke","Fumaça",0,1.5,.05,fx.muzzle.smoke,"")+
            this.color("muzzle.color","Cor",fx.muzzle.color)+
            this.color("muzzle.coreColor","Núcleo",fx.muzzle.coreColor)+
            this.color("muzzle.accentColor","Acento",fx.muzzle.accentColor)+
          '</div></details>'+

          '<details class="tq-ammo-fx-section" open><summary><strong>🔥 Projétil em movimento</strong><small>Cor, glow, escala e oscilação durante o voo.</small></summary><div class="tq-ammo-fx-grid">'+
            this.range("projectile.scale","Escala",.2,4,.05,fx.projectile.scale,"×")+
            this.range("projectile.glow","Glow",0,2.5,.05,fx.projectile.glow,"")+
            this.range("projectile.opacity","Opacidade",.05,1,.05,fx.projectile.opacity,"")+
            this.range("projectile.wobble","Oscilação",0,1,.02,fx.projectile.wobble,"")+
            this.toggle("projectile.auraEnabled","Aura do asset",fx.projectile.auraEnabled)+
            this.range("projectile.auraScale","Escala da aura",1,3.5,.05,fx.projectile.auraScale,"×")+
            this.range("projectile.auraOpacity","Opacidade da aura",0,1,.05,fx.projectile.auraOpacity,"")+
            this.range("projectile.orbitCount","Partículas orbitais",0,12,1,fx.projectile.orbitCount,"")+
            this.range("projectile.orbitRadius","Raio orbital",.25,2.2,.05,fx.projectile.orbitRadius,"×")+
            this.range("projectile.sparkle","Sparkle",0,1.5,.05,fx.projectile.sparkle,"")+
            this.range("projectile.pulseSpeed","Pulso",.2,4,.05,fx.projectile.pulseSpeed,"×")+
            this.color("projectile.color","Cor",fx.projectile.color)+
            this.color("projectile.coreColor","Núcleo",fx.projectile.coreColor)+
            this.color("projectile.accentColor","Acento",fx.projectile.accentColor)+
            '<div class="tq-ammo-asset tq-ammo-fx-wide"><span>Asset central do projétil</span><div class="tq-ammo-asset__row">'+(fx.projectile.texture?'<img src="'+this.e(fx.projectile.texture)+'" alt="">':'<span class="tq-ammo-asset__empty">∅</span>')+'<div><button type="button" class="tq-ships__new" data-ammo-asset>▦ Escolher asset</button><small>'+this.e(fx.projectile.texture||"Sem asset: usando somente fallback WebGL")+'</small></div></div><input data-fx="projectile.texture" value="'+this.e(fx.projectile.texture)+'" placeholder="./assets/cannons/...webp"></div>'+
          '</div></details>'+

          '<details class="tq-ammo-fx-section" open><summary><strong>☄️ Rastro</strong><small>Comprimento, largura, fade e cor da trilha.</small></summary><div class="tq-ammo-fx-grid">'+
            this.toggle("trail.enabled","Ativo",fx.trail.enabled)+
            this.range("trail.length","Comprimento",0,36,1,fx.trail.length,"")+
            this.range("trail.width","Largura",1,64,1,fx.trail.width," px")+
            this.range("trail.opacity","Opacidade",0,1,.05,fx.trail.opacity,"")+
            this.range("trail.taper","Afinamento",0,1,.05,fx.trail.taper,"")+
            this.range("trail.sparkle","Sparkles",0,1.5,.05,fx.trail.sparkle,"")+
            this.range("trail.ribbon","Ribbon duplo",0,1.5,.05,fx.trail.ribbon,"")+
            this.color("trail.color","Cor principal",fx.trail.color)+
            this.color("trail.secondaryColor","Cor secundária",fx.trail.secondaryColor)+
          '</div></details>'+

          '<details class="tq-ammo-fx-section" open><summary><strong>💣 Impacto no casco</strong><small>Explosão, choque, fagulhas e fumaça.</small></summary><div class="tq-ammo-fx-grid">'+
            this.toggle("impactShip.enabled","Ativo",fx.impactShip.enabled)+
            this.range("impactShip.size","Escala",12,360,2,fx.impactShip.size," px")+
            this.range("impactShip.durationMs","Duração",80,2200,10,fx.impactShip.durationMs," ms")+
            this.range("impactShip.sparks","Fagulhas",0,64,1,fx.impactShip.sparks,"")+
            this.range("impactShip.smoke","Fumaça",0,1.5,.05,fx.impactShip.smoke,"")+
            this.range("impactShip.shock","Onda de choque",0,1.5,.05,fx.impactShip.shock,"")+
            this.range("impactShip.fireworks","Fogos",0,1.5,.05,fx.impactShip.fireworks,"")+
            this.range("impactShip.ringCount","Anéis",1,4,1,fx.impactShip.ringCount,"")+
            this.color("impactShip.color","Cor",fx.impactShip.color)+
            this.color("impactShip.coreColor","Núcleo",fx.impactShip.coreColor)+
            this.color("impactShip.accentColor","Acento",fx.impactShip.accentColor)+
          '</div></details>'+

          '<details class="tq-ammo-fx-section" open><summary><strong>🌊 Impacto na água</strong><small>Splash, ripple, espuma e névoa.</small></summary><div class="tq-ammo-fx-grid">'+
            this.toggle("impactWater.enabled","Ativo",fx.impactWater.enabled)+
            this.range("impactWater.size","Escala",12,420,2,fx.impactWater.size," px")+
            this.range("impactWater.durationMs","Duração",80,2600,10,fx.impactWater.durationMs," ms")+
            this.range("impactWater.splash","Splash",0,1.5,.05,fx.impactWater.splash,"")+
            this.range("impactWater.ripple","Ripple",0,1.5,.05,fx.impactWater.ripple,"")+
            this.range("impactWater.foam","Espuma",0,1.5,.05,fx.impactWater.foam,"")+
            this.range("impactWater.mist","Névoa",0,1.5,.05,fx.impactWater.mist,"")+
            this.range("impactWater.magic","Partículas mágicas",0,1.5,.05,fx.impactWater.magic,"")+
            this.range("impactWater.ringCount","Anéis",1,4,1,fx.impactWater.ringCount,"")+
            this.color("impactWater.color","Cor",fx.impactWater.color)+
            this.color("impactWater.coreColor","Núcleo",fx.impactWater.coreColor)+
            this.color("impactWater.accentColor","Acento",fx.impactWater.accentColor)+
          '</div></details>'+
        '</div>'+

        '<aside class="tq-ammo-preview"><section class="tq-ships__panel"><div class="tq-ships__panel-title"><div><strong>Simulador WebGL</strong><small>O mesmo renderer usado no combate naval.</small></div><span class="tq-ammo-live">● AO VIVO</span></div>'+
          '<div class="tq-ammo-preview__toolbar">'+
            '<label><span>Destino</span><select data-preview-mode><option value="ship">Casco</option><option value="water">Água</option><option value="alternate">Alternar</option></select></label>'+
            '<label><span>Velocidade</span><input type="range" data-preview-speed min=".25" max="2" step=".25" value="1"></label>'+
            '<label class="tq-ammo-preview__loop"><input type="checkbox" data-preview-loop checked><span>Replay</span></label>'+
          '</div>'+
          '<div class="tq-ammo-preview__stage" data-preview-stage><div class="tq-ammo-preview__sea"></div><div class="tq-ammo-preview__cannon">☠</div><div class="tq-ammo-preview__ship">⛵</div><div class="tq-ammo-preview__water-target">◎</div><div class="tq-ammo-preview__asset-state" data-preview-asset-state>Verificando asset…</div><canvas data-ammo-preview></canvas></div>'+
          '<div class="tq-ammo-preview__actions"><button type="button" data-fire-ship>💥 Testar casco</button><button type="button" data-fire-water>🌊 Testar água</button><button type="button" data-preview-clear>Limpar</button></div>'+
          '<div class="tq-ammo-preview__stats"><span>Dano <b data-preview-damage>'+Number(ammo.damage)+'</b></span><span>Velocidade <b data-preview-projectile-speed>'+Number(ammo.projectileSpeed)+'</b></span><span>Preset <b data-preview-preset>'+this.e(fx.preset)+'</b></span></div>'+
        '</section></aside>'+
      '</div>';

    const canvas=host.querySelector("[data-ammo-preview]");
    this.preview=new AmmoPreviewGL(canvas);
    const assetState=host.querySelector("[data-preview-asset-state]");
    const updateAssetState=state=>{
      if(!assetState)return;
      assetState.classList.toggle("is-ready",state?.ready===true);
      assetState.classList.toggle("is-error",state?.failed===true);
      assetState.textContent=!state?.src
        ?"Sem asset central"
        :state.ready
          ?"✓ Asset carregado"
          :state.failed
            ?"⚠ Falha ao carregar asset"
            :"Carregando asset…";
    };
    this.preview.setTextureStateListener(updateAssetState);
    this.preview.setAmmo(ammo);
    this.preview.mount();

    const setPath=(object,path,value)=>{
      const parts=path.split(".");
      let target=object;
      for(let i=0;i<parts.length-1;i++)target=target[parts[i]]??=( {});
      target[parts.at(-1)]=value;
    };

    const read=()=>{
      let value=structuredClone(ammo);
      value.name=host.querySelector("[data-a-name]").value;
      value.damage=Math.max(0,Number(host.querySelector("[data-a-damage]").value)||0);
      value.projectileSpeed=Math.max(80,Number(host.querySelector("[data-a-speed]").value)||80);
      value.size=Math.max(.2,Number(host.querySelector("[data-a-size]").value)||1);
      value.available=host.querySelector("[data-a-available]").checked;
      value.shop={purchasable:host.querySelector("[data-a-buy]").checked,price:Math.max(0,Number(host.querySelector("[data-a-price]").value)||0)};
      value.fx=structuredClone(fx);
      host.querySelectorAll("[data-fx]").forEach(input=>{
        let raw=input.type==="checkbox"?input.checked:input.value;
        if(input.type==="range"||input.type==="number")raw=Number(raw);
        setPath(value.fx,input.dataset.fx,raw);
      });
      return this.normalize(value);
    };

    const refreshPreview=()=>{
      const value=read();
      this.preview?.setAmmo(value);
      host.querySelector("[data-preview-damage]").textContent=String(value.damage);
      host.querySelector("[data-preview-projectile-speed]").textContent=String(value.projectileSpeed);
      host.querySelector("[data-preview-preset]").textContent=String(value.fx.preset||"custom");
      host.querySelectorAll("[data-fx-output]").forEach(output=>{
        const input=host.querySelector('[data-fx="'+output.dataset.fxOutput+'"]');
        if(input)output.textContent=this.format(input.value)+(input.dataset.unit||"");
      });
      host.querySelectorAll(".tq-ammo-fx-color input[type=color]").forEach(input=>{
        const code=input.parentElement?.querySelector("code");if(code)code.textContent=input.value;
      });
      return value;
    };

    const persist=()=>this.save(refreshPreview());

    host.querySelector("[data-ammo-asset]")?.addEventListener("click",()=>this.requestAsset?.({ammoId:ammo.id,currentAsset:fx.projectile.texture}));

    host.querySelector("[data-a-preset]").addEventListener("change",event=>{
      const current=read();
      this.save(applyAmmoFxPreset(current,event.currentTarget.value));
      this.renderEditor();
    });
    host.querySelectorAll("[data-fx], [data-a-damage], [data-a-speed], [data-a-size]").forEach(input=>input.addEventListener("input",refreshPreview));
    host.querySelectorAll("[data-fx], [data-a-name], [data-a-damage], [data-a-speed], [data-a-size], [data-a-price], [data-a-available], [data-a-buy]").forEach(input=>input.addEventListener("change",persist));

    host.querySelector("[data-preview-mode]").addEventListener("change",e=>this.preview?.setMode(e.currentTarget.value));
    host.querySelector("[data-preview-speed]").addEventListener("input",e=>this.preview?.setSpeed(e.currentTarget.value));
    host.querySelector("[data-preview-loop]").addEventListener("change",e=>this.preview?.setLoop(e.currentTarget.checked));
    host.querySelector("[data-fire-ship]").onclick=()=>this.preview?.fire("ship");
    host.querySelector("[data-fire-water]").onclick=()=>this.preview?.fire("water");
    host.querySelector("[data-preview-clear]").onclick=()=>this.preview?.clear();
    refreshPreview();
  }

  setProjectileAsset(asset){
    const current=this.current();
    if(!current)return false;
    const next=structuredClone(current);
    next.fx=normalizeAmmoFx(next);
    next.fx.projectile.texture=String(asset||"");
    this.save(next);
    this.renderEditor();
    return true;
  }

  resolve(id){return this.all().find(x=>x.id===String(id||""))||null}
  format(value){const n=Number(value);return Number.isFinite(n)?String(Math.round(n*100)/100):String(value??"")}
  e(v){return String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]))}
}
