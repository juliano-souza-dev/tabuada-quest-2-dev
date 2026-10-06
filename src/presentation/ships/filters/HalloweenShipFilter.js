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

float luminance(vec3 c) {
  return dot(c, vec3(0.299, 0.587, 0.114));
}

float emissionMask(vec4 sampleColor) {
  vec3 c = sampleColor.rgb;
  float l = luminance(c);

  float orange =
    smoothstep(0.12, 0.72, c.r - c.b) *
    smoothstep(0.02, 0.50, c.g - c.b * 0.52);

  float hot =
    smoothstep(0.30, 0.78, l) *
    smoothstep(0.46, 0.98, c.r);

  return orange * hot * sampleColor.a;
}

float bloomAt(vec2 uv, vec2 texel, float radius) {
  vec2 r = texel * radius;

  float sum = 0.0;
  sum += emissionMask(texture(uTexture, uv + vec2( r.x, 0.0)));
  sum += emissionMask(texture(uTexture, uv + vec2(-r.x, 0.0)));
  sum += emissionMask(texture(uTexture, uv + vec2(0.0,  r.y)));
  sum += emissionMask(texture(uTexture, uv + vec2(0.0, -r.y)));

  sum += emissionMask(texture(uTexture, uv + vec2( r.x,  r.y)));
  sum += emissionMask(texture(uTexture, uv + vec2(-r.x,  r.y)));
  sum += emissionMask(texture(uTexture, uv + vec2( r.x, -r.y)));
  sum += emissionMask(texture(uTexture, uv + vec2(-r.x, -r.y)));

  return sum * 0.125;
}

void main() {
  vec2 uv = vTextureCoord;
  vec2 texel = uInputSize.zw;

  vec4 base = texture(uTexture, uv);
  float emit = emissionMask(base);

  float flicker =
    0.86 +
    0.09 * sin(uTime * 5.4 + uv.y * 31.0) +
    0.05 * sin(uTime * 9.1 + uv.x * 47.0);

  float bloomNear = bloomAt(uv, texel, 3.5);
  float bloomMid  = bloomAt(uv, texel, 7.5);
  float bloomFar  = bloomAt(uv, texel, 13.0);

  float bloom =
    bloomNear * 0.78 +
    bloomMid  * 0.48 +
    bloomFar  * 0.24;

  vec3 coreColor =
    mix(
      vec3(1.00, 0.18, 0.01),
      vec3(1.00, 0.92, 0.34),
      smoothstep(0.25, 0.92, luminance(base.rgb))
    );

  vec3 bloomColor =
    mix(
      vec3(1.00, 0.12, 0.00),
      vec3(1.00, 0.52, 0.03),
      0.58
    );

  vec3 color = base.rgb;

  // Faz olhos, bocas, lanternas e detalhes quentes parecerem fontes de luz.
  color +=
    coreColor *
    emit *
    flicker *
    uGlowStrength *
    1.18;

  // Bloom macio fora das áreas emissivas, sem outline.
  color +=
    bloomColor *
    bloom *
    flicker *
    uGlowStrength *
    0.88;

  // Pequeno reforço de contraste para o fogo parecer mais luminoso
  // sem lavar o casco inteiro.
  float baseLum = luminance(base.rgb);
  color *= mix(
    0.94,
    1.04,
    smoothstep(0.16, 0.72, baseLum)
  );

  float bloomAlpha =
    clamp(
      bloom * flicker * 0.52,
      0.0,
      0.68
    );

  float alpha = max(base.a, bloomAlpha);

  vec3 finalRgb = clamp(color, 0.0, 1.0);

  // Saída premultiplicada para composição correta no Pixi.
  finalColor = vec4(
    finalRgb * alpha,
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
            value: 1.0,
            type: 'f32'
          }
        }
      }
    });

    this.resolution = Math.min(
      Math.max(
        1,
        Number(globalThis.devicePixelRatio) || 1
      ),
      2
    );

    this.padding = 48;
  }

  update(timeSeconds) {
    this.resources.halloweenUniforms.uniforms.uTime =
      Math.max(
        0,
        Number(timeSeconds) || 0
      );
  }
}
