# SEU ZÉLLA — FIRE TEST PROTOCOL

## Objetivo
Validar o produto em um ambiente Zélla virgem, usando uma primeira pousada de teste cadastrada manualmente, um número WhatsApp Business dedicado e um número pessoal atuando como hóspede.

## Regra de ouro
Nenhum mock de tenant, hóspede, conversa, pagamento, WhatsApp ou operação pode contaminar o ambiente do fire test. Dados de sistema estritamente necessários (admin, configurações técnicas e migrations) podem existir; dados de negócio devem nascer durante o teste.

## Fase 0 — Infraestrutura
1. Comprar `seuzella.com`.
2. Criar e-mail corporativo `suporte@seuzella.com` e demais caixas operacionais.
3. Criar/transferir o repositório para a identidade corporativa conforme política definida, preservando histórico e permissões.
4. Provisionar a VPS Hostinger limpa.
5. Configurar PostgreSQL/Redis/segredos do ambiente por variáveis, nunca no Git.
6. Configurar domínio, TLS, SMTP/Email provider e observabilidade.
7. Configurar conta Meta Business + WhatsApp Business Platform.

## WhatsApp — configuração de teste
- A pousada fictícia pode ter dados fictícios.
- O número WhatsApp da pousada NÃO pode ser um número inventado. Deve ser um número real capaz de ser registrado/verificado na Plataforma do WhatsApp Business, ou o número de teste oficial da Meta para a etapa inicial.
- O número pessoal do operador pode ser usado como o número do hóspede para a prova de fogo.
- Para o número de teste da Meta, apenas destinatários previamente autorizados podem ser usados; para o teste completo recomenda-se um número empresarial dedicado real.
- Respostas livres ficam dentro da janela de atendimento de 24h após uma mensagem recebida; fora dela, utilizar template aprovado.

## Fase 1 — Zélla virgem
Acceptance:
- `Tenant` count = 0 antes do primeiro cadastro, desconsiderando somente fixtures de sistema formalmente documentadas.
- `Guest`, `Reservation`, `Booking`, `ConversationLog`, `ConversationMessage`, `GuestMessage`, `AIActivityLog` e `ZelladorMessage` de negócio = 0.
- ZCC onboarding tracker retorna `source=database` e `totalTenants=0`.
- O endpoint de onboarding NÃO pode retornar tenants de exemplo.

## Fase 2 — Primeiro cadastro manual
O operador cadastra manualmente uma pousada fictícia pelo fluxo normal do produto.

Registrar evidências:
- tenantId
- propertyId
- rooms
- owner/user
- plano/status
- dados de contato
- configuração WhatsApp
- configuração fiscal, quando aplicável
- configuração de pagamento
- lock mapping, quando utilizado

Acceptance:
- exatamente 1 tenant de negócio;
- exatamente 1 property associada;
- todas as relações tenant-scoped apontam para o tenant correto;
- ZCC passa a exibir somente a primeira pousada criada;
- nenhum dado de outra propriedade aparece.

## Fase 3 — Primeiro hóspede real do teste
Usar o WhatsApp pessoal do operador para enviar mensagem ao número empresarial da pousada.

Validar:
1. Meta webhook recebido.
2. Assinatura validada.
3. Business number → tenant resolvido.
4. `providerMessageId` persistido como chave de idempotência.
5. Guest criado/atualizado.
6. GuestMessage/ConversationLog/ConversationMessage persistidos.
7. Mensagem chega à fila/cérebro.
8. Resposta Zélla gerada.
9. Resposta enviada pela Cloud API.
10. `wamid` persistido para rastreabilidade.
11. Auditoria criada sem segredos ou tokens.

## Fase 4 — Reserva e operação
Criar uma reserva fictícia real no tenant de teste e validar:
- quarto correto;
- datas;
- preço;
- pagamento Asaas ou Mercado Pago em sandbox/ambiente controlado;
- webhook real;
- idempotência;
- Transaction da reserva;
- notificação persistente;
- room → lock;
- PIN somente quando houver vínculo explícito.

## Fase 5 — ZCC e Cérebro
O ZCC deve começar vazio e acumular dados reais do tenant conforme as operações acontecem.

O que significa “aprender” neste teste:
- persistir contexto de tenant/hóspede;
- compilar métricas e eventos;
- atualizar memória/knowledge/contexto do agente;
- registrar atividade e confiança;
- utilizar dados anteriores autorizados no contexto de novas interações.

Não considerar “aprendizado” como retreinamento automático dos pesos do modelo. Qualquer treinamento/recalibração de modelo deve ser um processo separado, auditável e explicitamente autorizado.

## Fase 6 — Prova de isolamento
Criar um segundo tenant fictício somente depois do primeiro fluxo funcionar.
Validar que:
- tenant A nunca lê hóspedes/reservas/conversas do tenant B;
- eventos realtime não cruzam tenants;
- ZCC administrativo consegue consultar ambos somente através de rotas autorizadas;
- dados fiscais/pagamentos/WhatsApp continuam vinculados ao tenant correto.

## Evidências obrigatórias
- screenshots de onboarding;
- request/response de webhook sem segredos;
- IDs de provider;
- IDs internos de tenant/guest/reservation;
- logs de auditoria;
- métricas do ZCC antes/depois;
- transição dos estados de pagamento;
- resultado do realtime 2-device;
- resultado da operação do lock/PIN, quando aplicável.

## Go / No-Go
GO somente quando:
- ambiente virgem comprovado;
- primeiro cadastro manual concluído;
- primeiro hóspede WhatsApp concluído;
- resposta Zélla entregue;
- dados persistidos e visíveis no ZCC;
- pagamento/webhook reconciliado;
- segurança/tenant isolation verdes;
- nenhum mock de negócio for usado para mascarar resultado.
