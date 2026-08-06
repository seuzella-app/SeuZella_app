// ============================================================================
// ZCC Simulation Environment — public surface
// ----------------------------------------------------------------------------
// This module is the *permanent* simulation environment. The name "Mock"
// has been retired — what we have here is the **ZCC Digital Twin**.
// ============================================================================

export {
  bootDigitalTwin,
  isDigitalTwinBooted,
  digitalTwinSnapshot,
  simulationLab,
  adsSimulator,
  nationalSimulator,
  behavioralEngine,
  generateSyntheticBrazil,
} from './ZCCDigitalTwin';
export type { DigitalTwinBootOptions } from './ZCCDigitalTwin';

export { ZCCSimulationLab } from './ZCCSimulationLab';
export type { ExperimentConfig } from './ZCCSimulationLab';

export * from './SyntheticBrazil';
export * from './BehavioralEngine';
export * from './AdsSimulator';
export * from './NationalSimulator';
