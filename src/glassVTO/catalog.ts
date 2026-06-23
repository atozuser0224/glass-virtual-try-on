// =============================================================================
// catalog.ts — Glasses models catalog
// Shapes match Jeeliz 3D mesh types. Material data sourced from
// Jeeliz GlassesDB API (https://glassesdbcached.jeeliz.com/sku/).
// =============================================================================

export interface GlassModel {
  sku: string;
  label: string;
  frameColor: string;
  lensColor: string;
  bridgeColor: string;
  shape: 'aviator' | 'round' | 'wayfarer' | 'square' | 'cat-eye' | 'browline';
  preScale?: number;
  preOffsetY?: number;
  /** Jeeliz material slots from GlassesDB */
  jeelizMats?: string[];
}

export const GLASS_MODELS: GlassModel[] = [
  // ── Aviators ──────────────────────────────────────────────────────────
  {
    sku: 'rayban_aviator_or_vertFlash',
    label: 'Aviator Gold / Green',
    frameColor: '#c4a652',       // metals/rb_or
    bridgeColor: '#b4953e',
    lensColor: 'rgba(95, 132, 96, 0.28)',  // glasses/rb_vertflash_aviator
    shape: 'aviator',
    preScale: 1.0,
    jeelizMats: ['plastic/transparent', 'glasses/rb_vertflash_aviator', 'metals/rb_or', 'plastic/transparent'],
  },
  {
    sku: 'rayban_aviator_argent_bleuMirroir',
    label: 'Aviator Silver / Blue',
    frameColor: '#c0c0c0',       // metals/rb_argent
    bridgeColor: '#a8a8a8',
    lensColor: 'rgba(70, 120, 180, 0.25)',  // blue mirror
    shape: 'aviator',
    preScale: 1.0,
    jeelizMats: ['plastic/transparent', 'glasses/rb_bleumirroir', 'metals/rb_argent'],
  },
  {
    sku: 'rayban_aviator_noir_marron',
    label: 'Aviator Dark / Brown',
    frameColor: '#2a2a2a',
    bridgeColor: '#1a1a1a',
    lensColor: 'rgba(120, 80, 50, 0.26)',  // brown gradient
    shape: 'aviator',
    preScale: 1.0,
    jeelizMats: ['plastic/black', 'glasses/rb_marronclassicB15', 'metals/rb_noir'],
  },

  // ── Round ─────────────────────────────────────────────────────────────
  {
    sku: 'rayban_round_cuivre_pinkBrownDegrade',
    label: 'Round Copper / Pink-Brown',
    frameColor: '#bd7f5f',       // metals/rb_cuivre
    bridgeColor: '#a7684d',
    lensColor: 'rgba(172, 95, 103, 0.22)',  // glasses/rb_pinkbrowndegrade_round
    shape: 'round',
    preScale: 0.95,
    jeelizMats: ['metals/rb_cuivre', 'glasses/rb_pinkbrowndegrade_round', 'plastic/transparent', 'plastic/marronfonce'],
  },
  {
    sku: 'rayban_round_gold_green',
    label: 'Round Gold / Green',
    frameColor: '#d4a853',       // metals/rb_or
    bridgeColor: '#c09840',
    lensColor: 'rgba(50, 100, 60, 0.24)',
    shape: 'round',
    preScale: 0.95,
    jeelizMats: ['metals/rb_or', 'glasses/rb_vertflash_round', 'plastic/transparent'],
  },
  {
    sku: 'rayban_round_argent_vert',
    label: 'Round Silver / Green',
    frameColor: '#c8c8c8',
    bridgeColor: '#b0b0b0',
    lensColor: 'rgba(55, 110, 70, 0.24)',
    shape: 'round',
    preScale: 0.95,
    jeelizMats: ['metals/rb_argent', 'glasses/rb_vertflash_round'],
  },

  // ── Wayfarers ─────────────────────────────────────────────────────────
  {
    sku: 'rayban_wayfarer_havane_marron',
    label: 'Wayfarer Tortoise / Brown',
    frameColor: '#2a1813',       // plastic/havane_wayfarer
    bridgeColor: '#2a1813',
    lensColor: 'rgba(105, 76, 58, 0.24)',  // glasses/rb_marronclassicB15_wayfarer
    shape: 'wayfarer',
    preScale: 1.02,
    jeelizMats: ['plastic/havane', 'glasses/rb_marronclassicB15_wayfarer', 'metals/rb_argent', 'plastic/havane_wayfarer'],
  },
  {
    sku: 'rayban_wayfarer_noir_vert',
    label: 'Wayfarer Black / Green',
    frameColor: '#1a1a1a',       // plastic/black
    bridgeColor: '#111111',
    lensColor: 'rgba(50, 100, 60, 0.28)',
    shape: 'wayfarer',
    preScale: 1.02,
    jeelizMats: ['plastic/black', 'glasses/rb_vertflash_wayfarer', 'metals/rb_argent'],
  },
  {
    sku: 'rayban_wayfarer_ecaille_bleu',
    label: 'Wayfarer Havana / Blue',
    frameColor: '#5c3a28',
    bridgeColor: '#4a2e20',
    lensColor: 'rgba(60, 90, 160, 0.26)',
    shape: 'wayfarer',
    preScale: 1.02,
    jeelizMats: ['plastic/havane', 'glasses/rb_bleumirroir', 'metals/rb_argent'],
  },

  // ── Justin ────────────────────────────────────────────────────────────
  {
    sku: 'rayban_justin_noir_bleuMirroir',
    label: 'Justin Black / Blue Mirror',
    frameColor: '#111111',       // plastic/black_justin
    bridgeColor: '#0a0a0a',
    lensColor: 'rgba(60, 110, 200, 0.28)',  // glasses/rb_bleumirroir_justin
    shape: 'wayfarer',
    preScale: 1.0,
    jeelizMats: ['plastic/black_justin', 'glasses/rb_bleumirroir_justin'],
  },
  {
    sku: 'rayban_justin_marron_marron',
    label: 'Justin Brown / Brown',
    frameColor: '#4a3020',
    bridgeColor: '#3a2518',
    lensColor: 'rgba(100, 70, 40, 0.26)',
    shape: 'wayfarer',
    preScale: 1.0,
    jeelizMats: ['plastic/marron', 'glasses/rb_marronclassicB15', 'plastic/marron'],
  },

  // ── Clubmaster / Browline ─────────────────────────────────────────────
  {
    sku: 'browline_noir_or',
    label: 'Clubmaster Black / Gold',
    frameColor: '#1a1a1a',
    bridgeColor: '#c4a652',       // metals/rb_or bridge
    lensColor: 'rgba(65, 80, 70, 0.24)',
    shape: 'browline',
    preScale: 1.0,
    jeelizMats: ['plastic/black', 'glasses/rb_vertflash', 'metals/rb_or', 'plastic/black'],
  },
  {
    sku: 'browline_havane_or',
    label: 'Clubmaster Havana / Gold',
    frameColor: '#5c3a28',
    bridgeColor: '#d4a853',
    lensColor: 'rgba(85, 100, 70, 0.22)',
    shape: 'browline',
    preScale: 1.0,
    jeelizMats: ['plastic/havane', 'glasses/rb_marronclassicB15', 'metals/rb_or', 'plastic/havane'],
  },

  // ── Square ────────────────────────────────────────────────────────────
  {
    sku: 'square_ecaille_marron',
    label: 'Square Tortoise / Brown',
    frameColor: '#6b3a2a',
    bridgeColor: '#5a2d1e',
    lensColor: 'rgba(139, 119, 90, 0.22)',
    shape: 'square',
    preScale: 1.0,
    jeelizMats: ['plastic/tortoise', 'glasses/marron', 'metals/rb_or'],
  },
  {
    sku: 'square_noir_noir',
    label: 'Square Black / Dark',
    frameColor: '#111111',
    bridgeColor: '#0a0a0a',
    lensColor: 'rgba(40, 40, 40, 0.30)',
    shape: 'square',
    preScale: 1.05,
    jeelizMats: ['plastic/black', 'glasses/noir'],
  },

  // ── Cat-Eye ───────────────────────────────────────────────────────────
  {
    sku: 'cateye_ecaille_marronDegrade',
    label: 'Cat-Eye Tortoise / Brown',
    frameColor: '#8b6914',
    bridgeColor: '#7a5a10',
    lensColor: 'rgba(160, 140, 100, 0.20)',
    shape: 'cat-eye',
    preScale: 0.95,
    preOffsetY: 0.01,
    jeelizMats: ['plastic/tortoise', 'glasses/browndegrade', 'plastic/tortoise'],
  },
  {
    sku: 'cateye_noir_noir',
    label: 'Cat-Eye Black / Smoke',
    frameColor: '#1a1a1a',
    bridgeColor: '#111111',
    lensColor: 'rgba(60, 55, 55, 0.26)',
    shape: 'cat-eye',
    preScale: 0.95,
    preOffsetY: 0.01,
    jeelizMats: ['plastic/black', 'glasses/noir', 'plastic/black'],
  },
];

export function getModelBySku(sku: string): GlassModel | null {
  return GLASS_MODELS.find((model) => model.sku === sku) ?? null;
}
