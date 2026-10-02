const clamp=(value,min,max)=>Math.min(max,Math.max(min,value));
const smoothstep=(edge0,edge1,value)=>{
  const t=clamp((value-edge0)/Math.max(.000001,edge1-edge0),0,1);
  return t*t*(3-2*t);
};

const VERTEX=`#version 300 es
precision highp float;
in vec2 aClip;
uniform float uPointSize;
void main(){
  gl_Position=vec4(aClip,0.0,1.0);
  gl_PointSize=uPointSize;
}
`;

const FRAGMENT=`#version 300 es
precision highp float;
uniform float uPulse;
uniform float uEffectType;
uniform float uProgress;
uniform float uUseTexture;
uniform sampler2D uProjectileTexture;
out vec4 outColor;
void main(){
  vec2 p=gl_PointCoord-vec2(.5);
  float d=length(p);
  if(uUseTexture>.5){
    vec4 tex=texture(uProjectileTexture,vec2(gl_PointCoord.x,1.0-gl_PointCoord.y));
    if(tex.a<.02)discard;
    float glow=1.0-smoothstep(.18,.5,d);
    outColor=vec4(tex.rgb*(1.0+glow*(.18+uPulse*.12)),tex.a);
    return;
  }
  if(d>.5)discard;

  if(uEffectType<.5){
    float core=1.0-smoothstep(.08,.22,d);
    float halo=1.0-smoothstep(.16,.50,d);
    vec3 hot=vec3(1.0,.95,.72);
    vec3 fire=vec3(1.0,.33,.06);
    vec3 color=mix(fire,hot,core);
    float alpha=clamp(core+halo*.72,0.0,1.0)*(0.88+uPulse*.12);
    outColor=vec4(color,alpha);
    return;
  }

  float progress=clamp(uProgress,0.0,1.0);

  if(uEffectType<1.5){
    float radius=mix(.06,.44,progress);
    float ring=1.0-smoothstep(.018,.085,abs(d-radius));
    float core=(1.0-smoothstep(.02,.24,d))*(1.0-progress);
    float sparks=pow(max(0.0,sin((atan(p.y,p.x)*11.0)+(progress*24.0))),10.0);
    sparks*=1.0-smoothstep(.12,.48,d);
    vec3 hot=vec3(1.0,.96,.72);
    vec3 orange=vec3(1.0,.28,.035);
    vec3 color=mix(orange,hot,clamp(core+ring*.55,0.0,1.0));
    float alpha=(ring*.92+core+sparks*.32)*(1.0-progress);
    if(alpha<.01)discard;
    outColor=vec4(color,clamp(alpha,0.0,1.0));
    return;
  }

  if(uEffectType<2.5){
    vec2 flameP=vec2(p.x*1.08,p.y*.78+.08);
    float body=1.0-smoothstep(.10,.46,length(flameP));
    float inner=1.0-smoothstep(.03,.23,length(vec2(flameP.x*1.15,flameP.y+.09)));
    float tongue=.5+.5*sin((p.x*17.0)+(p.y*11.0)+(uPulse*6.2831));
    body*=.72+.28*tongue;
    vec3 orange=vec3(1.0,.18,.015);
    vec3 yellow=vec3(1.0,.92,.42);
    vec3 color=mix(orange,yellow,inner);
    float alpha=clamp(body*.86+inner*.72,0.0,1.0);
    if(alpha<.015)discard;
    outColor=vec4(color,alpha);
    return;
  }

  if(uEffectType<3.5){
    float cloud=1.0-smoothstep(.16,.49,d);
    float lobes=.62+.38*sin(p.x*20.0+p.y*13.0+uPulse*4.0);
    float fade=1.0-progress*.68;
    vec3 smoke=mix(vec3(.045,.052,.060),vec3(.23,.24,.25),progress*.58);
    float alpha=cloud*(.26+.20*lobes)*fade;
    if(alpha<.01)discard;
    outColor=vec4(smoke,alpha);
    return;
  }

  if(uEffectType<4.5){
    float core=1.0-smoothstep(.04,.18,d);
    float halo=1.0-smoothstep(.10,.50,d);
    float fade=1.0-smoothstep(.0,1.0,progress);
    vec3 violet=vec3(.56,.08,1.0);
    vec3 hot=vec3(.94,.58,1.0);
    vec3 color=mix(violet,hot,core);
    float alpha=(core*.82+halo*.42)*fade;
    if(alpha<.01)discard;
    outColor=vec4(color,alpha);
    return;
  }

  float flash=(1.0-smoothstep(.0,.18,progress))*(1.0-smoothstep(.02,.34,d));
  float radius=mix(.05,.47,smoothstep(.04,.86,progress));
  float ring=1.0-smoothstep(.016,.07,abs(d-radius));
  float rays=pow(max(0.0,sin(atan(p.y,p.x)*13.0+progress*31.0)),12.0);
  rays*=1.0-smoothstep(.08,.49,d);
  float fade=1.0-smoothstep(.48,1.0,progress);
  vec3 orange=vec3(1.0,.16,.01);
  vec3 hot=vec3(1.0,.98,.76);
  vec3 color=mix(orange,hot,clamp(flash+ring*.62,0.0,1.0));
  float alpha=clamp(flash+ring*.92*fade+rays*.46*fade,0.0,1.0);
  if(alpha<.01)discard;
  outColor=vec4(color,alpha);
}
`;

function compile(gl,type,source){
  const shader=gl.createShader(type);
  gl.shaderSource(shader,source);
  gl.compileShader(shader);
  if(!gl.getShaderParameter(shader,gl.COMPILE_STATUS)){
    const message=gl.getShaderInfoLog(shader)||"Naval combat shader compile failed";
    gl.deleteShader(shader);
    throw new Error(message);
  }
  return shader;
}

export class NavalCombatWebGLRenderer{
  constructor(canvas){
    this.canvas=canvas;
    this.gl=null;
    this.program=null;
    this.buffer=null;
    this.position=-1;
    this.uniforms={};
    this.shots=[];
    this.impacts=[];
    this.destructions=[];
    this.ready=false;
    this.failed=false;
    this.pixelRatio=1;
    this.maxPointSize=256;
    this.cssWidth=0;
    this.cssHeight=0;
    this.projectileTextures=new Map();
  }

  init(){
    if(this.ready)return true;
    if(this.failed||!this.canvas)return false;
    try{
      const gl=this.canvas.getContext("webgl2",{
        alpha:true,
        antialias:true,
        depth:false,
        stencil:false,
        premultipliedAlpha:false,
        preserveDrawingBuffer:false,
        powerPreference:"high-performance"
      });
      if(!gl)throw new Error("WebGL2 unavailable");
      this.gl=gl;
      const vertex=compile(gl,gl.VERTEX_SHADER,VERTEX);
      const fragment=compile(gl,gl.FRAGMENT_SHADER,FRAGMENT);
      const program=gl.createProgram();
      gl.attachShader(program,vertex);
      gl.attachShader(program,fragment);
      gl.linkProgram(program);
      gl.deleteShader(vertex);
      gl.deleteShader(fragment);
      if(!gl.getProgramParameter(program,gl.LINK_STATUS)){
        throw new Error(gl.getProgramInfoLog(program)||"Naval combat shader link failed");
      }
      this.program=program;
      this.position=gl.getAttribLocation(program,"aClip");
      this.uniforms.pointSize=gl.getUniformLocation(program,"uPointSize");
      this.uniforms.pulse=gl.getUniformLocation(program,"uPulse");
      this.uniforms.effectType=gl.getUniformLocation(program,"uEffectType");
      this.uniforms.progress=gl.getUniformLocation(program,"uProgress");
      this.uniforms.useTexture=gl.getUniformLocation(program,"uUseTexture");
      this.uniforms.projectileTexture=gl.getUniformLocation(program,"uProjectileTexture");
      this.buffer=gl.createBuffer();
      const pointRange=gl.getParameter(gl.ALIASED_POINT_SIZE_RANGE);
      this.maxPointSize=Math.max(16,Number(pointRange?.[1])||256);
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.SRC_ALPHA,gl.ONE);
      gl.disable(gl.DEPTH_TEST);
      gl.clearColor(0,0,0,0);
      this.ready=true;
      return true;
    }catch(error){
      this.failed=true;
      console.warn("[TabuadaQuest] Naval combat WebGL unavailable:",error);
      return false;
    }
  }

  resize(width,height){
    if(!this.gl)return;
    const dpr=clamp(Number(globalThis.devicePixelRatio)||1,1,2);
    const cssWidth=Math.max(1,Number(width)||1);
    const cssHeight=Math.max(1,Number(height)||1);
    const pixelWidth=Math.max(1,Math.round(cssWidth*dpr));
    const pixelHeight=Math.max(1,Math.round(cssHeight*dpr));
    if(this.canvas.width!==pixelWidth)this.canvas.width=pixelWidth;
    if(this.canvas.height!==pixelHeight)this.canvas.height=pixelHeight;
    if(this.cssWidth!==cssWidth){
      this.canvas.style.width=cssWidth+"px";
      this.cssWidth=cssWidth;
    }
    if(this.cssHeight!==cssHeight){
      this.canvas.style.height=cssHeight+"px";
      this.cssHeight=cssHeight;
    }
    this.pixelRatio=dpr;
    this.gl.viewport(0,0,pixelWidth,pixelHeight);
  }

  loadProjectileTexture(id,src){
    const key=String(id||src||"");
    if(!key||!src||this.projectileTextures.has(key))return;
    const entry={texture:null,ready:false};
    this.projectileTextures.set(key,entry);
    const image=new Image();
    image.decoding="async";
    image.onload=()=>{
      if(!this.gl)return;
      const gl=this.gl,texture=gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D,texture);
      gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL,false);
      gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
      gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,image);
      entry.texture=texture;entry.ready=true;
    };
    image.onerror=()=>console.warn("[TabuadaQuest] Projectile texture failed:",src);
    image.src=src;
  }

  fire({from,to,duration=620,startTime=performance.now(),onImpact=null,ammo=null}={}){
    if(!this.init())return false;
    if(!from||!to)return false;
    this.shots.push({
      from:{x:Number(from.x)||0,y:Number(from.y)||0},
      to:{x:Number(to.x)||0,y:Number(to.y)||0},
      duration:clamp(Number(duration)||620,220,1600),
      startTime:Number(startTime)||performance.now(),
      impactSpawned:false,
      ammo:ammo&&typeof ammo==="object"?ammo:null,
      onImpact:typeof onImpact==="function"?onImpact:null
    });
    const textureSrc=ammo?.effects?.texture;
    if(textureSrc)this.loadProjectileTexture(ammo?.id,textureSrc);
    if(this.shots.length>24)this.shots.splice(0,this.shots.length-24);
    return true;
  }

  destroyShip({at,size=180,duration=1100,startTime=performance.now()}={}){
    if(!this.init()||!at)return false;
    this.destructions.push({
      x:Number(at.x)||0,
      y:Number(at.y)||0,
      size:clamp(Number(size)||180,48,1400),
      duration:clamp(Number(duration)||1100,600,2200),
      startTime:Number(startTime)||performance.now()
    });
    if(this.destructions.length>16)this.destructions.splice(0,this.destructions.length-16);
    return true;
  }

  render({time=performance.now(),camera={x:0,y:0},zoom=1,width=1,height=1,damagedShips=[]}={}){
    if(!this.init()||!this.gl)return false;
    this.resize(width,height);
    const gl=this.gl;
    gl.clear(gl.COLOR_BUFFER_BIT);

    const now=Number(time)||performance.now();

    for(const shot of this.shots){
      const elapsed=now-shot.startTime;
      if(elapsed>=shot.duration&&!shot.impactSpawned){
        shot.impactSpawned=true;
        const piercing=String(shot.ammo?.effects?.impact||"")==="piercing-shrapnel-webgl";
        this.impacts.push({
          x:shot.to.x,
          y:shot.to.y,
          startTime:shot.startTime+shot.duration,
          duration:piercing?680:460,
          effect:piercing?"piercing-shrapnel":"standard",
          seed:Math.abs(Math.sin(shot.to.x*.017+shot.to.y*.031+shot.startTime*.0001))
        });
        try{shot.onImpact?.()}catch(error){
          console.warn("[TabuadaQuest] Naval impact callback failed:",error);
        }
      }
    }
    this.shots=this.shots.filter(shot=>now-shot.startTime<=shot.duration);
    this.impacts=this.impacts.filter(impact=>now-impact.startTime<=impact.duration);
    this.destructions=this.destructions.filter(effect=>now-effect.startTime<=effect.duration);
    const visibleDamage=Array.isArray(damagedShips)
      ?damagedShips.filter(ship=>Number(ship?.damageRatio)>=.5&&Number(ship?.damageRatio)<1)
      :[];
    if(!this.shots.length&&!this.impacts.length&&!this.destructions.length&&!visibleDamage.length)return true;

    gl.useProgram(this.program);
    gl.bindBuffer(gl.ARRAY_BUFFER,this.buffer);
    gl.enableVertexAttribArray(this.position);
    gl.vertexAttribPointer(this.position,2,gl.FLOAT,false,0,0);
    gl.uniform1f(this.uniforms.pulse,.5+.5*Math.sin(now*.018));

    const toClip=(x,y)=>{
      const screenX=(x-(Number(camera.x)||0))*(Number(zoom)||1)+width*.5;
      const screenY=(y-(Number(camera.y)||0))*(Number(zoom)||1)+height*.5;
      return [
        screenX/Math.max(1,width)*2-1,
        1-screenY/Math.max(1,height)*2
      ];
    };

    const drawPoint=(x,y,size,effectType,progress=0,additive=true)=>{
      const point=toClip(x,y);
      gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(point),gl.DYNAMIC_DRAW);
      gl.uniform1f(this.uniforms.pointSize,Math.min(this.maxPointSize,Math.max(2,size)*this.pixelRatio));
      gl.uniform1f(this.uniforms.effectType,effectType);
      gl.uniform1f(this.uniforms.progress,clamp(progress,0,1));
      gl.uniform1f(this.uniforms.useTexture,0);
      gl.blendFunc(gl.SRC_ALPHA,additive?gl.ONE:gl.ONE_MINUS_SRC_ALPHA);
      gl.drawArrays(gl.POINTS,0,1);
    };

    if(this.shots.length){
      for(const shot of this.shots){
        const t=clamp((now-shot.startTime)/shot.duration,0,1);
        const eased=1-Math.pow(1-t,2);
        const x=shot.from.x+(shot.to.x-shot.from.x)*eased;
        const y=shot.from.y+(shot.to.y-shot.from.y)*eased;
        const isPurpleHalloween=String(shot.ammo?.id||"")==="cannonball-halloween-purple"||String(shot.ammo?.effects?.projectile||"")==="halloween-purple-webgl";
        if(isPurpleHalloween){
          const trailSteps=9;
          for(let step=trailSteps;step>=1;step--){
            const trailT=clamp(t-step*.035,0,1);
            if(trailT>=t)continue;
            const trailEased=1-Math.pow(1-trailT,2);
            const trailX=shot.from.x+(shot.to.x-shot.from.x)*trailEased;
            const trailY=shot.from.y+(shot.to.y-shot.from.y)*trailEased;
            drawPoint(trailX,trailY,clamp(22-step*1.25,7,22),4,step/trailSteps,true);
          }
        }
        const point=toClip(x,y);
        const textureEntry=this.projectileTextures.get(String(shot.ammo?.id||""));
        const textured=textureEntry?.ready&&textureEntry.texture;
        gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(point),gl.DYNAMIC_DRAW);
        gl.uniform1f(this.uniforms.pointSize,(textured?clamp(32*Number(shot.ammo?.size||1),18,96):18)*this.pixelRatio);
        gl.uniform1f(this.uniforms.effectType,0);
        gl.uniform1f(this.uniforms.progress,0);
        gl.uniform1f(this.uniforms.useTexture,textured?1:0);
        if(textured){
          gl.activeTexture(gl.TEXTURE0);
          gl.bindTexture(gl.TEXTURE_2D,textureEntry.texture);
          gl.uniform1i(this.uniforms.projectileTexture,0);
          gl.blendFunc(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA);
        }else gl.blendFunc(gl.SRC_ALPHA,gl.ONE);
        gl.drawArrays(gl.POINTS,0,1);
      }
      gl.uniform1f(this.uniforms.useTexture,0);
    }

    for(const impact of this.impacts){
      const progress=clamp((now-impact.startTime)/impact.duration,0,1);
      if(impact.effect==="piercing-shrapnel"){
        const burst=clamp(progress/.42,0,1);
        const fade=1-smoothstep(.34,1,progress);
        drawPoint(impact.x,impact.y,(34+burst*92)*fade,5,progress,true);
        const shardCount=14;
        for(let i=0;i<shardCount;i++){
          const hash=Math.sin((i+1)*91.733+(impact.seed||0)*731.17)*43758.5453;
          const jitter=hash-Math.floor(hash);
          const angle=(i/shardCount)*Math.PI*2+(jitter-.5)*.42;
          const speed=.72+jitter*.72;
          const travel=(18+92*speed)*Math.sin(Math.min(1,progress)*Math.PI*.72)*Math.pow(progress,.68);
          const sx=impact.x+Math.cos(angle)*travel;
          const sy=impact.y+Math.sin(angle)*travel+progress*progress*28;
          const shardFade=clamp(1-progress,0,1);
          drawPoint(sx,sy,(8+jitter*9)*shardFade,5,clamp(progress+jitter*.12,0,1),true);
          if(i%3===0){
            const sparkTravel=travel*1.28;
            drawPoint(
              impact.x+Math.cos(angle+.11)*sparkTravel,
              impact.y+Math.sin(angle+.11)*sparkTravel+progress*progress*20,
              (4+jitter*5)*shardFade,
              0,
              progress,
              true
            );
          }
        }
      }else{
        const point=toClip(impact.x,impact.y);
        gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(point),gl.DYNAMIC_DRAW);
        gl.uniform1f(this.uniforms.pointSize,(42+progress*54)*this.pixelRatio);
        gl.uniform1f(this.uniforms.effectType,1);
        gl.uniform1f(this.uniforms.progress,progress);
        gl.uniform1f(this.uniforms.useTexture,0);
        gl.blendFunc(gl.SRC_ALPHA,gl.ONE);
        gl.drawArrays(gl.POINTS,0,1);
      }
    }

    for(const ship of visibleDamage){
      const damageRatio=clamp(Number(ship.damageRatio)||0,.5,.999);
      const intensity=clamp(.35+(damageRatio-.5)*1.3,.35,1);
      const worldSize=clamp(Number(ship.size)||180,48,1400);
      const screenSize=clamp(worldSize*(Number(zoom)||1),32,360);
      const phase=now*.0018+(Number(ship.x)||0)*.003+(Number(ship.y)||0)*.002;
      const sway=Math.sin(phase*2.7);
      const flameCycle=(phase%1+1)%1;
      const smokeCycle=((phase*.43)%1+1)%1;
      const x=Number(ship.x)||0;
      const y=Number(ship.y)||0;

      drawPoint(
        x+worldSize*.045*sway,
        y-worldSize*.055,
        screenSize*(.25+.12*intensity),
        2,
        flameCycle,
        true
      );
      drawPoint(
        x-worldSize*.055*(.55+sway*.25),
        y-worldSize*.015,
        screenSize*(.17+.08*intensity),
        2,
        (flameCycle+.37)%1,
        true
      );
      drawPoint(
        x+worldSize*.025*Math.sin(phase),
        y-worldSize*(.09+.12*smokeCycle),
        screenSize*(.34+.28*smokeCycle)*(.72+.28*intensity),
        3,
        smokeCycle,
        false
      );
      drawPoint(
        x-worldSize*.035*Math.cos(phase*.8),
        y-worldSize*(.06+.10*((smokeCycle+.48)%1)),
        screenSize*(.25+.22*((smokeCycle+.48)%1)),
        3,
        (smokeCycle+.48)%1,
        false
      );
    }

    for(const effect of this.destructions){
      const progress=clamp((now-effect.startTime)/effect.duration,0,1);
      const screenSize=clamp(effect.size*(Number(zoom)||1),42,520);
      drawPoint(
        effect.x,
        effect.y,
        screenSize*(.72+progress*.78),
        4,
        progress,
        true
      );
      if(progress>.14){
        const smokeProgress=clamp((progress-.14)/.86,0,1);
        drawPoint(
          effect.x,
          effect.y-effect.size*.17*smokeProgress,
          screenSize*(.42+smokeProgress*.72),
          3,
          smokeProgress,
          false
        );
      }
    }
    return true;
  }

  clear(){
    this.shots.length=0;
    this.impacts.length=0;
    this.destructions.length=0;
    if(this.gl)this.gl.clear(this.gl.COLOR_BUFFER_BIT);
  }

  destroy(){
    if(this.gl){
      if(this.buffer)this.gl.deleteBuffer(this.buffer);
      for(const entry of this.projectileTextures.values())if(entry.texture)this.gl.deleteTexture(entry.texture);
      this.projectileTextures.clear();
      if(this.program)this.gl.deleteProgram(this.program);
    }
    this.shots.length=0;
    this.impacts.length=0;
    this.destructions.length=0;
    this.gl=null;
    this.ready=false;
  }
}
