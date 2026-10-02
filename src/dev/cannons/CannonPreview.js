const clamp=(value,min,max)=>Math.min(max,Math.max(min,Number(value)||0));

export class CannonPreview{
  constructor(){
    this.host=null;
    this.cannon=null;
    this.cannonId="";
    this.targetDistance=1800;
    this.auto=true;
    this.timer=0;
    this.effectTimers=new Set();
    this.maxDistance=6000;
    this.dragging=false;
  }

  ensureStyles(){
    if(document.querySelector("[data-tq-cannon-preview-styles]"))return;
    const style=document.createElement("style");
    style.dataset.tqCannonPreviewStyles="";
    style.textContent=[
      ".tq-cannon-sim{margin-top:14px;border:1px solid #284d62;border-radius:14px;background:linear-gradient(180deg,#071a28 0%,#061520 100%);overflow:hidden;box-shadow:0 12px 30px #0006}",
      ".tq-cannon-sim__head{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:12px 14px;border-bottom:1px solid #244454;background:#0a2232}",
      ".tq-cannon-sim__head>div:first-child{display:grid;gap:3px}.tq-cannon-sim__head strong{font-size:14px}.tq-cannon-sim__head small{font-size:11px;color:#9fb5c2}",
      ".tq-cannon-sim__actions{display:flex;align-items:center;gap:8px;flex-wrap:wrap}.tq-cannon-sim__actions button{border:1px solid #39738f;border-radius:9px;background:#103447;color:#eefaff;padding:8px 12px;font-weight:800;cursor:pointer}.tq-cannon-sim__actions button:hover{background:#17465c}",
      ".tq-cannon-sim__auto{display:flex;align-items:center;gap:6px;font-size:11px;color:#c9dce5;background:#0a1b27;border:1px solid #294757;border-radius:9px;padding:7px 9px}.tq-cannon-sim__auto input{accent-color:#27a7ef}",
      ".tq-cannon-sim__stats{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:1px;background:#203b49;border-bottom:1px solid #244454}",
      ".tq-cannon-sim__stat{background:#091b27;padding:8px 10px;min-width:0}.tq-cannon-sim__stat span{display:block;color:#819aaa;font-size:9px;text-transform:uppercase;letter-spacing:.04em}.tq-cannon-sim__stat b{display:block;margin-top:2px;color:#eaf7ff;font-size:12px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}",
      ".tq-cannon-sim__stat.is-ok b{color:#79e3a1}.tq-cannon-sim__stat.is-out b{color:#ffae78}",
      ".tq-cannon-sim__stage{--start:18%;--end:90%;position:relative;height:330px;overflow:hidden;touch-action:none;user-select:none;background:radial-gradient(ellipse at 50% 115%,#1f7396 0%,#0f4d6b 42%,#082f46 72%,#061e2e 100%)}",
      ".tq-cannon-sim__stage:before{content:\"\";position:absolute;inset:0;opacity:.32;background:repeating-linear-gradient(0deg,transparent 0 23px,#69c4e21a 24px 25px),repeating-linear-gradient(90deg,transparent 0 79px,#69c4e214 80px 81px);pointer-events:none}",
      ".tq-cannon-sim__horizon{position:absolute;left:0;right:0;bottom:44px;height:56px;background:linear-gradient(180deg,#a7eaff0d,#8be0ff1e 45%,#b9efff0a);border-top:1px solid #89dfff3d;transform:skewY(-1deg);pointer-events:none}",
      ".tq-cannon-sim__range{position:absolute;left:18%;bottom:42px;height:5px;border-radius:8px;background:linear-gradient(90deg,#55d79b,#67caff);box-shadow:0 0 14px #4ec9d488;pointer-events:none}.tq-cannon-sim__range:after{content:\"\";position:absolute;right:-1px;bottom:-7px;width:2px;height:74px;background:#7ee9ff88;box-shadow:0 0 12px #79eaff}",
      ".tq-cannon-sim__range-label{position:absolute;right:0;bottom:67px;transform:translateX(50%);padding:3px 6px;border-radius:6px;background:#071722d9;color:#9ceeff;font-size:9px;white-space:nowrap;border:1px solid #346275}",
      ".tq-cannon-sim__ship,.tq-cannon-sim__target{position:absolute;bottom:48px;z-index:4}.tq-cannon-sim__ship{left:4%;width:150px;height:150px}.tq-cannon-sim__target{width:145px;height:145px;transform:translateX(-50%);cursor:ew-resize;outline:none}",
      ".tq-cannon-sim__player-sprite{position:absolute;inset:0;background-image:url('./assets/ships/pirate_ship_16dir_1600x1600_4x4.webp');background-repeat:no-repeat;background-size:400% 400%;background-position:0 33.333%;filter:drop-shadow(0 12px 8px #00131faa)}",
      ".tq-cannon-sim__target img{position:absolute;inset:0;width:100%;height:100%;object-fit:contain;filter:drop-shadow(0 12px 8px #00131faa)}",
      ".tq-cannon-sim__actor-tag{position:absolute;left:50%;bottom:-21px;transform:translateX(-50%);border:1px solid #315469;border-radius:6px;background:#061621e8;color:#d5eaf5;padding:3px 7px;font-size:9px;font-weight:900;white-space:nowrap}",
      ".tq-cannon-sim__target.is-in .tq-cannon-sim__actor-tag{border-color:#358561;color:#8bf0af}.tq-cannon-sim__target.is-out .tq-cannon-sim__actor-tag{border-color:#a2633c;color:#ffc18e}",
      ".tq-cannon-sim__muzzle{position:absolute;right:17px;top:72px;width:8px;height:8px;border-radius:50%;background:#fff;box-shadow:0 0 8px 4px #ffd96a;opacity:.45}",
      ".tq-cannon-sim__cannon{position:absolute;right:22px;top:52px;width:42px;height:42px;object-fit:contain;filter:drop-shadow(0 4px 4px #0009);z-index:3;pointer-events:none}",
      ".tq-cannon-sim__projectile{position:absolute;width:13px;height:13px;border-radius:50%;z-index:7;background:radial-gradient(circle at 35% 30%,#fff2a5 0 15%,#ff9e3c 30%,#202b34 58%,#05090c 100%);box-shadow:0 0 9px 3px #ff9a3caa;pointer-events:none;will-change:transform}",
      ".tq-cannon-sim__projectile:after{content:\"\";position:absolute;right:8px;top:4px;width:30px;height:5px;border-radius:50%;background:linear-gradient(90deg,transparent,#ffb45888);filter:blur(1px)}",
      ".tq-cannon-sim__impact{position:absolute;width:12px;height:12px;border-radius:50%;z-index:8;pointer-events:none;transform:translate(-50%,-50%);animation:tq-cannon-impact .55s ease-out forwards}.tq-cannon-sim__impact.is-hit{background:#fff1a2;box-shadow:0 0 10px 5px #ff943d,0 0 28px 12px #ff5a2a88}.tq-cannon-sim__impact.is-water{background:#bcefff;box-shadow:0 -8px 0 1px #8edfff88,0 0 14px 7px #70d7ff99}",
      ".tq-cannon-sim__ship.is-recoil{animation:tq-cannon-recoil .16s ease-out}.tq-cannon-sim__target.is-hit{animation:tq-cannon-target-hit .22s ease-out}",
      ".tq-cannon-sim__result{position:absolute;left:50%;top:15px;transform:translateX(-50%);z-index:10;max-width:80%;padding:6px 10px;border:1px solid #31556a;border-radius:8px;background:#061722dd;color:#d7edf8;font-size:10px;font-weight:800;text-align:center;pointer-events:none}",
      ".tq-cannon-sim__scale{position:absolute;left:18%;right:10%;bottom:10px;height:20px;border-top:1px solid #8dc6dc55;color:#88aebe;font-size:8px;pointer-events:none}.tq-cannon-sim__scale span{position:absolute;top:4px;transform:translateX(-50%)}",
      "@keyframes tq-cannon-impact{0%{opacity:1;transform:translate(-50%,-50%) scale(.5)}100%{opacity:0;transform:translate(-50%,-50%) scale(4.4)}}",
      "@keyframes tq-cannon-recoil{50%{transform:translateX(-7px) rotate(-1deg)}}@keyframes tq-cannon-target-hit{50%{filter:brightness(1.8);transform:translateX(-50%) translateX(4px)}}",
      "@media(max-width:900px){.tq-cannon-sim__stats{grid-template-columns:repeat(2,minmax(0,1fr))}.tq-cannon-sim__stage{height:285px}.tq-cannon-sim__ship{width:120px;height:120px}.tq-cannon-sim__target{width:118px;height:118px}.tq-cannon-sim__head{align-items:flex-start;flex-direction:column}}"
    ].join("");
    document.head.append(style);
  }

  mount(host,cannon){
    this.stop();
    this.host=host||null;
    this.cannon=cannon||null;
    if(!this.host||!this.cannon)return;
    this.ensureStyles();

    if(this.cannonId!==String(this.cannon.id||"")){
      this.cannonId=String(this.cannon.id||"");
      this.targetDistance=clamp(Math.round((Number(this.cannon.range)||900)*0.72),650,5200);
      this.auto=true;
    }

    this.host.innerHTML=[
      '<section class="tq-cannon-sim">',
      '<div class="tq-cannon-sim__head"><div><strong>Simulação de alcance e disparo</strong><small>Arraste o NPC para testar alcance, velocidade e cadência sem configurar às cegas.</small></div>',
      '<div class="tq-cannon-sim__actions"><label class="tq-cannon-sim__auto"><input type="checkbox" data-csim-auto> Disparo automático</label><button type="button" data-csim-fire>💥 Testar disparo</button></div></div>',
      '<div class="tq-cannon-sim__stats">',
      '<div class="tq-cannon-sim__stat"><span>Alcance</span><b data-csim-range-stat></b></div>',
      '<div class="tq-cannon-sim__stat"><span>Distância do alvo</span><b data-csim-distance></b></div>',
      '<div class="tq-cannon-sim__stat"><span>Projétil</span><b data-csim-speed></b></div>',
      '<div class="tq-cannon-sim__stat"><span>Tempo estimado</span><b data-csim-time></b></div>',
      '<div class="tq-cannon-sim__stat" data-csim-status-box><span>Status</span><b data-csim-status></b></div>',
      '</div>',
      '<div class="tq-cannon-sim__stage" data-csim-stage>',
      '<div class="tq-cannon-sim__horizon"></div>',
      '<div class="tq-cannon-sim__range" data-csim-range><span class="tq-cannon-sim__range-label" data-csim-range-label></span></div>',
      '<div class="tq-cannon-sim__result" data-csim-result>Preview pronto.</div>',
      '<div class="tq-cannon-sim__ship" data-csim-ship><div class="tq-cannon-sim__player-sprite"></div><img class="tq-cannon-sim__cannon" data-csim-cannon alt="" hidden><i class="tq-cannon-sim__muzzle" data-csim-muzzle></i><span class="tq-cannon-sim__actor-tag">NAVIO</span></div>',
      '<div class="tq-cannon-sim__target" data-csim-target role="slider" tabindex="0" aria-label="Distância do NPC" aria-valuemin="300" aria-valuemax="6000"><img src="./assets/ships/el-colombo.webp" alt=""><span class="tq-cannon-sim__actor-tag">NPC · ARRASTE</span></div>',
      '<div class="tq-cannon-sim__scale"><span style="left:0%">0</span><span style="left:25%">1500</span><span style="left:50%">3000</span><span style="left:75%">4500</span><span style="left:100%">6000 px</span></div>',
      '</div></section>'
    ].join("");

    const auto=this.host.querySelector("[data-csim-auto]");
    auto.checked=this.auto;
    auto.addEventListener("change",()=>{this.auto=auto.checked;this.restartAuto(true)});
    this.host.querySelector("[data-csim-fire]").addEventListener("click",()=>this.fire());

    const target=this.host.querySelector("[data-csim-target]");
    target.addEventListener("pointerdown",event=>{
      this.dragging=true;
      target.setPointerCapture?.(event.pointerId);
      this.setDistanceFromPointer(event.clientX);
    });
    target.addEventListener("pointermove",event=>{if(this.dragging)this.setDistanceFromPointer(event.clientX)});
    const endDrag=event=>{
      if(!this.dragging)return;
      this.dragging=false;
      try{target.releasePointerCapture?.(event.pointerId)}catch{}
    };
    target.addEventListener("pointerup",endDrag);
    target.addEventListener("pointercancel",endDrag);
    target.addEventListener("keydown",event=>{
      if(!["ArrowLeft","ArrowRight","Home","End"].includes(event.key))return;
      event.preventDefault();
      if(event.key==="Home")this.targetDistance=300;
      else if(event.key==="End")this.targetDistance=this.maxDistance;
      else{
        const direction=event.key==="ArrowRight"?1:-1;
        this.targetDistance=clamp(this.targetDistance+direction*(event.shiftKey?500:100),300,this.maxDistance);
      }
      this.refresh();
    });

    this.refresh();
    this.restartAuto(true);
  }

  update(cannon){
    if(cannon)this.cannon=cannon;
    if(!this.host||!this.cannon)return;
    const cannonImage=this.host.querySelector("[data-csim-cannon]");
    if(cannonImage){
      const src=String(this.cannon.asset||"");
      if(src){cannonImage.src=src;cannonImage.hidden=false}
      else{cannonImage.removeAttribute("src");cannonImage.hidden=true}
    }
    this.refresh();
    this.restartAuto(false);
  }

  setDistanceFromPointer(clientX){
    const stage=this.host?.querySelector("[data-csim-stage]");
    if(!stage)return;
    const rect=stage.getBoundingClientRect();
    if(!rect.width)return;
    const start=rect.width*0.18;
    const end=rect.width*0.90;
    const normalized=clamp((clientX-rect.left-start)/(end-start),0,1);
    this.targetDistance=Math.round((300+normalized*(this.maxDistance-300))/25)*25;
    this.refresh();
  }

  refresh(){
    if(!this.host||!this.cannon)return;
    const c=this.cannon;
    const range=clamp(c.range,100,this.maxDistance);
    const speed=Math.max(100,Number(c.projectileSpeed)||620);
    const rate=1000/Math.max(100,Number(c.attackCooldownMs)||1200);
    const inRange=this.targetDistance<=range;
    const travel=Math.min(this.targetDistance,range);
    const seconds=travel/speed;

    const targetPct=18+(clamp(this.targetDistance/this.maxDistance,0,1)*72);
    const rangePct=clamp(range/this.maxDistance,0,1)*72;
    const target=this.host.querySelector("[data-csim-target]");
    const rangeBar=this.host.querySelector("[data-csim-range]");
    target.style.left=targetPct+"%";
    target.classList.toggle("is-in",inRange);
    target.classList.toggle("is-out",!inRange);
    target.setAttribute("aria-valuenow",String(this.targetDistance));
    rangeBar.style.width=rangePct+"%";

    this.host.querySelector("[data-csim-range-stat]").textContent=Math.round(range)+" px";
    this.host.querySelector("[data-csim-distance]").textContent=Math.round(this.targetDistance)+" px";
    this.host.querySelector("[data-csim-speed]").textContent=Math.round(speed)+" px/s · "+rate.toFixed(2)+" tiro/s";
    this.host.querySelector("[data-csim-time]").textContent=seconds.toFixed(2)+" s";
    this.host.querySelector("[data-csim-range-label]").textContent="limite "+Math.round(range)+" px";
    this.host.querySelector("[data-csim-status]").textContent=inRange?"DENTRO DO ALCANCE":"FORA DO ALCANCE";
    const statusBox=this.host.querySelector("[data-csim-status-box]");
    statusBox.classList.toggle("is-ok",inRange);
    statusBox.classList.toggle("is-out",!inRange);
  }

  restartAuto(immediate=false){
    clearTimeout(this.timer);
    this.timer=0;
    if(!this.auto||!this.host||!this.cannon)return;
    const tick=()=>{
      if(!this.auto||!this.host||!this.cannon||!document.body.contains(this.host))return;
      this.fire();
      this.timer=setTimeout(tick,Math.max(100,Number(this.cannon.attackCooldownMs)||1200));
    };
    this.timer=setTimeout(tick,immediate?320:Math.max(100,Number(this.cannon.attackCooldownMs)||1200));
  }

  fire(){
    const stage=this.host?.querySelector("[data-csim-stage]");
    const muzzle=this.host?.querySelector("[data-csim-muzzle]");
    const target=this.host?.querySelector("[data-csim-target]");
    const ship=this.host?.querySelector("[data-csim-ship]");
    if(!stage||!muzzle||!target||!this.cannon)return;

    const stageRect=stage.getBoundingClientRect();
    const muzzleRect=muzzle.getBoundingClientRect();
    const targetRect=target.getBoundingClientRect();
    if(!stageRect.width)return;

    const range=Math.max(100,Number(this.cannon.range)||900);
    const speed=Math.max(100,Number(this.cannon.projectileSpeed)||620);
    const inRange=this.targetDistance<=range;
    const travelDistance=Math.min(this.targetDistance,range);
    const fraction=inRange?1:clamp(range/Math.max(1,this.targetDistance),0,1);

    const startX=muzzleRect.left-stageRect.left+muzzleRect.width/2;
    const startY=muzzleRect.top-stageRect.top+muzzleRect.height/2;
    const targetX=targetRect.left-stageRect.left+targetRect.width/2;
    const targetY=targetRect.top-stageRect.top+targetRect.height*.55;
    const impactX=startX+(targetX-startX)*fraction;
    const impactY=startY+(targetY-startY)*fraction;
    const dx=impactX-startX;
    const dy=impactY-startY;

    const active=stage.querySelectorAll(".tq-cannon-sim__projectile");
    if(active.length>24)active[0]?.remove();

    const projectile=document.createElement("i");
    projectile.className="tq-cannon-sim__projectile";
    projectile.style.left=(startX-6)+"px";
    projectile.style.top=(startY-6)+"px";
    stage.append(projectile);

    const rawDuration=(travelDistance/speed)*1000;
    const duration=clamp(rawDuration,160,7000);
    const animation=projectile.animate([
      {transform:"translate(0,0) scale(.82)",offset:0},
      {transform:"translate("+(dx*.5)+"px,"+((dy*.5)-Math.min(34,Math.abs(dx)*.06))+"px) scale(1.05)",offset:.5},
      {transform:"translate("+dx+"px,"+dy+"px) scale(.92)",offset:1}
    ],{duration,easing:"linear",fill:"forwards"});

    ship.classList.remove("is-recoil");
    void ship.offsetWidth;
    ship.classList.add("is-recoil");

    const result=this.host.querySelector("[data-csim-result]");
    if(result){
      const trueSeconds=rawDuration/1000;
      result.textContent=inRange
        ?"Disparo em curso · impacto estimado em "+trueSeconds.toFixed(2)+" s"
        :"Fora do alcance · projétil cai após "+trueSeconds.toFixed(2)+" s";
    }

    animation.finished.then(()=>{
      projectile.remove();
      if(!stage.isConnected)return;
      const impact=document.createElement("i");
      impact.className="tq-cannon-sim__impact "+(inRange?"is-hit":"is-water");
      impact.style.left=impactX+"px";
      impact.style.top=impactY+"px";
      stage.append(impact);
      const cleanup=setTimeout(()=>{impact.remove();this.effectTimers.delete(cleanup)},620);
      this.effectTimers.add(cleanup);

      if(inRange){
        target.classList.remove("is-hit");
        void target.offsetWidth;
        target.classList.add("is-hit");
        const hitTimer=setTimeout(()=>{target.classList.remove("is-hit");this.effectTimers.delete(hitTimer)},260);
        this.effectTimers.add(hitTimer);
      }
      if(result)result.textContent=inRange?"ACERTO · alvo dentro do alcance":"QUEDA NA ÁGUA · alvo fora do alcance";
    }).catch(()=>projectile.remove());
  }

  stop(){
    clearTimeout(this.timer);
    this.timer=0;
    for(const timer of this.effectTimers)clearTimeout(timer);
    this.effectTimers.clear();
    if(this.host)this.host.querySelectorAll(".tq-cannon-sim__projectile,.tq-cannon-sim__impact").forEach(node=>node.remove());
    this.dragging=false;
  }
}
