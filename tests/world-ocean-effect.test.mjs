import test from "node:test";
import assert from "node:assert/strict";
import {
  OCEAN_PRESETS,
  normalizeOceanConfig,
  applyOceanPreset,
  computeOceanFrame
} from "../src/world/WorldOceanEffect.mjs";

test("ocean config is clamped and normalized",()=>{
  const ocean=normalizeOceanConfig({
    preset:"adventure",
    speed:999,
    directionX:-9,
    directionY:9,
    swell:-20,
    tileSize:20
  });
  assert.equal(ocean.speed,100);
  assert.equal(ocean.directionX,-1);
  assert.equal(ocean.directionY,1);
  assert.equal(ocean.swell,0);
  assert.equal(ocean.tileSize,240);
});

test("ocean presets apply documented movement values",()=>{
  for(const preset of Object.keys(OCEAN_PRESETS)){
    const ocean=applyOceanPreset({},preset);
    assert.equal(ocean.preset,preset);
    assert.equal(ocean.speed,OCEAN_PRESETS[preset].speed);
  }
});

test("active ocean produces bounded swell and directional movement",()=>{
  const ocean=applyOceanPreset({background:"./ocean.webp"},"storm");
  const a=computeOceanFrame(ocean,0);
  const b=computeOceanFrame(ocean,10000);
  assert.equal(a.offsetX,0);
  assert.ok(b.offsetX>0);
  assert.ok(b.offsetY>0);
  assert.ok(b.scale>=1&&b.scale<=1.02);
});

test("inactive ocean does not move",()=>{
  const frame=computeOceanFrame({active:false,preset:"calm"},10000);
  assert.equal(frame.offsetX,0);
  assert.equal(frame.offsetY,0);
  assert.equal(frame.scale,1);
});
