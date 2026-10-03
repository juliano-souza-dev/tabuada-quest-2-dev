const clone=value=>structuredClone(value);

const FLOW_UID="tq-flowtest-local-player";
const STATE_KEY="tq.flowtest.player.state.v1";
const CLAIMS_KEY="tq.flowtest.reward.claims.v1";

const emptyState=()=>({
  schema:"tq.player-state",
  version:1,
  profile:{
    uid:FLOW_UID,
    displayName:"Jogador Teste",
    developer:true,
    flowTest:true
  },
  game:{
    rewards:{coins:0,gold:0,rubies:0,xp:0,claims:[],claimDetails:{}},
    ships:{ownedShips:[],equippedShip:null},
    cannons:{owned:{},equippedByShip:{}},
    missions:{progress:{}}
  }
});

const readJson=(key,fallback)=>{
  try{
    const raw=localStorage.getItem(key);
    if(!raw)return fallback;
    const parsed=JSON.parse(raw);
    return parsed&&typeof parsed==="object"?parsed:fallback;
  }catch{
    return fallback;
  }
};

const writeJson=(key,value)=>{
  try{localStorage.setItem(key,JSON.stringify(value));return true}catch{return false}
};

class LocalFlowTestAuth extends EventTarget{
  status(){
    return Object.freeze({
      configured:true,
      authenticated:true,
      busy:false,
      uid:FLOW_UID,
      email:"flowtest@local.invalid",
      displayName:"Jogador Teste",
      online:false,
      localOnly:true,
      developer:true,
      flowTest:true
    });
  }
  async init(){return this.status()}
  async ensureFreshToken(){return null}
  async signInWithGoogle(){return this.status()}
  async signOut(){return this.status()}
}

class LocalFlowTestPlayerState extends EventTarget{
  constructor(auth){
    super();
    this.auth=auth;
    if(!localStorage.getItem(STATE_KEY))writeJson(STATE_KEY,emptyState());
  }

  status(){
    const auth=this.auth.status();
    return Object.freeze({
      authenticated:true,
      uid:auth.uid,
      online:false,
      canPlay:true,
      accountRequired:false,
      offlineAllowed:true,
      localOnly:true,
      flowTest:true
    });
  }

  load(){
    return clone(readJson(STATE_KEY,emptyState()));
  }

  save(state,{sync=true}={}){
    const next=state&&typeof state==="object"?clone(state):emptyState();
    writeJson(STATE_KEY,next);
    const detail={ok:true,code:"local-saved",syncRequested:Boolean(sync),localOnly:true};
    this.emit("sync",detail);
    return next;
  }

  hasPendingLocal(){return false}

  async restore(){
    const state=this.load();
    const result={ok:true,code:"local-restored",state};
    this.emit("restore",result);
    return result;
  }

  async syncNow(){
    const result={ok:true,code:"local-only",state:this.load()};
    this.emit("sync",result);
    return result;
  }

  async reserveRewardClaim(claimKey,payload={}){
    const key=String(claimKey||"").trim();
    if(!key)return {ok:false,code:"invalid_claim",claim:null};
    const claims=readJson(CLAIMS_KEY,{});
    if(claims[key]){
      const result={ok:false,code:"duplicate",claim:clone(claims[key])};
      this.emit("reward-claim",result);
      return result;
    }
    const claim={claimKey:key,payload:clone(payload),createdAt:new Date().toISOString()};
    claims[key]=claim;
    writeJson(CLAIMS_KEY,claims);
    const result={ok:true,code:"reserved-local",claim:clone(claim)};
    this.emit("reward-claim",result);
    return result;
  }

  clearCurrentAccount(){
    try{
      localStorage.removeItem(STATE_KEY);
      localStorage.removeItem(CLAIMS_KEY);
      writeJson(STATE_KEY,emptyState());
      return true;
    }catch{return false}
  }

  emit(type,detail){
    this.dispatchEvent(new CustomEvent(type,{detail}));
    globalThis.dispatchEvent?.(new CustomEvent("tq:player-"+type,{detail}));
  }
}

export function createLocalFlowTestServices(){
  const auth=new LocalFlowTestAuth();
  const playerState=new LocalFlowTestPlayerState(auth);
  return Object.freeze({
    auth,
    playerState,
    multiplayer:null,
    gameContent:null,
    getStatus:()=>Object.freeze({
      ...playerState.status(),
      auth:auth.status(),
      content:{source:"local-json",ready:true,localOnly:true,flowTest:true}
    })
  });
}
