import { WorldRuntime } from "./WorldRuntime.js?v=20260930-2235";
import { SceneRuntime } from "../runtime/SceneRuntime.js?v=20260930-1851";

export async function launchWorldTest(root,{worldId="ocean-prototype"}={}){
  const catalogResponse=await fetch("./src/config/world-catalog.json?v=20260930-1851",{cache:"no-store"});
  if(!catalogResponse.ok)throw new Error("World catalog failed: "+catalogResponse.status);
  const catalog=await catalogResponse.json();
  const entry=(catalog.worlds||[]).find(item=>item.id===worldId)
    ||(catalog.worlds||[]).find(item=>item.id==="ocean-prototype");
  if(!entry?.path)throw new Error("World test not found: "+worldId);

  const response=await fetch(entry.path+"?v=20260930-1851",{cache:"no-store"});
  if(!response.ok)throw new Error("World test config failed: "+response.status);
  const config=await response.json();

  let world=null;
  let state=null;

  const openWorld=()=>{
    root.innerHTML="";
    world=new WorldRuntime(root,config,{
      state,
      onEnterScene:(entity,nextState)=>{
        state=nextState;
        openScene(entity);
      }
    });
    world.mount();
    globalThis.TabuadaQuest={
      ...(globalThis.TabuadaQuest||{}),
      world,
      worldTest:true,
      worldTestId:config.id
    };
  };

  const openScene=async entity=>{
    world?.destroy();
    root.innerHTML="";

    const sceneRoot=document.createElement("div");
    root.append(sceneRoot);

    const runtime=new SceneRuntime(sceneRoot,{width:390,height:844});
    await runtime.load(entity.scene);

    const badge=document.createElement("div");
    badge.className="tq-world-scene-badge";
    badge.textContent="SceneRuntime · "+(entity.label||entity.id);

    const back=document.createElement("button");
    back.type="button";
    back.className="tq-world-scene-back";
    back.textContent="← Voltar ao oceano";
    back.addEventListener("click",openWorld);

    document.body.append(badge,back);

    const removeSceneChrome=()=>{
      badge.remove();
      back.remove();
    };
    back.addEventListener("click",removeSceneChrome,{once:true});

    globalThis.TabuadaQuest={
      ...(globalThis.TabuadaQuest||{}),
      runtime,
      worldTest:true
    };
  };

  openWorld();
}
