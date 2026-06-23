import type { FacePose, GlassesProduct } from './types';

interface RenderOptions {
  canvas: HTMLCanvasElement;
  product: GlassesProduct;
  pose: FacePose | null;
  demoMode: boolean;
  mirrored: boolean;
}

export function resizeCanvasToDisplaySize(canvas: HTMLCanvasElement): boolean {
  const rect = canvas.getBoundingClientRect();
  const width = Math.max(1, Math.round(rect.width * window.devicePixelRatio));
  const height = Math.max(1, Math.round(rect.height * window.devicePixelRatio));

  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
    return true;
  }

  return false;
}

export function renderGlasses(options: RenderOptions): void {
  const { canvas, product, pose, demoMode, mirrored } = options;
  resizeCanvasToDisplaySize(canvas);

  const ctx = canvas.getContext('2d');
  if (!ctx) {
    return;
  }

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  const resolvedPose = pose ?? getDemoPose(canvas);

  if (resolvedPose.detected < 0.52 && !demoMode) {
    drawFaceHint(ctx, canvas);
    return;
  }

  const centerX = (0.5 + resolvedPose.x * 0.5) * canvas.width;
  const centerY = (0.5 + resolvedPose.y * 0.5) * canvas.height;
  const frameWidth = canvas.width * resolvedPose.scale * 1.72 * product.scale;
  const frameHeight = frameWidth * 0.31;
  const rotation = mirrored ? -resolvedPose.rotationZ : resolvedPose.rotationZ;

  ctx.save();
  ctx.translate(centerX, centerY + frameHeight * 0.05 + product.bridgeOffset);
  ctx.rotate(rotation);
  ctx.scale(mirrored ? -1 : 1, 1);
  drawProductFrame(ctx, product, frameWidth, frameHeight);
  ctx.restore();
}

function getDemoPose(canvas: HTMLCanvasElement): FacePose {
  const time = performance.now() * 0.001;
  return {
    detected: 1,
    x: Math.sin(time * 0.7) * 0.035,
    y: -0.03 + Math.cos(time * 0.5) * 0.012,
    scale: Math.min(canvas.width, canvas.height) / canvas.width * 0.42,
    rotationX: 0,
    rotationY: Math.sin(time * 0.5) * 0.12,
    rotationZ: Math.sin(time * 0.65) * 0.035
  };
}

function drawProductFrame(
  ctx: CanvasRenderingContext2D,
  product: GlassesProduct,
  width: number,
  height: number
): void {
  const lensWidth = width * (product.fit === 'wide' ? 0.38 : 0.36);
  const lensHeight = height;
  const bridgeWidth = width * 0.14;
  const leftX = -bridgeWidth * 0.5 - lensWidth;
  const rightX = bridgeWidth * 0.5;
  const lineWidth = Math.max(5, width * 0.035);

  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.shadowColor = 'rgba(0, 0, 0, 0.24)';
  ctx.shadowBlur = width * 0.035;
  ctx.shadowOffsetY = width * 0.018;

  drawTemple(ctx, product, leftX, -lensHeight * 0.1, -width * 0.18, -height * 0.16);
  drawTemple(
    ctx,
    product,
    rightX + lensWidth,
    -lensHeight * 0.1,
    width * 0.18,
    -height * 0.16
  );

  ctx.shadowBlur = width * 0.025;
  drawLens(ctx, leftX, -lensHeight * 0.5, lensWidth, lensHeight, product, lineWidth);
  drawLens(ctx, rightX, -lensHeight * 0.5, lensWidth, lensHeight, product, lineWidth);

  ctx.strokeStyle = product.frameColor;
  ctx.lineWidth = lineWidth * 0.72;
  ctx.beginPath();
  ctx.moveTo(leftX + lensWidth - lineWidth * 0.2, -lensHeight * 0.05);
  ctx.bezierCurveTo(
    -bridgeWidth * 0.34,
    -lensHeight * 0.18,
    bridgeWidth * 0.34,
    -lensHeight * 0.18,
    rightX + lineWidth * 0.2,
    -lensHeight * 0.05
  );
  ctx.stroke();

  ctx.shadowColor = 'transparent';
  ctx.fillStyle = 'rgba(255, 255, 255, 0.34)';
  ctx.fillRect(leftX + lensWidth * 0.25, -lensHeight * 0.32, lensWidth * 0.16, lineWidth * 0.28);
  ctx.fillRect(rightX + lensWidth * 0.25, -lensHeight * 0.32, lensWidth * 0.16, lineWidth * 0.28);
}

function drawLens(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  product: GlassesProduct,
  lineWidth: number
): void {
  const radius = product.tone === 'metal' ? height * 0.48 : height * 0.28;
  const path = new Path2D();
  path.roundRect(x, y, width, height, radius);

  ctx.fillStyle = product.lensTint;
  ctx.fill(path);
  ctx.strokeStyle = product.frameColor;
  ctx.lineWidth = lineWidth;
  ctx.stroke(path);

  if (product.tone === 'tortoise') {
    ctx.save();
    ctx.clip(path);
    ctx.globalAlpha = 0.22;
    ctx.fillStyle = '#d19a52';
    for (let i = 0; i < 6; i += 1) {
      ctx.beginPath();
      ctx.ellipse(
        x + width * (0.18 + i * 0.14),
        y + height * (0.28 + (i % 2) * 0.36),
        width * 0.1,
        height * 0.18,
        i * 0.55,
        0,
        Math.PI * 2
      );
      ctx.fill();
    }
    ctx.restore();
  }
}

function drawTemple(
  ctx: CanvasRenderingContext2D,
  product: GlassesProduct,
  x: number,
  y: number,
  endX: number,
  endY: number
): void {
  ctx.strokeStyle = product.templeColor;
  ctx.lineWidth = Math.max(4, Math.abs(endX) * 0.08);
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.quadraticCurveTo(x + endX * 0.42, y + endY * 0.18, x + endX, y + endY);
  ctx.stroke();
}

function drawFaceHint(ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement): void {
  ctx.save();
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.76)';
  ctx.lineWidth = Math.max(2, canvas.width * 0.004);
  ctx.setLineDash([10, 12]);
  ctx.beginPath();
  ctx.ellipse(
    canvas.width * 0.5,
    canvas.height * 0.46,
    canvas.width * 0.18,
    canvas.height * 0.25,
    0,
    0,
    Math.PI * 2
  );
  ctx.stroke();
  ctx.restore();
}
