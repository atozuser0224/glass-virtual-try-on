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

const MIN_FRAME_WIDTH = 0.2;
const EYE_TO_FRAME_RATIO = 2.4;

export function computeFrameFit(anchors: FaceAnchors): FrameFit {
  const eyeCenter = midpoint(anchors.leftEye, anchors.rightEye);
  const dx = anchors.rightEye.x - anchors.leftEye.x;
  const dy = anchors.rightEye.y - anchors.leftEye.y;
  const dz = anchors.rightEye.z - anchors.leftEye.z;
  const eyeDistance = Math.hypot(dx, dy);

  return {
    center: {
      x: eyeCenter.x,
      y: eyeCenter.y,
      z: (eyeCenter.z + anchors.nose.z) * 0.5
    },
    width: Math.max(MIN_FRAME_WIDTH, eyeDistance * EYE_TO_FRAME_RATIO),
    roll: Math.atan2(dy, dx),
    yaw: Math.atan2(dz, Math.max(eyeDistance, 0.001))
  };
}

function midpoint(a: Point3, b: Point3): Point3 {
  return {
    x: (a.x + b.x) * 0.5,
    y: (a.y + b.y) * 0.5,
    z: (a.z + b.z) * 0.5
  };
}
