'use client';

import { Shield, Lock, FileText } from 'lucide-react';

export default function PoliticaPrivacidadePage() {
  return (
    <div className="min-h-screen bg-[#0a0a0f] text-zinc-200">
      <div className="max-w-3xl mx-auto px-4 py-12">
        <div className="flex items-center gap-3 mb-8">
          <Lock className="w-8 h-8 text-emerald-400" />
          <h1 className="text-3xl font-bold text-white">Política de Privacidade</h1>
        </div>

        <p className="text-sm text-zinc-500 mb-8">Última atualização: 15 de agosto de 2026</p>

        <div className="space-y-6 text-sm leading-relaxed">
          <section>
            <h2 className="text-lg font-bold text-emerald-400 mb-2">1. Sobre esta Política</h2>
            <p>
              Esta Política de Privacidade descreve como o Seu Zélla (seuzella.com) coleta,
              usa, armazena e protege dados pessoais em conformidade com a Lei Geral de
              Proteção de Dados (Lei 13.709/2018 — LGPD).
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-emerald-400 mb-2">2. Dados Coletados</h2>
            <p className="mb-2"><strong>Dados do Pousadeiro (Titular da Conta):</strong></p>
            <ul className="list-disc pl-6 space-y-1">
              <li>Nome, email, telefone, CPF/CNPJ</li>
              <li>Endereço da pousada (convertido em lat/lng para mapa)</li>
              <li>Chave PIX (para receber pagamentos de hóspedes)</li>
              <li>Credenciais OAuth de fechaduras eletrônicas (criptografadas AES-256-GCM)</li>
              <li>Histórico de uso (mensagens enviadas, reservas criadas, custos IA)</li>
            </ul>
            <p className="mt-2 mb-2"><strong>Dados do Hóspede (via WhatsApp):</strong></p>
            <ul className="list-disc pl-6 space-y-1">
              <li>Nome, telefone, CPF/RG (para FNRH Digital — Ficha Nacional de Registro de Hóspedes)</li>
              <li>Histórico de conversa com a IA (mensagens enviadas e recebidas)</li>
              <li>Dados de reserva (datas, valor, quarto, forma de pagamento)</li>
              <li>Depósito PIX (valor depositado, status, estorno)</li>
              <li>Código de fechadura eletrônica (PIN gerado, validade, uso)</li>
            </ul>
            <p className="mt-2 mb-2"><strong>Dados de Visitantes da Landing Page:</strong></p>
            <ul className="list-disc pl-6 space-y-1">
              <li>User-Agent, viewport, rota acessada (analytics — sem cookies persistentes)</li>
              <li>DevicePing: deviceId efêmero (sessionStorage, destruído ao fechar aba)</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-bold text-emerald-400 mb-2">3. Base Legal (Art. 7º LGPD)</h2>
            <ul className="list-disc pl-6 space-y-1">
              <li><strong>Consentimento:</strong> hóspede consente ao iniciar conversa via WhatsApp</li>
              <li><strong>Execução de contrato:</strong> reserva = contrato de hospedagem</li>
              <li><strong>Obrigação legal:</strong> FNRH é obrigatória pela ANTT (Lei 11.726/2008)</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-bold text-emerald-400 mb-2">4. Finalidade do Tratamento</h2>
            <ul className="list-disc pl-6 space-y-1">
              <li>Atendimento automatizado de hóspedes via WhatsApp (IA 24/7)</li>
              <li>Gestão de reservas e pagamentos via PIX</li>
              <li>Geração e revogação de PINs de fechadura eletrônica</li>
              <li>Precificação dinâmica (Yield Management)</li>
              <li>Auditoria de segurança noturna (SAST + pentest + métricas)</li>
              <li>Análise de sentimento e prevenção de churn</li>
              <li>Cumprimento de obrigações legais (FNRH, LGPD)</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-bold text-emerald-400 mb-2">5. Minimização de Dados</h2>
            <p>
              Coletamos apenas o necessário: para reservar um quarto, precisamos de nome,
              documento e datas. Não coletamos religião, opinião política, orientação sexual,
              ou outros dados sensíveis sem base legal específica.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-emerald-400 mb-2">6. Segurança dos Dados (Art. 46 LGPD)</h2>
            <ul className="list-disc pl-6 space-y-1">
              <li><strong>Isolamento multi-tenant:</strong> pousada A não acessa dados da pousada B (RLS Prisma)</li>
              <li><strong>Criptografia em repouso:</strong> tokens OAuth de fechaduras em AES-256-GCM</li>
              <li><strong>Criptografia em trânsito:</strong> HTTPS/TLS 1.3 em todas as rotas</li>
              <li><strong>Auth 6 camadas ZCC:</strong> rate limit, master key, godmode, NextAuth JWT, silent reject</li>
              <li><strong>SAST noturno:</strong> 133 patterns de código perigoso verificados diariamente</li>
              <li><strong>SecLists:</strong> 1.403 prompts de jailbreak bloqueados + 10.000 senhas comuns rejeitadas</li>
              <li><strong>Prompt hashing:</strong> prompts LLM armazenados como hash SHA-256 (não texto bruto)</li>
              <li><strong>BudgetGuard:</strong> limite de $20 USD/mês por pousada em chamadas IA</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-bold text-emerald-400 mb-2">7. Retenção de Dados</h2>
            <ul className="list-disc pl-6 space-y-1">
              <li><strong>Hóspede (FNRH):</strong> 5 anos (obrigação ANTT)</li>
              <li><strong>Conversas WhatsApp:</strong> 1 ano após check-out</li>
              <li><strong>Lead não convertido:</strong> 1 ano</li>
              <li><strong>Tenant cancelado:</strong> 90 dias para exportar/delete</li>
              <li><strong>Logs de auditoria LGPD (LockEvent):</strong> 5 anos</li>
              <li><strong>PINs de fechadura:</strong> revogados ao expirar, mantidos no log por 5 anos</li>
              <li><strong>Depósito PIX:</strong> registros mantidos por 5 anos (obrigação fiscal)</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-bold text-emerald-400 mb-2">8. Direitos do Titular (Art. 18 LGPD)</h2>
            <p>Você tem direito a:</p>
            <ul className="list-disc pl-6 space-y-1">
              <li><strong>Acesso:</strong> solicitar cópia dos seus dados</li>
              <li><strong>Retificação:</strong> corrigir dados incorretos</li>
              <li><strong>Anonimização:</strong> remover identificação pessoal</li>
              <li><strong>Portabilidade:</strong> exportar dados em formato estruturado</li>
              <li><strong>Eliminação:</strong> solicitar exclusão (exceto dados com obrigação legal)</li>
              <li><strong>Esquecimento:</strong> endpoint /api/lgpd/forget-guest para hóspedes</li>
            </ul>
            <p className="mt-2">
              Para exercer seus direitos, envie email para: lgpd@seuzella.com
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-emerald-400 mb-2">9. Compartilhamento de Dados</h2>
            <p className="mb-2">Nós NÃO vendemos seus dados. Compartilhamos apenas com:</p>
            <ul className="list-disc pl-6 space-y-1">
              <li><strong>WhatsApp Cloud API (Meta):</strong> mensagens dos hóspedes</li>
              <li><strong>Z.ai (GLM 5.2):</strong> processamento de IA (apenas prompt + contexto, sem dados pessoais sensíveis)</li>
              <li><strong>Mercado Pago / Payment Gateway:</strong> processamento de pagamentos</li>
              <li><strong>Provedores de fechadura (TTLock, Tuya, etc.):</strong> apenas PIN e deviceId</li>
              <li><strong>Autoridades:</strong> quando exigido por ordem judicial</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-bold text-emerald-400 mb-2">10. Transferência Internacional</h2>
            <p>
              Alguns provedores (Meta, Z.ai, Google) processam dados fora do Brasil.
              Garantimos que esses provedores possuem salvaguardas adequadas conforme
              o Art. 33 da LGPD.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-emerald-400 mb-2">11. Cérebro Zélla — Delirium Zero</h2>
            <p>
              A IA do Seu Zélla utiliza um sistema de "Delirium Zero" que injeta apenas
              fatos validados (com confidence e fonte citada) no prompt do LLM. A IA NUNCA
              inventa dados — se não sabe, diz "não tenho dados suficientes". Fatos são
              extraídos do relatório noturno e persistidos em CerebroKnowledgeFact.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-emerald-400 mb-2">12. Alterações desta Política</h2>
            <p>
              Podemos atualizar esta Política a qualquer momento. Notificaremos os usuários
              por email com 30 dias de antecedência para mudanças significativas.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-emerald-400 mb-2">13. Contato do Encarregado (DPO)</h2>
            <p>
              Para questões de privacidade e LGPD:<br/>
              Email: lgpd@seuzella.com<br/>
              Assunto: "LGPD — Solicitação"
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
