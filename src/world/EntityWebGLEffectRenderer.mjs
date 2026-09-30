const clamp=(value,min,max)=>Math.min(max,Math.max(min,value));

function compile(gl,type,source){
  const shader=gl.createShader(type);
  gl.shaderSource(shader,source);
  gl.compileShader(shader);
  if(!gl.getShaderParameter(shader,gl.COMPILE_STATUS)){
    const message=gl.getShaderInfoLog(shader)||"Entity shader compile failed";
    gl.deleteShader(shader);
    throw new Error(message);
  }
  return shader;
}

export class EntityWebGLEffectRenderer{
  constructor(canvas){
    this.canvas=canvas;
    this.gl=null;
    this.program=null;
    this.buffer=null;
    this.texture=null;
    this.ready=false;
    this.failed=false;
    this.source="";
    this.pending=null;
  }

  async init(src){
    src=String(src||"");
    if(!src)return false;
    if(this.failed)return false;
    if(this.ready&&this.source===src)return true;
    if(this.pending&&this.source===src)return this.pending;
    this.source=src;
    this.pending=this.load(src);
    return this.pending;
  }

  async load(src){
    try{
      if(!this.gl)this.setup();
      const image=await new Promise((resolve,reject)=>{
        const img=new Image();
        img.decoding="async";
        img.onload=()=>resolve(img);
        img.onerror=()=>reject(new Error("Entity WebGL texture failed: "+src));
        img.src=src;
      });
      if(src!==this.source)return false;
      const gl=this.gl;
      gl.bindTexture(gl.TEXTURE_2D,this.texture);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,true);
      gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,image);
      this.ready=true;
      return true;
    }catch(error){
      this.failed=true;
      this.ready=false;
      console.warn("[TabuadaQuest] Entity WebGL fallback:",error);
      return false;
    }finally{
      this.pending=null;
    }
  }

  setup(){
    const gl=this.canvas.getContext("webgl",{
      alpha:true,
      antialias:true,
      premultipliedAlpha:false,
      powerPreference:"high-performance"
    });
    if(!gl)throw new Error("WebGL indisponível para o asset");
    this.gl=gl;

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
      "uniform sampler2D u_texture;",
      "uniform float u_time;",
      "uniform float u_distortion;",
      "uniform float u_glow;",
      "uniform float u_intensity;",
      "void main(){",
      "  vec2 uv=v_uv;",
      "  float w1=sin(uv.y*18.0+u_time*1.65);",
      "  float w2=sin(uv.x*15.0-u_time*1.17);",
      "  float warp=.0045*u_distortion;",
      "  uv+=vec2(w1,w2)*warp;",
      "  vec4 color=texture2D(u_texture,clamp(uv,0.001,0.999));",
      "  float sparkle=pow(max(0.0,sin((uv.x+uv.y)*42.0+u_time*2.9)),18.0);",
      "  color.rgb+=vec3(1.0,.72,.24)*sparkle*u_glow*color.a;",
      "  color.rgb*=1.0+u_intensity*.08;",
      "  gl_FragColor=color;",
      "}"
    ].join("\n"));

    this.program=gl.createProgram();
    gl.attachShader(this.program,vertex);
    gl.attachShader(this.program,fragment);
    gl.linkProgram(this.program);
    gl.deleteShader(vertex);
    gl.deleteShader(fragment);
    if(!gl.getProgramParameter(this.program,gl.LINK_STATUS)){
      throw new Error(gl.getProgramInfoLog(this.program)||"Entity WebGL shader link failed");
    }

    this.position=gl.getAttribLocation(this.program,"a_position");
    this.uniforms={
      texture:gl.getUniformLocation(this.program,"u_texture"),
      time:gl.getUniformLocation(this.program,"u_time"),
      distortion:gl.getUniformLocation(this.program,"u_distortion"),
      glow:gl.getUniformLocation(this.program,"u_glow"),
      intensity:gl.getUniformLocation(this.program,"u_intensity")
    };

    this.buffer=gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER,this.buffer);
    gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([
      -1,-1, 1,-1, -1,1,
      -1,1, 1,-1, 1,1
    ]),gl.STATIC_DRAW);

    this.texture=gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D,this.texture);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
    gl.clearColor(0,0,0,0);
  }

  resize(width,height){
    if(!this.gl)return;
    const dpr=Math.min(2,Math.max(1,Number(globalThis.devicePixelRatio)||1));
    const w=Math.max(1,Math.round((Number(width)||1)*dpr));
    const h=Math.max(1,Math.round((Number(height)||1)*dpr));
    if(this.canvas.width!==w||this.canvas.height!==h){
      this.canvas.width=w;
      this.canvas.height=h;
      this.gl.viewport(0,0,w,h);
    }
  }

  render(timeMs,effect,width,height){
    if(!this.ready||!this.gl)return false;
    this.resize(width,height);
    const gl=this.gl;
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.useProgram(this.program);
    gl.bindBuffer(gl.ARRAY_BUFFER,this.buffer);
    gl.enableVertexAttribArray(this.position);
    gl.vertexAttribPointer(this.position,2,gl.FLOAT,false,0,0);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D,this.texture);
    gl.uniform1i(this.uniforms.texture,0);
    gl.uniform1f(this.uniforms.time,Math.max(0,Number(timeMs)||0)/1000);
    gl.uniform1f(this.uniforms.distortion,clamp(Number(effect?.distortion||0)/100,0,1));
    gl.uniform1f(this.uniforms.glow,clamp(Number(effect?.glow||0)/100,0,1));
    gl.uniform1f(this.uniforms.intensity,clamp(Number(effect?.intensity||0)/100,0,1));
    gl.drawArrays(gl.TRIANGLES,0,6);
    return true;
  }

  destroy(){
    if(!this.gl)return;
    if(this.texture)this.gl.deleteTexture(this.texture);
    if(this.buffer)this.gl.deleteBuffer(this.buffer);
    if(this.program)this.gl.deleteProgram(this.program);
    this.gl=null;
    this.ready=false;
  }
}
