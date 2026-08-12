'use client';

// ==============================================================================
// ZCC PAGE — Zélla Central Control v5
// ==============================================================================
// Substitui a versão antiga pelo novo ZCC v5 com:
//   - ZccShell (sidebar + topbar + layout responsivo)
//   - NavigationHub (navegação por teclas)
//   - 18 painéis modulares em src/components/zcc/panels/
//   - Mock data alinhado com Prisma schema
//   - Mapa do Brasil com 27 estados
// ==============================================================================

import { ZccShell } from '@/components/zcc/zcc-shell';

export default function ZCCPage() {
  return <ZccShell />;
}
