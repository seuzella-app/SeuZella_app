/**
 * Tests for Gap 9 — ConquistasTab component (PARCEIRO_ZÉLLA only)
 *
 * Validates:
 *  - Component file exists and exports ConquistasTab
 *  - Renders all required UI sections (header, tier, milestone, stats, achievements, activity)
 *  - Tab is added to navItems with tier='parceiro' (Pousada + Airbnb)
 *  - Tab type unions include 'conquistas'
 *
 * Note: This test uses static file analysis (no React rendering needed)
 * so it can run in CI without a DOM.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

const PROJECT_ROOT = join(__dirname, '../../..');

describe('Gap 9 — ConquistasTab file existence', () => {
  it('component file exists at src/components/ddc/conquistas/ConquistasTab.tsx', () => {
    const path = join(PROJECT_ROOT, 'src/components/ddc/conquistas/ConquistasTab.tsx');
    expect(existsSync(path)).toBe(true);
  });

  it('exports ConquistasTab named function', () => {
    const source = readFileSync(
      join(PROJECT_ROOT, 'src/components/ddc/conquistas/ConquistasTab.tsx'),
      'utf-8'
    );
    expect(source).toMatch(/export\s+function\s+ConquistasTab/);
  });

  it('exports ConquistasTabProps interface', () => {
    const source = readFileSync(
      join(PROJECT_ROOT, 'src/components/ddc/conquistas/ConquistasTab.tsx'),
      'utf-8'
    );
    expect(source).toMatch(/export\s+interface\s+ConquistasTabProps/);
  });
});

describe('Gap 9 — ConquistasTab renders required UI sections', () => {
  const source = readFileSync(
    join(PROJECT_ROOT, 'src/components/ddc/conquistas/ConquistasTab.tsx'),
    'utf-8'
  );

  it('renders header with Trophy icon and PARCEIRO ZÉLLA label', () => {
    expect(source).toContain('Trophy');
    expect(source).toContain('PARCEIRO ZÉLLA');
  });

  it('renders tier card (bronze/prata/ouro)', () => {
    expect(source).toContain('bronze');
    expect(source).toContain('prata');
    expect(source).toContain('ouro');
    expect(source).toContain('Tier Atual');
  });

  it('renders next milestone progress bar', () => {
    expect(source).toContain('nextMilestone');
    expect(source).toContain('Próximo Milestone');
    expect(source).toContain('Progress');
  });

  it('renders stats cards (reservas confirmadas + MRR record)', () => {
    expect(source).toContain('Reservas Confirmadas');
    expect(source).toContain('Recorde MRR');
  });

  it('renders achievements awarded badges', () => {
    expect(source).toContain('achievementsAwarded');
    expect(source).toContain('Conquistas Conquistadas');
  });

  it('renders recent activity scroll area', () => {
    expect(source).toContain('achievementsHistory');
    expect(source).toContain('Atividade Recente');
  });

  it('maps all 5 achievement types to labels', () => {
    expect(source).toContain('first_booking');
    expect(source).toContain('milestone_10');
    expect(source).toContain('milestone_100');
    expect(source).toContain('revenue_record');
    expect(source).toContain('partner_level_up');
  });

  it('has fetch call to /api/ddc/notifications/v2 with category=achievements', () => {
    expect(source).toMatch(/\/api\/ddc\/notifications\/v2\?niche=all&category=achievements/);
  });
});

describe('Gap 9 — ConquistasTab in navItems (Pousada + Airbnb)', () => {
  it('pousadaNavItems includes conquistas with tier=parceiro', () => {
    const source = readFileSync(
      join(PROJECT_ROOT, 'src/app/ddc/pousada/DDCPousadaContent.tsx'),
      'utf-8'
    );
    expect(source).toMatch(/id:\s*'conquistas'[^}]*tier:\s*'parceiro'/);
  });

  it('airbnbNavItems includes conquistas with tier=parceiro', () => {
    const source = readFileSync(
      join(PROJECT_ROOT, 'src/app/ddc/airbnb/DDCAirbnbContent.tsx'),
      'utf-8'
    );
    expect(source).toMatch(/id:\s*'conquistas'[^}]*tier:\s*'parceiro'/);
  });

  it('PousadaTab type includes conquistas', () => {
    const source = readFileSync(
      join(PROJECT_ROOT, 'src/app/ddc/pousada/DDCPousadaContent.tsx'),
      'utf-8'
    );
    expect(source).toMatch(/type\s+PousadaTab\s*=.*'conquistas'/s);
  });

  it('AirbnbTab type includes conquistas', () => {
    const source = readFileSync(
      join(PROJECT_ROOT, 'src/app/ddc/airbnb/DDCAirbnbContent.tsx'),
      'utf-8'
    );
    expect(source).toMatch(/type\s+AirbnbTab\s*=.*'conquistas'/s);
  });

  it('pousada navItems includes conquistas in validTabs array', () => {
    const source = readFileSync(
      join(PROJECT_ROOT, 'src/app/ddc/pousada/DDCPousadaContent.tsx'),
      'utf-8'
    );
    expect(source).toMatch(/validTabs.*'conquistas'/s);
  });

  it('airbnb validTabs includes conquistas', () => {
    const source = readFileSync(
      join(PROJECT_ROOT, 'src/app/ddc/airbnb/DDCAirbnbContent.tsx'),
      'utf-8'
    );
    expect(source).toMatch(/validTabs.*'conquistas'/s);
  });

  it('pousada renders <ConquistasTab /> for activeTab === conquistas', () => {
    const source = readFileSync(
      join(PROJECT_ROOT, 'src/app/ddc/pousada/DDCPousadaContent.tsx'),
      'utf-8'
    );
    expect(source).toMatch(/activeTab\s*===\s*'conquistas'.*<ConquistasTab/s);
  });

  it('airbnb renders <ConquistasTab /> for activeTab === conquistas', () => {
    const source = readFileSync(
      join(PROJECT_ROOT, 'src/app/ddc/airbnb/DDCAirbnbContent.tsx'),
      'utf-8'
    );
    expect(source).toMatch(/case\s+'conquistas':\s*return\s+<ConquistasTab/s);
  });

  it('both files import ConquistasTab from correct path', () => {
    const pousadaSource = readFileSync(
      join(PROJECT_ROOT, 'src/app/ddc/pousada/DDCPousadaContent.tsx'),
      'utf-8'
    );
    const airbnbSource = readFileSync(
      join(PROJECT_ROOT, 'src/app/ddc/airbnb/DDCAirbnbContent.tsx'),
      'utf-8'
    );
    expect(pousadaSource).toContain(
      "import { ConquistasTab } from '@/components/ddc/conquistas/ConquistasTab';"
    );
    expect(airbnbSource).toContain(
      "import { ConquistasTab } from '@/components/ddc/conquistas/ConquistasTab';"
    );
  });
});
