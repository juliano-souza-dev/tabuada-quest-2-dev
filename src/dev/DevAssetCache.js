const CACHE_NAME="tq-dev-assets-v20261003-2040-galeao";
const MANIFEST_URL="./src/config/asset-tree.json";
const HASH_KEY="tq.dev.asset-manifest-hash:v1";

const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));

function progressOverlay(){
  let el=document.querySelector("[data-dev-asset-preload]");
  if(el)return el;
  el=document.createElement("div");
  el.dataset.devAssetPreload="";
  el.innerHTML=`
    <section>
      <strong>Atualizando assets DEV</strong>
      <span data-dev-asset-status>Preparando atualização…</span>
      <progress data-dev-asset-progress max="100" value="0"></progress>
      <small data-dev-asset-count>0 / 0</small>
    </section>`;
  Object.assign(el.style,{
    position:"fixed",inset:"0",zIndex:"2147483647",
    display:"grid",placeItems:"center",
    background:"rgba(6,19,31,.96)",color:"#eefaff",
    fontFamily:"system-ui,Segoe UI,sans-serif"
  });
  const card=el.querySelector("section");
  Object.assign(card.style,{
    display:"grid",gap:"10px",width:"min(440px,calc(100vw - 36px))",
    padding:"22px",border:"1px solid rgba(255,255,255,.14)",
    borderRadius:"16px",background:"#0a2233"
  });
  const progress=el.querySelector("progress");
  Object.assign(progress.style,{width:"100%",height:"14px"});
  document.body.appendChild(el);
  return el;
}

function setProgress(el,{done,total,status}){
  const pct=total?Math.round((done/total)*100):0;
  const bar=el.querySelector("[data-dev-asset-progress]");
  const label=el.querySelector("[data-dev-asset-count]");
  const text=el.querySelector("[data-dev-asset-status]");
  if(bar)bar.value=pct;
  if(label)label.textContent=done+" / "+total+" · "+pct+"%";
  if(text&&status)text.textContent=status;
}

async function digest(text){
  if(!globalThis.crypto?.subtle)return String(text.length);
  const bytes=new TextEncoder().encode(text);
  const hash=await crypto.subtle.digest("SHA-256",bytes);
  return [...new Uint8Array(hash)].map(byte=>byte.toString(16).padStart(2,"0")).join("");
}

async function registerWorker(){
  if(!("serviceWorker" in navigator))return null;
  try{
    const registration=await navigator.serviceWorker.register("./dev-sw.js?v=20261005-manual-assets-v1",{scope:"./"});
    return registration;
  }catch(error){
    console.warn("[DEV asset cache] Service Worker unavailable",error);
    return null;
  }
}

async function fetchAndCache(cache,url,{force=false,retries=2}={}){
  if(!force){
    const cached=await cache.match(url,{ignoreSearch:true});
    if(cached)return {url,cached:true};
  }
  let lastError=null;
  for(let attempt=0;attempt<=retries;attempt++){
    try{
      const response=await fetch(url,{
        cache:force?"no-cache":"default",
        credentials:"same-origin"
      });
      if(!response.ok)throw new Error("HTTP "+response.status+" "+url);
      await cache.put(url,response.clone());
      return {url,cached:false};
    }catch(error){
      lastError=error;
      if(attempt<retries)await sleep(250*(attempt+1));
    }
  }
  throw lastError||new Error("Asset preload failed: "+url);
}

async function runPool(items,worker,limit=6,onDone=()=>{}){
  let cursor=0;
  let done=0;
  const runners=Array.from({length:Math.min(limit,Math.max(1,items.length))},async()=>{
    while(true){
      const index=cursor++;
      if(index>=items.length)return;
      await worker(items[index],index);
      done++;
      onDone(done,items.length);
    }
  });
  await Promise.all(runners);
}

export async function refreshDevAssetCache({force=true}={}){
  const overlay=progressOverlay();
  setProgress(overlay,{done:0,total:0,status:"Lendo catálogo de assets…"});

  try{
    const manifestResponse=await fetch(MANIFEST_URL+"?ts="+Date.now(),{
      cache:"no-store",
      credentials:"same-origin"
    });
    if(!manifestResponse.ok)throw new Error("Asset tree failed: "+manifestResponse.status);

    const manifestText=await manifestResponse.text();
    const manifest=JSON.parse(manifestText);
    const paths=[...new Set((manifest.assets||[])
      .map(asset=>String(asset.path||"").trim())
      .filter(path=>path.startsWith("assets/"))
    )];
    const urls=paths.map(path=>"./"+path);
    const cache=await caches.open(CACHE_NAME);
    const failures=[];

    setProgress(overlay,{done:0,total:urls.length,status:"Atualizando cache de assets…"});

    await runPool(urls,async url=>{
      try{
        await fetchAndCache(cache,url,{force});
      }catch(error){
        failures.push({url,error:String(error)});
      }
    },6,(done,total)=>setProgress(overlay,{
      done,total,
      status:"Baixando assets solicitados…"
    }));

    const manifestHash=await digest(manifestText);
    localStorage.setItem(HASH_KEY,manifestHash);

    setProgress(overlay,{
      done:urls.length-failures.length,
      total:urls.length,
      status:failures.length
        ?"Atualização concluída com "+failures.length+" falha(s)."
        :"Assets atualizados."
    });

    const result={total:urls.length,cacheName:CACHE_NAME,failures,manifestHash};
    globalThis.dispatchEvent?.(new CustomEvent("tq:dev-assets-updated",{detail:result}));
    await sleep(450);
    return result;
  }finally{
    overlay.remove();
  }
}

export async function installDevAssetCache(){
  await registerWorker();

  const api={
    cacheName:CACHE_NAME,
    deferred:true,
    refresh:options=>refreshDevAssetCache(options),
    clear:async()=>{
      await caches.delete(CACHE_NAME);
      localStorage.removeItem(HASH_KEY);
    }
  };
  globalThis.TabuadaQuestDevAssetCache=api;

  // Boot rápido: não percorre o catálogo nem baixa o pacote inteiro.
  // Assets individuais continuam sendo armazenados pelo service worker quando usados.
  return {cacheName:CACHE_NAME,deferred:true};
}
