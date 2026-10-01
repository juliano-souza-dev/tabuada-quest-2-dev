import test from "node:test";
import assert from "node:assert/strict";
import { readFile, access } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { resolve, dirname } from "node:path";

const here=dirname(fileURLToPath(import.meta.url));
const root=resolve(here,"..");

const config=JSON.parse(await readFile(resolve(root,"src/world/world-test.world.json"),"utf8"));
const catalog=JSON.parse(await readFile(resolve(root,"src/config/world-catalog.json"),"utf8"));

test("world prototype has finite positive dimensions",()=>{
  assert.ok(Number.isFinite(config.width)&&config.width>390);
  assert.ok(Number.isFinite(config.height)&&config.height>844);
});

test("world entities have unique ids and stay inside world bounds",()=>{
  const seen=new Set();
  for(const entity of config.entities||[]){
    assert.ok(entity.id);
    assert.equal(seen.has(entity.id),false,"duplicate entity id: "+entity.id);
    seen.add(entity.id);
    assert.ok(entity.x>=0&&entity.x<=config.width,"x outside world: "+entity.id);
    assert.ok(entity.y>=0&&entity.y<=config.height,"y outside world: "+entity.id);
  }
});

test("location entities point to scene files that exist",async()=>{
  for(const entity of (config.entities||[]).filter(item=>item.type==="location")){
    assert.ok(String(entity.scene||"").endsWith(".scene.json"),"missing scene for "+entity.id);
    const scenePath=resolve(root,String(entity.scene).replace(/^\.\//,""));
    await access(scenePath);
  }
});

test("world catalog exposes the prototype world",async()=>{
  assert.equal(catalog.schema,"tq.world-catalog");
  const ids=new Set();
  for(const entry of catalog.worlds||[]){
    assert.ok(entry.id&&entry.path);
    assert.equal(ids.has(entry.id),false,"duplicate world id: "+entry.id);
    ids.add(entry.id);
    await access(resolve(root,String(entry.path).replace(/^\.\//,"")));
  }
  assert.ok(ids.has("ocean-prototype"));
});

test("world prototype is editor-versioned",()=>{
  assert.equal(config.meta?.editorVersion,1);
  assert.ok(config.meta?.sourceRevision);
});

test("world prototype defines editable ocean movement",()=>{
  assert.equal(config.ocean?.active,true);
  assert.ok(String(config.ocean?.background||"").startsWith("./assets/backgrounds/"));
  assert.ok(["calm","adventure","storm"].includes(config.ocean?.preset));
  assert.ok(Number.isFinite(config.ocean?.speed));
  assert.ok(Number.isFinite(config.ocean?.swell));
});


test("world ocean controls stay slider-based in the DEV inspector", async()=>{
  const source=await readFile(new URL("../src/dev/DevOverlay.js",import.meta.url),"utf8");
  assert.match(source,/const oceanRange=/);
  for(const key of ["tileSize","brightness","saturation","speed","directionX","directionY","swell"]){
    assert.match(source,new RegExp('oceanRange\\("'+key+'"'));
  }
  assert.match(source,/data-ocean-output/);
  assert.match(source,/updateOcean\(\{\[key\]:value\},false\)/);
});


test("world config exposes navigator ship controls", async()=>{
  const overlay=await readFile(new URL("../src/dev/DevOverlay.js",import.meta.url),"utf8");
  const runtime=await readFile(new URL("../src/world/WorldRuntime.js",import.meta.url),"utf8");
  assert.match(overlay,/Navio navegador/);
  assert.match(overlay,/data-player-prop="src"/);
  assert.match(overlay,/data-player-prop="width"/);
  assert.match(overlay,/data-player-prop="height"/);
  assert.match(runtime,/getPlayerConfig\(\)/);
  assert.match(runtime,/updatePlayerConfig\(patch=\{\}/);
});


test("navigator ship selector refreshes from asset manifest", async()=>{
  const source=await readFile(new URL("../src/dev/DevOverlay.js",import.meta.url),"utf8");
  assert.match(source,/refreshWorldShipOptions\(\)/);
  assert.match(source,/data-player-prop="src"/);
  assert.match(source,/this\.loadAssets\(\)\.catch/);
  assert.match(source,/this\.refreshWorldShipOptions\?\.\(\)/);
});


test("world editor disables touch pinch zoom but keeps wheel zoom", async()=>{
  const runtime=await readFile(new URL("../src/world/WorldRuntime.js",import.meta.url),"utf8");
  assert.match(runtime,/Pinch\/multi-touch zoom is intentionally disabled/);
  assert.doesNotMatch(runtime,/let pinch=null/);
  assert.doesNotMatch(runtime,/pointerCenter=/);
  assert.doesNotMatch(runtime,/pinch\.world/);
  assert.match(runtime,/setEditorZoomAt\(this\.zoom\*factor,event\.clientX,event\.clientY\)/);
});
