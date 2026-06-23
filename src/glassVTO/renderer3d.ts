// =============================================================================
// renderer3d.ts — Three.js renderer for glasses VTO
// Replaces Canvas 2D rendering with proper 3D perspective rendering.
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
  /** Environment map for reflections */
  envMap: THREE.Texture | null;
  /** Ambient + directional lights */
  ambientLight: THREE.AmbientLight;
  keyLight: THREE.DirectionalLight;
  fillLight: THREE.DirectionalLight;
}

export function createRenderer3D(canvas: HTMLCanvasElement): Renderer3DState {
  // WebGL renderer — alpha for video background
  const renderer = new THREE.WebGLRenderer({
    canvas,
    alpha: true,
    antialias: true,
    preserveDrawingBuffer: true,
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.1;

  // Scene
  const scene = new THREE.Scene();

  // Camera — matches face FOV
  const camera = new THREE.PerspectiveCamera(45, 1, 0.01, 10);
  camera.position.set(0, 0, 0.5);
  camera.lookAt(0, 0, 0);

  // Lights — three-point setup
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
  scene.add(ambientLight);

  const keyLight = new THREE.DirectionalLight(0xffffff, 1.2);
  keyLight.position.set(0.3, 0.5, 0.8);
  scene.add(keyLight);

  const fillLight = new THREE.DirectionalLight(0xffffff, 0.4);
  fillLight.position.set(-0.5, -0.1, 0.3);
  scene.add(fillLight);

  // Simple environment map for reflections
  const pmremGenerator = new THREE.PMREMGenerator(renderer);
  pmremGenerator.compileEquirectangularShader();

  const envScene = new THREE.Scene();
  envScene.background = new THREE.Color(0x8899aa);
  const envMap = pmremGenerator.fromScene(envScene).texture;
  scene.environment = envMap;

  return {
    scene,
    camera,
    renderer,
    glassesGroup: null,
    currentShape: null,
    currentMaterial: null,
    envMap,
    ambientLight,
    keyLight,
    fillLight,
  };
}

/**
 * Update or create glasses model with new shape + material.
 */
export function updateGlassesModel(
  r3d: Renderer3DState,
  shape: GlassShape,
  materialConfig: GlassesMaterialConfig,
): void {
  // Remove old model
  if (r3d.glassesGroup) {
    r3d.scene.remove(r3d.glassesGroup);
    disposeGroup(r3d.glassesGroup);
    r3d.glassesGroup = null;
  }

  // Create new
  const group = createGlassesModel(shape, {}, materialConfig);

  // Orient glasses: Jeeliz coords → Three.js coords
  // Jeeliz: X right, Y down, Z into screen
  // Three.js default: X right, Y up, Z toward camera
  // We want glasses facing the camera → rotate around X
  group.rotation.set(0, Math.PI, 0); // face the camera (they're modeled looking at +Z)

  r3d.scene.add(group);
  r3d.glassesGroup = group;
  r3d.currentShape = shape;
  r3d.currentMaterial = materialConfig;
}

/**
 * Apply frame fit (position, rotation, scale) to the glasses model.
 * `fit` comes from computeFrameFit in normalized [0,1] coords.
 */
export function applyFrameFit(r3d: Renderer3DState, fit: FrameFit, _canvasSize: number): void {
  if (!r3d.glassesGroup) return;

  const group = r3d.glassesGroup;

  // Convert normalized coords to world space
  // Center (0.5, 0.5) → origin
  const worldX = (fit.center.x - 0.5) * 1.2;
  const worldY = -(fit.center.y - 0.5) * 1.2; // flip Y
  const worldZ = fit.center.z * 0.5;

  group.position.set(worldX, worldY, worldZ);

  // Roll: in-plane rotation (Z in 3D)
  group.rotation.z = -fit.roll;

  // Yaw: out-of-plane (Y rotation in 3D)
  group.rotation.y = Math.PI + fit.yaw; // PI because model faces +Z

  // Scale based on fit width
  const scale = fit.width * 2.5;
  group.scale.setScalar(scale);

  // Update camera FOV based on canvas aspect
  r3d.camera.aspect = 1; // square canvas
  r3d.camera.updateProjectionMatrix();
}

/**
 * Render one frame.
 */
export function renderFrame(r3d: Renderer3DState): void {
  r3d.renderer.render(r3d.scene, r3d.camera);
}

/**
 * Resize the renderer.
 */
export function resizeRenderer(r3d: Renderer3DState, width: number, height: number): void {
  r3d.renderer.setSize(width, height, false);
}

/**
 * Clean up.
 */
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
