const clamp=(value,min,max)=>Math.min(max,Math.max(min,value));
const finite=(value,fallback=0)=>Number.isFinite(Number(value))?Number(value):fallback;

export function normalizePlayerMaxSpeed(value,fallback=420){
  return clamp(finite(value,fallback)||fallback,60,1000);
}

export function stepPlayerVelocity(velocity={},input={},maxSpeed=420,dt=1/60){
  const speedLimit=normalizePlayerMaxSpeed(maxSpeed);
  const x=finite(input.x);
  const y=finite(input.y);
  const magnitude=Math.hypot(x,y);
  const scale=magnitude>1?1/magnitude:1;
  const ix=x*scale;
  const iy=y*scale;
  const inputMagnitude=clamp(Math.hypot(ix,iy),0,1);

  const targetVx=ix*speedLimit;
  const targetVy=iy*speedLimit;
  const step=Math.max(.001,Math.min(.04,finite(dt,1/60)));
  const response=1-Math.exp(-step*(inputMagnitude>.001?6.8:3.4));

  let vx=finite(velocity.vx)+(targetVx-finite(velocity.vx))*response;
  let vy=finite(velocity.vy)+(targetVy-finite(velocity.vy))*response;
  const current=Math.hypot(vx,vy);
  if(current>speedLimit){
    const cap=speedLimit/current;
    vx*=cap;
    vy*=cap;
  }

  return {vx,vy,maxSpeed:speedLimit};
}
