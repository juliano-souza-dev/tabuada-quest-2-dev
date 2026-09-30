import test from "node:test";
import assert from "node:assert/strict";
import {
  directionForHeading,
  resolveDirectionalSource,
  resolveDirectionalRegion,
  directionalRegionStyle
} from "../src/world/WorldDirectionalSprite.mjs";

test("16-direction resolver maps 22.5 degree headings",()=>{
  assert.equal(directionForHeading(0),"n");
  assert.equal(directionForHeading(22.5),"nne");
  assert.equal(directionForHeading(45),"ne");
  assert.equal(directionForHeading(67.5),"ene");
  assert.equal(directionForHeading(90),"e");
  assert.equal(directionForHeading(112.5),"ese");
  assert.equal(directionForHeading(135),"se");
  assert.equal(directionForHeading(157.5),"sse");
  assert.equal(directionForHeading(180),"s");
  assert.equal(directionForHeading(-157.5),"ssw");
  assert.equal(directionForHeading(-135),"sw");
  assert.equal(directionForHeading(-112.5),"wsw");
  assert.equal(directionForHeading(-90),"w");
  assert.equal(directionForHeading(-67.5),"wnw");
  assert.equal(directionForHeading(-45),"nw");
  assert.equal(directionForHeading(-22.5),"nnw");
});

test("16-direction resolver keeps current view inside hysteresis band",()=>{
  assert.equal(directionForHeading(14,"n",{hysteresis:4}),"n");
  assert.equal(directionForHeading(16,"n",{hysteresis:4}),"nne");
});

test("legacy directional files still provide fallback for intermediate headings",()=>{
  const directions={n:"n.png",ne:"ne.png",e:"e.png",se:"se.png",s:"s.png",sw:"sw.png",w:"w.png",nw:"nw.png"};
  assert.equal(resolveDirectionalSource(directions,"nne","fallback.png"),"n.png");
  assert.equal(resolveDirectionalSource(directions,"ene","fallback.png"),"ne.png");
  assert.equal(resolveDirectionalSource(directions,"ese","fallback.png"),"se.png");
  assert.equal(resolveDirectionalSource(directions,"wsw","fallback.png"),"w.png");
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

test("all sixteen headings resolve to visible crop styles",()=>{
  const keys=["n","nne","ne","ene","e","ese","se","sse","s","ssw","sw","wsw","w","wnw","nw","nnw"];
  const regions={};
  keys.forEach((key,index)=>{
    regions[key]={x:(index%4)*100,y:Math.floor(index/4)*100,width:100,height:100};
  });
  const sprite={src:"ship.webp",imageWidth:400,imageHeight:400,regions};
  for(const key of keys){
    const region=resolveDirectionalRegion(sprite,key);
    const style=directionalRegionStyle(sprite,key);
    assert.ok(region);
    assert.equal(region.resolvedDirection,key);
    assert.ok(style);
    assert.match(style.backgroundPosition,/^-?\d+(?:\.\d+)?% -?\d+(?:\.\d+)?%$/);
  }
});

test("8-way atlas remains compatible with 16-way runtime",()=>{
  const sprite={
    src:"ship.webp",
    imageWidth:800,
    imageHeight:100,
    regions:{
      n:{x:0,y:0,width:100,height:100},
      ne:{x:100,y:0,width:100,height:100},
      e:{x:200,y:0,width:100,height:100},
      se:{x:300,y:0,width:100,height:100},
      s:{x:400,y:0,width:100,height:100},
      sw:{x:500,y:0,width:100,height:100},
      w:{x:600,y:0,width:100,height:100},
      nw:{x:700,y:0,width:100,height:100}
    }
  };
  assert.equal(resolveDirectionalRegion(sprite,"nne").resolvedDirection,"n");
  assert.equal(resolveDirectionalRegion(sprite,"ene").resolvedDirection,"ne");
  assert.equal(resolveDirectionalRegion(sprite,"ese").resolvedDirection,"se");
  assert.equal(resolveDirectionalRegion(sprite,"wsw").resolvedDirection,"w");
});

test("missing direction falls back instead of hiding ship",()=>{
  const sprite={src:"ship.webp",imageWidth:400,imageHeight:200,regions:{w:{x:100,y:0,width:100,height:100}}};
  const region=resolveDirectionalRegion(sprite,"nne");
  assert.ok(region);
  assert.deepEqual({x:region.x,y:region.y,width:region.width,height:region.height},{x:100,y:0,width:100,height:100});
});
