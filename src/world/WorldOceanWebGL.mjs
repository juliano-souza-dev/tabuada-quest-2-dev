const clamp=(value,min,max)=>Math.min(max,Math.max(min,value));

const shader=(gl,type,source)=>{
  const item=gl.createShader(type);
  gl.shaderSource(item,source);
  gl.compileShader(item);
  if(!gl.getShaderParameter(item,gl.COMPILE_STATUS)){
    const message=gl.getShaderInfoLog(item)||"Falha ao compilar shader";
    gl.deleteShader(item);
    throw new Error(message);
  }
  return item;
};

export class WorldOceanWebGL {
  constructor(runtime,canvas,fallback){
    this.runtime=runtime;
    this.canvas=canvas;
    this.fallback=fallback;
    this.ready=false;
    this.failed=false;
    this.textureReady=false;
    this.background="";
    this.image=null;

    try{
      this.gl=canvas.getContext("webgl",{
        alpha:false,
        antialias:false,
        premultipliedAlpha:false,
        preserveDrawingBuffer:false,
        powerPreference:"high-performance"
      });
      if(!this.gl)throw new Error("WebGL indisponível");
      this.init();
    }catch(error){
      this.failed=true;
      canvas.hidden=true;
      console.warn("[TabuadaQuest] World ocean WebGL fallback:",error);
    }
  }

  init(){
    const gl=this.gl;
    const vertex=shader(gl,gl.VERTEX_SHADER,[
      "attribute vec2 a_position;",
      "varying vec2 v_uv;",
      "void main(){",
      "  v_uv=a_position*.5+.5;",
      "  gl_Position=vec4(a_position,0.0,1.0);",
      "}"
    ].join("\n"));

    const fragment=shader(gl,gl.FRAGMENT_SHADER,[
      "precision mediump float;",
      "varying vec2 v_uv;",
      "uniform sampler2D u_texture;",
      "uniform vec2 u_resolution;",
      "uniform float u_time;",
      "uniform float u_speed;",
      "uniform vec2 u_direction;",
      "uniform float u_swell;",
      "uniform float u_tile;",
      "uniform float u_brightness;",
      "uniform float u_saturation;",
      "vec3 saturateColor(vec3 c,float s){",
      "  float l=dot(c,vec3(.2126,.7152,.0722));",
      "  return mix(vec3(l),c,s);",
      "}",
      "void main(){",
      "  float t=u_time*(.22+u_speed*1.55);",
      "  float aspect=max(.25,u_resolution.x/max(1.0,u_resolution.y));",
      "  vec2 uv=v_uv;",
      "  vec2 flow=u_direction*t*(.018+.045*u_speed);",
      "  float w1=sin((uv.y*16.0+uv.x*7.0)+t*1.45);",
      "  float w2=sin((uv.y*29.0-uv.x*11.0)-t*.92);",
      "  float w3=sin((uv.x+uv.y)*39.0+t*.61);",
      "  float wave=w1*.52+w2*.31+w3*.17;",
      "  float amount=(.0015+.0085*u_swell);",
      "  vec2 distortion=vec2(w1+w3*.55,w2+w3*.35)*amount;",
      "  vec2 tiles=vec2(max(1.0,u_resolution.x/u_tile),max(1.0,u_resolution.y/u_tile));",
      "  vec2 texUv=fract((uv+flow+distortion)*tiles);",
      "  vec3 color=texture2D(u_texture,texUv).rgb;",
      "  float crest=smoothstep(.30,.95,wave*.5+.5);",
      "  float sparkle=pow(max(0.0,sin((uv.x*aspect+uv.y)*105.0+t*2.15)),12.0);",
      "  color+=vec3(.055,.18,.24)*(crest*.45+sparkle*.34)*u_swell;",
      "  color*=u_brightness;",
      "  color=saturateColor(color,u_saturation);",
      "  gl_FragColor=vec4(color,1.0);",
      "}"
    ].join("\n"));

    this.program=gl.createProgram();
    gl.attachShader(this.program,vertex);
    gl.attachShader(this.program,fragment);
    gl.linkProgram(this.program);
    gl.deleteShader(vertex);
    gl.deleteShader(fragment);
    if(!gl.getProgramParameter(this.program,gl.LINK_STATUS)){
      throw new Error(gl.getProgramInfoLog(this.program)||"Falha ao linkar shader do oceano");
    }

    this.buffer=gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER,this.buffer);
    gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([
      -1,-1,1,-1,-1,1,
      -1,1,1,-1,1,1
    ]),gl.STATIC_DRAW);

    this.position=gl.getAttribLocation(this.program,"a_position");
    this.uniforms={
      texture:gl.getUniformLocation(this.program,"u_texture"),
      resolution:gl.getUniformLocation(this.program,"u_resolution"),
      time:gl.getUniformLocation(this.program,"u_time"),
      speed:gl.getUniformLocation(this.program,"u_speed"),
      direction:gl.getUniformLocation(this.program,"u_direction"),
      swell:gl.getUniformLocation(this.program,"u_swell"),
      tile:gl.getUniformLocation(this.program,"u_tile"),
      brightness:gl.getUniformLocation(this.program,"u_brightness"),
      saturation:gl.getUniformLocation(this.program,"u_saturation")
    };

    this.texture=gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D,this.texture);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.REPEAT);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.REPEAT);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);

    this.resize();
  }

  setBackground(src){
    src=String(src||"");
    if(this.failed||src===this.background)return;
    this.background=src;
    this.textureReady=false;
    this.ready=false;
    this.canvas.hidden=true;
    if(this.fallback)this.fallback.hidden=false;

    const image=new Image();
    this.image=image;
    image.decoding="async";
    image.onload=()=>{
      if(this.image!==image||!this.gl)return;
      try{
        const gl=this.gl;
        gl.bindTexture(gl.TEXTURE_2D,this.texture);
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,true);
        gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,image);
        this.textureReady=true;
        this.ready=true;
        this.canvas.hidden=false;
        if(this.fallback)this.fallback.hidden=true;
      }catch(error){
        this.textureReady=false;
        this.ready=false;
        this.canvas.hidden=true;
        if(this.fallback)this.fallback.hidden=false;
        console.warn("[TabuadaQuest] World ocean texture fallback:",error);
      }
    };
    image.onerror=()=>{
      if(this.image!==image)return;
      this.textureReady=false;
      this.ready=false;
      this.canvas.hidden=true;
      if(this.fallback)this.fallback.hidden=false;
    };
    image.src=src;
  }

  resize(){
    if(!this.gl||this.failed)return;
    const width=Math.max(1,Math.round(Number(this.runtime.config.width)||1));
    const height=Math.max(1,Math.round(Number(this.runtime.config.height)||1));
    const maxTexture=Math.min(2048,this.gl.getParameter(this.gl.MAX_RENDERBUFFER_SIZE)||2048);
    const scale=Math.min(1,maxTexture/Math.max(width,height));
    const internalWidth=Math.max(1,Math.round(width*scale));
    const internalHeight=Math.max(1,Math.round(height*scale));
    if(this.canvas.width!==internalWidth||this.canvas.height!==internalHeight){
      this.canvas.width=internalWidth;
      this.canvas.height=internalHeight;
    }
    this.canvas.style.width=width+"px";
    this.canvas.style.height=height+"px";
    this.gl.viewport(0,0,internalWidth,internalHeight);
  }

  render(timeMs,ocean){
    if(this.failed||!this.gl||!this.textureReady||!ocean?.active)return false;
    this.resize();
    const gl=this.gl;
    gl.useProgram(this.program);
    gl.bindBuffer(gl.ARRAY_BUFFER,this.buffer);
    gl.enableVertexAttribArray(this.position);
    gl.vertexAttribPointer(this.position,2,gl.FLOAT,false,0,0);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D,this.texture);
    gl.uniform1i(this.uniforms.texture,0);
    gl.uniform2f(this.uniforms.resolution,this.canvas.width,this.canvas.height);
    gl.uniform1f(this.uniforms.time,Math.max(0,Number(timeMs)||0)/1000);
    gl.uniform1f(this.uniforms.speed,clamp(Number(ocean.speed||0)/100,0,1));
    gl.uniform2f(this.uniforms.direction,Number(ocean.directionX||0),Number(ocean.directionY||0));
    gl.uniform1f(this.uniforms.swell,clamp(Number(ocean.swell||0)/100,0,1));
    gl.uniform1f(this.uniforms.tile,clamp(Number(ocean.tileSize||720),240,1600));
    gl.uniform1f(this.uniforms.brightness,clamp(Number(ocean.brightness||100)/100,.5,1.5));
    gl.uniform1f(this.uniforms.saturation,clamp(Number(ocean.saturation||100)/100,0,1.8));
    gl.drawArrays(gl.TRIANGLES,0,6);
    return true;
  }

  destroy(){
    if(!this.gl)return;
    if(this.texture)this.gl.deleteTexture(this.texture);
    if(this.buffer)this.gl.deleteBuffer(this.buffer);
    if(this.program)this.gl.deleteProgram(this.program);
  }
}
