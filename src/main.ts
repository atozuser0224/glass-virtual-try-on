import { JEELIZVTOWIDGET } from 'jeelizvtowidget';
import './styles.css';

const app = document.querySelector<HTMLDivElement>('#app');

if (!app) {
  throw new Error('App root not found.');
}

const DEFAULT_SKU = 'rayban_aviator_or_vertFlash';
const SKU_MODEL_2 = 'rayban_round_cuivre_pinkBrownDegrade';
const SEARCH_IMAGE_MASK = 'https://appstatic.jeeliz.com/jeewidget/images/target512.jpg';

app.innerHTML = `
  <main class="content">
    <header class="header">
      <div class="headerTitle">Jeeliz VTO Widget</div>
    </header>

    <section id="JeelizVTOWidget" aria-label="Jeeliz glasses virtual try-on widget">
      <canvas id="JeelizVTOWidgetCanvas"></canvas>

      <div class="JeelizVTOWidgetControls JeelizVTOWidgetControlsTop">
        <button id="JeelizVTOWidgetAdjust" type="button">
          <span class="buttonIcon"><i class="fas fa-arrows-alt"></i></span>Adjust
        </button>

        <button id="buttonResizeCanvas" type="button">
          <span class="buttonIcon"><i class="fas fa-sync-alt"></i></span>Resize widget
        </button>
      </div>

      <div class="JeelizVTOWidgetControls" id="JeelizVTOWidgetChangeModelContainer">
        <button type="button" data-sku="${DEFAULT_SKU}">Model 1</button>
        <button type="button" data-sku="${SKU_MODEL_2}">Model 2</button>
        <button type="button" id="buttonLoadSku">by SKU</button>
      </div>

      <div id="JeelizVTOWidgetAdjustNotice">
        Move the glasses to adjust them.
        <button class="JeelizVTOWidgetBottomButton" id="JeelizVTOWidgetAdjustExit" type="button">Quit</button>
      </div>

      <div id="JeelizVTOWidgetLoading">
        <div class="JeelizVTOWidgetLoadingText">LOADING...</div>
      </div>
    </section>
  </main>
`;

const widget = app.querySelector<HTMLElement>('#JeelizVTOWidget');
const resizeButton = app.querySelector<HTMLButtonElement>('#buttonResizeCanvas');
const loadSkuButton = app.querySelector<HTMLButtonElement>('#buttonLoadSku');
const modelButtons = app.querySelectorAll<HTMLButtonElement>('[data-sku]');

if (!widget || !resizeButton || !loadSkuButton) {
  throw new Error('Required Jeeliz widget elements are missing.');
}

const widgetElement = widget;
let isResized = false;

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
  const sku = window.prompt('Please enter a glasses model SKU:', 'rayban_wayfarer_havane_marron');
  if (sku) {
    JEELIZVTOWIDGET.load(sku);
  }
}

function startWidget(): void {
  JEELIZVTOWIDGET.start({
    isShadow: getIsShadow(),
    sku: getInitialSku(),
    searchImageMask: SEARCH_IMAGE_MASK,
    searchImageColor: 0xeeeeee,
    callbackReady: () => {
      console.log('INFO: JEELIZVTOWIDGET is ready :)');
    },
    onError: (errorLabel: string) => {
      window.alert(`An error happened. errorLabel = ${errorLabel}`);
    }
  });
}

resizeButton.addEventListener('click', resizeWidget);
loadSkuButton.addEventListener('click', loadModelBySku);
modelButtons.forEach((button) => {
  button.addEventListener('click', () => {
    const sku = button.dataset.sku;
    if (sku) {
      JEELIZVTOWIDGET.load(sku);
    }
  });
});

window.addEventListener('load', startWidget);
