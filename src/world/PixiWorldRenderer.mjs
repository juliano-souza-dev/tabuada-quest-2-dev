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

    const preset=String(fx.preset||"standard");
    const special=!["standard","rusted-iron"].includes(preset);
    const root=new this.PIXI.Container();
    root.position.set(Number(at?.x)||0,Number(at?.y)||0);
    root.zIndex=92;
    root.eventMode="none";

    const scaleBase=clamp(Number(size)||1,.7,1.6);
    const radius=Math.max(4,style.size*(special?.105:.075)*scaleBase);
    const primary=hexNumber(style.color,0xff8a24);
    const core=hexNumber(style.coreColor,0xfff0a8);

    const flash=new this.PIXI.Graphics();
    if(special)flash.blendMode="add";
    flash.circle(0,0,radius*(special?1.7:1.3)).fill({color:primary,alpha:special?.16:.10});
    flash.circle(0,0,radius*(special?.86:.68)).fill({color:core,alpha:special?.76:.62});
    flash.circle(0,0,radius*(special?.30:.22)).fill({color:0xffffff,alpha:.95});
    root.addChild(flash);

    const smoke=[];
    const smokeCount=special?Math.min(2,Math.max(1,Math.round(style.smoke*2))):1;
    for(let i=0;i<smokeCount;i++){
      const puff=new this.PIXI.Graphics();
      puff.circle(0,0,radius*(.30+i*.05)).fill({color:0x2d2d2d,alpha:special?.20:.16});
      puff._vx=radius*(.48+i*.20);
      puff._vy=-radius*(.22+i*.18);
      root.addChild(puff);
      smoke.push(puff);
    }

    this.world.addChild(root);
    return this._animateTransient(root,special?150:110,(p)=>{
      const fade=1-p;
      flash.scale.set(.72+p*(special?.95:.62));
      flash.alpha=fade*fade;
      for(const puff of smoke){
        puff.x=puff._vx*p;
        puff.y=puff._vy*p;
        puff.scale.set(.82+p*.72);
        puff.alpha=fade*(special?.20:.16);
      }
    });
  }

  fireCannonProjectile({from,to,duration=600,size=7,ammo=null}={}){
    if(!this.ready||!this.world||!this.PIXI)return false;
    const start={x:Number(from?.x)||0,y:Number(from?.y)||0};
    const end={x:Number(to?.x)||0,y:Number(to?.y)||0};
    const life=Math.max(100,Number(duration)||600);
    const fx=normalizeAmmoFx(ammo||{});
    const projectileStyle=fx.projectile;
    const trailStyle=fx.trail;
    const preset=String(fx.preset||"standard");
    const solidBall=["standard","rusted-iron"].includes(preset);
    const moderate=preset==="piercing";
    const luminous=!solidBall;
    const radius=Math.max(4.2,(Number(size)||7)*clamp(projectileStyle.scale,.62,1.55));
    const distance=Math.hypot(end.x-start.x,end.y-start.y);
    const lift=Math.min(22,Math.max(5,distance*.016));
    const primary=hexNumber(projectileStyle.color,0xff6b1a);
    const core=hexNumber(projectileStyle.coreColor,0xfff0b0);
    const accent=hexNumber(projectileStyle.accentColor,0x69e7ff);

    const root=new this.PIXI.Container();
    root.position.set(start.x,start.y);
    root.zIndex=90;
    root.eventMode="none";

    let aura=null;
    if(luminous&&projectileStyle.auraEnabled!==false){
      aura=new this.PIXI.Graphics();
      aura.blendMode="add";
      const auraAlpha=moderate?.10:.18;
      aura.circle(0,0,radius*(moderate?1.55:1.95)).fill({color:primary,alpha:auraAlpha});
      aura.circle(0,0,radius*(moderate?1.05:1.28)).fill({color:accent,alpha:auraAlpha*.70});
      root.addChild(aura);
    }

    const trail=[];
    if(trailStyle.enabled!==false){
      const trailCount=solidBall?2:(moderate?3:5);
      for(let i=1;i<=trailCount;i++){
        const bead=new this.PIXI.Graphics();
        const beadRadius=solidBall
          ?Math.max(1.4,radius*(.30-i*.035))
          :Math.max(1.7,radius*(.48-i*.045));
        const beadColor=solidBall?(i%2?0x222222:0x4a4a4a):(i%2?primary:accent);
        bead.circle(0,0,beadRadius).fill({color:beadColor,alpha:solidBall?.18:(moderate?.20:.28)});
        root.addChildAt(bead,0);
        trail.push({display:bead,lag:i*(solidBall?.040:.034),index:i});
      }
    }

    const ball=new this.PIXI.Graphics();
    if(solidBall){
      ball.circle(0,0,radius).fill({color:0x080808,alpha:1});
      ball.circle(-radius*.25,-radius*.28,radius*.28).fill({color:0x9a9a9a,alpha:.52});
      ball.circle(radius*.08,radius*.10,radius*.76).stroke({width:Math.max(.8,radius*.09),color:0x2f2f2f,alpha:.9});
    }else{
      if(!moderate)ball.blendMode="add";
      ball.circle(0,0,radius*(moderate?1.00:1.08)).fill({color:primary,alpha:moderate?.86:.84});
      ball.circle(0,0,radius*(moderate?.52:.62)).fill({color:core,alpha:moderate?.82:.88});
      ball.circle(-radius*.18,-radius*.20,radius*.20).fill({color:0xffffff,alpha:.92});
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
      const point=pointOnPath(start,end,raw,lift);
      root.position.set(point.x,point.y);

      const heightPulse=.97+Math.sin(Math.PI*raw)*(solidBall?.10:.16);
      ball.scale.set(heightPulse);
      if(aura){
        const pulse=.97+.05*Math.sin((performance.now()-started)*.014*projectileStyle.pulseSpeed);
        aura.scale.set(heightPulse*pulse);
        aura.alpha=raw>.90?Math.max(0,(1-raw)/.10):1;
      }

      for(const bead of trail){
        const gt=clamp(raw-bead.lag,0,1);
        const gp=pointOnPath(start,end,gt,lift);
        bead.display.position.set(gp.x-point.x,gp.y-point.y);
        bead.display.alpha=clamp((1-raw)*.60+.12,0,.60)*(1-bead.index/(trail.length+2));
      }

      root.alpha=raw>.95?Math.max(0,(1-raw)/.05):1;
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

    const preset=String(fx.preset||"standard");
    const special=!["standard","rusted-iron"].includes(preset);
    const moderate=preset==="piercing";
    const root=new this.PIXI.Container();
    root.position.set(Number(at?.x)||0,Number(at?.y)||0);
    root.zIndex=96;
    root.eventMode="none";

    const scaleBase=clamp(Number(size)||1,.65,1.35);
    const radius=Math.max(6.5,style.size*(special?.080:.062)*scaleBase);
    const primary=hexNumber(style.color,water?0x8feaff:0xff5a12);
    const core=hexNumber(style.coreColor,0xffffff);
    const accent=hexNumber(style.accentColor,water?0xffffff:0x69e7ff);

    const bloom=new this.PIXI.Graphics();
    if(special&&!moderate)bloom.blendMode="add";
    if(special){
      bloom.circle(0,0,radius*(moderate?1.25:1.45)).fill({color:accent,alpha:moderate?.08:.10});
      bloom.circle(0,0,radius*(moderate?.85:1.02)).fill({color:primary,alpha:moderate?.18:.24});
    }
    bloom.circle(0,0,radius*.62).fill({color:water?accent:primary,alpha:water?.34:.48});
    bloom.circle(0,0,radius*.34).fill({color:core,alpha:.78});
    bloom.circle(0,0,radius*.14).fill({color:0xffffff,alpha:.94});
    root.addChild(bloom);

    let shock=null;
    if(special){
      shock=new this.PIXI.Graphics();
      shock.circle(0,0,radius*.62).stroke({width:Math.max(1,radius*.07),color:accent,alpha:moderate?.22:.30});
      root.addChild(shock);
    }

    const sparks=[];
    const sparkCount=water?5:(special?8:6);
    for(let i=0;i<sparkCount;i++){
      const spark=new this.PIXI.Graphics();
      const a=(Math.PI*2*i)/sparkCount+(i%2)*.18;
      const sr=Math.max(1,radius*(i%3===0?.07:.045));
      const sparkColor=special?(i%2?accent:primary):(i%2?0xffb04a:0xff6a1f);
      spark.circle(0,0,sr).fill({color:sparkColor,alpha:.86});
      spark._a=a;
      spark._speed=radius*(.88+(i%4)*.18);
      root.addChild(spark);
      sparks.push(spark);
    }

    const smoke=[];
    if(!water){
      const smokeCount=special?2:2;
      for(let i=0;i<smokeCount;i++){
        const puff=new this.PIXI.Graphics();
        puff.circle(0,0,radius*(.28+i*.05)).fill({color:i%2?0x282828:0x3b3b3b,alpha:.18});
        puff._a=-Math.PI*.62+i*.18;
        puff._speed=radius*(.45+i*.14);
        root.addChildAt(puff,0);
        smoke.push(puff);
      }
    }

    const ripple=water?new this.PIXI.Graphics():null;
    if(ripple){
      ripple.circle(0,0,radius*.65).stroke({width:Math.max(1,radius*.07),color:accent,alpha:.34});
      root.addChildAt(ripple,0);
    }

    this.world.addChild(root);
    const duration=water?380:(special?360:300);

    return this._animateTransient(root,duration,(p)=>{
      const fade=1-p;
      const pop=Math.sin(Math.min(1,p*2.7)*Math.PI*.5);
      bloom.scale.set(.62+pop*(special?.58:.40)+p*.06);
      bloom.alpha=clamp(1-p*1.08,0,1);

      if(shock){
        shock.scale.set(.72+p*(moderate?.75:1.05));
        shock.alpha=fade*(moderate?.20:.28);
      }

      for(const spark of sparks){
        const travel=spark._speed*(p+p*p*.08);
        spark.x=Math.cos(spark._a)*travel;
        spark.y=Math.sin(spark._a)*travel+p*p*radius*.12;
        spark.alpha=fade;
        spark.scale.set(1-p*.46);
      }

      for(const puff of smoke){
        const travel=puff._speed*p;
        puff.x=Math.cos(puff._a)*travel;
        puff.y=Math.sin(puff._a)*travel-radius*p*.40;
        puff.scale.set(.78+p*.78);
        puff.alpha=fade*.18;
      }

      if(ripple){
        ripple.scale.set(.74+p*1.05);
        ripple.alpha=fade*.30;
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
