import { FunctionDefinition, FunctionContext } from '../types';
import axios from 'axios';

/**
 * Sentiment analysis function to analyze text sentiment
 */
export const functionDefinition: FunctionDefinition = {
  name: 'analyzeSentiment',
  description: 'Analyze the sentiment of a text input',
  type: 'cloud',
  apiKeyName: 'sentiment',
  parameters: {
    type: 'object',
    properties: {
      text: {
        type: 'string',
        description: 'The text to analyze for sentiment'
      },
      language: {
        type: 'string',
        enum: ['en', 'fr', 'es', 'de', 'it'],
        description: 'Language of the text (default: en)',
        default: 'en'
      }
    },
    required: ['text']
  },
  handler: async (params: Record<string, any>, context?: FunctionContext) => {
    const text = params.text as string;
    const language = params.language as string || 'en';
    
    try {
      const apiKey = context?.apiKey;
      
      if (!apiKey) {
        // If no API key, use a simple fallback algorithm
        return performLocalSentimentAnalysis(text);
      }
      
      // In a real implementation, this would call an external API
      const url = `https://api.sentimentanalysis.example/v1/analyze`;
      
      const response = await axios.post(url, {
        text,
        language,
        apiKey
      });
      
      return {
        sentiment: response.data.sentiment,
        score: response.data.score,
        confidence: response.data.confidence,
        entities: response.data.entities,
        language: response.data.language
      };
    } catch (error) {
      console.error('Error in sentiment analysis:', error);
      
      // Fallback to local analysis if API call fails
      return performLocalSentimentAnalysis(text);
    }
  }
};

/**
 * Simple local sentiment analysis as a fallback when no API key is available
 * This is a very basic implementation for demonstration purposes only
 */
function performLocalSentimentAnalysis(text: string) {
  const text_lower = text.toLowerCase();
  
  // Very simple positive and negative word lists
  const positiveWords = [
    'good', 'great', 'excellent', 'fantastic', 'wonderful', 'amazing', 'love', 
    'happy', 'best', 'perfect', 'awesome', 'enjoy', 'enjoyed', 'like', 'likes',
    'positive', 'nice', 'beautiful', 'beneficial', 'better', 'fabulous', 'fantastic',
    'fun', 'glad', 'impressive', 'ideal', 'joy', 'magnificent', 'pleased', 'remarkable',
    'satisfied', 'superb', 'terrific'
  ];
  
  const negativeWords = [
    'bad', 'terrible', 'awful', 'horrible', 'hate', 'dislike', 'sad', 'worst',
    'poor', 'disappointing', 'negative', 'ugly', 'unpleasant', 'annoying',
    'angry', 'broken', 'confusing', 'corrupt', 'damage', 'defect', 'deficient',
    'disastrous', 'failure', 'faulty', 'feeble', 'garbage', 'gross', 'harmful',
    'harsh', 'inferior', 'lousy', 'messy', 'nonfunctional', 'poorly', 'rubbish',
    'severe', 'suspicious', 'unhappy', 'worthless'
  ];
  
  // Count positive and negative words
  let positiveCount = 0;
  let negativeCount = 0;
  
  for (const word of positiveWords) {
    const regex = new RegExp(`\\b${word}\\b`, 'gi');
    const matches = text_lower.match(regex);
    if (matches) {
      positiveCount += matches.length;
    }
  }
  
  for (const word of negativeWords) {
    const regex = new RegExp(`\\b${word}\\b`, 'gi');
    const matches = text_lower.match(regex);
    if (matches) {
      negativeCount += matches.length;
    }
  }
  
  // Calculate sentiment score
  let score = 0;
  if (positiveCount + negativeCount > 0) {
    score = (positiveCount - negativeCount) / (positiveCount + negativeCount);
  }
  
  // Determine sentiment label
  let sentiment;
  if (score > 0.25) {
    sentiment = 'positive';
  } else if (score < -0.25) {
    sentiment = 'negative';
  } else {
    sentiment = 'neutral';
  }
  
  // Add a mock confidence level
  const confidence = 0.5 + Math.abs(score) * 0.4;
  
  return {
    sentiment,
    score: parseFloat(score.toFixed(2)),
    confidence: parseFloat(confidence.toFixed(2)),
    positiveWordCount: positiveCount,
    negativeWordCount: negativeCount,
    entities: [],
    language: 'en',
    note: 'This analysis was performed using a basic local algorithm as no API key was provided'
  };
}

// Register function with the Function Manager
export default function register(functionManager: any) {
  functionManager.registerFunction(functionDefinition);
}