import test from "node:test";
import assert from "node:assert/strict";
import {integratePlayerVelocity} from "../src/world/navigation/PlayerKinematics.mjs";
import {composeEntityVisualFrame} from "../src/world/presentation/EntityVisualFrame.mjs";
import {selectVisibleTreasures} from "../src/world/presentation/TreasureRenderModel.mjs";
import {paintEntityTransform} from "../src/world/presentation/EntityTransformPainter.mjs";

test("player velocity respects max speed",()=>{
  const result=integratePlayerVelocity({vx:1000,vy:0,input:{x:1,y:0},dt:1/60,maxSpeed:420});
  assert.ok(Math.hypot(result.vx,result.vy)<=420);
});
test("visual frame composes motion and effect offsets",()=>{
  const result=composeEntityVisualFrame({
    entity:{x:100,y:200,rotation:30,height:80},
    motionFrame:{offsetX:5,offsetY:-2,rotation:4,scaleY:2},
    effectFrame:{offsetX:3,offsetY:7,rotation:6,scaleX:1.2,scaleY:.5},
    timelineAnimated:false,hasDirectionalSprite:false
  });
  assert.equal(result.x,108);
  assert.equal(result.y,205);
  assert.equal(result.rotation,40);
  assert.equal(result.scaleY,1);
});
test("treasure model excludes collected and pending items",()=>{
  const entities=[
    {id:"a",type:"treasure",x:2,y:3,el:{hidden:false}},
    {id:"b",type:"treasure",treasurePending:true,el:{hidden:false}},
    {id:"c",type:"treasure",el:{hidden:false}},
    {id:"d",type:"npc",el:{hidden:false}}
  ];
  const result=selectVisibleTreasures(entities,new Set(["c"]),()=>0);
  assert.equal(result.length,1);
  assert.equal(result[0].x,2);
});
test("transform painter updates entity and name coordinates",()=>{
  const entity={rotation:10,el:{style:{},hidden:false},nameEl:{style:{},hidden:false}};
  paintEntityTransform(entity,{x:50,y:60,rotation:15,scaleX:1,scaleY:1,nameOffset:20},{active:false},{opacity:.4});
  assert.equal(entity.visualX,50);
  assert.equal(entity.el.style.left,"50px");
  assert.equal(entity.nameEl.style.top,"80px");
  assert.equal(entity.el.style.opacity,"1");
});
