'use client';

import { CreditCard } from 'lucide-react';

export default function PoliticaCobrancaPage() {
  return (
    <div className="min-h-screen bg-[#0a0a0f] text-zinc-200">
      <div className="max-w-3xl mx-auto px-4 py-12">
        <div className="flex items-center gap-3 mb-8">
          <CreditCard className="w-8 h-8 text-emerald-400" />
          <h1 className="text-3xl font-bold text-white">Política de Cobrança</h1>
        </div>

        <p className="text-sm text-zinc-500 mb-8">Última atualização: 15 de agosto de 2026</p>

        <div className="space-y-6 text-sm leading-relaxed">
          <section>
            <h2 className="text-lg font-bold text-emerald-400 mb-2">1. Formas de Pagamento</h2>
            <ul className="list-disc pl-6 space-y-1">
              <li><strong>PIX:</strong> via Mercado Pago (processamento automático)</li>
              <li><strong>Cartão de crédito:</strong> via Payment Gateway (Visa, Mastercard, Elo, Amex)</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-bold text-emerald-400 mb-2">2. Ciclo de Cobrança</h2>
            <p>
              A cobrança é mensal e recorrente. A primeira cobrança ocorre no momento
              da assinatura. As subsequentes ocorrem no mesmo dia de cada mês.
              Se o dia não existir (ex: dia 31 em fevereiro), cobra no último dia do mês.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-emerald-400 mb-2">3. Planos</h2>
            <ul className="list-disc pl-6 space-y-1">
              <li><strong>LITE:</strong> R$ 197/mês — 50 hóspedes, 500 mensagens</li>
              <li><strong>PRO:</strong> R$ 397/mês — ilimitado, OAuth Airbnb, yield engine</li>
              <li><strong>MAX:</strong> R$ 797/mês — tudo de PRO + multi-propriedades</li>
              <li><strong>PARCEIRO:</strong> R$ 247/mês — PRO + indicações</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-bold text-emerald-400 mb-2">4. Depósito PIX (Hóspedes)</h2>
            <p>
              Para reservas confirmadas, o sistema pode solicitar uma depósito PIX ao hóspede
              (valor definido pelo pousadeiro, padrão R$ 500). A depósito funciona como
              garantia contra danos. O estorno é automático 24 horas após o check-out,
              caso não haja retenção por parte do pousadeiro.
            </p>
            <p className="mt-2">
              Se a depósito for retida, o PIN da fechadura é revogado imediatamente
              (integração onDepositStatusChange).
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-emerald-400 mb-2">5. Serviços Extras (Upsell)</h2>
            <ul className="list-disc pl-6 space-y-1">
              <li><strong>Check-in Antecipado:</strong> R$ 50 (estende PIN +3 horas antes)</li>
              <li><strong>Check-out Estendido:</strong> R$ 50 (estende PIN +4 horas depois)</li>
              <li><strong>Pet:</strong> R$ 80 (hospedagem com animal de estimação)</li>
            </ul>
            <p className="mt-2">
              Pagos via PIX pelo hóspede. O PIN da fechadura é automaticamente
              revogado e recriado com a nova validade.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-emerald-400 mb-2">6. Yield Booster (Fase 2)</h2>
            <p>
              Na Fase 2 (temporada 2027/2028), pode ser aplicada taxa de sucesso (ZÉLLA BOOST)
              de 10-12% sobre o lucro extra gerado pela precificação dinâmica. Na Fase 1
              (temporada 2026/2027), o recurso é 100% gratuito.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-emerald-400 mb-2">7. Cancelamento e Reembolso</h2>
            <p>
              Cancelamento pode ser feito a qualquer momento pelo DDC com efeito no final
              do ciclo atual. Não há reembolso proporcional, mas o acesso é mantido até
              o fim do período pago. Não há trial gratuito.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-emerald-400 mb-2">8. Inadimplência</h2>
            <p>
              Após 3 dias sem pagamento, o plano é suspenso (atendimento WhatsApp pausado).
              Após 7 dias, a conta é arquivada (dados preservados por 90 dias para reativação).
              Após 90 dias sem reativação, os dados são anonimizados conforme LGPD.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-emerald-400 mb-2">9. Contato</h2>
            <p>
              Para questões de cobrança: cobranca@seuzella.com
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
