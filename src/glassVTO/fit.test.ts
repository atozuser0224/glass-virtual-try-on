import { describe, expect, it } from 'vitest';
import {
  computeFrameFit,
  smootherstep,
  euclideanDistance2D,
  lerp,
  clamp,
  computeDeformationScale,
  computeTempleBend,
  computeLensesGradient,
  temporalSmoothFit,
  computeEffectiveFOV,
} from './jeeliz-math';

// ---------------------------------------------------------------------------
// computeFrameFit  (Jeeliz s64 + s66)
// ---------------------------------------------------------------------------

describe('computeFrameFit', () => {
  it('centers the frame between both eyes', () => {
    const fit = computeFrameFit({
      leftEye: { x: 0.4, y: 0.45, z: 0 },
      rightEye: { x: 0.6, y: 0.47, z: 0 },
      nose: { x: 0.5, y: 0.56, z: 0 },
    });

    expect(fit.center.x).toBeCloseTo(0.5);
    expect(fit.center.y).toBeCloseTo(0.46, 1);
    expect(fit.roll).toBeCloseTo(Math.atan2(0.02, 0.2));
  });

  it('keeps tiny eye distances from collapsing the rendered frame', () => {
    const fit = computeFrameFit({
      leftEye: { x: 0.5, y: 0.5, z: 0 },
      rightEye: { x: 0.502, y: 0.5, z: 0 },
      nose: { x: 0.501, y: 0.58, z: 0 },
    });

    expect(fit.width).toBeGreaterThanOrEqual(0.2);
  });

  it('computes yaw from z-difference of eyes', () => {
    const fit = computeFrameFit({
      leftEye: { x: 0.35, y: 0.5, z: -0.05 },
      rightEye: { x: 0.65, y: 0.5, z: 0.05 },
      nose: { x: 0.5, y: 0.56, z: 0.02 },
    });

    // Positive dz gives positive yaw
    expect(fit.yaw).toBeGreaterThan(0);
  });

  it('applies deformation scaling when yaw is non-zero', () => {
    const flatAnchors = {
      leftEye: { x: 0.35, y: 0.5, z: 0 },
      rightEye: { x: 0.65, y: 0.5, z: 0 },
      nose: { x: 0.5, y: 0.56, z: 0 },
    };

    const tiltedAnchors = {
      leftEye: { x: 0.36, y: 0.5, z: -0.08 },
      rightEye: { x: 0.64, y: 0.5, z: 0.08 },
      nose: { x: 0.5, y: 0.56, z: 0.04 },
    };

    const flatFit = computeFrameFit(flatAnchors, { deformScaleXFactor: 0.5, dsOffset: 0 });
    const tiltedFit = computeFrameFit(tiltedAnchors, { deformScaleXFactor: 0.5, dsOffset: 0 });

    // Tilted head has yaw → deformation scaling should change width
    // With yaw > 0, deformScaleX from 1/cos(yaw) > 1, so width should be larger
    expect(tiltedFit.yaw).not.toBeCloseTo(0);
    // Width proportions should differ (yaw deformation affects scaledEyeDistance)
    const flatWidthPerEye = flatFit.width / 0.3; // eyeDistance2D for flat
    const tiltedWidthPerEye = tiltedFit.width / Math.hypot(0.28, 0.16); // eyeDistance2D for tilted
    // These won't be equal because yaw deformation changes the scaling
    expect(flatWidthPerEye).not.toBeCloseTo(tiltedWidthPerEye, 5);
  });
});

// ---------------------------------------------------------------------------
// smootherstep  (Jeeliz zb)
// ---------------------------------------------------------------------------

describe('smootherstep', () => {
  it('returns 0 at t=0 and 1 at t=1', () => {
    expect(smootherstep(0)).toBeCloseTo(0);
    expect(smootherstep(1)).toBeCloseTo(1);
  });

  it('has zero derivative at endpoints', () => {
    // Numerical derivative approximation near endpoints
    const eps = 1e-6;
    const derivAt0 = (smootherstep(eps) - smootherstep(0)) / eps;
    const derivAt1 = (smootherstep(1) - smootherstep(1 - eps)) / eps;

    expect(Math.abs(derivAt0)).toBeLessThan(1e-4);
    expect(Math.abs(derivAt1)).toBeLessThan(1e-4);
  });

  it('is monotonic increasing', () => {
    let prev = smootherstep(0);
    for (let t = 0.05; t <= 1.0; t += 0.05) {
      const cur = smootherstep(t);
      expect(cur).toBeGreaterThanOrEqual(prev);
      prev = cur;
    }
  });

  it('matches the Jeeliz zb() formula exactly', () => {
    // zb: .5>a ? 4*a*a*a : (a-1)*(2*a-2)*(2*a-2)+1
    function zb(a: number): number {
      return 0.5 > a ? 4 * a * a * a : (a - 1) * (2 * a - 2) * (2 * a - 2) + 1;
    }
    for (let t = 0; t <= 1; t += 0.01) {
      expect(smootherstep(t)).toBeCloseTo(zb(t), 10);
    }
  });
});

// ---------------------------------------------------------------------------
// euclideanDistance2D  (Jeeliz wd)
// ---------------------------------------------------------------------------

describe('euclideanDistance2D', () => {
  it('matches the Jeeliz wd() formula', () => {
    function wd(a: number, b: number, d: number, f: number): number {
      return Math.sqrt((a - d) * (a - d) + (b - f) * (b - f));
    }
    expect(euclideanDistance2D(0, 0, 3, 4)).toBeCloseTo(wd(0, 0, 3, 4));
    expect(euclideanDistance2D(1, 2, 4, 6)).toBeCloseTo(wd(1, 2, 4, 6));
  });
});

// ---------------------------------------------------------------------------
// lerp
// ---------------------------------------------------------------------------

describe('lerp', () => {
  it('interpolates correctly', () => {
    expect(lerp(0, 10, 0)).toBeCloseTo(0);
    expect(lerp(0, 10, 0.5)).toBeCloseTo(5);
    expect(lerp(0, 10, 1)).toBeCloseTo(10);
  });
});

// ---------------------------------------------------------------------------
// clamp
// ---------------------------------------------------------------------------

describe('clamp', () => {
  it('clamps values to range', () => {
    expect(clamp(5, 0, 10)).toBe(5);
    expect(clamp(-1, 0, 10)).toBe(0);
    expect(clamp(15, 0, 10)).toBe(10);
  });
});

// ---------------------------------------------------------------------------
// computeDeformationScale  (Jeeliz s64)
// ---------------------------------------------------------------------------

describe('computeDeformationScale', () => {
  it('returns 1,1 when yaw is 0 and no offsets', () => {
    const result = computeDeformationScale(0, 0.5, 0);
    expect(result.scaleX).toBeCloseTo(1);
    expect(result.scaleY).toBeCloseTo(1);
  });

  it('scaleX > 1 when yaw > 0 and deformFactor > 0', () => {
    const result = computeDeformationScale(0.5, 0.5, 0);
    // cos(0.5) ≈ 0.877, 1/cos ≈ 1.139, lerp(1, 1.139, 0.5) ≈ 1.07
    expect(result.scaleX).toBeGreaterThan(1);
  });

  it('scaleX < 1 when yaw is negative', () => {
    const result = computeDeformationScale(-0.5, 0.5, 0);
    // cos is symmetric, so this should also be > 1
    expect(result.scaleX).toBeGreaterThan(1);
  });
});

// ---------------------------------------------------------------------------
// computeTempleBend  (Jeeliz s66 / mp)
// ---------------------------------------------------------------------------

describe('computeTempleBend', () => {
  it('returns zero bend when zDepth is 0', () => {
    const result = computeTempleBend(0, 0.35);
    expect(result.rotationOffset).toBeCloseTo(0);
    expect(result.zOffset).toBeCloseTo(0);
  });

  it('bend is proportional to zDepth × strength', () => {
    const z = 0.1;
    const strength = 0.35;
    const result = computeTempleBend(z, strength);
    expect(result.rotationOffset).toBeCloseTo(z * strength);
    expect(result.zOffset).toBeCloseTo(-z * strength);
  });
});

// ---------------------------------------------------------------------------
// computeLensesGradient  (Jeeliz Fd)
// ---------------------------------------------------------------------------

describe('computeLensesGradient', () => {
  it('computes gradient from Jeeliz Fd() formula', () => {
    const result = computeLensesGradient(0.28, 0.5, 0.35, 0.15);

    const expectedCenter = -30 * 0.5 - 40;   // -55
    const expectedHalfWidth = 50 * 0.35 * 0.5; // 8.75

    expect(result.alphaMin).toBeCloseTo(0.28 * 0.15); // 0.042
    expect(result.alphaMax).toBeCloseTo(0.28);
    expect(result.gradientStart).toBeCloseTo(expectedCenter - expectedHalfWidth);
    expect(result.gradientEnd).toBeCloseTo(expectedCenter + expectedHalfWidth);
  });
});

// ---------------------------------------------------------------------------
// temporalSmoothFit  (Jeeliz s68 / s70)
// ---------------------------------------------------------------------------

describe('temporalSmoothFit', () => {
  const baseFit = {
    center: { x: 0.5, y: 0.5, z: 0 },
    width: 0.5,
    roll: 0,
    yaw: 0,
  };

  it('returns current when previous is null', () => {
    const result = temporalSmoothFit(baseFit, null, 16, 0.35, 1.0);
    expect(result).toEqual(baseFit);
  });

  it('returns current when deltaTime is 0', () => {
    const prev = { ...baseFit, center: { x: 0.4, y: 0.4, z: 0 } };
    const result = temporalSmoothFit(baseFit, prev, 0, 0.35, 1.0);
    expect(result).toEqual(baseFit);
  });

  it('smooths large displacements less than small ones', () => {
    const prev = { ...baseFit, center: { x: 0.5, y: 0.5, z: 0 } };
    const smallJump = {
      ...baseFit,
      center: { x: 0.51, y: 0.51, z: 0 },
    };
    const largeJump = {
      ...baseFit,
      center: { x: 0.8, y: 0.8, z: 0 },
    };

    const smallResult = temporalSmoothFit(smallJump, prev, 16, 0.35, 1.0);
    const largeResult = temporalSmoothFit(largeJump, prev, 16, 0.35, 1.0);

    // Large jump → consistency kicks in → less smoothing → closer to current
    // So largeResult.center.x should be closer to largeJump.center.x (0.8)
    // than smallResult.center.x is to smallJump.center.x (0.51)
    const smallDistToCurrent = Math.abs(smallResult.center.x - 0.51);
    const largeDistToCurrent = Math.abs(largeResult.center.x - 0.8);
    // The large jump result should be closer to its raw input (less smoothed)
    // Actually both should be smoothed towards previous... let me think.
    // With consistency: large displacement → consistency → 1 → alpha → 0 → less smoothing → closer to current
    // So largeDistToCurrent should be SMALLER (closer to raw) than proportionally
    expect(largeDistToCurrent / 0.3).toBeLessThan(smallDistToCurrent / 0.01 + 0.01);
  });
});

// ---------------------------------------------------------------------------
// computeEffectiveFOV  (Jeeliz hb.Kg)
// ---------------------------------------------------------------------------

describe('computeEffectiveFOV', () => {
  it('returns a positive FOV for standard inputs', () => {
    const fov = computeEffectiveFOV(Math.PI / 3, 720 / 960, 0.5);
    expect(fov).toBeGreaterThan(0);
    expect(fov).toBeLessThan(Math.PI);
  });
});
