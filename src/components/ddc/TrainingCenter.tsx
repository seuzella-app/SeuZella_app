'use client';

import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { GraduationCap, BookOpen, Sparkles, Play, CheckCircle2, XCircle, Plus, Search, MoreVertical, Edit, Trash2, Brain, TrendingUp, Clock, ShieldCheck, AlertTriangle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { useTrainingCenter } from '@/lib/ddc/use-training-center';
import { useLearningStats } from '@/lib/ddc/use-learning-stats';
import type { TrainingPrompt, LearnedPattern } from '@/types/ddc';

type TrainingTab = 'manual' | 'learned';

export function TrainingCenter() {
  const {
    trainings = [],
    isLoading,
    isTesting,
    addTraining,
    removeTraining,
    testTraining,
    activateTraining,
    deactivateTraining,
    editTraining,
  } = useTrainingCenter();

  const { stats: learningData, patterns: learnedPatterns, isLoading: learningLoading } = useLearningStats();
  const [activeTab, setActiveTab] = useState<TrainingTab>('manual');

  const [selectedTrainingId, setSelectedTrainingId] = useState<string | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [testResult, setTestResult] = useState<{ status: 'passed' | 'failed' | 'pending'; score?: number; feedback?: string } | null>(null);
  const [localTestingId, setLocalTestingId] = useState<string | null>(null);

  const selectedTraining = useMemo(() => {
    return trainings.find(t => t.id === selectedTrainingId) || null;
  }, [trainings, selectedTrainingId]);

  const filteredTrainings = useMemo(() => {
    return trainings.filter(t =>
      (t.title || t.name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (t.category || t.type || '').toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [trainings, searchQuery]);

  const filteredLearned = useMemo(() => {
    if (!searchQuery) return learnedPatterns;
    return learnedPatterns.filter(p =>
      p.question.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.category.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [learnedPatterns, searchQuery]);

  const handleTest = async (trainingId: string) => {
    setLocalTestingId(trainingId);
    setTestResult(null);
    try {
      const result = await testTraining(trainingId);
      setTestResult({ status: result.status, score: result.score, feedback: result.feedback });
    } catch (err) {
      setTestResult({ status: 'failed', score: 0, feedback: err instanceof Error ? err.message : 'Erro ao testar.' });
    } finally {
      setLocalTestingId(null);
    }
  };

  const handleAddTraining = async (newPrompt: Omit<TrainingPrompt, 'id' | 'createdAt' | 'updatedAt'>) => {
    try { await addTraining(newPrompt); setIsAdding(false); } catch (err) { console.error('Failed to create training:', err); }
  };

  const handleDeleteTraining = async (trainingId: string) => {
    try {
      await removeTraining(trainingId);
      if (selectedTrainingId === trainingId) { setSelectedTrainingId(null); setTestResult(null); }
    } catch (err) { console.error('Failed to delete training:', err); }
  };

  const handleToggleActive = async (training: TrainingPrompt) => {
    try {
      if (training.isActive) { await deactivateTraining(training.id); } else { await activateTraining(training.id); }
    } catch (err) { console.error('Failed to toggle active status:', err); }
  };

  const getCategoryLabel = (cat: string) => {
    const labels: Record<string, string> = {
      persona: 'Persona da IA', response: 'Regra de Resposta', escalation: 'Critério de Escalação',
      proactive: 'Mensagem Proativa', checkin: 'Check-in', checkout: 'Checkout',
      servicos: 'Serviços', horarios: 'Horários', reservas: 'Reservas',
      politicas: 'Políticas', faq: 'FAQ', pricing: 'Preços', rooms: 'Quartos',
      amenities: 'Comodidades', policies: 'Políticas', location: 'Localização',
      activities: 'Atividades', food: 'Gastronomia', custom: 'Personalizado',
    };
    return labels[cat] || cat;
  };

  const fadeInUp = {
    hidden: { opacity: 0, y: 20 },
    visible: (i: number) => ({ opacity: 1, y: 0, transition: { delay: i * 0.05, duration: 0.3, ease: 'easeOut' as const } })
  } as const;

  const activeTrainingsCount = trainings.filter(t => t.isActive).length;

  return (
    <Card className="bg-white/[0.02] border border-white/[0.06] h-full flex flex-col">
      <CardHeader className="pb-3 border-b border-white/[0.06]">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-violet-600 flex items-center justify-center">
              <GraduationCap className="w-5 h-5 text-white" />
            </div>
            <div>
              <CardTitle className="text-base font-bold text-white">Centro de Treinamento IA</CardTitle>
              <p className="text-[10px] text-white/40 font-mono">
                {activeTrainingsCount} treinos ativos
                {learningData && (
                  <span className="text-emerald-400/70"> · {(learningData?.verifiedPatterns || 0)} padrões verificados</span>
                )}
              </p>
            </div>
          </div>
          {activeTab === 'manual' && (
            <Dialog open={isAdding} onOpenChange={setIsAdding}>
              <DialogTrigger asChild>
                <Button size="sm" className="bg-violet-500 hover:bg-violet-600">
                  <Plus className="w-3.5 h-3.5 mr-1.5" />
                  <span className="text-xs">Novo Treino</span>
                </Button>
              </DialogTrigger>
              <DialogContent className="bg-[#0a0a0f] border-white/[0.06] max-w-2xl text-white">
                <DialogHeader>
                  <DialogTitle className="text-white">Adicionar Novo Treinamento</DialogTitle>
                </DialogHeader>
                <AddTrainingForm onSubmit={handleAddTraining} onCancel={() => setIsAdding(false)} />
              </DialogContent>
            </Dialog>
          )}
        </div>

        {/* Tabs + Search */}
        <div className="mt-3 flex items-center gap-3">
          <div className="flex items-center bg-white/[0.03] rounded-lg p-0.5 border border-white/[0.06]">
            <button
              onClick={() => setActiveTab('manual')}
              className={`px-3 py-1.5 rounded-md text-[11px] font-medium transition-all ${
                activeTab === 'manual'
                  ? 'bg-violet-500/20 text-violet-400 border border-violet-500/30'
                  : 'text-white/40 hover:text-white/70'
              }`}
            >
              <BookOpen className="w-3 h-3 inline mr-1.5 -mt-0.5" />
              Treinos Manuais
            </button>
            <button
              onClick={() => setActiveTab('learned')}
              className={`px-3 py-1.5 rounded-md text-[11px] font-medium transition-all relative ${
                activeTab === 'learned'
                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                  : 'text-white/40 hover:text-white/70'
              }`}
            >
              <Brain className="w-3 h-3 inline mr-1.5 -mt-0.5" />
              Padroes Aprendidos
              {(learningData?.totalPatterns || 0) > 0 && (
                <span className="ml-1.5 px-1.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 text-[8px] font-bold">
                  {learningData?.totalPatterns}
                </span>
              )}
            </button>
          </div>
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
            <Input
              placeholder="Buscar..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-white/[0.04] border-white/[0.08] rounded-lg pl-9 pr-3 py-1.5 text-xs text-white placeholder:text-white/30"
            />
          </div>
        </div>
      </CardHeader>

      <div className="flex-1 flex overflow-hidden">
        {activeTab === 'manual' ? (
          /* ═══ TREINOS MANUAIS ═══ */
          <>
            <div className="w-80 border-r border-white/[0.06] flex flex-col">
              <ScrollArea className="flex-1">
                <div className="p-2 space-y-2">
                  {isLoading ? (
                    <div className="text-center py-12 text-xs text-white/30">Carregando...</div>
                  ) : filteredTrainings.length === 0 ? (
                    <div className="text-center py-12 text-xs text-white/30">Nenhum treino encontrado</div>
                  ) : (
                    filteredTrainings.map((training, index) => (
                      <motion.button key={training.id} custom={index} variants={fadeInUp} initial="hidden" animate="visible"
                        onClick={() => { setSelectedTrainingId(training.id); setTestResult(null); }}
                        className={`w-full text-left p-3 rounded-lg border transition-all ${
                          selectedTraining?.id === training.id
                            ? 'bg-violet-500/10 border-violet-500/30'
                            : 'bg-white/[0.02] border-white/[0.04] hover:bg-white/[0.04] hover:border-white/[0.08]'
                        }`}
                      >
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <div className={`w-8 h-8 rounded-lg ${training.isActive ? 'bg-gradient-to-br from-violet-500 to-purple-600' : 'bg-white/[0.04]'} flex items-center justify-center`}>
                              <BookOpen className={`w-4 h-4 ${training.isActive ? 'text-white' : 'text-white/40'}`} />
                            </div>
                            <div>
                              <div className="text-xs font-semibold text-white line-clamp-1 w-[150px]">{training.title || training.name}</div>
                              <div className="text-[9px] text-white/40">{getCategoryLabel(training.category || training.type || '')}</div>
                            </div>
                          </div>
                          {training.isActive && (
                            <Badge variant="outline" className="text-[8px] h-4 bg-emerald-500/20 text-emerald-400 border-emerald-500/30">Ativo</Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="text-[8px] h-4 bg-white/[0.04] text-white/60 border-white/[0.08]">v{training.version || 1}</Badge>
                          {(training.testResult || (training.successRate ?? 0) > 0) && (
                            <div className="text-[9px] font-medium text-emerald-400">Testado</div>
                          )}
                        </div>
                      </motion.button>
                    ))
                  )}
                </div>
              </ScrollArea>
            </div>
            <div className="flex-1 flex flex-col">
              {selectedTraining ? (
                <>
                  <div className="p-4 border-b border-white/[0.06] bg-white/[0.02]">
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <h3 className="text-sm font-bold text-white mb-1">{selectedTraining.title || selectedTraining.name}</h3>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="text-[8px] h-4 bg-white/[0.04] text-white/60 border-white/[0.08]">{getCategoryLabel(selectedTraining.category || selectedTraining.type || '')}</Badge>
                          <Badge variant="outline" className="text-[8px] h-4 bg-white/[0.04] text-white/60 border-white/[0.08]">v{selectedTraining.version || 1}</Badge>
                          {selectedTraining.isActive ? (
                            <Badge className="text-[8px] h-4 bg-emerald-500/20 text-emerald-400 border-emerald-500/30">Ativo no Atendimento</Badge>
                          ) : (
                            <Badge className="text-[8px] h-4 bg-slate-500/20 text-slate-400 border-slate-500/30">Desativado</Badge>
                          )}
                        </div>
                      </div>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild><Button variant="ghost" size="sm" className="h-8 w-8 p-0"><MoreVertical className="w-4 h-4 text-white/60" /></Button></DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="bg-[#0a0a0f] border-white/[0.06]">
                          <DropdownMenuItem className="text-white/70 hover:text-white cursor-pointer text-xs" onClick={() => handleToggleActive(selectedTraining)}>
                            {selectedTraining.isActive ? 'Desativar' : 'Ativar'}
                          </DropdownMenuItem>
                          <DropdownMenuItem className="text-red-400 hover:text-red-300 cursor-pointer text-xs" onClick={() => handleDeleteTraining(selectedTraining.id)}>
                            <Trash2 className="w-4 h-4 mr-2" />Excluir
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                    <AnimatePresence>
                      {testResult && (
                        <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
                          className={`p-3 rounded-lg border ${testResult.status === 'passed' ? 'bg-emerald-500/10 border-emerald-500/20' : 'bg-red-500/10 border-red-500/20'}`}
                        >
                          <div className="flex items-center gap-2 mb-1">
                            {testResult.status === 'passed' ? <CheckCircle2 className="w-4 h-4 text-emerald-400" /> : <XCircle className="w-4 h-4 text-red-400" />}
                            <span className={`text-xs font-semibold ${testResult.status === 'passed' ? 'text-emerald-400' : 'text-red-400'}`}>
                              {testResult.status === 'passed' ? 'Aprovado!' : 'Falhou'}
                            </span>
                            {testResult.score !== undefined && <span className="text-[9px] text-white/50">{testResult.score}%</span>}
                          </div>
                          {testResult.feedback && <p className="text-[10px] text-white/70">{testResult.feedback}</p>}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                  <ScrollArea className="flex-1 p-4">
                    <label className="text-[10px] text-white/40 uppercase tracking-wider mb-2 block font-mono">Conteudo do Treinamento</label>
                    <div className="bg-white/[0.02] border border-white/[0.06] rounded-lg p-3">
                      <p className="text-xs text-white/80 leading-relaxed whitespace-pre-wrap">{selectedTraining.content}</p>
                    </div>
                  </ScrollArea>
                  <div className="p-3 border-t border-white/[0.06] bg-white/[0.02]">
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" className="flex-1 border-violet-500/30 text-violet-400 hover:bg-violet-500/10"
                        onClick={() => handleTest(selectedTraining.id)} disabled={isTesting || localTestingId === selectedTraining.id}>
                        <Play className="w-3.5 h-3.5 mr-1.5" />{localTestingId === selectedTraining.id ? 'Testando...' : 'Testar Prompt'}
                      </Button>
                      <Button variant="outline" size="sm" className="flex-1 border-white/[0.08] text-white/70 hover:bg-white/[0.04]" onClick={() => setTestResult(null)}>Limpar</Button>
                    </div>
                  </div>
                </>
              ) : (
                <div className="flex-1 flex items-center justify-center">
                  <div className="text-center">
                    <GraduationCap className="w-16 h-16 text-white/10 mx-auto mb-4" />
                    <p className="text-sm text-white/40">Selecione um treino</p>
                    <p className="text-[10px] text-white/30 mt-1">ou crie um novo para comecar</p>
                  </div>
                </div>
              )}
            </div>
          </>
        ) : (
          /* ═══ PADRÕES APRENDIDOS PELO CÉREBRO ═══ */
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Stats Bar */}
            {learningData && (
              <div className="grid grid-cols-4 gap-2 p-3 border-b border-white/[0.06] bg-white/[0.01]">
                {[
                  { label: 'Total Aprendidos', value: learningData.totalPatterns, icon: <Brain className="w-3.5 h-3.5 text-violet-400" />, color: 'text-violet-400' },
                  { label: 'Verificados', value: learningData.verifiedPatterns, icon: <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />, color: 'text-emerald-400' },
                  { label: 'Ativos', value: learningData.activePatterns, icon: <TrendingUp className="w-3.5 h-3.5 text-cyan-400" />, color: 'text-cyan-400' },
                  { label: 'Confianca Media', value: `${(learningData.overallConfidence * 100).toFixed(0)}%`, icon: <Sparkles className="w-3.5 h-3.5 text-amber-400" />, color: 'text-amber-400' },
                ].map((s, i) => (
                  <motion.div key={s.label} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
                    className="bg-white/[0.02] rounded-lg p-2.5 flex items-center gap-2"
                  >
                    {s.icon}
                    <div>
                      <div className="text-[8px] text-white/30 uppercase tracking-wider">{s.label}</div>
                      <div className={`text-sm font-bold font-mono ${s.color}`}>{s.value}</div>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}

            {/* Patterns List */}
            <ScrollArea className="flex-1">
              <div className="p-2 space-y-2">
                {learningLoading ? (
                  <div className="text-center py-12 text-xs text-white/30">Carregando padroes aprendidos...</div>
                ) : filteredLearned.length === 0 ? (
                  <div className="text-center py-12">
                    <Brain className="w-12 h-12 text-white/5 mx-auto mb-3" />
                    <p className="text-xs text-white/30">Nenhum padrao aprendido ainda</p>
                    <p className="text-[10px] text-white/20 mt-1 max-w-xs mx-auto">
                      O sistema aprende automaticamente com conversas resolvidas. Quanto mais conversas, mais padrões surgem.
                    </p>
                  </div>
                ) : (
                  filteredLearned.map((pattern, index) => (
                    <LearnedPatternCard key={pattern.id} pattern={pattern} index={index} getCategoryLabel={getCategoryLabel} />
                  ))
                )}
              </div>
            </ScrollArea>

            {/* Recent Activity */}
            {learningData && learningData.recentActivity.length > 0 && (
              <div className="border-t border-white/[0.06] p-3 bg-white/[0.01]">
                <div className="text-[9px] text-white/30 uppercase tracking-wider mb-2 font-mono flex items-center gap-1.5">
                  <Clock className="w-3 h-3" /> Atividade Recente de Aprendizado
                </div>
                <div className="space-y-1">
                  {learningData.recentActivity.slice(0, 3).map((activity, i) => (
                    <div key={i} className="flex items-start gap-2 text-[10px]">
                      <span className={`mt-0.5 ${activity.success ? 'text-emerald-400' : 'text-red-400'}`}>
                        {activity.success ? '●' : '○'}
                      </span>
                      <span className="text-white/50 line-clamp-1 flex-1">{activity.message}</span>
                      <span className="text-white/20 shrink-0">{new Date(activity.date).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </Card>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   LEARNED PATTERN CARD
   ═══════════════════════════════════════════════════════════════════════════ */

function LearnedPatternCard({
  pattern, index, getCategoryLabel,
}: {
  pattern: LearnedPattern;
  index: number;
  getCategoryLabel: (cat: string) => string;
}) {
  const fadeInUp = {
    hidden: { opacity: 0, y: 12 },
    visible: (i: number) => ({ opacity: 1, y: 0, transition: { delay: i * 0.03, duration: 0.25, ease: 'easeOut' as const } }),
  } as const;

  const statusColor = pattern.deprecated
    ? 'border-red-500/20 bg-red-500/[0.02]'
    : pattern.verified
    ? 'border-emerald-500/20 bg-emerald-500/[0.02]'
    : 'border-white/[0.04] bg-white/[0.02]';

  const statusBadge = pattern.deprecated
    ? <Badge className="text-[7px] h-3.5 bg-red-500/15 text-red-400 border-red-500/25"><AlertTriangle className="w-2.5 h-2.5 mr-0.5" />Desativado</Badge>
    : pattern.verified
    ? <Badge className="text-[7px] h-3.5 bg-emerald-500/15 text-emerald-400 border-emerald-500/25"><ShieldCheck className="w-2.5 h-2.5 mr-0.5" />Verificado</Badge>
    : <Badge variant="outline" className="text-[7px] h-3.5 bg-white/[0.04] text-white/50 border-white/[0.08]">Aprendendo</Badge>;

  return (
    <motion.div
      custom={index}
      variants={fadeInUp}
      initial="hidden"
      animate="visible"
      className={`rounded-lg border p-3 ${statusColor}`}
    >
      <div className="flex items-start justify-between mb-1.5">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <div className={`w-6 h-6 rounded-md flex items-center justify-center shrink-0 ${
            pattern.verified ? 'bg-emerald-500/20' : pattern.deprecated ? 'bg-red-500/10' : 'bg-white/[0.04]'
          }`}>
            <Brain className={`w-3 h-3 ${pattern.verified ? 'text-emerald-400' : pattern.deprecated ? 'text-red-400/50' : 'text-white/30'}`} />
          </div>
          <div className="min-w-0">
            <p className="text-[11px] font-medium text-white/80 line-clamp-1">{pattern.question}</p>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className="text-[8px] text-white/30">{getCategoryLabel(pattern.category)}</span>
              <span className="text-white/10">·</span>
              <span className="text-[8px] text-white/30">{pattern.timesUsed}x usado</span>
            </div>
          </div>
        </div>
        {statusBadge}
      </div>

      <p className="text-[10px] text-white/40 line-clamp-2 ml-8 mb-1.5">{pattern.answer}</p>

      <div className="flex items-center gap-3 ml-8">
        {/* Effectiveness bar */}
        <div className="flex items-center gap-1.5 flex-1">
          <span className="text-[8px] text-white/20">eficacia</span>
          <div className="flex-1 h-1 bg-white/[0.04] rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${
                (pattern.effectiveness || 0) >= 70 ? 'bg-emerald-500' :
                (pattern.effectiveness || 0) >= 40 ? 'bg-amber-500' : 'bg-red-500'
              }`}
              style={{ width: `${Math.max(2, pattern.effectiveness || 0)}%` }}
            />
          </div>
          <span className={`text-[9px] font-mono font-bold ${
            (pattern.effectiveness || 0) >= 70 ? 'text-emerald-400' :
            (pattern.effectiveness || 0) >= 40 ? 'text-amber-400' : 'text-red-400'
          }`}>
            {Math.round(pattern.effectiveness || 0)}%
          </span>
        </div>
        {pattern.confidence > 0 && (
          <span className="text-[8px] text-white/20 font-mono">
            conf {(pattern.confidence * 100).toFixed(0)}%
          </span>
        )}
      </div>
    </motion.div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   ADD TRAINING FORM
   ═══════════════════════════════════════════════════════════════════════════ */

function AddTrainingForm({ onSubmit, onCancel }: { onSubmit: (training: Omit<TrainingPrompt, 'id' | 'createdAt' | 'updatedAt'>) => void; onCancel: () => void }) {
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('persona');
  const [content, setContent] = useState('');

  const categories = [
    { value: 'persona', label: 'Persona da IA' },
    { value: 'response', label: 'Regras de Resposta' },
    { value: 'escalation', label: 'Criterios de Escalacao' },
    { value: 'proactive', label: 'Mensagens Proativas' }
  ];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (title && content) {
      onSubmit({ title, name: title, category, type: category, content, version: 1, isActive: true, propertyId: 'default-prop' });
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="text-[10px] text-white/40 uppercase tracking-wider mb-2 block font-mono">Titulo</label>
        <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ex: Como fazer check-in antecipado"
          className="bg-white/[0.04] border-white/[0.08] text-white placeholder:text-white/30" />
      </div>
      <div>
        <label className="text-[10px] text-white/40 uppercase tracking-wider mb-2 block font-mono">Categoria</label>
        <div className="flex flex-wrap gap-2">
          {categories.map((cat) => (
            <button key={cat.value} type="button" onClick={() => setCategory(cat.value)}
              className={`px-3 py-1.5 rounded-lg text-xs border transition-all ${
                category === cat.value ? 'bg-violet-500/20 border-violet-500/30 text-violet-400' : 'bg-white/[0.02] border-white/[0.08] text-white/60 hover:bg-white/[0.04]'
              }`}>
              {cat.label}
            </button>
          ))}
        </div>
      </div>
      <div>
        <label className="text-[10px] text-white/40 uppercase tracking-wider mb-2 block font-mono">Conteudo do Treinamento</label>
        <Textarea value={content} onChange={(e) => setContent(e.target.value)} placeholder="Descreva como a IA deve responder..."
          rows={6} className="bg-white/[0.04] border-white/[0.08] text-white placeholder:text-white/30 resize-none" />
      </div>
      <div className="flex gap-2 pt-2">
        <Button type="button" variant="outline" size="sm" className="flex-1 border-white/[0.08] text-white/70 hover:bg-white/[0.04]" onClick={onCancel}>Cancelar</Button>
        <Button type="submit" size="sm" className="flex-1 bg-violet-500 hover:bg-violet-600" disabled={!title || !content}>
          <Sparkles className="w-3.5 h-3.5 mr-1.5" />Criar Treinamento
        </Button>
      </div>
    </form>
  );
}