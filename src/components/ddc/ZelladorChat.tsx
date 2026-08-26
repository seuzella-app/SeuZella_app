'use client';

import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Send, Bot, Shield, Crown, Loader2, AlertTriangle, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';

// ── Tipos ───────────────────────────────────────────────────────────────────────

interface ZelladorMessage {
  id?: string;
  role: 'user' | 'assistant';
  content: string;
  blocked?: boolean;
}

interface ZelladorChatProps {
  /** Plano do tenant vindo da session. Se não for 'max', exibe tela de upgrade. */
  userPlan: string;
}

// ── Constantes ──────────────────────────────────────────────────────────────────

const SECURITY_RESPONSE =
  'Erro de Segurança: Ação não permitida. Como seu Gerente de Treinamento, estou autorizado a responder apenas dúvidas operacionais de configuração do dashboard e planos de faturamento do Seu ZÉLLA.';

const WELCOME_MESSAGE: ZelladorMessage = {
  role: 'assistant',
  content:
    'Olá! Sou o **Zellador**, seu Gerente de Treinamento Dedicado do plano MAX. 🎯\n\n' +
    'Estou aqui para te ajudar com:\n' +
    '• Configuração do Dashboard DDC e IA\n' +
    '• Sincronização de calendários (iCal)\n' +
    '• Dúvidas sobre faturamento e planos\n' +
    '• Onboarding e melhores práticas\n\n' +
    'Como posso te ajudar hoje?',
};

// ── Componente Principal ───────────────────────────────────────────────────────

export function ZelladorChat({ userPlan }: ZelladorChatProps) {
  const isMax = userPlan === 'max';

  if (!isMax) {
    return <UpgradePrompt currentPlan={userPlan} />;
  }

  return <ActiveZelladorChat />;
}

// ── Chat Ativo (Plano MAX) ────────────────────────────────────────────────────

function ActiveZelladorChat() {
  const [messages, setMessages] = useState<ZelladorMessage[]>([WELCOME_MESSAGE]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [conversationId, setConversationId] = useState<string | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-scroll ao receber nova mensagem
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Enviar mensagem
  const handleSend = async () => {
    const trimmed = input.trim();
    if (!trimmed || loading) return;

    setError(null);

    // Adicionar mensagem do usuário localmente
    const userMessage: ZelladorMessage = { role: 'user', content: trimmed };
    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setLoading(true);

    try {
      const res = await fetch('/api/ddc/gerente-ia', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: trimmed,
          conversationId,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        // Se for erro de segurança, mostrar como resposta do Zellador
        if (res.status === 400 && data.error === 'SECURITY_BLOCK') {
          setMessages((prev) => [
            ...prev,
            { role: 'assistant', content: data.message || SECURITY_RESPONSE },
          ]);
        } else if (res.status === 429) {
          setError('Limite de requisições atingido. Aguarde alguns segundos.');
        } else if (res.status === 403) {
          // Plano mudou desde o carregamento — exibir upgrade
          setError('Sua assinatura MAX não está mais ativa. Recarregue a página.');
        } else {
          setError(data.message || 'Erro ao comunicar com o Zellador.');
        }
        return;
      }

      // Salvar conversationId para manter o contexto
      if (data.data?.conversationId) {
        setConversationId(data.data.conversationId);
      }

      // Adicionar resposta do Zellador
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: data.data?.response ?? 'Sem resposta' },
      ]);
    } catch {
      setError('Erro de conexão. Verifique sua internet e tente novamente.');
    } finally {
      setLoading(false);
      // Re-focar no textarea
      setTimeout(() => textareaRef.current?.focus(), 100);
    }
  };

  // Enviar com Enter (Shift+Enter para nova linha)
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex flex-col h-[500px] bg-black/40 rounded-xl border border-white/[0.06] overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.06] bg-white/[0.02]">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center">
            <Bot className="w-4 h-4 text-white" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white">Zellador</h3>
            <div className="flex items-center gap-1.5">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-[10px] text-white/50">Online — Plano MAX</span>
            </div>
          </div>
        </div>
        <Badge variant="outline" className="border-emerald-500/30 text-emerald-400 text-[10px]">
          <Shield className="w-3 h-3 mr-1" />
          Protegido
        </Badge>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-thin">
        <AnimatePresence mode="popLayout">
          {messages.map((msg, i) => (
            <motion.div
              key={msg.id ?? i}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                  msg.role === 'user'
                    ? 'bg-emerald-600/20 text-emerald-100 rounded-br-md'
                    : 'bg-white/[0.04] text-white/90 rounded-bl-md'
                }`}
              >
                <div className="whitespace-pre-wrap break-words">
                  {msg.content}
                </div>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>

        {/* Loading indicator */}
        {loading && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex justify-start"
          >
            <div className="bg-white/[0.04] rounded-2xl rounded-bl-md px-4 py-3 flex items-center gap-2">
              <Loader2 className="w-4 h-4 text-emerald-400 animate-spin" />
              <span className="text-xs text-white/50">Zellador está pensando...</span>
            </div>
          </motion.div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Error banner */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="flex items-center gap-2 px-4 py-2 bg-red-500/10 border-t border-red-500/20">
              <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0" />
              <span className="text-xs text-red-300 flex-1">{error}</span>
              <button onClick={() => setError(null)} className="text-red-400 hover:text-red-300">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Input */}
      <div className="border-t border-white/[0.06] p-3">
        <div className="flex items-end gap-2">
          <Textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value.slice(0, 2000))}
            onKeyDown={handleKeyDown}
            placeholder="Pergunte sobre configuração, faturamento, onboarding..."
            className="min-h-[44px] max-h-[120px] resize-none bg-white/[0.04] border-white/[0.08] text-white text-sm placeholder:text-white/30 focus-visible:ring-emerald-500/30"
            rows={1}
            disabled={loading}
          />
          <Button
            onClick={handleSend}
            disabled={!input.trim() || loading}
            className="h-11 w-11 p-0 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg flex-shrink-0"
          >
            {loading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
          </Button>
        </div>
        <div className="flex justify-between mt-1.5 px-1">
          <span className="text-[10px] text-white/30">
            Enter para enviar · Shift+Enter para nova linha
          </span>
          <span className="text-[10px] text-white/30">
            {input.length}/2.000
          </span>
        </div>
      </div>
    </div>
  );
}

// ── Tela de Upgrade (Planos inferiores) ────────────────────────────────────────

function UpgradePrompt({ currentPlan }: { currentPlan: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="flex flex-col items-center justify-center h-[500px] bg-black/40 rounded-xl border border-white/[0.06] p-8 text-center"
    >
      <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center mb-6">
        <Crown className="w-8 h-8 text-white" />
      </div>

      <h3 className="text-xl font-bold text-white mb-2">
        Zellador — Gerente de Treinamento IA
      </h3>
      <p className="text-sm text-white/60 max-w-md mb-6">
        Acesso exclusivo do plano MAX. Tenha um gerente de treinamento dedicado
        que te guia na configuração do dashboard, responde dúvidas sobre faturamento
        e acelera seu onboarding com suporte personalizado via IA.
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-8 w-full max-w-lg">
        {[
          { label: 'Onboarding Personalizado', icon: '🎯' },
          { label: 'Suporte 24/7 via IA', icon: '🤖' },
          { label: 'Mentoria de Configuração', icon: '📊' },
        ].map((feature) => (
          <div
            key={feature.label}
            className="bg-white/[0.04] border border-white/[0.06] rounded-lg px-3 py-3"
          >
            <span className="text-lg mb-1 block">{feature.icon}</span>
            <span className="text-[11px] text-white/70">{feature.label}</span>
          </div>
        ))}
      </div>

      <div className="flex items-center gap-2 mb-4">
        <Badge variant="outline" className="border-white/20 text-white/50 text-[10px]">
          Plano atual: {currentPlan?.toUpperCase() || 'GRATUITO'}
        </Badge>
      </div>

      <Button
        onClick={() => { (window.location.href = '/#precos')} }
        className="bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500 text-white font-semibold px-8 py-2.5 rounded-lg"
      >
        <Crown className="w-4 h-4 mr-2" />
        Fazer Upgrade para MAX
      </Button>

      <p className="text-[10px] text-white/30 mt-3">
        A partir de R$ 797/mês · Cancelamento a qualquer momento
      </p>
    </motion.div>
  );
}
