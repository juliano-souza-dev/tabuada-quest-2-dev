import { Filter, GlProgram } from 'pixi.js';

const VERTEX_SHADER = `
precision highp float;

in vec2 aPosition;
out vec2 vTextureCoord;

uniform vec4 uInputSize;
uniform vec4 uOutputFrame;
uniform vec4 uOutputTexture;

vec4 filterVertexPosition() {
  vec2 position = aPosition * uOutputFrame.zw + uOutputFrame.xy;
  position.x = position.x * (2.0 / uOutputTexture.x) - 1.0;
  position.y = position.y * (2.0 * uOutputTexture.z / uOutputTexture.y) - uOutputTexture.z;
  return vec4(position, 0.0, 1.0);
}

vec2 filterTextureCoord() {
  return aPosition * (uOutputFrame.zw * uInputSize.zw);
}

void main() {
  gl_Position = filterVertexPosition();
  vTextureCoord = filterTextureCoord();
}
`;

const FRAGMENT_SHADER = `
precision highp float;

in vec2 vTextureCoord;

uniform sampler2D uTexture;
uniform float uTime;
uniform float uWorldLeft;
uniform float uWorldTop;
uniform float uWorldWidth;
uniform float uWorldHeight;

float hash21(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
}

vec3 saturateColor(vec3 color, float amount) {
  float luma = dot(color, vec3(0.299, 0.587, 0.114));
  return mix(vec3(luma), color, amount);
}

void main() {
  vec2 uv = vTextureCoord;

  // Mesmo conceito do oceano antigo: uma única textura alimenta
  // profundidade, ondas e espuma. A câmera nunca altera a velocidade.
  const float speed = 28.0;
  const float swell = 28.0;
  const float distortion = 48.0;
  const float waveMix = 34.0;
  const float foamMix = 20.0;
  const float sparkleIntensity = 34.0;
  const float sparkleSharpness = 18.0;
  const float tileSize = 720.0;

  vec2 world = vec2(
    uWorldLeft + uv.x * uWorldWidth,
    uWorldTop + uv.y * uWorldHeight
  );

  vec2 baseCoord = world / tileSize;
  float motion = uTime * (0.025 + speed * 0.0015);

  vec2 dir = normalize(vec2(0.82, 0.32));

  float waveA = sin(
    baseCoord.y * 18.0 +
    baseCoord.x * (18.0 * 0.22) +
    uTime * (0.45 + speed * 0.006)
  );

  float waveB = cos(
    baseCoord.x * 15.0 -
    baseCoord.y * (15.0 * 0.46) +
    uTime * (0.34 + speed * 0.004)
  );

  float swellAmount = 0.0015 + swell * 0.000045;
  float distortionStrength = 0.15 + distortion * 0.0125;

  vec2 distortionOffset =
    vec2(waveA, waveB) *
    swellAmount *
    distortionStrength;

  // A base permanece reconhecível. As outras duas leituras da MESMA
  // textura criam movimento superficial, não um novo background.
  vec2 deepUv = clamp(
    uv + dir * motion * 0.010 + distortionOffset * 0.45,
    vec2(0.002),
    vec2(0.998)
  );

  vec2 waveUv = clamp(
    uv + dir.yx * motion * 0.017 + distortionOffset,
    vec2(0.002),
    vec2(0.998)
  );

  vec2 foamUv = clamp(
    uv - dir * motion * 0.024 + distortionOffset * 1.55,
    vec2(0.002),
    vec2(0.998)
  );

  vec3 deep = texture(uTexture, deepUv).rgb;
  vec3 wave = texture(uTexture, waveUv).rgb;
  vec3 foamTexture = texture(uTexture, foamUv).rgb;

  float crest = smoothstep(
    0.40,
    0.95,
    0.5 + 0.5 * sin(
      baseCoord.x * 24.0 +
      baseCoord.y * 19.0 +
      uTime * (0.8 + speed * 0.008)
    )
  );

  float waveAmount = clamp(waveMix * 0.01, 0.0, 1.0);
  float foamAmount = clamp(foamMix * 0.01, 0.0, 1.0);

  // Fundo um pouco mais escuro e profundo, como no vídeo antigo.
  vec3 color = deep * vec3(0.82, 0.90, 0.94);

  color = mix(
    color,
    wave * vec3(0.90, 0.97, 1.03),
    clamp(waveAmount * (0.58 + crest * 0.26), 0.0, 0.38)
  );

  color = mix(
    color,
    foamTexture * vec3(1.02, 1.05, 1.06),
    crest * foamAmount * 0.24
  );

  vec2 sparkleGrid = baseCoord * 34.0;
  vec2 sparkleCell = floor(sparkleGrid);
  vec2 sparkleLocal = fract(sparkleGrid) - 0.5;
  float sparkleHash = hash21(sparkleCell);

  float sparklePulse =
    0.5 +
    0.5 * sin(
      uTime * (1.4 + sparkleHash * 1.8) +
      sparkleHash * 6.2831853
    );

  float sparkleCore =
    1.0 - smoothstep(0.03, 0.20, length(sparkleLocal));

  float sparkle = pow(
    max(0.0, sparkleCore * sparklePulse * crest),
    max(2.0, sparkleSharpness * 0.35)
  ) * step(0.84, sparkleHash);

  color +=
    vec3(1.0, 0.86, 0.52) *
    sparkle *
    clamp(sparkleIntensity * 0.01, 0.0, 1.0) *
    0.34;

  color = saturateColor(color, 1.05);
  color = (color - 0.5) * 1.03 + 0.5;
  color *= 1.02;

  gl_FragColor = vec4(clamp(color, 0.0, 1.0), 1.0);
}
`;

export class OceanSurfaceFilter extends Filter {
  constructor() {
    super({
      glProgram: GlProgram.from({
        vertex: VERTEX_SHADER,
        fragment: FRAGMENT_SHADER
      }),
      resources: {
        oceanUniforms: {
          uTime: { value: 0, type: 'f32' },
          uWorldLeft: { value: 0, type: 'f32' },
          uWorldTop: { value: 0, type: 'f32' },
          uWorldWidth: { value: 1, type: 'f32' },
          uWorldHeight: { value: 1, type: 'f32' }
        }
      }
    });

    this.padding = 8;
  }

  setWorldRect(left, top, width, height) {
    const uniforms = this.resources.oceanUniforms.uniforms;
    uniforms.uWorldLeft = Number(left) || 0;
    uniforms.uWorldTop = Number(top) || 0;
    uniforms.uWorldWidth = Math.max(1, Number(width) || 1);
    uniforms.uWorldHeight = Math.max(1, Number(height) || 1);
  }

  update(timeSeconds) {
    this.resources.oceanUniforms.uniforms.uTime =
      Math.max(0, Number(timeSeconds) || 0);
  }
}
