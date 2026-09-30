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

export const DEFAULT_POLYGON_POINTS=Object.freeze([
  Object.freeze({x:-.5,y:-.5}),
  Object.freeze({x:.5,y:-.5}),
  Object.freeze({x:.5,y:.5}),
  Object.freeze({x:-.5,y:.5})
]);

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

export function normalizePolygonPoints(points=[]){
  const out=[];
  for(const point of Array.isArray(points)?points:[]){
    if(!point)continue;
    const x=clamp(finite(point.x,0),-.75,.75);
    const y=clamp(finite(point.y,0),-.75,.75);
    const previous=out[out.length-1];
    if(previous&&Math.hypot(previous.x-x,previous.y-y)<.001)continue;
    out.push({x,y});
    if(out.length>=64)break;
  }
  if(out.length>2){
    const first=out[0],last=out[out.length-1];
    if(Math.hypot(first.x-last.x,first.y-last.y)<.001)out.pop();
  }
  return out;
}

export function polygonFromScale(scaleX=.72,scaleY=.5){
  const sx=clamp(finite(scaleX,.72),.1,1.5)/2;
  const sy=clamp(finite(scaleY,.5),.1,1.5)/2;
  return [
    {x:-sx,y:-sy},
    {x:sx,y:-sy},
    {x:sx,y:sy},
    {x:-sx,y:sy}
  ];
}

export function normalizeEntityCollision(input={},entity={}){
  const defaults=defaultCollisionForEntity(entity);
  const explicitActive=input.active!==undefined
    ?input.active!==false
    :(entity.collidable!==undefined?entity.collidable!==false:defaults.active);
  const shape=["ellipse","box","polygon"].includes(input.shape)?input.shape:defaults.shape;
  const points=normalizePolygonPoints(input.points);
  return {
    active:Boolean(explicitActive),
    shape,
    scaleX:clamp(finite(input.scaleX,defaults.scaleX),.1,1.5),
    scaleY:clamp(finite(input.scaleY,defaults.scaleY),.1,1.5),
    padding:clamp(finite(input.padding,defaults.padding),0,500),
    points
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

function closestPointOnSegment(point,a,b){
  const abx=b.x-a.x;
  const aby=b.y-a.y;
  const denom=abx*abx+aby*aby;
  if(denom<=1e-9)return {x:a.x,y:a.y,t:0};
  const t=clamp(((point.x-a.x)*abx+(point.y-a.y)*aby)/denom,0,1);
  return {x:a.x+abx*t,y:a.y+aby*t,t};
}

function pointInPolygon(point,points){
  let inside=false;
  for(let i=0,j=points.length-1;i<points.length;j=i++){
    const a=points[i],b=points[j];
    const intersects=((a.y>point.y)!==(b.y>point.y))
      &&(point.x<(b.x-a.x)*(point.y-a.y)/((b.y-a.y)||1e-9)+a.x);
    if(intersects)inside=!inside;
  }
  return inside;
}

function polygonLocalPoints(entity,collision){
  const width=Math.max(1,finite(entity.width,96));
  const height=Math.max(1,finite(entity.height,96));
  return collision.points.map(point=>({
    x:point.x*width,
    y:point.y*height
  }));
}

function resolveCircleVsPolygon(local,radius,entity,collision,localVelocity){
  const points=polygonLocalPoints(entity,collision);
  if(points.length<3){
    return {collided:false,pushX:0,pushY:0,penetration:0};
  }

  const clearance=Math.max(0,finite(radius))+collision.padding;
  let minX=Infinity,minY=Infinity,maxX=-Infinity,maxY=-Infinity;
  for(const p of points){
    minX=Math.min(minX,p.x);minY=Math.min(minY,p.y);
    maxX=Math.max(maxX,p.x);maxY=Math.max(maxY,p.y);
  }
  if(local.x<minX-clearance||local.x>maxX+clearance||local.y<minY-clearance||local.y>maxY+clearance){
    return {collided:false,pushX:0,pushY:0,penetration:0};
  }

  const inside=pointInPolygon(local,points);
  let best=null;
  let bestDistance=Infinity;

  for(let i=0;i<points.length;i++){
    const a=points[i];
    const b=points[(i+1)%points.length];
    const closest=closestPointOnSegment(local,a,b);
    const dx=local.x-closest.x;
    const dy=local.y-closest.y;
    const distance=Math.hypot(dx,dy);
    if(distance<bestDistance){
      bestDistance=distance;
      best={closest,dx,dy,a,b};
    }
  }

  if(!best)return {collided:false,pushX:0,pushY:0,penetration:0};
  if(!inside&&bestDistance>=clearance){
    return {collided:false,pushX:0,pushY:0,penetration:0};
  }

  let dirX,dirY,penetration;
  if(inside){
    if(bestDistance>1e-6){
      dirX=(best.closest.x-local.x)/bestDistance;
      dirY=(best.closest.y-local.y)/bestDistance;
    }else{
      const edgeX=best.b.x-best.a.x;
      const edgeY=best.b.y-best.a.y;
      const candidateA=normalizeVector(-edgeY,edgeX,-localVelocity.x,-localVelocity.y);
      const candidateB={x:-candidateA.x,y:-candidateA.y};
      const probe=.5;
      const aInside=pointInPolygon({x:local.x+candidateA.x*probe,y:local.y+candidateA.y*probe},points);
      const out=aInside?candidateB:candidateA;
      dirX=out.x;dirY=out.y;
    }
    penetration=bestDistance+clearance;
  }else{
    if(bestDistance>1e-6){
      dirX=best.dx/bestDistance;
      dirY=best.dy/bestDistance;
    }else{
      const fallback=normalizeVector(-localVelocity.x,-localVelocity.y,0,-1);
      dirX=fallback.x;dirY=fallback.y;
    }
    penetration=clearance-bestDistance;
  }

  return {
    collided:true,
    pushX:dirX*penetration,
    pushY:dirY*penetration,
    penetration
  };
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

  let pushX=0,pushY=0,penetration=0;

  if(collision.shape==="polygon"){
    const hit=resolveCircleVsPolygon(local,radius,entity,collision,localVelocity);
    if(!hit.collided){
      return {collided:false,x:point.x,y:point.y,normalX:0,normalY:0,penetration:0};
    }
    pushX=hit.pushX;
    pushY=hit.pushY;
    penetration=hit.penetration;
  }else{
    const halfW=Math.max(4,finite(entity.width,96)*collision.scaleX/2+Math.max(0,finite(radius))+collision.padding);
    const halfH=Math.max(4,finite(entity.height,96)*collision.scaleY/2+Math.max(0,finite(radius))+collision.padding);

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
