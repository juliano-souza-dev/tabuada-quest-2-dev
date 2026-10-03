import test from "node:test";
import assert from "node:assert/strict";
import { normalizeWorldWeatherCycle, computeWorldWeatherCycle } from "../src/world/WorldWeatherCycle.mjs";

test("weather cycle defaults to 12 minutes normal and 3 minutes rain",()=>{
  const cycle=normalizeWorldWeatherCycle({active:true});
  assert.equal(cycle.normalDurationMs,720000);
  assert.equal(cycle.rainDurationMs,180000);
  assert.equal(cycle.normalWeather,"halloween");
  assert.equal(cycle.rainWeather,"halloween-rain");
});

test("weather cycle alternates normal then rain and repeats",()=>{
  const config={active:true,normalDurationMs:720000,rainDurationMs:180000};
  assert.equal(computeWorldWeatherCycle(config,0).phase,"normal");
  assert.equal(computeWorldWeatherCycle(config,719999).phase,"normal");
  assert.equal(computeWorldWeatherCycle(config,720000).phase,"rain");
  assert.equal(computeWorldWeatherCycle(config,899999).phase,"rain");
  assert.equal(computeWorldWeatherCycle(config,900000).phase,"normal");
});
