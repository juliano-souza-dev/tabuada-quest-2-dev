export class GameAudio{
  constructor(catalog={sounds:[]}){
    this.catalog=catalog;
    this.byEvent=new Map((catalog.sounds||[]).map(sound=>[String(sound.event||sound.id),sound]));
    this.ambient=new Map();
    this.unlocked=false;
  }
  unlock(){
    if(this.unlocked)return;
    this.unlocked=true;
    for(const sound of this.catalog.sounds||[])if(sound.loop)this.startLoop(sound.event);
  }
  play(event,{volume=1}={}){
    const sound=this.byEvent.get(String(event||""));if(!sound?.src)return false;
    if(!this.unlocked)return false;
    const audio=new Audio(sound.src);
    audio.preload="auto";audio.volume=Math.max(0,Math.min(1,(Number(sound.volume)??1)*volume));
    audio.play().catch(()=>{});
    return true;
  }
  startLoop(event){
    const key=String(event||""),sound=this.byEvent.get(key);
    if(!this.unlocked||!sound?.src||!sound.loop||this.ambient.has(key))return false;
    const audio=new Audio(sound.src);audio.loop=true;audio.preload="auto";audio.volume=Math.max(0,Math.min(1,Number(sound.volume)??1));
    this.ambient.set(key,audio);audio.play().catch(()=>{});return true;
  }
  stopLoop(event){const a=this.ambient.get(String(event||""));if(!a)return;a.pause();a.currentTime=0;this.ambient.delete(String(event||""))}
  destroy(){for(const a of this.ambient.values()){a.pause();a.currentTime=0}this.ambient.clear()}
}
