import { NavalCombatWebGLRenderer } from "../../world/NavalCombatWebGLRenderer.mjs?v=20261002-2010";
import { normalizeAmmoFx } from "../../world/fx/AmmoFxProfile.mjs?v=20261002-2003";

export class AmmoPreviewGL{
  constructor(canvas){
    this.canvas=canvas;
    this.renderer=new NavalCombatWebGLRenderer(canvas);
    this.ammo=null;
    this.mode="ship";
    this.loop=true;
    this.speed=1;
    this.raf=0;
    this.lastShotAt=0;
    this.sequence=0;
    this.running=false;
    this.resizeObserver=null;
  }

  mount(){
    if(this.running)return;
    this.running=true;
    this.renderer.init();
    if(globalThis.ResizeObserver){
      this.resizeObserver=new ResizeObserver(()=>this.render(performance.now()));
      this.resizeObserver.observe(this.canvas);
    }
    this.tick=now=>{
      if(!this.running)return;
      const rect=this.canvas.getBoundingClientRect();
      const width=Math.max(320,rect.width||this.canvas.clientWidth||640);
      const height=Math.max(220,rect.height||this.canvas.clientHeight||360);
      if(this.ammo&&this.loop&&(!this.lastShotAt||now-this.lastShotAt>Math.max(650,1800/Math.max(.25,this.speed)))){
        this.fire();
      }
      this.renderer.render({
        time:now,
        camera:{x:width/2,y:height/2},
        zoom:1,
        width,
        height,
        damagedShips:[]
      });
      this.raf=requestAnimationFrame(this.tick);
    };
    this.raf=requestAnimationFrame(this.tick);
  }

  setAmmo(ammo){
    this.ammo=ammo?{...structuredClone(ammo),fx:normalizeAmmoFx(ammo)}:null;
    if(this.ammo)this.renderer.prepareAmmo?.(this.ammo);
  }

  textureState(){
    return this.renderer.projectileTextureState?.(this.ammo)||{src:"",ready:false,failed:false};
  }

  setMode(mode){
    this.mode=["ship","water","alternate"].includes(mode)?mode:"ship";
    this.renderer.clear();
    this.lastShotAt=0;
  }

  setLoop(value){this.loop=value!==false}
  setSpeed(value){this.speed=Math.max(.25,Math.min(2,Number(value)||1))}

  fire(kind){
    if(!this.ammo)return false;
    const rect=this.canvas.getBoundingClientRect();
    const width=Math.max(320,rect.width||this.canvas.clientWidth||640);
    const height=Math.max(220,rect.height||this.canvas.clientHeight||360);
    let impactKind=kind;
    if(!impactKind){
      if(this.mode==="alternate"){
        impactKind=this.sequence++%2===0?"ship":"water";
      }else impactKind=this.mode;
    }
    impactKind=impactKind==="water"?"water":"ship";
    const distance=Math.max(180,width*.68);
    const projectileSpeed=Math.max(80,Number(this.ammo.projectileSpeed)||720);
    const physicalDuration=(distance/projectileSpeed*1000)/this.speed;
    const duration=Math.max(720,Math.min(2200,physicalDuration));
    const from={x:width*.17,y:height*.54};
    const to={x:width*.83,y:impactKind==="water"?height*.67:height*.48};
    const fired=this.renderer.fire({
      from,to,duration,ammo:this.ammo,impactKind,startTime:performance.now()
    });
    if(fired)this.lastShotAt=performance.now();
    return fired;
  }

  render(now=performance.now()){
    if(!this.running)return;
    const rect=this.canvas.getBoundingClientRect();
    const width=Math.max(320,rect.width||this.canvas.clientWidth||640);
    const height=Math.max(220,rect.height||this.canvas.clientHeight||360);
    this.renderer.render({time:now,camera:{x:width/2,y:height/2},zoom:1,width,height,damagedShips:[]});
  }

  clear(){this.renderer.clear();this.lastShotAt=0}

  destroy(){
    this.running=false;
    if(this.raf)cancelAnimationFrame(this.raf);
    this.raf=0;
    this.resizeObserver?.disconnect?.();
    this.resizeObserver=null;
    this.renderer.destroy();
  }
}
