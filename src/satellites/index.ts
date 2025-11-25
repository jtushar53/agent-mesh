/**
 * Satellite Agents for Project Stella
 * The 6 specialized satellites that form the Agent Mesh
 */

export { BaseSatellite } from './base-satellite'
export type { SatelliteEvent, SatelliteEventCallback, SatelliteEventType } from './base-satellite'

// The 6 Satellites
export { Shaka } from './shaka'         // 01. Orchestrator
export { Lilith } from './lilith'       // 02. Critic
export { Edison } from './edison'       // 03. Inventor
export { Pythagoras } from './pythagoras' // 04. Researcher
export { Atlas } from './atlas'         // 05. Tool Executor
export { York } from './york'           // 06. Resource Manager
