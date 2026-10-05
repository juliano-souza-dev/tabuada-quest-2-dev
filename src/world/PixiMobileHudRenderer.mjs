const PIXI_URL="https://cdn.jsdelivr.net/npm/pixi.js@8.21.0/dist/pixi.min.mjs";

const HUD_V="20261005-hud-halloween-v13";

const ASSETS={
  ammo:"./assets/hud/municao.webp?v="+HUD_V,
  fire:"./assets/hud/atirar.webp?v="+HUD_V,
  follow:"./assets/hud/seguir.webp?v="+HUD_V,
  center:"./assets/hud/centralizar.webp?v="+HUD_V,
  shipyard:"./assets/hud/estaleiro.webp?v="+HUD_V,
  missions:"./assets/hud/missoes.webp?v="+HUD_V,
  shop:"./assets/hud/loja.webp?v="+HUD_V,

  hProfile:"./assets/hud/events/halloween/profile_hud_halloween.webp?v="+HUD_V,
  hHealth:"./assets/hud/events/halloween/health_bar_halloween.webp?v="+HUD_V,
  hGold:"./assets/hud/events/halloween/gold_bar_halloween.webp?v="+HUD_V,
  hRuby:"./assets/hud/events/halloween/ruby_bar_halloween.webp?v="+HUD_V,
  hShipyard:"./assets/hud/events/halloween/shipyard_halloween.webp?v="+HUD_V,
  hGroups:"./assets/hud/events/halloween/groups_halloween.webp?v="+HUD_V,
  hMissions:"./assets/hud/halloween_hud_missoes.webp?v="+HUD_V,
  hShop:"./assets/hud/halloween_hud_loja.webp?v="+HUD_V,
  hAmmo:"./assets/hud/halloween_hud_btn_trocar_municao.webp?v="+HUD_V,
  hFire:"./assets/hud/halloween_hud_btn_iniciar_ataque.webp?v="+HUD_V,
  hCancel:"./assets/hud/halloween_hud_btn_cancelar_ataque.webp?v="+HUD_V,
  hCenter:"./assets/hud/events/halloween/center_ship_halloween.webp?v="+HUD_V,
  hRepair:"./assets/hud/halloween_hud_btn_consertar_navio.webp?v="+HUD_V,

  minimap:"./assets/ui/ui_minimap_frame_pirate_cartoon_hq.webp?v="+HUD_V
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
    this.editorRects={};
    this.layoutOffsets={};
    this.lastSize="";
    this.theme="standard";
    this.ammoIconUrl="";
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
    const {Container,Graphics,Sprite,Texture}=this.PIXI;
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
    const halloweenChrome=new Container();
    const halloweenActions=new Container();

    const hpLabel=this.makeText("CASCO",15,0);
    const hpText=this.makeText("50 / 50",16,.5);
    const goldText=this.makeText("0",18,0);
    const rubyText=this.makeText("0",18,0);
    const levelText=this.makeText("1",16,.5);
    const targetText=this.makeText("",13,.5);
    const ammoQtyText=this.makeText("",11,.5);
    const shieldQtyText=this.makeText("",10,.5);
    const shieldIcon=this.makeText("🛡",24,.5);

    root.addChild(
      top,hpBack,hpFill,portrait,halloweenChrome,
      joystick,minimapBack,mapMarkers,actions,halloweenActions,
      hpLabel,hpText,goldText,rubyText,levelText,targetText,
      ammoQtyText,shieldQtyText,shieldIcon
    );

    const minimapFrame=this.makeSprite("minimap");
    if(minimapFrame)root.addChild(minimapFrame);

    const sprites={};
    for(const key of ["ammo","fire","follow","center","shipyard","missions","shop"]){
      const sprite=this.makeSprite(key);
      if(sprite){actions.addChild(sprite);sprites[key]=sprite}
    }

    const halloweenSprites={};
    for(const key of ["hProfile","hHealth","hGold","hRuby"]){
      const sprite=this.makeSprite(key);
      if(sprite){halloweenChrome.addChild(sprite);halloweenSprites[key]=sprite}
    }
    for(const key of ["hShipyard","hGroups","hMissions","hShop","hAmmo","hFire","hCancel","hCenter","hRepair"]){
      const sprite=this.makeSprite(key);
      if(sprite){halloweenActions.addChild(sprite);halloweenSprites[key]=sprite}
    }

    const ammoIcon=new Sprite(Texture.EMPTY);
    ammoIcon.anchor.set(.5);
    ammoIcon.eventMode="none";
    ammoIcon.visible=false;
    halloweenActions.addChild(ammoIcon);

    // Settings has no dedicated event asset yet.
    const configBack=new Graphics();
    const configIcon=this.makeText("⚙",32,.5);
    root.addChild(configBack,configIcon);

    stage.addChild(root);
    this.refs={
      root,top,hpBack,hpFill,portrait,joystick,minimapBack,mapMarkers,minimapFrame,
      actions,halloweenChrome,halloweenActions,sprites,halloweenSprites,
      configBack,configIcon,hpLabel,hpText,goldText,rubyText,levelText,targetText,
      ammoQtyText,shieldQtyText,shieldIcon,ammoIcon
    };
  }

  fitSprite(sprite,x,y,maxW,maxH,key=null){
    if(!sprite)return null;
    const tw=Math.max(1,Number(sprite.texture?.width)||1);
    const th=Math.max(1,Number(sprite.texture?.height)||1);
    const scale=Math.min(Math.max(1,maxW)/tw,Math.max(1,maxH)/th);
    const width=tw*scale;
    const height=th*scale;
    sprite.position.set(x,y);
    sprite.width=width;
    sprite.height=height;
    if(key)this.buttonRects[key]={left:x-width/2,top:y-height/2,width,height};
    return {left:x-width/2,top:y-height/2,width,height,cx:x,cy:y};
  }

  setSquare(key,sprite,x,y,size){
    const rect={left:x-size/2,top:y-size/2,width:size,height:size,cx:x,cy:y};
    this.buttonRects[key]=rect;
    if(sprite){
      sprite.position.set(x,y);
      sprite.width=size;
      sprite.height=size;
    }
    return rect;
  }

  async syncAmmoIcon(url){
    const next=String(url||"");
    if(next===this.ammoIconUrl)return;
    this.ammoIconUrl=next;
    const sprite=this.refs.ammoIcon;
    if(!sprite)return;
    if(!next){sprite.visible=false;return}
    try{
      const texture=await this.PIXI.Assets.load(next);
      if(this.ammoIconUrl!==next)return;
      sprite.texture=texture;
      const rect=this.buttonRects.ammo;
      if(rect){
        const size=Math.min(rect.width,rect.height)*.38;
        sprite.position.set(rect.left+rect.width*.50,rect.top+rect.height*.50);
        sprite.width=size;
        sprite.height=size;
      }
      sprite.visible=this.theme==="halloween";
    }catch{
      if(this.ammoIconUrl===next)sprite.visible=false;
    }
  }

  layout(force=false){
    if(!this.app||!this.ready)return false;
    const rect=this.root.getBoundingClientRect();
    const w=Math.max(1,Math.round(rect.width||innerWidth||390));
    const h=Math.max(1,Math.round(rect.height||innerHeight||844));
    const mobile=h>w*1.02||w<720;
    const signature=w+"x"+h+":"+this.theme+":"+(mobile?"m":"d");
    if(!force&&signature===this.lastSize)return false;
    this.lastSize=signature;
    this.app.renderer.resize(w,h);

    const r=this.refs;
    const halloween=this.theme==="halloween";
    this.buttonRects={};
    this.editorRects={};

    r.halloweenChrome.visible=halloween;
    r.halloweenActions.visible=halloween;
    r.top.visible=!halloween;
    r.sprites.ammo.visible=!halloween;
    r.sprites.center.visible=!halloween;
    r.sprites.shipyard.visible=!halloween;
    r.sprites.missions.visible=!halloween;
    r.sprites.shop.visible=!halloween;
    r.sprites.follow.visible=true;
    r.sprites.fire.visible=true;

    r.configBack.visible=true;
    r.configIcon.visible=true;

    let topZoneBottom=0;

    if(!halloween){
      const topH=clamp(h*.078,66,84);
      const portraitR=clamp(w*.062,34,48);
      const hpX=portraitR*2+20;
      const hpY=topH*.51;
      const hpW=clamp(w*.35,130,280);
      const hpH=clamp(topH*.31,20,28);

      r.top.clear().rect(0,0,w,topH).fill(0x2a160d);
      r.top.rect(0,topH-8,w,8).fill(0x70401e);
      r.top.rect(0,topH-3,w,3).fill(0xd49b48);
      r.portrait.clear().circle(portraitR+8,topH*.52,portraitR).fill(0x102b3a).stroke({color:0xc78e42,width:5});
      r.portrait.circle(29,topH-2,17).fill(0x12100d).stroke({color:0xd19a49,width:3});
      r.hpBack.clear().roundRect(hpX,hpY,hpW,hpH,10).fill(0x0a0d0e).stroke({color:0xb77b35,width:3});
      r.hpLabel.position.set(hpX,hpY-21);
      r.hpText.position.set(hpX+hpW/2,hpY+hpH/2);
      r.levelText.position.set(29,topH-2);

      const goldX=Math.max(hpX+hpW+28,w*.53);
      const rubyX=Math.max(goldX+92,w*.75);
      r.top.circle(goldX,topH*.42,15).fill(0xf4bf24).stroke({color:0x88500d,width:3});
      r.top.circle(rubyX,topH*.42,14).fill(0xd22542).stroke({color:0x711125,width:3});
      r.goldText.position.set(goldX+21,topH*.42-10);
      r.rubyText.position.set(rubyX+20,topH*.42-10);
      topZoneBottom=topH;
    }else{
      r.top.clear();

      if(mobile){
        const margin=6;
        const profileW=clamp(w*.59,205,255);
        const profileRect=this.fitSprite(
          r.halloweenSprites.hProfile,
          margin+profileW/2,
          margin+profileW*(227/628)/2,
          profileW,
          96
        );

        const profileH=profileRect?.height||82;
        const portraitX=margin+profileW*.19;
        const portraitY=margin+profileH*.50;
        const portraitR=profileH*.34;
        r.portrait.clear().circle(portraitX,portraitY,portraitR).fill({color:0x100b14,alpha:.82});
        r.levelText.position.set(margin+profileW*.105,margin+profileH*.82);

        const healthW=clamp(w*.50,180,220);
        const healthTop=margin+profileH+2;
        const healthRect=this.fitSprite(
          r.halloweenSprites.hHealth,
          margin+healthW/2,
          healthTop+healthW*(195/397)/2,
          healthW,
          84
        );
        if(healthRect){
          const innerX=healthRect.left+healthRect.width*.33;
          const innerY=healthRect.top+healthRect.height*.43;
          const innerW=healthRect.width*.59;
          const innerH=Math.max(13,healthRect.height*.17);
          r.hpBack.clear().roundRect(innerX,innerY,innerW,innerH,innerH/2).fill({color:0x07100b,alpha:.95});
          r.hpLabel.position.set(healthRect.left+healthRect.width*.36,healthRect.top+healthRect.height*.18);
          r.hpText.position.set(innerX+innerW/2,innerY+innerH/2);
        }

        const rightLeft=Math.max(profileW+10,w*.61);
        const rightW=Math.max(116,w-rightLeft-7);
        const goldW=Math.min(rightW,150);
        const goldRect=this.fitSprite(r.halloweenSprites.hGold,rightLeft+goldW/2,margin+29,goldW,58);
        const rubyW=Math.min(rightW,154);
        const rubyRect=this.fitSprite(r.halloweenSprites.hRuby,rightLeft+rubyW/2,margin+83,rubyW,54);
        if(goldRect)r.goldText.position.set(goldRect.left+goldRect.width*.54,goldRect.top+goldRect.height*.54);
        if(rubyRect)r.rubyText.position.set(rubyRect.left+rubyRect.width*.54,rubyRect.top+rubyRect.height*.54);

        topZoneBottom=Math.max(
          healthRect?healthRect.top+healthRect.height:healthTop+80,
          rubyRect?rubyRect.top+rubyRect.height:margin+112
        )+4;
      }else{
        const margin=8;
        const profileW=clamp(w*.29,360,470);
        const profileRect=this.fitSprite(
          r.halloweenSprites.hProfile,
          margin+profileW/2,
          margin+profileW*(227/628)/2,
          profileW,
          116
        );
        const profileH=profileRect?.height||110;
        const portraitX=margin+profileW*.19;
        const portraitY=margin+profileH*.50;
        const portraitR=profileH*.34;
        r.portrait.clear().circle(portraitX,portraitY,portraitR).fill({color:0x100b14,alpha:.82});
        r.levelText.position.set(margin+profileW*.105,margin+profileH*.82);

        const healthW=clamp(profileW*.72,250,330);
        const healthRect=this.fitSprite(
          r.halloweenSprites.hHealth,
          margin+healthW/2,
          margin+profileH+healthW*(195/397)/2,
          healthW,
          105
        );
        if(healthRect){
          const innerX=healthRect.left+healthRect.width*.33;
          const innerY=healthRect.top+healthRect.height*.43;
          const innerW=healthRect.width*.59;
          const innerH=Math.max(15,healthRect.height*.17);
          r.hpBack.clear().roundRect(innerX,innerY,innerW,innerH,innerH/2).fill({color:0x07100b,alpha:.95});
          r.hpLabel.position.set(healthRect.left+healthRect.width*.36,healthRect.top+healthRect.height*.18);
          r.hpText.position.set(innerX+innerW/2,innerY+innerH/2);
        }

        const currencyLeft=margin+profileW+12;
        const goldW=clamp(w*.15,180,250);
        const rubyW=clamp(w*.16,190,260);
        const goldRect=this.fitSprite(r.halloweenSprites.hGold,currencyLeft+goldW/2,margin+34,goldW,68);
        const rubyRect=this.fitSprite(r.halloweenSprites.hRuby,currencyLeft+rubyW/2,margin+100,rubyW,64);
        if(goldRect)r.goldText.position.set(goldRect.left+goldRect.width*.54,goldRect.top+goldRect.height*.54);
        if(rubyRect)r.rubyText.position.set(rubyRect.left+rubyRect.width*.54,rubyRect.top+rubyRect.height*.54);

        topZoneBottom=Math.max(
          healthRect?healthRect.top+healthRect.height:margin+profileH+100,
          rubyRect?rubyRect.top+rubyRect.height:margin+132
        )+4;
      }
    }

    const mapR=mobile?clamp(w*.115,46,58):clamp(Math.min(w,h)*.082,60,82);
    const mapX=w-mapR-10;
    const mapY=topZoneBottom+mapR+10;
    r.minimapBack.clear().circle(mapX,mapY,mapR).fill(0x072d36);
    if(r.minimapFrame){
      r.minimapFrame.position.set(mapX,mapY);
      r.minimapFrame.width=(mapR+12)*2;
      r.minimapFrame.height=(mapR+12)*2;
    }

    const joyR=mobile?clamp(w*.16,58,72):clamp(Math.min(w,h)*.10,64,92);
    const joyX=joyR+10;
    const joyY=h-joyR-16;
    r.joystick.clear()
      .circle(joyX,joyY,joyR).fill({color:0x092b3c,alpha:.82}).stroke({color:0xc0833b,width:6})
      .circle(joyX,joyY,joyR*.75).stroke({color:0x5c7c85,width:2,alpha:.55})
      .moveTo(joyX-joyR*.62,joyY).lineTo(joyX+joyR*.62,joyY).stroke({color:0x9eb8c0,width:2,alpha:.35})
      .moveTo(joyX,joyY-joyR*.62).lineTo(joyX,joyY+joyR*.62).stroke({color:0x9eb8c0,width:2,alpha:.35})
      .circle(joyX,joyY,joyR*.35).fill({color:0x16658a,alpha:.9}).stroke({color:0xd5edf3,width:3});

    const gap=mobile?5:8;

    if(!halloween){
      const base=clamp(w*.094,54,78);
      const primary=base*1.18;
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
      for(const [key,pos] of Object.entries({...actionLayout,...utilities})) this.setSquare(key,r.sprites[key],pos.x,pos.y,pos.size);

      const c=utilities.config;
      r.configBack.clear().roundRect(c.x-c.size/2,c.y-c.size/2,c.size,c.size,12).fill(0x10131c).stroke({color:0xb98039,width:3});
      r.configIcon.position.set(c.x,c.y);
      r.ammoQtyText.visible=false;
      r.shieldQtyText.visible=false;
      r.shieldIcon.visible=false;
      r.ammoIcon.visible=false;
    }else{
      const cell=mobile?clamp(w*.145,54,66):clamp(Math.min(w,h)*.082,60,76);
      const fireSize=cell*1.08;
      const gap=mobile?6:9;
      const leftMargin=10;
      const rightMargin=10;
      const topStart=topZoneBottom+10;
      const rowHeight=Math.max(cell,fireSize);
      const ordered=[
        {key:"ammo",size:cell},
        {key:"fire",size:fireSize},
        {key:"groups",size:cell},
        {key:"follow",size:cell},
        {key:"shipyard",size:cell},
        {key:"shop",size:cell},
        {key:"missions",size:cell},
        {key:"config",size:cell}
      ];
      const positions={};
      let cursorX=leftMargin;
      let row=0;

      for(const item of ordered){
        if(cursorX+item.size> w-rightMargin && cursorX>leftMargin){
          row+=1;
          cursorX=leftMargin;
        }
        const y=topStart+row*(rowHeight+gap)+item.size/2;
        positions[item.key]={x:cursorX+item.size/2,y,size:item.size};
        cursorX+=item.size+gap;
      }

      const pAmmo=positions.ammo;
      const pFire=positions.fire;
      const pGroups=positions.groups;
      const pFollow=positions.follow;
      const pShipyard=positions.shipyard;
      const pShop=positions.shop;
      const pMissions=positions.missions;
      const pConfig=positions.config;

      this.fitSprite(r.halloweenSprites.hAmmo,pAmmo.x,pAmmo.y,pAmmo.size,pAmmo.size,"ammo");
      this.fitSprite(r.halloweenSprites.hFire,pFire.x,pFire.y,pFire.size,pFire.size,"fire");
      this.fitSprite(r.halloweenSprites.hCancel,pFire.x,pFire.y,pFire.size,pFire.size);
      this.fitSprite(r.halloweenSprites.hGroups,pGroups.x,pGroups.y,pGroups.size,pGroups.size,"groups");
      this.setSquare("follow",r.sprites.follow,pFollow.x,pFollow.y,pFollow.size);
      this.fitSprite(r.halloweenSprites.hShipyard,pShipyard.x,pShipyard.y,pShipyard.size,pShipyard.size,"shipyard");
      this.fitSprite(r.halloweenSprites.hShop,pShop.x,pShop.y,pShop.size,pShop.size,"shop");
      this.fitSprite(r.halloweenSprites.hMissions,pMissions.x,pMissions.y,pMissions.size,pMissions.size,"missions");

      this.buttonRects.config={left:pConfig.x-pConfig.size/2,top:pConfig.y-pConfig.size/2,width:pConfig.size,height:pConfig.size,cx:pConfig.x,cy:pConfig.y};
      r.configBack.clear().roundRect(pConfig.x-pConfig.size/2,pConfig.y-pConfig.size/2,pConfig.size,pConfig.size,12).fill({color:0x171019,alpha:.94}).stroke({color:0xd09b3f,width:4});
      r.configIcon.position.set(pConfig.x,pConfig.y);

      const contextualY=topStart+cell/2;
      const centerX=w-cell/2-rightMargin;
      const repairX=centerX-cell-gap;
      const shieldX=repairX-cell-gap;

      this.fitSprite(r.halloweenSprites.hCenter,centerX,contextualY,cell,cell,"center");
      this.fitSprite(r.halloweenSprites.hRepair,repairX,contextualY,cell*.92,cell*.92,"repair");

      const shieldSize=mobile?clamp(cell*.70,42,52):48;
      this.buttonRects.shield={left:shieldX-shieldSize/2,top:contextualY-shieldSize/2,width:shieldSize,height:shieldSize,cx:shieldX,cy:contextualY};
      r.shieldIcon.position.set(shieldX,contextualY);
      r.shieldQtyText.position.set(shieldX+shieldSize*.28,contextualY+shieldSize*.30);

      const ammoRect=this.buttonRects.ammo;
      if(ammoRect){
        const iconSize=Math.min(ammoRect.width,ammoRect.height)*.44;
        r.ammoIcon.position.set(ammoRect.left+ammoRect.width*.50,ammoRect.top+ammoRect.height*.50);
        r.ammoIcon.width=iconSize;
        r.ammoIcon.height=iconSize;
        r.ammoQtyText.position.set(ammoRect.left+ammoRect.width*.78,ammoRect.top+ammoRect.height*.78);
      }
      r.ammoQtyText.visible=true;
      r.shieldQtyText.visible=true;
      r.shieldIcon.visible=true;
    }

    r.targetText.position.set(w/2,topZoneBottom+6);

    this.editorRects.top={left:0,top:0,width:w,height:Math.max(70,topZoneBottom)};
    this.editorRects.minimap={left:mapX-mapR-12,top:mapY-mapR-12,width:(mapR+12)*2,height:(mapR+12)*2};
    this.editorRects.joystick={left:joyX-joyR,top:joyY-joyR,width:joyR*2,height:joyR*2};
    for(const [key,rectValue] of Object.entries(this.buttonRects))this.editorRects[key]={...rectValue};
    this.applyLayoutOffsets();
    return true;
  }

  setLayoutOffsets(offsets={}){
    this.layoutOffsets=offsets&&typeof offsets==="object"?structuredClone(offsets):{};
    this.lastSize="";
    this.layout(true);
    return true;
  }

  applyLayoutOffsets(){
    const offsetOf=key=>{
      const value=this.layoutOffsets?.[key]||{};
      return {x:Number(value.x)||0,y:Number(value.y)||0,scale:Math.max(.35,Math.min(3,Number(value.scale)||1))};
    };
    const shiftDisplay=(display,key)=>{
      if(!display)return;
      const offset=offsetOf(key);
      display.position.x+=offset.x;
      display.position.y+=offset.y;
      if(offset.scale!==1&&display.scale){
        display.scale.x*=offset.scale;
        display.scale.y*=offset.scale;
      }
    };
    const shiftRect=(key)=>{
      const rect=this.buttonRects[key];
      const editorRect=this.editorRects[key];
      const offset=offsetOf(key);
      if(rect){
        const cx=(rect.cx??rect.left+rect.width/2)+offset.x;
        const cy=(rect.cy??rect.top+rect.height/2)+offset.y;
        const width=rect.width*offset.scale;
        const height=rect.height*offset.scale;
        rect.width=width;rect.height=height;rect.cx=cx;rect.cy=cy;rect.left=cx-width/2;rect.top=cy-height/2;
      }
      if(editorRect){
        const cx=editorRect.left+editorRect.width/2+offset.x;
        const cy=editorRect.top+editorRect.height/2+offset.y;
        const width=editorRect.width*offset.scale;
        const height=editorRect.height*offset.scale;
        editorRect.width=width;editorRect.height=height;editorRect.left=cx-width/2;editorRect.top=cy-height/2;
      }
    };

    const topOffset=offsetOf("top");
    for(const display of [
      this.refs.top,this.refs.hpBack,this.refs.hpFill,this.refs.portrait,this.refs.halloweenChrome,
      this.refs.hpLabel,this.refs.hpText,this.refs.goldText,this.refs.rubyText,this.refs.levelText
    ]){
      if(display){
        display.position.x+=topOffset.x;display.position.y+=topOffset.y;
        if(topOffset.scale!==1&&display.scale){display.scale.x*=topOffset.scale;display.scale.y*=topOffset.scale}
      }
    }
    if(this.editorRects.top){
      const rect=this.editorRects.top;
      const cx=rect.left+rect.width/2+topOffset.x;
      const cy=rect.top+rect.height/2+topOffset.y;
      const width=rect.width*topOffset.scale;
      const height=rect.height*topOffset.scale;
      rect.width=width;rect.height=height;rect.left=cx-width/2;rect.top=cy-height/2;
    }

    shiftDisplay(this.refs.minimapBack,"minimap");
    shiftDisplay(this.refs.mapMarkers,"minimap");
    shiftDisplay(this.refs.minimapFrame,"minimap");
    if(this.editorRects.minimap){
      const o=offsetOf("minimap");this.editorRects.minimap.left+=o.x;this.editorRects.minimap.top+=o.y;
    }

    shiftDisplay(this.refs.joystick,"joystick");
    if(this.editorRects.joystick){
      const o=offsetOf("joystick");this.editorRects.joystick.left+=o.x;this.editorRects.joystick.top+=o.y;
    }

    const displayForKey=key=>{
      if(key==="config")return [this.refs.configBack,this.refs.configIcon];
      if(key==="shield")return [this.refs.shieldIcon,this.refs.shieldQtyText];
      if(key==="ammo")return [this.theme==="halloween"?this.refs.halloweenSprites.hAmmo:this.refs.sprites.ammo,this.refs.ammoIcon,this.refs.ammoQtyText];
      if(key==="fire")return [this.refs.sprites.fire,this.refs.halloweenSprites.hCancel];
      if(key==="repair")return [this.refs.halloweenSprites.hRepair];
      if(key==="center")return [this.theme==="halloween"?this.refs.halloweenSprites.hCenter:this.refs.sprites.center];
      if(key==="shipyard")return [this.theme==="halloween"?this.refs.halloweenSprites.hShipyard:this.refs.sprites.shipyard];
      if(key==="groups")return [this.refs.halloweenSprites.hGroups];
      if(key==="missions")return [this.theme==="halloween"?this.refs.halloweenSprites.hMissions:this.refs.sprites.missions];
      if(key==="shop")return [this.theme==="halloween"?this.refs.halloweenSprites.hShop:this.refs.sprites.shop];
      if(key==="follow")return [this.refs.sprites.follow];
      return [];
    };

    for(const key of Object.keys(this.buttonRects)){
      for(const display of displayForKey(key))shiftDisplay(display,key);
      shiftRect(key);
    }
  }

  sync(state={}){
    if(!this.ready)return false;
    const nextTheme=String(state.hudTheme||"standard")==="halloween"?"halloween":"standard";
    if(nextTheme!==this.theme){
      this.theme=nextTheme;
      this.lastSize="";
    }
    this.layout();

    const r=this.refs;
    const halloween=this.theme==="halloween";
    const maxHp=Math.max(1,Number(state.playerMaxHp)||1);
    const hp=clamp(Number(state.playerHp)||0,0,maxHp);
    const pct=hp/maxHp;

    const backBounds=r.hpBack.getBounds();
    const x=backBounds.x+3;
    const y=backBounds.y+3;
    const h=Math.max(1,backBounds.height-6);
    const w=Math.max(1,(backBounds.width-6)*pct);
    r.hpFill.clear().roundRect(x,y,w,h,Math.max(5,h*.45)).fill(pct>.35?0x27b95d:0xd34832);
    r.hpText.text=Math.round(hp).toLocaleString("pt-BR")+" / "+Math.round(maxHp).toLocaleString("pt-BR");
    r.goldText.text=Number(state.gold||0).toLocaleString("pt-BR");
    r.rubyText.text=Number(state.rubies||0).toLocaleString("pt-BR");
    r.levelText.text=String(Math.max(1,Math.floor(Number(state.level)||1)));

    const target=state.target||{};
    r.targetText.text=target.visible===true
      ?String(target.name||"Navio inimigo")+"  "+Math.round(Number(target.hp)||0).toLocaleString("pt-BR")+"/"+Math.round(Number(target.maxHp)||1).toLocaleString("pt-BR")
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

    const attacking=state.attacking===true;
    const selectedAmmo=(Array.isArray(state.ammo)?state.ammo:[]).find(item=>item?.selected===true);
    const selectedQty=Math.max(0,Math.floor(Number(selectedAmmo?.quantity)||0));
    r.ammoQtyText.text=selectedQty>0?"×"+selectedQty:"";
    if(halloween)this.syncAmmoIcon(selectedAmmo?.image||"");
    else r.ammoIcon.visible=false;

    const shieldQty=Math.max(0,Math.floor(Number(state.hullReinforcementQuantity)||0));
    const shieldActive=state.hullReinforcementActive===true;
    r.shieldQtyText.text=shieldActive?"ON":(shieldQty>0?"×"+shieldQty:"");
    r.shieldIcon.alpha=shieldActive?1:(shieldQty>0?1:.38);

    const canRepair=hp>0&&hp<maxHp&&!attacking&&state.repairAvailable===true;
    if(r.halloweenSprites.hRepair){
      r.halloweenSprites.hRepair.visible=halloween&&canRepair;
      r.halloweenSprites.hRepair.alpha=canRepair?1:.38;
    }

    const centerStandard=r.sprites.center;
    if(centerStandard)centerStandard.alpha=state.cameraDetached===true?1:.38;
    const hCenter=r.halloweenSprites.hCenter;
    if(hCenter)hCenter.alpha=state.cameraDetached===true?1:.62;

    const follow=r.sprites.follow;
    if(follow){
      follow.visible=true;
      follow.alpha=state.target?.visible===true?1:.38;
    }

    const fire=r.sprites.fire;
    const cancel=r.halloweenSprites.hCancel;
    if(halloween){
      if(fire){
        fire.visible=!attacking;
        fire.alpha=state.hasCannons!==false&&state.hasAmmo!==false?1:.45;
      }
      if(cancel)cancel.visible=attacking;
      if(r.halloweenSprites.hAmmo)r.halloweenSprites.hAmmo.visible=true;
      if(r.halloweenSprites.hCenter)r.halloweenSprites.hCenter.visible=true;
      r.ammoIcon.visible=Boolean(this.ammoIconUrl&&r.ammoIcon.texture);
    }else{
      if(fire){
        fire.visible=true;
        fire.alpha=state.hasCannons!==false&&state.hasAmmo!==false?1:.45;
      }
      if(cancel)cancel.visible=false;
    }
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
