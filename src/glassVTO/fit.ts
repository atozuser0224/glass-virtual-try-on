// =============================================================================
// fit.ts — Re-exports frame fitting logic from the Jeeliz math module.
// All calculation formulas are in jeeliz-math.ts (sourced from Jeeliz VTO Widget).
// =============================================================================

export {
  type Point3,
  type FaceAnchors,
  type FrameFit,
  type FittingParams,
  DEFAULT_FITTING_PARAMS,
  computeFrameFit,
  temporalSmoothFit,
  computeDeformationScale,
} from './jeeliz-math';
