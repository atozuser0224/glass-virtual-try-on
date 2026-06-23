import type { FacePose, JeelizDetectState } from './types';

interface TrackerOptions {
  canvasId: string;
  onVideo: (videoElement: HTMLVideoElement) => void;
  onPose: (pose: FacePose) => void;
  onStatus: (message: string) => void;
  onError: (message: string) => void;
}

const JEELIZ_NN_PATH = 'https://appstatic.jeeliz.com/faceFilter/';

export class JeelizTracker {
  private isStarted = false;

  start(options: TrackerOptions): void {
    if (this.isStarted) {
      return;
    }

    if (!window.JEELIZFACEFILTER) {
      options.onError('Jeeliz FaceFilter script is not available.');
      return;
    }

    this.isStarted = true;
    let initFailed = false;
    options.onStatus('카메라 권한을 요청하는 중');

    window.JEELIZFACEFILTER.init({
      canvasId: options.canvasId,
      NNCPath: JEELIZ_NN_PATH,
      followZRot: true,
      maxFacesDetected: 1,
      videoSettings: {
        facingMode: 'user',
        idealWidth: 960,
        idealHeight: 720
      },
      onWebcamAsk: () => {
        options.onStatus('브라우저 카메라 권한을 허용해주세요');
      },
      onWebcamGet: (videoElement) => {
        if (initFailed) {
          return;
        }
        videoElement.muted = true;
        videoElement.playsInline = true;
        options.onVideo(videoElement);
        options.onStatus('얼굴을 화면 중앙에 맞춰주세요');
      },
      callbackReady: (errCode) => {
        if (errCode) {
          initFailed = true;
          this.isStarted = false;
          options.onError(`Jeeliz 초기화 실패: ${errCode}`);
          return;
        }
        options.onStatus('피팅 준비 완료');
      },
      callbackTrack: (detectState) => {
        options.onPose(toFacePose(detectState));
      }
    });
  }
}

function toFacePose(detectState: JeelizDetectState): FacePose {
  return {
    detected: detectState.detected,
    x: detectState.x,
    y: -detectState.y,
    scale: detectState.s,
    rotationX: detectState.rx,
    rotationY: detectState.ry,
    rotationZ: detectState.rz
  };
}
