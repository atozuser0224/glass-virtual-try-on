// =============================================================================
// jeeliz-math.ts — Calculation formulas extracted from Jeeliz Glasses VTO Widget
// Source: https://github.com/jeeliz/jeelizGlassesVTOWidget
// License: Apache 2.0 — Jeeliz / WebAR.rocks
//
// These are the core math primitives, projection/geometry helpers, temporal
// filters, and glasses-fitting parameter computations used by the Jeeliz widget.
// Adapted to TypeScript to work with our MediaPipe landmark pipeline.
// =============================================================================

// ---------------------------------------------------------------------------
// 1. Basic math primitives (Jeeliz zb, Ea, wd — literal transcriptions)
// ---------------------------------------------------------------------------

/**
 * Cubic smoothstep (Ken Perlin's smootherstep variant).
 * First derivative zero at both endpoints.
 * Source: Jeeliz `function zb(a){return.5>a?4*a*a*a:(a-1)*(2*a-2)*(2*a-2)+1}`
 */
export function smootherstep(t: number): number {
  return t < 0.5 ? 4 * t * t * t : (t - 1) * (2 * t - 2) * (2 * t - 2) + 1;
}

/**
 * Component-wise linear interpolation of a 2-element array.
 * Source: Jeeliz `function Ea(a,b){return a[0]*(1-b)+a[1]*b}`
 */
export function lerpArr2(a: [number, number], t: number): number {
  return a[0] * (1 - t) + a[1] * t;
}

/**
 * 2D Euclidean distance.
 * Source: Jeeliz `function wd(a,b,d,f){return Math.sqrt((a-d)*(a-d)+(b-f)*(b-f))}`
 */
export function euclideanDistance2D(
  x1: number, y1: number, x2: number, y2: number
): number {
  return Math.sqrt((x1 - x2) * (x1 - x2) + (y1 - y2) * (y1 - y2));
}

/**
 * Standard linear interpolation.
 * Source: Jeeliz Ma.Ne / Ia.Vj usage pattern
 */
export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/**
 * Clamp value to [min, max] range.
 */
export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

// ---------------------------------------------------------------------------
// 2. FOV & perspective projection (hb.Kg / hb.Rg / Ta.ul)
// ---------------------------------------------------------------------------

/**
 * Compute effective FOV from base sensor FOV, accounting for aspect ratio
 * and UV scale.  Mirrors the Jeeliz hb.Kg() chain.
 *
 *   Z  = 2*atan(max(K,1/K) / (16/9) * tan(0.5*baseFov))
 *   sf = 2*atan(2*uvScale[0] * tan(0.5 * (
 *          1<K ? 2*atan(1/K * tan(0.5*Z)) : Z
 *        )))
 *
 * where K = height/width (sensor aspect ratio).
 */
export function computeEffectiveFOV(
  baseFovRad: number,
  aspectRatioHeightOverWidth: number,
  uvScaleX: number
): number {
  const K = aspectRatioHeightOverWidth;
  let fov = baseFovRad;

  // Desktop / mobile FOV adjustment
  fov = 2 * Math.atan(
    Math.max(K, 1 / K) / (16 / 9) * Math.tan(0.5 * fov)
  );

  // Sensor crop
  if (1 < K) {
    fov = 2 * Math.atan(1 / K * Math.tan(0.5 * fov));
  }

  return 2 * Math.atan(2 * uvScaleX * Math.tan(0.5 * fov));
}

/**
 * Build a perspective projection matrix (column-major, 16 floats).
 * Source: Jeeliz Ta.ul() — `Ga.ij = [Z,0,0,0, 0,Z/ua,0,0, 0,0,-(S+K)/(S-K),-1, 0,0,-2*K*S/(S-K),0]`
 *
 *   focalLength = 1 / tan(0.5 * fov)
 *   mat[0]  = focalLength
 *   mat[5]  = focalLength / aspectRatio
 *   mat[10] = -(far + near) / (far - near)
 *   mat[11] = -1
 *   mat[14] = -2 * near * far / (far - near)
 */
export function buildPerspectiveMatrix(
  fovRad: number,
  aspectRatio: number,    // width / height
  near: number,
  far: number
): Float32Array {
  const f = 1 / Math.tan(0.5 * fovRad);
  const nf = 1 / (near - far);

  const m = new Float32Array(16);
  m[0] = f;
  m[1] = 0;
  m[2] = 0;
  m[3] = 0;

  m[4] = 0;
  m[5] = f / aspectRatio;
  m[6] = 0;
  m[7] = 0;

  m[8] = 0;
  m[9] = 0;
  m[10] = (far + near) * nf;     // -(far+near)/(near-far) = (far+near)/(near-far)
  m[11] = -1;

  m[12] = 0;
  m[13] = 0;
  m[14] = 2 * far * near * nf;   // -2*near*far/(far-near) → 2*near*far/(near-far)
  m[15] = 0;

  return m;
}

// ---------------------------------------------------------------------------
// 3. UV / aspect-ratio correction (hb.Kg sensor-crop matrix)
// ---------------------------------------------------------------------------

/**
 * Compute UV scale factors for sensor / display mismatch.
 * Source: Jeeliz hb.Kg()
 *
 *   ba = [0.5, 0.5]
 *   K  = videoHeight / videoWidth
 *   K > displayAspect ? ba[1] *= displayAspect/K : ba[0] *= K/displayAspect
 *
 * Returns [scaleX, scaleY] used as a 2×2 texture-coordinate matrix diagonal.
 */
export function computeUVScale(
  videoWidth: number,
  videoHeight: number,
  displayWidth: number,
  displayHeight: number
): [number, number] {
  const uvScale: [number, number] = [0.5, 0.5];
  const sensorAspect = videoHeight / videoWidth;
  const displayAspect = displayWidth / displayHeight;

  if (sensorAspect > displayAspect) {
    uvScale[1] *= displayAspect / sensorAspect;
  } else {
    uvScale[0] *= sensorAspect / displayAspect;
  }

  return uvScale;
}

/**
 * Camera resolution compatibility check — reject frames outside 4:3 – 16:9.
 * Source: Jeeliz `var H = Math.max(g.Mb,q.Bb)/Math.min(g.Mb,q.Bb);
 *          if (H < 4/3-0.1 || H > 16/9+0.1) continue;`
 */
export function isResolutionCompatible(width: number, height: number): boolean {
  const ar = Math.max(width, height) / Math.min(width, height);
  return !(ar < 4 / 3 - 0.1 || ar > 16 / 9 + 0.1);
}

// ---------------------------------------------------------------------------
// 4. 3D rotation helpers (Euler angles, quaternion, cross product)
// ---------------------------------------------------------------------------

/**
 * Apply Euler-angle sign convention for Jeeliz coordinate system.
 * X and Y axes are negated; Z is kept.
 * Source: Jeeliz `M.Ua = [-Z.rotationEulerAnglesFactors[0],
 *                          -Z.rotationEulerAnglesFactors[1],
 *                           Z.rotationEulerAnglesFactors[2]]`
 */
export function jeelizEulerFactors(
  euler: [number, number, number]
): [number, number, number] {
  return [-euler[0], -euler[1], euler[2]];
}

/**
 * 3D vector cross product: target = a × b.
 * Source: Jeeliz `function ud(a,b){a.x=f*b.z-m*b.y; a.y=m*b.x-d*b.z; a.z=d*b.y-f*b.x}`
 */
export function cross3(
  a: { x: number; y: number; z: number },
  b: { x: number; y: number; z: number },
  out: { x: number; y: number; z: number } = { x: 0, y: 0, z: 0 }
): { x: number; y: number; z: number } {
  out.x = a.y * b.z - a.z * b.y;
  out.y = a.z * b.x - a.x * b.z;
  out.z = a.x * b.y - a.y * b.x;
  return out;
}

/**
 * Quaternion multiplication: out = b × d (Hamilton product).
 * Source: Jeeliz `function td(a,b,d)`
 *
 *   a.F = b.F*d + b*n + m*l - r*g
 *   a.G = m*d + b*g + r*n - f*l
 *   a.H = r*d + b*l + f*g - m*n
 *   a.T = b*d - f*n - m*g - r*l
 */
export function quatMultiply(
  b: { x: number; y: number; z: number; w: number },
  d: { x: number; y: number; z: number; w: number },
  out: { x: number; y: number; z: number; w: number } = { x: 0, y: 0, z: 0, w: 0 }
): { x: number; y: number; z: number; w: number } {
  // Jeeliz naming: b=(F,G,H,T), d=(f,m,r,l)  → result
  //   F' = F*l + f*T + m*H - r*G   (W)
  //   G' = m*l + F*r + r*T - f*H   (X)
  //   H' = r*l + F*m + f*G - m*T   (Y)
  //   T' = T*l - f*F - m*G - r*H   (Z)
  // Mapping: b=(x,y,z,w)  d=(x2,y2,z2,w2)
  out.x = d.w * b.x + d.x * b.w + d.y * b.z - d.z * b.y;
  out.y = d.w * b.y - d.x * b.z + d.y * b.w + d.z * b.x;
  out.z = d.w * b.z + d.x * b.y - d.y * b.x + d.z * b.w;
  out.w = d.w * b.w - d.x * b.x - d.y * b.y - d.z * b.z;
  return out;
}

// ---------------------------------------------------------------------------
// 5. Deformation scaling from head yaw (GLSL s64)
// ---------------------------------------------------------------------------

/**
 * Deformation scale applied to eye separation based on head yaw.
 * Source: Jeeliz shader s64
 *
 *   vec2 n = vec2(mix(1., 1./cos(m), u44), 1.);  // deformScale factor
 *   a *= n;                                        // apply to eye position
 *   a *= 1. + u45;                                 // ds offset
 *
 * Parameters:
 *   yaw                  — head yaw angle in radians (m in shader)
 *   deformScaleXFactor   — u44: how much yaw deforms the X scale (0 = no deformation)
 *   dsOffset             — u45: additional global scale offset
 */
export function computeDeformationScale(
  yaw: number,
  deformScaleXFactor: number,
  dsOffset: number
): { scaleX: number; scaleY: number } {
  const cosYaw = Math.cos(yaw);
  const safeCosYaw = Math.abs(cosYaw) < 1e-7 ? 1e-7 : cosYaw;
  // mix(1., 1./cos(m), u44)  →  lerp between 1 and 1/cos by factor
  const scaleX = lerp(1, 1 / safeCosYaw, deformScaleXFactor) * (1 + dsOffset);
  const scaleY = 1 + dsOffset; // Y is not affected by yaw deformation (vec2(…, 1.))
  return { scaleX, scaleY };
}

// ---------------------------------------------------------------------------
// 6. Face anchor → glasses fit (s64 extract + s66 denormalize)
// ---------------------------------------------------------------------------

export interface Point3 {
  x: number;
  y: number;
  z: number;
}

export interface FaceAnchors {
  leftEye: Point3;
  rightEye: Point3;
  nose: Point3;
}

export interface FrameFit {
  center: Point3;
  width: number;
  roll: number;
  yaw: number;
}

/** Fitting tunables — mirrors Jeeliz default config values */
export interface FittingParams {
  /** u43 — pupil-distance scale factor (inter-pupillary distance multiplier) */
  pdScale: number;
  /** u44 — deformation X-scale factor from yaw (0 = off, 1 = full) */
  deformScaleXFactor: number;
  /** u45 — global scale offset added after yaw deformation */
  dsOffset: number;
  /** u46 — vertical offset from yaw (dy in normalized coords × pd) */
  dyOffsetFactor: number;
  /** Minimum frame width in normalized coords */
  minFrameWidth: number;
  /** Eye-distance to frame-width multiplier */
  eyeToFrameRatio: number;
  /** Z blend: how much nose.z contributes to frame center.z */
  noseZBlend: number;
}

export const DEFAULT_FITTING_PARAMS: FittingParams = {
  pdScale: 1.0,
  deformScaleXFactor: 0.5,
  dsOffset: 0.0,
  dyOffsetFactor: -0.04,
  minFrameWidth: 0.2,
  eyeToFrameRatio: 2.4,
  noseZBlend: 0.5,
};

/**
 * Compute frame fit from face anchor points using Jeeliz shader s64 + s66 math.
 *
 * s64 extracts eye centers accounting for yaw rotation:
 *   eyeCenterUV = detected_eye_center + rotation_matrix * (half_position * scale)
 *   with deformation from yaw applied to scale
 *
 * s66 denormalizes 3D coords:
 *   3D = offset + normalized * scale_factors
 */
export function computeFrameFit(
  anchors: FaceAnchors,
  params: Partial<FittingParams> = {}
): FrameFit {
  const p = { ...DEFAULT_FITTING_PARAMS, ...params };

  const eyeCenter = midpoint(anchors.leftEye, anchors.rightEye);
  const dx = anchors.rightEye.x - anchors.leftEye.x;
  const dy = anchors.rightEye.y - anchors.leftEye.y;
  const dz = anchors.rightEye.z - anchors.leftEye.z;
  const eyeDistance2D = Math.hypot(dx, dy);

  // Roll: angle of eye line in 2D image plane
  const roll = Math.atan2(dy, dx);

  // Yaw: out-of-plane rotation from eye z-difference
  //   Jeeliz s64: `atan(h, a)`  (atan2)
  const yaw = Math.atan2(dz, Math.max(eyeDistance2D, 0.001));

  // Deformation scaling from yaw (s64)
  //   vec2 n = vec2(mix(1., 1./cos(m), u44), 1.)
  //   a *= n; a *= 1. + u45;
  const deform = computeDeformationScale(yaw, p.deformScaleXFactor, p.dsOffset);

  // Apply PD scale and deformation to the 2D eye distance
  const scaledEyeDistance = eyeDistance2D * p.pdScale * deform.scaleX;

  // Frame width: eye distance × ratio, clamped to minimum
  const frameWidth = Math.max(p.minFrameWidth, scaledEyeDistance * p.eyeToFrameRatio);

  // Center:
  //   x, y = eye center (already midpoint)
  //   z    = blend of eye center z and nose z (s66: nose gives z reference)
  //   dy compensation from yaw (s64: c += vec2(-.5) * a * (g * vec2(0., u46)))
  const dyCompensation = p.dyOffsetFactor * eyeDistance2D * p.pdScale;

  return {
    center: {
      x: eyeCenter.x,
      y: eyeCenter.y + dyCompensation,
      z: eyeCenter.z + (anchors.nose.z - eyeCenter.z) * p.noseZBlend,
    },
    width: frameWidth,
    roll,
    yaw,
  };
}

function midpoint(a: Point3, b: Point3): Point3 {
  return {
    x: (a.x + b.x) * 0.5,
    y: (a.y + b.y) * 0.5,
    z: (a.z + b.z) * 0.5,
  };
}

// ---------------------------------------------------------------------------
// 7. Temple bending (jeeliz mp / s64 vertex shader)
// ---------------------------------------------------------------------------

/**
 * Z-depth based temple bend.
 * Source: Jeeliz shader s66
 *   d = b.z * u57;     // bend_amount = z_coord * bend_strength
 *   c += d;            // rotation += bend
 *   b.z -= d;          // z -= bend (counter-rotate)
 *
 * In vertex shader the temple mesh undergoes an additional Z-dependent
 * rotation about the temple attachment point.
 */
export function computeTempleBend(
  zDepth: number,
  bendStrength: number
): { rotationOffset: number; zOffset: number } {
  const bend = zDepth * bendStrength;
  return {
    rotationOffset: bend,
    zOffset: -bend,
  };
}

/** Default temple bend parameters from Jeeliz config */
export const DEFAULT_TEMPLE_BEND = {
  /** J.md — base temple bend start Z */
  beginBendZ: -0.02,
  /** J.Qb — base bend strength */
  bendStrength: 0.35,
};

// ---------------------------------------------------------------------------
// 8. Lenses Y-gradient alpha (Jeeliz Fd)
// ---------------------------------------------------------------------------

export interface LensesGradient {
  alphaMin: number;
  alphaMax: number;
  gradientStart: number;
  gradientEnd: number;
}

/**
 * Compute vertical alpha gradient for sunglass lens tint.
 * Source: Jeeliz `function Fd(O,W)`
 *
 *   pa = -30 * lensesYGradientHeight - 40          // center of gradient
 *   za =  50 * lensesYGradientSmoothness            // width of gradient
 *   returns [alpha*alphaMinFactor, alpha, pa-0.5*za, pa+0.5*za]
 */
export function computeLensesGradient(
  baseAlpha: number,
  height: number,
  smoothness: number,
  alphaMinFactor: number
): LensesGradient {
  const center = -30 * height - 40;
  const halfWidth = 50 * smoothness * 0.5;
  return {
    alphaMin: baseAlpha * alphaMinFactor,
    alphaMax: baseAlpha,
    gradientStart: center - halfWidth,
    gradientEnd: center + halfWidth,
  };
}

/** Default lenses gradient params from Jeeliz config */
export const DEFAULT_LENSES_GRADIENT = {
  height: 0.5,
  smoothness: 0.35,
  alphaMinFactor: 0.15,
};

// ---------------------------------------------------------------------------
// 9. Temporal smoothing with consistency validation (Jeeliz s68 / s70)
// ---------------------------------------------------------------------------

/**
 * Frame-rate-independent temporal smoothing with displacement-based
 * consistency check.  Mirrors the Jeeliz s68/s70 temporal pipeline.
 *
 * s68 consistency check:
 *   maxDisp = max(|dx|, |dy|) / (pdScale * deltaTime)
 *   weight  = smoothstep(thresholdLow, thresholdHigh, maxDisp)
 *   result  = mix(current, previous, weight)
 *
 * s70 exponential smoothing:
 *   result = mix(current, previous, smoothingFactor)
 *   result /= deltaTime  (rate-independent)
 */
export function temporalSmoothFit(
  current: FrameFit,
  previous: FrameFit | null,
  deltaTimeMs: number,
  smoothingFactor: number,
  pdScale: number,
  consistencyThreshold: [number, number] = [0.3, 1.2]
): FrameFit {
  if (!previous || deltaTimeMs <= 0) {
    return current;
  }

  const dt = deltaTimeMs / 1000; // convert to seconds

  // Normalized displacement (s68)
  const dispX = Math.abs(current.center.x - previous.center.x);
  const dispY = Math.abs(current.center.y - previous.center.y);
  const normDispX = dispX / (pdScale * dt);
  const normDispY = dispY / (pdScale * dt);
  const maxDisp = Math.max(normDispX, normDispY);

  // Consistency weight via smoothstep
  const consistency = smoothstep(
    consistencyThreshold[0],
    consistencyThreshold[1],
    maxDisp
  );

  // Blend factor: reduce smoothing when displacement is large (inconsistent)
  const alpha = smoothingFactor * (1 - consistency) * dt;

  return {
    center: {
      x: lerp(previous.center.x, current.center.x, 1 - alpha),
      y: lerp(previous.center.y, current.center.y, 1 - alpha),
      z: lerp(previous.center.z, current.center.z, 1 - alpha),
    },
    width: lerp(previous.width, current.width, 1 - alpha),
    roll: lerp(previous.roll, current.roll, 1 - alpha),
    yaw: lerp(previous.yaw, current.yaw, 1 - alpha),
  };
}

/**
 * Smoothstep: Hermite interpolation between edge0 and edge1.
 * Equivalent to GLSL smoothstep.
 */
export function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = clamp((x - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}

// ---------------------------------------------------------------------------
// 10. Glasses scale & offset system (Jeeliz Ce / Be)
// ---------------------------------------------------------------------------

/**
 * Compute total glasses render scale.
 * Source: Jeeliz `Ca.wo(Ja*J.Qn, Wb, ob.scale)`
 *
 *   totalScale = userScale × configFactor × preScale × pinchScale
 */
export function computeGlassesScale(
  userScale: number,          // Ja — model-specific scale
  configFactor: number,       // J.Qn — nominal scale factor
  preScale: number,           // Wb — tweaker preScale
  pinchScale: number          // ob.scale — user interactive pinch
): number {
  return userScale * configFactor * preScale * pinchScale;
}

/**
 * Compute glasses pan offset.
 * Source: Jeeliz `Be:function(){Cc[0]=Pa[0]-ob.offsetX; Cc[1]=Pa[1]+ob.offsetY; Cc[2]=Pa[2]}`
 *
 * Applied to the face center before rendering.
 */
export function computeGlassesOffset(
  preOffset: Point3,              // Pa — base offset (mm in Jeeliz, normalized here)
  interactiveOffsetX: number,     // ob.offsetX — user drag X
  interactiveOffsetY: number      // ob.offsetY — user drag Y
): Point3 {
  return {
    x: preOffset.x - interactiveOffsetX,
    y: preOffset.y + interactiveOffsetY,
    z: preOffset.z,
  };
}

/**
 * Clamp interactive pinch / pan to allowed ranges.
 * Source: Jeeliz
 *   ob.scale  = clamp(ob.scale + delta*J.vn,  J.Ti[0], J.Ti[1])
 *   ob.offset = clamp(ob.offset - delta*J.Si, -J.$d,   J.$d)
 */
export function clampInteractiveScale(
  scale: number,
  delta: number,
  speed: number,
  minScale: number,
  maxScale: number
): number {
  return clamp(scale + delta * speed, minScale, maxScale);
}

export function clampInteractiveOffset(
  offset: number,
  delta: number,
  speed: number,
  maxOffset: number
): number {
  return clamp(offset - delta * speed, -maxOffset, maxOffset);
}

// ---------------------------------------------------------------------------
// 11. Color helpers (Jeeliz sd / Wd)
// ---------------------------------------------------------------------------

/**
 * Integer RGB888 to float {r,g,b}.
 * Source: Jeeliz `function sd(a,b)`
 */
export function intToRGB(
  color: number
): { r: number; g: number; b: number } {
  return {
    r: ((color >> 16) & 255) / 255,
    g: ((color >> 8) & 255) / 255,
    b: (color & 255) / 255,
  };
}

/**
 * Parse hex color string to float RGB.
 * Source: Jeeliz Wd color parsing (hex branch)
 */
export function hexToRGB(hex: string): { r: number; g: number; b: number } {
  const h = hex.replace('#', '');
  if (h.length === 3) {
    return {
      r: parseInt(h[0] + h[0], 16) / 255,
      g: parseInt(h[1] + h[1], 16) / 255,
      b: parseInt(h[2] + h[2], 16) / 255,
    };
  }
  return {
    r: parseInt(h.substring(0, 2), 16) / 255,
    g: parseInt(h.substring(2, 4), 16) / 255,
    b: parseInt(h.substring(4, 6), 16) / 255,
  };
}

// ---------------------------------------------------------------------------
// 12. BT.601 luminance (GLSL f constant)
// ---------------------------------------------------------------------------

/**
 * BT.601 luminance from RGB.
 * Source: Jeeliz GLSL `const vec3 f = vec3(.299,.587,.114)`
 */
export function luminance(r: number, g: number, b: number): number {
  return 0.299 * r + 0.587 * g + 0.114 * b;
}

// ---------------------------------------------------------------------------
// 13. Oversampling / retina scale (Jeeliz Oa / ja.resize)
// ---------------------------------------------------------------------------

/**
 * Compute oversampling factor for retina displays.
 * Source: Jeeliz `J.cvWidth = Math.round(1 * gb.displayWidth);
 *          ja.resize(Oa.width * Z, Oa.height * Z)`
 */
export function computeCanvasSize(
  displayWidth: number,
  displayHeight: number,
  oversamplingFactor: number
): { cvWidth: number; cvHeight: number } {
  return {
    cvWidth: Math.round(oversamplingFactor * displayWidth),
    cvHeight: Math.round(oversamplingFactor * displayHeight),
  };
}
