import { Filter, GlProgram } from 'pixi.js';

const VERTEX_SHADER = `#version 300 es
precision highp float;

in vec2 aPosition;
out vec2 vTextureCoord;

uniform vec4 uInputSize;
uniform vec4 uOutputFrame;
uniform vec4 uOutputTexture;

vec4 filterVertexPosition() {
  vec2 position =
    aPosition * uOutputFrame.zw +
    uOutputFrame.xy;

  position.x =
    position.x * (2.0 / uOutputTexture.x) -
    1.0;

  position.y =
    position.y *
    (2.0 * uOutputTexture.z / uOutputTexture.y) -
    uOutputTexture.z;

  return vec4(position, 0.0, 1.0);
}

vec2 filterTextureCoord() {
  return aPosition *
    (uOutputFrame.zw * uInputSize.zw);
}

void main() {
  gl_Position = filterVertexPosition();
  vTextureCoord = filterTextureCoord();
}
`;

const FRAGMENT_SHADER = `#version 300 es
precision highp float;

in vec2 vTextureCoord;
out vec4 finalColor;

uniform sampler2D uTexture;
uniform vec4 uInputSize;

uniform float uTime;
uniform float uGlowStrength;
uniform float uRimStrength;
uniform float uHeatStrength;

vec3 saturateColor(vec3 color, float amount) {
  float luma =
    dot(color, vec3(0.299, 0.587, 0.114));

  return mix(
    vec3(luma),
    color,
    amount
  );
}

void main() {
  vec2 uv = vTextureCoord;
  vec2 texel = uInputSize.zw;

  // O sprite não é deformado. Isso evita o navio parecer submerso
  // ou compartilhar a animação do oceano.
  vec4 base = texture(uTexture, uv);

  // Máscara das áreas quentes já existentes no asset.
  float warmRed =
    smoothstep(
      0.38,
      0.92,
      base.r - base.b * 0.46
    );

  float warmOrange =
    smoothstep(
      0.20,
      0.78,
      base.r + base.g * 0.42 - base.b * 0.72
    );

  float luminosity =
    dot(
      base.rgb,
      vec3(0.299, 0.587, 0.114)
    );

  float hotMask =
    warmRed *
    warmOrange *
    smoothstep(0.16, 0.72, luminosity) *
    base.a;

  float pulse =
    0.82 +
    0.18 * sin(uTime * 2.25) +
    0.07 * sin(uTime * 4.70 + uv.y * 12.0);

  vec3 emberColor =
    mix(
      vec3(1.00, 0.18, 0.015),
      vec3(1.00, 0.64, 0.05),
      smoothstep(0.25, 0.85, luminosity)
    );

  vec3 color = base.rgb;

  color +=
    emberColor *
    hotMask *
    pulse *
    uGlowStrength *
    0.48;

  // Energia espectral dentro do próprio casco/velas.
  // Atua principalmente nas áreas escuras e preserva os laranjas.
  float darkMask =
    smoothstep(
      0.72,
      0.18,
      luminosity
    ) *
    base.a *
    (1.0 - hotMask * 0.82);

  float ghostInsidePulse =
    0.78 +
    0.22 * sin(
      uTime * 1.55 +
      uv.y * 8.0
    );

  vec3 ghostInside =
    mix(
      vec3(0.05, 0.46, 0.52),
      vec3(0.12, 0.80, 0.64),
      0.5 + 0.5 * sin(uTime * 0.85)
    );

  color = mix(
    color,
    color + ghostInside * 0.34,
    darkMask * ghostInsidePulse
  );

  // Aura espectral larga calculada a partir do alpha.
  float nearAlpha = 0.0;
  float farAlpha = 0.0;

  vec2 r1 = texel * 4.0;
  vec2 r2 = texel * 8.0;

  nearAlpha = max(nearAlpha, texture(uTexture, uv + vec2( r1.x, 0.0)).a);
  nearAlpha = max(nearAlpha, texture(uTexture, uv + vec2(-r1.x, 0.0)).a);
  nearAlpha = max(nearAlpha, texture(uTexture, uv + vec2(0.0,  r1.y)).a);
  nearAlpha = max(nearAlpha, texture(uTexture, uv + vec2(0.0, -r1.y)).a);
  nearAlpha = max(nearAlpha, texture(uTexture, uv + vec2( r1.x,  r1.y)).a);
  nearAlpha = max(nearAlpha, texture(uTexture, uv + vec2(-r1.x,  r1.y)).a);
  nearAlpha = max(nearAlpha, texture(uTexture, uv + vec2( r1.x, -r1.y)).a);
  nearAlpha = max(nearAlpha, texture(uTexture, uv + vec2(-r1.x, -r1.y)).a);

  farAlpha = max(farAlpha, texture(uTexture, uv + vec2( r2.x, 0.0)).a);
  farAlpha = max(farAlpha, texture(uTexture, uv + vec2(-r2.x, 0.0)).a);
  farAlpha = max(farAlpha, texture(uTexture, uv + vec2(0.0,  r2.y)).a);
  farAlpha = max(farAlpha, texture(uTexture, uv + vec2(0.0, -r2.y)).a);

  float nearGlow =
    max(0.0, nearAlpha - base.a);

  float farGlow =
    max(0.0, farAlpha - max(base.a, nearGlow * 0.5));

  float ghostPulse =
    0.82 +
    0.18 * sin(uTime * 1.35);

  vec3 ghostColor =
    mix(
      vec3(0.08, 0.78, 0.88),
      vec3(0.30, 1.00, 0.72),
      0.46 + 0.18 * sin(uTime * 0.95)
    );

  color +=
    ghostColor *
    (
      nearGlow * 0.72 +
      farGlow * 0.34
    ) *
    ghostPulse *
    uRimStrength;

  // Mantém a leitura da arte original.
  color = saturateColor(color, 1.045);

  float auraAlpha =
    nearGlow * 0.42 +
    farGlow * 0.18;

  float alpha =
    max(
      base.a,
      auraAlpha * ghostPulse
    );

  finalColor = vec4(
    clamp(color, 0.0, 1.0),
    alpha
  );
}
`;

export class HalloweenShipFilter extends Filter {
  constructor() {
    super({
      glProgram: GlProgram.from({
        vertex: VERTEX_SHADER,
        fragment: FRAGMENT_SHADER
      }),
      resources: {
        halloweenUniforms: {
          uTime: {
            value: 0,
            type: 'f32'
          },
          uGlowStrength: {
            value: 0.95,
            type: 'f32'
          },
          uRimStrength: {
            value: 1.0,
            type: 'f32'
          },
          uHeatStrength: {
            value: 0.0,
            type: 'f32'
          }
        }
      }
    });

    // Filters render through an intermediate texture. Match the game canvas
    // density so the 400x400 directional frame stays crisp on mobile.
    this.resolution = Math.min(
      Math.max(1, Number(globalThis.devicePixelRatio) || 1),
      2
    );
    this.padding = 34;
  }

  update(timeSeconds) {
    this.resources.halloweenUniforms.uniforms.uTime =
      Math.max(
        0,
        Number(timeSeconds) || 0
      );
  }
}
