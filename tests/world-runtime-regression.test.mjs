import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

const runtime=readFileSync(new URL("../src/world/WorldRuntime.js",import.meta.url),"utf8");

test("removed mission services are not invoked by WorldRuntime",()=>{
  assert.doesNotMatch(runtime,/this\.(?:getMissionProgress|isMissionComplete)\s*\(/);
});
test("removed mission action is not wired to the interaction button",()=>{
  assert.doesNotMatch(runtime,/directAction==="open-shipyard"\|\|directAction==="open-missions"/);
});
test("dynamic import destructuring matches Promise.all entries",()=>{
  const prelude=runtime.slice(0,runtime.indexOf("]);")+3);
  const imports=[...prelude.matchAll(/\bimport\("/g)];
  const bindings=prelude.slice(prelude.indexOf("const [")+6,prelude.indexOf("]=await Promise.all"));
  const bindingCount=(bindings.match(/^  \{/gm)||[]).length;
  assert.equal(bindingCount,imports.length);
});
