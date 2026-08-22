import type { MetadataRoute } from 'next';

/**
 * Canonical manifest for the Seu Zélla client app.
 * The same installed PWA serves both DDC niches; the authenticated tenant
 * determines whether the user enters the Pousada or Anfitrião experience.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Seu Zélla — DDC',
    short_name: 'Seu Zélla',
    description: 'Aplicativo do DDC Seu Zélla para Pousadas e Anfitriões.',
    start_url: '/mobile',
    scope: '/',
    id: '/mobile',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#0f172a',
    theme_color: '#0f172a',
    icons: [
      // SVG icons — vector, infinitely scalable, smaller payload than PNG.
      // Chrome/Edge/Firefox all support SVG PWA icons (Safari 17+ also).
      {
        src: '/icon-192.svg',
        sizes: '192x192',
        type: 'image/svg+xml',
        purpose: 'any',
      },
      {
        src: '/icon-512.svg',
        sizes: '512x512',
        type: 'image/svg+xml',
        purpose: 'any',
      },
      {
        src: '/icon-maskable-512.svg',
        sizes: '512x512',
        type: 'image/svg+xml',
        purpose: 'maskable',
      },
    ],
  };
}
