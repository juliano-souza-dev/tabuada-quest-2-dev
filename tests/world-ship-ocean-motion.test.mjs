import test from "node:test";
import assert from "node:assert/strict";
import {computeShipOceanMotion} from "../src/world/WorldShipOceanMotion.mjs";

const ocean={
  active:true,
  speed:28,
  swell:28,
  tileSize:720,
  directionX:0,
  directionY:1,
  waveFrequencyA:18,
  waveFrequencyB:15
};

test("ship response grows with ocean swell",()=>{
  const player={x:1100,y:1800,rotation:180};
  const calm=computeShipOceanMotion({...ocean,swell:8},player,1800,1);
  const rough=computeShipOceanMotion({...ocean,swell:72},player,1800,1);
  assert.ok(rough.energy>calm.energy);
  assert.ok(Math.abs(rough.surge)>=Math.abs(calm.surge));
});

test("heading against waves creates stronger fore-aft movement than following them",()=>{
  const against=computeShipOceanMotion(ocean,{x:960,y:1260,rotation:0},2400,1);
  const following=computeShipOceanMotion(ocean,{x:960,y:1260,rotation:180},2400,1);
  assert.ok(against.alignment<0);
  assert.ok(following.alignment>0);
  assert.ok(Math.abs(against.surge)>Math.abs(following.surge));
});

test("broadside waves emphasize roll rather than fore-aft alignment",()=>{
  const broadside=computeShipOceanMotion(ocean,{x:700,y:920,rotation:90},3300,1);
  const headOn=computeShipOceanMotion(ocean,{x:700,y:920,rotation:0},3300,1);
  assert.ok(broadside.broadside>headOn.broadside);
  assert.ok(Math.abs(broadside.roll)>=Math.abs(headOn.roll));
});

test("response multiplier can disable visual ocean motion",()=>{
  const motion=computeShipOceanMotion(ocean,{x:500,y:500,rotation:45},1200,0);
  assert.equal(motion.energy,0);
  assert.ok(Math.abs(motion.offsetX)<2);
  assert.ok(Math.abs(motion.offsetY)<2);
  assert.ok(Math.abs(motion.roll)<=1.1);
});
