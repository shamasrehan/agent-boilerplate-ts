import { Agent } from './Agent';
import { createApiRouter } from './apiRoutes';
import { AgentConfig, LLMMessage } from './types';
import * as path from 'path';
import * as dotenv from 'dotenv';
import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';

// Load environment variables
dotenv.config();

// Create an Express app for testing UI
const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer);

// Middleware
app.use(express.static(path.join(__dirname, '..', 'public')));
app.use(express.json());

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
    }
  }
};

// Create and initialize the agent
const agent = new Agent(defaultConfig);

// Set up API routes
app.use('/api', createApiRouter(agent));

// Set up routes
app.get('/dashboard', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'dashboard.html'));
});

app.get('/server', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'server.html'));
});

// Default route
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

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
        response = await agent.executeFunction(
          payload.name,
          payload.params || {},
          payload.context || {}
        );
      } else if (payload.type === 'job') {
        // Schedule a job
        response = await agent.scheduleJob(
          payload.name,
          payload.data || {},
          payload.options || {}
        );
      } else if (payload.type === 'message') {
        // Send a message via RabbitMQ
        response = await agent.sendMessage(
          payload.messageType || 'custom',
          payload.payload || {},
          payload.metadata || {}
        );
      } else if (payload.intent) {
        // Standard agent message format with intent/action/entity
        // Process with LLM to determine what to do
        const llmManager = agent.getLLMManager();
        
        if (!llmManager) {
          throw new Error('LLM Manager not initialized');
        }
        
        // Format message for LLM to interpret
        const messages: LLMMessage[] = [
          {
            role: 'system',
            content: `You are an AI Agent that can execute functions and schedule jobs. 
                     When you receive a message with intent/action/entity, analyze it to determine:
                     1. If a function should be called directly, which one and with what parameters
                     2. If a job should be scheduled, which one and with what data
                     3. If a general response should be generated
                     
                     Available functions: ${agent.getFunctionManager()?.listFunctions().join(', ') || 'None'}`
          },
          {
            role: 'user',
            content: JSON.stringify(payload)
          }
        ];
        
        // Get LLM interpretation
        const llmResponse = await llmManager.sendMessage(messages);
        
        // Attempt to extract function/job calls from response
        try {
          const content = JSON.parse(llmResponse.content);
          
          if (content.action === 'call_function' && content.function) {
            // Execute the function
            response = await agent.executeFunction(
              content.function,
              content.parameters || {},
              content.context || {}
            );
          } else if (content.action === 'schedule_job' && content.job) {
            // Schedule the job
            response = await agent.scheduleJob(
              content.job,
              content.data || {},
              content.options || {}
            );
          } else {
            // Use the LLM response directly
            response = {
              intent: "INFORM",
              action: "READ",
              entity: {
                type: "AGENT",
                context: {
                  description: "Response from AI Agent",
                  data: content
                }
              }
            };
          }
        } catch (e) {
          // If can't parse LLM response as JSON, wrap the text response
          response = {
            intent: "INFORM",
            action: "READ",
            entity: {
              type: "AGENT",
              context: {
                description: "Response from AI Agent",
                data: llmResponse.content
              }
            }
          };
        }
      } else {
        // Default to LLM generation if enabled
        if (agent.getLLMManager()) {
          response = await agent.generateResponse(
            typeof data === 'string' ? data : JSON.stringify(payload, null, 2),
            payload.options || {}
          );
          
          // Format the response
          response = {
            intent: "INFORM",
            action: "READ",
            entity: {
              type: "AGENT",
              context: {
                description: "Response from AI Agent",
                data: response
              }
            }
          };
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