const GOOGLE_IDENTITY_SCRIPT = "https://accounts.google.com/gsi/client";

function safeJson(raw){
  try{return raw?JSON.parse(raw):null}catch{return null}
}

export class FirebaseAuthService extends EventTarget {
  constructor(config, options={}){
    super();
    this.config=config||{};
    this.storage=options.storage||globalThis.localStorage;
    this.sessionKey=options.sessionKey||"tq.firebase.auth.session.v1";
    this.session=this.readSession();
    this.busy=false;
    this.googleScriptPromise=null;
    this.refreshPromise=null;
    this.lastCode="";
  }

  static async fromUrl(url){
    const response=await fetch(url,{cache:"no-store"});
    if(!response.ok)throw new Error(`Firebase public config load failed: ${response.status}`);
    return new FirebaseAuthService(await response.json());
  }

  isConfigured(){
    return Boolean(this.config?.apiKey&&this.config?.projectId&&this.config?.googleWebClientId);
  }

  readSession(){
    const value=safeJson(this.storage?.getItem?.(this.sessionKey));
    if(!value?.uid)return null;
    return {
      uid:String(value.uid),
      idToken:String(value.idToken||""),
      refreshToken:String(value.refreshToken||""),
      expiresAt:Number(value.expiresAt)||0,
      email:String(value.email||""),
      displayName:String(value.displayName||"")
    };
  }

  persistSession(next){
    this.session=next;
    try{
      if(next)this.storage?.setItem?.(this.sessionKey,JSON.stringify(next));
      else this.storage?.removeItem?.(this.sessionKey);
    }catch{}
  }

  status(){
    return Object.freeze({
      configured:this.isConfigured(),
      authenticated:Boolean(this.session?.uid),
      busy:this.busy,
      uid:String(this.session?.uid||""),
      email:String(this.session?.email||""),
      displayName:String(this.session?.displayName||""),
      online:globalThis.navigator?.onLine!==false,
      lastCode:String(this.lastCode||"")
    });
  }

  emit(code,ok=true,extra={}){
    this.lastCode=String(code||"");
    const detail={ok:Boolean(ok),code:this.lastCode,status:this.status(),...extra};
    this.dispatchEvent(new CustomEvent("change",{detail}));
    globalThis.dispatchEvent?.(new CustomEvent("tq:auth-change",{detail}));
    return detail;
  }

  async init(){
    if(!this.isConfigured()){
      this.emit("firebase_not_configured",false);
      return this.status();
    }

    if(this.session?.uid){
      this.emit("session_restored",true);
      if(globalThis.navigator?.onLine!==false)await this.ensureFreshToken().catch(()=>{});
    }else{
      this.emit("auth_required",false);
    }

    globalThis.addEventListener?.("online",()=>{
      this.ensureFreshToken().catch(()=>{});
      this.preloadGoogleIdentity();
    });
    if(globalThis.navigator?.onLine!==false)this.preloadGoogleIdentity();
    return this.status();
  }

  preloadGoogleIdentity(){
    this.loadGoogleIdentity().catch(()=>{});
  }

  loadGoogleIdentity(){
    if(globalThis.google?.accounts?.oauth2)return Promise.resolve();
    if(this.googleScriptPromise)return this.googleScriptPromise;

    const attempt=new Promise((resolve,reject)=>{
      const existing=document.querySelector('script[data-tq-google-identity="true"]');
      if(existing){
        if(globalThis.google?.accounts?.oauth2){resolve();return}
        existing.remove();
      }

      const script=document.createElement("script");
      script.src=GOOGLE_IDENTITY_SCRIPT;
      script.async=true;
      script.defer=true;
      script.dataset.tqGoogleIdentity="true";
      script.addEventListener("load",resolve,{once:true});
      script.addEventListener("error",()=>{
        script.remove();
        reject(new Error("google_sign_in_unavailable"));
      },{once:true});
      document.head.append(script);
    });

    this.googleScriptPromise=attempt.catch(error=>{
      this.googleScriptPromise=null;
      throw error;
    });
    return this.googleScriptPromise;
  }

  async exchangeGoogleToken(accessToken){
    const endpoint="https://identitytoolkit.googleapis.com/v1/accounts:signInWithIdp?key="+encodeURIComponent(this.config.apiKey);
    const response=await fetch(endpoint,{
      method:"POST",
      headers:{"Content-Type":"application/json"},
      body:JSON.stringify({
        postBody:new URLSearchParams({access_token:String(accessToken||""),providerId:"google.com"}).toString(),
        requestUri:String(globalThis.location?.origin||""),
        returnIdpCredential:true,
        returnSecureToken:true
      })
    });

    const body=await response.json().catch(()=>({}));
    if(!response.ok||!body.localId||!body.idToken){
      const code=String(body?.error?.message||"firebase_google_sign_in_failed");
      console.error("[TQ auth] Firebase signInWithIdp failed",{
        status:response.status,
        code,
        requestUri:String(globalThis.location?.origin||""),
        providerId:"google.com"
      });
      throw new Error(code);
    }

    this.persistSession({
      uid:String(body.localId),
      idToken:String(body.idToken),
      refreshToken:String(body.refreshToken||""),
      expiresAt:Date.now()+Math.max(60,Number(body.expiresIn)||3600)*1000,
      email:String(body.email||""),
      displayName:String(body.displayName||body.fullName||"")
    });
  }

  async signInWithGoogle(){
    if(this.busy)return this.status();
    if(!this.isConfigured()){
      this.emit("firebase_not_configured",false);
      return this.status();
    }
    if(globalThis.navigator?.onLine===false){
      this.emit("login_requires_network",false);
      return this.status();
    }

    this.busy=true;
    this.emit("google_sign_in_started",true);

    try{
      await this.loadGoogleIdentity();
      if(!globalThis.google?.accounts?.oauth2)throw new Error("google_sign_in_unavailable");

      const accessToken=await new Promise((resolve,reject)=>{
        const client=globalThis.google.accounts.oauth2.initTokenClient({
          client_id:this.config.googleWebClientId,
          scope:"openid email profile",
          callback:result=>{
            if(result?.access_token&&!result?.error)resolve(result.access_token);
            else reject(new Error(result?.error||"google_sign_in_cancelled_or_failed"));
          },
          error_callback:()=>reject(new Error("google_sign_in_cancelled_or_failed"))
        });
        client.requestAccessToken({prompt:"select_account"});
      });

      await this.exchangeGoogleToken(accessToken);
      this.busy=false;
      this.emit("google_signed_in",true);
      return this.status();
    }catch(error){
      this.busy=false;
      this.emit(error?.message||"google_sign_in_cancelled_or_failed",false);
      return this.status();
    }
  }

  async refreshSession(){
    if(this.refreshPromise)return this.refreshPromise;
    if(!this.session?.refreshToken||globalThis.navigator?.onLine===false)return Boolean(this.session?.uid);

    this.refreshPromise=(async()=>{
      try{
        const response=await fetch(
          "https://securetoken.googleapis.com/v1/token?key="+encodeURIComponent(this.config.apiKey),
          {
            method:"POST",
            headers:{"Content-Type":"application/x-www-form-urlencoded"},
            body:new URLSearchParams({
              grant_type:"refresh_token",
              refresh_token:this.session.refreshToken
            }).toString()
          }
        );

        if(!response.ok){
          if(response.status===400||response.status===401){
            this.persistSession(null);
            this.emit("auth_required",false);
          }
          return false;
        }

        const body=await response.json();
        this.persistSession({
          ...this.session,
          uid:String(body.user_id||this.session.uid||""),
          idToken:String(body.id_token||""),
          refreshToken:String(body.refresh_token||this.session.refreshToken||""),
          expiresAt:Date.now()+Math.max(60,Number(body.expires_in)||3600)*1000
        });
        this.emit("session_refreshed",true);
        return true;
      }catch{
        return Boolean(this.session?.uid);
      }finally{
        this.refreshPromise=null;
      }
    })();

    return this.refreshPromise;
  }

  async ensureFreshToken(){
    if(!this.session?.uid)return "";
    const refreshAheadMs=5*60*1000;
    if(
      this.session.refreshToken&&
      globalThis.navigator?.onLine!==false&&
      (!this.session.expiresAt||this.session.expiresAt-Date.now()<=refreshAheadMs)
    ){
      await this.refreshSession();
    }
    return String(this.session?.idToken||"");
  }

  async signOut(){
    this.persistSession(null);
    this.emit("signed_out",true);
    return this.status();
  }
}
