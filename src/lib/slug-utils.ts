import { db } from '@/lib/db';
import { randomBytes } from 'crypto';

/**
 * Generate a unique slug for guest guides
 *
 * RUN 6 — capability entropy (P1): o slug É a credencial do guia público
 * (contém senha de Wi-Fi, chave Pix e códigos de fechadura). O formato antigo
 * `base`, `base-1`, `base-2`… ou `base-<timestamp>` era adivinhável.
 * Agora: sufixo aleatório criptográfico (~71 bits) em todo slug novo.
 */
export async function generateSlug(base: string, _tenantId?: string): Promise<string> {
  const slug = (base || 'guia')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60) || 'guia';
  let attempts = 0;

  while (attempts < 20) {
    const suffix = randomBytes(9).toString('base64url');
    const candidate = `${slug}-${suffix}`;

    const existing = await db.guestGuide.findFirst({
      where: { slug: candidate },
    });

    if (!existing) return candidate;
    attempts++;
  }

  // Practically unreachable (birthday bound); keep a safe random fallback.
  return `${slug}-${randomBytes(12).toString('base64url')}`;
}
