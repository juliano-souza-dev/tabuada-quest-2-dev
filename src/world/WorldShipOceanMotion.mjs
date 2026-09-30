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
  const energy=clamp((.18+swell01*.92)*(.84+speed01*.28),0,1.28)*clamp(finite(response,1),0,2);

  const heave=(waveA*.72+waveB*.28)*(1.1+6.8*energy);
  const surge=waveA*(1.2+7.8*energy)*(.28+headOn*.48+against*.64);
  const sway=waveB*(.45+4.4*energy)*(.18+broadside*.82);

  const offsetX=forward.x*surge+right.x*sway+direction.x*heave*.14;
  const offsetY=forward.y*surge+right.y*sway+direction.y*heave*.14;

  const roll=(waveB*.72+crest*.28)*(1.1+6.7*energy)*(.18+broadside*.82);
  const pitch=(waveA*.78+crest*.22)*(1.2+4.6*energy)*(.32+headOn*.68);

  return {
    offsetX,
    offsetY,
    roll,
    scaleX:1-pitch*.0018,
    scaleY:1+pitch*.0027,
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
