import test from "node:test";
import assert from "node:assert/strict";
import {
  normalizeJoystickVector,
  screenPointToWorld,
  targetNavigationVector
} from "../src/world/WorldNavigationInput.mjs";

test("analog joystick keeps center inside the dead zone",()=>{
  const value=normalizeJoystickVector(4,3,60,{deadZone:.14});
  assert.deepEqual({x:value.x,y:value.y,magnitude:value.magnitude},{x:0,y:0,magnitude:0});
});

test("analog joystick preserves proportional magnitude",()=>{
  const half=normalizeJoystickVector(30,0,60,{deadZone:0});
  assert.ok(Math.abs(half.x-.5)<1e-9);
  assert.equal(half.y,0);
  assert.ok(Math.abs(half.magnitude-.5)<1e-9);
});

test("analog joystick caps values outside the base radius",()=>{
  const value=normalizeJoystickVector(120,0,60,{deadZone:0});
  assert.equal(value.x,1);
  assert.equal(value.y,0);
  assert.equal(value.magnitude,1);
});

test("screen click maps through camera and zoom into world coordinates",()=>{
  const point=screenPointToWorld(300,250,{
    viewportLeft:100,
    viewportTop:50,
    viewportWidth:400,
    viewportHeight:400,
    cameraX:1000,
    cameraY:1200,
    zoom:2,
    worldWidth:2200,
    worldHeight:3200,
    marginX:55,
    marginY:70
  });
  assert.deepEqual(point,{x:1000,y:1200});
});

test("screen click is clamped inside navigable world margins",()=>{
  const point=screenPointToWorld(-500,-500,{
    viewportLeft:0,
    viewportTop:0,
    viewportWidth:400,
    viewportHeight:800,
    cameraX:100,
    cameraY:100,
    zoom:1,
    worldWidth:2200,
    worldHeight:3200,
    marginX:55,
    marginY:70
  });
  assert.deepEqual(point,{x:55,y:70});
});

test("click navigation slows near target and stops inside arrival radius",()=>{
  const far=targetNavigationVector({x:100,y:100},{x:500,y:100},{arrivalRadius:24,slowRadius:180});
  assert.equal(far.arrived,false);
  assert.equal(far.magnitude,1);
  assert.equal(far.x,1);
  assert.equal(far.y,0);

  const near=targetNavigationVector({x:100,y:100},{x:145,y:100},{arrivalRadius:24,slowRadius:180});
  assert.equal(near.arrived,false);
  assert.ok(near.magnitude<1);
  assert.ok(near.magnitude>=.12);

  const arrived=targetNavigationVector({x:100,y:100},{x:120,y:100},{arrivalRadius:24,slowRadius:180});
  assert.equal(arrived.arrived,true);
  assert.equal(arrived.magnitude,0);
});
