import { LLMConfig, LLMMessage, LLMResponse, ModelRegistry, FunctionContext, IncomingMessage } from '../types';
import { FunctionManager } from './FunctionManager';
import { JobQueueManager } from './JobQueueManager';
import { MessagingManager } from './MessagingManager';
import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';
import { v4 as uuidv4 } from 'uuid';
import * as dotenv from 'dotenv';

dotenv.config();

/**
 * LLM Manager for interacting with language models
 */
export class LLMManager {
  private config: LLMConfig;
  private apiKeys: Record<string, string[]> = {};
  private openaiClient?: OpenAI;
  private anthropicClient?: Anthropic;
  private functionManager?: FunctionManager;
  private jobQueueManager?: JobQueueManager;
  private messagingManager?: MessagingManager;
  private modelRegistry: ModelRegistry = {};
  private masterModel?: LLMConfig;

  /**
   * Create a new LLMManager
   * @param config Initial LLM configuration
   * @param functionManager Optional function manager for AI function calling
   * @param jobQueueManager Optional job queue manager for scheduling tasks
   * @param messagingManager Optional messaging manager for sending responses
   */
  constructor(
    config: LLMConfig,
    functionManager?: FunctionManager,
    jobQueueManager?: JobQueueManager,
    messagingManager?: MessagingManager
  ) {
    this.config = config;
    this.functionManager = functionManager;
    this.jobQueueManager = jobQueueManager;
    this.messagingManager = messagingManager;
    this.loadApiKeys();
    this.initializeClients();

    // Set up the master model with the same config as default
    this.masterModel = { ...config };
  }

  /**
   * Load API keys from environment variables
   */
  private loadApiKeys(): void {
    const envVars = process.env;

    // Extract API keys from environment variables
    Object.keys(envVars).forEach((key) => {
      if (key.endsWith('_API_KEYS')) {
        try {
          const apiKeyName = key.replace('_API_KEYS', '').toLowerCase();
          const keysValue = envVars[key];

          if (keysValue) {
            const keys = JSON.parse(keysValue);
            if (Array.isArray(keys)) {
              this.apiKeys[apiKeyName] = keys;
            }
          }
        } catch (error) {
          console.error(`Error parsing API keys for ${key}: ${error}`);
        }
      }
    });
  }

  /**
   * Initialize API clients based on the current configuration
   */
  private initializeClients(): void {
    const apiKey = this.getApiKey(this.config.apiKeyName);

    if (!apiKey) {
      throw new Error(`No API key found for ${this.config.apiKeyName}`);
    }

    switch (this.config.provider) {
      case 'openai':
        this.openaiClient = new OpenAI({ apiKey });
        break;
      case 'anthropic':
        this.anthropicClient = new Anthropic({ apiKey });
        break;
      case 'google':
        // Google API client would be initialized here
        console.log('Google API client not yet implemented');
        break;
      default:
        throw new Error(`Unsupported LLM provider: ${this.config.provider}`);
    }
  }

  /**
   * Get an API key for a specific service
   * @param apiKeyName Name of the API key service
   * @param index Index of the specific key to retrieve
   */
  private getApiKey(apiKeyName: string, index: number = 0): string | undefined {
    const normalizedName = apiKeyName.toLowerCase();
    const keys = this.apiKeys[normalizedName] || [];

    if (keys.length > 0) {
      return keys[index % keys.length]; // Cycle through keys if index is out of bounds
    }

    return undefined;
  }

  /**
   * Update the LLM configuration
   * @param config New LLM configuration
   */
  public updateConfig(config: Partial<LLMConfig>): void {
    this.config = { ...this.config, ...config };

    // Reinitialize clients if provider or API key changed
    if (config.provider || config.apiKeyName) {
      this.initializeClients();
    }
  }

  /**
   * Get the current LLM configuration
   */
  public getConfig(): LLMConfig {
    return { ...this.config };
  }

  /**
   * Register a model with the model registry
   * @param modelId Unique identifier for the model
   * @param config Configuration for the model
   */
  public registerModel(modelId: string, config: LLMConfig): void {
    this.modelRegistry[modelId] = config;
  }

  /**
   * Get a model configuration from the registry
   * @param modelId Identifier for the model
   */
  public getModelConfig(modelId: string): LLMConfig | undefined {
    return this.modelRegistry[modelId];
  }

  /**
   * Update the master model configuration
   * @param config New configuration for the master model
   */
  public updateMasterModel(config: Partial<LLMConfig>): void {
    if (!this.masterModel) {
      this.masterModel = { ...this.config };
    }
    this.masterModel = { ...this.masterModel, ...config };
  }

  /**
   * Get the master model configuration
   */
  public getMasterModelConfig(): LLMConfig | undefined {
    return this.masterModel ? { ...this.masterModel } : undefined;
  }

  /**
   * Get available models for the current provider
   */
  public async getAvailableModels(): Promise<string[]> {
    try {
      switch (this.config.provider) {
        case 'openai':
          if (!this.openaiClient) {
            throw new Error('OpenAI client not initialized');
          }
          const response = await this.openaiClient.models.list();
          return response.data.map(model => model.id);

        case 'anthropic':
          // Anthropic doesn't have a list models endpoint, so return hardcoded supported models
          return [
            'claude-3-opus-20240229',
            'claude-3-sonnet-20240229',
            'claude-3-haiku-20240307',
            'claude-2.1',
            'claude-2.0',
            'claude-instant-1.2'
          ];

        case 'google':
          // Would implement Google model listing here
          return ['gemini-pro', 'gemini-ultra'];

        default:
          return [];
      }
    } catch (error) {
      console.error('Error getting available models:', error);
      return [];
    }
  }
  /**
   * Send a message to the LLM and get a response
   * @param messages Array of messages to send to the LLM
   * @param options Optional parameters to override configuration
   * @param modelId Optional model ID to use for this request
   */
  public async sendMessage(
    messages: LLMMessage[],
    options: Partial<LLMConfig> = {},
    modelId?: string
  ): Promise<LLMResponse> {
    // Determine which config to use
    let config: LLMConfig;

    if (modelId && this.modelRegistry[modelId]) {
      // Use the specified model from the registry
      config = { ...this.modelRegistry[modelId], ...options };
    } else {
      // Use the default config
      config = { ...this.config, ...options };
    }

    try {
      switch (config.provider) {
        case 'openai':
          return await this.sendOpenAIMessage(messages, config);

        case 'anthropic':
          return await this.sendAnthropicMessage(messages, config);

        case 'google':
          throw new Error('Google AI integration not yet implemented');

        default:
          throw new Error(`Unsupported LLM provider: ${config.provider}`);
      }
    } catch (error) {
      console.error('Error sending message to LLM:', error);
      throw error;
    }
  }

  /**
   * Send a message to OpenAI
   * @param messages Messages to send
   * @param config Configuration options
   */
  private async sendOpenAIMessage(
    messages: LLMMessage[],
    config: LLMConfig
  ): Promise<LLMResponse> {
    if (!this.openaiClient) {
      throw new Error('OpenAI client not initialized');
    }

    // Prepare function calling if a function manager is provided
    const functions = this.prepareFunctionCalling();

    // Prepare the request options
    const requestOptions: OpenAI.ChatCompletionCreateParams = {
      model: config.model,
      messages: messages as any,
      temperature: config.temperature,
      max_tokens: config.maxTokens,
      top_p: config.topP,
      frequency_penalty: config.frequencyPenalty,
      presence_penalty: config.presencePenalty
    };

    // Add functions if available
    if (functions && functions.length > 0) {
      requestOptions.functions = functions as any;
      requestOptions.function_call = 'auto';
    }

    // Add response format if specified
    if (config.responseFormat === 'json_object') {
      requestOptions.response_format = { type: 'json_object' };
    }

    // Send the request to OpenAI
    const response = await this.openaiClient.chat.completions.create(requestOptions);

    // Extract the first choice from the response
    const choice = response.choices[0];
    const message = choice.message;

    // Process function calls if present
    let functionCalls;
    if (message.function_call) {
      functionCalls = [{
        name: message.function_call.name,
        arguments: JSON.parse(message.function_call.arguments)
      }];
    }

    // Return standardized response
    return {
      id: response.id,
      content: message.content || '',
      model: response.model,
      usage: {
        promptTokens: response.usage?.prompt_tokens || 0,
        completionTokens: response.usage?.completion_tokens || 0,
        totalTokens: response.usage?.total_tokens || 0
      },
      functionCalls
    };
  }

  /**
   * Send a message to Anthropic
   * @param messages Messages to send
   * @param config Configuration options
   */
  private async sendAnthropicMessage(
    messages: LLMMessage[],
    config: LLMConfig
  ): Promise<LLMResponse> {
    if (!this.anthropicClient) {
      throw new Error('Anthropic client not initialized');
    }

    // Convert LLMMessages to Anthropic format
    const anthropicMessages = messages.map(msg => {
      if (msg.role === 'system') {
        return { role: 'user' as const, content: msg.content };
      } else if (msg.role === 'assistant') {
        return { role: 'assistant' as const, content: msg.content };
      } else {
        return { role: 'user' as const, content: msg.content };
      }
    });

    // Add system prompt if specified
    if (config.systemPrompt) {
      anthropicMessages.unshift({ role: 'user' as const, content: config.systemPrompt });
    }

    // Prepare the request options
    const requestOptions = {
      model: config.model,
      messages: anthropicMessages,
      temperature: config.temperature,
      max_tokens: config.maxTokens || 1024,
      top_p: config.topP
    };

    // Send the request to Anthropic
    const response = await this.anthropicClient.messages.create(requestOptions);

    // Return standardized response
    return {
      id: response.id,
      content: response.content[0].type === 'text' ? response.content[0].text : '',
      model: response.model,
      usage: {
        promptTokens: 0, // Anthropic doesn't provide token usage details
        completionTokens: 0,
        totalTokens: 0
      }
    };
  }
  /**
   * Prepare function calling for OpenAI
   */
  private prepareFunctionCalling(): any[] | undefined {
    if (!this.functionManager) {
      return undefined;
    }

    // Get function schemas from the function manager
    const functionSchemas = this.functionManager.getAllFunctionSchemas();

    return functionSchemas.length > 0 ? functionSchemas : undefined;
  }

  /**
   * Execute a function call from an LLM response
   * @param functionCall The function call information
   * @param context Optional context for function execution
   */
  public async executeFunctionCall(
    functionCall: { name: string; arguments: Record<string, any> },
    context?: FunctionContext
  ): Promise<any> {
    if (!this.functionManager) {
      throw new Error('Function manager not available');
    }

    return await this.functionManager.executeFunction(
      functionCall.name,
      functionCall.arguments,
      context
    );
  }

  /**
   * Generate a simple text completion using a specific model
   * @param prompt The prompt text
   * @param options Optional parameters to override configuration
   * @param modelId Optional model ID to use for this request
   */
  public async generateCompletion(
    prompt: string,
    options: Partial<LLMConfig> = {},
    modelId?: string
  ): Promise<string> {
    const messages: LLMMessage[] = [];

    // Determine which config to use
    let config: LLMConfig;

    if (modelId && this.modelRegistry[modelId]) {
      config = { ...this.modelRegistry[modelId], ...options };
    } else {
      config = { ...this.config, ...options };
    }

    // Add system message if specified
    if (config.systemPrompt) {
      messages.push({
        role: 'system',
        content: config.systemPrompt
      });
    }

    // Add the user prompt
    messages.push({
      role: 'user',
      content: prompt
    });

    // Send the message and return the content
    const response = await this.sendMessage(messages, options, modelId);
    return response.content;
  }

  /**
   * Have a conversation with the LLM, managing message history
   * @param userMessage The user message to send
   * @param conversationHistory Previous messages in the conversation
   * @param options Optional parameters to override configuration
   * @param modelId Optional model ID to use for this conversation
   */
  public async chat(
    userMessage: string,
    conversationHistory: LLMMessage[] = [],
    options: Partial<LLMConfig> = {},
    modelId?: string
  ): Promise<{ response: LLMResponse; updatedHistory: LLMMessage[] }> {
    // Create a copy of the conversation history
    const messages = [...conversationHistory];

    // Determine which config to use
    let config: LLMConfig;

    if (modelId && this.modelRegistry[modelId]) {
      config = { ...this.modelRegistry[modelId], ...options };
    } else {
      config = { ...this.config, ...options };
    }

    // Add system message if not already present
    if (
      messages.length === 0 ||
      !messages.some(msg => msg.role === 'system')
    ) {
      const systemPrompt = config.systemPrompt || '';
      if (systemPrompt) {
        messages.unshift({
          role: 'system',
          content: systemPrompt
        });
      }
    }

    // Add the user message
    messages.push({
      role: 'user',
      content: userMessage
    });

    // Send the message
    const response = await this.sendMessage(messages, options, modelId);

    // Add the assistant response to the history
    const assistantMessage: LLMMessage = {
      role: 'assistant',
      content: response.content
    };

    // Add function calls if present
    if (response.functionCalls && response.functionCalls.length > 0) {
      assistantMessage.function_call = {
        name: response.functionCalls[0].name,
        arguments: JSON.stringify(response.functionCalls[0].arguments)
      };
    }

    messages.push(assistantMessage);

    return {
      response,
      updatedHistory: messages
    };
  }
  /**
   * Process an incoming message using the Master Model
   * @param message The incoming message to process
   */
  public async processMasterModelMessage(message: IncomingMessage): Promise<any> {
    if (!this.masterModel) {
      throw new Error('Master Model not configured');
    }

    if (!this.functionManager) {
      throw new Error('Function Manager not available for Master Model');
    }

    // Create a context message with information about the received message
    const contextMessage = `Received message:
Type: ${message.type}
ID: ${message.id}
Timestamp: ${new Date(message.timestamp).toISOString()}
Payload: ${JSON.stringify(message.payload, null, 2)}
`;

    // Create an instruction message about capabilities
    const instructionMessage = `You are the Master Model that controls this AI agent system. 
You can analyze the message and decide what to do with it. You have these capabilities:
1. Execute functions by returning a JSON object with {"action": "executeFunction", "functionName": "name", "params": {}}
2. Schedule jobs by returning {"action": "scheduleJob", "jobName": "name", "data": {}, "options": {}}
3. Send a response message by returning {"action": "sendResponse", "content": "your message", "type": "responseType"}
4. Do nothing by returning {"action": "none", "reason": "reason for inaction"}

Available functions: ${this.functionManager.listFunctions().join(", ")}
`;

    // Prepare messages for the LLM
    const messages: LLMMessage[] = [
      {
        role: 'system',
        content: this.masterModel.systemPrompt || instructionMessage
      },
      {
        role: 'user',
        content: contextMessage
      }
    ];

    // Send to LLM and get response
    const response = await this.sendMessage(messages, {}, 'masterModel');

    // Try to parse the response as JSON action
    try {
      let action: any;

      // Check if the response has a function call
      if (response.functionCalls && response.functionCalls.length > 0) {
        const functionCall = response.functionCalls[0];

        // Execute the function directly
        return await this.executeFunctionCall(functionCall, {
          messageId: message.id,
          messageType: message.type
        });
      } else {
        // Try to parse the content as JSON action
        try {
          action = JSON.parse(response.content);
        } catch (e) {
          // If not valid JSON, create a default response action
          action = {
            action: 'sendResponse',
            content: response.content,
            type: 'text'
          };
        }

        // Process the action
        switch (action.action) {
          case 'executeFunction':
            if (!action.functionName || !action.params) {
              throw new Error('Invalid function execution request');
            }

            return await this.functionManager.executeFunction(
              action.functionName,
              action.params,
              { messageId: message.id, messageType: message.type }
            );

          case 'scheduleJob':
            if (!this.jobQueueManager) {
              throw new Error('Job Queue Manager not available');
            }

            if (!action.jobName || !action.data) {
              throw new Error('Invalid job scheduling request');
            }

            return await this.jobQueueManager.addJob({
              name: action.jobName,
              data: action.data,
              priority: action.options?.priority,
              delay: action.options?.delay,
              attempts: action.options?.attempts
            });

          case 'sendResponse':
            if (!this.messagingManager) {
              throw new Error('Messaging Manager not available');
            }

            return await this.messagingManager.sendMessage(
              action.type || 'response',
              { content: action.content },
              message.id,
              { processed: true, by: 'masterModel' }
            );

          case 'none':
            return { action: 'none', reason: action.reason };

          default:
            return { error: 'Unknown action type', originalAction: action };
        }
      }
    } catch (error) {
      console.error('Error processing Master Model action:', error);
      throw error;
    }
  }

  /**
   * Execute a function using a specific LLM model
   * @param functionName Name of the function to execute
   * @param params Function parameters
   * @param context Function context
   * @param modelId ID of the model to use for this function
   */
  public async executeFunctionWithModel(
    functionName: string,
    params: Record<string, any>,
    context?: FunctionContext,
    modelId?: string
  ): Promise<any> {
    if (!this.functionManager) {
      throw new Error('Function Manager not available');
    }

    // Get the function definition
    const functionDef = this.functionManager.getFunction(functionName);
    if (!functionDef) {
      throw new Error(`Function ${functionName} not found`);
    }

    // If the function has a preferred model ID and none was specified, use that
    if (!modelId && functionDef.preferredModelId) {
      modelId = functionDef.preferredModelId;
    }

    // Set the current LLM in the context
    const llmContext = {
      ...context,
      llm: {
        manager: this,
        modelId
      }
    };

    // Execute the function with the LLM context
    return await this.functionManager.executeFunction(
      functionName,
      params,
      llmContext
    );
  }
  /**
 * Get the full model registry
 * @returns The model registry containing all registered models
 */
  public getModelRegistry(): ModelRegistry {
    return { ...this.modelRegistry };
  }

  /**
   * Unregister a model from the registry
   * @param modelId The ID of the model to unregister
   * @returns True if the model was found and unregistered, false otherwise
   */
  public unregisterModel(modelId: string): boolean {
    if (modelId === 'masterModel') {
      throw new Error('Cannot unregister the Master Model');
    }

    if (this.modelRegistry[modelId]) {
      delete this.modelRegistry[modelId];
      return true;
    }

    return false;
  }
}

export default LLMManager;