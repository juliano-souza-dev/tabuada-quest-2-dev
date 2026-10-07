import test from "node:test";
import assert from "node:assert/strict";
import {
  hasTimelineSpriteAnimation,
  resolveTimelineAnimationName,
  timelineAnimationFrame,
  atlasFrameStyle
} from "../src/world/WorldSpriteAnimation.mjs";

const baseEntity={
  id:"monster.guardiao",
  entityKind:"monster",
  spriteAnimationMode:"timeline",
  sprite:{src:"guardiao.webp",columns:4,rows:4},
  animations:{
    idle:{frameMs:100,loop:true,frames:[0,1,2,3]},
    swim:{frameMs:80,loop:true,frames:[4,5,6,7]}
  },
  npcNavigation:{mode:"stationary",vx:0,vy:0}
};

test("timeline atlas is enabled only with explicit animation contract",()=>{
  assert.equal(hasTimelineSpriteAnimation(baseEntity),true);
  assert.equal(hasTimelineSpriteAnimation({...baseEntity,spriteAnimationMode:""}),false);
  assert.equal(hasTimelineSpriteAnimation({...baseEntity,sprite:null}),false);
});

test("stationary monster uses idle and moving monster uses swim",()=>{
  assert.equal(resolveTimelineAnimationName(baseEntity),"idle");
  const moving={...baseEntity,npcNavigation:{mode:"roam",vx:12,vy:0}};
  assert.equal(resolveTimelineAnimationName(moving),"swim");
});

test("timeline frames advance and loop deterministically",()=>{
  assert.equal(timelineAnimationFrame(baseEntity,0,0).frame,0);
  assert.equal(timelineAnimationFrame(baseEntity,100,0).frame,1);
  assert.equal(timelineAnimationFrame(baseEntity,400,0).frame,0);
});

test("atlas style crops the selected 4x4 frame",()=>{
  const style=atlasFrameStyle(baseEntity.sprite,5);
  assert.equal(style.backgroundImage,'url("guardiao.webp")');
  assert.equal(style.backgroundSize,"400% 400%");
  assert.equal(style.backgroundPosition,(1/3*100)+"% "+(1/3*100)+"%");
  assert.equal(style.backgroundRepeat,"no-repeat");
});
