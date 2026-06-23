export type FrameTone = 'charcoal' | 'tortoise' | 'crystal' | 'metal';

export interface GlassesProduct {
  id: string;
  name: string;
  style: string;
  price: string;
  tone: FrameTone;
  fit: 'narrow' | 'medium' | 'wide';
  lensTint: string;
  frameColor: string;
  templeColor: string;
  scale: number;
  bridgeOffset: number;
}

export interface FacePose {
  detected: number;
  x: number;
  y: number;
  scale: number;
  rotationX: number;
  rotationY: number;
  rotationZ: number;
}

export interface JeelizDetectState {
  detected: number;
  x: number;
  y: number;
  s: number;
  rx: number;
  ry: number;
  rz: number;
}

export interface JeelizReadySpec {
  canvasElement: HTMLCanvasElement;
  GL: WebGLRenderingContext;
}

export interface JeelizFaceFilterApi {
  init(options: {
    canvasId: string;
    NNCPath?: string;
    followZRot?: boolean;
    maxFacesDetected?: number;
    videoSettings?: {
      facingMode?: 'user' | 'environment';
      idealWidth?: number;
      idealHeight?: number;
    };
    onWebcamAsk?: () => void;
    onWebcamGet?: (videoElement: HTMLVideoElement) => void;
    callbackReady: (errCode: string | false, spec: JeelizReadySpec) => void;
    callbackTrack: (detectState: JeelizDetectState) => void;
  }): void;
  destroy?: () => void;
  resize?: () => void;
}

declare global {
  interface Window {
    JEELIZFACEFILTER?: JeelizFaceFilterApi;
  }
}
