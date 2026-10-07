// Presentation-only renderer for entity effects and atlas visibility.
export function paintEntityEffects({entity,effect,effectFrame,time,timelineAnimated,hasDirectionalSprite,renderer}){
  const img=entity.el.querySelector(":scope > img:not(.tq-world-island-depth-layer)");
  const canvas=entity.el.querySelector(".tq-world-entity__webgl");
  const blur=effect.active?Number(effectFrame.blur||0):0;
  const depthLayer=entity.el.querySelector(".tq-world-island-depth-layer");
  const maskedDepth=String(entity.type||"")==="island"&&Array.isArray(entity.depthMask?.points)&&entity.depthMask.points.length>=3;
  if(img)img.style.filter=maskedDepth?"drop-shadow(0 6px 4px #001a2e80)":`drop-shadow(0 6px 4px #001a2e80) blur(${blur}px)`;
  if(depthLayer)depthLayer.style.filter=`blur(${blur}px)`;

  const atlasMode=timelineAnimated||hasDirectionalSprite||entity.el.dataset.renderMode==="atlas";
  if(effect.active&&effect.renderer==="webgl"&&!atlasMode){
    const rendered=renderer?.render?.(time,effect,entity.width||96,entity.height||96)===true;
    if(canvas)canvas.hidden=!rendered;
    if(img)img.hidden=rendered;
  }else{
    if(canvas)canvas.hidden=true;
    if(img)img.hidden=atlasMode;
  }
}
