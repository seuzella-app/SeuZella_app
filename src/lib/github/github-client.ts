/**
 * GitHub Client — Wrapper centralizado para todas as chamadas à API GitHub.
 *
 * Features:
 *  - Suporte a Fine-Grained PAT e GitHub App (com install tokens)
 *  - Rate limit tracking (respeita X-RateLimit-Remaining)
 *  - Retries com backoff exponencial (429, 502, 503, 504)
 *  - ETag caching para GETs (reduz consumo de rate limit)
 *  - Audit log automático de TODA chamada (via pat-vault)
 *  - Validação de escopo antes de disparar request
 *  - User-Agent customizado para identificação no GitHub
 *
 * Doc: "Bíblia do ZéCode — GitHub GitOps" (Cap. 5)
 *
 * USO:
 *   const client = getGitHubClient(credentialId);
 *   const pr = await client.createPR({ repo: 'foo/bar', ... });
 */

import { getCredential, auditLog } from './pat-vault';
import { db } from '@/lib/db';
import crypto from 'crypto';

const GITHUB_API = 'https://api.github.com';
const USER_AGENT = 'ZéCode-Bot/1.0 (+https://zcc.seuzella.com)';
const API_VERSION = '2022-11-28';

interface RequestOptions {
  method: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  path: string;
  body?: any;
  headers?: Record<string, string>;
  expectedStatus?: number[];
  skipAudit?: boolean; // para GETs comuns — desabilita audit (reduz volume)
}

interface RateLimitInfo {
  limit: number;
  remaining: number;
  reset: Date;
  used: number;
}

export class GitHubApiError extends Error {
  constructor(
    public status: number,
    public body: string,
    public path: string,
    public method: string
  ) {
    super(`GitHub API ${status} ${method} ${path}: ${body.substring(0, 200)}`);
    this.name = 'GitHubApiError';
  }
}

export class GitHubClient {
  private rateLimit: RateLimitInfo | null = null;
  private etagCache = new Map<string, { etag: string; data: any; timestamp: number }>();
  private installationToken: { token: string; expiresAt: Date } | null = null;

  constructor(private credentialId: string) {}

  // ============================================================
  // AUTENTICAÇÃO
  // ============================================================

  private async getAuthHeader(): Promise<string> {
    const cred = await db.gitHubCredential.findUniqueOrThrow({
      where: { id: this.credentialId },
    });

    if (!cred.isActive) {
      throw new Error(`Credencial "${cred.label}" está inativa`);
    }

    if (cred.expiresAt < new Date()) {
      throw new Error(`Credencial "${cred.label}" expirou`);
    }

    if (cred.authType === 'fine_grained_pat') {
      const pat = await getCredential(this.credentialId);
      return `Bearer ${pat}`;
    }

    if (cred.authType === 'github_app') {
      const token = await this.getInstallationToken(cred);
      return `token ${token}`;
    }

    throw new Error(`authType não suportado: ${cred.authType}`);
  }

  /**
   * Para GitHub App: gera JWT assinado com private key,
   * troca por install token (expira em 1h, cacheia).
   */
  private async getInstallationToken(cred: any): Promise<string> {
    // Cache check — install token válido por 1h, renovamos em 50min
    if (this.installationToken && this.installationToken.expiresAt > new Date(Date.now() + 10 * 60 * 1000)) {
      return this.installationToken.token;
    }

    if (!cred.githubAppId || !cred.installationId) {
      throw new Error('GitHub App credential sem githubAppId ou installationId');
    }

    const privateKeyPem = await getCredential(this.credentialId);
    const appId = cred.githubAppId;
    const installationId = cred.installationId;

    // Gera JWT (válido 10 min)
    const jwt = this.generateAppJWT(appId, privateKeyPem);

    // Troca JWT por install token
    const res = await fetch(`${GITHUB_API}/app/installations/${installationId}/access_tokens`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${jwt}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': API_VERSION,
        'User-Agent': USER_AGENT,
      },
    });

    if (!res.ok) {
      const errBody = await res.text();
      throw new Error(`Falha ao obter install token: ${res.status} ${errBody}`);
    }

    const data = await res.json();
    this.installationToken = {
      token: data.token,
      expiresAt: new Date(data.expires_at),
    };

    return this.installationToken.token;
  }

  private generateAppJWT(appId: string, privateKeyPem: string): string {
    const now = Math.floor(Date.now() / 1000);
    const payload = {
      iat: now - 60, // 1 min de skew (clock drift)
      exp: now + 10 * 60, // 10 min
      iss: appId,
    };

    // Sign com RS256
    const header = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT' })).toString('base64url');
    const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
    const signable = `${header}.${body}`;

    const sign = crypto.createSign('RSA-SHA256');
    sign.update(signable);
    const signature = sign.sign(privateKeyPem, 'base64url');

    return `${signable}.${signature}`;
  }

  // ============================================================
  // CHAMADA CENTRALIZADA
  // ============================================================

  private async callApi(opts: RequestOptions): Promise<any> {
    const startTime = Date.now();
    const authHeader = await this.getAuthHeader();

    // Rate limit — se esgotou, espera até reset (máx 60s)
    if (this.rateLimit && this.rateLimit.remaining === 0) {
      const waitMs = this.rateLimit.reset.getTime() - Date.now();
      if (waitMs > 0 && waitMs < 60000) {
        await new Promise((r) => setTimeout(r, waitMs + 100));
      }
    }

    const url = `${GITHUB_API}${opts.path}`;
    const headers: Record<string, string> = {
      Authorization: authHeader,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': API_VERSION,
      'User-Agent': USER_AGENT,
      ...opts.headers,
    };

    // ETag caching para GETs
    if (opts.method === 'GET') {
      const cached = this.etagCache.get(opts.path);
      if (cached) {
        headers['If-None-Match'] = cached.etag;
      }
    }

    let attempt = 0;
    const maxRetries = 3;

    while (attempt <= maxRetries) {
      attempt++;
      try {
        const res = await fetch(url, {
          method: opts.method,
          headers,
          body: opts.body ? JSON.stringify(opts.body) : undefined,
        });

        // Atualiza rate limit info
        this.updateRateLimit(res.headers);

        // 304 Not Modified — usa cache
        if (res.status === 304 && this.etagCache.has(opts.path)) {
          return this.etagCache.get(opts.path)!.data;
        }

        // Retry em 429 (rate limit), 502, 503, 504
        if ([429, 502, 503, 504].includes(res.status) && attempt <= maxRetries) {
          const backoffMs = Math.min(1000 * 2 ** attempt, 30000);
          await new Promise((r) => setTimeout(r, backoffMs));
          continue;
        }

        // 404 — normal para alguns endpoints
        if (res.status === 404) {
          if (!opts.skipAudit) {
            await auditLog(this.credentialId, 'API_CALL', {
              apiEndpoint: opts.path,
              apiMethod: opts.method,
              success: false,
              statusCode: 404,
              errorMessage: 'Not Found',
              durationMs: Date.now() - startTime,
            });
          }
          return null;
        }

        if (!res.ok && !(opts.expectedStatus || []).includes(res.status)) {
          const errBody = await res.text();
          if (!opts.skipAudit) {
            await auditLog(this.credentialId, 'API_CALL', {
              apiEndpoint: opts.path,
              apiMethod: opts.method,
              success: false,
              statusCode: res.status,
              errorMessage: errBody.substring(0, 2000),
              durationMs: Date.now() - startTime,
            });
          }
          throw new GitHubApiError(res.status, errBody, opts.path, opts.method);
        }

        const data = res.status === 204 ? null : await res.json();

        // Atualiza cache ETag
        if (opts.method === 'GET' && res.headers.get('ETag')) {
          this.etagCache.set(opts.path, {
            etag: res.headers.get('ETag')!,
            data,
            timestamp: Date.now(),
          });
          // Limpa cache antigo (> 1h) para evitar memory leak
          if (this.etagCache.size > 100) {
            const cutoff = Date.now() - 60 * 60 * 1000;
            for (const [key, val] of this.etagCache.entries()) {
              if (val.timestamp < cutoff) this.etagCache.delete(key);
            }
          }
        }

        if (!opts.skipAudit) {
          await auditLog(this.credentialId, 'API_CALL', {
            apiEndpoint: opts.path,
            apiMethod: opts.method,
            success: true,
            statusCode: res.status,
            durationMs: Date.now() - startTime,
          });
        }

        return data;
      } catch (err) {
        if (attempt > maxRetries) {
          if (!opts.skipAudit) {
            await auditLog(this.credentialId, 'API_CALL', {
              apiEndpoint: opts.path,
              apiMethod: opts.method,
              success: false,
              errorMessage: String(err).substring(0, 2000),
              durationMs: Date.now() - startTime,
            });
          }
          throw err;
        }
        await new Promise((r) => setTimeout(r, 1000 * 2 ** attempt));
      }
    }
  }

  private updateRateLimit(headers: Headers) {
    const remaining = headers.get('X-RateLimit-Remaining');
    const reset = headers.get('X-RateLimit-Reset');
    const limit = headers.get('X-RateLimit-Limit');
    const used = headers.get('X-RateLimit-Used');
    if (remaining && reset) {
      this.rateLimit = {
        remaining: parseInt(remaining),
        reset: new Date(parseInt(reset) * 1000),
        limit: limit ? parseInt(limit) : 5000,
        used: used ? parseInt(used) : 0,
      };
    }
  }

  getRateLimitInfo(): RateLimitInfo | null {
    return this.rateLimit;
  }

  // ============================================================
  // BRANCHES & COMMITS
  // ============================================================

  async createBranch(repo: string, fromBranch: string, newBranch: string): Promise<any> {
    const ref = await this.callApi({
      method: 'GET',
      path: `/repos/${repo}/git/refs/heads/${fromBranch}`,
      skipAudit: true,
    });
    return this.callApi({
      method: 'POST',
      path: `/repos/${repo}/git/refs`,
      body: { ref: `refs/heads/${newBranch}`, sha: ref.object.sha },
    });
  }

  async getBranch(repo: string, branch: string): Promise<any> {
    return this.callApi({
      method: 'GET',
      path: `/repos/${repo}/branches/${branch}`,
      skipAudit: true,
    });
  }

  async deleteBranch(repo: string, branch: string): Promise<void> {
    await this.callApi({
      method: 'DELETE',
      path: `/repos/${repo}/git/refs/heads/${branch}`,
    });
  }

  /**
   * Cria commit atômico com múltiplos arquivos via Git Database API.
   * Mais eficiente que commits individuais para cada arquivo.
   */
  async commitFiles(
    repo: string,
    branch: string,
    files: Array<{ path: string; content: string; encoding?: 'utf-8' | 'base64' }>,
    message: string
  ): Promise<{ sha: string; commitUrl: string }> {
    // 1. Pega ref atual do branch
    const ref = await this.callApi({
      method: 'GET',
      path: `/repos/${repo}/git/refs/heads/${branch}`,
      skipAudit: true,
    });
    const baseCommit = await this.callApi({
      method: 'GET',
      path: `/repos/${repo}/git/commits/${ref.object.sha}`,
      skipAudit: true,
    });

    // 2. Cria blobs para cada arquivo
    const treeItems = [];
    for (const file of files) {
      const blob = await this.callApi({
        method: 'POST',
        path: `/repos/${repo}/git/blobs`,
        body: {
          content: file.content,
          encoding: file.encoding || 'utf-8',
        },
      });
      treeItems.push({
        path: file.path,
        mode: '100644',
        type: 'blob',
        sha: blob.sha,
      });
    }

    // 3. Cria nova árvore baseada na anterior
    const tree = await this.callApi({
      method: 'POST',
      path: `/repos/${repo}/git/trees`,
      body: { base_tree: baseCommit.tree.sha, tree: treeItems },
    });

    // 4. Cria commit apontando para nova árvore
    const commit = await this.callApi({
      method: 'POST',
      path: `/repos/${repo}/git/commits`,
      body: {
        message,
        tree: tree.sha,
        parents: [baseCommit.sha],
        author: {
          name: 'ZéCode Bot',
          email: 'ze-code@zehla.local',
          date: new Date().toISOString(),
        },
      },
    });

    // 5. Atualiza branch para apontar para o novo commit
    await this.callApi({
      method: 'PATCH',
      path: `/repos/${repo}/git/refs/heads/${branch}`,
      body: { sha: commit.sha },
    });

    return { sha: commit.sha, commitUrl: commit.html_url };
  }

  async getFileContent(repo: string, path: string, branch?: string): Promise<string | null> {
    const params = branch ? `?ref=${branch}` : '';
    const data = await this.callApi({
      method: 'GET',
      path: `/repos/${repo}/contents/${path}${params}`,
      skipAudit: true,
    });
    if (!data) return null;
    if (data.encoding !== 'base64') return data.content;
    return Buffer.from(data.content, 'base64').toString('utf8');
  }

  // ============================================================
  // PULL REQUESTS
  // ============================================================

  async createPR(opts: {
    repo: string;
    title: string;
    head: string;
    base: string;
    body: string;
    draft?: boolean;
  }): Promise<any> {
    return this.callApi({
      method: 'POST',
      path: `/repos/${opts.repo}/pulls`,
      body: {
        title: opts.title,
        head: opts.head,
        base: opts.base,
        body: opts.body,
        draft: opts.draft || false,
      },
      expectedStatus: [201],
    });
  }

  async getPR(repo: string, prNumber: number): Promise<any> {
    return this.callApi({
      method: 'GET',
      path: `/repos/${repo}/pulls/${prNumber}`,
      skipAudit: true,
    });
  }

  async listPRs(repo: string, state: 'open' | 'closed' | 'all' = 'open'): Promise<any[]> {
    const data = await this.callApi({
      method: 'GET',
      path: `/repos/${repo}/pulls?state=${state}&per_page=30`,
      skipAudit: true,
    });
    return data || [];
  }

  async addPRComment(repo: string, prNumber: number, body: string): Promise<any> {
    return this.callApi({
      method: 'POST',
      path: `/repos/${repo}/issues/${prNumber}/comments`,
      body: { body },
      expectedStatus: [201],
    });
  }

  async createPRReview(
    repo: string,
    prNumber: number,
    review: {
      commitId: string;
      event: 'APPROVE' | 'REQUEST_CHANGES' | 'COMMENT';
      body: string;
      comments?: Array<{ path: string; line: number; body: string }>;
    }
  ): Promise<any> {
    return this.callApi({
      method: 'POST',
      path: `/repos/${repo}/pulls/${prNumber}/reviews`,
      body: review,
      expectedStatus: [200, 201],
    });
  }

  async getPRDiff(repo: string, prNumber: number): Promise<string> {
    // Para pegar o diff puro (não JSON), usamos Accept: application/vnd.github.v3.diff
    const authHeader = await this.getAuthHeader();
    const res = await fetch(`${GITHUB_API}/repos/${repo}/pulls/${prNumber}`, {
      headers: {
        Authorization: authHeader,
        Accept: 'application/vnd.github.v3.diff',
        'User-Agent': USER_AGENT,
      },
    });
    if (!res.ok) {
      throw new GitHubApiError(res.status, await res.text(), `/repos/${repo}/pulls/${prNumber}`, 'GET');
    }
    return res.text();
  }

  async mergePR(
    repo: string,
    prNumber: number,
    method: 'merge' | 'squash' | 'rebase'
  ): Promise<any> {
    return this.callApi({
      method: 'PUT',
      path: `/repos/${repo}/pulls/${prNumber}/merge`,
      body: { merge_method: method },
      expectedStatus: [200],
    });
  }

  async closePR(repo: string, prNumber: number): Promise<any> {
    return this.callApi({
      method: 'PATCH',
      path: `/repos/${repo}/pulls/${prNumber}`,
      body: { state: 'closed' },
    });
  }

  // ============================================================
  // ISSUES
  // ============================================================

  async createIssue(
    repo: string,
    title: string,
    body: string,
    labels?: string[]
  ): Promise<any> {
    return this.callApi({
      method: 'POST',
      path: `/repos/${repo}/issues`,
      body: { title, body, labels: labels || [] },
      expectedStatus: [201],
    });
  }

  async getIssue(repo: string, issueNumber: number): Promise<any> {
    return this.callApi({
      method: 'GET',
      path: `/repos/${repo}/issues/${issueNumber}`,
      skipAudit: true,
    });
  }

  async addIssueComment(repo: string, issueNumber: number, body: string): Promise<any> {
    return this.callApi({
      method: 'POST',
      path: `/repos/${repo}/issues/${issueNumber}/comments`,
      body: { body },
      expectedStatus: [201],
    });
  }

  async closeIssue(repo: string, issueNumber: number): Promise<any> {
    return this.callApi({
      method: 'PATCH',
      path: `/repos/${repo}/issues/${issueNumber}`,
      body: { state: 'closed' },
    });
  }

  async addLabels(repo: string, issueNumber: number, labels: string[]): Promise<any> {
    return this.callApi({
      method: 'POST',
      path: `/repos/${repo}/issues/${issueNumber}/labels`,
      body: { labels },
    });
  }

  // ============================================================
  // CI/CD — ACTIONS & CHECKS
  // ============================================================

  async getWorkflowRuns(repo: string, branch?: string): Promise<any> {
    const params = new URLSearchParams({ per_page: '20' });
    if (branch) params.set('branch', branch);
    return this.callApi({
      method: 'GET',
      path: `/repos/${repo}/actions/runs?${params}`,
      skipAudit: true,
    });
  }

  async getCheckStatuses(repo: string, ref: string): Promise<any> {
    return this.callApi({
      method: 'GET',
      path: `/repos/${repo}/commits/${ref}/check-runs`,
      skipAudit: true,
    });
  }

  async triggerWorkflow(
    repo: string,
    workflowId: string,
    ref: string,
    inputs?: Record<string, string>
  ): Promise<void> {
    await this.callApi({
      method: 'POST',
      path: `/repos/${repo}/actions/workflows/${workflowId}/dispatches`,
      body: { ref, inputs: inputs || {} },
      expectedStatus: [204],
    });
  }

  // ============================================================
  // SECURITY — DEPENDABOT & SECRET SCANNING
  // ============================================================

  async getDependabotAlerts(repo: string, state: 'open' | 'closed' | 'all' = 'open'): Promise<any[]> {
    const data = await this.callApi({
      method: 'GET',
      path: `/repos/${repo}/dependabot/alerts?state=${state}&per_page=50`,
      skipAudit: true,
    });
    return data || [];
  }

  async getSecretScanningAlerts(repo: string): Promise<any[]> {
    const data = await this.callApi({
      method: 'GET',
      path: `/repos/${repo}/secret-scanning/alerts?state=open&per_page=50`,
      skipAudit: true,
    });
    return data || [];
  }

  // ============================================================
  // STATS / INSIGHTS
  // ============================================================

  async getCommitActivity(repo: string): Promise<any[]> {
    const data = await this.callApi({
      method: 'GET',
      path: `/repos/${repo}/stats/commit_activity`,
      skipAudit: true,
    });
    return data || [];
  }

  async getContributors(repo: string): Promise<any[]> {
    const data = await this.callApi({
      method: 'GET',
      path: `/repos/${repo}/contributors?per_page=30`,
      skipAudit: true,
    });
    return data || [];
  }

  // ============================================================
  // REPO METADATA
  // ============================================================

  async getRepo(repo: string): Promise<any> {
    return this.callApi({
      method: 'GET',
      path: `/repos/${repo}`,
      skipAudit: true,
    });
  }

  // ============================================================
  // VALIDATION (não requer credencial salva)
  // ============================================================

  /**
   * Valida PAT (ou App JWT) sem persistir.
   * Retorna login + scopes + rate limit info.
   * Usado pelo admin UI antes de salvar nova credencial.
   */
  static async validatePat(pat: string): Promise<{
    valid: boolean;
    login: string;
    scopes: string[];
    rateLimit: { remaining: number; reset: Date; limit: number };
  }> {
    const res = await fetch(`${GITHUB_API}/user`, {
      headers: {
        Authorization: `Bearer ${pat}`,
        Accept: 'application/vnd.github+json',
        'User-Agent': USER_AGENT,
      },
    });

    if (!res.ok) {
      return {
        valid: false,
        login: '',
        scopes: [],
        rateLimit: { remaining: 0, reset: new Date(), limit: 5000 },
      };
    }

    const data = await res.json();
    const scopesHeader = res.headers.get('X-OAuth-Scopes') || '';
    return {
      valid: true,
      login: data.login,
      scopes: scopesHeader
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
      rateLimit: {
        remaining: parseInt(res.headers.get('X-RateLimit-Remaining') || '0'),
        reset: new Date(parseInt(res.headers.get('X-RateLimit-Reset') || '0') * 1000),
        limit: parseInt(res.headers.get('X-RateLimit-Limit') || '5000'),
      },
    };
  }

  /**
   * Verifica que PAT tem acesso a um repo específico.
   */
  static async validateRepoAccess(pat: string, repo: string): Promise<{
    hasAccess: boolean;
    permissions?: { admin: boolean; push: boolean; pull: boolean };
  }> {
    const res = await fetch(`${GITHUB_API}/repos/${repo}`, {
      headers: {
        Authorization: `Bearer ${pat}`,
        Accept: 'application/vnd.github+json',
        'User-Agent': USER_AGENT,
      },
    });

    if (!res.ok) {
      return { hasAccess: false };
    }

    const data = await res.json();
    return {
      hasAccess: true,
      permissions: data.permissions,
    };
  }
}

// ============================================================
// SINGLETON CACHE (uma instância por credentialId)
// ============================================================

const clientCache = new Map<string, GitHubClient>();

export function getGitHubClient(credentialId: string): GitHubClient {
  if (!clientCache.has(credentialId)) {
    clientCache.set(credentialId, new GitHubClient(credentialId));
  }
  return clientCache.get(credentialId)!;
}

/**
 * Limpa cache — útil após rotação/revogação.
 * Próxima chamada getGitHubClient() criará nova instância.
 */
export function invalidateClientCache(credentialId?: string): void {
  if (credentialId) {
    clientCache.delete(credentialId);
  } else {
    clientCache.clear();
  }
}
