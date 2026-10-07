export class WorldGameLoop{
  constructor(runtime,{requestFrame=callback=>requestAnimationFrame(callback),cancelFrame=id=>cancelAnimationFrame(id)}={}){
    if(!runtime)throw new TypeError("WorldGameLoop requires a runtime");
    this.runtime=runtime;
    this.requestFrame=requestFrame;
    this.cancelFrame=cancelFrame;
    this.frameId=0;
    this.lastTime=0;
    this.running=false;
    this.inFrame=false;
  }

  start(){
    if(this.running)return false;
    this.running=true;
    this.schedule();
    return true;
  }

  stop(){
    this.running=false;
    if(this.frameId)this.cancelFrame(this.frameId);
    this.frameId=0;
  }

  schedule(){
    if(!this.running||this.frameId||this.inFrame)return;
    this.frameId=this.requestFrame(time=>{this.frameId=0;this.frame(time);});
  }

  frame(time){
    if(!this.running||this.inFrame)return;
    this.inFrame=true;
    const now=Number(time)||0;
    const previous=this.lastTime||now;
    const dt=Math.min(.10,Math.max(.001,(now-previous)/1000));
    this.lastTime=now;

    const runtime=this.runtime;
    try{
      runtime.updateSimulationFrame(now,dt);
      if(!this.running)return;
      runtime.updatePresentationFrame(now,dt);
      if(!this.running)return;
      runtime.updateInterfaceFrame(now,dt);
    }catch(error){
      this.stop();
      throw error;
    }finally{
      this.inFrame=false;
      if(this.running)this.schedule();
    }
  }
}
