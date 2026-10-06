import { enforcePwaOnly } from "./runtime/PwaGate.js?v=20261006-pwa-install-fix-v2";

const app=document.querySelector("#app");
if(!app)throw new Error("Tabuada Quest app root not found");

const gate=await enforcePwaOnly(app);
if(gate.allowed){
  await import("./game.js?v=20261006-offline-only-v1");
}else{
  globalThis.TabuadaQuest={
    ...(globalThis.TabuadaQuest||{}),
    pwaGate:gate,
    pwaOnly:true
  };
}
