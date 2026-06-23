import { describe, expect, it } from 'vitest';
import { computeFrameFit } from './fit';

describe('computeFrameFit', () => {
  it('centers the frame between both eyes', () => {
    const fit = computeFrameFit({
      leftEye: { x: 0.4, y: 0.45, z: 0 },
      rightEye: { x: 0.6, y: 0.47, z: 0 },
      nose: { x: 0.5, y: 0.56, z: 0 }
    });

    expect(fit.center.x).toBeCloseTo(0.5);
    expect(fit.center.y).toBeCloseTo(0.46);
    expect(fit.roll).toBeCloseTo(Math.atan2(0.02, 0.2));
    expect(fit.width).toBeCloseTo(0.48);
  });

  it('keeps tiny eye distances from collapsing the rendered frame', () => {
    const fit = computeFrameFit({
      leftEye: { x: 0.5, y: 0.5, z: 0 },
      rightEye: { x: 0.502, y: 0.5, z: 0 },
      nose: { x: 0.501, y: 0.58, z: 0 }
    });

    expect(fit.width).toBeGreaterThanOrEqual(0.2);
  });
});
