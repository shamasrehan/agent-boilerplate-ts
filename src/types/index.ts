// Base types
export interface MessageConfig {
  exchange?: string;
  incomingQueue: string;
  outgoingQueue: string;
  acknowledgmentQueue: string;
}

export interface Message {
  id: string;
  type: string;
  timestamp: number;
  payload: any;
  metadata?: Record<string, any>;
}

export interface IncomingMessage extends Message {
  replyTo?: string;
}

export interface OutgoingMessage extends Message {
  correlationId?: string;
  status?: 'success' | 'error' | 'pending';
}

export interface MessageSchema {
  name: string;
  schema: Record<string, any>;
}

// Function types
export interface FunctionDefinition {
  name: string;
  description: string;
  type: 'local' | 'cloud';
  apiKeyName?: string;
  parameters: {
    type: 'object';
    properties: Record<string, any>;
    required?: string[];
  };
  handler: FunctionHandler;
}

export type FunctionHandler = (
  params: Record<string, any>,
  context?: FunctionContext
) => Promise<any>;

export interface FunctionContext {
  apiKey?: string;
  userId?: string;
  sessionId?: string;
  [key: string]: any;
}

export interface FunctionRegistry {
  [key: string]: FunctionDefinition;
}

// Job types
export interface Job {
  id?: string;
  name: string;
  data: any;
  priority?: number;
  delay?: number;
  attempts?: number;
  backoff?: {
    type: 'fixed' | 'exponential';
    delay: number;
  };
  timeout?: number;
  removeOnComplete?: boolean;
  removeOnFail?: boolean;
}

export interface JobResult {
  jobId: string;
  result: any;
  error?: Error;
  duration: number;
  completedAt: Date;
}

export enum JobStatus {
  WAITING = 'waiting',
  ACTIVE = 'active',
  COMPLETED = 'completed',
  FAILED = 'failed',
  DELAYED = 'delayed',
  PAUSED = 'paused',
}

// LLM types
export interface LLMConfig {
  provider: 'openai' | 'anthropic' | 'google';
  model: string;
  apiKeyName: string;
  temperature?: number;
  maxTokens?: number;
  topP?: number;
  frequencyPenalty?: number;
  presencePenalty?: number;
  systemPrompt?: string;
  responseFormat?: 'text' | 'json_object';
}

export interface LLMMessage {
  role: 'system' | 'user' | 'assistant' | 'function';
  content: string;
  name?: string;
  function_call?: {
    name: string;
    arguments: string;
  };
}

export interface LLMResponse {
  id: string;
  content: string;
  model: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  functionCalls?: Array<{
    name: string;
    arguments: Record<string, any>;
  }>;
}

// Agent types
export interface AgentConfig {
  name: string;
  version: string;
  functions?: {
    enabled: boolean;
    registry?: string[];
  };
  messaging?: {
    enabled: boolean;
    config?: MessageConfig;
  };
  jobQueue?: {
    enabled: boolean;
    concurrency?: number;
    retryAttempts?: number;
    retryDelay?: number;
  };
  llm?: {
    enabled: boolean;
    config?: LLMConfig;
  };
}