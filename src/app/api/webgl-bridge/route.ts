/**
 * ZEHLA — WebGL Bridge 3D Rendering API Route
 *
 * POST /api/webgl-bridge
 * Bridges BIM Vision extraction data to WebGL 3D scene representation
 * with PBR materials, scene graph, and volumetric mesh data.
 *
 * Security: Protected by Zero Trust API Shield (rate limit, sanitization, payload size).
 */

import { NextResponse } from 'next/server';
import { withSecurity } from '@/lib/security/api-shield';
import { bridgeToWebGL, extractTelemetry, type WebGLBridgeInput } from '@/lib/webgl-bridge';
import type { BIMExtractionResult } from '@/lib/bim-vision';
import { guardRequest, auditRouteEvent } from '@/lib/infra/wiring';

export const POST = withSecurity(
  async (request, ctx) => {
    // RUN19-A (HYGIENE): anti-flood fail-closed por IP — 60 req/1min (retry com âncoras expandidas).
    const rlDeny = guardRequest(request, 'webgl-bridge', { points: 60, windowMs: 60000 });
    if (rlDeny) return rlDeny;
    // RUN19-A (HYGIENE): trilha de auditoria da entrada da rota (sem payload).
    auditRouteEvent({ who: 'route:webgl-bridge', what: 'webgl-bridge.entry', resource: 'api', result: 'ALLOW' });
    const body = ctx.sanitizedBody;

    if (!body?.tenantId || !body?.traceId) {
      return NextResponse.json(
        {
          error: 'VALIDATION_ERROR',
          message: 'Campos obrigatorios: tenantId, traceId, bimResult',
          requestId: ctx.requestId,
        },
        { status: 400 }
      );
    }

    if (!body?.bimResult) {
      return NextResponse.json(
        {
          error: 'VALIDATION_ERROR',
          message: 'bimResult (saida do modulo BIM Vision) e obrigatorio',
          requestId: ctx.requestId,
        },
        { status: 400 }
      );
    }

    // Validate bimResult has required structure
    const bim = body.bimResult as Record<string, unknown>;
    const bimElements = bim.elements as unknown[] | undefined;
    if (!bimElements?.length || !bim.projectExtent || !bim.spatialZones) {
      return NextResponse.json(
        {
          error: 'VALIDATION_ERROR',
          message: 'bimResult deve conter elements, projectExtent e spatialZones',
          requestId: ctx.requestId,
        },
        { status: 400 }
      );
    }

    try {
      const input: WebGLBridgeInput = {
        tenantId: body.tenantId as string,
        traceId: body.traceId as string,
        bimResult: bim as unknown as BIMExtractionResult,
        renderConfig: body.renderConfig as WebGLBridgeInput['renderConfig'],
      };

      const result = await bridgeToWebGL(input);

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
        { error: 'WEBGL_BRIDGE_ERROR', message, requestId: ctx.requestId },
        { status: 500 }
      );
    }
  },
  {
    maxPayloadBytes: 3_000_000, // 3MB for BIM data + mesh output
    routeLabel: 'WEBGL_BRIDGE',
  }
);