import { SceneRuntime } from "./runtime/SceneRuntime.js?v=20260930-2320";
import { SceneResolver } from "./runtime/SceneResolver.js?v=20260930-1851";
import { installAuthRuntime } from "./runtime/auth/AuthRuntimeBridge.js?v=20260930-1851";
import { PedagogyRuntime } from "./runtime/pedagogy/PedagogyRuntime.js?v=20261001-0035";
import { DevOverlay } from "./dev/DevOverlay.js?v=20261001-0035";
import { launchWorldTest } from "./world/WorldTestLauncher.js?v=20260930-2242";
import { readAppContinuity, installAppLifecycle } from "./runtime/AppLifecycle.js?v=20260930-1851";

const app=document.querySelector("#app");
const continuity=readAppContinuity();
const worldTestParam=new URLSearchParams(location.search).get("worldtest");
const worldTest=Boolean(worldTestParam);

if(worldTest){
  const worldId=worldTestParam==="1"?"ocean-prototype":worldTestParam;
  await launchWorldTest(app,{worldId});
  globalThis.TabuadaQuest={
    ...(globalThis.TabuadaQuest||{}),
    lifecycle:installAppLifecycle()
  };
}else{
  const resolver=await SceneResolver.load("./src/config/scene-catalog.json?v=20260930-1851");
  const continuityScene=continuity?.sceneId
    ? resolver.catalog.scenes.find(scene=>scene.id===continuity.sceneId&&scene.path)
    : null;
  const resolved=continuityScene?{scene:continuityScene}:resolver.resolve("login");

  const runtime=new SceneRuntime(app,{width:390,height:844},{editorEnabled:true});
  const services=await installAuthRuntime(runtime,{
    configUrl:"./src/config/firebase-public.json?v=20260930-1851"
  });
  const pedagogyRuntime=new PedagogyRuntime({
    getState:()=>services.playerState.load()||{}
  });
  const recordPedagogyResult=result=>{
    const current=services.playerState.load()||{};
    const game=current.game&&typeof current.game==="object"?current.game:{};
    const pedagogy=game.pedagogy&&typeof game.pedagogy==="object"?game.pedagogy:{};
    const activity=Array.isArray(pedagogy.activity)?pedagogy.activity.slice(-199):[];
    activity.push({
      at:Date.now(),
      entityId:String(result?.entityId||""),
      challengeId:String(result?.challengeId||""),
      operation:String(result?.operation||"multiplication"),
      a:Number(result?.a),
      b:Number(result?.b),
      answer:result?.answer===null||result?.answer===undefined||result?.answer===""?null:(Number.isFinite(Number(result.answer))?Number(result.answer):null),
      correct:result?.correct===true
    });
    services.playerState.save({
      ...current,
      game:{
        ...game,
        pedagogy:{
          ...pedagogy,
          activity
        }
      }
    },{sync:true});
  };
  await runtime.load(resolved.scene.path);

  const dev=new DevOverlay(document.body,runtime,{
    sceneResolver:resolver,
    pedagogyRuntime,
    onPedagogyResult:recordPedagogyResult
  });
  dev.mount();
  if(continuity)await dev.restoreContinuity(continuity);

  const lifecycle=installAppLifecycle({dev,runtime});

  globalThis.TabuadaQuest={
    ...(globalThis.TabuadaQuest||{}),
    runtime,
    dev,
    auth:services.auth,
    playerState:services.playerState,
    pedagogyRuntime,
    getAccessStatus:services.getStatus,
    lifecycle
  };
}
