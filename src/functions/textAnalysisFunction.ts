import { FunctionDefinition, FunctionContext, LLMMessage } from '../types';

/**
 * Text analysis function that uses its own LLM model to analyze text
 */
export const functionDefinition: FunctionDefinition = {
  name: 'analyzeText',
  description: 'Analyze text for sentiment, keywords, and themes using AI',
  type: 'local',
  preferredModelId: 'textAnalysisModel', // This function prefers to use a specific model
  customPrompt: 'You are a specialized text analysis AI. Your task is to analyze the provided text and extract sentiment, key topics, themes, and important keywords. Provide a concise but comprehensive analysis.',
  parameters: {
    type: 'object',
    properties: {
      text: {
        type: 'string',
        description: 'The text to analyze'
      },
      options: {
        type: 'object',
        description: 'Analysis options',
        properties: {
          includeSentiment: {
            type: 'boolean',
            description: 'Whether to include sentiment analysis'
          },
          includeKeywords: {
            type: 'boolean',
            description: 'Whether to include keyword extraction'
          },
          includeThemes: {
            type: 'boolean',
            description: 'Whether to include theme identification'
          }
        }
      }
    },
    required: ['text']
  },
  handler: async (params: Record<string, any>, context?: FunctionContext) => {
    const text = params.text as string;
    const options = params.options || {
      includeSentiment: true,
      includeKeywords: true,
      includeThemes: true
    };
    
    try {
      // Check if we have access to the LLM manager in the context
      if (!context?.llm?.manager) {
        throw new Error('LLM manager not available in function context');
      }
      
      const llmManager = context.llm.manager;
      const modelId = context.llm.modelId || 'textAnalysisModel';
      
      // Create a system prompt based on the options
      let systemPrompt = 'You are a text analysis expert. Analyze the following text';
      const analysisTypes = [];
      
      if (options.includeSentiment) {
        analysisTypes.push('sentiment (positive, negative, or neutral)');
      }
      
      if (options.includeKeywords) {
        analysisTypes.push('important keywords');
      }
      
      if (options.includeThemes) {
        analysisTypes.push('main themes and topics');
      }
      
      if (analysisTypes.length > 0) {
        systemPrompt += ` and provide the following: ${analysisTypes.join(', ')}.`;
      }
      
      systemPrompt += ' Format your response as a JSON object with appropriate keys for each analysis type.';
      
      // Set up messages for the LLM
      const messages: LLMMessage[] = [
        {
          role: 'system',
          content: systemPrompt
        },
        {
          role: 'user',
          content: text
        }
      ];
      
      // Use the LLM manager to send the message
      const response = await llmManager.sendMessage(
        messages,
        { responseFormat: 'json_object' },
        modelId
      );
      
      // Try to parse the response as JSON
      try {
        const analysis = JSON.parse(response.content);
        return {
          text: text.substring(0, 100) + (text.length > 100 ? '...' : ''), // Include a preview of the analyzed text
          analysis,
          model: response.model
        };
      } catch (error) {
        // If response isn't valid JSON, return it as plain text
        return {
          text: text.substring(0, 100) + (text.length > 100 ? '...' : ''),
          analysis: response.content,
          model: response.model
        };
      }
    } catch (error) {
      console.error('Error analyzing text:', error);
      throw error;
    }
  }
};

// Register function with the Function Manager
export default function register(functionManager: any) {
  functionManager.registerFunction(functionDefinition);
}