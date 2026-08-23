import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const pousada = fs.readFileSync(path.join(root, 'src/app/ddc/pousada/DDCPousadaClientContent.tsx'), 'utf8');
const airbnb = fs.readFileSync(path.join(root, 'src/app/ddc/airbnb/DDCAirbnbClientContent.tsx'), 'utf8');

describe('DDC iPad layout routing', () => {
  for (const [name, source] of [['pousada', pousada], ['airbnb', airbnb] ] as const) {
    it(`${name}: keeps phones on Mobile SuperApp below md`, () => {
      expect(source).toContain('className="block md:hidden');
      expect(source).toContain(name === 'pousada' ? '<MobilePousadaSuperApp />' : '<MobileAirbnbSuperApp />');
    });

    it(`${name}: serves the current desktop DDC from iPad width (md and up)`, () => {
      expect(source).toContain('className="hidden md:block');
      expect(source).toContain(name === 'pousada' ? '<DDCPousadaContent />' : '<DDCAirbnbContent />');
      expect(source).not.toContain('className="block lg:hidden');
      expect(source).not.toContain('className="hidden lg:block');
    });
  }

  it('preserves the iPad stale-shell deployment guard', () => {
    expect(pousada).toContain('<DDCStaleShellGuard expectedBuildId={buildId} />');
    expect(airbnb).toContain('<DDCStaleShellGuard expectedBuildId={buildId} />');
  });
});
