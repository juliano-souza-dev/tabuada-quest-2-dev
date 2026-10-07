const clamp=(value,min,max)=>Math.min(max,Math.max(min,Number(value)||0));

function compile(gl,type,source){
  const shader=gl.createShader(type);
  gl.shaderSource(shader,source);
  gl.compileShader(shader);
  if(!gl.getShaderParameter(shader,gl.COMPILE_STATUS)){
    const message=gl.getShaderInfoLog(shader)||"Monster presence shader compile failed";
    gl.deleteShader(shader);
    throw new Error(message);
  }
  return shader;
}

export class MonsterPresenceWebGLRenderer{
  constructor(canvas){
    this.canvas=canvas;
    this.gl=null;
    this.program=null;
    this.buffer=null;
    this.position=-1;
    this.uniforms={};
    this.failed=false;
    this.lastFrameAt=0;
  }

  setup(){
    if(this.gl||this.failed)return Boolean(this.gl);
    try{
      const gl=this.canvas.getContext("webgl",{
        alpha:true,
        antialias:true,
        premultipliedAlpha:false,
        powerPreference:"high-performance"
      });
      if(!gl)throw new Error("WebGL indisponível para presença do monstro");

      const vertex=compile(gl,gl.VERTEX_SHADER,[
        "attribute vec2 a_position;",
        "varying vec2 v_uv;",
        "void main(){",
        "  v_uv=a_position*.5+.5;",
        "  gl_Position=vec4(a_position,0.0,1.0);",
        "}"
      ].join("\n"));

      const fragment=compile(gl,gl.FRAGMENT_SHADER,[
        "precision mediump float;",
        "varying vec2 v_uv;",
        "uniform float u_time;",
        "uniform float u_aspect;",
        "uniform float u_seed;",
        "uniform float u_target;",
        "uniform float u_intensity;",
        "float ring(float d,float radius,float width){",
        "  return 1.0-smoothstep(width,width*2.2,abs(d-radius));",
        "}",
        "void main(){",
        "  vec2 p=v_uv*2.0-1.0;",
        "  p.x*=u_aspect;",
        "  vec2 water=vec2(p.x*.78,(p.y+.47)*1.70);",
        "  float d=length(water);",
        "  float pulse=fract(u_time*.17+u_seed);",
        "  float pulse2=fract(pulse+.52);",
        "  float r1=ring(d,.36+pulse*.35,.010)*(1.0-pulse);",
        "  float r2=ring(d,.34+pulse2*.40,.008)*(1.0-pulse2)*.66;",
        "  float core=1.0-smoothstep(.18,.88,d);",
        "  float lower=smoothstep(.52,-.42,p.y);",
        "  float waveA=sin(p.x*19.0+u_time*1.20+u_seed*8.0);",
        "  float waveB=sin((p.x+p.y)*25.0-u_time*.93);",
        "  float waveC=sin((p.x-p.y)*31.0+u_time*.71);",
        "  float caustic=pow(clamp((waveA+waveB+waveC)*.166+.52,0.0,1.0),6.0);",
        "  caustic*=core*lower*.48;",
        "  float breathing=.82+.18*sin(u_time*1.95+u_seed*6.2831);",
        "  float aura=pow(max(0.0,1.0-d),3.0)*.22*breathing;",
        "  float alpha=(r1*.44+r2*.28+caustic*.30+aura)*u_intensity;",
        "  vec3 aqua=vec3(.18,.78,.88);",
        "  vec3 deep=vec3(.02,.22,.34);",
        "  vec3 gold=vec3(1.0,.68,.18);",
        "  vec3 color=mix(deep,aqua,clamp(caustic*2.2+r1+r2,0.0,1.0));",
        "  color=mix(color,gold,u_target*clamp(r1+r2,0.0,1.0)*.72);",
        "  gl_FragColor=vec4(color,clamp(alpha,0.0,.72));",
        "}"
      ].join("\n"));

      const program=gl.createProgram();
      gl.attachShader(program,vertex);
      gl.attachShader(program,fragment);
      gl.linkProgram(program);
      gl.deleteShader(vertex);
      gl.deleteShader(fragment);
      if(!gl.getProgramParameter(program,gl.LINK_STATUS)){
        throw new Error(gl.getProgramInfoLog(program)||"Monster presence shader link failed");
      }

      this.gl=gl;
      this.program=program;
      this.position=gl.getAttribLocation(program,"a_position");
      this.uniforms={
        time:gl.getUniformLocation(program,"u_time"),
        aspect:gl.getUniformLocation(program,"u_aspect"),
        seed:gl.getUniformLocation(program,"u_seed"),
        target:gl.getUniformLocation(program,"u_target"),
        intensity:gl.getUniformLocation(program,"u_intensity")
      };
      this.buffer=gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER,this.buffer);
      gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([
        -1,-1, 1,-1, -1,1,
        -1,1, 1,-1, 1,1
      ]),gl.STATIC_DRAW);
      gl.clearColor(0,0,0,0);
      return true;
    }catch(error){
      this.failed=true;
      console.warn("[TabuadaQuest] Monster presence WebGL fallback:",error);
      return false;
    }
  }

  resize(width,height){
    const gl=this.gl;
    if(!gl)return;
    const dpr=Math.min(2,Math.max(1,Number(globalThis.devicePixelRatio)||1));
    const w=Math.max(1,Math.round(Math.max(1,Number(width)||1)*dpr));
    const h=Math.max(1,Math.round(Math.max(1,Number(height)||1)*dpr));
    if(this.canvas.width!==w||this.canvas.height!==h){
      this.canvas.width=w;
      this.canvas.height=h;
      gl.viewport(0,0,w,h);
    }
  }

  render(timeMs,width,height,{seed=0,target=false,intensity=1}={}){
    if(!this.setup())return false;
    const time=Math.max(0,Number(timeMs)||0);
    if(time-this.lastFrameAt<30)return true;
    this.lastFrameAt=time;
    const drawWidth=Math.max(1,Number(width)||1);
    const drawHeight=Math.max(1,Number(height)||1);
    this.resize(drawWidth,drawHeight);
    const gl=this.gl;
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.useProgram(this.program);
    gl.bindBuffer(gl.ARRAY_BUFFER,this.buffer);
    gl.enableVertexAttribArray(this.position);
    gl.vertexAttribPointer(this.position,2,gl.FLOAT,false,0,0);
    gl.uniform1f(this.uniforms.time,time/1000);
    gl.uniform1f(this.uniforms.aspect,clamp(drawWidth/drawHeight,.5,2));
    gl.uniform1f(this.uniforms.seed,Math.abs(Number(seed)||0)%1);
    gl.uniform1f(this.uniforms.target,target?1:0);
    gl.uniform1f(this.uniforms.intensity,clamp(intensity,0,1.4));
    gl.drawArrays(gl.TRIANGLES,0,6);
    return true;
  }

  destroy(){
    if(!this.gl)return;
    if(this.buffer)this.gl.deleteBuffer(this.buffer);
    if(this.program)this.gl.deleteProgram(this.program);
    this.gl=null;
    this.program=null;
    this.buffer=null;
  }
}
