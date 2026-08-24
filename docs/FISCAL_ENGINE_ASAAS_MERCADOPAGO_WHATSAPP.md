# Seu Zélla — Fiscal Engine, Pagamentos e WhatsApp

## Escopo oficial

- Pagamentos: **Asaas + Mercado Pago**.
- Emissão fiscal automatizada: **Asaas NFS-e**, quando a conta do estabelecimento estiver fiscalmente configurada e o município/serviço forem compatíveis.
- WhatsApp: **Meta WhatsApp Business Cloud API** para mensagens, templates, status e webhooks.
- Stripe: **fora do escopo**.

## 1. Regra fiscal central

O Seu Zélla é o software de automação e conciliação. A nota fiscal é emitida pelo CNPJ que legalmente presta o serviço e está configurado no emissor/provedor fiscal.

### 1.1 Pousada → Hóspede

Quando a pousada precisar emitir NFS-e para o hóspede, o Zélla pode:

1. identificar a reserva/pagamento;
2. reunir os dados fiscais do hóspede;
3. usar o pagamento Asaas como origem da NFS-e ou uma emissão avulsa vinculada ao cliente;
4. enviar os dados corretos do serviço municipal;
5. acompanhar `SCHEDULED → SYNCHRONIZED/PROCESSING → AUTHORIZED/ERROR`;
6. disponibilizar PDF/XML/número/código de validação quando o provedor fornecer;
7. comunicar o hóspede por WhatsApp/e-mail conforme a configuração.

A API Asaas permite NFS-e vinculada a cobrança (`payment`), parcelamento (`installment`) ou avulsa por cliente (`customer`). A emissão exige configuração fiscal da conta e serviço municipal. citehttps://docs.asaas.com/reference/agendar-nota-fiscalhttps://docs.asaas.com/docs/notas-fiscais

### 1.2 Pousada → Seu Zélla

Este é um fluxo fiscal diferente. O estabelecimento pode ter uma obrigação de emitir documento fiscal para a empresa Seu Zélla quando houver uma relação comercial/repasse que juridicamente exija isso.

O Zélla **não deve fabricar ou emitir essa nota como se fosse o emissor do CNPJ da pousada**. O sistema deve:

- manter o cadastro fiscal do Seu Zélla como destinatário;
- gerar a instrução/documento de solicitação com os dados corretos;
- registrar o status `REQUESTED → ISSUED_BY_SUPPLIER → RECEIVED → VALIDATED/REJECTED`;
- armazenar a referência do documento recebido e seus metadados;
- conciliar o documento com contrato, repasse e período financeiro.

A emissão do documento permanece de responsabilidade do CNPJ prestador e do emissor fiscal utilizado por ele.

## 2. Asaas — domínio fiscal

Antes de emitir NFS-e, o Asaas exige configuração fiscal da conta, incluindo dados da empresa e requisitos da prefeitura. A API disponibiliza consulta das exigências municipais e configuração fiscal. citehttps://docs.asaas.com/reference/criar-e-atualizar-informacoes-fiscaishttps://docs.asaas.com/docs/configurar-informacoes-fiscais

O serviço municipal deve ser configurado por município/atividade. Quando a prefeitura disponibiliza `municipalServiceId`, ele é preferível; em cenários como Portal Nacional, pode ser necessário informar `municipalServiceCode`. citehttps://docs.asaas.com/reference/agendar-nota-fiscal

As regras fiscais devem permanecer configuráveis. Não colocar alíquotas ou regime tributário fixos no código.

Em 30/06/2026 entrou em vigor no Asaas a NT-007 para clientes do Regime Normal em cenários aplicáveis de NFS-e; Simples Nacional não é afetado por essa mudança de payload. citehttps://docs.asaas.com/changelog/novas-regras-de-piscofins-na-emiss%C3%A3o-de-nfs-e-via-api

## 3. Webhooks fiscais Asaas

O ciclo fiscal deve ser assíncrono e idempotente.

Eventos relevantes:

- `INVOICE_CREATED`
- `INVOICE_UPDATED`
- `INVOICE_SYNCHRONIZED`
- `INVOICE_AUTHORIZED`
- `INVOICE_PROCESSING_CANCELLATION`
- `INVOICE_CANCELED`
- `INVOICE_CANCELLATION_DENIED`
- `INVOICE_ERROR`

A Asaas usa entrega `at least once`; a aplicação deve deduplicar pelo `event.id`, validar `asaas-access-token` e não depender da ordem dos eventos. citehttps://docs.asaas.com/docs/webhook-para-notas-fiscais

## 4. Mercado Pago

Mercado Pago será utilizado no Seu Zélla como provedor de pagamentos/assinaturas/reembolsos/relatórios conforme o domínio necessário. A API oficial documenta pagamentos, assinaturas, reembolsos, relatórios e OAuth. citehttps://www.mercadopago.com.br/developers/pt/reference

Webhooks são o mecanismo recomendado para atualizações; a autenticidade deve ser validada por `x-signature`, usando o `secret` da aplicação. O identificador do evento/pagamento deve alimentar a idempotência interna. citehttps://www.mercadopago.com.br/developers/pt/docs/checkout-api-orders/notifications

A documentação pública consultada não apresenta uma API NFS-e equivalente à do Asaas na referência principal. O Mercado Pago possui emissão fiscal no Sistema de Gestão, com configuração do emissor e certificado; portanto o Seu Zélla não deve assumir que o token de pagamentos do Mercado Pago permite emitir NFS-e automaticamente. citehttps://www.mercadopago.com.br/developers/pt/referencehttps://www.mercadopago.com.br/blog/emitir-notas-fiscais-sistema-gestao

## 5. WhatsApp Cloud API

O client oficial deve operar exclusivamente no servidor usando:

- `META_ACCESS_TOKEN`
- `META_PHONE_NUMBER_ID`
- `META_WABA_ID`
- `META_VERIFY_TOKEN`
- `META_APP_SECRET`
- `META_GRAPH_API_VERSION`

A Cloud API utiliza `POST /{Phone-Number-ID}/messages` para envio de texto, mídia e templates. Templates precisam existir/aprovados no WhatsApp Manager ou Business Manager. Mensagens retornam um `wamid` que deve ser armazenado para rastreabilidade e status via webhook. citehttps://www.postman.com/meta/whatsapp-business-platform/documentation/wlk6lh4/whatsapp-cloud-api

## 6. UX do dono da pousada/anfitrião

O usuário não escolhe banco ou API. Ele vê ações de negócio:

- **Emitir nota para hóspede**
- **Nota emitida**
- **Acompanhar emissão**
- **Baixar PDF/XML**
- **Cancelar nota** (quando permitido)
- **Configurar emissão automática**
- **Solicitar documento fiscal para o Seu Zélla**
- **Enviar documento fiscal recebido**
- **Conciliar documento com repasse**

O provider aparece somente em uma área técnica do ZCC, para diagnóstico e configuração.

## 7. Regras de segurança

- Nenhum access token fica no client.
- Nenhum documento fiscal fica exposto por URL pública previsível.
- Todo documento é tenant-scoped.
- Webhooks são verificados e idempotentes.
- Eventos fiscais são auditáveis.
- Status fiscal é separado do status de pagamento.
- Emissão automática só pode ser ativada depois de validação da configuração fiscal e serviço municipal.

## 8. Aceite operacional

### NFS-e para hóspede

`Pagamento aprovado → cobrança encontrada → NFS-e agendada → webhook recebido → AUTHORIZED → PDF/XML disponível → hóspede notificado`.

### Documento pousada → Seu Zélla

`Solicitação → documento emitido pelo fornecedor → documento recebido → validação → conciliação com repasse → arquivo auditável`.

### WhatsApp

`Webhook verificado → evento idempotente → fila → agente → resposta → wamid → status de entrega`.
