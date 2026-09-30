import test from "node:test";
import assert from "node:assert/strict";
import {
  ENTITY_EFFECT_PRESETS,
  inferEntityEffectCategory,
  listEntityEffectPresets,
  normalizeEntityEffect,
  applyEntityEffectPreset,
  computeEntityEffectFrame
} from "../src/world/WorldEntityEffects.mjs";

test("effect categories are inferred for world object families",()=>{
  assert.equal(inferEntityEffectCategory({type:"treasure"}),"treasure");
  assert.equal(inferEntityEffectCategory({type:"barrel"}),"sea-item");
  assert.equal(inferEntityEffectCategory({type:"ship"}),"ship");
  assert.equal(inferEntityEffectCategory({type:"location"}),"island");
  assert.equal(inferEntityEffectCategory({type:"object",src:"./assets/backgrounds/horizon.webp"}),"background");
});

test("category lists expose parallax and WebGL presets",()=>{
  const background=listEntityEffectPresets("background").map(item=>item.id);
  const treasure=listEntityEffectPresets("treasure").map(item=>item.id);
  const ships=listEntityEffectPresets("ship").map(item=>item.id);

  assert.ok(background.includes("background-far"));
  assert.equal(ENTITY_EFFECT_PRESETS["background-far"].renderer,"parallax");
  assert.ok(treasure.includes("treasure-glint"));
  assert.equal(ENTITY_EFFECT_PRESETS["treasure-glint"].renderer,"webgl");
  assert.ok(ships.includes("ship-cruise"));
});

test("effect values are clamped safely",()=>{
  const effect=normalizeEntityEffect({
    preset:"ship-cruise-webgl",
    speed:999,
    intensity:-10,
    range:99999,
    parallax:-4,
    opacity:4,
    blur:99,
    distortion:200,
    glow:-5
  },{type:"ship"});

  assert.equal(effect.speed,100);
  assert.equal(effect.intensity,0);
  assert.equal(effect.range,2400);
  assert.equal(effect.parallax,0);
  assert.equal(effect.opacity,1);
  assert.equal(effect.blur,8);
  assert.equal(effect.distortion,100);
  assert.equal(effect.glow,0);
});

test("parallax effect offsets against camera movement",()=>{
  const effect=applyEntityEffectPreset({category:"background"},"background-far",{type:"background"});
  const frame=computeEntityEffectFrame(effect,1000,0,{
    entity:{type:"background"},
    camera:{x:500,y:400},
    cameraOrigin:{x:100,y:100},
    worldHeight:8000
  });
  assert.ok(frame.offsetX>0);
  assert.ok(frame.offsetY>0);
  assert.ok(frame.scaleX>0);
});


test("horizon blend keeps background integration separate from the WebGL ocean renderer",()=>{
  const presets=listEntityEffectPresets("background").map(item=>item.id);
  assert.ok(presets.includes("horizon-blend"));
  const preset=ENTITY_EFFECT_PRESETS["horizon-blend"];
  assert.equal(preset.renderer,"parallax");
  assert.equal(preset.mode,"horizonBlend");

  const effect=applyEntityEffectPreset({category:"background"},"horizon-blend",{type:"background"});
  assert.equal(effect.active,true);
  assert.ok(effect.blendLine>0&&effect.blendLine<1);
  assert.ok(effect.blendFeather>0);
  assert.ok(effect.oceanTint>=0&&effect.oceanTint<=1);

  const frame=computeEntityEffectFrame(effect,1000,0,{
    entity:{type:"background"},
    camera:{x:600,y:500},
    cameraOrigin:{x:200,y:200},
    worldHeight:8000
  });
  assert.ok(frame.offsetX>0);
  assert.ok(frame.offsetY>0);
});

test("cruise effect moves ships around their anchor",()=>{
  const effect=applyEntityEffectPreset({category:"ship"},"ship-cruise",{type:"ship"});
  const a=computeEntityEffectFrame(effect,0,1,{entity:{type:"ship"}});
  const b=computeEntityEffectFrame(effect,2500,1,{entity:{type:"ship"}});
  assert.notEqual(a.offsetX,b.offsetX);
  assert.notEqual(a.offsetY,b.offsetY);
  assert.notEqual(a.rotation,b.rotation);
});
