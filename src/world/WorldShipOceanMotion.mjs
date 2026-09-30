const clamp=(value,min,max)=>Math.min(max,Math.max(min,value));
const finite=(value,fallback=0)=>Number.isFinite(Number(value))?Number(value):fallback;

function normalizeDirection(x,y){
  const length=Math.hypot(x,y);
  if(length<1e-6)return {x:.92,y:.38};
  return {x:x/length,y:y/length};
}

export function computeShipOceanMotion(ocean={},player={},timeMs=0,response=1){
  const t=Math.max(0,finite(timeMs))/1000;
  const speed=clamp(finite(ocean.speed,28),0,100);
  const swell=clamp(finite(ocean.swell,28),0,100);
  const distortion=clamp(finite(ocean.distortion,34),0,100);
  const waveMix=clamp(finite(ocean.waveMix,36),0,100);
  const foamMix=clamp(finite(ocean.foamMix,24),0,100);
  const tile=Math.max(64,finite(ocean.tileSize,720));
  const freqA=clamp(finite(ocean.waveFrequencyA,18),2,60);
  const freqB=clamp(finite(ocean.waveFrequencyB,15),2,60);
  const direction=normalizeDirection(finite(ocean.directionX,.82),finite(ocean.directionY,.32));
  const heading=finite(player.rotation,0)*Math.PI/180;
  const forward={x:Math.sin(heading),y:-Math.cos(heading)};
  const right={x:Math.cos(heading),y:Math.sin(heading)};
  const alignment=forward.x*direction.x+forward.y*direction.y;
  const headOn=Math.abs(alignment);
  const against=Math.max(0,-alignment);
  const broadside=1-headOn;

  const baseX=finite(player.x,0)/tile;
  const baseY=finite(player.y,0)/tile;
  const waveA=Math.sin(
    baseY*freqA+
    baseX*(freqA*.22)+
    t*(.45+speed*.006)
  );
  const waveB=Math.cos(
    baseX*freqB-
    baseY*(freqB*.46)+
    t*(.34+speed*.004)
  );
  const crest=Math.sin(
    baseX*24+
    baseY*19+
    t*(.8+speed*.008)
  );

  const swell01=swell/100;
  const speed01=speed/100;
  const distortion01=distortion/100;
  const waveMix01=waveMix/100;
  const foam01=foamMix/100;
  const responseScale=clamp(finite(response,1),0,2);

  const oceanEnergy=clamp(
    .10+
    swell01*.62+
    distortion01*.18+
    waveMix01*.16+
    speed01*.12+
    foam01*.05,
    .08,
    1.28
  );
  const energy=oceanEnergy*responseScale;

  const heave=(waveA*.72+waveB*.28)*(3.6+18.5*oceanEnergy)*responseScale;
  const surge=waveA*(5.0+26.0*oceanEnergy)*(.32+headOn*.46+against*.82)*responseScale;
  const sway=waveB*(2.2+13.5*oceanEnergy)*(.18+broadside*.82)*responseScale;

  const offsetX=forward.x*surge+right.x*sway+direction.x*heave*.22;
  const offsetY=forward.y*surge+right.y*sway+direction.y*heave*.22;

  const roll=(waveB*.72+crest*.28)*(3.4+17.0*oceanEnergy)*(.16+broadside*.84)*responseScale;
  const pitch=(waveA*.78+crest*.22)*(3.0+12.0*oceanEnergy)*(.28+headOn*.72)*responseScale;

  return {
    offsetX,
    offsetY,
    roll,
    scaleX:1-pitch*.0024,
    scaleY:1+pitch*.0036,
    heave,
    surge,
    sway,
    alignment,
    headOn,
    against,
    broadside,
    waveA,
    waveB,
    energy
  };
}
