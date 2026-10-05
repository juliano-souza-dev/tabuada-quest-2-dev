import { normalizeAmmoFx } from "./fx/AmmoFxProfile.mjs?v=20261002-2118";

const PIXI_MODULE_URL="https://cdn.jsdelivr.net/npm/pixi.js@8.21.0/dist/pixi.min.mjs";
const clamp=(value,min,max)=>Math.min(max,Math.max(min,Number(value)||0));
const lerp=(a,b,t)=>a+(b-a)*t;
const hexNumber=(value,fallback=0xffffff)=>{
  const raw=String(value||"").replace("#","");
  return /^[0-9a-f]{6}$/i.test(raw)?parseInt(raw,16):fallback;
};
const pointOnPath=(start,end,t,lift=0)=>({
  x:lerp(start.x,end.x,t),
  y:lerp(start.y,end.y,t)-Math.sin(Math.PI*t)*lift
});

export class PixiWorldRenderer{
  constructor(viewport){
    this.viewport=viewport||null;
    this.app=null;
    this.world=null;
    this.PIXI=null;
    this.ready=false;
    this.failed=false;
    this.entitySprites=new Map();
    this.loading=new Map();
    this.projectileFx=new Set();
    this.transientFx=new Set();
    this.maxTransientFx=72;
  }

  async init(){
    if(this.ready||this.failed||!this.viewport)return this.ready;
    try{
      const PIXI=await import(PIXI_MODULE_URL);
      const app=new PIXI.Application();
      const rect=this.viewport.getBoundingClientRect();
      await app.init({
        width:Math.max(1,Math.round(rect.width||1)),
        height:Math.max(1,Math.round(rect.height||1)),
        backgroundAlpha:0,
        antialias:true,
        autoDensity:true,
        resolution:Math.min(2,Math.max(1,Number(globalThis.devicePixelRatio)||1)),
        preference:"webgl"
      });
      app.canvas.className="tq-world-pixi";
      app.canvas.setAttribute("aria-hidden","true");
      Object.assign(app.canvas.style,{
        position:"absolute",
        inset:"0",
        width:"100%",
        height:"100%",
        display:"block",
        pointerEvents:"none",
        zIndex:"2"
      });
      const world=new PIXI.Container();
      world.sortableChildren=true;
      app.stage.addChild(world);
      this.viewport.append(app.canvas);
      this.PIXI=PIXI;
      this.app=app;
      this.world=world;
      this.ready=true;
      return true;
    }catch(error){
      this.failed=true;
      console.warn("[TQ Pixi] renderer unavailable; keeping DOM renderer",error);
      return false;
    }
  }

  supportsEntity(entity){
    if(!entity||!entity.src)return false;
    if(String(entity.type||"")!=="treasure")return false;
    if(entity.sprite?.regions||entity.directions)return false;
    return true;
  }

  async ensureEntity(entity){
    if(!this.ready||!this.supportsEntity(entity))return false;
    const id=String(entity.id||"");
    if(!id)return false;
    if(this.entitySprites.has(id))return true;
    if(this.loading.has(id))return this.loading.get(id);

    const task=(async()=>{
      try{
        const texture=await this.PIXI.Assets.load(String(entity.src));
        if(!this.ready||!this.world)return false;
        const sprite=new this.PIXI.Sprite(texture);
        sprite.anchor.set(.5);
        sprite.eventMode="none";
        this.world.addChild(sprite);
        this.entitySprites.set(id,sprite);
        this.syncEntity(entity);
        return true;
      }catch(error){
        console.warn("[TQ Pixi] asset load failed",entity.src,error);
        return false;
      }finally{
        this.loading.delete(id);
      }
    })();
    this.loading.set(id,task);
    return task;
  }

  syncEntity(entity){
    if(!this.ready||!this.supportsEntity(entity))return false;
    const id=String(entity.id||"");
    const sprite=this.entitySprites.get(id);
    if(!sprite){
      this.ensureEntity(entity);
      return false;
    }
    sprite.x=Number(entity.visualX??entity.x)||0;
    sprite.y=Number(entity.visualY??entity.y)||0;
    sprite.width=Math.max(1,Number(entity.width)||88);
    sprite.height=Math.max(1,Number(entity.height)||88);
    sprite.rotation=(Number(entity.visualRotation??entity.rotation)||0)*Math.PI/180;
    sprite.visible=entity.treasurePending!==true&&entity.el?.hidden!==true;
    sprite.zIndex=Number(entity.z)||18;
    return true;
  }

  removeEntity(id){
    const key=String(id||"");
    const sprite=this.entitySprites.get(key);
    if(sprite){
      sprite.removeFromParent();
      sprite.destroy();
      this.entitySprites.delete(key);
    }
    this.loading.delete(key);
  }

  syncEntities(entities=[]){
    if(!this.ready)return false;
    const seen=new Set();
    for(const entity of entities){
      if(!this.supportsEntity(entity))continue;
      const id=String(entity.id||"");
      if(!id)continue;
      seen.add(id);
      this.syncEntity(entity);
    }
    for(const id of [...this.entitySprites.keys()])if(!seen.has(id))this.removeEntity(id);
    return true;
  }

  _destroyDisplay(display){
    if(!display)return;
    try{display.removeFromParent?.()}catch{}
    try{display.destroy?.({children:true})}catch{
      try{display.destroy?.()}catch{}
    }
  }

  _cleanupTransient(entry){
    if(!entry)return;
    try{this.app?.ticker?.remove(entry.tick)}catch{}
    this.transientFx.delete(entry);
    this._destroyDisplay(entry.container);
  }

  _animateTransient(container,duration,update){
    if(!this.ready||!this.app||!container)return false;
    while(this.transientFx.size>=this.maxTransientFx){
      const oldest=this.transientFx.values().next().value;
      if(!oldest)break;
      this._cleanupTransient(oldest);
    }
    const life=Math.max(60,Number(duration)||300);
    const started=performance.now();
    const entry={container,tick:null};
    const tick=()=>{
      if(!container.parent){this._cleanupTransient(entry);return;}
      const progress=clamp((performance.now()-started)/life,0,1);
      try{update?.(progress,performance.now()-started)}catch(error){
        console.warn("[TQ Pixi] transient FX update failed",error);
      }
      if(progress>=1)this._cleanupTransient(entry);
    };
    entry.tick=tick;
    this.transientFx.add(entry);
    this.app.ticker.add(tick);
    return true;
  }

  playMuzzleFx({at,ammo=null,size=1}={}){
    if(!this.ready||!this.world||!this.PIXI)return false;
    const fx=normalizeAmmoFx(ammo||{});
    const style=fx.muzzle;
    if(style.enabled===false)return false;
    const root=new this.PIXI.Container();
    root.position.set(Number(at?.x)||0,Number(at?.y)||0);
    root.zIndex=92;
    root.eventMode="none";

    const scaleBase=clamp(Number(size)||1,.6,2.2);
    const radius=Math.max(10,style.size*.28*scaleBase);
    const flash=new this.PIXI.Graphics();
    flash.circle(0,0,radius*1.45).fill({color:hexNumber(style.color,0xff8a24),alpha:.22});
    flash.circle(0,0,radius*.86).fill({color:hexNumber(style.coreColor,0xfff0a8),alpha:.9});
    flash.circle(0,0,radius*.34).fill({color:0xffffff,alpha:1});
    root.addChild(flash);

    const ring=new this.PIXI.Graphics();
    ring.circle(0,0,radius*.72).stroke({width:Math.max(2,radius*.10),color:hexNumber(style.accentColor,0x69e7ff),alpha:.9});
    root.addChild(ring);

    const smoke=[];
    const smokeCount=Math.min(4,Math.max(1,Math.round(style.smoke*4)));
    for(let i=0;i<smokeCount;i++){
      const puff=new this.PIXI.Graphics();
      const a=(Math.PI*2*i)/smokeCount+.45;
      puff.circle(0,0,radius*(.24+i*.035)).fill({color:0x2a2a2a,alpha:.38});
      puff._vx=Math.cos(a)*(8+i*2);
      puff._vy=Math.sin(a)*(8+i*2)-4;
      root.addChild(puff);
      smoke.push(puff);
    }

    this.world.addChild(root);
    return this._animateTransient(root,Math.max(90,style.durationMs),(p)=>{
      const fade=1-p;
      flash.scale.set(.72+p*1.65);
      flash.alpha=fade*fade;
      ring.scale.set(.72+p*2.25);
      ring.alpha=fade*.85;
      for(const puff of smoke){
        puff.x=puff._vx*p;
        puff.y=puff._vy*p;
        puff.scale.set(.8+p*1.55);
        puff.alpha=fade*.38;
      }
    });
  }

  fireCannonProjectile({from,to,duration=600,size=7,ammo=null}={}){
    if(!this.ready||!this.world||!this.PIXI)return false;
    const start={x:Number(from?.x)||0,y:Number(from?.y)||0};
    const end={x:Number(to?.x)||0,y:Number(to?.y)||0};
    const life=Math.max(80,Number(duration)||600);
    const fx=normalizeAmmoFx(ammo||{});
    const projectileStyle=fx.projectile;
    const trailStyle=fx.trail;
    const radius=Math.max(4,(Number(size)||7)*clamp(projectileStyle.scale,.55,2.2));
    const distance=Math.hypot(end.x-start.x,end.y-start.y);
    const lift=Math.min(30,Math.max(7,distance*.028));
    const solidBall=["standard","rusted-iron","piercing"].includes(String(fx.preset||""));
    const primary=hexNumber(projectileStyle.color,0xff6b1a);
    const core=hexNumber(projectileStyle.coreColor,0xfff0b0);
    const accent=hexNumber(projectileStyle.accentColor,0x69e7ff);

    const root=new this.PIXI.Container();
    root.position.set(start.x,start.y);
    root.zIndex=90;
    root.eventMode="none";

    const aura=new this.PIXI.Graphics();
    if(projectileStyle.auraEnabled!==false){
      aura.circle(0,0,radius*2.2).fill({color:primary,alpha:solidBall?.10:.23});
      aura.circle(0,0,radius*1.45).stroke({width:Math.max(1.5,radius*.22),color:accent,alpha:solidBall?.18:.48});
      root.addChild(aura);
    }

    const ghostCount=trailStyle.enabled===false?0:(solidBall?3:4);
    const ghosts=[];
    for(let i=ghostCount;i>=1;i--){
      const ghost=new this.PIXI.Graphics();
      const ghostRadius=radius*(1-i*.09);
      const ghostColor=solidBall?(i===ghostCount?0x4a4a4a:0x232323):(i%2?primary:accent);
      ghost.circle(0,0,Math.max(2,ghostRadius)).fill({color:ghostColor,alpha:solidBall?.34:.28});
      ghost.zIndex=-i;
      root.addChild(ghost);
      ghosts.push({display:ghost,lag:i*(solidBall?.045:.035),index:i});
    }

    const ball=new this.PIXI.Graphics();
    if(solidBall){
      ball.circle(0,0,radius*1.08).fill({color:0x090909,alpha:1});
      ball.circle(-radius*.25,-radius*.28,radius*.38).fill({color:0x777777,alpha:.72});
      ball.circle(radius*.10,radius*.10,radius*.82).stroke({width:Math.max(1,radius*.12),color:primary,alpha:.42});
    }else{
      ball.circle(0,0,radius*1.22).fill({color:primary,alpha:.88});
      ball.circle(0,0,radius*.68).fill({color:core,alpha:.92});
      ball.circle(-radius*.20,-radius*.24,radius*.25).fill({color:0xffffff,alpha:.95});
      ball.circle(0,0,radius*1.08).stroke({width:Math.max(1.4,radius*.16),color:accent,alpha:.78});
    }
    root.addChild(ball);

    this.world.addChild(root);
    this.playMuzzleFx({at:start,ammo,size:radius/7});

    const started=performance.now();
    const entry={container:root,tick:null};
    const tick=()=>{
      if(!root.parent){
        try{this.app?.ticker?.remove(tick)}catch{}
        this.projectileFx.delete(entry);
        return;
      }
      const raw=clamp((performance.now()-started)/life,0,1);
      const t=1-Math.pow(1-raw,2);
      const point=pointOnPath(start,end,t,lift);
      root.position.set(point.x,point.y);

      const heightPulse=.92+Math.sin(Math.PI*raw)*.34;
      ball.scale.set(heightPulse);
      if(aura.parent){
        const pulse=1+Math.sin((performance.now()-started)*.018*projectileStyle.pulseSpeed)*.08;
        aura.scale.set(heightPulse*pulse);
        aura.alpha=raw>.82?Math.max(0,(1-raw)/.18):1;
      }

      for(const ghost of ghosts){
        const gt=clamp(t-ghost.lag,0,1);
        const gp=pointOnPath(start,end,gt,lift);
        ghost.display.position.set(gp.x-point.x,gp.y-point.y);
        ghost.display.alpha=clamp((1-raw)*.75+.15,0,.72)*(1-ghost.index/(ghostCount+2));
        ghost.display.scale.set(.78+heightPulse*.18);
      }

      root.alpha=raw>.88?Math.max(0,(1-raw)/.12):1;
      if(raw>=1){
        try{this.app?.ticker?.remove(tick)}catch{}
        this.projectileFx.delete(entry);
        this._destroyDisplay(root);
      }
    };
    entry.tick=tick;
    this.projectileFx.add(entry);
    this.app.ticker.add(tick);
    return true;
  }

  playImpactFx({at,ammo=null,kind="ship",size=1}={}){
    if(!this.ready||!this.world||!this.PIXI)return false;
    const fx=normalizeAmmoFx(ammo||{});
    const water=String(kind||"")==="water";
    const style=water?fx.impactWater:fx.impactShip;
    if(style.enabled===false)return false;

    const root=new this.PIXI.Container();
    root.position.set(Number(at?.x)||0,Number(at?.y)||0);
    root.zIndex=96;
    root.eventMode="none";
    const scaleBase=clamp(Number(size)||1,.55,2.2);
    const radius=Math.max(20,style.size*.38*scaleBase);
    const primary=hexNumber(style.color,water?0x8feaff:0xff5a12);
    const core=hexNumber(style.coreColor,0xffffff);
    const accent=hexNumber(style.accentColor,water?0xffd86a:0x69e7ff);

    const flash=new this.PIXI.Graphics();
    flash.circle(0,0,radius*1.18).fill({color:accent,alpha:water?.16:.20});
    flash.circle(0,0,radius*.78).fill({color:primary,alpha:water?.36:.56});
    flash.circle(0,0,radius*.43).fill({color:core,alpha:.92});
    flash.circle(0,0,radius*.18).fill({color:0xffffff,alpha:1});
    root.addChild(flash);

    const shock=new this.PIXI.Graphics();
    shock.circle(0,0,radius*.58).stroke({width:Math.max(3,radius*.075),color:accent,alpha:.9});
    root.addChild(shock);

    const halo=new this.PIXI.Graphics();
    halo.circle(0,0,radius*.86).stroke({width:Math.max(2,radius*.05),color:primary,alpha:.72});
    root.addChild(halo);

    const targetDots=[];
    if(!water){
      const dotCount=20;
      for(let i=0;i<dotCount;i++){
        const dot=new this.PIXI.Graphics();
        dot.circle(0,0,Math.max(2.2,radius*.045)).fill({color:0xffdf16,alpha:.96});
        const a=(Math.PI*2*i)/dotCount;
        dot._a=a;
        root.addChild(dot);
        targetDots.push(dot);
      }
    }

    const sparks=[];
    const sparkCount=water?8:Math.min(14,Math.max(8,Math.round((style.sparks||12)*.42)));
    for(let i=0;i<sparkCount;i++){
      const spark=new this.PIXI.Graphics();
      const a=(Math.PI*2*i)/sparkCount+(i%2)*.13;
      const sr=Math.max(1.5,radius*(i%3===0?.035:.022));
      spark.circle(0,0,sr).fill({color:i%3===0?core:(i%2?accent:primary),alpha:.95});
      spark._a=a;
      spark._speed=radius*(.78+(i%5)*.13);
      root.addChild(spark);
      sparks.push(spark);
    }

    const smoke=[];
    if(!water){
      const smokeCount=Math.min(7,Math.max(3,Math.round((style.smoke||.5)*7)));
      for(let i=0;i<smokeCount;i++){
        const puff=new this.PIXI.Graphics();
        const a=(Math.PI*2*i)/smokeCount+.28;
        puff.circle(0,0,radius*(.15+(i%3)*.035)).fill({color:i%2?0x262626:0x393939,alpha:.42});
        puff._a=a;
        puff._distance=radius*(.22+(i%4)*.08);
        root.addChild(puff);
        smoke.push(puff);
      }
    }

    const splash=[];
    if(water){
      for(let i=0;i<10;i++){
        const drop=new this.PIXI.Graphics();
        const a=(Math.PI*2*i)/10;
        drop.circle(0,0,Math.max(2,radius*.03)).fill({color:i%2?0xffffff:primary,alpha:.88});
        drop._a=a;
        drop._distance=radius*(.55+(i%3)*.18);
        root.addChild(drop);
        splash.push(drop);
      }
    }

    this.world.addChild(root);
    const duration=Math.max(240,Number(style.durationMs)||700);
    return this._animateTransient(root,duration,(p)=>{
      const fade=1-p;
      const blast=Math.sin(Math.min(1,p*2.3)*Math.PI*.5);
      flash.scale.set(.42+blast*1.48+p*.45);
      flash.alpha=clamp((1-p*1.05)*(water?.82:1),0,1);
      shock.scale.set(.58+p*2.75);
      shock.alpha=fade*.82;
      halo.scale.set(.72+p*1.75);
      halo.alpha=fade*.55;

      const ringRadius=radius*(1.15+p*.48);
      for(const dot of targetDots){
        dot.x=Math.cos(dot._a)*ringRadius;
        dot.y=Math.sin(dot._a)*ringRadius*.72;
        dot.alpha=clamp((1-p*1.3)*.95,0,.95);
        dot.scale.set(.8+p*.35);
      }

      for(const spark of sparks){
        const travel=spark._speed*(p*.92+p*p*.18);
        spark.x=Math.cos(spark._a)*travel;
        spark.y=Math.sin(spark._a)*travel+p*p*radius*.18;
        spark.alpha=fade;
        spark.scale.set(.95-p*.48);
      }

      for(const puff of smoke){
        const travel=puff._distance*(.45+p);
        puff.x=Math.cos(puff._a)*travel;
        puff.y=Math.sin(puff._a)*travel-radius*p*.72;
        puff.scale.set(.72+p*2.5);
        puff.alpha=fade*.42;
      }

      for(const drop of splash){
        const travel=drop._distance*(p+.12*Math.sin(Math.PI*p));
        drop.x=Math.cos(drop._a)*travel;
        drop.y=Math.sin(drop._a)*travel*.52-radius*Math.sin(Math.PI*p)*.42;
        drop.scale.set(1+p*.55);
        drop.alpha=fade*.9;
      }
    });
  }

  setCamera({camera,zoom=1,width=1,height=1}={}){
    if(!this.ready||!this.world)return false;
    const z=Math.max(.1,Number(zoom)||1);
    this.world.scale.set(z);
    this.world.position.set(
      (Number(width)||1)/2-(Number(camera?.x)||0)*z,
      (Number(height)||1)/2-(Number(camera?.y)||0)*z
    );
    return true;
  }

  resize(width,height){
    if(!this.ready||!this.app)return false;
    this.app.renderer.resize(Math.max(1,Math.round(Number(width)||1)),Math.max(1,Math.round(Number(height)||1)));
    return true;
  }

  hasEntity(id){
    return this.entitySprites.has(String(id||""));
  }

  destroy(){
    this.ready=false;
    this.loading.clear();
    for(const entry of [...this.projectileFx]){
      try{this.app?.ticker?.remove(entry.tick)}catch{}
      this._destroyDisplay(entry.container);
    }
    this.projectileFx.clear();
    for(const entry of [...this.transientFx])this._cleanupTransient(entry);
    for(const sprite of this.entitySprites.values())sprite.destroy();
    this.entitySprites.clear();
    try{this.app?.destroy?.(true,{children:true,texture:false,textureSource:false})}catch{}
    this.app=null;
    this.world=null;
    this.PIXI=null;
  }
}
