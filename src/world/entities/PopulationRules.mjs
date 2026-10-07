const clamp=(value,min,max)=>Math.min(max,Math.max(min,value));

export const normalizeNpcAmmoIds=input=>[...new Set((Array.isArray(input)?input:[]).map(value=>String(value||"").trim()).filter(Boolean))];

export const normalizeNpcPopulation=input=>{
  const value=input&&typeof input==="object"?input:{};
  const spread=value.spread&&typeof value.spread==="object"?value.spread:{};
  const movement=value.movement&&typeof value.movement==="object"?value.movement:{};
  const types=Array.isArray(value.types)?value.types:[];
  return {
    enabled:value.enabled===true,
    seed:Math.max(1,Math.floor(Number(value.seed)||1)),
    spread:{
      mode:["random","random-spaced"].includes(String(spread.mode))?String(spread.mode):"random-spaced",
      margin:clamp(Number(spread.margin??320),0,2000),
      minDistance:clamp(Number(spread.minDistance??360),0,1800)
    },
    movement:{mode:"straight",speed:clamp(Number(movement.speed??80),0,1200)},
    types:types.slice(0,12).map(item=>({
      npcId:String(item?.npcId||item?.shipId||""),
      shipId:String(item?.shipId||""),
      count:clamp(Math.floor(Number(item?.count)||0),0,50),
      enabled:item?.enabled!==false,
      unlockAfterMission:String(item?.unlockAfterMission||"").trim(),
      spawn:{
        mode:["random","random-spaced"].includes(String(item?.spawn?.mode))?String(item.spawn.mode):String(spread.mode||"random-spaced"),
        margin:clamp(Number(item?.spawn?.margin??spread.margin??320),0,2000),
        minDistance:clamp(Number(item?.spawn?.minDistance??spread.minDistance??360),0,1800),
        seed:Math.max(0,Math.floor(Number(item?.spawn?.seed)||0))
      },
      hp:clamp(Math.floor(Number(item?.hp)||3),1,500000000),
      respawn:item?.respawn===true,
      respawnDelaySec:clamp(Number(item?.respawnDelaySec??30),1,86400),
      devFrozen:item?.devFrozen===true,
      hitRewardGold:Math.max(0,Math.floor(Number(item?.hitRewardGold)||0)),
      rewards:item?.rewards&&typeof item.rewards==="object"?structuredClone(item.rewards):{},
      allowedAmmoIds:normalizeNpcAmmoIds(item?.allowedAmmoIds)
    })).filter(item=>(item.npcId||item.shipId)&&item.count>0)
  };
};

export const normalizeTreasurePopulation=input=>{
  const value=input&&typeof input==="object"?input:{};
  const spread=value.spread&&typeof value.spread==="object"?value.spread:{};
  return {
    enabled:value.enabled===true,
    seed:Math.max(1,Math.floor(Number(value.seed)||1)),
    spread:{
      mode:["random","random-spaced"].includes(String(spread.mode))?String(spread.mode):"random-spaced",
      margin:clamp(Number(spread.margin??220),0,2000),
      minDistance:clamp(Number(spread.minDistance??180),0,1800)
    },
    types:(Array.isArray(value.types)?value.types:[]).slice(0,16).map(item=>({
      treasureId:String(item?.treasureId||""),
      count:clamp(Math.floor(Number(item?.count)||0),0,100),
      respawn:item?.respawn===true,
      spawnIntervalSec:clamp(Number(item?.spawnIntervalSec??5),0,3600),
      respawnDelaySec:clamp(Number(item?.respawnDelaySec??30),1,3600)
    })).filter(item=>item.treasureId&&item.count>0)
  };
};
