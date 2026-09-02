import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Termos do Programa Beta — Seu Zélla',
  description: 'Termos e condições para participação no programa beta fechado do Seu Zélla.',
};

export default function BetaTermsPage() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-12 prose prose-lg">
      <h1>Termos do Programa Beta — Seu Zélla</h1>
      <p className="text-sm text-gray-500">Última atualização: Setembro de 2026</p>

      <h2>1. Natureza do Programa</h2>
      <p>
        O Programa Beta do Seu Zélla é uma fase de testes controlados com pousadas
        piloto reais. O objetivo é validar a plataforma em ambiente de produção
        antes do Go-Live oficial.
      </p>

      <h2>2. Pousadas Piloto</h2>
      <p>As seguintes pousadas participam do programa beta fechado:</p>
      <ul>
        <li><strong>Pousada Mar Azul</strong> — pousada piloto #1</li>
        <li><strong>Pousada Encanto da Serra</strong> — pousada piloto #2</li>
        <li><strong>Pousada Sol & Mar</strong> — pousada piloto #3</li>
      </ul>

      <h2>3. Duração</h2>
      <p>
        O programa beta tem duração prevista de 30 dias, podendo ser estendido
        ou encerrado antecipadamente pelo Seu Zélla ou pela pousada participante.
      </p>

      <h2>4. Responsabilidades da Pousada</h2>
      <ul>
        <li>Utilizar a plataforma para gestão real de reservas</li>
        <li>Reportar bugs e feedback estruturado</li>
        <li>Manter dados de hóspedes atualizados e precisos</li>
        <li>Respeitar a LGPD no tratamento de dados de hóspedes</li>
      </ul>

      <h2>5. Responsabilidades do Seu Zélla</h2>
      <ul>
        <li>Manter a plataforma disponível (SLA: 99% em beta)</li>
        <li>Corrigir bugs reportados em prazo razoável</li>
        <li>Garantir backup diário criptografado dos dados</li>
        <li>Não utilizar dados de hóspedes para fins não autorizados</li>
        <li>Respeitar a LGPD em todas as operações</li>
      </ul>

      <h2>6. Custos</h2>
      <p>
        Durante o período beta, a pousada participante não paga mensalidade.
        Apenas a comissão de 7% sobre UPSELL (reservas em datas especiais
        fechadas pelo Zélla) é aplicada, conforme regra comercial canônica.
      </p>

      <h2>7. Confidencialidade</h2>
      <p>
        Ambas as partes concordam em manter confidencialidade sobre
        funcionalidades, preços e estratégias comerciais discutidas durante o
        programa beta.
      </p>

      <h2>8. Encerramento</h2>
      <p>
        Ao encerramento do beta, a pousada pode: (a) migrar para plano
        Parceiro Zélla (R$247/mês, 24 meses, 100 vagas), ou (b) encerrar a
        conta com exportação de dados (LGPD art. 18, V).
      </p>

      <h2>9. Contato</h2>
      <p>E-mail: <a href="mailto:suporte@seuzella.com">suporte@seuzella.com</a></p>
    </div>
  );
}
