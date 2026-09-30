import test from "node:test";
import assert from "node:assert/strict";
import { resolveEntityPresentation, isLogicalOnlyEntity } from "../src/world/WorldEntityPresentation.mjs";

test("semantic location does not imply visual card chrome",()=>{
  const presentation=resolveEntityPresentation({
    type:"location",
    label:"Região 01",
    src:"./assets/backgrounds/regiao_01.webp"
  });
  assert.equal(presentation.renderMode,"sprite");
  assert.equal(presentation.hasSprite,true);
  assert.equal(presentation.showLabel,false);
  assert.equal(presentation.visualChrome,false);
});

test("background recognition stays logical while sprite stays raw",()=>{
  const presentation=resolveEntityPresentation({
    type:"location",
    src:"./assets/backgrounds/background.webp",
    renderMode:"sprite"
  });
  assert.equal(presentation.renderMode,"sprite");
  assert.equal(presentation.visualChrome,false);
});

test("entity without sprite can remain logical only",()=>{
  const entity={type:"location",renderMode:"logical"};
  assert.equal(isLogicalOnlyEntity(entity),true);
  assert.equal(resolveEntityPresentation(entity).hasSprite,false);
});

test("labels remain opt-in metadata without visual chrome",()=>{
  const presentation=resolveEntityPresentation({
    type:"location",
    src:"./assets/backgrounds/island.webp",
    showLabel:true
  });
  assert.equal(presentation.showLabel,true);
  assert.equal(presentation.visualChrome,false);
});
