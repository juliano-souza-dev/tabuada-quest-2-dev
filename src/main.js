import { installDevAssetCache } from "./dev/DevAssetCache.js?v=20261001-1934";
import { SceneRuntime } from "./runtime/SceneRuntime.js?v=20260930-2320";
import { SceneResolver } from "./runtime/SceneResolver.js?v=20260930-1851";
import { installAuthRuntime } from "./runtime/auth/AuthRuntimeBridge.js?v=20261003-0217";
import { PedagogyRuntime } from "./runtime/pedagogy/PedagogyRuntime.js?v=20261001-0854";
import { DevOverlay } from "./dev/DevOverlay.js?v=20261003-1222";
import { launchWorldTest } from "./world/WorldTestLauncher.js?v=20261002-1007";
import { readAppContinuity, installAppLifecycle } from "./runtime/AppLifecycle.js?v=20260930-1851";

const app=document.querySelector("#app");
const DEV_PLAYER_UID="tq-dev-local-player";
const DEV_PLAYER_KEY="tq.dev.player.state.v1."+DEV_PLAYER_UID;
const createDevPlayerState=()=>{
  const empty=()=>({
    schema:"tq.dev-player-state",version:1,
    profile:{uid:DEV_PLAYER_UID,displayName:"Jogador DEV",developer:true},
    game:{rewards:{coins:0,gold:0,rubies:0,xp:0,devRewardClaims:[]},devInventory:{ammo:{},cannons:{},ships:[]}}
  });
  const load=()=>{
    try{const raw=localStorage.getItem(DEV_PLAYER_KEY);if(raw){const value=JSON.parse(raw);if(value&&typeof value==="object")return value}}catch{}
    const value=empty();try{localStorage.setItem(DEV_PLAYER_KEY,JSON.stringify(value))}catch{}return value;
  };
  const save=(state={})=>{const value=structuredClone(state);try{localStorage.setItem(DEV_PLAYER_KEY,JSON.stringify(value))}catch{}return value};
  return Object.freeze({uid:DEV_PLAYER_UID,load,save,status:()=>Object.freeze({authenticated:true,uid:DEV_PLAYER_UID,online:false,canPlay:true,accountRequired:false,offlineAllowed:true,developer:true})});
};
await installDevAssetCache();
const continuity=readAppContinuity();
const worldTestParam=new URLSearchParams(location.search).get("worldtest");
const worldTest=Boolean(worldTestParam);

if(worldTest){
  const worldId=worldTestParam==="1"?"":worldTestParam;
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
  const devPlayerState=createDevPlayerState();
  const pedagogyResponse=await fetch("./src/config/pedagogy-curriculum.json?v=20261001-0047",{cache:"no-store"});
  if(!pedagogyResponse.ok)throw new Error("Pedagogy curriculum failed: "+pedagogyResponse.status);
  const pedagogyCurriculum=await pedagogyResponse.json();
  const pedagogyRuntime=new PedagogyRuntime({
    getState:()=>devPlayerState.load()||{},
    curriculum:pedagogyCurriculum
  });
  const recordPedagogyResult=result=>{
    const current=devPlayerState.load()||{};
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
    devPlayerState.save({
      ...current,
      game:{
        ...game,
        pedagogy:{
          ...pedagogy,
          activity
        }
      }
    },{sync:false});
  };
  const recordTreasureCollected=event=>{
    const payload=event?.detail||{};
    const entity=payload.entity||{};
    const challenge=payload.challenge||{};
    if(!entity.id)return;

    const current=devPlayerState.load()||{};
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

    devPlayerState.save({
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
    },{sync:false});
  };
  const applyWorldReward=payload=>{
    const rewards=payload?.rewards&&typeof payload.rewards==="object"?payload.rewards:{};
    const entityId=String(payload?.entity?.id||"");
    const worldId=String(payload?.worldId||"dev-world");
    if(!entityId)return false;
    const gold=Math.max(0,Number(rewards.gold??rewards.coins)||0);
    const rubies=Math.max(0,Number(rewards.rubies)||0);
    const xp=Math.max(0,Number(rewards.xp)||0);
    if(!gold&&!rubies&&!xp)return false;
    const current=devPlayerState.load()||{};
    const game=current.game&&typeof current.game==="object"?current.game:{};
    const wallet=game.rewards&&typeof game.rewards==="object"?game.rewards:{};
    const claims=Array.isArray(wallet.devRewardClaims)?[...wallet.devRewardClaims]:[];
    const claimKey=worldId+":"+entityId;
    if(claims.includes(claimKey))return false;
    claims.push(claimKey);
    const previousGold=Math.max(0,Number(wallet.gold??wallet.coins)||0);
    devPlayerState.save({
      ...current,
      game:{
        ...game,
        rewards:{
          ...wallet,
          coins:previousGold+gold,
          gold:previousGold+gold,
          rubies:Math.max(0,Number(wallet.rubies)||0)+rubies,
          xp:Math.max(0,Number(wallet.xp)||0)+xp,
          devRewardClaims:claims.slice(-500)
        }
      }
    },{sync:false});
    return true;
  };
  const purchaseWorldShopItem=async({item,quantity}={})=>{
    const product=item&&typeof item==="object"?item:null;
    const amount=Math.max(1,Math.floor(Number(quantity)||1));
    if(!product?.id)return {ok:false,message:"Item inválido para compra."};
    const currency=String(product.currency||"gold").toLowerCase();
    const walletKey=["rubies","ruby","gem","gems","diamond","diamonds"].includes(currency)?"rubies":"gold";
    const total=Math.max(0,Math.floor(Number(product.price)||0))*amount;
    const current=devPlayerState.load()||{};
    const game=current.game&&typeof current.game==="object"?current.game:{};
    const rewards=game.rewards&&typeof game.rewards==="object"?game.rewards:{};
    const available=Math.max(0,Number(rewards[walletKey]??(walletKey==="gold"?rewards.coins:0))||0);
    const currencyName=walletKey==="rubies"?"rubis":"ouro";
    if(available<total)return {ok:false,message:`Saldo insuficiente: são necessários ${total.toLocaleString("pt-BR")} ${currencyName}.`};
    const inventory=game.devInventory&&typeof game.devInventory==="object"?game.devInventory:{ammo:{},cannons:{},ships:[]};
    if(product.type==="ship"&&inventory.ships.includes(String(product.id)))return {ok:false,message:"Você já possui este navio."};
    if(product.type==="ammo"){
      const world=globalThis.TabuadaQuest?.dev?.worldEditor?.runtime;
      if(!world?.state?.ammo)return {ok:false,message:"Nenhuma região está aberta para receber a munição."};
      world.state.ammo.stock=world.state.ammo.stock&&typeof world.state.ammo.stock==="object"?world.state.ammo.stock:{};
      world.state.ammo.stock[product.id]=Math.max(0,Number(world.state.ammo.stock[product.id])||0)+amount;
      if(!world.state.ammo.selectedAmmoId)world.state.ammo.selectedAmmoId=String(product.id);
      inventory.ammo={...(inventory.ammo||{}),[product.id]:Math.max(0,Number(inventory.ammo?.[product.id])||0)+amount};
    }else if(product.type==="cannon"){
      inventory.cannons={...(inventory.cannons||{}),[product.id]:Math.max(0,Number(inventory.cannons?.[product.id])||0)+amount};
    }else if(product.type==="ship"){
      inventory.ships=[...(Array.isArray(inventory.ships)?inventory.ships:[]),String(product.id)];
    }
    const nextRewards={...rewards,[walletKey]:available-total};
    if(walletKey==="gold")nextRewards.coins=available-total;
    devPlayerState.save({...current,game:{...game,rewards:nextRewards,devInventory:inventory}},{sync:false});
    return {ok:true,message:`Compra realizada: ${amount}× ${product.name||product.id}.`};
  };
  globalThis.addEventListener?.("tq:treasurecollected",recordTreasureCollected);

  await runtime.load(resolved.scene.path);

  const dev=new DevOverlay(document.body,runtime,{
    sceneResolver:resolver,
    pedagogyRuntime,
    onPedagogyResult:recordPedagogyResult,
    onRewardCollected:applyWorldReward,
    onShopPurchase:purchaseWorldShopItem,
    shopBalances:()=>{
      const rewards=devPlayerState.load()?.game?.rewards||{};
      return {
        gold:Math.max(0,Number(rewards.gold??rewards.coins)||0),
        rubies:Math.max(0,Number(rewards.rubies)||0)
      };
    }
  });
  dev.mount();
  if(continuity)await dev.restoreContinuity(continuity);

  const lifecycle=installAppLifecycle({dev,runtime});

  globalThis.TabuadaQuest={
    ...(globalThis.TabuadaQuest||{}),
    runtime,
    dev,
    auth:services.auth,
    playerState:devPlayerState,
    firebasePlayerState:services.playerState,
    pedagogyRuntime,
    pedagogyCurriculum,
    getAccessStatus:services.getStatus,
    lifecycle
  };
}
