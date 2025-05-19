import { AgentConfig } from './types';
import loadConfig from './utils/configLoader';

// Load the configuration from environment or use defaults
const config: AgentConfig = loadConfig();

export default config;