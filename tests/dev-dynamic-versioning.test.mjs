import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read=path=>readFile(new URL("../"+path,import.meta.url),"utf8");

test("dev entrypoints dynamically version CSS, manifest and PWA entry",async()=>{
  for(const path of ["index.html","game.html"]){
    const html=await read(path);
    assert.match(html,/const stamp=Date\.now\(\)/);
    assert.match(html,/world-test\.css/);
    assert.match(html,/manifest\.webmanifest/);
    assert.match(html,/pwa-entry\.js\?v="\+stamp/);
    assert.doesNotMatch(html,/world-test\.css\?v=202\d/);
    assert.doesNotMatch(html,/pwa-entry\.js\?v=202\d/);
  }
});

test("runtime boot chain propagates the same dev stamp",async()=>{
  const pwa=await read("src/pwa-entry.js");
  const game=await read("src/game.js");
  const runtime=await read("src/runtime/GameRuntime.js");
  const world=await read("src/world/WorldRuntime.js");

  assert.match(pwa,/PwaGate\.js\?v="\+__tqDevStamp/);
  assert.match(game,/GameRuntime\.js\?v="\+__tqDevStamp/);
  assert.match(game,/AuthRuntimeBridge\.js\?v="\+__tqDevStamp/);
  assert.match(runtime,/SceneRuntime\.js\?v="\+__tqDevStamp/);
  assert.match(runtime,/WorldRuntime\.js\?v="\+__tqDevStamp/);
  assert.match(world,/NavalCombatWebGLRenderer\.mjs\?v="\+__tqDevStamp/);
  assert.doesNotMatch(world,/NavalCombatWebGLRenderer\.mjs\?v=202\d/);
});

test("service worker version and cache namespace are dynamic in dev",async()=>{
  const gate=await read("src/runtime/PwaGate.js");
  const sw=await read("sw.js");
  assert.match(gate,/register\("\.\/sw\.js\?v="\+stamp/);
  assert.match(gate,/registerWorker\(\)\.catch/);
  assert.match(sw,/searchParams\.get\("v"\)/);
  assert.match(sw,/CACHE_NAME="tq-pwa-runtime-"\+CACHE_STAMP/);
});
