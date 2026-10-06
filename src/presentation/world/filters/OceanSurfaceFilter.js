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
uniform float uDistortion;
uniform float uFoam;
uniform float uSparkle;
uniform float uMotion;


float hash21(vec2 p) {
  p = fract(p * vec2(123.34, 345.45));
  p += dot(p, p + 34.345);
  return fract(p.x * p.y);
}

vec3 boostSaturation(vec3 color, float amount) {
  float luma = dot(color, vec3(0.299, 0.587, 0.114));
  return mix(vec3(luma), color, amount);
}

void main() {
  vec2 uv = vTextureCoord;
  float t = uTime;

  float longWave =
    sin(uv.y * 21.0 + uv.x * 6.0 + t * (0.54 + uMotion * 0.18));

  float crossWave =
    cos(uv.x * 17.0 - uv.y * 11.0 - t * (0.39 + uMotion * 0.12));

  float smallWave =
    sin((uv.x + uv.y) * 36.0 + t * (0.82 + uMotion * 0.22));

  vec2 offset = vec2(
    longWave * 0.62 + smallWave * 0.38,
    crossWave * 0.66 - smallWave * 0.34
  ) * uDistortion;

  vec2 sampleUv = clamp(uv + offset, vec2(0.002), vec2(0.998));

  vec3 base = texture(uTexture, sampleUv).rgb;

  vec2 secondaryUv = clamp(
    uv + vec2(
      crossWave * uDistortion * 0.55,
      longWave * uDistortion * 0.42
    ),
    vec2(0.002),
    vec2(0.998)
  );

  vec3 secondary = texture(uTexture, secondaryUv).rgb;

  float crestSignal =
    0.52 +
    longWave * 0.24 +
    crossWave * 0.16 +
    smallWave * 0.08;

  float crest = smoothstep(0.61, 0.93, crestSignal);

  float foamBand =
    0.5 +
    0.5 * sin(
      uv.y * 63.0 +
      uv.x * 24.0 +
      t * (1.02 + uMotion * 0.28) +
      longWave * 1.3
    );

  float foamMask =
    smoothstep(0.80, 0.98, foamBand) *
    smoothstep(0.46, 0.88, crest) *
    uFoam;

  vec2 sparkleGrid = uv * vec2(42.0, 34.0);
  vec2 sparkleCell = floor(sparkleGrid);
  vec2 sparkleLocal = fract(sparkleGrid) - 0.5;
  float sparkleSeed = hash21(sparkleCell);
  float sparklePulse =
    0.5 +
    0.5 * sin(t * (1.2 + sparkleSeed * 1.8) + sparkleSeed * 6.2831853);

  float sparkleShape =
    1.0 - smoothstep(0.025, 0.14, length(sparkleLocal));

  float sparkle =
    sparkleShape *
    sparklePulse *
    step(0.90, sparkleSeed) *
    smoothstep(0.40, 0.92, crestSignal) *
    uSparkle;

  vec3 color = mix(base, secondary, 0.18 + crest * 0.08);

  color = mix(
    color,
    vec3(0.86, 0.98, 1.0),
    clamp(foamMask * 0.34, 0.0, 0.42)
  );

  color += vec3(1.0, 0.86, 0.52) * sparkle * 0.28;
  color += vec3(0.16, 0.44, 0.55) * crest * 0.055;

  color = boostSaturation(color, 1.04);
  color = (color - 0.5) * 1.025 + 0.5;

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
          uDistortion: { value: 0.0062, type: 'f32' },
          uFoam: { value: 0.72, type: 'f32' },
          uSparkle: { value: 0.62, type: 'f32' },
          uMotion: { value: 0.68, type: 'f32' }
        }
      }
    });

    this.padding = 12;
  }

  update(timeSeconds) {
    this.resources.oceanUniforms.uniforms.uTime = timeSeconds;
  }
}
