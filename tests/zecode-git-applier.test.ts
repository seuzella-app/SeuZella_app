// ============================================================================
// ZéCode — Testes do Git Applier (auto-create PR)
// ============================================================================
// Valida:
//   1. Mock mode: simula PR sem tocar no git real
//   2. Live mode: exige GODMODE, validação de path, rate limit
//   3. Safety locks: rejects paths proibidos (.env, schema.prisma, etc)
//   4. Fallback gracioso quando config GitHub ausente
// ============================================================================

import { describe, it, expect, beforeEach, vi } from 'vitest';

// ── Mocks (factory pattern hoisted) ─────────────────────────────────────────

const gitMock = {
  status: vi.fn().mockResolvedValue({ isClean: () => true }),
  checkoutLocalBranch: vi.fn().mockResolvedValue(undefined),
  add: vi.fn().mockResolvedValue(undefined),
  commit: vi.fn().mockResolvedValue({ commit: 'mock-sha-123' }),
  push: vi.fn().mockResolvedValue(undefined),
  checkout: vi.fn().mockResolvedValue(undefined),
};

vi.mock('simple-git', () => ({
  default: vi.fn(() => gitMock),
}));

const octokitMock = {
  rest: {
    repos: {
      get: vi.fn().mockResolvedValue({ data: { default_branch: 'main' } }),
    },
    pulls: {
      create: vi.fn().mockResolvedValue({
        data: {
          number: 42,
          html_url: 'https://github.com/MarcioCau14/SmartHotel_Zehla/pull/42',
        },
      }),
    },
    issues: {
      addLabels: vi.fn().mockResolvedValue({}),
      createComment: vi.fn().mockResolvedValue({}),
    },
  },
};

vi.mock('@octokit/rest', () => ({
  Octokit: vi.fn(() => octokitMock),
}));

const dbMock = {
  gapFinding: {
    update: vi.fn().mockResolvedValue({ id: 'gap-1' }),
    findUnique: vi.fn().mockResolvedValue(null),
  },
  bottleneckFinding: {
    update: vi.fn().mockResolvedValue({ id: 'bn-1' }),
    findUnique: vi.fn().mockResolvedValue(null),
  },
  refactorSuggestion: {
    update: vi.fn().mockResolvedValue({}),
    findUnique: vi.fn().mockResolvedValue(null),
  },
};

vi.mock('@/lib/db', () => ({ db: dbMock }));

vi.mock('fs', () => ({
  readFileSync: vi.fn().mockReturnValue('const x = 1;\n'),
  writeFileSync: vi.fn(),
  existsSync: vi.fn().mockReturnValue(true),
}));

vi.mock('path', async () => {
  const actual = await vi.importActual('path');
  return { ...actual, join: vi.fn((_, p) => `/mocked/${p}`) };
});

// Importa depois do mock
const { applySuggestionViaGit } = await import('@/lib/cerebro/ze-code/git-applier');
import type { GitApplyRequest } from '@/lib/cerebro/ze-code/git-applier';

// ── Helpers ─────────────────────────────────────────────────────────────────

function baseRequest(overrides: Partial<GitApplyRequest> = {}): GitApplyRequest {
  return {
    category: 'gap',
    findingId: 'gap_test_123',
    filePath: 'src/lib/utils.ts',
    startLine: 5,
    endLine: 7,
    newCode: 'const x = 2;',
    commitMessage: 'fix: refactor x',
    appliedBy: 'admin@zella.com',
    prTitle: '[ZéCode] Test PR',
    prBody: 'Test body',
    ...overrides,
  };
}

// ── Tests ───────────────────────────────────────────────────────────────────

describe('ZéCode Git Applier — Mock Mode', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.CEREBRO_LIVE_MODE = 'false'; // mock mode
  });

  it('em modo mock, simula PR sem chamar git/octokit', async () => {
    const result = await applySuggestionViaGit(baseRequest());

    expect(result.ok).toBe(true);
    expect(result.mode).toBe('mock');
    expect(result.prUrl).toContain('github.com');
    expect(result.branch).toMatch(/^zecode\/gap-/);
    expect(result.safetyLocksTriggered).toContain('mock_mode_no_real_write');
    expect(result.safetyLocksTriggered).toContain('pr_simulated');
    expect(gitMock.status).not.toHaveBeenCalled();
    expect(octokitMock.rest.pulls.create).not.toHaveBeenCalled();
  });

  it('em modo mock, falha sem appliedBy', async () => {
    const result = await applySuggestionViaGit(baseRequest({ appliedBy: '' }));

    expect(result.ok).toBe(false);
    expect(result.safetyLocksTriggered).toContain('missing_applied_by');
  });
});

describe('ZéCode Git Applier — Live Mode Safety', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.CEREBRO_LIVE_MODE = 'true';
    process.env.GLM_5_2_API_KEY = 'test-key';
    process.env.GITHUB_TOKEN = 'ghp_test';
    process.env.GITHUB_REPO_OWNER = 'MarcioCau14';
    process.env.GITHUB_REPO_NAME = 'SmartHotel_Zehla';
    process.env.ZCC_GODMODE = 'true';
  });

  it('falha sem GODMODE em live mode', async () => {
    process.env.ZCC_GODMODE = 'false';

    const result = await applySuggestionViaGit(baseRequest());

    expect(result.ok).toBe(false);
    expect(result.mode).toBe('live');
    expect(result.safetyLocksTriggered).toContain('godmode_required');
  });

  it('falha sem config GitHub (token/owner/repo)', async () => {
    delete process.env.GITHUB_TOKEN;

    const result = await applySuggestionViaGit(baseRequest());

    expect(result.ok).toBe(false);
    expect(result.safetyLocksTriggered).toContain('missing_github_config');
  });

  it('rejeita path proibido (.env)', async () => {
    const result = await applySuggestionViaGit(baseRequest({
      filePath: '.env.production',
    }));

    expect(result.ok).toBe(false);
    expect(result.safetyLocksTriggered).toContain('path_validation_failed');
  });

  it('rejeita path proibido (schema.prisma)', async () => {
    const result = await applySuggestionViaGit(baseRequest({
      filePath: 'prisma/schema.prisma',
    }));

    expect(result.ok).toBe(false);
    expect(result.safetyLocksTriggered).toContain('path_validation_failed');
  });

  it('rejeita path proibido (middleware.ts)', async () => {
    const result = await applySuggestionViaGit(baseRequest({
      filePath: 'src/middleware.ts',
    }));

    expect(result.ok).toBe(false);
    expect(result.safetyLocksTriggered).toContain('path_validation_failed');
  });

  it('rejeita path traversal (../../etc/passwd)', async () => {
    const result = await applySuggestionViaGit(baseRequest({
      filePath: '../../etc/passwd',
    }));

    expect(result.ok).toBe(false);
    expect(result.safetyLocksTriggered).toContain('path_validation_failed');
  });
});

describe('ZéCode Git Applier — Live Mode Happy Path', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.CEREBRO_LIVE_MODE = 'true';
    process.env.GLM_5_2_API_KEY = 'test-key';
    process.env.GITHUB_TOKEN = 'ghp_test';
    process.env.GITHUB_REPO_OWNER = 'MarcioCau14';
    process.env.GITHUB_REPO_NAME = 'SmartHotel_Zehla';
    process.env.ZCC_GODMODE = 'true';
  });

  it('cria branch + commit + push + PR draft em happy path', async () => {
    const result = await applySuggestionViaGit(baseRequest());

    expect(result.ok).toBe(true);
    expect(result.mode).toBe('live');
    expect(result.prNumber).toBe(42);
    expect(result.prUrl).toContain('github.com');
    expect(result.branch).toMatch(/^zecode\/gap-/);
    expect(gitMock.checkoutLocalBranch).toHaveBeenCalled();
    expect(gitMock.add).toHaveBeenCalled();
    expect(gitMock.commit).toHaveBeenCalled();
    expect(gitMock.push).toHaveBeenCalled();
    expect(octokitMock.rest.pulls.create).toHaveBeenCalled();

    // PR draft: octokit payload deve ter draft:true
    const prCall = octokitMock.rest.pulls.create.mock.calls[0][0];
    expect(prCall.draft).toBe(true);
  });

  it('persiste prUrl + branch no DB quando category=gap', async () => {
    await applySuggestionViaGit(baseRequest({ category: 'gap' }));

    expect(dbMock.gapFinding.update).toHaveBeenCalledTimes(1);
    const updateCall = dbMock.gapFinding.update.mock.calls[0][0];
    expect(updateCall.data.status).toBe('applied');
    expect(updateCall.data.prUrl).toContain('github.com');
    expect(updateCall.data.prBranch).toMatch(/^zecode\/gap-/);
  });

  it('persiste prUrl + branch no DB quando category=bottleneck', async () => {
    await applySuggestionViaGit(baseRequest({ category: 'bottleneck' }));

    expect(dbMock.bottleneckFinding.update).toHaveBeenCalledTimes(1);
    const updateCall = dbMock.bottleneckFinding.update.mock.calls[0][0];
    expect(updateCall.data.status).toBe('applied');
    expect(updateCall.data.prUrl).toContain('github.com');
  });
});
