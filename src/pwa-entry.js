import { enforcePwaOnly } from "./runtime/PwaGate.js?v=20261006-pwa-install-fix-v2";

const app=document.querySelector("#app");
if(!app)throw new Error("Tabuada Quest app root not found");

const showOpeningBanner=async()=>{
  const overlay=document.createElement("div");
  overlay.setAttribute("aria-label","Abertura Tabuada Quest Halloween");
  Object.assign(overlay.style,{
    position:"fixed",
    inset:"0",
    zIndex:"2147483647",
    background:"#050709",
    display:"grid",
    placeItems:"center",
    overflow:"hidden",
    opacity:"1",
    transition:"opacity 420ms ease"
  });

  const img=document.createElement("img");
  img.src="./assets/ui/evento_halloween_terror_em_alto_mar.webp?v=20261006-opening-banner-v1";
  img.alt="Evento Halloween: Terror em Alto Mar";
  Object.assign(img.style,{
    width:"100%",
    height:"100%",
    objectFit:"contain",
    objectPosition:"center",
    display:"block"
  });

  overlay.append(img);
  document.body.append(overlay);

  await Promise.race([
    new Promise(resolve=>{
      if(img.complete)resolve();
      else{
        img.addEventListener("load",resolve,{once:true});
        img.addEventListener("error",resolve,{once:true});
      }
    }),
    new Promise(resolve=>setTimeout(resolve,1400))
  ]);

  await new Promise(resolve=>setTimeout(resolve,2600));
  overlay.style.opacity="0";
  await new Promise(resolve=>setTimeout(resolve,440));
  overlay.remove();
};

const gate=await enforcePwaOnly(app);
if(gate.allowed){
  await showOpeningBanner();
  await import("./game.js?v=20261006-opening-banner-v1");
}else{
  globalThis.TabuadaQuest={
    ...(globalThis.TabuadaQuest||{}),
    pwaGate:gate,
    pwaOnly:true
  };
}
