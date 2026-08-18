// ============================================================================
// Cortex Registry & Public Surface
// ----------------------------------------------------------------------------
// Central registry that the ZCC uses to boot every cortex in the correct
// order. Cortexes start in dependency order:
//
//   1. ZCC (Chief Architect — boots first, always)
//   2. Growth Cortex (foundation — observes marketing + funnel)
//   3. Market Intelligence Cortex (parallel to Growth, observes market)
//   4. Sales Cortex (depends on Growth for persona conversion data)
//   5. Revenue Cortex (depends on Sales for subscription lifecycle)
//   6. Success Cortex (depends on Revenue for tenant context)
//   7. Learning Cortex (depends on all others to observe their learning)
//   8. Executive Cortex (depends on all others for synthesis)
//   9. ZGS (Zélla Growth Strategy — strategic decision layer, boots last)
//
// ============================================================================

import type { AdapterBundle } from '@/adapters';
import type { CortexId } from '@/domain/zcc';
import { CortexBase } from './CortexBase';
import { GrowthCortex } from './GrowthCortex';
import { MarketIntelligenceCortex } from './MarketIntelligenceCortex';
import { SalesCortex } from './SalesCortex';
import { RevenueCortex } from './RevenueCortex';
import { SuccessCortex } from './SuccessCortex';
import { LearningCortex } from './LearningCortex';
import { ExecutiveCortex } from './ExecutiveCortex';

export { CortexBase } from './CortexBase';
export { GrowthCortex } from './GrowthCortex';
export { MarketIntelligenceCortex } from './MarketIntelligenceCortex';
export { SalesCortex } from './SalesCortex';
export { RevenueCortex } from './RevenueCortex';
export { SuccessCortex } from './SuccessCortex';
export { LearningCortex } from './LearningCortex';
export { ExecutiveCortex } from './ExecutiveCortex';

/**
 * Instantiate and register all cortexes in the correct boot order.
 * The ZGS is registered separately (see `src/domain/strategy/`).
 */
export function buildAllCortexes(adapters: AdapterBundle): CortexBase[] {
  return [
    new GrowthCortex(adapters),
    new MarketIntelligenceCortex(adapters),
    new SalesCortex(adapters),
    new RevenueCortex(adapters),
    new SuccessCortex(adapters),
    new LearningCortex(adapters),
    new ExecutiveCortex(adapters),
  ];
}

export const CORTEX_BOOT_ORDER: CortexId[] = [
  'zcc',
  'growth',
  'market-intelligence',
  'sales',
  'revenue',
  'success',
  'learning',
  'executive',
  'zgs',
];
