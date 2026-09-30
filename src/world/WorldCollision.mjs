const clamp=(value,min,max)=>Math.min(max,Math.max(min,value));
const finite=(value,fallback=0)=>Number.isFinite(Number(value))?Number(value):fallback;

export const COLLISION_TYPE_DEFAULTS=Object.freeze({
  location:Object.freeze({active:true,shape:"ellipse",scaleX:.72,scaleY:.50,padding:10}),
  island:Object.freeze({active:true,shape:"ellipse",scaleX:.72,scaleY:.50,padding:10}),
  ship:Object.freeze({active:true,shape:"ellipse",scaleX:.44,scaleY:.58,padding:6}),
  background:Object.freeze({active:false,shape:"box",scaleX:1,scaleY:1,padding:0}),
  barrel:Object.freeze({active:false,shape:"ellipse",scaleX:.72,scaleY:.72,padding:0}),
  treasure:Object.freeze({active:false,shape:"ellipse",scaleX:.72,scaleY:.72,padding:0}),
  object:Object.freeze({active:false,shape:"ellipse",scaleX:.72,scaleY:.72,padding:0})
});

export function defaultCollisionForEntity(entity={}){
  const effectCategory=String(entity.effect?.category||entity.effectCategory||"");
  const effectMode=String(entity.effect?.mode||"");
  if(effectCategory==="background"||effectMode==="horizonBlend"){
    return {...COLLISION_TYPE_DEFAULTS.background};
  }
  if(effectCategory==="island"){
    return {...COLLISION_TYPE_DEFAULTS.island};
  }
  const type=String(entity.type||"object");
  const defaults=COLLISION_TYPE_DEFAULTS[type]||COLLISION_TYPE_DEFAULTS.object;
  return {...defaults};
}

export function normalizeEntityCollision(input={},entity={}){
  const defaults=defaultCollisionForEntity(entity);
  const explicitActive=input.active!==undefined
    ?input.active!==false
    :(entity.collidable!==undefined?entity.collidable!==false:defaults.active);
  const shape=["ellipse","box"].includes(input.shape)?input.shape:defaults.shape;
  return {
    active:Boolean(explicitActive),
    shape,
    scaleX:clamp(finite(input.scaleX,defaults.scaleX),.1,1.5),
    scaleY:clamp(finite(input.scaleY,defaults.scaleY),.1,1.5),
    padding:clamp(finite(input.padding,defaults.padding),0,500)
  };
}

export function collisionCenter(entity={}){
  return {
    x:finite(entity.visualX,finite(entity.x,0)),
    y:finite(entity.visualY,finite(entity.y,0)),
    rotation:finite(entity.visualRotation,finite(entity.rotation,0))
  };
}

function rotateIntoLocal(dx,dy,rotationDeg){
  const a=-rotationDeg*Math.PI/180;
  const c=Math.cos(a),s=Math.sin(a);
  return {x:dx*c-dy*s,y:dx*s+dy*c};
}

function rotateIntoWorld(dx,dy,rotationDeg){
  const a=rotationDeg*Math.PI/180;
  const c=Math.cos(a),s=Math.sin(a);
  return {x:dx*c-dy*s,y:dx*s+dy*c};
}

function normalizeVector(x,y,fallbackX=0,fallbackY=-1){
  const len=Math.hypot(x,y);
  if(len>1e-6)return {x:x/len,y:y/len};
  const fallbackLen=Math.hypot(fallbackX,fallbackY)||1;
  return {x:fallbackX/fallbackLen,y:fallbackY/fallbackLen};
}

export function resolveCircleVsEntity(point,radius,entity,collisionInput={},velocity={x:0,y:0}){
  const collision=normalizeEntityCollision(collisionInput,entity);
  if(!collision.active)return {collided:false,x:point.x,y:point.y,normalX:0,normalY:0,penetration:0};

  const center=collisionCenter(entity);
  const local=rotateIntoLocal(
    finite(point.x)-center.x,
    finite(point.y)-center.y,
    center.rotation
  );
  const localVelocity=rotateIntoLocal(
    finite(velocity.x),
    finite(velocity.y),
    center.rotation
  );

  const halfW=Math.max(4,finite(entity.width,96)*collision.scaleX/2+Math.max(0,finite(radius))+collision.padding);
  const halfH=Math.max(4,finite(entity.height,96)*collision.scaleY/2+Math.max(0,finite(radius))+collision.padding);

  let pushX=0,pushY=0,penetration=0;

  if(collision.shape==="box"){
    if(Math.abs(local.x)>=halfW||Math.abs(local.y)>=halfH){
      return {collided:false,x:point.x,y:point.y,normalX:0,normalY:0,penetration:0};
    }

    const left=Math.abs(local.x+halfW);
    const right=Math.abs(halfW-local.x);
    const top=Math.abs(local.y+halfH);
    const bottom=Math.abs(halfH-local.y);
    const min=Math.min(left,right,top,bottom);

    if(min===left){pushX=-left;pushY=0;penetration=left}
    else if(min===right){pushX=right;pushY=0;penetration=right}
    else if(min===top){pushX=0;pushY=-top;penetration=top}
    else {pushX=0;pushY=bottom;penetration=bottom}
  }else{
    const nx=local.x/halfW;
    const ny=local.y/halfH;
    const q=Math.hypot(nx,ny);
    if(q>=1){
      return {collided:false,x:point.x,y:point.y,normalX:0,normalY:0,penetration:0};
    }

    let dirX=local.x;
    let dirY=local.y;
    if(Math.hypot(dirX,dirY)<1e-5){
      dirX=-localVelocity.x;
      dirY=-localVelocity.y;
      if(Math.hypot(dirX,dirY)<1e-5)dirY=-1;
    }

    const denom=Math.sqrt((dirX*dirX)/(halfW*halfW)+(dirY*dirY)/(halfH*halfH))||1;
    const scale=1/denom;
    const targetX=dirX*scale;
    const targetY=dirY*scale;
    pushX=targetX-local.x;
    pushY=targetY-local.y;
    penetration=Math.hypot(pushX,pushY);
  }

  const pushWorld=rotateIntoWorld(pushX,pushY,center.rotation);
  const normal=normalizeVector(pushWorld.x,pushWorld.y,-velocity.x,-velocity.y);
  return {
    collided:true,
    x:finite(point.x)+pushWorld.x,
    y:finite(point.y)+pushWorld.y,
    normalX:normal.x,
    normalY:normal.y,
    penetration
  };
}

export function resolvePlayerCollisions(position,radius,entities=[],velocity={x:0,y:0},{iterations=4}={}){
  const result={
    x:finite(position.x),
    y:finite(position.y),
    vx:finite(velocity.x),
    vy:finite(velocity.y),
    hits:[]
  };

  const maxIterations=clamp(Math.round(finite(iterations,4)),1,8);
  for(let pass=0;pass<maxIterations;pass++){
    let changed=false;
    for(const entity of entities){
      if(!entity)continue;
      const collision=normalizeEntityCollision(entity.collision||{},entity);
      if(!collision.active)continue;

      const hit=resolveCircleVsEntity(
        {x:result.x,y:result.y},
        radius,
        entity,
        collision,
        {x:result.vx,y:result.vy}
      );
      if(!hit.collided)continue;

      changed=true;
      result.x=hit.x;
      result.y=hit.y;

      const inward=result.vx*hit.normalX+result.vy*hit.normalY;
      if(inward<0){
        result.vx-=hit.normalX*inward;
        result.vy-=hit.normalY*inward;
      }

      if(!result.hits.includes(entity.id))result.hits.push(entity.id);
    }
    if(!changed)break;
  }
  return result;
}
