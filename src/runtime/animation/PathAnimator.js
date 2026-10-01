const clamp01=value=>Math.max(0,Math.min(1,Number(value)||0));
const lerp=(a,b,t)=>a+(b-a)*t;
const smoothstep=value=>{const t=clamp01(value);return t*t*(3-2*t)};

function frameAt(frames,index,loop){
  if(!frames.length)return null;
  if(loop){
    const wrapped=((index%frames.length)+frames.length)%frames.length;
    return frames[wrapped];
  }
  return frames[Math.max(0,Math.min(frames.length-1,index))];
}

function catmullRom(p0,p1,p2,p3,t){
  const t2=t*t,t3=t2*t;
  return .5*((2*p1)+(-p0+p2)*t+((2*p0)-(5*p1)+(4*p2)-p3)*t2+(-p0+(3*p1)-(3*p2)+p3)*t3);
}

function addScale(frame,from,to,t,smooth=false){
  const p=smooth?smoothstep(t):clamp01(t);
  if(Number.isFinite(Number(from?.sx))&&Number.isFinite(Number(to?.sx)))frame.sx=Math.max(.01,lerp(Number(from.sx),Number(to.sx),p));
  if(Number.isFinite(Number(from?.sy))&&Number.isFinite(Number(to?.sy)))frame.sy=Math.max(.01,lerp(Number(from.sy),Number(to.sy),p));
  return frame;
}

function perspectiveProgress(progress,startScale,endScale){
  const t=clamp01(progress);
  const start=Math.max(.0001,Number(startScale)||1);
  const end=Math.max(.0001,Number(endScale)||start);
  const ratio=end/start;
  if(Math.abs(ratio-1)<.0001)return t;

  if(ratio>1){
    const alpha=1-(1/ratio);
    const relative=1/Math.max(.0001,1-alpha*t);
    return clamp01((relative-1)/(ratio-1));
  }

  const inverseRatio=1/ratio;
  const alpha=1-(1/inverseRatio);
  const mirrored=1-t;
  const relative=1/Math.max(.0001,1-alpha*mirrored);
  const q=(relative-1)/(inverseRatio-1);
  return clamp01(1-q);
}

export class PathAnimator {
  constructor(runtime,node,{channel="route"}={}){
    this.runtime=runtime;
    this.node=node;
    this.channel=channel;
    this.raf=0;
    this.signature="";
    this.running=false;
  }

  normalize(config={}){
    const frames=(Array.isArray(config.frames)?config.frames:[])
      .map(frame=>({
        x:Number(frame?.x)||0,
        y:Number(frame?.y)||0,
        ...(Number.isFinite(Number(frame?.sx))?{sx:Math.max(.01,Number(frame.sx))}:{}),
        ...(Number.isFinite(Number(frame?.sy))?{sy:Math.max(.01,Number(frame.sy))}:{})
      }));

    return {
      enabled:config.enabled===true,
      frames,
      interpolation:["linear","smooth","curve","perspective"].includes(config.interpolation)?config.interpolation:"linear",
      timing:config.timing==="equal"?"equal":"distance",
      speed:Math.max(.01,Math.min(4,Number(config.speed)||1)),
      durationMs:Math.max(0,Math.min(120000,Number(config.durationMs)||0)),
      loop:config.loop===true,
      restartAtOrigin:config.restartAtOrigin===true,
      pixelsPerSecond:Math.max(20,Number(config.pixelsPerSecond)||220)
    };
  }

  configSignature(config){
    return JSON.stringify(config);
  }

  sync(config){
    const normalized=this.normalize(config);
    const signature=this.configSignature(normalized);
    if(signature===this.signature&&this.running)return;
    this.signature=signature;
    if(!normalized.enabled||normalized.frames.length<2){
      this.stop({clear:true,resetSignature:false});
      return;
    }
    this.play(normalized);
  }

  stop({clear=true,resetSignature=false}={}){
    cancelAnimationFrame(this.raf);
    this.raf=0;
    this.running=false;
    if(resetSignature)this.signature="";
    if(clear)this.runtime.clearAnimationTransform(this.node.id,this.channel);
  }

  apply(frame){
    if(!frame)return;
    this.runtime.setAnimationTransform(this.node.id,this.channel,{
      x:Number(frame.x)||0,
      y:Number(frame.y)||0,
      scaleX:Number.isFinite(Number(frame.sx))?Number(frame.sx):1,
      scaleY:Number.isFinite(Number(frame.sy))?Number(frame.sy):1
    });
  }

  interpolate(config,segmentIndex,progress){
    const frames=config.frames;
    const wrap=config.loop&&!config.restartAtOrigin;
    const from=frameAt(frames,segmentIndex,wrap);
    const to=frameAt(frames,segmentIndex+1,wrap);
    if(!from||!to)return from||to||null;

    if(config.interpolation==="linear"){
      const t=clamp01(progress);
      return addScale({x:lerp(from.x,to.x,t),y:lerp(from.y,to.y,t)},from,to,t,false);
    }

    if(config.interpolation==="smooth"||frames.length<3){
      const t=smoothstep(progress);
      return addScale({x:lerp(from.x,to.x,t),y:lerp(from.y,to.y,t)},from,to,t,false);
    }

    const p0=frameAt(frames,segmentIndex-1,wrap);
    const p3=frameAt(frames,segmentIndex+2,wrap);
    const t=clamp01(progress);
    return addScale({
      x:catmullRom(p0.x,from.x,to.x,p3.x,t),
      y:catmullRom(p0.y,from.y,to.y,p3.y,t)
    },from,to,t,true);
  }

  interpolatePerspective(config,progress){
    const from=config.frames[0],to=config.frames[config.frames.length-1];
    const startScale=Number.isFinite(Number(from.sx))?Number(from.sx):(Number(from.sy)||1);
    const endScale=Number.isFinite(Number(to.sx))?Number(to.sx):(Number(to.sy)||startScale);
    const q=perspectiveProgress(progress,startScale,endScale);
    return addScale({x:lerp(from.x,to.x,q),y:lerp(from.y,to.y,q)},from,to,q,false);
  }

  segmentDuration(config,from,to){
    if(config.timing==="equal")return Math.max(90,700/config.speed);
    const distance=Math.hypot((to?.x||0)-(from?.x||0),(to?.y||0)-(from?.y||0));
    if(distance<=.001)return Math.max(90,260/config.speed);
    return Math.max(90,Math.min(600000,(distance/(config.pixelsPerSecond*config.speed))*1000));
  }

  play(rawConfig){
    this.stop();
    const config=this.normalize(rawConfig);
    if(!config.enabled||config.frames.length<2)return false;

    this.running=true;
    this.apply(config.frames[0]);

    if(config.interpolation==="perspective"){
      const duration=Math.max(250,(config.durationMs||6500)/config.speed);
      let startedAt=null;
      const step=timestamp=>{
        if(!this.running)return;
        if(startedAt===null)startedAt=timestamp;
        const progress=clamp01((timestamp-startedAt)/duration);
        this.apply(this.interpolatePerspective(config,progress));

        if(progress<1){
          this.raf=requestAnimationFrame(step);
          return;
        }

        if(config.loop){
          if(config.restartAtOrigin)this.apply(config.frames[0]);
          startedAt=timestamp;
          this.raf=requestAnimationFrame(step);
          return;
        }

        this.running=false;
      };
      this.raf=requestAnimationFrame(step);
      return true;
    }

    const maxSegmentIndex=config.loop&&!config.restartAtOrigin?config.frames.length-1:config.frames.length-2;
    let segmentIndex=0;
    let segmentStartedAt=null;

    const step=timestamp=>{
      if(!this.running)return;
      const wrap=config.loop&&!config.restartAtOrigin;
      const from=frameAt(config.frames,segmentIndex,wrap);
      const to=frameAt(config.frames,segmentIndex+1,wrap);
      if(!from||!to){this.running=false;return}

      if(segmentStartedAt===null)segmentStartedAt=timestamp;
      const duration=this.segmentDuration(config,from,to);
      const progress=clamp01((timestamp-segmentStartedAt)/duration);
      this.apply(this.interpolate(config,segmentIndex,progress));

      if(progress<1){
        this.raf=requestAnimationFrame(step);
        return;
      }

      if(segmentIndex>=maxSegmentIndex){
        if(!config.loop){
          this.apply(config.frames[config.frames.length-1]);
          this.running=false;
          return;
        }
        if(config.restartAtOrigin)this.apply(config.frames[0]);
        segmentIndex=0;
      }else{
        segmentIndex+=1;
      }

      segmentStartedAt=timestamp;
      this.raf=requestAnimationFrame(step);
    };

    this.raf=requestAnimationFrame(step);
    return true;
  }

  destroy(){
    this.stop();
  }
}

export const PathMath=Object.freeze({
  clamp01,
  lerp,
  smoothstep,
  catmullRom,
  perspectiveProgress
});
