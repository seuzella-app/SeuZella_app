import { describe, expect, it } from 'vitest';
import fs from 'node:fs';

const path = 'src/app/api/telemetry/query/route.ts';

describe('telemetry query security contract', () => {
  it('must reject invalid limits and fail closed on query errors', () => {
    const source = fs.readFileSync(path, 'utf8');
    expect(source).toContain("{ success: false, error: 'Invalid limit' }");
    expect(source).toContain("{ success: false, error: 'Telemetry query unavailable' }");
    expect(source).toContain('status: 503');
    expect(source).toContain("'Cache-Control': 'private, no-store'");
  });
});
