import { FunctionDefinition, FunctionContext } from '../types';
import axios from 'axios';

/**
 * Weather function to get current weather by city name
 */
export const functionDefinition: FunctionDefinition = {
  name: 'getWeather',
  description: 'Get the current weather for a specified city',
  type: 'cloud',
  apiKeyName: 'weather',
  parameters: {
    type: 'object',
    properties: {
      city: {
        type: 'string',
        description: 'The city name to get weather for'
      },
      units: {
        type: 'string',
        enum: ['metric', 'imperial'],
        description: 'Units to use for temperature (metric: Celsius, imperial: Fahrenheit)',
        default: 'metric'
      }
    },
    required: ['city']
  },
  handler: async (params: Record<string, any>, context?: FunctionContext) => {
    const city = params.city as string;
    const units = params.units as string | undefined;
    
    try {
      const apiKey = context?.apiKey;
      
      if (!apiKey) {
        throw new Error('Weather API key not provided');
      }
      
      const url = `https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(city)}&units=${units || 'metric'}&appid=${apiKey}`;
      
      const response = await axios.get(url);
      
      return {
        city: response.data.name,
        country: response.data.sys.country,
        temperature: response.data.main.temp,
        feels_like: response.data.main.feels_like,
        humidity: response.data.main.humidity,
        wind_speed: response.data.wind.speed,
        description: response.data.weather[0].description,
        icon: response.data.weather[0].icon
      };
    } catch (error) {
      if (axios.isAxiosError(error) && error.response) {
        if (error.response.status === 404) {
          throw new Error(`City "${city}" not found`);
        } else {
          throw new Error(`Weather API error: ${error.response.status} - ${error.response.data.message || 'Unknown error'}`);
        }
      }
      throw error;
    }
  }
};

// Register function with the Function Manager
export default function register(functionManager: any) {
  functionManager.registerFunction(functionDefinition);
}