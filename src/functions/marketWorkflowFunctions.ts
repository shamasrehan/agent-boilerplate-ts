import { FunctionDefinition, FunctionContext } from '../types';

/**
 * Market data fetching function for use in workflows
 */
export const fetchMarketDataFunction: FunctionDefinition = {
  name: 'fetchMarketData',
  description: 'Fetch market data for a specific market and sector',
  type: 'cloud',
  parameters: {
    type: 'object',
    properties: {
      market: {
        type: 'string',
        description: 'Market to fetch data for (e.g., NASDAQ, NYSE, S&P500)',
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
        description: 'Timeframe for the data',
        default: '1w'
      },
      limit: {
        type: 'number',
        description: 'Maximum number of records to return',
        default: 10
      }
    },
    required: ['market']
  },
  handler: async (params: Record<string, any>, context?: FunctionContext) => {
    const market = params.market as string;
    const sector = params.sector as string;
    const timeframe = params.timeframe as string;
    const limit = params.limit as number || 10;
    
    // Simulate API call delay
    await new Promise(resolve => setTimeout(resolve, 800));
    
    // Generate mock market data
    const date = new Date();
    const stocks = generateMockStockData(sector, limit);
    const marketSummary = generateMarketSummary(market, stocks);
    
    return {
      status: 'success',
      timestamp: new Date().toISOString(),
      market,
      sector,
      timeframe,
      summary: marketSummary,
      data: stocks
    };
  }
};

/**
 * Technical analysis function for use in workflows
 */
export const analyzeTechnicalIndicatorsFunction: FunctionDefinition = {
  name: 'analyzeTechnicalIndicators',
  description: 'Analyze technical indicators for market data',
  type: 'local',
  parameters: {
    type: 'object',
    properties: {
      indicators: {
        type: 'array',
        items: {
          type: 'string'
        },
        description: 'Technical indicators to analyze',
        default: ['macd', 'rsi', 'moving_average']
      },
      period: {
        type: 'number',
        description: 'Period for the indicators (e.g., 14 days)',
        default: 14
      },
      data: {
        type: 'array',
        description: 'Market data to analyze'
      }
    },
    required: ['indicators']
  },
  handler: async (params: Record<string, any>, context?: FunctionContext) => {
    const indicators = params.indicators as string[];
    const period = params.period as number || 14;
    const data = params.data || [];
    
    // Simulate processing delay
    await new Promise(resolve => setTimeout(resolve, 1200));
    
    // Generate technical analysis results
    const results: Record<string, any> = {};
    
    if (indicators.includes('rsi')) {
      results.rsi = {
        value: Math.floor(Math.random() * 100),
        interpretation: 'neutral',
        period
      };
      
      if (results.rsi.value > 70) {
        results.rsi.interpretation = 'overbought';
      } else if (results.rsi.value < 30) {
        results.rsi.interpretation = 'oversold';
      }
    }
    
    if (indicators.includes('macd')) {
      const macdValue = (Math.random() * 4) - 2;
      const macdSignal = (Math.random() * 4) - 2;
      
      results.macd = {
        value: parseFloat(macdValue.toFixed(2)),
        signal: parseFloat(macdSignal.toFixed(2)),
        histogram: parseFloat((macdValue - macdSignal).toFixed(2)),
        interpretation: macdValue > macdSignal ? 'bullish' : 'bearish'
      };
    }
    
    if (indicators.includes('moving_average')) {
      results.moving_average = {
        short: Math.floor(Math.random() * 1000) + 500,
        medium: Math.floor(Math.random() * 1000) + 500,
        long: Math.floor(Math.random() * 1000) + 500,
        interpretation: Math.random() > 0.5 ? 'bullish' : 'bearish'
      };
    }
    
    return {
      status: 'success',
      timestamp: new Date().toISOString(),
      indicators,
      period,
      results,
      summary: generateTechnicalAnalysisSummary(results)
    };
  }
};

/**
 * Market news sentiment analysis function for workflows
 */
export const marketSentimentFunction: FunctionDefinition = {
  name: 'analyzeMarketSentiment',
  description: 'Analyze sentiment from market news and social media',
  type: 'cloud',
  parameters: {
    type: 'object',
    properties: {
      subject: {
        type: 'string',
        description: 'Subject to analyze sentiment for (e.g., market news, specific stock)',
        default: 'market news'
      },
      sources: {
        type: 'array',
        items: {
          type: 'string'
        },
        description: 'Sources to analyze (e.g., financial_times, bloomberg, social_media)',
        default: ['financial_times', 'bloomberg', 'wsj']
      },
      limit: {
        type: 'number',
        description: 'Maximum number of sources to analyze',
        default: 10
      },
      timeframe: {
        type: 'string',
        description: 'Timeframe for the analysis',
        default: '1d'
      }
    },
    required: ['subject']
  },
  handler: async (params: Record<string, any>, context?: FunctionContext) => {
    const subject = params.subject as string;
    const sources = params.sources as string[] || ['financial_times', 'bloomberg', 'wsj'];
    const limit = params.limit as number || 10;
    const timeframe = params.timeframe as string || '1d';
    
    // Simulate API call delay
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Generate mock sentiment data
    const sourceSentiments = sources.slice(0, limit).map(source => {
      const sentimentScore = (Math.random() * 2) - 1; // -1 to 1
      
      let sentiment;
      if (sentimentScore > 0.3) {
        sentiment = 'positive';
      } else if (sentimentScore < -0.3) {
        sentiment = 'negative';
      } else {
        sentiment = 'neutral';
      }
      
      return {
        source,
        sentimentScore: parseFloat(sentimentScore.toFixed(2)),
        sentiment,
        confidence: parseFloat((0.5 + Math.random() * 0.5).toFixed(2)),
        articleCount: Math.floor(Math.random() * 20) + 1
      };
    });
    
    // Calculate average sentiment
    const totalSentiment = sourceSentiments.reduce((sum, item) => sum + item.sentimentScore, 0);
    const averageSentiment = parseFloat((totalSentiment / sourceSentiments.length).toFixed(2));
    
    let overallSentiment;
    if (averageSentiment > 0.3) {
      overallSentiment = 'positive';
    } else if (averageSentiment < -0.3) {
      overallSentiment = 'negative';
    } else {
      overallSentiment = 'neutral';
    }
    
    return {
      status: 'success',
      timestamp: new Date().toISOString(),
      subject,
      timeframe,
      sourcesAnalyzed: sourceSentiments.length,
      averageSentiment,
      overallSentiment,
      sourceSentiments,
      summary: generateSentimentSummary(subject, overallSentiment, averageSentiment, sourceSentiments)
    };
  }
};

/**
 * AI Market insights function for workflows
 */
export const generateAIInsightsFunction: FunctionDefinition = {
  name: 'generateAIInsights',
  description: 'Generate market insights using AI based on technical and sentiment analysis',
  type: 'local',
  parameters: {
    type: 'object',
    properties: {
      technicalAnalysis: {
        type: 'object',
        description: 'Technical analysis results'
      },
      sentimentAnalysis: {
        type: 'object',
        description: 'Sentiment analysis results'
      },
      marketData: {
        type: 'object',
        description: 'Market data'
      },
      options: {
        type: 'object',
        description: 'LLM options',
        properties: {
          temperature: {
            type: 'number',
            default: 0.5
          },
          maxTokens: {
            type: 'number',
            default: 1000
          }
        }
      }
    },
    required: ['technicalAnalysis', 'sentimentAnalysis']
  },
  handler: async (params: Record<string, any>, context?: FunctionContext) => {
    const technicalAnalysis = params.technicalAnalysis;
    const sentimentAnalysis = params.sentimentAnalysis;
    const marketData = params.marketData;
    const options = params.options || { temperature: 0.5, maxTokens: 1000 };
    
    // Get LLM Manager from context (if provided)
    const llmManager = context?.llmManager;
    
    if (!llmManager) {
      // If no LLM manager, generate a mock response
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      return {
        status: 'success',
        timestamp: new Date().toISOString(),
        insights: generateMockInsights(technicalAnalysis, sentimentAnalysis, marketData),
        recommendations: generateMockRecommendations(),
        riskAnalysis: {
          overallRisk: 'moderate',
          marketRisk: 'moderate',
          volatilityRisk: 'low',
          sentimentRisk: 'moderate'
        }
      };
    }
    
    // Generate a prompt for the LLM
    const prompt = generateInsightsPrompt(technicalAnalysis, sentimentAnalysis, marketData);
    
    // Use LLM to generate insights
    const analysis = await llmManager.generateCompletion(prompt, {
      temperature: options.temperature || 0.5,
      maxTokens: options.maxTokens || 1000
    });
    
    return {
      status: 'success',
      timestamp: new Date().toISOString(),
      insights: analysis,
      sourceData: {
        technical: technicalAnalysis?.summary,
        sentiment: sentimentAnalysis?.summary,
        market: marketData?.summary
      }
    };
  }
};

/**
 * Helper function to generate mock stock data
 */
function generateMockStockData(sector: string, limit: number) {
  const stocksBySection: Record<string, any[]> = {
    'Technology': [
      { symbol: 'AAPL', name: 'Apple Inc.' },
      { symbol: 'MSFT', name: 'Microsoft Corporation' },
      { symbol: 'GOOGL', name: 'Alphabet Inc.' },
      { symbol: 'AMZN', name: 'Amazon.com, Inc.' },
      { symbol: 'META', name: 'Meta Platforms, Inc.' },
      { symbol: 'TSLA', name: 'Tesla, Inc.' },
      { symbol: 'NVDA', name: 'NVIDIA Corporation' },
      { symbol: 'ADBE', name: 'Adobe Inc.' },
      { symbol: 'CRM', name: 'Salesforce, Inc.' },
      { symbol: 'NFLX', name: 'Netflix, Inc.' }
    ],
    'Healthcare': [
      { symbol: 'JNJ', name: 'Johnson & Johnson' },
      { symbol: 'PFE', name: 'Pfizer Inc.' },
      { symbol: 'UNH', name: 'UnitedHealth Group Incorporated' },
      { symbol: 'MRK', name: 'Merck & Co., Inc.' },
      { symbol: 'ABT', name: 'Abbott Laboratories' },
      { symbol: 'TMO', name: 'Thermo Fisher Scientific Inc.' },
      { symbol: 'BMY', name: 'Bristol-Myers Squibb Company' },
      { symbol: 'ABBV', name: 'AbbVie Inc.' },
      { symbol: 'LLY', name: 'Eli Lilly and Company' },
      { symbol: 'AMGN', name: 'Amgen Inc.' }
    ],
    'Finance': [
      { symbol: 'JPM', name: 'JPMorgan Chase & Co.' },
      { symbol: 'BAC', name: 'Bank of America Corporation' },
      { symbol: 'WFC', name: 'Wells Fargo & Company' },
      { symbol: 'C', name: 'Citigroup Inc.' },
      { symbol: 'GS', name: 'The Goldman Sachs Group, Inc.' },
      { symbol: 'MS', name: 'Morgan Stanley' },
      { symbol: 'BLK', name: 'BlackRock, Inc.' },
      { symbol: 'AXP', name: 'American Express Company' },
      { symbol: 'V', name: 'Visa Inc.' },
      { symbol: 'MA', name: 'Mastercard Incorporated' }
    ]
  };
  
  // Use stocks from the specified sector or default to Technology
  const baseStocks = stocksBySection[sector] || stocksBySection['Technology'];
  const selectedStocks = baseStocks.slice(0, Math.min(limit, baseStocks.length));
  
  // Generate random stock data
  return selectedStocks.map(stock => {
    const price = Math.floor(Math.random() * 500) + 50;
    const change = parseFloat((Math.random() * 20 - 10).toFixed(2));
    const percentChange = parseFloat(((change / price) * 100).toFixed(2));
    
    return {
      ...stock,
      price,
      change,
      percentChange,
      volume: Math.floor(Math.random() * 5000000) + 100000,
      marketCap: Math.floor(Math.random() * 1000) + 100, // in billions
      pe: parseFloat((Math.random() * 30 + 5).toFixed(2))
    };
  });
}

/**
 * Generate market summary from stock data
 */
function generateMarketSummary(market: string, stocks: any[]) {
  const gainers = stocks.filter(stock => stock.change > 0);
  const losers = stocks.filter(stock => stock.change < 0);
  
  const averageChange = parseFloat(
    (stocks.reduce((sum, stock) => sum + stock.percentChange, 0) / stocks.length).toFixed(2)
  );
  
  const totalVolume = stocks.reduce((sum, stock) => sum + stock.volume, 0);
  
  const indexValue = Math.floor(Math.random() * 15000) + 5000;
  const indexChange = parseFloat((averageChange * 50).toFixed(2));
  
  return {
    market,
    indexValue,
    change: indexChange,
    percentChange: averageChange,
    volume: totalVolume,
    gainers: gainers.length,
    losers: losers.length,
    unchanged: stocks.length - gainers.length - losers.length,
    trend: gainers.length > losers.length ? 'bullish' : gainers.length < losers.length ? 'bearish' : 'neutral'
  };
}

/**
 * Generate technical analysis summary
 */
function generateTechnicalAnalysisSummary(results: Record<string, any>) {
  const interpretations = Object.values(results).map((indicator: any) => indicator.interpretation);
  
  const bullishCount = interpretations.filter(interp => interp === 'bullish').length;
  const bearishCount = interpretations.filter(interp => interp === 'bearish').length;
  const neutralCount = interpretations.filter(interp => interp === 'neutral' || interp === 'overbought' || interp === 'oversold').length;
  
  let overallTrend;
  if (bullishCount > bearishCount + neutralCount) {
    overallTrend = 'strongly bullish';
  } else if (bullishCount > bearishCount) {
    overallTrend = 'moderately bullish';
  } else if (bearishCount > bullishCount + neutralCount) {
    overallTrend = 'strongly bearish';
  } else if (bearishCount > bullishCount) {
    overallTrend = 'moderately bearish';
  } else {
    overallTrend = 'neutral';
  }
  
  return {
    overallTrend,
    bullishIndicators: bullishCount,
    bearishIndicators: bearishCount,
    neutralIndicators: neutralCount,
    technicalSignal: overallTrend.includes('bullish') ? 'buy' : 
                     overallTrend.includes('bearish') ? 'sell' : 'hold'
  };
}

/**
 * Generate sentiment analysis summary
 */
function generateSentimentSummary(
  subject: string, 
  overallSentiment: string, 
  averageSentiment: number, 
  sourceSentiments: any[]
) {
  const positiveCount = sourceSentiments.filter(source => source.sentiment === 'positive').length;
  const negativeCount = sourceSentiments.filter(source => source.sentiment === 'negative').length;
  const neutralCount = sourceSentiments.filter(source => source.sentiment === 'neutral').length;
  
  const totalArticles = sourceSentiments.reduce((sum, source) => sum + source.articleCount, 0);
  
  let marketOutlook;
  if (averageSentiment > 0.5) {
    marketOutlook = 'very optimistic';
  } else if (averageSentiment > 0.1) {
    marketOutlook = 'cautiously optimistic';
  } else if (averageSentiment < -0.5) {
    marketOutlook = 'very pessimistic';
  } else if (averageSentiment < -0.1) {
    marketOutlook = 'cautiously pessimistic';
  } else {
    marketOutlook = 'neutral';
  }
  
  return {
    subject,
    overallSentiment,
    marketOutlook,
    sentimentBreakdown: {
      positive: positiveCount,
      neutral: neutralCount,
      negative: negativeCount
    },
    totalSources: sourceSentiments.length,
    totalArticles
  };
}

/**
 * Generate mock insights for the AI insights function (when no LLM is available)
 */
function generateMockInsights(technicalAnalysis: any, sentimentAnalysis: any, marketData: any) {
  const technicalTrend = technicalAnalysis?.summary?.overallTrend || 'neutral';
  const sentimentOutlook = sentimentAnalysis?.summary?.marketOutlook || 'neutral';
  const marketTrend = marketData?.summary?.trend || 'neutral';
  
  let insight = `Market Analysis Overview:\n\n`;
  
  if (technicalTrend.includes('bullish') && (sentimentOutlook.includes('optimistic') || marketTrend === 'bullish')) {
    insight += `The market shows strong bullish signals with aligned technical indicators and positive sentiment. Technical analysis indicates a ${technicalTrend} trend, while sentiment analysis suggests a ${sentimentOutlook} outlook. `;
    insight += `This alignment of technical and sentiment factors creates a favorable environment for growth in the short to medium term.\n\n`;
    insight += `Key growth sectors appear to be technology and consumer discretionary, with particular strength in cloud computing and e-commerce platforms.`;
  } 
  else if (technicalTrend.includes('bearish') && (sentimentOutlook.includes('pessimistic') || marketTrend === 'bearish')) {
    insight += `The market displays concerning bearish signals with aligned technical indicators and negative sentiment. Technical analysis indicates a ${technicalTrend} trend, while sentiment analysis suggests a ${sentimentOutlook} outlook. `;
    insight += `This alignment of negative factors suggests potential downside risk in the near term.\n\n`;
    insight += `Defensive sectors like utilities and consumer staples may offer relative safety, while technology and cyclicals face headwinds.`;
  }
  else {
    insight += `The market currently presents a mixed picture with some conflicting signals. Technical analysis indicates a ${technicalTrend} trend, while sentiment analysis suggests a ${sentimentOutlook} outlook. `;
    insight += `This divergence between technical and sentiment factors creates an uncertain environment with potential volatility.\n\n`;
    insight += `Selective opportunities exist in specific sectors, but broad market exposure should be approached with caution.`;
  }
  
  return insight;
}

/**
 * Generate mock recommendations
 */
function generateMockRecommendations() {
  const recommendations = [
    {
      action: 'buy',
      tickers: ['AAPL', 'MSFT', 'AMZN'],
      rationale: 'Strong technical indicators and positive sentiment'
    },
    {
      action: 'hold',
      tickers: ['GOOGL', 'META', 'NFLX'],
      rationale: 'Mixed signals suggest maintaining current positions'
    },
    {
      action: 'sell',
      tickers: ['IBM', 'INTC', 'CSCO'],
      rationale: 'Deteriorating technical patterns and negative sentiment'
    }
  ];
  
  // Randomly select one recommendation type
  return recommendations[Math.floor(Math.random() * recommendations.length)];
}

/**
 * Generate a prompt for the LLM to analyze market data
 */
function generateInsightsPrompt(technicalAnalysis: any, sentimentAnalysis: any, marketData: any) {
  return `
You are a senior financial analyst and market strategist. Please analyze the following market data and provide insights.

TECHNICAL ANALYSIS:
${JSON.stringify(technicalAnalysis, null, 2)}

SENTIMENT ANALYSIS:
${JSON.stringify(sentimentAnalysis, null, 2)}

MARKET DATA:
${JSON.stringify(marketData, null, 2)}

Based on this data, provide a comprehensive analysis including:
1. Overall market outlook and trend interpretation
2. Key insights from the technical indicators
3. Impact of market sentiment on likely price action
4. Potential opportunities and risks
5. Sector-specific observations
6. Actionable recommendations for investors

Provide your analysis in a well-structured, professional format with clear insights and actionable information.
`;
}

// Register functions with the Function Manager
export default function register(functionManager: any) {
  functionManager.registerFunction(fetchMarketDataFunction);
  functionManager.registerFunction(analyzeTechnicalIndicatorsFunction);
  functionManager.registerFunction(marketSentimentFunction);
  functionManager.registerFunction(generateAIInsightsFunction);
}