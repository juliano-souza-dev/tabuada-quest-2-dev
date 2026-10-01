export const OCEAN_PRESETS = Object.freeze({
  calm: Object.freeze({
    speed: 12,
    directionX: 0.55,
    directionY: 0.18,
    swell: 12,
    tileSize: 760,
    brightness: 100,
    saturation: 95
  }),
  adventure: Object.freeze({
    speed: 28,
    directionX: 0.82,
    directionY: 0.32,
    swell: 28,
    tileSize: 720,
    brightness: 102,
    saturation: 105
  }),
  storm: Object.freeze({
    speed: 56,
    directionX: 1,
    directionY: 0.62,
    swell: 62,
    tileSize: 660,
    brightness: 88,
    saturation: 82
  })
});

const number=(value,fallback)=>Number.isFinite(Number(value))?Number(value):fallback;
const clamp=(value,min,max)=>Math.min(max,Math.max(min,value));

export function normalizeOceanConfig(input={}){
  const preset=OCEAN_PRESETS[input.preset]?input.preset:"adventure";
  const defaults=OCEAN_PRESETS[preset];
  return {
    active: input.active!==false,
    background: String(input.background||"./assets/backgrounds/scene-ocean.webp"),
    preset,
    speed: clamp(number(input.speed,defaults.speed),0,100),
    directionX: clamp(number(input.directionX,defaults.directionX),-1,1),
    directionY: clamp(number(input.directionY,defaults.directionY),-1,1),
    swell: clamp(number(input.swell,defaults.swell),0,100),
    tileSize: clamp(number(input.tileSize,defaults.tileSize),240,1600),
    brightness: clamp(number(input.brightness,defaults.brightness),50,150),
    saturation: clamp(number(input.saturation,defaults.saturation),0,180)
  };
}

export function applyOceanPreset(input={},preset="adventure"){
  const id=OCEAN_PRESETS[preset]?preset:"adventure";
  return normalizeOceanConfig({
    ...input,
    ...OCEAN_PRESETS[id],
    preset:id
  });
}

export function computeOceanFrame(input={},timeMs=0){
  const ocean=normalizeOceanConfig(input);
  if(!ocean.active){
    return {
      offsetX:0,
      offsetY:0,
      scale:1,
      brightness:ocean.brightness,
      saturation:ocean.saturation
    };
  }

  const t=Math.max(0,Number(timeMs)||0)/1000;
  const pxPerSecond=ocean.speed*0.42;
  const swellAmount=(ocean.swell/100)*0.016;
  const swellPhase=t*(0.42+ocean.speed/180);

  return {
    offsetX:t*pxPerSecond*ocean.directionX,
    offsetY:t*pxPerSecond*ocean.directionY,
    scale:1+swellAmount*(0.5+0.5*Math.sin(swellPhase)),
    brightness:ocean.brightness+Math.sin(t*0.7)*(ocean.swell/100)*2,
    saturation:ocean.saturation
  };
}
