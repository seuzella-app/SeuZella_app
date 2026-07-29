'use client';

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Bot, 
  Send, 
  Sparkles, 
  ShieldCheck, 
  X, 
  Crown, 
  Zap, 
  FileText, 
  Mail, 
  CheckCircle2,
  HelpCircle,
  MessageSquare
} from 'lucide-react';
import { PlanTier } from '@/lib/plan-features';

export interface ZeladorSuporteModalProps {
  isOpen: boolean;
  onClose: () => void;
  tier?: PlanTier;
  userName?: string;
  propertyName?: string;
}

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  time: string;
}

export function ZeladorSuporteModal({
  isOpen,
  onClose,
  tier = 'pro',
  userName = 'Anfitrião',
  propertyName = 'Pousada Serenity',
}: ZeladorSuporteModalProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [ticketStatus, setTicketStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const [consultoriaReport, setConsultoriaReport] = useState<string | null>(null);
  const [isGeneratingReport, setIsGeneratingReport] = useState(false);
  
  const chatEndRef = useRef<HTMLDivElement>(null);
  const isMax = tier === 'max';

  useEffect(() => {
    if (isOpen && messages.length === 0) {
      setMessages([
        {
          role: 'assistant',
          content: `Olá ${userName}! Sou o Zelador da ferramenta seuzella.com, mas prefiro que você me chame de Zélla! 😊\n\nEstou à sua disposição no plano **${tier.toUpperCase()}** para resolver qualquer dúvida sobre suas fechaduras, WhatsApp, PIX ou relatórios. Como posso te auxiliar hoje?`,
          time: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
        },
      ]);
    }
  }, [isOpen, messages.length, tier, userName]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userText = input.trim();
    setInput('');

    const newMessages: ChatMessage[] = [
      ...messages,
      {
        role: 'user',
        content: userText,
        time: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
      },
    ];

    setMessages(newMessages);
    setIsLoading(true);

    try {
      const res = await fetch('/api/zelador-suporte/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: userText,
          history: newMessages.map((m) => ({ role: m.role, content: m.content })),
          tier,
          userName,
        }),
      });

      const data = await res.json();
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: data.reply || 'Olá! Sou o Zélla e estou aqui para te ajudar.',
          time: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
        },
      ]);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: 'Ocorreu uma oscilação na conexão. Estou à disposição para ajudar nas configurações do seu painel!',
          time: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpenTicket = async () => {
    setTicketStatus('sending');
    try {
      const lastUserMsg = messages.filter((m) => m.role === 'user').pop()?.content || 'Dúvida geral no painel';
      const chatSummary = messages.map((m) => `${m.role.toUpperCase()}: ${m.content}`).join('\n');

      const res = await fetch('/api/zelador-suporte/ticket', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userName,
          propertyName,
          tier,
          issueDescription: lastUserMsg,
          chatSummary,
        }),
      });

      if (res.ok) {
        setTicketStatus('sent');
      } else {
        setTicketStatus('error');
      }
    } catch {
      setTicketStatus('error');
    }
  };

  const handleGenerateConsultoria = async () => {
    setIsGeneratingReport(true);
    try {
      const res = await fetch('/api/zelador-suporte/consultoria', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ propertyName, userName, tier }),
      });

      const data = await res.json();
      if (data.success) {
        setConsultoriaReport(data.report);
      }
    } catch {
      setConsultoriaReport('Falha ao gerar relatório consultivo.');
    } finally {
      setIsGeneratingReport(false);
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          className="relative w-full max-w-3xl bg-neutral-900 border border-neutral-800 rounded-3xl shadow-2xl overflow-hidden text-white flex flex-col h-[650px]"
        >
          {/* Header */}
          <div className="p-5 border-b border-neutral-800 flex items-center justify-between bg-gradient-to-r from-emerald-950/50 via-neutral-900 to-neutral-900">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl text-emerald-400">
                <Bot className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
                  O Zelador Zélla
                  <span className={`text-xs px-2.5 py-0.5 rounded-full font-semibold border flex items-center gap-1 ${
                    isMax 
                      ? 'bg-amber-500/20 text-amber-300 border-amber-500/30' 
                      : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                  }`}>
                    {isMax ? <Crown className="w-3 h-3" /> : <Zap className="w-3 h-3" />}
                    Plano {tier.toUpperCase()}
                  </span>
                </h2>
                <p className="text-xs text-neutral-400">
                  {isMax ? 'Suporte VIP 24/7 + Consultoria Mensal de Receita' : 'Suporte Prioritário 24/7 no seu Dashboard'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {isMax && (
                <button
                  onClick={handleGenerateConsultoria}
                  disabled={isGeneratingReport}
                  className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-amber-300 rounded-xl text-xs font-semibold transition-colors"
                >
                  <FileText className="w-3.5 h-3.5" />
                  {isGeneratingReport ? 'Gerando...' : 'Consultoria VIP'}
                </button>
              )}
              <button
                onClick={onClose}
                className="p-2 text-neutral-400 hover:text-white rounded-full hover:bg-neutral-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Relatório Consultivo MAX Overlay */}
          {consultoriaReport && (
            <div className="p-4 bg-amber-950/40 border-b border-amber-500/20 text-xs font-mono text-amber-200 relative max-h-48 overflow-y-auto">
              <div className="flex justify-between items-center mb-2">
                <span className="font-bold text-amber-400 flex items-center gap-1">
                  <Sparkles className="w-4 h-4" /> Relatório Consultivo VIP Zélla (MAX)
                </span>
                <button onClick={() => setConsultoriaReport(null)} className="text-amber-400 hover:text-white">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <pre className="whitespace-pre-wrap font-mono text-[11px] leading-relaxed text-amber-100">{consultoriaReport}</pre>
            </div>
          )}

          {/* Chat Messages Body */}
          <div className="flex-1 p-5 overflow-y-auto space-y-4 bg-neutral-950/50">
            {messages.map((msg, i) => (
              <div
                key={i}
                className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                {msg.role === 'assistant' && (
                  <div className="w-8 h-8 rounded-full bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0 mt-1">
                    <Bot className="w-4 h-4" />
                  </div>
                )}
                <div
                  className={`max-w-[80%] p-4 rounded-2xl text-sm leading-relaxed ${
                    msg.role === 'user'
                      ? 'bg-emerald-600 text-white rounded-tr-none'
                      : 'bg-neutral-900 border border-neutral-800 text-neutral-200 rounded-tl-none shadow-md'
                  }`}
                >
                  <p className="whitespace-pre-line">{msg.content}</p>
                  <span className="text-[10px] text-neutral-400/80 float-right mt-1 font-mono">{msg.time}</span>
                </div>
              </div>
            ))}
            {isLoading && (
              <div className="flex gap-3 justify-start">
                <div className="w-8 h-8 rounded-full bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0">
                  <Bot className="w-4 h-4 animate-spin" />
                </div>
                <div className="p-3 bg-neutral-900 border border-neutral-800 text-neutral-400 rounded-2xl rounded-tl-none text-xs flex items-center gap-2">
                  <Sparkles className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
                  O Zélla está digitando...
                </div>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>

          {/* Footer Action Bar */}
          <div className="p-4 border-t border-neutral-800 bg-neutral-900 space-y-3">
            {/* Action Bar for Tickets */}
            <div className="flex items-center justify-between text-xs text-neutral-400 px-1">
              <span className="flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                Sigilo corporativo e segurança Zero-Trust
              </span>

              <button
                type="button"
                onClick={handleOpenTicket}
                disabled={ticketStatus === 'sending' || ticketStatus === 'sent'}
                className="flex items-center gap-1.5 text-xs text-emerald-400 hover:text-emerald-300 transition-colors font-medium"
              >
                <Mail className="w-3.5 h-3.5" />
                {ticketStatus === 'sent' 
                  ? 'Chamado Enviado!' 
                  : ticketStatus === 'sending' 
                  ? 'Encaminhando...' 
                  : `Encaminhar para ${isMax ? 'atendimento@seuzella.com' : 'suporte@seuzella.com'}`}
              </button>
            </div>

            {ticketStatus === 'sent' && (
              <p className="text-xs text-emerald-400 flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" />
                Seu chamado foi encaminhado para a equipe corporativa {isMax ? 'VIP' : 'Seu Zélla'} com o histórico desta conversa!
              </p>
            )}

            {/* Message Input */}
            <form onSubmit={handleSend} className="flex gap-2">
              <input
                type="text"
                placeholder="Pergunte ao Zélla sobre qualquer função do seu painel..."
                value={input}
                onChange={(e) => setInput(e.target.value)}
                className="flex-1 bg-neutral-950 border border-neutral-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-emerald-500"
              />
              <button
                type="submit"
                disabled={!input.trim() || isLoading}
                className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-medium text-sm flex items-center gap-2 transition-colors disabled:opacity-50"
              >
                <Send className="w-4 h-4" />
                Enviar
              </button>
            </form>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
