import { MultiplayerRuntime } from "../multiplayer/MultiplayerRuntime.js?v=20261002-2103";
import { FirebaseAuthService } from "./FirebaseAuthService.js?v=20260930-0018";
import { PlayerStateStore } from "../persistence/PlayerStateStore.js?v=20260930-0018";

export async function installAuthRuntime(runtime,{configUrl="./src/config/firebase-public.json"}={}){
  const response=await fetch(configUrl,{cache:"no-store"});
  if(!response.ok)throw new Error(`Firebase public config load failed: ${response.status}`);
  const config=await response.json();

  const auth=new FirebaseAuthService(config);
  const playerState=new PlayerStateStore(auth,config);
  const multiplayer=new MultiplayerRuntime(auth,config,{snapshotHz:10,pollMs:100});

  const signalReady=async(reason)=>{
    const status=auth.status();
    if(!status.authenticated)return {status,restore:null,state:null};

    let restore=null;
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
      await playerState.syncNow();
    }

    const detail={
      reason:String(reason||"authenticated"),
      status:auth.status(),
      restore,
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

  await auth.init();

  if(auth.status().authenticated){
    queueMicrotask(()=>signalReady("session_restored").catch(()=>{}));
  }

  return Object.freeze({
    auth,
    playerState,
    multiplayer,
    getStatus:()=>Object.freeze({
      ...playerState.status(),
      auth:auth.status()
    })
  });
}
