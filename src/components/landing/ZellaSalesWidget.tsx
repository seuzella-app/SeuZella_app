'use client';

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Send, X, Bot, Sparkles, MapPin, Building2, ShieldCheck, CheckCircle2 } from 'lucide-react';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  recommendedPlan?: 'lite' | 'pro' | 'max';
  timestamp: string;
}

export function ZellaSalesWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [hasPrompted, setHasPrompted] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome-1',
      role: 'assistant',
      content: 'Olá! Sou o Seu Zélla, zelador oficial das pousadas e imóveis do Brasil! 😊\n\nTô a postos pra te ajudar! Qual cidade fica sua pousada e quantos quartos você administra hoje?',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    },
  ]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-prompt (Smart Delay de 8 segundos)
  useEffect(() => {
    const timer = setTimeout(() => {
      if (!isOpen && !hasPrompted) {
        setHasPrompted(true);
      }
    }, 8000);
    return () => clearTimeout(timer);
  }, [isOpen, hasPrompted]);

  // Scroll suave até o final das mensagens
  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isOpen, isTyping]);

  const sendMessage = async (textToSend?: string) => {
    const query = textToSend || input;
    if (!query.trim() || isTyping) return;

    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: query.trim(),
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMsg]);
    if (!textToSend) setInput('');
    setIsTyping(true);

    try {
      const response = await fetch('/api/landing/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: query.trim(),
          history: messages.map((m) => ({ role: m.role, content: m.content })),
        }),
      });

      const data = await response.json();

      const assistantMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: data.reply || 'Olá, meu amigo anfitrião! Tô a postos pra te ajudar no que precisar!',
        recommendedPlan: data.recommendedPlan,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };

      setMessages((prev) => [...prev, assistantMsg]);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: 'Opa, tive uma pequena oscilação aqui na conexão, mas o Seu Zélla tá pronto! Como posso te ajudar na sua pousada?',
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ]);
    } finally {
      setIsTyping(false);
    }
  };

  const handleQuickOption = (optionText: string) => {
    if (!isOpen) setIsOpen(true);
    sendMessage(optionText);
  };

  const scrollToPricing = () => {
    const el = document.querySelector('#precos');
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
      setIsOpen(false);
    }
  };

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end pointer-events-auto">
      <AnimatePresence>
        {/* Tooltip de Balãozinho de Entrada (Gatilho de 8s) */}
        {!isOpen && hasPrompted && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            onClick={() => setIsOpen(true)}
            className="mb-3 max-w-xs cursor-pointer p-4 rounded-2xl rounded-br-none bg-[#12141c] border border-amber-500/40 shadow-2xl text-white backdrop-blur-xl relative group hover:border-amber-400 transition-all duration-300"
          >
            <button
              onClick={(e) => {
                e.stopPropagation();
                setHasPrompted(false);
              }}
              className="absolute -top-2 -left-2 bg-[#1f2430] hover:bg-red-500 text-gray-300 hover:text-white p-1 rounded-full text-xs transition-colors"
            >
              <X className="w-3 h-3" />
            </button>
            <div className="flex items-center gap-2 mb-1">
              <span className="flex h-2 w-2 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              <span className="text-xs font-semibold text-amber-400 flex items-center gap-1">
                <Sparkles className="w-3 h-3" /> Seu Zélla a postos
              </span>
            </div>
            <p className="text-xs text-gray-200 font-medium leading-relaxed">
              &quot;Olá! Sou o Seu Zélla! Quer saber qual o plano perfeito pra sua pousada ou tirar alguma dúvida? Clica aqui! 😊&quot;
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {/* Janela do Pop-up em Formato do Balão do Logo do Zélla */}
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ duration: 0.25, ease: 'easeOut' }}
            className="w-[92vw] sm:w-[400px] h-[520px] max-h-[85vh] bg-[#0c0e14] border border-amber-500/30 rounded-[32px] rounded-br-[4px] shadow-2xl flex flex-col overflow-hidden backdrop-blur-2xl mb-4 relative text-white"
            style={{
              boxShadow: '0 20px 50px rgba(0, 0, 0, 0.7), 0 0 30px rgba(245, 158, 11, 0.15)',
            }}
          >
            {/* Header do Balão Zélla */}
            <div className="p-4 bg-gradient-to-r from-[#171924] via-[#12141d] to-[#0c0e14] border-b border-white/10 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="relative">
                  <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center text-slate-950 font-bold shadow-md">
                    <Bot className="w-6 h-6 text-slate-950" />
                  </div>
                  <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 bg-emerald-500 rounded-full border-2 border-[#0c0e14]" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-white flex items-center gap-1.5">
                    Seu Zélla <span className="text-[10px] bg-amber-500/20 text-amber-300 px-2 py-0.5 rounded-full font-medium border border-amber-500/30">Zelador Oficial</span>
                  </h4>
                  <p className="text-[11px] text-gray-400 flex items-center gap-1">
                    <ShieldCheck className="w-3 h-3 text-emerald-400" /> Atendimento & Vendas Humanizado
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="p-1.5 rounded-xl text-gray-400 hover:text-white hover:bg-white/10 transition-colors"
                aria-label="Fechar chat"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Corpo de Mensagens */}
            <div className="flex-1 p-4 overflow-y-auto space-y-3 scrollbar-thin scrollbar-thumb-amber-500/20">
              {messages.map((msg) => (
                <motion.div
                  key={msg.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}
                >
                  <div
                    className={`max-w-[85%] p-3.5 rounded-2xl text-xs sm:text-sm leading-relaxed whitespace-pre-wrap ${
                      msg.role === 'user'
                        ? 'bg-gradient-to-r from-amber-500 to-amber-600 text-slate-950 font-medium rounded-br-none shadow-lg'
                        : 'bg-[#181a26] text-gray-100 border border-white/10 rounded-bl-none shadow-md'
                    }`}
                  >
                    {msg.content}

                    {/* Card de Recomendação de Plano quando sugerido */}
                    {msg.recommendedPlan && (
                      <div className="mt-3 p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-200 text-xs">
                        <div className="font-bold text-amber-400 flex items-center gap-1.5 mb-1">
                          <CheckCircle2 className="w-4 h-4 text-amber-400" /> Recomendação do Zélla: Plano {msg.recommendedPlan.toUpperCase()}
                        </div>
                        <p className="text-[11px] text-gray-300 mb-2">
                          Este é o plano ideal para a quantidade de acomodações e automação que sua pousada precisa.
                        </p>
                        <button
                          onClick={scrollToPricing}
                          className="w-full py-1.5 px-3 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs transition-colors flex items-center justify-center gap-1"
                        >
                          Ver Plano {msg.recommendedPlan.toUpperCase()} na Tabela
                        </button>
                      </div>
                    )}
                  </div>
                  <span className="text-[10px] text-gray-500 mt-1 px-1">{msg.timestamp}</span>
                </motion.div>
              ))}

              {isTyping && (
                <div className="flex items-center gap-2 p-3 bg-[#181a26] border border-white/10 rounded-2xl rounded-bl-none w-24">
                  <span className="text-[10px] text-amber-400 font-medium">Zélla digitando</span>
                  <span className="flex gap-1">
                    <span className="w-1.5 h-1.5 bg-amber-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></span>
                    <span className="w-1.5 h-1.5 bg-amber-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></span>
                    <span className="w-1.5 h-1.5 bg-amber-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></span>
                  </span>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Sugestões Rápidas de Diálogo */}
            {messages.length < 5 && !isTyping && (
              <div className="px-3 py-2 bg-[#0a0b10] border-t border-white/5 flex gap-1.5 overflow-x-auto no-scrollbar">
                <button
                  onClick={() => handleQuickOption('Qual o plano ideal pra minha pousada?')}
                  className="text-[11px] whitespace-nowrap px-2.5 py-1 rounded-full bg-white/5 hover:bg-amber-500/20 text-gray-300 hover:text-amber-300 border border-white/10 hover:border-amber-500/40 transition-colors flex items-center gap-1"
                >
                  <Building2 className="w-3 h-3" /> Qual o plano ideal?
                </button>
                <button
                  onClick={() => handleQuickOption('Tenho pousada em Ubatuba')}
                  className="text-[11px] whitespace-nowrap px-2.5 py-1 rounded-full bg-white/5 hover:bg-amber-500/20 text-gray-300 hover:text-amber-300 border border-white/10 hover:border-amber-500/40 transition-colors flex items-center gap-1"
                >
                  <MapPin className="w-3 h-3" /> Exemplo por cidade
                </button>
              </div>
            )}

            {/* Campo de Envio de Mensagem */}
            <div className="p-3 bg-[#11131c] border-t border-white/10 flex items-center gap-2">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
                placeholder="Pergunte pro Seu Zélla..."
                className="flex-1 bg-[#1a1d2b] text-xs sm:text-sm text-white placeholder-gray-500 px-3.5 py-2.5 rounded-xl border border-white/10 focus:outline-none focus:border-amber-500 transition-all"
              />
              <button
                onClick={() => sendMessage()}
                disabled={!input.trim() || isTyping}
                className="p-2.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-md"
                aria-label="Enviar mensagem"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Botão Flutuante em Formato do Balão do Logo do Zélla */}
      {!isOpen && (
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => setIsOpen(true)}
          className="relative group p-4 rounded-3xl rounded-br-[6px] bg-gradient-to-br from-amber-400 via-amber-500 to-amber-600 text-slate-950 shadow-2xl border-2 border-amber-300/50 flex items-center gap-2.5 font-bold transition-all duration-300"
          style={{
            boxShadow: '0 10px 30px rgba(245, 158, 11, 0.4), 0 0 15px rgba(245, 158, 11, 0.3)',
          }}
          aria-label="Abrir atendimento Seu Zélla"
        >
          <div className="relative flex items-center justify-center">
            <Bot className="w-7 h-7 text-slate-950" />
            <span className="absolute -top-1 -right-1 flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500 border-2 border-slate-950"></span>
            </span>
          </div>
          <span className="hidden sm:inline text-xs tracking-wide uppercase font-extrabold text-slate-950">
            Falar com Seu Zélla
          </span>
        </motion.button>
      )}
    </div>
  );
}
