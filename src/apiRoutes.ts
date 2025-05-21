import { Router, Request, Response } from 'express';
import { Agent } from './Agent';

/**
 * API router for HTTP endpoints
 */
export function createApiRouter(agent: Agent): Router {
  const router = Router();
  
  // API status endpoint
  router.get('/status', (req: Request, res: Response) => {
    // Return basic agent status
    res.json({
      status: 'online',
      agent: {
        name: agent['name'],
        version: agent['version'],
        isInitialized: agent['isInitialized']
      },
      components: {
        functions: Boolean(agent.getFunctionManager()),
        messaging: Boolean(agent.getMessagingManager()),
        jobQueue: Boolean(agent.getJobQueueManager()),
        llm: Boolean(agent.getLLMManager())
      },
      timestamp: new Date().toISOString()
    });
  });
  
  // Send a message to the agent
  router.post('/message', async (req: Request, res: Response) => {
    try {
      const messageManager = agent.getMessagingManager();
      
      if (!messageManager) {
        return res.status(500).json({
          error: 'Messaging Manager is not initialized'
        });
      }
      
      const { type, payload, metadata } = req.body;
      
      const messageId = await agent.sendMessage(
        type || 'api:message',
        payload,
        metadata
      );
      
      res.json({
        success: true,
        messageId
      });
    } catch (error) {
      console.error('API error:', error);
      res.status(500).json({
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });
  
  // Execute a function directly
  router.post('/function', async (req: Request, res: Response) => {
    try {
      const { name, params, context } = req.body;
      
      if (!name) {
        return res.status(400).json({
          error: 'Function name is required'
        });
      }
      
      const result = await agent.executeFunction(
        name,
        params || {},
        context || {}
      );
      
      res.json(result);
    } catch (error) {
      console.error('API error:', error);
      res.status(500).json({
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });
  
  // Schedule a job
  router.post('/job', async (req: Request, res: Response) => {
    try {
      const { name, data, options } = req.body;
      
      if (!name) {
        return res.status(400).json({
          error: 'Job name is required'
        });
      }
      
      const jobId = await agent.scheduleJob(
        name,
        data || {},
        options || {}
      );
      
      res.json({
        success: true,
        jobId
      });
    } catch (error) {
      console.error('API error:', error);
      res.status(500).json({
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });
  
  // Get job status
  router.get('/job/:id', async (req: Request, res: Response) => {
    try {
      const jobId = req.params.id;
      const status = await agent.getJobStatus(jobId);
      
      if (status === null) {
        return res.status(404).json({
          error: `Job ${jobId} not found`
        });
      }
      
      res.json({ jobId, status });
    } catch (error) {
      console.error('API error:', error);
      res.status(500).json({
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });
  
  // Generate LLM response
  router.post('/generate', async (req: Request, res: Response) => {
    try {
      const { prompt, options } = req.body;
      
      if (!prompt) {
        return res.status(400).json({
          error: 'Prompt is required'
        });
      }
      
      const response = await agent.generateResponse(
        prompt,
        options || {}
      );
      
      res.json({ response });
    } catch (error) {
      console.error('API error:', error);
      res.status(500).json({
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });
  
  return router;
}