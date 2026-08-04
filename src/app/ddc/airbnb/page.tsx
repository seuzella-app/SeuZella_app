// ==============================================================================
// DDC AIRBNB PAGE — Server Component
// ==============================================================================
// - Server Component (no 'use client') so we can use route segment config
// - Uses `export const dynamic = 'force-dynamic'` to defeat Vercel ISR cache
//   so the Hallmark Terminal layout changes are visible immediately
// - Imports DDCAirbnbClientContent (Client Component) which handles the
//   dynamic import with ssr:false
// ==============================================================================

import { DDCAirbnbClientContent } from './DDCAirbnbClientContent';

// Force fresh render on every deploy — defeats Vercel's ISR cache
export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';

export default function DDCAirbnbPage() {
  return <DDCAirbnbClientContent />;
}
