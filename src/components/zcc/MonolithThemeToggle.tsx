'use client';

// =============================================================================
// MONOLITH THEME TOGGLE — floating button (bottom-right)
// =============================================================================
// Cycles between 5 themes:
//   dark (phosphor green)  · light (warm paper)  · midnight (deep navy)
//   monolith (white/black) · zella-lacquer (original gold-on-dark)
//
// Persists choice in localStorage. Mounts once at ZCCShell level.
// =============================================================================

import { useState, useEffect, useCallback } from 'react';
import { Palette } from 'lucide-react';

const THEMES = [
  { id: 'dark', label: 'Phosphor', desc: 'Terminal verde fósforo' },
  { id: 'monolith', label: 'Monolith', desc: 'Branco/preto puro' },
  { id: 'midnight', label: 'Midnight', desc: 'Azul profundo' },
  { id: 'light', label: 'Paper', desc: 'Papel quente' },
  { id: 'zella-lacquer', label: 'Lacquer', desc: 'Dourado original Zélla' },
] as const;

type ThemeId = (typeof THEMES)[number]['id'];

const STORAGE_KEY = 'zcc:monolith-theme';

export function MonolithThemeToggle() {
  const [open, setOpen] = useState(false);
  const [current, setCurrent] = useState<ThemeId>('dark');

  // ── On mount, read saved theme (or default to 'dark') ────────────────────
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY) as ThemeId | null;
      if (saved && THEMES.some(t => t.id === saved)) {
        setCurrent(saved);
        applyTheme(saved);
      } else {
        applyTheme('dark');
      }
    } catch {
      /* storage unavailable */
    }
  }, []);

  const applyTheme = useCallback((theme: ThemeId) => {
    const shell = document.querySelector('[data-zcc-shell="1"]') as HTMLElement | null;
    if (shell) {
      shell.setAttribute('data-theme', theme);
    }
  }, []);

  const choose = useCallback((theme: ThemeId) => {
    setCurrent(theme);
    applyTheme(theme);
    try {
      localStorage.setItem(STORAGE_KEY, theme);
    } catch {
      /* ignore */
    }
    setOpen(false);
  }, [applyTheme]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  const currentLabel = THEMES.find(t => t.id === current)?.label ?? 'Phosphor';

  return (
    <>
      <button
        className="zcc-theme-toggle"
        onClick={() => setOpen(v => !v)}
        aria-label="Alternar tema ZCC"
        title="Alternar tema visual"
        type="button"
      >
        <Palette size={11} style={{ display: 'inline', marginRight: 6, verticalAlign: 'middle' }} />
        {currentLabel.toUpperCase()}
      </button>

      {open && (
        <div className="zcc-theme-toggle-menu" role="menu">
          {THEMES.map(t => (
            <button
              key={t.id}
              className={current === t.id ? 'active' : ''}
              onClick={() => choose(t.id)}
              role="menuitem"
              type="button"
            >
              <div style={{ fontWeight: 600 }}>{t.label}</div>
              <div style={{ fontSize: 9, color: 'var(--text-3)', marginTop: 2 }}>
                {t.desc}
              </div>
            </button>
          ))}
        </div>
      )}
    </>
  );
}
