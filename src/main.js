import { installDevAssetCache } from "./dev/DevAssetCache.js?v=20261001-1934";
import { SceneRuntime } from "./runtime/SceneRuntime.js?v=20260930-2320";
import { SceneResolver } from "./runtime/SceneResolver.js?v=20260930-1851";
import { installAuthRuntime } from "./runtime/auth/AuthRuntimeBridge.js?v=20261003-2450";
import { PedagogyRuntime } from "./runtime/pedagogy/PedagogyRuntime.js?v=20261001-0854";
import { DevOverlay } from "./dev/DevOverlay.js?v=20261003-2040";
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
  const readDevShipyard=()=>{
    const current=devPlayerState.load()||{};
    const game=current.game&&typeof current.game==="object"?current.game:{};
    const inventory=game.devInventory&&typeof game.devInventory==="object"?game.devInventory:{ammo:{},cannons:{},ships:[]};
    const yard=game.devShipyard&&typeof game.devShipyard==="object"?game.devShipyard:{};
    return {current,game,inventory,yard};
  };
  const devShipyardCatalog=()=>{
    const overlay=globalThis.TabuadaQuest?.dev;
    return {
      ships:overlay?.shipEditor?.repositoryShips?.()||[],
      cannons:overlay?.cannonEditor?.getCatalog?.()?.cannons||[]
    };
  };
  const getDevShipyardState=()=>{
    const {inventory,yard}=readDevShipyard();
    const catalog=devShipyardCatalog();
    // No DEV, todos os itens publicados ficam disponíveis para teste antes da compra real.
    const ownedIds=new Set(Array.isArray(inventory.ships)&&inventory.ships.length?inventory.ships:catalog.ships.map(ship=>String(ship?.id||"")));
    const ships=catalog.ships.filter(ship=>ownedIds.has(String(ship?.id||""))).map(ship=>{
      const id=String(ship.id||"");
      const installed=Array.isArray(yard.mountedCannons?.[id])?yard.mountedCannons[id]:[];
      return {id,name:ship.name||id,equipped:String(yard.equippedShip||catalog.ships[0]?.id||"")===id,cannons:installed.map(cannonId=>{
        const cannon=catalog.cannons.find(item=>String(item?.id||"")===String(cannonId));
        return {id:String(cannonId),name:cannon?.name||String(cannonId)};
      })};
    });
    const storage={...(inventory.cannons||{})};
    if(!Object.keys(storage).length&&catalog.cannons[0]?.id)storage[catalog.cannons[0].id]=1;
    return {ships,cannons:catalog.cannons.map(cannon=>({id:String(cannon.id||""),name:cannon.name||cannon.id})),storage};
  };
  const saveDevShipyard=next=>{
    const {current,game}=readDevShipyard();
    devPlayerState.save({...current,game:{...game,devShipyard:next}},{sync:false});
  };
  const equipDevShip=id=>{
    const state=getDevShipyardState();
    if(!state.ships.some(ship=>ship.id===id))return {ok:false,message:"Este navio não está disponível no teste."};
    const {yard}=readDevShipyard();
    saveDevShipyard({...yard,equippedShip:id});
    return {ok:true,message:"Navio equipado para o teste DEV."};
  };
  const equipDevCannon=id=>{
    const state=getDevShipyardState();
    if(!(Number(state.storage[id])>0))return {ok:false,message:"Este canhão não está disponível no depósito."};
    const active=state.ships.find(ship=>ship.equipped);
    if(!active)return {ok:false,message:"Equipe um navio antes de instalar o canhão."};
    const {inventory,yard}=readDevShipyard();
    const storage={...(inventory.cannons||{}),[id]:Math.max(0,Number(inventory.cannons?.[id])||0)-1};
    const mounted={...(yard.mountedCannons||{}),[active.id]:[...(yard.mountedCannons?.[active.id]||[]),id]};
    const current=devPlayerState.load()||{};
    devPlayerState.save({...current,game:{...current.game,devInventory:{...inventory,cannons:storage},devShipyard:{...yard,mountedCannons:mounted, equippedShip:active.id}}},{sync:false});
    return {ok:true,message:"Canhão instalado no navio ativo."};
  };
  const grantDevStarterCannon=()=>{
    const catalog=devShipyardCatalog();
    const cannonId=String(catalog.cannons.find(item=>item?.available!==false)?.id||"");
    if(!cannonId)return {ok:false,message:"Nenhum canhão publicado está disponível."};
    const {current,game,inventory}=readDevShipyard();
    const cannons={...(inventory.cannons||{}),[cannonId]:Math.max(0,Number(inventory.cannons?.[cannonId])||0)+1};
    devPlayerState.save({...current,game:{...game,devInventory:{...inventory,cannons}}},{sync:false});
    const equipped=equipDevCannon(cannonId);
    if(!equipped.ok)return equipped;
    const active=getDevShipyardState().ships.find(ship=>ship.equipped);
    const equippedCannonIds=(active?.cannons||[]).map(cannon=>String(cannon?.id||cannon));
    return {ok:true,cannonId,cannonName:catalog.cannons.find(item=>String(item?.id||"")===cannonId)?.name||cannonId,equippedCannonIds};
  };
  const removeDevCannon=(id,shipId)=>{
    const {current,game,inventory,yard}=readDevShipyard();
    const installed=[...(yard.mountedCannons?.[shipId]||[])];
    const index=installed.indexOf(id);
    if(index<0)return {ok:false,message:"Canhão não encontrado neste navio."};
    installed.splice(index,1);
    const mounted={...(yard.mountedCannons||{}),[shipId]:installed};
    const cannons={...(inventory.cannons||{}),[id]:Math.max(0,Number(inventory.cannons?.[id])||0)+1};
    devPlayerState.save({...current,game:{...game,devInventory:{...inventory,cannons},devShipyard:{...yard,mountedCannons:mounted}}},{sync:false});
    return {ok:true,message:"Canhão guardado no depósito."};
  };
  globalThis.addEventListener?.("tq:treasurecollected",recordTreasureCollected);

  await runtime.load(resolved.scene.path);

  const dev=new DevOverlay(document.body,runtime,{
    sceneResolver:resolver,
    pedagogyRuntime,
    onPedagogyResult:recordPedagogyResult,
    onRewardCollected:applyWorldReward,
    onShopPurchase:purchaseWorldShopItem,
    getShipyardState:getDevShipyardState,
    onEquipShip:equipDevShip,
    onEquipCannon:equipDevCannon,
    onRemoveCannon:removeDevCannon,
    onStarterCannonEarned:grantDevStarterCannon,
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
