import * as THREE from "three";
import { createPortalMaterial } from "./PortalMaterial.js";
import { createPortalParticles } from "./PortalParticles.js";
import { createPortalText } from "./PortalText.js";

export class Portal extends THREE.Group {
  constructor() {
    super();

    // Portal surface
    this.material = createPortalMaterial();
    this.mesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.material);
    this.mesh.renderOrder = 1;
    this.add(this.mesh);

    // Particles
    this.particles = createPortalParticles(800);
    this.add(this.particles);

    // Text layers (Outer + Inner)
    this.textInner = createPortalText({
      text: "NoHack",
      fontSize: 0.28,
      color: "#F2FEFF",
      glow: "#7EDCFF",
      lightning: "#D6F6FF",

      outline: 0.11,
      boltSpeed: 2.4,
      boltWidth: 0.48,
      branching: 0.55,
      boltIntensity: 1.35,
      horzDistort: 0.04
    });

    this.textOuter = createPortalText({
      text: "NoHack",
      fontSize: 0.28,
      color: "#DFF8FF",
      glow: "#6EDBFF",
      lightning: "#B6EFFF",

      outline: 0.17,
      boltSpeed: 1.4,
      boltWidth: 0.70,
      branching: 0.80,
      boltIntensity: 0.95,
      horzDistort: 0.028
    });

    // Position inside portal
    this.textInner.position.set(0, 0.08, 0.018);
    this.textOuter.position.set(0, 0.08, 0.012);
    this.textOuter.scale.set(1.03, 1.03, 1);

    this.textOuter.renderOrder = 9;
    this.textInner.renderOrder = 10;

    this.add(this.textOuter);
    this.add(this.textInner);

    // Billboard control (optional)
    this.billboardText = true;
  }

  resize(width, height) {
    this.material.uniforms.uResolution.value.set(width, height);
  }

  update(timeSeconds, camera) {
    this.material.uniforms.uTime.value = timeSeconds;
    this.particles.material.uniforms.uTime.value = timeSeconds;

    this.textOuter.userData.update(timeSeconds);
    this.textInner.userData.update(timeSeconds);

    if (this.billboardText && camera) {
      this.textOuter.quaternion.copy(camera.quaternion);
      this.textInner.quaternion.copy(camera.quaternion);
    }
  }
}
