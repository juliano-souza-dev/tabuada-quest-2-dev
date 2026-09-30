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
  assert.ok(String(config.ocean?.background||"").startsWith("./assets/ocean/"));
  assert.ok(["calm","adventure","storm"].includes(config.ocean?.preset));
  assert.ok(Number.isFinite(config.ocean?.speed));
  assert.ok(Number.isFinite(config.ocean?.swell));
});


test("complete ocean prototype defines the 7400x7400 playable area",()=>{
  assert.deepEqual(config.playableArea,{x:300,y:300,width:7400,height:7400});
});

test("complete ocean prototype includes five region islands",()=>{
  const islands=(config.entities||[]).filter(item=>item.type==="location"&&String(item.src||"").includes("/regions/islands/"));
  assert.equal(islands.length,5);
});

test("complete ocean prototype includes scattered treasure chests",()=>{
  const chests=(config.entities||[]).filter(item=>item.type==="treasure");
  assert.ok(chests.length>=10);
  assert.ok(chests.every(item=>String(item.src||"").includes("bau")));
});

test("player uses the 1600x1600 16-direction 4x4 atlas",()=>{
  const sprite=config.player?.sprite;
  assert.ok(String(sprite?.src||"").includes("pirate_ship_16dir_1600x1600_4x4.webp"));
  assert.equal(sprite?.imageWidth,1600);
  assert.equal(sprite?.imageHeight,1600);
  const keys=["n","nne","ne","ene","e","ese","se","sse","s","ssw","sw","wsw","w","wnw","nw","nnw"];
  assert.deepEqual(Object.keys(sprite?.regions||{}),keys);
  for(const region of Object.values(sprite.regions)){
    assert.equal(region.width,400);
    assert.equal(region.height,400);
  }
});
