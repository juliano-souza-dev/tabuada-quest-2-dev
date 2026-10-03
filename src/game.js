import { GameRuntime } from "./runtime/GameRuntime.js?v=20261002-2217";
import { installAuthRuntime } from "./runtime/auth/AuthRuntimeBridge.js?v=20261003-0210";

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

const showBootError=error=>{
  console.error("[TQ Game] boot failed",error);
  app.innerHTML='<div style="position:fixed;inset:0;display:grid;place-items:center;padding:24px;background:#081b2b;color:white;font:16px system-ui;text-align:center"><div><strong>Falha ao iniciar o teste</strong><br><br><span style="opacity:.8"></span></div></div>';
  const span=app.querySelector("span");if(span)span.textContent=String(error?.message||error);
};
let game;
let services;
try{
game=await GameRuntime.load(app,"./src/config/game.manifest.json?v=20261001-1848");
services=await installAuthRuntime(game,{
  configUrl:"./src/config/firebase-public.json?v=20260930-1851"
});
game.attachPlayerStateStore(services.playerState);
game.attachMultiplayer?.(services.multiplayer);

await game.start(start);

}catch(error){showBootError(error);throw error}

globalThis.TabuadaQuest={
  ...(globalThis.TabuadaQuest||{}),
  game,
  runtime:game,
  auth:services.auth,
  playerState:services.playerState,
  multiplayer:services.multiplayer,
  getAccessStatus:services.getStatus
};
