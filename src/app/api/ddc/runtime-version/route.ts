import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';

/**
 * Runtime build identity used by the DDC iPad stale-shell guard.
 *
 * This endpoint is deliberately outside the Service Worker cache allowlist
 * and explicitly returns no-store so an installed iPad PWA can prove which
 * deployment is currently serving production.
 */
export async function GET() {
  const buildId =
    process.env.VERCEL_GIT_COMMIT_SHA ||
    process.env.GIT_COMMIT_SHA ||
    process.env.npm_package_version ||
    'development';

  return NextResponse.json(
    { buildId },
    {
      headers: {
        'Cache-Control': 'private, no-store, max-age=0, must-revalidate',
        'CDN-Cache-Control': 'no-store',
        'Vercel-CDN-Cache-Control': 'no-store',
      },
    },
  );
}
