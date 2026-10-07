const clamp=(value,min,max)=>Math.min(max,Math.max(min,value));

export function hasTimelineSpriteAnimation(entity={}){
  return String(entity.spriteAnimationMode||"")==="timeline"
    &&Boolean(entity.sprite?.src)
    &&Boolean(entity.animations&&typeof entity.animations==="object");
}

export function resolveTimelineAnimationName(entity={}){
  const animations=entity.animations&&typeof entity.animations==="object"?entity.animations:{};
  const nav=entity.npcNavigation&&typeof entity.npcNavigation==="object"?entity.npcNavigation:{};
  const speed=Math.hypot(Number(nav.vx)||0,Number(nav.vy)||0);
  const stationary=String(entity.npcBehavior||nav.mode||"")==="stationary";
  if(!stationary&&speed>4&&animations.swim)return "swim";
  if(animations.idle)return "idle";
  if(animations.swim)return "swim";
  return Object.keys(animations)[0]||"";
}

export function timelineAnimationFrame(entity={},timeMs=0,phaseMs=0){
  if(!hasTimelineSpriteAnimation(entity))return null;
  const name=resolveTimelineAnimationName(entity);
  const animation=entity.animations?.[name];
  const frames=Array.isArray(animation?.frames)
    ?animation.frames.map(Number).filter(Number.isFinite)
    :[];
  if(!frames.length)return null;

  const frameMs=clamp(Number(animation.frameMs)||120,40,1000);
  const elapsed=Math.max(0,Number(timeMs)||0)+Math.max(0,Number(phaseMs)||0);
  let cursor=Math.floor(elapsed/frameMs);
  if(animation.loop===false)cursor=Math.min(frames.length-1,cursor);
  else cursor%=frames.length;

  return {
    name,
    frame:Math.max(0,Math.floor(frames[cursor]||0)),
    cursor,
    frameMs
  };
}

export function atlasFrameStyle(sprite={},frame=0){
  if(!sprite?.src)return null;
  const columns=Math.max(1,Math.floor(Number(sprite.columns)||1));
  const rows=Math.max(1,Math.floor(Number(sprite.rows)||1));
  const total=columns*rows;
  const index=Math.max(0,Math.min(total-1,Math.floor(Number(frame)||0)));
  const column=index%columns;
  const row=Math.floor(index/columns);
  const safe=String(sprite.src||"").replace(/["\\]/g,"");

  return {
    backgroundImage:safe?'url("'+safe+'")':"none",
    backgroundSize:(columns*100)+"% "+(rows*100)+"%",
    backgroundPosition:
      (columns===1?0:(column/(columns-1))*100)+"% "+
      (rows===1?0:(row/(rows-1))*100)+"%",
    backgroundRepeat:"no-repeat"
  };
}
