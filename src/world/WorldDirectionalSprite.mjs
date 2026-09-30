export const DIRECTION_KEYS=Object.freeze(["n","ne","e","se","s","sw","w","nw"]);
const CENTERS=Object.freeze({n:0,ne:45,e:90,se:135,s:180,sw:-135,w:-90,nw:-45});

export function normalizeHeading(value=0){
  return ((Number(value||0)+180)%360+360)%360-180;
}

export function angularDistance(a,b){
  return Math.abs(normalizeHeading(Number(a||0)-Number(b||0)));
}

export function directionForHeading(heading,current=null,{hysteresis=7}={}){
  const angle=normalizeHeading(heading);
  const hold=Math.max(0,Number(hysteresis)||0);
  if(current&&DIRECTION_KEYS.includes(current)&&angularDistance(angle,CENTERS[current])<=22.5+hold)return current;

  let best="n";
  let distance=Infinity;
  for(const key of DIRECTION_KEYS){
    const next=angularDistance(angle,CENTERS[key]);
    if(next<distance){
      best=key;
      distance=next;
    }
  }
  return best;
}

export function resolveDirectionalSource(directions,key,fallback=""){
  if(!directions||typeof directions!=="object")return String(fallback||"");
  const normalized=DIRECTION_KEYS.includes(key)?key:"n";
  return String(directions[normalized]||directions.n||fallback||"");
}

export function normalizeAtlasRegion(raw={}){
  return {
    x:Math.max(0,Number(raw.x)||0),
    y:Math.max(0,Number(raw.y)||0),
    width:Math.max(1,Number(raw.width)||1),
    height:Math.max(1,Number(raw.height)||1)
  };
}

export function resolveDirectionalRegion(sprite,key){
  if(!sprite||typeof sprite!=="object"||!sprite.src)return null;

  const requested=DIRECTION_KEYS.includes(key)?key:"n";
  const raw=sprite.regions?.[requested]||sprite.regions?.n;
  if(!raw)return null;

  const region=normalizeAtlasRegion(raw);
  const imageWidth=Math.max(region.x+region.width,Number(sprite.imageWidth)||0,1);
  const imageHeight=Math.max(region.y+region.height,Number(sprite.imageHeight)||0,1);

  return {
    src:String(sprite.src),
    direction:requested,
    ...region,
    imageWidth,
    imageHeight
  };
}

export function directionalRegionStyle(sprite,key){
  const region=resolveDirectionalRegion(sprite,key);
  if(!region)return null;

  const sizeX=(region.imageWidth/region.width)*100;
  const sizeY=(region.imageHeight/region.height)*100;
  const positionX=region.imageWidth<=region.width
    ? 0
    : (region.x/(region.imageWidth-region.width))*100;
  const positionY=region.imageHeight<=region.height
    ? 0
    : (region.y/(region.imageHeight-region.height))*100;

  return {
    backgroundImage:'url("'+region.src.replace(/["\\]/g,"")+'")',
    backgroundSize:sizeX+"% "+sizeY+"%",
    backgroundPosition:positionX+"% "+positionY+"%",
    backgroundRepeat:"no-repeat"
  };
}
