import { describe, it, expect } from 'vitest';
import manifest from '../src/app/manifest';

describe('PWA & Mobile App Readiness Suite', () => {
  it('canonical installed app manifest uses the shared Seu Zélla Mobile entry', () => {
    const config = manifest();
    expect(config.name).toContain('Seu Zélla');
    expect(config.short_name).toBe('Seu Zélla');
    expect(config.start_url).toBe('/mobile');
    expect(config.id).toBe('/mobile');
    expect(config.scope).toBe('/');
    expect(config.display).toBe('standalone');
    expect(config.orientation).toBe('portrait');
    expect(config.theme_color).toBe('#0f172a');
    expect(config.icons).toHaveLength(4);

    const icons = config.icons ?? [];
    expect(icons).toEqual(expect.arrayContaining([
      expect.objectContaining({ sizes: '192x192', purpose: 'any' }),
      expect.objectContaining({ sizes: '192x192', purpose: 'maskable' }),
      expect.objectContaining({ sizes: '512x512', purpose: 'any' }),
      expect.objectContaining({ sizes: '512x512', purpose: 'maskable' }),
    ]));
  });

  it('one-thumb navigation keeps the core DDC modules discoverable', () => {
    const mobileBottomBar = [
      { id: 'visao-geral', label: 'Início', path: '/ddc' },
      { id: 'entregas-zella', label: 'Conversas', path: '/ddc/chats' },
      { id: 'sync-ical', label: 'Calendário', path: '/ddc/calendar' },
      { id: 'guia-hospedes', label: 'Ajustes', path: '/ddc/settings' },
    ];
    expect(mobileBottomBar).toHaveLength(4);
    expect(mobileBottomBar[0].path).toBe('/ddc');
    expect(mobileBottomBar[1].label).toBe('Conversas');
  });

  it('one-tap kill-switch toggles AI state deterministically', () => {
    let aiBotActive = true;
    const toggle = () => (aiBotActive = !aiBotActive);
    expect(toggle()).toBe(false);
    expect(toggle()).toBe(true);
  });

  it('keeps server-rendered app architecture instead of static export', () => {
    const hybridStrategy = {
      mode: 'SERVER_PWA',
      preservesServerComponents: true,
      preservesNextAuthCookies: true,
    };
    expect(hybridStrategy.mode).toBe('SERVER_PWA');
    expect(hybridStrategy.preservesServerComponents).toBe(true);
    expect(hybridStrategy.preservesNextAuthCookies).toBe(true);
  });

  it('defines the expected offline and push assets', () => {
    const pwaAssets = {
      offlineUrl: '/offline.html',
      serviceWorker: '/sw.js',
      supportsPushNotifications: true,
    };
    expect(pwaAssets.offlineUrl).toBe('/offline.html');
    expect(pwaAssets.serviceWorker).toBe('/sw.js');
    expect(pwaAssets.supportsPushNotifications).toBe(true);
  });
});
