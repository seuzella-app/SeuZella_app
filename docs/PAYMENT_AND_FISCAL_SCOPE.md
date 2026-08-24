# Seu Zélla — Escopo Oficial de Pagamentos e Fiscal

## Pagamentos

**Somente:**
- Asaas
- Mercado Pago
- Mock (testes automatizados)

## Fora do escopo

- Stripe não é gateway do produto e não deve aparecer em runtime, environment contract, factories, E2E, readiness ou documentação operacional de integração.

## Fiscal

- Asaas: provider fiscal inicial para NFS-e via API.
- Mercado Pago: provider de pagamentos/assinaturas/financeiro. Não assumir NFS-e via API sem capacidade oficialmente documentada.
- Zélla: orquestra, concilia, armazena referências e apresenta UX de negócio.
- O CNPJ emissor continua sendo o prestador/empresa fiscalmente responsável.

## WhatsApp

Meta WhatsApp Business Cloud API é o canal oficial de mensageria integrado ao domínio de hospedagem. Credenciais ficam server-side e mensagens são rastreadas por `wamid`.
