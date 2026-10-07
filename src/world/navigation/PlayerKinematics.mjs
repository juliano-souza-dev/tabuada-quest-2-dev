// Pure kinematics: world collision and interaction state remain in WorldRuntime.
export function integratePlayerVelocity({vx=0,vy=0,input,acceleration=1100,maxSpeed=420,minSpeed=0,braking=.12,dt}){
  const clamp=(value,min,max)=>Math.min(max,Math.max(min,value));
  const accel=Math.max(100,Number(acceleration)||1100);
  const limit=Math.max(40,Number(maxSpeed)||420);
  const floor=clamp(Number(minSpeed)||0,0,limit);
  const drag=Math.pow(clamp(Number(braking??.12),.01,.98),dt);
  let nextVx=(vx+(Number(input?.x)||0)*accel*dt)*drag;
  let nextVy=(vy+(Number(input?.y)||0)*accel*dt)*drag;
  let speed=Math.hypot(nextVx,nextVy);
  const steering=Math.hypot(Number(input?.x)||0,Number(input?.y)||0);
  if(steering>.001&&speed>0&&speed<floor){
    const scale=floor/speed;
    nextVx*=scale;nextVy*=scale;speed=floor;
  }
  if(speed>limit){
    const scale=limit/speed;
    nextVx*=scale;nextVy*=scale;
  }
  return {vx:nextVx,vy:nextVy};
}
