import { WorldRuntime } from "./WorldRuntime.js?v=20261005-seafight-vfx-v3";
import { SceneRuntime } from "../runtime/SceneRuntime.js?v=20260930-1851";
import { PedagogyRuntime } from "../runtime/pedagogy/PedagogyRuntime.js?v=20261003-2113-repair-region";

export async function launchWorldTest(root,{worldId=""}={}){
  const catalogResponse=await fetch("./src/config/world-catalog.json?v=20261001-2307",{cache:"no-store"});
  if(!catalogResponse.ok)throw new Error("World catalog failed: "+catalogResponse.status);
  const catalog=await catalogResponse.json();
  const worlds=Array.isArray(catalog.worlds)?catalog.worlds:[];
  const entry=(worldId?worlds.find(item=>item.id===worldId):null)||worlds[0]||null;
  if(!entry?.path)throw new Error(worldId?"World test not found: "+worldId:"No world tests configured");

  const response=await fetch(entry.path+"?v=20261001-2209",{cache:"no-store"});
  if(!response.ok)throw new Error("World test config failed: "+response.status);
  const config=await response.json();

  const manifestResponse=await fetch("./src/config/game.manifest.json?v=20261003-global-camera",{cache:"no-store"});
  if(!manifestResponse.ok)throw new Error("Game manifest failed: "+manifestResponse.status);
  const gameManifest=await manifestResponse.json();
  const globalCamera=gameManifest?.worldDefaults?.camera||{playZoom:0.4841};

  const ammoResponse=await fetch("./src/config/ammo-catalog.json?v=20261002-0926",{cache:"no-store"});
  if(!ammoResponse.ok)throw new Error("Ammo catalog failed: "+ammoResponse.status);
  const ammoCatalog=await ammoResponse.json();
  const availableAmmo=(Array.isArray(ammoCatalog.ammo)?ammoCatalog.ammo:[]).filter(item=>item?.available!==false);
  const testAmmoId=String(config.test?.ammoId||ammoCatalog.defaultAmmoId||availableAmmo[0]?.id||"cannonball-standard");

  const cannonResponse=await fetch("./src/config/cannon-catalog.json?v=20261002-0953",{cache:"no-store"});
  if(!cannonResponse.ok)throw new Error("Cannon catalog failed: "+cannonResponse.status);
  const cannonCatalog=await cannonResponse.json();
  const availableCannons=(Array.isArray(cannonCatalog.cannons)?cannonCatalog.cannons:[]).filter(item=>item?.available!==false);
  const defaultCannonId=String(cannonCatalog.defaultCannonId||availableCannons[0]?.id||"cannon-basic");
  const requestedCannonIds=Array.isArray(config.test?.cannonIds)?config.test.cannonIds.map(String):[];
  const testCannonIds=(requestedCannonIds.length?requestedCannonIds:[defaultCannonId]).filter(id=>availableCannons.some(item=>String(item.id)===id));

  const pedagogyResponse=await fetch("./src/config/pedagogy-curriculum.json?v=20261001-0047",{cache:"no-store"});
  if(!pedagogyResponse.ok)throw new Error("Pedagogy curriculum failed: "+pedagogyResponse.status);
  const pedagogyCurriculum=await pedagogyResponse.json();
  const pedagogyRuntime=new PedagogyRuntime({
    getState:()=>({game:{pedagogy:{progress:{region:Math.max(1,Math.floor(Number(entry?.region)||1)),plannedCompleted:0}}}}),
    curriculum:pedagogyCurriculum
  });

  let world=null;
  let state=null;

  const openWorld=()=>{
    root.innerHTML="";
    world=new WorldRuntime(root,config,{
      state,
      globalCamera,
      ammoCatalog:availableAmmo,
      testAmmoId,
      testAmmoUnlimited:true,
      cannonCatalog:availableCannons,
      testCannonIds:testCannonIds.length?testCannonIds:[defaultCannonId],
      createPedagogyChallenge:({entity})=>{
        const repairChallenge=entity?.type==="repair";
        const mapPedagogyRegion=repairChallenge?Math.max(0,Math.floor(Number(entry?.region)||0)):0;
        return pedagogyRuntime.createChallenge({
          kind:entity?.type==="treasure"?"treasure":(repairChallenge?"combat":"world-interaction"),
          worldId:config.id,
          entityId:entity?.id,
          entityType:entity?.type,
          pedagogyRegion:mapPedagogyRegion||undefined,
          useRegionFamilies:repairChallenge&&mapPedagogyRegion>0
        });
      },
      onPedagogyResult:result=>{
        globalThis.dispatchEvent?.(new CustomEvent("tq:pedagogytestresult",{detail:result}));
      },
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
      worldTestId:config.id,
      pedagogyRuntime,
      pedagogyCurriculum
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
