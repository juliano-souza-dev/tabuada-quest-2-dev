// Pure composition of motion and effects. DOM painting stays in the runtime.
export function composeEntityVisualFrame({entity,motionFrame,effectFrame,timelineAnimated,hasDirectionalSprite}){
  const offsetX=Number(motionFrame.offsetX||0)+Number(effectFrame.offsetX||0);
  const offsetY=Number(motionFrame.offsetY||0)+Number(effectFrame.offsetY||0);
  const rotation=((hasDirectionalSprite||timelineAnimated)?0:Number(entity.rotation||0))
    +Number(motionFrame.rotation||0)+Number(effectFrame.rotation||0);
  const scaleX=Number(effectFrame.scaleX||1);
  const scaleY=Number(motionFrame.scaleY||1)*Number(effectFrame.scaleY||1);
  return {
    x:entity.x+offsetX,
    y:entity.y+offsetY,
    rotation,
    scaleX,
    scaleY,
    nameOffset:Math.max(18,Number(entity.height)||96)*Math.abs(scaleY)*.54+10
  };
}
