import { products } from './catalog';
import { JeelizTracker } from './jeelizTracker';
import { renderGlasses, resizeCanvasToDisplaySize } from './renderer';
import type { FacePose, GlassesProduct } from './types';
import './styles.css';

const app = document.querySelector<HTMLDivElement>('#app');

if (!app) {
  throw new Error('App root not found.');
}

let selectedProduct: GlassesProduct = products[0];
let currentPose: FacePose | null = null;
let demoMode = false;
let cameraStarted = false;
let statusMessage = '카메라를 켜고 안경을 착용해보세요';

app.innerHTML = `
  <main class="shell">
    <section class="studio" aria-label="안경 가상 피팅">
      <div class="viewer">
        <video class="camera" autoplay muted playsinline></video>
        <canvas id="jeeliz-tracker" class="tracker" width="640" height="480"></canvas>
        <canvas class="overlay" aria-label="안경 피팅 화면"></canvas>
        <div class="empty-preview">
          <div class="face-card">
            <span></span>
            <strong>Glass Fit Studio</strong>
          </div>
        </div>
        <div class="viewer-topbar">
          <div>
            <span class="eyebrow">Live try-on</span>
            <h1>Glass Fit Studio</h1>
          </div>
          <button class="icon-button" type="button" data-action="capture" title="현재 화면 저장">
            <span aria-hidden="true">◎</span>
          </button>
        </div>
        <div class="status-pill" role="status">${statusMessage}</div>
      </div>
      <aside class="control-panel" aria-label="피팅 컨트롤">
        <div class="selected-summary">
          <span class="eyebrow">Selected frame</span>
          <h2>${selectedProduct.name}</h2>
          <p>${selectedProduct.style}</p>
          <strong>${selectedProduct.price}</strong>
        </div>
        <div class="actions">
          <button class="primary-button" type="button" data-action="start">카메라 켜기</button>
          <button class="secondary-button" type="button" data-action="demo">데모 모드</button>
        </div>
        <div class="catalog" aria-label="안경 상품 목록"></div>
      </aside>
    </section>
  </main>
`;

const video = app.querySelector<HTMLVideoElement>('.camera');
const overlay = app.querySelector<HTMLCanvasElement>('.overlay');
const trackerCanvas = app.querySelector<HTMLCanvasElement>('#jeeliz-tracker');
const catalog = app.querySelector<HTMLDivElement>('.catalog');
const statusPill = app.querySelector<HTMLDivElement>('.status-pill');
const selectedSummary = app.querySelector<HTMLDivElement>('.selected-summary');
const emptyPreview = app.querySelector<HTMLDivElement>('.empty-preview');

if (!video || !overlay || !trackerCanvas || !catalog || !statusPill || !selectedSummary || !emptyPreview) {
  throw new Error('Required app elements are missing.');
}

const cameraVideo = video;
const overlayCanvas = overlay;
const catalogElement = catalog;
const statusElement = statusPill;
const summaryElement = selectedSummary;
const previewElement = emptyPreview;
const tracker = new JeelizTracker();

catalogElement.innerHTML = products.map(renderProductButton).join('');
catalogElement.addEventListener('click', (event) => {
  const button = (event.target as HTMLElement).closest<HTMLButtonElement>('[data-product]');
  if (!button) {
    return;
  }

  const product = products.find((item) => item.id === button.dataset.product);
  if (!product) {
    return;
  }

  selectedProduct = product;
  updateProductSelection();
});

app.addEventListener('click', (event) => {
  const button = (event.target as HTMLElement).closest<HTMLButtonElement>('[data-action]');
  if (!button) {
    return;
  }

  if (button.dataset.action === 'start') {
    startCamera();
  }

  if (button.dataset.action === 'demo') {
    demoMode = !demoMode;
    updateStatus(demoMode ? '데모 모드 실행 중' : statusMessage);
    previewElement.classList.toggle('is-hidden', cameraStarted || demoMode);
  }

  if (button.dataset.action === 'capture') {
    captureFrame();
  }
});

window.addEventListener('resize', () => {
  resizeCanvasToDisplaySize(overlayCanvas);
  window.JEELIZFACEFILTER?.resize?.();
});

updateProductSelection();
requestAnimationFrame(drawLoop);

function startCamera(): void {
  if (cameraStarted) {
    return;
  }

  tracker.start({
    canvasId: 'jeeliz-tracker',
    onVideo: (videoElement) => {
      cameraVideo.srcObject = videoElement.srcObject;
      cameraStarted = true;
      demoMode = false;
      previewElement.classList.add('is-hidden');
    },
    onPose: (pose) => {
      currentPose = pose;
      if (pose.detected > 0.65) {
        updateStatus('얼굴 추적 중');
      }
    },
    onStatus: updateStatus,
    onError: (message) => {
      console.warn(message);
      cameraStarted = false;
      demoMode = true;
      previewElement.classList.add('is-hidden');
      updateStatus('카메라를 사용할 수 없어 데모 모드로 전환했습니다');
    }
  });
}

function drawLoop(): void {
  renderGlasses({
    canvas: overlayCanvas,
    product: selectedProduct,
    pose: currentPose,
    demoMode,
    mirrored: true
  });
  requestAnimationFrame(drawLoop);
}

function updateStatus(message: string): void {
  statusMessage = message;
  statusElement.textContent = message;
}

function updateProductSelection(): void {
  summaryElement.innerHTML = `
    <span class="eyebrow">Selected frame</span>
    <h2>${selectedProduct.name}</h2>
    <p>${selectedProduct.style}</p>
    <strong>${selectedProduct.price}</strong>
  `;

  catalogElement.querySelectorAll<HTMLButtonElement>('[data-product]').forEach((button) => {
    button.classList.toggle('is-selected', button.dataset.product === selectedProduct.id);
  });
}

function renderProductButton(product: GlassesProduct): string {
  return `
    <button class="product-card" type="button" data-product="${product.id}">
      <span class="swatch" style="--frame-color: ${product.frameColor}; --lens-color: ${product.lensTint}">
        <span></span>
      </span>
      <span>
        <strong>${product.name}</strong>
        <small>${product.style}</small>
      </span>
      <em>${product.price}</em>
    </button>
  `;
}

function captureFrame(): void {
  const composed = document.createElement('canvas');
  composed.width = overlayCanvas.width;
  composed.height = overlayCanvas.height;
  const ctx = composed.getContext('2d');
  if (!ctx) {
    return;
  }

  if (cameraStarted && cameraVideo.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
    ctx.save();
    ctx.translate(composed.width, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(cameraVideo, 0, 0, composed.width, composed.height);
    ctx.restore();
  } else {
    ctx.fillStyle = '#dbe4e2';
    ctx.fillRect(0, 0, composed.width, composed.height);
  }

  ctx.drawImage(overlayCanvas, 0, 0);
  const link = document.createElement('a');
  link.download = `${selectedProduct.id}-try-on.png`;
  link.href = composed.toDataURL('image/png');
  link.click();
}
