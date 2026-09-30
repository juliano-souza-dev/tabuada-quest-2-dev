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

export const OCEAN_LAYER_DEFAULTS=Object.freeze({
  deep:Object.freeze({
    parallax:.22,
    driftX:7,
    driftY:4,
    tileScale:1.18,
    opacity:1
  }),
  wave:Object.freeze({
    parallax:.45,
    driftX:18,
    driftY:11,
    tileScale:.72,
    opacity:.34
  }),
  foam:Object.freeze({
    parallax:.68,
    driftX:36,
    driftY:24,
    tileScale:.48,
    opacity:.20
  })
});

const number=(value,fallback)=>Number.isFinite(Number(value))?Number(value):fallback;
const clamp=(value,min,max)=>Math.min(max,Math.max(min,value));

const normalizeLayer=(input={},defaults,background)=>({
  background:String(input.background||background||""),
  parallax:clamp(number(input.parallax,defaults.parallax),0,1),
  driftX:clamp(number(input.driftX,defaults.driftX),-120,120),
  driftY:clamp(number(input.driftY,defaults.driftY),-120,120),
  tileScale:clamp(number(input.tileScale,defaults.tileScale),.2,2.5),
  opacity:clamp(number(input.opacity,defaults.opacity),0,1)
});

export function normalizeOceanConfig(input={}){
  const preset=OCEAN_PRESETS[input.preset]?input.preset:"adventure";
  const defaults=OCEAN_PRESETS[preset];
  const background=String(input.background||"./assets/backgrounds/scene-ocean.webp");
  const layersInput=input.layers||{};
  return {
    active: input.active!==false,
    renderer:String(input.renderer||"webgl").toLowerCase()==="css"?"css":"webgl",
    background,
    preset,
    speed: clamp(number(input.speed,defaults.speed),0,100),
    directionX: clamp(number(input.directionX,defaults.directionX),-1,1),
    directionY: clamp(number(input.directionY,defaults.directionY),-1,1),
    swell: clamp(number(input.swell,defaults.swell),0,100),
    tileSize: clamp(number(input.tileSize,defaults.tileSize),240,1600),
    brightness: clamp(number(input.brightness,defaults.brightness),50,150),
    saturation: clamp(number(input.saturation,defaults.saturation),0,180),
    layers:{
      deep:normalizeLayer(layersInput.deep,OCEAN_LAYER_DEFAULTS.deep,background),
      wave:normalizeLayer(layersInput.wave,OCEAN_LAYER_DEFAULTS.wave,background),
      foam:normalizeLayer(layersInput.foam,OCEAN_LAYER_DEFAULTS.foam,background)
    }
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

export function computeOceanFrame(input={},timeMs=0,camera={x:0,y:0}){
  const ocean=normalizeOceanConfig(input);
  const t=Math.max(0,Number(timeMs)||0)/1000;
  const camX=Number(camera?.x)||0;
  const camY=Number(camera?.y)||0;
  const basePxPerSecond=ocean.speed*0.42;
  const swellAmount=(ocean.swell/100)*0.016;
  const swellPhase=t*(0.42+ocean.speed/180);
  const scale=ocean.active?1+swellAmount*(0.5+0.5*Math.sin(swellPhase)):1;
  const brightness=ocean.active?ocean.brightness+Math.sin(t*0.7)*(ocean.swell/100)*2:ocean.brightness;

  const layerFrame=layer=>{
    if(!ocean.active)return {offsetX:-camX*layer.parallax,offsetY:-camY*layer.parallax};
    return {
      offsetX:-camX*layer.parallax+t*(layer.driftX+basePxPerSecond*ocean.directionX),
      offsetY:-camY*layer.parallax+t*(layer.driftY+basePxPerSecond*ocean.directionY)
    };
  };

  return {
    scale,
    brightness,
    saturation:ocean.saturation,
    layers:{
      deep:layerFrame(ocean.layers.deep),
      wave:layerFrame(ocean.layers.wave),
      foam:layerFrame(ocean.layers.foam)
    }
  };
}

export function cameraFollowStep(camera,player,dt,sharpness=4.5){
  const safeDt=Math.max(0,Number(dt)||0);
  const k=1-Math.exp(-safeDt*Math.max(0,Number(sharpness)||0));
  return {
    x:Number(camera?.x||0)+(Number(player?.x||0)-Number(camera?.x||0))*k,
    y:Number(camera?.y||0)+(Number(player?.y||0)-Number(camera?.y||0))*k,
    k
  };
}
