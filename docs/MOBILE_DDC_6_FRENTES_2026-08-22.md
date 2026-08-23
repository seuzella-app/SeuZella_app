# DDC Mobile — ciclo de 6 frentes

## Objetivo
Consolidar o DDC Mobile Pousada e Anfitrião em uma única arquitetura operacional, com identidade de tenant derivada no servidor, estado live compartilhado, PWA canônico e contratos automatizados contra regressões.

## Frentes concluídas neste ciclo
1. Entrada canônica `/mobile` desacoplada do nicho.
2. Boundary único `MobileDDCDataBoundary` usando `MobileDDCLiveProvider`.
3. Resumo operacional derivado de reservas do estado live.
4. Contratos PWA v2: Service Worker, offline, push e notification click.
5. Paridade de estado entre Pousada e Airbnb.
6. Proteção contratual contra tenantId controlado pelo cliente.

## Pendências que permanecem explicitamente fora deste ciclo
- Ícones finais do produto: aguardando os arquivos oficiais do símbolo “Zé”.
- Hardware físico: exige dispositivos reais e credenciais de homologação.
- E2E browser real: exige execução em ambiente com navegador/CI.
- Vercel: exige confirmação do deployment após os commits.
- Push de produção: exige VAPID/credenciais e teste em dispositivo real.

## Regra de segurança
Nenhum tenantId deve ser aceito como autoridade a partir de query string, localStorage ou payload de UI. A identidade operacional deve ser resolvida a partir da sessão/autorização server-side.
