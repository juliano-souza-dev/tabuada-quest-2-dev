const PIXI_URL="https://cdn.jsdelivr.net/npm/pixi.js@8.21.0/dist/pixi.min.mjs";

const ASSETS={
  ammo:"./assets/hud/municao.webp?v=20261005-hud-stable-v9",
  fire:"./assets/hud/atirar.webp?v=20261005-hud-stable-v9",
  follow:"./assets/hud/seguir.webp?v=20261005-hud-stable-v9",
  center:"./assets/hud/centralizar.webp?v=20261005-hud-stable-v9",
  shipyard:"./assets/hud/estaleiro.webp?v=20261005-hud-stable-v9",
  missions:"./assets/hud/missoes.webp?v=20261005-hud-stable-v9",
  shop:"./assets/hud/loja.webp?v=20261005-hud-stable-v9",
  minimap:"./assets/ui/ui_minimap_frame_pirate_cartoon_hq.webp?v=20261005-hud-stable-v9"
};

const clamp=(v,min,max)=>Math.min(max,Math.max(min,Number(v)||0));

export class PixiMobileHudRenderer{
  constructor(root){
    this.root=root||null;
    this.PIXI=null;
    this.app=null;
    this.ready=false;
    this.failed=false;
    this.refs={};
    this.textures={};
    this.buttonRects={};
    this.lastSize="";
  }

  async init(){
    if(this.ready||this.failed||!this.root)return this.ready;
    try{
      const PIXI=await import(PIXI_URL);
      const app=new PIXI.Application();
      const rect=this.root.getBoundingClientRect();
      await app.init({
        width:Math.max(1,Math.round(rect.width||innerWidth||390)),
        height:Math.max(1,Math.round(rect.height||innerHeight||844)),
        backgroundAlpha:0,
        antialias:true,
        autoDensity:true,
        resolution:Math.min(2,Math.max(1,Number(devicePixelRatio)||1)),
        preference:"webgl"
      });
      app.canvas.className="tq-mobile-hud-pixi";
      app.canvas.setAttribute("aria-hidden","true");
      Object.assign(app.canvas.style,{
        position:"fixed",inset:"0",width:"100%",height:"100%",
        display:"block",pointerEvents:"none",zIndex:"615"
      });
      this.root.append(app.canvas);
      this.PIXI=PIXI;
      this.app=app;
      await this.loadTextures();
      this.build();
      this.ready=true;
      this.layout(true);
      return true;
    }catch(error){
      this.failed=true;
      console.warn("[TQ Pixi HUD] init failed",error);
      return false;
    }
  }

  async loadTextures(){
    for(const [key,url] of Object.entries(ASSETS)){
      try{this.textures[key]=await this.PIXI.Assets.load(url)}
      catch(error){console.warn("[TQ Pixi HUD] asset failed",url,error)}
    }
  }

  makeText(text,size=16,anchor=.5){
    const value=new this.PIXI.Text({
      text,
      style:{
        fill:"#fff4c8",
        fontFamily:"Georgia, system-ui, serif",
        fontSize:size,
        fontWeight:"900",
        stroke:{color:"#130b05",width:3}
      }
    });
    value.anchor.set(anchor);
    return value;
  }

  makeSprite(key){
    const texture=this.textures[key];
    if(!texture)return null;
    const sprite=new this.PIXI.Sprite(texture);
    sprite.anchor.set(.5);
    sprite.eventMode="none";
    return sprite;
  }

  build(){
    const {Container,Graphics}=this.PIXI;
    const stage=this.app.stage;
    stage.removeChildren();

    const root=new Container();
    const top=new Graphics();
    const hpBack=new Graphics();
    const hpFill=new Graphics();
    const portrait=new Graphics();
    const joystick=new Graphics();
    const minimapBack=new Graphics();
    const mapMarkers=new Graphics();
    const actions=new Container();

    const hpLabel=this.makeText("CASCO",15,0);
    const hpText=this.makeText("50 / 50",16,.5);
    const goldText=this.makeText("0",18,0);
    const rubyText=this.makeText("0",18,0);
    const levelText=this.makeText("1",16,.5);
    const targetText=this.makeText("",13,.5);

    root.addChild(top,hpBack,hpFill,portrait,joystick,minimapBack,mapMarkers,actions,hpLabel,hpText,goldText,rubyText,levelText,targetText);

    const minimapFrame=this.makeSprite("minimap");
    if(minimapFrame)root.addChild(minimapFrame);

    const sprites={};
    for(const key of ["ammo","fire","follow","center","shipyard","missions","shop"]){
      const sprite=this.makeSprite(key);
      if(sprite){actions.addChild(sprite);sprites[key]=sprite}
    }

    // Config has no uploaded asset yet, so draw a matching temporary button in Pixi.
    const configBack=new Graphics();
    const configIcon=this.makeText("⚙",32,.5);
    actions.addChild(configBack,configIcon);

    stage.addChild(root);
    this.refs={root,top,hpBack,hpFill,portrait,joystick,minimapBack,mapMarkers,minimapFrame,actions,sprites,configBack,configIcon,hpLabel,hpText,goldText,rubyText,levelText,targetText};
  }

  layout(force=false){
    if(!this.app||!this.ready)return false;
    const rect=this.root.getBoundingClientRect();
    const w=Math.max(1,Math.round(rect.width||innerWidth||390));
    const h=Math.max(1,Math.round(rect.height||innerHeight||844));
    const signature=w+"x"+h;
    if(!force&&signature===this.lastSize)return false;
    this.lastSize=signature;
    this.app.renderer.resize(w,h);

    const r=this.refs;
    const topH=0;

    // The legacy brown status bar was removed from gameplay.
    // Keep its display objects alive for state compatibility, but never render them.
    r.top.clear();
    r.hpBack.clear();
    r.hpFill.clear();
    r.portrait.clear();
    r.hpLabel.visible=false;
    r.hpText.visible=false;
    r.goldText.visible=false;
    r.rubyText.visible=false;
    r.levelText.visible=false;

    const mapR=clamp(w*.13,62,90);
    const mapX=w-mapR-12;
    const mapY=topH+mapR+18;
    r.minimapBack.clear().circle(mapX,mapY,mapR).fill(0x072d36);
    if(r.minimapFrame){
      r.minimapFrame.position.set(mapX,mapY);
      r.minimapFrame.width=(mapR+14)*2;
      r.minimapFrame.height=(mapR+14)*2;
    }

    const joyR=clamp(w*.145,64,100);
    const joyX=joyR+12;
    const joyY=h-joyR-22;
    r.joystick.clear();
    r.joystick.circle(joyX,joyY,joyR).fill({color:0x092b3c,alpha:.82}).stroke({color:0xc0833b,width:6});
    r.joystick.circle(joyX,joyY,joyR*.75).stroke({color:0x5c7c85,width:2,alpha:.55});
    r.joystick.moveTo(joyX-joyR*.62,joyY).lineTo(joyX+joyR*.62,joyY).stroke({color:0x9eb8c0,width:2,alpha:.35});
    r.joystick.moveTo(joyX,joyY-joyR*.62).lineTo(joyX,joyY+joyR*.62).stroke({color:0x9eb8c0,width:2,alpha:.35});
    r.joystick.circle(joyX,joyY,joyR*.35).fill({color:0x16658a,alpha:.9}).stroke({color:0xd5edf3,width:3});

    const base=clamp(w*.094,54,78);
    const primary=base*1.18;
    const gap=clamp(w*.012,5,10);
    const bottom=Math.max(10,h*.012);
    const startX=w-(base*3+primary+gap*3)-8;
    const rowY=h-bottom-base/2;
    const fireY=h-bottom-primary/2;

    const actionLayout={
      ammo:{x:startX+base/2,y:rowY,size:base},
      fire:{x:startX+base+gap+primary/2,y:fireY,size:primary},
      follow:{x:startX+base+gap+primary+gap+base/2,y:rowY,size:base},
      center:{x:startX+base+gap+primary+gap+base+gap+base/2,y:rowY,size:base}
    };

    const utilityX=w-base/2-12;
    const utilityY=h-bottom-primary-base-gap*2;
    const utilities={
      shop:{x:utilityX,y:utilityY,size:base},
      missions:{x:utilityX-base-gap,y:utilityY,size:base},
      config:{x:utilityX,y:utilityY-base-gap,size:base},
      shipyard:{x:utilityX-base-gap,y:utilityY-base-gap,size:base}
    };

    this.buttonRects={};
    for(const [key,pos] of Object.entries({...actionLayout,...utilities})){
      this.buttonRects[key]={left:pos.x-pos.size/2,top:pos.y-pos.size/2,width:pos.size,height:pos.size};
      const sprite=r.sprites[key];
      if(sprite){
        sprite.position.set(pos.x,pos.y);
        sprite.width=pos.size;
        sprite.height=pos.size;
      }
    }

    r.configBack.clear();
    const c=utilities.config;
    r.configBack.roundRect(c.x-c.size/2,c.y-c.size/2,c.size,c.size,12).fill(0x10131c).stroke({color:0xb98039,width:3});
    r.configIcon.position.set(c.x,c.y);

    r.targetText.position.set(w/2,topH+7);
    return true;
  }

  sync(state={}){
    if(!this.ready)return false;
    this.layout();
    const r=this.refs;
    const maxHp=Math.max(1,Number(state.playerMaxHp)||1);
    const hp=clamp(Number(state.playerHp)||0,0,maxHp);
    const pct=hp/maxHp;

    const backBounds=r.hpBack.getBounds();
    const x=backBounds.x+3;
    const y=backBounds.y+3;
    const h=Math.max(1,backBounds.height-6);
    const w=Math.max(1,(backBounds.width-6)*pct);
    r.hpFill.clear().roundRect(x,y,w,h,8).fill(pct>.35?0x27b95d:0xd34832);
    r.hpText.text=Math.round(hp)+" / "+Math.round(maxHp);
    r.goldText.text=Number(state.gold||0).toLocaleString("pt-BR");
    r.rubyText.text=Number(state.rubies||0).toLocaleString("pt-BR");
    r.levelText.text=String(Math.max(1,Math.floor(Number(state.level)||1)));

    const target=state.target||{};
    r.targetText.text=target.visible===true
      ?String(target.name||"Navio inimigo")+"  "+Math.round(Number(target.hp)||0)+"/"+Math.round(Number(target.maxHp)||1)
      :"";

    const map=r.mapMarkers;
    map.clear();
    const mapState=state.minimap||{};
    const bounds=mapState.bounds||{};
    const points=Array.isArray(mapState.points)?mapState.points:[];
    const frame=r.minimapBack.getBounds();
    const cx=frame.x+frame.width/2;
    const cy=frame.y+frame.height/2;
    const radius=Math.max(1,frame.width/2-12);
    const bw=Math.max(1,Number(bounds.width)||1);
    const bh=Math.max(1,Number(bounds.height)||1);
    for(const point of points.slice(0,48)){
      const px=cx-radius+(clamp(Number(point.x)||0,0,bw)/bw)*radius*2;
      const py=cy-radius+(clamp(Number(point.y)||0,0,bh)/bh)*radius*2;
      map.circle(px,py,point.player?4:3).fill(point.player?0xfff09a:(point.hostile?0xf1493f:0x6fdc82));
    }

    const center=r.sprites.center;
    if(center)center.alpha=state.cameraDetached===true?1:.38;
    const fire=r.sprites.fire;
    if(fire)fire.alpha=state.hasCannons!==false&&state.hasAmmo!==false?1:.45;
    return true;
  }

  destroy(){
    try{this.app?.destroy(true,{children:true,texture:false})}catch{}
    this.app=null;
    this.PIXI=null;
    this.ready=false;
    this.refs={};
    this.buttonRects={};
  }
}
