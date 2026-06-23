import { GLASSVTOWIDGET } from './glassVTO/widget';
import { GLASS_MODELS } from './glassVTO/catalog';
import './styles.css';

const app = document.querySelector<HTMLDivElement>('#app')!;
if (!app) throw new Error('App root not found.');

const DEFAULT_SKU = 'rayban_aviator_or_vertFlash';
const SEARCH_IMAGE_MASK = 'https://appstatic.jeeliz.com/jeewidget/images/target512.jpg';

// ---------------------------------------------------------------------------
// Build DOM
// ---------------------------------------------------------------------------

function modelButton(sku: string, label: string): string {
  return `<button type="button" data-sku="${sku}">${label}</button>`;
}

const modelButtonsHtml = GLASS_MODELS.slice(0, 6)
  .map((m) => modelButton(m.sku, m.label))
  .join('\n');

app.innerHTML = `
  <main class="content">
    <header class="header">
      <div class="headerTitle">Glass VTO Widget</div>
    </header>

    <section id="JeelizVTOWidget" aria-label="Jeeliz glasses virtual try-on widget">
      <canvas id="JeelizVTOWidgetCanvas"></canvas>

      <div class="JeelizVTOWidgetControls JeelizVTOWidgetControlsTop">
        <button id="JeelizVTOWidgetAdjust" type="button">
          <span class="buttonIcon"><i class="fas fa-arrows-alt"></i></span>Adjust
        </button>
        <button id="buttonResizeCanvas" type="button">
          <span class="buttonIcon"><i class="fas fa-sync-alt"></i></span>Resize
        </button>
      </div>

      <div class="JeelizVTOWidgetControls" id="JeelizVTOWidgetChangeModelContainer">
        ${modelButtonsHtml}
        <button type="button" id="buttonLoadMore">+ More</button>
        <button type="button" id="buttonLoadSku">by SKU</button>
      </div>

      <div class="footerInfo">
        <span class="footerInfoText" id="currentModelLabel">Aviator Gold</span>
      </div>

      <div id="JeelizVTOWidgetAdjustNotice">
        Drag to move &bull; Scroll to resize &bull;
        <button class="JeelizVTOWidgetBottomButton" id="JeelizVTOWidgetAdjustExit" type="button">Done</button>
      </div>

      <div id="JeelizVTOWidgetLoading">
        <div class="loadingSpinner"></div>
        <div class="JeelizVTOWidgetLoadingText">LOADING…</div>
      </div>
    </section>
  </main>
`;

// ---------------------------------------------------------------------------
// Wire events
// ---------------------------------------------------------------------------

const widget = app.querySelector<HTMLElement>('#JeelizVTOWidget');
const resizeButton = app.querySelector<HTMLButtonElement>('#buttonResizeCanvas');
const loadSkuButton = app.querySelector<HTMLButtonElement>('#buttonLoadSku');
const loadMoreButton = app.querySelector<HTMLButtonElement>('#buttonLoadMore');
const adjustButton = app.querySelector<HTMLButtonElement>('#JeelizVTOWidgetAdjust');
const adjustExitButton = app.querySelector<HTMLButtonElement>('#JeelizVTOWidgetAdjustExit');
const modelLabel = app.querySelector<HTMLElement>('#currentModelLabel');

if (!widget || !resizeButton || !loadSkuButton || !adjustButton || !adjustExitButton || !loadMoreButton) {
  throw new Error('Required Jeeliz widget elements are missing.');
}

const widgetElement = widget;
let isResized = false;
let showingAllModels = false;

function getInitialSku(): string {
  const params = new URLSearchParams(window.location.search);
  return params.get('sku') || DEFAULT_SKU;
}

function getIsShadow(): boolean {
  return !new URLSearchParams(window.location.search).has('isHideShadow');
}

function resizeWidget(): void {
  const halfHeightPx = `${Math.round(window.innerHeight / 2)}px`;
  widgetElement.style.maxHeight = isResized ? '' : halfHeightPx;
  isResized = !isResized;
}

function loadModelBySku(): void {
  const sku = window.prompt('Enter glasses model SKU:', 'rayban_wayfarer_black');
  if (sku) {
    GLASSVTOWIDGET.load(sku);
    updateModelLabel(sku);
  }
}

function updateModelLabel(sku: string): void {
  const model = GLASS_MODELS.find((m) => m.sku === sku);
  if (model && modelLabel) {
    modelLabel.textContent = model.label;
  }
}

function toggleMoreModels(): void {
  const container = app.querySelector<HTMLElement>('#JeelizVTOWidgetChangeModelContainer');
  if (!container) return;

  showingAllModels = !showingAllModels;
  const models = showingAllModels ? GLASS_MODELS : GLASS_MODELS.slice(0, 6);
  const existingButtons = container.querySelectorAll<HTMLButtonElement>('[data-sku]');
  existingButtons.forEach((b) => b.remove());

  const moreBtn = container.querySelector<HTMLButtonElement>('#buttonLoadMore');
  const skuBtn = container.querySelector<HTMLButtonElement>('#buttonLoadSku');

  models.forEach((m) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.dataset.sku = m.sku;
    btn.textContent = m.label;
    btn.addEventListener('click', () => {
      GLASSVTOWIDGET.load(m.sku);
      updateModelLabel(m.sku);
    });
    if (moreBtn) container.insertBefore(btn, moreBtn);
    else if (skuBtn) container.insertBefore(btn, skuBtn);
    else container.appendChild(btn);
  });

  if (loadMoreButton) loadMoreButton.textContent = showingAllModels ? '− Less' : '+ More';
}

function startWidget(): void {
  const initialSku = getInitialSku();
  updateModelLabel(initialSku);

  void GLASSVTOWIDGET.start({
    isShadow: getIsShadow(),
    sku: initialSku,
    searchImageMask: SEARCH_IMAGE_MASK,
    searchImageColor: 0xeeeeee,
    searchImageRotationSpeed: 30,
    callbackReady: () => {
      console.log('INFO: GLASSVTOWIDGET is ready :)');
    },
    onError: (errorLabel: string) => {
      window.alert(`An error happened. errorLabel = ${errorLabel}`);
    },
  });
}

// Bind events
resizeButton.addEventListener('click', resizeWidget);
loadSkuButton.addEventListener('click', loadModelBySku);
loadMoreButton.addEventListener('click', toggleMoreModels);
adjustButton.addEventListener('click', () => GLASSVTOWIDGET.enter_adjustMode());
adjustExitButton.addEventListener('click', () => GLASSVTOWIDGET.exit_adjustMode());

// Model button clicks (initial 6)
app.querySelectorAll<HTMLButtonElement>('[data-sku]').forEach((button) => {
  button.addEventListener('click', () => {
    const sku = button.dataset.sku;
    if (sku) {
      GLASSVTOWIDGET.load(sku);
      updateModelLabel(sku);
    }
  });
});

window.addEventListener('load', startWidget);
