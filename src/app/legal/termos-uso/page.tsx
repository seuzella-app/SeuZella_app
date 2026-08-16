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
              Oferecemos 4 planos de assinatura mensal:
            </p>
            <ul className="list-disc pl-6 space-y-1">
              <li><strong>LITE</strong> — R$ 197/mês: 50 hóspedes/mês, 500 mensagens, IA limitada</li>
              <li><strong>PRO</strong> — R$ 397/mês: Ilimitado, OAuth Airbnb, precificação dinâmica</li>
              <li><strong>MAX</strong> — R$ 797/mês: Tudo de PRO + monitoramento de concorrentes + multi-propriedades</li>
              <li><strong>PARCEIRO</strong> — R$ 247/mês: PRO + gamificação de indicações</li>
            </ul>
            <p className="mt-2">
              Os pagamentos são processados via PIX (Mercado Pago) ou cartão de crédito (Stripe).
              A cobrança é mensal e recorrente. Cancelamento pode ser feito a qualquer momento
              com efeito no final do ciclo atual.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-emerald-400 mb-2">3. IA e Atendimento via WhatsApp</h2>
            <p className="mb-2">
              O Seu Zélla utiliza inteligência artificial (GLM 5.2 via Z.ai API) para atender
              hóspedes via WhatsApp de forma automatizada. A IA:
            </p>
            <ul className="list-disc pl-6 space-y-1">
              <li>Responde mensagens em português brasileiro 24/7</li>
              <li>Calcula preços dinâmicos baseados em ocupação e demanda (Yield Management)</li>
              <li>Processa reservas e envia chaves PIX para pagamento</li>
              <li>Envia códigos de fechadura eletrônica automaticamente após confirmação de pagamento</li>
              <li>Aprende com cada interação para melhorar o atendimento (Delirium Zero)</li>
            </ul>
            <p className="mt-2">
              A IA NUNCA substitui inteiramente o atendimento humano. Em casos de conflito,
              cancelamento, ou quando o hóspede solicita expressamente, a conversa é escalada
              para o dono da pousada.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-emerald-400 mb-2">4. Fechaduras Eletrônicas</h2>
            <p className="mb-2">
              O Seu Zélla integra com 10 marcas de fechadura eletrônica (5 com API oficial:
              TTLock, Tuya, Igloohome, Nuki, August; e 5 em modo manual: Intelbras, Yale,
              Papaiz, Philco, Samsung). Recursos de segurança:
            </p>
            <ul className="list-disc pl-6 space-y-1">
              <li>PINs gerados com CSPRNG (crypto.randomInt) — nunca Math.random</li>
              <li>Tokens OAuth criptografados com AES-256-GCM</li>
              <li>Auditoria completa LGPD: quem abriu, quando, com qual PIN</li>
              <li>Isolamento multi-tenant: uma pousada não vê PINs de outra</li>
              <li>Panic Revoke: revogação de todos os PINs em 1 clique</li>
              <li>Cron de manutenção a cada 15 minutos (revoga PINs expirados)</li>
              <li>FNRH Digital: PIN gerado automaticamente após cadastro completo do hóspede</li>
              <li>Caução PIX: acesso revogado se caução for retida</li>
              <li>Serviços extras: check-in antecipado e check-out estendido estendem PIN automaticamente</li>
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
