// =============================================================================
// glasses3d.ts — Procedural 3D glasses models built with Three.js
// Shapes match the Jeeliz GlassesDB catalog: aviator, round, wayfarer,
// square, cat-eye, browline.
// =============================================================================

import * as THREE from 'three';

export type GlassShape = 'aviator' | 'round' | 'wayfarer' | 'square' | 'cat-eye' | 'browline';

export interface GlassesMaterialConfig {
  frameColor: string;
  lensColor: string;
  bridgeColor: string;
  /** Lens opacity 0–1 (0 = clear, 1 = opaque) */
  lensOpacity: number;
  /** Metalness 0–1 */
  metalness: number;
  /** Roughness 0–1 */
  roughness: number;
}

export interface GlassesGeometryConfig {
  shape: GlassShape;
  /** Total frame width in world units */
  width: number;
  /** Lens height ratio (height / width) */
  heightRatio: number;
  /** Bridge width ratio (bridge / width) */
  bridgeRatio: number;
  /** Temple length ratio */
  templeRatio: number;
}

/** Pre-scale to match Jeeliz coordinate system (mm → world) */
const MM_SCALE = 0.001;

/** Default geometry ratios per shape — tuned to match real glasses proportions */
const SHAPE_DEFAULTS: Record<GlassShape, { heightRatio: number; bridgeRatio: number }> = {
  aviator: { heightRatio: 0.34, bridgeRatio: 0.12 },
  round: { heightRatio: 0.32, bridgeRatio: 0.14 },
  wayfarer: { heightRatio: 0.30, bridgeRatio: 0.13 },
  square: { heightRatio: 0.28, bridgeRatio: 0.13 },
  'cat-eye': { heightRatio: 0.30, bridgeRatio: 0.12 },
  browline: { heightRatio: 0.28, bridgeRatio: 0.14 },
};

const DEFAULT_CONFIG: GlassesGeometryConfig = {
  shape: 'aviator',
  width: 140,   // typical frame width in mm
  heightRatio: 0.34,
  bridgeRatio: 0.12,
  templeRatio: 0.85,
};

const FRAME_THICKNESS = 3.0;      // mm
const TEMPLE_THICKNESS = 2.0;     // mm
const LENS_OFFSET_Z = 1.0;        // mm — lens sits slightly behind frame front

// ---------------------------------------------------------------------------

export function createGlassesModel(
  shape: GlassShape,
  config: Partial<GlassesGeometryConfig>,
  materials: GlassesMaterialConfig,
): THREE.Group {
  const cfg = resolveConfig(shape, config);
  const group = new THREE.Group();

  const w = cfg.width * MM_SCALE;
  const h = w * cfg.heightRatio;
  const bridgeW = w * cfg.bridgeRatio;
  const halfBridge = bridgeW * 0.5;
  const lensW = (w - bridgeW) * 0.5;  // width of a single lens opening
  const templeLen = w * cfg.templeRatio;
  const thickness = FRAME_THICKNESS * MM_SCALE;
  const templeThick = TEMPLE_THICKNESS * MM_SCALE;

  // Materials
  const frameMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(materials.frameColor),
    metalness: materials.metalness,
    roughness: materials.roughness,
  });
  const lensMat = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(materials.lensColor),
    metalness: 0,
    roughness: 0.05,
    transparent: true,
    opacity: materials.lensOpacity,
    envMapIntensity: 0.6,
    clearcoat: 0.1,
  });
  const bridgeMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(materials.bridgeColor),
    metalness: materials.metalness,
    roughness: materials.roughness,
  });

  // Left and right lens-frame assemblies
  const leftAssembly = createLensAssembly(shape, lensW, h, thickness, frameMat, lensMat, true);
  leftAssembly.position.x = -(halfBridge + lensW * 0.5);
  group.add(leftAssembly);

  const rightAssembly = createLensAssembly(shape, lensW, h, thickness, frameMat, lensMat, false);
  rightAssembly.position.x = halfBridge + lensW * 0.5;
  group.add(rightAssembly);

  // Bridge
  const bridge = createBridge(bridgeW, h, thickness, bridgeMat, shape);
  group.add(bridge);

  // Temples
  const leftTemple = createTemple(templeLen, templeThick, h, frameMat, true);
  leftTemple.position.set(-(halfBridge + lensW), -h * 0.08, 0);
  group.add(leftTemple);

  const rightTemple = createTemple(templeLen, templeThick, h, frameMat, false);
  rightTemple.position.set(halfBridge + lensW, -h * 0.08, 0);
  group.add(rightTemple);

  return group;
}

// ---------------------------------------------------------------------------
// Lens + frame ring assembly
// ---------------------------------------------------------------------------

function createLensAssembly(
  shape: GlassShape,
  lensW: number,
  lensH: number,
  thickness: number,
  frameMat: THREE.Material,
  lensMat: THREE.Material,
  isLeft: boolean,
): THREE.Group {
  const group = new THREE.Group();

  // Create a 2D shape for the lens outline
  const outline = createLensOutline(shape, lensW, lensH, isLeft);
  const frameGeo = createFrameRingGeometry(outline, thickness);

  // Frame ring
  const frame = new THREE.Mesh(frameGeo, frameMat);
  frame.position.z = 0;
  group.add(frame);

  // Lens plane (slightly inset)
  const lensGeo = createLensPlaneGeometry(outline, thickness);
  const lens = new THREE.Mesh(lensGeo, lensMat);
  lens.position.z = -LENS_OFFSET_Z * MM_SCALE;
  group.add(lens);

  return group;
}

// ---------------------------------------------------------------------------
// Lens outline — 2D Shape per glass type
// ---------------------------------------------------------------------------

function createLensOutline(
  shape: GlassShape,
  w: number,
  h: number,
  isLeft: boolean,
): THREE.Shape {
  const hw = w * 0.5;
  const hh = h * 0.5;
  const sign = isLeft ? 1 : -1;

  switch (shape) {
    case 'round':
      return createRoundOutline(hw, hh);

    case 'aviator':
      return createAviatorOutline(hw, hh);

    case 'wayfarer':
      return createWayfarerOutline(hw, hh, sign);

    case 'square':
      return createSquareOutline(hw, hh);

    case 'cat-eye':
      return createCatEyeOutline(hw, hh, sign);

    case 'browline':
      return createBrowlineOutline(hw, hh);

    default:
      return createSquareOutline(hw, hh);
  }
}

function createRoundOutline(hw: number, hh: number): THREE.Shape {
  const shape = new THREE.Shape();
  const segments = 48;
  for (let i = 0; i <= segments; i++) {
    const angle = (i / segments) * Math.PI * 2;
    const x = Math.cos(angle) * hw;
    const y = Math.sin(angle) * hh;
    if (i === 0) shape.moveTo(x, y);
    else shape.lineTo(x, y);
  }
  shape.closePath();
  return shape;
}

function createAviatorOutline(hw: number, hh: number): THREE.Shape {
  // Aviator teardrop: wider at top, narrower at bottom
  const shape = new THREE.Shape();
  const points: [number, number][] = [];

  // Top edge — slightly flattened
  for (let i = 0; i <= 16; i++) {
    const t = i / 16;
    const angle = Math.PI + t * Math.PI; // from PI to 2PI (left to right across top)
    const rx = hw;
    const ry = hh * 0.85; // top is slightly flatter
    points.push([Math.cos(angle) * rx, Math.sin(angle) * ry + hh * 0.15]);
  }

  // Bottom — more pointed teardrop
  for (let i = 0; i <= 16; i++) {
    const t = i / 16;
    const angle = t * Math.PI; // from 0 to PI (right to left across bottom)
    const rx = hw * (1 - t * 0.15); // narrows toward bottom
    const ry = hh * 1.15;
    points.push([Math.cos(angle) * rx, Math.sin(angle) * ry - hh * 0.15]);
  }

  points.forEach(([x, y], i) => {
    if (i === 0) shape.moveTo(x, y);
    else shape.lineTo(x, y);
  });
  shape.closePath();
  return shape;
}

function createWayfarerOutline(hw: number, hh: number, _sign: number): THREE.Shape {
  // Wayfarer: trapezoid with rounded corners
  const shape = new THREE.Shape();
  const topW = hw * 0.9;
  const botW = hw * 0.85;
  const r = Math.min(hw, hh) * 0.2; // corner radius

  // Top edge
  shape.moveTo(-topW + r, hh);
  shape.lineTo(topW - r, hh);
  shape.quadraticCurveTo(topW, hh, topW, hh - r);

  // Outer edge (angled)
  shape.lineTo(botW, -hh + r);
  shape.quadraticCurveTo(botW, -hh, botW - r, -hh);

  // Bottom edge
  shape.lineTo(-botW + r, -hh);
  shape.quadraticCurveTo(-botW, -hh, -botW, -hh + r);

  // Inner edge (angled back up)
  shape.lineTo(-topW, hh - r);
  shape.quadraticCurveTo(-topW, hh, -topW + r, hh);

  shape.closePath();
  return shape;
}

function createSquareOutline(hw: number, hh: number): THREE.Shape {
  const shape = new THREE.Shape();
  const cornerR = Math.min(hw, hh) * 0.25;

  shape.moveTo(-hw + cornerR, hh);
  shape.lineTo(hw - cornerR, hh);
  shape.quadraticCurveTo(hw, hh, hw, hh - cornerR);
  shape.lineTo(hw, -hh + cornerR);
  shape.quadraticCurveTo(hw, -hh, hw - cornerR, -hh);
  shape.lineTo(-hw + cornerR, -hh);
  shape.quadraticCurveTo(-hw, -hh, -hw, -hh + cornerR);
  shape.lineTo(-hw, hh - cornerR);
  shape.quadraticCurveTo(-hw, hh, -hw + cornerR, hh);
  shape.closePath();
  return shape;
}

function createCatEyeOutline(hw: number, hh: number, _sign: number): THREE.Shape {
  // Cat-eye: upswept outer corner
  const shape = new THREE.Shape();
  const sweep = hh * 0.35;
  const innerTopY = hh * 0.6;
  const outerTopY = hh + sweep;

  // Inner top → outer top (upsweep)
  shape.moveTo(-hw * 0.15, innerTopY);
  shape.quadraticCurveTo(hw * 0.3, hh * 0.9, hw * 0.7, outerTopY);

  // Outer point
  shape.lineTo(hw * 0.95, hh * 0.3);

  // Outer bottom curve
  shape.quadraticCurveTo(hw * 0.5, -hh, hw * 0.1, -hh * 0.9);

  // Inner bottom
  shape.quadraticCurveTo(-hw * 0.3, -hh * 0.5, -hw * 0.15, -hh * 0.2);
  shape.quadraticCurveTo(-hw * 0.1, hh * 0.1, -hw * 0.15, innerTopY);

  shape.closePath();
  return shape;
}

function createBrowlineOutline(hw: number, hh: number): THREE.Shape {
  // Browline: thick upper rim, thin lower
  const shape = new THREE.Shape();
  const r = Math.min(hw, hh) * 0.22;

  // Top (thicker brow)
  shape.moveTo(-hw + r, hh);
  shape.lineTo(hw - r, hh);
  shape.quadraticCurveTo(hw, hh, hw, hh - r * 1.5);

  // Outer edge
  shape.lineTo(hw * 0.95, -hh + r);
  shape.quadraticCurveTo(hw * 0.95, -hh, hw * 0.95 - r, -hh);

  // Bottom edge
  shape.lineTo(-hw * 0.95 + r, -hh);
  shape.quadraticCurveTo(-hw * 0.95, -hh, -hw * 0.95, -hh + r);

  // Inner edge back up
  shape.lineTo(-hw, hh - r * 1.5);
  shape.quadraticCurveTo(-hw, hh, -hw + r, hh);

  shape.closePath();
  return shape;
}

// ---------------------------------------------------------------------------
// 3D geometry from 2D outline
// ---------------------------------------------------------------------------

function createFrameRingGeometry(outline: THREE.Shape, thickness: number): THREE.BufferGeometry {
  // Extrude the outline to create the frame ring
  const extrudeSettings: THREE.ExtrudeGeometryOptions = {
    steps: 1,
    depth: thickness,
    bevelEnabled: true,
    bevelThickness: thickness * 0.3,
    bevelSize: thickness * 0.3,
    bevelSegments: 8,
  };
  return new THREE.ExtrudeGeometry(outline, extrudeSettings);
}

function createLensPlaneGeometry(outline: THREE.Shape, _frameThickness: number): THREE.BufferGeometry {
  // Simple flat shape for the lens
  return new THREE.ShapeGeometry(outline, 32);
}

// ---------------------------------------------------------------------------
// Bridge
// ---------------------------------------------------------------------------

function createBridge(
  bridgeW: number,
  lensH: number,
  frameThickness: number,
  material: THREE.Material,
  shape: GlassShape,
): THREE.Group {
  const group = new THREE.Group();

  if (shape === 'browline') {
    // Browline: thick upper bar across both lenses
    const barGeo = new THREE.BoxGeometry(bridgeW * 2.5, frameThickness * 1.5, frameThickness * 1.2);
    const bar = new THREE.Mesh(barGeo, material);
    bar.position.y = lensH * 0.5;
    group.add(bar);
  }

  // Standard bridge curve
  const bridgeGeo = createBridgeCurve(bridgeW, lensH, frameThickness);
  const bridge = new THREE.Mesh(bridgeGeo, material);
  bridge.position.y = -lensH * 0.06;
  group.add(bridge);

  return group;
}

function createBridgeCurve(bridgeW: number, lensH: number, thickness: number): THREE.BufferGeometry {
  const curvePoints: THREE.Vector3[] = [];
  const segments = 16;
  const archHeight = lensH * 0.18;

  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    const x = (t - 0.5) * bridgeW;
    // Parabolic arch
    const y = archHeight * (1 - Math.pow(t * 2 - 1, 2)) - lensH * 0.06;
    curvePoints.push(new THREE.Vector3(x, y, 0));
  }

  const curve = new THREE.CatmullRomCurve3(curvePoints);
  const tubeGeo = new THREE.TubeGeometry(curve, 16, thickness * 0.25, 8, false);
  return tubeGeo;
}

// ---------------------------------------------------------------------------
// Temples (arms)
// ---------------------------------------------------------------------------

function createTemple(
  length: number,
  thickness: number,
  lensH: number,
  material: THREE.Material,
  isLeft: boolean,
): THREE.Group {
  const group = new THREE.Group();

  // Temple arm: starts going back, then curves down behind ear
  const curvePoints: THREE.Vector3[] = [];
  const segments = 20;
  const bendY = -lensH * 0.15;
  const dropY = -lensH * 0.5;

  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    // Goes back (-z), then curves outward and down
    const z = -t * length;
    const x = isLeft
      ? -thickness * 0.5 * (1 - t * 0.3)
      : thickness * 0.5 * (1 - t * 0.3);
    const y = t < 0.6
      ? bendY * (t / 0.6)
      : bendY + (dropY - bendY) * ((t - 0.6) / 0.4);
    curvePoints.push(new THREE.Vector3(x, y, z));
  }

  const curve = new THREE.CatmullRomCurve3(curvePoints);
  const r = thickness * 0.5;
  const tubeGeo = new THREE.TubeGeometry(curve, 20, r, 8, false);
  const temple = new THREE.Mesh(tubeGeo, material);
  group.add(temple);

  // Temple tip (ear piece)
  const tipGeo = new THREE.CapsuleGeometry(r * 0.8, length * 0.15, 4, 8);
  const tipMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(material instanceof THREE.MeshStandardMaterial ? material.color : 0x111111),
    metalness: 0,
    roughness: 0.8,
  });
  const tip = new THREE.Mesh(tipGeo, tipMat);
  const lastPoint = curvePoints[curvePoints.length - 1];
  tip.position.copy(lastPoint).z -= length * 0.07;
  tip.rotation.x = Math.PI * 0.5;
  group.add(tip);

  return group;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function resolveConfig(
  shape: GlassShape,
  partial: Partial<GlassesGeometryConfig>,
): GlassesGeometryConfig {
  const defaults = SHAPE_DEFAULTS[shape];
  return {
    ...DEFAULT_CONFIG,
    ...defaults,
    ...partial,
    shape,
  };
}

/** Default materials matching Jeeliz catalog entries */
export const DEFAULT_MATERIALS: Record<string, GlassesMaterialConfig> = {
  gold_green: {
    frameColor: '#c4a652',
    lensColor: '#5f8460',
    bridgeColor: '#b4953e',
    lensOpacity: 0.28,
    metalness: 0.9,
    roughness: 0.35,
  },
  silver_dark: {
    frameColor: '#c0c0c0',
    lensColor: '#3c5046',
    bridgeColor: '#a8a8a8',
    lensOpacity: 0.25,
    metalness: 0.95,
    roughness: 0.3,
  },
  copper_pink: {
    frameColor: '#bd7f5f',
    lensColor: '#ac5f67',
    bridgeColor: '#a7684d',
    lensOpacity: 0.22,
    metalness: 0.7,
    roughness: 0.4,
  },
  darkbrown: {
    frameColor: '#2a1813',
    lensColor: '#694c3a',
    bridgeColor: '#2a1813',
    lensOpacity: 0.24,
    metalness: 0.1,
    roughness: 0.55,
  },
  black: {
    frameColor: '#1a1a1a',
    lensColor: '#282828',
    bridgeColor: '#111111',
    lensOpacity: 0.30,
    metalness: 0.05,
    roughness: 0.5,
  },
  tortoise: {
    frameColor: '#6b3a2a',
    lensColor: '#8b775a',
    bridgeColor: '#5a2d1e',
    lensOpacity: 0.22,
    metalness: 0.1,
    roughness: 0.5,
  },
  red: {
    frameColor: '#8b1a1a',
    lensColor: '#503232',
    bridgeColor: '#6e1515',
    lensOpacity: 0.22,
    metalness: 0.15,
    roughness: 0.45,
  },
};
