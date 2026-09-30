import test from "node:test";
import assert from "node:assert/strict";
import {
  directionForHeading,
  resolveDirectionalSource,
  resolveDirectionalRegion,
  directionalRegionStyle
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

test("legacy directional source resolves exact asset and n fallback",()=>{
  const directions={n:"n.png",e:"e.png"};
  assert.equal(resolveDirectionalSource(directions,"e","fallback.png"),"e.png");
  assert.equal(resolveDirectionalSource(directions,"sw","fallback.png"),"n.png");
});

test("atlas crop uses CSS background positioning semantics",()=>{
  const sprite={
    src:"ship.webp",
    imageWidth:800,
    imageHeight:400,
    regions:{e:{x:200,y:100,width:100,height:100}}
  };
  const style=directionalRegionStyle(sprite,"e");
  assert.equal(style.backgroundSize,"800% 400%");
  assert.equal(style.backgroundPosition,String(200/700*100)+"% "+String(100/300*100)+"%");
});

test("all eight headings resolve to finite visible crop styles",()=>{
  const regions={};
  const keys=["n","ne","e","se","s","sw","w","nw"];
  keys.forEach((key,index)=>{
    regions[key]={x:(index%4)*100,y:Math.floor(index/4)*100,width:100,height:100};
  });
  const sprite={src:"ship.webp",imageWidth:400,imageHeight:200,regions};
  for(const key of keys){
    const region=resolveDirectionalRegion(sprite,key);
    const style=directionalRegionStyle(sprite,key);
    assert.ok(region);
    assert.ok(style);
    assert.match(style.backgroundPosition,/^-?\d+(?:\.\d+)?% -?\d+(?:\.\d+)?%$/);
  }
});

test("missing direction falls back to first configured region instead of disappearing",()=>{
  const sprite={src:"ship.webp",imageWidth:400,imageHeight:200,regions:{w:{x:100,y:0,width:100,height:100}}};
  const region=resolveDirectionalRegion(sprite,"n");
  assert.ok(region);
  assert.deepEqual({x:region.x,y:region.y,width:region.width,height:region.height},{x:100,y:0,width:100,height:100});
});
