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

  // Distorção mínima e localizada no eixo vertical.
  float heatWave =
    sin(uv.y * 58.0 + uTime * 2.15) *
    sin(uv.x * 19.0 - uTime * 1.35);

  vec2 heatOffset = vec2(
    heatWave * texel.x * 0.85,
    heatWave * texel.y * 0.22
  ) * uHeatStrength;

  vec4 base = texture(
    uTexture,
    clamp(
      uv + heatOffset,
      vec2(0.001),
      vec2(0.999)
    )
  );

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

  // Contorno mágico usando apenas vizinhos do alpha.
  float alphaNear = 0.0;

  alphaNear = max(
    alphaNear,
    texture(
      uTexture,
      uv + vec2(texel.x * 2.0, 0.0)
    ).a
  );

  alphaNear = max(
    alphaNear,
    texture(
      uTexture,
      uv - vec2(texel.x * 2.0, 0.0)
    ).a
  );

  alphaNear = max(
    alphaNear,
    texture(
      uTexture,
      uv + vec2(0.0, texel.y * 2.0)
    ).a
  );

  alphaNear = max(
    alphaNear,
    texture(
      uTexture,
      uv - vec2(0.0, texel.y * 2.0)
    ).a
  );

  alphaNear = max(
    alphaNear,
    texture(
      uTexture,
      uv + texel * vec2(1.45, 1.45)
    ).a
  );

  alphaNear = max(
    alphaNear,
    texture(
      uTexture,
      uv + texel * vec2(-1.45, 1.45)
    ).a
  );

  float rim =
    max(0.0, alphaNear - base.a) *
    uRimStrength;

  vec3 rimColor =
    mix(
      vec3(0.78, 0.08, 0.94),
      vec3(1.00, 0.14, 0.42),
      0.36 + 0.16 * sin(uTime * 1.45)
    );

  color += rimColor * rim * 0.82;

  // Mantém a leitura da arte original.
  color = saturateColor(color, 1.045);

  float alpha =
    max(
      base.a,
      rim * 0.72
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
            value: 0.72,
            type: 'f32'
          },
          uHeatStrength: {
            value: 0.52,
            type: 'f32'
          }
        }
      }
    });

    this.padding = 18;
  }

  update(timeSeconds) {
    this.resources.halloweenUniforms.uniforms.uTime =
      Math.max(
        0,
        Number(timeSeconds) || 0
      );
  }
}
