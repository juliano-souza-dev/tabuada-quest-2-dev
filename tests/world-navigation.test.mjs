import test from "node:test";
import assert from "node:assert/strict";
import {
  NAVIGATION_DEFAULTS,
  applyCounterSteer,
  computeCameraFollowTarget,
  computeCameraLookAhead,
  expSmoothingFactor,
  shortestAngleDelta,
  smoothAngle,
  velocityHeading
} from "../src/world/WorldNavigation.mjs";

test("shortest rotation crosses the -180/180 seam",()=>{
  assert.equal(shortestAngleDelta(179,-179),2);
  assert.equal(shortestAngleDelta(-179,179),-2);
});

test("smooth rotation approaches target without snapping",()=>{
  const next=smoothAngle(0,90,1/60);
  assert.ok(next>0&&next<90);
  const later=smoothAngle(next,90,1/60);
  assert.ok(later>next&&later<90);
});

test("rotation smoothing is deltaTime based",()=>{
  const oneFrame=smoothAngle(0,90,1/30);
  const twoFrames=smoothAngle(smoothAngle(0,90,1/60),90,1/60);
  assert.ok(Math.abs(oneFrame-twoFrames)<0.000001);
});

test("velocity heading respects ship forward axis",()=>{
  assert.equal(velocityHeading(0,-100,0),0);
  assert.equal(velocityHeading(100,0,0),90);
  assert.equal(velocityHeading(0,100,0),-180);
  assert.equal(velocityHeading(2,2,37),37);
});

test("camera look-ahead is proportional to speed and capped",()=>{
  const half=computeCameraLookAhead(NAVIGATION_DEFAULTS.maxSpeed/2,0);
  assert.equal(half.distance,NAVIGATION_DEFAULTS.cameraLookAheadDistance/2);
  assert.equal(half.x,half.distance);
  assert.equal(half.y,0);

  const capped=computeCameraLookAhead(NAVIGATION_DEFAULTS.maxSpeed*3,0);
  assert.equal(capped.distance,NAVIGATION_DEFAULTS.cameraLookAheadDistance);
});

test("camera smoothing factor matches exponential time behavior",()=>{
  const a=expSmoothingFactor(1/30,NAVIGATION_DEFAULTS.cameraSharpness);
  const half=expSmoothingFactor(1/60,NAVIGATION_DEFAULTS.cameraSharpness);
  const combined=1-(1-half)*(1-half);
  assert.ok(Math.abs(a-combined)<0.000001);
});


test("camera follow keeps downward movement visually downward",()=>{
  const target=computeCameraFollowTarget(
    {x:1100,y:1080},
    {x:1100,y:1000},
    {
      viewportWidth:390,
      viewportHeight:844,
      zoom:1,
      worldWidth:2200,
      worldHeight:3200,
      deadZone:40
    }
  );
  assert.equal(target.y,1040);
  assert.ok(1080-target.y>0);
});

test("camera follow keeps upward movement visually upward",()=>{
  const target=computeCameraFollowTarget(
    {x:1100,y:1000},
    {x:1100,y:1080},
    {
      viewportWidth:390,
      viewportHeight:844,
      zoom:1,
      worldWidth:2200,
      worldHeight:3200,
      deadZone:40
    }
  );
  assert.equal(target.y,1040);
  assert.ok(1000-target.y<0);
});

test("camera dead zone does not move while the ship remains inside it",()=>{
  const target=computeCameraFollowTarget(
    {x:1120,y:1025},
    {x:1100,y:1000},
    {
      viewportWidth:390,
      viewportHeight:844,
      zoom:1,
      worldWidth:2200,
      worldHeight:3200,
      deadZone:40
    }
  );
  assert.equal(target.x,1100);
  assert.equal(target.y,1000);
});


test("counter steering cancels momentum on the opposite axis",()=>{
  assert.equal(applyCounterSteer(-180,1),0);
  assert.equal(applyCounterSteer(180,-1),0);
  assert.equal(applyCounterSteer(180,1),180);
  assert.equal(applyCounterSteer(-180,-1),-180);
  assert.equal(applyCounterSteer(180,0),180);
});

test("counter steering may retain configured inertia without reversing intent",()=>{
  assert.equal(applyCounterSteer(-200,1,{retention:.25}),-50);
});
