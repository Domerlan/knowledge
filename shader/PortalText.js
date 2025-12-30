import * as THREE from "three";
import { Text } from "troika-three-text";

/**
 * Создает 1 слой текста (troika SDF) с:
 * - легким плаванием (vertex)
 * - горизонтальной динамикой (fragment)
 * - молнией, бегущей по контуру (fragment, через dFdx/dFdy)
 *
 * Для итогового эффекта используйте 2 слоя: Inner + Outer (с разными параметрами).
 */
export function createPortalText({
  text = "NoHack",
  fontSize = 0.28,

  color = "#EAFBFF",
  glow = "#7EDCFF",
  lightning = "#B6EFFF",

  outline = 0.12,
  boltSpeed = 1.8,
  boltWidth = 0.55,
  branching = 0.65,
  boltIntensity = 1.1,
  horzDistort = 0.035,

  floatAmp = 0.015,
  floatSpeed = 1.2
} = {}) {
  const t = new Text();
  t.text = text;
  t.fontSize = fontSize;
  t.color = color;
  t.anchorX = "center";
  t.anchorY = "middle";
  t.sync();

  // clone base troika material
  t.material = t.material.clone();
  t.material.transparent = true;
  t.material.depthWrite = false;
  t.material.blending = THREE.AdditiveBlending;
  t.material.extensions = { derivatives: true }; // REQUIRED for dFdx/dFdy
  t.renderOrder = 10;

  t.material.userData.u = {
    uTime: { value: 0 },

    uCore: { value: new THREE.Color(color) },
    uGlow: { value: new THREE.Color(glow) },
    uBolt: { value: new THREE.Color(lightning) },

    uFloatAmp: { value: floatAmp },
    uFloatSpeed: { value: floatSpeed },

    uHorzDistort: { value: horzDistort },
    uBoltIntensity: { value: boltIntensity },
    uOutline: { value: outline },

    uBoltSpeed: { value: boltSpeed },
    uBoltWidth: { value: boltWidth },
    uBranching: { value: branching }
  };

  t.material.onBeforeCompile = (shader) => {
    // uniforms bridge
    shader.uniforms.uTime = t.material.userData.u.uTime;
    shader.uniforms.uCore = t.material.userData.u.uCore;
    shader.uniforms.uGlow = t.material.userData.u.uGlow;
    shader.uniforms.uBolt = t.material.userData.u.uBolt;

    shader.uniforms.uFloatAmp = t.material.userData.u.uFloatAmp;
    shader.uniforms.uFloatSpeed = t.material.userData.u.uFloatSpeed;

    shader.uniforms.uHorzDistort = t.material.userData.u.uHorzDistort;
    shader.uniforms.uBoltIntensity = t.material.userData.u.uBoltIntensity;
    shader.uniforms.uOutline = t.material.userData.u.uOutline;

    shader.uniforms.uBoltSpeed = t.material.userData.u.uBoltSpeed;
    shader.uniforms.uBoltWidth = t.material.userData.u.uBoltWidth;
    shader.uniforms.uBranching = t.material.userData.u.uBranching;

    // --- vertex: float motion ---
    shader.vertexShader = shader.vertexShader.replace(
      "void main() {",
      `
      uniform float uTime;
      uniform float uFloatAmp;
      uniform float uFloatSpeed;
      void main() {
      `
    );

    shader.vertexShader = shader.vertexShader.replace(
      "#include <begin_vertex>",
      `
      #include <begin_vertex>
      transformed.y += sin(uTime * uFloatSpeed + position.x * 6.0) * uFloatAmp;
      transformed.x += cos(uTime * (uFloatSpeed * 0.8) + position.y * 5.0) * (uFloatAmp * 0.6);
      `
    );

    // --- fragment: contour traveling bolt ---
    shader.fragmentShader = shader.fragmentShader.replace(
      "void main() {",
      `
      uniform float uTime;
      uniform vec3 uCore;
      uniform vec3 uGlow;
      uniform vec3 uBolt;

      uniform float uHorzDistort;
      uniform float uBoltIntensity;
      uniform float uOutline;

      uniform float uBoltSpeed;
      uniform float uBoltWidth;
      uniform float uBranching;

      float hash21(vec2 p){
        p = fract(p*vec2(123.34, 345.45));
        p += dot(p, p+34.345);
        return fract(p.x*p.y);
      }
      float noise(vec2 p){
        vec2 i = floor(p);
        vec2 f = fract(p);
        vec2 u = f*f*(3.0-2.0*f);
        float a = hash21(i);
        float b = hash21(i + vec2(1.0,0.0));
        float c = hash21(i + vec2(0.0,1.0));
        float d = hash21(i + vec2(1.0,1.0));
        return mix(a,b,u.x) + (c-a)*u.y*(1.0-u.x) + (d-b)*u.x*u.y;
      }

      void main() {
      `
    );

    shader.fragmentShader = shader.fragmentShader.replace(
      "gl_FragColor = vec4( outgoingLight, diffuseColor.a );",
      `
      vec3 base = uCore;
      float aText = diffuseColor.a;

      // edge region around the SDF boundary
      float edge = smoothstep(0.0, uOutline, aText) - smoothstep(uOutline, uOutline + 0.18, aText);
      edge = clamp(edge, 0.0, 1.0);

      // contour direction via alpha derivatives
      vec2 g = vec2(dFdx(aText), dFdy(aText));
      float glen = max(length(g), 1e-6);
      vec2 nrm = g / glen;            // normal
      vec2 tan = vec2(-nrm.y, nrm.x); // tangent (along contour)

      vec2 p = vUv;

      // horizontal energy wobble
      float horz = sin((p.y * 40.0) + uTime * 6.0) * uHorzDistort;
      p.x += horz;

      // traveling head along tangent
      float travelCoord = dot(p, tan) * 40.0 + uTime * 10.0 * uBoltSpeed;
      float head = fract(travelCoord);
      head = smoothstep(0.0, 0.15, head) * (1.0 - smoothstep(0.55, 1.0, head));

      // jaggedness + branching
      float n1 = noise(p * vec2(60.0, 35.0) + tan * uTime * 6.0);
      float n2 = noise(p * vec2(120.0, 70.0) - tan * uTime * 9.0);
      float jag = mix(n1, n2, 0.5);

      float branchMask = step(0.72 + (1.0 - uBranching) * 0.2, noise(p * 30.0 + uTime * 2.0));

      float boltCore = smoothstep(0.55 - uBoltWidth * 0.25, 0.95, jag) * head;
      float bolt = boltCore * edge;
      bolt += boltCore * edge * branchMask * 0.65;

      bolt *= uBoltIntensity;

      vec3 glow = uGlow * edge * 2.2;
      vec3 bolts = uBolt * bolt * 3.2;

      vec3 outCol = base + glow + bolts;
      float outA = clamp(aText + edge*0.35 + bolt*0.45, 0.0, 1.0);

      gl_FragColor = vec4(outCol, outA);
      `
    );
  };

  // small forward offset to avoid z-fighting with portal surface
  t.position.z = 0.01;

  t.userData.update = (timeSeconds) => {
    t.material.userData.u.uTime.value = timeSeconds;
  };

  return t;
}
