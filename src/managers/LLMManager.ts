import { LLMConfig, LLMMessage, LLMResponse } from '../types';
import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';
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

  /**
   * Create a new LLMManager
   * @param config Initial LLM configuration
   */
  constructor(config: LLMConfig) {
    this.config = config;
    this.loadApiKeys();
    this.initializeClients();
  }

  /**
   * Load API keys from environment variables
   */
  private loadApiKeys(): void {
    const envVars = process.env;
    
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
          console.error(`Error parsing API keys for ${key}:`, error);
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
      console.warn(`No API key found for ${this.config.apiKeyName}. LLM functionality will be limited.`);
      return;
    }
    
    switch (this.config.provider) {
      case 'openai':
        this.openaiClient = new OpenAI({ apiKey });
        break;
      case 'anthropic':
        this.anthropicClient = new Anthropic({ apiKey });
        break;
      case 'google':
        console.log('Google API client not yet implemented');
        break;
      default:
        console.warn(`Unsupported LLM provider: ${this.config.provider}`);
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
      return keys[index % keys.length];
    }
    
    return undefined;
  }

  /**
   * Update the LLM configuration
   * @param config New LLM configuration
   */
  public updateConfig(config: Partial<LLMConfig>): void {
    this.config = { ...this.config, ...config };
    
    if (config.provider || config.apiKeyName) {
      this.initializeClients();
    }
  }

  /**
   * Send a message to the LLM and get a response
   * @param messages Array of messages to send to the LLM
   * @param options Optional parameters to override configuration
   */
  public async sendMessage(
    messages: LLMMessage[],
    options: Partial<LLMConfig> = {}
  ): Promise<LLMResponse> {
    const config = { ...this.config, ...options };
    
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
    
    // Prepare the request options
    const requestOptions: any = {
      model: config.model,
      messages: messages,
      temperature: config.temperature,
      max_tokens: config.maxTokens,
      top_p: config.topP,
      frequency_penalty: config.frequencyPenalty,
      presence_penalty: config.presencePenalty
    };
    
    // Add functions if available
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
   * Generate a simple text completion
   * @param prompt The prompt text
   * @param options Optional parameters to override configuration
   */
  public async generateCompletion(
    prompt: string,
    options: Partial<LLMConfig> = {}
  ): Promise<string> {
    const messages: LLMMessage[] = [];
    
    // Add system message if specified
    if (this.config.systemPrompt || options.systemPrompt) {
      messages.push({
        role: 'system',
        content: options.systemPrompt || this.config.systemPrompt || ''
      });
    }
    
    // Add the user prompt
    messages.push({
      role: 'user',
      content: prompt
    });
    
    // Send the message and return the content
    const response = await this.sendMessage(messages, options);
    return response.content;
  }
}

export default LLMManager;