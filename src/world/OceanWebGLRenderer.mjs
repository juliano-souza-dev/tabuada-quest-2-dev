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

  float waveA=sin((base.y*18.0)+(base.x*4.0)+uTime*(0.45+uSpeed*0.006));
  float waveB=cos((base.x*15.0)-(base.y*7.0)+uTime*(0.34+uSpeed*0.004));
  float swell=(0.0025+uSwell*0.000055);
  vec2 distortion=vec2(waveA,waveB)*swell;

  vec2 uvDeep=fract(base*1.00+dir*motion*0.35+distortion*0.45);
  vec2 uvWave=fract(base*1.38+dir.yx*motion*0.58+distortion);
  vec2 uvFoam=fract(base*2.15-dir*motion*0.83+distortion*1.55);

  vec3 deep=texture(uTexture,uvDeep).rgb;
  vec3 wave=texture(uTexture,uvWave).rgb;
  vec3 foam=texture(uTexture,uvFoam).rgb;

  float crest=smoothstep(0.40,0.95,0.5+0.5*sin(base.x*24.0+base.y*19.0+uTime*(0.8+uSpeed*0.008)));
  float sparkle=pow(max(0.0,sin((base.x-base.y)*58.0+uTime*2.1)),18.0)*0.11;

  vec3 color=deep;
  color=mix(color,wave,0.22+crest*0.12);
  color=mix(color,foam,crest*(0.07+uSwell*0.0012));
  color+=vec3(1.0,0.86,0.52)*sparkle*(0.35+uSwell*0.012);

  color*=uBrightness;
  color=saturateColor(color,uSaturation);
  outColor=vec4(color,1.0);
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

export class OceanWebGLRenderer{
  constructor(canvas){
    this.canvas=canvas;
    this.gl=null;
    this.program=null;
    this.texture=null;
    this.ready=false;
    this.failed=false;
    this.uniforms={};
    this.image=null;
    this.source="";
    this.pixelRatio=1;
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
      const buffer=gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER,buffer);
      gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([
        -1,-1, 1,-1, -1,1,
        -1,1, 1,-1, 1,1
      ]),gl.STATIC_DRAW);
      gl.enableVertexAttribArray(position);
      gl.vertexAttribPointer(position,2,gl.FLOAT,false,0,0);

      for(const name of [
        "uTexture","uResolution","uCamera","uDirection","uZoom","uTime",
        "uTileSize","uSpeed","uSwell","uBrightness","uSaturation"
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
    if(this.source===src&&this.image)return;

    const image=new Image();
    image.decoding="async";
    const loaded=new Promise((resolve,reject)=>{
      image.onload=()=>resolve();
      image.onerror=()=>reject(new Error("Ocean texture failed: "+src));
    });
    image.src=src;
    await loaded;

    const gl=this.gl;
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D,this.texture);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,true);
    gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,image);
    gl.generateMipmap(gl.TEXTURE_2D);
    this.image=image;
    this.source=src;
  }

  resize(width,height){
    if(!this.gl||!this.canvas)return;
    const dpr=clamp(Number(globalThis.devicePixelRatio)||1,1,2);
    const w=Math.max(1,Math.round(Number(width)||1));
    const h=Math.max(1,Math.round(Number(height)||1));
    const pixelW=Math.max(1,Math.round(w*dpr));
    const pixelH=Math.max(1,Math.round(h*dpr));

    if(this.canvas.width!==pixelW||this.canvas.height!==pixelH){
      this.canvas.width=pixelW;
      this.canvas.height=pixelH;
    }
    this.canvas.style.width=w+"px";
    this.canvas.style.height=h+"px";
    this.pixelRatio=dpr;
    this.gl.viewport(0,0,pixelW,pixelH);
  }

  render({time=0,camera={x:0,y:0},zoom=1,ocean={},width=1,height=1}={}){
    if(!this.ready||!this.gl||!this.program)return false;
    const gl=this.gl;
    this.resize(width,height);

    gl.useProgram(this.program);
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

    gl.drawArrays(gl.TRIANGLES,0,6);
    return true;
  }

  destroy(){
    const gl=this.gl;
    if(gl){
      if(this.texture)gl.deleteTexture(this.texture);
      if(this.program)gl.deleteProgram(this.program);
    }
    this.ready=false;
    this.gl=null;
    this.program=null;
    this.texture=null;
    this.image=null;
  }
}
