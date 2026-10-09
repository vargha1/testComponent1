import { describe, expect, it } from 'vitest';
import { calculate, roundTo, activeFeatures } from '../src/calc';
import type { EstimatorConfig, Selection } from '../src/types';

const scale = { label: 'صفحه', unit: 'صفحه', min: 1, max: 30, step: 1, default: 5, included: 5, pricePerUnit: 1, weeksPerUnit: 0.5 };

const cfg = {
  currencyUnit: 'میلیون تومان',
  range: { low: 0.9, high: 1.2 },
  roundTo: 0.5,
  submit: { url: '/x' },
  texts: {} as never,
  projectTypes: [
    { id: 'site', title: 'site', basePrice: 20, baseWeeks: 4, scale },
    { id: 'app', title: 'app', basePrice: 60, baseWeeks: 10, scale: { ...scale, pricePerUnit: 2, included: 3, default: 3 } },
  ],
  features: [
    { id: 'seo', title: 'seo', price: 5, weeks: 1 },
    { id: 'pay', title: 'pay', price: 10, weeks: 2, types: ['app'] },
  ],
  urgency: [
    { id: 'normal', title: 'n', priceMultiplier: 1, timeMultiplier: 1 },
    { id: 'rush', title: 'r', priceMultiplier: 1.5, timeMultiplier: 0.6 },
  ],
} as EstimatorConfig;

const sel = (p: Partial<Selection> = {}): Selection => ({ typeId: 'site', featureIds: [], units: 5, urgencyId: 'normal', ...p });

describe('calculate', () => {
  it('returns zeros without a project type', () => {
    expect(calculate(cfg, sel({ typeId: null }))).toEqual({ minPrice: 0, maxPrice: 0, minWeeks: 0, maxWeeks: 0 });
  });

  it('base price spread by range', () => {
    // 20 * 0.9 = 18, 20 * 1.2 = 24 ; 4 weeks -> ceil(3.6)=4, ceil(4.8)=5
    expect(calculate(cfg, sel())).toEqual({ minPrice: 18, maxPrice: 24, minWeeks: 4, maxWeeks: 5 });
  });

  it('adds feature price and time', () => {
    const e = calculate(cfg, sel({ featureIds: ['seo'] }));
    expect(e.minPrice).toBe(22.5); // 25*0.9
    expect(e.maxPrice).toBe(30);
    expect(e.maxWeeks).toBe(6); // 5*1.2
  });

  it('ignores features that do not apply to the type', () => {
    const s = sel({ featureIds: ['pay'] });
    expect(activeFeatures(cfg, s)).toEqual([]);
    expect(calculate(cfg, s)).toEqual(calculate(cfg, sel()));
  });

  it('charges only for units above the included amount', () => {
    const below = calculate(cfg, sel({ units: 3 }));
    const atIncluded = calculate(cfg, sel({ units: 5 }));
    const above = calculate(cfg, sel({ units: 15 })); // +10 units => +10 price, +5 weeks
    expect(below).toEqual(atIncluded);
    expect(above.maxPrice).toBe(36); // 30 * 1.2
    expect(above.maxWeeks).toBe(11); // 9 * 1.2 = 10.8
  });

  it('clamps units to the allowed range', () => {
    expect(calculate(cfg, sel({ units: 999 }))).toEqual(calculate(cfg, sel({ units: 30 })));
    expect(calculate(cfg, sel({ units: NaN }))).toEqual(calculate(cfg, sel({ units: 5 })));
  });

  it('applies urgency multipliers to price and time', () => {
    const e = calculate(cfg, sel({ urgencyId: 'rush' }));
    expect(e.minPrice).toBe(27); // 20*1.5*0.9
    expect(e.maxPrice).toBe(36);
    expect(e.minWeeks).toBe(3); // 4*0.6*0.9 = 2.16 -> 3
  });

  it('treats unknown urgency as neutral', () => {
    expect(calculate(cfg, sel({ urgencyId: null }))).toEqual(calculate(cfg, sel()));
  });

  it('never returns less than one week', () => {
    const tiny = { ...cfg, projectTypes: [{ ...cfg.projectTypes[0], baseWeeks: 0 }] };
    expect(calculate(tiny, sel()).minWeeks).toBe(1);
  });

  it('supports type-specific features', () => {
    const e = calculate(cfg, sel({ typeId: 'app', units: 3, featureIds: ['pay'] }));
    expect(e.minPrice).toBe(63); // 70*0.9
    expect(e.maxPrice).toBe(84);
  });
});

describe('roundTo', () => {
  it('rounds to nearest step without float noise', () => {
    expect(roundTo(22.4, 0.5)).toBe(22.5);
    expect(roundTo(0.1 + 0.2, 0.1)).toBe(0.3);
    expect(roundTo(7.3, 0)).toBe(7.3);
  });
});
