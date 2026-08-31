# Lote 4 — IDOR | Fases 1–2

Data: 2026-08-29
Baseline: `main@d1e283b38ba72452df99dffb1cf283dbc29506df`
Branch: `security/lote4-idor-phase1-2`

## Fase 1 — Inventário factual

A superfície de API do repositório deve ser reconciliada a partir do código presente no `main`, sem assumir que findings de snapshots históricos ainda são válidos. A pesquisa inicial identificou, entre outros, `src/app/api/checkout/success/route.ts` como endpoint de checkout com acesso direto a `Subscription` por identificador fornecido pela requisição.

## Finding confirmado

### Checkout success — ownership pós-consulta

Antes da correção, o endpoint:

1. autenticava a sessão e obtinha `session.user.tenantId`;
2. validava a assinatura HMAC do `subscription_id`;
3. buscava `Subscription` somente por `id`;
4. comparava `subscription.tenantId` com o tenant da sessão somente depois da leitura;
5. atualizava a assinatura somente por `id`.

Isso não era uma quebra direta de autorização com a assinatura HMAC correta, mas criava um padrão de acesso global por identificador e deixava a fronteira de tenant dependente de uma checagem posterior. O padrão é desnecessariamente permissivo para um endpoint de alta sensibilidade.

## Fase 2 — Correção aplicada

A consulta passou a exigir simultaneamente:

`id = subscriptionId AND tenantId = session.user.tenantId`

A mutação passou a usar `updateMany` com o mesmo predicado e exige exatamente uma linha afetada.

Também foi endurecida a validação da assinatura: `timingSafeEqual` só é chamado quando os buffers possuem o mesmo tamanho, evitando exceção causada por entrada malformada.

A mensagem de ausência não diferencia objeto inexistente de objeto pertencente a outro tenant, reduzindo enumeração.

## Invariantes

- usuário sem `tenantId` não acessa o fluxo;
- assinatura válida de outro tenant não é encontrada;
- nenhuma atualização é feita fora do tenant autenticado;
- assinatura malformada não gera 500 por diferença de tamanho;
- a ativação precisa afetar exatamente uma assinatura do tenant;
- o tenant atualizado é o tenant da sessão, não um tenant derivado livremente do objeto solicitado.

## Próxima fase

Expandir o inventário para os demais endpoints tenant-scoped e classificar cada acesso por autenticação, tenant boundary, ownership, recurso e teste existente antes de novas mudanças de código.
