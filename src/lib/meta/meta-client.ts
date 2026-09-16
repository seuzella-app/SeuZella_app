// ==============================================================================
// ZÉLLA — Meta Client (Fase 2 / Fase 20 / Fase 11)
// ==============================================================================
// Cliente Graph API centralizado: versão única (META_GRAPH_API_VERSION),
// timeout obrigatório, retry APENAS quando seguro (erro de rede/5xx — nunca
// 4xx), correlationId e nenhuma exposição de token em logs/retornos.
//
// Reaproveita a configuração central de env.ts. O padrão de endpoint segue o
// já existente em src/lib/whatsapp/cloud-api.ts (mesma URL centralizada).
// ==============================================================================

import { META_ACCESS_TOKEN } from '@/lib/env';
import { metaGraphUrl, ACTIVE_META_GRAPH_API_VERSION } from './meta-config';

const DEFAULT_TIMEOUT_MS = 15_000;
const MAX_SAFE_RETRIES = 1;

export interface MetaGraphResult<T = unknown> {
  ok: boolean;
  status: number;
  data: T | null;
  error: string | null;
  correlationId: string;
  /** true se a resposta veio depois de retry seguro. */
  retried: boolean;
  graphApiVersion: string;
}

function isRetryableStatus(status: number): boolean {
  // Retry apenas para erros transitórios de servidor/rate limit pesado.
  return status >= 500;
}

export async function metaGraphFetch<T = unknown>(params: {
  /** Path relativo à versão, ex: `${phoneNumberId}/messages`. */
  path: string;
  method?: 'GET' | 'POST';
  body?: Record<string, unknown>;
  query?: Record<string, string>;
  correlationId?: string;
  timeoutMs?: number;
}): Promise<MetaGraphResult<T>> {
  const {
    path,
    method = 'GET',
    body,
    query,
    correlationId = `meta-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
    timeoutMs = DEFAULT_TIMEOUT_MS,
  } = params;

  if (!META_ACCESS_TOKEN) {
    return {
      ok: false,
      status: 0,
      data: null,
      error: 'META_CREDENTIALS_NOT_CONFIGURED',
      correlationId,
      retried: false,
      graphApiVersion: ACTIVE_META_GRAPH_API_VERSION,
    };
  }

  const url = new URL(metaGraphUrl(path));
  for (const [k, v] of Object.entries(query ?? {})) url.searchParams.set(k, v);

  let attempt = 0;
  let retried = false;

  while (attempt <= MAX_SAFE_RETRIES) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(url.toString(), {
        method,
        headers: {
          Authorization: `Bearer ${META_ACCESS_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: body ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });

      const json = (await response.json().catch(() => null)) as T | null;

      if (response.ok) {
        return {
          ok: true,
          status: response.status,
          data: json,
          error: null,
          correlationId,
          retried,
          graphApiVersion: ACTIVE_META_GRAPH_API_VERSION,
        };
      }

      // 4xx = erro do caller — NUNCA reintentar (evita cobrar mensagens duplicadas).
      if (!isRetryableStatus(response.status)) {
        const errObj = (json as { error?: { message?: string } } | null)?.error;
        return {
          ok: false,
          status: response.status,
          data: json,
          error: errObj?.message ?? `META_GRAPH_ERROR_${response.status}`,
          correlationId,
          retried,
          graphApiVersion: ACTIVE_META_GRAPH_API_VERSION,
        };
      }

      // 5xx: pode reintentar UMA vez com segurança.
      if (attempt < MAX_SAFE_RETRIES) {
        retried = true;
        attempt += 1;
        continue;
      }

      const errObj = (json as { error?: { message?: string } } | null)?.error;
      return {
        ok: false,
        status: response.status,
        data: json,
        error: errObj?.message ?? `META_GRAPH_ERROR_${response.status}`,
        correlationId,
        retried,
        graphApiVersion: ACTIVE_META_GRAPH_API_VERSION,
      };
    } catch (error) {
      // Erro de rede/timeout: seguro reintentar UMA vez (request não confirmado
      // pela Meta — nunca registramos custo neste ponto).
      const isAbort = error instanceof Error && error.name === 'AbortError';
      if (attempt < MAX_SAFE_RETRIES) {
        retried = true;
        attempt += 1;
        continue;
      }
      return {
        ok: false,
        status: 0,
        data: null,
        error: isAbort ? 'META_GRAPH_TIMEOUT' : 'META_GRAPH_NETWORK_ERROR',
        correlationId,
        retried,
        graphApiVersion: ACTIVE_META_GRAPH_API_VERSION,
      };
    } finally {
      clearTimeout(timer);
    }
  }

  // Inalcançável, mas satisfaz o type checker.
  return {
    ok: false,
    status: 0,
    data: null,
    error: 'META_GRAPH_UNKNOWN',
    correlationId,
    retried,
    graphApiVersion: ACTIVE_META_GRAPH_API_VERSION,
  };
}
