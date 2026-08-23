'use client';

import { Shield, Lock, FileText, CreditCard } from 'lucide-react';
import { useState } from 'react';

export default function TermosUsoPage() {
  return (
    <div className="min-h-screen bg-[#0a0a0f] text-zinc-200">
      <div className="max-w-3xl mx-auto px-4 py-12">
        <div className="flex items-center gap-3 mb-8">
          <FileText className="w-8 h-8 text-emerald-400" />
          <h1 className="text-3xl font-bold text-white">Termos de Uso</h1>
        </div>

        <p className="text-sm text-zinc-500 mb-8">Última atualização: 15 de agosto de 2026</p>

        <div className="space-y-6 text-sm leading-relaxed">
          <section>
            <h2 className="text-lg font-bold text-emerald-400 mb-2">1. Sobre o Seu Zélla</h2>
            <p className="mb-2">
              O Seu Zélla (seuzella.com) é uma plataforma SaaS (Software as a Service) que fornece
              assistência inteligente via WhatsApp para pousadas e imóveis Airbnb em todo o Brasil.
              Nossa IA atende hóspedes 24 horas por dia, gerencia reservas, calcula preços dinâmicos
              (Yield Management), processa pagamentos via PIX, e integra com fechaduras eletrônicas.
            </p>
            <p>
              Ao utilizar nossos serviços, você concorda com estes Termos de Uso. Se não concordar,
              não utilize a plataforma.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-emerald-400 mb-2">2. Planos e Cobrança</h2>
            <p className="mb-2">
              Oferecemos planos modulares com cobrança em moeda nacional (BRL) processada exclusivamente
              via PIX e Cartão de Crédito através de instituições autorizadas pelo Banco Central (Asaas v3 e Mercado Pago):
            </p>
            <ul className="list-disc pl-6 space-y-1">
              <li><strong>LITE</strong> — R$ 197/mês: 50 hóspedes/mês, 500 mensagens, IA com suporte essencial</li>
              <li><strong>PRO</strong> — R$ 397/mês: Ilimitado, OAuth Airbnb, precificação dinâmica e fechaduras inteligentes</li>
              <li><strong>MAX</strong> — R$ 797/mês: Tudo de PRO + monitoramento de concorrentes + multi-propriedades</li>
              <li><strong>PARCEIRO</strong> — R$ 247/mês: PRO + programa de indicação e amortização</li>
            </ul>
            <p className="mt-2">
              A cobrança é mensal e recorrente com faturamento sob regime do Simples Nacional (Anexo III - 6%).
              O cancelamento pode ser solicitado a qualquer momento diretamente pelo painel.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-emerald-400 mb-2">3. IA e Atendimento via WhatsApp</h2>
            <p className="mb-2">
              O Seu Zélla utiliza inteligência artificial e motor cognitivo multimodelo para atender
              hóspedes via WhatsApp de forma automatizada. A IA:
            </p>
            <ul className="list-disc pl-6 space-y-1">
              <li>Responde mensagens em português brasileiro 24/7 com concisão e empatia</li>
              <li>Calcula preços dinâmicos baseados em ocupação e demanda (Yield Management)</li>
              <li>Processa reservas e gera cobranças instantâneas via PIX 1-clique</li>
              <li>Despacha códigos de fechadura eletrônica automaticamente após confirmação de pagamento</li>
              <li>Aprende continuamente com as preferências de cada pousada respeitando o isolamento LGPD</li>
            </ul>
            <p className="mt-2">
              A IA trabalha em cooperação com o atendimento humano. O contratante pode, a qualquer
              momento, utilizar a função <strong>"Assumir Chat"</strong> para responder diretamente
              ao hóspede pelo seu aplicativo do WhatsApp.
            </p>
            <p className="mt-2 bg-emerald-500/10 border border-emerald-500/20 p-3 rounded-xl text-xs text-emerald-200">
              <strong>Cláusula de Intervenção Humana:</strong> A opção do contratante de assumir
              temporária ou permanentemente qualquer conversa não retira, atenua ou modifica o direito
              de recebimento integral da mensalidade contratada e eventuais taxas de serviço ou UPSELL do
              Seu Zélla, visto que a infraestrutura, sincronização de calendários, fechaduras, registros
              e histórico contextual permanecem integralmente operantes. O retorno ao atendimento automatizado
              ocorre imediatamente ao clicar em <em>"Zélla assume"</em>.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-emerald-400 mb-2">4. Governança Física de Fechaduras Eletrônicas (Smart Locks)</h2>
            <p className="mb-2">
              O Seu Zélla integra centralizadamente com as 10 principais fabricantes do mercado:
              <strong> TTLock, Tuya, Igloohome, Nuki, August, Intelbras, Yale, Papaiz, Philco e Samsung</strong>.
              A governança de acesso físico segue protocolos de segurança estritos (*Zero Trust*):
            </p>
            <ul className="list-disc pl-6 space-y-1">
              <li><strong>Política Fail-Closed:</strong> Falhas de comunicação com APIs de fabricantes nunca geram PINs locais simulados. Se o hardware não confirmar a gravação do código, o acesso físico é bloqueado e o host notificado imediatamente.</li>
              <li><strong>Pareamento em Estágios (Staged Pairing):</strong> Dispositivos podem ser pré-cadastrados antes do pareamento físico, mas permanecem estritamente bloqueados para comandos de abertura até a conclusão do vínculo de hardware (`externalDeviceId`).</li>
              <li><strong>Autorização Condicional:</strong> A emissão de códigos depende cumulativamente de reserva válida, pagamento compensado, janela temporal exata (check-in/check-out) e máquina de estados consistente.</li>
              <li><strong>OAuth State com Nonce:</strong> O fluxo de autorização de fabricantes é protegido por estado criptográfico com `tenantId + provider + timestamp + nonce` com expiração de 10 minutos contra ataques CSRF e BOLA/IDOR.</li>
              <li><strong>Comandos por Voz Alexa:</strong> Abertura via Alexa Smart Home Skill API exige autenticação OAuth2 e validação de PIN de voz de 4 dígitos.</li>
              <li><strong>Auditoria e Revogação:</strong> Rastreamento completo de aberturas, expurgo automático de PINs expirados a cada 15 minutos e botão de <em>Panic Revoke</em> para revogação em 1 clique.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-bold text-emerald-400 mb-2">5. Precificação Dinâmica (Yield Management)</h2>
            <p>
              O Seu Zélla ajusta automaticamente as diárias baseado em:
              ocupação atual (50%+ surge, 80%+ scarcity), feriados brasileiros
              (Réveillon, Natal, Carnaval, Corpus Christi), e dias até o evento.
              O lucro extra gerado é registrado e exibido no Dashboard do Cliente (DDC).
              Na Fase 1 (temporada 2026/2027), o recurso é gratuito. Na Fase 2
              (temporada 2027/2028), pode ser aplicada taxa de sucesso (ZÉLLA BOOST).
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-emerald-400 mb-2">6. Cérebro Zélla — Auditoria Noturna</h2>
            <p className="mb-2">
              O sistema executa automaticamente, durante a madrugada (03:00 BRT):
            </p>
            <ul className="list-disc pl-6 space-y-1">
              <li>Varredura de código (SAST) com 133 patterns de vulnerabilidade</li>
              <li>Pentest de API routes (rotas sem proteção, BOLA/IDOR, SQL injection)</li>
              <li>Verificação de dependências (npm audit)</li>
              <li>Coleta de métricas (leads, conversões, cliques, regiões)</li>
              <li>Análise de atividade suspeita em landing page, DDC, Link-in-Bio e Zélla Parceiros</li>
              <li>Relatório executivo gerado pelo GLM 5.2 em PT-BR</li>
              <li>Pulsos de vida a cada 30 minutos (health check + mini-scan + métricas)</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-bold text-emerald-400 mb-2">7. Otimizações de Inferência</h2>
            <p>
              Para reduzir custos operacionais e melhorar performance, o Seu Zélla aplica
              4 otimizações: Deferred Tool Discovery (-50% tokens), Prompt Caching (-80%
              reprocessamento), Tool Output Cap (máximo 250 tokens por ferramenta),
              e Tier Distribution 80/15/5 (80% das mensagens em modelo Flash, 15% Full, 5% Reasoning).
              Redução total: 73,5% no custo de IA.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-emerald-400 mb-2">8. Segurança (SecLists)</h2>
            <p>
              O sistema integra 11.616 regras de segurança do projeto SecLists (MIT License):
              1.403 prompts de jailbreak, 119 patterns SAST, 94 funções maliciosas,
              10.000 senhas comuns, e 200 payloads de command injection. A defesa é
              automática e silenciosa.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-emerald-400 mb-2">9. TensorFlow Integration</h2>
            <p>
              O sistema possui 8 modelos neurais TensorFlow prontos para ativação:
              classificação de intenção, predição de churn, scoring de leads, detecção
              de anomalias, previsão de ocupação (LSTM), análise de sentimento,
              otimização de preço, e recomendação de serviços extras. Modelos são
              ativados individualmente via feature flags (USE_TF_INTENT, USE_TF_CHURN, etc.).
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-emerald-400 mb-2">10. Limitação de Responsabilidade</h2>
            <p>
              O Seu Zélla não se responsabiliza por: decisões de preço tomadas pela IA
              (o dono da pousada pode override qualquer preço), falhas de provedores
              terceiros (WhatsApp Cloud API, Airbnb, TTLock, Tuya, etc.), ou perdas
              decorrentes de indisponibilidade temporária do serviço. O orçamento de IA
              é limitado a $20 USD/mês por pousada (BudgetGuard).
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-emerald-400 mb-2">11. Cancelamento</h2>
            <p>
              Você pode cancelar a qualquer momento pelo Dashboard do Cliente (DDC).
              O cancelamento entra em vigor no final do ciclo de cobrança atual.
              Não há reembolso proporcional, mas você mantém acesso até o final
              do período pago.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-emerald-400 mb-2">12. Contato</h2>
            <p>
              Em caso de dúvidas sobre estes Termos de Uso, entre em contato via
              WhatsApp: [número a ser definido] ou email: contato@seuzella.com
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
