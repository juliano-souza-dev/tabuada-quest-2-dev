import { GameRuntime } from "./runtime/GameRuntime.js?v=20261003-2235";
import { installAuthRuntime } from "./runtime/auth/AuthRuntimeBridge.js?v=20261003-0223";

const app=document.querySelector("#app");
const params=new URLSearchParams(location.search);
const rawStart=params.get("start");
const flowTest=params.get("flowtest")==="1";
let start=null;

if(rawStart){
  const separator=rawStart.indexOf(":");
  if(separator>0){
    const kind=rawStart.slice(0,separator);
    const id=rawStart.slice(separator+1);
    if((kind==="scene"||kind==="world")&&id)start={kind,id};
  }
}

const mountFlowTestExit=()=>{
  if(!flowTest)return null;
  document.documentElement.classList.add("tq-flow-test-active");
  const button=document.createElement("button");
  button.type="button";
  button.className="tq-flow-test-exit";
  button.setAttribute("aria-label","Sair do modo testar fluxo");
  button.title="Sair do modo Testar fluxo";
  button.innerHTML='<span aria-hidden="true">✕</span><strong>Sair do teste</strong>';
  button.addEventListener("click",()=>{
    try{globalThis.opener?.focus?.()}catch{}
    try{globalThis.close()}catch{}
    setTimeout(()=>{
      if(!document.hidden)location.href="./index.html";
    },120);
  });
  document.body.append(button);
  return button;
};

mountFlowTestExit();

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
