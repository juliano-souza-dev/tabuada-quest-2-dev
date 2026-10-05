const PIXI_URL="https://cdn.jsdelivr.net/npm/pixi.js@8.21.0/dist/pixi.min.mjs";

const ASSETS={
  ammo:"./assets/hud/municao.webp",
  fire:"./assets/hud/atirar.webp",
  follow:"./assets/hud/seguir.webp",
  center:"./assets/hud/centralizar.webp",
  shipyard:"./assets/hud/estaleiro.webp",
  missions:"./assets/hud/missoes.webp",
  shop:"./assets/hud/loja.webp",
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

    // Semantic composition:
    // - ATIRAR + MUNIÇÃO = combat actions, bottom-right.
    // - SEGUIR + CENTRALIZAR = target/camera/navigation controls, directly above combat.
    // - ESTALEIRO + MISSÕES + LOJA = persistent game menus under the minimap.
    // - REPARO + REFORÇO = hull maintenance, physically next to the CASCO status.
    const gap=portraitMode?6:8;

    if(portraitMode){
      const action=clamp(w*.145,50,62);
      const primary=clamp(w*.17,58,72);
      const right=8;
      const bottom=10;

      const fireX=w-right-primary/2;
      const fireY=h-bottom-primary/2;
      const ammoX=fireX-primary/2-gap-action/2;
      this.setRect("fire",fireX,fireY,primary,primary);
      this.setRect("ammo",ammoX,fireY,action,action);

      const navY=fireY-primary/2-gap-action/2;
      this.setRect("center",fireX,navY,action,action);
      this.setRect("follow",ammoX,navY,action,action);

      const util=clamp(w*.13,46,56);
      const ux=w-10-util/2;
      const utilityTop=Math.min(h*.58,mapY+mapR+util*.72);
      this.setRect("config",ux,utilityTop,util,util);
      this.setRect("shipyard",ux-util-gap,utilityTop,util,util);
      this.setRect("shop",ux,utilityTop+util+gap,util,util);
      this.setRect("missions",ux-util-gap,utilityTop+util+gap,util,util);

      const maintain=clamp(w*.105,40,48);
      const maintainY=topH+maintain*.62;
      this.setRect("repair",hpX+hpW+maintain*.65,maintainY,maintain,maintain);
      this.setRect("shield",hpX+hpW+maintain*1.65+gap,maintainY,maintain,maintain);
    }else{
      const desktop=w>=900&&h>=600;
      const action=clamp(Math.min(w,h)*(desktop?.078:.072),54,74);
      const primary=clamp(Math.min(w,h)*(desktop?.088:.082),62,82);
      const right=12;
      const bottom=10;

      const fireX=w-right-primary/2;
      const fireY=h-bottom-primary/2;
      const ammoX=fireX-primary/2-gap-action/2;
      this.setRect("fire",fireX,fireY,primary,primary);
      this.setRect("ammo",ammoX,fireY,action,action);

      const navY=fireY-primary/2-gap-action/2;
      this.setRect("center",fireX,navY,action,action);
      this.setRect("follow",ammoX,navY,action,action);

      const util=clamp(Math.min(w,h)*.07,54,68);
      const ux=w-right-util/2;
      const utilityTop=Math.min(
        h-primary-action-gap*3-util*2,
        mapY+mapR+util*.72
      );
      this.setRect("config",ux,utilityTop,util,util);
      this.setRect("shipyard",ux-util-gap,utilityTop,util,util);
      this.setRect("shop",ux,utilityTop+util+gap,util,util);
      this.setRect("missions",ux-util-gap,utilityTop+util+gap,util,util);

      const maintain=clamp(Math.min(w,h)*.055,42,54);
      const maintainY=topH+maintain*.62;
      this.setRect("repair",hpX+hpW+maintain*.65,maintainY,maintain,maintain);
      this.setRect("shield",hpX+hpW+maintain*1.65+gap,maintainY,maintain,maintain);
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
      const tex=this.textures.fire;
      if(tex)sprites.fire.texture=tex;
      sprites.fire.alpha=canFire?1:.38;
      sprites.fire.tint=attacking?0xffaaaa:0xffffff;
    }
    if(r.cancelMark){
      const rect=this.buttonRects.fire;
      r.cancelMark.visible=attacking===true&&Boolean(rect);
      if(rect)r.cancelMark.position.set(rect.left+rect.width/2,rect.top+rect.height/2);
    }
    if(sprites.follow)sprites.follow.alpha=targetVisible?1:.38;
    if(sprites.center)sprites.center.alpha=state.cameraDetached===true?1:.62;

    const canRepair=hp>0&&hp<maxHp&&!attacking&&state.repairAvailable===true;
    if(r.repairButton){
      r.repairButton.visible=canRepair;
      r.repairButton.alpha=canRepair?1:.38;
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
