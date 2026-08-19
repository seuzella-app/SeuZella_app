'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, Globe, Sparkles, Brain, ShieldCheck, CheckCircle2, ArrowRight } from 'lucide-react';
import type { NicheType } from '@/contexts/NicheContext';
import { NICHE_THEME } from './DDCShell';

// ═══════════════════════════════════════════════════════════════
// MAGIC SCANNER — Boutique Onboarding UX
// ═══════════════════════════════════════════════════════════════
// O usuário cola a URL do anúncio e assiste a "mágica" acontecer.
// Status steps com animações sequenciais → chama API → devolve dados.
// ═══════════════════════════════════════════════════════════════

export interface MagicScanResult {
  propertyName: string;
  amenities: string[];
  checkInTime: string;
  checkOutTime: string;
  aiVoiceTone: string;
  source: 'airbnb' | 'booking' | 'website';
  location?: string;
  rating?: number;
  totalRooms?: number;
  description?: string;
  priceRange?: string;
  policies?: string;
  highlights?: string[];
}

interface MagicScannerProps {
  niche: NicheType;
  onComplete: (result: MagicScanResult) => void;
}

type ScanPhase = 'input' | 'scanning' | 'complete';

const SCAN_STEPS = [
  { id: 'analyze', label: 'Analisando URL...', icon: Globe, duration: 1500 },
  { id: 'amenities', label: 'Mapeando comodidades e quartos...', icon: Search, duration: 1500 },
  { id: 'policies', label: 'Lendo políticas de cancelamento...', icon: ShieldCheck, duration: 1500 },
  { id: 'calibrate', label: 'Calibrando Motor de Atendimento...', icon: Brain, duration: 1500 },
];

export function MagicScanner({ niche, onComplete }: MagicScannerProps) {
  const [phase, setPhase] = useState<ScanPhase>('input');
  const [url, setUrl] = useState('');
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [completedSteps, setCompletedSteps] = useState<Set<number>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const theme = NICHE_THEME[niche];

  // Detect source from URL
  const detectSource = useCallback((inputUrl: string): 'airbnb' | 'booking' | 'website' => {
    const lower = inputUrl.toLowerCase();
    if (lower.includes('airbnb')) return 'airbnb';
    if (lower.includes('booking.com')) return 'booking';
    return 'website';
  }, []);

  // Run scan animation sequence
  const runScanSequence = useCallback(async (submittedUrl: string) => {
    setPhase('scanning');
    setCurrentStepIndex(0);
    setCompletedSteps(new Set());
    setError(null);

    // Animate through each step
    for (let i = 0; i < SCAN_STEPS.length; i++) {
      setCurrentStepIndex(i);
      await new Promise(r => setTimeout(r, SCAN_STEPS[i].duration));
      setCompletedSteps(prev => new Set([...prev, i]));
    }

    // Call API
    try {
      const response = await fetch('/api/ddc/magic-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: submittedUrl, niche, source: detectSource(submittedUrl) }),
      });

      if (!response.ok) {
        throw new Error('Erro ao processar o link');
      }

      const json = await response.json();
      const data: MagicScanResult = json.data ?? { propertyName: '', amenities: [], checkInTime: '14:00', checkOutTime: '12:00', aiVoiceTone: '', source: 'website' };
      setPhase('complete');

      // Brief pause to show "complete" state, then trigger parent
      await new Promise(r => setTimeout(r, 800));
      onComplete(data);
    } catch {
      setError('Não foi possível ler este link. Tente novamente ou pule esta etapa.');
      setPhase('input');
    }
  }, [niche, detectSource, onComplete]);

  const handleSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = url.trim();
    if (!trimmed) return;

    // Basic URL validation (allow with or without protocol)
    const hasProtocol = trimmed.startsWith('http://') || trimmed.startsWith('https://');
    const fullUrl = hasProtocol ? trimmed : `https://${trimmed}`;

    try {
      new URL(fullUrl);
    } catch {
      setError('Por favor, cole uma URL válida.');
      return;
    }

    setUrl(fullUrl);
    runScanSequence(fullUrl);
  }, [url, runScanSequence]);

  // Auto-focus input
  useEffect(() => {
    if (phase === 'input' && inputRef.current) {
      inputRef.current.focus();
    }
  }, [phase]);

  // ─── RENDER: Input Phase ─────────────────────────────────────────

  if (phase === 'input') {
    return (
      <div className="min-h-screen bg-[#0a0a0f] text-white flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          className="w-full max-w-2xl text-center"
        >
          {/* Icon */}
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.2, duration: 0.5 }}
            className="mb-8"
          >
            <div className={`w-20 h-20 mx-auto rounded-2xl bg-gradient-to-br ${theme.headerGradient} flex items-center justify-center shadow-lg`}>
              <Sparkles className="w-10 h-10 text-white" />
            </div>
          </motion.div>

          {/* Title */}
          <motion.h1
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 0.5 }}
            className="text-3xl md:text-4xl font-bold tracking-tight mb-3"
          >
            Magic Scanner
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4, duration: 0.5 }}
            className="text-zinc-400 text-base md:text-lg mb-10 max-w-md mx-auto leading-relaxed"
          >
            Cole o link do seu anúncio (Airbnb, Booking ou Site) e deixe o Zélla fazer a leitura.
          </motion.p>

          {/* Input Form */}
          <motion.form
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5, duration: 0.5 }}
            onSubmit={handleSubmit}
            className="relative"
          >
            <div className="relative group">
              <div className={`absolute -inset-1 bg-gradient-to-r ${theme.headerGradient} rounded-2xl opacity-20 group-hover:opacity-40 blur transition-opacity duration-500`} />
              <div className="relative flex items-center bg-[#111118] border border-white/[0.08] rounded-2xl overflow-hidden">
                <div className="pl-5 pr-3">
                  <Globe className={`w-5 h-5 ${theme.accentText}`} />
                </div>
                <input
                  ref={inputRef}
                  type="text"
                  value={url}
                  onChange={(e) => { setUrl(e.target.value); setError(null); }}
                  placeholder="https://www.airbnb.com/rooms/..."
                  className="flex-1 bg-transparent py-5 pr-4 text-white text-lg placeholder:text-zinc-600 outline-none min-w-0"
                  autoComplete="url"
                  spellCheck={false}
                />
                <button
                  type="submit"
                  className={`flex items-center gap-2 px-6 py-3 mr-2 rounded-xl bg-gradient-to-r ${theme.headerGradient} text-white font-semibold text-sm transition-all duration-200 hover:shadow-lg active:scale-95`}
                >
                  <ArrowRight className="w-4 h-4" />
                  <span className="hidden sm:inline">Ler</span>
                </button>
              </div>
            </div>
          </motion.form>

          {/* Error message */}
          <AnimatePresence>
            {error && (
              <motion.p
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                className="text-red-400 text-sm mt-4"
              >
                {error}
              </motion.p>
            )}
          </AnimatePresence>

          {/* Hint */}
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.8 }}
            className="text-zinc-600 text-xs mt-6"
          >
            Cole e pressione Enter — a mágica acontece em segundos
          </motion.p>
        </motion.div>
      </div>
    );
  }

  // ─── RENDER: Scanning Phase ──────────────────────────────────────

  if (phase === 'scanning') {
    return (
      <div className="min-h-screen bg-[#0a0a0f] text-white flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="w-full max-w-md text-center"
        >
          {/* Animated radar icon */}
          <div className="relative w-24 h-24 mx-auto mb-10">
            <motion.div
              className={`absolute inset-0 rounded-full bg-gradient-to-br ${theme.headerGradient} opacity-20`}
              animate={{ scale: [1, 1.3, 1], opacity: [0.2, 0.4, 0.2] }}
              transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
            />
            <motion.div
              className={`absolute inset-2 rounded-full bg-gradient-to-br ${theme.headerGradient} opacity-30`}
              animate={{ scale: [1, 1.2, 1], opacity: [0.3, 0.5, 0.3] }}
              transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut', delay: 0.2 }}
            />
            <div className={`absolute inset-0 flex items-center justify-center`}>
              <Sparkles className={`w-10 h-10 ${theme.accentText}`} />
            </div>
          </div>

          {/* Status steps */}
          <div className="space-y-4 text-left">
            {SCAN_STEPS.map((step, index) => {
              const isCompleted = completedSteps.has(index);
              const isCurrent = index === currentStepIndex && !isCompleted;
              const isPending = index > currentStepIndex;
              const Icon = step.icon;

              return (
                <motion.div
                  key={step.id}
                  initial={{ opacity: 0, x: -16 }}
                  animate={{ opacity: isPending ? 0.3 : 1, x: 0 }}
                  transition={{ delay: index * 0.1, duration: 0.4 }}
                  className={`flex items-center gap-4 px-5 py-3.5 rounded-xl transition-all duration-500 ${
                    isCompleted
                      ? `${theme.accentBg} border ${theme.accentBorder}`
                      : isCurrent
                        ? 'bg-white/[0.04] border border-white/[0.08]'
                        : 'bg-transparent border border-transparent'
                  }`}
                >
                  <div className={`flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center transition-all duration-500 ${
                    isCompleted
                      ? `${theme.accentBg}`
                      : isCurrent
                        ? 'bg-white/[0.06]'
                        : 'bg-white/[0.02]'
                  }`}>
                    {isCompleted ? (
                      <CheckCircle2 className={`w-4.5 h-4.5 ${theme.accentText}`} />
                    ) : isCurrent ? (
                      <motion.div
                        animate={{ rotate: 360 }}
                        transition={{ duration: 1.5, repeat: Infinity, ease: 'linear' }}
                      >
                        <Icon className={`w-4 h-4 ${theme.accentText}`} />
                      </motion.div>
                    ) : (
                      <Icon className="w-4 h-4 text-zinc-600" />
                    )}
                  </div>
                  <span className={`text-sm font-medium transition-colors duration-500 ${
                    isCompleted
                      ? 'text-white'
                      : isCurrent
                        ? 'text-white/90'
                        : 'text-zinc-600'
                  }`}>
                    {step.label}
                  </span>
                </motion.div>
              );
            })}
          </div>

          {/* URL being scanned */}
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
            className="text-zinc-600 text-xs mt-8 truncate"
          >
            <Globe className="w-3 h-3 inline mr-1.5" />
            {url}
          </motion.p>
        </motion.div>
      </div>
    );
  }

  // ─── RENDER: Complete Phase ──────────────────────────────────────

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.4 }}
        className="text-center"
      >
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', stiffness: 200, damping: 15 }}
          className={`w-20 h-20 mx-auto rounded-2xl bg-gradient-to-br ${theme.headerGradient} flex items-center justify-center mb-6`}
        >
          <CheckCircle2 className="w-10 h-10 text-white" />
        </motion.div>
        <h2 className="text-2xl font-bold mb-2">Leitura Concluída!</h2>
        <p className="text-zinc-400 text-sm">Preparando seu painel...</p>
      </motion.div>
    </div>
  );
}
