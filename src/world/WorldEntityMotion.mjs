export const ENTITY_MOTION_PRESETS = Object.freeze({
  none: Object.freeze({active:false,speed:50,heave:0,pitch:0,roll:0,sway:0}),
  calm: Object.freeze({active:true,speed:38,heave:24,pitch:20,roll:10,sway:8}),
  navigation: Object.freeze({active:true,speed:55,heave:46,pitch:42,roll:24,sway:14}),
  rough: Object.freeze({active:true,speed:78,heave:82,pitch:76,roll:58,sway:30}),
  heavy: Object.freeze({active:true,speed:32,heave:38,pitch:28,roll:18,sway:10})
});

const clamp=(value,min,max)=>Math.min(max,Math.max(min,value));
const number=(value,fallback)=>Number.isFinite(Number(value))?Number(value):fallback;

export function defaultEntityMotion(type="object"){
  if(type==="ship")return {preset:"navigation",...ENTITY_MOTION_PRESETS.navigation};
  if(type==="barrel"||type==="treasure")return {preset:"calm",...ENTITY_MOTION_PRESETS.calm};
  return {preset:"none",...ENTITY_MOTION_PRESETS.none};
}

export function normalizeEntityMotion(input={},type="object"){
  const fallback=defaultEntityMotion(type);
  const preset=ENTITY_MOTION_PRESETS[input.preset]?input.preset:fallback.preset;
  const defaults=ENTITY_MOTION_PRESETS[preset]||fallback;
  return {
    active: input.active===undefined?defaults.active:input.active!==false,
    preset,
    speed: clamp(number(input.speed,defaults.speed),0,100),
    heave: clamp(number(input.heave,defaults.heave),0,100),
    pitch: clamp(number(input.pitch,defaults.pitch),0,100),
    roll: clamp(number(input.roll,defaults.roll),0,100),
    sway: clamp(number(input.sway,defaults.sway),0,100)
  };
}

export function applyEntityMotionPreset(input={},preset="none",type="object"){
  const id=ENTITY_MOTION_PRESETS[preset]?preset:defaultEntityMotion(type).preset;
  return normalizeEntityMotion({...input,...ENTITY_MOTION_PRESETS[id],preset:id},type);
}

export function computeEntityMotionFrame(input={},timeMs=0,phase=0,type="object"){
  const motion=normalizeEntityMotion(input,type);
  if(!motion.active)return {offsetX:0,offsetY:0,rotation:0,scaleY:1};

  const t=Math.max(0,Number(timeMs)||0)/1000;
  const frequency=.42+(motion.speed/100)*1.28;
  const wave=t*frequency+Number(phase||0);
  const secondary=t*(frequency*.73)+Number(phase||0)*1.61;

  return {
    offsetX:Math.sin(secondary)*(motion.sway*.10),
    offsetY:Math.sin(wave)*(motion.heave*.16),
    rotation:Math.sin(wave*.88)*(motion.roll*.10),
    scaleY:1+Math.sin(secondary*.81)*(motion.pitch*.00035)
  };
}
