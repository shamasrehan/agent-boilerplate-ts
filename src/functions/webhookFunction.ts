import { FunctionDefinition, FunctionContext, IncomingMessage } from '../types';
import axios from 'axios';

/**
 * Webhook handler function that uses the Master Model to analyze incoming webhooks
 */
export const functionDefinition: FunctionDefinition = {
  name: 'processWebhook',
  description: 'Process an incoming webhook by analyzing its content and taking appropriate actions',
  type: 'local',
  parameters: {
    type: 'object',
    properties: {
      source: {
        type: 'string',
        description: 'The source of the webhook'
      },
      event: {
        type: 'string',
        description: 'The event type of the webhook'
      },
      payload: {
        type: 'object',
        description: 'The webhook payload data'
      },
      headers: {
        type: 'object',
        description: 'The webhook request headers'
      }
    },
    required: ['source', 'event', 'payload']
  },
  handler: async (params: Record<string, any>, context?: FunctionContext) => {
    const source = params.source as string;
    const event = params.event as string;
    const payload = params.payload as Record<string, any>;
    const headers = params.headers as Record<string, any> || {};
    
    try {
      // Check if we have access to the LLM manager in the context
      if (!context?.llm?.manager) {
        throw new Error('LLM manager not available in function context');
      }
      
      const llmManager = context.llm.manager;
      
      // Create a mock message for the Master Model to analyze
      const mockMessage: IncomingMessage = {
        id: context.messageId || `webhook-${Date.now()}`,
        type: `webhook:${source}:${event}`,
        timestamp: Date.now(),
        payload: {
          source,
          event,
          data: payload,
          headers
        }
      };
      
      console.log(`Processing webhook from ${source} with event ${event}`);
      
      // Use the Master Model to analyze the webhook and decide what to do
      const result = await llmManager.processMasterModelMessage(mockMessage);
      
      // Log the Master Model's decision
      console.log(`Master Model decided to: ${result.action || 'unknown action'}`);
      
      // Perform additional actions based on the webhook source/event if needed
      if (source === 'github' && event === 'push') {
        // Example: Process GitHub push events specially
        const repo = payload.repository?.name;
        const branch = payload.ref?.replace('refs/heads/', '');
        console.log(`GitHub push to ${repo}/${branch}`);
        
        // Maybe trigger a CI/CD pipeline
        // await triggerPipeline(repo, branch);
      }
      
      return {
        processed: true,
        source,
        event,
        masterModelDecision: result,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      console.error(`Error processing webhook from ${source}:`, error);
      throw error;
    }
  }
};

// Helper function to validate webhook signatures (example)
async function validateWebhookSignature(signature: string, secret: string, body: string): Promise<boolean> {
  // Implementation would depend on the signature algorithm used by the webhook source
  // This is just a placeholder
  return true;
}

// Register function with the Function Manager
export default function register(functionManager: any) {
  functionManager.registerFunction(functionDefinition);
}