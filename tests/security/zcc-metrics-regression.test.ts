import { describe, expect, it } from 'vitest';
import fs from 'node:fs';

describe('ZCC metrics regression contracts', () => {
  it('fails closed instead of returning fake zero metrics', () => {
    const p = 'src/app/api/zcc/metrics/route.ts';
    const s = fs.readFileSync(p, 'utf8');
    expect(s).toContain("success: false");
    expect(s).toContain("status: 503");
    expect(s).not.toMatch(/success:\s*true,\s*data:\s*\{\s*totalClients:\s*0/);
  });

  it('does not advertise unavailable infrastructure as operational', () => {
    const s = fs.readFileSync('src/app/api/zcc/metrics/route.ts', 'utf8');
    expect(s).not.toContain("redis: 'not_used'");
    expect(s).not.toContain("bullmq: 'not_used'");
    expect(s).not.toContain("evolutionApi: 'operational'");
    expect(s).not.toContain("nginx: 'operational'");
  });

  it('prevents browser caching of privileged metrics', () => {
    const s = fs.readFileSync('src/app/api/zcc/metrics/route.ts', 'utf8');
    expect(s).toContain("Cache-Control");
    expect(s).toContain("private, no-store");
  });
});
