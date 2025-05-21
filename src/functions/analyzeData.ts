import { FunctionDefinition, FunctionContext } from '../types';

/**
 * Data analyzer function example
 */
export const functionDefinition: FunctionDefinition = {
  name: 'analyzeData',
  description: 'Analyze data and return insights',
  type: 'local',
  parameters: {
    type: 'object',
    properties: {
      dataset: {
        type: 'string',
        description: 'The dataset to analyze'
      },
      metrics: {
        type: 'array',
        items: {
          type: 'string'
        },
        description: 'Metrics to calculate'
      }
    },
    required: ['dataset']
  },
  handler: async (params: Record<string, any>, context?: FunctionContext) => {
    const dataset = params.dataset as string;
    const metrics = params.metrics as string[] || ['mean', 'median', 'mode'];
    
    // Simulate data analysis
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    // Return mock results
    return {
      dataset,
      metrics,
      results: {
        mean: 42.5,
        median: 38.0,
        mode: 35.0,
        count: 100,
        min: 10.2,
        max: 95.7,
        stdDev: 15.3
      },
      timestamp: new Date().toISOString()
    };
  }
};

// Register function with the Function Manager
export default function register(functionManager: any) {
  functionManager.registerFunction(functionDefinition);
}