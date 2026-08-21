import { describe, expect, it } from 'vitest';
import fs from 'node:fs';

const source = fs.readFileSync('src/app/api/telemetry/ingest/route.ts', 'utf8');

describe('telemetry ingest body-size regression', () => {
  it('measures the actual UTF-8 body after reading it', () => {
    expect(source).toContain("Buffer.byteLength(rawBody, 'utf8')");
    expect(source).toContain('const rawBody = await request.text()');
  });

  it('keeps the declared content-length check as an early rejection', () => {
    expect(source).toContain("request.headers.get('content-length')");
    expect(source).toContain('MAX_BODY_BYTES');
  });
});
