// ==============================================================================
// ZÉLLA — Scroll Utilities (Shared)
// ==============================================================================
// Helper único para smooth scroll para seções por ID.
// Substitui o padrão duplicado `document.querySelector('#precos')` em 7+ arquivos.
// ==============================================================================

/**
 * Faz scroll suave até um elemento pelo seu ID.
 *
 * - Atualiza a URL via history.replaceState (sem reload) para permitir
 *   anchor links compartilháveis
 * - Tipagem correta: usa getElementById que retorna HTMLElement | null
 *   (em vez de querySelector que retorna Element | null)
 * - Safe para SSR: early return se typeof document === 'undefined'
 */
export function scrollToId(
  id: string,
  options: ScrollIntoViewOptions = { behavior: 'smooth', block: 'start' }
): void {
  if (typeof document === 'undefined') return;
  if (!id) return;

  const el = document.getElementById(id);
  if (!el) {
    console.warn(`[scrollToId] Elemento #${id} não encontrado`);
    return;
  }

  el.scrollIntoView(options);

  // Atualiza URL sem reload para anchor link compartilhável
  // (apenas se a URL atual não tem o hash ou tem um diferente)
  if (typeof window !== 'undefined' && window.location.hash !== `#${id}`) {
    try {
      history.replaceState(null, '', `#${id}`);
    } catch (err) {
      // Alguns browsers em modo privado podem bloquear history.replaceState
      console.warn('[scrollToId] history.replaceState falhou (non-fatal):', err);
    }
  }
}
