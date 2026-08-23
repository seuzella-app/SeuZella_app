// ============================================================================
// GET /api/zcc/cognitive-bus — inspect the ZCB event log
// Query: ?prefix=&source=&since=&limit=
// ============================================================================

import { NextResponse } from 'next/server';
import { zcb } from '@/domain/zcc';

export async function GET(req: Request) {
  const url = new URL(req.url);
  const prefix = url.searchParams.get('prefix') ?? undefined;
  const source = url.searchParams.get('source') as any;
  const since = url.searchParams.get('since') ?? undefined;
  const limit = url.searchParams.get('limit') ? parseInt(url.searchParams.get('limit')!) : 1000;
  const events = zcb.inspect({
    typePrefix: prefix,
    source,
    since,
    limit,
  });
  return NextResponse.json({
    totalEvents: zcb.size(),
    returned: events.length,
    events,
  });
}
