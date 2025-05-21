import { AgentConfig, IncomingMessage, Message, LLMMessage } from './types';
import FunctionManager from './managers/FunctionManager';
import MessagingManager from './managers/MessagingManager';
import JobQueueManager from './managers/JobQueueManager';
import LLMManager from './managers/LLMManager';
import { EventEmitter } from 'events';
import * as path from 'path';
import * as dotenv from 'dotenv';

dotenv.config();

/**
 * Main Agent class that brings together all components
 */
export class Agent extends EventEmitter {
  private name: string;
  private version: string;
  private functionManager?: FunctionManager;
  private messagingManager?: MessagingManager;
  private jobQueueManager?: JobQueueManager;
  private llmManager?: LLMManager;
  private config: AgentConfig;
  private isInitialized: boolean = false;

  /**
   * Create a new Agent instance
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
        const functionsDir = path.join(__dirname, 'functions');
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
      
      // Connect to RabbitMQ
      const rabbitmqUrl = process.env.RABBITMQ_URL || 'amqp://guest:guest@127.0.0.1:5672';
      console.log('RabbitMQ Configuration:', {
        url: rabbitmqUrl,
        hasEnvUrl: !!process.env.RABBITMQ_URL,
        config: this.config.messaging.config
      });
      
      try {
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
        console.log('Continuing without Messaging Manager...');
        // Don't throw here, continue without messaging
      }
    }
    
    // Initialize Job Queue Manager if enabled
    if (this.config.jobQueue?.enabled) {
      try {
        this.jobQueueManager = new JobQueueManager({
          concurrency: this.config.jobQueue.concurrency || 5,
          retryAttempts: this.config.jobQueue.retryAttempts || 3,
          retryDelay: this.config.jobQueue.retryDelay || 5000,
          notifyMessaging: !!this.messagingManager,
          redis: {
            host: process.env.REDIS_HOST || 'localhost',
            port: parseInt(process.env.REDIS_PORT || '6379', 10),
            password: process.env.REDIS_PASSWORD
          }
        });
        
        // Set up job event handlers
        this.jobQueueManager.on('job:completed', (result) => {
          this.emit('job:completed', result);
        });
        
        this.jobQueueManager.on('job:failed', (result) => {
          this.emit('job:failed', result);
          this.emit('error', { source: 'job', error: result.error });
        });
        
        console.log('Job Queue Manager initialized');
      } catch (error) {
        console.error('Failed to initialize Job Queue Manager:', error);
        console.log('Continuing without Job Queue Manager...');
        // Don't throw here, continue without job queue
      }
    }
    
    // Initialize LLM Manager if enabled
    if (this.config.llm?.enabled) {
      if (!this.config.llm.config) {
        throw new Error('LLM configuration is required when LLM is enabled');
      }
      
      try {
        this.llmManager = new LLMManager(this.config.llm.config);
        console.log(`LLM Manager initialized with ${this.config.llm.config.provider}/${this.config.llm.config.model}`);
      } catch (error) {
        console.error('Failed to initialize LLM Manager:', error);
        console.log('Continuing without LLM Manager...');
        // Don't throw here, continue without LLM
      }
    }
    
    this.isInitialized = true;
    this.emit('initialized');
    console.log(`Agent ${this.name} v${this.version} initialized successfully`);
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
      
      // Process based on message type
      switch (message.type) {
        case 'function:execute':
          // Execute function directly
          if (!this.functionManager) {
            throw new Error('Function Manager is not initialized');
          }
          
          response = await this.functionManager.executeFunction(
            message.payload.name,
            message.payload.params,
            message.payload.context
          );
          break;
        
        case 'job:schedule':
          // Schedule a job
          if (!this.jobQueueManager) {
            throw new Error('Job Queue Manager is not initialized');
          }
          
          const jobId = await this.jobQueueManager.addJob(message.payload);
          response = { jobId };
          break;
        
        case 'job:status':
          // Get job status
          if (!this.jobQueueManager) {
            throw new Error('Job Queue Manager is not initialized');
          }
          
          const status = await this.jobQueueManager.getJobStatus(message.payload.jobId);
          response = { status };
          break;
        
        case 'llm:generate':
          // Generate LLM response
          if (!this.llmManager) {
            throw new Error('LLM Manager is not initialized');
          }
          
          response = await this.llmManager.sendMessage(
            message.payload.messages,
            message.payload.options
          );
          break;
        
        case 'agent:process':
          // Process a high-level agent request (intent/action/entity format)
          response = await this.processAgentRequest(message.payload);
          break;
        
        default:
          // Handle custom message types
          this.emit('message:custom', message);
          response = { received: true, processed: false, message: 'Unhandled message type' };
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
   * Process a high-level agent request with intent/action/entity format
   * @param payload The request payload
   */
  private async processAgentRequest(payload: any): Promise<any> {
    if (!this.llmManager) {
      throw new Error('LLM Manager is not initialized for processing agent requests');
    }

    // Format available functions for the LLM
    let functionsList = 'No functions available';
    if (this.functionManager) {
      const functions = this.functionManager.getAllFunctions();
      functionsList = functions.map(fn => 
        `${fn.name}: ${fn.description} (params: ${JSON.stringify(fn.parameters)})`
      ).join('\n');
    }

    // Create prompt for the LLM to determine action
    const messages: LLMMessage[] = [
      {
        role: 'system',
        content: `You are an AI Agent that processes requests and determines appropriate actions.
                 
                 When you receive a message with intent/action/entity, analyze it to determine:
                 1. If a function should be called directly, which one and with what parameters
                 2. If a job should be scheduled, which one and with what data
                 3. If a general response should be generated
                 
                 Format your response as a JSON object with:
                 {
                   "action": "call_function" | "schedule_job" | "generate_response",
                   "function": "<function_name>",  // If action is call_function
                   "parameters": {},               // If action is call_function
                   "job": "<job_name>",           // If action is schedule_job
                   "data": {},                    // If action is schedule_job
                   "options": {},                 // Optional settings
                   "response": ""                 // If action is generate_response
                 }
                 
                 Available functions:
                 ${functionsList}`
      },
      {
        role: 'user',
        content: JSON.stringify(payload)
      }
    ];
    
    // Get LLM interpretation
    const llmResponse = await this.llmManager.sendMessage(messages);
    let parsedResponse;
    
    try {
      // Try to parse the LLM response as JSON
      parsedResponse = JSON.parse(llmResponse.content);
    } catch (e) {
      // If not valid JSON, create a default response
      parsedResponse = {
        action: 'generate_response',
        response: llmResponse.content
      };
    }
    
    // Process based on determined action
    if (parsedResponse.action === 'call_function' && parsedResponse.function) {
      if (!this.functionManager) {
        throw new Error('Function Manager is not initialized');
      }
      
      // Execute the function
      const result = await this.functionManager.executeFunction(
        parsedResponse.function,
        parsedResponse.parameters || {},
        parsedResponse.context || {}
      );
      
      // Return result formatted for the agent response
      return {
        intent: "INFORM",
        action: "READ",
        entity: {
          type: "AGENT",
          context: {
            description: `Result of function: ${parsedResponse.function}`,
            data: result
          }
        }
      };
      
    } else if (parsedResponse.action === 'schedule_job' && parsedResponse.job) {
      if (!this.jobQueueManager) {
        throw new Error('Job Queue Manager is not initialized');
      }
      
      // Schedule the job
      const jobId = await this.jobQueueManager.addJob({
        name: parsedResponse.job,
        data: parsedResponse.data || {},
        priority: parsedResponse.options?.priority,
        delay: parsedResponse.options?.delay,
        attempts: parsedResponse.options?.attempts
      });
      
      // Return job scheduling confirmation
      return {
        intent: "INFORM",
        action: "READ",
        entity: {
          type: "AGENT",
          context: {
            description: `Scheduled job: ${parsedResponse.job}`,
            data: { jobId }
          }
        }
      };
      
    } else {
      // Generate a general response
      return {
        intent: "INFORM",
        action: "READ",
        entity: {
          type: "AGENT",
          context: {
            description: "Response from AI Agent",
            data: parsedResponse.response || llmResponse.content
          }
        }
      };
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
   * Process a high-level agent message with intent/action/entity format
   * This is a public API for direct calls
   * @param message The message to process
   */
  public async processMessage(message: any): Promise<any> {
    return await this.processAgentRequest(message);
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
   * Generate an AI response
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
   * Chat with the AI
   * @param userMessage The user message
   * @param conversationHistory Optional conversation history
   * @param options Optional LLM configuration options
   */
  public async chat(
    userMessage: string,
    conversationHistory: LLMMessage[] = [],
    options?: Record<string, any>
  ): Promise<{ response: string; history: LLMMessage[] }> {
    if (!this.llmManager) {
      throw new Error('LLM Manager is not initialized');
    }
    
    const result = await this.llmManager.sendMessage([
      ...conversationHistory,
      { role: 'user', content: userMessage }
    ], options);
    
    return {
      response: result.content,
      history: [...conversationHistory, { role: 'user', content: userMessage }, { role: 'assistant', content: result.content }]
    };
  }

  /**
   * Get the Function Manager instance
   */
  public getFunctionManager(): FunctionManager | undefined {
    return this.functionManager;
  }

  /**
   * Get the Messaging Manager instance
   */
  public getMessagingManager(): MessagingManager | undefined {
    return this.messagingManager;
  }

  /**
   * Get the Job Queue Manager instance
   */
  public getJobQueueManager(): JobQueueManager | undefined {
    return this.jobQueueManager;
  }

  /**
   * Get the LLM Manager instance
   */
  public getLLMManager(): LLMManager | undefined {
    return this.llmManager;
  }

  /**
   * Shutdown the agent and all its components
   */
  public async shutdown(): Promise<void> {
    console.log(`Shutting down agent: ${this.name} v${this.version}`);
    
    if (this.jobQueueManager) {
      try {
        await this.jobQueueManager.close();
        console.log('Job Queue Manager closed');
      } catch (error) {
        console.error('Error closing Job Queue Manager:', error);
      }
    }
    
    if (this.messagingManager) {
      try {
        await this.messagingManager.close();
        console.log('Messaging Manager closed');
      } catch (error) {
        console.error('Error closing Messaging Manager:', error);
      }
    }
    
    console.log(`Agent ${this.name} shutdown complete`);
  }
}

export default Agent;