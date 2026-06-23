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

const modelButtonsHtml = GLASS_MODELS.map((m) =>
  `<button type="button" data-sku="${m.sku}">${m.label}</button>`
).join('\n');

app.innerHTML = `
  <main class="content">
    <header class="header">
      <div class="headerTitle">Glass VTO</div>
    </header>

    <section id="JeelizVTOWidget" aria-label="Glasses virtual try-on">
      <canvas id="JeelizVTOWidgetCanvas"></canvas>

      <div class="JeelizVTOWidgetControls JeelizVTOWidgetControlsTop">
        <button id="JeelizVTOWidgetAdjust" type="button">
          <span class="buttonIcon"><i class="fas fa-arrows-alt"></i></span>Adjust
        </button>
      </div>

      <div class="JeelizVTOWidgetControls" id="JeelizVTOWidgetChangeModelContainer">
        ${modelButtonsHtml}
      </div>

      <div class="footerInfo">
        <span class="footerInfoText" id="currentModelLabel">Aviator Gold</span>
      </div>

      <div id="JeelizVTOWidgetAdjustNotice">
        <span>Drag to move &bull; Pinch to resize</span>
        <button id="JeelizVTOWidgetAdjustExit" type="button">Done</button>
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
const adjustButton = app.querySelector<HTMLButtonElement>('#JeelizVTOWidgetAdjust');
const adjustExitButton = app.querySelector<HTMLButtonElement>('#JeelizVTOWidgetAdjustExit');
const modelLabel = app.querySelector<HTMLElement>('#currentModelLabel');

if (!widget || !adjustButton || !adjustExitButton) {
  throw new Error('Required widget elements missing.');
}

function getInitialSku(): string {
  return new URLSearchParams(window.location.search).get('sku') || DEFAULT_SKU;
}

function getIsShadow(): boolean {
  return !new URLSearchParams(window.location.search).has('isHideShadow');
}

function updateModelLabel(sku: string): void {
  const model = GLASS_MODELS.find((m) => m.sku === sku);
  if (model && modelLabel) modelLabel.textContent = model.label;
}

// Bind
adjustButton.addEventListener('click', () => GLASSVTOWIDGET.enter_adjustMode());
adjustExitButton.addEventListener('click', () => GLASSVTOWIDGET.exit_adjustMode());

// Model buttons
app.querySelectorAll<HTMLButtonElement>('[data-sku]').forEach((btn) => {
  btn.addEventListener('click', () => {
    const sku = btn.dataset.sku;
    if (sku) {
      GLASSVTOWIDGET.load(sku);
      updateModelLabel(sku);
    }
  });
});

// Start
const initialSku = getInitialSku();
updateModelLabel(initialSku);

window.addEventListener('load', () => {
  void GLASSVTOWIDGET.start({
    isShadow: getIsShadow(),
    sku: initialSku,
    searchImageMask: SEARCH_IMAGE_MASK,
    searchImageColor: 0xeeeeee,
    callbackReady: () => console.log('INFO: GLASSVTOWIDGET ready'),
    onError: (errorLabel: string) => {
      window.alert(`Error: ${errorLabel}`);
    },
  });
});
