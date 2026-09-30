import test from "node:test";
import assert from "node:assert/strict";
import {
  normalizeEntityCollision,
  polygonFromScale,
  resolveCircleVsEntity,
  resolvePlayerCollisions
} from "../src/world/WorldCollision.mjs";

test("islands and ships are solid by default while backgrounds stay non-solid",()=>{
  assert.equal(normalizeEntityCollision({}, {type:"location"}).active,true);
  assert.equal(normalizeEntityCollision({}, {type:"island"}).active,true);
  assert.equal(normalizeEntityCollision({}, {type:"ship"}).active,true);
  assert.equal(normalizeEntityCollision({}, {type:"background"}).active,false);

  const oldBackgroundAsLocation={
    type:"location",
    effect:{category:"background",mode:"horizonBlend"}
  };
  assert.equal(normalizeEntityCollision({},oldBackgroundAsLocation).active,false);
});

test("player circle is pushed outside an island ellipse",()=>{
  const island={
    id:"island.1",
    type:"location",
    x:500,
    y:500,
    width:400,
    height:260,
    rotation:0
  };
  const hit=resolveCircleVsEntity(
    {x:620,y:500},
    30,
    island,
    {active:true,shape:"ellipse",scaleX:.72,scaleY:.5,padding:10},
    {x:-100,y:0}
  );
  assert.equal(hit.collided,true);
  assert.ok(hit.x>620);
  assert.ok(hit.penetration>0);
});

test("collision resolution removes velocity into the obstacle and preserves sliding",()=>{
  const island={
    id:"island.1",
    type:"location",
    x:500,
    y:500,
    width:420,
    height:300,
    collision:{active:true,shape:"ellipse",scaleX:.8,scaleY:.6,padding:8}
  };
  const result=resolvePlayerCollisions(
    {x:635,y:560},
    34,
    [island],
    {x:-180,y:90},
    {iterations:4}
  );
  assert.ok(result.hits.includes("island.1"));
  assert.ok(Number.isFinite(result.x)&&Number.isFinite(result.y));
  assert.ok(Number.isFinite(result.vx)&&Number.isFinite(result.vy));
  assert.ok(Math.hypot(result.vx,result.vy)<=Math.hypot(-180,90)+1e-6);
});

test("disabled collision never blocks navigation",()=>{
  const background={
    id:"background.1",
    type:"background",
    x:500,
    y:500,
    width:1000,
    height:1000,
    collision:{active:false,shape:"box",scaleX:1,scaleY:1,padding:0}
  };
  const result=resolvePlayerCollisions(
    {x:500,y:500},
    40,
    [background],
    {x:100,y:0}
  );
  assert.deepEqual(result.hits,[]);
  assert.equal(result.x,500);
  assert.equal(result.y,500);
});


test("polygon colliders preserve point-by-point geometry",()=>{
  const collision=normalizeEntityCollision({
    active:true,
    shape:"polygon",
    points:[
      {x:-.5,y:-.4},
      {x:.45,y:-.35},
      {x:.28,y:.5},
      {x:-.42,y:.38}
    ]
  },{type:"island"});

  assert.equal(collision.shape,"polygon");
  assert.equal(collision.points.length,4);
  assert.deepEqual(collision.points[0],{x:-.5,y:-.4});
});

test("polygon can be initialized from the previous collision size",()=>{
  const points=polygonFromScale(.72,.5);
  assert.equal(points.length,4);
  assert.equal(points[0].x,-.36);
  assert.equal(points[0].y,-.25);
  assert.equal(points[2].x,.36);
  assert.equal(points[2].y,.25);
});

test("player circle cannot cross a custom island polygon",()=>{
  const island={
    id:"island.poly",
    type:"island",
    x:500,
    y:500,
    width:400,
    height:300,
    rotation:0,
    collision:{
      active:true,
      shape:"polygon",
      padding:0,
      points:[
        {x:-.5,y:-.4},
        {x:.4,y:-.45},
        {x:.5,y:.15},
        {x:.12,y:.5},
        {x:-.45,y:.32}
      ]
    }
  };

  const hit=resolveCircleVsEntity(
    {x:650,y:500},
    28,
    island,
    island.collision,
    {x:-120,y:0}
  );

  assert.equal(hit.collided,true);
  assert.ok(hit.x>650);
  assert.ok(hit.penetration>0);
});

test("concave polygon leaves navigable cutouts outside the drawn solid area",()=>{
  const island={
    id:"island.concave",
    type:"island",
    x:500,
    y:500,
    width:400,
    height:400,
    collision:{
      active:true,
      shape:"polygon",
      padding:0,
      points:[
        {x:-.5,y:-.5},
        {x:.5,y:-.5},
        {x:.5,y:.5},
        {x:.12,y:.5},
        {x:.12,y:-.05},
        {x:-.12,y:-.05},
        {x:-.12,y:.5},
        {x:-.5,y:.5}
      ]
    }
  };

  const result=resolvePlayerCollisions(
    {x:500,y:650},
    18,
    [island],
    {x:0,y:-100}
  );

  assert.deepEqual(result.hits,[]);
});
