const clamp=(value,min,max)=>Math.min(max,Math.max(min,value));

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
out vec4 outColor;
void main(){
  vec2 p=gl_PointCoord-vec2(.5);
  float d=length(p);
  if(d>.5)discard;
  float core=1.0-smoothstep(.08,.22,d);
  float halo=1.0-smoothstep(.16,.50,d);
  vec3 hot=vec3(1.0,.95,.72);
  vec3 fire=vec3(1.0,.33,.06);
  vec3 color=mix(fire,hot,core);
  float alpha=clamp(core+halo*.72,0.0,1.0)*(0.88+uPulse*.12);
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
    this.ready=false;
    this.failed=false;
    this.pixelRatio=1;
    this.cssWidth=0;
    this.cssHeight=0;
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
      this.buffer=gl.createBuffer();
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

  fire({from,to,duration=620,startTime=performance.now()}={}){
    if(!this.init())return false;
    if(!from||!to)return false;
    this.shots.push({
      from:{x:Number(from.x)||0,y:Number(from.y)||0},
      to:{x:Number(to.x)||0,y:Number(to.y)||0},
      duration:clamp(Number(duration)||620,220,1600),
      startTime:Number(startTime)||performance.now()
    });
    if(this.shots.length>24)this.shots.splice(0,this.shots.length-24);
    return true;
  }

  render({time=performance.now(),camera={x:0,y:0},zoom=1,width=1,height=1}={}){
    if(!this.init()||!this.gl)return false;
    this.resize(width,height);
    const gl=this.gl;
    gl.clear(gl.COLOR_BUFFER_BIT);

    const now=Number(time)||performance.now();
    this.shots=this.shots.filter(shot=>now-shot.startTime<=shot.duration);
    if(!this.shots.length)return true;

    gl.useProgram(this.program);
    gl.bindBuffer(gl.ARRAY_BUFFER,this.buffer);
    gl.enableVertexAttribArray(this.position);
    gl.vertexAttribPointer(this.position,2,gl.FLOAT,false,0,0);

    const points=[];
    for(const shot of this.shots){
      const t=clamp((now-shot.startTime)/shot.duration,0,1);
      const eased=1-Math.pow(1-t,2);
      const x=shot.from.x+(shot.to.x-shot.from.x)*eased;
      const y=shot.from.y+(shot.to.y-shot.from.y)*eased;
      const screenX=(x-(Number(camera.x)||0))*(Number(zoom)||1)+width*.5;
      const screenY=(y-(Number(camera.y)||0))*(Number(zoom)||1)+height*.5;
      const clipX=screenX/Math.max(1,width)*2-1;
      const clipY=1-screenY/Math.max(1,height)*2;
      points.push(clipX,clipY);
    }

    gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(points),gl.DYNAMIC_DRAW);
    gl.uniform1f(this.uniforms.pointSize,18*this.pixelRatio);
    gl.uniform1f(this.uniforms.pulse,.5+.5*Math.sin(now*.018));
    gl.drawArrays(gl.POINTS,0,points.length/2);
    return true;
  }

  clear(){
    this.shots.length=0;
    if(this.gl)this.gl.clear(this.gl.COLOR_BUFFER_BIT);
  }

  destroy(){
    if(!this.gl)return;
    if(this.buffer)this.gl.deleteBuffer(this.buffer);
    if(this.program)this.gl.deleteProgram(this.program);
    this.shots.length=0;
    this.gl=null;
    this.ready=false;
  }
}
