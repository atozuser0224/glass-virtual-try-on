import { FaceLandmarker, FilesetResolver } from '@mediapipe/tasks-vision';
import { computeFrameFit, type FaceAnchors, type FrameFit, type Point3 } from './fit';
import { getModelBySku, type GlassModel } from './catalog';

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
  isAdjustMode: boolean;
  isShadow: boolean;
  onError: (errorLabel: string) => void;
  callbacks: WidgetCallbacks;
}

const DEFAULT_SKU = 'rayban_aviator_or_vertFlash';
const MEDIAPIPE_WASM =
  'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.35/wasm';
const FACE_MODEL =
  'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/latest/face_landmarker.task';
const LEFT_EYE_INDEX = 33;
const RIGHT_EYE_INDEX = 263;
const NOSE_INDEX = 1;

let state: RuntimeState | null = null;

export const GLASSVTOWIDGET = {
  VERSION: '0.1.0-clean-room',
  start,
  load,
  enter_adjustMode,
  exit_adjustMode,
  capture_image,
  destroy
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

  state = {
    placeholder,
    canvas,
    ctx,
    video,
    landmarker: null,
    animationId: 0,
    model,
    lastFit: null,
    isAdjustMode: false,
    isShadow: options.isShadow ?? true,
    onError,
    callbacks: options.callbacks ?? {}
  };

  syncDomForLoading(true);
  options.callbacks?.LOADING_START?.();

  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: {
        facingMode: 'user',
        width: { ideal: 960 },
        height: { ideal: 720 }
      }
    });
    video.srcObject = stream;
    await video.play();

    const fileset = await FilesetResolver.forVisionTasks(MEDIAPIPE_WASM);
    state.landmarker = await FaceLandmarker.createFromOptions(fileset, {
      baseOptions: {
        modelAssetPath: FACE_MODEL,
        delegate: 'GPU'
      },
      runningMode: 'VIDEO',
      numFaces: 1
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
  }
}

function enter_adjustMode(): void {
  if (!state) {
    throw new Error('You should call GLASSVTOWIDGET.start() first');
  }

  state.isAdjustMode = true;
  state.callbacks.ADJUST_START?.();
  document.getElementById('JeelizVTOWidgetAdjust')?.style.setProperty('display', 'none');
  document.getElementById('JeelizVTOWidgetChangeModelContainer')?.style.setProperty('display', 'none');
  document.getElementById('JeelizVTOWidgetAdjustNotice')?.style.setProperty('display', 'block');
}

function exit_adjustMode(): void {
  if (!state) {
    throw new Error('You should call GLASSVTOWIDGET.start() first');
  }

  state.isAdjustMode = false;
  state.callbacks.ADJUST_END?.();
  document.getElementById('JeelizVTOWidgetAdjust')?.style.setProperty('display', 'inline-block');
  document.getElementById('JeelizVTOWidgetChangeModelContainer')?.style.setProperty('display', 'block');
  document.getElementById('JeelizVTOWidgetAdjustNotice')?.style.setProperty('display', 'none');
}

function capture_image(): string {
  if (!state) {
    throw new Error('You should call GLASSVTOWIDGET.start() first');
  }
  return state.canvas.toDataURL('image/png');
}

function destroy(): void {
  if (!state) {
    return;
  }

  cancelAnimationFrame(state.animationId);
  state.landmarker?.close();
  const stream = state.video.srcObject;
  if (stream instanceof MediaStream) {
    stream.getTracks().forEach((track) => track.stop());
  }
  state = null;
}

function renderLoop(): void {
  if (!state) {
    return;
  }

  resizeCanvas();
  drawVideo();
  const result = state.landmarker?.detectForVideo(state.video, performance.now());
  const landmarks = result?.faceLandmarks?.[0];

  if (landmarks) {
    const fit = computeFrameFit(toAnchors(landmarks));
    state.lastFit = smoothFit(state.lastFit, fit);
    drawGlasses(state.lastFit);
  } else {
    drawSearchTarget();
  }

  state.animationId = requestAnimationFrame(renderLoop);
}

function renderSearchScreen(): void {
  if (!state) {
    return;
  }
  resizeCanvas();
  state.ctx.fillStyle = '#eeeeee';
  state.ctx.fillRect(0, 0, state.canvas.width, state.canvas.height);
  drawSearchTarget();
}

function resizeCanvas(): void {
  if (!state) {
    return;
  }

  const rect = state.placeholder.getBoundingClientRect();
  const size = Math.max(1, Math.floor(Math.min(rect.width, rect.height) * devicePixelRatio));
  if (state.canvas.width !== size || state.canvas.height !== size) {
    state.canvas.width = size;
    state.canvas.height = size;
  }
}

function drawVideo(): void {
  if (!state) {
    return;
  }

  const { canvas, ctx, video } = state;
  ctx.save();
  ctx.translate(canvas.width, 0);
  ctx.scale(-1, 1);
  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
  ctx.restore();
}

function drawSearchTarget(): void {
  if (!state) {
    return;
  }

  const { canvas, ctx } = state;
  ctx.save();
  ctx.strokeStyle = 'rgba(255,255,255,0.85)';
  ctx.lineWidth = Math.max(3, canvas.width * 0.008);
  ctx.setLineDash([canvas.width * 0.03, canvas.width * 0.025]);
  ctx.beginPath();
  ctx.ellipse(
    canvas.width * 0.5,
    canvas.height * 0.45,
    canvas.width * 0.18,
    canvas.height * 0.25,
    0,
    0,
    Math.PI * 2
  );
  ctx.stroke();
  ctx.restore();
}

function drawGlasses(fit: FrameFit): void {
  if (!state) {
    return;
  }

  const { canvas, ctx, model } = state;
  const cx = fit.center.x * canvas.width;
  const cy = fit.center.y * canvas.height + canvas.height * 0.02;
  const width = fit.width * canvas.width;
  const height = width * (model.shape === 'aviator' ? 0.34 : 0.3);
  const lensWidth = width * 0.38;
  const bridge = width * 0.12;
  const lineWidth = Math.max(4, width * 0.035);

  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(fit.roll);
  if (state.isShadow) {
    ctx.shadowColor = 'rgba(0,0,0,0.35)';
    ctx.shadowBlur = width * 0.035;
    ctx.shadowOffsetY = width * 0.02;
  }

  drawTemple(-bridge * 0.5 - lensWidth, -height * 0.1, -width * 0.25, -height * 0.16);
  drawTemple(bridge * 0.5 + lensWidth, -height * 0.1, width * 0.25, -height * 0.16);
  drawLens(-bridge * 0.5 - lensWidth, -height * 0.5);
  drawLens(bridge * 0.5, -height * 0.5);

  ctx.strokeStyle = model.bridgeColor;
  ctx.lineWidth = lineWidth * 0.7;
  ctx.beginPath();
  ctx.moveTo(-bridge * 0.5, -height * 0.06);
  ctx.quadraticCurveTo(0, -height * 0.18, bridge * 0.5, -height * 0.06);
  ctx.stroke();
  ctx.restore();

  function drawLens(x: number, y: number): void {
    const radius = model.shape === 'round' || model.shape === 'aviator' ? height * 0.5 : height * 0.25;
    const path = new Path2D();
    path.roundRect(x, y, lensWidth, height, radius);
    ctx.fillStyle = model.lensColor;
    ctx.fill(path);
    ctx.strokeStyle = model.frameColor;
    ctx.lineWidth = lineWidth;
    ctx.stroke(path);
  }

  function drawTemple(x: number, y: number, endX: number, endY: number): void {
    ctx.strokeStyle = model.frameColor;
    ctx.lineWidth = lineWidth * 0.55;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.quadraticCurveTo(x + endX * 0.45, y + endY * 0.4, x + endX, y + endY);
    ctx.stroke();
  }
}

function toAnchors(landmarks: Point3[]): FaceAnchors {
  return {
    leftEye: landmarks[LEFT_EYE_INDEX],
    rightEye: landmarks[RIGHT_EYE_INDEX],
    nose: landmarks[NOSE_INDEX]
  };
}

function smoothFit(previous: FrameFit | null, next: FrameFit): FrameFit {
  if (!previous) {
    return next;
  }

  const alpha = 0.35;
  return {
    center: {
      x: lerp(previous.center.x, next.center.x, alpha),
      y: lerp(previous.center.y, next.center.y, alpha),
      z: lerp(previous.center.z, next.center.z, alpha)
    },
    width: lerp(previous.width, next.width, alpha),
    roll: lerp(previous.roll, next.roll, alpha),
    yaw: lerp(previous.yaw, next.yaw, alpha)
  };
}

function lerp(a: number, b: number, alpha: number): number {
  return a + (b - a) * alpha;
}

function syncDomForLoading(isLoading: boolean): void {
  document.getElementById('JeelizVTOWidgetLoading')?.style.setProperty('display', isLoading ? 'block' : 'none');
  document.getElementById('JeelizVTOWidgetAdjust')?.style.setProperty('display', isLoading ? 'none' : 'inline-block');
  document
    .getElementById('JeelizVTOWidgetChangeModelContainer')
    ?.style.setProperty('display', isLoading ? 'none' : 'block');
}
