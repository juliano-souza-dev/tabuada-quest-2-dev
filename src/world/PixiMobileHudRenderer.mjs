const PIXI_URL="https://cdn.jsdelivr.net/npm/pixi.js@8.21.0/dist/pixi.min.mjs";

const ASSETS={
  ammo:"./assets/hud/municao.webp",
  fire:"./assets/hud/atirar.webp",
  follow:"./assets/hud/seguir.webp",
  center:"./assets/hud/centralizar.webp",
  shipyard:"./assets/hud/estaleiro.webp",
  missions:"./assets/hud/missoes.webp",
  shop:"./assets/hud/loja.webp",
  repair:"./assets/hud/conserto_navio_padrao_ui.webp",

  halloweenFire:"./assets/hud/halloween_hud_btn_iniciar_ataque.webp",
  halloweenCancel:"./assets/hud/halloween_hud_btn_cancelar_ataque.webp",
  halloweenAmmo:"./assets/hud/halloween_hud_btn_trocar_municao.webp",
  halloweenRepair:"./assets/hud/halloween_hud_btn_consertar_navio.webp",
  halloweenShop:"./assets/hud/halloween_hud_loja.webp",
  halloweenMissions:"./assets/hud/halloween_hud_missoes.webp",

  minimap:"./assets/ui/ui_minimap_frame_pirate_cartoon_hq.webp"
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
    this.theme="standard";
    this.layoutMode="";
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
        position:"fixed",
        inset:"0",
        width:"100%",
        height:"100%",
        display:"block",
        pointerEvents:"none",
        zIndex:"615"
      });
      this.root.append(app.canvas);
      this.PIXI=PIXI;
      this.app=app;
      await this.loadTextures();
      this.build();
      this.ready=true;
      this.applyTheme("standard");
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
    value.eventMode="none";
    return value;
  }

  makeSprite(textureKey){
    const texture=this.textures[textureKey];
    if(!texture)return null;
    const sprite=new this.PIXI.Sprite(texture);
    sprite.anchor.set(.5);
    sprite.eventMode="none";
    return sprite;
  }

  makeFallbackButton(icon){
    const container=new this.PIXI.Container();
    container.eventMode="none";
    const back=new this.PIXI.Graphics();
    const text=this.makeText(icon,31,.5);
    container.addChild(back,text);
    container._back=back;
    container._icon=text;
    return container;
  }

  drawFallbackButton(container,width,height,{active=false}={}){
    if(!container)return;
    const back=container._back;
    back.clear()
      .roundRect(-width/2,-height/2,width,height,Math.max(10,height*.18))
      .fill(active?0x37203f:0x11151e)
      .stroke({color:active?0xf4bf54:0xb98039,width:3});
    container._icon.style.fontSize=Math.max(22,height*.45);
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
    const targetBack=new Graphics();
    const targetFill=new Graphics();
    const actions=new Container();

    const hpLabel=this.makeText("CASCO",15,0);
    const hpText=this.makeText("50 / 50",16,.5);
    const goldText=this.makeText("0",18,0);
    const rubyText=this.makeText("0",18,0);
    const levelText=this.makeText("1",16,.5);
    const targetText=this.makeText("",13,.5);
    const targetHpText=this.makeText("",11,.5);
    const ammoQtyText=this.makeText("",11,.5);
    const shieldQtyText=this.makeText("",10,.5);

    root.addChild(
      top,hpBack,hpFill,portrait,joystick,minimapBack,mapMarkers,
      targetBack,targetFill,actions,
      hpLabel,hpText,goldText,rubyText,levelText,targetText,targetHpText,
      ammoQtyText,shieldQtyText
    );

    const minimapFrame=this.makeSprite("minimap");
    if(minimapFrame)root.addChild(minimapFrame);

    const sprites={};
    for(const key of ["ammo","fire","follow","center","repair","shipyard","missions","shop"]){
      const sprite=this.makeSprite(key);
      if(sprite){actions.addChild(sprite);sprites[key]=sprite}
    }

    const configButton=this.makeFallbackButton("⚙");
    const shieldButton=this.makeFallbackButton("🛡");
    actions.addChild(configButton,shieldButton);

    stage.addChild(root);
    this.refs={
      root,top,hpBack,hpFill,portrait,joystick,minimapBack,mapMarkers,minimapFrame,
      targetBack,targetFill,actions,sprites,configButton,shieldButton,
      hpLabel,hpText,goldText,rubyText,levelText,targetText,targetHpText,
      ammoQtyText,shieldQtyText
    };
  }

  setSpriteTexture(key,textureKey){
    const sprite=this.refs.sprites?.[key];
    const texture=this.textures[textureKey];
    if(sprite&&texture)sprite.texture=texture;
  }

  applyTheme(theme="standard"){
    const next=theme==="halloween"?"halloween":"standard";
    this.theme=next;
    const halloween=next==="halloween";
    this.setSpriteTexture("ammo",halloween?"halloweenAmmo":"ammo");
    this.setSpriteTexture("fire",halloween?"halloweenFire":"fire");
    this.setSpriteTexture("repair",halloween?"halloweenRepair":"repair");
    this.setSpriteTexture("missions",halloween?"halloweenMissions":"missions");
    this.setSpriteTexture("shop",halloween?"halloweenShop":"shop");
    this.setSpriteTexture("follow","follow");
    this.setSpriteTexture("center","center");
    this.setSpriteTexture("shipyard","shipyard");
    this.lastSize="";
  }

  setRect(key,x,y,width,height){
    const w=Math.max(1,width),h=Math.max(1,height);
    this.buttonRects[key]={left:x-w/2,top:y-h/2,width:w,height:h};
    const sprite=this.refs.sprites?.[key];
    if(sprite){
      sprite.position.set(x,y);
      sprite.width=w;
      sprite.height=h;
    }
    const fallback=key==="config"?this.refs.configButton:(key==="shield"?this.refs.shieldButton:null);
    if(fallback){
      fallback.position.set(x,y);
      this.drawFallbackButton(fallback,w,h,{active:key==="shield"});
    }
  }

  layout(force=false){
    if(!this.app||!this.ready)return false;
    const rect=this.root.getBoundingClientRect();
    const w=Math.max(1,Math.round(rect.width||innerWidth||390));
    const h=Math.max(1,Math.round(rect.height||innerHeight||844));
    const portraitMode=h>w*1.08;
    const signature=w+"x"+h+":"+this.theme+":"+(portraitMode?"p":"l");
    if(!force&&signature===this.lastSize)return false;
    this.lastSize=signature;
    this.layoutMode=portraitMode?"portrait":"landscape";
    this.app.renderer.resize(w,h);

    const r=this.refs;
    const halloween=this.theme==="halloween";

    // Top strip: keep vital data readable while leaving the ocean unobstructed.
    const topH=clamp(h*.078,64,84);
    const portraitR=clamp(Math.min(w,h)*.048,31,45);
    const hpX=portraitR*2+22;
    const hpY=topH*.51;
    const hpW=portraitMode?clamp(w*.48,145,225):clamp(w*.24,185,320);
    const hpH=clamp(topH*.29,19,27);

    r.top.clear()
      .rect(0,0,w,topH).fill(halloween?0x25100e:0x2a160d)
      .rect(0,topH-8,w,8).fill(halloween?0x5c2618:0x70401e)
      .rect(0,topH-3,w,3).fill(halloween?0xe29a2c:0xd49b48);

    r.portrait.clear()
      .circle(portraitR+8,topH*.52,portraitR)
      .fill(halloween?0x271024:0x102b3a)
      .stroke({color:halloween?0xe0a034:0xc78e42,width:5});
    r.portrait.circle(28,topH-2,16).fill(0x12100d).stroke({color:0xd19a49,width:3});

    r.hpBack.clear().roundRect(hpX,hpY,hpW,hpH,10).fill(0x0a0d0e).stroke({color:0xb77b35,width:3});
    r.hpLabel.position.set(hpX,hpY-21);
    r.hpText.position.set(hpX+hpW/2,hpY+hpH/2);
    r.levelText.position.set(28,topH-2);

    const goldX=portraitMode?Math.max(hpX+hpW+22,w*.67):Math.max(hpX+hpW+38,w*.50);
    const rubyX=Math.min(w-42,goldX+(portraitMode?78:108));
    r.top.circle(goldX,topH*.42,14).fill(0xf4bf24).stroke({color:0x88500d,width:3});
    r.top.circle(rubyX,topH*.42,13).fill(0xd22542).stroke({color:0x711125,width:3});
    r.goldText.position.set(goldX+19,topH*.42-9);
    r.rubyText.position.set(rubyX+18,topH*.42-9);

    // Target bar lives under the top strip and appears only during target lock.
    const targetW=portraitMode?clamp(w*.68,210,310):clamp(w*.34,270,470);
    const targetH=16;
    const targetX=w/2-targetW/2;
    const targetY=topH+24;
    r.targetBack.clear()
      .roundRect(targetX,targetY,targetW,targetH,8)
      .fill({color:0x110d12,alpha:.88})
      .stroke({color:halloween?0xd68d2c:0xcaa462,width:2});
    r.targetText.position.set(w/2,targetY-7);
    r.targetHpText.position.set(w/2,targetY+targetH/2);
    r.targetFill.clear();

    // Minimap.
    const mapR=portraitMode?clamp(w*.125,52,72):clamp(Math.min(w,h)*.092,62,88);
    const mapX=w-mapR-12;
    const mapY=topH+mapR+20;
    r.minimapBack.clear().circle(mapX,mapY,mapR).fill(0x072d36);
    if(r.minimapFrame){
      r.minimapFrame.position.set(mapX,mapY);
      r.minimapFrame.width=(mapR+14)*2;
      r.minimapFrame.height=(mapR+14)*2;
    }

    // Joystick art under the real touch joystick.
    const joyR=portraitMode?clamp(w*.155,60,76):clamp(Math.min(w,h)*.105,64,96);
    const joyX=joyR+12;
    const joyY=h-joyR-18;
    r.joystick.clear()
      .circle(joyX,joyY,joyR).fill({color:0x092b3c,alpha:.82}).stroke({color:0xc0833b,width:6})
      .circle(joyX,joyY,joyR*.75).stroke({color:0x5c7c85,width:2,alpha:.55})
      .moveTo(joyX-joyR*.62,joyY).lineTo(joyX+joyR*.62,joyY).stroke({color:0x9eb8c0,width:2,alpha:.35})
      .moveTo(joyX,joyY-joyR*.62).lineTo(joyX,joyY+joyR*.62).stroke({color:0x9eb8c0,width:2,alpha:.35})
      .circle(joyX,joyY,joyR*.35).fill({color:0x16658a,alpha:.9}).stroke({color:0xd5edf3,width:3});

    this.buttonRects={};

    if(portraitMode){
      // Bottom-right combat block, leaving the joystick's entire touch area free.
      const compact=clamp(w*.135,48,58);
      const wideH=clamp(w*.145,52,62);
      const wideW=wideH*(halloween?1.50:1.12);
      const primaryH=wideH*1.08;
      const primaryW=primaryH*(halloween?1.50:1.12);
      const gap=6;
      const right=8;
      const row2Y=h-12-primaryH/2;
      const row1Y=row2Y-primaryH/2-wideH/2-gap;

      this.setRect("fire",w-right-primaryW/2,row2Y,primaryW,primaryH);
      this.setRect("follow",w-right-primaryW-gap-compact/2,row2Y,compact,compact);
      this.setRect("ammo",w-right-wideW/2,row1Y,wideW,wideH);
      this.setRect("center",w-right-wideW-gap-compact/2,row1Y,compact,compact);

      const repairY=row1Y-wideH/2-wideH/2-gap;
      this.setRect("repair",w-right-wideW/2,repairY,wideW,wideH);
      this.setRect("shield",w-right-wideW-gap-compact/2,repairY,compact,compact);

      // Utility pair sits below the minimap, away from combat controls.
      const util=clamp(w*.13,46,56);
      const utilWideH=clamp(w*.13,46,56);
      const utilWideW=utilWideH*(halloween?1.50:1.0);
      const ux=w-10-util/2;
      const uy=Math.min(h*.58,mapY+mapR+58);
      this.setRect("config",ux,uy,util,util);
      this.setRect("shipyard",ux-util-gap,uy,util,util);
      this.setRect("shop",w-10-utilWideW/2,uy+util+gap,utilWideW,utilWideH);
      this.setRect("missions",w-10-utilWideW-gap-utilWideW/2,uy+util+gap,utilWideW,utilWideH);
    }else{
      // Landscape/desktop: a clean horizontal combat strip, matching the reference layout.
      const compact=clamp(Math.min(w,h)*.075,54,74);
      const wideH=clamp(Math.min(w,h)*.082,58,78);
      const wideW=wideH*(halloween?1.50:1.08);
      const primaryH=wideH*1.10;
      const primaryW=primaryH*(halloween?1.50:1.08);
      const gap=8;
      const bottom=10;
      const y=h-bottom-primaryH/2;

      const actionWidths=[wideW,primaryW,compact,compact];
      const total=actionWidths.reduce((a,b)=>a+b,0)+gap*3;
      let x=w-12-total;
      this.setRect("ammo",x+wideW/2,h-bottom-wideH/2,wideW,wideH); x+=wideW+gap;
      this.setRect("fire",x+primaryW/2,y,primaryW,primaryH); x+=primaryW+gap;
      this.setRect("follow",x+compact/2,h-bottom-compact/2,compact,compact); x+=compact+gap;
      this.setRect("center",x+compact/2,h-bottom-compact/2,compact,compact);

      const extraY=h-bottom-primaryH-gap-wideH/2;
      this.setRect("repair",w-12-wideW/2,extraY,wideW,wideH);
      this.setRect("shield",w-12-wideW-gap-compact/2,extraY,compact,compact);

      // Right-side utility cluster, directly under the minimap.
      const util=compact;
      const utilWideH=wideH*.92;
      const utilWideW=utilWideH*(halloween?1.50:1.0);
      const uRight=12;
      const uBaseY=Math.min(h-primaryH-wideH-gap*3,mapY+mapR+util*.78);
      this.setRect("config",w-uRight-util/2,uBaseY,util,util);
      this.setRect("shipyard",w-uRight-util-gap-util/2,uBaseY,util,util);
      this.setRect("shop",w-uRight-utilWideW/2,uBaseY+util+gap,utilWideW,utilWideH);
      this.setRect("missions",w-uRight-utilWideW-gap-utilWideW/2,uBaseY+util+gap,utilWideW,utilWideH);
    }

    // Badges sit over the corresponding Pixi buttons.
    const ammoRect=this.buttonRects.ammo;
    if(ammoRect)r.ammoQtyText.position.set(ammoRect.left+ammoRect.width-7,ammoRect.top+8);
    const shieldRect=this.buttonRects.shield;
    if(shieldRect)r.shieldQtyText.position.set(shieldRect.left+shieldRect.width-5,shieldRect.top+7);

    return true;
  }

  sync(state={}){
    if(!this.ready)return false;
    const nextTheme=String(state.hudTheme||"standard")==="halloween"?"halloween":"standard";
    if(nextTheme!==this.theme){
      this.applyTheme(nextTheme);
      this.layout(true);
    }else{
      this.layout();
    }

    const r=this.refs;
    const maxHp=Math.max(1,Number(state.playerMaxHp)||1);
    const hp=clamp(Number(state.playerHp)||0,0,maxHp);
    const pct=hp/maxHp;

    const backBounds=r.hpBack.getBounds();
    const x=backBounds.x+3;
    const y=backBounds.y+3;
    const barH=Math.max(1,backBounds.height-6);
    const barW=Math.max(1,(backBounds.width-6)*pct);
    r.hpFill.clear().roundRect(x,y,barW,barH,8).fill(pct>.35?0x27b95d:0xd34832);
    r.hpText.text=Math.round(hp).toLocaleString("pt-BR")+" / "+Math.round(maxHp).toLocaleString("pt-BR");
    r.goldText.text=Number(state.gold||0).toLocaleString("pt-BR");
    r.rubyText.text=Number(state.rubies||0).toLocaleString("pt-BR");
    r.levelText.text=String(Math.max(1,Math.floor(Number(state.level)||1)));

    const target=state.target||{};
    const targetVisible=target.visible===true;
    r.targetBack.visible=targetVisible;
    r.targetFill.visible=targetVisible;
    r.targetText.visible=targetVisible;
    r.targetHpText.visible=targetVisible;
    if(targetVisible){
      const tmax=Math.max(1,Number(target.maxHp)||1);
      const thp=clamp(Number(target.hp)||0,0,tmax);
      const bounds=r.targetBack.getBounds();
      r.targetFill.clear().roundRect(
        bounds.x+2,
        bounds.y+2,
        Math.max(1,(bounds.width-4)*(thp/tmax)),
        Math.max(1,bounds.height-4),
        7
      ).fill(0xb52b2b);
      r.targetText.text=String(target.name||"Navio inimigo");
      r.targetHpText.text=Math.round(thp).toLocaleString("pt-BR")+" / "+Math.round(tmax).toLocaleString("pt-BR");
    }else{
      r.targetText.text="";
      r.targetHpText.text="";
    }

    // Minimap markers.
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

    const sprites=r.sprites;
    const attacking=state.attacking===true;
    const canFire=attacking||(state.hasCannons!==false&&state.hasAmmo!==false&&targetVisible);
    if(sprites.fire){
      const fireKey=this.theme==="halloween"
        ?(attacking?"halloweenCancel":"halloweenFire")
        :"fire";
      const tex=this.textures[fireKey];
      if(tex)sprites.fire.texture=tex;
      sprites.fire.alpha=canFire?1:.38;
    }
    if(sprites.follow)sprites.follow.alpha=targetVisible?1:.38;
    if(sprites.center)sprites.center.alpha=state.cameraDetached===true?1:.62;

    const canRepair=hp>0&&hp<maxHp&&!attacking&&state.repairAvailable===true;
    if(sprites.repair){
      sprites.repair.visible=canRepair;
      sprites.repair.alpha=canRepair?1:.38;
    }

    const shieldQty=Math.max(0,Math.floor(Number(state.hullReinforcementQuantity)||0));
    const shieldActive=state.hullReinforcementActive===true;
    r.shieldButton.visible=shieldQty>0||shieldActive;
    r.shieldButton.alpha=shieldActive?.55:1;
    r.shieldQtyText.visible=r.shieldButton.visible;
    r.shieldQtyText.text=shieldActive?"ON":(shieldQty>0?"×"+shieldQty:"");

    const selectedAmmo=(Array.isArray(state.ammo)?state.ammo:[]).find(item=>item?.selected===true);
    r.ammoQtyText.text=selectedAmmo?"×"+Math.floor(Number(selectedAmmo.quantity)||0):"";
    r.ammoQtyText.visible=Boolean(selectedAmmo);

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
