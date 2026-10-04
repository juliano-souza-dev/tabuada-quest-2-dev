export const ENTITY_EFFECT_CATEGORIES=Object.freeze({
  generic:Object.freeze({label:"Genérico"}),
  treasure:Object.freeze({label:"Baú / tesouro"}),
  "sea-item":Object.freeze({label:"Item ao mar"}),
  island:Object.freeze({label:"Ilha"}),
  background:Object.freeze({label:"Background / profundidade"}),
  ship:Object.freeze({label:"Navio aleatório"})
});

export const ENTITY_EFFECT_PRESETS=Object.freeze({
  none:Object.freeze({
    label:"Sem efeito",category:"generic",active:false,renderer:"dom",mode:"none",
    speed:50,intensity:0,range:0,parallax:1,opacity:1,blur:0,distortion:0,glow:0,rotateToPath:false
  }),
  float:Object.freeze({
    label:"Flutuar suave",category:"sea-item",active:true,renderer:"dom",mode:"float",
    speed:38,intensity:32,range:22,parallax:1,opacity:1,blur:0,distortion:0,glow:0,rotateToPath:false
  }),
  "sea-drift":Object.freeze({
    label:"Deriva ao mar",category:"sea-item",active:true,renderer:"dom",mode:"drift",
    speed:30,intensity:36,range:90,parallax:1,opacity:1,blur:0,distortion:0,glow:0,rotateToPath:false
  }),
  "treasure-glint":Object.freeze({
    label:"Baú brilhando · WebGL",category:"treasure",active:true,renderer:"webgl",mode:"float",
    speed:34,intensity:28,range:16,parallax:1,opacity:1,blur:0,distortion:10,glow:76,rotateToPath:false
  }),
  "sea-webgl":Object.freeze({
    label:"Ondulação · WebGL",category:"sea-item",active:true,renderer:"webgl",mode:"float",
    speed:48,intensity:38,range:24,parallax:1,opacity:1,blur:0,distortion:34,glow:24,rotateToPath:false
  }),
  "island-depth":Object.freeze({
    label:"Ilha com profundidade",category:"island",active:true,renderer:"parallax",mode:"parallax",
    speed:0,intensity:12,range:0,parallax:.68,opacity:1,blur:.25,distortion:0,glow:0,rotateToPath:false
  }),
  "island-distant":Object.freeze({
    label:"Ilha distante / névoa",category:"island",active:true,renderer:"parallax",mode:"parallax",
    speed:0,intensity:18,range:0,parallax:.38,opacity:.82,blur:1.1,distortion:0,glow:0,rotateToPath:false
  }),
  "background-far":Object.freeze({
    label:"Background distante",category:"background",active:true,renderer:"parallax",mode:"parallax",
    speed:0,intensity:10,range:0,parallax:.16,opacity:.72,blur:1.5,distortion:0,glow:0,rotateToPath:false
  }),
  "background-mid":Object.freeze({
    label:"Background médio",category:"background",active:true,renderer:"parallax",mode:"parallax",
    speed:0,intensity:8,range:0,parallax:.42,opacity:.86,blur:.65,distortion:0,glow:0,rotateToPath:false
  }),
  "background-near":Object.freeze({
    label:"Background próximo",category:"background",active:true,renderer:"parallax",mode:"parallax",
    speed:0,intensity:5,range:0,parallax:.72,opacity:1,blur:0,distortion:0,glow:0,rotateToPath:false
  }),
  "ship-cruise":Object.freeze({
    label:"Navio navegando",category:"ship",active:true,renderer:"dom",mode:"cruise",
    speed:44,intensity:16,range:360,parallax:1,opacity:1,blur:0,distortion:0,glow:0,rotateToPath:true
  }),
  "ship-cruise-webgl":Object.freeze({
    label:"Navio navegando · WebGL",category:"ship",active:true,renderer:"webgl",mode:"cruise",
    speed:50,intensity:22,range:420,parallax:1,opacity:1,blur:0,distortion:12,glow:18,rotateToPath:true
  })
});

const CATEGORY_PRESETS=Object.freeze({
  generic:["none","float","sea-drift","sea-webgl","island-depth","background-far","background-mid","background-near","ship-cruise","ship-cruise-webgl"],
  treasure:["none","float","treasure-glint","sea-drift"],
  "sea-item":["none","float","sea-drift","sea-webgl"],
  island:["none","island-depth","island-distant","background-mid"],
  background:["none","background-far","background-mid","background-near"],
  ship:["none","ship-cruise","ship-cruise-webgl","float"]
});

const clamp=(value,min,max)=>Math.min(max,Math.max(min,value));
const number=(value,fallback)=>Number.isFinite(Number(value))?Number(value):fallback;

export function inferEntityEffectCategory(entity={}){
  const explicit=String(entity.effect?.category||entity.effectCategory||"");
  if(ENTITY_EFFECT_CATEGORIES[explicit])return explicit;
  const type=String(entity.type||"object");
  const src=String(entity.src||"").toLowerCase();
  if(type==="treasure")return "treasure";
  if(type==="barrel")return "sea-item";
  if(type==="ship")return "ship";
  if(type==="background")return "background";
  if(type==="island"||type==="location")return "island";
  if(/\/baus\//.test(src))return "treasure";
  if(/\/barris\/|\/collectibles\//.test(src))return "sea-item";
  if(/\/ships\//.test(src))return "ship";
  if(/island|ilha/.test(src))return "island";
  if(/\/backgrounds\//.test(src))return "background";
  return "generic";
}

export function listEntityEffectPresets(category="generic"){
  const id=ENTITY_EFFECT_CATEGORIES[category]?category:"generic";
  return (CATEGORY_PRESETS[id]||CATEGORY_PRESETS.generic).map(preset=>({
    id:preset,
    ...ENTITY_EFFECT_PRESETS[preset]
  }));
}

export function defaultEntityEffect(entity={}){
  const category=inferEntityEffectCategory(entity);
  return {category,...ENTITY_EFFECT_PRESETS.none,preset:"none"};
}

export function recommendedEntityEffect(entity={}){
  const category=inferEntityEffectCategory(entity);
  const recommended={
    treasure:"treasure-glint",
    "sea-item":"sea-drift",
    island:"island-depth",
    background:"background-far",
    ship:"ship-cruise",
    generic:"none"
  }[category]||"none";
  return normalizeEntityEffect({category,preset:recommended,...ENTITY_EFFECT_PRESETS[recommended]},entity);
}

export function normalizeEntityEffect(input={},entity={}){
  const category=ENTITY_EFFECT_CATEGORIES[input.category]
    ?input.category
    :inferEntityEffectCategory({...entity,effect:input});
  const preset=ENTITY_EFFECT_PRESETS[input.preset]?input.preset:"none";
  const defaults=ENTITY_EFFECT_PRESETS[preset]||ENTITY_EFFECT_PRESETS.none;
  const renderer=["dom","parallax","webgl"].includes(input.renderer)?input.renderer:defaults.renderer;
  const mode=["none","float","drift","parallax","cruise"].includes(input.mode)?input.mode:defaults.mode;

  return {
    category,
    preset,
    active:input.active===undefined?defaults.active:input.active!==false,
    renderer,
    mode,
    speed:clamp(number(input.speed,defaults.speed),0,100),
    intensity:clamp(number(input.intensity,defaults.intensity),0,100),
    range:clamp(number(input.range,defaults.range),0,2400),
    parallax:clamp(number(input.parallax,defaults.parallax),0,1),
    opacity:clamp(number(input.opacity,defaults.opacity),.08,1),
    blur:clamp(number(input.blur,defaults.blur),0,8),
    distortion:clamp(number(input.distortion,defaults.distortion),0,100),
    glow:clamp(number(input.glow,defaults.glow),0,100),
    rotateToPath:input.rotateToPath===undefined?Boolean(defaults.rotateToPath):input.rotateToPath!==false
  };
}

export function applyEntityEffectPreset(input={},preset="none",entity={}){
  const id=ENTITY_EFFECT_PRESETS[preset]?preset:"none";
  const category=input.category||inferEntityEffectCategory(entity);
  return normalizeEntityEffect({
    ...input,
    ...ENTITY_EFFECT_PRESETS[id],
    category,
    preset:id
  },entity);
}

export function computeEntityEffectFrame(input={},timeMs=0,phase=0,context={}){
  const effect=normalizeEntityEffect(input,context.entity||{});
  const zero={
    offsetX:0,offsetY:0,rotation:0,scaleX:1,scaleY:1,
    opacity:effect.opacity,blur:effect.blur
  };
  if(!effect.active||effect.mode==="none")return zero;

  const t=Math.max(0,Number(timeMs)||0)/1000;
  const seed=Number(phase||0);
  const frequency=.18+(effect.speed/100)*.92;
  const wave=t*frequency+seed;
  const secondary=t*(frequency*.73)+seed*1.37;

  if(effect.mode==="float"){
    return {
      ...zero,
      offsetX:Math.sin(secondary)*(effect.range*.08+effect.intensity*.025),
      offsetY:Math.sin(wave)*(effect.intensity*.13),
      rotation:Math.sin(wave*.82)*(effect.intensity*.035),
      scaleY:1+Math.sin(secondary*.9)*(effect.intensity*.00025)
    };
  }

  if(effect.mode==="drift"){
    const radius=Math.max(8,effect.range);
    return {
      ...zero,
      offsetX:Math.sin(wave*.58)*radius*.32,
      offsetY:Math.sin(secondary)*effect.intensity*.11,
      rotation:Math.sin(wave*.77)*effect.intensity*.028
    };
  }

  if(effect.mode==="parallax"){
    const camera=context.camera||{x:0,y:0};
    const origin=context.cameraOrigin||camera;
    const factor=effect.parallax;
    const depth=1-factor;
    const verticalDelta=(Number(camera.y)||0)-(Number(origin.y)||0);
    return {
      ...zero,
      // Camera/parallax must never resize the entity itself. Scaling the asset
      // here creates a visual feedback loop where ships appear to "inflate"
      // whenever the camera moves. Keep entity size stable and move only its
      // apparent depth position relative to the camera.
      offsetX:((Number(camera.x)||0)-(Number(origin.x)||0))*depth,
      offsetY:verticalDelta*depth,
      scaleX:1,
      scaleY:1
    };
  }

  if(effect.mode==="cruise"){
    const radius=Math.max(24,effect.range);
    const a=wave*.68;
    const b=wave*.51+seed*.47;
    const offsetX=Math.cos(a)*radius;
    const offsetY=Math.sin(b)*radius*.56;
    const dx=-Math.sin(a)*radius*.68*frequency;
    const dy=Math.cos(b)*radius*.56*.51*frequency;
    const heading=effect.rotateToPath
      ?Math.atan2(dy,dx)*180/Math.PI+90
      :0;
    return {
      ...zero,
      offsetX,
      offsetY,
      rotation:heading+Math.sin(wave*.9)*effect.intensity*.025
    };
  }

  return zero;
}
