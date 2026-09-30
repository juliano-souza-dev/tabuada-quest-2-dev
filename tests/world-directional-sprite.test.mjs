import test from "node:test";
import assert from "node:assert/strict";
import {
  directionForHeading,
  resolveDirectionalSource
} from "../src/world/WorldDirectionalSprite.mjs";

test("8-direction resolver maps cardinal headings",()=>{
  assert.equal(directionForHeading(0),"n");
  assert.equal(directionForHeading(45),"ne");
  assert.equal(directionForHeading(90),"e");
  assert.equal(directionForHeading(135),"se");
  assert.equal(directionForHeading(180),"s");
  assert.equal(directionForHeading(-135),"sw");
  assert.equal(directionForHeading(-90),"w");
  assert.equal(directionForHeading(-45),"nw");
});

test("direction resolver keeps current view inside hysteresis band",()=>{
  assert.equal(directionForHeading(27,"n",{hysteresis:7}),"n");
  assert.equal(directionForHeading(31,"n",{hysteresis:7}),"ne");
});

test("directional source resolves exact asset and n fallback",()=>{
  const directions={n:"n.png",e:"e.png"};
  assert.equal(resolveDirectionalSource(directions,"e","fallback.png"),"e.png");
  assert.equal(resolveDirectionalSource(directions,"sw","fallback.png"),"n.png");
});
