import { GameRuntime } from "./runtime/GameRuntime.js?v=20261005-missions-flow-v2";
import { installAuthRuntime } from "./runtime/auth/AuthRuntimeBridge.js?v=20261005-ammo-ledger-v6";
import { createLocalFlowTestServices } from "./runtime/testing/LocalFlowTestServices.js?v=20261003-3015";

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

const mountRewardDiagnostics=()=>{
  if(!flowTest)return null;
  const panel=document.createElement("aside");
  panel.id="tq-reward-diagnostics";
  panel.style.cssText=[
    "position:fixed","right:8px","bottom:8px","z-index:2147483646",
    "width:min(420px,calc(100vw - 16px))","max-height:48vh","overflow:auto",
    "padding:10px 12px","border-radius:10px","background:rgba(8,12,20,.94)",
    "color:#dff7ff","font:12px/1.35 ui-monospace,SFMono-Regular,Consolas,monospace",
    "box-shadow:0 8px 28px rgba(0,0,0,.45)","white-space:pre-wrap"
  ].join(";");
  panel.textContent="Reward diagnostics ativo\nAguardando coleta...";
  document.body.append(panel);

  const rows=[];
  const push=(label,data={})=>{
    const stamp=new Date().toLocaleTimeString();
    rows.unshift("["+stamp+"] "+label+"\n"+JSON.stringify(data,null,2));
    panel.textContent=rows.slice(0,8).join("\n\n");
  };

  const rewardDebug=event=>push("rewarddebug",event.detail||{});
  const rewardGranted=event=>push("rewardgranted",event.detail||{});
  const playerSync=event=>push("player-sync",{
    event:event.detail||{},
    runtimeWallet:game?.getWalletBalances?.()||null,
    runtimeRewards:game?.rewards||null,
    persistedRewards:services?.playerState?.load?.()?.game?.rewards||null
  });
  const rewardClaim=event=>push("firebase-reward-claim",event.detail||{});
  const authReady=event=>push("auth-entry-ready",{
    reason:event.detail?.reason,
    restore:event.detail?.restore?.code,
    runtimeWallet:game?.getWalletBalances?.()||null,
    restoredRewards:event.detail?.state?.game?.rewards||null
  });

  globalThis.addEventListener("tq:rewarddebug",rewardDebug);
  globalThis.addEventListener("tq:rewardgranted",rewardGranted);
  globalThis.addEventListener("tq:player-sync",playerSync);
  globalThis.addEventListener("tq:player-reward-claim",rewardClaim);
  globalThis.addEventListener("tq:auth-entry-ready",authReady);

  return panel;
};
const rewardDiagnostics=null;
try{
game=await GameRuntime.load(app,"./src/config/game.manifest.json?v=20261005-missions-flow-v2");

if(flowTest){
  try{
    const key="tq.flowtest.world.override.v1";
    const raw=localStorage.getItem(key);
    if(raw){
      const payload=JSON.parse(raw);
      const world=payload?.world&&typeof payload.world==="object"?payload.world:null;
      const expectedId=start?.kind==="world"?String(start.id||""):"";
      if(world?.id&&(!expectedId||String(world.id)===expectedId)){
        game.setWorldOverride?.(world);
      }
      localStorage.removeItem(key);
    }
  }catch(error){
    try{localStorage.removeItem("tq.flowtest.world.override.v1")}catch{}
    console.warn("[TQ Game] flow-test world override ignored",error);
  }

  services=createLocalFlowTestServices();
  game.attachPlayerStateStore(services.playerState);
  game.attachMultiplayer?.(null);

  const detail={
    reason:"flowtest-local-session",
    status:services.auth.status(),
    restore:await services.playerState.restore(),
    content:{ok:true,code:"flowtest-local-json",source:"local-json"},
    state:services.playerState.load()
  };
  globalThis.dispatchEvent?.(new CustomEvent("tq:auth-entry-ready",{detail}));
}else{
  services=await installAuthRuntime(game,{
    configUrl:"./src/config/firebase-public.json?v=20260930-1851"
  });
  game.attachPlayerStateStore(services.playerState);
  game.attachMultiplayer?.(services.multiplayer);
}

await game.start(start);

}catch(error){showBootError(error);throw error}

globalThis.TabuadaQuest={
  ...(globalThis.TabuadaQuest||{}),
  game,
  runtime:game,
  auth:services.auth,
  playerState:services.playerState,
  multiplayer:services.multiplayer,
  flowTestLocalAccount:flowTest===true,
  getAccessStatus:services.getStatus,
  rewardDiagnostics
};