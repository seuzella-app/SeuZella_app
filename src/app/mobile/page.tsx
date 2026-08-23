import { redirect } from 'next/navigation';

/**
 * Canonical entry point for the installed Seu Zélla mobile application.
 *
 * The entry point is intentionally niche-neutral: authentication resolves the
 * same account used by Desktop, and the authenticated tenant determines the
 * Pousada vs. Anfitrião experience. No tenant id is accepted from the URL.
 */
export default function MobileIndexPage() {
  redirect('/login?callbackUrl=%2Fmobile');
}
