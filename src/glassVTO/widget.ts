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
import { createRenderer3D, updateGlassesModel, applyFrameFit, renderFrame, resizeRenderer, disposeRenderer, type Renderer3DState } from './renderer3d';
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

  // Three.js rendering
  r3d: Renderer3DState;
  videoTexture: THREE.VideoTexture;
  videoPlane: THREE.Mesh;

  // Jeeliz interactive state
  pinchScale: number;
  offsetX: number;
  offsetY: number;

  // Gesture tracking
  gestureActive: boolean;
  gestureType: 'drag' | 'pinch' | null;
  gestureLastX: number;
  gestureLastY: number;
  gestureLastDist: number;

  // Search target
  searchMask: HTMLImageElement | null;
  searchColor: number;
  searchRotation: number;
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

// Material mapping: model SKU → our material config
function getMaterialForModel(model: GlassModel): GlassesMaterialConfig {
  // Try to match by color characteristics
  const fc = model.frameColor;
  const r = parseInt(fc.substring(1, 3), 16);
  const g = parseInt(fc.substring(3, 5), 16);
  const b = parseInt(fc.substring(5, 7), 16);

  const brightness = (r + g + b) / 3;
  const saturation = Math.max(r, g, b) - Math.min(r, g, b);

  if (brightness > 160) return { ...DEFAULT_MATERIALS.silver_dark, lensColor: model.lensColor, frameColor: model.frameColor, bridgeColor: model.bridgeColor };
  if (brightness < 60) return { ...DEFAULT_MATERIALS.black, lensColor: model.lensColor, frameColor: model.frameColor, bridgeColor: model.bridgeColor };
  if (r > g + 40 && r > b + 40 && saturation > 40) return { ...DEFAULT_MATERIALS.copper_pink, lensColor: model.lensColor, frameColor: model.frameColor, bridgeColor: model.bridgeColor };
  if (g > 100 && r > 100 && b < 100) return { ...DEFAULT_MATERIALS.gold_green, lensColor: model.lensColor, frameColor: model.frameColor, bridgeColor: model.bridgeColor };
  if (saturation < 30) return { ...DEFAULT_MATERIALS.darkbrown, lensColor: model.lensColor, frameColor: model.frameColor, bridgeColor: model.bridgeColor };

  return {
    frameColor: model.frameColor,
    lensColor: model.lensColor,
    bridgeColor: model.bridgeColor,
    lensOpacity: 0.25,
    metalness: 0.3,
    roughness: 0.5,
  };
}

let state: RuntimeState | null = null;

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export const GLASSVTOWIDGET = {
  VERSION: '0.4.0-3d',
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

  if (!(placeholder instanceof HTMLElement)) { onError('PLACEHOLDER_NULL_WIDTH'); return; }
  if (!(canvas instanceof HTMLCanvasElement)) { onError('FATAL'); return; }

  const model = getModelBySku(options.sku ?? DEFAULT_SKU);
  if (!model) { onError('INVALID_SKU'); return; }

  const video = document.createElement('video');
  video.autoplay = true;
  video.muted = true;
  video.playsInline = true;

  let searchMask: HTMLImageElement | null = null;
  if (options.searchImageMask) {
    searchMask = new Image();
    searchMask.src = options.searchImageMask;
  }

  const lensesGradient = computeLensesGradient(0.28, DEFAULT_LENSES_GRADIENT.height, DEFAULT_LENSES_GRADIENT.smoothness, DEFAULT_LENSES_GRADIENT.alphaMinFactor);

  // Three.js setup
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
  videoPlane.position.z = -0.01;
  r3d.scene.add(videoPlane);

  // Initial glasses model
  const materialConfig = getMaterialForModel(model);
  updateGlassesModel(r3d, model.shape, materialConfig);

  state = {
    placeholder, canvas, video, landmarker: null, animationId: 0, model,
    lastFit: null, prevTimestamp: 0, isAdjustMode: false,
    isShadow: options.isShadow ?? true, onError, callbacks: options.callbacks ?? {},
    r3d, videoTexture, videoPlane,
    pinchScale: 1.0, offsetX: 0, offsetY: 0,
    gestureActive: false, gestureType: null, gestureLastX: 0, gestureLastY: 0, gestureLastDist: 0,
    searchMask, searchColor: options.searchImageColor ?? 0xeeeeee, searchRotation: 0,
    searchRotationSpeed: options.searchImageRotationSpeed ?? 30,
    fittingParams: { ...DEFAULT_FITTING_PARAMS },
    templeBend: { ...DEFAULT_TEMPLE_BEND }, lensesGradient,
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
    renderSearchScreen();
  }
}

function load(sku: string): void {
  const model = getModelBySku(sku);
  if (!model) { state?.onError('INVALID_SKU'); return; }
  if (!state) return;

  state.model = model;
  state.pinchScale = 1.0;
  state.offsetX = 0;
  state.offsetY = 0;

  const matConfig = getMaterialForModel(model);
  updateGlassesModel(state.r3d, model.shape, matConfig);
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
  document.getElementById('JeelizVTOWidgetChangeModelContainer')?.style.setProperty('display', 'block');
  document.getElementById('JeelizVTOWidgetAdjustNotice')?.style.setProperty('display', 'none');
}

function capture_image(): string {
  if (!state) throw new Error('call start() first');
  renderFrame(state.r3d); // ensure latest is drawn
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
  if (state.videoPlane) {
    state.videoPlane.geometry.dispose();
    (state.videoPlane.material as THREE.Material).dispose();
  }
  disposeRenderer(state.r3d);
  state = null;
}

// ---------------------------------------------------------------------------
// Gesture handling
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
    state.gestureActive = true;
    state.gestureType = 'pinch';
    state.gestureLastDist = touchDist(e);
  } else {
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
    const dist = touchDist(e);
    const delta = (state.gestureLastDist - dist) / state.canvas.width;
    state.pinchScale = clamp(state.pinchScale + delta * PINCH_SPEED * 30, PINCH_SCALE_MIN, PINCH_SCALE_MAX);
    state.gestureLastDist = dist;
  } else if (state.gestureType === 'drag') {
    const dx = (pos[0].x - state.gestureLastX) / state.canvas.width;
    const dy = (pos[0].y - state.gestureLastY) / state.canvas.height;
    state.offsetX = clamp(state.offsetX + dx * OFFSET_SPEED * 30, -OFFSET_MAX, OFFSET_MAX);
    state.offsetY = clamp(state.offsetY + dy * OFFSET_SPEED * 30, -OFFSET_MAX, OFFSET_MAX);
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
  state.pinchScale = clamp(state.pinchScale + delta * PINCH_SPEED * 30, PINCH_SCALE_MIN, PINCH_SCALE_MAX);
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
  resizeCanvas();

  // Update video texture
  if (state.video.readyState >= state.video.HAVE_CURRENT_DATA) {
    state.videoTexture.needsUpdate = true;
  }

  // Mirror the video plane for selfie view
  state.videoPlane.scale.x = -1;

  // Detect face
  const result = state.landmarker?.detectForVideo(state.video, now);
  const landmarks = result?.faceLandmarks?.[0];

  if (landmarks) {
    const anchors = toAnchors(landmarks);
    const rawFit = computeFrameFit(anchors, state.fittingParams);

    rawFit.center.x += state.offsetX;
    rawFit.center.y += state.offsetY;
    rawFit.width *= state.pinchScale * (state.model.preScale ?? 1.0);

    const dt = state.prevTimestamp > 0 ? now - state.prevTimestamp : 0;
    const smoothedFit = temporalSmoothFit(rawFit, state.lastFit, dt, SMOOTHING_FACTOR, state.fittingParams.pdScale, CONSISTENCY_THRESHOLD);

    state.lastFit = smoothedFit;
    state.prevTimestamp = now;

    // Apply to 3D glasses
    applyFrameFit(state.r3d, smoothedFit, state.canvas.width);

    // Shadow via soft directional light adjustment
    if (state.isShadow && state.r3d.glassesGroup) {
      state.r3d.keyLight.intensity = 1.2;
      state.r3d.keyLight.castShadow = false;
    }
  } else {
    // Face lost — fade to search mode
    state.lastFit = null;
    state.prevTimestamp = 0;
    state.searchRotation += state.searchRotationSpeed * (1 / 60);
  }

  renderFrame(state.r3d);
  state.animationId = requestAnimationFrame(renderLoop);
}

function renderSearchScreen(): void {
  if (!state) return;
  resizeCanvas();
  state.r3d.renderer.setClearColor(new THREE.Color(0xeeeeee));
  renderFrame(state.r3d);
}

// ---------------------------------------------------------------------------
// Canvas sizing
// ---------------------------------------------------------------------------

function resizeCanvas(): void {
  if (!state) return;
  const rect = state.placeholder.getBoundingClientRect();
  const size = Math.max(1, Math.floor(Math.min(rect.width, rect.height) * devicePixelRatio));
  if (state.canvas.width !== size || state.canvas.height !== size) {
    state.canvas.width = size;
    state.canvas.height = size;
    resizeRenderer(state.r3d, size, size);
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
// DOM helpers
// ---------------------------------------------------------------------------

function syncDomForLoading(isLoading: boolean): void {
  document.getElementById('JeelizVTOWidgetLoading')?.style.setProperty('display', isLoading ? 'block' : 'none');
  document.getElementById('JeelizVTOWidgetAdjust')?.style.setProperty('display', isLoading ? 'none' : 'inline-block');
  document.getElementById('JeelizVTOWidgetChangeModelContainer')?.style.setProperty('display', isLoading ? 'none' : 'block');
}
