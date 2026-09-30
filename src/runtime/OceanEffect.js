const WAKE_PRESETS=Object.freeze({
  subtle:Object.freeze({intensity:36,length:34,spread:32,foam:34}),
  navigation:Object.freeze({intensity:62,length:56,spread:44,foam:62}),
  strong:Object.freeze({intensity:86,length:76,spread:54,foam:86}),
  heavy:Object.freeze({intensity:74,length:68,spread:62,foam:72})
});

const clamp=(value,min=0,max=1)=>Math.max(min,Math.min(max,Number(value)||0));

export class OceanEffect {
  constructor(runtime,node){
    this.runtime=runtime;
    this.node=node;
    this.textureReady=false;
    this.maskReady=false;
    this.failed=false;
    this.maskSignature="";
    this.ripple={x:.5,y:.5,startedAt:-99};
    this.wakeMotion=new Map();

    this.canvas=document.createElement("canvas");
    this.canvas.className="tq-webgl-ocean";
    this.canvas.dataset.forNode=node.id;
    this.canvas.setAttribute("aria-hidden","true");
    runtime.stage.append(this.canvas);

    try{
      this.gl=this.canvas.getContext("webgl",{
        alpha:true,
        antialias:false,
        premultipliedAlpha:false,
        preserveDrawingBuffer:false
      });
      if(!this.gl)throw new Error("WebGL indisponível");
      this.init();
    }catch(error){
      this.failed=true;
      this.canvas.hidden=true;
      console.warn("[TabuadaQuest] Ocean WebGL fallback:",error);
    }

    this.onPointerDown=this.onPointerDown.bind(this);
    this.runtime.stage.addEventListener("pointerdown",this.onPointerDown,true);
    this.sync();
    this.loop=this.loop.bind(this);
    this.raf=requestAnimationFrame(this.loop);
  }

  init(){
    const gl=this.gl;

    const vertexSource=[
      "attribute vec2 a_position;",
      "varying vec2 v_uv;",
      "void main(){",
      "  v_uv=a_position*.5+.5;",
      "  gl_Position=vec4(a_position,0.0,1.0);",
      "}"
    ].join("\n");

    const fragmentSource=[
      "precision mediump float;",
      "varying vec2 v_uv;",
      "uniform sampler2D u_texture;",
      "uniform sampler2D u_mask;",
      "uniform float u_time;",
      "uniform float u_speed;",
      "uniform float u_movement;",
      "uniform float u_shine;",
      "uniform float u_foam;",
      "uniform float u_ripple_age;",
      "uniform vec2 u_ripple;",
      "uniform int u_ripples;",
      "uniform float u_wake_count;",
      "uniform vec4 u_wake_pos[4];",
      "uniform vec4 u_wake_meta[4];",
      "void main(){",
      "  vec2 uv=v_uv;",
      "  float mask=texture2D(u_mask,uv).a;",
      "  if(mask<0.02)discard;",
      "  float t=u_time*u_speed;",
      "  float w1=sin(uv.y*34.0+uv.x*8.0+t*1.45);",
      "  float w2=sin(uv.y*19.0-uv.x*13.0-t*1.05);",
      "  float w3=sin((uv.x+uv.y)*27.0+t*.72);",
      "  float waves=w1*.50+w2*.31+w3*.19;",
      "  float movement=u_movement*2.8;",
      "  vec2 offset=vec2(",
      "    (w1*.0036+w3*.0019)*movement,",
      "    (w2*.0024+w3*.0012)*movement",
      "  );",
      "  if(u_ripples==1 && u_ripple_age>=0.0 && u_ripple_age<2.8){",
      "    vec2 delta=uv-u_ripple;",
      "    float dist=length(delta);",
      "    float ring=sin((dist-u_ripple_age*.18)*95.0);",
      "    float decay=exp(-u_ripple_age*1.7)*exp(-dist*2.2);",
      "    vec2 dir=dist>.0001?delta/dist:vec2(0.0);",
      "    offset+=dir*ring*decay*(.010+.020*u_movement);",
      "  }",
      "  for(int wi=0;wi<4;wi++){",
      "    if(float(wi)<u_wake_count){",
      "      vec2 wp=u_wake_pos[wi].xy;",
      "      vec2 dir=normalize(u_wake_pos[wi].zw+vec2(.00001));",
      "      float intensity=u_wake_meta[wi].x;",
      "      float wakeLength=u_wake_meta[wi].y;",
      "      float spread=u_wake_meta[wi].z;",
      "      vec2 delta=uv-wp;",
      "      vec2 backDir=-dir;",
      "      vec2 sideDir=vec2(-dir.y,dir.x);",
      "      float back=dot(delta,backDir);",
      "      float side=abs(dot(delta,sideDir));",
      "      float body=smoothstep(0.0,.025,back)*(1.0-smoothstep(wakeLength*.72,wakeLength,back));",
      "      float arm=abs(side-max(0.0,back)*spread);",
      "      float wake=exp(-arm*105.0)*body*intensity;",
      "      offset+=sideDir*sign(dot(delta,sideDir))*wake*.0048;",
      "    }",
      "  }",
      "  vec4 color=texture2D(u_texture,clamp(uv+offset,0.001,0.999));",
      "  float crest=smoothstep(.34,.95,waves*.5+.5);",
      "  float sparkle=pow(max(0.0,sin((uv.x*1.2+uv.y)*92.0+t*2.1)),10.0);",
      "  float light=(crest*.11+sparkle*.18)*u_shine;",
      "  color.rgb+=vec3(.23,.55,.72)*light;",
      "  float foamBand=sin(uv.y*73.0+uv.x*19.0+t*1.9)*.5+.5;",
      "  float foam=smoothstep(.84,.98,foamBand)*smoothstep(.38,.92,crest)*u_foam*.34;",
      "  for(int fi=0;fi<4;fi++){",
      "    if(float(fi)<u_wake_count){",
      "      vec2 wp=u_wake_pos[fi].xy;",
      "      vec2 dir=normalize(u_wake_pos[fi].zw+vec2(.00001));",
      "      float intensity=u_wake_meta[fi].x;",
      "      float wakeLength=u_wake_meta[fi].y;",
      "      float spread=u_wake_meta[fi].z;",
      "      float wakeFoam=u_wake_meta[fi].w;",
      "      vec2 delta=uv-wp;",
      "      vec2 backDir=-dir;",
      "      vec2 sideDir=vec2(-dir.y,dir.x);",
      "      float back=dot(delta,backDir);",
      "      float side=abs(dot(delta,sideDir));",
      "      float body=smoothstep(0.0,.022,back)*(1.0-smoothstep(wakeLength*.70,wakeLength,back));",
      "      float arm=abs(side-max(0.0,back)*spread);",
      "      float arms=exp(-arm*128.0)*body;",
      "      float tail=exp(-side*62.0)*body*.36;",
      "      foam+=(arms+tail)*intensity*wakeFoam;",
      "    }",
      "  }",
      "  color.rgb=mix(color.rgb,vec3(.91,.98,1.0),clamp(foam,0.0,.72));",
      "  color.a*=smoothstep(0.02,0.92,mask);",
      "  gl_FragColor=color;",
      "}"
    ].join("\n");

    const compile=(type,source)=>{
      const shader=gl.createShader(type);
      gl.shaderSource(shader,source);
      gl.compileShader(shader);
      if(!gl.getShaderParameter(shader,gl.COMPILE_STATUS)){
        const message=gl.getShaderInfoLog(shader)||"Falha ao compilar shader";
        gl.deleteShader(shader);
        throw new Error(message);
      }
      return shader;
    };

    const vertex=compile(gl.VERTEX_SHADER,vertexSource);
    const fragment=compile(gl.FRAGMENT_SHADER,fragmentSource);

    this.program=gl.createProgram();
    gl.attachShader(this.program,vertex);
    gl.attachShader(this.program,fragment);
    gl.linkProgram(this.program);
    gl.deleteShader(vertex);
    gl.deleteShader(fragment);

    if(!gl.getProgramParameter(this.program,gl.LINK_STATUS)){
      throw new Error(gl.getProgramInfoLog(this.program)||"Falha ao linkar programa WebGL");
    }

    this.buffer=gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER,this.buffer);
    gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([
      -1,-1,1,-1,-1,1,
      -1,1,1,-1,1,1
    ]),gl.STATIC_DRAW);

    gl.useProgram(this.program);
    this.position=gl.getAttribLocation(this.program,"a_position");
    gl.enableVertexAttribArray(this.position);
    gl.vertexAttribPointer(this.position,2,gl.FLOAT,false,0,0);

    this.uniforms={
      texture:gl.getUniformLocation(this.program,"u_texture"),
      mask:gl.getUniformLocation(this.program,"u_mask"),
      time:gl.getUniformLocation(this.program,"u_time"),
      speed:gl.getUniformLocation(this.program,"u_speed"),
      movement:gl.getUniformLocation(this.program,"u_movement"),
      shine:gl.getUniformLocation(this.program,"u_shine"),
      foam:gl.getUniformLocation(this.program,"u_foam"),
      rippleAge:gl.getUniformLocation(this.program,"u_ripple_age"),
      ripple:gl.getUniformLocation(this.program,"u_ripple"),
      ripples:gl.getUniformLocation(this.program,"u_ripples"),
      wakeCount:gl.getUniformLocation(this.program,"u_wake_count"),
      wakePos:gl.getUniformLocation(this.program,"u_wake_pos[0]"),
      wakeMeta:gl.getUniformLocation(this.program,"u_wake_meta[0]")
    };

    this.texture=gl.createTexture();
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D,this.texture);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);

    this.maskTexture=gl.createTexture();
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D,this.maskTexture);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
    gl.activeTexture(gl.TEXTURE0);

    this.uploadTexture();
    this.updateMaskTexture(true);
  }

  config(){
    const composition=this.node.composition||{};
    const animation=composition.animation||{};
    const legacy=composition.effects?.ripple||{};
    const legacyShine=Number(composition.appearance?.shine);
    const legacyFoam=Number(composition.appearance?.foam);

    return {
      active:composition.active!==false,
      preset:animation.preset||"adventure",
      speed:Number(animation.speed??Math.round((legacy.speed??.88)*50)),
      movement:Number(animation.movement??Math.round((legacy.strength??1.04)*50)),
      shine:Number(animation.shine??(Number.isFinite(legacyShine)?legacyShine*100:20)),
      foam:Number(animation.foam??(Number.isFinite(legacyFoam)?legacyFoam*100:57)),
      ripples:animation.ripples??composition.ripples??true,
      quality:animation.quality||"balanced"
    };
  }

  uploadTexture(){
    const gl=this.gl;
    const image=this.runtime.nodes.get(this.node.id)?.el;
    if(!gl||!image||image.tagName!=="IMG")return;

    const upload=()=>{
      try{
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D,this.texture);
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,true);
        gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,image);
        this.textureReady=true;
      }catch(error){
        this.textureReady=false;
        console.warn("[TabuadaQuest] Ocean texture fallback:",error);
      }
    };

    if(image.complete&&image.naturalWidth)upload();
    else image.addEventListener("load",upload,{once:true});
  }

  updateMaskTexture(force=false){
    const gl=this.gl;
    if(!gl||!this.maskTexture)return;

    const points=this.node.composition?.area?.points||[];
    const signature=points.map(point=>Number(point.x).toFixed(5)+","+Number(point.y).toFixed(5)).join(";");
    if(!force&&signature===this.maskSignature)return;
    this.maskSignature=signature;

    const size=512;
    if(!this.maskCanvas){
      this.maskCanvas=document.createElement("canvas");
      this.maskCanvas.width=size;
      this.maskCanvas.height=size;
      this.maskContext=this.maskCanvas.getContext("2d");
    }

    const ctx=this.maskContext;
    if(!ctx){this.maskReady=false;return}
    ctx.clearRect(0,0,size,size);

    if(points.length>=3){
      ctx.beginPath();
      points.forEach((point,index)=>{
        const x=clamp(point.x)*size;
        const y=clamp(point.y)*size;
        if(index===0)ctx.moveTo(x,y);else ctx.lineTo(x,y);
      });
      ctx.closePath();
      ctx.fillStyle="#fff";
      ctx.fill();
    }

    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D,this.maskTexture);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,true);
    gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,this.maskCanvas);
    gl.activeTexture(gl.TEXTURE0);
    this.maskReady=points.length>=3;
  }

  qualityScale(){
    const quality=this.config().quality;
    if(quality==="economy")return .65;
    if(quality==="high")return Math.min(2,window.devicePixelRatio||1);
    return Math.min(1.25,window.devicePixelRatio||1);
  }

  sync(){
    const node=this.node;
    const canvas=this.canvas;
    const layout=this.runtime.resolveNodeLayout(node);
    const width=Math.max(1,layout.width||1);
    const height=Math.max(1,layout.height||1);

    canvas.style.left=layout.x+"px";
    canvas.style.top=layout.y+"px";
    canvas.style.width=width+"px";
    canvas.style.height=height+"px";
    canvas.style.zIndex=String(node.z??0);
    canvas.style.transform="rotate("+(node.rotation||0)+"deg) skew("+(node.skewX||0)+"deg,"+(node.skewY||0)+"deg) scale("+(node.scaleX||1)+","+(node.scaleY||1)+")";
    canvas.hidden=this.failed||node.visible===false||!this.config().active;

    this.updateMaskTexture();

    const dpr=this.qualityScale();
    const internalWidth=Math.max(1,Math.round(width*dpr));
    const internalHeight=Math.max(1,Math.round(height*dpr));
    if(canvas.width!==internalWidth||canvas.height!==internalHeight){
      canvas.width=internalWidth;
      canvas.height=internalHeight;
      this.gl?.viewport(0,0,internalWidth,internalHeight);
    }
  }

  pointInWater(x,yTop){
    const points=this.node.composition?.area?.points||[];
    let inside=false;
    for(let i=0,j=points.length-1;i<points.length;j=i++){
      const a=points[i],b=points[j];
      if(((a.y>yTop)!=(b.y>yTop))&&(x<(b.x-a.x)*(yTop-a.y)/(b.y-a.y+Number.EPSILON)+a.x))inside=!inside;
    }
    return inside;
  }

  stagePoint(stageX,stageY){
    const layout=this.runtime.resolveNodeLayout(this.node);
    if(!layout.width||!layout.height)return null;
    const x=(stageX-layout.x)/layout.width;
    const yTop=(stageY-layout.y)/layout.height;
    if(x<0||x>1||yTop<0||yTop>1)return null;
    return {x,yTop,y:1-yTop};
  }

  sampleWaveAtStage(stageX,stageY,now=performance.now()){
    const point=this.stagePoint(stageX,stageY);
    if(!point||!this.pointInWater(point.x,point.yTop))return null;
    const config=this.config();
    const t=(now/1000)*(Math.max(0,config.speed)/100);
    const uvX=point.x,uvY=point.y;
    const w1=Math.sin(uvY*34+uvX*8+t*1.45);
    const w2=Math.sin(uvY*19-uvX*13-t*1.05);
    const w3=Math.sin((uvX+uvY)*27+t*.72);
    return {
      height:w1*.50+w2*.31+w3*.19,
      movement:Math.max(0,config.movement)/100,
      x:point.x,
      y:point.y
    };
  }

  normalizeWakeConfig(value={}){
    const preset=WAKE_PRESETS[value.preset]||WAKE_PRESETS.navigation;
    const p=n=>clamp(n,0,100);
    return {
      enabled:value.enabled!==false,
      intensity:p(value.intensity??preset.intensity),
      length:p(value.length??preset.length),
      spread:p(value.spread??preset.spread),
      foam:p(value.foam??preset.foam)
    };
  }

  wakeDirection(id,point,now,rotation=0){
    const angle=rotation*Math.PI/180;
    const initial={x:Math.cos(angle),y:-Math.sin(angle)};
    const previous=this.wakeMotion.get(id)||{x:point.x,y:point.y,now,dirX:initial.x,dirY:initial.y};
    const dx=point.x-previous.x,dy=point.y-previous.y;
    const distance=Math.hypot(dx,dy);
    let dirX=previous.dirX,dirY=previous.dirY;

    if(distance>.00008&&distance<.28){
      const rawX=dx/distance,rawY=dy/distance;
      dirX=dirX*.74+rawX*.26;
      dirY=dirY*.74+rawY*.26;
      const length=Math.hypot(dirX,dirY)||1;
      dirX/=length;dirY/=length;
    }

    this.wakeMotion.set(id,{x:point.x,y:point.y,now,dirX,dirY});
    return {x:dirX,y:dirY};
  }

  activeWakes(now){
    const entries=[];
    for(const ship of this.runtime.compositions.list("ship")){
      if(entries.length>=4)break;
      const wake=this.normalizeWakeConfig(ship.wakeConfig?.()||{enabled:false});
      if(!wake.enabled)continue;

      const state=this.runtime.getAnimatedWorldState(ship.node.id);
      if(!state)continue;
      const point=this.stagePoint(state.centerX,state.y+state.height*.68);
      if(!point)continue;

      entries.push({
        id:ship.node.id,
        point:{x:point.x,y:point.y},
        direction:this.wakeDirection(ship.node.id,{x:point.x,y:point.y},now,state.rotation),
        wake
      });
    }

    for(const id of [...this.wakeMotion.keys()]){
      if(!entries.some(entry=>entry.id===id))this.wakeMotion.delete(id);
    }
    return entries;
  }

  wakeUniformData(now){
    const entries=this.activeWakes(now);
    const positions=new Float32Array(16);
    const meta=new Float32Array(16);
    entries.forEach((entry,index)=>{
      const p=index*4,wake=entry.wake;
      positions[p]=entry.point.x;
      positions[p+1]=entry.point.y;
      positions[p+2]=entry.direction.x;
      positions[p+3]=entry.direction.y;
      meta[p]=(wake.intensity/100)*1.25;
      meta[p+1]=.10+(wake.length/100)*.42;
      meta[p+2]=.14+(wake.spread/100)*.46;
      meta[p+3]=(wake.foam/100)*1.15;
    });
    return {count:entries.length,positions,meta};
  }

  onPointerDown(event){
    if(this.failed||this.runtime.mode!=="play")return;
    const config=this.config();
    if(!config.active||!config.ripples)return;

    const rect=this.canvas.getBoundingClientRect();
    if(!rect.width||!rect.height)return;
    const x=(event.clientX-rect.left)/rect.width;
    const y=1-(event.clientY-rect.top)/rect.height;
    if(x<0||x>1||y<0||y>1||!this.pointInWater(x,1-y))return;
    this.ripple={x,y,startedAt:performance.now()/1000};
  }

  loop(ms){
    if(!this.canvas.isConnected)return;

    const gl=this.gl;
    const points=this.node.composition?.area?.points||[];
    const config=this.config();

    if(gl&&!this.failed&&config.active&&this.textureReady&&this.maskReady&&points.length>=3){
      this.canvas.hidden=false;
      gl.viewport(0,0,this.canvas.width,this.canvas.height);
      gl.useProgram(this.program);
      gl.bindBuffer(gl.ARRAY_BUFFER,this.buffer);
      gl.enableVertexAttribArray(this.position);
      gl.vertexAttribPointer(this.position,2,gl.FLOAT,false,0,0);

      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D,this.texture);
      gl.uniform1i(this.uniforms.texture,0);

      gl.activeTexture(gl.TEXTURE1);
      gl.bindTexture(gl.TEXTURE_2D,this.maskTexture);
      gl.uniform1i(this.uniforms.mask,1);

      const wakes=this.wakeUniformData(ms);
      gl.uniform1f(this.uniforms.time,ms/1000);
      gl.uniform1f(this.uniforms.speed,Math.max(0,config.speed)/100);
      gl.uniform1f(this.uniforms.movement,Math.max(0,config.movement)/100);
      gl.uniform1f(this.uniforms.shine,Math.max(0,config.shine)/100);
      gl.uniform1f(this.uniforms.foam,Math.max(0,config.foam)/100);
      gl.uniform1i(this.uniforms.ripples,config.ripples?1:0);
      gl.uniform2f(this.uniforms.ripple,this.ripple.x,this.ripple.y);
      gl.uniform1f(this.uniforms.rippleAge,ms/1000-this.ripple.startedAt);
      gl.uniform1f(this.uniforms.wakeCount,wakes.count);
      gl.uniform4fv(this.uniforms.wakePos,wakes.positions);
      gl.uniform4fv(this.uniforms.wakeMeta,wakes.meta);

      gl.clearColor(0,0,0,0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.disable(gl.BLEND);
      gl.drawArrays(gl.TRIANGLES,0,6);
    }else if(gl){
      gl.clearColor(0,0,0,0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      if(!config.active)this.canvas.hidden=true;
    }

    const reduced=window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
    if(!reduced||this.runtime.editorEnabled||!this.textureReady)this.raf=requestAnimationFrame(this.loop);
  }

  destroy(){
    cancelAnimationFrame(this.raf);
    this.runtime.stage.removeEventListener("pointerdown",this.onPointerDown,true);
    this.wakeMotion.clear();

    if(this.gl){
      if(this.texture)this.gl.deleteTexture(this.texture);
      if(this.maskTexture)this.gl.deleteTexture(this.maskTexture);
      if(this.buffer)this.gl.deleteBuffer(this.buffer);
      if(this.program)this.gl.deleteProgram(this.program);
    }

    this.canvas.remove();
  }
}

export const OceanEngineering=Object.freeze({WAKE_PRESETS});
