'use client';

import { useState, Suspense, useEffect, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Toaster, toast } from 'sonner';
import { ZellaLogo } from '@/components/brand/ZellaLogo';
import {
  Mail, Lock, User, Loader2, Eye, EyeOff,
  ChevronDown, CheckCircle2, ArrowRight, ShieldCheck, Sparkles,
  LayoutDashboard,
} from 'lucide-react';

// ── Google SVG Icon 
function GoogleIcon({ className = '' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
    </svg>
  );
}

// ── Animation Variants 
const fadeUp = {
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -12 },
};

const stagger = {
  animate: { transition: { staggerChildren: 0.06 } },
};

// ── Main Page 
export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-[#080b14] p-4">
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="h-8 w-8 animate-spin text-emerald-400" />
            <span className="text-zinc-500 text-sm">Carregando...</span>
          </div>
        </div>
      }
    >
      <LoginContent />
    </Suspense>
  );
}

type ViewMode = 'signin' | 'signup' | 'magic-sent';

function LoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  // Se login for 123/123, redireciona para ZCC em vez de DDC
  const callbackUrl = searchParams.get('callbackUrl') || '/ddc';
  const magicLoginParam = searchParams.get('magicLogin');
  const magicEmailParam = searchParams.get('email');
  const magicRedirectParam = searchParams.get('redirect');
  const errorParam = searchParams.get('error');

  // Determine context from callback URL
  const isZCC = callbackUrl.startsWith('/zcc');
  const isDDC = callbackUrl.startsWith('/ddc');
  const contextLabel = isZCC ? 'ZCC — Central Control' : isDDC ? 'DDC — Painel do Cliente' : 'Dashboard';
  const contextIcon = isZCC ? ShieldCheck : LayoutDashboard;

  const [isLoading, setIsLoading] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>('signin');
  const [showCredentials, setShowCredentials] = useState(isZCC); // Auto-expand for ZCC
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Sign in form
  const [credentialData, setCredentialData] = useState({ email: '', password: '' });

  // Magic link form
  const [magicEmail, setMagicEmailState] = useState('');
  const [magicDevUrl, setMagicDevUrl] = useState<string | null>(null);

  // Sign up form
  const [signUpData, setSignUpData] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
    phone: '',
    propertyName: '',
    niche: 'pousada' as 'pousada' | 'airbnb',
  });
  const [agreedTerms, setAgreedTerms] = useState(false);

  // Handle magic link auto-login
  useEffect(() => {
    if (magicLoginParam === 'true' && magicEmailParam) {
      const doMagicLogin = async () => {
        setIsLoading(true);
        try {
          const response = await fetch('/api/auth/magic-verify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: magicEmailParam }),
          });

          if (response.ok) {
            const data = await response.json();
            if (data.tempPassword) {
              const { signIn } = await import('next-auth/react');
              const result = await signIn('credentials', {
                email: magicEmailParam,
                password: data.tempPassword,
                redirect: false,
              });
              if (result?.ok) {
                toast.success('Acesso autorizado!');
                await new Promise(r => setTimeout(r, 500));
                const redirectPath = magicRedirectParam || '/ddc';
                router.push(redirectPath);
                router.refresh();
              } else {
                toast.error('Credenciais inválidas.');
              }
            }
          } else {
            toast.error('Link expirado ou inválido.');
          }
        } catch {
          toast.error('Erro de conexão.');
        } finally {
          setIsLoading(false);
        }
      };
      doMagicLogin();
    }
  }, [magicLoginParam, magicEmailParam, magicRedirectParam, router]);

  // Show error from URL params
  useEffect(() => {
    if (errorParam) {
      const errorMessages: Record<string, string> = {
        'invalid-token': 'Token inválido. Solicite um novo link.',
        'token-not-found': 'Link não encontrado ou já usado.',
        'token-expired': 'Link expirado. Solicite um novo.',
        'service-unavailable': 'Serviço indisponível no momento.',
        'internal-error': 'Erro interno. Tente novamente.',
      };
      toast.error(errorMessages[errorParam] || 'Erro na autenticação.');
    }
  }, [errorParam]);

  // ── Magic Link 
  const handleMagicLink = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!magicEmail || !magicEmail.includes('@')) {
      toast.error('Digite um e-mail válido.');
      return;
    }
    setIsLoading(true);
    try {
      const response = await fetch('/api/auth/magic-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: magicEmail }),
      });
      const data = await response.json();
      if (response.ok) {
        setViewMode('magic-sent');
        if (data.devUrl) setMagicDevUrl(data.devUrl);
        toast.success('Link de acesso enviado!');
      } else {
        toast.error(data.error || 'Erro ao enviar link.');
      }
    } catch {
      toast.error('Erro de conexão.');
    } finally {
      setIsLoading(false);
    }
  }, [magicEmail]);

  // ── Credentials Login 
  const handleCredentialLogin = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!credentialData.email || !credentialData.password) {
      toast.error('Preencha login e senha.');
      return;
    }
    setIsLoading(true);
    try {
      const { signIn } = await import('next-auth/react');
      const result = await signIn('credentials', {
        email: credentialData.email,
        password: credentialData.password,
        redirect: false,
      });
      if (result?.error) {
        toast.error(result.error === 'CredentialsSignin' ? 'Login ou senha incorretos.' : `Erro: ${result.error}`);
      } else if (result?.ok) {
        toast.success('Acesso autorizado!');
        await new Promise(r => setTimeout(r, 500));
        // Se login for 123/123, redireciona para ZCC em vez de DDC
        const redirectPath = credentialData.email === '123' ? '/zcc' : callbackUrl;
        router.push(redirectPath);
        router.refresh();
      }
    } catch {
      toast.error('Erro de conexão.');
    } finally {
      setIsLoading(false);
    }
  }, [credentialData, callbackUrl, router]);

  // ── Google OAuth 
  const handleGoogleLogin = useCallback(async () => {
    setIsLoading(true);
    try {
      const { signIn } = await import('next-auth/react');
      await signIn('google', { callbackUrl });
    } catch {
      toast.error('Erro ao conectar com Google.');
      setIsLoading(false);
    }
  }, [callbackUrl]);

  // ── Register 
  const handleRegister = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (signUpData.password !== signUpData.confirmPassword) {
      toast.error('As senhas não coincidem.');
      return;
    }
    if (signUpData.password.length < 6) {
      toast.error('Senha deve ter pelo menos 6 caracteres.');
      return;
    }
    if (!agreedTerms) {
      toast.error('Aceite os Termos de Uso.');
      return;
    }
    setIsLoading(true);
    try {
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: signUpData.name,
          email: signUpData.email,
          password: signUpData.password,
          phone: signUpData.phone,
          pousadaName: signUpData.propertyName,
          niche: signUpData.niche,
        }),
      });
      const data = await response.json();
      if (response.ok) {
        toast.success('Conta criada!');
        const { signIn } = await import('next-auth/react');
        const result = await signIn('credentials', {
          email: signUpData.email,
          password: signUpData.password,
          redirect: false,
        });
        if (result?.ok) {
          const redirectPath = signUpData.niche === 'airbnb' ? '/ddc/airbnb' : '/ddc/pousada';
          router.push(redirectPath);
          router.refresh();
        }
      } else {
        toast.error(data.error || 'Erro ao criar conta.');
      }
    } catch {
      toast.error('Erro ao criar conta.');
    } finally {
      setIsLoading(false);
    }
  }, [signUpData, agreedTerms, router]);

  // ── Loading overlay 
  if (magicLoginParam === 'true' && isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#080b14]">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-emerald-400" />
          <span className="text-zinc-500 text-sm">Verificando acesso...</span>
        </div>
        <Toaster position="top-center" richColors />
      </div>
    );
  }

  const ContextIcon = contextIcon;

  return (
    <div className="min-h-screen w-full flex flex-col items-center justify-center bg-[#080b14] text-white px-4 py-8">
      <Toaster position="top-center" richColors />

      {/* Background — subtle grid pattern, NO marketing gradients */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden opacity-30">
        <div className="absolute inset-0" style={{
          backgroundImage: 'radial-gradient(circle at 1px 1px, rgba(255,255,255,0.03) 1px, transparent 0)',
          backgroundSize: '40px 40px',
        }} />
      </div>

      <div className="relative w-full max-w-md mx-auto">
        <AnimatePresence mode="wait">
          {/* ══ SIGN IN VIEW  */}
          {viewMode === 'signin' && (
            <motion.div
              key="signin"
              variants={stagger}
              initial="initial"
              animate="animate"
              exit="exit"
              className="flex flex-col items-center gap-6"
            >
              {/* Logo + Context Badge */}
              <motion.div variants={fadeUp} className="flex flex-col items-center gap-3">
                <ZellaLogo size={56} />
                <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/[0.04] border border-white/[0.06]">
                  <ContextIcon className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="text-[10px] font-mono font-bold tracking-widest text-emerald-400 uppercase">{contextLabel}</span>
                </div>
              </motion.div>

              {/* Title — Dashboard Auth Gate */}
              <motion.div variants={fadeUp} className="text-center">
                <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
                  Acesse seu Dashboard
                </h1>
                <p className="text-zinc-500 text-sm mt-1">
                  Faça login para entrar no painel
                </p>
              </motion.div>

              {/* Google OAuth */}
              <motion.div variants={fadeUp} className="w-full">
                <Button
                  type="button"
                  variant="outline"
                  className="w-full h-12 bg-[#0d1117] border-white/[0.08] hover:bg-[#161b22] hover:border-white/[0.14] text-white font-medium rounded-xl cursor-pointer transition-all"
                  onClick={handleGoogleLogin}
                  disabled={isLoading}
                >
                  <GoogleIcon className="w-5 h-5 mr-3" />
                  Continuar com Google
                </Button>
              </motion.div>

              {/* Divider */}
              <motion.div variants={fadeUp} className="w-full flex items-center gap-3">
                <div className="flex-1 h-px bg-white/[0.06]" />
                <span className="text-zinc-600 text-[10px] font-mono tracking-wider uppercase">ou e-mail</span>
                <div className="flex-1 h-px bg-white/[0.06]" />
              </motion.div>

              {/* Magic Link Form */}
              <motion.form variants={fadeUp} onSubmit={handleMagicLink} className="w-full space-y-3">
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-600" />
                  <Input
                    type="email"
                    placeholder="seu@email.com"
                    className="pl-10 h-12 bg-[#0d1117] border-white/[0.08] focus:border-emerald-500/50 focus:ring-emerald-500/20 text-white placeholder:text-zinc-600 rounded-xl"
                    value={magicEmail}
                    onChange={(e) => setMagicEmailState(e.target.value)}
                  />
                </div>
                <Button
                  type="submit"
                  className="w-full h-12 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl cursor-pointer active:scale-[0.98] transition-all"
                  disabled={isLoading || !magicEmail}
                >
                  {isLoading ? (
                    <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Enviando...</>
                  ) : (
                    <>
                      <Sparkles className="mr-2 h-4 w-4" />
                      Enviar link de acesso
                    </>
                  )}
                </Button>
              </motion.form>

              {/* Credentials toggle */}
              <motion.div variants={fadeUp} className="w-full flex items-center gap-3">
                <div className="flex-1 h-px bg-white/[0.06]" />
                <button
                  type="button"
                  className="text-zinc-600 text-[10px] font-mono tracking-wider uppercase hover:text-zinc-400 cursor-pointer flex items-center gap-1 transition-colors"
                  onClick={() => setShowCredentials(!showCredentials)}
                >
                  login com senha
                  <ChevronDown className={`h-3 w-3 transition-transform ${showCredentials ? 'rotate-180' : ''}`} />
                </button>
                <div className="flex-1 h-px bg-white/[0.06]" />
              </motion.div>

              {/* Expandable Credentials Form */}
              <AnimatePresence>
                {showCredentials && (
                  <motion.form
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.25 }}
                    onSubmit={handleCredentialLogin}
                    data-credential-form
                    className="w-full space-y-3 overflow-hidden"
                  >
                    <div className="relative">
                      <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-600" />
                      <Input
                        type="text"
                        placeholder="E-mail"
                        className="pl-10 h-11 bg-[#0d1117] border-white/[0.08] focus:border-emerald-500/50 focus:ring-emerald-500/20 text-white placeholder:text-zinc-600 rounded-xl"
                        value={credentialData.email}
                        onChange={(e) => setCredentialData({ ...credentialData, email: e.target.value })}
                      />
                    </div>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-600" />
                      <Input
                        type={showPassword ? 'text' : 'password'}
                        placeholder="Senha"
                        className="pl-10 pr-10 h-11 bg-[#0d1117] border-white/[0.08] focus:border-emerald-500/50 focus:ring-emerald-500/20 text-white placeholder:text-zinc-600 rounded-xl"
                        value={credentialData.password}
                        onChange={(e) => setCredentialData({ ...credentialData, password: e.target.value })}
                      />
                      <button
                        type="button"
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-600 hover:text-zinc-400 cursor-pointer"
                        onClick={() => setShowPassword(!showPassword)}
                      >
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                    <Button
                      type="submit"
                      variant="outline"
                      className="w-full h-11 bg-[#0d1117] border-white/[0.08] hover:bg-[#161b22] text-white font-medium rounded-xl cursor-pointer transition-all"
                      disabled={isLoading}
                    >
                      {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                      Entrar
                    </Button>
                  </motion.form>
                )}
              </AnimatePresence>

              {/* ── Demo Quick Login  */}
              {isZCC && (
                <motion.div variants={fadeUp} className="w-full">
                  <div className="p-3 rounded-xl bg-emerald-500/[0.06] border border-emerald-500/[0.12] space-y-2">
                    <p className="text-emerald-400 text-xs font-medium text-center">
                      Acesso rápido ao ZCC — Modo Demonstração
                    </p>
                    <Button
                      type="button"
                      className="w-full h-10 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold rounded-lg cursor-pointer active:scale-[0.97] transition-all text-sm"
                      disabled={isLoading}
                      onClick={async () => {
                        setIsLoading(true);
                        try {
                          const { signIn } = await import('next-auth/react');
                          const result = await signIn('credentials', {
                            email: 'zella@zella.com.br',
                            password: '123',
                            redirect: false,
                          });
                          if (result?.ok) {
                            toast.success('Acesso ZCC autorizado!');
                            await new Promise(r => setTimeout(r, 500));
                            router.push('/zcc');
                            router.refresh();
                          } else {
                            toast.error(result?.error === 'CredentialsSignin' ? 'Credenciais demo não encontradas. Execute o seed primeiro.' : `Erro: ${result?.error}`);
                          }
                        } catch {
                          toast.error('Erro de conexão.');
                        } finally {
                          setIsLoading(false);
                        }
                      }}
                    >
                      {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <LayoutDashboard className="mr-2 h-4 w-4" />}
                      Entrar no ZCC (login: zella@zella.com.br / senha: 123)
                    </Button>
                  </div>
                </motion.div>
              )}

              {/* ── Demo Quick Login for DDC  */}
              {!isZCC && (
                <motion.div variants={fadeUp} className="w-full">
                  <button
                    type="button"
                    className="w-full text-zinc-500 text-[10px] font-mono tracking-wider uppercase hover:text-zinc-400 cursor-pointer flex items-center justify-center gap-1 transition-colors py-1"
                    onClick={() => {
                      setCredentialData({ email: 'demo@pousada.com.br', password: 'Demo@123' });
                      setShowCredentials(true);
                    }}
                  >
                    acesso demo (demo@pousada.com.br / Demo@123)
                  </button>
                </motion.div>
              )}

              {/* ── ZCC Admin Quick Login (123/123)  */}
              <motion.div variants={fadeUp} className="w-full">
                <button
                  type="button"
                  className="w-full text-amber-500/60 text-[10px] font-mono tracking-wider uppercase hover:text-amber-400 cursor-pointer flex items-center justify-center gap-1 transition-colors py-1"
                  onClick={() => {
                    setCredentialData({ email: '123', password: '123' });
                    setShowCredentials(true);
                  }}
                >
                  acesso ZCC admin (123 / 123)
                </button>
              </motion.div>

              {/* Sign up link */}
              <motion.div variants={fadeUp} className="text-center pt-2">
                <p className="text-zinc-600 text-sm">
                  Não tem conta?{' '}
                  <button
                    type="button"
                    onClick={() => { setViewMode('signup'); setShowPassword(false); setShowConfirmPassword(false); }}
                    className="text-emerald-400 hover:underline font-semibold cursor-pointer"
                  >
                    Criar conta
                  </button>
                </p>
              </motion.div>
            </motion.div>
          )}

          {/* ══ MAGIC LINK SENT VIEW  */}
          {viewMode === 'magic-sent' && (
            <motion.div
              key="magic-sent"
              variants={stagger}
              initial="initial"
              animate="animate"
              exit="exit"
              className="flex flex-col items-center gap-6"
            >
              <motion.div
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: 'spring', stiffness: 200, damping: 15 }}
                className="w-20 h-20 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center"
              >
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ delay: 0.2, type: 'spring', stiffness: 300, damping: 12 }}
                >
                  <CheckCircle2 className="w-10 h-10 text-emerald-400" />
                </motion.div>
              </motion.div>

              <motion.div variants={fadeUp} className="text-center">
                <h2 className="text-xl font-bold text-white">Link de acesso enviado!</h2>
                <p className="text-zinc-500 text-sm mt-2">
                  Enviamos para <span className="text-emerald-400 font-medium">{magicEmail}</span>
                </p>
                <p className="text-zinc-600 text-xs mt-1">
                  Verifique sua caixa de entrada e clique no link.
                </p>
              </motion.div>

              {magicDevUrl && (
                <motion.div variants={fadeUp} className="w-full">
                  <div className="bg-emerald-500/[0.06] border border-emerald-500/20 rounded-xl p-4 space-y-2">
                    <p className="text-emerald-400 text-xs font-semibold flex items-center gap-1.5">
                      <Sparkles className="h-3 w-3" /> Modo Dev
                    </p>
                    <a
                      href={magicDevUrl}
                      className="text-emerald-400 text-xs underline break-all hover:text-emerald-300 transition-colors"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      {magicDevUrl}
                    </a>
                  </div>
                </motion.div>
              )}

              <motion.div variants={fadeUp} className="w-full space-y-3">
                <Button
                  type="button"
                  variant="outline"
                  className="w-full h-12 bg-[#0d1117] border-white/[0.08] hover:bg-[#161b22] text-white font-medium rounded-xl cursor-pointer transition-all"
                  onClick={async () => {
                    setIsLoading(true);
                    try {
                      const response = await fetch('/api/auth/magic-link', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ email: magicEmail }),
                      });
                      const data = await response.json();
                      if (response.ok) {
                        toast.success('Link reenviado!');
                        if (data.devUrl) setMagicDevUrl(data.devUrl);
                      } else {
                        toast.error(data.error || 'Erro ao reenviar.');
                      }
                    } catch {
                      toast.error('Erro de conexão.');
                    } finally {
                      setIsLoading(false);
                    }
                  }}
                  disabled={isLoading}
                >
                  {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Mail className="mr-2 h-4 w-4" />}
                  Reenviar link
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  className="w-full text-zinc-500 hover:text-white cursor-pointer"
                  onClick={() => { setViewMode('signin'); setMagicDevUrl(null); }}
                >
                  Voltar ao login
                </Button>
              </motion.div>
            </motion.div>
          )}

          {/* ══ SIGN UP VIEW  */}
          {viewMode === 'signup' && (
            <motion.div
              key="signup"
              variants={stagger}
              initial="initial"
              animate="animate"
              exit="exit"
              className="flex flex-col items-center gap-5"
            >
              <motion.div variants={fadeUp} className="flex flex-col items-center gap-3">
                <ZellaLogo size={48} />
                <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/[0.04] border border-white/[0.06]">
                  <LayoutDashboard className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="text-[10px] font-mono font-bold tracking-widest text-emerald-400 uppercase">DDC — Painel do Cliente</span>
                </div>
              </motion.div>

              <motion.div variants={fadeUp} className="text-center">
                <h1 className="text-xl font-bold text-white tracking-tight">Criar conta</h1>
                <p className="text-zinc-500 text-sm mt-1">Ative seu dashboard Zélla</p>
              </motion.div>

              {/* Google OAuth */}
              <motion.div variants={fadeUp} className="w-full">
                <Button
                  type="button"
                  variant="outline"
                  className="w-full h-12 bg-[#0d1117] border-white/[0.08] hover:bg-[#161b22] hover:border-white/[0.14] text-white font-medium rounded-xl cursor-pointer transition-all"
                  onClick={handleGoogleLogin}
                  disabled={isLoading}
                >
                  <GoogleIcon className="w-5 h-5 mr-3" />
                  Cadastrar com Google
                </Button>
              </motion.div>

              {/* Divider */}
              <motion.div variants={fadeUp} className="w-full flex items-center gap-3">
                <div className="flex-1 h-px bg-white/[0.06]" />
                <span className="text-zinc-600 text-[10px] font-mono tracking-wider uppercase">ou preencha</span>
                <div className="flex-1 h-px bg-white/[0.06]" />
              </motion.div>

              {/* Registration Form */}
              <motion.form variants={fadeUp} onSubmit={handleRegister} className="w-full space-y-3">
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-600" />
                  <Input
                    type="text"
                    placeholder="Seu nome"
                    className="pl-10 h-11 bg-[#0d1117] border-white/[0.08] focus:border-emerald-500/50 focus:ring-emerald-500/20 text-white placeholder:text-zinc-600 rounded-xl"
                    value={signUpData.name}
                    onChange={(e) => setSignUpData({ ...signUpData, name: e.target.value })}
                    required
                  />
                </div>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-600" />
                  <Input
                    type="email"
                    placeholder="seu@email.com"
                    className="pl-10 h-11 bg-[#0d1117] border-white/[0.08] focus:border-emerald-500/50 focus:ring-emerald-500/20 text-white placeholder:text-zinc-600 rounded-xl"
                    value={signUpData.email}
                    onChange={(e) => setSignUpData({ ...signUpData, email: e.target.value })}
                    required
                  />
                </div>

                {/* Niche Selector — Pousada vs Airbnb */}
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setSignUpData({ ...signUpData, niche: 'pousada' })}
                    className={`flex flex-col items-center gap-1 p-3 rounded-xl border transition-all cursor-pointer ${
                      signUpData.niche === 'pousada'
                        ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                        : 'bg-[#0d1117] border-white/[0.06] text-zinc-500 hover:border-white/[0.12]'
                    }`}
                  >
                    <span className="text-lg">🏨</span>
                    <span className="text-xs font-bold">Pousada</span>
                    <span className="text-[9px] opacity-60">LITE · PRO · MAX</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setSignUpData({ ...signUpData, niche: 'airbnb' })}
                    className={`flex flex-col items-center gap-1 p-3 rounded-xl border transition-all cursor-pointer ${
                      signUpData.niche === 'airbnb'
                        ? 'bg-amber-500/10 border-amber-500/30 text-amber-400'
                        : 'bg-[#0d1117] border-white/[0.06] text-zinc-500 hover:border-white/[0.12]'
                    }`}
                  >
                    <span className="text-lg">🏠</span>
                    <span className="text-xs font-bold">Airbnb</span>
                    <span className="text-[9px] opacity-60">PRO · MAX</span>
                  </button>
                </div>

                {/* Property Name */}
                <div className="relative">
                  <LayoutDashboard className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-600" />
                  <Input
                    type="text"
                    placeholder={signUpData.niche === 'pousada' ? 'Nome da pousada' : 'Seu nome de anfitrião'}
                    className="pl-10 h-11 bg-[#0d1117] border-white/[0.08] focus:border-emerald-500/50 focus:ring-emerald-500/20 text-white placeholder:text-zinc-600 rounded-xl"
                    value={signUpData.propertyName}
                    onChange={(e) => setSignUpData({ ...signUpData, propertyName: e.target.value })}
                  />
                </div>

                {/* Password fields */}
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-600" />
                  <Input
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Senha (mín. 6 caracteres)"
                    className="pl-10 pr-10 h-11 bg-[#0d1117] border-white/[0.08] focus:border-emerald-500/50 focus:ring-emerald-500/20 text-white placeholder:text-zinc-600 rounded-xl"
                    value={signUpData.password}
                    onChange={(e) => setSignUpData({ ...signUpData, password: e.target.value })}
                    required
                  />
                  <button
                    type="button"
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-600 hover:text-zinc-400 cursor-pointer"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-600" />
                  <Input
                    type={showConfirmPassword ? 'text' : 'password'}
                    placeholder="Confirmar senha"
                    className="pl-10 pr-10 h-11 bg-[#0d1117] border-white/[0.08] focus:border-emerald-500/50 focus:ring-emerald-500/20 text-white placeholder:text-zinc-600 rounded-xl"
                    value={signUpData.confirmPassword}
                    onChange={(e) => setSignUpData({ ...signUpData, confirmPassword: e.target.value })}
                    required
                  />
                  <button
                    type="button"
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-600 hover:text-zinc-400 cursor-pointer"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  >
                    {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>

                {/* Terms */}
                <label className="flex items-start gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={agreedTerms}
                    onChange={(e) => setAgreedTerms(e.target.checked)}
                    className="mt-1 accent-emerald-500"
                  />
                  <span className="text-[11px] text-zinc-500 leading-relaxed">
                    Concordo com os{' '}
                    <a href="/legal/termos-uso" className="text-emerald-400 hover:underline" target="_blank">Termos de Uso</a>
                    {' '}e a{' '}
                    <a href="/legal/politica-privacidade" className="text-emerald-400 hover:underline" target="_blank">Política de Privacidade</a>
                  </span>
                </label>

                <Button
                  type="submit"
                  className="w-full h-12 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl cursor-pointer active:scale-[0.98] transition-all"
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Criando conta...</>
                  ) : (
                    <>
                      <ArrowRight className="mr-2 h-4 w-4" />
                      Criar conta e acessar dashboard
                    </>
                  )}
                </Button>
              </motion.form>

              {/* Back to login */}
              <motion.div variants={fadeUp} className="text-center">
                <p className="text-zinc-600 text-sm">
                  Já tem conta?{' '}
                  <button
                    type="button"
                    onClick={() => setViewMode('signin')}
                    className="text-emerald-400 hover:underline font-semibold cursor-pointer"
                  >
                    Fazer login
                  </button>
                </p>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
