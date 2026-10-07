import test from "node:test";
import assert from "node:assert/strict";
import {normalizeNpcPopulation,normalizeTreasurePopulation,normalizeNpcAmmoIds} from "../src/world/entities/PopulationRules.mjs";
import {normalizeAmmoInventory,navalShotDamage,resolvePlayerHullHp} from "../src/world/combat/NavalCombatRules.mjs";

test("NPC population normalizes identity, limits and ammo ids",()=>{
  const result=normalizeNpcPopulation({enabled:true,types:[{shipId:"corsair",count:99,hp:0,allowedAmmoIds:["ball","ball",""]}]});
  assert.equal(result.enabled,true);
  assert.equal(result.types[0].npcId,"corsair");
  assert.equal(result.types[0].count,50);
  assert.equal(result.types[0].hp,3);
  assert.deepEqual(result.types[0].allowedAmmoIds,["ball"]);
});

test("treasure population clamps invalid values",()=>{
  const result=normalizeTreasurePopulation({enabled:true,types:[{treasureId:"gold",count:150,spawnIntervalSec:-4}]});
  assert.equal(result.types[0].count,100);
  assert.equal(result.types[0].spawnIntervalSec,0);
});

test("ammo inventory removes invalid quantities without changing ids",()=>{
  assert.deepEqual(normalizeAmmoInventory({selectedAmmoId:"heavy",stock:{heavy:3.9,empty:-2}}),{selectedAmmoId:"heavy",stock:{heavy:3,empty:0}});
});

test("naval damage keeps cannon and ammo responsibilities explicit",()=>{
  assert.equal(navalShotDamage({damagePerShot:250},{damageFactor:1.5}),375);
});

test("player hull hp applies flat and percentage modifiers",()=>{
  assert.equal(resolvePlayerHullHp({combat:{hp:100},combatModifiers:{maxHpFlat:50,maxHpPct:.5}}),200);
});

test("npc ammo ids are stable and unique",()=>assert.deepEqual(normalizeNpcAmmoIds(["a","a"," b ",""]),["a","b"]));
