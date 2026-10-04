const PIXI_MODULE_URL="https://cdn.jsdelivr.net/npm/pixi.js@8.21.0/dist/pixi.min.mjs";

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
    if(this.world)this.world.sortableChildren=true;
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
    for(const sprite of this.entitySprites.values())sprite.destroy();
    this.entitySprites.clear();
    try{this.app?.destroy?.(true,{children:true,texture:false,textureSource:false})}catch{}
    this.app=null;
    this.world=null;
    this.PIXI=null;
  }
}
