import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';
import * as dotenv from 'dotenv';

import { AgentConfig, IncomingMessage, LLMMessage } from '../types';

import FunctionManager from './FunctionManager';
import MessagingManager from './MessagingManager';
import JobQueueManager from './JobQueueManager';
import LLMManager from './LLMManager';

dotenv.config();

/**
 * Central AgentManager class that orchestrates all components
 */
export class AgentManager extends EventEmitter {
  private name: string;
  private version: string;
  private functionManager?: FunctionManager;
  private messagingManager?: MessagingManager;
  private jobQueueManager?: JobQueueManager;
  private llmManager?: LLMManager;
  private agentLLM?: LLMManager; // Dedicated LLM for agent decision making
  private config: AgentConfig;
  private isInitialized: boolean = false;

  /**
   * Create a new AgentManager instance
   * @param config Agent configuration
   */
  constructor(config: AgentConfig) {
    super();
    this.name = config.name;
    this.version = config.version;
    this.config = config;
  }

  /**
   * Initialize the agent and all enabled components
   */
  public async initialize(): Promise<void> {
    console.log(`Initializing agent: ${this.name} v${this.version}`);
    
    // Initialize Function Manager if enabled
    if (this.config.functions?.enabled) {
      this.functionManager = new FunctionManager();
      
      // Load functions from registry if specified
      if (this.config.functions.registry && this.config.functions.registry.length > 0) {
        const functionsDir = 'functions';
        this.functionManager.loadFunctionsFromDirectory(functionsDir);
        console.log(`Loaded functions from ${functionsDir}`);
      }
    }
    
    // Initialize Messaging Manager if enabled
    if (this.config.messaging?.enabled) {
      if (!this.config.messaging.config) {
        throw new Error('Messaging configuration is required when messaging is enabled');
      }
      
      this.messagingManager = new MessagingManager(this.config.messaging.config);
      
      try {
        // Connect to RabbitMQ
        const rabbitmqUrl = process.env.RABBITMQ_URL || 'amqp://guest:guest@127.0.0.1:5672';
        await this.messagingManager.initialize(rabbitmqUrl);
        
        // Set up message handler
        this.messagingManager.on('message', this.handleIncomingMessage.bind(this));
        this.messagingManager.on('error', (error) => {
          console.error('Messaging error:', error);
          this.emit('error', { source: 'messaging', error });
        });
        
        console.log('Messaging Manager initialized');
      } catch (error) {
        console.error('Failed to initialize Messaging Manager:', error);
        console.log('Continuing without messaging functionality');
      }
    }
    
    // Initialize Job Queue Manager if enabled
    if (this.config.jobQueue?.enabled) {
      try {
        this.jobQueueManager = new JobQueueManager({
          concurrency: this.config.jobQueue.concurrency || 5,
          retryAttempts: this.config.jobQueue.retryAttempts || 3,
          retryDelay: this.config.jobQueue.retryDelay || 5000,
          notifyMessaging: false // AgentManager will handle messaging
        });
        
        // Set up job event handlers
        this.jobQueueManager.on('job:completed', (result) => {
          this.emit('job:completed', result);
          // Process job result with agent LLM if needed
          this.processJobResult(result);
        });
        
        this.jobQueueManager.on('job:failed', (result) => {
          this.emit('job:failed', result);
          this.emit('error', { source: 'job', error: result.error });
        });
        
        console.log('Job Queue Manager initialized');
      } catch (error) {
        console.error('Failed to initialize Job Queue Manager:', error);
        console.log('Continuing without job queue functionality');
      }
    }
    
    // Initialize LLM Manager for functions if enabled
    if (this.config.llm?.enabled) {
      if (!this.config.llm.config) {
        throw new Error('LLM configuration is required when LLM is enabled');
      }
      
      try {
        this.llmManager = new LLMManager(this.config.llm.config);
        console.log(`LLM Manager initialized with ${this.config.llm.config.provider}/${this.config.llm.config.model}`);
        
        // Create a dedicated Agent LLM for orchestration with a special system prompt
        if (this.llmManager) {
          const agentLLMConfig = {
            ...this.config.llm.config,
            systemPrompt: this.getAgentSystemPrompt()
          };
          
          this.agentLLM = new LLMManager(agentLLMConfig);
          console.log('Agent LLM initialized for orchestration');
        }
      } catch (error) {
        console.error('Failed to initialize LLM Manager:', error);
        console.log('Continuing without LLM functionality');
      }
    }
    
    this.isInitialized = true;
    this.emit('initialized');
    console.log(`Agent ${this.name} v${this.version} initialized successfully`);
  }

  /**
   * Generate the system prompt for the agent LLM
   */
  private getAgentSystemPrompt(): string {
    const functionSchemas = this.functionManager ? 
      JSON.stringify(this.functionManager.getAllFunctionSchemas(), null, 2) : 
      'None registered yet';
    
    return `You are an AI agent orchestrator. You will receive messages in JSON format and need to:
1. Analyze the content and determine the best course of action
2. You can call functions provided to you to get information or perform tasks
3. You can schedule jobs for longer-running tasks
4. After gathering all needed information, craft a comprehensive response

Available functions: ${functionSchemas}

Your response should be in JSON format with these possible fields:
- functionCalls: Array of {name, arguments} if you need to call functions
- scheduleJob: {name, data, options} if you need to schedule a job
- checkJobStatus: {jobId} if you need to check a job status
- response: Final response to send back
- error: Error message if something went wrong`;
  }

  /**
   * Handle incoming messages from the messaging system
   * @param message The incoming message
   */
  private async handleIncomingMessage(message: IncomingMessage): Promise<void> {
    console.log(`Processing incoming message: ${message.id} (${message.type})`);
    this.emit('message:received', message);
    
    try {
      let response: any;
      
      // Process message with agent LLM if available
      if (this.agentLLM && message.type !== 'function:result' && message.type !== 'job:result') {
        response = await this.processMessageWithLLM(message);
      } else {
        // Direct processing based on message type
        switch (message.type) {
          case 'function:execute':
            response = await this.executeFunction(
              message.payload.name,
              message.payload.params,
              message.payload.context
            );
            break;
          
          case 'job:schedule':
            const jobId = await this.scheduleJob(
              message.payload.name,
              message.payload.data,
              message.payload.options
            );
            response = { jobId };
            break;
          
          case 'job:status':
            const status = await this.getJobStatus(message.payload.jobId);
            response = { status };
            break;
            
          default:
            // For unhandled message types
            this.emit('message:custom', message);
            response = { received: true, processed: false, message: 'Unhandled message type' };
        }
      }
      
      // Send response message if there's a reply-to queue
      if (this.messagingManager && message.replyTo) {
        await this.messagingManager.sendMessage(
          'response',
          response,
          message.id,
          { originalType: message.type }
        );
      }
      
      // Send acknowledgment
      if (this.messagingManager) {
        await this.messagingManager.sendAcknowledgment(
          message.id,
          'success',
          { processed: true }
        );
      }
      
      this.emit('message:processed', { messageId: message.id, response });
    } catch (error) {
      console.error(`Error processing message ${message.id}:`, error);
      
      // Send error acknowledgment
      if (this.messagingManager) {
        await this.messagingManager.sendAcknowledgment(
          message.id,
          'error',
          {
            error: error instanceof Error ? error.message : String(error)
          }
        );
      }
      
      this.emit('error', { source: 'message', messageId: message.id, error });
    }
  }
  
  /**
   * Process a message using the Agent LLM to determine actions
   */
  private async processMessageWithLLM(message: IncomingMessage): Promise<any> {
    if (!this.agentLLM) {
      throw new Error('Agent LLM not initialized');
    }
    
    // Convert message to a format suitable for the LLM
    const llmMessages: LLMMessage[] = [
      {
        role: 'user',
        content: JSON.stringify({
          messageId: message.id,
          messageType: message.type,
          payload: message.payload,
          metadata: message.metadata,
          timestamp: message.timestamp
        }, null, 2)
      }
    ];
    
    // Get LLM response
    const llmResponse = await this.agentLLM.sendMessage(llmMessages);
    let parsedResponse: any = {};
    
    // Parse the response from LLM
    try {
      if (llmResponse.content) {
        parsedResponse = JSON.parse(llmResponse.content);
      } else if (llmResponse.functionCalls && llmResponse.functionCalls.length > 0) {
        parsedResponse = { functionCalls: llmResponse.functionCalls };
      }
    } catch (error) {
      console.error('Error parsing LLM response:', error);
      throw new Error('Failed to parse LLM response');
    }
    
    // Handle function calls if needed
    if (parsedResponse.functionCalls && parsedResponse.functionCalls.length > 0) {
      const functionResults = [];
      
      for (const call of parsedResponse.functionCalls) {
        try {
          const result = await this.executeFunction(call.name, call.arguments);
          functionResults.push({ name: call.name, result });
        } catch (error) {
          functionResults.push({ 
            name: call.name, 
            error: error instanceof Error ? error.message : String(error) 
          });
        }
      }
      
      // If there were function calls, pass results back to LLM for final response
      if (functionResults.length > 0) {
        const followUpMessages: LLMMessage[] = [
          ...llmMessages,
          {
            role: 'assistant' as const,
            content: llmResponse.content || 'I need to call some functions to process this.'
          },
          {
            role: 'function' as const,
            name: 'functionResults',
            content: JSON.stringify(functionResults)
          }
        ];
        
        const finalResponse = await this.agentLLM.sendMessage(followUpMessages);
        try {
          return finalResponse.content ? JSON.parse(finalResponse.content) : { error: 'No content in final response' };
        } catch (error) {
          console.error('Error parsing final LLM response:', error);
          return { content: finalResponse.content };
        }
      }
    }
    
    // Handle job scheduling if needed
    if (parsedResponse.scheduleJob) {
      const job = parsedResponse.scheduleJob;
      const jobId = await this.scheduleJob(job.name, job.data, job.options);
      parsedResponse.jobId = jobId;
    }
    
    // Handle job status checking if needed
    if (parsedResponse.checkJobStatus) {
      const status = await this.getJobStatus(parsedResponse.checkJobStatus.jobId);
      parsedResponse.jobStatus = status;
    }
    
    return parsedResponse.response || parsedResponse;
  }
  
  /**
   * Process a job result with the Agent LLM if needed
   */
  private async processJobResult(result: any): Promise<void> {
    if (!this.agentLLM) return;
    
    // Create messages for LLM to process job result
    const llmMessages: LLMMessage[] = [
      {
        role: 'user',
        content: JSON.stringify({
          type: 'job:result',
          jobId: result.jobId,
          result: result.result,
          error: result.error,
          duration: result.duration,
          completedAt: result.completedAt
        }, null, 2)
      }
    ];
    
    // Get LLM response
    const llmResponse = await this.agentLLM.sendMessage(llmMessages);
    let parsedResponse: any = {};
    
    // Parse the response from LLM
    try {
      if (llmResponse.content) {
        parsedResponse = JSON.parse(llmResponse.content);
      }
    } catch (error) {
      console.error('Error parsing LLM response for job result:', error);
      return;
    }
    
    // If there's a notification to send, send it via messaging manager
    if (parsedResponse.notification && this.messagingManager) {
      await this.messagingManager.sendMessage(
        'job:notification',
        parsedResponse.notification,
        result.jobId
      );
    }
  }

  /**
   * Send a message through the messaging system
   * @param type Message type
   * @param payload Message payload
   * @param metadata Optional metadata
   */
  public async sendMessage(
    type: string,
    payload: any,
    metadata?: Record<string, any>
  ): Promise<string> {
    if (!this.messagingManager) {
      throw new Error('Messaging Manager is not initialized');
    }
    
    return await this.messagingManager.sendMessage(type, payload, undefined, metadata);
  }

  /**
   * Execute a function
   * @param name Function name
   * @param params Function parameters
   * @param context Optional execution context
   */
  public async executeFunction(
    name: string,
    params: Record<string, any>,
    context?: Record<string, any>
  ): Promise<any> {
    if (!this.functionManager) {
      throw new Error('Function Manager is not initialized');
    }
    
    return await this.functionManager.executeFunction(name, params, context);
  }

  /**
   * Schedule a job
   * @param name Job name
   * @param data Job data
   * @param options Optional job options
   */
  public async scheduleJob(
    name: string,
    data: any,
    options?: {
      priority?: number;
      delay?: number;
      attempts?: number;
    }
  ): Promise<string> {
    if (!this.jobQueueManager) {
      throw new Error('Job Queue Manager is not initialized');
    }
    
    return await this.jobQueueManager.addJob({
      name,
      data,
      priority: options?.priority,
      delay: options?.delay,
      attempts: options?.attempts
    });
  }

  /**
   * Get job status
   * @param jobId Job ID
   */
  public async getJobStatus(jobId: string): Promise<string | null> {
    if (!this.jobQueueManager) {
      throw new Error('Job Queue Manager is not initialized');
    }
    
    return await this.jobQueueManager.getJobStatus(jobId);
  }

  /**
   * Generate a response using the function LLM
   * @param prompt The prompt to send to the LLM
   * @param options Optional LLM configuration options
   */
  public async generateResponse(
    prompt: string,
    options?: Record<string, any>
  ): Promise<string> {
    if (!this.llmManager) {
      throw new Error('LLM Manager is not initialized');
    }
    
    return await this.llmManager.generateCompletion(prompt, options);
  }

  /**
   * Shutdown the agent and all its components
   */
  public async shutdown(): Promise<void> {
    console.log(`Shutting down agent: ${this.name} v${this.version}`);
    
    if (this.jobQueueManager) {
      await this.jobQueueManager.close().catch(err => {
        console.error('Error closing Job Queue Manager:', err);
      });
    }
    
    if (this.messagingManager) {
      await this.messagingManager.close().catch(err => {
        console.error('Error closing Messaging Manager:', err);
      });
    }
    
    console.log(`Agent ${this.name} shutdown complete`);
  }
}

export default AgentManager;