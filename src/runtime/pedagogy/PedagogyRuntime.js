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
  constructor({getState=null}={}){
    this.getState=typeof getState==="function"?getState:()=>null;
    this.lastFactKey="";
  }

  pedagogicalState(){
    const state=this.getState?.()||{};
    const game=state.game&&typeof state.game==="object"?state.game:{};
    const pedagogy=game.pedagogy&&typeof game.pedagogy==="object"
      ?game.pedagogy
      :(state.pedagogy&&typeof state.pedagogy==="object"?state.pedagogy:{});
    return pedagogy;
  }

  allowedFacts(){
    const pedagogy=this.pedagogicalState();
    return uniqueFacts(
      pedagogy.allowedFacts
      ??pedagogy.activeFacts
      ??pedagogy.challengeFacts
      ??[]
    );
  }

  createChallenge(context={}){
    const facts=this.allowedFacts();
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

    return {
      available:true,
      id:"multiplication:"+key+":"+Date.now().toString(36),
      kind:"multiplication",
      operation:"multiplication",
      a:fact.a,
      b:fact.b,
      prompt:fact.a+" × "+fact.b+" = ?",
      source:"player-pedagogy",
      context:{
        worldId:String(context.worldId||""),
        entityId:String(context.entityId||"")
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
