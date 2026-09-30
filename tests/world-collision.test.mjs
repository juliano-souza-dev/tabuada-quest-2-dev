import test from "node:test";
import assert from "node:assert/strict";
import {
  normalizeCollision,
  inferCollisionAction,
  collisionMessage,
  resolveCircleVsEntity,
  removeVelocityIntoNormal,
  contourVelocity
} from "../src/world/WorldCollision.mjs";

test("collision defaults distinguish islands, collectibles and backgrounds",()=>{
  assert.equal(normalizeCollision({}, {type:"island"}).active,true);
  assert.equal(normalizeCollision({}, {type:"treasure"}).active,true);
  assert.equal(normalizeCollision({}, {type:"barrel"}).active,true);
  assert.equal(normalizeCollision({}, {type:"ship"}).active,true);
  assert.equal(normalizeCollision({}, {type:"background"}).active,false);
  assert.equal(normalizeCollision({}, {type:"location",effect:{category:"background"}}).active,false);
});

test("collision actions are inferred from entity purpose",()=>{
  assert.equal(inferCollisionAction({type:"treasure"},{}),"collect");
  assert.equal(inferCollisionAction({type:"barrel"},{}),"collect");
  assert.equal(inferCollisionAction({type:"location",scene:"./island.scene.json"},{}),"enter-scene");
  assert.equal(inferCollisionAction({type:"ship"},{}),"none");
  assert.equal(inferCollisionAction({type:"location",scene:"./island.scene.json"},{action:"none"}),"none");
});

test("collision message uses custom copy or a safe automatic fallback",()=>{
  assert.equal(
    collisionMessage({type:"treasure",label:"Baú Dourado"},{message:"Tesouro à vista!"}),
    "Tesouro à vista!"
  );
  assert.match(collisionMessage({type:"treasure",label:"Baú Dourado"},{}),/Baú Dourado/);
});

test("circle collision keeps the ship outside an island ellipse",()=>{
  const island={
    id:"island.1",
    type:"island",
    x:500,
    y:500,
    width:420,
    height:300,
    rotation:0
  };
  const hit=resolveCircleVsEntity(
    {x:620,y:500},
    30,
    island,
    {active:true,shape:"ellipse",scaleX:.72,scaleY:.52,padding:10}
  );
  assert.equal(hit.collided,true);
  assert.ok(hit.x>620);
  assert.ok(hit.normalX>0);
});

test("normal response removes velocity that points through an obstacle",()=>{
  const next=removeVelocityIntoNormal({x:-200,y:70},1,0);
  assert.equal(next.x,0);
  assert.equal(next.y,70);
});

test("non-interactive collision produces a stable tangential contour velocity",()=>{
  const next=contourVelocity(
    {x:-180,y:0},
    1,
    0,
    {x:-1,y:0},
    {side:1,minSpeed:120,maxSpeed:220,strength:1}
  );
  assert.ok(Math.abs(next.x)<1e-6);
  assert.ok(Math.abs(next.y)>=120);
  assert.equal(next.side,1);
});
