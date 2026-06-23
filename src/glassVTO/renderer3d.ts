// =============================================================================
// renderer3d.ts — Three.js renderer for glasses VTO
// =============================================================================

import * as THREE from 'three';
import { createGlassesModel, type GlassesMaterialConfig, type GlassShape } from './glasses3d';
import { type FrameFit } from './jeeliz-math';

export interface Renderer3DState {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  renderer: THREE.WebGLRenderer;
  glassesGroup: THREE.Group | null;
  currentShape: GlassShape | null;
  currentMaterial: GlassesMaterialConfig | null;
  envMap: THREE.Texture | null;
  ambientLight: THREE.AmbientLight;
  keyLight: THREE.DirectionalLight;
  fillLight: THREE.DirectionalLight;
}

export function createRenderer3D(canvas: HTMLCanvasElement): Renderer3DState {
  const renderer = new THREE.WebGLRenderer({
    canvas,
    alpha: true,
    antialias: true,
    preserveDrawingBuffer: true,
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;

  const scene = new THREE.Scene();

  // Camera — matches typical webcam FOV (~60° diagonal)
  const camera = new THREE.PerspectiveCamera(55, 1, 0.01, 10);
  camera.position.set(0, 0, 1.0);
  camera.lookAt(0, 0, 0);

  // Three-point lighting
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
  scene.add(ambientLight);

  const keyLight = new THREE.DirectionalLight(0xffffff, 1.0);
  keyLight.position.set(0.3, 0.5, 0.8);
  scene.add(keyLight);

  const fillLight = new THREE.DirectionalLight(0xffffff, 0.5);
  fillLight.position.set(-0.5, -0.1, 0.3);
  scene.add(fillLight);

  const rimLight = new THREE.DirectionalLight(0xffffff, 0.3);
  rimLight.position.set(0, -0.3, -0.5);
  scene.add(rimLight);

  // Environment map for metallic reflections
  const pmremGenerator = new THREE.PMREMGenerator(renderer);
  pmremGenerator.compileEquirectangularShader();
  const envScene = new THREE.Scene();
  envScene.background = new THREE.Color(0x8899aa);
  const envMap = pmremGenerator.fromScene(envScene).texture;
  scene.environment = envMap;

  return { scene, camera, renderer, glassesGroup: null, currentShape: null, currentMaterial: null, envMap, ambientLight, keyLight, fillLight };
}

export function updateGlassesModel(r3d: Renderer3DState, shape: GlassShape, material: GlassesMaterialConfig): void {
  if (r3d.glassesGroup) {
    r3d.scene.remove(r3d.glassesGroup);
    disposeGroup(r3d.glassesGroup);
    r3d.glassesGroup = null;
  }

  const group = createGlassesModel(shape, {}, material);
  // Face the camera (+Z direction)
  group.rotation.set(0, Math.PI, 0);
  r3d.scene.add(group);
  r3d.glassesGroup = group;
  r3d.currentShape = shape;
  r3d.currentMaterial = material;
}

/**
 * Apply frame fit in normalized [0,1] coords to 3D glasses.
 * `aspect` = canvas width / height — needed to map normalized X to world X correctly.
 */
export function applyFrameFit(r3d: Renderer3DState, fit: FrameFit, aspect: number): void {
  if (!r3d.glassesGroup) return;
  const g = r3d.glassesGroup;

  // Camera FOV=55° at z=1, glasses at z=0 plane:
  //   visible half-height = tan(27.5°) * 1.0 ≈ 0.5206
  const halfFovRad = (55 * Math.PI) / 360;
  const worldH = 2 * Math.tan(halfFovRad); // ~1.0412
  const worldW = worldH * aspect;

  // Normalized [0,1] → world: center (0.5, 0.5) maps to origin
  const worldX = (fit.center.x - 0.5) * worldW;
  const worldY = -(fit.center.y - 0.5) * worldH;
  const worldZ = 0;

  g.position.set(worldX, worldY, worldZ);
  g.rotation.z = -fit.roll;
  g.rotation.y = Math.PI + fit.yaw;

  // Scale: fit.width × worldW = desired frame width in world units
  // Model default width = 140mm × 0.001 = 0.14 world units
  const MODEL_BASE_WIDTH = 0.14; // 140mm
  const scale = (fit.width * worldW) / MODEL_BASE_WIDTH;
  g.scale.setScalar(scale);

  r3d.camera.aspect = aspect;
  r3d.camera.updateProjectionMatrix();
}

export function renderFrame(r3d: Renderer3DState): void {
  r3d.renderer.render(r3d.scene, r3d.camera);
}

export function resizeRenderer(r3d: Renderer3DState, width: number, height: number): void {
  r3d.renderer.setSize(width, height, false);
}

export function disposeRenderer(r3d: Renderer3DState): void {
  if (r3d.glassesGroup) {
    r3d.scene.remove(r3d.glassesGroup);
    disposeGroup(r3d.glassesGroup);
  }
  r3d.envMap?.dispose();
  r3d.renderer.dispose();
}

function disposeGroup(group: THREE.Group): void {
  group.traverse((child) => {
    if (child instanceof THREE.Mesh) {
      child.geometry.dispose();
      if (Array.isArray(child.material)) {
        child.material.forEach((m) => m.dispose());
      } else {
        child.material.dispose();
      }
    }
  });
}
