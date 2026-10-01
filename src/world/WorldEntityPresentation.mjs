export const ENTITY_DEPTH_PRESETS=Object.freeze({
  far:Object.freeze({depth:"far",parallax:0.2,scale:0.55,opacity:0.45,blur:1.5,tint:"#6fa8dc",tintStrength:0.28,shadow:0.08}),
  gameplay:Object.freeze({depth:"gameplay",parallax:1,scale:1,opacity:1,blur:0,tint:"#ffffff",tintStrength:0,shadow:0.38}),
  foreground:Object.freeze({depth:"foreground",parallax:1.5,scale:1.3,opacity:1,blur:0,tint:"#ffffff",tintStrength:0,shadow:0.72})
});

const clamp=(value,min,max)=>Math.min(max,Math.max(min,value));
const number=(value,fallback)=>Number.isFinite(Number(value))?Number(value):fallback;
const hex=value=>/^#[0-9a-f]{6}$/i.test(String(value||""))?String(value):"#ffffff";

export function normalizeDepthPresentation(input={}){
  const depth=ENTITY_DEPTH_PRESETS[input.depth]?input.depth:"gameplay";
  const defaults=ENTITY_DEPTH_PRESETS[depth];
  return {
    depth,
    parallax:clamp(number(input.parallax,defaults.parallax),0.05,3),
    scale:clamp(number(input.scale,defaults.scale),0.1,3),
    opacity:clamp(number(input.opacity,defaults.opacity),0.05,1),
    blur:clamp(number(input.blur,defaults.blur),0,12),
    tint:hex(input.tint??defaults.tint),
    tintStrength:clamp(number(input.tintStrength,defaults.tintStrength),0,1),
    shadow:clamp(number(input.shadow,defaults.shadow),0,1)
  };
}

export function applyDepthPreset(input={},depth="gameplay"){
  const id=ENTITY_DEPTH_PRESETS[depth]?depth:"gameplay";
  return normalizeDepthPresentation({...input,...ENTITY_DEPTH_PRESETS[id],depth:id});
}

export function resolveEntityPresentation(entity={}){
  const renderMode=entity.renderMode||(entity.src?"sprite":"logical");
  return {
    renderMode,
    hasSprite:renderMode==="sprite"&&Boolean(entity.src),
    showLabel:entity.showLabel===true,
    visualChrome:false,
    ...normalizeDepthPresentation(entity.presentation||{})
  };
}

export function computeParallaxPoint(entity={},camera={},presentation=resolveEntityPresentation(entity)){
  const cx=number(camera.x,0),cy=number(camera.y,0);
  const x=number(entity.x,0),y=number(entity.y,0);
  const factor=number(presentation.parallax,1);
  return {x:cx+(x-cx)*factor,y:cy+(y-cy)*factor};
}

export function isLogicalOnlyEntity(entity={}){
  return resolveEntityPresentation(entity).renderMode==="logical";
}
