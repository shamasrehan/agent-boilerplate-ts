import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import * as path from 'path';
import * as dotenv from 'dotenv';
import AgentManager from './managers/AgentManager';
import { loadConfig } from './utils/configLoader';

// Load environment variables
dotenv.config();

// Create an Express app for testing UI
const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer);

// Serve static files
app.use(express.static(path.join(__dirname, '..', 'public')));
app.use(express.json());

// Create and initialize the agent manager
const agentManager = new AgentManager(loadConfig());

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
        try {
          response = await agentManager.executeFunction(
            payload.name,
            payload.params || {},
            payload.context || {}
          );
        } catch (error) {
          response = { error: `Function execution failed: ${error instanceof Error ? error.message : String(error)}` };
        }
      } else if (payload.type === 'job') {
        // Schedule a job
        try {
          response = await agentManager.scheduleJob(
            payload.name,
            payload.data || {},
            payload.options || {}
          );
        } catch (error) {
          response = { error: `Job scheduling failed: ${error instanceof Error ? error.message : String(error)}` };
        }
      } else if (payload.type === 'message') {
        // Send a message via RabbitMQ
        try {
          response = await agentManager.sendMessage(
            payload.messageType || 'custom',
            payload.payload || {},
            payload.metadata || {}
          );
        } catch (error) {
          response = { error: `Message sending failed: ${error instanceof Error ? error.message : String(error)}` };
        }
      } else {
        // Default to LLM generation
        try {
          response = await agentManager.generateResponse(
            typeof data === 'string' ? data : JSON.stringify(payload, null, 2),
            payload.options || {}
          );
        } catch (error) {
          response = { error: `LLM generation failed: ${error instanceof Error ? error.message : String(error)}` };
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
    await agentManager.initialize();
    
    // Set up event listeners
    agentManager.on('error', (error) => {
      console.error('Agent error:', error);
    });
    
    agentManager.on('message:received', (message) => {
      io.emit('agent:message', { type: 'received', message });
    });
    
    agentManager.on('message:processed', (data) => {
      io.emit('agent:message', { type: 'processed', data });
    });
    
    agentManager.on('job:completed', (result) => {
      io.emit('agent:job', { type: 'completed', result });
    });
    
    agentManager.on('job:failed', (result) => {
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
  await agentManager.shutdown();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('Shutting down...');
  await agentManager.shutdown();
  process.exit(0);
});

// Start the agent
start();

export { agentManager, AgentManager };