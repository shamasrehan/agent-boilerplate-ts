import * as dotenv from 'dotenv';
import { AgentConfig } from '../types';

dotenv.config();

/**
 * Load and validate agent configuration from environment variables
 */
export function loadConfig(): AgentConfig {
  return {
    name: process.env.AGENT_NAME || 'ai-agent',
    version: process.env.AGENT_VERSION || '1.0.0',
    functions: {
      enabled: process.env.FUNCTIONS_ENABLED !== 'false',
      registry: process.env.FUNCTIONS_REGISTRY ? 
        process.env.FUNCTIONS_REGISTRY.split(',') : 
        ['default']
    },
    messaging: {
      enabled: process.env.MESSAGING_ENABLED !== 'false',
      config: {
        incomingQueue: process.env.RABBITMQ_INCOMING_QUEUE || 'agent-incoming',
        outgoingQueue: process.env.RABBITMQ_OUTGOING_QUEUE || 'agent-outgoing',
        acknowledgmentQueue: process.env.RABBITMQ_ACKNOWLEDGMENT_QUEUE || 'agent-acknowledgment',
        exchange: process.env.RABBITMQ_EXCHANGE
      }
    },
    jobQueue: {
      enabled: process.env.JOB_QUEUE_ENABLED !== 'false',
      concurrency: parseInt(process.env.JOB_QUEUE_CONCURRENCY || '5', 10),
      retryAttempts: parseInt(process.env.JOB_QUEUE_RETRY_ATTEMPTS || '3', 10),
      retryDelay: parseInt(process.env.JOB_QUEUE_RETRY_DELAY || '5000', 10)
    },
    llm: {
      enabled: process.env.LLM_ENABLED !== 'false',
      config: {
        provider: (process.env.LLM_PROVIDER as any) || 'openai',
        model: process.env.LLM_MODEL || 'gpt-4',
        apiKeyName: process.env.LLM_API_KEY_NAME || 'openai',
        temperature: parseFloat(process.env.LLM_TEMPERATURE || '0.7'),
        maxTokens: parseInt(process.env.LLM_MAX_TOKENS || '2048', 10),
        systemPrompt: process.env.LLM_SYSTEM_PROMPT || 'You are a helpful AI assistant.'
      }
    }
  };
}

export default loadConfig;