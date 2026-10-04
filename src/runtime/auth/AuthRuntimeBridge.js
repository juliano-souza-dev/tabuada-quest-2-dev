import { MultiplayerRuntime } from "../multiplayer/MultiplayerRuntime.js?v=20261003-2450";
import { FirebaseAuthService } from "./FirebaseAuthService.js?v=20260930-0018";
import { PlayerStateStore } from "../persistence/PlayerStateStore.js?v=20261003-2350";
import { GameContentStore } from "../content/GameContentStore.js?v=20261003-2630";

export async function createAuthRuntimeServices({configUrl="./src/config/firebase-public.json"}={}){
  const response=await fetch(configUrl,{cache:"no-store"});
  if(!response.ok)throw new Error(`Firebase public config load failed: ${response.status}`);
  const config=await response.json();

  const auth=new FirebaseAuthService(config);
  const playerState=new PlayerStateStore(auth,config);
  const multiplayer=new MultiplayerRuntime(auth,config,{snapshotHz:10,pollMs:100});
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

  runtime.registerAction(
    "auth.google.signIn",
    async()=>{
      const status=await auth.signInWithGoogle();
      if(status.authenticated)await signalReady("google_signed_in");
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
