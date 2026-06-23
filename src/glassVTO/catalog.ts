export interface GlassModel {
  sku: string;
  label: string;
  frameColor: string;
  lensColor: string;
  bridgeColor: string;
  shape: 'aviator' | 'round' | 'wayfarer' | 'square' | 'cat-eye' | 'browline';
  /** Jeeliz preScale — model-specific size adjustment */
  preScale?: number;
  /** Jeeliz preOffset dy — vertical adjustment */
  preOffsetY?: number;
}

export const GLASS_MODELS: GlassModel[] = [
  {
    sku: 'rayban_aviator_or_vertFlash',
    label: 'Aviator Gold',
    frameColor: '#c4a652',
    bridgeColor: '#b4953e',
    lensColor: 'rgba(95, 132, 96, 0.28)',
    shape: 'aviator',
    preScale: 1.0,
  },
  {
    sku: 'rayban_aviator_silver',
    label: 'Aviator Silver',
    frameColor: '#c0c0c0',
    bridgeColor: '#a8a8a8',
    lensColor: 'rgba(60, 80, 70, 0.25)',
    shape: 'aviator',
    preScale: 1.0,
  },
  {
    sku: 'rayban_round_cuivre_pinkBrownDegrade',
    label: 'Round Copper',
    frameColor: '#bd7f5f',
    bridgeColor: '#a7684d',
    lensColor: 'rgba(172, 95, 103, 0.22)',
    shape: 'round',
    preScale: 0.95,
  },
  {
    sku: 'rayban_round_gold_green',
    label: 'Round Gold',
    frameColor: '#d4a853',
    bridgeColor: '#c09840',
    lensColor: 'rgba(50, 100, 60, 0.24)',
    shape: 'round',
    preScale: 0.95,
  },
  {
    sku: 'rayban_wayfarer_havane_marron',
    label: 'Wayfarer Brown',
    frameColor: '#2a1813',
    bridgeColor: '#2a1813',
    lensColor: 'rgba(105, 76, 58, 0.24)',
    shape: 'wayfarer',
    preScale: 1.02,
  },
  {
    sku: 'rayban_wayfarer_black',
    label: 'Wayfarer Black',
    frameColor: '#1a1a1a',
    bridgeColor: '#111111',
    lensColor: 'rgba(40, 40, 40, 0.30)',
    shape: 'wayfarer',
    preScale: 1.02,
  },
  {
    sku: 'square_tortoise_brown',
    label: 'Square Tortoise',
    frameColor: '#6b3a2a',
    bridgeColor: '#5a2d1e',
    lensColor: 'rgba(139, 119, 90, 0.22)',
    shape: 'square',
    preScale: 1.0,
  },
  {
    sku: 'square_black_thick',
    label: 'Square Thick',
    frameColor: '#111111',
    bridgeColor: '#0a0a0a',
    lensColor: 'rgba(60, 60, 60, 0.28)',
    shape: 'square',
    preScale: 1.05,
  },
  {
    sku: 'cateye_tortoise',
    label: 'Cat-Eye Tortoise',
    frameColor: '#8b6914',
    bridgeColor: '#7a5a10',
    lensColor: 'rgba(160, 140, 100, 0.20)',
    shape: 'cat-eye',
    preScale: 0.95,
    preOffsetY: 0.01,
  },
  {
    sku: 'cateye_red',
    label: 'Cat-Eye Red',
    frameColor: '#8b1a1a',
    bridgeColor: '#6e1515',
    lensColor: 'rgba(80, 50, 50, 0.22)',
    shape: 'cat-eye',
    preScale: 0.95,
    preOffsetY: 0.01,
  },
  {
    sku: 'browline_classic',
    label: 'Browline Classic',
    frameColor: '#2a2a2a',
    bridgeColor: '#c4a652',
    lensColor: 'rgba(70, 75, 80, 0.24)',
    shape: 'browline',
    preScale: 1.0,
  },
  {
    sku: 'browline_silver',
    label: 'Browline Silver',
    frameColor: '#3a3a3a',
    bridgeColor: '#d0d0d0',
    lensColor: 'rgba(60, 65, 75, 0.22)',
    shape: 'browline',
    preScale: 1.0,
  },
];

export function getModelBySku(sku: string): GlassModel | null {
  return GLASS_MODELS.find((model) => model.sku === sku) ?? null;
}
