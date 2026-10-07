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

test("start preserves the supplied clock and does not schedule twice",()=>{
  let scheduled=0;
  const loop=new WorldGameLoop({
    updateSimulationFrame:()=>{},
    updatePresentationFrame:()=>{},
    updateInterfaceFrame:()=>{}
  },{requestFrame:()=>++scheduled,cancelFrame:()=>{}});
  loop.lastTime=2000;
  assert.equal(loop.start(),true);
  assert.equal(loop.start(),false);
  assert.equal(loop.lastTime,2000);
  assert.equal(scheduled,1);
});

test("stopping inside simulation skips later phases and does not reschedule",()=>{
  let scheduled=0;
  const calls=[];
  let loop;
  loop=new WorldGameLoop({
    updateSimulationFrame:()=>{calls.push("simulation");loop.stop();},
    updatePresentationFrame:()=>calls.push("presentation"),
    updateInterfaceFrame:()=>calls.push("interface")
  },{requestFrame:()=>++scheduled,cancelFrame:()=>{}});
  loop.start();
  loop.frame(1000);
  assert.deepEqual(calls,["simulation"]);
  assert.equal(scheduled,1);
});
