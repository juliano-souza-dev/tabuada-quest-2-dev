import test from "node:test";
import assert from "node:assert/strict";
import {
  OCEAN_PRESETS,
  OCEAN_LAYER_DEFAULTS,
  normalizeOceanConfig,
  applyOceanPreset,
  computeOceanFrame,
  cameraFollowStep
} from "../src/world/WorldOceanEffect.mjs";

test("ocean config is clamped and normalized",()=>{
  const ocean=normalizeOceanConfig({
    preset:"adventure",
    speed:999,
    directionX:-9,
    directionY:9,
    swell:-20,
    tileSize:20,
    layers:{
      deep:{parallax:9,opacity:-1},
      foam:{driftX:999,tileScale:9}
    }
  });
  assert.equal(ocean.speed,100);
  assert.equal(ocean.directionX,-1);
  assert.equal(ocean.directionY,1);
  assert.equal(ocean.swell,0);
  assert.equal(ocean.tileSize,240);
  assert.equal(ocean.layers.deep.parallax,1);
  assert.equal(ocean.layers.deep.opacity,0);
  assert.equal(ocean.layers.foam.driftX,120);
  assert.equal(ocean.layers.foam.tileScale,2.5);
});

test("ocean presets preserve layered parallax defaults",()=>{
  for(const preset of Object.keys(OCEAN_PRESETS)){
    const ocean=applyOceanPreset({},preset);
    assert.equal(ocean.preset,preset);
    assert.equal(ocean.speed,OCEAN_PRESETS[preset].speed);
    assert.equal(ocean.layers.deep.parallax,OCEAN_LAYER_DEFAULTS.deep.parallax);
    assert.equal(ocean.layers.wave.parallax,OCEAN_LAYER_DEFAULTS.wave.parallax);
    assert.equal(ocean.layers.foam.parallax,OCEAN_LAYER_DEFAULTS.foam.parallax);
  }
});

test("layered ocean combines camera parallax with timed drift",()=>{
  const ocean=normalizeOceanConfig({
    active:true,
    preset:"adventure",
    speed:0,
    directionX:0,
    directionY:0,
    layers:{
      deep:{parallax:.22,driftX:7,driftY:4},
      wave:{parallax:.45,driftX:18,driftY:11},
      foam:{parallax:.68,driftX:36,driftY:24}
    }
  });
  const frame=computeOceanFrame(ocean,1000,{x:100,y:200});
  assert.equal(frame.layers.deep.offsetX,-15);
  assert.equal(frame.layers.deep.offsetY,-40);
  assert.equal(frame.layers.wave.offsetX,-27);
  assert.equal(frame.layers.wave.offsetY,-79);
  assert.equal(frame.layers.foam.offsetX,-32);
  assert.equal(frame.layers.foam.offsetY,-112);
});

test("active ocean produces bounded swell",()=>{
  const ocean=applyOceanPreset({background:"./ocean.webp"},"storm");
  const frame=computeOceanFrame(ocean,10000);
  assert.ok(frame.scale>=1&&frame.scale<=1.02);
});

test("inactive ocean stops timed drift and swell but follows camera parallax",()=>{
  const frame=computeOceanFrame({active:false,preset:"calm"},10000,{x:100,y:200});
  assert.equal(frame.layers.deep.offsetX,-22);
  assert.equal(frame.layers.deep.offsetY,-44);
  assert.equal(frame.scale,1);
});

test("camera follow is frame-rate independent exponential smoothing",()=>{
  const oneStep=cameraFollowStep({x:0,y:0},{x:100,y:50},1,4.5);
  const twoA=cameraFollowStep({x:0,y:0},{x:100,y:50},.5,4.5);
  const twoB=cameraFollowStep(twoA,{x:100,y:50},.5,4.5);
  assert.ok(Math.abs(oneStep.x-twoB.x)<1e-9);
  assert.ok(Math.abs(oneStep.y-twoB.y)<1e-9);
  assert.ok(oneStep.k>0&&oneStep.k<1);
});
