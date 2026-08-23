import { NextRequest, NextResponse } from 'next/server';
import { resolveTenantId } from '@/lib/ddc/auth-utils';
import { listLocks as ttlockList } from '@/lib/locks/providers/ttlock';
import { listLocks as tuyaList } from '@/lib/locks/providers/tuya';
import { listLocks as igloohomeList } from '@/lib/locks/providers/igloohome';
import { listLocks as nukiList } from '@/lib/locks/providers/nuki';
import { listLocks as augustList } from '@/lib/locks/providers/august';

// GET /api/ddc/locks/oauth/[provider]/devices — Lista fechaduras do provedor
//
// Após OAuth conectado, o host pode listar as fechaduras vinculadas à conta
// do provedor e selecionar quais importar para o Zélla.
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ provider: string }> },
) {
  try {
    const { provider } = await params;
    const tenantId = await resolveTenantId();
    if (!tenantId) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    let locks: any[] = [];
    try {
      switch (provider) {
        case 'ttlock':
          locks = await ttlockList();
          break;
        case 'tuya':
          locks = await tuyaList();
          break;
        case 'igloohome':
          locks = await igloohomeList();
          break;
        case 'nuki':
          locks = await nukiList();
          break;
        case 'august':
          locks = await augustList();
          break;
        default:
          return NextResponse.json(
            { success: false, error: `Provider ${provider} não suportado` },
            { status: 400 },
          );
      }
    } catch (err) {
      // Provavelmente OAuth não conectado ou expirado
      return NextResponse.json({
        success: false,
        error: `Não foi possível listar dispositivos de ${provider}. Verifique se a conexão OAuth está ativa.`,
        details: (err as Error).message,
        hint: `Inicie OAuth em GET /api/ddc/locks/oauth/${provider}/start`,
      }, { status: 502 });
    }

    return NextResponse.json({
      success: true,
      provider,
      count: locks.length,
      locks,
    });
  } catch (error) {
    console.error('[LOCKS] List provider devices error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to list provider devices' },
      { status: 500 },
    );
  }
}
