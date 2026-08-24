# TENANT ISOLATION MATRIX — Seu Zélla

## Regra de classificação

Esta matriz distingue presença de `tenantId` de autorização. Um modelo só entra em `TENANT_SCOPED` quando seus registros pertencem a uma conta/negócio; ter `tenantId` no schema não é, sozinho, prova suficiente de que todo o modelo deve ser filtrado da mesma forma.

Classes:
- `TENANT_SCOPED`: dados privados do tenant.
- `SYSTEM_GLOBAL`: configuração/estado global do sistema.
- `ZCC_GLOBAL`: administração central do Seu Zélla.
- `AUTH_GLOBAL`: autenticação e identidade global.
- `AUDIT_GLOBAL`: auditoria cross-tenant controlada.
- `SHARED_REFERENCE`: referência compartilhada.

## Modelos atualmente protegidos por `TENANT_MODELS`

LockDevice, LockCode, LockEvent, LockOAuthAccount, Reservation, Guest, GuestMessage, GuestGuide, Property, Room, ApiConfig, AgentConfig, Lead, Campaign, Target, SwipeTemplate, SwipeUsage, FunnelEvent, FunnelScore, AgentLog, ConversationLog, ConversationMessage, AIActivityLog, KnowledgeEntry, Transaction, Subscription, PaymentTransaction, CalendarSync, AuditLog, ConsentLog, AirBProperty, AirBConversation, AirBSubscription, DynamicPricingRule, PricingCalculation, ReferralCode, AmortizationCredit, LiteMilestone, GuestRegistration, YieldProfitRecord, DevicePing.

## Modelos adicionais encontrados no schema para reconciliação

| Modelo | Classe Onda 0 | Decisão de enforcement | Observação |
|---|---|---|---|
| User | AUTH_GLOBAL / TENANT_SCOPED conforme uso | revisão | possui `tenantId` opcional; identidade não pode depender apenas dele |
| SecurityAlert | AUDIT_GLOBAL | não adicionar cegamente | tenantId opcional; precisa de regra de visibilidade |
| CostLog | TENANT_SCOPED | adicionar | cada registro de custo com `tenantId` pertence ao tenant; agregações sistêmicas usam caminho ZCC separado |
| Booking | TENANT_SCOPED | adicionar | dado operacional do tenant |
| TrainingPrompt | TENANT_SCOPED | adicionar | prompt configurável do tenant |
| Notification | TENANT_SCOPED | adicionar | notificação de operação do tenant |
| PerformanceSnapshot | TENANT_SCOPED | adicionar | métricas do tenant |
| QuickAction | TENANT_SCOPED | adicionar | ações configuráveis do tenant |
| Feedback | TENANT_SCOPED | adicionar | feedback do tenant |
| ZelladorMessage | TENANT_SCOPED | adicionar | mensagens privadas do tenant |
| LgpdDeleteRequest | TENANT_SCOPED | adicionar | processo LGPD do tenant |
| LgpdIncident | TENANT_SCOPED | adicionar | incidente relacionado a tenant |
| PushSubscription | TENANT_SCOPED | adicionar | inscrição por tenant/usuário |
| MetaCostLog | TENANT_SCOPED | adicionar | custo de comunicação por tenant |
| AirBRegionalKnowledge | TENANT_SCOPED | adicionar | conhecimento Airbnb do tenant |
| AirBScrapingJob | TENANT_SCOPED | adicionar | job do tenant |
| AirBTransaction | TENANT_SCOPED | adicionar | transação Airbnb do tenant |
| ZCCAccessLog | ZCC_GLOBAL | não adicionar | auditoria da administração central |
| WhatsAppMessageCost | TENANT_SCOPED | adicionar | custo WhatsApp por tenant |
| MessageBundle | TENANT_SCOPED | adicionar | bundling do tenant |
| ConsentRecord | TENANT_SCOPED | adicionar | consentimento por tenant |
| AirbnbWebhookEvent | TENANT_SCOPED | adicionar | webhook pertence ao tenant |
| AirbnbOAuthToken | TENANT_SCOPED | adicionar | segredo de integração do tenant |
| DpoPreferencePair | TENANT_SCOPED | adicionar | dados de governança do tenant |
| GraphNode | TENANT_SCOPED | adicionar | grafo privado do tenant |
| GraphEdge | TENANT_SCOPED | adicionar | relações privadas do tenant |
| BrainHealthLog | TENANT_SCOPED | adicionar | saúde do cérebro do tenant |
| CompiledPrompt | TENANT_SCOPED | adicionar | prompt compilado por tenant |
| AirbExpense | TENANT_SCOPED | adicionar | despesa Airbnb do tenant |
| AirbOperationTask | TENANT_SCOPED | adicionar | tarefa operacional do tenant |
| AirbGoal | TENANT_SCOPED | adicionar | meta do tenant |
| AirbCommission | TENANT_SCOPED | adicionar | comissão do tenant |
| AirbReport | TENANT_SCOPED | adicionar | relatório do tenant |
| PolicyAudit | TENANT_SCOPED | adicionar | auditoria de política com escopo tenant |
| CerebroWorkflow | TENANT_SCOPED | adicionar | workflow privado do tenant |
| CerebroTelemetryEvent | AUDIT_GLOBAL/TENANT_SCOPED | revisão | `tenantId` é opcional; visibilidade precisa ser definida antes do enforcement automático |
| AirbTrialSignup | SYSTEM_GLOBAL/TENANT_SCOPED | revisão | confirmar se é lead global ou signup atribuído |

## Contagem de enforcement

- `TENANT_MODELS` pré-existentes: **41**
- Modelos adicionais classificados como `TENANT_SCOPED`: **32**
- Total esperado em `TENANT_MODELS` após a Wave 1: **73**

## Nota de reconciliação

A contagem de modelos com `tenantId` é validada pelo script `scripts/audit-tenant-models.ts`. A matriz é a fonte de classificação, enquanto o script é a fonte de contagem. Modelos com `tenantId` opcional não entram automaticamente; somente modelos classificados como `TENANT_SCOPED` entram no enforcement.

## Gate Onda 1

Somente modelos classificados como `TENANT_SCOPED` serão adicionados ao enforcement automático. `ZCC_GLOBAL`, `AUTH_GLOBAL`, `AUDIT_GLOBAL` e `SHARED_REFERENCE` não entram por conveniência.
