export interface GlassModel {
  sku: string;
  label: string;
  frameColor: string;
  lensColor: string;
  bridgeColor: string;
  shape: 'aviator' | 'round' | 'wayfarer';
}

export const GLASS_MODELS: GlassModel[] = [
  {
    sku: 'rayban_aviator_or_vertFlash',
    label: 'Model 1',
    frameColor: '#c4a652',
    bridgeColor: '#b4953e',
    lensColor: 'rgba(95, 132, 96, 0.28)',
    shape: 'aviator'
  },
  {
    sku: 'rayban_round_cuivre_pinkBrownDegrade',
    label: 'Model 2',
    frameColor: '#bd7f5f',
    bridgeColor: '#a7684d',
    lensColor: 'rgba(172, 95, 103, 0.22)',
    shape: 'round'
  },
  {
    sku: 'rayban_wayfarer_havane_marron',
    label: 'Wayfarer',
    frameColor: '#2a1813',
    bridgeColor: '#2a1813',
    lensColor: 'rgba(105, 76, 58, 0.24)',
    shape: 'wayfarer'
  }
];

export function getModelBySku(sku: string): GlassModel | null {
  return GLASS_MODELS.find((model) => model.sku === sku) ?? null;
}
