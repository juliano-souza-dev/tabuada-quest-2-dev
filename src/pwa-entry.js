import { enforcePwaOnly } from "./runtime/PwaGate.js?v=20261006-prod-boot-fix-v1";

const app=document.querySelector("#app");
if(!app)throw new Error("Tabuada Quest app root not found");

const showFatalBootError=error=>{
  console.error("[TQ PWA] boot failed",error);
  app.innerHTML=
    '<main style="min-height:100vh;min-height:100dvh;display:grid;place-items:center;padding:24px;box-sizing:border-box;background:#071927;color:#fff;font:15px/1.45 system-ui;text-align:center">'+
      '<section style="max-width:460px;padding:24px;border:1px solid rgba(230,184,91,.45);border-radius:18px;background:#0a2233">'+
        '<strong style="display:block;font-size:20px;margin-bottom:10px">Falha ao iniciar o Tabuada Quest</strong>'+
        '<span data-tq-boot-error style="opacity:.82"></span>'+
        '<button type="button" data-tq-reload style="display:block;width:100%;margin-top:18px;min-height:46px;border:0;border-radius:12px;background:#d99a32;color:#211306;font-weight:900">Tentar novamente</button>'+
      '</section>'+
    '</main>';
  const span=app.querySelector("[data-tq-boot-error]");
  if(span)span.textContent=String(error?.message||error||"Erro desconhecido");
  app.querySelector("[data-tq-reload]")?.addEventListener("click",()=>location.reload());
};

try{
  const gate=await enforcePwaOnly(app);
  if(gate.allowed){
    await import("./game.js?v=20261006-prod-boot-fix-v1");
  }else{
    globalThis.TabuadaQuest={
      ...(globalThis.TabuadaQuest||{}),
      pwaGate:gate,
      pwaOnly:true
    };
  }
}catch(error){
  showFatalBootError(error);
}
