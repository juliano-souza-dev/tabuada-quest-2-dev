import test from "node:test";
import assert from "node:assert/strict";
import { WorldGameLoop } from "../src/world/systems/WorldGameLoop.mjs";

test("WorldGameLoop preserves simulation, presentation and interface order",()=>{
  const calls=[];
  const queued=[];
  const runtime={
    updateSimulationFrame:(time,dt)=>calls.push(["simulation",time,dt]),
    updatePresentationFrame:(time,dt)=>calls.push(["presentation",time,dt]),
    updateInterfaceFrame:(time,dt)=>calls.push(["interface",time,dt])
  };
  const loop=new WorldGameLoop(runtime,{
    requestFrame:callback=>{queued.push(callback);return queued.length;},
    cancelFrame:()=>{}
  });
  loop.running=true;
  loop.lastTime=1000;
  loop.frame(1050);
  assert.deepEqual(calls.map(([name])=>name),["simulation","presentation","interface"]);
  assert.equal(calls[0][2],.05);
  assert.equal(queued.length,1);
});

test("WorldGameLoop caps long frame deltas and stop cancels the scheduled frame",()=>{
  const dts=[];
  const cancelled=[];
  const loop=new WorldGameLoop({
    updateSimulationFrame:(_time,dt)=>dts.push(dt),
    updatePresentationFrame:()=>{},
    updateInterfaceFrame:()=>{}
  },{
    requestFrame:()=>17,
    cancelFrame:id=>cancelled.push(id)
  });
  loop.running=true;
  loop.lastTime=1000;
  loop.frame(5000);
  assert.equal(dts[0],.10);
  assert.equal(loop.frameId,17);
  loop.stop();
  assert.deepEqual(cancelled,[17]);
  assert.equal(loop.running,false);
  assert.equal(loop.frameId,0);
});
