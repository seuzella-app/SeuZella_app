'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  CheckCircle2,
  Copy,
  ExternalLink,
  RefreshCw,
  AlertCircle,
  HelpCircle,
  Link,
  ShieldCheck,
  ChevronRight
} from 'lucide-react';

interface OTAModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialOtaId?: 'booking' | 'decolar' | 'expedia' | 'airbnb';
}

const otaDetails = {
  booking: {
    name: 'Booking.com',
    logo: '/images/ota-logos/booking.png',
    extranetUrl: 'https://admin.booking.com/',
    steps: [
      'Acesse a Extranet da Booking.com com seu login de proprietário.',
      'Navegue até a aba "Calendário" > selecione "Sincronizar Calendários".',
      'Clique em "Adicionar Conexão de Calendário" e selecione "Importar Calendário".',
      'Cole a URL iCal gerada pelo Seu Zélla abaixo e dê um nome (ex: "Seu Zélla Pousada").',
      'Copie a URL iCal exportada pela Booking.com e cole no campo de importação abaixo.'
    ]
  },
  decolar: {
    name: 'Decolar / Despegar',
    logo: '/images/ota-logos/decolar.png',
    extranetUrl: 'https://extranet.despegar.com/',
    steps: [
      'Entre no portal Extranet Decolar Partner com seus dados de acesso.',
      'Vá em "Tarifas e Disponibilidade" > "Gerenciamento de Canais / Sincronização iCal".',
      'Selecione a acomodação correspondente e clique em "Adicionar Link de Sincronização".',
      'Cole o link do Seu Zélla e copie o link de saída fornecido pela Decolar.',
      'Cole o link da Decolar na aba de importação do Seu Zélla para bloqueio recíproco 2-Way.'
    ]
  },
  expedia: {
    name: 'Expedia Group',
    logo: '/images/ota-logos/expedia.png',
    extranetUrl: 'https://www.expediapartnercentral.com/',
    steps: [
      'Acesse o Expedia Partner Central com seu ID de conta.',
      'Menu "Quartos e Tarifas" > "Configuração de Calendários / Conectividade iCal".',
      'Clique em "Adicionar Calendário Externo" e informe o link seguro fornecido abaixo.',
      'Copie a URL de exportação gerada pela Expedia para a acomodação.',
      'Cole a URL no Seu Zélla para sincronização automática de bloqueios e reservas.'
    ]
  },
  airbnb: {
    name: 'Airbnb',
    logo: '/images/ota-logos/airbnb.png',
    extranetUrl: 'https://www.airbnb.com.br/hosting/listings',
    steps: [
      'Acesse o menu "Anúncios" no seu painel de anfitrião Airbnb.',
      'Selecione o imóvel > "Preços e Disponibilidade" > role até "Sincronização de Calendário".',
      'Clique em "Exportar Calendário" para copiar a URL .ics do Airbnb.',
      'Clique em "Importar Calendário" no Airbnb e cole o link iCal do Seu Zélla.',
      'Cole a URL exportada do Airbnb no campo abaixo para finalizar a sincronização 2-Way.'
    ]
  }
};

export function OTAIntegrationModal({ isOpen, onClose, initialOtaId = 'booking' }: OTAModalProps) {
  const [selectedOta, setSelectedOta] = useState<'booking' | 'decolar' | 'expedia' | 'airbnb'>(initialOtaId);
  const [importUrl, setImportUrl] = useState('');
  const [copied, setCopied] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);

  if (!isOpen) return null;

  const currentOta = otaDetails[selectedOta];
  const zellaExportUrl = `https://seuzella.com/api/integrations/ical/room-demo-101?token=zk_live_${selectedOta}_8f9a2b`;

  const handleCopy = () => {
    navigator.clipboard.writeText(zellaExportUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!importUrl) return;
    setIsSaving(true);
    setTimeout(() => {
      setIsSaving(false);
      setSavedSuccess(true);
      setTimeout(() => {
        setSavedSuccess(false);
        onClose();
      }, 1500);
    }, 1200);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 15 }}
        className="relative w-full max-w-2xl bg-zinc-900 border border-zinc-800 rounded-3xl shadow-2xl overflow-hidden text-white"
      >
        {/* Header */}
        <div className="p-6 border-b border-zinc-800 flex items-center justify-between bg-zinc-950/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
              <Link className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <h3 className="font-bold text-lg text-white">Sincronização iCal 2-Way OTAs</h3>
              <p className="text-xs text-neutral-400">Conecte sua pousada às 4 maiores plataformas sem overbooking</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-zinc-800 hover:bg-zinc-700 flex items-center justify-center transition-colors"
          >
            <X className="w-4 h-4 text-neutral-400" />
          </button>
        </div>

        {/* OTA Selector Tabs */}
        <div className="grid grid-cols-4 border-b border-zinc-800 bg-zinc-950">
          {(['booking', 'decolar', 'expedia', 'airbnb'] as const).map((id) => (
            <button
              key={id}
              onClick={() => {
                setSelectedOta(id);
                setSavedSuccess(false);
              }}
              className={`py-3 px-2 flex items-center justify-center gap-2 border-b-2 text-xs font-semibold transition-all ${
                selectedOta === id
                  ? 'border-emerald-400 text-white bg-zinc-900'
                  : 'border-transparent text-neutral-400 hover:text-neutral-200'
              }`}
            >
              <img
                src={otaDetails[id].logo}
                alt={otaDetails[id].name}
                className="h-3.5 w-auto object-contain brightness-125"
              />
              <span className="hidden sm:inline">{otaDetails[id].name}</span>
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="p-6 space-y-6 max-h-[75vh] overflow-y-auto">
          {/* Step-by-step Guide */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-2">
                <span>Passo a Passo na Extranet {currentOta.name}</span>
              </h4>
              <a
                href={currentOta.extranetUrl}
                target="_blank"
                rel="noreferrer"
                className="text-xs text-blue-400 hover:underline flex items-center gap-1"
              >
                <span>Abrir Extranet {currentOta.name}</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>

            <ol className="space-y-2.5 bg-zinc-950/60 border border-zinc-800 rounded-2xl p-4 text-xs text-neutral-300">
              {currentOta.steps.map((step, idx) => (
                <li key={idx} className="flex items-start gap-2.5">
                  <span className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-400 font-bold flex items-center justify-center shrink-0 text-[10px]">
                    {idx + 1}
                  </span>
                  <span className="leading-relaxed">{step}</span>
                </li>
              ))}
            </ol>
          </div>

          {/* Export Link (Seu Zélla -> OTA) */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-neutral-300 block">
              1. Link iCal do Seu Zélla para colar na Extranet {currentOta.name}:
            </label>
            <div className="flex items-center gap-2 bg-zinc-950 border border-zinc-800 rounded-xl p-2">
              <input
                type="text"
                readOnly
                value={zellaExportUrl}
                className="bg-transparent text-xs text-emerald-400 font-mono flex-1 outline-none truncate px-2"
              />
              <button
                onClick={handleCopy}
                className="px-3 py-1.5 rounded-lg bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 text-xs font-semibold hover:bg-emerald-500/30 flex items-center gap-1.5 transition-colors"
              >
                {copied ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied ? 'Copiado!' : 'Copiar Link'}</span>
              </button>
            </div>
          </div>

          {/* Import Link Form (OTA -> Seu Zélla) */}
          <form onSubmit={handleSave} className="space-y-3 pt-2">
            <label className="text-xs font-semibold text-neutral-300 block">
              2. Cole aqui o Link iCal fornecido pela Extranet {currentOta.name}:
            </label>
            <div className="flex items-center gap-2">
              <input
                type="url"
                required
                placeholder={`https://...ical.${selectedOta}.com/export.ics`}
                value={importUrl}
                onChange={(e) => setImportUrl(e.target.value)}
                className="bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2.5 text-xs text-white placeholder-neutral-500 flex-1 outline-none focus:border-emerald-500/50 transition-colors"
              />
              <button
                type="submit"
                disabled={isSaving}
                className="px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black font-extrabold text-xs flex items-center gap-2 shadow-lg shadow-emerald-500/20 disabled:opacity-50 transition-all"
              >
                {isSaving ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <ShieldCheck className="w-3.5 h-3.5" />
                )}
                <span>{isSaving ? 'Sincronizando...' : 'Ativar Sincronização'}</span>
              </button>
            </div>
          </form>

          {savedSuccess && (
            <motion.div
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-semibold flex items-center gap-2"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>Sincronização iCal 2-Way ativada com sucesso para {currentOta.name}!</span>
            </motion.div>
          )}

          {/* Safety Notice */}
          <div className="p-3.5 rounded-xl bg-zinc-950/80 border border-zinc-800/80 flex items-start gap-3 text-[11px] text-neutral-400">
            <HelpCircle className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
            <p className="leading-relaxed">
              <strong className="text-white">Bloqueio Automático de Calendário:</strong> Assim que ativado, o Seu Zélla consulta o feed da OTA a cada 5 minutos. Qualquer reserva feita no WhatsApp bloqueia a data instantaneamente na {currentOta.name} e vice-versa.
            </p>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
