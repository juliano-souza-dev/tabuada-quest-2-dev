export const DIRECTION_KEYS=Object.freeze([
  "n","nne","ne","ene",
  "e","ese","se","sse",
  "s","ssw","sw","wsw",
  "w","wnw","nw","nnw"
]);

export const LEGACY_DIRECTION_KEYS=Object.freeze(["n","ne","e","se","s","sw","w","nw"]);

const CENTERS=Object.freeze({
  n:0,nne:22.5,ne:45,ene:67.5,
  e:90,ese:112.5,se:135,sse:157.5,
  s:180,ssw:-157.5,sw:-135,wsw:-112.5,
  w:-90,wnw:-67.5,nw:-45,nnw:-22.5
});

const LEGACY_FALLBACK=Object.freeze({
  n:"n",nne:"n",ne:"ne",ene:"ne",
  e:"e",ese:"se",se:"se",sse:"s",
  s:"s",ssw:"sw",sw:"sw",wsw:"w",
  w:"w",wnw:"nw",nw:"nw",nnw:"n"
});

export function normalizeHeading(value=0){
  return ((Number(value||0)+180)%360+360)%360-180;
}

export function angularDistance(a,b){
  return Math.abs(normalizeHeading(Number(a||0)-Number(b||0)));
}

export function directionForHeading(heading,current=null,{hysteresis=4}={}){
  const angle=normalizeHeading(heading);
  const hold=Math.max(0,Number(hysteresis)||0);

  if(current&&DIRECTION_KEYS.includes(current)){
    const center=CENTERS[current];
    if(angularDistance(angle,center)<=11.25+hold)return current;
  }

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
  const requested=DIRECTION_KEYS.includes(key)?key:"n";
  const legacy=LEGACY_FALLBACK[requested]||"n";
  return String(directions[requested]||directions[legacy]||directions.n||fallback||"");
}

export function normalizeAtlasRegion(raw={}){
  const points=Array.isArray(raw.points)
    ? raw.points
      .map(point=>({x:Number(point?.x),y:Number(point?.y)}))
      .filter(point=>Number.isFinite(point.x)&&Number.isFinite(point.y))
    : [];

  if(points.length>=3){
    const xs=points.map(point=>point.x);
    const ys=points.map(point=>point.y);
    const x=Math.max(0,Math.min(...xs));
    const y=Math.max(0,Math.min(...ys));
    const right=Math.max(...xs);
    const bottom=Math.max(...ys);
    return {
      x,
      y,
      width:Math.max(1,right-x),
      height:Math.max(1,bottom-y),
      points
    };
  }

  return {
    x:Math.max(0,Number(raw.x)||0),
    y:Math.max(0,Number(raw.y)||0),
    width:Math.max(1,Number(raw.width)||1),
    height:Math.max(1,Number(raw.height)||1),
    points:[]
  };
}

export function resolveDirectionalRegion(sprite,key){
  if(!sprite||typeof sprite!=="object"||!sprite.src)return null;

  const requested=DIRECTION_KEYS.includes(key)?key:"n";
  const regions=sprite.regions&&typeof sprite.regions==="object"?sprite.regions:{};
  const legacy=LEGACY_FALLBACK[requested];
  const firstAvailable=DIRECTION_KEYS.map(direction=>regions[direction]).find(Boolean)
    ||LEGACY_DIRECTION_KEYS.map(direction=>regions[direction]).find(Boolean);
  const raw=regions[requested]||regions[legacy]||regions.n||firstAvailable;
  if(!raw)return null;

  const region=normalizeAtlasRegion(raw);
  const imageWidth=Math.max(region.x+region.width,Number(sprite.imageWidth)||0,1);
  const imageHeight=Math.max(region.y+region.height,Number(sprite.imageHeight)||0,1);

  return {
    src:String(sprite.src),
    direction:requested,
    resolvedDirection:regions[requested]?requested:(regions[legacy]?legacy:(regions.n?"n":"fallback")),
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

  const polygon=Array.isArray(region.points)&&region.points.length>=3
    ? region.points.map(point=>{
      const x=((point.x-region.x)/region.width)*100;
      const y=((point.y-region.y)/region.height)*100;
      return Math.max(0,Math.min(100,x)).toFixed(3)+"% "+Math.max(0,Math.min(100,y)).toFixed(3)+"%";
    }).join(",")
    : "";
  const clipPath=polygon?"polygon("+polygon+")":"none";

  return {
    backgroundImage:'url("'+region.src.replace(/["\\]/g,"")+'")',
    backgroundSize:sizeX+"% "+sizeY+"%",
    backgroundPosition:positionX+"% "+positionY+"%",
    backgroundRepeat:"no-repeat",
    clipPath,
    WebkitClipPath:clipPath
  };
}
