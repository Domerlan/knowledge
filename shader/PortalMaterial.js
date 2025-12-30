import * as THREE from "three";

export function createPortalMaterial() {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,

    uniforms: {
      uTime: { value: 0 },
      uResolution: { value: new THREE.Vector2(1, 1) },

      // Colors (HEX)
      uCoreColor: { value: new THREE.Color("#4FC3FF") },
      uEdgeColor: { value: new THREE.Color("#1E6BFF") },
      uGlowColor: { value: new THREE.Color("#B6EFFF") },

      // Controls (AE-like)
      uRadius: { value: 0.42 },
      uWaveAmp: { value: 0.02 },
      uWaveFreq: { value: 18.0 },
      uSpeed: { value: 1.0 }
    },

    vertexShader: `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,

    fragmentShader: `
      precision highp float;

      varying vec2 vUv;
      uniform float uTime;
      uniform vec2 uResolution;

      uniform vec3 uCoreColor;
      uniform vec3 uEdgeColor;
      uniform vec3 uGlowColor;

      uniform float uRadius;
      uniform float uWaveAmp;
      uniform float uWaveFreq;
      uniform float uSpeed;

      float hash(vec2 p) {
        return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
      }

      float noise(vec2 p) {
        vec2 i = floor(p);
        vec2 f = fract(p);
        f = f*f*(3.0-2.0*f);

        float a = hash(i);
        float b = hash(i + vec2(1.0,0.0));
        float c = hash(i + vec2(0.0,1.0));
        float d = hash(i + vec2(1.0,1.0));

        return mix(a, b, f.x) +
               (c - a)*f.y*(1.0 - f.x) +
               (d - b)*f.x*f.y;
      }

      void main() {
        vec2 uv = vUv - 0.5;
        uv.x *= uResolution.x / uResolution.y;

        float t = uTime * uSpeed;
        float r = length(uv);
        float a = atan(uv.y, uv.x);

        // swirl
        a += r * 5.0 - t * 0.4;

        // wave
        float n = noise(vec2(a * 1.2, r * 4.0 - t));
        float wave = sin(r * uWaveFreq - t * 2.2 + n * 2.0) * uWaveAmp;
        float radius = uRadius + wave;

        // inner mask
        float inner = smoothstep(radius, radius - 0.012, r);

        // edge band
        float edge =
          smoothstep(radius - 0.01, radius + 0.004, r) -
          smoothstep(radius + 0.004, radius + 0.02, r);
        edge = clamp(edge, 0.0, 1.0);

        // color
        float depth = smoothstep(0.0, radius, r);
        vec3 color = mix(uCoreColor, uEdgeColor, depth);
        color += uGlowColor * edge * 1.6;

        float alpha = inner + edge;

        gl_FragColor = vec4(color, alpha);
      }
    `
  });
}
