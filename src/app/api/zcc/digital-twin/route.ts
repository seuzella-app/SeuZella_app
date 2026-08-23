// ============================================================================
// GET /api/zcc/digital-twin — Digital Twin status & snapshot
// POST /api/zcc/digital-twin/boot — Boot the Digital Twin
// ============================================================================

import { NextResponse } from 'next/server';
import {
  bootDigitalTwin,
  isDigitalTwinBooted,
  digitalTwinSnapshot,
} from '@/simulation';

export async function GET() {
  return NextResponse.json({
    ...digitalTwinSnapshot(),
  });
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    await bootDigitalTwin({
      operatingMode: 'digital-twin',
      seedSyntheticBrazil: body.seedSyntheticBrazil ?? true,
      autoStartLab: body.autoStartLab ?? false,
      heartbeatMs: body.heartbeatMs,
    });
    return NextResponse.json({
      ok: true,
      booted: isDigitalTwinBooted(),
      snapshot: digitalTwinSnapshot(),
    });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: String(err) },
      { status: 500 }
    );
  }
}
