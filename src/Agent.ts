// Re-export AgentManager as Agent for backward compatibility
import { AgentManager } from './managers/AgentManager';

// Export the AgentManager class as "Agent" for backward compatibility
export class Agent extends AgentManager {}

export default Agent;