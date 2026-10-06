import {
  Container,
  Mesh,
  MeshGeometry,
  Shader,
  UniformGroup
} from 'pixi.js';

const clamp = (value, min, max) =>
  Math.min(max, Math.max(min, value));

const distance = (a, b) =>
  Math.hypot(a.x - b.x, a.y - b.y);

const WAKE = Object.freeze({
  opacity: 0.78,
  width: 66,
  length: 240,
  rateMs: 55,
  minSpeed: 35,
  maxSamples: 72
});

const WAKE_VERTEX_SHADER = `#version 300 es
precision highp float;

in vec2 aPosition;
in vec2 aUV;

uniform vec2 uWakeResolution;
uniform vec2 uWakeCamera;
uniform float uWakeZoom;
uniform float uWakeKind;

out float vAlpha;
out float vKind;
out float vAcross;
out vec2 vWorld;

void main() {
  vec2 screen =
    (aPosition - uWakeCamera) * uWakeZoom +
    uWakeResolution * 0.5;

  vec2 clip = vec2(
    screen.x / max(uWakeResolution.x, 1.0) * 2.0 - 1.0,
    1.0 - screen.y / max(uWakeResolution.y, 1.0) * 2.0
  );

  gl_Position = vec4(clip, 0.0, 1.0);

  vAlpha = aUV.y;
  vKind = uWakeKind;
  vAcross = aUV.x;
  vWorld = aPosition;
}
`;

const WAKE_FRAGMENT_SHADER = `#version 300 es
precision highp float;

uniform float uWakeTime;

in float vAlpha;
in float vKind;
in float vAcross;
in vec2 vWorld;

out vec4 finalColor;

float hash(vec2 p) {
  return fract(
    sin(dot(p, vec2(127.1, 311.7))) *
    43758.5453123
  );
}

void main() {
  float across = abs(vAcross);
  float edge =
    1.0 - smoothstep(0.62, 1.0, across);

  float n1 = hash(
    floor(vWorld * 0.075) +
    floor(uWakeTime * 2.0)
  );

  float n2 = hash(
    floor(vWorld.yx * 0.13) +
    vec2(floor(uWakeTime * 3.0), 0.0)
  );

  float noise = mix(n1, n2, 0.45);

  float rail = step(0.5, vKind);

  float foamMask = mix(
    edge * (0.42 + noise * 0.58),
    (0.62 + edge * 0.38) *
      (0.68 + noise * 0.32),
    rail
  );

  float alpha = vAlpha * foamMask;

  if (alpha < 0.008) {
    discard;
  }

  vec3 centerColor = vec3(
    0.62,
    0.86,
    0.95
  );

  vec3 railColor = vec3(
    0.90,
    0.98,
    1.0
  );

  vec3 color = mix(
    centerColor,
    railColor,
    rail
  );

  color *= 0.90 + noise * 0.18;

  finalColor = vec4(color, alpha);
}
`;

function createStrip(kind) {
  const geometry = new MeshGeometry({
    positions: new Float32Array([0, 0, 0, 0, 0, 0]),
    uvs: new Float32Array([0, 0, 0, 0, 0, 0]),
    indices: new Uint32Array([0, 1, 2])
  });

  const uniforms = new UniformGroup({
    uWakeResolution: {
      value: new Float32Array([1, 1]),
      type: 'vec2<f32>'
    },
    uWakeCamera: {
      value: new Float32Array([0, 0]),
      type: 'vec2<f32>'
    },
    uWakeZoom: {
      value: 1,
      type: 'f32'
    },
    uWakeTime: {
      value: 0,
      type: 'f32'
    },
    uWakeKind: {
      value: kind,
      type: 'f32'
    }
  });

  const shader = Shader.from({
    gl: {
      vertex: WAKE_VERTEX_SHADER,
      fragment: WAKE_FRAGMENT_SHADER
    },
    resources: {
      wakeUniforms: uniforms
    }
  });

  const mesh = new Mesh({
    geometry,
    shader
  });

  mesh.eventMode = 'none';
  mesh.visible = false;

  return {
    geometry,
    uniforms,
    mesh
  };
}

export class ShipWakeRenderer {
  constructor({ shipHeight = 116 } = {}) {
    this.view = new Container();
    this.shipHeight = shipHeight;

    this.samples = [];
    this.elapsedMs = 0;
    this.lastSampleMs = -Infinity;

    this.center = createStrip(0);
    this.leftRail = createStrip(1);
    this.rightRail = createStrip(1);

    this.view.addChild(
      this.center.mesh,
      this.leftRail.mesh,
      this.rightRail.mesh
    );

    this.view.eventMode = 'none';
  }

  update(transform, movement, dt) {
    this.elapsedMs += Math.max(0, Number(dt) || 0) * 1000;

    const speed = Math.max(
      0,
      Number(movement?.speed) || 0
    );

    const maxSpeed = Math.max(
      120,
      Number(movement?.maxSpeed) || 320
    );

    const lifetime = clamp(
      1100 + WAKE.length * 6.2,
      1600,
      6200
    );

    this.samples = this.samples.filter(
      (sample) =>
        this.elapsedMs - Number(sample.time || 0) <
        lifetime
    );

    if (
      !transform ||
      speed < WAKE.minSpeed ||
      this.elapsedMs - this.lastSampleMs <
        WAKE.rateMs
    ) {
      return;
    }

    this.lastSampleMs = this.elapsedMs;

    const angle =
      Number(transform.rotation || 0) *
      Math.PI / 180;

    const forwardX = Math.sin(angle);
    const forwardY = -Math.cos(angle);

    const sternDistance =
      this.shipHeight * 0.35 + 8;

    const sample = {
      x:
        Number(transform.x || 0) -
        forwardX * sternDistance,
      y:
        Number(transform.y || 0) -
        forwardY * sternDistance,
      heading: Number(transform.rotation || 0),
      speedFactor: clamp(
        speed / maxSpeed,
        0.18,
        1
      ),
      time: this.elapsedMs
    };

    const list = this.samples;
    const previous = list[list.length - 1];

    if (
      !previous ||
      distance(previous, sample) >= 4
    ) {
      list.push(sample);
    }

    let totalDistance = 0;
    let keepFrom = Math.max(
      0,
      list.length - 1
    );

    const maxPath =
      WAKE.length *
      (0.95 + sample.speedFactor * 0.38);

    for (
      let i = list.length - 1;
      i > 0;
      i -= 1
    ) {
      totalDistance += distance(
        list[i],
        list[i - 1]
      );

      keepFrom = i - 1;

      if (totalDistance >= maxPath) {
        break;
      }
    }

    if (keepFrom > 0) {
      list.splice(0, keepFrom);
    }

    if (list.length > WAKE.maxSamples) {
      list.splice(
        0,
        list.length - WAKE.maxSamples
      );
    }
  }

  buildStrip(kind, side, lifetime) {
    const positions = [];
    const uvs = [];

    const pushVertex = (
      x,
      y,
      alpha,
      across
    ) => {
      positions.push(x, y);
      uvs.push(across, alpha);
    };

    const section = (
      sample,
      index
    ) => {
      const count = Math.max(
        2,
        this.samples.length
      );

      const pathAge =
        1 - index / (count - 1);

      const timeAge = clamp(
        (
          this.elapsedMs -
          Number(sample.time || this.elapsedMs)
        ) / lifetime,
        0,
        1
      );

      const age = clamp(
        Math.max(
          pathAge * 0.72,
          timeAge
        ),
        0,
        1
      );

      const life = Math.pow(
        Math.max(0, 1 - age),
        1.08
      );

      const speedFactor = clamp(
        Number(sample.speedFactor) || 0.4,
        0.15,
        1
      );

      const spread =
        WAKE.width *
        (0.58 + age * 0.92);

      const rad =
        Number(sample.heading || 0) *
        Math.PI / 180;

      const rightX = Math.cos(rad);
      const rightY = Math.sin(rad);

      const railCenter =
        side * spread * 0.31;

      const halfWidth =
        kind > 0.5
          ? Math.max(
              2.6,
              spread *
                (0.050 + age * 0.028)
            )
          : Math.max(
              6,
              spread *
                (0.19 + age * 0.13)
            );

      const offset =
        kind > 0.5
          ? railCenter
          : 0;

      const cx =
        Number(sample.x || 0) +
        rightX * offset;

      const cy =
        Number(sample.y || 0) +
        rightY * offset;

      const alpha =
        WAKE.opacity *
        life *
        speedFactor *
        (kind > 0.5 ? 0.98 : 0.34);

      return {
        left: {
          x: cx - rightX * halfWidth,
          y: cy - rightY * halfWidth
        },
        right: {
          x: cx + rightX * halfWidth,
          y: cy + rightY * halfWidth
        },
        alpha
      };
    };

    for (
      let i = 0;
      i < this.samples.length - 1;
      i += 1
    ) {
      const a = section(
        this.samples[i],
        i
      );

      const b = section(
        this.samples[i + 1],
        i + 1
      );

      if (
        a.alpha <= 0.002 &&
        b.alpha <= 0.002
      ) {
        continue;
      }

      pushVertex(
        a.left.x,
        a.left.y,
        a.alpha,
        -1
      );

      pushVertex(
        a.right.x,
        a.right.y,
        a.alpha,
        1
      );

      pushVertex(
        b.left.x,
        b.left.y,
        b.alpha,
        -1
      );

      pushVertex(
        b.left.x,
        b.left.y,
        b.alpha,
        -1
      );

      pushVertex(
        a.right.x,
        a.right.y,
        a.alpha,
        1
      );

      pushVertex(
        b.right.x,
        b.right.y,
        b.alpha,
        1
      );
    }

    const vertexCount =
      positions.length / 2;

    const indices =
      new Uint32Array(vertexCount);

    for (
      let i = 0;
      i < vertexCount;
      i += 1
    ) {
      indices[i] = i;
    }

    return {
      positions: new Float32Array(positions),
      uvs: new Float32Array(uvs),
      indices
    };
  }

  syncStrip(
    strip,
    data,
    camera
  ) {
    strip.mesh.visible =
      data.positions.length >= 6;

    if (!strip.mesh.visible) {
      return;
    }

    strip.geometry.positions =
      data.positions;

    strip.geometry.uvs =
      data.uvs;

    strip.geometry.indices =
      data.indices;

    const uniforms =
      strip.uniforms.uniforms;

    const resolution =
      uniforms.uWakeResolution;

    resolution[0] =
      Math.max(
        1,
        Number(camera.width) || 1
      );

    resolution[1] =
      Math.max(
        1,
        Number(camera.height) || 1
      );

    const cameraUniform =
      uniforms.uWakeCamera;

    cameraUniform[0] =
      Number(camera.x) || 0;

    cameraUniform[1] =
      Number(camera.y) || 0;

    uniforms.uWakeZoom =
      Math.max(
        0.1,
        Number(camera.zoom) || 1
      );

    uniforms.uWakeTime =
      this.elapsedMs / 1000;
  }

  render(camera = {}) {
    const lifetime = clamp(
      1100 + WAKE.length * 6.2,
      1600,
      6200
    );

    if (this.samples.length < 2) {
      this.center.mesh.visible = false;
      this.leftRail.mesh.visible = false;
      this.rightRail.mesh.visible = false;
      return;
    }

    this.syncStrip(
      this.center,
      this.buildStrip(
        0,
        0,
        lifetime
      ),
      camera
    );

    this.syncStrip(
      this.leftRail,
      this.buildStrip(
        1,
        -1,
        lifetime
      ),
      camera
    );

    this.syncStrip(
      this.rightRail,
      this.buildStrip(
        1,
        1,
        lifetime
      ),
      camera
    );
  }
}
