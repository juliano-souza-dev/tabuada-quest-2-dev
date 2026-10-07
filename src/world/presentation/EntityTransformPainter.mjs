// DOM presentation for a composed entity visual frame.
export function paintEntityTransform(entity,visual,effect,effectFrame){
  entity.visualX=visual.x;
  entity.visualY=visual.y;
  entity.visualRotation=Number(entity.rotation||0);
  entity.el.style.left=visual.x+"px";
  entity.el.style.top=visual.y+"px";
  entity.el.style.opacity=String(effect.active?effectFrame.opacity:1);
  entity.el.style.transform=`translate(-50%,-50%) rotate(${visual.rotation}deg) skewX(${Number(entity.skewX||0)}deg) skewY(${Number(entity.skewY||0)}deg) scale(${visual.scaleX},${visual.scaleY})`;
  if(entity.nameEl){
    entity.nameEl.style.left=visual.x+"px";
    entity.nameEl.style.top=(visual.y+visual.nameOffset)+"px";
    entity.nameEl.hidden=entity.el.hidden===true;
  }
}
