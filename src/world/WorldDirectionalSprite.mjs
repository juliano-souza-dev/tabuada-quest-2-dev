export const DIRECTION_KEYS=Object.freeze(["n","ne","e","se","s","sw","w","nw"]);

const CENTERS=Object.freeze({
  n:0,
  ne:45,
  e:90,
  se:135,
  s:180,
  sw:-135,
  w:-90,
  nw:-45
});

export function normalizeHeading(value=0){
  return ((Number(value||0)+180)%360+360)%360-180;
}

export function angularDistance(a,b){
  return Math.abs(normalizeHeading(Number(a||0)-Number(b||0)));
}

export function directionForHeading(heading,current=null,{hysteresis=7}={}){
  const angle=normalizeHeading(heading);
  const hold=Math.max(0,Number(hysteresis)||0);

  if(current&&DIRECTION_KEYS.includes(current)){
    const currentCenter=CENTERS[current];
    if(angularDistance(angle,currentCenter)<=22.5+hold)return current;
  }

  let best="n";
  let bestDistance=Infinity;
  for(const key of DIRECTION_KEYS){
    const d=angularDistance(angle,CENTERS[key]);
    if(d<bestDistance){
      best=key;
      bestDistance=d;
    }
  }
  return best;
}

export function resolveDirectionalSource(directions,key,fallback=""){
  if(!directions||typeof directions!=="object")return String(fallback||"");
  const normalized=DIRECTION_KEYS.includes(key)?key:"n";
  return String(directions[normalized]||directions.n||fallback||"");
}
