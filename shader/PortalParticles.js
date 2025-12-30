import * as THREE from "three";

export function createPortalParticles(count = 800) {
  const geometry = new THREE.BufferGeometry();
  const positions = new Float32Array(count * 3);
  const speeds = new Float32Array(count);

  for (let i = 0; i < count; i++) {
    const a = Math.random() * Math.PI * 2;
    const r = Math.random() * 0.4;

    positions[i * 3 + 0] = Math.cos(a) * r;
    positions[i * 3 + 1] = Math.sin(a) * r;
    positions[i * 3 + 2] = 0.0;

    speeds[i] = 0.3 + Math.random() * 0.7;
  }

  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute("speed", new THREE.BufferAttribute(speeds, 1));

  const material = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,

    uniforms: {
      uTime: { value: 0 },
      uColor: { value: new THREE.Color("#AEEBFF") }
    },

    vertexShader: `
      attribute float speed;
      uniform float uTime;

      void main() {
        vec3 p = position;
        float t = uTime * speed;

        // outward + slightly backward in Z
        vec2 dir = normalize(p.xy + vec2(1e-6));
        p.xy += dir * t;
        p.z -= t * 0.4;

        gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
        gl_PointSize = 3.0;
      }
    `,

    fragmentShader: `
      uniform vec3 uColor;
      void main() {
        float d = length(gl_PointCoord - 0.5);
        float alpha = smoothstep(0.5, 0.0, d);
        gl_FragColor = vec4(uColor, alpha);
      }
    `
  });

  const points = new THREE.Points(geometry, material);
  points.renderOrder = 5;
  return points;
}
