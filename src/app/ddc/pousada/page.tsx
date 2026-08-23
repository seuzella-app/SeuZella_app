// ==============================================================================
// DDC POUSADA PAGE — Server Component
// ==============================================================================
// - Server Component (no 'use client') so we can use route segment config
// - Uses `export const dynamic = 'force-dynamic'` to defeat Vercel ISR cache
// - Passes the authoritative Vercel commit SHA to the iPad-only stale-shell
//   guard so a long-lived Safari/PWA cannot remain on an older deployment.
// ==============================================================================

import { DDCPousadaClientContent } from './DDCPousadaClientContent';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';

export default function DDCPousadaPage() {
  const buildId =
    process.env.VERCEL_GIT_COMMIT_SHA ||
    process.env.GIT_COMMIT_SHA ||
    process.env.npm_package_version ||
    'development';

  return <DDCPousadaClientContent buildId={buildId} />;
}
