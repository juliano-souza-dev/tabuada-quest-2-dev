const clamp=(value,min,max)=>Math.min(max,Math.max(min,Number(value)||0));
const bool=(value,fallback=true)=>value===undefined?fallback:value!==false;
const color=(value,fallback)=>/^#[0-9a-f]{6}$/i.test(String(value||""))?String(value):fallback;

export const AMMO_FX_PRESETS={
  standard:{
    id:"standard",label:"Padrão",
    muzzle:{enabled:true,size:44,durationMs:150,intensity:1,sparks:8,smoke:.28,color:"#ff9a32",coreColor:"#fff1b0"},
    projectile:{scale:1,color:"#ff6b1a",coreColor:"#fff0b0",glow:.72,opacity:1,wobble:0},
    trail:{enabled:true,length:8,width:14,opacity:.46,taper:.72,color:"#ff7a1a"},
    impactShip:{enabled:true,size:92,durationMs:480,sparks:16,smoke:.35,shock:.58,color:"#ff4a10",coreColor:"#fff1bd"},
    impactWater:{enabled:true,size:112,durationMs:720,splash:.78,ripple:.82,foam:.65,mist:.28,color:"#aeeeff",coreColor:"#ffffff"}
  },
  incendiary:{
    id:"incendiary",label:"Incendiária",
    muzzle:{enabled:true,size:54,durationMs:180,intensity:1.25,sparks:14,smoke:.42,color:"#ff5b0a",coreColor:"#fff07a"},
    projectile:{scale:1.18,color:"#ff2700",coreColor:"#fff166",glow:1.25,opacity:1,wobble:.12},
    trail:{enabled:true,length:18,width:21,opacity:.78,taper:.82,color:"#ff3a06"},
    impactShip:{enabled:true,size:132,durationMs:760,sparks:26,smoke:.72,shock:.72,color:"#ff2600",coreColor:"#fff394"},
    impactWater:{enabled:true,size:124,durationMs:820,splash:.95,ripple:.86,foam:.7,mist:.45,color:"#ff8450",coreColor:"#fff8d6"}
  },
  piercing:{
    id:"piercing",label:"Perfurante",
    muzzle:{enabled:true,size:38,durationMs:110,intensity:.9,sparks:10,smoke:.18,color:"#ffbd62",coreColor:"#ffffff"},
    projectile:{scale:.82,color:"#dbe9ff",coreColor:"#ffffff",glow:.42,opacity:1,wobble:0},
    trail:{enabled:true,length:13,width:7,opacity:.58,taper:.9,color:"#8fd4ff"},
    impactShip:{enabled:true,size:88,durationMs:620,sparks:30,smoke:.24,shock:.36,color:"#ffac55",coreColor:"#ffffff"},
    impactWater:{enabled:true,size:86,durationMs:560,splash:.54,ripple:.64,foam:.48,mist:.18,color:"#aeeeff",coreColor:"#ffffff"}
  },
  halloween:{
    id:"halloween",label:"Halloween roxa",
    muzzle:{enabled:true,size:56,durationMs:190,intensity:1.2,sparks:14,smoke:.32,color:"#8c2cff",coreColor:"#f3a8ff"},
    projectile:{scale:1.12,color:"#781cff",coreColor:"#f0a5ff",glow:1.35,opacity:1,wobble:.16},
    trail:{enabled:true,length:20,width:20,opacity:.72,taper:.8,color:"#8b2cff"},
    impactShip:{enabled:true,size:128,durationMs:720,sparks:22,smoke:.44,shock:.84,color:"#7c16ff",coreColor:"#f1a4ff"},
    impactWater:{enabled:true,size:136,durationMs:860,splash:.9,ripple:1,foam:.72,mist:.38,color:"#9d6cff",coreColor:"#f5c8ff"}
  }
};

const legacyPreset=ammo=>{
  const projectile=String(ammo?.effects?.projectile||"");
  const impact=String(ammo?.effects?.impact||"");
  if(projectile.includes("halloween")||impact.includes("halloween"))return "halloween";
  if(projectile.includes("piercing")||impact.includes("piercing"))return "piercing";
  return "standard";
};

const mergeSection=(base,value={})=>({...base,...(value&&typeof value==="object"?value:{})});

export function normalizeAmmoFx(ammo={}){
  const source=ammo?.fx&&typeof ammo.fx==="object"?ammo.fx:{};
  const presetId=String(source.preset||legacyPreset(ammo));
  const preset=AMMO_FX_PRESETS[presetId]||AMMO_FX_PRESETS.standard;
  const muzzle=mergeSection(preset.muzzle,source.muzzle);
  const projectile=mergeSection(preset.projectile,source.projectile);
  const trail=mergeSection(preset.trail,source.trail);
  const impactShip=mergeSection(preset.impactShip,source.impactShip);
  const impactWater=mergeSection(preset.impactWater,source.impactWater);
  const texture=String(source.projectile?.texture||ammo?.effects?.texture||"");
  return {
    preset:presetId,
    muzzle:{
      enabled:bool(muzzle.enabled,true),size:clamp(muzzle.size,8,220),durationMs:clamp(muzzle.durationMs,40,1600),
      intensity:clamp(muzzle.intensity,.05,3),sparks:Math.round(clamp(muzzle.sparks,0,64)),smoke:clamp(muzzle.smoke,0,1.5),
      color:color(muzzle.color,preset.muzzle.color),coreColor:color(muzzle.coreColor,preset.muzzle.coreColor)
    },
    projectile:{
      scale:clamp(projectile.scale,.2,4),color:color(projectile.color,preset.projectile.color),
      coreColor:color(projectile.coreColor,preset.projectile.coreColor),glow:clamp(projectile.glow,0,2.5),
      opacity:clamp(projectile.opacity,.05,1),wobble:clamp(projectile.wobble,0,1),texture
    },
    trail:{
      enabled:bool(trail.enabled,true),length:Math.round(clamp(trail.length,0,36)),width:clamp(trail.width,1,64),
      opacity:clamp(trail.opacity,0,1),taper:clamp(trail.taper,0,1),color:color(trail.color,preset.trail.color)
    },
    impactShip:{
      enabled:bool(impactShip.enabled,true),size:clamp(impactShip.size,12,360),durationMs:clamp(impactShip.durationMs,80,2200),
      sparks:Math.round(clamp(impactShip.sparks,0,64)),smoke:clamp(impactShip.smoke,0,1.5),shock:clamp(impactShip.shock,0,1.5),
      color:color(impactShip.color,preset.impactShip.color),coreColor:color(impactShip.coreColor,preset.impactShip.coreColor)
    },
    impactWater:{
      enabled:bool(impactWater.enabled,true),size:clamp(impactWater.size,12,420),durationMs:clamp(impactWater.durationMs,80,2600),
      splash:clamp(impactWater.splash,0,1.5),ripple:clamp(impactWater.ripple,0,1.5),foam:clamp(impactWater.foam,0,1.5),
      mist:clamp(impactWater.mist,0,1.5),color:color(impactWater.color,preset.impactWater.color),
      coreColor:color(impactWater.coreColor,preset.impactWater.coreColor)
    }
  };
}

export function applyAmmoFxPreset(ammo,presetId){
  const preset=AMMO_FX_PRESETS[presetId]||AMMO_FX_PRESETS.standard;
  return {...ammo,fx:normalizeAmmoFx({...ammo,fx:{preset:preset.id,...structuredClone(preset)}})};
}

export function hexToRgb01(value,fallback="#ffffff"){
  const hex=color(value,fallback).slice(1);
  return [
    parseInt(hex.slice(0,2),16)/255,
    parseInt(hex.slice(2,4),16)/255,
    parseInt(hex.slice(4,6),16)/255
  ];
}
