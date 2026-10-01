import test from "node:test";
import assert from "node:assert/strict";
import { PedagogyRuntime } from "../src/runtime/pedagogy/PedagogyRuntime.js";

const curriculum={
  schema:"tq.pedagogy-curriculum",
  version:1,
  factors:{min:1,max:10},
  factsTotal:100,
  exposuresPerFact:4,
  plannedPresentations:400,
  regions:10,
  islandsPerRegion:5,
  challengesPerIsland:8,
  presentationsPerRegion:40,
  bonusChallenges:{
    treasureChest:{
      enabled:true,
      countTowardPlannedPresentations:false,
      source:"current-region-planned-facts"
    }
  }
};

test("curriculum creates exactly 400 planned presentations",()=>{
  const runtime=new PedagogyRuntime({curriculum});
  const check=runtime.validateCurriculum();
  assert.equal(check.valid,true);
  assert.equal(check.facts,100);
  assert.equal(check.presentations,400);
  assert.deepEqual(check.regionCounts,[40,40,40,40,40,40,40,40,40,40]);
});

test("every multiplication fact appears exactly four times",()=>{
  const runtime=new PedagogyRuntime({curriculum});
  const counts=new Map();
  for(const slot of runtime.plannedSlots()){
    const key=slot.a+"x"+slot.b;
    counts.set(key,(counts.get(key)||0)+1);
  }
  assert.equal(counts.size,100);
  assert.ok([...counts.values()].every(value=>value===4));
});

test("every region has five islands with eight planned challenges",()=>{
  const runtime=new PedagogyRuntime({curriculum});
  const slots=runtime.plannedSlots();
  for(let region=1;region<=10;region++){
    const regionSlots=slots.filter(slot=>slot.region===region);
    assert.equal(regionSlots.length,40);
    for(let island=1;island<=5;island++){
      assert.equal(regionSlots.filter(slot=>slot.island===island).length,8);
    }
  }
});

test("treasure challenge is bonus and uses only current-region scheduled facts",()=>{
  const runtime=new PedagogyRuntime({
    curriculum,
    getState:()=>({game:{pedagogy:{progress:{plannedCompleted:0}}}})
  });
  const regionFacts=new Set(runtime.factsForRegion(1).map(f=>f.a+"x"+f.b));
  const challenge=runtime.createChallenge({kind:"treasure",entityType:"treasure",entityId:"treasure.01"});
  assert.equal(challenge.available,true);
  assert.equal(challenge.region,1);
  assert.equal(challenge.bonus,true);
  assert.equal(challenge.countsTowardPlanned,false);
  assert.ok(regionFacts.has(challenge.a+"x"+challenge.b));
});

test("explicit allowed facts override curriculum pool",()=>{
  const runtime=new PedagogyRuntime({
    curriculum,
    getState:()=>({
      game:{
        pedagogy:{
          allowedFacts:[{a:3,b:4}]
        }
      }
    })
  });
  const challenge=runtime.createChallenge({kind:"treasure",entityType:"treasure"});
  assert.equal(challenge.available,true);
  assert.equal(challenge.a,3);
  assert.equal(challenge.b,4);
  assert.equal(challenge.evaluate("12").correct,true);
  assert.equal(challenge.evaluate("11").correct,false);
});

test("runtime accepts declared fact formats without expanding explicit pool",()=>{
  const runtime=new PedagogyRuntime({
    curriculum,
    getState:()=>({
      pedagogy:{
        activeFacts:["2x5",[7,3],{factorA:4,factorB:6},"invalid"]
      }
    })
  });
  const facts=runtime.allowedFacts().facts.map(f=>f.a+"x"+f.b).sort();
  assert.deepEqual(facts,["2x5","4x6","7x3"]);
});
