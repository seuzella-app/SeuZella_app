'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Smartphone, Download, Check, X, ShieldCheck } from 'lucide-react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export function PWAInstallWidget() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showBanner, setShowBanner] = useState(false);
  const [installed, setInstalled] = useState(false);
  const [isIOS, setIsIOS] = useState(false);

  useEffect(() => {
    // Verifica se já está rodando em modo standalone (PWA instalado)
    if (window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone) {
      setInstalled(true);
      return;
    }

    // Detecta iOS
    const userAgent = window.navigator.userAgent.toLowerCase();
    const iosDevice = /iphone|ipad|ipod/.test(userAgent);
    setIsIOS(iosDevice);

    const handleBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setShowBanner(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstall);

    // No iOS, se não estiver instalado, mostra a dica após 3 segundos
    if (iosDevice && !sessionStorage.getItem('ddc_pwa_dismissed')) {
      const timer = setTimeout(() => setShowBanner(true), 3000);
      return () => clearTimeout(timer);
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
    };
  }, []);

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        setInstalled(true);
        setShowBanner(false);
      }
      setDeferredPrompt(null);
    } else if (isIOS) {
      alert('Para instalar no iPhone: Toque no ícone de Compartilhar (quadrado com seta para cima) e selecione "Adicionar à Tela de Início".');
    }
  };

  const handleDismiss = () => {
    setShowBanner(false);
    sessionStorage.setItem('ddc_pwa_dismissed', 'true');
  };

  if (installed || !showBanner) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 20 }}
        className="fixed bottom-20 right-4 z-50 max-w-sm rounded-xl border border-emerald-500/30 bg-zinc-950/95 p-4 shadow-2xl backdrop-blur-md"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
              <Smartphone className="size-4" />
            </div>
            <div>
              <p className="text-xs font-bold text-white">Instalar App Seu Zélla</p>
              <p className="text-[11px] text-zinc-400">
                Acesse o painel direto da tela inicial com modo offline.
              </p>
            </div>
          </div>
          <button
            onClick={handleDismiss}
            className="text-zinc-500 hover:text-zinc-300 p-1"
            title="Fechar"
          >
            <X className="size-3.5" />
          </button>
        </div>

        <div className="mt-3 flex items-center justify-between gap-2 border-t border-white/5 pt-2.5">
          <span className="flex items-center gap-1 text-[10px] text-emerald-400">
            <ShieldCheck className="size-3" /> 100% Seguro & Rápido
          </span>
          <button
            onClick={handleInstallClick}
            className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-500 px-3 py-1.5 text-xs font-semibold text-zinc-950 shadow-sm transition hover:bg-emerald-400"
          >
            <Download className="size-3.5" />
            Instalar App
          </button>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
