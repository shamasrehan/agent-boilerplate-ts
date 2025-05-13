import { AgentConfig, IncomingMessage, Message } from './types';
import FunctionManager from './core/FunctionManager';
import MessagingManager from './core/MessagingManager';
import JobQueueManager from './core/JobQueueManager';
import LLMManager from './core/LLMManager';
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
      await this.messagingManager.initialize(rabbitmqUrl);
      
      // Set up message handler
      this.messagingManager.on('message', this.handleIncomingMessage.bind(this));
      this.messagingManager.on('error', (error) => {
        console.error('Messaging error:', error);
        this.emit('error', { source: 'messaging', error });
      });
      
      console.log('Messaging Manager initialized');
    }
    
    // Initialize Job Queue Manager if enabled
    if (this.config.jobQueue?.enabled) {
      this.jobQueueManager = new JobQueueManager(
        {
          concurrency: this.config.jobQueue.concurrency || 5,
          retryAttempts: this.config.jobQueue.retryAttempts || 3,
          retryDelay: this.config.jobQueue.retryDelay || 5000,
          notifyMessaging: !!this.messagingManager
        },
        this.messagingManager
      );
      
      // Set up job event handlers
      this.jobQueueManager.on('job:completed', (result) => {
        this.emit('job:completed', result);
      });
      
      this.jobQueueManager.on('job:failed', (result) => {
        this.emit('job:failed', result);
        this.emit('error', { source: 'job', error: result.error });
      });
      
      console.log('Job Queue Manager initialized');
    }
    
    // Initialize LLM Manager if enabled
    if (this.config.llm?.enabled) {
      if (!this.config.llm.config) {
        throw new Error('LLM configuration is required when LLM is enabled');
      }
      
      this.llmManager = new LLMManager(this.config.llm.config, this.functionManager);
      console.log(`LLM Manager initialized with ${this.config.llm.config.provider}/${this.config.llm.config.model}`);
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
      await this.jobQueueManager.close();
    }
    
    if (this.messagingManager) {
      await this.messagingManager.close();
    }
    
    console.log(`Agent ${this.name} shutdown complete`);
  }
}

export default Agent;