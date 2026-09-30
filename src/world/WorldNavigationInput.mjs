export const NAVIGATION_INPUT_DEFAULTS=Object.freeze({
  joystickDeadZone:.14,
  arrivalRadius:24,
  slowRadius:180
});

export const clamp=(value,min,max)=>Math.min(max,Math.max(min,value));

export function normalizeJoystickVector(dx,dy,radius,{
  deadZone=NAVIGATION_INPUT_DEFAULTS.joystickDeadZone
}={}){
  const safeRadius=Math.max(1,Number(radius)||1);
  const x=(Number(dx)||0)/safeRadius;
  const y=(Number(dy)||0)/safeRadius;
  const rawMagnitude=Math.hypot(x,y);
  const cappedMagnitude=Math.min(1,rawMagnitude);
  const safeDeadZone=clamp(Number(deadZone)||0,0,.95);

  if(rawMagnitude<=safeDeadZone){
    return {x:0,y:0,magnitude:0,rawMagnitude:cappedMagnitude};
  }

  const directionX=x/rawMagnitude;
  const directionY=y/rawMagnitude;
  const magnitude=clamp((cappedMagnitude-safeDeadZone)/(1-safeDeadZone),0,1);

  return {
    x:directionX*magnitude,
    y:directionY*magnitude,
    magnitude,
    rawMagnitude:cappedMagnitude
  };
}

export function screenPointToWorld(clientX,clientY,{
  viewportLeft=0,
  viewportTop=0,
  viewportWidth=0,
  viewportHeight=0,
  cameraX=0,
  cameraY=0,
  zoom=1,
  worldWidth=1,
  worldHeight=1,
  marginX=0,
  marginY=0
}={}){
  const safeZoom=Math.max(.1,Number(zoom)||1);
  const x=Number(cameraX||0)+(Number(clientX||0)-Number(viewportLeft||0)-Number(viewportWidth||0)/2)/safeZoom;
  const y=Number(cameraY||0)+(Number(clientY||0)-Number(viewportTop||0)-Number(viewportHeight||0)/2)/safeZoom;
  const mx=Math.max(0,Number(marginX)||0);
  const my=Math.max(0,Number(marginY)||0);
  const ww=Math.max(mx*2+1,Number(worldWidth)||1);
  const wh=Math.max(my*2+1,Number(worldHeight)||1);

  return {
    x:clamp(x,mx,ww-mx),
    y:clamp(y,my,wh-my)
  };
}

export function targetNavigationVector(player,target,{
  arrivalRadius=NAVIGATION_INPUT_DEFAULTS.arrivalRadius,
  slowRadius=NAVIGATION_INPUT_DEFAULTS.slowRadius
}={}){
  if(!target)return {x:0,y:0,magnitude:0,remaining:0,arrived:true};

  const dx=Number(target.x||0)-Number(player?.x||0);
  const dy=Number(target.y||0)-Number(player?.y||0);
  const remaining=Math.hypot(dx,dy);
  const arrival=Math.max(1,Number(arrivalRadius)||1);
  const slow=Math.max(arrival+1,Number(slowRadius)||arrival+1);

  if(remaining<=arrival){
    return {x:0,y:0,magnitude:0,remaining,arrived:true};
  }

  const magnitude=clamp(remaining/slow,.12,1);
  return {
    x:dx/remaining*magnitude,
    y:dy/remaining*magnitude,
    magnitude,
    remaining,
    arrived:false
  };
}
