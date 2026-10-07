import { enforcePwaOnly } from "./runtime/PwaGate.js?v=20261007-monster-water-blood-v2";

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
    overflow:"hidden",
    opacity:"1",
    transition:"opacity 320ms ease"
  });

  const img=document.createElement("img");
  img.src="./assets/ui/evento_halloween_terror_em_alto_mar.webp?v=20261006-opening-banner-play-v2";
  img.alt="Evento Halloween: Terror em Alto Mar";
  Object.assign(img.style,{
    position:"absolute",
    inset:"0",
    width:"100%",
    height:"100%",
    objectFit:"cover",
    objectPosition:"center",
    display:"block",
    imageRendering:"auto",
    transform:"translateZ(0)",
    backfaceVisibility:"hidden"
  });

  const play=document.createElement("button");
  play.type="button";
  play.setAttribute("aria-label","Jogar");
  Object.assign(play.style,{
    position:"absolute",
    left:"50%",
    bottom:"clamp(2.5%, 3.5vh, 5%)",
    transform:"translateX(-50%)",
    width:"min(64vw, 300px)",
    height:"clamp(54px, 10vh, 96px)",
    border:"0",
    padding:"0",
    margin:"0",
    background:"transparent",
    cursor:"pointer",
    zIndex:"2",
    WebkitTapHighlightColor:"transparent"
  });
  overlay.append(img,play);
  document.body.append(overlay);

  await new Promise(resolve=>{
    const finish=()=>{
      play.disabled=true;
      overlay.style.opacity="0";
      setTimeout(()=>{overlay.remove();resolve();},330);
    };
    play.addEventListener("click",finish,{once:true});
    play.addEventListener("pointerup",event=>{
      event.preventDefault();
      event.stopPropagation();
    },{passive:false});
  });
};

const gate=await enforcePwaOnly(app);
if(gate.allowed){
  await showOpeningBanner();
  const devStamp=Date.now();
  globalThis.__TQ_DEV_STAMP__=devStamp;
  await import("./game.js?v="+devStamp);
}else{
  globalThis.TabuadaQuest={
    ...(globalThis.TabuadaQuest||{}),
    pwaGate:gate,
    pwaOnly:true
  };
}
