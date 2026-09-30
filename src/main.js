import { SceneRuntime } from "./runtime/SceneRuntime.js?v=20260930-1525";
import { SceneResolver } from "./runtime/SceneResolver.js?v=20260930-1525";
import { installAuthRuntime } from "./runtime/auth/AuthRuntimeBridge.js?v=20260930-1525";
import { DevOverlay } from "./dev/DevOverlay.js?v=20260930-1608";
import { launchWorldTest } from "./world/WorldTestLauncher.js?v=20260930-1525";
import { readAppContinuity, installAppLifecycle } from "./runtime/AppLifecycle.js?v=20260930-1525";

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
  const resolver=await SceneResolver.load("./src/config/scene-catalog.json?v=20260930-1525");
  const continuityScene=continuity?.sceneId
    ? resolver.catalog.scenes.find(scene=>scene.id===continuity.sceneId&&scene.path)
    : null;
  const resolved=continuityScene?{scene:continuityScene}:resolver.resolve("login");

  const runtime=new SceneRuntime(app,{width:390,height:844},{editorEnabled:true});
  const services=await installAuthRuntime(runtime,{
    configUrl:"./src/config/firebase-public.json?v=20260930-1525"
  });
  await runtime.load(resolved.scene.path);

  const dev=new DevOverlay(document.body,runtime,{sceneResolver:resolver});
  dev.mount();
  if(continuity)await dev.restoreContinuity(continuity);

  const lifecycle=installAppLifecycle({dev,runtime});

  globalThis.TabuadaQuest={
    ...(globalThis.TabuadaQuest||{}),
    runtime,
    dev,
    auth:services.auth,
    playerState:services.playerState,
    getAccessStatus:services.getStatus,
    lifecycle
  };
}
