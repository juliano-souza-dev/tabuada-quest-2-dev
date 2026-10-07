import assert from 'node:assert/strict';
import {isMonsterEntity,monsterAnimationConfig,monsterAnimationFrame,monsterFrameStyle,monsterPoseFrame} from '../src/world/WorldMonsterSprite.mjs';

const entity={
  id:'monster.test',
  entityKind:'monster',
  shipId:'monster-guardiao-abissal',
  sprite:{src:'./assets/monsters/guardiao.webp',columns:4,rows:4},
  spriteAnimations:{idle:{frameMs:100,loop:true,frames:Array.from({length:16},(_,i)=>i)}},
  npcNavigation:{vx:12,vy:0}
};

assert.equal(isMonsterEntity(entity),true);
assert.equal(isMonsterEntity({shipId:'monster-anything'}),true);
assert.equal(isMonsterEntity({shipId:'ship-galleon'}),false);
const config=monsterAnimationConfig(entity);
assert.equal(config.frames.length,16);
assert.equal(config.columns,4);
assert.equal(monsterAnimationFrame(entity,0).frame>=0,true);
const rendered=monsterFrameStyle(entity,0);
assert.match(rendered.style.backgroundImage,/guardiao\.webp/);
assert.equal(rendered.style.backgroundSize,'400% 400%');
assert.ok(rendered.frame>=0&&rendered.frame<16);
for(let t=0;t<2000;t+=73){
  const f=monsterAnimationFrame(entity,t).frame;
  assert.ok(f>=0&&f<16);
  const p=monsterPoseFrame(entity,t);
  assert.ok(Math.abs(p.offsetY)<=3.21);
  assert.ok(Math.abs(p.rotation)<=1.16);
  assert.ok(p.scaleY>.98&&p.scaleY<1.02);
}
console.log('world-monster-sprite: ok');
