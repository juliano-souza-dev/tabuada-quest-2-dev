const clamp=(value,min,max)=>Math.min(max,Math.max(min,value));

const VERTEX_SHADER=`#version 300 es
precision highp float;
in vec2 aPosition;
out vec2 vUv;
void main(){
  vUv=aPosition*0.5+0.5;
  gl_Position=vec4(aPosition,0.0,1.0);
}
`;

const FRAGMENT_SHADER=`#version 300 es
precision highp float;

uniform sampler2D uTexture;
uniform vec2 uResolution;
uniform vec2 uCamera;
uniform vec2 uDirection;
uniform float uZoom;
uniform float uTime;
uniform float uTileSize;
uniform float uSpeed;
uniform float uSwell;
uniform float uBrightness;
uniform float uSaturation;
uniform float uContrast;
uniform vec3 uTint;
uniform float uDistortion;
uniform float uWaveFrequencyA;
uniform float uWaveFrequencyB;
uniform float uWaveMix;
uniform float uFoamMix;
uniform float uSparkleIntensity;
uniform float uSparkleSharpness;

in vec2 vUv;
out vec4 outColor;

vec3 saturateColor(vec3 color,float amount){
  float luma=dot(color,vec3(0.299,0.587,0.114));
  return mix(vec3(luma),color,amount);
}

void main(){
  vec2 centered=vec2(vUv.x-0.5,0.5-vUv.y);
  vec2 world=uCamera+centered*(uResolution/max(uZoom,0.001));
  float tile=max(uTileSize,64.0);
  vec2 base=world/tile;

  float motion=uTime*(0.025+uSpeed*0.0015);
  vec2 dir=normalize(uDirection+vec2(0.0001));

  float freqA=max(2.0,uWaveFrequencyA);
  float freqB=max(2.0,uWaveFrequencyB);
  float waveA=sin((base.y*freqA)+(base.x*(freqA*0.22))+uTime*(0.45+uSpeed*0.006));
  float waveB=cos((base.x*freqB)-(base.y*(freqB*0.46))+uTime*(0.34+uSpeed*0.004));
  float swell=(0.0015+uSwell*0.000045);
  float distortionStrength=(0.15+uDistortion*0.0125);
  vec2 distortion=vec2(waveA,waveB)*swell*distortionStrength;

  vec2 uvDeep=fract(base*1.00+dir*motion*0.35+distortion*0.45);
  vec2 uvWave=fract(base*1.38+dir.yx*motion*0.58+distortion);
  vec2 uvFoam=fract(base*2.15-dir*motion*0.83+distortion*1.55);

  vec3 deep=texture(uTexture,uvDeep).rgb;
  vec3 wave=texture(uTexture,uvWave).rgb;
  vec3 foam=texture(uTexture,uvFoam).rgb;

  float crest=smoothstep(0.40,0.95,0.5+0.5*sin(base.x*24.0+base.y*19.0+uTime*(0.8+uSpeed*0.008)));
  vec2 sparkleGrid=base*34.0;
  vec2 sparkleCell=floor(sparkleGrid);
  vec2 sparkleLocal=fract(sparkleGrid)-0.5;
  float sparkleHash=fract(sin(dot(sparkleCell,vec2(127.1,311.7)))*43758.5453123);
  float sparklePulse=0.5+0.5*sin(uTime*(1.4+sparkleHash*1.8)+sparkleHash*6.2831853);
  float sparkleCore=1.0-smoothstep(0.03,0.20,length(sparkleLocal));
  float sparkle=pow(max(0.0,sparkleCore*sparklePulse*crest),max(2.0,uSparkleSharpness*0.35))*step(0.84,sparkleHash);
  float waveAmount=clamp(uWaveMix*0.01,0.0,1.0);
  float foamAmount=clamp(uFoamMix*0.01,0.0,1.0);
  float sparkleAmount=clamp(uSparkleIntensity*0.01,0.0,1.0);

  vec3 color=deep;
  color=mix(color,wave,clamp(waveAmount*(0.72+crest*0.36),0.0,1.0));
  color=mix(color,foam,crest*foamAmount);
  color+=vec3(1.0,0.86,0.52)*sparkle*sparkleAmount*(0.45+uSwell*0.008);

  color*=uBrightness;
  color=saturateColor(color,uSaturation);
  color=(color-0.5)*uContrast+0.5;
  color*=uTint;
  outColor=vec4(clamp(color,0.0,1.0),1.0);
}
`;

const WAKE_VERTEX_SHADER=`#version 300 es
precision highp float;

in vec2 aWorld;
in float aAlpha;
in float aKind;
in float aAcross;

uniform vec2 uWakeResolution;
uniform vec2 uWakeCamera;
uniform float uWakeZoom;

out float vAlpha;
out float vKind;
out float vAcross;
out vec2 vWorld;

void main(){
  vec2 screen=(aWorld-uWakeCamera)*uWakeZoom+uWakeResolution*0.5;
  vec2 clip=vec2(
    screen.x/max(uWakeResolution.x,1.0)*2.0-1.0,
    1.0-screen.y/max(uWakeResolution.y,1.0)*2.0
  );
  gl_Position=vec4(clip,0.0,1.0);
  vAlpha=aAlpha;
  vKind=aKind;
  vAcross=aAcross;
  vWorld=aWorld;
}
`;

const WAKE_FRAGMENT_SHADER=`#version 300 es
precision highp float;

uniform float uWakeTime;
in float vAlpha;
in float vKind;
in float vAcross;
in vec2 vWorld;
out vec4 outColor;

float hash(vec2 p){
  return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453123);
}

void main(){
  float across=abs(vAcross);
  float edge=1.0-smoothstep(0.62,1.0,across);
  float n1=hash(floor(vWorld*0.075)+floor(uWakeTime*2.0));
  float n2=hash(floor(vWorld.yx*0.13)+vec2(floor(uWakeTime*3.0),0.0));
  float noise=mix(n1,n2,0.45);

  float rail=step(0.5,vKind);
  float foamMask=mix(
    edge*(0.42+noise*0.58),
    (0.62+edge*0.38)*(0.68+noise*0.32),
    rail
  );

  float alpha=vAlpha*foamMask;
  if(alpha<0.008)discard;

  vec3 centerColor=vec3(0.62,0.86,0.95);
  vec3 railColor=vec3(0.90,0.98,1.0);
  vec3 color=mix(centerColor,railColor,rail);
  color*=0.90+noise*0.18;

  outColor=vec4(color,alpha);
}
`;

function compileShader(gl,type,source){
  const shader=gl.createShader(type);
  gl.shaderSource(shader,source);
  gl.compileShader(shader);
  if(!gl.getShaderParameter(shader,gl.COMPILE_STATUS)){
    const message=gl.getShaderInfoLog(shader)||"shader compile failed";
    gl.deleteShader(shader);
    throw new Error(message);
  }
  return shader;
}

function createProgram(gl){
  const vertex=compileShader(gl,gl.VERTEX_SHADER,VERTEX_SHADER);
  const fragment=compileShader(gl,gl.FRAGMENT_SHADER,FRAGMENT_SHADER);
  const program=gl.createProgram();
  gl.attachShader(program,vertex);
  gl.attachShader(program,fragment);
  gl.linkProgram(program);
  gl.deleteShader(vertex);
  gl.deleteShader(fragment);
  if(!gl.getProgramParameter(program,gl.LINK_STATUS)){
    const message=gl.getProgramInfoLog(program)||"program link failed";
    gl.deleteProgram(program);
    throw new Error(message);
  }
  return program;
}

function createWakeProgram(gl){
  const vertex=compileShader(gl,gl.VERTEX_SHADER,WAKE_VERTEX_SHADER);
  const fragment=compileShader(gl,gl.FRAGMENT_SHADER,WAKE_FRAGMENT_SHADER);
  const program=gl.createProgram();
  gl.attachShader(program,vertex);
  gl.attachShader(program,fragment);
  gl.linkProgram(program);
  gl.deleteShader(vertex);
  gl.deleteShader(fragment);
  if(!gl.getProgramParameter(program,gl.LINK_STATUS)){
    const message=gl.getProgramInfoLog(program)||"wake program link failed";
    gl.deleteProgram(program);
    throw new Error(message);
  }
  return program;
}

export class OceanWebGLRenderer{
  constructor(canvas){
    this.canvas=canvas;
    this.gl=null;
    this.program=null;
    this.texture=null;
    this.buffer=null;
    this.wakeProgram=null;
    this.wakeBuffer=null;
    this.wakeCpuBuffer=new Float32Array(0);
    this.wakeFloatCount=0;
    this.wakeGpuCapacityBytes=0;
    this.wakeAttributes={};
    this.wakeUniforms={};
    this.wakeVertexCount=0;
    this.ready=false;
    this.failed=false;
    this.uniforms={};
    this.source="";
    this.textureLoaded=false;
    this.textureWidth=0;
    this.textureHeight=0;
    this.pixelRatio=1;
    this.cssWidth=0;
    this.cssHeight=0;
  }

  async init(source){
    if(this.failed)return false;
    if(!this.canvas)return false;

    try{
      const gl=this.canvas.getContext("webgl2",{
        alpha:false,
        antialias:false,
        depth:false,
        stencil:false,
        premultipliedAlpha:false,
        preserveDrawingBuffer:false,
        powerPreference:"high-performance"
      });
      if(!gl)throw new Error("WebGL2 unavailable");

      this.gl=gl;
      this.program=createProgram(gl);
      gl.useProgram(this.program);

      const position=gl.getAttribLocation(this.program,"aPosition");
      this.position=position;
      this.buffer=gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER,this.buffer);
      gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([
        -1,-1, 1,-1, -1,1,
        -1,1, 1,-1, 1,1
      ]),gl.STATIC_DRAW);
      gl.enableVertexAttribArray(position);
      gl.vertexAttribPointer(position,2,gl.FLOAT,false,0,0);

      for(const name of [
        "uTexture","uResolution","uCamera","uDirection","uZoom","uTime",
        "uTileSize","uSpeed","uSwell","uBrightness","uSaturation","uContrast","uTint",
        "uDistortion","uWaveFrequencyA","uWaveFrequencyB","uWaveMix",
        "uFoamMix","uSparkleIntensity","uSparkleSharpness"
      ]){
        this.uniforms[name]=gl.getUniformLocation(this.program,name);
      }

      this.texture=gl.createTexture();
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D,this.texture);
      gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.REPEAT);
      gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.REPEAT);
      gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR_MIPMAP_LINEAR);
      gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);

      await this.loadTexture(source);
      gl.uniform1i(this.uniforms.uTexture,0);

      this.wakeProgram=createWakeProgram(gl);
      this.wakeBuffer=gl.createBuffer();
      this.wakeAttributes={
        world:gl.getAttribLocation(this.wakeProgram,"aWorld"),
        alpha:gl.getAttribLocation(this.wakeProgram,"aAlpha"),
        kind:gl.getAttribLocation(this.wakeProgram,"aKind"),
        across:gl.getAttribLocation(this.wakeProgram,"aAcross")
      };
      this.wakeUniforms={
        resolution:gl.getUniformLocation(this.wakeProgram,"uWakeResolution"),
        camera:gl.getUniformLocation(this.wakeProgram,"uWakeCamera"),
        zoom:gl.getUniformLocation(this.wakeProgram,"uWakeZoom"),
        time:gl.getUniformLocation(this.wakeProgram,"uWakeTime")
      };

      this.ready=true;
      this.failed=false;
      return true;
    }catch(error){
      console.warn("[TabuadaQuest] WebGL ocean fallback:",error);
      this.failed=true;
      this.ready=false;
      return false;
    }
  }

  async loadTexture(source){
    const src=String(source||"");
    if(!src)throw new Error("Ocean texture missing");
    if(this.source===src&&this.textureLoaded)return;

    const gl=this.gl;
    if(src==="none"||src==="__none__"){
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D,this.texture);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,false);
      const water=new Uint8Array([8,117,167,255]);
      gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,1,1,0,gl.RGBA,gl.UNSIGNED_BYTE,water);
      gl.generateMipmap(gl.TEXTURE_2D);
      this.source="none";
      this.textureLoaded=true;
      this.textureWidth=1;
      this.textureHeight=1;
      return;
    }

    const image=new Image();
    image.decoding="async";
    const loaded=new Promise((resolve,reject)=>{
      image.onload=()=>resolve();
      image.onerror=()=>reject(new Error("Ocean texture failed: "+src));
    });
    image.src=src;
    await loaded;

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D,this.texture);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,true);
    gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,image);
    gl.generateMipmap(gl.TEXTURE_2D);
    this.source=src;
    this.textureLoaded=true;
    this.textureWidth=Math.max(1,Number(image.naturalWidth||image.width)||1);
    this.textureHeight=Math.max(1,Number(image.naturalHeight||image.height)||1);
    image.onload=null;
    image.onerror=null;
  }

  resize(width,height){
    if(!this.gl||!this.canvas)return;
    const rawDpr=Number(globalThis.devicePixelRatio)||1;
    const coarsePointer=Boolean(globalThis.matchMedia?.("(pointer: coarse)")?.matches);
    const mobileViewport=Math.min(Number(globalThis.innerWidth)||9999,Number(globalThis.innerHeight)||9999)<900;
    const maxDpr=(coarsePointer||mobileViewport)?1.5:2;
    const dpr=clamp(rawDpr,1,maxDpr);
    const w=Math.max(1,Math.round(Number(width)||1));
    const h=Math.max(1,Math.round(Number(height)||1));
    const pixelW=Math.max(1,Math.round(w*dpr));
    const pixelH=Math.max(1,Math.round(h*dpr));

    if(this.canvas.width!==pixelW||this.canvas.height!==pixelH){
      this.canvas.width=pixelW;
      this.canvas.height=pixelH;
    }
    if(this.cssWidth!==w){
      this.canvas.style.width=w+"px";
      this.cssWidth=w;
    }
    if(this.cssHeight!==h){
      this.canvas.style.height=h+"px";
      this.cssHeight=h;
    }
    this.pixelRatio=dpr;
    this.gl.viewport(0,0,pixelW,pixelH);
  }

  render({time=0,camera={x:0,y:0},zoom=1,ocean={},width=1,height=1,wake=null}={}){
    if(!this.ready||!this.gl||!this.program)return false;
    const gl=this.gl;
    this.resize(width,height);

    gl.useProgram(this.program);
    gl.bindBuffer(gl.ARRAY_BUFFER,this.buffer);
    gl.enableVertexAttribArray(this.position);
    gl.vertexAttribPointer(this.position,2,gl.FLOAT,false,0,0);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D,this.texture);

    const resolutionX=Math.max(1,Number(width)||1);
    const resolutionY=Math.max(1,Number(height)||1);
    const dirX=Number(ocean.directionX)||0;
    const dirY=Number(ocean.directionY)||0;

    gl.uniform2f(this.uniforms.uResolution,resolutionX,resolutionY);
    gl.uniform2f(this.uniforms.uCamera,Number(camera.x)||0,Number(camera.y)||0);
    gl.uniform2f(this.uniforms.uDirection,dirX,dirY);
    gl.uniform1f(this.uniforms.uZoom,Math.max(0.1,Number(zoom)||1));
    gl.uniform1f(this.uniforms.uTime,Math.max(0,Number(time)||0)/1000);
    gl.uniform1f(this.uniforms.uTileSize,Math.max(64,Number(ocean.tileSize)||720));
    gl.uniform1f(this.uniforms.uSpeed,clamp(Number(ocean.speed)||0,0,100));
    gl.uniform1f(this.uniforms.uSwell,clamp(Number(ocean.swell)||0,0,100));
    gl.uniform1f(this.uniforms.uBrightness,clamp(Number(ocean.brightness)||100,50,150)/100);
    gl.uniform1f(this.uniforms.uSaturation,clamp(Number(ocean.saturation)||100,0,180)/100);
    gl.uniform1f(this.uniforms.uContrast,clamp(Number(ocean.contrast)||100,50,150)/100);
    gl.uniform3f(
      this.uniforms.uTint,
      clamp(Number(ocean.tintR)||100,50,150)/100,
      clamp(Number(ocean.tintG)||100,50,150)/100,
      clamp(Number(ocean.tintB)||100,50,150)/100
    );
    gl.uniform1f(this.uniforms.uDistortion,clamp(Number(ocean.distortion)||0,0,100));
    gl.uniform1f(this.uniforms.uWaveFrequencyA,clamp(Number(ocean.waveFrequencyA)||18,2,60));
    gl.uniform1f(this.uniforms.uWaveFrequencyB,clamp(Number(ocean.waveFrequencyB)||15,2,60));
    gl.uniform1f(this.uniforms.uWaveMix,clamp(Number(ocean.waveMix)||0,0,100));
    gl.uniform1f(this.uniforms.uFoamMix,clamp(Number(ocean.foamMix)||0,0,100));
    gl.uniform1f(this.uniforms.uSparkleIntensity,clamp(Number(ocean.sparkleIntensity)||0,0,100));
    gl.uniform1f(this.uniforms.uSparkleSharpness,clamp(Number(ocean.sparkleSharpness)||18,2,48));

    gl.drawArrays(gl.TRIANGLES,0,6);
    this.renderWake({time,camera,zoom,width:resolutionX,height:resolutionY,wake});
    return true;
  }

  ensureWakeCpuCapacity(floatCount){
    const required=Math.max(0,Math.floor(Number(floatCount)||0));
    if(this.wakeCpuBuffer.length>=required)return;
    let capacity=Math.max(256,this.wakeCpuBuffer.length||0);
    while(capacity<required)capacity*=2;
    this.wakeCpuBuffer=new Float32Array(capacity);
  }

  buildWakeVertices(wake,timeMs){
    const samples=Array.isArray(wake?.samples)?wake.samples:[];
    this.wakeFloatCount=0;
    if(samples.length<2||wake?.active===false)return this.wakeCpuBuffer;

    const maxVertices=(samples.length-1)*6*3;
    this.ensureWakeCpuCapacity(maxVertices*5);

    const width=Math.max(18,Number(wake?.width)||64);
    const opacity=clamp(Number(wake?.opacity??.72),0,1);
    const lifetime=Math.max(600,Number(wake?.lifetime)||2600);
    const now=Math.max(0,Number(timeMs)||0);
    let cursor=0;

    const pushVertex=(x,y,alpha,kind,across)=>{
      const out=this.wakeCpuBuffer;
      out[cursor++]=x;
      out[cursor++]=y;
      out[cursor++]=alpha;
      out[cursor++]=kind;
      out[cursor++]=across;
    };

    const section=(sample,index,kind,side)=>{
      const count=Math.max(2,samples.length);
      const pathAge=1-index/(count-1);
      const timeAge=clamp((now-Number(sample.time||now))/lifetime,0,1);
      const age=clamp(Math.max(pathAge*.72,timeAge),0,1);
      const life=Math.pow(Math.max(0,1-age),1.08);
      const speedFactor=clamp(Number(sample.speedFactor)||.4,.15,1);
      const spread=width*(.58+age*.92);
      const rad=Number(sample.heading||0)*Math.PI/180;
      const rightX=Math.cos(rad);
      const rightY=Math.sin(rad);
      const railCenter=side*spread*.31;
      const halfWidth=kind>0.5
        ?Math.max(2.6,spread*(.050+age*.028))
        :Math.max(6,spread*(.19+age*.13));
      const offset=kind>0.5?railCenter:0;
      const cx=Number(sample.x||0)+rightX*offset;
      const cy=Number(sample.y||0)+rightY*offset;
      const alpha=opacity*life*speedFactor*(kind>0.5?.98:.34);
      return {
        left:{x:cx-rightX*halfWidth,y:cy-rightY*halfWidth},
        right:{x:cx+rightX*halfWidth,y:cy+rightY*halfWidth},
        alpha
      };
    };

    const appendStrip=(kind,side)=>{
      for(let i=0;i<samples.length-1;i++){
        const a=section(samples[i],i,kind,side);
        const b=section(samples[i+1],i+1,kind,side);
        if(a.alpha<=.002&&b.alpha<=.002)continue;
        pushVertex(a.left.x,a.left.y,a.alpha,kind,-1);
        pushVertex(a.right.x,a.right.y,a.alpha,kind,1);
        pushVertex(b.left.x,b.left.y,b.alpha,kind,-1);
        pushVertex(b.left.x,b.left.y,b.alpha,kind,-1);
        pushVertex(a.right.x,a.right.y,a.alpha,kind,1);
        pushVertex(b.right.x,b.right.y,b.alpha,kind,1);
      }
    };

    appendStrip(0,0);
    appendStrip(1,-1);
    appendStrip(1,1);
    this.wakeFloatCount=cursor;
    return this.wakeCpuBuffer;
  }

  renderWake({time=0,camera={x:0,y:0},zoom=1,width=1,height=1,wake=null}={}){
    const gl=this.gl;
    if(!gl||!this.wakeProgram||!this.wakeBuffer)return false;
    const data=this.buildWakeVertices(wake,time);
    this.wakeVertexCount=Math.floor(this.wakeFloatCount/5);
    if(!this.wakeVertexCount)return false;

    gl.useProgram(this.wakeProgram);
    gl.bindBuffer(gl.ARRAY_BUFFER,this.wakeBuffer);
    const uploadBytes=this.wakeFloatCount*Float32Array.BYTES_PER_ELEMENT;
    if(this.wakeGpuCapacityBytes<uploadBytes){
      let capacity=Math.max(1024,this.wakeGpuCapacityBytes||0);
      while(capacity<uploadBytes)capacity*=2;
      gl.bufferData(gl.ARRAY_BUFFER,capacity,gl.DYNAMIC_DRAW);
      this.wakeGpuCapacityBytes=capacity;
    }
    gl.bufferSubData(gl.ARRAY_BUFFER,0,data,0,this.wakeFloatCount);

    const stride=5*4;
    const attrs=this.wakeAttributes;
    gl.enableVertexAttribArray(attrs.world);
    gl.vertexAttribPointer(attrs.world,2,gl.FLOAT,false,stride,0);
    gl.enableVertexAttribArray(attrs.alpha);
    gl.vertexAttribPointer(attrs.alpha,1,gl.FLOAT,false,stride,2*4);
    gl.enableVertexAttribArray(attrs.kind);
    gl.vertexAttribPointer(attrs.kind,1,gl.FLOAT,false,stride,3*4);
    gl.enableVertexAttribArray(attrs.across);
    gl.vertexAttribPointer(attrs.across,1,gl.FLOAT,false,stride,4*4);

    gl.uniform2f(this.wakeUniforms.resolution,Math.max(1,width),Math.max(1,height));
    gl.uniform2f(this.wakeUniforms.camera,Number(camera.x)||0,Number(camera.y)||0);
    gl.uniform1f(this.wakeUniforms.zoom,Math.max(.1,Number(zoom)||1));
    gl.uniform1f(this.wakeUniforms.time,Math.max(0,Number(time)||0)/1000);

    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA);
    gl.drawArrays(gl.TRIANGLES,0,this.wakeVertexCount);
    gl.disable(gl.BLEND);
    return true;
  }

  getDiagnostics(){
    const width=Math.max(0,Number(this.textureWidth)||0);
    const height=Math.max(0,Number(this.textureHeight)||0);
    const baseBytes=width*height*4;
    const mipmappedBytes=this.textureLoaded?Math.round(baseBytes*4/3):0;
    return {
      renderer:"webgl2",
      ready:this.ready,
      source:this.source,
      pixelRatio:this.pixelRatio,
      canvasWidth:Number(this.canvas?.width)||0,
      canvasHeight:Number(this.canvas?.height)||0,
      textureWidth:width,
      textureHeight:height,
      estimatedTextureBytes:mipmappedBytes,
      drawCallsPerFrame:this.ready?(this.wakeVertexCount?2:1):0,
      wakeVertices:this.wakeVertexCount
    };
  }

  destroy(){
    const gl=this.gl;
    if(gl){
      if(this.texture)gl.deleteTexture(this.texture);
      if(this.buffer)gl.deleteBuffer(this.buffer);
      if(this.wakeBuffer)gl.deleteBuffer(this.wakeBuffer);
      if(this.program)gl.deleteProgram(this.program);
      if(this.wakeProgram)gl.deleteProgram(this.wakeProgram);
    }
    this.ready=false;
    this.textureLoaded=false;
    this.gl=null;
    this.program=null;
    this.wakeProgram=null;
    this.texture=null;
    this.buffer=null;
    this.wakeBuffer=null;
    this.wakeCpuBuffer=new Float32Array(0);
    this.wakeFloatCount=0;
    this.wakeGpuCapacityBytes=0;
    this.wakeVertexCount=0;
    this.textureWidth=0;
    this.textureHeight=0;
  }
}
