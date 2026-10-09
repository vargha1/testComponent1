import type { EstimatorConfig, Estimate, Feature, ProjectType, Selection } from './types';

export const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** Round to the nearest multiple of `step`, free of float noise. */
export function roundTo(value: number, step: number): number {
  if (!(step > 0)) return value;
  return Number((Math.round(value / step) * step).toFixed(6));
}

export const findType = (cfg: EstimatorConfig, id: string | null): ProjectType | undefined =>
  cfg.projectTypes.find((t) => t.id === id);

export const featuresFor = (cfg: EstimatorConfig, typeId: string | null): Feature[] =>
  cfg.features.filter((f) => !f.types || (typeId !== null && f.types.includes(typeId)));

/** Selected features that actually apply to the chosen type. */
export function activeFeatures(cfg: EstimatorConfig, sel: Selection): Feature[] {
  const allowed = featuresFor(cfg, sel.typeId);
  return allowed.filter((f) => sel.featureIds.includes(f.id));
}

const ZERO: Estimate = { minPrice: 0, maxPrice: 0, minWeeks: 0, maxWeeks: 0 };

/**
 * Pure price/time calculation.
 * subtotal = base + features + max(0, units - included) * pricePerUnit
 * result   = subtotal * urgency multiplier, spread by cfg.range, rounded.
 */
export function calculate(cfg: EstimatorConfig, sel: Selection): Estimate {
  const type = findType(cfg, sel.typeId);
  if (!type) return ZERO;

  const { scale } = type;
  const units = clamp(Number.isFinite(sel.units) ? sel.units : scale.default, scale.min, scale.max);
  const extra = Math.max(0, units - scale.included);
  const feats = activeFeatures(cfg, sel);
  const urgency = cfg.urgency.find((u) => u.id === sel.urgencyId);
  const pm = urgency?.priceMultiplier ?? 1;
  const tm = urgency?.timeMultiplier ?? 1;

  const price = (type.basePrice + feats.reduce((s, f) => s + f.price, 0) + extra * scale.pricePerUnit) * pm;
  const weeks = (type.baseWeeks + feats.reduce((s, f) => s + f.weeks, 0) + extra * scale.weeksPerUnit) * tm;
  const { low, high } = cfg.range;

  return {
    minPrice: roundTo(price * low, cfg.roundTo),
    maxPrice: roundTo(price * high, cfg.roundTo),
    minWeeks: Math.max(1, Math.ceil(weeks * low - 1e-9)),
    maxWeeks: Math.max(1, Math.ceil(weeks * high - 1e-9)),
  };
}
