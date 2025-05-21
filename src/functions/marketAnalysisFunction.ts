import { FunctionDefinition, FunctionContext } from '../types';
import axios from 'axios';

/**
 * Market Analysis function that uses LLM to generate market insights
 */
export const functionDefinition: FunctionDefinition = {
  name: 'analyzeMarketData',
  description: 'Analyze market data and provide insights using LLM',
  type: 'local',
  parameters: {
    type: 'object',
    properties: {
      market: {
        type: 'string',
        description: 'Market to analyze (e.g., NASDAQ, NYSE, S&P500)',
        default: 'NASDAQ'
      },
      sector: {
        type: 'string',
        description: 'Specific sector to focus on (e.g., Technology, Healthcare)',
        default: 'Technology'
      },
      timeframe: {
        type: 'string',
        enum: ['1d', '1w', '1m', '3m', '6m', '1y'],
        description: 'Timeframe for the analysis',
        default: '1w'
      },
      analysisType: {
        type: 'string',
        enum: ['trend', 'forecast', 'volatility', 'recommendation', 'summary'],
        description: 'Type of analysis to perform',
        default: 'summary'
      }
    },
    required: ['market']
  },
  handler: async (params: Record<string, any>, context?: FunctionContext) => {
    const market = params.market as string;
    const sector = params.sector as string;
    const timeframe = params.timeframe as string;
    const analysisType = params.analysisType as string;
    
    try {
      // First, fetch market data from a mock API
      const marketData = await fetchMarketData(market, sector, timeframe);
      
      // Get LLM Manager from context (if provided)
      const llmManager = context?.llmManager;
      
      if (!llmManager) {
        return {
          error: 'LLM Manager not available in context',
          marketData
        };
      }
      
      // Generate a prompt for the LLM
      const prompt = generateAnalysisPrompt(
        market, 
        sector, 
        timeframe, 
        analysisType,
        marketData
      );
      
      // Use LLM to generate analysis
      const analysis = await llmManager.generateCompletion(prompt, {
        temperature: 0.5,
        maxTokens: 1000
      });
      
      return {
        market,
        sector,
        timeframe,
        analysisType,
        timestamp: new Date().toISOString(),
        marketSummary: marketData.summary,
        keyMetrics: marketData.keyMetrics,
        analysis: analysis,
        dataSource: 'Demo data for illustration'
      };
    } catch (error) {
      console.error('Error in market analysis:', error);
      return {
        error: error instanceof Error ? error.message : String(error),
        market,
        sector,
        timeframe
      };
    }
  }
};

/**
 * Mock function to fetch market data
 * In a real implementation, this would call an actual market data API
 */
async function fetchMarketData(market: string, sector: string, timeframe: string) {
  // Simulate API call delay
  await new Promise(resolve => setTimeout(resolve, 500));
  
  const date = new Date();
  const currentDate = date.toISOString().split('T')[0];
  
  // Generate random market data for demonstration
  const change = (Math.random() * 5 - 2.5).toFixed(2);
  const percentChange = (parseFloat(change) / 100).toFixed(2);
  const volume = Math.floor(Math.random() * 10000000) + 1000000;
  
  // Generate random stock data
  const stocks = [
    { symbol: 'AAPL', name: 'Apple Inc.' },
    { symbol: 'MSFT', name: 'Microsoft Corporation' },
    { symbol: 'GOOGL', name: 'Alphabet Inc.' },
    { symbol: 'AMZN', name: 'Amazon.com, Inc.' },
    { symbol: 'META', name: 'Meta Platforms, Inc.' },
    { symbol: 'TSLA', name: 'Tesla, Inc.' },
    { symbol: 'NVDA', name: 'NVIDIA Corporation' },
    { symbol: 'JPM', name: 'JPMorgan Chase & Co.' },
    { symbol: 'JNJ', name: 'Johnson & Johnson' },
    { symbol: 'V', name: 'Visa Inc.' }
  ].filter((_, index) => index < 5);  // Take first 5 stocks
  
  const stockData = stocks.map(stock => {
    const price = Math.floor(Math.random() * 500) + 50;
    const change = (Math.random() * 20 - 10).toFixed(2);
    const percentChange = ((parseFloat(change) / price) * 100).toFixed(2);
    
    return {
      ...stock,
      price,
      change: parseFloat(change),
      percentChange: parseFloat(percentChange),
      volume: Math.floor(Math.random() * 5000000) + 100000
    };
  });
  
  // Calculate some key metrics
  const keyMetrics = {
    averageVolume: Math.floor(stockData.reduce((sum, stock) => sum + stock.volume, 0) / stockData.length),
    averageChange: parseFloat((stockData.reduce((sum, stock) => sum + stock.percentChange, 0) / stockData.length).toFixed(2)),
    gainers: stockData.filter(stock => stock.change > 0).length,
    losers: stockData.filter(stock => stock.change < 0).length
  };
  
  // Generate market trend
  const trend = keyMetrics.gainers > keyMetrics.losers ? 'bullish' : 
               keyMetrics.gainers < keyMetrics.losers ? 'bearish' : 'neutral';
  
  return {
    market,
    sector,
    timeframe,
    date: currentDate,
    summary: {
      indexValue: Math.floor(Math.random() * 15000) + 5000,
      change: parseFloat(change),
      percentChange: parseFloat(percentChange),
      volume,
      trend
    },
    keyMetrics,
    topStocks: stockData
  };
}

/**
 * Generate a prompt for the LLM to analyze market data
 */
function generateAnalysisPrompt(
  market: string, 
  sector: string, 
  timeframe: string, 
  analysisType: string,
  marketData: any
): string {
  const marketSummary = marketData.summary;
  const metrics = marketData.keyMetrics;
  const stocks = marketData.topStocks.map((s: any) => 
    `${s.name} (${s.symbol}): $${s.price} (${s.change > 0 ? '+' : ''}${s.change}%)`
  ).join('\n');
  
  let analysisPrompt = '';
  switch (analysisType) {
    case 'trend':
      analysisPrompt = `Analyze the current trend in the ${market} ${sector} sector over the ${timeframe} timeframe. Explain the factors driving this trend.`;
      break;
    case 'forecast':
      analysisPrompt = `Based on the current data, provide a forecast for the ${market} ${sector} sector for the next month.`;
      break;
    case 'volatility':
      analysisPrompt = `Analyze the volatility in the ${market} ${sector} sector and explain what this means for investors.`;
      break;
    case 'recommendation':
      analysisPrompt = `Based on the current market conditions, provide investment recommendations for the ${market} ${sector} sector.`;
      break;
    case 'summary':
    default:
      analysisPrompt = `Provide a concise summary of the current state of the ${market} ${sector} sector over the ${timeframe} timeframe.`;
  }
  
  return `
You are a financial market analyst. Analyze the following market data and provide insights.

MARKET: ${market}
SECTOR: ${sector}
TIMEFRAME: ${timeframe}
DATE: ${marketData.date}

MARKET SUMMARY:
- Index Value: ${marketSummary.indexValue}
- Change: ${marketSummary.change > 0 ? '+' : ''}${marketSummary.change} (${marketSummary.percentChange}%)
- Volume: ${marketSummary.volume.toLocaleString()}
- Trend: ${marketSummary.trend}

KEY METRICS:
- Average Volume: ${metrics.averageVolume.toLocaleString()}
- Average Change: ${metrics.averageChange}%
- Gainers: ${metrics.gainers}
- Losers: ${metrics.losers}

TOP STOCKS:
${stocks}

${analysisPrompt}

Provide your analysis in a professional, concise format with clear insights and actionable information. Include specific references to the provided data.
`;
}

// Register function with the Function Manager
export default function register(functionManager: any) {
  functionManager.registerFunction(functionDefinition);
}