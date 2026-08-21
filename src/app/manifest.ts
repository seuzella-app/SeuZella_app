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
      {
        src: '/icon-192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icon-192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'maskable',
      },
      {
        src: '/icon-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icon-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
  };
}
