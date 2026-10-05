const CONTINUITY_KEY="tq.app.continuity:v1";
const UPDATE_RELOAD_KEY="tq.app.update-reload:v1";
const BUILD_META_NAME="tq-build";
const CONTINUITY_MAX_AGE=12*60*60*1000;
const UPDATE_INTERVAL=45*1000;
const UPDATE_COOLDOWN=10*1000;

function currentBuildId(){
  return document.querySelector('meta[name="'+BUILD_META_NAME+'"]')?.content||"";
}

function parseRemoteBuildId(html){
  try{
    const doc=new DOMParser().parseFromString(html,"text/html");
    return doc.querySelector('meta[name="'+BUILD_META_NAME+'"]')?.content||"";
  }catch{
    return "";
  }
}

export function readAppContinuity(){
  try{
    const raw=sessionStorage.getItem(CONTINUITY_KEY);
    if(!raw)return null;
    const state=JSON.parse(raw);
    if(!state||state.schema!=="tq.app-continuity")return null;
    if(state.pathname&&state.pathname!==location.pathname)return null;
    if(Date.now()-Number(state.timestamp||0)>CONTINUITY_MAX_AGE)return null;
    return state;
  }catch{
    return null;
  }
}

export function saveAppContinuity({dev=null,runtime=null}={}){
  try{
    const base=typeof dev?.captureContinuity==="function"
      ? dev.captureContinuity()
      : {
        schema:"tq.app-continuity",
        version:1,
        timestamp:Date.now(),
        workspace:"page",
        mode:null,
        sceneId:runtime?.scene?.id||null,
        worldId:null,
        selectedId:null,
        panel:null
      };
    const state={
      ...base,
      timestamp:Date.now(),
      pathname:location.pathname,
      search:location.search,
      hash:location.hash,
      scrollX:window.scrollX||0,
      scrollY:window.scrollY||0
    };
    sessionStorage.setItem(CONTINUITY_KEY,JSON.stringify(state));
    return state;
  }catch(error){
    console.warn("Continuity save failed",error);
    return null;
  }
}

function createInstallButton(){
  let button=document.querySelector("[data-tq-install-app]");
  if(button)return button;
  button=document.createElement("button");
  button.type="button";
  button.className="tq-install-app";
  button.dataset.tqInstallApp="";
  button.hidden=true;
  button.textContent="📲 Instalar app";
  document.body.append(button);
  return button;
}

async function registerPWA(){
  if(!("serviceWorker" in navigator))return null;
  try{
    const registration=await navigator.serviceWorker.register("./sw.js?v=20261005-ammo-ledger-v6",{
      scope:"./",
      updateViaCache:"none"
    });
    return registration;
  }catch(error){
    console.warn("PWA service worker registration failed",error);
    return null;
  }
}

export function installAppLifecycle({dev=null,runtime=null}={}){
  const buildId=currentBuildId();
  const installButton=createInstallButton();
  let deferredInstallPrompt=null;
  let lastCheck=0;
  let checking=false;
  let reloading=false;
  let registration=null;

  const save=()=>saveAppContinuity({dev,runtime});

  const requestReload=remoteBuild=>{
    if(reloading)return;
    if(remoteBuild&&sessionStorage.getItem(UPDATE_RELOAD_KEY)===remoteBuild)return;
    reloading=true;
    save();
    if(remoteBuild)sessionStorage.setItem(UPDATE_RELOAD_KEY,remoteBuild);
    registration?.waiting?.postMessage?.({type:"SKIP_WAITING"});
    location.reload();
  };

  const checkForUpdate=async(force=false)=>{
    if(checking||reloading)return false;
    const now=Date.now();
    if(!force&&now-lastCheck<UPDATE_COOLDOWN)return false;
    lastCheck=now;
    checking=true;
    try{
      const response=await fetch("./index.html?__tq_update="+now,{
        cache:"no-store",
        headers:{"Cache-Control":"no-cache"}
      });
      if(!response.ok)return false;
      const remoteBuild=parseRemoteBuildId(await response.text());
      if(remoteBuild&&buildId&&remoteBuild!==buildId){
        requestReload(remoteBuild);
        return true;
      }
      if(remoteBuild===buildId)sessionStorage.removeItem(UPDATE_RELOAD_KEY);
      await registration?.update?.();
      return false;
    }catch(error){
      if(navigator.onLine)console.warn("Update check failed",error);
      return false;
    }finally{
      checking=false;
    }
  };

  window.addEventListener("pagehide",save);
  window.addEventListener("beforeunload",save);
  document.addEventListener("visibilitychange",()=>{
    if(document.visibilityState==="hidden")save();
    else checkForUpdate();
  });
  window.addEventListener("focus",()=>checkForUpdate());
  window.addEventListener("online",()=>checkForUpdate(true));

  for(const eventName of ["tq:sceneload","tq:worldopen","tq:worldchange","tq:selectionchange","tq:worldselectionchange"]){
    window.addEventListener(eventName,save);
  }

  window.addEventListener("beforeinstallprompt",event=>{
    event.preventDefault();
    deferredInstallPrompt=event;
    installButton.hidden=false;
  });
  window.addEventListener("appinstalled",()=>{
    deferredInstallPrompt=null;
    installButton.hidden=true;
  });
  installButton.addEventListener("click",async()=>{
    if(!deferredInstallPrompt)return;
    installButton.disabled=true;
    try{
      await deferredInstallPrompt.prompt();
      await deferredInstallPrompt.userChoice;
    }finally{
      deferredInstallPrompt=null;
      installButton.hidden=true;
      installButton.disabled=false;
    }
  });

  if(!dev){
    registerPWA().then(result=>{
      registration=result;
      setTimeout(()=>checkForUpdate(true),1200);
    });
  }

  const interval=setInterval(()=>checkForUpdate(),UPDATE_INTERVAL);

  return {
    save,
    checkForUpdate:()=>checkForUpdate(true),
    destroy(){
      clearInterval(interval);
      window.removeEventListener("pagehide",save);
      window.removeEventListener("beforeunload",save);
    }
  };
}
