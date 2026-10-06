const isStandalone=()=>(
  globalThis.matchMedia?.("(display-mode: standalone)")?.matches===true
  ||globalThis.matchMedia?.("(display-mode: fullscreen)")?.matches===true
  ||globalThis.navigator?.standalone===true
);

const isIOS=()=>{
  const ua=String(globalThis.navigator?.userAgent||"");
  const platform=String(globalThis.navigator?.platform||"");
  const touch=Math.max(0,Number(globalThis.navigator?.maxTouchPoints)||0);
  return /iPad|iPhone|iPod/i.test(ua)||(platform==="MacIntel"&&touch>1);
};

const html=String.raw;

async function registerWorker(){
  if(!("serviceWorker" in navigator))return null;
  try{
    return await navigator.serviceWorker.register("./sw.js?v=20261006-pwa-only-v1",{
      scope:"./",
      updateViaCache:"none"
    });
  }catch(error){
    console.warn("[TQ PWA] service worker registration failed",error);
    return null;
  }
}

function gateMarkup({ios=false}={}){
  return html`
    <main class="tq-pwa-gate" role="main">
      <section class="tq-pwa-gate__card" aria-labelledby="tq-pwa-title">
        <img class="tq-pwa-gate__icon" src="./assets/pwa/icon-192.svg" alt="">
        <p class="tq-pwa-gate__eyebrow">TABUADA QUEST</p>
        <h1 id="tq-pwa-title">Instale o jogo para continuar</h1>
        <p class="tq-pwa-gate__lead">O Tabuada Quest funciona somente como aplicativo instalado. O jogo não inicia dentro do navegador.</p>
        <button class="tq-pwa-gate__install" type="button" data-pwa-install>
          Instalar Tabuada Quest
        </button>
        <div class="tq-pwa-gate__status" data-pwa-status aria-live="polite"></div>
        <div class="tq-pwa-gate__ios" data-pwa-ios ${ios?"":"hidden"}>
          <strong>No iPhone ou iPad:</strong>
          <span>toque em Compartilhar e depois em “Adicionar à Tela de Início”.</span>
        </div>
        <p class="tq-pwa-gate__hint">Depois de instalar, abra o Tabuada Quest pelo ícone criado na tela inicial ou no menu de aplicativos.</p>
      </section>
    </main>`;
}

function installGateStyles(){
  if(document.querySelector("#tq-pwa-gate-style"))return;
  const style=document.createElement("style");
  style.id="tq-pwa-gate-style";
  style.textContent=`
    html,body{margin:0;min-height:100%;background:#071927}
    body{min-height:100vh;min-height:100dvh}
    #app{min-height:100vh;min-height:100dvh}
    .tq-pwa-gate{min-height:100vh;min-height:100dvh;display:grid;place-items:center;padding:max(20px,env(safe-area-inset-top)) max(18px,env(safe-area-inset-right)) max(20px,env(safe-area-inset-bottom)) max(18px,env(safe-area-inset-left));box-sizing:border-box;background:
      radial-gradient(circle at 50% 18%,rgba(24,98,126,.34),transparent 34%),
      linear-gradient(180deg,#071927,#0b2232 64%,#071927);color:#fff;font-family:system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}
    .tq-pwa-gate__card{width:min(420px,100%);box-sizing:border-box;padding:30px 24px 26px;border:1px solid rgba(224,172,70,.42);border-radius:24px;background:rgba(7,23,34,.92);box-shadow:0 22px 70px rgba(0,0,0,.48);text-align:center}
    .tq-pwa-gate__icon{width:104px;height:104px;display:block;margin:0 auto 16px;filter:drop-shadow(0 10px 24px rgba(0,0,0,.35))}
    .tq-pwa-gate__eyebrow{margin:0 0 8px;color:#e6b85b;font-size:12px;font-weight:900;letter-spacing:.18em}
    .tq-pwa-gate h1{margin:0;font:900 clamp(26px,7vw,36px)/1.05 Georgia,serif}
    .tq-pwa-gate__lead{margin:16px auto 20px;max-width:34ch;color:#d4e0e8;font-size:15px;line-height:1.5}
    .tq-pwa-gate__install{width:100%;min-height:52px;border:0;border-radius:14px;padding:12px 16px;background:linear-gradient(#efbd50,#c87d1d);color:#241307;font-size:16px;font-weight:900;box-shadow:inset 0 1px rgba(255,255,255,.45),0 8px 20px rgba(0,0,0,.3);cursor:pointer}
    .tq-pwa-gate__install:disabled{opacity:.55;cursor:default}
    .tq-pwa-gate__status{min-height:22px;margin:12px 0 0;color:#bfe9ff;font-size:13px;line-height:1.35}
    .tq-pwa-gate__ios{margin:14px 0 0;padding:13px 14px;border-radius:13px;background:rgba(255,255,255,.07);color:#eef8ff;font-size:14px;line-height:1.45}
    .tq-pwa-gate__ios strong,.tq-pwa-gate__ios span{display:block}
    .tq-pwa-gate__hint{margin:16px auto 0;color:#8fa8b7;font-size:12px;line-height:1.45}
    [hidden]{display:none!important}
  `;
  document.head.append(style);
}

export async function enforcePwaOnly(root){
  await registerWorker();
  if(isStandalone())return {allowed:true,standalone:true};

  installGateStyles();
  const ios=isIOS();
  root.innerHTML=gateMarkup({ios});

  const button=root.querySelector("[data-pwa-install]");
  const status=root.querySelector("[data-pwa-status]");
  let promptEvent=null;

  const setStatus=message=>{if(status)status.textContent=String(message||"")};
  const syncButton=()=>{
    if(!button)return;
    if(ios){
      button.textContent="Ver como instalar";
      button.disabled=false;
      return;
    }
    if(promptEvent){
      button.textContent="Instalar Tabuada Quest";
      button.disabled=false;
      return;
    }
    button.textContent="Aguardando opção de instalação…";
    button.disabled=true;
  };

  const beforeInstall=event=>{
    event.preventDefault();
    promptEvent=event;
    setStatus("");
    syncButton();
  };
  const installed=()=>{
    promptEvent=null;
    setStatus("Instalado. Agora abra o Tabuada Quest pelo ícone do aplicativo.");
    syncButton();
  };

  globalThis.addEventListener("beforeinstallprompt",beforeInstall);
  globalThis.addEventListener("appinstalled",installed);

  button?.addEventListener("click",async()=>{
    if(ios){
      const iosBox=root.querySelector("[data-pwa-ios]");
      if(iosBox)iosBox.hidden=false;
      setStatus("Use o menu Compartilhar do Safari.");
      return;
    }
    if(!promptEvent)return;
    button.disabled=true;
    try{
      await promptEvent.prompt();
      const choice=await promptEvent.userChoice;
      if(choice?.outcome==="accepted"){
        setStatus("Instalação iniciada. Depois, abra o jogo pelo ícone instalado.");
      }else{
        setStatus("A instalação foi cancelada.");
      }
    }catch(error){
      console.warn("[TQ PWA] install prompt failed",error);
      setStatus("Não foi possível abrir a instalação automaticamente.");
    }finally{
      promptEvent=null;
      syncButton();
    }
  });

  syncButton();

  // Some browsers dispatch beforeinstallprompt very early. Keep the gate active
  // regardless: browser play is intentionally blocked.
  return {
    allowed:false,
    standalone:false,
    destroy(){
      globalThis.removeEventListener("beforeinstallprompt",beforeInstall);
      globalThis.removeEventListener("appinstalled",installed);
    }
  };
}
