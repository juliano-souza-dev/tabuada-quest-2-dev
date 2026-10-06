import {
  Container,
  Graphics,
  Mesh,
  MeshGeometry,
  Shader,
  UniformGroup
} from 'pixi.js';

const OCEAN_TEXTURE_URL = new URL(
  '../../../assets/oceans/ocean.png',
  import.meta.url
).href;

const OCEAN = Object.freeze({
  directionX: 0.82,
  directionY: 0.32,
  speed: 28,
  swell: 28,
  tileSize: 720,
  brightness: 1.02,
  saturation: 1.05,
  contrast: 1,
  tintR: 1,
  tintG: 1,
  tintB: 1,
  distortion: 48,
  waveFrequencyA: 18,
  waveFrequencyB: 15,
  waveMix: 34,
  foamMix: 20,
  sparkleIntensity: 34,
  sparkleSharpness: 18
});

const VERTEX_SHADER = `#version 300 es
precision highp float;

in vec2 aPosition;
out vec2 vUv;

void main() {
  vUv = aPosition * 0.5 + 0.5;
  gl_Position = vec4(aPosition, 0.0, 1.0);
}
`;

const FRAGMENT_SHADER = `#version 300 es
precision highp float;

uniform sampler2D uTexture;
uniform vec2 uResolution;
uniform vec2 uCamera;
uniform vec2 uDirection;
uniform float uZoom;
uniform float uTime;
uniform float uTileSize;
uniform float uSpeed;
uniform float uSwell;
uniform float uBrightness;
uniform float uSaturation;
uniform float uContrast;
uniform vec3 uTint;
uniform float uDistortion;
uniform float uWaveFrequencyA;
uniform float uWaveFrequencyB;
uniform float uWaveMix;
uniform float uFoamMix;
uniform float uSparkleIntensity;
uniform float uSparkleSharpness;

in vec2 vUv;
out vec4 finalColor;

vec3 saturateColor(vec3 color, float amount) {
  float luma = dot(color, vec3(0.299, 0.587, 0.114));
  return mix(vec3(luma), color, amount);
}

void main() {
  vec2 centered = vec2(vUv.x - 0.5, 0.5 - vUv.y);
  vec2 world = uCamera + centered * (uResolution / max(uZoom, 0.001));
  float tile = max(uTileSize, 64.0);
  vec2 base = world / tile;

  float motion = uTime * (0.025 + uSpeed * 0.0015);
  vec2 dir = normalize(uDirection + vec2(0.0001));

  float freqA = max(2.0, uWaveFrequencyA);
  float freqB = max(2.0, uWaveFrequencyB);

  float waveA = sin(
    (base.y * freqA) +
    (base.x * (freqA * 0.22)) +
    uTime * (0.45 + uSpeed * 0.006)
  );

  float waveB = cos(
    (base.x * freqB) -
    (base.y * (freqB * 0.46)) +
    uTime * (0.34 + uSpeed * 0.004)
  );

  float swell = 0.0015 + uSwell * 0.000045;
  float distortionStrength = 0.15 + uDistortion * 0.0125;
  vec2 distortion = vec2(waveA, waveB) * swell * distortionStrength;

  vec2 uvDeep = fract(
    base * 1.00 +
    dir * motion * 0.35 +
    distortion * 0.45
  );

  vec2 uvWave = fract(
    base * 1.38 +
    dir.yx * motion * 0.58 +
    distortion
  );

  vec2 uvFoam = fract(
    base * 2.15 -
    dir * motion * 0.83 +
    distortion * 1.55
  );

  vec3 deep = texture(uTexture, uvDeep).rgb;
  vec3 wave = texture(uTexture, uvWave).rgb;
  vec3 foam = texture(uTexture, uvFoam).rgb;

  float crest = smoothstep(
    0.40,
    0.95,
    0.5 + 0.5 * sin(
      base.x * 24.0 +
      base.y * 19.0 +
      uTime * (0.8 + uSpeed * 0.008)
    )
  );

  vec2 sparkleGrid = base * 34.0;
  vec2 sparkleCell = floor(sparkleGrid);
  vec2 sparkleLocal = fract(sparkleGrid) - 0.5;

  float sparkleHash = fract(
    sin(dot(sparkleCell, vec2(127.1, 311.7))) *
    43758.5453123
  );

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
    max(2.0, uSparkleSharpness * 0.35)
  ) * step(0.84, sparkleHash);

  float waveAmount = clamp(uWaveMix * 0.01, 0.0, 1.0);
  float foamAmount = clamp(uFoamMix * 0.01, 0.0, 1.0);
  float sparkleAmount = clamp(
    uSparkleIntensity * 0.01,
    0.0,
    1.0
  );

  vec3 color = deep;

  color = mix(
    color,
    wave,
    clamp(
      waveAmount * (0.72 + crest * 0.36),
      0.0,
      1.0
    )
  );

  color = mix(
    color,
    foam,
    crest * foamAmount
  );

  color +=
    vec3(1.0, 0.86, 0.52) *
    sparkle *
    sparkleAmount *
    (0.45 + uSwell * 0.008);

  color *= uBrightness;
  color = saturateColor(color, uSaturation);
  color = (color - 0.5) * uContrast + 0.5;
  color *= uTint;

  finalColor = vec4(clamp(color, 0.0, 1.0), 1.0);
}
`;

export class OceanRenderer {
  constructor() {
    this.view = new Container();
    this.elapsed = 0;
    this.mesh = null;
    this.uniforms = null;

    this.fallback = new Graphics();
    this.fallback.eventMode = 'none';
    this.view.addChild(this.fallback);
  }

  async init(assets) {
    if (!assets || this.mesh) return;

    try {
      const texture = await assets.load(OCEAN_TEXTURE_URL);

      const geometry = new MeshGeometry({
        positions: new Float32Array([
          -1, -1,
           1, -1,
           1,  1,
          -1,  1
        ]),
        uvs: new Float32Array([
          0, 0,
          1, 0,
          1, 1,
          0, 1
        ]),
        indices: new Uint32Array([
          0, 1, 2,
          0, 2, 3
        ])
      });

      this.uniforms = new UniformGroup({
        uResolution: {
          value: new Float32Array([1, 1]),
          type: 'vec2<f32>'
        },
        uCamera: {
          value: new Float32Array([0, 0]),
          type: 'vec2<f32>'
        },
        uDirection: {
          value: new Float32Array([
            OCEAN.directionX,
            OCEAN.directionY
          ]),
          type: 'vec2<f32>'
        },
        uZoom: { value: 1, type: 'f32' },
        uTime: { value: 0, type: 'f32' },
        uTileSize: { value: OCEAN.tileSize, type: 'f32' },
        uSpeed: { value: OCEAN.speed, type: 'f32' },
        uSwell: { value: OCEAN.swell, type: 'f32' },
        uBrightness: { value: OCEAN.brightness, type: 'f32' },
        uSaturation: { value: OCEAN.saturation, type: 'f32' },
        uContrast: { value: OCEAN.contrast, type: 'f32' },
        uTint: {
          value: new Float32Array([
            OCEAN.tintR,
            OCEAN.tintG,
            OCEAN.tintB
          ]),
          type: 'vec3<f32>'
        },
        uDistortion: { value: OCEAN.distortion, type: 'f32' },
        uWaveFrequencyA: {
          value: OCEAN.waveFrequencyA,
          type: 'f32'
        },
        uWaveFrequencyB: {
          value: OCEAN.waveFrequencyB,
          type: 'f32'
        },
        uWaveMix: { value: OCEAN.waveMix, type: 'f32' },
        uFoamMix: { value: OCEAN.foamMix, type: 'f32' },
        uSparkleIntensity: {
          value: OCEAN.sparkleIntensity,
          type: 'f32'
        },
        uSparkleSharpness: {
          value: OCEAN.sparkleSharpness,
          type: 'f32'
        }
      });

      const shader = Shader.from({
        gl: {
          vertex: VERTEX_SHADER,
          fragment: FRAGMENT_SHADER
        },
        resources: {
          uTexture: texture.source,
          oceanUniforms: this.uniforms
        }
      });

      this.mesh = new Mesh({ geometry, shader });
      this.mesh.eventMode = 'none';

      this.view.addChild(this.mesh);
      this.fallback.visible = false;
    } catch (error) {
      console.error('[OceanRenderer] Pixi WebGL ocean failed:', error);
      this.fallback.visible = true;
    }
  }

  setCameraPosition(x, y) {
    if (!this.uniforms) return;
    const camera = this.uniforms.uniforms.uCamera;
    camera[0] = Number(x) || 0;
    camera[1] = Number(y) || 0;
  }

  setZoom(zoom) {
    if (!this.uniforms) return;
    this.uniforms.uniforms.uZoom =
      Math.max(0.1, Number(zoom) || 1);
  }

  resize(width, height) {
    const safeWidth = Math.max(1, Number(width) || 1);
    const safeHeight = Math.max(1, Number(height) || 1);

    if (this.uniforms) {
      const resolution = this.uniforms.uniforms.uResolution;
      resolution[0] = safeWidth;
      resolution[1] = safeHeight;
    }

    if (this.fallback.visible) {
      this.fallback
        .clear()
        .rect(0, 0, safeWidth, safeHeight)
        .fill('#0b4263');
    }
  }

  update(dt) {
    if (!this.uniforms) return;

    this.elapsed += Math.max(0, Number(dt) || 0);
    this.uniforms.uniforms.uTime = this.elapsed;
  }
}
