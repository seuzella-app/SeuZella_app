# META ONE READINESS (Fase 28)

Onda: `feat/meta-zella-foundation`

## Posição oficial

**Meta One é OPCIONAL. A Cloud API do Zélla NÃO depende da assinatura.**
O Meta Business Agent permanece **desligado** (`businessAgentEnabled=false`).

Nesta onda NÃO foi implementado:
- assinatura Meta One
- checkout Meta One
- scraping
- automação de assinatura

Este documento existe apenas como **preparação de conhecimento** — sem alterar
produto.

## Planos Meta One (referência pública — sem integração)

| Tier | O que a Meta oferta (resumo) | Relevância futura para o Zélla |
|---|---|---|
| **Essential** | base Cloud API + ferramentas básicas de conversa | nenhum requisito atual |
| **Advanced** | automações/agentes adicionais no ecossistema Business | possível fallback/canal auxiliar |
| **Expert** | capacidades avançadas de agente + escala | apenas se o Cérebro Zélla precisar de canal de discovery |
| **Max** | pacote completo de agente/automação | sem caso de uso identificado |

> Verificar os tiers vigentes no painel da Meta antes de qualquer decisão —
> os nomes/escopos acima são referência pública e podem mudar.

## Quando (e se) o Meta Business Agent for avaliado

Ele só poderia entrar, no futuro, como:
- **fallback** (quando o Cérebro Zélla estiver indisponível)
- **canal auxiliar** (qualificação/discovery/aquisição)

**Nunca** como substituição do Zélla Brain, que permanece responsável por
contexto hoteleiro, memória, conhecimento, raciocínio, ferramentas e
aprendizagem.

## Capability model (implementado — Fase 13)

`src/lib/meta/meta-config.ts` → `getMetaBusinessAgentCapability()`:

```ts
{
  businessAgentAvailable: false,   // sem Meta approval / Meta One
  businessAgentEnabled: false,     // SEMPRE false nesta onda
  businessAgentProvider: 'none',
  businessAgentBillingModel: 'none'
}
```

## Como ativar futuramente (checklist)

1. Meta approval + decisão comercial explícita
2. `META_BUSINESS_AGENT_ENABLED=true` (feature flag única)
3. Contrato de evento próprio (não reutilizar o webhook do WhatsApp sem teste)
4. Guardrails revisados — NADA do Cérebro delegado por padrão

## Como desligar / rollback

Flag para `false` — reversão imediata, sem migration, sem dependência.
