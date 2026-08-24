import { describe, expect, it } from 'vitest';

describe('Wave 4 — production readiness environment gate', () => {
  it('does not claim provider readiness without required production inputs', () => {
    const production = process.env.NODE_ENV === 'production';
    if (!production) return;

    expect(process.env.NEXTAUTH_URL).toBeTruthy();
    expect(process.env.DATABASE_URL).toBeTruthy();
    expect(process.env.NEXTAUTH_SECRET).toBeTruthy();
    expect(process.env.ZCC_ADMIN_EMAILS).toBeTruthy();
  });
});
