// ==============================================================================
// DDC AIRBNB / ANFITRIÃO PAGE — Server Component
// ==============================================================================

import { DDCAirbnbClientContent } from './DDCAirbnbClientContent';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';

export default function DDCAirbnbPage() {
  const buildId =
    process.env.VERCEL_GIT_COMMIT_SHA ||
    process.env.GIT_COMMIT_SHA ||
    process.env.npm_package_version ||
    'development';

  return <DDCAirbnbClientContent buildId={buildId} />;
}
