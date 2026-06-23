import type { GlassesProduct } from './types';

export const products: GlassesProduct[] = [
  {
    id: 'seoul-classic',
    name: 'Seoul Classic',
    style: 'Soft square acetate',
    price: '$128',
    tone: 'charcoal',
    fit: 'medium',
    lensTint: 'rgba(210, 225, 225, 0.2)',
    frameColor: '#121418',
    templeColor: '#121418',
    scale: 1,
    bridgeOffset: 0
  },
  {
    id: 'han-river',
    name: 'Han River',
    style: 'Clear rounded frame',
    price: '$118',
    tone: 'crystal',
    fit: 'narrow',
    lensTint: 'rgba(222, 242, 255, 0.18)',
    frameColor: 'rgba(235, 242, 246, 0.82)',
    templeColor: '#aab7bf',
    scale: 0.94,
    bridgeOffset: -2
  },
  {
    id: 'night-market',
    name: 'Night Market',
    style: 'Slim metal aviator',
    price: '$146',
    tone: 'metal',
    fit: 'wide',
    lensTint: 'rgba(164, 194, 206, 0.25)',
    frameColor: '#b8a76b',
    templeColor: '#857448',
    scale: 1.06,
    bridgeOffset: 3
  },
  {
    id: 'forest-hour',
    name: 'Forest Hour',
    style: 'Tortoise everyday frame',
    price: '$136',
    tone: 'tortoise',
    fit: 'medium',
    lensTint: 'rgba(230, 210, 175, 0.16)',
    frameColor: '#5c3728',
    templeColor: '#3f281f',
    scale: 1.01,
    bridgeOffset: 1
  }
];
