/**
 * GET /api/lgpd/dpa
 *
 * Retorna o template do Data Processing Agreement (DPA) entre Zélla e Pousada.
 * Documento exigido pela ANPD quando terceiriza processamento de dados.
 */

import { NextRequest, NextResponse } from 'next/server';
import { DPA_TEMPLATE } from '@/lib/lgpd/lgpd-service';

async function getHandler(_req: NextRequest) {
  return NextResponse.json({
    success: true,
    data: {
      template: DPA_TEMPLATE,
      versao: '1.0',
      dataAtualizacao: '2026-08-17',
      fundamentoLegal: 'LGPD art. 39 — obrigatoriedade de contrato entre controladora e operadora',
    },
  });
}

export const GET = getHandler;
