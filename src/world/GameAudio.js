export class GameAudio{
  constructor(catalog={sounds:[]}){
    this.catalog=catalog;
    this.byEvent=new Map((catalog.sounds||[]).map(sound=>[String(sound.event||sound.id),sound]));
    this.ambient=new Map();
    this.pools=new Map();
    this.lastPlayedAt=new Map();
    this.unlocked=false;
  }
  unlock(){
    if(this.unlocked)return;
    this.unlocked=true;
    for(const sound of this.catalog.sounds||[])if(sound.loop)this.startLoop(sound.event);
  }
  poolFor(event,sound){
    const key=String(event||"");
    let pool=this.pools.get(key);
    if(pool)return pool;
    const voices=Math.max(1,Math.min(6,Number(sound?.voices)||(
      key==="cannon-shot"?4:
      key==="cannon-impact-ship"||key==="cannon-impact-water"?3:2
    )));
    pool={index:0,items:[]};
    for(let i=0;i<voices;i++){
      const audio=new Audio(sound.src);
      audio.preload="auto";
      audio.volume=Math.max(0,Math.min(1,Number(sound.volume)??1));
      pool.items.push(audio);
    }
    this.pools.set(key,pool);
    return pool;
  }
  play(event,{volume=1}={}){
    const key=String(event||"");
    const sound=this.byEvent.get(key);if(!sound?.src)return false;
    if(!this.unlocked)return false;

    // Avoid pathological duplicate bursts arriving from both snapshot and event
    // streams in the same instant. This also prevents audio creation from
    // becoming a source of combat-frame hitches on mobile.
    const now=performance.now();
    const minGap=key==="cannon-shot"?35:(key==="cannon-impact-ship"||key==="cannon-impact-water"?45:0);
    const last=Number(this.lastPlayedAt.get(key)||0);
    if(minGap>0&&now-last<minGap)return false;
    this.lastPlayedAt.set(key,now);

    const pool=this.poolFor(key,sound);
    const audio=pool.items[pool.index++%pool.items.length];
    try{
      audio.pause();
      audio.currentTime=0;
      audio.volume=Math.max(0,Math.min(1,(Number(sound.volume)??1)*volume));
      audio.play().catch(()=>{});
      return true;
    }catch{return false}
  }
  startLoop(event){
    const key=String(event||""),sound=this.byEvent.get(key);
    if(!this.unlocked||!sound?.src||!sound.loop||this.ambient.has(key))return false;
    const audio=new Audio(sound.src);audio.loop=true;audio.preload="auto";audio.volume=Math.max(0,Math.min(1,Number(sound.volume)??1));
    this.ambient.set(key,audio);audio.play().catch(()=>{});return true;
  }
  stopLoop(event){const a=this.ambient.get(String(event||""));if(!a)return;a.pause();a.currentTime=0;this.ambient.delete(String(event||""))}
  destroy(){
    for(const a of this.ambient.values()){a.pause();a.currentTime=0}
    for(const pool of this.pools.values())for(const a of pool.items){a.pause();a.currentTime=0}
    this.ambient.clear();
    this.pools.clear();
    this.lastPlayedAt.clear();
  }
}
