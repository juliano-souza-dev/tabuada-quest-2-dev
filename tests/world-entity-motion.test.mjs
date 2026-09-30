import test from "node:test";
import assert from "node:assert/strict";
import {
  ENTITY_MOTION_PRESETS,
  defaultEntityMotion,
  normalizeEntityMotion,
  applyEntityMotionPreset,
  computeEntityMotionFrame
} from "../src/world/WorldEntityMotion.mjs";

test("ship and floating objects reuse the scene motor vocabulary",()=>{
  assert.equal(defaultEntityMotion("ship").preset,"navigation");
  assert.equal(defaultEntityMotion("barrel").preset,"calm");
  for(const key of ["heave","pitch","roll","sway"]){
    assert.ok(key in ENTITY_MOTION_PRESETS.navigation);
  }
});

test("entity motion values are clamped",()=>{
  const motion=normalizeEntityMotion({
    preset:"rough",
    speed:999,
    heave:-20,
    pitch:500,
    roll:130,
    sway:-1
  },"ship");
  assert.equal(motion.speed,100);
  assert.equal(motion.heave,0);
  assert.equal(motion.pitch,100);
  assert.equal(motion.roll,100);
  assert.equal(motion.sway,0);
});

test("none preset disables motion",()=>{
  const motion=applyEntityMotionPreset({active:true},"none","barrel");
  assert.equal(motion.active,false);
  const frame=computeEntityMotionFrame(motion,5000,1.2,"barrel");
  assert.deepEqual(frame,{offsetX:0,offsetY:0,rotation:0,scaleY:1});
});

test("navigation preset produces heave, roll and sway over time",()=>{
  const motion=applyEntityMotionPreset({},"navigation","ship");
  const a=computeEntityMotionFrame(motion,0,0,"ship");
  const b=computeEntityMotionFrame(motion,1500,0,"ship");
  assert.notEqual(b.offsetY,a.offsetY);
  assert.notEqual(b.offsetX,a.offsetX);
  assert.notEqual(b.rotation,a.rotation);
  assert.ok(b.scaleY>0.95&&b.scaleY<1.05);
});
