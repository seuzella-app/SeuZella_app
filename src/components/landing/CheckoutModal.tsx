'use client';

import { useState, useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import type { NicheType } from '@/contexts/NicheContext';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Shield,
  Check,
  Loader2,
  QrCode,
  CreditCard,
  Mail,
  User,
  Phone,
  Building2,
  AlertCircle,
  ArrowRight,
} from 'lucide-react';
import { toast } from 'sonner';
import { PaymentTrustBadges } from '@/components/landing/PaymentTrustBadges';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface CheckoutModalProps {
  open: boolean;
  onClose: () => void;
  planId: string;
  planName: string;
  price: number;
  paymentMethod: 'pix' | 'cartao';
  niche: NicheType;
}

type ModalState = 'form' | 'loading' | 'success' | 'error';

interface FormData {
  name: string;
  email: string;
  phone: string;
  propertyName: string;
  niche: 'pousada' | 'airbnb';
}

interface FormErrors {
  name?: string;
  email?: string;
}

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function formatPrice(value: number): string {
  return value.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  });
}

export function CheckoutModal({
  open,
  onClose,
  planId,
  planName,
  price,
  paymentMethod,
  niche,
}: CheckoutModalProps) {
  const router = useRouter();
  const [modalState, setModalState] = useState<ModalState>('form');
  const [errorMessage, setErrorMessage] = useState('');
  const [formData, setFormData] = useState<FormData>({
    name: '',
    email: '',
    phone: '',
    propertyName: '',
    niche: niche,
  });
  const [errors, setErrors] = useState<FormErrors>({});

  // BUG #2 FIX: Sincroniza formData.niche quando a prop niche muda
  // (useState não re-inicializa quando props mudam — useEffect é necessário)
  useEffect(() => {
    setFormData(prev => ({ ...prev, niche }));
  }, [niche]);

  const resetState = useCallback(() => {
    setModalState('form');
    setErrorMessage('');
    setFormData({
      name: '',
      email: '',
      phone: '',
      propertyName: '',
      niche: niche,
    });
    setErrors({});
  }, [niche]);

  const handleClose = useCallback(() => {
    onClose();
    // Reset after animation completes
    setTimeout(resetState, 300);
  }, [onClose, resetState]);

  const validateForm = useCallback((): boolean => {
    const newErrors: FormErrors = {};

    if (!formData.name.trim()) {
      newErrors.name = 'Nome e obrigatorio';
    }

    if (!formData.email.trim()) {
      newErrors.email = 'E-mail e obrigatorio';
    } else if (!emailRegex.test(formData.email.trim())) {
      newErrors.email = 'Formato de e-mail invalido';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [formData]);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();

      if (!validateForm()) return;

      setModalState('loading');

      try {
        const response = await fetch('/api/checkout/create', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: formData.email,
            name: formData.name,
            phone: formData.phone,
            propertyName: formData.propertyName,
            niche: formData.niche,
            planType: planId,
            paymentMethod: paymentMethod,
          }),
        });

        const json = await response.json();

        // New API wraps data in { success: true, data: { ... } }
        // Old API returned flat { success: true, subscriptionId, checkoutUrl, ... }
        const data = json.data || json;

        if (json.success) {
          setModalState('success');
          toast.success('Checkout criado com sucesso!');

          // Handle redirect after showing success state
          setTimeout(() => {
            if (data.checkoutUrl) {
              window.location.href = data.checkoutUrl;
            } else if (data.redirectUrl) {
              if (data.redirectUrl.startsWith('/')) {
                router.push(data.redirectUrl);
              } else {
                window.location.href = data.redirectUrl;
              }
            } else if (planId === 'gratuito') {
              router.push('/login?checkout=success');
            }
          }, 2000);
        } else {
          setModalState('error');
          const errorMsg = data.message || json.error?.message || json.message || data.error || 'Falha ao processar checkout. Tente novamente.';
          setErrorMessage(errorMsg);
          toast.error('Erro ao criar checkout');
        }
      } catch (error) {
        console.error('Checkout error:', error);
        setModalState('error');
        setErrorMessage('Erro de conexao. Verifique sua internet e tente novamente.');
        toast.error('Erro de conexao');
      }
    },
    [formData, planId, paymentMethod, validateForm, router],
  );

  const handleRetry = useCallback(() => {
    setModalState('form');
    setErrorMessage('');
  }, []);

  const updateField = useCallback(
    (field: keyof FormData, value: string) => {
      setFormData((prev) => ({ ...prev, [field]: value }));
      // Clear error on field change
      if (field in errors) {
        setErrors((prev) => ({ ...prev, [field]: undefined }));
      }
    },
    [errors],
  );

  const paymentIcon = paymentMethod === 'pix' ? QrCode : CreditCard;
  const PaymentIcon = paymentIcon;
  const paymentLabel = paymentMethod === 'pix' ? 'PIX' : 'Cartao de Credito';

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && handleClose()}>
      <DialogContent
        className="bg-[#0a0a0a] border-white/10 text-white sm:max-w-md p-0 overflow-hidden"
        showCloseButton={modalState !== 'loading'}
      >
        <AnimatePresence mode="wait">
          {/* ========== FORM STATE ========== */}
          {modalState === 'form' && (
            <motion.div
              key="form"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.3, ease: 'easeOut' }}
            >
              {/* Header */}
              <div className="px-6 pt-6 pb-4 border-b border-white/10">
                <DialogHeader>
                  <DialogTitle className="text-xl font-bold text-white flex items-center gap-2">
                    <Shield className="w-5 h-5 text-emerald-400" />
                    Finalizar Assinatura
                  </DialogTitle>
                  <DialogDescription className="text-neutral-400 text-sm mt-1">
                    Preencha seus dados para iniciar o plano {planName}
                  </DialogDescription>
                </DialogHeader>

                {/* Plan Summary Badge */}
                <div className="mt-4 flex items-center justify-between bg-white/5 rounded-lg p-3 border border-white/10">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
                      <PaymentIcon className="w-5 h-5 text-emerald-400" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-white">{planName}</p>
                      <p className="text-xs text-neutral-400">{paymentLabel}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    {price === 0 ? (
                      <p className="text-lg font-bold text-emerald-400">Gratis</p>
                    ) : (
                      <p className="text-lg font-bold text-white">
                        {formatPrice(price)}
                        <span className="text-xs text-neutral-400 font-normal">/mes</span>
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {/* Form */}
              <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
                {/* Name */}
                <div className="space-y-1.5">
                  <Label htmlFor="checkout-name" className="text-neutral-300 text-xs font-medium">
                    Nome completo <span className="text-red-400">*</span>
                  </Label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-500" />
                    <Input
                      id="checkout-name"
                      type="text"
                      placeholder="Seu nome completo"
                      value={formData.name}
                      onChange={(e) => updateField('name', e.target.value)}
                      className="pl-9 bg-white/5 border-white/10 text-white placeholder:text-neutral-600 focus-visible:border-emerald-500/50 focus-visible:ring-emerald-500/20 h-10"
                      aria-invalid={!!errors.name}
                      autoComplete="name"
                    />
                  </div>
                  {errors.name && (
                    <p className="text-xs text-red-400 flex items-center gap-1">
                      <AlertCircle className="w-3 h-3" />
                      {errors.name}
                    </p>
                  )}
                </div>

                {/* Email */}
                <div className="space-y-1.5">
                  <Label htmlFor="checkout-email" className="text-neutral-300 text-xs font-medium">
                    E-mail <span className="text-red-400">*</span>
                  </Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-500" />
                    <Input
                      id="checkout-email"
                      type="email"
                      placeholder="seu@email.com"
                      value={formData.email}
                      onChange={(e) => updateField('email', e.target.value)}
                      className="pl-9 bg-white/5 border-white/10 text-white placeholder:text-neutral-600 focus-visible:border-emerald-500/50 focus-visible:ring-emerald-500/20 h-10"
                      aria-invalid={!!errors.email}
                      autoComplete="email"
                    />
                  </div>
                  {errors.email && (
                    <p className="text-xs text-red-400 flex items-center gap-1">
                      <AlertCircle className="w-3 h-3" />
                      {errors.email}
                    </p>
                  )}
                </div>

                {/* Phone (optional) */}
                <div className="space-y-1.5">
                  <Label htmlFor="checkout-phone" className="text-neutral-300 text-xs font-medium">
                    Telefone <span className="text-neutral-600">(opcional)</span>
                  </Label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-500" />
                    <Input
                      id="checkout-phone"
                      type="tel"
                      placeholder="(00) 00000-0000"
                      value={formData.phone}
                      onChange={(e) => updateField('phone', e.target.value)}
                      className="pl-9 bg-white/5 border-white/10 text-white placeholder:text-neutral-600 focus-visible:border-emerald-500/50 focus-visible:ring-emerald-500/20 h-10"
                      autoComplete="tel"
                    />
                  </div>
                </div>

                {/* Property Name (optional) */}
                <div className="space-y-1.5">
                  <Label htmlFor="checkout-property" className="text-neutral-300 text-xs font-medium">
                    Nome da propriedade <span className="text-neutral-600">(opcional)</span>
                  </Label>
                  <div className="relative">
                    <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-500" />
                    <Input
                      id="checkout-property"
                      type="text"
                      placeholder="Ex: Pousada Sol Nascente"
                      value={formData.propertyName}
                      onChange={(e) => updateField('propertyName', e.target.value)}
                      className="pl-9 bg-white/5 border-white/10 text-white placeholder:text-neutral-600 focus-visible:border-emerald-500/50 focus-visible:ring-emerald-500/20 h-10"
                    />
                  </div>
                </div>

                {/* Niche Selector */}
                <div className="space-y-1.5">
                  <Label className="text-neutral-300 text-xs font-medium">Tipo de negocio</Label>
                  <Select
                    value={formData.niche}
                    onValueChange={(value) => updateField('niche', value)}
                  >
                    <SelectTrigger className="w-full bg-white/5 border-white/10 text-white focus-visible:border-emerald-500/50 focus-visible:ring-emerald-500/20 h-10">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-[#0a0a0a] border-white/10">
                      <SelectItem value="pousada" className="text-white focus:bg-white/10 focus:text-white">
                        Pousada
                      </SelectItem>
                      <SelectItem value="airbnb" className="text-white focus:bg-white/10 focus:text-white">
                        Airbnb / Anfitriao
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Submit Button */}
                <Button
                  type="submit"
                  className="w-full h-11 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-sm transition-colors mt-2"
                >
                  {price === 0 ? (
                    <>
                      Comecar gratis
                      <ArrowRight className="w-4 h-4 ml-1" />
                    </>
                  ) : (
                    <>
                      Assinar {planName} - {formatPrice(price)}/mes
                      <ArrowRight className="w-4 h-4 ml-1" />
                    </>
                  )}
                </Button>

                {/* Security notice & Trust Badges */}
                <div className="pt-2">
                  <PaymentTrustBadges compact={true} />
                </div>
              </form>
            </motion.div>
          )}

          {/* ========== LOADING STATE ========== */}
          {modalState === 'loading' && (
            <motion.div
              key="loading"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.3, ease: 'easeOut' }}
              className="flex flex-col items-center justify-center py-16 px-6"
            >
              <div className="relative">
                <div className="w-16 h-16 rounded-full border-2 border-emerald-500/20 flex items-center justify-center">
                  <Loader2 className="w-8 h-8 text-emerald-400 animate-spin" />
                </div>
              </div>
              <h3 className="text-lg font-semibold text-white mt-6">Processando...</h3>
              <p className="text-sm text-neutral-400 mt-2 text-center">
                Criando sua assinatura do plano {planName}. Aguarde um momento.
              </p>
              <div className="mt-4 flex items-center gap-2 text-xs text-neutral-500">
                <Shield className="w-3.5 h-3.5" />
                Conexao segura criptografada
              </div>
            </motion.div>
          )}

          {/* ========== SUCCESS STATE ========== */}
          {modalState === 'success' && (
            <motion.div
              key="success"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.3, ease: 'easeOut' }}
              className="flex flex-col items-center justify-center py-16 px-6"
            >
              <div className="w-16 h-16 rounded-full bg-emerald-500/10 border-2 border-emerald-500/30 flex items-center justify-center">
                <Check className="w-8 h-8 text-emerald-400" />
              </div>
              <h3 className="text-lg font-semibold text-white mt-6">Checkout criado com sucesso!</h3>
              <p className="text-sm text-neutral-400 mt-2 text-center">
                {paymentMethod === 'pix'
                  ? 'Voce sera redirecionado para realizar o pagamento via PIX.'
                  : 'Voce sera redirecionado para a pagina de pagamento.'}
              </p>
              <div className="mt-6 flex items-center gap-2 text-xs text-neutral-500">
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                Redirecionando...
              </div>
            </motion.div>
          )}

          {/* ========== ERROR STATE ========== */}
          {modalState === 'error' && (
            <motion.div
              key="error"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.3, ease: 'easeOut' }}
              className="flex flex-col items-center justify-center py-16 px-6"
            >
              <div className="w-16 h-16 rounded-full bg-red-500/10 border-2 border-red-500/30 flex items-center justify-center">
                <AlertCircle className="w-8 h-8 text-red-400" />
              </div>
              <h3 className="text-lg font-semibold text-white mt-6">Erro ao processar</h3>
              <p className="text-sm text-neutral-400 mt-2 text-center max-w-xs">
                {errorMessage}
              </p>
              <div className="flex gap-3 mt-6">
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleClose}
                  className="border-white/10 text-neutral-300 hover:bg-white/5 hover:text-white"
                >
                  Fechar
                </Button>
                <Button
                  type="button"
                  onClick={handleRetry}
                  className="bg-emerald-600 hover:bg-emerald-500 text-white font-semibold"
                >
                  Tentar novamente
                </Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </DialogContent>
    </Dialog>
  );
}
