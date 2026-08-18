'use client';

import { useRef, useState } from 'react';
import { motion, AnimatePresence, useInView } from 'framer-motion';
import { MessageSquare, Mail, Phone, CheckCircle, Send, AlertTriangle } from 'lucide-react';
import Link from 'next/link';

export function ContactSection() {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, margin: '-100px' });

  const [formState, setFormState] = useState({
    name: '',
    email: '',
    phone: '',
    subject: '',
    message: '',
    honeypot: '',
  });

  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');

  const subjects = [
    'Dúvidas sobre os planos',
    'Demonstração personalizada',
    'Suporte técnico / Integração',
    'Comercial / Parcerias',
    'Outros',
  ];

  const handleChange = (field: keyof typeof formState) => (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    setFormState((prev) => ({ ...prev, [field]: e.target.value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (formState.honeypot) {
      // Bloqueio silencioso de bot
      setStatus('success');
      return;
    }

    setStatus('loading');
    setErrorMessage('');

    try {
      // Sprint 2, Day 11 P0 FIX: Replaced fake setTimeout(1500) with REAL API call.
      // The previous implementation showed false success messages — never persisted
      // the lead anywhere. Now the message is persisted to the DB + logged for follow-up.
      const res = await fetch('/api/landing/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formState),
      });
      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data?.message || 'Falha ao enviar mensagem.');
      }

      setStatus('success');
      
      // Limpar formulário após envio bem-sucedido
      setFormState({
        name: '',
        email: '',
        phone: '',
        subject: '',
        message: '',
        honeypot: '',
      });
    } catch (err) {
      setStatus('error');
      setErrorMessage(
        err instanceof Error
          ? err.message
          : 'Ocorreu um erro ao enviar sua mensagem. Por favor, tente novamente.'
      );
    }
  };

  const inputClass = "w-full rounded-xl border border-white/[0.03] bg-[#070709] px-4 py-3 text-sm text-white placeholder-neutral-600 focus:border-[#4169E1] focus:bg-black focus:outline-none focus:ring-2 focus:ring-[#4169E1]/40 transition-all duration-200";

  return (
    <section ref={ref} id="contato" className="py-28 sm:py-36 lg:py-44 relative overflow-hidden">
      {/* Background gradients */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/3 left-1/4 -translate-x-1/2 w-[500px] h-[500px] rounded-full bg-emerald-500/[0.03] blur-[100px]" />
        <div className="absolute bottom-1/3 right-1/4 translate-x-1/2 w-[500px] h-[500px] rounded-full bg-blue-500/[0.02] blur-[100px]" />
      </div>

      <div className="relative z-10 max-w-5xl mx-auto px-4">
        {/* Section Header */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.7 }}
          className="text-center mb-20"
        >
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 mb-6">
            <MessageSquare className="w-3.5 h-3.5 text-emerald-400" />
            <span className="text-emerald-400 text-xs font-semibold">Fale com o Seu Zélla</span>
          </div>
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-extrabold text-white mb-6">
            Ainda com <span className="text-emerald-400 font-bold">dúvidas?</span>
          </h2>
          <p className="text-neutral-400 text-lg max-w-2xl mx-auto">
            Planos, demonstrações ou parcerias — respondemos em até 1 dia útil.
          </p>
        </motion.div>

        {/* Grid Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-12">
          
          {/* Column Left: Contact Form */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={isInView ? { opacity: 1, x: 0 } : {}}
            transition={{ duration: 0.5 }}
            className="p-10 sm:p-12 rounded-2xl border border-white/[0.03] bg-[#070709] shadow-2xl"
          >
            <AnimatePresence mode="wait">
              {status === 'success' ? (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="flex flex-col items-center justify-center py-16 text-center"
                >
                  <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/10 border border-emerald-500/20 mb-6">
                    <CheckCircle className="h-8 w-8 text-emerald-400" />
                  </div>
                  <h3 className="text-xl font-bold text-white mb-2">Mensagem enviada!</h3>
                  <p className="text-sm text-neutral-400 max-w-md mb-8">
                    Recebemos seu contato e responderemos em até 1 dia útil no e-mail informado.
                  </p>
                  <button
                    type="button"
                    onClick={() => setStatus('idle')}
                    className="text-sm text-emerald-400 hover:text-emerald-300 font-semibold underline underline-offset-2 transition-colors cursor-pointer"
                  >
                    Enviar outra mensagem
                  </button>
                </motion.div>
              ) : (
                <motion.form
                  onSubmit={handleSubmit}
                  className="space-y-7"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                >
                  {/* Honeypot anti-spam */}
                  <input
                    type="text"
                    name="hp"
                    value={formState.honeypot}
                    onChange={handleChange('honeypot')}
                    className="sr-only"
                    tabIndex={-1}
                    autoComplete="off"
                    aria-hidden="true"
                  />

                  {/* Nome e E-mail */}
                  <div className="grid gap-7 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-neutral-300 flex items-center gap-1">
                        Nome <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        minLength={2}
                        placeholder="Seu nome"
                        value={formState.name}
                        onChange={handleChange('name')}
                        className={inputClass}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-neutral-300 flex items-center gap-1">
                        E-mail <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="email"
                        required
                        placeholder="seu@email.com"
                        value={formState.email}
                        onChange={handleChange('email')}
                        className={inputClass}
                      />
                    </div>
                  </div>

                  {/* Telefone e Assunto */}
                  <div className="grid gap-7 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-neutral-300">
                        Telefone / WhatsApp
                      </label>
                      <input
                        type="tel"
                        placeholder="(11) 99999-9999"
                        value={formState.phone}
                        onChange={handleChange('phone')}
                        className={inputClass}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-neutral-300">
                        Assunto
                      </label>
                      <select
                        required
                        value={formState.subject}
                        onChange={handleChange('subject')}
                        className={`${inputClass} appearance-none cursor-pointer bg-[#141414]`}
                      >
                        <option value="" disabled>Selecione...</option>
                        {subjects.map((sub) => (
                          <option key={sub} value={sub} className="bg-[#141414] text-white">
                            {sub}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Mensagem */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-neutral-300 flex items-center gap-1">
                      Mensagem <span className="text-rose-500">*</span>
                    </label>
                    <textarea
                      required
                      minLength={10}
                      maxLength={5000}
                      rows={5}
                      placeholder="Descreva sua dúvida, projeto ou necessidade..."
                      value={formState.message}
                      onChange={handleChange('message')}
                      className={`${inputClass} resize-none`}
                    />
                    <div className="flex justify-between items-center text-[10px] text-neutral-400">
                      <span>Responderemos o mais rápido possível</span>
                      <span>{formState.message.length}/5000</span>
                    </div>
                  </div>

                  {status === 'error' && (
                    <div className="flex items-center gap-2 rounded-xl border border-rose-500/20 bg-rose-500/5 px-4 py-3 text-sm text-rose-400">
                      <AlertTriangle className="h-4 w-4 shrink-0" />
                      <span>{errorMessage}</span>
                    </div>
                  )}

                  {/* Submit Button */}
                  <div className="space-y-4">
                    <button
                      type="submit"
                      disabled={status === 'loading'}
                      className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-600 text-sm font-bold text-white transition-all hover:from-emerald-400 hover:to-emerald-500 disabled:opacity-60 cursor-pointer shadow-lg shadow-emerald-500/20 active:scale-95 duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 focus-visible:ring-offset-black"
                    >
                      {status === 'loading' ? (
                        <>
                          <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                            <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" className="opacity-25" />
                            <path d="M4 12a8 8 0 018-8V0" stroke="currentColor" strokeWidth="4" className="opacity-75" />
                          </svg>
                          Enviando…
                        </>
                      ) : (
                        <>
                          <Send className="h-4 w-4" />
                          Enviar mensagem
                        </>
                      )}
                    </button>
                    <p className="text-center text-[10px] text-neutral-400">
                      Ao enviar, você concorda com nossa{' '}
                      <Link href="/legal/politica-privacidade" className="text-neutral-400 underline underline-offset-2 hover:text-emerald-400 transition-colors">
                        Política de Privacidade
                      </Link>
                      .
                    </p>
                  </div>
                </motion.form>
              )}
            </AnimatePresence>
          </motion.div>

          {/* Column Right: Contact Info Cards */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={isInView ? { opacity: 1, x: 0 } : {}}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="flex flex-col gap-6"
          >
            <div className="p-7 rounded-2xl border border-white/[0.03] bg-[#070709] shadow-2xl">
              <h3 className="mb-6 text-sm font-bold text-white">Canais diretos</h3>
              
              <div className="space-y-6">
                {/* Comercial / Vendas */}
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                    <Mail className="h-4 w-4 text-emerald-400" />
                  </div>
                  <div>
                    <p className="text-[10px] text-neutral-400 uppercase tracking-wider font-semibold">Comercial</p>
                    <a
                      href="mailto:contato@zehla.com.br"
                      className="text-xs text-emerald-400 hover:text-emerald-300 transition-colors font-medium break-all"
                    >
                      contato@zehla.com.br
                    </a>
                  </div>
                </div>

                {/* Suporte Técnico */}
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                    <Mail className="h-4 w-4 text-emerald-400" />
                  </div>
                  <div>
                    <p className="text-[10px] text-neutral-400 uppercase tracking-wider font-semibold">Suporte Técnico</p>
                    <a
                      href="mailto:suporte@zehla.com.br"
                      className="text-xs text-emerald-400 hover:text-emerald-300 transition-colors font-medium break-all"
                    >
                      suporte@zehla.com.br
                    </a>
                  </div>
                </div>

                {/* WhatsApp */}
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                    <Phone className="h-4 w-4 text-emerald-400" />
                  </div>
                  <div>
                    <p className="text-[10px] text-neutral-400 uppercase tracking-wider font-semibold">WhatsApp de Plantão</p>
                    <a
                      href={`https://wa.me/${process.env.NEXT_PUBLIC_WHATSAPP_SUPPORT ?? '5548999990001'}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-emerald-400 hover:text-emerald-300 transition-colors font-medium"
                    >
                      Iniciar conversa
                    </a>
                  </div>
                </div>
              </div>
            </div>

            {/* Atendimento Note */}
            <div className="p-7 rounded-2xl border border-white/[0.02] bg-[#070709]/50 text-neutral-400 text-xs leading-relaxed">
              <span className="font-semibold text-neutral-300 block mb-1">Horário de Atendimento</span>
              De segunda a sexta-feira, das 09h às 18h (Horário de Brasília). Para urgências operacionais de hotéis parceiros, temos plantão 24h via central.
            </div>
          </motion.div>

        </div>
      </div>
    </section>
  );
}
