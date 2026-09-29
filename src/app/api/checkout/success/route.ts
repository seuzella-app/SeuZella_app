import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getNextAuthSecret } from '@/lib/env';
import { verifyCheckoutSubscriptionSignature } from '@/lib/payments/checkout-signature';
import { guardRequest, auditRouteEvent } from '@/lib/infra/wiring';

// ═══════════════════════════════════════════════════════════════════════════
// RBW v2 — CHECKOUT SUCCESS É OBSERVADOR, NUNCA AUTORIDADE FINANCEIRA
// ═══════════════════════════════════════════════════════════════════════════
// Correção da auditoria do kit v1 (item 3.1): esta rota AINDA ativava
// subscription+tenant e criava período financeiro por um GET do navegador —
// autoridade paralela ao webhook. A partir da v2:
//
//   CHECKOUT/SUCCESS (GET do cliente)  =  LEITURA + UX de retorno
//   WEBHOOK DO PROVIDER                =  ÚNICA AUTORIDADE DE MUTAÇÃO
//     → verificação → idempotência → normalização → state machine
//     → applySubscriptionPaymentStatus (dono único)
//
// Contrato desta rota (NADA além disto):
//   1. valida subscription_id presente;
//   2. valida assinatura HMAC (timing-safe);
//   3. valida sessão/tenant;
//   4. LÊ o estado atual da assinatura;
//   5. NÃO ativa subscription;      6. NÃO ativa tenant;
//   7. NÃO altera plano;            8. NÃO altera período financeiro;
//   9. NÃO transforma pendente em aprovado;
//  10. NÃO cria autoridade financeira paralela (nem Property, nem tenant).
//
// Estados:
//   pending/sem estado   → /ddc?payment=pending   (sem mutação)
//   rejected             → /ddc?payment=rejected (sem mutação)
//   refunded/cancelled/
//   expired/chargeback   → /ddc?payment=failed   (sem mutação)
//   active + approved    → /ddc?payment=success  (NO-OP financeiro)
//
// REPLAY GARANTIDO: refresh/reenvio do link nunca cria nem estende
// currentPeriodStart/currentPeriodEnd — a rota não escreve nada no banco
// financeiro.
// ═══════════════════════════════════════════════════════════════════════════

export async function GET(request: NextRequest) {
  // RUN13-A (W2): anti-flood fail-closed por IP — 60 req/1min.
  const rlDeny = guardRequest(request, 'checkout.success', { points: 60, windowMs: 60000 });
  if (rlDeny) return rlDeny;
  // RUN13-A (W2): trilha de auditoria da entrada da rota (sem payload).
  auditRouteEvent({ who: 'route:checkout.success', what: 'checkout.success.entry', resource: 'api', result: 'ALLOW' });
  try {
    const {searchParams} = request.nextUrl;
    const subscriptionId = searchParams.get('subscription_id');
    const sig = searchParams.get('sig');

    if (!subscriptionId) {
      return NextResponse.redirect(new URL('/?error=missing_subscription', request.url));
    }

    if (!sig) {
      return NextResponse.redirect(new URL('/?error=invalid_signature', request.url));
    }

    const session = await getServerSession(authOptions);
    if (!session?.user?.tenantId) {
      return NextResponse.redirect(new URL('/?error=unauthorized', request.url));
    }

    const secret = getNextAuthSecret();
    // Fase H (RBW): verificação canônica única (timing-safe, comprimento
    // comparado antes de timingSafeEqual — evita throw em sig de tamanho errado).
    if (!verifyCheckoutSubscriptionSignature(subscriptionId, sig, secret)) {
      return NextResponse.redirect(new URL('/?error=invalid_signature', request.url));
    }

    const subscription = await db.subscription.findUnique({
      where: { id: subscriptionId },
    });

    if (!subscription) {
      return NextResponse.redirect(new URL('/?error=subscription_not_found', request.url));
    }

    // Isolamento por tenant: assinatura de OUTRO tenant é bloqueada
    // (o link vazado/forjado não dá acesso nem visibilidade de outro tenant).
    if (subscription.tenantId !== session.user.tenantId) {
      return NextResponse.redirect(new URL('/?error=forbidden', request.url));
    }

    // ── RBW v2: LEITURA de estado — sem NENHUMA mutação financeira ─────────
    // A ativação (subscription active + tenant active + período) acontece
    // EXCLUSIVAMENTE no fluxo canônico: provider webhook → state machine →
    // applySubscriptionPaymentStatus. Aqui apenas classificamos o estado
    // para o redirect de UX.
    const isActiveApproved =
      subscription.status === 'active' && subscription.paymentStatus === 'approved';

    if (!isActiveApproved) {
      const paymentStatus = subscription.paymentStatus || 'pending';
      let redirectPath: string;
      if (paymentStatus === 'rejected') {
        redirectPath = '/ddc?payment=rejected';
      } else if (
        paymentStatus === 'refunded' ||
        paymentStatus === 'chargeback' ||
        paymentStatus === 'cancelled' ||
        paymentStatus === 'expired'
      ) {
        redirectPath = '/ddc?payment=failed';
      } else {
        // pending e qualquer estado desconhecido: pagamento ainda não
        // confirmado — NUNCA transformamos pendente em aprovado aqui.
        redirectPath = '/ddc?payment=pending';
      }
      return NextResponse.redirect(new URL(redirectPath, request.url));
    }

    // ── Estado ATIVO+APROVADO (atividade feita pelo WEBHOOK, não por aqui) ──
    // RBW v2.1: este GET é estritamente observador. Não registra conversão,
    // não cria tracking, não atualiza qualquer entidade e não dispara workflow.
    return NextResponse.redirect(new URL('/ddc?payment=success', request.url));

  } catch (error) {
    console.error('Payment success error:', error);
    return NextResponse.redirect(new URL('/?error=payment_failed', request.url));
  }
}
