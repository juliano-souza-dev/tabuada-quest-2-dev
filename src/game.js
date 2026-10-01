import { GameRuntime } from "./runtime/GameRuntime.js?v=20260930-2258";

const app=document.querySelector("#app");
const params=new URLSearchParams(location.search);
const rawStart=params.get("start");
let start=null;

if(rawStart){
  const separator=rawStart.indexOf(":");
  if(separator>0){
    const kind=rawStart.slice(0,separator);
    const id=rawStart.slice(separator+1);
    if((kind==="scene"||kind==="world")&&id)start={kind,id};
  }
}

const game=await GameRuntime.load(app,"./src/config/game.manifest.json?v=20260930-2258");
await game.start(start);

globalThis.TabuadaQuest={
  ...(globalThis.TabuadaQuest||{}),
  game,
  runtime:game
};
