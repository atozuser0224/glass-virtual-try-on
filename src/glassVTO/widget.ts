import { FaceLandmarker, FilesetResolver } from '@mediapipe/tasks-vision';
import * as THREE from 'three';
import {
  computeFrameFit,
  temporalSmoothFit,
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
import {
  createRenderer3D, updateGlassesModel, applyFrameFit,
  renderFrame, resizeRenderer, disposeRenderer,
  type Renderer3DState,
} from './renderer3d';
import { DEFAULT_MATERIALS, type GlassesMaterialConfig } from './glasses3d';

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

  r3d: Renderer3DState;
  videoTexture: THREE.VideoTexture;
  videoPlane: THREE.Mesh;
  canvasAspect: number;

  pinchScale: number;
  offsetX: number;
  offsetY: number;

  gestureActive: boolean;
  gestureType: 'drag' | 'pinch' | null;
  gestureLastX: number;
  gestureLastY: number;
  gestureLastDist: number;

  fittingParams: FittingParams;
  templeBend: { beginBendZ: number; bendStrength: number };
  lensesGradient: LensesGradient;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DEFAULT_SKU = 'rayban_aviator_or_vertFlash';
const MEDIAPIPE_WASM = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.35/wasm';
const FACE_MODEL = 'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/latest/face_landmarker.task';

const LEFT_EYE_INDEX = 33;
const RIGHT_EYE_INDEX = 263;
const NOSE_INDEX = 1;

const SMOOTHING_FACTOR = 0.35;
const CONSISTENCY_THRESHOLD: [number, number] = [0.3, 1.2];

const PINCH_SCALE_MIN = 0.5;
const PINCH_SCALE_MAX = 2.0;
const PINCH_SPEED = 0.015;
const OFFSET_MAX = 0.3;
const OFFSET_SPEED = 0.005;

// Mobile performance: cap pixel ratio
const MAX_DPR = 1.5;

let state: RuntimeState | null = null;

// ---------------------------------------------------------------------------
// Material resolver
// ---------------------------------------------------------------------------

function getMaterialForModel(model: GlassModel): GlassesMaterialConfig {
  const fc = model.frameColor;
  const r = parseInt(fc.substring(1, 3), 16);
  const g = parseInt(fc.substring(3, 5), 16);
  const b = parseInt(fc.substring(5, 7), 16);
  const brightness = (r + g + b) / 3;

  if (brightness > 160) return { ...DEFAULT_MATERIALS.silver_dark, lensColor: model.lensColor, frameColor: model.frameColor, bridgeColor: model.bridgeColor };
  if (brightness < 60) return { ...DEFAULT_MATERIALS.black, lensColor: model.lensColor, frameColor: model.frameColor, bridgeColor: model.bridgeColor };
  if (r > g + 40 && r > b + 40) return { ...DEFAULT_MATERIALS.copper_pink, lensColor: model.lensColor, frameColor: model.frameColor, bridgeColor: model.bridgeColor };
  return { frameColor: model.frameColor, lensColor: model.lensColor, bridgeColor: model.bridgeColor, lensOpacity: 0.25, metalness: 0.3, roughness: 0.5 };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export const GLASSVTOWIDGET = {
  VERSION: '0.6.0-mobile',
  start, load, enter_adjustMode, exit_adjustMode, capture_image, destroy,
};

async function start(options: WidgetStartOptions = {}): Promise<void> {
  destroy();

  const placeholder = document.getElementById('JeelizVTOWidget');
  const canvas = document.getElementById('JeelizVTOWidgetCanvas');
  const onError = options.onError ?? (() => undefined);

  if (!(placeholder instanceof HTMLElement)) { onError('PLACEHOLDER_NULL_WIDTH'); return; }
  if (!(canvas instanceof HTMLCanvasElement)) { onError('FATAL'); return; }

  const model = getModelBySku(options.sku ?? DEFAULT_SKU);
  if (!model) { onError('INVALID_SKU'); return; }

  const video = document.createElement('video');
  video.autoplay = true;
  video.muted = true;
  video.playsInline = true;
  video.setAttribute('playsinline', '');

  const r3d = createRenderer3D(canvas);

  // Video background plane
  const videoTexture = new THREE.VideoTexture(video);
  videoTexture.minFilter = THREE.LinearFilter;
  videoTexture.magFilter = THREE.LinearFilter;
  videoTexture.colorSpace = THREE.SRGBColorSpace;

  const videoPlaneGeo = new THREE.PlaneGeometry(2, 2);
  const videoPlaneMat = new THREE.MeshBasicMaterial({ map: videoTexture, depthTest: false, depthWrite: false });
  const videoPlane = new THREE.Mesh(videoPlaneGeo, videoPlaneMat);
  videoPlane.renderOrder = -1;
  videoPlane.position.z = -0.5;
  r3d.scene.add(videoPlane);

  // Initial glasses
  updateGlassesModel(r3d, model.shape, getMaterialForModel(model));

  state = {
    placeholder, canvas, video, landmarker: null, animationId: 0, model,
    lastFit: null, prevTimestamp: 0, isAdjustMode: false,
    isShadow: options.isShadow ?? true, onError, callbacks: options.callbacks ?? {},
    r3d, videoTexture, videoPlane, canvasAspect: 1,
    pinchScale: 1, offsetX: 0, offsetY: 0,
    gestureActive: false, gestureType: null, gestureLastX: 0, gestureLastY: 0, gestureLastDist: 0,
    fittingParams: { ...DEFAULT_FITTING_PARAMS },
    templeBend: { ...DEFAULT_TEMPLE_BEND },
    lensesGradient: computeLensesGradient(0.28, DEFAULT_LENSES_GRADIENT.height, DEFAULT_LENSES_GRADIENT.smoothness, DEFAULT_LENSES_GRADIENT.alphaMinFactor),
  };

  bindGestureEvents(placeholder);
  syncDomForLoading(true);
  options.callbacks?.LOADING_START?.();

  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'user', width: { ideal: 960 }, height: { ideal: 720 } },
    });
    video.srcObject = stream;
    await video.play();

    const fileset = await FilesetResolver.forVisionTasks(MEDIAPIPE_WASM);
    state.landmarker = await FaceLandmarker.createFromOptions(fileset, {
      baseOptions: { modelAssetPath: FACE_MODEL, delegate: 'GPU' },
      runningMode: 'VIDEO', numFaces: 1,
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
  }
}

function load(sku: string): void {
  const model = getModelBySku(sku);
  if (!model) { state?.onError('INVALID_SKU'); return; }
  if (!state) return;
  state.model = model;
  state.pinchScale = 1;
  state.offsetX = 0;
  state.offsetY = 0;
  updateGlassesModel(state.r3d, model.shape, getMaterialForModel(model));
}

function enter_adjustMode(): void {
  if (!state) throw new Error('call start() first');
  state.isAdjustMode = true;
  state.callbacks.ADJUST_START?.();
  document.getElementById('JeelizVTOWidgetAdjust')?.style.setProperty('display', 'none');
  document.getElementById('JeelizVTOWidgetChangeModelContainer')?.style.setProperty('display', 'none');
  document.getElementById('JeelizVTOWidgetAdjustNotice')?.style.setProperty('display', 'flex');
}

function exit_adjustMode(): void {
  if (!state) throw new Error('call start() first');
  state.isAdjustMode = false;
  state.callbacks.ADJUST_END?.();
  document.getElementById('JeelizVTOWidgetAdjust')?.style.setProperty('display', 'inline-block');
  document.getElementById('JeelizVTOWidgetChangeModelContainer')?.style.setProperty('display', 'flex');
  document.getElementById('JeelizVTOWidgetAdjustNotice')?.style.setProperty('display', 'none');
}

function capture_image(): string {
  if (!state) throw new Error('call start() first');
  renderFrame(state.r3d);
  return state.canvas.toDataURL('image/png');
}

function destroy(): void {
  if (!state) return;
  cancelAnimationFrame(state.animationId);
  state.landmarker?.close();
  const stream = state.video.srcObject;
  if (stream instanceof MediaStream) stream.getTracks().forEach((t) => t.stop());
  unbindGestureEvents(state.placeholder);
  state.videoTexture.dispose();
  state.videoPlane.geometry.dispose();
  (state.videoPlane.material as THREE.Material).dispose();
  disposeRenderer(state.r3d);
  state = null;
}

// ---------------------------------------------------------------------------
// Gestures
// ---------------------------------------------------------------------------

function bindGestureEvents(el: HTMLElement): void {
  el.addEventListener('touchstart', onGestureStart, { passive: false });
  el.addEventListener('touchmove', onGestureMove, { passive: false });
  el.addEventListener('touchend', onGestureEnd);
  el.addEventListener('touchcancel', onGestureEnd);
  el.addEventListener('mousedown', onGestureStart);
  window.addEventListener('mousemove', onGestureMove);
  window.addEventListener('mouseup', onGestureEnd);
  el.addEventListener('wheel', onWheel, { passive: false });
}

function unbindGestureEvents(el: HTMLElement): void {
  el.removeEventListener('touchstart', onGestureStart);
  el.removeEventListener('touchmove', onGestureMove);
  el.removeEventListener('touchend', onGestureEnd);
  el.removeEventListener('touchcancel', onGestureEnd);
  el.removeEventListener('mousedown', onGestureStart);
  window.removeEventListener('mousemove', onGestureMove);
  window.removeEventListener('mouseup', onGestureEnd);
  el.removeEventListener('wheel', onWheel);
}

function onGestureStart(e: MouseEvent | TouchEvent): void {
  if (!state?.isAdjustMode) return;
  e.preventDefault();
  const pos = getEventPos(e);
  if (e instanceof TouchEvent && e.touches.length >= 2) {
    state.gestureActive = true; state.gestureType = 'pinch';
    state.gestureLastDist = touchDist(e);
  } else {
    state.gestureActive = true; state.gestureType = 'drag';
    state.gestureLastX = pos[0].x; state.gestureLastY = pos[0].y;
  }
}

function onGestureMove(e: MouseEvent | TouchEvent): void {
  if (!state?.isAdjustMode || !state.gestureActive) return;
  e.preventDefault();
  const pos = getEventPos(e);

  if (e instanceof TouchEvent && e.touches.length >= 2 && state.gestureType === 'pinch') {
    const dist = touchDist(e);
    if (state.gestureLastDist > 0) {
      const delta = (state.gestureLastDist - dist) / Math.min(state.canvas.width, state.canvas.height);
      state.pinchScale = clamp(state.pinchScale + delta * PINCH_SPEED * 20, PINCH_SCALE_MIN, PINCH_SCALE_MAX);
    }
    state.gestureLastDist = dist;
  } else if (state.gestureType === 'drag') {
    const dx = (pos[0].x - state.gestureLastX) / state.canvas.width;
    const dy = (pos[0].y - state.gestureLastY) / state.canvas.height;
    state.offsetX = clamp(state.offsetX + dx * OFFSET_SPEED * 20, -OFFSET_MAX, OFFSET_MAX);
    state.offsetY = clamp(state.offsetY + dy * OFFSET_SPEED * 20, -OFFSET_MAX, OFFSET_MAX);
    state.gestureLastX = pos[0].x; state.gestureLastY = pos[0].y;
  }
}

function onGestureEnd(): void {
  if (!state) return;
  state.gestureActive = false; state.gestureType = null;
}

function onWheel(e: WheelEvent): void {
  if (!state?.isAdjustMode) return;
  e.preventDefault();
  const delta = e.deltaY > 0 ? 0.015 : -0.015;
  state.pinchScale = clamp(state.pinchScale + delta * PINCH_SPEED * 20, PINCH_SCALE_MIN, PINCH_SCALE_MAX);
}

function getEventPos(e: MouseEvent | TouchEvent): Array<{ x: number; y: number }> {
  if (e instanceof TouchEvent) return Array.from(e.touches).map((t) => ({ x: t.clientX, y: t.clientY }));
  return [{ x: e.clientX, y: e.clientY }];
}

function touchDist(e: TouchEvent): number {
  if (e.touches.length < 2) return 0;
  return Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
}

// ---------------------------------------------------------------------------
// Render loop
// ---------------------------------------------------------------------------

function renderLoop(): void {
  if (!state) return;
  const now = performance.now();
  resize();

  if (state.video.readyState >= state.video.HAVE_CURRENT_DATA) {
    state.videoTexture.needsUpdate = true;
  }

  state.videoPlane.scale.x = -1; // mirror

  const result = state.landmarker?.detectForVideo(state.video, now);
  const landmarks = result?.faceLandmarks?.[0];

  if (landmarks) {
    const rawFit = computeFrameFit(toAnchors(landmarks), state.fittingParams);
    rawFit.center.x += state.offsetX;
    rawFit.center.y += state.offsetY;
    rawFit.width *= state.pinchScale * (state.model.preScale ?? 1.0);

    const dt = state.prevTimestamp > 0 ? now - state.prevTimestamp : 0;
    const fit = temporalSmoothFit(rawFit, state.lastFit, dt, SMOOTHING_FACTOR, state.fittingParams.pdScale, CONSISTENCY_THRESHOLD);
    state.lastFit = fit;
    state.prevTimestamp = now;

    applyFrameFit(state.r3d, fit, state.canvasAspect);
  } else {
    state.lastFit = null;
    state.prevTimestamp = 0;
  }

  renderFrame(state.r3d);
  state.animationId = requestAnimationFrame(renderLoop);
}

// ---------------------------------------------------------------------------
// Canvas + video sizing — handles portrait/landscape/any aspect
// ---------------------------------------------------------------------------

function resize(): void {
  if (!state) return;
  const rect = state.placeholder.getBoundingClientRect();
  if (rect.width < 2 || rect.height < 2) return;

  const dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);
  const w = Math.floor(rect.width * dpr);
  const h = Math.floor(rect.height * dpr);

  if (state.canvas.width !== w || state.canvas.height !== h) {
    state.canvas.width = w;
    state.canvas.height = h;
    state.canvasAspect = w / h;
    resizeRenderer(state.r3d, w, h);
  }

  // Scale video plane to COVER the viewport (preserving video aspect)
  // Camera FOV=55° at z=1, video plane at z=-0.5
  // visible half-height at z=-0.5 = tan(27.5°) * 1.5 ≈ 0.781
  const halfFov = (55 * Math.PI) / 360;
  const camToPlane = 1.0 - (-0.5); // 1.5
  const visibleHalfH = Math.tan(halfFov) * camToPlane;

  const videoW = state.video.videoWidth || 640;
  const videoH = state.video.videoHeight || 480;
  const videoAspect = videoW / Math.max(videoH, 1); // landscape ~1.33

  const canvasAspect = state.canvasAspect;

  // "cover" — scale video plane so it fills the viewport
  let planeScaleX: number;
  let planeScaleY: number;

  if (canvasAspect > videoAspect) {
    // Canvas wider than video → match height, overflow width
    planeScaleY = visibleHalfH;
    planeScaleX = planeScaleY * canvasAspect;
  } else {
    // Canvas taller than video → match width, overflow height
    planeScaleX = visibleHalfH * canvasAspect;
    planeScaleY = planeScaleX / videoAspect;
  }

  // PlaneGeometry is 2×2, so we need scale to make 2*scale = desired size
  state.videoPlane.scale.set(planeScaleX, planeScaleY, 1);
}

// ---------------------------------------------------------------------------
// Landmarks
// ---------------------------------------------------------------------------

function toAnchors(landmarks: Point3[]): FaceAnchors {
  return {
    leftEye: landmarks[LEFT_EYE_INDEX],
    rightEye: landmarks[RIGHT_EYE_INDEX],
    nose: landmarks[NOSE_INDEX],
  };
}

// ---------------------------------------------------------------------------
// DOM
// ---------------------------------------------------------------------------

function syncDomForLoading(isLoading: boolean): void {
  document.getElementById('JeelizVTOWidgetLoading')?.style.setProperty('display', isLoading ? 'flex' : 'none');
  document.getElementById('JeelizVTOWidgetAdjust')?.style.setProperty('display', isLoading ? 'none' : 'inline-block');
  document.getElementById('JeelizVTOWidgetChangeModelContainer')?.style.setProperty('display', isLoading ? 'none' : 'flex');
}
