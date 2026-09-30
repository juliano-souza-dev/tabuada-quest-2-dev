const clamp=(value,min,max)=>Math.min(max,Math.max(min,value));
const finite=(value,fallback=0)=>Number.isFinite(Number(value))?Number(value):fallback;

const VALID_ACTIONS=new Set(["auto","none","collect","enter-scene"]);

export function inferCollisionAction(entity={},collision={}){
  const explicit=VALID_ACTIONS.has(String(collision.action||""))
    ?String(collision.action)
    :"auto";
  if(explicit!=="auto")return explicit;

  const type=String(entity.type||"object");
  const category=String(entity.effect?.category||"");
  if(type==="treasure"||type==="barrel")return "collect";
  if((type==="location"||type==="island"||category==="island")&&entity.scene)return "enter-scene";
  if(entity.collectible===true||String(entity.interaction||"")==="collect")return "collect";
  return "none";
}

export function defaultCollision(entity={}){
  const type=String(entity.type||"object");
  const category=String(entity.effect?.category||"");
  const isBackground=type==="background"||category==="background";
  const isIsland=type==="island"||category==="island"||(type==="location"&&Boolean(entity.scene));
  const isCollectible=type==="treasure"||type==="barrel";
  const isShip=type==="ship";

  if(isBackground)return {active:false,shape:"box",scaleX:1,scaleY:1,padding:0,action:"none",message:""};
  if(isIsland)return {active:true,shape:"ellipse",scaleX:.72,scaleY:.52,padding:10,action:"auto",message:""};
  if(isCollectible)return {active:true,shape:"ellipse",scaleX:.72,scaleY:.72,padding:4,action:"auto",message:""};
  if(isShip)return {active:true,shape:"ellipse",scaleX:.46,scaleY:.60,padding:8,action:"none",message:""};
  return {active:false,shape:"ellipse",scaleX:.72,scaleY:.72,padding:0,action:"auto",message:""};
}

export function normalizeCollision(input={},entity={}){
  const defaults=defaultCollision(entity);
  const shape=["ellipse","box"].includes(String(input.shape||""))?String(input.shape):defaults.shape;
  const action=VALID_ACTIONS.has(String(input.action||""))?String(input.action):defaults.action;
  return {
    active:input.active===undefined?Boolean(defaults.active):input.active!==false,
    shape,
    scaleX:clamp(finite(input.scaleX,defaults.scaleX),.1,1.5),
    scaleY:clamp(finite(input.scaleY,defaults.scaleY),.1,1.5),
    padding:clamp(finite(input.padding,defaults.padding),0,500),
    action,
    message:String(input.message??defaults.message??"").slice(0,240)
  };
}

export function collisionMessage(entity={},collision={}){
  const action=inferCollisionAction(entity,collision);
  const label=String(entity.label||entity.id||"objeto");
  if(collision.message)return collision.message;
  if(action==="collect")return "Você encontrou "+label+".";
  if(action==="enter-scene")return "Você chegou a "+label+".";
  return "";
}

export function collisionActionLabel(entity={},collision={}){
  const action=inferCollisionAction(entity,collision);
  if(action==="collect")return "Recolher";
  if(action==="enter-scene")return "Acessar";
  return "";
}

function centerOf(entity={}){
  return {
    x:finite(entity.visualX,finite(entity.x,0)),
    y:finite(entity.visualY,finite(entity.y,0)),
    rotation:finite(entity.visualRotation,finite(entity.rotation,0))
  };
}

function toLocal(dx,dy,rotationDeg){
  const a=-rotationDeg*Math.PI/180;
  const c=Math.cos(a),s=Math.sin(a);
  return {x:dx*c-dy*s,y:dx*s+dy*c};
}

function toWorld(dx,dy,rotationDeg){
  const a=rotationDeg*Math.PI/180;
  const c=Math.cos(a),s=Math.sin(a);
  return {x:dx*c-dy*s,y:dx*s+dy*c};
}

function normalize(x,y,fallbackX=0,fallbackY=-1){
  const length=Math.hypot(x,y);
  if(length>1e-7)return {x:x/length,y:y/length};
  const fallbackLength=Math.hypot(fallbackX,fallbackY)||1;
  return {x:fallbackX/fallbackLength,y:fallbackY/fallbackLength};
}

export function resolveCircleVsEntity(point,radius,entity,collisionInput={}){
  const collision=normalizeCollision(collisionInput,entity);
  if(!collision.active)return {collided:false,x:point.x,y:point.y,normalX:0,normalY:0,penetration:0};

  const center=centerOf(entity);
  const local=toLocal(
    finite(point.x)-center.x,
    finite(point.y)-center.y,
    center.rotation
  );
  const circleRadius=Math.max(0,finite(radius));
  const halfW=Math.max(4,finite(entity.width,96)*collision.scaleX/2+circleRadius+collision.padding);
  const halfH=Math.max(4,finite(entity.height,96)*collision.scaleY/2+circleRadius+collision.padding);

  let pushX=0;
  let pushY=0;
  let penetration=0;

  if(collision.shape==="box"){
    if(Math.abs(local.x)>=halfW||Math.abs(local.y)>=halfH){
      return {collided:false,x:point.x,y:point.y,normalX:0,normalY:0,penetration:0};
    }
    const px=halfW-Math.abs(local.x);
    const py=halfH-Math.abs(local.y);
    if(px<py){
      pushX=(local.x>=0?1:-1)*px;
      penetration=px;
    }else{
      pushY=(local.y>=0?1:-1)*py;
      penetration=py;
    }
  }else{
    const nx=local.x/halfW;
    const ny=local.y/halfH;
    const q=Math.hypot(nx,ny);
    if(q>=1){
      return {collided:false,x:point.x,y:point.y,normalX:0,normalY:0,penetration:0};
    }

    let dirX=local.x;
    let dirY=local.y;
    if(Math.hypot(dirX,dirY)<1e-6){
      dirY=-1;
    }
    const denom=Math.sqrt((dirX*dirX)/(halfW*halfW)+(dirY*dirY)/(halfH*halfH))||1;
    const scale=1/denom;
    const edgeX=dirX*scale;
    const edgeY=dirY*scale;
    pushX=edgeX-local.x;
    pushY=edgeY-local.y;
    penetration=Math.hypot(pushX,pushY);
  }

  const worldPush=toWorld(pushX,pushY,center.rotation);
  const normal=normalize(worldPush.x,worldPush.y);
  return {
    collided:true,
    x:finite(point.x)+worldPush.x,
    y:finite(point.y)+worldPush.y,
    normalX:normal.x,
    normalY:normal.y,
    penetration
  };
}

export function removeVelocityIntoNormal(velocity,normalX,normalY){
  let vx=finite(velocity?.x);
  let vy=finite(velocity?.y);
  const inward=vx*normalX+vy*normalY;
  if(inward<0){
    vx-=normalX*inward;
    vy-=normalY*inward;
  }
  return {x:vx,y:vy};
}

export function chooseContourSide(normalX,normalY,desired={},preferredSide=0){
  if(preferredSide===1||preferredSide===-1)return preferredSide;
  const tx=-normalY;
  const ty=normalX;
  const dx=finite(desired.x);
  const dy=finite(desired.y);
  return dx*tx+dy*ty>=0?1:-1;
}

export function contourVelocity(velocity,normalX,normalY,desired={},{
  side=0,
  minSpeed=115,
  maxSpeed=260,
  strength=.72
}={}){
  const clean=removeVelocityIntoNormal(velocity,normalX,normalY);
  const chosen=chooseContourSide(normalX,normalY,desired,side);
  const tangent={x:-normalY*chosen,y:normalX*chosen};
  const current=clean.x*tangent.x+clean.y*tangent.y;
  const desiredLength=Math.hypot(finite(desired.x),finite(desired.y));
  const currentLength=Math.hypot(clean.x,clean.y);
  const target=clamp(Math.max(minSpeed,currentLength*.82,desiredLength*maxSpeed),minSpeed,maxSpeed);
  const delta=Math.max(0,target-current)*clamp(finite(strength,.72),0,1);
  return {
    x:clean.x+tangent.x*delta,
    y:clean.y+tangent.y*delta,
    side:chosen,
    tangentX:tangent.x,
    tangentY:tangent.y
  };
}
