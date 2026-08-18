"use client";

import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Building2, Bed, Shield, CreditCard, MessageCircle, Sparkles,
  CheckCircle2, ChevronRight, ChevronLeft, Rocket, X, Info,
  TrendingUp, BellRing, Percent, Check
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

/*
 * OnboardingWizard — Wizard multi-step para o dono cadastrar a pousada.
 *
 * Etapas:
 *   1. Dados básicos (nome, descrição, cidade, endereço)
 *   2. Quartos (quantidade, tipos, preços) — apenas link para seção de quartos
 *   3. Políticas (check-in, check-out, pets, cancelamento)
 *   4. PIX (chave PIX para pagamentos)
 *   5. WhatsApp (instruções para conectar Cloud API)
 *   6. Personalidade (tom de voz da IA)
 *   7. Alta Demanda & Upsell (precificação inteligente, notificação prévia e aceite dos 7% de sucesso)
 *
 * Conexões:
 *   - GET/POST /api/ddc/onboarding-wizard
 *   - POST /api/ddc/personality (step 6)
 */

const STEPS = [
  { id: "basic_info", label: "Dados Básicos", icon: Building2 },
  { id: "rooms", label: "Quartos", icon: Bed },
  { id: "policies", label: "Políticas", icon: Shield },
  { id: "pix", label: "PIX", icon: CreditCard },
  { id: "whatsapp", label: "WhatsApp", icon: MessageCircle },
  { id: "personality", label: "Personalidade", icon: Sparkles },
  { id: "yield_upsell", label: "Alta Demanda & Upsell", icon: TrendingUp },
];

interface OnboardingWizardProps {
  tenantId: string;
  onClose: () => void;
  onComplete?: () => void;
}

export function OnboardingWizard({ tenantId, onClose, onComplete }: OnboardingWizardProps) {
  const [currentStep, setCurrentStep] = React.useState(0);
  const [loading, setLoading] = React.useState(false);
  const [stepsCompleted, setStepsCompleted] = React.useState<string[]>([]);

  // Form state
  const [formData, setFormData] = React.useState({
    name: "", description: "", city: "", state: "", address: "",
    checkInTime: "14:00", checkOutTime: "12:00",
    petPolicy: "not_allowed", cancellationPolicy: "flexible",
    pixKey: "", pixKeyType: "cpf",
    tone: "descontraida", expressions: [] as string[], greeting: "",
    assistantName: "Zélla",
    highSeasonMultiplierPercent: 40,
    notifyBeforePriceChange: true,
    autoUpsellActive: true,
    acceptedUpsellSuccessFeeTerms: true,
  });

  // Load existing data
  React.useEffect(() => {
    fetch(`/api/ddc/onboarding-wizard?tenantId=${tenantId}`)
      .then(res => res.json())
      .then(json => {
        if (json?.success && json?.data?.property) {
          const p = json.data.property;
          setFormData(prev => ({
            ...prev,
            name: p.name || "", description: p.description || "",
            city: p.city || "", state: p.state || "", address: p.address || "",
            checkInTime: p.checkInTime || "14:00", checkOutTime: p.checkOutTime || "12:00",
            petPolicy: p.petPolicy || "not_allowed", cancellationPolicy: p.cancellationPolicy || "flexible",
            pixKey: p.pixKey || "", pixKeyType: p.pixKeyType || "cpf",
            tone: p.aiTone || "descontraida", greeting: p.aiGreeting || "",
            assistantName: p.aiAssistantName || "Zélla",
            highSeasonMultiplierPercent: p.highSeasonMultiplierPercent ?? 40,
            notifyBeforePriceChange: p.notifyBeforePriceChange ?? true,
            autoUpsellActive: p.autoUpsellActive ?? true,
            acceptedUpsellSuccessFeeTerms: p.acceptedUpsellSuccessFeeTerms ?? true,
          }));
          setStepsCompleted(json.data.stepsCompleted || []);
        }
      })
      .catch(() => {});
  }, [tenantId]);

  const saveStep = async (stepId: string, data: any) => {
    setLoading(true);
    try {
      const res = await fetch("/api/ddc/onboarding-wizard", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tenantId, step: stepId, data }),
      });
      const json = await res.json();
      if (json?.success) {
        setStepsCompleted(json.data.stepsCompleted);
        toast.success(json.message || `Etapa ${stepId} salva!`);
        if (json.data.completedAll) {
          toast.success("Onboarding completo! 🎉", {
            description: "Sua pousada está pronta para receber hóspedes!",
          });
          onComplete?.();
          onClose();
        }
      } else {
        toast.error("Erro ao salvar etapa");
      }
    } catch {
      toast.error("Erro de conexão");
    } finally {
      setLoading(false);
    }
  };

  const handleNext = () => {
    const step = STEPS[currentStep];
    if (step.id === "rooms") {
      // Quartos são salvos separadamente — apenas marca como completo
      setStepsCompleted(prev => [...new Set([...prev, "rooms"])]);
      saveStep("rooms", {});
    } else {
      saveStep(step.id, formData);
    }
    if (currentStep < STEPS.length - 1) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handlePrev = () => {
    if (currentStep > 0) setCurrentStep(currentStep - 1);
  };

  const isStepComplete = (stepId: string) => stepsCompleted.includes(stepId);

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-2xl rounded-xl border border-border bg-card shadow-2xl max-h-[90vh] overflow-hidden flex flex-col"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-5 py-3">
          <div>
            <h2 className="flex items-center gap-2 text-sm font-bold text-foreground">
              <Rocket className="size-4 text-primary" />
              Configuração da Pousada
            </h2>
            <p className="mt-0.5 text-[10px] text-muted-foreground">
              Etapa {currentStep + 1} de {STEPS.length} — complete para ativar o Zélla
            </p>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="size-5" />
          </button>
        </div>

        {/* Progress bar */}
        <div className="flex items-center gap-1 px-5 py-2 border-b border-border bg-secondary/30">
          {STEPS.map((step, idx) => (
            <button
              key={step.id}
              onClick={() => setCurrentStep(idx)}
              className={cn(
                "flex items-center gap-1.5 rounded-md px-2 py-1 text-[10px] font-medium transition-colors",
                idx === currentStep
                  ? "bg-primary text-primary-foreground"
                  : isStepComplete(step.id)
                    ? "bg-emerald-500/10 text-emerald-400"
                    : "text-muted-foreground hover:text-foreground"
              )}
            >
              {isStepComplete(step.id) && idx !== currentStep ? (
                <CheckCircle2 className="size-3" />
              ) : (
                <step.icon className="size-3" />
              )}
              {step.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5 zcc-scroll">
          <AnimatePresence mode="wait">
            {currentStep === 0 && (
              <motion.div key="basic" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                <h3 className="mb-3 text-sm font-semibold text-foreground">Dados Básicos da Pousada</h3>
                <div className="space-y-3">
                  <Field label="Nome da pousada" value={formData.name} onChange={(v) => setFormData({ ...formData, name: v })} placeholder="Ex: Pousada Mar Azul" />
                  <Field label="Descrição" value={formData.description} onChange={(v) => setFormData({ ...formData, description: v })} placeholder="Ex: Refúgio à beira-mar com café da manhã artesanal" textarea />
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Cidade" value={formData.city} onChange={(v) => setFormData({ ...formData, city: v })} placeholder="Ex: Florianópolis" />
                    <Field label="Estado (UF)" value={formData.state} onChange={(v) => setFormData({ ...formData, state: v.toUpperCase().slice(0, 2) })} placeholder="Ex: SC" />
                  </div>
                  <Field label="Endereço completo" value={formData.address} onChange={(v) => setFormData({ ...formData, address: v })} placeholder="Ex: Rua das Flores, 123 — Praia Brava" />
                </div>
              </motion.div>
            )}

            {currentStep === 1 && (
              <motion.div key="rooms" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                <h3 className="mb-3 text-sm font-semibold text-foreground">Quartos e Acomodações</h3>
                <p className="text-[11px] text-muted-foreground mb-4">
                  Os quartos são cadastrados na aba "Quartos" do seu dashboard. Marque como completo quando tiver cadastrado pelo menos 1 quarto.
                </p>
                <div className="rounded-lg border border-primary/20 bg-primary/5 p-4">
                  <Info className="size-5 text-primary mb-2" />
                  <p className="text-[11px] text-foreground">
                    <strong>Como cadastrar quartos:</strong>
                  </p>
                  <ol className="mt-2 space-y-1 text-[10px] text-muted-foreground">
                    <li>1. Feche este wizard</li>
                    <li>2. Vá em "Quartos" no menu lateral</li>
                    <li>3. Clique em "Adicionar Quarto"</li>
                    <li>4. Preencha: nome, tipo, capacidade, preço/noite</li>
                    <li>5. Volte aqui e marque como completo</li>
                  </ol>
                </div>
              </motion.div>
            )}

            {currentStep === 2 && (
              <motion.div key="policies" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                <h3 className="mb-3 text-sm font-semibold text-foreground">Políticas da Pousada</h3>
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Horário de Check-in" value={formData.checkInTime} onChange={(v) => setFormData({ ...formData, checkInTime: v })} placeholder="14:00" />
                    <Field label="Horário de Check-out" value={formData.checkOutTime} onChange={(v) => setFormData({ ...formData, checkOutTime: v })} placeholder="12:00" />
                  </div>
                  <SelectField
                    label="Política de Pets"
                    value={formData.petPolicy}
                    onChange={(v) => setFormData({ ...formData, petPolicy: v })}
                    options={[
                      { value: "allowed_free", label: "Permitido sem taxa" },
                      { value: "allowed_fee", label: "Permitido com taxa" },
                      { value: "not_allowed", label: "Não permitido" },
                    ]}
                  />
                  <SelectField
                    label="Política de Cancelamento"
                    value={formData.cancellationPolicy}
                    onChange={(v) => setFormData({ ...formData, cancellationPolicy: v })}
                    options={[
                      { value: "flexible", label: "Flexível (48h antes)" },
                      { value: "moderate", label: "Moderada (7 dias antes)" },
                      { value: "strict", label: "Rígida (14 dias antes)" },
                    ]}
                  />
                </div>
              </motion.div>
            )}

            {currentStep === 3 && (
              <motion.div key="pix" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                <h3 className="mb-3 text-sm font-semibold text-foreground">Chave PIX para Pagamentos</h3>
                <p className="text-[11px] text-muted-foreground mb-4">
                  Esta chave será enviada automaticamente aos hóspedes quando solicitarem reserva.
                </p>
                <div className="space-y-3">
                  <SelectField
                    label="Tipo da chave PIX"
                    value={formData.pixKeyType}
                    onChange={(v) => setFormData({ ...formData, pixKeyType: v })}
                    options={[
                      { value: "cpf", label: "CPF" },
                      { value: "cnpj", label: "CNPJ" },
                      { value: "email", label: "E-mail" },
                      { value: "phone", label: "Telefone" },
                      { value: "random", label: "Chave aleatória" },
                    ]}
                  />
                  <Field
                    label="Chave PIX"
                    value={formData.pixKey}
                    onChange={(v) => setFormData({ ...formData, pixKey: v })}
                    placeholder="Ex: 123.456.789-00"
                  />
                </div>
              </motion.div>
            )}

            {currentStep === 4 && (
              <motion.div key="whatsapp" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                <h3 className="mb-3 text-sm font-semibold text-foreground">Conectar WhatsApp</h3>
                <p className="text-[11px] text-muted-foreground mb-4">
                  Para que o Zélla responda seus hóspedes automaticamente, você precisa conectar seu número de WhatsApp Business.
                </p>
                <div className="rounded-lg border border-primary/20 bg-primary/5 p-4">
                  <ol className="space-y-2 text-[11px] text-muted-foreground">
                    <li><strong className="text-foreground">1.</strong> Acesse <code className="font-mono text-primary">business.facebook.com</code></li>
                    <li><strong className="text-foreground">2.</strong> Crie uma conta Business Manager (com seu CNPJ)</li>
                    <li><strong className="text-foreground">3.</strong> Vá em "WhatsApp Manager" → "Telefone"</li>
                    <li><strong className="text-foreground">4.</strong> Adicione seu número de WhatsApp</li>
                    <li><strong className="text-foreground">5.</strong> Copie os tokens (App Secret, Access Token, Phone Number ID)</li>
                    <li><strong className="text-foreground">6.</strong> Configure no ZCC → Tokens & IA</li>
                  </ol>
                </div>
                <div className="mt-3">
                  <label className="flex items-center gap-2 text-[11px] text-muted-foreground cursor-pointer">
                    <input
                      type="checkbox"
                      checked={stepsCompleted.includes("whatsapp")}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setStepsCompleted(prev => [...new Set([...prev, "whatsapp"])]);
                          saveStep("whatsapp", { connected: true });
                        }
                      }}
                    />
                    Já configurei o WhatsApp no ZCC → Tokens & IA
                  </label>
                </div>
              </motion.div>
            )}

            {currentStep === 5 && (
              <motion.div key="personality" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                <h3 className="mb-3 text-sm font-semibold text-foreground">Personalidade da IA</h3>
                <p className="text-[11px] text-muted-foreground mb-4">
                  Escolha como o Zélla vai conversar com seus hóspedes. Você pode mudar isso depois!
                </p>
                <div className="space-y-3">
                  <div>
                    <label className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Nome da assistente</label>
                    <input
                      type="text"
                      value={formData.assistantName}
                      onChange={(e) => setFormData({ ...formData, assistantName: e.target.value })}
                      placeholder="Ex: Zélla, Sofia, Marina..."
                      className="mt-1 h-9 w-full rounded-md border border-border bg-background px-3 text-xs text-foreground focus:border-primary/50 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Tom de voz</label>
                    <div className="mt-1 grid grid-cols-2 gap-2">
                      {[
                        { value: "formal", label: "👔 Formal", desc: "Profissional, educada" },
                        { value: "descontraida", label: "😊 Descontraída", desc: "Amigável, casual" },
                        { value: "divertida", label: "😄 Divertida", desc: "Brincalhona, animada" },
                        { value: "profissional", label: "💼 Profissional", desc: "Clara, direta" },
                      ].map((opt) => (
                        <button
                          key={opt.value}
                          onClick={() => setFormData({ ...formData, tone: opt.value })}
                          className={cn(
                            "rounded-lg border p-2 text-left transition-colors",
                            formData.tone === opt.value
                              ? "border-primary bg-primary/10"
                              : "border-border hover:border-primary/40"
                          )}
                        >
                          <p className="text-xs font-semibold text-foreground">{opt.label}</p>
                          <p className="text-[9px] text-muted-foreground">{opt.desc}</p>
                        </button>
                      ))}
                    </div>
                  </div>
                  <Field
                    label="Saudação inicial (opcional)"
                    value={formData.greeting}
                    onChange={(v) => setFormData({ ...formData, greeting: v })}
                    placeholder="Ex: Olá! Seja bem-vindo à nossa pousada!"
                  />
                </div>
              </motion.div>
            )}

            {currentStep === 6 && (
              <motion.div key="yield_upsell" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                    <TrendingUp className="size-4 text-emerald-400" />
                    Alta Demanda & Parceria de UPSELL
                  </h3>
                  <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-emerald-500/15 border border-emerald-500/30 text-emerald-300">
                    Transparência Total
                  </span>
                </div>
                
                <p className="text-[11px] text-muted-foreground mb-4 leading-relaxed">
                  No dia a dia normal, o Seu Zélla atende 24h e fecha reservas no PIX com <strong className="text-emerald-400">0% de taxa</strong> (100% da diária no seu bolso). 
                  Nos feriados e datas festivas da sua região, o fluxo de mensagens cresce: o Zélla atende a avalanche, valoriza o valor por quarto e vende comodidades extras (UPSELL).
                </p>

                <div className="space-y-4">
                  {/* Multiplicador de Valorização */}
                  <div className="rounded-lg border border-border bg-card/60 p-3.5 space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-[11px] font-semibold text-foreground flex items-center gap-1.5">
                        <Percent className="size-3.5 text-primary" />
                        Valorização sugerida por quarto em feriados/festas
                      </label>
                      <span className="text-xs font-black text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                        +{formData.highSeasonMultiplierPercent}%
                      </span>
                    </div>
                    <div className="grid grid-cols-4 gap-2 pt-1">
                      {[
                        { val: 25, label: "+25%", desc: "Moderada" },
                        { val: 40, label: "+40%", desc: "Recomendada" },
                        { val: 60, label: "+60%", desc: "Alta Procura" },
                        { val: 100, label: "+100%", desc: "Réveillon / Carnaval" },
                      ].map((item) => (
                        <button
                          key={item.val}
                          type="button"
                          onClick={() => setFormData({ ...formData, highSeasonMultiplierPercent: item.val })}
                          className={cn(
                            "rounded-md border p-2 text-center transition-all",
                            formData.highSeasonMultiplierPercent === item.val
                              ? "border-emerald-500 bg-emerald-500/15 text-emerald-300 font-bold shadow-sm"
                              : "border-border bg-background hover:border-border/80 text-muted-foreground"
                          )}
                        >
                          <div className="text-xs">{item.label}</div>
                          <div className="text-[9px] text-muted-foreground">{item.desc}</div>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Mecanismo de Notificação e Aprovação Prévia */}
                  <div className="rounded-lg border border-border bg-card/60 p-3.5 space-y-3">
                    <label className="flex items-start gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formData.notifyBeforePriceChange}
                        onChange={(e) => setFormData({ ...formData, notifyBeforePriceChange: e.target.checked })}
                        className="mt-0.5 rounded border-border text-primary focus:ring-primary size-4"
                      />
                      <div>
                        <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                          <BellRing className="size-3.5 text-amber-400" />
                          Avisar-me com antecedência antes de aplicar valores de pico
                        </span>
                        <p className="text-[10px] text-muted-foreground mt-0.5">
                          O Cérebro Zélla monitora o calendário da sua cidade. Ao detectar aumento de mensagens, calcula e sugere os valores de diária e upsell no DDC e DDC Mobile para você aprovar ou ajustar.
                        </p>
                      </div>
                    </label>

                    <label className="flex items-start gap-3 cursor-pointer pt-2 border-t border-border/50">
                      <input
                        type="checkbox"
                        checked={formData.autoUpsellActive}
                        onChange={(e) => setFormData({ ...formData, autoUpsellActive: e.target.checked })}
                        className="mt-0.5 rounded border-border text-primary focus:ring-primary size-4"
                      />
                      <div>
                        <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                          <Sparkles className="size-3.5 text-teal-400" />
                          Oferecer comodidades extras de UPSELL por quarto aos hóspedes
                        </span>
                        <p className="text-[10px] text-muted-foreground mt-0.5">
                          Late check-out, early check-in, café especial, upgrade de suíte, kit praia e passeios locais.
                        </p>
                      </div>
                    </label>
                  </div>

                  {/* Simulação Matemática Prática */}
                  <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/[0.06] p-3.5">
                    <p className="text-[11px] font-bold text-emerald-300 mb-1.5 flex items-center gap-1.5">
                      <Info className="size-3.5" />
                      Como funciona a matemática na prática:
                    </p>
                    <div className="grid grid-cols-2 gap-2 text-[10px]">
                      <div className="bg-black/30 p-2 rounded border border-white/5">
                        <span className="text-muted-foreground block">☀️ Dia a dia normal</span>
                        <span className="font-bold text-foreground">Diária R$ 300</span>
                        <span className="text-emerald-400 block font-semibold">Taxa Zélla = R$ 0,00 (0%)</span>
                      </div>
                      <div className="bg-black/30 p-2 rounded border border-white/5">
                        <span className="text-muted-foreground block">🎉 Feriado (+{formData.highSeasonMultiplierPercent}% + R$ 500 Upsell)</span>
                        <span className="font-bold text-foreground">Lucro Extra = +R$ 500</span>
                        <span className="text-emerald-300 block font-semibold">Pousada fica com R$ 465 (+93%) · Zélla 7% (R$ 35)</span>
                      </div>
                    </div>
                  </div>

                  {/* Termo de Transparência e Aceite */}
                  <label className="flex items-start gap-2.5 p-3 rounded-lg border border-primary/30 bg-primary/[0.05] cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.acceptedUpsellSuccessFeeTerms}
                      onChange={(e) => setFormData({ ...formData, acceptedUpsellSuccessFeeTerms: e.target.checked })}
                      className="mt-0.5 rounded border-border text-primary focus:ring-primary size-4"
                    />
                    <span className="text-[10px] text-zinc-300 leading-tight">
                      <strong className="text-white">Estou ciente e de acordo:</strong> Diárias normais têm ZERO taxa o ano todo. A taxa de sucesso de 7% incide única e exclusivamente sobre o faturamento extra de UPSELL vendido em datas de alta demanda com notificação prévia.
                    </span>
                  </label>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-border px-5 py-3">
          <button
            onClick={handlePrev}
            disabled={currentStep === 0}
            className="inline-flex items-center gap-1 rounded-md border border-border bg-background px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground disabled:opacity-30"
          >
            <ChevronLeft className="size-3.5" />
            Voltar
          </button>
          <span className="text-[10px] text-muted-foreground">
            {stepsCompleted.length}/{STEPS.length} etapas completas
          </span>
          <button
            onClick={handleNext}
            disabled={loading}
            className="inline-flex items-center gap-1 rounded-md border border-primary bg-primary px-3 py-1.5 text-xs font-bold text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {loading ? (
              <span className="size-3 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent" />
            ) : (
              <>
                {currentStep === STEPS.length - 1 ? (
                  <>
                    <Rocket className="size-3.5" />
                    Finalizar
                  </>
                ) : (
                  <>
                    Próximo
                    <ChevronRight className="size-3.5" />
                  </>
                )}
              </>
            )}
          </button>
        </div>
      </motion.div>
    </div>
  );
}

// ── Sub-components ─────────────────────────────────────────────

function Field({
  label, value, onChange, placeholder, textarea,
}: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string; textarea?: boolean;
}) {
  return (
    <div>
      <label className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</label>
      {textarea ? (
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="mt-1 h-20 w-full resize-none rounded-md border border-border bg-background px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground focus:border-primary/50 focus:outline-none"
        />
      ) : (
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="mt-1 h-9 w-full rounded-md border border-border bg-background px-3 text-xs text-foreground placeholder:text-muted-foreground focus:border-primary/50 focus:outline-none"
        />
      )}
    </div>
  );
}

function SelectField({
  label, value, onChange, options,
}: {
  label: string; value: string; onChange: (v: string) => void; options: Array<{ value: string; label: string }>;
}) {
  return (
    <div>
      <label className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 h-9 w-full rounded-md border border-border bg-background px-3 text-xs text-foreground focus:border-primary/50 focus:outline-none"
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>{opt.label}</option>
        ))}
      </select>
    </div>
  );
}
