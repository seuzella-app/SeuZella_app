// ============================================================================
// ZCC Foundation — public surface
// ----------------------------------------------------------------------------
// Single import point for everything the cortexes and adapters need:
//   import { zcc, zcb, sharedMemory, buildEvent, runLearningCycle } from '@/domain/zcc';
// ============================================================================

export { zcc, ZellaCentralControl } from './ZCC';
export type { ZCCConfig } from './ZCC';
export { zcb, buildEvent } from './ZCB';
export { sharedMemory } from './SharedCognitiveMemory';
export {
  runLearningCycle,
  warmStartFromEvents,
} from './LearningPipeline';
export type {
  Observation,
  Inference,
  Hypothesis,
  TestResult,
  Validation,
  LearningRunOptions,
} from './LearningPipeline';
export type {
  CognitiveEvent,
  KnowledgeEntry,
  CortexId,
  CognitiveSeverity,
  LearningStage,
  OperatingMode,
  ExperimentResult,
  Persona,
  EventHandler,
} from './types';
