export interface ScaleConfig {
  label: string;
  unit: string;
  min: number;
  max: number;
  step: number;
  default: number;
  /** units covered by the base price */
  included: number;
  pricePerUnit: number;
  weeksPerUnit: number;
}

export interface ProjectType {
  id: string;
  title: string;
  description?: string;
  icon?: string;
  basePrice: number;
  baseWeeks: number;
  scale: ScaleConfig;
}

export interface Feature {
  id: string;
  title: string;
  description?: string;
  icon?: string;
  price: number;
  weeks: number;
  /** project type ids this feature applies to; omitted = all */
  types?: string[];
}

export interface Urgency {
  id: string;
  title: string;
  description?: string;
  icon?: string;
  priceMultiplier: number;
  timeMultiplier: number;
}

export interface StepText {
  title: string;
  hint?: string;
}

export interface Texts {
  title: string;
  subtitle: string;
  stepOf: string;
  next: string;
  back: string;
  submit: string;
  submitting: string;
  estimateLabel: string;
  timeLabel: string;
  weeks: string;
  to: string;
  summaryTitle: string;
  summaryEmpty: string;
  nothingSelected: string;
  loading: string;
  loadError: string;
  nameLabel: string;
  mobileLabel: string;
  mobileHint: string;
  nameError: string;
  mobileError: string;
  successTitle: string;
  successBody: string;
  submitError: string;
  restart: string;
  increase: string;
  decrease: string;
  disclaimer: string;
  steps: Record<'type' | 'features' | 'scale' | 'urgency' | 'contact', StepText>;
}

export interface EstimatorConfig {
  /** money unit shown after prices, e.g. "میلیون تومان"; all prices use this unit */
  currencyUnit: string;
  /** spread applied around the computed value to produce a range */
  range: { low: number; high: number };
  /** prices are rounded to a multiple of this (in currency units) */
  roundTo: number;
  submit: { url: string; method?: string; headers?: Record<string, string> };
  texts: Texts;
  projectTypes: ProjectType[];
  features: Feature[];
  urgency: Urgency[];
  /** urgency id preselected on start; defaults to the first one */
  defaultUrgency?: string;
}

export interface Selection {
  typeId: string | null;
  featureIds: string[];
  units: number;
  urgencyId: string | null;
}

export interface Estimate {
  minPrice: number;
  maxPrice: number;
  minWeeks: number;
  maxWeeks: number;
}
