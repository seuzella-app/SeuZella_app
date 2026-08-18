import { redirect } from 'next/navigation';

/**
 * /mobile  →  redireciona para o nicho padrão (pousada).
 *
 * Donos de pousada acessam diretamente /mobile/pousada.
 * Anfitriões Airbnb acessam diretamente /mobile/airbnb.
 *
 * O redirecionamento default para pousada existe apenas para evitar
 * uma página 404 caso o usuário acesse a raiz /mobile sem nicho.
 * Em produção, todo link de marketing aponta para o nicho específico.
 */
export default function MobileIndexPage() {
  redirect('/mobile/pousada');
}
