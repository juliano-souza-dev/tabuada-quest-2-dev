// Pure view-model for naval treasure rendering. No DOM or runtime access.
export function selectVisibleTreasures(entities,collected,hashString){
  return entities
    .filter(entity=>String(entity?.type||"")==="treasure"
      &&!collected.has(entity.id)
      &&!entity.treasurePending
      &&entity.el?.hidden!==true)
    .map(entity=>({
      x:Number(entity.visualX??entity.x)||0,
      y:Number(entity.visualY??entity.y)||0,
      size:Math.max(42,Number(entity.width)||0,Number(entity.height)||0),
      phase:(Math.abs(hashString(String(entity.id||"treasure")))%6283)/1000
    }));
}
