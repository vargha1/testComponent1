import { CostEstimator } from './element';

if (!customElements.get('cost-estimator')) customElements.define('cost-estimator', CostEstimator);

export { CostEstimator };
export { calculate } from './calc';
