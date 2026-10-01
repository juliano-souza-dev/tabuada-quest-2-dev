import { installDevAssetCache } from "./dev/DevAssetCache.js?v=20261001-1934";
import { SceneRuntime } from "./runtime/SceneRuntime.js?v=20260930-2320";
import { SceneResolver } from "./runtime/SceneResolver.js?v=20260930-1851";
import { installAuthRuntime } from "./runtime/auth/AuthRuntimeBridge.js?v=20260930-1851";
import { PedagogyRuntime } from "./runtime/pedagogy/PedagogyRuntime.js?v=20261001-0854";
import { DevOverlay } from "./dev/DevOverlay.js?v=20261001-1922";
import { launchWorldTest } from "./world/WorldTestLauncher.js?v=20261001-1552";
import { readAppContinuity, installAppLifecycle } from "./runtime/AppLifecycle.js?v=20260930-1851";

const app=document.querySelector("#app");
await installDevAssetCache();
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
  const pedagogyResponse=await fetch("./src/config/pedagogy-curriculum.json?v=20261001-0047",{cache:"no-store"});
  if(!pedagogyResponse.ok)throw new Error("Pedagogy curriculum failed: "+pedagogyResponse.status);
  const pedagogyCurriculum=await pedagogyResponse.json();
  const pedagogyRuntime=new PedagogyRuntime({
    getState:()=>services.playerState.load()||{},
    curriculum:pedagogyCurriculum
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
      correct:result?.correct===true,
      region:Number(result?.region)||null,
      bonus:result?.bonus===true,
      countsTowardPlanned:result?.countsTowardPlanned!==false
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
  const recordTreasureCollected=event=>{
    const payload=event?.detail||{};
    const entity=payload.entity||{};
    const challenge=payload.challenge||{};
    if(!entity.id)return;

    const current=services.playerState.load()||{};
    const game=current.game&&typeof current.game==="object"?current.game:{};
    const pedagogy=game.pedagogy&&typeof game.pedagogy==="object"?game.pedagogy:{};
    const bonus=pedagogy.bonus&&typeof pedagogy.bonus==="object"?pedagogy.bonus:{};
    const openedChestIds=Array.isArray(bonus.openedChestIds)?[...bonus.openedChestIds]:[];
    const worldId=String(challenge?.context?.worldId||"dev-world");
    const chestKey=worldId+":"+String(entity.id);
    const region=Number(challenge.region)||Number(pedagogy.progress?.region)||1;
    const chestsOpenedByRegion={
      ...(bonus.chestsOpenedByRegion&&typeof bonus.chestsOpenedByRegion==="object"?bonus.chestsOpenedByRegion:{})
    };

    if(!openedChestIds.includes(chestKey)){
      openedChestIds.push(chestKey);
      chestsOpenedByRegion[String(region)]=Number(chestsOpenedByRegion[String(region)]||0)+1;
    }

    services.playerState.save({
      ...current,
      game:{
        ...game,
        pedagogy:{
          ...pedagogy,
          bonus:{
            ...bonus,
            openedChestIds,
            chestsOpenedByRegion,
            totalChestChallenges:Object.values(chestsOpenedByRegion).reduce((sum,value)=>sum+Number(value||0),0)
          }
        }
      }
    },{sync:true});
  };
  globalThis.addEventListener?.("tq:treasurecollected",recordTreasureCollected);

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
    pedagogyCurriculum,
    getAccessStatus:services.getStatus,
    lifecycle
  };
}
