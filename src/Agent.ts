import { AgentConfig, IncomingMessage, Message, LLMConfig, LLMMessage, LLMResponse } from './types';
import FunctionManager from './core/FunctionManager';
import MessagingManager from './core/MessagingManager';
import JobQueueManager from './core/JobQueueManager';
import LLMManager from './core/LLMManager';
import { EventEmitter } from 'events';
import * as path from 'path';
import * as dotenv from 'dotenv';
import { v4 as uuidv4 } from 'uuid';

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
   * Get the agent's name
   */
  public getName(): string {
    return this.name;
  }

  /**
   * Get the agent's version
   */
  public getVersion(): string {
    return this.version;
  }

  /**
   * Set the agent's name
   * @param name New name
   */
  public setName(name: string): void {
    this.name = name;
    this.config.name = name;
  }

  /**
   * Set the agent's version
   * @param version New version
   */
  public setVersion(version: string): void {
    this.version = version;
    this.config.version = version;
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
        this.messagingManager,
        this.functionManager  // Pass FunctionManager to JobQueueManager
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
    
    // Initialize LLM Manager using our new method
    await this.initializeLLM();
    
    this.isInitialized = true;
    this.emit('initialized');
    console.log(`Agent ${this.name} v${this.version} initialized successfully`);
  }

  /**
   * Initialize the LLM Manager with all necessary components
   */
  private async initializeLLM(): Promise<void> {
    if (this.config.llm?.enabled) {
      if (!this.config.llm.config) {
        throw new Error('LLM configuration is required when LLM is enabled');
      }
      
      // Initialize LLM Manager with all necessary managers
      this.llmManager = new LLMManager(
        this.config.llm.config,
        this.functionManager,
        this.jobQueueManager,
        this.messagingManager
      );
      
      // Register additional models if specified in the config
      if (this.config.llm.models) {
        for (const [modelId, modelConfig] of Object.entries(this.config.llm.models)) {
          this.llmManager.registerModel(modelId, modelConfig);
        }
      }
      
      // Register the master model with a special system prompt if not already set
      if (!this.llmManager.getMasterModelConfig()) {
        const masterModelConfig: LLMConfig = {
          ...this.config.llm.config,
          systemPrompt: `You are the Master Model that controls this AI agent system.
You can analyze incoming messages and decide what actions to take.
Available functions: ${this.functionManager ? this.functionManager.listFunctions().join(", ") : "None"}
You can execute functions, schedule jobs, or send response messages as needed.`
        };
        this.llmManager.registerModel('masterModel', masterModelConfig);
        this.llmManager.updateMasterModel(masterModelConfig);
      }
      
      console.log(`LLM Manager initialized with ${this.config.llm.config.provider}/${this.config.llm.config.model}`);
    }
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
      let usedMasterModel = false;
      
      // Check if we should use the Master Model to process this message
      if (this.llmManager && 
          !message.type.startsWith('function:') && 
          !message.type.startsWith('job:') && 
          !message.type.startsWith('llm:')) {
        try {
          // Let the Master Model decide how to handle the message
          response = await this.llmManager.processMasterModelMessage(message);
          usedMasterModel = true;
          
          this.emit('message:processed:mastermodel', { 
            messageId: message.id, 
            response 
          });
        } catch (masterModelError) {
          console.warn(`Master Model failed to process message ${message.id}:`, masterModelError);
          // Fall back to standard processing if Master Model fails
          usedMasterModel = false;
        }
      }
      
      // Process based on message type if Master Model wasn't used or failed
      if (!usedMasterModel) {
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
          
          case 'function:execute:withmodel':
            // Execute function with specific LLM model
            if (!this.functionManager || !this.llmManager) {
              throw new Error('Function Manager or LLM Manager is not initialized');
            }
            
            response = await this.llmManager.executeFunctionWithModel(
              message.payload.name,
              message.payload.params,
              message.payload.context,
              message.payload.modelId
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
              message.payload.options,
              message.payload.modelId
            );
            break;
          
          case 'llm:completion':
            // Generate a simple completion
            if (!this.llmManager) {
              throw new Error('LLM Manager is not initialized');
            }
            
            response = await this.llmManager.generateCompletion(
              message.payload.prompt,
              message.payload.options,
              message.payload.modelId
            );
            break;
          
          case 'llm:chat':
            // Have a chat conversation
            if (!this.llmManager) {
              throw new Error('LLM Manager is not initialized');
            }
            
            response = await this.llmManager.chat(
              message.payload.message,
              message.payload.history,
              message.payload.options,
              message.payload.modelId
            );
            break;
          
          default:
            // Handle custom message types
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
   * Register a new LLM model in the agent
   * @param modelId Unique identifier for the model
   * @param config Model configuration
   */
  public registerLLMModel(modelId: string, config: LLMConfig): void {
    if (!this.llmManager) {
      throw new Error('LLM Manager is not initialized');
    }
    
    this.llmManager.registerModel(modelId, config);
    console.log(`Registered model ${modelId} with provider ${config.provider}/${config.model}`);
  }

  /**
   * Update the Master Model configuration
   * @param config New configuration options for the Master Model
   */
  public updateMasterModel(config: Partial<LLMConfig>): void {
    if (!this.llmManager) {
      throw new Error('LLM Manager is not initialized');
    }
    
    this.llmManager.updateMasterModel(config);
    console.log('Master Model configuration updated');
  }

  /**
   * Execute a function using a specific LLM model
   * @param name Function name
   * @param params Function parameters
   * @param modelId ID of the model to use (optional)
   * @param context Function execution context (optional)
   */
  public async executeFunctionWithModel(
    name: string,
    params: Record<string, any>,
    modelId?: string,
    context?: Record<string, any>
  ): Promise<any> {
    if (!this.llmManager) {
      throw new Error('LLM Manager is not initialized');
    }
    
    return await this.llmManager.executeFunctionWithModel(
      name,
      params,
      context,
      modelId
    );
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
 * Schedule a job to execute a function from FunctionManager
 * @param functionName Name of the function to execute
 * @param functionParams Parameters to pass to the function
 * @param options Optional job options
 * @param functionContext Optional context for function execution
 */
public async scheduleFunctionJob(
  functionName: string,
  functionParams: Record<string, any>,
  options?: {
    priority?: number;
    delay?: number;
    attempts?: number;
  },
  functionContext?: Record<string, any>
): Promise<string> {
  if (!this.jobQueueManager) {
    throw new Error('Job Queue Manager is not initialized');
  }
  
  if (!this.functionManager) {
    throw new Error('Function Manager is not initialized');
  }
  
  // Verify the function exists
  const functionDef = this.functionManager.getFunction(functionName);
  if (!functionDef) {
    throw new Error(`Function '${functionName}' not found`);
  }
  
  // Schedule the job with special function execution data
  return await this.jobQueueManager.addJob({
    name: `execute-function-${functionName}`,
    data: {
      useFunctionManager: true,
      functionName: functionName,
      functionParams: functionParams,
      functionContext: functionContext || {}
    },
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
   * Generate an AI response using a specific model
   * @param prompt The prompt to send to the LLM
   * @param modelId ID of the model to use (optional)
   * @param options Optional LLM configuration options
   */
  public async generateResponseWithModel(
    prompt: string,
    modelId?: string,
    options?: Record<string, any>
  ): Promise<string> {
    if (!this.llmManager) {
      throw new Error('LLM Manager is not initialized');
    }
    
    return await this.llmManager.generateCompletion(prompt, options, modelId);
  }

  /**
   * Have a chat conversation with a specific model
   * @param message User message
   * @param history Previous conversation history
   * @param modelId ID of the model to use (optional)
   * @param options Optional configuration options
   */
  public async chatWithModel(
    message: string,
    history: LLMMessage[] = [],
    modelId?: string,
    options?: Partial<LLMConfig>
  ): Promise<{ response: LLMResponse; updatedHistory: LLMMessage[] }> {
    if (!this.llmManager) {
      throw new Error('LLM Manager is not initialized');
    }
    
    return await this.llmManager.chat(message, history, options, modelId);
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