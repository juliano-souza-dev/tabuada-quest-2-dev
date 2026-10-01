const clamp=(value,min,max)=>Math.min(max,Math.max(min,value));

const finiteInteger=value=>{
  const number=Number(value);
  return Number.isInteger(number)?number:null;
};

const normalizeFact=value=>{
  if(Array.isArray(value)&&value.length>=2){
    const a=finiteInteger(value[0]);
    const b=finiteInteger(value[1]);
    return a===null||b===null?null:{a,b};
  }
  if(value&&typeof value==="object"){
    const a=finiteInteger(value.a??value.left??value.factorA);
    const b=finiteInteger(value.b??value.right??value.factorB);
    return a===null||b===null?null:{a,b};
  }
  if(typeof value==="string"){
    const match=value.trim().match(/^(-?\d+)\s*(?:x|×|\*)\s*(-?\d+)$/i);
    if(!match)return null;
    return {a:Number(match[1]),b:Number(match[2])};
  }
  return null;
};

const uniqueFacts=values=>{
  const seen=new Set();
  const facts=[];
  for(const value of Array.isArray(values)?values:[]){
    const fact=normalizeFact(value);
    if(!fact)continue;
    const key=fact.a+"x"+fact.b;
    if(seen.has(key))continue;
    seen.add(key);
    facts.push(fact);
  }
  return facts;
};

export class PedagogyRuntime {
  constructor({getState=null,curriculum=null}={}){
    this.getState=typeof getState==="function"?getState:()=>null;
    this.curriculum=curriculum&&typeof curriculum==="object"?structuredClone(curriculum):null;
    this.lastFactKey="";
    this.slotCache=null;
  }

  setCurriculum(curriculum){
    this.curriculum=curriculum&&typeof curriculum==="object"?structuredClone(curriculum):null;
    this.slotCache=null;
    return this;
  }

  pedagogicalState(){
    const state=this.getState?.()||{};
    const game=state.game&&typeof state.game==="object"?state.game:{};
    return game.pedagogy&&typeof game.pedagogy==="object"
      ?game.pedagogy
      :(state.pedagogy&&typeof state.pedagogy==="object"?state.pedagogy:{});
  }

  explicitAllowedFacts(){
    const pedagogy=this.pedagogicalState();
    return uniqueFacts(
      pedagogy.allowedFacts
      ??pedagogy.activeFacts
      ??pedagogy.challengeFacts
      ??[]
    );
  }

  plannedSlots(){
    if(this.slotCache)return this.slotCache.map(slot=>({...slot}));
    const curriculum=this.curriculum||{};
    const min=finiteInteger(curriculum.factors?.min)??1;
    const max=finiteInteger(curriculum.factors?.max)??10;
    const exposures=Math.max(1,finiteInteger(curriculum.exposuresPerFact)??4);
    const regions=Math.max(1,finiteInteger(curriculum.regions)??10);
    const islandsPerRegion=Math.max(1,finiteInteger(curriculum.islandsPerRegion)??5);
    const challengesPerIsland=Math.max(1,finiteInteger(curriculum.challengesPerIsland)??8);
    const perRegion=islandsPerRegion*challengesPerIsland;

    const facts=[];
    for(let a=min;a<=max;a++){
      for(let b=min;b<=max;b++)facts.push({a,b});
    }

    const slots=[];
    let index=0;
    for(let exposure=1;exposure<=exposures;exposure++){
      for(const fact of facts){
        const region=Math.min(regions,Math.floor(index/perRegion)+1);
        const inRegion=index%perRegion;
        const island=Math.floor(inRegion/challengesPerIsland)+1;
        const challenge=inRegion%challengesPerIsland+1;
        slots.push({
          index,
          presentation:index+1,
          exposure,
          region,
          island,
          challenge,
          a:fact.a,
          b:fact.b
        });
        index++;
      }
    }

    this.slotCache=slots;
    return slots.map(slot=>({...slot}));
  }

  validateCurriculum(){
    const curriculum=this.curriculum||{};
    const slots=this.plannedSlots();
    const facts=new Map();
    for(const slot of slots){
      const key=slot.a+"x"+slot.b;
      facts.set(key,(facts.get(key)||0)+1);
    }

    const expectedFacts=Number(curriculum.factsTotal??100);
    const expectedPresentations=Number(curriculum.plannedPresentations??400);
    const expectedExposure=Number(curriculum.exposuresPerFact??4);
    const regions=Number(curriculum.regions??10);
    const perRegion=Number(curriculum.presentationsPerRegion??40);
    const regionCounts=Array.from({length:regions},(_,i)=>slots.filter(slot=>slot.region===i+1).length);

    return {
      valid:
        facts.size===expectedFacts
        &&slots.length===expectedPresentations
        &&[...facts.values()].every(count=>count===expectedExposure)
        &&regionCounts.every(count=>count===perRegion),
      facts:facts.size,
      presentations:slots.length,
      exposuresPerFact:expectedExposure,
      regionCounts
    };
  }

  progress(){
    const pedagogy=this.pedagogicalState();
    const progress=pedagogy.progress&&typeof pedagogy.progress==="object"?pedagogy.progress:{};
    const total=this.plannedSlots().length;
    const completed=clamp(
      finiteInteger(
        progress.plannedCompleted
        ??progress.plannedPresentationsCompleted
        ??progress.completedChallenges
        ??0
      )??0,
      0,
      total
    );
    const slot=this.plannedSlots()[Math.min(completed,Math.max(0,total-1))]||null;
    return {
      plannedCompleted:completed,
      plannedTotal:total,
      region:finiteInteger(progress.region)??slot?.region??1,
      island:finiteInteger(progress.island)??slot?.island??1,
      challenge:finiteInteger(progress.challenge)??slot?.challenge??1,
      slot
    };
  }

  factsForRegion(region){
    const value=clamp(finiteInteger(region)??1,1,Number(this.curriculum?.regions??10));
    return uniqueFacts(
      this.plannedSlots()
        .filter(slot=>slot.region===value)
        .map(slot=>({a:slot.a,b:slot.b}))
    );
  }

  allowedFacts(context={}){
    const explicit=this.explicitAllowedFacts();
    if(explicit.length)return {facts:explicit,source:"player-pedagogy",region:this.progress().region};

    const progress=this.progress();
    const isTreasure=context.kind==="treasure"||context.entityType==="treasure";
    const isCombat=context.kind==="combat"||(context.entityType==="ship"&&context.combat===true);
    if(isTreasure&&this.curriculum?.bonusChallenges?.treasureChest?.enabled!==false){
      return {
        facts:this.factsForRegion(progress.region),
        source:"curriculum-current-region",
        region:progress.region
      };
    }
    if(isCombat){
      return {
        facts:this.factsForRegion(progress.region),
        source:"curriculum-current-region-combat",
        region:progress.region
      };
    }

    const slot=progress.slot;
    return {
      facts:slot?[{a:slot.a,b:slot.b}]:[],
      source:"curriculum-planned-slot",
      region:slot?.region??progress.region
    };
  }

  createChallenge(context={}){
    const selection=this.allowedFacts(context);
    const facts=selection.facts;
    if(!facts.length){
      return {
        available:false,
        code:"pedagogy_rules_unavailable",
        message:"Desafio pedagógico indisponível para esta conta."
      };
    }

    let pool=facts;
    if(facts.length>1&&this.lastFactKey){
      const filtered=facts.filter(fact=>fact.a+"x"+fact.b!==this.lastFactKey);
      if(filtered.length)pool=filtered;
    }

    const fact=pool[Math.floor(Math.random()*pool.length)];
    const key=fact.a+"x"+fact.b;
    this.lastFactKey=key;
    const expected=fact.a*fact.b;
    const isTreasure=context.kind==="treasure"||context.entityType==="treasure";
    const isCombat=context.kind==="combat"||(context.entityType==="ship"&&context.combat===true);
    const isBonus=isTreasure||isCombat;

    return {
      available:true,
      id:"multiplication:"+key+":"+Date.now().toString(36),
      kind:"multiplication",
      operation:"multiplication",
      a:fact.a,
      b:fact.b,
      prompt:fact.a+" × "+fact.b+" = ?",
      source:selection.source,
      region:selection.region,
      bonus:isBonus,
      countsTowardPlanned:isTreasure
        ?this.curriculum?.bonusChallenges?.treasureChest?.countTowardPlannedPresentations===true
        :(isCombat?false:true),
      context:{
        worldId:String(context.worldId||""),
        entityId:String(context.entityId||""),
        entityType:String(context.entityType||"")
      },
      evaluate:answer=>{
        const number=Number(String(answer??"").trim());
        return {
          correct:Number.isFinite(number)&&number===expected,
          expected,
          answer:Number.isFinite(number)?number:null
        };
      }
    };
  }
}
