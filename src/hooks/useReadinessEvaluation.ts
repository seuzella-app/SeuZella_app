import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

export interface ReadinessAnswers {
  hasPMS: boolean;
  hasChannelManager: boolean;
  hasBookingEngine: boolean;
  hasWhatsAppAutomation: boolean;
  hasReviewAutomation: boolean;
  hasConsolidatedDatabase: boolean;
  hasHistoricalData: boolean;
  teamOpenToAI: boolean;
  teamTrained: boolean;
  hasLgpdConsent: boolean;
  hasLgpdDeletionProcess: boolean;
  hasSecureDataStorage: boolean;
  propertyName?: string;
  notes?: string;
}

export interface RoiInput {
  roomsCount: number;
  averageDailyRate: number;
  currentOccupancy: number;
  staffAverageHourlyRate: number;
}

export interface EvaluatePayload {
  answers: ReadinessAnswers;
  roiInput: RoiInput;
}

export function useReadinessEvaluation() {
  const queryClient = useQueryClient();

  // Query to check/poll the playbook status
  const statusQuery = useQuery({
    queryKey: ['readiness-playbook'],
    queryFn: async () => {
      const res = await fetch('/api/readiness/playbook');
      if (!res.ok) throw new Error('Erro ao buscar status do playbook');
      return res.json();
    },
    // Poll every 3 seconds if there's no URL yet
    refetchInterval: (query) => {
      const {data} = query.state;
      // If we don't have a playbookUrl, poll
      return data && data.playbookUrl ? false : 3000;
    },
  });

  // Mutation to submit evaluation
  const evaluateMutation = useMutation({
    mutationFn: async (payload: EvaluatePayload) => {
      const res = await fetch('/api/readiness/evaluate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Erro ao avaliar maturidade');
      }
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.setQueryData(['readiness-playbook'], {
        playbookUrl: null,
        playbookGeneratedAt: null,
        readinessScore: data.assessment.score,
        lgpdRisk: data.assessment.lgpdRisk,
      });
      queryClient.invalidateQueries({ queryKey: ['readiness-playbook'] });
    },
  });

  return {
    playbookStatus: statusQuery.data,
    isLoadingStatus: statusQuery.isLoading,
    isRefetchingStatus: statusQuery.isRefetching,
    evaluate: evaluateMutation.mutateAsync,
    isEvaluating: evaluateMutation.isPending,
    evaluationResult: evaluateMutation.data,
    evaluationError: evaluateMutation.error,
  };
}
