import test from "node:test";
import assert from "node:assert/strict";
import { PedagogyRuntime } from "../src/runtime/pedagogy/PedagogyRuntime.js";

test("pedagogy runtime does not invent facts when rules are absent",()=>{
  const runtime=new PedagogyRuntime({getState:()=>({game:{pedagogy:{}}})});
  const challenge=runtime.createChallenge({worldId:"ocean",entityId:"treasure.01"});
  assert.equal(challenge.available,false);
  assert.equal(challenge.code,"pedagogy_rules_unavailable");
});

test("pedagogy runtime only draws from allowed facts",()=>{
  const runtime=new PedagogyRuntime({
    getState:()=>({
      game:{
        pedagogy:{
          allowedFacts:[{a:3,b:4}]
        }
      }
    })
  });
  const challenge=runtime.createChallenge({worldId:"ocean",entityId:"treasure.01"});
  assert.equal(challenge.available,true);
  assert.equal(challenge.a,3);
  assert.equal(challenge.b,4);
  assert.equal(challenge.prompt,"3 × 4 = ?");
  assert.equal(challenge.evaluate("12").correct,true);
  assert.equal(challenge.evaluate("11").correct,false);
});

test("pedagogy runtime accepts declared fact formats without expanding the pool",()=>{
  const runtime=new PedagogyRuntime({
    getState:()=>({
      pedagogy:{
        activeFacts:["2x5",[7,3],{factorA:4,factorB:6},"invalid"]
      }
    })
  });
  const facts=runtime.allowedFacts().map(f=>f.a+"x"+f.b).sort();
  assert.deepEqual(facts,["2x5","4x6","7x3"]);
});
