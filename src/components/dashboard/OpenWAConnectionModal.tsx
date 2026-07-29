'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  QrCode, 
  CheckCircle2, 
  AlertCircle, 
  RefreshCw, 
  Smartphone, 
  ShieldCheck, 
  Zap, 
  X, 
  Send,
  MessageSquare,
  Sparkles
} from 'lucide-react';

export interface OpenWAConnectionModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function OpenWAConnectionModal({ isOpen, onClose }: OpenWAConnectionModalProps) {
  const [provider, setProvider] = useState<'openwa' | 'meta'>('openwa');
  const [status, setStatus] = useState<'AUTHENTICATED' | 'PAIRING' | 'DISCONNECTED' | 'OFFLINE'>('PAIRING');
  const [qrCodeUrl, setQrCodeUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [testPhone, setTestPhone] = useState('');
  const [testStatus, setTestStatus] = useState<'idle' | 'sending' | 'success' | 'error'>('idle');
  const [testMessage, setTestMessage] = useState('');

  // Simular busca de status e QR Code do servidor OpenWA
  const fetchStatus = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/openwa/status');
      const data = await res.json();
      if (data.success) {
        setStatus(data.status || 'PAIRING');
        setQrCodeUrl(data.qrCodeUrl || null);
      } else {
        setStatus('OFFLINE');
      }
    } catch {
      setStatus('OFFLINE');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchStatus();
    }
  }, [isOpen]);

  const handleTestSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!testPhone) return;

    setTestStatus('sending');
    setTestMessage('');

    try {
      const res = await fetch('/api/webhooks/openwa', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event: 'message',
          session: 'default',
          payload: {
            from: testPhone.replace(/\D/g, ''),
            body: 'Mensagem de teste de conexão com o Seu Zélla',
            sender: { name: 'Anfitrião Zélla' },
          },
        }),
      });

      if (res.ok) {
        setTestStatus('success');
        setTestMessage('Mensagem de teste processada com sucesso no ZaosNeuroRouter!');
      } else {
        setTestStatus('error');
        setTestMessage('Falha ao enviar mensagem de teste.');
      }
    } catch {
      setTestStatus('error');
      setTestMessage('Erro de conexão ao testar o gateway.');
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md">
        <motion.div 
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          className="relative w-full max-w-2xl bg-neutral-900 border border-neutral-800 rounded-3xl shadow-2xl overflow-hidden text-white"
        >
          {/* Header */}
          <div className="p-6 border-b border-neutral-800 flex items-center justify-between bg-gradient-to-r from-emerald-950/40 via-neutral-900 to-neutral-900">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl text-emerald-400">
                <MessageSquare className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
                  Gateway de WhatsApp
                  <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-semibold border border-emerald-500/30">
                    Dual Engine
                  </span>
                </h2>
                <p className="text-sm text-neutral-400">Escolha como conectar o número da sua pousada ao Seu Zélla</p>
              </div>
            </div>

            <button 
              onClick={onClose}
              className="p-2 text-neutral-400 hover:text-white rounded-full hover:bg-neutral-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Provider Selector Tabs */}
          <div className="p-6 space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <button
                type="button"
                onClick={() => setProvider('openwa')}
                className={`p-4 rounded-2xl border text-left transition-all relative overflow-hidden ${
                  provider === 'openwa' 
                    ? 'border-emerald-500 bg-emerald-950/20 text-white shadow-lg shadow-emerald-950/30' 
                    : 'border-neutral-800 bg-neutral-900/50 text-neutral-400 hover:border-neutral-700'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2 text-emerald-400 font-bold">
                    <QrCode className="w-5 h-5" />
                    <span>OpenWA (QR Code)</span>
                  </div>
                  <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-400/10 text-emerald-400 border border-emerald-400/20">
                    Zero Taxas Meta
                  </span>
                </div>
                <p className="text-xs text-neutral-400">Conecte via celular com QR Code. Sem custo por conversa e sem burocracia da Meta.</p>
              </button>

              <button
                type="button"
                onClick={() => setProvider('meta')}
                className={`p-4 rounded-2xl border text-left transition-all relative overflow-hidden ${
                  provider === 'meta' 
                    ? 'border-blue-500 bg-blue-950/20 text-white shadow-lg shadow-blue-950/30' 
                    : 'border-neutral-800 bg-neutral-900/50 text-neutral-400 hover:border-neutral-700'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2 text-blue-400 font-bold">
                    <ShieldCheck className="w-5 h-5" />
                    <span>Meta Cloud API</span>
                  </div>
                  <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-blue-400/10 text-blue-400 border border-blue-400/20">
                    Oficial Meta
                  </span>
                </div>
                <p className="text-xs text-neutral-400">API oficial da Meta com selo de verificação Business. Requer token e WABA ID.</p>
              </button>
            </div>

            {/* Provider Details: OpenWA */}
            {provider === 'openwa' && (
              <div className="bg-neutral-950/70 border border-neutral-800 rounded-2xl p-6 space-y-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`w-3 h-3 rounded-full ${
                      status === 'AUTHENTICATED' ? 'bg-emerald-400 animate-pulse' :
                      status === 'PAIRING' ? 'bg-amber-400 animate-ping' : 'bg-rose-400'
                    }`} />
                    <span className="text-sm font-semibold">
                      {status === 'AUTHENTICATED' ? 'Conectado e Operacional' :
                       status === 'PAIRING' ? 'Aguardando Leitura de QR Code' : 'Desconectado / Offline'}
                    </span>
                  </div>

                  <button
                    onClick={fetchStatus}
                    disabled={isLoading}
                    className="flex items-center gap-2 text-xs text-neutral-400 hover:text-white px-3 py-1.5 rounded-xl border border-neutral-800 hover:bg-neutral-800 transition-colors"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
                    Atualizar
                  </button>
                </div>

                {/* QR Code Container */}
                <div className="flex flex-col md:flex-row items-center gap-6 p-4 bg-neutral-900/80 rounded-xl border border-neutral-800">
                  <div className="w-44 h-44 bg-white p-3 rounded-2xl flex items-center justify-center border-4 border-emerald-500/30 shadow-inner">
                    {qrCodeUrl ? (
                      /* eslint-disable-next-next/no-img-element */
                      <img src={qrCodeUrl} alt="QR Code OpenWA" className="w-full h-full object-contain" />
                    ) : (
                      <div className="text-center p-2">
                        <QrCode className="w-12 h-12 text-neutral-400 mx-auto mb-2" />
                        <span className="text-[10px] text-neutral-500 font-mono">Pareamento OpenWA</span>
                      </div>
                    )}
                  </div>

                  <div className="space-y-3 flex-1 text-sm text-neutral-300">
                    <h4 className="font-semibold text-white flex items-center gap-2">
                      <Smartphone className="w-4 h-4 text-emerald-400" />
                      Como Parear Seu Celular:
                    </h4>
                    <ol className="list-decimal list-inside space-y-1.5 text-xs text-neutral-400">
                      <li>Abra o WhatsApp no seu smartphone.</li>
                      <li>Toque em <strong className="text-neutral-200">Dispositivos Conectados</strong>.</li>
                      <li>Selecione <strong className="text-neutral-200">Conectar um dispositivo</strong> e aponte para este QR Code.</li>
                    </ol>
                    <div className="pt-2 flex items-center gap-2 text-xs text-emerald-400 font-medium">
                      <Sparkles className="w-4 h-4" />
                      Atendimento automático Zélla assumirá instantaneamente após o pareamento.
                    </div>
                  </div>
                </div>

                {/* Test Send Input */}
                <form onSubmit={handleTestSend} className="space-y-3 pt-2">
                  <label className="text-xs font-semibold text-neutral-300 block">
                    Testar Disparo de Mensagem Zélla
                  </label>
                  <div className="flex gap-2">
                    <input 
                      type="text"
                      placeholder="Ex: 5511988888888"
                      value={testPhone}
                      onChange={(e) => setTestPhone(e.target.value)}
                      className="flex-1 bg-neutral-900 border border-neutral-800 rounded-xl px-3.5 py-2 text-sm text-white focus:outline-none focus:border-emerald-500"
                    />
                    <button
                      type="submit"
                      disabled={testStatus === 'sending' || !testPhone}
                      className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-medium text-sm flex items-center gap-2 transition-colors disabled:opacity-50"
                    >
                      <Send className="w-4 h-4" />
                      {testStatus === 'sending' ? 'Enviando...' : 'Testar'}
                    </button>
                  </div>

                  {testMessage && (
                    <p className={`text-xs flex items-center gap-1.5 ${
                      testStatus === 'success' ? 'text-emerald-400' : 'text-rose-400'
                    }`}>
                      {testStatus === 'success' ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
                      {testMessage}
                    </p>
                  )}
                </form>
              </div>
            )}

            {/* Provider Details: Meta */}
            {provider === 'meta' && (
              <div className="bg-neutral-950/70 border border-neutral-800 rounded-2xl p-6 space-y-4 text-sm text-neutral-300">
                <div className="flex items-center gap-2 text-blue-400 font-semibold">
                  <Zap className="w-4 h-4" />
                  Configuração Meta Developer Cloud API (v21.0)
                </div>
                <p className="text-xs text-neutral-400">
                  Para utilizar a API oficial da Meta, certifique-se de configurar as variáveis de ambiente no arquivo <code className="text-blue-300 bg-blue-950/50 px-1.5 py-0.5 rounded">.env</code>:
                </p>
                <div className="bg-neutral-900 p-4 rounded-xl font-mono text-xs text-neutral-300 space-y-1 border border-neutral-800">
                  <div>WHATSAPP_PROVIDER=meta</div>
                  <div>META_ACCESS_TOKEN=EAAG...</div>
                  <div>META_PHONE_NUMBER_ID=1006...</div>
                  <div>META_VERIFY_TOKEN=sua_chave_segura</div>
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="p-4 border-t border-neutral-800 bg-neutral-950 flex items-center justify-between text-xs text-neutral-400">
            <span className="flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              Protegido pelo Escudo Anti-Taxas Zélla
            </span>
            <button
              onClick={onClose}
              className="px-4 py-2 bg-neutral-800 hover:bg-neutral-700 text-white rounded-xl font-medium transition-colors"
            >
              Concluído
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
