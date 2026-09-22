/**
 * ZEHLA — PINNs / Clifford Algebra Processing API Route
 *
 * POST /api/pinns-clifford
 * Processes spatial data through Physics-Informed Neural Networks
 * with Clifford Algebra geometric layer.
 *
 * Security: Protected by Zero Trust API Shield (rate limit, sanitization, payload size).
 */

import { NextResponse } from 'next/server';
import { withSecurity } from '@/lib/security/api-shield';
import { processWithPINNsClifford, extractTelemetry, type PINNsProcessingInput } from '@/lib/pinns-clifford';
import { guardRequest, auditRouteEvent } from '@/lib/infra/wiring';

export const POST = withSecurity(
  async (request, ctx) => {
    // RUN19-A (HYGIENE): anti-flood fail-closed por IP — 60 req/1min (retry com âncoras expandidas).
    const rlDeny = guardRequest(request, 'pinns-clifford', { points: 60, windowMs: 60000 });
    if (rlDeny) return rlDeny;
    // RUN19-A (HYGIENE): trilha de auditoria da entrada da rota (sem payload).
    auditRouteEvent({ who: 'route:pinns-clifford', what: 'pinns-clifford.entry', resource: 'api', result: 'ALLOW' });
    const body = ctx.sanitizedBody;

    if (!body?.tenantId || !body?.traceId) {
      return NextResponse.json(
        {
          error: 'VALIDATION_ERROR',
          message: 'Campos obrigatorios: tenantId, traceId, spatialData.coordinates',
          requestId: ctx.requestId,
        },
        { status: 400 }
      );
    }

    const spatialData = body?.spatialData as Record<string, unknown> | undefined;
    if (!spatialData?.coordinates || !(spatialData.coordinates as unknown[]).length) {
      return NextResponse.json(
        {
          error: 'VALIDATION_ERROR',
          message: 'spatialData.coordinates deve conter ao menos um ponto [x, y, z]',
          requestId: ctx.requestId,
        },
        { status: 400 }
      );
    }

    const coords = spatialData!.coordinates as number[][];
    for (const coord of coords) {
      if (!Array.isArray(coord) || coord.length < 3 || coord.some(c => typeof c !== 'number')) {
        return NextResponse.json(
          {
            error: 'VALIDATION_ERROR',
            message: 'Cada coordenada deve ser [x, y, z] com valores numericos',
            requestId: ctx.requestId,
          },
          { status: 400 }
        );
      }
    }

    try {
      const input: PINNsProcessingInput = {
        tenantId: body.tenantId as string,
        traceId: body.traceId as string,
        spatialData: {
          coordinates: coords,
          properties: spatialData.properties as Record<string, number[]> | undefined,
        },
        physicsConfig: body.physicsConfig as PINNsProcessingInput['physicsConfig'],
      };

      const result = await processWithPINNsClifford(input);

      const telemetry = extractTelemetry(result);

      return NextResponse.json({
        success: true,
        requestId: ctx.requestId,
        data: result,
        telemetry,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Erro desconhecido';
      return NextResponse.json(
        {
          error: 'PINNS_PROCESSING_ERROR',
          message,
          requestId: ctx.requestId,
        },
        { status: 500 }
      );
    }
  },
  {
    maxPayloadBytes: 2_000_000, // 2MB for coordinate data
    routeLabel: 'PINNS_CLIFFORD',
  }
);