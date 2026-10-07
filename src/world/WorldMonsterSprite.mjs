const clamp=(value,min,max)=>Math.min(max,Math.max(min,Number(value)||0));

const hash=value=>{
  let h=2166136261;
  for(const ch of String(value||"")){
    h^=ch.charCodeAt(0);
    h=Math.imul(h,16777619);
  }
  return h>>>0;
};

export const isMonsterEntity=entity=>{
  const kind=String(entity?.entityKind||entity?.kind||"").toLowerCase();
  const shipId=String(entity?.shipId||"").toLowerCase();
  return kind==="monster"||shipId.startsWith("monster-");
};

export const monsterAnimationConfig=(entity,name="idle")=>{
  if(!isMonsterEntity(entity))return null;
  const sprite=entity?.sprite&&typeof entity.sprite==="object"?entity.sprite:null;
  if(!sprite?.src)return null;
  const groups=entity?.spriteAnimations&&typeof entity.spriteAnimations==="object"
    ?entity.spriteAnimations
    :(entity?.animations&&typeof entity.animations==="object"?entity.animations:{});
  const source=groups?.[name]||groups?.idle||{};
  const columns=Math.max(1,Math.floor(Number(sprite.columns)||4));
  const rows=Math.max(1,Math.floor(Number(sprite.rows)||4));
  const maxFrame=columns*rows-1;
  const declared=Array.isArray(source.frames)?source.frames:[];
  const frames=(declared.length?declared:Array.from({length:maxFrame+1},(_,index)=>index))
    .map(value=>Math.floor(Number(value)))
    .filter(value=>Number.isFinite(value)&&value>=0&&value<=maxFrame);
  return {
    src:String(sprite.src),
    columns,
    rows,
    frames:frames.length?frames:[0],
    frameMs:clamp(source.frameMs||110,60,500),
    loop:source.loop!==false
  };
};

export const monsterAnimationFrame=(entity,time=0,name="idle")=>{
  const config=monsterAnimationConfig(entity,name);
  if(!config)return null;
  const seed=hash(entity?.id||entity?.npcId||entity?.shipId||"monster");
  const offset=seed%config.frameMs;
  const cursor=Math.floor((Math.max(0,Number(time)||0)+offset)/config.frameMs);
  const index=config.loop?cursor%config.frames.length:Math.min(config.frames.length-1,cursor);
  return {config,frame:config.frames[index],index};
};

export const monsterFrameStyle=(entity,time=0,name="idle")=>{
  const state=monsterAnimationFrame(entity,time,name);
  if(!state)return null;
  const {config,frame}=state;
  const column=frame%config.columns;
  const row=Math.floor(frame/config.columns);
  return {
    ...state,
    style:{
      backgroundImage:`url("${config.src.replace(/["\\]/g,"")}")`,
      backgroundSize:`${config.columns*100}% ${config.rows*100}%`,
      backgroundPosition:`${config.columns===1?0:(column/(config.columns-1))*100}% ${config.rows===1?0:(row/(config.rows-1))*100}%`,
      backgroundRepeat:"no-repeat"
    }
  };
};

export const monsterPoseFrame=(entity,time=0)=>{
  if(!isMonsterEntity(entity))return {offsetX:0,offsetY:0,rotation:0,scaleX:1,scaleY:1};
  const seed=hash(entity?.id||entity?.npcId||entity?.shipId||"monster");
  const period=clamp(entity?.monsterMotion?.periodMs||2600,1200,7000);
  const phase=((Math.max(0,Number(time)||0)+(seed%period))/period)*Math.PI*2;
  const moving=Math.hypot(Number(entity?.npcNavigation?.vx)||0,Number(entity?.npcNavigation?.vy)||0)>6;
  const intensity=moving?1:.72;
  return {
    offsetX:Math.sin(phase*.73)*1.4*intensity,
    offsetY:Math.sin(phase)*3.2*intensity,
    rotation:Math.sin(phase*.81)*1.15*intensity,
    scaleX:1-Math.sin(phase)*.006*intensity,
    scaleY:1+Math.sin(phase)*.012*intensity
  };
};
