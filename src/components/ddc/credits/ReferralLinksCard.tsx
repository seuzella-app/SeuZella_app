'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import {
  Link2,
  Mail,
  MessageCircle,
  Hash,
  Copy,
  Check,
  Plus,
  ExternalLink,
  Smartphone,
  QrCode,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import type { ReferralCodeDTO } from '@/lib/credits/engine';
import type { ReferralChannel } from '@/lib/credits/rules';
import { REFERRAL_CHANNELS } from '@/lib/credits/rules';

interface Props {
  codes: ReferralCodeDTO[];
  onCreateCode: (channel: ReferralChannel, label?: string) => Promise<{ success: boolean; error?: string }>;
  loading: boolean;
}

const CHANNEL_ICON: Record<ReferralChannel, React.ElementType> = {
  linkinbio: Link2,
  email: Mail,
  whatsapp: MessageCircle,
  manual: Hash,
};

const CHANNEL_COLOR: Record<ReferralChannel, string> = {
  linkinbio: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
  email: 'text-blue-400 bg-blue-500/10 border-blue-500/20',
  whatsapp: 'text-green-400 bg-green-500/10 border-green-500/20',
  manual: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
};

export function ReferralLinksCard({ codes, onCreateCode, loading }: Props) {
  const [createOpen, setCreateOpen] = useState(false);
  const [newChannel, setNewChannel] = useState<ReferralChannel>('linkinbio');
  const [newLabel, setNewLabel] = useState('');
  const [creating, setCreating] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const handleCreate = async () => {
    setCreating(true);
    const result = await onCreateCode(newChannel, newLabel.trim() || undefined);
    setCreating(false);
    if (result.success) {
      toast.success('Código criado!', {
        description: 'Já está pronto para divulgação.',
      });
      setCreateOpen(false);
      setNewLabel('');
    } else {
      toast.error('Erro ao criar código', { description: result.error });
    }
  };

  const handleCopy = async (code: ReferralCodeDTO) => {
    try {
      await navigator.clipboard.writeText(code.fullUrl);
      setCopiedId(code.id);
      toast.success('Link copiado!');
      setTimeout(() => setCopiedId(null), 2500);
    } catch {
      toast.error('Não foi possível copiar');
    }
  };

  return (
    <Card className="bg-[#0d0d14] border-white/[0.06]">
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <div>
          <CardTitle className="text-base font-bold text-white flex items-center gap-2">
            <Smartphone className="w-4 h-4 text-emerald-400" />
            Seus Links de Indicação
          </CardTitle>
          <CardDescription className="text-xs text-zinc-500 mt-1">
            Um código rastreia todos os canais. Copie e divulgue onde quiser.
          </CardDescription>
        </div>
        <Button
          onClick={() => setCreateOpen(true)}
          size="sm"
          className="bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 text-emerald-400"
        >
          <Plus className="w-3.5 h-3.5 mr-1" />
          Novo Link
        </Button>
      </CardHeader>
      <CardContent className="space-y-3">
        {loading && codes.length === 0 ? (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-20 animate-pulse bg-white/[0.03] rounded-lg" />
            ))}
          </div>
        ) : codes.length === 0 ? (
          <div className="text-center py-8 text-zinc-500 text-xs">
            <Link2 className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p>Você ainda não tem links de indicação.</p>
            <Button
              onClick={() => setCreateOpen(true)}
              size="sm"
              variant="outline"
              className="mt-3 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10"
            >
              Criar primeiro link
            </Button>
          </div>
        ) : (
          codes.map((code, idx) => {
            const Icon = CHANNEL_ICON[code.channel];
            const colorClass = CHANNEL_COLOR[code.channel];
            const channelConfig = REFERRAL_CHANNELS.find((c) => c.id === code.channel);
            const isWhatsapp = code.channel === 'whatsapp';
            const isManual = code.channel === 'manual';

            return (
              <motion.div
                key={code.id || idx}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.05 }}
                className="bg-white/[0.02] border border-white/[0.06] rounded-lg p-3 hover:border-white/[0.1] transition-all"
              >
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <div className={`w-8 h-8 rounded-lg border flex items-center justify-center shrink-0 ${colorClass}`}>
                      <Icon className="w-3.5 h-3.5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-bold text-white">
                          {channelConfig?.label || code.channel}
                        </span>
                        {code.label && (
                          <Badge variant="outline" className="text-[9px] py-0 px-1.5 h-4 border-white/10 text-zinc-400">
                            {code.label}
                          </Badge>
                        )}
                      </div>
                      <p className="text-[10px] text-zinc-500 mt-0.5">
                        {code.clicksCount} cliques · {code.conversionsCount} conversões
                      </p>
                    </div>
                  </div>
                  <Badge className="text-[9px] uppercase tracking-wider bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
                    Ativo
                  </Badge>
                </div>

                <div className="flex items-center gap-1.5">
                  <code className="flex-1 text-[11px] text-zinc-300 bg-[#080808] border border-white/[0.06] rounded px-2 py-1.5 font-mono truncate">
                    {code.fullUrl}
                  </code>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleCopy(code)}
                    className="h-8 w-8 p-0 border-white/10 hover:border-emerald-500/30 hover:bg-emerald-500/10"
                  >
                    {copiedId === code.id ? (
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                    ) : (
                      <Copy className="w-3.5 h-3.5 text-zinc-400" />
                    )}
                  </Button>
                  {!isManual && (
                    <a
                      href={code.fullUrl}
                      target={isWhatsapp ? '_blank' : undefined}
                      rel={isWhatsapp ? 'noopener noreferrer' : undefined}
                      className="h-8 w-8 p-0 inline-flex items-center justify-center border border-white/10 rounded-md hover:border-emerald-500/30 hover:bg-emerald-500/10 transition-all"
                      title="Abrir link"
                    >
                      <ExternalLink className="w-3.5 h-3.5 text-zinc-400" />
                    </a>
                  )}
                </div>
              </motion.div>
            );
          })
        )}

        {/* Anti-fraud hint */}
        <div className="bg-emerald-500/[0.04] border border-emerald-500/15 rounded-lg p-3 flex items-start gap-2">
          <QrCode className="w-3.5 h-3.5 text-emerald-400 mt-0.5 shrink-0" />
          <p className="text-[11px] text-zinc-400 leading-relaxed">
            <strong className="text-emerald-400">Rastreamento anti-fraude:</strong> Cada clique é
            identificado por fingerprint SHA-256(IP + dispositivo). Auto-indicação é bloqueada.
            Conversões exigem cookie ativo e email diferente do seu.
          </p>
        </div>
      </CardContent>

      {/* Modal: criar novo código */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="bg-[#111118] border-zinc-800 text-white max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base font-bold flex items-center gap-2 text-emerald-400">
              <Plus className="w-4 h-4" />
              Criar novo link de indicação
            </DialogTitle>
            <DialogDescription className="text-zinc-400 text-xs">
              Escolha o canal de divulgação. O código será único e rastreável.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label className="text-xs text-zinc-400">Canal de divulgação</Label>
              <div className="grid grid-cols-2 gap-2">
                {REFERRAL_CHANNELS.map((ch) => {
                  const Icon = CHANNEL_ICON[ch.id];
                  return (
                    <button
                      key={ch.id}
                      onClick={() => setNewChannel(ch.id)}
                      className={`flex items-center gap-2 p-2.5 rounded-lg border text-xs font-medium transition-all ${
                        newChannel === ch.id
                          ? CHANNEL_COLOR[ch.id] + ' border-current'
                          : 'bg-white/[0.02] border-white/[0.06] text-zinc-400 hover:bg-white/[0.04]'
                      }`}
                    >
                      <Icon className="w-3.5 h-3.5 shrink-0" />
                      <span className="truncate">{ch.label}</span>
                    </button>
                  );
                })}
              </div>
              <p className="text-[10px] text-zinc-500 mt-1 leading-relaxed">
                {REFERRAL_CHANNELS.find((c) => c.id === newChannel)?.description}
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="label" className="text-xs text-zinc-400">
                Apelido (opcional)
              </Label>
              <Input
                id="label"
                placeholder="Ex: Campanha Verão, Bio Instagram..."
                value={newLabel}
                onChange={(e) => setNewLabel(e.target.value)}
                maxLength={100}
                className="bg-[#0a0a0f] border-zinc-700 text-white"
              />
              <p className="text-[10px] text-zinc-500">
                Ajuda você a identificar de onde vieram os cliques.
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)} className="border-zinc-700 text-zinc-300">
              Cancelar
            </Button>
            <Button
              onClick={handleCreate}
              disabled={creating}
              className="bg-emerald-500 hover:bg-emerald-600 text-zinc-950"
            >
              {creating ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-zinc-950/30 border-t-zinc-950 rounded-full animate-spin mr-2" />
                  Criando...
                </>
              ) : (
                <>
                  <Plus className="w-3.5 h-3.5 mr-1" />
                  Criar link
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
