import { PathAnimator } from "./animation/PathAnimator.js?v=20260930-0018";

const SEA_PRESETS=Object.freeze({
  calm:Object.freeze({heave:24,pitch:20,roll:10,sway:8,inertia:82,damping:68,coupling:54}),
  navigation:Object.freeze({heave:46,pitch:42,roll:24,sway:14,inertia:68,damping:54,coupling:76}),
  rough:Object.freeze({heave:82,pitch:76,roll:58,sway:30,inertia:48,damping:38,coupling:96}),
  heavy:Object.freeze({heave:38,pitch:28,roll:18,sway:10,inertia:91,damping:74,coupling:82})
});

const ROUTE_PRESETS=Object.freeze({
  none:Object.freeze({enabled:false}),
  straight:Object.freeze({interpolation:"linear",timing:"distance",speed:.5,loop:false,restartAtOrigin:false}),
  approach:Object.freeze({interpolation:"perspective",timing:"equal",speed:1,durationMs:7200,loop:false,restartAtOrigin:false,dyRatio:420/1672,endScale:2.68}),
  horizon:Object.freeze({interpolation:"perspective",timing:"equal",speed:1,durationMs:9000,loop:false,restartAtOrigin:false,dyRatio:390/1672,endScale:2.30}),
  docking:Object.freeze({interpolation:"perspective",timing:"equal",speed:1,durationMs:4800,loop:false,restartAtOrigin:false,dyRatio:190/1672,endScale:1.48})
});

function percent(value,fallback){
  const n=Number(value);
  return Math.max(0,Math.min(100,Number.isFinite(n)?n:fallback));
}

function springAxis(state,key,target,stiffness,damping,dt){
  const velocityKey=key+"Velocity";
  const current=Number(state[key])||0;
  const velocity=Number(state[velocityKey])||0;
  const acceleration=(target-current)*stiffness;
  const nextVelocity=(velocity+acceleration*dt)*Math.exp(-damping*dt);
  const nextValue=current+nextVelocity*dt;
  state[key]=nextValue;
  state[velocityKey]=nextVelocity;
  return nextValue;
}

export class ShipEffect {
  constructor(runtime,node){
    this.runtime=runtime;
    this.node=node;
    this.phase=(this.hash(node.id)%997)/997*Math.PI*2;
    this.physics={x:0,xVelocity:0,y:0,yVelocity:0,rotation:0,rotationVelocity:0,lastNow:performance.now()};
    this.path=new PathAnimator(runtime,node,{channel:"ship-route"});
    this.lastMode=runtime.mode;
    this.loop=this.loop.bind(this);
    this.sync();
    this.raf=requestAnimationFrame(this.loop);
  }

  hash(value){
    let hash=2166136261;
    for(const char of String(value||""))hash=Math.imul(hash^char.charCodeAt(0),16777619);
    return hash>>>0;
  }

  config(){
    const composition=this.node.composition||{};
    const animation=composition.animation||{};
    const presetName=SEA_PRESETS[animation.preset]?animation.preset:"navigation";
    const preset=SEA_PRESETS[presetName];

    return {
      active:composition.active!==false,
      preset:presetName,
      heave:percent(animation.heave,preset.heave),
      pitch:percent(animation.pitch,preset.pitch),
      roll:percent(animation.roll,preset.roll),
      sway:percent(animation.sway,preset.sway),
      inertia:percent(animation.inertia,preset.inertia),
      damping:percent(animation.damping,preset.damping),
      coupling:percent(animation.coupling,preset.coupling),
      pivotX:Math.max(0,Math.min(1,(Number(animation.pivotX??50)>1?Number(animation.pivotX??50)/100:Number(animation.pivotX??.5)))),
      pivotY:Math.max(0,Math.min(1,(Number(animation.pivotY??76)>1?Number(animation.pivotY??76)/100:Number(animation.pivotY??.76)))),
      routePreset:ROUTE_PRESETS[animation.routePreset]?animation.routePreset:"none",
      route:animation.route&&typeof animation.route==="object"?animation.route:null,
      routeSpeed:percent(animation.routeSpeed,50),
      routeLoop:animation.routeLoop===true,
      wakeEnabled:animation.wakeEnabled!==false,
      wakePreset:String(animation.wakePreset||"navigation"),
      wakeIntensity:percent(animation.wakeIntensity,62),
      wakeLength:percent(animation.wakeLength,56),
      wakeSpread:percent(animation.wakeSpread,44),
      wakeFoam:percent(animation.wakeFoam,62)
    };
  }

  sync(){
    const item=this.runtime.nodes.get(this.node.id);
    const config=this.config();
    if(item?.el)item.el.style.transformOrigin=(config.pivotX*100)+"% "+(config.pivotY*100)+"%";

    if(!config.active){
      this.path.stop();
      this.resetLocalMotion();
      return;
    }

    const previewMode=this.runtime.editorEnabled&&this.runtime.mode==="config";
    if(this.runtime.mode==="play"||previewMode){
      this.path.node=this.node;
      this.path.sync(this.buildRouteConfig(config));
    }else{
      this.path.stop();
    }
  }

  buildRouteConfig(config=this.config()){
    if(Array.isArray(config.route?.frames)&&config.route.frames.length>=2){
      return {
        enabled:config.route.enabled!==false,
        frames:config.route.frames,
        interpolation:config.route.interpolation||"curve",
        timing:config.route.timing||"distance",
        speed:Math.max(.01,Number(config.route.speed)||1),
        durationMs:Math.max(0,Number(config.route.durationMs)||0),
        loop:config.route.loop===true,
        restartAtOrigin:config.route.restartAtOrigin===true
      };
    }

    const preset=ROUTE_PRESETS[config.routePreset]||ROUTE_PRESETS.none;
    if(!preset.enabled&&config.routePreset==="none")return {enabled:false,frames:[]};

    const speedMultiplier=.15+(config.routeSpeed/100)*1.85;
    const base={...preset,enabled:true,speed:(preset.speed||1)*speedMultiplier,loop:config.routeLoop||preset.loop===true};

    if(config.routePreset==="straight"){
      const state=this.runtime.getAnimatedWorldState(this.node.id,{excludeChannels:["ship-route","ship-local"]});
      if(!state)return {enabled:false,frames:[]};
      const angle=(state.rotation||0)*Math.PI/180;
      const dx=Math.cos(angle),dy=Math.sin(angle);
      const viewportWidth=Math.max(1,this.runtime.logicalViewport?.width||this.runtime.reference.width);
      const viewportHeight=Math.max(1,this.runtime.logicalViewport?.height||this.runtime.reference.height);
      const halfW=state.width/2,halfH=state.height/2;
      const cx=state.centerX,cy=state.centerY;
      const tx=Math.abs(dx)<.00001?Infinity:(dx>0?(viewportWidth-halfW-cx)/dx:(halfW-cx)/dx);
      const ty=Math.abs(dy)<.00001?Infinity:(dy>0?(viewportHeight-halfH-cy)/dy:(halfH-cy)/dy);
      const distance=Math.max(0,Math.min(tx>0?tx:Infinity,ty>0?ty:Infinity));
      const safeDistance=Number.isFinite(distance)?distance:0;
      return {...base,frames:[{x:0,y:0,sx:1,sy:1},{x:dx*safeDistance,y:dy*safeDistance,sx:1,sy:1}]};
    }

    const dy=(preset.dyRatio||0)*(this.runtime.reference?.height||844);
    return {
      ...base,
      frames:[
        {x:0,y:0,sx:1,sy:1},
        {x:0,y:dy,sx:preset.endScale||1,sy:preset.endScale||1}
      ]
    };
  }

  fallbackWave(now,offset=0){
    const seconds=now/1000;
    const phase=this.phase+offset;
    const w1=Math.sin(seconds*1.14+phase);
    const w2=Math.sin(seconds*.71-phase*.63);
    const w3=Math.sin(seconds*1.83+phase*.37);
    return {height:w1*.50+w2*.31+w3*.19,movement:.55};
  }

  sampleSea(stageX,stageY,now,offset=0){
    for(const ocean of this.runtime.compositions.list("ocean")){
      const sampled=ocean.sampleWaveAtStage?.(stageX,stageY,now);
      if(sampled&&Number.isFinite(Number(sampled.height)))return sampled;
    }
    return this.fallbackWave(now,offset);
  }

  seaMotion(now,config){
    const state=this.runtime.getAnimatedWorldState(this.node.id,{excludeChannels:["ship-local"]});
    if(!state)return {x:0,y:0,rotation:0,scale:1};

    const centerX=state.centerX;
    const waterlineY=state.y+state.height*.68;
    const hullSpan=Math.max(18,Math.min(state.width*.42,(this.runtime.logicalViewport?.width||this.runtime.reference.width)*.18));

    const stern=this.sampleSea(centerX-hullSpan,waterlineY,now,-.7);
    const bow=this.sampleSea(centerX+hullSpan,waterlineY,now,.7);
    const center=this.sampleSea(centerX,waterlineY,now,0);

    const coupling=config.coupling/100;
    const movement=Math.max(.18,Number(center.movement)||Number(bow.movement)||.55);
    const meanHeight=((Number(stern.height)||0)+(Number(center.height)||0)+(Number(bow.height)||0))/3;
    const slope=(Number(bow.height)||0)-(Number(stern.height)||0);
    const secondaryRoll=Math.sin(now*.00072+this.phase*1.41)+Math.sin(now*.00113+this.phase*.57)*.42;

    const targetY=meanHeight*(1.5+(config.heave/100)*13)*coupling*(.65+movement*.75);
    const targetRotation=(slope*(config.pitch/100)*7.2+secondaryRoll*(config.roll/100)*1.9)*coupling;
    const targetX=(Math.sin(now*.00043+this.phase)+Math.sin(now*.00081+this.phase*1.27)*.35)*(config.sway/100)*4.5*coupling;

    const dt=Math.max(1/120,Math.min(.05,(now-this.physics.lastNow)/1000||1/60));
    this.physics.lastNow=now;
    const stiffness=5+(1-config.inertia/100)*17;
    const damping=2.5+(config.damping/100)*8.5;

    return {
      x:springAxis(this.physics,"x",targetX,stiffness*.72,damping,dt),
      y:springAxis(this.physics,"y",targetY,stiffness,damping,dt),
      rotation:springAxis(this.physics,"rotation",targetRotation,stiffness*.84,damping,dt),
      scale:1+meanHeight*coupling*(config.heave/100)*.0022
    };
  }

  resetLocalMotion(){
    this.runtime.clearAnimationTransform(this.node.id,"ship-local");
    this.physics.x=0;this.physics.xVelocity=0;
    this.physics.y=0;this.physics.yVelocity=0;
    this.physics.rotation=0;this.physics.rotationVelocity=0;
    this.physics.lastNow=performance.now();
  }

  loop(now){
    if(!this.runtime.nodes.has(this.node.id))return;

    const config=this.config();
    if(this.lastMode!==this.runtime.mode){
      this.lastMode=this.runtime.mode;
      const previewMode=this.runtime.editorEnabled&&this.runtime.mode==="config";
      if((this.runtime.mode==="play"||previewMode)&&config.active)this.path.play(this.buildRouteConfig(config));
      else this.path.stop();
    }

    const reduced=window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
    const previewMode=this.runtime.editorEnabled&&this.runtime.mode==="config";
    const animateLocal=config.active&&this.node.visible!==false&&(this.runtime.mode==="play"||previewMode)&&(!reduced||this.runtime.editorEnabled);

    if(animateLocal){
      const motion=this.seaMotion(now,config);
      this.runtime.setAnimationTransform(this.node.id,"ship-local",{
        x:motion.x,
        y:motion.y,
        rotation:motion.rotation,
        scaleX:motion.scale,
        scaleY:motion.scale
      });
    }else{
      this.resetLocalMotion();
    }

    this.raf=requestAnimationFrame(this.loop);
  }

  wakeConfig(){
    const config=this.config();
    return {
      enabled:config.active&&config.wakeEnabled,
      preset:config.wakePreset,
      intensity:config.wakeIntensity,
      length:config.wakeLength,
      spread:config.wakeSpread,
      foam:config.wakeFoam
    };
  }

  destroy(){
    cancelAnimationFrame(this.raf);
    this.path.destroy();
    this.runtime.clearAnimationTransform(this.node.id,"ship-local");
    const item=this.runtime.nodes.get(this.node.id);
    if(item?.el)item.el.style.transformOrigin="";
  }
}

export const ShipEngineering=Object.freeze({SEA_PRESETS,ROUTE_PRESETS});
