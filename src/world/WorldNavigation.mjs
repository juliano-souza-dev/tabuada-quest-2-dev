export const NAVIGATION_DEFAULTS=Object.freeze({
  maxSpeed:250,
  minHeadingSpeed:8,
  rotationSharpness:8.5,
  cameraSharpness:7.7,
  cameraLookAheadDistance:150,
  cameraDeadZone:72,
  counterSteerRetention:0
});

export const clamp=(value,min,max)=>Math.min(max,Math.max(min,value));

export function normalizeDegrees(value=0){
  return ((Number(value||0)+180)%360+360)%360-180;
}

export function shortestAngleDelta(current,target){
  return normalizeDegrees(Number(target||0)-Number(current||0));
}

export function expSmoothingFactor(dt,sharpness){
  const seconds=Math.max(0,Number(dt)||0);
  const rate=Math.max(0,Number(sharpness)||0);
  return 1-Math.exp(-rate*seconds);
}

export function smoothAngle(current,target,dt,sharpness=NAVIGATION_DEFAULTS.rotationSharpness){
  const factor=expSmoothingFactor(dt,sharpness);
  return normalizeDegrees(Number(current||0)+shortestAngleDelta(current,target)*factor);
}

export function velocityHeading(vx,vy,fallback=0,minSpeed=NAVIGATION_DEFAULTS.minHeadingSpeed){
  const x=Number(vx)||0;
  const y=Number(vy)||0;
  if(Math.hypot(x,y)<Math.max(0,Number(minSpeed)||0))return normalizeDegrees(fallback);
  return normalizeDegrees(Math.atan2(y,x)*180/Math.PI+90);
}

export function applyCounterSteer(velocity,input,{
  retention=NAVIGATION_DEFAULTS.counterSteerRetention
}={}){
  const v=Number(velocity)||0;
  const intent=Number(input)||0;
  if(!intent||!v||Math.sign(v)===Math.sign(intent))return v;
  return v*clamp(Number(retention)||0,0,1);
}

export function computeCameraLookAhead(vx,vy,{
  maxSpeed=NAVIGATION_DEFAULTS.maxSpeed,
  maxDistance=NAVIGATION_DEFAULTS.cameraLookAheadDistance
}={}){
  const x=Number(vx)||0;
  const y=Number(vy)||0;
  const speed=Math.hypot(x,y);
  if(speed<=0)return {x:0,y:0,distance:0};

  const speedLimit=Math.max(1,Number(maxSpeed)||1);
  const distanceLimit=Math.max(0,Number(maxDistance)||0);
  const ratio=clamp(speed/speedLimit,0,1);
  const distance=distanceLimit*ratio;
  const inv=1/speed;

  return {x:x*inv*distance,y:y*inv*distance,distance};
}

export function computeCameraFollowTarget(player,camera,{
  viewportWidth=0,
  viewportHeight=0,
  zoom=1,
  worldWidth=0,
  worldHeight=0,
  deadZone=NAVIGATION_DEFAULTS.cameraDeadZone
}={}){
  const px=Number(player?.x)||0;
  const py=Number(player?.y)||0;
  const cx=Number(camera?.x)||px;
  const cy=Number(camera?.y)||py;
  const safeZoom=Math.max(.1,Number(zoom)||1);
  const vw=Math.max(0,Number(viewportWidth)||0);
  const vh=Math.max(0,Number(viewportHeight)||0);
  const ww=Math.max(1,Number(worldWidth)||1);
  const wh=Math.max(1,Number(worldHeight)||1);
  const deadWorld=Math.max(0,Number(deadZone)||0)/safeZoom;

  let targetX=cx;
  let targetY=cy;
  const dx=px-cx;
  const dy=py-cy;

  if(dx>deadWorld)targetX=px-deadWorld;
  else if(dx<-deadWorld)targetX=px+deadWorld;

  if(dy>deadWorld)targetY=py-deadWorld;
  else if(dy<-deadWorld)targetY=py+deadWorld;

  const halfW=Math.min(ww/2,vw/(2*safeZoom));
  const halfH=Math.min(wh/2,vh/(2*safeZoom));

  return {
    x:clamp(targetX,halfW,ww-halfW),
    y:clamp(targetY,halfH,wh-halfH),
    deadWorld
  };
}
