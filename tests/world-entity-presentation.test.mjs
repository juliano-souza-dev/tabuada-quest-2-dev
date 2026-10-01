import test from "node:test";
import assert from "node:assert/strict";
import {
  ENTITY_DEPTH_PRESETS,
  applyDepthPreset,
  computeParallaxPoint,
  normalizeDepthPresentation,
  resolveEntityPresentation,
  isLogicalOnlyEntity
} from "../src/world/WorldEntityPresentation.mjs";

test("semantic location does not imply visual card chrome",()=>{
  const p=resolveEntityPresentation({type:"location",label:"Região 01",src:"./assets/backgrounds/regiao_01.webp"});
  assert.equal(p.renderMode,"sprite");
  assert.equal(p.hasSprite,true);
  assert.equal(p.showLabel,false);
  assert.equal(p.visualChrome,false);
});

test("background recognition stays logical while sprite stays raw",()=>{
  const p=resolveEntityPresentation({type:"location",src:"./assets/backgrounds/background.webp",renderMode:"sprite"});
  assert.equal(p.renderMode,"sprite");
  assert.equal(p.visualChrome,false);
});

test("entity without sprite can remain logical only",()=>{
  const entity={type:"location",renderMode:"logical"};
  assert.equal(isLogicalOnlyEntity(entity),true);
  assert.equal(resolveEntityPresentation(entity).hasSprite,false);
});

test("labels remain opt-in metadata without visual chrome",()=>{
  const p=resolveEntityPresentation({type:"location",src:"./assets/backgrounds/island.webp",showLabel:true});
  assert.equal(p.showLabel,true);
  assert.equal(p.visualChrome,false);
});

test("depth presets are editable starting points",()=>{
  const far=applyDepthPreset({},"far");
  const gameplay=applyDepthPreset({},"gameplay");
  const foreground=applyDepthPreset({},"foreground");
  assert.equal(far.parallax,0.2);
  assert.equal(gameplay.parallax,1);
  assert.equal(foreground.parallax,1.5);
  assert.ok(far.scale<gameplay.scale);
  assert.ok(foreground.scale>gameplay.scale);
  assert.equal(far.tint,ENTITY_DEPTH_PRESETS.far.tint);

  const custom=normalizeDepthPresentation({...far,parallax:.37,scale:.71});
  assert.equal(custom.depth,"far");
  assert.equal(custom.parallax,.37);
  assert.equal(custom.scale,.71);
});

test("parallax changes camera-relative displacement without changing world coordinates",()=>{
  const camera={x:1000,y:1000};
  const entity={x:1200,y:1300};
  const far=computeParallaxPoint(entity,camera,applyDepthPreset({},"far"));
  const gameplay=computeParallaxPoint(entity,camera,applyDepthPreset({},"gameplay"));
  const foreground=computeParallaxPoint(entity,camera,applyDepthPreset({},"foreground"));
  assert.deepEqual(gameplay,{x:1200,y:1300});
  assert.deepEqual(far,{x:1040,y:1060});
  assert.deepEqual(foreground,{x:1300,y:1450});
  assert.deepEqual(entity,{x:1200,y:1300});
});

test("presentation values are clamped",()=>{
  const value=normalizeDepthPresentation({depth:"foreground",parallax:99,scale:-2,opacity:4,blur:200,tintStrength:-1,shadow:8});
  assert.equal(value.parallax,3);
  assert.equal(value.scale,.1);
  assert.equal(value.opacity,1);
  assert.equal(value.blur,12);
  assert.equal(value.tintStrength,0);
  assert.equal(value.shadow,1);
});
