'use client';

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Send, X, ShieldCheck, CheckCheck } from 'lucide-react';

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
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [hasSentSecondWelcome, setHasSentSecondWelcome] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Inicialização das mensagens no padrão exato solicitado pelo usuário
  useEffect(() => {
    if (messages.length === 0) {
      const now = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      setMessages([
        {
          id: 'welcome-1',
          role: 'assistant',
          content: 'Olá! Eu sou o Seu Zélla, e posso ser o zelador oficial da sua pousada! 😊\nPode me chamar de Zé se preferir.',
          timestamp: now,
        },
      ]);
    }
  }, [messages]);

  // Envio da segunda mensagem exatamente 3 segundos depois com efeito de digitação
  useEffect(() => {
    if (isOpen && !hasSentSecondWelcome && messages.length === 1) {
      setIsTyping(true);
      const timer = setTimeout(() => {
        setIsTyping(false);
        setHasSentSecondWelcome(true);
        const now = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        setMessages((prev) => [
          ...prev,
          {
            id: 'welcome-2',
            role: 'assistant',
            content: 'Como eu posso te ajudar?\nProcurando um zelador para responder todas as suas mensagens de Whatsapp 24h por dia?',
            timestamp: now,
          },
        ]);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [isOpen, hasSentSecondWelcome, messages]);

  // Smart Delay de 8 segundos para o tooltip flutuante
  useEffect(() => {
    const timer = setTimeout(() => {
      if (!isOpen && !hasPrompted) {
        setHasPrompted(true);
      }
    }, 8000);
    return () => clearTimeout(timer);
  }, [isOpen, hasPrompted]);

  // Scroll suave automático
  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isOpen, isTyping]);

  const sendMessage = async (textToSend?: string) => {
    const query = textToSend || input;
    if (!query.trim() || isTyping) return;

    const now = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: query.trim(),
      timestamp: now,
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
      const replyText = data.reply || 'Tô por aqui! Como posso te ajudar na sua pousada?';

      // Simulação de cadência humana natural (delay proporcional ao tamanho do texto: 1.2s a 2.5s)
      const typingDelay = Math.min(2500, Math.max(1200, replyText.length * 20));
      await new Promise((res) => setTimeout(res, typingDelay));

      const assistantMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: replyText,
        recommendedPlan: data.recommendedPlan,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };

      setMessages((prev) => [...prev, assistantMsg]);
    } catch {
      await new Promise((res) => setTimeout(res, 1200));
      setMessages((prev) => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: 'Tô por aqui, meu amigo! Como posso te ajudar hoje?',
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
    <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end pointer-events-auto font-sans">
      {/* Tooltip de Saudação Flutuante Aprimorado com Foto Oficial Zélla */}
      <AnimatePresence>
        {!isOpen && hasPrompted && (
          <motion.div
            initial={{ opacity: 0, y: 12, scale: 0.92 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            onClick={() => setIsOpen(true)}
            className="mb-3 max-w-[300px] cursor-pointer p-3.5 rounded-2xl rounded-br-none bg-[#0d1418]/95 border border-[#00a884]/40 shadow-2xl text-white backdrop-blur-xl relative group hover:border-[#00a884] transition-all duration-300"
          >
            <button
              onClick={(e) => {
                e.stopPropagation();
                setHasPrompted(false);
              }}
              className="absolute -top-2 -left-2 bg-[#202c33] hover:bg-red-500 text-gray-300 hover:text-white p-1 rounded-full text-xs transition-colors z-10"
              aria-label="Fechar notificação"
            >
              <X className="w-3 h-3" />
            </button>
            <div className="flex items-center gap-3">
              <div className="relative shrink-0">
                <img
                  src="/Ze_SeuZella_Chat.png"
                  alt="Seu Zélla Avatar"
                  className="w-11 h-11 rounded-full object-cover border border-[#00a884]/40 shadow-md"
                />
                <span className="absolute bottom-0 right-0 flex h-3 w-3">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-[#00a884] border-2 border-[#0d1418]"></span>
                </span>
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-1.5 mb-0.5">
                  <span className="text-xs font-bold text-[#00a884]">Seu Zélla</span>
                  <span className="text-[10px] bg-[#00a884]/20 text-[#00a884] px-1.5 py-0.2 rounded font-semibold border border-[#00a884]/30">Zelador</span>
                </div>
                <p className="text-[12px] text-gray-200 font-medium leading-tight">
                  &quot;Como vai? Tudo bem? Respondendo muitas mensagens no Whatsapp?&quot;
                </p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Janela de Chat no Formato Exato do Balão do Logo (Com bico no lado esquerdo) */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ duration: 0.25, ease: 'easeOut' }}
            className="w-[92vw] sm:w-[380px] h-[520px] max-h-[85vh] bg-[#0b141a] border border-[#202c33] rounded-[32px] shadow-2xl flex flex-col overflow-hidden relative text-white"
            style={{
              boxShadow: '0 20px 50px rgba(0, 0, 0, 0.8), 0 0 30px rgba(0, 168, 132, 0.15)',
            }}
          >
            {/* Bico Triangular Característico do Logo do Zélla no Lado Esquerdo */}
            <svg
              className="absolute -left-[14px] bottom-16 w-4 h-6 text-[#111b21] pointer-events-none hidden sm:block"
              viewBox="0 0 16 24"
              fill="currentColor"
            >
              <path d="M16,0 L0,12 L16,24 Z" />
            </svg>

            {/* Header Estilo WhatsApp com Foto Oficial Ze_SeuZella_Chat.png */}
            <div className="p-3.5 bg-[#202c33] border-b border-[#2a3942] flex items-center justify-between shadow-md">
              <div className="flex items-center gap-3">
                <div className="relative">
                  <img
                    src="/Ze_SeuZella_Chat.png"
                    alt="Seu Zélla Avatar"
                    className="w-10 h-10 rounded-full object-cover border border-emerald-400/40 shadow-md"
                  />
                  <span className="absolute bottom-0 right-0 h-3 w-3 bg-emerald-400 rounded-full border-2 border-[#202c33]" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-white flex items-center gap-1.5">
                    Seu Zélla <span className="text-[10px] bg-[#00a884]/20 text-[#00a884] px-2 py-0.5 rounded-full font-semibold border border-[#00a884]/30">Zelador</span>
                  </h4>
                  <p className="text-[11px] text-emerald-400 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse" /> online no WhatsApp
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="p-1.5 rounded-full text-gray-400 hover:text-white hover:bg-white/10 transition-colors"
                aria-label="Fechar chat"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Fundo do Chat Estilo WhatsApp (`#111b21`) */}
            <div className="flex-1 p-4 overflow-y-auto space-y-3 bg-[#111b21] bg-opacity-95 scrollbar-thin scrollbar-thumb-[#202c33]">
              {messages.map((msg) => (
                <motion.div
                  key={msg.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}
                >
                  <div
                    className={`max-w-[85%] p-3 rounded-2xl text-xs sm:text-sm leading-relaxed whitespace-pre-wrap relative shadow-sm ${
                      msg.role === 'user'
                        ? 'bg-[#005c4b] text-white rounded-tr-none'
                        : 'bg-[#202c33] text-gray-100 rounded-tl-none border border-white/5'
                    }`}
                  >
                    {msg.content}

                    <div className="flex items-center justify-end gap-1 mt-1 text-[10px] text-gray-400">
                      <span>{msg.timestamp}</span>
                      {msg.role === 'user' && <CheckCheck className="w-3 h-3 text-[#53bdeb]" />}
                    </div>

                    {/* Card de Sugestão de Plano */}
                    {msg.recommendedPlan && (
                      <div className="mt-2.5 p-2.5 rounded-xl bg-[#111b21] border border-[#00a884]/40 text-xs">
                        <p className="font-bold text-[#00a884] mb-1">
                          Plano {msg.recommendedPlan.toUpperCase()} sugerido pelo Zé!
                        </p>
                        <button
                          onClick={scrollToPricing}
                          className="w-full mt-1.5 py-1.5 px-2.5 rounded-lg bg-[#00a884] hover:bg-[#029071] text-slate-950 font-bold text-xs transition-colors flex items-center justify-center gap-1"
                        >
                          Ver Plano {msg.recommendedPlan.toUpperCase()}
                        </button>
                      </div>
                    )}
                  </div>
                </motion.div>
              ))}

              {/* Animação de Digitação em Tempo Real */}
              {isTyping && (
                <div className="flex items-center gap-2 p-3 bg-[#202c33] rounded-2xl rounded-tl-none border border-white/5 w-28">
                  <span className="text-[10px] text-emerald-400 font-medium">Zé digitando</span>
                  <span className="flex gap-1">
                    <span className="w-1.5 h-1.5 bg-[#00a884] rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></span>
                    <span className="w-1.5 h-1.5 bg-[#00a884] rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></span>
                    <span className="w-1.5 h-1.5 bg-[#00a884] rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></span>
                  </span>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Opções Rápidas em Estilo Chip WhatsApp */}
            {messages.length < 4 && !isTyping && (
              <div className="px-3 py-2 bg-[#111b21] border-t border-[#202c33] flex gap-1.5 overflow-x-auto no-scrollbar">
                <button
                  onClick={() => handleQuickOption('Como funciona o WhatsApp 24h por dia?')}
                  className="text-[11px] whitespace-nowrap px-3 py-1.5 rounded-full bg-[#202c33] hover:bg-[#00a884]/20 text-gray-200 hover:text-[#00a884] border border-[#2a3942] hover:border-[#00a884]/50 transition-colors"
                >
                  💬 Como funciona o WhatsApp 24h?
                </button>
                <button
                  onClick={() => handleQuickOption('Tenho 1 imóvel de aluguel por temporada')}
                  className="text-[11px] whitespace-nowrap px-3 py-1.5 rounded-full bg-[#202c33] hover:bg-[#00a884]/20 text-gray-200 hover:text-[#00a884] border border-[#2a3942] hover:border-[#00a884]/50 transition-colors"
                >
                  🏠 Tenho 1 imóvel
                </button>
                <button
                  onClick={() => handleQuickOption('Tenho uma pousada')}
                  className="text-[11px] whitespace-nowrap px-3 py-1.5 rounded-full bg-[#202c33] hover:bg-[#00a884]/20 text-gray-200 hover:text-[#00a884] border border-[#2a3942] hover:border-[#00a884]/50 transition-colors"
                >
                  🏨 Tenho uma pousada
                </button>
              </div>
            )}

            {/* Campo de Entrada de Mensagem */}
            <div className="p-2.5 bg-[#202c33] border-t border-[#2a3942] flex items-center gap-2">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
                placeholder="Escreva uma mensagem..."
                className="flex-1 bg-[#2a3942] text-xs sm:text-sm text-white placeholder-gray-400 px-3.5 py-2.5 rounded-xl focus:outline-none focus:ring-1 focus:ring-[#00a884] transition-all"
              />
              <button
                onClick={() => sendMessage()}
                disabled={!input.trim() || isTyping}
                className="p-2.5 bg-[#00a884] hover:bg-[#029071] text-slate-950 font-bold rounded-xl transition-all disabled:opacity-40 disabled:cursor-not-allowed shadow-md"
                aria-label="Enviar mensagem no WhatsApp"
              >
                <Send className="w-4 h-4 text-slate-950" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Botão Flutuante em Formato Exato do Balão do Logo do Zélla */}
      {!isOpen && (
        <motion.button
          whileHover={{ scale: 1.06 }}
          whileTap={{ scale: 0.94 }}
          onClick={() => setIsOpen(true)}
          className="relative group p-4 rounded-[28px] rounded-bl-none bg-gradient-to-br from-[#00a884] via-[#029071] to-[#005c4b] text-slate-950 shadow-2xl border-2 border-emerald-300/40 flex items-center gap-2.5 font-bold transition-all duration-300"
          style={{
            boxShadow: '0 10px 30px rgba(0, 168, 132, 0.4), 0 0 20px rgba(0, 168, 132, 0.2)',
          }}
          aria-label="Abrir atendimento Seu Zélla no WhatsApp"
        >
          {/* Bico do Balão do Logo no Botão com Foto Oficial Ze_SeuZella_Chat.png */}
          <div className="relative flex items-center justify-center">
            <img
              src="/Ze_SeuZella_Chat.png"
              alt="Seu Zélla"
              className="w-8 h-8 rounded-full object-cover border border-emerald-300/60 shadow-md"
            />
            <span className="absolute -top-1 -right-1 flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-300 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-400 border-2 border-slate-950"></span>
            </span>
          </div>
          <span className="hidden sm:inline text-xs tracking-wide uppercase font-extrabold text-white">
            Conversar com Seu Zé
          </span>
        </motion.button>
      )}
    </div>
  );
}
