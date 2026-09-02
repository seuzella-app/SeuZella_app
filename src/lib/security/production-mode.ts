/**
 * Central production-mode guard. Demo and middleware bypass flags are useful
 * in local development but are security-sensitive and must never be enabled
 * in a production process.
 */
export function isDemoMode(): boolean {
  return process.env.NODE_ENV !== 'production' && process.env.ZELLA_DEMO_MODE === 'true';
}

export function assertProductionSafeMode(): void {
  if (process.env.NODE_ENV !== 'production') return;

  if (process.env.ZELLA_DEMO_MODE === 'true') {
    throw new Error('ZELLA_DEMO_MODE must not be true in production');
  }

  if (process.env.BYPASS_MIDDLEWARE_AUTH === 'true') {
    throw new Error('BYPASS_MIDDLEWARE_AUTH must not be true in production');
  }
}
