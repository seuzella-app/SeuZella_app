/**
 * ZEHLA — BIM Vision Biologica Extraction API Route
 *
 * POST /api/bim-vision
 * Extracts structural and spatial data from BIM models (IFC/RVT)
 * conforming to ISO 19650 CDE specifications.
 *
 * Security: Protected by Zero Trust API Shield (rate limit, sanitization, payload size).
 */

import { NextResponse } from 'next/server';
import { withSecurity } from '@/lib/security/api-shield';
import { extractBIMVision, extractTelemetry, type BIMExtractionInput, type BIMFormat } from '@/lib/bim-vision';
import { guardRequest, auditRouteEvent } from '@/lib/infra/wiring';

export const POST = withSecurity(
  async (request, ctx) => {
    // RUN19-A (HYGIENE): anti-flood fail-closed por IP — 60 req/1min (retry com âncoras expandidas).
    const rlDeny = guardRequest(request, 'bim-vision', { points: 60, windowMs: 60000 });
    if (rlDeny) return rlDeny;
    // RUN19-A (HYGIENE): trilha de auditoria da entrada da rota (sem payload).
    auditRouteEvent({ who: 'route:bim-vision', what: 'bim-vision.entry', resource: 'api', result: 'ALLOW' });
    const body = ctx.sanitizedBody;

    if (!body?.tenantId || !body?.traceId) {
      return NextResponse.json(
        {
          error: 'VALIDATION_ERROR',
          message: 'Campos obrigatorios: tenantId, traceId, container, format',
          requestId: ctx.requestId,
        },
        { status: 400 }
      );
    }

    const validFormats: string[] = ['IFC4', 'IFC4x3', 'RVT', 'IFC2x3'];
    const format = body?.format as string | undefined;
    if (!format || !validFormats.includes(format)) {
      return NextResponse.json(
        {
          error: 'VALIDATION_ERROR',
          message: `format deve ser um de: ${validFormats.join(', ')}`,
          requestId: ctx.requestId,
        },
        { status: 400 }
      );
    }

    if (!body?.container) {
      return NextResponse.json(
        {
          error: 'VALIDATION_ERROR',
          message: 'container (ISO 19650) e obrigatorio',
          requestId: ctx.requestId,
        },
        { status: 400 }
      );
    }

    try {
      const pinnsData = body?.spatialDataFromPINNs as Record<string, unknown> | undefined;
      const pinnsCoords = pinnsData?.coordinates as unknown[] | undefined;
      const pinnsIntegrated = !!pinnsCoords?.length;

      const result = await extractBIMVision({
        tenantId: body.tenantId as string,
        traceId: body.traceId as string,
        container: body.container as BIMExtractionInput['container'],
        format: format as BIMFormat,
        fileContent: body.fileContent as string | undefined,
        spatialDataFromPINNs: body.spatialDataFromPINNs as BIMExtractionInput['spatialDataFromPINNs'],
      });

      const telemetry = extractTelemetry(result, pinnsIntegrated);

      return NextResponse.json({
        success: true,
        requestId: ctx.requestId,
        data: result,
        telemetry,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Erro desconhecido';

      if (message.includes('ISO19650')) {
        return NextResponse.json(
          { error: 'BIM_ISO19650_VIOLATION', message, requestId: ctx.requestId },
          { status: 422 }
        );
      }

      return NextResponse.json(
        { error: 'BIM_EXTRACTION_ERROR', message, requestId: ctx.requestId },
        { status: 500 }
      );
    }
  },
  {
    maxPayloadBytes: 5_000_000, // 5MB for potential file content
    routeLabel: 'BIM_VISION',
  }
);