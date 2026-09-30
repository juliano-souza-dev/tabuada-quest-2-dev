export const DIRECTION_KEYS=Object.freeze(["n","ne","e","se","s","sw","w","nw"]);
const CENTERS=Object.freeze({n:0,ne:45,e:90,se:135,s:180,sw:-135,w:-90,nw:-45});
export function normalizeHeading(value=0){return ((Number(value||0)+180)%360+360)%360-180}
export function angularDistance(a,b){return Math.abs(normalizeHeading(Number(a||0)-Number(b||0)))}
export function directionForHeading(heading,current=null,{hysteresis=7}={}){
 const angle=normalizeHeading(heading),hold=Math.max(0,Number(hysteresis)||0);
 if(current&&DIRECTION_KEYS.includes(current)&&angularDistance(angle,CENTERS[current])<=22.5+hold)return current;
 let best="n",dist=Infinity;for(const key of DIRECTION_KEYS){const d=angularDistance(angle,CENTERS[key]);if(d<dist){best=key;dist=d}}return best;
}
export function resolveDirectionalSource(directions,key,fallback=""){if(!directions||typeof directions!=="object")return String(fallback||"");const k=DIRECTION_KEYS.includes(key)?key:"n";return String(directions[k]||directions.n||fallback||"")}
export function normalizeAtlasRegion(raw={}){
 return {x:Math.max(0,Number(raw.x)||0),y:Math.max(0,Number(raw.y)||0),width:Math.max(1,Number(raw.width)||1),height:Math.max(1,Number(raw.height)||1)};
}
export function resolveDirectionalRegion(sprite,key){
 if(!sprite||typeof sprite!=="object"||!sprite.src)return null;
 const k=DIRECTION_KEYS.includes(key)?key:"n";
 const raw=sprite.regions?.[k]||sprite.regions?.n;
 if(!raw)return null;
 return {src:String(sprite.src),direction:k,...normalizeAtlasRegion(raw),imageWidth:Math.max(1,Number(sprite.imageWidth)||1),imageHeight:Math.max(1,Number(sprite.imageHeight)||1)};
}
export function directionalRegionStyle(sprite,key){
 const r=resolveDirectionalRegion(sprite,key);if(!r)return null;
 const sx=100/r.width,sy=100/r.height;
 return {backgroundImage:'url("'+r.src.replace(/["\\]/g,"")+'")',backgroundSize:(r.imageWidth*sx)+"% "+(r.imageHeight*sy)+"%",backgroundPosition:(-r.x*sx)+"% "+(-r.y*sy)+"%",backgroundRepeat:"no-repeat"};
}
