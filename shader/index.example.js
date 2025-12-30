/**
 * Example integration (ESM).
 * This file is intentionally minimal: plug into your existing Three.js app.
 */
import * as THREE from "three";
import { Portal } from "./Portal.js";

// Basic scene
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 100);
camera.position.set(0, 0, 4);

const portal = new Portal();
scene.add(portal);

function onResize() {
  renderer.setSize(window.innerWidth, window.innerHeight);
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  portal.resize(window.innerWidth, window.innerHeight);
}
window.addEventListener("resize", onResize);
onResize();

const clock = new THREE.Clock();

function animate() {
  const t = clock.getElapsedTime();
  portal.update(t, camera);

  renderer.render(scene, camera);
  requestAnimationFrame(animate);
}
animate();
