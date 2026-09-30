import { WorldRuntime } from "./WorldRuntime.js?v=20260930-0450";
import { SceneRuntime } from "../runtime/SceneRuntime.js?v=20260930-0450";

export async function launchWorldTest(root){
  const response=await fetch("./src/world/world-test.world.json?v=20260930-0450",{cache:"no-store"});
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
      worldTest:true
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
