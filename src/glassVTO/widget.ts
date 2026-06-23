import { FaceLandmarker, FilesetResolver } from '@mediapipe/tasks-vision';
import {
  computeFrameFit,
  temporalSmoothFit,
  computeTempleBend,
  computeLensesGradient,
  clamp,
  DEFAULT_FITTING_PARAMS,
  DEFAULT_TEMPLE_BEND,
  DEFAULT_LENSES_GRADIENT,
  type FaceAnchors,
  type FrameFit,
  type FittingParams,
  type Point3,
  type LensesGradient,
} from './jeeliz-math';
import { getModelBySku, type GlassModel } from './catalog';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface WidgetCallbacks {
  ADJUST_START?: (() => void) | null;
  ADJUST_END?: (() => void) | null;
  LOADING_START?: (() => void) | null;
  LOADING_END?: (() => void) | null;
}

export interface WidgetStartOptions {
  isShadow?: boolean;
  sku?: string;
  searchImageMask?: string;
  searchImageColor?: number;
  searchImageRotationSpeed?: number;
  callbackReady?: () => void;
  onError?: (errorLabel: string) => void;
  callbacks?: WidgetCallbacks;
}

interface RuntimeState {
  placeholder: HTMLElement;
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  video: HTMLVideoElement;
  landmarker: FaceLandmarker | null;
  animationId: number;
  model: GlassModel;
  lastFit: FrameFit | null;
  prevTimestamp: number;
  isAdjustMode: boolean;
  isShadow: boolean;
  onError: (errorLabel: string) => void;
  callbacks: WidgetCallbacks;

  // Jeeliz interactive state (ob.scale, ob.offsetX, ob.offsetY)
  pinchScale: number;
  offsetX: number;
  offsetY: number;

  // Gesture tracking
  gestureActive: boolean;
  gestureType: 'drag' | 'pinch' | null;
  gestureLastX: number;
  gestureLastY: number;
  gestureLastDist: number;
  gestureLastAngle: number;

  // Search target
  searchMask: HTMLImageElement | null;
  searchColor: number;
  searchRotation: number;     // animated rotation angle
  searchRotationSpeed: number;

  // Config
  fittingParams: FittingParams;
  templeBend: { beginBendZ: number; bendStrength: number };
  lensesGradient: LensesGradient;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DEFAULT_SKU = 'rayban_aviator_or_vertFlash';
const MEDIAPIPE_WASM =
  'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.35/wasm';
const FACE_MODEL =
  'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/latest/face_landmarker.task';

const LEFT_EYE_INDEX = 33;
const RIGHT_EYE_INDEX = 263;
const NOSE_INDEX = 1;

const SMOOTHING_FACTOR = 0.35;
const CONSISTENCY_THRESHOLD: [number, number] = [0.3, 1.2];

// Interactive control (Jeeliz ob.scale / ob.offset clamp bounds)
//   J.Ti = [0.5, 2.0]   scale range
//   J.vn = 0.015         pinch speed
//   J.$d = 0.3           max offset
//   J.Si = 0.005         pan speed
const PINCH_SCALE_MIN = 0.5;
const PINCH_SCALE_MAX = 2.0;
const PINCH_SPEED = 0.015;
const OFFSET_MAX = 0.3;
const OFFSET_SPEED = 0.005;

let state: RuntimeState | null = null;

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export const GLASSVTOWIDGET = {
  VERSION: '0.3.0',
  start,
  load,
  enter_adjustMode,
  exit_adjustMode,
  capture_image,
  destroy,
};

async function start(options: WidgetStartOptions = {}): Promise<void> {
  destroy();

  const placeholder = document.getElementById('JeelizVTOWidget');
  const canvas = document.getElementById('JeelizVTOWidgetCanvas');
  const onError = options.onError ?? (() => undefined);

  if (!(placeholder instanceof HTMLElement)) {
    onError('PLACEHOLDER_NULL_WIDTH');
    return;
  }
  if (!(canvas instanceof HTMLCanvasElement)) {
    onError('FATAL');
    return;
  }

  const ctx = canvas.getContext('2d');
  const model = getModelBySku(options.sku ?? DEFAULT_SKU);
  if (!ctx || !model) {
    onError(model ? 'FATAL' : 'INVALID_SKU');
    return;
  }

  const video = document.createElement('video');
  video.autoplay = true;
  video.muted = true;
  video.playsInline = true;

  // Load search mask image
  let searchMask: HTMLImageElement | null = null;
  if (options.searchImageMask) {
    searchMask = new Image();
    searchMask.src = options.searchImageMask;
  }

  const lensesGradient = computeLensesGradient(
    0.28,
    DEFAULT_LENSES_GRADIENT.height,
    DEFAULT_LENSES_GRADIENT.smoothness,
    DEFAULT_LENSES_GRADIENT.alphaMinFactor,
  );

  state = {
    placeholder,
    canvas,
    ctx,
    video,
    landmarker: null,
    animationId: 0,
    model,
    lastFit: null,
    prevTimestamp: 0,
    isAdjustMode: false,
    isShadow: options.isShadow ?? true,
    onError,
    callbacks: options.callbacks ?? {},
    pinchScale: 1.0,
    offsetX: 0,
    offsetY: 0,
    gestureActive: false,
    gestureType: null,
    gestureLastX: 0,
    gestureLastY: 0,
    gestureLastDist: 0,
    gestureLastAngle: 0,
    searchMask,
    searchColor: options.searchImageColor ?? 0xeeeeee,
    searchRotation: 0,
    searchRotationSpeed: options.searchImageRotationSpeed ?? 30,
    fittingParams: { ...DEFAULT_FITTING_PARAMS },
    templeBend: { ...DEFAULT_TEMPLE_BEND },
    lensesGradient,
  };

  bindGestureEvents(placeholder);
  syncDomForLoading(true);
  options.callbacks?.LOADING_START?.();

  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: {
        facingMode: 'user',
        width: { ideal: 960 },
        height: { ideal: 720 },
      },
    });
    video.srcObject = stream;
    await video.play();

    const fileset = await FilesetResolver.forVisionTasks(MEDIAPIPE_WASM);
    state.landmarker = await FaceLandmarker.createFromOptions(fileset, {
      baseOptions: {
        modelAssetPath: FACE_MODEL,
        delegate: 'GPU',
      },
      runningMode: 'VIDEO',
      numFaces: 1,
    });

    syncDomForLoading(false);
    options.callbacks?.LOADING_END?.();
    options.callbackReady?.();
    renderLoop();
  } catch (error) {
    console.warn(error);
    syncDomForLoading(false);
    options.callbacks?.LOADING_END?.();
    onError(error instanceof DOMException ? 'WEBCAM_UNAVAILABLE' : 'FATAL');
    renderSearchScreen();
  }
}

function load(sku: string): void {
  const model = getModelBySku(sku);
  if (!model) {
    state?.onError('INVALID_SKU');
    return;
  }
  if (state) {
    state.model = model;
    // Reset interactive state on model switch
    state.pinchScale = 1.0;
    state.offsetX = 0;
    state.offsetY = 0;
    state.lensesGradient = computeLensesGradient(
      0.28,
      DEFAULT_LENSES_GRADIENT.height,
      DEFAULT_LENSES_GRADIENT.smoothness,
      DEFAULT_LENSES_GRADIENT.alphaMinFactor,
    );
  }
}

function enter_adjustMode(): void {
  if (!state) throw new Error('You should call GLASSVTOWIDGET.start() first');
  state.isAdjustMode = true;
  state.callbacks.ADJUST_START?.();
  document.getElementById('JeelizVTOWidgetAdjust')?.style.setProperty('display', 'none');
  document.getElementById('JeelizVTOWidgetChangeModelContainer')?.style.setProperty('display', 'none');
  document.getElementById('JeelizVTOWidgetAdjustNotice')?.style.setProperty('display', 'flex');
}

function exit_adjustMode(): void {
  if (!state) throw new Error('You should call GLASSVTOWIDGET.start() first');
  state.isAdjustMode = false;
  state.callbacks.ADJUST_END?.();
  document.getElementById('JeelizVTOWidgetAdjust')?.style.setProperty('display', 'inline-block');
  document.getElementById('JeelizVTOWidgetChangeModelContainer')?.style.setProperty('display', 'block');
  document.getElementById('JeelizVTOWidgetAdjustNotice')?.style.setProperty('display', 'none');
}

function capture_image(): string {
  if (!state) throw new Error('You should call GLASSVTOWIDGET.start() first');
  return state.canvas.toDataURL('image/png');
}

function destroy(): void {
  if (!state) return;
  cancelAnimationFrame(state.animationId);
  state.landmarker?.close();
  const stream = state.video.srcObject;
  if (stream instanceof MediaStream) {
    stream.getTracks().forEach((t) => t.stop());
  }
  unbindGestureEvents(state.placeholder);
  state = null;
}

// ---------------------------------------------------------------------------
// Gesture handling (Jeeliz adjust mode)
// ---------------------------------------------------------------------------

function bindGestureEvents(el: HTMLElement): void {
  el.addEventListener('touchstart', onGestureStart, { passive: false });
  el.addEventListener('touchmove', onGestureMove, { passive: false });
  el.addEventListener('touchend', onGestureEnd);
  el.addEventListener('mousedown', onGestureStart);
  window.addEventListener('mousemove', onGestureMove);
  window.addEventListener('mouseup', onGestureEnd);
  el.addEventListener('wheel', onWheel, { passive: false });
}

function unbindGestureEvents(el: HTMLElement): void {
  el.removeEventListener('touchstart', onGestureStart);
  el.removeEventListener('touchmove', onGestureMove);
  el.removeEventListener('touchend', onGestureEnd);
  el.removeEventListener('mousedown', onGestureStart);
  window.removeEventListener('mousemove', onGestureMove);
  window.removeEventListener('mouseup', onGestureEnd);
  el.removeEventListener('wheel', onWheel);
}

function onGestureStart(e: MouseEvent | TouchEvent): void {
  if (!state?.isAdjustMode) return;
  e.preventDefault();

  const pos = getEventPos(e);
  if (e instanceof TouchEvent && e.touches.length === 2) {
    // Pinch start
    state.gestureActive = true;
    state.gestureType = 'pinch';
    state.gestureLastDist = touchDist(e);
    state.gestureLastX = (pos[0].x + pos[1].x) * 0.5;
    state.gestureLastY = (pos[0].y + pos[1].y) * 0.5;
  } else {
    // Drag start
    state.gestureActive = true;
    state.gestureType = 'drag';
    state.gestureLastX = pos[0].x;
    state.gestureLastY = pos[0].y;
  }
}

function onGestureMove(e: MouseEvent | TouchEvent): void {
  if (!state?.isAdjustMode || !state.gestureActive) return;
  e.preventDefault();

  const pos = getEventPos(e);

  if (e instanceof TouchEvent && e.touches.length === 2 && state.gestureType === 'pinch') {
    // Pinch zoom (Jeeliz ob.scale)
    const dist = touchDist(e);
    const delta = (state.gestureLastDist - dist) / state.canvas.width;
    state.pinchScale = clamp(
      state.pinchScale + delta * PINCH_SPEED * 30,
      PINCH_SCALE_MIN,
      PINCH_SCALE_MAX,
    );
    state.gestureLastDist = dist;
  } else if (state.gestureType === 'drag') {
    // Pan offset (Jeeliz ob.offsetX / ob.offsetY)
    const dx = (pos[0].x - state.gestureLastX) / state.canvas.width;
    const dy = (pos[0].y - state.gestureLastY) / state.canvas.height;
    state.offsetX = clamp(
      state.offsetX + dx * OFFSET_SPEED * 30,
      -OFFSET_MAX,
      OFFSET_MAX,
    );
    state.offsetY = clamp(
      state.offsetY + dy * OFFSET_SPEED * 30,
      -OFFSET_MAX,
      OFFSET_MAX,
    );
    state.gestureLastX = pos[0].x;
    state.gestureLastY = pos[0].y;
  }
}

function onGestureEnd(): void {
  if (!state) return;
  state.gestureActive = false;
  state.gestureType = null;
}

function onWheel(e: WheelEvent): void {
  if (!state?.isAdjustMode) return;
  e.preventDefault();
  const delta = e.deltaY > 0 ? 0.01 : -0.01;
  state.pinchScale = clamp(
    state.pinchScale + delta * PINCH_SPEED * 30,
    PINCH_SCALE_MIN,
    PINCH_SCALE_MAX,
  );
}

function getEventPos(e: MouseEvent | TouchEvent): Array<{ x: number; y: number }> {
  if (e instanceof TouchEvent) {
    return Array.from(e.touches).map((t) => ({ x: t.clientX, y: t.clientY }));
  }
  return [{ x: e.clientX, y: e.clientY }];
}

function touchDist(e: TouchEvent): number {
  if (e.touches.length < 2) return 0;
  const dx = e.touches[0].clientX - e.touches[1].clientX;
  const dy = e.touches[0].clientY - e.touches[1].clientY;
  return Math.hypot(dx, dy);
}

// ---------------------------------------------------------------------------
// Render loop
// ---------------------------------------------------------------------------

function renderLoop(): void {
  if (!state) return;

  const now = performance.now();
  resizeCanvas();
  drawVideo();

  const result = state.landmarker?.detectForVideo(state.video, now);
  const landmarks = result?.faceLandmarks?.[0];

  if (landmarks) {
    const anchors = toAnchors(landmarks);
    const rawFit = computeFrameFit(anchors, state.fittingParams);

    // Apply model preScale (Jeeliz Ja * J.Qn)
    const modelPreScale = state.model.preScale ?? 1.0;

    // Apply interactive offsets (Jeeliz Be / Ce)
    rawFit.center.x += state.offsetX;
    rawFit.center.y += state.offsetY;
    rawFit.width *= state.pinchScale * modelPreScale;

    // Temporal smoothing (Jeeliz s68 / s70)
    const dt = state.prevTimestamp > 0 ? now - state.prevTimestamp : 0;
    const smoothedFit = temporalSmoothFit(
      rawFit, state.lastFit, dt,
      SMOOTHING_FACTOR, state.fittingParams.pdScale, CONSISTENCY_THRESHOLD,
    );

    state.lastFit = smoothedFit;
    state.prevTimestamp = now;
    drawGlasses(smoothedFit);
  } else {
    // Face lost — draw search target
    state.searchRotation += state.searchRotationSpeed * (1 / 60);
    drawSearchTarget();
    state.lastFit = null;
    state.prevTimestamp = 0;
  }

  state.animationId = requestAnimationFrame(renderLoop);
}

function renderSearchScreen(): void {
  if (!state) return;
  resizeCanvas();
  state.ctx.fillStyle = hexColorString(state.searchColor);
  state.ctx.fillRect(0, 0, state.canvas.width, state.canvas.height);
  drawSearchTarget();
}

// ---------------------------------------------------------------------------
// Canvas / drawing
// ---------------------------------------------------------------------------

function resizeCanvas(): void {
  if (!state) return;
  const rect = state.placeholder.getBoundingClientRect();
  const size = Math.max(1, Math.floor(Math.min(rect.width, rect.height) * devicePixelRatio));
  if (state.canvas.width !== size || state.canvas.height !== size) {
    state.canvas.width = size;
    state.canvas.height = size;
  }
}

function drawVideo(): void {
  if (!state) return;
  const { canvas, ctx, video } = state;
  ctx.save();
  ctx.translate(canvas.width, 0);
  ctx.scale(-1, 1);
  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
  ctx.restore();
}

function drawSearchTarget(): void {
  if (!state) return;
  const { canvas, ctx, searchMask, searchRotation } = state;
  const cx = canvas.width * 0.5;
  const cy = canvas.height * 0.45;
  const rx = canvas.width * 0.18;
  const ry = canvas.height * 0.25;

  ctx.save();

  if (searchMask && searchMask.complete && searchMask.naturalWidth > 0) {
    // Jeeliz-style search mask with rotation
    ctx.translate(cx, cy);
    ctx.rotate((searchRotation * Math.PI) / 180);
    const maskSize = Math.max(rx, ry) * 2.4;
    ctx.globalAlpha = 0.6;
    ctx.drawImage(searchMask, -maskSize / 2, -maskSize / 2, maskSize, maskSize);
    ctx.globalAlpha = 1.0;
  } else {
    // Fallback: pulsing ellipse guide
    const pulse = 1 + 0.05 * Math.sin(searchRotation * Math.PI / 180);
    ctx.strokeStyle = 'rgba(255,255,255,0.85)';
    ctx.lineWidth = Math.max(3, canvas.width * 0.008);
    ctx.setLineDash([canvas.width * 0.03, canvas.width * 0.025]);
    ctx.beginPath();
    ctx.ellipse(cx, cy, rx * pulse, ry * pulse, 0, 0, Math.PI * 2);
    ctx.stroke();

    // Nose bridge guide
    ctx.setLineDash([]);
    ctx.strokeStyle = 'rgba(255,255,255,0.45)';
    ctx.lineWidth = Math.max(2, canvas.width * 0.004);
    ctx.beginPath();
    ctx.moveTo(cx, cy - ry * 0.3);
    ctx.lineTo(cx, cy + ry * 0.5);
    ctx.stroke();
  }

  ctx.restore();
}

// ---------------------------------------------------------------------------
// Glasses rendering
// ---------------------------------------------------------------------------

function drawGlasses(fit: FrameFit): void {
  if (!state) return;
  const { canvas, ctx, model, templeBend } = state;

  const cx = fit.center.x * canvas.width;
  const cy = fit.center.y * canvas.height + canvas.height * 0.02;
  const width = fit.width * canvas.width;

  const heightRatio = getHeightRatio(model.shape);
  const height = width * heightRatio;
  const lensWidth = width * 0.38;
  const bridge = width * 0.12;
  const lineWidth = Math.max(4, width * 0.035);

  // Temple bend
  const zDepth = fit.center.z;
  const bend = computeTempleBend(zDepth + templeBend.beginBendZ, templeBend.bendStrength);
  const templeAngle = bend.rotationOffset * 0.3;

  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(fit.roll);

  if (state.isShadow) {
    ctx.shadowColor = 'rgba(0,0,0,0.35)';
    ctx.shadowBlur = width * 0.035;
    ctx.shadowOffsetY = width * 0.02;
  }

  // Temples (behind lenses)
  drawTemple(-bridge * 0.5 - lensWidth, -height * 0.08, -width * 0.25, -height * 0.15, templeAngle, model, lineWidth);
  drawTemple(bridge * 0.5 + lensWidth, -height * 0.08, width * 0.25, -height * 0.15, -templeAngle, model, lineWidth);

  // Lenses
  drawLens(-bridge * 0.5 - lensWidth, -height * 0.5, lensWidth, height, model, lineWidth);
  drawLens(bridge * 0.5, -height * 0.5, lensWidth, height, model, lineWidth);

  // Bridge
  if (model.shape === 'browline') {
    // Browline has a thick upper bridge
    ctx.strokeStyle = model.frameColor;
    ctx.lineWidth = lineWidth * 1.2;
    ctx.beginPath();
    ctx.moveTo(-bridge * 0.5 - lensWidth * 0.3, -height * 0.5);
    ctx.lineTo(-bridge * 0.5, -height * 0.06);
    ctx.lineTo(bridge * 0.5, -height * 0.06);
    ctx.lineTo(bridge * 0.5 + lensWidth * 0.3, -height * 0.5);
    ctx.stroke();
  } else {
    ctx.strokeStyle = model.bridgeColor;
    ctx.lineWidth = lineWidth * 0.7;
    ctx.beginPath();
    ctx.moveTo(-bridge * 0.5, -height * 0.06);
    ctx.quadraticCurveTo(0, -height * 0.18, bridge * 0.5, -height * 0.06);
    ctx.stroke();
  }

  ctx.restore();
}

function drawLens(
  x: number, y: number,
  lensW: number, lensH: number,
  model: GlassModel, lineWidth: number,
): void {
  if (!state) return;
  const { ctx, lensesGradient } = state;

  let path = new Path2D();
  let radius: number;

  switch (model.shape) {
    case 'round':
      radius = lensH * 0.5;
      path.roundRect(x, y, lensW, lensH, radius);
      break;
    case 'aviator':
      // Aviator: teardrop — wider at top, curved bottom
      radius = lensH * 0.5;
      path.roundRect(x, y, lensW, lensH, radius);
      break;
    case 'cat-eye':
      // Cat-eye: upswept outer corners
      radius = lensH * 0.3;
      path = catEyePath(x, y, lensW, lensH);
      break;
    case 'browline':
      radius = lensH * 0.2;
      path.roundRect(x, y, lensW, lensH, radius);
      break;
    case 'square':
      radius = lensH * 0.2;
      path.roundRect(x, y, lensW, lensH, radius);
      break;
    case 'wayfarer':
    default:
      radius = lensH * 0.25;
      path.roundRect(x, y, lensW, lensH, radius);
      break;
  }

  // Lenses Y-gradient
  const gradStart = y + lensesGradient.gradientStart * 0.01 * lensH;
  const gradEnd = y + lensesGradient.gradientEnd * 0.01 * lensH;
  const gradient = ctx.createLinearGradient(0, gradStart, 0, gradEnd);
  const rgb = extractRGB(model.lensColor);
  gradient.addColorStop(0, rgbaStr(rgb.r, rgb.g, rgb.b, lensesGradient.alphaMin));
  gradient.addColorStop(0.5, rgbaStr(rgb.r, rgb.g, rgb.b, lensesGradient.alphaMax));
  gradient.addColorStop(1, rgbaStr(rgb.r, rgb.g, rgb.b, lensesGradient.alphaMin));

  ctx.fillStyle = gradient;
  ctx.fill(path);
  ctx.strokeStyle = model.frameColor;
  ctx.lineWidth = lineWidth;
  ctx.stroke(path);
}

function drawTemple(
  x: number, y: number, endX: number, endY: number,
  bendAngle: number,
  model: GlassModel, lineWidth: number,
): void {
  if (!state) return;
  const { ctx } = state;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(bendAngle);

  ctx.strokeStyle = model.frameColor;
  ctx.lineWidth = lineWidth * 0.55;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.quadraticCurveTo(endX * 0.45, endY * 0.4, endX, endY);
  ctx.stroke();
  ctx.restore();
}

function catEyePath(x: number, y: number, w: number, h: number): Path2D {
  const p = new Path2D();
  const swoop = h * 0.25;
  p.moveTo(x + h * 0.3, y);                          // top left
  p.quadraticCurveTo(x + w * 0.5, y - swoop, x + w - h * 0.3, y); // top edge with upsweep
  p.lineTo(x + w, y + h * 0.35);                     // outer corner point
  p.quadraticCurveTo(x + w * 0.65, y + h, x + w * 0.5, y + h); // outer bottom curve
  p.lineTo(x + h * 0.3, y + h);                      // bottom edge
  p.quadraticCurveTo(x + w * 0.25, y + h, x, y + h * 0.55); // inner bottom
  p.quadraticCurveTo(x - w * 0.05, y + h * 0.2, x + h * 0.3, y); // inner top
  p.closePath();
  return p;
}

function getHeightRatio(shape: GlassModel['shape']): number {
  switch (shape) {
    case 'aviator': return 0.34;
    case 'round': return 0.32;
    case 'cat-eye': return 0.30;
    case 'browline': return 0.28;
    case 'square': return 0.30;
    case 'wayfarer': return 0.30;
    default: return 0.30;
  }
}

// ---------------------------------------------------------------------------
// Landmark helpers
// ---------------------------------------------------------------------------

function toAnchors(landmarks: Point3[]): FaceAnchors {
  return {
    leftEye: landmarks[LEFT_EYE_INDEX],
    rightEye: landmarks[RIGHT_EYE_INDEX],
    nose: landmarks[NOSE_INDEX],
  };
}

// ---------------------------------------------------------------------------
// Color helpers
// ---------------------------------------------------------------------------

function hexColorString(color: number): string {
  const r = (color >> 16) & 255;
  const g = (color >> 8) & 255;
  const b = color & 255;
  return `rgb(${r},${g},${b})`;
}

function extractRGB(colorStr: string): { r: number; g: number; b: number } {
  const match = colorStr.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
  if (match) {
    return { r: parseInt(match[1], 10), g: parseInt(match[2], 10), b: parseInt(match[3], 10) };
  }
  return { r: 0, g: 0, b: 0 };
}

function rgbaStr(r: number, g: number, b: number, a: number): string {
  return `rgba(${r},${g},${b},${a.toFixed(3)})`;
}

// ---------------------------------------------------------------------------
// DOM helpers
// ---------------------------------------------------------------------------

function syncDomForLoading(isLoading: boolean): void {
  document.getElementById('JeelizVTOWidgetLoading')?.style.setProperty('display', isLoading ? 'block' : 'none');
  document.getElementById('JeelizVTOWidgetAdjust')?.style.setProperty('display', isLoading ? 'none' : 'inline-block');
  document.getElementById('JeelizVTOWidgetChangeModelContainer')
    ?.style.setProperty('display', isLoading ? 'none' : 'block');
}
