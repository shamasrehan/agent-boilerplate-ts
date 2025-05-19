import { Agent } from './Agent';
import { AgentConfig, JobStatus } from './types';
import * as path from 'path';
import * as dotenv from 'dotenv';
import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { v4 as uuidv4 } from 'uuid';

// Load environment variables
dotenv.config();

// Create an Express app for testing UI
const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer);

// Serve static files
app.use(express.static(path.join(__dirname, '..', 'public')));
app.use(express.json());
app.get('/customize', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'customize.html'));
});

// Default agent configuration
const defaultConfig: AgentConfig = {
  name: process.env.AGENT_NAME || 'ai-agent',
  version: process.env.AGENT_VERSION || '1.0.0',
  functions: {
    enabled: true,
    registry: ['default'] // Load default functions
  },
  messaging: {
    enabled: true,
    config: {
      incomingQueue: process.env.RABBITMQ_INCOMING_QUEUE || 'agent-incoming',
      outgoingQueue: process.env.RABBITMQ_OUTGOING_QUEUE || 'agent-outgoing',
      acknowledgmentQueue: process.env.RABBITMQ_ACKNOWLEDGMENT_QUEUE || 'agent-acknowledgment'
    }
  },
  jobQueue: {
    enabled: true,
    concurrency: parseInt(process.env.JOBS_QUEUE_CONCURRENCY || '5', 10),
    retryAttempts: parseInt(process.env.JOBS_QUEUE_RETRY_ATTEMPTS || '3', 10),
    retryDelay: parseInt(process.env.JOBS_QUEUE_RETRY_DELAY || '5000', 10)
  },
  llm: {
    enabled: true,
    config: {
      provider: (process.env.LLM_PROVIDER as any) || 'openai',
      model: process.env.LLM_MODEL || 'gpt-4',
      apiKeyName: process.env.LLM_API_KEY_NAME || 'openai',
      temperature: parseFloat(process.env.LLM_TEMPERATURE || '0.7'),
      maxTokens: parseInt(process.env.LLM_MAX_TOKENS || '2048', 10),
      systemPrompt: process.env.LLM_SYSTEM_PROMPT || 'You are a helpful AI assistant.'
    },
    // Additional models registry
    models: {
      // Text analysis specialized model
      'textAnalysisModel': {
        provider: (process.env.TEXT_ANALYSIS_PROVIDER as any) || 'openai',
        model: process.env.TEXT_ANALYSIS_MODEL || 'gpt-4',
        apiKeyName: process.env.TEXT_ANALYSIS_API_KEY_NAME || 'openai',
        temperature: 0.3, // Lower temperature for more deterministic responses
        maxTokens: 1024,
        systemPrompt: 'You are a specialized text analysis AI. Your task is to analyze the provided text and extract sentiment, key topics, themes, and important keywords. Provide a concise but comprehensive analysis.'
      },
      // Master model configuration
      'masterModel': {
        provider: (process.env.MASTER_MODEL_PROVIDER as any) || 'openai',
        model: process.env.MASTER_MODEL || 'gpt-4',
        apiKeyName: process.env.MASTER_MODEL_API_KEY_NAME || 'openai',
        temperature: 0.2, // Lower temperature for more deterministic routing
        maxTokens: 2048,
        systemPrompt: `You are the Master Model that controls this AI agent system.
You can analyze incoming messages and decide what actions to take.
You have the ability to execute functions, schedule jobs, or send response messages.

When analyzing messages, respond with a JSON object specifying the action to take:
1. Execute functions: {"action": "executeFunction", "functionName": "name", "params": {}}
2. Schedule jobs: {"action": "scheduleJob", "jobName": "name", "data": {}, "options": {}}
3. Send response: {"action": "sendResponse", "content": "your message", "type": "responseType"}
4. Do nothing: {"action": "none", "reason": "reason for inaction"}

Be decisive and efficient in your decision making.`
      }
    }
  }
};

// Create and initialize the agent
const agent = new Agent(defaultConfig);

// Set up WebSocket for testing UI
io.on('connection', (socket) => {
  console.log('Client connected');
  
  socket.on('message', async (data) => {
    try {
      let response;
      
      // Parse input as JSON if possible
      let payload;
      try {
        payload = typeof data === 'string' ? JSON.parse(data) : data;
      } catch (e) {
        // If not valid JSON, treat as plain text for LLM
        payload = { text: data };
      }
      
      if (payload.type === 'function') {
        // Execute function
        if (payload.modelId) {
          // Use function with a specific model
          response = await agent.executeFunctionWithModel(
            payload.name,
            payload.params || {},
            payload.modelId,
            payload.context || {}
          );
        } else {
          // Use standard function execution
          response = await agent.executeFunction(
            payload.name,
            payload.params || {},
            payload.context || {}
          );
        }
      } else if (payload.type === 'job') {
        // Schedule a job
        response = await agent.scheduleJob(
          payload.name,
          payload.data || {},
          payload.options || {}
        );
      } else if (payload.type === 'job:function') {
        // Schedule a function job
        response = await agent.scheduleFunctionJob(
          payload.functionName,
          payload.functionParams || {},
          payload.options || {},
          payload.functionContext || {}
        );
      } else if (payload.type === 'message') {
        // Send a message via RabbitMQ
        response = await agent.sendMessage(
          payload.messageType || 'custom',
          payload.payload || {},
          payload.metadata || {}
        );
      } else if (payload.type === 'llm:analyze') {
        // Use Master Model to analyze a message
        const llmManager = agent.getLLMManager();
        if (!llmManager) {
          throw new Error('LLM Manager is not initialized');
        }
        
        // Create a mock incoming message for analysis
        const mockMessage = {
          id: uuidv4(),
          type: payload.messageType || 'user:input',
          timestamp: Date.now(),
          payload: payload.content || payload.text || payload.payload || {},
          metadata: payload.metadata || {}
        };
        
        response = await llmManager.processMasterModelMessage(mockMessage);
      } else if (payload.type === 'llm:model') {
        // Use a specific model for completion
        if (!agent.getLLMManager()) {
          throw new Error('LLM Manager is not initialized');
        }
        
        response = await agent.generateResponseWithModel(
          typeof data === 'string' ? data : (payload.prompt || payload.text || JSON.stringify(payload, null, 2)),
          payload.modelId,
          payload.options || {}
        );
      } else {
        // Default to LLM generation if enabled
        if (agent.getLLMManager()) {
          response = await agent.generateResponse(
            typeof data === 'string' ? data : JSON.stringify(payload, null, 2),
            payload.options || {}
          );
        } else {
          response = { error: 'LLM not enabled and message type not recognized' };
        }
      }
      
      socket.emit('response', response);
    } catch (error) {
      console.error('Error processing socket message:', error);
      socket.emit('error', {
        message: error instanceof Error ? error.message : String(error)
      });
    }
  });
  
  socket.on('disconnect', () => {
    console.log('Client disconnected');
  });
});

// Function to extract function handler source code
function extractHandlerSource(func: { handler?: Function }): string {
  if (!func || !func.handler) return '';
  
  try {
    return func.handler.toString();
  } catch (error) {
    console.error('Error extracting handler source:', error);
    return '';
  }
}

// Set up socket events for customization interface
io.on('connection', (socket) => {
  // Existing code from previous implementation...
  
  // Function management
  socket.on('functions:list', async () => {
    try {
      const functionManager = agent.getFunctionManager();
      if (!functionManager) {
        throw new Error('Function Manager is not initialized');
      }
      
      const functions = functionManager.getAllFunctions();
      socket.emit('functions:list', functions);
    } catch (error: unknown) {
      console.error('Error listing functions:', error);
      socket.emit('response:error', { message: error instanceof Error ? error.message : String(error) });
    }
  });
  
  socket.on('function:get', async (data) => {
    try {
      const functionManager = agent.getFunctionManager();
      if (!functionManager) {
        throw new Error('Function Manager is not initialized');
      }
      
      const func = functionManager.getFunction(data.name);
      if (!func) {
        throw new Error(`Function '${data.name}' not found`);
      }
      
      const functionWithSource = {
        ...func,
        handlerSource: extractHandlerSource(func)
      };
      
      socket.emit('function:get', functionWithSource);
    } catch (error: unknown) {
      console.error('Error getting function:', error);
      socket.emit('response:error', { message: error instanceof Error ? error.message : String(error) });
    }
  });
  
  socket.on('function:save', async (data) => {
    try {
      const functionManager = agent.getFunctionManager();
      if (!functionManager) {
        throw new Error('Function Manager is not initialized');
      }
      
      let handler;
      try {
        handler = new Function(`return ${data.handlerSource}`)();
      } catch (error: unknown) {
        throw new Error(`Error parsing function handler: ${error instanceof Error ? error.message : String(error)}`);
      }
      
      const functionDef = {
        name: data.name,
        description: data.description,
        type: data.type,
        preferredModelId: data.preferredModelId,
        apiKeyName: data.apiKeyName,
        parameters: data.parameters,
        customPrompt: data.customPrompt,
        handler: handler
      };
      
      functionManager.unregisterFunction(data.name);
      functionManager.registerFunction(functionDef);
      
      socket.emit('response:success', { 
        message: `Function '${data.name}' saved successfully` 
      });
      
      const functions = functionManager.getAllFunctions();
      socket.emit('functions:list', functions);
    } catch (error: unknown) {
      console.error('Error saving function:', error);
      socket.emit('response:error', { message: error instanceof Error ? error.message : String(error) });
    }
  });
  
  socket.on('function:delete', async (data) => {
    try {
      const functionManager = agent.getFunctionManager();
      if (!functionManager) {
        throw new Error('Function Manager is not initialized');
      }
      
      const success = functionManager.unregisterFunction(data.name);
      
      if (success) {
        socket.emit('response:success', { 
          message: `Function '${data.name}' deleted successfully` 
        });
        
        const functions = functionManager.getAllFunctions();
        socket.emit('functions:list', functions);
      } else {
        throw new Error(`Function '${data.name}' not found`);
      }
    } catch (error: unknown) {
      console.error('Error deleting function:', error);
      socket.emit('response:error', { message: error instanceof Error ? error.message : String(error) });
    }
  });
  
  // Model management
  socket.on('models:list', async () => {
    try {
      const llmManager = agent.getLLMManager();
      if (!llmManager) {
        throw new Error('LLM Manager is not initialized');
      }
      
      const defaultModel = {
        default: llmManager.getConfig()
      };
      
      const masterModel = llmManager.getMasterModelConfig();
      if (masterModel) {
        (defaultModel as any).masterModel = masterModel;
      }
      
      const modelRegistry = llmManager.getModelRegistry?.() || {};
      
      const models = {
        ...defaultModel,
        ...modelRegistry
      };
      
      socket.emit('models:list', models);
    } catch (error: unknown) {
      console.error('Error listing models:', error);
      socket.emit('response:error', { message: error instanceof Error ? error.message : String(error) });
    }
  });
  
  socket.on('model:get', async (data) => {
    try {
      const llmManager = agent.getLLMManager();
      if (!llmManager) {
        throw new Error('LLM Manager is not initialized');
      }
      
      let config;
      
      if (data.id === 'default') {
        config = llmManager.getConfig();
      } else if (data.id === 'masterModel') {
        config = llmManager.getMasterModelConfig();
      } else {
        config = llmManager.getModelConfig(data.id);
      }
      
      if (!config) {
        throw new Error(`Model '${data.id}' not found`);
      }
      
      socket.emit('model:get', {
        id: data.id,
        config
      });
    } catch (error: unknown) {
      console.error('Error getting model:', error);
      socket.emit('response:error', { message: error instanceof Error ? error.message : String(error) });
    }
  });
  
  socket.on('model:save', async (data) => {
    try {
      const llmManager = agent.getLLMManager();
      if (!llmManager) {
        throw new Error('LLM Manager is not initialized');
      }
      
      if (data.modelId === 'masterModel') {
        throw new Error('Cannot directly modify Master Model. Use Agent Settings instead.');
      }
      
      if (data.modelId === 'default') {
        llmManager.updateConfig(data.config);
      } else {
        agent.registerLLMModel(data.modelId, data.config);
      }
      
      socket.emit('response:success', { 
        message: `Model '${data.modelId}' saved successfully` 
      });
      
      socket.emit('models:list', await getModels());
    } catch (error: unknown) {
      console.error('Error saving model:', error);
      socket.emit('response:error', { message: error instanceof Error ? error.message : String(error) });
    }
  });
  
  socket.on('model:delete', async (data) => {
    try {
      const llmManager = agent.getLLMManager();
      if (!llmManager) {
        throw new Error('LLM Manager is not initialized');
      }
      
      if (data.id === 'default' || data.id === 'masterModel') {
        throw new Error(`Cannot delete ${data.id} model`);
      }
      
      if (llmManager.unregisterModel) {
        const success = llmManager.unregisterModel(data.id);
        
        if (success) {
          socket.emit('response:success', { 
            message: `Model '${data.id}' deleted successfully` 
          });
          
          socket.emit('models:list', await getModels());
        } else {
          throw new Error(`Model '${data.id}' not found`);
        }
      } else {
        throw new Error('Unregister model method not available');
      }
    } catch (error: unknown) {
      console.error('Error deleting model:', error);
      socket.emit('response:error', { message: error instanceof Error ? error.message : String(error) });
    }
  });
  
  // Agent settings
  socket.on('agent:settings', async () => {
    try {
      const settings = {
        name: agent.getName(),
        version: agent.getVersion(),
        masterModelPrompt: agent.getLLMManager()?.getMasterModelConfig()?.systemPrompt || ''
      };
      
      socket.emit('agent:settings', settings);
    } catch (error: unknown) {
      console.error('Error getting agent settings:', error);
      socket.emit('response:error', { message: error instanceof Error ? error.message : String(error) });
    }
  });
  
  socket.on('agent:settings:save', async (data) => {
    try {
      if (data.name) {
        agent.setName(data.name);
      }
      
      if (data.version) {
        agent.setVersion(data.version);
      }
      
      if (data.masterModelPrompt && agent.getLLMManager()) {
        agent.updateMasterModel({
          systemPrompt: data.masterModelPrompt
        });
      }
      
      socket.emit('response:success', { 
        message: 'Agent settings saved successfully' 
      });
      
      socket.emit('agent:settings', {
        name: agent.getName(),
        version: agent.getVersion(),
        masterModelPrompt: agent.getLLMManager()?.getMasterModelConfig()?.systemPrompt || ''
      });
    } catch (error: unknown) {
      console.error('Error saving agent settings:', error);
      socket.emit('response:error', { message: error instanceof Error ? error.message : String(error) });
    }
  });
  
  socket.on('agent:stats', async () => {
    try {
      const stats = {
        functionCount: agent.getFunctionManager()?.listFunctions().length || 0,
        modelCount: 0,
        activeJobs: 0,
        components: {
          'Function Manager': !!agent.getFunctionManager(),
          'Messaging Manager': !!agent.getMessagingManager(),
          'Job Queue Manager': !!agent.getJobQueueManager(),
          'LLM Manager': !!agent.getLLMManager()
        }
      };
      
      const llmManager = agent.getLLMManager();
      if (llmManager?.getModelRegistry) {
        const modelRegistry = llmManager.getModelRegistry();
        stats.modelCount = Object.keys(modelRegistry).length + 2;
      }
      
      const jobQueueManager = agent.getJobQueueManager();
      if (jobQueueManager?.getJobsByStatus) {
        try {
          const activeJobs = await jobQueueManager.getJobsByStatus('active' as JobStatus);
          stats.activeJobs = activeJobs.length;
        } catch (error) {
          console.error('Error getting active jobs:', error);
        }
      }
      
      socket.emit('agent:stats', stats);
    } catch (error: unknown) {
      console.error('Error getting agent stats:', error);
      socket.emit('response:error', { message: error instanceof Error ? error.message : String(error) });
    }
  });
});

// Helper function to get models
async function getModels() {
  const llmManager = agent.getLLMManager();
  if (!llmManager) {
    return {};
  }
  
  const defaultModel = {
    default: llmManager.getConfig()
  };
  
  const masterModel = llmManager.getMasterModelConfig();
  if (masterModel) {
    (defaultModel as any).masterModel = masterModel;
  }
  
  const modelRegistry = llmManager.getModelRegistry?.() || {};
  
  return {
    ...defaultModel,
    ...modelRegistry
  };
}

// Start the agent and server
async function start() {
  try {
    await agent.initialize();
    
    // Set up event listeners
    agent.on('error', (error) => {
      console.error('Agent error:', error);
    });
    
    agent.on('message:received', (message) => {
      io.emit('agent:message', { type: 'received', message });
    });
    
    agent.on('message:processed', (data) => {
      io.emit('agent:message', { type: 'processed', data });
    });
    
    agent.on('job:completed', (result) => {
      io.emit('agent:job', { type: 'completed', result });
    });
    
    agent.on('job:failed', (result) => {
      io.emit('agent:job', { type: 'failed', result });
    });
    
    // Start the HTTP server
    const port = process.env.PORT || 3000;
    httpServer.listen(port, () => {
      console.log(`Agent server running at http://localhost:${port}`);
    });
  } catch (error) {
    console.error('Failed to start agent:', error);
    process.exit(1);
  }
}

// Handle shutdown gracefully
process.on('SIGINT', async () => {
  console.log('Shutting down...');
  await agent.shutdown();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('Shutting down...');
  await agent.shutdown();
  process.exit(0);
});

// Start the agent
start();

export { agent, Agent };