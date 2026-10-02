const clamp=(value,min,max)=>Math.min(max,Math.max(min,Number(value)||0));
const bool=(value,fallback=true)=>value===undefined?fallback:value!==false;
const color=(value,fallback)=>/^#[0-9a-f]{6}$/i.test(String(value||""))?String(value):fallback;

const preset=(id,label,{muzzle,projectile,trail,impactShip,impactWater})=>({
  id,label,muzzle,projectile,trail,impactShip,impactWater
});

export const AMMO_FX_PRESETS={
  standard:preset("standard","Padrão lux",{
    muzzle:{enabled:true,size:48,durationMs:170,intensity:1.05,sparks:10,smoke:.28,color:"#ff8a24",coreColor:"#fff0a8",accentColor:"#69e7ff",starburst:.35},
    projectile:{scale:1,color:"#ff6b1a",coreColor:"#fff0b0",accentColor:"#69e7ff",glow:.78,opacity:1,wobble:.02,auraEnabled:true,auraScale:1.95,auraOpacity:.52,orbitCount:2,orbitRadius:.72,sparkle:.32,pulseSpeed:1.1},
    trail:{enabled:true,length:10,width:13,opacity:.5,taper:.72,color:"#ff8c21",secondaryColor:"#69e7ff",sparkle:.3,ribbon:.22},
    impactShip:{enabled:true,size:104,durationMs:620,sparks:18,smoke:.38,shock:.72,color:"#ff5a12",coreColor:"#fff1bd",accentColor:"#69e7ff",fireworks:.35,ringCount:2},
    impactWater:{enabled:true,size:118,durationMs:780,splash:.86,ripple:.9,foam:.72,mist:.3,color:"#8feaff",coreColor:"#ffffff",accentColor:"#ffd86a",magic:.25,ringCount:2}
  }),
  incendiary:preset("incendiary","Incendiária",{
    muzzle:{enabled:true,size:58,durationMs:210,intensity:1.35,sparks:18,smoke:.48,color:"#ff4b08",coreColor:"#fff166",accentColor:"#ffbd24",starburst:.72},
    projectile:{scale:1.18,color:"#ff2600",coreColor:"#fff166",accentColor:"#ff8c00",glow:1.38,opacity:1,wobble:.1,auraEnabled:true,auraScale:2.2,auraOpacity:.72,orbitCount:3,orbitRadius:.86,sparkle:.72,pulseSpeed:1.6},
    trail:{enabled:true,length:19,width:21,opacity:.82,taper:.82,color:"#ff3205",secondaryColor:"#ffb318",sparkle:.8,ribbon:.45},
    impactShip:{enabled:true,size:138,durationMs:820,sparks:30,smoke:.78,shock:.82,color:"#ff2400",coreColor:"#fff394",accentColor:"#ff9a18",fireworks:.72,ringCount:2},
    impactWater:{enabled:true,size:130,durationMs:900,splash:1.02,ripple:.92,foam:.74,mist:.62,color:"#ff7b42",coreColor:"#fff8d6",accentColor:"#ffffff",magic:.42,ringCount:2}
  }),
  piercing:preset("piercing","Perfurante elétrica",{
    muzzle:{enabled:true,size:42,durationMs:125,intensity:1,sparks:16,smoke:.12,color:"#67bfff",coreColor:"#ffffff",accentColor:"#9eefff",starburst:.75},
    projectile:{scale:.9,color:"#5aa8ff",coreColor:"#ffffff",accentColor:"#98eaff",glow:.72,opacity:1,wobble:0,auraEnabled:true,auraScale:1.58,auraOpacity:.34,orbitCount:2,orbitRadius:.7,sparkle:.55,pulseSpeed:1.7,texture:"./assets/cannons/bala_perfurante_512_q95.webp"},
    trail:{enabled:true,length:15,width:7,opacity:.62,taper:.92,color:"#71c7ff",secondaryColor:"#d9f8ff",sparkle:.58,ribbon:.42},
    impactShip:{enabled:true,size:94,durationMs:680,sparks:34,smoke:.2,shock:.52,color:"#55b8ff",coreColor:"#ffffff",accentColor:"#bdeeff",fireworks:.62,ringCount:2},
    impactWater:{enabled:true,size:90,durationMs:620,splash:.62,ripple:.76,foam:.5,mist:.16,color:"#86ddff",coreColor:"#ffffff",accentColor:"#c9f7ff",magic:.28,ringCount:2}
  }),
  halloween:preset("halloween","Halloween roxa clássica",{
    muzzle:{enabled:true,size:60,durationMs:220,intensity:1.35,sparks:18,smoke:.42,color:"#8c2cff",coreColor:"#f3a8ff",accentColor:"#63ff9a",starburst:.82},
    projectile:{scale:1.15,color:"#781cff",coreColor:"#f0a5ff",accentColor:"#63ff9a",glow:1.45,opacity:1,wobble:.16,auraEnabled:true,auraScale:2.3,auraOpacity:.8,orbitCount:6,orbitRadius:1.05,sparkle:1.05,pulseSpeed:2.1,texture:"./assets/cannons/bola_canhao_halloween_roxa.webp"},
    trail:{enabled:true,length:21,width:20,opacity:.76,taper:.8,color:"#8b2cff",secondaryColor:"#63ff9a",sparkle:1.08,ribbon:.92},
    impactShip:{enabled:true,size:136,durationMs:820,sparks:28,smoke:.5,shock:1,color:"#7c16ff",coreColor:"#f1a4ff",accentColor:"#63ff9a",fireworks:1.12,ringCount:3},
    impactWater:{enabled:true,size:142,durationMs:940,splash:1.02,ripple:1.12,foam:.8,mist:.54,color:"#9d6cff",coreColor:"#f5c8ff",accentColor:"#63ff9a",magic:1.05,ringCount:3}
  }),
  "rusted-iron":preset("rusted-iron","Ferro enferrujado",{
    muzzle:{enabled:true,size:50,durationMs:190,intensity:1.08,sparks:18,smoke:.62,color:"#d26a24",coreColor:"#ffd08a",accentColor:"#ffb04e",starburst:.46},
    projectile:{scale:1.08,color:"#bd5a27",coreColor:"#ffd18c",accentColor:"#ff9d3c",glow:.58,opacity:1,wobble:.025,auraEnabled:true,auraScale:1.7,auraOpacity:.38,orbitCount:1,orbitRadius:.58,sparkle:.36,pulseSpeed:.8,texture:"./assets/cannons/Bola de Canhão de Ferro Enferrujado.png"},
    trail:{enabled:true,length:12,width:10,opacity:.52,taper:.82,color:"#a84620",secondaryColor:"#ffb14c",sparkle:.52,ribbon:.24},
    impactShip:{enabled:true,size:118,durationMs:760,sparks:32,smoke:.78,shock:.62,color:"#c14b1e",coreColor:"#ffd298",accentColor:"#ffb24a",fireworks:.46,ringCount:2},
    impactWater:{enabled:true,size:116,durationMs:820,splash:.82,ripple:.78,foam:.58,mist:.58,color:"#a6e5ee",coreColor:"#ffffff",accentColor:"#e97a34",magic:.12,ringCount:2}
  }),
  "violet-crystal":preset("violet-crystal","Cristal violeta prismático",{
    muzzle:{enabled:true,size:64,durationMs:240,intensity:1.55,sparks:26,smoke:.18,color:"#8a36ff",coreColor:"#ffffff",accentColor:"#28e8ff",starburst:1.15},
    projectile:{scale:1.16,color:"#7a2cff",coreColor:"#ffffff",accentColor:"#20e7ff",glow:1.72,opacity:1,wobble:.08,auraEnabled:true,auraScale:2.45,auraOpacity:.76,orbitCount:8,orbitRadius:1.12,sparkle:1.35,pulseSpeed:2.3,texture:"./assets/cannons/Orbe Mágico de Cristal Violeta.png"},
    trail:{enabled:true,length:24,width:15,opacity:.78,taper:.82,color:"#8d36ff",secondaryColor:"#25e6ff",sparkle:1.35,ribbon:1.05},
    impactShip:{enabled:true,size:150,durationMs:980,sparks:38,smoke:.18,shock:1.18,color:"#7c22ff",coreColor:"#ffffff",accentColor:"#24e8ff",fireworks:1.48,ringCount:3},
    impactWater:{enabled:true,size:152,durationMs:1040,splash:1.12,ripple:1.22,foam:.78,mist:.38,color:"#865dff",coreColor:"#ffffff",accentColor:"#26e8ff",magic:1.28,ringCount:3}
  }),
  "ocean-pearl":preset("ocean-pearl","Pérola oceânica",{
    muzzle:{enabled:true,size:56,durationMs:210,intensity:1.32,sparks:16,smoke:.16,color:"#38d6ff",coreColor:"#ffffff",accentColor:"#64ffd5",starburst:.72},
    projectile:{scale:1.18,color:"#54ddff",coreColor:"#ffffff",accentColor:"#65ffd6",glow:1.45,opacity:1,wobble:.055,auraEnabled:true,auraScale:2.25,auraOpacity:.68,orbitCount:5,orbitRadius:.95,sparkle:1.05,pulseSpeed:1.55,texture:"./assets/cannons/Orbe Mágico de Pérola Oceânica.png"},
    trail:{enabled:true,length:22,width:17,opacity:.72,taper:.75,color:"#49d7ff",secondaryColor:"#62ffd8",sparkle:.92,ribbon:.9},
    impactShip:{enabled:true,size:132,durationMs:860,sparks:22,smoke:.14,shock:.95,color:"#38c9ff",coreColor:"#ffffff",accentColor:"#6affdc",fireworks:.88,ringCount:3},
    impactWater:{enabled:true,size:176,durationMs:1180,splash:1.42,ripple:1.42,foam:1.28,mist:.76,color:"#5be2ff",coreColor:"#ffffff",accentColor:"#5dffd3",magic:1.42,ringCount:4}
  }),
  "halloween-pumpkin":preset("halloween-pumpkin","Abóbora arcana",{
    muzzle:{enabled:true,size:72,durationMs:280,intensity:1.75,sparks:32,smoke:.62,color:"#7c22ff",coreColor:"#ffb340",accentColor:"#72ff54",starburst:1.35},
    projectile:{scale:1.22,color:"#7928ff",coreColor:"#ffb644",accentColor:"#70ff4d",glow:1.95,opacity:1,wobble:.19,auraEnabled:true,auraScale:2.7,auraOpacity:.88,orbitCount:10,orbitRadius:1.25,sparkle:1.5,pulseSpeed:2.65,texture:"./assets/cannons/Orbe Místico de Abóbora Roxa.png"},
    trail:{enabled:true,length:28,width:22,opacity:.86,taper:.7,color:"#8a2eff",secondaryColor:"#70ff4d",sparkle:1.5,ribbon:1.32},
    impactShip:{enabled:true,size:170,durationMs:1120,sparks:44,smoke:.72,shock:1.38,color:"#7b1fff",coreColor:"#ffc251",accentColor:"#70ff4d",fireworks:1.5,ringCount:4},
    impactWater:{enabled:true,size:178,durationMs:1260,splash:1.32,ripple:1.48,foam:1.05,mist:1.02,color:"#924fff",coreColor:"#ffd08a",accentColor:"#70ff4d",magic:1.5,ringCount:4}
  }),
  "volcanic-lava":preset("volcanic-lava","Lava vulcânica",{
    muzzle:{enabled:true,size:74,durationMs:260,intensity:1.82,sparks:36,smoke:.86,color:"#ff2a00",coreColor:"#fff36c",accentColor:"#ff9b13",starburst:1.22},
    projectile:{scale:1.22,color:"#ff2500",coreColor:"#fff56c",accentColor:"#ff9b13",glow:1.9,opacity:1,wobble:.09,auraEnabled:true,auraScale:2.55,auraOpacity:.86,orbitCount:4,orbitRadius:.9,sparkle:1.38,pulseSpeed:2.15,texture:"./assets/cannons/Orbe Vulcânico de Lava Incandescente.png"},
    trail:{enabled:true,length:26,width:25,opacity:.9,taper:.78,color:"#ff2b00",secondaryColor:"#ffb21a",sparkle:1.4,ribbon:.82},
    impactShip:{enabled:true,size:176,durationMs:1180,sparks:46,smoke:1.05,shock:1.32,color:"#ff2400",coreColor:"#fff06a",accentColor:"#ff9d12",fireworks:1.35,ringCount:3},
    impactWater:{enabled:true,size:188,durationMs:1380,splash:1.12,ripple:1.16,foam:1.18,mist:1.45,color:"#ff5b2c",coreColor:"#ffffff",accentColor:"#ffbf25",magic:.78,ringCount:3}
  }),
  "terror-rose":preset("terror-rose","Rosa do Terror",{
    muzzle:{enabled:true,size:70,durationMs:270,intensity:1.68,sparks:28,smoke:.52,color:"#ff216f",coreColor:"#ffd0ef",accentColor:"#76ff5a",starburst:1.25},
    projectile:{scale:1.2,color:"#d71373",coreColor:"#ffd1ee",accentColor:"#76ff5a",glow:1.82,opacity:1,wobble:.14,auraEnabled:true,auraScale:2.6,auraOpacity:.84,orbitCount:9,orbitRadius:1.18,sparkle:1.45,pulseSpeed:2.4,texture:"./assets/cannons/rosa do terror.png"},
    trail:{enabled:true,length:27,width:19,opacity:.84,taper:.72,color:"#e31778",secondaryColor:"#76ff5a",sparkle:1.45,ribbon:1.2},
    impactShip:{enabled:true,size:164,durationMs:1080,sparks:42,smoke:.58,shock:1.3,color:"#d91572",coreColor:"#ffd2ef",accentColor:"#76ff5a",fireworks:1.5,ringCount:4},
    impactWater:{enabled:true,size:166,durationMs:1220,splash:1.22,ripple:1.38,foam:.96,mist:.92,color:"#e94c9e",coreColor:"#ffd7f1",accentColor:"#76ff5a",magic:1.45,ringCount:4}
  })
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
  const texture=String(source.projectile?.texture||projectile.texture||ammo?.effects?.texture||"");
  return {
    preset:presetId,
    muzzle:{
      enabled:bool(muzzle.enabled,true),size:clamp(muzzle.size,8,260),durationMs:clamp(muzzle.durationMs,40,1800),
      intensity:clamp(muzzle.intensity,.05,3),sparks:Math.round(clamp(muzzle.sparks,0,64)),smoke:clamp(muzzle.smoke,0,1.5),
      color:color(muzzle.color,preset.muzzle.color),coreColor:color(muzzle.coreColor,preset.muzzle.coreColor),
      accentColor:color(muzzle.accentColor,preset.muzzle.accentColor||preset.muzzle.coreColor),starburst:clamp(muzzle.starburst,0,1.5)
    },
    projectile:{
      scale:clamp(projectile.scale,.2,4),color:color(projectile.color,preset.projectile.color),
      coreColor:color(projectile.coreColor,preset.projectile.coreColor),accentColor:color(projectile.accentColor,preset.projectile.accentColor||preset.projectile.coreColor),
      glow:clamp(projectile.glow,0,2.5),opacity:clamp(projectile.opacity,.05,1),wobble:clamp(projectile.wobble,0,1),texture,
      auraEnabled:bool(projectile.auraEnabled,true),auraScale:clamp(projectile.auraScale,1,3.5),auraOpacity:clamp(projectile.auraOpacity,0,1),
      orbitCount:Math.round(clamp(projectile.orbitCount,0,12)),orbitRadius:clamp(projectile.orbitRadius,.25,2.2),
      sparkle:clamp(projectile.sparkle,0,1.5),pulseSpeed:clamp(projectile.pulseSpeed,.2,4)
    },
    trail:{
      enabled:bool(trail.enabled,true),length:Math.round(clamp(trail.length,0,36)),width:clamp(trail.width,1,64),
      opacity:clamp(trail.opacity,0,1),taper:clamp(trail.taper,0,1),color:color(trail.color,preset.trail.color),
      secondaryColor:color(trail.secondaryColor,preset.trail.secondaryColor||preset.trail.color),sparkle:clamp(trail.sparkle,0,1.5),ribbon:clamp(trail.ribbon,0,1.5)
    },
    impactShip:{
      enabled:bool(impactShip.enabled,true),size:clamp(impactShip.size,12,420),durationMs:clamp(impactShip.durationMs,80,2400),
      sparks:Math.round(clamp(impactShip.sparks,0,64)),smoke:clamp(impactShip.smoke,0,1.5),shock:clamp(impactShip.shock,0,1.5),
      color:color(impactShip.color,preset.impactShip.color),coreColor:color(impactShip.coreColor,preset.impactShip.coreColor),
      accentColor:color(impactShip.accentColor,preset.impactShip.accentColor||preset.impactShip.coreColor),
      fireworks:clamp(impactShip.fireworks,0,1.5),ringCount:Math.round(clamp(impactShip.ringCount,1,4))
    },
    impactWater:{
      enabled:bool(impactWater.enabled,true),size:clamp(impactWater.size,12,460),durationMs:clamp(impactWater.durationMs,80,2800),
      splash:clamp(impactWater.splash,0,1.5),ripple:clamp(impactWater.ripple,0,1.5),foam:clamp(impactWater.foam,0,1.5),
      mist:clamp(impactWater.mist,0,1.5),color:color(impactWater.color,preset.impactWater.color),
      coreColor:color(impactWater.coreColor,preset.impactWater.coreColor),
      accentColor:color(impactWater.accentColor,preset.impactWater.accentColor||preset.impactWater.coreColor),
      magic:clamp(impactWater.magic,0,1.5),ringCount:Math.round(clamp(impactWater.ringCount,1,4))
    }
  };
}

export function applyAmmoFxPreset(ammo,presetId){
  const selected=AMMO_FX_PRESETS[presetId]||AMMO_FX_PRESETS.standard;
  return {...ammo,fx:normalizeAmmoFx({...ammo,fx:{preset:selected.id,...structuredClone(selected)}})};
}

export function hexToRgb01(value,fallback="#ffffff"){
  const hex=color(value,fallback).slice(1);
  return [
    parseInt(hex.slice(0,2),16)/255,
    parseInt(hex.slice(2,4),16)/255,
    parseInt(hex.slice(4,6),16)/255
  ];
}
