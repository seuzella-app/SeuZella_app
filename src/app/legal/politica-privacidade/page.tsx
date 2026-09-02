import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Política de Privacidade — Seu Zélla',
  description: 'Política de privacidade do Seu Zélla em conformidade com a LGPD (Lei 13.709/2018).',
};

export default function PrivacyPolicyPage() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-12 prose prose-lg">
      <h1>Política de Privacidade</h1>
      <p className="text-sm text-gray-500">Última atualização: Setembro de 2026</p>

      <h2>1. Introdução</h2>
      <p>
        O Seu Zélla ("nós", "nosso") opera uma plataforma de gestão hoteleira inteligente.
        Esta política descreve como coletamos, usamos, armazenamos e protegemos dados pessoais
        em conformidade com a Lei Geral de Proteção de Dados (LGPD — Lei 13.709/2018).
      </p>

      <h2>2. Dados Coletados</h2>
      <h3>2.1. Dados de Hóspedes</h3>
      <ul>
        <li>Nome completo (necessário para FNRH)</li>
        <li>Documento de identificação (CPF/RG/passaporte)</li>
        <li>Telefone/WhatsApp (para comunicação de reservas)</li>
        <li>E-mail (para confirmações e comunicações)</li>
        <li>Datas de check-in/check-out</li>
      </ul>
      <h3>2.2. Dados de Pousadeiros/Anfitriões</h3>
      <ul>
        <li>Nome, e-mail, telefone (cadastro de conta)</li>
        <li>CNPJ/CPF (faturamento)</li>
        <li>Dados de pagamento (processados por gateways terceiros)</li>
      </ul>

      <h2>3. Base Legal e Finalidade</h2>
      <ul>
        <li><strong>Execução de contrato</strong> (art. 7º, V): gestão de reservas e hospedagem</li>
        <li><strong>Obrigação legal</strong> (art. 7º, II): registro hoteleiro (FNRH), fiscal/tax</li>
        <li><strong>Legítimo interesse</strong> (art. 7º, IX): segurança, qualidade de serviço, IA</li>
        <li><strong>Consentimento</strong> (art. 7º, I): marketing, comunicações opcionais</li>
      </ul>

      <h2>4. Retenção de Dados</h2>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b">
            <th className="text-left py-2">Categoria</th>
            <th className="text-left py-2">Período</th>
            <th className="text-left py-2">Ação ao expirar</th>
          </tr>
        </thead>
        <tbody>
          <tr className="border-b"><td>Logs de conversa (WhatsApp)</td><td>180 dias</td><td>Exclusão</td></tr>
          <tr className="border-b"><td>FNRH (registro hoteleiro)</td><td>5 anos</td><td>Anonimização</td></tr>
          <tr className="border-b"><td>Transações de pagamento</td><td>7 anos</td><td>Anonimização</td></tr>
          <tr className="border-b"><td>Registros de consentimento</td><td>5 anos</td><td>Exclusão</td></tr>
          <tr className="border-b"><td>Logs de auditoria</td><td>365 dias</td><td>Exclusão</td></tr>
          <tr><td>Dados de conta excluída</td><td>90 dias</td><td>Exclusão</td></tr>
        </tbody>
      </table>

      <h2>5. Direitos do Titular (art. 18)</h2>
      <ul>
        <li>Confirmação de tratamento</li>
        <li>Acesso aos dados</li>
        <li>Correção de dados incompletos/inexatos</li>
        <li>Anonimização, bloqueio ou eliminação</li>
        <li>Portabilidade dos dados</li>
        <li>Eliminação de dados pessoais tratados com consentimento</li>
        <li>Informação sobre compartilhamento</li>
      </ul>
      <p>Para exercer seus direitos, contate: <a href="mailto:dpo@seuzella.com">dpo@seuzella.com</a></p>

      <h2>6. Segurança</h2>
      <p>
        Implementamos criptografia AES-256-GCM para dados sensíveis, TLS 1.2+ para
        comunicação, backups criptografados com retenção de 30 dias, e controle
        de acesso baseado em tenant (multi-tenancy com isolamento de dados).
      </p>

      <h2>7. Compartilhamento</h2>
      <p>Não compartilhamos dados pessoais com terceiros, exceto:</p>
      <ul>
        <li>Gateways de pagamento (Asaas, Mercado Pago) — para processar pagamentos</li>
        <li>WhatsApp Cloud API (Meta) — para comunicação de reservas</li>
        <li>Autoridades legais quando obrigatório por lei</li>
      </ul>

      <h2>8. Contato do Encarregado (DPO)</h2>
      <p>E-mail: <a href="mailto:dpo@seuzella.com">dpo@seuzella.com</a></p>
    </div>
  );
}
