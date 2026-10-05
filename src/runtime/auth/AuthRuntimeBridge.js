import { MultiplayerRuntime } from "../multiplayer/MultiplayerRuntime.js?v=20261005-ammo-ledger-v6";
import { FirebaseAuthService } from "./FirebaseAuthService.js?v=20261004-auth-trace";
import { PlayerStateStore } from "../persistence/PlayerStateStore.js?v=20261004-1924-runtime-refresh";
import { GameContentStore } from "../content/GameContentStore.js?v=20261003-2630";

export async function createAuthRuntimeServices({configUrl="./src/config/firebase-public.json"}={}){
  const response=await fetch(configUrl,{cache:"no-store"});
  if(!response.ok)throw new Error(`Firebase public config load failed: ${response.status}`);
  const config=await response.json();

  const auth=new FirebaseAuthService(config);
  const playerState=new PlayerStateStore(auth,config);
  const multiplayer=new MultiplayerRuntime(auth,config,{snapshotHz:Number(config.multiplayer?.snapshotHz)||20});
  const gameContent=new GameContentStore(auth,config);

  await auth.init();

  if(auth.status().authenticated){
    await gameContent.prepare({preferRemote:true,allowCache:true}).catch(()=>{});
  }

  return {config,auth,playerState,multiplayer,gameContent};
}

export async function installAuthRuntime(runtime,{configUrl="./src/config/firebase-public.json",services=null}={}){
  const resolved=services||await createAuthRuntimeServices({configUrl});
  const {auth,playerState,multiplayer,gameContent}=resolved;

  const signalReady=async(reason)=>{
    const status=auth.status();
    if(!status.authenticated)return {status,restore:null,state:null,content:null};

    // Authentication success must never be blocked by optional content/state sync.
    // If Firestore/content restore fails, enter the game with the authenticated
    // session and the best locally available state, then allow later sync retries.
    let content={ok:false,code:"content_not_prepared"};
    try{
      content=await gameContent.prepare({preferRemote:true,allowCache:true});
      if(content?.ok){
        try{
          await runtime.reloadCanonicalContent?.(gameContent);
        }catch(error){
          console.warn("Canonical content reload failed after auth",error);
        }
      }
    }catch(error){
      console.warn("Game content prepare failed after auth",error);
      content={ok:false,code:"content_prepare_failed",message:String(error?.message||error)};
    }

    let restore=null;
    try{
      if(playerState.hasPendingLocal()){
        const sync=await playerState.syncNow();
        restore=sync.ok
          ? await playerState.restore()
          : {ok:false,code:"restore_skipped_pending_local",state:playerState.load()};
      }else{
        restore=await playerState.restore();
      }

      const localState=playerState.load();
      if(restore?.code==="remote_state_empty"&&localState){
        await playerState.syncNow().catch(error=>console.warn("Initial player-state sync failed",error));
      }
    }catch(error){
      console.warn("Player state restore failed after auth",error);
      restore={ok:false,code:"restore_failed",message:String(error?.message||error),state:playerState.load()};
    }

    const detail={
      reason:String(reason||"authenticated"),
      status:auth.status(),
      restore,
      content,
      state:playerState.load()
    };
    globalThis.dispatchEvent?.(new CustomEvent("tq:auth-entry-ready",{detail}));
    return detail;
  };

  const showLoginDiagnostic=(message,ok=false)=>{
    let el=document.querySelector("[data-tq-auth-diagnostic]");
    if(!el){
      el=document.createElement("div");
      el.dataset.tqAuthDiagnostic="true";
      el.style.cssText="position:fixed;left:12px;right:12px;bottom:18px;z-index:2147483647;padding:10px 12px;border-radius:10px;background:rgba(5,12,20,.92);color:#fff;font:13px/1.35 system-ui;text-align:center;box-shadow:0 6px 24px rgba(0,0,0,.35)";
      document.body.append(el);
    }
    el.textContent=String(message||"");
    el.dataset.ok=ok?"true":"false";
    if(ok)setTimeout(()=>el.remove(),1800);
  };

  runtime.registerAction(
    "auth.google.signIn",
    async()=>{
      showLoginDiagnostic("Conectando ao Google…",true);
      const status=await auth.signInWithGoogle();
      if(!status.authenticated){
        const code=String(status.lastCode||"google_sign_in_failed");
        console.error("[TQ auth] Google login did not create a Firebase session",{code,status});
        showLoginDiagnostic("Login não concluído: "+code,false);
        return;
      }

      showLoginDiagnostic("Login confirmado. Carregando o jogo…",true);
      await signalReady("google_signed_in");

      // Safety net: if authentication succeeded but the route event was unable
      // to leave the login scene, enter the configured post-auth world directly.
      setTimeout(()=>{
        const current=runtime?.current;
        if(current?.kind==="scene"&&current?.id==="login"&&auth.status().authenticated){
          const target=runtime?.manifest?.afterAuth||{kind:"world",id:"r1-enseada-aprendizes"};
          const task=target.kind==="scene"
            ?runtime.openScene?.(target,{pushHistory:false})
            :runtime.openWorld?.(target,{pushHistory:false});
          Promise.resolve(task).catch(error=>{
            console.error("[TQ auth] Post-login fallback route failed",error);
            showLoginDiagnostic("Login OK, mas falhou ao abrir o jogo: "+String(error?.message||error),false);
          });
        }
      },1500);
    },
    {
      label:"Entrar com Google",
      assetPaths:["assets/ui/icons/ui_login_google_plaque.webp"]
    }
  );

  runtime.registerAction(
    "auth.restore",
    async()=>{
      if(auth.status().authenticated)await signalReady("manual_restore");
    },
    {label:"Restaurar progresso"}
  );

  runtime.registerAction(
    "auth.signOut",
    async()=>{
      await auth.signOut();
      globalThis.dispatchEvent?.(new CustomEvent("tq:auth-signed-out",{detail:{status:auth.status()}}));
    },
    {label:"Sair da conta"}
  );

  if(auth.status().authenticated){
    queueMicrotask(()=>signalReady("session_restored").catch(()=>{}));
  }

  return Object.freeze({
    auth,
    playerState,
    multiplayer,
    gameContent,
    getStatus:()=>Object.freeze({
      ...playerState.status(),
      auth:auth.status(),
      content:gameContent.status()
    })
  });
}
