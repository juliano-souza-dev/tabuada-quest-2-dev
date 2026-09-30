import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import {resolve,dirname} from "node:path";
import {fileURLToPath} from "node:url";

const here=dirname(fileURLToPath(import.meta.url));
const root=resolve(here,"..");
const world=JSON.parse(await readFile(resolve(root,"src/world/ocean-horizon-blend.world.json"),"utf8"));

test("horizon-blend sea keeps the existing WebGL ocean engine",()=>{
  assert.equal(world.ocean?.renderer,"webgl");
  assert.ok(String(world.ocean?.background||"").startsWith("./assets/ocean/"));
});

test("horizon background starts fitted to the full ship navigation area",()=>{
  const area=world.playableArea;
  const bg=(world.entities||[]).find(entity=>entity.id==="background.horizonte-integrado");
  assert.ok(bg);
  assert.equal(bg.type,"background");
  assert.equal(bg.x,area.x+area.width/2);
  assert.equal(bg.y,area.y+area.height/2);
  assert.equal(bg.width,area.width);
  assert.equal(bg.height,area.height);
  assert.equal(bg.lockAspect,false);
});

test("horizon background uses the ocean integration preset",()=>{
  const bg=(world.entities||[]).find(entity=>entity.id==="background.horizonte-integrado");
  assert.equal(bg.effect?.preset,"horizon-blend");
  assert.equal(bg.effect?.mode,"horizonBlend");
  assert.equal(bg.effect?.renderer,"parallax");
  assert.equal(bg.effect?.active,true);
});
